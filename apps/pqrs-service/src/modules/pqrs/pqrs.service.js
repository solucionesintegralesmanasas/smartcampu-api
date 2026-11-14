const { v4: uuidv4 } = require('uuid');

// eslint-disable-next-line import/no-extraneous-dependencies
const { EVENT_TYPES } = require('@uajs/shared-types');

const { env } = require('../../config/env');
const { esClient } = require('../../config/elasticsearch');
const logger = require('../../config/logger');
const { ForbiddenError, NotFoundError, ValidationError } = require('../../core/exceptions');
const {
  parseFestivos,
  obtenerFechaLocal,
  sumarDiasHabiles,
} = require('../../core/helpers/business-days.helper');
const { getPaginationMeta, paginationHelper } = require('../../core/helpers/pagination.helper');
const {
  ESTADOS,
  ESTADOS_CALIFICABLES,
  validarTransicion,
} = require('./pqrs.state-machine');

const ROLES_PERSONAL = ['ADMIN', 'STAFF'];
const LONGITUD_MAXIMA_NOMBRE = 120;

const esPersonal = (usuario) => Boolean(usuario) && ROLES_PERSONAL.includes(usuario.rol);

const nombreSnapshot = (nombre) =>
  String(nombre || 'Usuario sin nombre').slice(0, LONGITUD_MAXIMA_NOMBRE);

const toRespuestaDto = (row) => ({
  uuid: row.uuid,
  respondedor: { uuid: row.respondedorUuid, nombre: row.respondedorNombre },
  cuerpo: row.cuerpo,
  esFinal: Number(row.esFinal) === 1,
  creadaEn: row.creadaEn,
});

const toResumenDto = (row) => ({
  uuid: row.uuid,
  numeroRadicado: row.ticket_number,
  asunto: row.subject,
  esAnonima: Number(row.is_anonymous) === 1,
  estado: { codigo: row.estado_codigo, nombre: row.estado_nombre, colorHex: row.estado_color },
  tipo: { codigo: row.tipo_codigo, nombre: row.tipo_nombre, plazoDias: row.tipo_plazo_dias },
  solicitante: row.is_anonymous
    ? { uuid: null, nombre: 'Anónimo' }
    : { uuid: row.requester_uuid, nombre: row.requester_name },
  asignado: row.assignee_uuid ? { uuid: row.assignee_uuid, nombre: row.assignee_name } : null,
  fechaRadicacion: row.filed_at,
  fechaLimite: row.response_due_date,
  fechaRespuesta: row.responded_at,
  fechaCierre: row.closed_at,
  calificacion: row.satisfaction_score,
  creadaEn: row.created_at,
});

const toDetalleDto = (row, respuestas) => ({
  ...toResumenDto(row),
  descripcion: row.description,
  actualizadaEn: row.updated_at,
  respuestas: respuestas.map(toRespuestaDto),
});

const toConsultaPublicaDto = (row) => ({
  numeroRadicado: row.ticket_number,
  asunto: row.subject,
  estado: { codigo: row.estado_codigo, nombre: row.estado_nombre },
  tipo: { codigo: row.tipo_codigo, nombre: row.tipo_nombre },
  fechaRadicacion: row.filed_at,
  fechaLimite: row.response_due_date,
  fechaRespuesta: row.responded_at,
  fechaCierre: row.closed_at,
});

/**
 * Lógica de negocio de PQRS: radicación (identificada o anónima), consulta pública,
 * asignación, respuestas, cambios de estado y calificación. Publica el evento de
 * respuesta definitiva después de confirmar la transacción.
 */
class PqrsService {
  /**
   * @param {import('./pqrs.repository')} pqrsRepository
   * @param {import('../../jobs/producers/pqrs.producer')} producer
   * @param {{ festivos?: Set<string>, reloj?: () => Date }} [opciones]
   */
  constructor(
    pqrsRepository,
    producer,
    { festivos = parseFestivos(env.HOLIDAYS), reloj = () => new Date() } = {},
  ) {
    this.repository = pqrsRepository;
    this.producer = producer;
    this.festivos = festivos;
    this.reloj = reloj;
  }

