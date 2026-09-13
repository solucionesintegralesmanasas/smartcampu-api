const { esClient } = require('../../config/elasticsearch');
const { env } = require('../../config/env');
const { ConflictError, NotFoundError } = require('../../core/exceptions');

class ProgramaService {
  constructor(programaRepository, facultadRepository = null, redisClient = null) {
    this.programaRepository = programaRepository;
    this.facultadRepository = facultadRepository;
    this.redisClient = redisClient;
  }

  async create(createDto) {
    if (this.facultadRepository) {
      const facultad = await this.facultadRepository.findById(createDto.facultadId);
      if (!facultad) {
        throw new NotFoundError(`La facultad con ID ${createDto.facultadId} no existe`);
      }
    }

    const existingCode = await this.programaRepository.findByCodigo(createDto.codigo);
    if (existingCode) {
      throw new ConflictError(
        `El código de programa '${createDto.codigo}' ya se encuentra registrado`,
      );
    }

    const existingName = await this.programaRepository.findByNombre(createDto.nombre);
    if (existingName) {
      throw new ConflictError(
        `El nombre de programa '${createDto.nombre}' ya se encuentra registrado`,
      );
    }

    const programa = await this.programaRepository.withTransaction(async (conn) => {
      const created = await this.programaRepository.create(createDto, conn);
      return created;
    });

    await this.indexPrograma(programa);
    await this.invalidateCache();

    return programa;
  }

  async findAll(options = {}) {
    const page = options.page || 1;
    const limit = options.limit || 20;
    const search = options.search || '';
    const facultadId = options.facultadId || '';
    const nivel = options.nivel || '';
    const cacheKey = `programa:all:${page}:${limit}:${search}:${facultadId}:${nivel}`;

    if (this.redisClient && !search && !facultadId && !nivel) {
      try {
        const cached = await this.redisClient.get(cacheKey);
        if (cached) return JSON.parse(cached);
      } catch (err) {
        // Fallback
      }
    }

    const result = await this.programaRepository.findAll({
      page,
      limit,
      search,
      facultadId,
      nivel,
    });

    if (this.redisClient && !search && !facultadId && !nivel) {
      try {
        await this.redisClient.set(cacheKey, JSON.stringify(result), env.UNIVERSITY_CACHE_TTL);
      } catch (err) {
        // Error no fatal
      }
    }

    return result;
  }

  async findById(id) {
    const cacheKey = `programa:${id}`;
    if (this.redisClient) {
      try {
        const cached = await this.redisClient.get(cacheKey);
        if (cached) return JSON.parse(cached);
      } catch (err) {
        // Fallback
      }
    }

    const programa = await this.programaRepository.findById(id);
    if (!programa) {
      throw new NotFoundError(`Programa con ID ${id} no encontrado`);
    }

    if (this.redisClient) {
      try {
        await this.redisClient.set(cacheKey, JSON.stringify(programa), env.UNIVERSITY_CACHE_TTL);
      } catch (err) {
        // Error no fatal
      }
    }

    return programa;
  }

  async update(id, updateDto) {
    const existing = await this.programaRepository.findById(id);
    if (!existing) {
      throw new NotFoundError(`Programa con ID ${id} no encontrado`);
    }

    if (updateDto.facultadId && this.facultadRepository) {
      const facultad = await this.facultadRepository.findById(updateDto.facultadId);
      if (!facultad) {
        throw new NotFoundError(`La facultad con ID ${updateDto.facultadId} no existe`);
      }
    }

    if (updateDto.codigo && updateDto.codigo !== existing.codigo) {
      const duplicate = await this.programaRepository.findByCodigo(updateDto.codigo);
      if (duplicate && duplicate.id !== existing.id) {
        throw new ConflictError(
          `El código de programa '${updateDto.codigo}' ya se encuentra registrado`,
        );
      }
    }

    if (updateDto.nombre && updateDto.nombre !== existing.nombre) {
      const duplicate = await this.programaRepository.findByNombre(updateDto.nombre);
      if (duplicate && duplicate.id !== existing.id) {
        throw new ConflictError(
          `El nombre de programa '${updateDto.nombre}' ya se encuentra registrado`,
        );
      }
    }

    const updated = await this.programaRepository.withTransaction(async (conn) => {
      const result = await this.programaRepository.update(id, updateDto, conn);
      return result;
    });

    await this.indexPrograma(updated);
    await this.invalidateCache();

    return updated;
  }

  async delete(id) {
    const existing = await this.programaRepository.findById(id);
    if (!existing) {
      throw new NotFoundError(`Programa con ID ${id} no encontrado`);
    }

    const estudiantes = await this.programaRepository.countStudentLinks(existing.id);
    if (estudiantes > 0) {
      throw new ConflictError(
        `No se puede eliminar el programa porque tiene ${estudiantes} estudiante(s) matriculado(s)`,
      );
    }

    await this.programaRepository.delete(id);

    try {
      await esClient.client
        .delete({
          index: 'uajs_university',
          id: `programa_${id}`,
        })
        .catch(() => {});
    } catch (err) {
      // Silenciar error en ES
    }

    await this.invalidateCache();
    return { success: true, message: 'Programa eliminado correctamente' };
  }

  async indexPrograma(programa) {
    const indexData = {
      type: 'programa',
      id: programa.id,
      uuid: programa.uuid,
      nombre: programa.nombre,
      codigo: programa.codigo,
      estado: programa.activo ? 'ACTIVO' : 'INACTIVO',
      numeroDocumento: programa.codigoSnies || null,
      email: null,
      telefono: null,
      relaciones: [],
      createdAt: programa.createdAt,
      updatedAt: programa.updatedAt,
    };

    if (programa.Facultad || programa.facultad) {
      const fac = programa.Facultad || programa.facultad;
      indexData.relaciones.push({
        type: 'facultad',
        id: programa.facultadId || fac.id,
        nombre: fac.nombre || `Facultad ${programa.facultadId}`,
      });
    }

    try {
      await esClient.client
        .index({
          index: 'uajs_university',
          id: `programa_${programa.id}`,
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
                { term: { type: 'programa' } },
                ...(searchTerm
                  ? [
                    {
                      multi_match: {
                        query: searchTerm,
                        fields: ['nombre', 'codigo', 'numeroDocumento'],
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
        const keys = await this.redisClient.keys('programa:*');
        if (keys && keys.length > 0) {
          await Promise.all(keys.map((k) => this.redisClient.del(k)));
        }
      } catch (err) {
        // Silenciar fallo de caché
      }
    }
  }
}

module.exports = ProgramaService;
