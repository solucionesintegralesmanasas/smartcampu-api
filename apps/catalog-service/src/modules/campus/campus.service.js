const { esClient } = require('../../config/elasticsearch');
const { env } = require('../../config/env');
const { NotFoundError, ConflictError } = require('../../core/exceptions');

const ES_INDEX = 'campuses';
const CACHE_PREFIX = 'campuses';

class CampusService {
  constructor(campusRepository, redisClient) {
    this.campusRepository = campusRepository;
    this.redisClient = redisClient;
    this.listKeys = new Set();
  }

  trackListKey(cacheKey) {
    this.listKeys.add(cacheKey);
  }

  async getCache(key) {
    const cached = await this.redisClient.get(key);
    return cached ? JSON.parse(cached) : null;
  }

  async indexDocument(campus) {
    try {
      await esClient.index({
        index: ES_INDEX,
        id: String(campus.id),
        document: {
          id: campus.id,
          uuid: campus.uuid,
          name: campus.name,
          address: campus.address,
          phone: campus.phone,
          cityId: campus.cityId,
          active: campus.active,
          createdAt: campus.created_at,
          updatedAt: campus.updated_at,
        },
      });
    } catch (error) {
      // La indexación en Elasticsearch no bloquea la operación
    }
  }

  async create(campusDto) {
    const existing = await this.campusRepository.findByName(campusDto.name);
    if (existing) {
      throw new ConflictError('Ya existe una sede con ese nombre');
    }

    const campus = await this.campusRepository.create(campusDto);
    await this.indexDocument(campus);
    await this.invalidateCache();

    return campus;
  }

  async findAll({ page = 1, limit = 10 } = {}) {
    const cacheKey = `${CACHE_PREFIX}:all:${page}:${limit}`;
    const cached = await this.getCache(cacheKey);
    if (cached) {
      return cached;
    }

    const result = await this.campusRepository.findAll({ page, limit });

    await this.redisClient.set(cacheKey, JSON.stringify(result), env.CATALOG_CACHE_TTL);
    this.trackListKey(cacheKey);

    return result;
  }

  async findById(id) {
    const cacheKey = `${CACHE_PREFIX}:${id}`;
    const cached = await this.getCache(cacheKey);
    if (cached) {
      return cached;
    }

    const campus = await this.campusRepository.findById(id);
    if (!campus) {
      throw new NotFoundError('Sede no encontrada');
    }

    await this.redisClient.set(cacheKey, JSON.stringify(campus), env.CATALOG_CACHE_TTL);

    return campus;
  }

  async findByCityId(cityId) {
    const cacheKey = `${CACHE_PREFIX}:city:${cityId}`;
    const cached = await this.getCache(cacheKey);
    if (cached) {
      return cached;
    }

    const campuses = await this.campusRepository.findByCityId(cityId);

    await this.redisClient.set(cacheKey, JSON.stringify(campuses), env.CATALOG_CACHE_TTL);
    this.trackListKey(cacheKey);

    return campuses;
  }

  async update(id, campusDto) {
    const existing = await this.campusRepository.findById(id);
    if (!existing) {
      throw new NotFoundError('Sede no encontrada');
    }

    if (campusDto.name && campusDto.name !== existing.name) {
      const duplicate = await this.campusRepository.findByName(campusDto.name);
      if (duplicate) {
        throw new ConflictError('Ya existe una sede con ese nombre');
      }
    }

    const updated = await this.campusRepository.update(id, campusDto);
    await this.indexDocument(updated);
    await this.invalidateCache(id);

    return updated;
  }

  async delete(id) {
    const existing = await this.campusRepository.findById(id);
    if (!existing) {
      throw new NotFoundError('Sede no encontrada');
    }

    await this.campusRepository.delete(id);

    try {
      await esClient.delete({
        index: ES_INDEX,
        id: String(id),
      });
    } catch (error) {
      // La eliminación en Elasticsearch no bloquea la operación
    }

    await this.invalidateCache(id);
  }

  async search(query) {
    const searchTerm = typeof query === 'string' ? query : query?.search || '';
    if (!searchTerm || !searchTerm.trim()) {
      return [];
    }

    try {
      const result = await esClient.search({
        index: ES_INDEX,
        query: {
          multi_match: {
            query: searchTerm,
            fields: ['name', 'address', 'phone'],
            fuzziness: 'AUTO',
          },
        },
      });
      const hits = result?.hits?.hits || [];
      if (hits.length > 0) {
        return hits.map((hit) => hit._source); // eslint-disable-line no-underscore-dangle
      }
    } catch (error) {
      // Si Elasticsearch no responde se usa la base de datos relacional
    }

    return this.campusRepository.search(searchTerm);
  }

  async invalidateCache(id) {
    const keys = Array.from(this.listKeys);
    if (id !== undefined && id !== null) {
      keys.push(`${CACHE_PREFIX}:${id}`);
    }
    await Promise.all(keys.map((key) => this.redisClient.del(key)));
    this.listKeys.clear();
  }
}

module.exports = CampusService;
