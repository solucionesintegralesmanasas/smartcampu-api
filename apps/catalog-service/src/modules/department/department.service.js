const { esClient } = require('../../config/elasticsearch');
const { env } = require('../../config/env');
const { NotFoundError, ConflictError } = require('../../core/exceptions');

const ES_INDEX = 'departments';

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

  async create(departmentDto) {
    const existing = await this.departmentRepository.findByName(departmentDto.name);
    if (existing) {
      throw new ConflictError('Department name already exists');
    }

    const department = await this.departmentRepository.create(departmentDto);

    try {
      await esClient.index({
        index: ES_INDEX,
        id: String(department.id),
        document: {
          id: department.id,
          uuid: department.uuid,
          name: department.name,
          daneCode: department.daneCode,
          active: department.active,
          createdAt: department.created_at,
          updatedAt: department.updated_at,
        },
      });
    } catch (error) {
      // ES indexing is non-blocking
    }

    await this.invalidateCache();

    return department;
  }

  async findAll({ page = 1, limit = 10 } = {}) {
    const cacheKey = `departments:all:${page}:${limit}`;
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
    const cacheKey = `departments:${id}`;
    const cached = await this.getCache(cacheKey);
    if (cached) {
      return cached;
    }

    const department = await this.departmentRepository.findById(id);
    if (!department) {
      throw new NotFoundError('Department not found');
    }

    await this.redisClient.set(cacheKey, JSON.stringify(department), env.CATALOG_CACHE_TTL);

    return department;
  }

  async update(id, departmentDto) {
    const existing = await this.departmentRepository.findById(id);
    if (!existing) {
      throw new NotFoundError('Department not found');
    }

    if (departmentDto.name && departmentDto.name !== existing.name) {
      const duplicate = await this.departmentRepository.findByName(departmentDto.name);
      if (duplicate) {
        throw new ConflictError('Department name already exists');
      }
    }

    const updated = await this.departmentRepository.update(id, departmentDto);

    try {
      await esClient.index({
        index: ES_INDEX,
        id: String(updated.id),
        document: {
          id: updated.id,
          uuid: updated.uuid,
          name: updated.name,
          daneCode: updated.daneCode,
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
    const existing = await this.departmentRepository.findById(id);
    if (!existing) {
      throw new NotFoundError('Department not found');
    }

    await this.departmentRepository.delete(id);

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

    return this.departmentRepository.search(searchTerm);
  }

  async invalidateCache() {
    const keys = Array.from(this.listKeys);
    await Promise.all(keys.map((key) => this.redisClient.del(key)));
    this.listKeys.clear();
  }
}

module.exports = DepartmentService;
