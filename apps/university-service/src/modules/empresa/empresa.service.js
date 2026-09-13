const { esClient } = require('../../config/elasticsearch');
const { env } = require('../../config/env');
const { ConflictError, NotFoundError } = require('../../core/exceptions');

class EmpresaService {
  constructor(empresaRepository, redisClient = null) {
    this.empresaRepository = empresaRepository;
    this.redisClient = redisClient;
  }

  async create(createDto) {
    const existing = await this.empresaRepository.findByNit(createDto.nit);
    if (existing) {
      throw new ConflictError(`Ya existe una empresa con el NIT ${createDto.nit}`);
    }

    const empresa = await this.empresaRepository.withTransaction(async (conn) => {
      const created = await this.empresaRepository.create(createDto, conn);
      return created;
    });

    await this.indexEmpresa(empresa);
    await this.invalidateCache();

    return empresa;
  }

  async findAll(options = {}) {
    const page = options.page || 1;
    const limit = options.limit || 20;
    const search = options.search || '';
    const cacheKey = `empresa:all:${page}:${limit}:${search}`;

    if (this.redisClient && !search) {
      try {
        const cached = await this.redisClient.get(cacheKey);
        if (cached) return JSON.parse(cached);
      } catch (err) {
        // Fallback a base de datos
      }
    }

    const result = await this.empresaRepository.findAll({ page, limit, search });

    if (this.redisClient && !search) {
      try {
        await this.redisClient.set(cacheKey, JSON.stringify(result), env.UNIVERSITY_CACHE_TTL);
      } catch (err) {
        // Error de caché no fatal
      }
    }

    return result;
  }

  async findById(id) {
    const cacheKey = `empresa:${id}`;
    if (this.redisClient) {
      try {
        const cached = await this.redisClient.get(cacheKey);
        if (cached) return JSON.parse(cached);
      } catch (err) {
        // Fallback a base de datos
      }
    }

    const empresa = await this.empresaRepository.findById(id);
    if (!empresa) {
      throw new NotFoundError(`Empresa con ID ${id} no encontrada`);
    }

    if (this.redisClient) {
      try {
        await this.redisClient.set(cacheKey, JSON.stringify(empresa), env.UNIVERSITY_CACHE_TTL);
      } catch (err) {
        // Error de caché no fatal
      }
    }

    return empresa;
  }

  async update(id, updateDto) {
    const existing = await this.empresaRepository.findById(id);
    if (!existing) {
      throw new NotFoundError(`Empresa con ID ${id} no encontrada`);
    }

    if (updateDto.nit && updateDto.nit !== existing.nit) {
      const duplicate = await this.empresaRepository.findByNit(updateDto.nit);
      if (duplicate && duplicate.id !== existing.id) {
        throw new ConflictError(`El NIT ${updateDto.nit} ya está registrado`);
      }
    }

    const updated = await this.empresaRepository.withTransaction(async (conn) => {
      const result = await this.empresaRepository.update(id, updateDto, conn);
      return result;
    });

    await this.indexEmpresa(updated);
    await this.invalidateCache();

    return updated;
  }

  async delete(id) {
    const existing = await this.empresaRepository.findById(id);
    if (!existing) {
      throw new NotFoundError(`Empresa con ID ${id} no encontrada`);
    }

    const asociados = await this.empresaRepository.countAssociatedTerceros(existing.id);
    if (asociados > 0) {
      throw new ConflictError(
        `No se puede eliminar la empresa: tiene ${asociados} persona(s) asociada(s)`,
      );
    }

    await this.empresaRepository.delete(id);

    try {
      await esClient.client
        .delete({
          index: 'uajs_university',
          id: `empresa_${id}`,
        })
        .catch(() => {});
    } catch (err) {
      // Ignorar fallo de ES
    }

    await this.invalidateCache();
    return { success: true, message: 'Empresa eliminada correctamente' };
  }

  async indexEmpresa(empresa) {
    const indexData = {
      type: 'empresa',
      id: empresa.id,
      uuid: empresa.uuid,
      nombre: empresa.razonSocial || empresa.nombre,
      codigo: empresa.nit,
      estado: empresa.activo ? 'ACTIVO' : 'INACTIVO',
      numeroDocumento: empresa.nit,
      email: empresa.email || null,
      telefono: empresa.telefono || null,
      relaciones: [],
      createdAt: empresa.createdAt,
      updatedAt: empresa.updatedAt,
    };

    try {
      await esClient.client
        .index({
          index: 'uajs_university',
          id: `empresa_${empresa.id}`,
          body: indexData,
        })
        .catch(() => {});
    } catch (err) {
      // Indexación no bloqueante
    }
  }

  async search(query) {
    const searchTerm = typeof query === 'string' ? query : query?.search || '';
    const limit = query?.limit || 20;

    try {
      const response = await esClient.client.search({
        index: 'uajs_university',
        body: {
          query: {
            bool: {
              must: [
                { term: { type: 'empresa' } },
                ...(searchTerm
                  ? [
                    {
                      multi_match: {
                        query: searchTerm,
                        fields: ['nombre', 'codigo', 'numeroDocumento', 'email', 'telefono'],
                        fuzziness: 'AUTO',
                      },
                    },
                  ]
                  : [{ match_all: {} }]),
              ],
            },
          },
          size: limit,
        },
      });

      const hits = response.body?.hits?.hits || response.hits?.hits || [];
      // eslint-disable-next-line no-underscore-dangle
      return hits.map((hit) => hit._source);
    } catch (error) {
      return [];
    }
  }

  async invalidateCache() {
    if (this.redisClient && typeof this.redisClient.keys === 'function') {
      try {
        const keys = await this.redisClient.keys('empresa:*');
        if (keys && keys.length > 0) {
          await Promise.all(keys.map((k) => this.redisClient.del(k)));
        }
      } catch (err) {
        // Ignorar fallo de invalidación
      }
    }
  }
}

module.exports = EmpresaService;
