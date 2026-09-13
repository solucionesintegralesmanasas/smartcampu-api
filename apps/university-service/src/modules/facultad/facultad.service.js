const { esClient } = require('../../config/elasticsearch');
const { env } = require('../../config/env');
const { ConflictError, NotFoundError } = require('../../core/exceptions');

class FacultadService {
  constructor(facultadRepository, redisClient = null) {
    this.facultadRepository = facultadRepository;
    this.redisClient = redisClient;
  }

  async create(createDto) {
    const existingCode = await this.facultadRepository.findByCodigo(createDto.codigo);
    if (existingCode) {
      throw new ConflictError(`El código de facultad '${createDto.codigo}' ya existe`);
    }

    const existingName = await this.facultadRepository.findByNombre(createDto.nombre);
    if (existingName) {
      throw new ConflictError(`El nombre de facultad '${createDto.nombre}' ya existe`);
    }

    const facultad = await this.facultadRepository.withTransaction(async (conn) => {
      const created = await this.facultadRepository.create(createDto, conn);
      return created;
    });

    await this.indexFacultad(facultad);
    await this.invalidateCache();

    return facultad;
  }

  async findAll(options = {}) {
    const page = options.page || 1;
    const limit = options.limit || 20;
    const search = options.search || '';
    const campusId = options.campusId || '';
    const cacheKey = `facultad:all:${page}:${limit}:${search}:${campusId}`;

    if (this.redisClient && !search && !campusId) {
      try {
        const cached = await this.redisClient.get(cacheKey);
        if (cached) return JSON.parse(cached);
      } catch (err) {
        // Fallback
      }
    }

    const result = await this.facultadRepository.findAll({
      page,
      limit,
      search,
      campusId,
    });

    if (this.redisClient && !search && !campusId) {
      try {
        await this.redisClient.set(cacheKey, JSON.stringify(result), env.UNIVERSITY_CACHE_TTL);
      } catch (err) {
        // Error no fatal
      }
    }

    return result;
  }

  async findById(id) {
    const cacheKey = `facultad:${id}`;
    if (this.redisClient) {
      try {
        const cached = await this.redisClient.get(cacheKey);
        if (cached) return JSON.parse(cached);
      } catch (err) {
        // Fallback
      }
    }

    const facultad = await this.facultadRepository.findById(id);
    if (!facultad) {
      throw new NotFoundError(`Facultad con ID ${id} no encontrada`);
    }

    if (this.redisClient) {
      try {
        await this.redisClient.set(cacheKey, JSON.stringify(facultad), env.UNIVERSITY_CACHE_TTL);
      } catch (err) {
        // Error no fatal
      }
    }

    return facultad;
  }

  async update(id, updateDto) {
    const existing = await this.facultadRepository.findById(id);
    if (!existing) {
      throw new NotFoundError(`Facultad con ID ${id} no encontrada`);
    }

    if (updateDto.codigo && updateDto.codigo !== existing.codigo) {
      const duplicate = await this.facultadRepository.findByCodigo(updateDto.codigo);
      if (duplicate && duplicate.id !== existing.id) {
        throw new ConflictError(`El código de facultad '${updateDto.codigo}' ya existe`);
      }
    }

    if (updateDto.nombre && updateDto.nombre !== existing.nombre) {
      const duplicate = await this.facultadRepository.findByNombre(updateDto.nombre);
      if (duplicate && duplicate.id !== existing.id) {
        throw new ConflictError(`El nombre de facultad '${updateDto.nombre}' ya existe`);
      }
    }

    const updated = await this.facultadRepository.withTransaction(async (conn) => {
      const result = await this.facultadRepository.update(id, updateDto, conn);
      return result;
    });

    await this.indexFacultad(updated);
    await this.invalidateCache();

    return updated;
  }

  async delete(id) {
    const existing = await this.facultadRepository.findById(id);
    if (!existing) {
      throw new NotFoundError(`Facultad con ID ${id} no encontrada`);
    }

    const programas = await this.facultadRepository.countProgramLinks(existing.id);
    if (programas > 0) {
      throw new ConflictError(
        `No se puede eliminar la facultad: tiene ${programas} programa(s) asociado(s)`,
      );
    }

    const docentes = await this.facultadRepository.countTeacherLinks(existing.id);
    if (docentes > 0) {
      throw new ConflictError(
        `No se puede eliminar la facultad porque tiene ${docentes} docente(s) asociado(s)`,
      );
    }

    await this.facultadRepository.delete(id);

    try {
      await esClient.client
        .delete({
          index: 'uajs_university',
          id: `facultad_${id}`,
        })
        .catch(() => {});
    } catch (err) {
      // Silenciar error en ES
    }

    await this.invalidateCache();
    return { success: true, message: 'Facultad eliminada correctamente' };
  }

  async indexFacultad(facultad) {
    const indexData = {
      type: 'facultad',
      id: facultad.id,
      uuid: facultad.uuid,
      nombre: facultad.nombre,
      codigo: facultad.codigo,
      estado: facultad.activo ? 'ACTIVO' : 'INACTIVO',
      numeroDocumento: null,
      email: facultad.email || null,
      telefono: null,
      relaciones: [
        {
          type: 'sede',
          id: facultad.campusId,
          nombre: `Sede ${facultad.campusId}`,
        },
      ],
      createdAt: facultad.createdAt,
      updatedAt: facultad.updatedAt,
    };

    try {
      await esClient.client
        .index({
          index: 'uajs_university',
          id: `facultad_${facultad.id}`,
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
                { term: { type: 'facultad' } },
                ...(searchTerm
                  ? [
                    {
                      multi_match: {
                        query: searchTerm,
                        fields: ['nombre', 'codigo', 'email'],
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
        const keys = await this.redisClient.keys('facultad:*');
        if (keys && keys.length > 0) {
          await Promise.all(keys.map((k) => this.redisClient.del(k)));
        }
      } catch (err) {
        // Silenciar fallo de caché
      }
    }
  }
}

module.exports = FacultadService;
