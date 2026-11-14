const { esClient } = require('../../config/elasticsearch');
const { env } = require('../../config/env');
const { NotFoundError, ConflictError } = require('../../core/exceptions');

const ES_INDEX = 'cities';
const CACHE_PREFIX = 'cities';

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

  async indexDocument(city) {
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
      // La indexación en Elasticsearch no bloquea la operación
    }
  }

  async create(cityDto) {
    const existing = await this.cityRepository.findByNameAndState(cityDto.name, cityDto.stateId);
    if (existing) {
      throw new ConflictError('Ya existe una ciudad con ese nombre en el departamento indicado');
    }

    const city = await this.cityRepository.create(cityDto);
    await this.indexDocument(city);
    await this.invalidateCache();

    return city;
  }

  async findAll({ page = 1, limit = 10 } = {}) {
    const cacheKey = `${CACHE_PREFIX}:all:${page}:${limit}`;
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
    const cacheKey = `${CACHE_PREFIX}:${id}`;
    const cached = await this.getCache(cacheKey);
    if (cached) {
      return cached;
    }

    const city = await this.cityRepository.findById(id);
    if (!city) {
      throw new NotFoundError('Ciudad no encontrada');
    }

    await this.redisClient.set(cacheKey, JSON.stringify(city), env.CATALOG_CACHE_TTL);

    return city;
  }

  async findByStateId(stateId) {
    const cacheKey = `${CACHE_PREFIX}:state:${stateId}`;
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
      throw new NotFoundError('Ciudad no encontrada');
    }

    const name = cityDto.name ?? existing.name;
    const stateId = cityDto.stateId ?? existing.stateId;
    if (name !== existing.name || stateId !== existing.stateId) {
      const duplicate = await this.cityRepository.findByNameAndState(name, stateId);
      if (duplicate) {
        throw new ConflictError('Ya existe una ciudad con ese nombre en el departamento indicado');
      }
    }

    const updated = await this.cityRepository.update(id, cityDto);
    await this.indexDocument(updated);
    await this.invalidateCache(id);

    return updated;
  }

  async delete(id) {
    const existing = await this.cityRepository.findById(id);
    if (!existing) {
      throw new NotFoundError('Ciudad no encontrada');
    }

    await this.cityRepository.delete(id);

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
      // Si Elasticsearch no responde se usa la base de datos relacional
    }

    return this.cityRepository.search(searchTerm);
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

module.exports = CityService;
