const { esClient } = require('../../config/elasticsearch');
const { env } = require('../../config/env');
const { NotFoundError, ConflictError } = require('../../core/exceptions');

const ES_INDEX = 'countries';
const CACHE_PREFIX = 'countries';

class CountryService {
  constructor(countryRepository, redisClient) {
    this.countryRepository = countryRepository;
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

  async indexDocument(country) {
    try {
      await esClient.index({
        index: ES_INDEX,
        id: String(country.id),
        document: {
          id: country.id,
          uuid: country.uuid,
          name: country.name,
          isoCode: country.isoCode,
          isoCode3: country.isoCode3,
          phoneCode: country.phoneCode,
          active: country.active,
          createdAt: country.created_at,
          updatedAt: country.updated_at,
        },
      });
    } catch (error) {
      // La indexación en Elasticsearch no bloquea la operación
    }
  }

  async create(countryDto) {
    const existingByName = await this.countryRepository.findByName(countryDto.name);
    if (existingByName) {
      throw new ConflictError('Ya existe un país con ese nombre');
    }

    const existingByIsoCode = await this.countryRepository.findByIsoCode(countryDto.isoCode);
    if (existingByIsoCode) {
      throw new ConflictError('Ya existe un país con ese código ISO');
    }

    const country = await this.countryRepository.create(countryDto);
    await this.indexDocument(country);
    await this.invalidateCache();

    return country;
  }

  async findAll({ page = 1, limit = 10 } = {}) {
    const cacheKey = `${CACHE_PREFIX}:all:${page}:${limit}`;
    const cached = await this.getCache(cacheKey);
    if (cached) {
      return cached;
    }

    const result = await this.countryRepository.findAll({ page, limit });

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

    const country = await this.countryRepository.findById(id);
    if (!country) {
      throw new NotFoundError('País no encontrado');
    }

    await this.redisClient.set(cacheKey, JSON.stringify(country), env.CATALOG_CACHE_TTL);

    return country;
  }

  async update(id, countryDto) {
    const existing = await this.countryRepository.findById(id);
    if (!existing) {
      throw new NotFoundError('País no encontrado');
    }

    if (countryDto.name && countryDto.name !== existing.name) {
      const duplicate = await this.countryRepository.findByName(countryDto.name);
      if (duplicate) {
        throw new ConflictError('Ya existe un país con ese nombre');
      }
    }

    if (countryDto.isoCode && countryDto.isoCode !== existing.isoCode) {
      const duplicate = await this.countryRepository.findByIsoCode(countryDto.isoCode);
      if (duplicate) {
        throw new ConflictError('Ya existe un país con ese código ISO');
      }
    }

    const updated = await this.countryRepository.update(id, countryDto);
    await this.indexDocument(updated);
    await this.invalidateCache(id);

    return updated;
  }

  async delete(id) {
    const existing = await this.countryRepository.findById(id);
    if (!existing) {
      throw new NotFoundError('País no encontrado');
    }

    const activeDepartments = await this.countryRepository.countActiveDepartments(id);
    if (activeDepartments > 0) {
      throw new ConflictError('No se puede eliminar el país porque tiene departamentos asociados');
    }

    await this.countryRepository.delete(id);

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
            fields: ['name', 'isoCode', 'isoCode3'],
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

    return this.countryRepository.search(searchTerm);
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

module.exports = CountryService;
