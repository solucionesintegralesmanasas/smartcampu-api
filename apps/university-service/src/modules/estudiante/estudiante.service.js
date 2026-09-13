const { esClient } = require('../../config/elasticsearch');
const { env } = require('../../config/env');
const { ConflictError, NotFoundError } = require('../../core/exceptions');
const UserProvisioningService = require('../../core/services/user-provisioning.service');

class EstudianteService {
  constructor(
    estudianteRepository,
    terceroRepository = null,
    programaRepository = null,
    redisClient = null,
    userProvisioningService = null,
  ) {
    this.estudianteRepository = estudianteRepository;
    this.terceroRepository = terceroRepository;
    this.programaRepository = programaRepository;
    this.redisClient = redisClient;
    this.userProvisioningService = userProvisioningService || new UserProvisioningService();
  }

  async create(createDto) {
    let persona = null;
    if (this.terceroRepository) {
      persona = await this.terceroRepository.findById(createDto.personaId);
      if (!persona) {
        throw new NotFoundError(`El tercero (persona) con ID ${createDto.personaId} no existe`);
      }
    }

    if (this.programaRepository) {
      const programa = await this.programaRepository.findById(createDto.programaId);
      if (!programa) {
        throw new NotFoundError(`El programa académico con ID ${createDto.programaId} no existe`);
      }
    }

    const existingCodigo = await this.estudianteRepository.findByCodigo(createDto.codigoEstudiante);
    if (existingCodigo) {
      throw new ConflictError(
        `El código estudiantil '${createDto.codigoEstudiante}' ya está registrado`,
      );
    }

    const existingPersona = await this.estudianteRepository.findByPersonaId(createDto.personaId);
    if (existingPersona) {
      throw new ConflictError(
        `La persona con ID ${createDto.personaId} ya está registrada como estudiante`,
      );
    }

    // Aprovisionamiento automático de usuario con rol STUDENT si no se proveyó userUuid
    if (!createDto.userUuid && persona && this.userProvisioningService) {
      const provision = await this.userProvisioningService.provisionUser({
        person: persona,
        roleName: 'STUDENT',
        customPassword: createDto.password,
      });
      createDto.userUuid = provision.userUuid;
    }

    const estudiante = await this.estudianteRepository.withTransaction(async (conn) => {
      const created = await this.estudianteRepository.create(createDto, conn);
      return created;
    });

    await this.indexEstudiante(estudiante);
    await this.invalidateCache();

    return estudiante;
  }

  async findAll(options = {}) {
    const page = options.page || 1;
    const limit = options.limit || 20;
    const search = options.search || '';
    const programaId = options.programaId || '';
    const personaId = options.personaId || '';
    const estado = options.estado || '';
    const filterKey = `${search}:${programaId}:${personaId}:${estado}`;
    const cacheKey = `estudiante:all:${page}:${limit}:${filterKey}`;

    if (this.redisClient && !search && !programaId && !personaId && !estado) {
      try {
        const cached = await this.redisClient.get(cacheKey);
        if (cached) return JSON.parse(cached);
      } catch (err) {
        // Fallback
      }
    }

    const result = await this.estudianteRepository.findAll({
      page,
      limit,
      search,
      programaId,
      personaId,
      estado,
    });

    if (this.redisClient && !search && !programaId && !personaId && !estado) {
      try {
        await this.redisClient.set(cacheKey, JSON.stringify(result), env.UNIVERSITY_CACHE_TTL);
      } catch (err) {
        // Error no fatal
      }
    }

    return result;
  }

  async findById(id) {
    const cacheKey = `estudiante:${id}`;
    if (this.redisClient) {
      try {
        const cached = await this.redisClient.get(cacheKey);
        if (cached) return JSON.parse(cached);
      } catch (err) {
        // Fallback
      }
    }

    const estudiante = await this.estudianteRepository.findById(id);
    if (!estudiante) {
      throw new NotFoundError(`Estudiante con ID ${id} no encontrado`);
    }

    if (this.redisClient) {
      try {
        await this.redisClient.set(cacheKey, JSON.stringify(estudiante), env.UNIVERSITY_CACHE_TTL);
      } catch (err) {
        // Error no fatal
      }
    }

    return estudiante;
  }

