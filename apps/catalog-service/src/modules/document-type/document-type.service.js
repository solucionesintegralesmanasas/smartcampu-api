const { esClient } = require('../../config/elasticsearch');
const { env } = require('../../config/env');
const { NotFoundError, ConflictError } = require('../../core/exceptions');

const ES_INDEX = 'document-types';
const CACHE_PREFIX = 'documentTypes';

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

  async indexDocument(documentType) {
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
          appliesToNaturalPerson: documentType.appliesToNaturalPerson,
          appliesToLegalEntity: documentType.appliesToLegalEntity,
          active: documentType.active,
          createdAt: documentType.created_at,
          updatedAt: documentType.updated_at,
        },
      });
    } catch (error) {
      // La indexación en Elasticsearch no bloquea la operación
    }
  }

  async create(documentTypeDto) {
    const existingByName = await this.documentTypeRepository.findByName(documentTypeDto.name);
    if (existingByName) {
      throw new ConflictError('Ya existe un tipo de documento con ese nombre');
    }

    const existingByCode = await this.documentTypeRepository.findByCode(documentTypeDto.code);
    if (existingByCode) {
      throw new ConflictError('Ya existe un tipo de documento con ese código');
    }

    const documentType = await this.documentTypeRepository.create(documentTypeDto);
    await this.indexDocument(documentType);
    await this.invalidateCache();

    return documentType;
  }

  async findAll({ page = 1, limit = 10 } = {}) {
    const cacheKey = `${CACHE_PREFIX}:all:${page}:${limit}`;
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
    const cacheKey = `${CACHE_PREFIX}:${id}`;
    const cached = await this.getCache(cacheKey);
    if (cached) {
      return cached;
    }

    const documentType = await this.documentTypeRepository.findById(id);
    if (!documentType) {
      throw new NotFoundError('Tipo de documento no encontrado');
    }

    await this.redisClient.set(cacheKey, JSON.stringify(documentType), env.CATALOG_CACHE_TTL);

    return documentType;
  }

  async update(id, documentTypeDto) {
    const existing = await this.documentTypeRepository.findById(id);
    if (!existing) {
      throw new NotFoundError('Tipo de documento no encontrado');
    }

    if (documentTypeDto.name && documentTypeDto.name !== existing.name) {
      const duplicate = await this.documentTypeRepository.findByName(documentTypeDto.name);
      if (duplicate) {
        throw new ConflictError('Ya existe un tipo de documento con ese nombre');
      }
    }

    if (documentTypeDto.code && documentTypeDto.code !== existing.code) {
      const duplicate = await this.documentTypeRepository.findByCode(documentTypeDto.code);
      if (duplicate) {
        throw new ConflictError('Ya existe un tipo de documento con ese código');
      }
    }

    const updated = await this.documentTypeRepository.update(id, documentTypeDto);
    await this.indexDocument(updated);
    await this.invalidateCache(id);

    return updated;
  }

  async delete(id) {
    const existing = await this.documentTypeRepository.findById(id);
    if (!existing) {
      throw new NotFoundError('Tipo de documento no encontrado');
    }

    await this.documentTypeRepository.delete(id);

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
      // Si Elasticsearch no responde se usa la base de datos relacional
    }

    return this.documentTypeRepository.search(searchTerm);
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

module.exports = DocumentTypeService;
