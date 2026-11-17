const { esClient } = require('../../config/elasticsearch');
const { env } = require('../../config/env');
const { NotFoundError } = require('../../core/exceptions');
const { safeCacheGet, safeCacheSet, safeCacheInvalidate } = require('../../core/helpers/cache.helper');

class UsuarioService {
  constructor(usuarioRepository, redisClient) {
    this.usuarioRepository = usuarioRepository;
    this.redisClient = redisClient;
    this.listKeys = new Set();
  }

  trackListKey(cacheKey) {
    this.listKeys.add(cacheKey);
  }

  async getCache(key) {
    return safeCacheGet(this.redisClient, key);
  }

  async findAll({
    page = 1, limit = 10, isActive, role,
  } = {}) {
    const cacheKey = `users:all:${page}:${limit}:${isActive ?? ''}:${role ?? ''}`;
    const cached = await this.getCache(cacheKey);
    if (cached) {
      return cached;
    }

    const result = await this.usuarioRepository.findAll({
      page, limit, isActive, role,
    });

    await safeCacheSet(this.redisClient, cacheKey, result, env.USER_CACHE_TTL);
    this.trackListKey(cacheKey);

    return result;
  }

  async findById(id) {
    const cacheKey = `users:${id}`;
    const cached = await this.getCache(cacheKey);
    if (cached) {
      return cached;
    }

    const user = await this.usuarioRepository.findById(id);
    if (!user) {
      throw new NotFoundError('Usuario no encontrado');
    }

    await safeCacheSet(this.redisClient, cacheKey, user, env.USER_CACHE_TTL);

    return user;
  }

  async update(id, updateDto) {
    const existing = await this.usuarioRepository.findById(id);
    if (!existing) {
      throw new NotFoundError('Usuario no encontrado');
    }

    const updated = await this.usuarioRepository.update(id, updateDto);

    await this.indexUser(updated);
    await this.invalidateCache();
    await safeCacheInvalidate(this.redisClient, [`users:${id}`]);

    return updated;
  }

  async updateRoles(id, roleNames, assignedById) {
    const existing = await this.usuarioRepository.findById(id);
    if (!existing) {
      throw new NotFoundError('Usuario no encontrado');
    }

    const updated = await this.usuarioRepository.replaceRoles(id, roleNames, assignedById);

    await this.indexUser(updated);
    await this.invalidateCache();
    await safeCacheInvalidate(this.redisClient, [`users:${id}`]);

    return updated;
  }

  async deactivate(id) {
    const existing = await this.usuarioRepository.findById(id);
    if (!existing) {
      throw new NotFoundError('Usuario no encontrado');
    }

    await this.usuarioRepository.deactivate(id);

    try {
      await esClient.delete({ index: env.USER_INDEX, id: existing.uuid });
    } catch (error) {
      // ES delete is non-blocking
    }

    await this.invalidateCache();
    await safeCacheInvalidate(this.redisClient, [`users:${id}`]);
  }

  async indexUser(user) {
    try {
      await esClient.index({
        index: env.USER_INDEX,
        id: user.uuid,
        document: {
          id: user.id,
          uuid: user.uuid,
          email: user.email,
          nombre: user.nombre,
          cedula: user.documentNumber,
          roles: user.roles,
          isActive: Boolean(user.isActive),
          createdAt: user.createdAt,
          updatedAt: user.updatedAt,
        },
      });
    } catch (error) {
      // ES indexing is non-blocking
    }
  }

  async search(query) {
    try {
      const result = await esClient.search({
        index: env.USER_INDEX,
        query: {
          multi_match: {
            query,
            fields: ['nombre', 'email', 'cedula'],
            fuzziness: 'AUTO',
          },
        },
      });
      return result.hits.hits.map((hit) => hit._source); // eslint-disable-line no-underscore-dangle
    } catch (error) {
      return [];
    }
  }

  async invalidateCache() {
    const keys = Array.from(this.listKeys);
    await safeCacheInvalidate(this.redisClient, keys);
    this.listKeys.clear();
  }
}

module.exports = UsuarioService;
