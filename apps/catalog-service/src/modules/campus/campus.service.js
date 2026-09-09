const { esClient } = require('../../config/elasticsearch');
const { env } = require('../../config/env');
const { NotFoundError, ConflictError } = require('../../core/exceptions');

const ES_INDEX = 'campuses';

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

  async create(campusDto) {
    const existing = await this.campusRepository.findByName(campusDto.name);
    if (existing) {
      throw new ConflictError('Campus name already exists');
    }

    const campus = await this.campusRepository.create(campusDto);

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
      // ES indexing is non-blocking
    }

    await this.invalidateCache();

    return campus;
  }

  async findAll({ page = 1, limit = 10 } = {}) {
    const cacheKey = `campuses:all:${page}:${limit}`;
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
    const cacheKey = `campuses:${id}`;
    const cached = await this.getCache(cacheKey);
    if (cached) {
      return cached;
    }

    const campus = await this.campusRepository.findById(id);
    if (!campus) {
      throw new NotFoundError('Campus not found');
    }

    await this.redisClient.set(cacheKey, JSON.stringify(campus), env.CATALOG_CACHE_TTL);

    return campus;
  }

  async findByCityId(cityId) {
    const cacheKey = `campuses:city:${cityId}`;
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
      throw new NotFoundError('Campus not found');
    }

    if (campusDto.name && campusDto.name !== existing.name) {
      const duplicate = await this.campusRepository.findByName(campusDto.name);
      if (duplicate) {
        throw new ConflictError('Campus name already exists');
      }
    }

    const updated = await this.campusRepository.update(id, campusDto);

    try {
      await esClient.index({
        index: ES_INDEX,
        id: String(updated.id),
        document: {
          id: updated.id,
          uuid: updated.uuid,
          name: updated.name,
          address: updated.address,
          phone: updated.phone,
          cityId: updated.cityId,
          active: updated.active,
          createdAt: updated.created_at,
          updatedAt: updated.updated_at,
        },
      });
    } catch (error) {
      // ES re-indexing is non-blocking
    }

    await this.invalidateCache();

    return updated;
  }

  async delete(id) {
    const existing = await this.campusRepository.findById(id);
    if (!existing) {
      throw new NotFoundError('Campus not found');
    }

    await this.campusRepository.delete(id);

    try {
      await esClient.delete({
        index: ES_INDEX,
        id: String(id),
      });
    } catch (error) {
      // ES delete is non-blocking
    }

    await this.invalidateCache();
  }

  async search(query) {
    try {
      const result = await esClient.search({
        index: ES_INDEX,
        query: {
          multi_match: {
            query,
            fields: ['name', 'address', 'phone'],
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
    await Promise.all(keys.map((key) => this.redisClient.del(key)));
    this.listKeys.clear();
  }
}

module.exports = CampusService;
