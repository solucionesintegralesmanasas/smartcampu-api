const { esClient } = require('../../config/elasticsearch');
const { env } = require('../../config/env');
const { NotFoundError, ConflictError } = require('../../core/exceptions');

const ES_INDEX = 'departments';
const CACHE_PREFIX = 'departments';

class DepartmentService {
  constructor(departmentRepository, redisClient) {
    this.departmentRepository = departmentRepository;
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

  async indexDocument(department) {
    try {
      await esClient.index({
        index: ES_INDEX,
        id: String(department.id),
        document: {
          id: department.id,
          uuid: department.uuid,
          name: department.name,
          daneCode: department.daneCode,
          countryId: department.countryId,
          active: department.active,
          createdAt: department.created_at,
          updatedAt: department.updated_at,
        },
      });
    } catch (error) {
      // La indexación en Elasticsearch no bloquea la operación
    }
  }

  async create(departmentDto) {
    const existing = await this.departmentRepository.findByNameAndCountry(
      departmentDto.name,
      departmentDto.countryId,
    );
    if (existing) {
      throw new ConflictError('Ya existe un departamento con ese nombre en el país indicado');
    }

    const department = await this.departmentRepository.create(departmentDto);
    await this.indexDocument(department);
    await this.invalidateCache();

    return department;
  }

  async findAll({ page = 1, limit = 10 } = {}) {
    const cacheKey = `${CACHE_PREFIX}:all:${page}:${limit}`;
    const cached = await this.getCache(cacheKey);
    if (cached) {
      return cached;
    }

    const result = await this.departmentRepository.findAll({ page, limit });

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

    const department = await this.departmentRepository.findById(id);
    if (!department) {
      throw new NotFoundError('Departamento no encontrado');
    }

    await this.redisClient.set(cacheKey, JSON.stringify(department), env.CATALOG_CACHE_TTL);

    return department;
  }

  async update(id, departmentDto) {
    const existing = await this.departmentRepository.findById(id);
    if (!existing) {
      throw new NotFoundError('Departamento no encontrado');
    }

    const name = departmentDto.name ?? existing.name;
    const countryId = departmentDto.countryId ?? existing.countryId;
    if (name !== existing.name || countryId !== existing.countryId) {
      const duplicate = await this.departmentRepository.findByNameAndCountry(name, countryId);
      if (duplicate) {
        throw new ConflictError('Ya existe un departamento con ese nombre en el país indicado');
      }
    }

    const updated = await this.departmentRepository.update(id, departmentDto);
    await this.indexDocument(updated);
    await this.invalidateCache(id);

    return updated;
  }

  async delete(id) {
    const existing = await this.departmentRepository.findById(id);
    if (!existing) {
      throw new NotFoundError('Departamento no encontrado');
    }

    await this.departmentRepository.delete(id);

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

    return this.departmentRepository.search(searchTerm);
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

module.exports = DepartmentService;