  async update(id, updateDto) {
    const existing = await this.estudianteRepository.findById(id);
    if (!existing) {
      throw new NotFoundError(`Estudiante con ID ${id} no encontrado`);
    }

    if (updateDto.programaId && this.programaRepository) {
      const programa = await this.programaRepository.findById(updateDto.programaId);
      if (!programa) {
        throw new NotFoundError(`El programa académico con ID ${updateDto.programaId} no existe`);
      }
    }

    if (updateDto.codigoEstudiante && updateDto.codigoEstudiante !== existing.codigoEstudiante) {
      const duplicate = await this.estudianteRepository.findByCodigo(updateDto.codigoEstudiante);
      if (duplicate && duplicate.id !== existing.id) {
        throw new ConflictError(
          `El código estudiantil '${updateDto.codigoEstudiante}' ya está registrado`,
        );
      }
    }

    const updated = await this.estudianteRepository.withTransaction(async (conn) => {
      const result = await this.estudianteRepository.update(id, updateDto, conn);
      return result;
    });

    await this.indexEstudiante(updated);
    await this.invalidateCache();

    return updated;
  }

  async delete(id) {
    const existing = await this.estudianteRepository.findById(id);
    if (!existing) {
      throw new NotFoundError(`Estudiante con ID ${id} no encontrado`);
    }

    await this.estudianteRepository.delete(id);

    try {
      await esClient.client
        .delete({
          index: 'uajs_university',
          id: `estudiante_${id}`,
        })
        .catch(() => {});
    } catch (err) {
      // Silenciar error en ES
    }

    await this.invalidateCache();
    return { success: true, message: 'Estudiante eliminado correctamente' };
  }

  async indexEstudiante(estudiante) {
    const personName = estudiante.Tercero?.nombre || 'Estudiante';
    const indexData = {
      type: 'estudiante',
      id: estudiante.id,
      uuid: estudiante.uuid,
      nombre: personName,
      codigo: estudiante.codigoEstudiante,
      estado: estudiante.estado,
      numeroDocumento: estudiante.Tercero?.numeroDocumento || null,
      email: estudiante.Tercero?.email || null,
      telefono: null,
      relaciones: [
        {
          type: 'tercero',
          id: estudiante.personaId,
          nombre: personName,
        },
        {
          type: 'programa',
          id: estudiante.programaId,
          nombre: estudiante.Programa?.nombre || `Programa ${estudiante.programaId}`,
        },
      ],
      createdAt: estudiante.createdAt,
      updatedAt: estudiante.updatedAt,
    };

    try {
      await esClient.client
        .index({
          index: 'uajs_university',
          id: `estudiante_${estudiante.id}`,
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
                { term: { type: 'estudiante' } },
                ...(searchTerm
                  ? [
                    {
                      bool: {
                        should: [
                          {
                            multi_match: {
                              query: searchTerm,
                              fields: ['nombre', 'codigo', 'numeroDocumento', 'email'],
                              fuzziness: 'AUTO',
                            },
                          },
                          {
                            wildcard: { codigo: `*${searchTerm}*` },
                          },
                          {
                            wildcard: { numeroDocumento: `*${searchTerm}*` },
                          },
                        ],
                        minimum_should_match: 1,
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
        const keys = await this.redisClient.keys('estudiante:*');
        if (keys && keys.length > 0) {
          await Promise.all(keys.map((k) => this.redisClient.del(k)));
        }
      } catch (err) {
        // Silenciar fallo de caché
      }
    }
  }
}

module.exports = EstudianteService;