  async crear(usuario, dto) {
    const tipo = await this.repository.findTipoByCode(dto.tipoCodigo);
    if (!tipo) {
      throw new NotFoundError('El tipo de PQRS no existe o está inactivo');
    }

    const esAnonima = dto.anonima === true;
    if (!esAnonima && !usuario) {
      throw new ValidationError('Debe autenticarse o marcar la PQRS como anónima');
    }

    const ahora = this.reloj();
    const fechaRadicacion = obtenerFechaLocal(ahora);
    const fechaLimite = sumarDiasHabiles(fechaRadicacion, tipo.plazoDias, this.festivos);
    const uuid = uuidv4();
    const anio = fechaRadicacion.slice(0, 4);

    const solicitanteNombre = esAnonima ? null : nombreSnapshot(usuario.nombre || usuario.correo);
    const solicitanteEmail = esAnonima ? dto.email : usuario.correo || dto.email || null;

    await this.repository.withTransaction(async (conn) => {
      const radicada = await this.repository.findEstadoByCode(ESTADOS.RADICADA, conn);
      const secuencia = await this.repository.siguienteSecuencia(anio, conn);
      const numeroRadicado = `PQRS-${anio}-${String(secuencia).padStart(6, '0')}`;

      const pqrsId = await this.repository.insertPqrs(
        {
          uuid,
          numero: numeroRadicado,
          tipoId: tipo.id,
          estadoId: radicada.id,
          esAnonima,
          solicitanteUuid: esAnonima ? null : usuario.uuid,
          solicitanteNombre,
          solicitanteEmail,
          asunto: dto.asunto,
          descripcion: dto.descripcion,
          fechaLimite,
        },
        conn,
      );

      await this.repository.insertAuditoria(
        {
          uuid: uuidv4(),
          pqrsId,
          desdeEstadoId: null,
          haciaEstadoId: radicada.id,
          actorUuid: esAnonima ? uuid : usuario.uuid,
          actorNombre: esAnonima ? 'Anónimo' : solicitanteNombre,
          comentario: 'PQRS radicada',
        },
        conn,
      );
    });

    const creada = await this.repository.findByUuid(uuid);
    await this.indexar(creada);

    return {
      cuenta: null,
      uuid,
      numeroRadicado: creada.ticket_number,
      fechaLimite,
    };
  }

  async consultarPorRadicado(ticket, email) {
    const pqrs = await this.repository.findByTicket(ticket);
    if (!pqrs || pqrs.requester_email !== email) {
      throw new NotFoundError('No se encontró una PQRS con ese radicado y correo');
    }
    return toConsultaPublicaDto(pqrs);
  }

  async listarMias(usuario, filtros = {}) {
    const { page, limit, offset } = paginationHelper(filtros.page, filtros.limit);
    const { rows, total } = await this.repository.findPqrs({
      limit,
      offset,
      requesterUuid: usuario.uuid,
      estado: filtros.estado,
      tipoCodigo: filtros.tipoCodigo,
      vencidas: filtros.vencidas,
    });
    return { data: rows.map(toResumenDto), meta: getPaginationMeta(page, limit, total) };
  }

  async listarPersonal(filtros = {}) {
    const { page, limit, offset } = paginationHelper(filtros.page, filtros.limit);
    const { rows, total } = await this.repository.findPqrs({
      limit,
      offset,
      estado: filtros.estado,
      tipoCodigo: filtros.tipoCodigo,
      vencidas: filtros.vencidas,
    });
    return { data: rows.map(toResumenDto), meta: getPaginationMeta(page, limit, total) };
  }

  async obtener(usuario, uuid) {
    const pqrs = await this.obtenerVisible(usuario, uuid);
    const respuestas = await this.repository.findRespuestas(pqrs.id);
    return toDetalleDto(pqrs, respuestas);
  }

