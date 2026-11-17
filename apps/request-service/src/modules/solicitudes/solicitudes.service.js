const { v4: uuidv4 } = require('uuid');

// eslint-disable-next-line import/no-extraneous-dependencies
const { EVENT_TYPES } = require('@uajs/shared-types');

const { env } = require('../../config/env');
const logger = require('../../config/logger');
const { ForbiddenError, NotFoundError } = require('../../core/exceptions');
const {
  parseFestivos,
  obtenerFechaLocal,
  sumarDiasHabiles,
} = require('../../core/helpers/business-days.helper');
const { getPaginationMeta, paginationHelper } = require('../../core/helpers/pagination.helper');
const { ESTADOS, validarTransicion } = require('./solicitudes.state-machine');

const ROLES_PERSONAL = ['ADMIN', 'STAFF'];
const LONGITUD_MAXIMA_NOMBRE = 120;

const esPersonal = (usuario) => ROLES_PERSONAL.includes(usuario.rol);

const nombreSnapshot = (usuario) =>
  (usuario.nombre || usuario.correo || 'Usuario sin nombre').slice(0, LONGITUD_MAXIMA_NOMBRE);

const toEstadoDto = (row) => ({
  codigo: row.estado_codigo,
  nombre: row.estado_nombre,
  colorHex: row.estado_color,
});

const toAsignadoDto = (row) =>
  row.assignee_uuid ? { uuid: row.assignee_uuid, nombre: row.assignee_name } : null;

const toComentarioDto = (row) => ({
  uuid: row.uuid,
  autor: { uuid: row.autorUuid, nombre: row.autorNombre },
  contenido: row.contenido,
  esInterno: Number(row.esInterno) === 1,
  creadoEn: row.creadoEn,
});

const toAdjuntoDto = (row) => ({
  uuid: row.uuid,
  fileUuid: row.fileUuid,
  nombreOriginal: row.nombreOriginal,
  mimeType: row.mimeType,
  tamanoBytes: row.tamanoBytes,
  subidoPorUuid: row.subidoPorUuid,
  subidoEn: row.subidoEn,
});

const toResumenDto = (row) => ({
  uuid: row.uuid,
  numeroSolicitud: row.ticket_number,
  titulo: row.title,
  estado: toEstadoDto(row),
  tipo: {
    uuid: row.tipo_uuid,
    codigo: row.tipo_codigo,
    nombre: row.tipo_nombre,
    requiereAprobacion: Number(row.requiere_aprobacion) === 1,
  },
  solicitante: { uuid: row.requester_uuid, nombre: row.requester_name },
  asignado: toAsignadoDto(row),
  fechaLimite: row.due_date,
  fechaResolucion: row.resolved_at,
  creadaEn: row.created_at,
});

const toSolicitudDto = (row, comentarios, adjuntos) => ({
  ...toResumenDto(row),
  descripcion: row.description,
  formData: row.form_data || null,
  actualizadaEn: row.updated_at,
  comentarios: comentarios.map(toComentarioDto),
  adjuntos: adjuntos.map(toAdjuntoDto),
});

/**
 * Lógica de negocio de solicitudes: radicación, consulta con permisos, comentarios,
 * adjuntos y cambios de estado. Publica eventos después de confirmar cada transacción.
 */
class SolicitudesService {
  /**
   * @param {import('./solicitudes.repository')} solicitudesRepository
   * @param {import('../../jobs/producers/solicitudes.producer')} producer
   * @param {{ festivos?: Set<string>, reloj?: () => Date }} [opciones]
   */
  constructor(
    solicitudesRepository,
    producer,
    { festivos = parseFestivos(env.HOLIDAYS), reloj = () => new Date() } = {},
  ) {
    this.repository = solicitudesRepository;
    this.producer = producer;
    this.festivos = festivos;
    this.reloj = reloj;
  }

