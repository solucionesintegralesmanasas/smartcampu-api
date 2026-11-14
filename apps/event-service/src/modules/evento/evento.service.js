const logger = require('../../config/logger');
const { ForbiddenError, NotFoundError } = require('../../core/exceptions');
const { getPaginationMeta } = require('../../core/helpers/pagination.helper');
const { formatFecha, formatHora } = require('../../core/helpers/fecha.helper');
const { ROLES_GESTION, tieneRol } = require('../../core/helpers/roles.helper');
const { getEventoProducer } = require('../../jobs/producers/evento.producer');
const { toEventoResponse } = require('./evento.mapper');
const {
  ESTADOS_EVENTO,
  ESTADOS_PUBLICOS,
  validarTransicion,
  validarEdicion,
  validarEliminacion,
} = require('./evento.state-machine');

const esGestor = (usuario) => tieneRol(usuario, ROLES_GESTION);

/**
 * Lógica de negocio de eventos: consulta con visibilidad por estado, CRUD con
 * validación de estado, transiciones auditadas y publicación de EventoProgramadoEvent.
 */
class EventoService {
  /**
   * @param {object} deps
   * @param {import('./evento.repository')} deps.eventoRepository
   * @param {import('../catalogo/catalogo.repository')} deps.catalogoRepository
   * @param {import('../inscripcion/inscripcion.repository')} deps.inscripcionRepository
   * @param {import('../../jobs/producers/evento.producer')} [deps.producer]
   */
  constructor({ eventoRepository, catalogoRepository, inscripcionRepository, producer = null }) {
    this.repository = eventoRepository;
    this.catalogoRepository = catalogoRepository;
    this.inscripcionRepository = inscripcionRepository;
    this.producer = producer || getEventoProducer();
  }

  async listar(filtros, usuario) {
    let estados;
    if (esGestor(usuario)) {
      estados = filtros.estado ? [filtros.estado] : null;
    } else {
      estados =
        filtros.estado && ESTADOS_PUBLICOS.includes(filtros.estado)
          ? [filtros.estado]
          : ESTADOS_PUBLICOS;
    }

    const { rows, total } = await this.repository.findAll({ ...filtros, estados });
    return {
      data: rows.map(toEventoResponse),
      meta: getPaginationMeta(filtros.page, filtros.limit, total),
    };
  }

  async obtener(uuid, usuario) {
    const evento = await this.repository.findByUuid(uuid);
    if (!evento) {
      throw new NotFoundError(`El evento ${uuid} no existe`);
    }
    if (!esGestor(usuario) && !ESTADOS_PUBLICOS.includes(evento.estado)) {
      // Se oculta la existencia de borradores y cancelados a usuarios sin gestión.
      throw new NotFoundError(`El evento ${uuid} no existe`);
    }
    return toEventoResponse(evento);
  }

  async crear(dto, usuario) {
    const categoria = await this.catalogoRepository.findCategoriaByUuid(dto.categoriaUuid);
    if (!categoria) {
      throw new NotFoundError('La categoría indicada no existe o está inactiva');
    }
    const estadoBorrador = await this.catalogoRepository.findEstadoByCodigo(ESTADOS_EVENTO.DRAFT);

    const uuid = await this.repository.insert({
      categoriaId: categoria.id,
      estadoId: estadoBorrador.id,
      organizadorUuid: usuario.uuid,
      organizadorNombre: usuario.nombre || 'Organizador',
      sedeUuid: dto.sedeUuid,
      sedeNombre: dto.sedeNombre,
      titulo: dto.titulo,
      descripcion: dto.descripcion,
      lugar: dto.lugar,
      fechaInicio: dto.fechaInicio,
      fechaFin: dto.fechaFin,
      capacidadMaxima: dto.capacidadMaxima,
      costo: dto.costo,
      requiereInscripcion: dto.requiereInscripcion,
      fechaLimiteInscripcion: dto.fechaLimiteInscripcion,
    });

    return this.obtener(uuid, usuario);
  }

  async actualizar(uuid, dto, usuario) {
    await this.repository.withTransaction(async (conn) => {
      const evento = await this.repository.findByUuid(uuid, { conn, lock: true });
      if (!evento) {
        throw new NotFoundError(`El evento ${uuid} no existe`);
      }
      const inscritos = await this.inscripcionRepository.contarActivas(evento.id, conn);
      validarEdicion(evento.estado, inscritos > 0);

      const datos = this.mapearCampos(dto);
      if (dto.categoriaUuid) {
        const categoria = await this.catalogoRepository.findCategoriaByUuid(dto.categoriaUuid, conn);
        if (!categoria) {
          throw new NotFoundError('La categoría indicada no existe o está inactiva');
        }
        datos.categoriaId = categoria.id;
      }
      await this.repository.update(evento.id, datos, conn);
    });

    return this.obtener(uuid, usuario);
  }

  async eliminar(uuid, usuario) {
    const evento = await this.repository.findByUuid(uuid);
    if (!evento) {
      throw new NotFoundError(`El evento ${uuid} no existe`);
    }
    if (!esGestor(usuario)) {
      throw new ForbiddenError('No tienes permisos para eliminar eventos');
    }
    validarEliminacion(evento.estado);
    await this.repository.softDelete(evento.id);
    return { uuid, eliminado: true };
  }

  async cambiarEstado(uuid, estado, usuario) {
    if (!esGestor(usuario)) {
      throw new ForbiddenError('No tienes permisos para cambiar el estado de un evento');
    }

    const evento = await this.repository.withTransaction(async (conn) => {
      const actual = await this.repository.findByUuid(uuid, { conn, lock: true });
      if (!actual) {
        throw new NotFoundError(`El evento ${uuid} no existe`);
      }
      validarTransicion(actual.estado, estado);
      const estadoRow = await this.catalogoRepository.findEstadoByCodigo(estado, conn);
      await this.repository.updateEstado(actual.id, estadoRow.id, conn);
      return this.repository.findByUuid(uuid, { conn });
    });

    if (estado === ESTADOS_EVENTO.PUBLISHED) {
      await this.publicarEventoProgramado(evento);
    }

    return toEventoResponse(evento);
  }

  mapearCampos(dto) {
    const datos = {};
    const permitidos = [
      'titulo',
      'descripcion',
      'lugar',
      'fechaInicio',
      'fechaFin',
      'capacidadMaxima',
      'costo',
      'requiereInscripcion',
      'fechaLimiteInscripcion',
      'sedeUuid',
      'sedeNombre',
    ];
    permitidos.forEach((campo) => {
      if (dto[campo] !== undefined) {
        datos[campo] = dto[campo];
      }
    });
    return datos;
  }

  /**
   * Publica EventoProgramadoEvent. Si falla, solo se registra: el evento ya está publicado.
   */
  async publicarEventoProgramado(evento) {
    try {
      await this.producer.publicarEventoProgramado({
        eventoUuid: evento.uuid,
        nombre: evento.titulo,
        fechaEvento: formatFecha(evento.fechaInicio),
        horaEvento: formatHora(evento.fechaInicio),
        sedeNombre: evento.sedeNombre,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error('No se pudo publicar EventoProgramadoEvent; el evento sigue publicado', {
        eventoUuid: evento.uuid,
        error: error.message,
      });
    }
  }
}

module.exports = EventoService;