  async asignar(usuario, uuid, dto) {
    this.exigirPersonal(usuario);
    const ahora = this.reloj();

    await this.repository.withTransaction(async (conn) => {
      const pqrs = await this.repository.findByUuid(uuid, { conn, bloquear: true });
      if (!pqrs) {
        throw new NotFoundError('La PQRS no existe');
      }

      await this.repository.updateAsignacion(
        pqrs.id,
        { asignadoUuid: dto.asignadoUuid, asignadoNombre: dto.asignadoNombre },
        conn,
      );

      if (pqrs.estado_codigo === ESTADOS.RADICADA) {
        validarTransicion(pqrs.estado_codigo, ESTADOS.EN_TRAMITE);
        const enTramite = await this.repository.findEstadoByCode(ESTADOS.EN_TRAMITE, conn);
        await this.repository.updateEstado(pqrs.id, { estadoId: enTramite.id }, conn);
        await this.repository.insertAuditoria(
          {
            uuid: uuidv4(),
            pqrsId: pqrs.id,
            desdeEstadoId: pqrs.estado_id,
            haciaEstadoId: enTramite.id,
            actorUuid: usuario.uuid,
            actorNombre: nombreSnapshot(usuario.nombre || usuario.correo),
            comentario: 'PQRS asignada a funcionario',
          },
          conn,
        );
      }
    });

    logger.debug('PQRS asignada', { uuid, ahora: ahora.toISOString() });
    return this.obtener(usuario, uuid);
  }

  async responder(usuario, uuid, dto) {
    this.exigirPersonal(usuario);
    const ahora = this.reloj();
    let respuestaId;

    const resultado = await this.repository.withTransaction(async (conn) => {
      const pqrs = await this.repository.findByUuid(uuid, { conn, bloquear: true });
      if (!pqrs) {
        throw new NotFoundError('La PQRS no existe');
      }
      if (pqrs.estado_codigo === ESTADOS.CERRADA) {
        throw new ValidationError('No se puede responder una PQRS cerrada');
      }

      respuestaId = await this.repository.insertRespuesta(
        {
          uuid: uuidv4(),
          pqrsId: pqrs.id,
          respondedorUuid: usuario.uuid,
          respondedorNombre: nombreSnapshot(usuario.nombre || usuario.correo),
          cuerpo: dto.cuerpo,
          esFinal: dto.esFinal === true,
        },
        conn,
      );

      if (dto.esFinal === true) {
        validarTransicion(pqrs.estado_codigo, ESTADOS.RESPONDIDA);
        const respondida = await this.repository.findEstadoByCode(ESTADOS.RESPONDIDA, conn);
        await this.repository.updateEstado(
          pqrs.id,
          { estadoId: respondida.id, responder: true },
          conn,
        );
        await this.repository.insertAuditoria(
          {
            uuid: uuidv4(),
            pqrsId: pqrs.id,
            desdeEstadoId: pqrs.estado_id,
            haciaEstadoId: respondida.id,
            actorUuid: usuario.uuid,
            actorNombre: nombreSnapshot(usuario.nombre || usuario.correo),
            comentario: 'Respuesta definitiva emitida',
          },
          conn,
        );
      }

      return {
        pqrsUuid: pqrs.uuid,
        tipoCodigo: pqrs.tipo_codigo,
        esFinal: dto.esFinal === true,
      };
    });

    if (resultado.esFinal) {
      await this.publicarEvento(EVENT_TYPES.PQRS_RESPONDIDA, {
        type: EVENT_TYPES.PQRS_RESPONDIDA,
        pqrsUuid: resultado.pqrsUuid,
        tipoPqrs: resultado.tipoCodigo,
        respuesta: dto.cuerpo,
        usuarioRespondeId: usuario.id,
        timestamp: ahora.toISOString(),
      });
    }

    logger.debug('Respuesta registrada', { uuid, respuestaId });
    return this.obtener(usuario, uuid);
  }