  async crear(usuario, dto) {
    const tipo = await this.repository.findTipoActivoByUuid(dto.tipoUuid);
    if (!tipo) {
      throw new NotFoundError('El tipo de solicitud no existe o está inactivo');
    }

    const ahora = this.reloj();
    const fechaRadicacion = obtenerFechaLocal(ahora);
    const fechaLimite = Number.isInteger(tipo.slaDias)
      ? sumarDiasHabiles(fechaRadicacion, tipo.slaDias, this.festivos)
      : null;
    const uuid = uuidv4();
    const anio = fechaRadicacion.slice(0, 4);

    const numero = await this.repository.withTransaction(async (conn) => {
      const pendiente = await this.repository.findEstadoByCode(ESTADOS.PENDING, conn);
      const secuencia = await this.repository.siguienteSecuencia(anio, conn);
      const numeroTicket = `REQ-${anio}-${String(secuencia).padStart(6, '0')}`;

      const solicitudId = await this.repository.insertSolicitud(
        {
          uuid,
          numero: numeroTicket,
          tipoId: tipo.id,
          estadoId: pendiente.id,
          solicitanteUuid: usuario.uuid,
          solicitanteNombre: nombreSnapshot(usuario),
          titulo: dto.titulo,
          descripcion: dto.descripcion,
          formData: dto.formData,
          fechaLimite,
        },
        conn,
      );

      await this.repository.insertAuditoria(
        {
          uuid: uuidv4(),
          solicitudId,
          desdeEstadoId: null,
          haciaEstadoId: pendiente.id,
          actorUuid: usuario.uuid,
          actorNombre: nombreSnapshot(usuario),
          comentario: 'Solicitud radicada',
        },
        conn,
      );
      return numeroTicket;
    });

    await this.publicarEvento(EVENT_TYPES.SOLICITUD_CREADA, {
      type: EVENT_TYPES.SOLICITUD_CREADA,
      solicitudUuid: uuid,
      numero_solicitud: numero,
      usuarioId: usuario.id,
      tipoSolicitud: tipo.code,
      descripcion: dto.descripcion,
      timestamp: ahora.toISOString(),
    });

    return this.obtener(usuario, uuid);
  }

  async listar(usuario, filtros = {}) {
    const { page, limit, offset } = paginationHelper(filtros.page, filtros.limit);
    const personal = esPersonal(usuario);

    const { rows, total } = await this.repository.findSolicitudes({
      limit,
      offset,
      requesterUuid: personal ? undefined : usuario.uuid,
      estado: filtros.estado,
      tipoUuid: filtros.tipoUuid,
      asignadoUuid: personal ? filtros.asignadoUuid : undefined,
    });

    return {
      data: rows.map(toResumenDto),
      meta: getPaginationMeta(page, limit, total),
    };
  }

  async obtener(usuario, uuid) {
    const solicitud = await this.obtenerVisible(usuario, uuid);
    const personal = esPersonal(usuario);
    const [comentarios, adjuntos] = await Promise.all([
      this.repository.findComentarios(solicitud.id, { soloPublicos: !personal }),
      this.repository.findAdjuntos(solicitud.id),
    ]);
    const comentariosVisibles = personal
      ? comentarios
      : comentarios.filter((comentario) => Number(comentario.esInterno) !== 1);
    return toSolicitudDto(solicitud, comentariosVisibles, adjuntos);
  }

  async agregarComentario(usuario, uuid, dto) {
    const solicitud = await this.obtenerVisible(usuario, uuid);
    if (dto.esInterno && !esPersonal(usuario)) {
      throw new ForbiddenError('Solo el personal puede crear comentarios internos');
    }

    const ahora = this.reloj();
    const comentario = {
      uuid: uuidv4(),
      solicitudId: solicitud.id,
      autorUuid: usuario.uuid,
      autorNombre: nombreSnapshot(usuario),
      contenido: dto.contenido,
      esInterno: dto.esInterno === true,
    };
    await this.repository.insertComentario(comentario);

    return toComentarioDto({
      uuid: comentario.uuid,
      autorUuid: comentario.autorUuid,
      autorNombre: comentario.autorNombre,
      contenido: comentario.contenido,
      esInterno: comentario.esInterno,
      creadoEn: ahora,
    });
  }

