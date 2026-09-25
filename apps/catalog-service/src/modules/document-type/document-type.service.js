const { esClient } = require('../../config/elasticsearch');
const { env } = require('../../config/env');
const { NotFoundError, ConflictError } = require('../../core/exceptions');

const ES_INDEX = 'document-types';

class DocumentTypeService {
  constructor(documentTypeRepository, redisClient) {
    this.documentTypeRepository = documentTypeRepository;
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

  async create(documentTypeDto) {
    const existingByName = await this.documentTypeRepository.findByName(documentTypeDto.name);
    if (existingByName) {
      throw new ConflictError('Document type name already exists');
    }

    if (documentTypeDto.code) {
      const { code } = documentTypeDto;
      const existingByCode = await this.documentTypeRepository.findByCode(code);
      if (existingByCode) {
        throw new ConflictError('Document type code already exists');
      }
    }

    const documentType = await this.documentTypeRepository.create(documentTypeDto);

    try {
      await esClient.index({
        index: ES_INDEX,
        id: String(documentType.id),
        document: {
          id: documentType.id,
          uuid: documentType.uuid,
          name: documentType.name,
          code: documentType.code,
          requiresCheckDigit: documentType.requiresCheckDigit,
          active: documentType.active,
          createdAt: documentType.created_at,
          updatedAt: documentType.updated_at,
        },
      });
    } catch (error) {
      // ES indexing is non-blocking
    }

    await this.invalidateCache();

    return documentType;
  }

  async findAll({ page = 1, limit = 10 } = {}) {
    const cacheKey = `documentTypes:all:${page}:${limit}`;
    const cached = await this.getCache(cacheKey);
    if (cached) {
      return cached;
    }

    const result = await this.documentTypeRepository.findAll({ page, limit });

    await this.redisClient.set(cacheKey, JSON.stringify(result), env.CATALOG_CACHE_TTL);
    this.trackListKey(cacheKey);

    return result;
  }

  async findById(id) {
    const cacheKey = `documentTypes:${id}`;
    const cached = await this.getCache(cacheKey);
    if (cached) {
      return cached;
    }

    const documentType = await this.documentTypeRepository.findById(id);
    if (!documentType) {
      throw new NotFoundError('Document type not found');
    }

    await this.redisClient.set(cacheKey, JSON.stringify(documentType), env.CATALOG_CACHE_TTL);

    return documentType;
  }

  async update(id, documentTypeDto) {
    const existing = await this.documentTypeRepository.findById(id);
    if (!existing) {
      throw new NotFoundError('Document type not found');
    }

    if (documentTypeDto.name && documentTypeDto.name !== existing.name) {
      const duplicate = await this.documentTypeRepository.findByName(documentTypeDto.name);
      if (duplicate) {
        throw new ConflictError('Document type name already exists');
      }
    }

    if (documentTypeDto.code && documentTypeDto.code !== existing.code) {
      const { code } = documentTypeDto;
      const duplicate = await this.documentTypeRepository.findByCode(code);
      if (duplicate) {
        throw new ConflictError('Document type code already exists');
      }
    }

    const updated = await this.documentTypeRepository.update(id, documentTypeDto);

    try {
      await esClient.index({
        index: ES_INDEX,
        id: String(updated.id),
        document: {
          id: updated.id,
          uuid: updated.uuid,
          name: updated.name,
          code: updated.code,
          requiresCheckDigit: updated.requiresCheckDigit,
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
    const existing = await this.documentTypeRepository.findById(id);
    if (!existing) {
      throw new NotFoundError('Document type not found');
    }

    await this.documentTypeRepository.delete(id);

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
            fields: ['name', 'code'],
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

    return this.documentTypeRepository.search(searchTerm);
  }

  async invalidateCache() {
    const keys = Array.from(this.listKeys);
    await Promise.all(keys.map((key) => this.redisClient.del(key)));
    this.listKeys.clear();
  }
}

module.exports = DocumentTypeService;