  async cambiarEstado(usuario, uuid, dto) {
    this.exigirPersonal(usuario);

    await this.repository.withTransaction(async (conn) => {
      const pqrs = await this.repository.findByUuid(uuid, { conn, bloquear: true });
      if (!pqrs) {
        throw new NotFoundError('La PQRS no existe');
      }
      validarTransicion(pqrs.estado_codigo, dto.estado);

      if (
        pqrs.estado_codigo === ESTADOS.RADICADA &&
        dto.estado === ESTADOS.CERRADA &&
        usuario.rol !== 'ADMIN'
      ) {
        throw new ForbiddenError('Solo un administrador puede cerrar una PQRS radicada');
      }

      const nuevoEstado = await this.repository.findEstadoByCode(dto.estado, conn);
      await this.repository.updateEstado(
        pqrs.id,
        { estadoId: nuevoEstado.id, cerrar: dto.estado === ESTADOS.CERRADA },
        conn,
      );
      await this.repository.insertAuditoria(
        {
          uuid: uuidv4(),
          pqrsId: pqrs.id,
          desdeEstadoId: pqrs.estado_id,
          haciaEstadoId: nuevoEstado.id,
          actorUuid: usuario.uuid,
          actorNombre: nombreSnapshot(usuario.nombre || usuario.correo),
          comentario: dto.comentario || null,
        },
        conn,
      );
    });

    return this.obtener(usuario, uuid);
  }

  async calificar(usuario, uuid, dto) {
    const pqrs = await this.obtenerVisible(usuario, uuid);
    if (esPersonal(usuario)) {
      throw new ForbiddenError('El personal no puede calificar su propia respuesta');
    }
    if (!ESTADOS_CALIFICABLES.includes(pqrs.estado_codigo)) {
      throw new ValidationError('Solo se puede calificar una PQRS respondida o cerrada');
    }

    await this.repository.updateCalificacion(pqrs.id, dto.puntaje);
    return this.obtener(usuario, uuid);
  }

  /**
   * Obtiene una PQRS verificando que el usuario sea el solicitante o personal.
   * Las PQRS anónimas solo son visibles para el personal.
   * @throws {NotFoundError} Si no existe.
   * @throws {ForbiddenError} Si el usuario no puede verla.
   */
  async obtenerVisible(usuario, uuid) {
    const pqrs = await this.repository.findByUuid(uuid);
    if (!pqrs) {
      throw new NotFoundError('La PQRS no existe');
    }
    if (esPersonal(usuario)) {
      return pqrs;
    }
    if (Number(pqrs.is_anonymous) === 1 || pqrs.requester_uuid !== usuario.uuid) {
      throw new ForbiddenError('No tienes permiso para acceder a esta PQRS');
    }
    return pqrs;
  }

  exigirPersonal(usuario) {
    if (!esPersonal(usuario)) {
      throw new ForbiddenError('Solo el personal puede realizar esta acción');
    }
  }

  /**
   * Publica un evento sin revertir la operación de negocio: si la cola falla, solo se registra.
   */
  async publicarEvento(tipoEvento, payload) {
    try {
      await this.producer.publicar(tipoEvento, payload);
    } catch (error) {
      logger.error('No se pudo publicar el evento de PQRS', {
        tipoEvento,
        error: error.message,
      });
    }
  }

  /**
   * Indexa la PQRS en Elasticsearch sin bloquear la operación.
   */
  async indexar(pqrs) {
    if (!pqrs) {
      return;
    }
    try {
      await esClient.index({
        index: env.PQRS_INDEX,
        id: pqrs.uuid,
        document: {
          id: pqrs.id,
          uuid: pqrs.uuid,
          ticket_number: pqrs.ticket_number,
          tipo_codigo: pqrs.tipo_codigo,
          estado_codigo: pqrs.estado_codigo,
          asunto: pqrs.subject,
          descripcion: pqrs.description,
          requester_uuid: pqrs.requester_uuid,
          requester_name: pqrs.requester_name,
          assignee_uuid: pqrs.assignee_uuid,
          assignee_name: pqrs.assignee_name,
          fecha_radicacion: pqrs.filed_at,
          fecha_respuesta: pqrs.responded_at,
          fecha_cierre: pqrs.closed_at,
          calificacion: pqrs.satisfaction_score,
          activo: Number(pqrs.is_active) === 1,
          createdAt: pqrs.created_at,
          updatedAt: pqrs.updated_at,
        },
      });
    } catch (error) {
      logger.warn('No se pudo indexar la PQRS en Elasticsearch', { error: error.message });
    }
  }
}

module.exports = PqrsService;