  async agregarAdjunto(usuario, uuid, dto) {
    const solicitud = await this.obtenerVisible(usuario, uuid);

    const ahora = this.reloj();
    const adjunto = {
      uuid: uuidv4(),
      solicitudId: solicitud.id,
      subidoPorUuid: usuario.uuid,
      fileUuid: dto.fileUuid,
      nombreOriginal: dto.nombreOriginal,
      mimeType: dto.mimeType,
      tamanoBytes: dto.tamanoBytes,
    };
    await this.repository.insertAdjunto(adjunto);

    return toAdjuntoDto({ ...adjunto, subidoEn: ahora });
  }

  async cambiarEstado(usuario, uuid, dto) {
    if (!esPersonal(usuario)) {
      throw new ForbiddenError('Solo el personal puede cambiar el estado de una solicitud');
    }

    const ahora = this.reloj();
    const transicion = await this.repository.withTransaction(async (conn) => {
      const solicitud = await this.repository.findByUuid(uuid, { conn, bloquear: true });
      if (!solicitud) {
        throw new NotFoundError('La solicitud no existe');
      }

      validarTransicion(solicitud.estado_codigo, dto.estado, {
        requiereAprobacion: Number(solicitud.requiere_aprobacion) === 1,
      });

      const nuevoEstado = await this.repository.findEstadoByCode(dto.estado, conn);
      await this.repository.updateEstado(
        solicitud.id,
        {
          estadoId: nuevoEstado.id,
          cerrar: dto.estado === ESTADOS.CLOSED,
          asignadoUuid: dto.asignadoUuid,
        },
        conn,
      );

      await this.repository.insertAuditoria(
        {
          uuid: uuidv4(),
          solicitudId: solicitud.id,
          desdeEstadoId: solicitud.estado_id,
          haciaEstadoId: nuevoEstado.id,
          actorUuid: usuario.uuid,
          actorNombre: nombreSnapshot(usuario),
          comentario: dto.comentario || null,
        },
        conn,
      );

      return {
        solicitudUuid: solicitud.uuid,
        estadoAnterior: solicitud.estado_codigo,
        estadoNuevo: dto.estado,
      };
    });

    await this.publicarEvento(EVENT_TYPES.SOLICITUD_ESTADO_CAMBIADO, {
      type: EVENT_TYPES.SOLICITUD_ESTADO_CAMBIADO,
      solicitudUuid: transicion.solicitudUuid,
      estadoAnterior: transicion.estadoAnterior,
      estadoNuevo: transicion.estadoNuevo,
      usuarioId: usuario.id,
      timestamp: ahora.toISOString(),
    });

    return this.obtener(usuario, uuid);
  }

  /**
   * Obtiene una solicitud verificando que el usuario sea el solicitante o personal.
   * @throws {NotFoundError} Si no existe.
   * @throws {ForbiddenError} Si el usuario no es el dueño ni personal.
   */
  async obtenerVisible(usuario, uuid) {
    const solicitud = await this.repository.findByUuid(uuid);
    if (!solicitud) {
      throw new NotFoundError('La solicitud no existe');
    }
    if (!esPersonal(usuario) && solicitud.requester_uuid !== usuario.uuid) {
      throw new ForbiddenError('No tienes permiso para acceder a esta solicitud');
    }
    return solicitud;
  }

  /**
   * Publica un evento sin revertir la operación de negocio: si la cola falla, solo se registra.
   */
  async publicarEvento(tipoEvento, payload) {
    try {
      await this.producer.publicar(tipoEvento, payload);
    } catch (error) {
      logger.error('No se pudo publicar el evento de solicitud', {
        tipoEvento,
        error: error.message,
      });
    }
  }
}

module.exports = SolicitudesService;
