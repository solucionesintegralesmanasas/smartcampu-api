const { esClient } = require('../../config/elasticsearch');
const { env } = require('../../config/env');
const { ConflictError, NotFoundError } = require('../../core/exceptions');

class TerceroService {
  constructor(terceroRepository, empresaRepository = null, redisClient = null) {
    this.terceroRepository = terceroRepository;
    this.empresaRepository = empresaRepository;
    this.redisClient = redisClient;
  }

  async create(createDto) {
    const existing = await this.terceroRepository.findByDocumento(
      createDto.tipoDocumento,
      createDto.numeroDocumento,
    );
    if (existing) {
      throw new ConflictError(
        `Ya existe un tercero con ${createDto.tipoDocumento} número ${createDto.numeroDocumento}`,
      );
    }

    const tercero = await this.terceroRepository.withTransaction(async (conn) => {
      const created = await this.terceroRepository.create(createDto, conn);
      return created;
    });

    // Indexar en ES con relaciones
    await this.indexTercero(tercero);
    await this.invalidateCache();

    return tercero;
  }

  async indexTercero(tercero) {
    const indexData = {
      type: 'tercero',
      id: tercero.id,
      uuid: tercero.uuid,
      nombre: tercero.nombre || `${tercero.primerNombre} ${tercero.primerApellido}`.trim(),
      codigo: tercero.numeroDocumento,
      estado: tercero.activo ? 'ACTIVO' : 'INACTIVO',
      numeroDocumento: tercero.numeroDocumento,
      email: tercero.email || null,
      telefono: tercero.telefono || null,
      relaciones: [],
      createdAt: tercero.createdAt,
      updatedAt: tercero.updatedAt,
    };

    if (tercero.Empresa || tercero.empresa) {
      const emp = tercero.Empresa || tercero.empresa;
      if (emp && emp.id) {
        indexData.relaciones.push({
          type: 'empresa',
          id: emp.id,
          nombre: emp.nombre || emp.razonSocial,
        });
      }
    }

    try {
      await esClient.client
        .index({
          index: 'uajs_university',
          id: `tercero_${tercero.id}`,
          body: indexData,
        })
        .catch(() => {});
    } catch (err) {
      // Indexación no bloqueante
    }
  }

  async search(query) {
    const searchQuery = typeof query === 'string' ? { search: query } : query || {};
    const searchTerm = searchQuery.search || '';
    const type = searchQuery.type || 'tercero';
    const limit = searchQuery.limit || 20;

    try {
      const response = await esClient.client.search({
        index: 'uajs_university',
        body: {
          query: {
            bool: {
              must: [
                { term: { type } },
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

  async findAll(options = {}) {
    const page = options.page || 1;
    const limit = options.limit || 20;
    const search = options.search || '';
    const tipoDocumento = options.tipoDocumento || '';
    const cacheKey = `tercero:all:${page}:${limit}:${search}:${tipoDocumento}`;

    if (this.redisClient && !search && !tipoDocumento) {
      try {
        const cached = await this.redisClient.get(cacheKey);
        if (cached) return JSON.parse(cached);
      } catch (err) {
        // Fallback a base de datos
      }
    }

    const result = await this.terceroRepository.findAll({
      page,
      limit,
      search,
      tipoDocumento,
    });

    if (this.redisClient && !search && !tipoDocumento) {
      try {
        await this.redisClient.set(cacheKey, JSON.stringify(result), env.UNIVERSITY_CACHE_TTL);
      } catch (err) {
        // Error no fatal
      }
    }

    return result;
  }

  async findById(id) {
    const cacheKey = `tercero:${id}`;
    if (this.redisClient) {
      try {
        const cached = await this.redisClient.get(cacheKey);
        if (cached) return JSON.parse(cached);
      } catch (err) {
        // Fallback a base de datos
      }
    }

    const tercero = await this.terceroRepository.findById(id);
    if (!tercero) {
      throw new NotFoundError(`Tercero con ID ${id} no encontrado`);
    }

    if (this.redisClient) {
      try {
        await this.redisClient.set(cacheKey, JSON.stringify(tercero), env.UNIVERSITY_CACHE_TTL);
      } catch (err) {
        // Error no fatal
      }
    }

    return tercero;
  }

  async update(id, updateDto) {
    const existing = await this.terceroRepository.findById(id);
    if (!existing) {
      throw new NotFoundError(`Tercero con ID ${id} no encontrado`);
    }

    if (
      (updateDto.tipoDocumento && updateDto.tipoDocumento !== existing.tipoDocumento)
      || (updateDto.numeroDocumento && updateDto.numeroDocumento !== existing.numeroDocumento)
    ) {
      const docType = updateDto.tipoDocumento || existing.tipoDocumento;
      const docNum = updateDto.numeroDocumento || existing.numeroDocumento;
      const duplicate = await this.terceroRepository.findByDocumento(docType, docNum);
      if (duplicate && duplicate.id !== existing.id) {
        throw new ConflictError(`El documento ${docType} ${docNum} ya está registrado`);
      }
    }

    const updated = await this.terceroRepository.withTransaction(async (conn) => {
      const result = await this.terceroRepository.update(id, updateDto, conn);
      return result;
    });

    await this.indexTercero(updated);
    await this.invalidateCache();

    return updated;
  }

  async delete(id) {
    const existing = await this.terceroRepository.findById(id);
    if (!existing) {
      throw new NotFoundError(`Tercero con ID ${id} no encontrado`);
    }

    const estudiantes = await this.terceroRepository.countStudentLinks(existing.id);
    if (estudiantes > 0) {
      throw new ConflictError(
        `No se puede eliminar el tercero: tiene ${estudiantes} matrícula(s) de estudiante`,
      );
    }

    const docentes = await this.terceroRepository.countTeacherLinks(existing.id);
    if (docentes > 0) {
      throw new ConflictError(
        `No se puede eliminar el tercero: tiene ${docentes} registro(s) como docente`,
      );
    }

    await this.terceroRepository.delete(id);

    try {
      await esClient.client
        .delete({
          index: 'uajs_university',
          id: `tercero_${id}`,
        })
        .catch(() => {});
    } catch (err) {
      // Silenciar error en ES
    }

    await this.invalidateCache();
    return { success: true, message: 'Tercero eliminado correctamente' };
  }

  async invalidateCache() {
    if (this.redisClient && typeof this.redisClient.keys === 'function') {
      try {
        const keys = await this.redisClient.keys('tercero:*');
        if (keys && keys.length > 0) {
          await Promise.all(keys.map((k) => this.redisClient.del(k)));
        }
      } catch (err) {
        // Silenciar fallo de caché
      }
    }
  }
}

module.exports = TerceroService;
