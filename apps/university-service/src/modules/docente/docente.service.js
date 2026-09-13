const { esClient } = require('../../config/elasticsearch');
const { env } = require('../../config/env');
const { ConflictError, NotFoundError } = require('../../core/exceptions');
const UserProvisioningService = require('../../core/services/user-provisioning.service');

class DocenteService {
  constructor(
    docenteRepository,
    terceroRepository = null,
    facultadRepository = null,
    redisClient = null,
    userProvisioningService = null,
  ) {
    this.docenteRepository = docenteRepository;
    this.terceroRepository = terceroRepository;
    this.facultadRepository = facultadRepository;
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

    if (this.facultadRepository) {
      const facultad = await this.facultadRepository.findById(createDto.facultadId);
      if (!facultad) {
        throw new NotFoundError(`La facultad con ID ${createDto.facultadId} no existe`);
      }
    }

    const existingCodigo = await this.docenteRepository.findByCodigo(createDto.codigoDocente);
    if (existingCodigo) {
      throw new ConflictError(`El código docente '${createDto.codigoDocente}' ya está registrado`);
    }

    const existingPersona = await this.docenteRepository.findByPersonaId(createDto.personaId);
    if (existingPersona) {
      throw new ConflictError(
        `La persona con ID ${createDto.personaId} ya está registrada como docente`,
      );
    }

    // Aprovisionamiento automático de usuario con rol TEACHER si no se proveyó userUuid
    if (!createDto.userUuid && persona && this.userProvisioningService) {
      const provision = await this.userProvisioningService.provisionUser({
        person: persona,
        roleName: 'TEACHER',
        customPassword: createDto.password,
      });
      createDto.userUuid = provision.userUuid;
    }

    const docente = await this.docenteRepository.withTransaction(async (conn) => {
      const created = await this.docenteRepository.create(createDto, conn);
      return created;
    });

    await this.indexDocente(docente);
    await this.invalidateCache();

    return docente;
  }

  async findAll(options = {}) {
    const page = options.page || 1;
    const limit = options.limit || 20;
    const search = options.search || '';
    const facultadId = options.facultadId || '';
    const personaId = options.personaId || '';
    const estado = options.estado || '';
    const tipoContrato = options.tipoContrato || '';
    const filterKey = `${search}:${facultadId}:${personaId}:${estado}:${tipoContrato}`;
    const cacheKey = `docente:all:${page}:${limit}:${filterKey}`;

    if (this.redisClient && !search && !facultadId && !personaId && !estado && !tipoContrato) {
      try {
        const cached = await this.redisClient.get(cacheKey);
        if (cached) return JSON.parse(cached);
      } catch (err) {
        // Fallback
      }
    }

    const result = await this.docenteRepository.findAll({
      page,
      limit,
      search,
      facultadId,
      personaId,
      estado,
      tipoContrato,
    });

    if (this.redisClient && !search && !facultadId && !personaId && !estado && !tipoContrato) {
      try {
        await this.redisClient.set(cacheKey, JSON.stringify(result), env.UNIVERSITY_CACHE_TTL);
      } catch (err) {
        // Error no fatal
      }
    }

    return result;
  }

  async findById(id) {
    const cacheKey = `docente:${id}`;
    if (this.redisClient) {
      try {
        const cached = await this.redisClient.get(cacheKey);
        if (cached) return JSON.parse(cached);
      } catch (err) {
        // Fallback
      }
    }

    const docente = await this.docenteRepository.findById(id);
    if (!docente) {
      throw new NotFoundError(`Docente con ID ${id} no encontrado`);
    }

    if (this.redisClient) {
      try {
        await this.redisClient.set(cacheKey, JSON.stringify(docente), env.UNIVERSITY_CACHE_TTL);
      } catch (err) {
        // Error no fatal
      }
    }

    return docente;
  }

  async update(id, updateDto) {
    const existing = await this.docenteRepository.findById(id);
    if (!existing) {
      throw new NotFoundError(`Docente con ID ${id} no encontrado`);
    }

    if (updateDto.facultadId && this.facultadRepository) {
      const facultad = await this.facultadRepository.findById(updateDto.facultadId);
      if (!facultad) {
        throw new NotFoundError(`La facultad con ID ${updateDto.facultadId} no existe`);
      }
    }

    if (updateDto.codigoDocente && updateDto.codigoDocente !== existing.codigoDocente) {
      const duplicate = await this.docenteRepository.findByCodigo(updateDto.codigoDocente);
      if (duplicate && duplicate.id !== existing.id) {
        throw new ConflictError(
          `El código docente '${updateDto.codigoDocente}' ya está registrado`,
        );
      }
    }

    const updated = await this.docenteRepository.withTransaction(async (conn) => {
      const result = await this.docenteRepository.update(id, updateDto, conn);
      return result;
    });

    await this.indexDocente(updated);
    await this.invalidateCache();

    return updated;
  }

  async delete(id) {
    const existing = await this.docenteRepository.findById(id);
    if (!existing) {
      throw new NotFoundError(`Docente con ID ${id} no encontrado`);
    }

    await this.docenteRepository.delete(id);

    try {
      await esClient.client
        .delete({
          index: 'uajs_university',
          id: `docente_${id}`,
        })
        .catch(() => {});
    } catch (err) {
      // Silenciar error en ES
    }

    await this.invalidateCache();
    return { success: true, message: 'Docente eliminado correctamente' };
  }

  async indexDocente(docente) {
    const personName = docente.Tercero?.nombre || 'Docente';
    const indexData = {
      type: 'docente',
      id: docente.id,
      uuid: docente.uuid,
      nombre: personName,
      codigo: docente.codigoDocente,
      estado: docente.estado,
      numeroDocumento: docente.Tercero?.numeroDocumento || null,
      email: docente.Tercero?.email || null,
      telefono: null,
      relaciones: [
        {
          type: 'tercero',
          id: docente.personaId,
          nombre: personName,
        },
        {
          type: 'facultad',
          id: docente.facultadId,
          nombre: docente.Facultad?.nombre || `Facultad ${docente.facultadId}`,
        },
      ],
      createdAt: docente.createdAt,
      updatedAt: docente.updatedAt,
    };

    try {
      await esClient.client
        .index({
          index: 'uajs_university',
          id: `docente_${docente.id}`,
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
                { term: { type: 'docente' } },
                ...(searchTerm
                  ? [
                    {
                      multi_match: {
                        query: searchTerm,
                        fields: ['nombre', 'codigo', 'numeroDocumento', 'email'],
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
        const keys = await this.redisClient.keys('docente:*');
        if (keys && keys.length > 0) {
          await Promise.all(keys.map((k) => this.redisClient.del(k)));
        }
      } catch (err) {
        // Silenciar fallo de caché
      }
    }
  }
}

module.exports = DocenteService;
