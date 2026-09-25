const { esClient } = require('../../config/elasticsearch');
const { env } = require('../../config/env');
const { NotFoundError, ConflictError } = require('../../core/exceptions');

const ES_INDEX = 'cities';

class CityService {
  constructor(cityRepository, redisClient) {
    this.cityRepository = cityRepository;
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

  async create(cityDto) {
    const existing = await this.cityRepository.findByName(cityDto.name);
    if (existing) {
      throw new ConflictError('City name already exists');
    }

    const city = await this.cityRepository.create(cityDto);

    try {
      await esClient.index({
        index: ES_INDEX,
        id: String(city.id),
        document: {
          id: city.id,
          uuid: city.uuid,
          name: city.name,
          daneCode: city.daneCode,
          stateId: city.stateId,
          active: city.active,
          createdAt: city.created_at,
          updatedAt: city.updated_at,
        },
      });
    } catch (error) {
      // ES indexing is non-blocking
    }

    await this.invalidateCache();

    return city;
  }

  async findAll({ page = 1, limit = 10 } = {}) {
    const cacheKey = `cities:all:${page}:${limit}`;
    const cached = await this.getCache(cacheKey);
    if (cached) {
      return cached;
    }

    const result = await this.cityRepository.findAll({ page, limit });

    await this.redisClient.set(cacheKey, JSON.stringify(result), env.CATALOG_CACHE_TTL);
    this.trackListKey(cacheKey);

    return result;
  }

  async findById(id) {
    const cacheKey = `cities:${id}`;
    const cached = await this.getCache(cacheKey);
    if (cached) {
      return cached;
    }

    const city = await this.cityRepository.findById(id);
    if (!city) {
      throw new NotFoundError('City not found');
    }

    await this.redisClient.set(cacheKey, JSON.stringify(city), env.CATALOG_CACHE_TTL);

    return city;
  }

  async findByStateId(stateId) {
    const cacheKey = `cities:state:${stateId}`;
    const cached = await this.getCache(cacheKey);
    if (cached) {
      return cached;
    }

    const cities = await this.cityRepository.findByStateId(stateId);

    await this.redisClient.set(cacheKey, JSON.stringify(cities), env.CATALOG_CACHE_TTL);
    this.trackListKey(cacheKey);

    return cities;
  }

  async update(id, cityDto) {
    const existing = await this.cityRepository.findById(id);
    if (!existing) {
      throw new NotFoundError('City not found');
    }

    if (cityDto.name && cityDto.name !== existing.name) {
      const duplicate = await this.cityRepository.findByName(cityDto.name);
      if (duplicate) {
        throw new ConflictError('City name already exists');
      }
    }

    const updated = await this.cityRepository.update(id, cityDto);

    try {
      await esClient.index({
        index: ES_INDEX,
        id: String(updated.id),
        document: {
          id: updated.id,
          uuid: updated.uuid,
          name: updated.name,
          daneCode: updated.daneCode,
          stateId: updated.stateId,
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
    const existing = await this.cityRepository.findById(id);
    if (!existing) {
      throw new NotFoundError('City not found');
    }

    await this.cityRepository.delete(id);

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
            fields: ['name', 'daneCode'],
            fuzziness: 'AUTO',
          },
        },
      });
      const hits = result?.hits?.hits || [];
      if (hits.length > 0) {
        return hits.map((hit) => hit._source); // eslint-disable-line no-underscore-dangle
      }
    } catch (error) {
      // Elasticsearch fallback to relational database
    }

    return this.cityRepository.search(searchTerm);
  }

  async invalidateCache() {
    const keys = Array.from(this.listKeys);
    await Promise.all(keys.map((key) => this.redisClient.del(key)));
    this.listKeys.clear();
  }
}

module.exports = CityService;
