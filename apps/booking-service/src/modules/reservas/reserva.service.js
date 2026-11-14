const crypto = require('crypto');

const logger = require('../../config/logger');
const {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
} = require('../../core/exceptions');
const { getPaginationMeta } = require('../../core/helpers/pagination.helper');
const { esAdmin, esGestor } = require('../auth/auth.roles');

const { ESTADOS, ESTADOS_BLOQUEANTES, assertTransicion } = require('./reserva.state-machine');
const { haySolape, normalizarHora, validarReglasTipo } = require('./reserva.rules');

const ESTADOS_CON_APROBADOR = Object.freeze([ESTADOS.APPROVED, ESTADOS.REJECTED]);

const COLUMNA_FECHA_POR_ESTADO = Object.freeze({
  [ESTADOS.APPROVED]: 'approved_at',
  [ESTADOS.COMPLETED]: 'completed_at',
  [ESTADOS.CANCELLED]: 'cancelled_at',
});

const generarReferencia = () =>
  `BK-${new Date().getUTCFullYear()}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;

const recortar = (texto, maximo) => String(texto || '').slice(0, maximo);

const presentarReserva = (reserva) => ({
  uuid: reserva.uuid,
  referencia: reserva.referencia,
  tipo: { codigo: reserva.tipoCodigo, nombre: reserva.tipoNombre },
  estado: { codigo: reserva.estadoCodigo, nombre: reserva.estadoNombre, colorHex: reserva.estadoColor },
  recurso: { uuid: reserva.recursoUuid, nombre: reserva.recursoNombre },
  solicitante: { uuid: reserva.solicitanteUuid, nombre: reserva.solicitanteNombre },
  aprobadorUuid: reserva.aprobadorUuid,
  titulo: reserva.titulo,
  descripcion: reserva.descripcion,
  fecha: reserva.fecha,
  horaInicio: reserva.horaInicio,
  horaFin: reserva.horaFin,
  asistentesEsperados: reserva.asistentesEsperados,
  motivoCancelacion: reserva.motivoCancelacion,
  solicitadaEn: reserva.solicitadaEn,
  aprobadaEn: reserva.aprobadaEn,
  canceladaEn: reserva.canceladaEn,
  completadaEn: reserva.completadaEn,
  createdAt: reserva.createdAt,
  updatedAt: reserva.updatedAt,
});

const presentarAuditoria = (registro) => ({
  uuid: registro.uuid,
  desde: registro.desdeCodigo,
  hacia: registro.hastaCodigo,
  actor: { uuid: registro.actorUuid, nombre: registro.actorNombre },
  comentario: registro.comentario,
  ocurridoEn: registro.ocurridoEn,
});

/**
 * Lógica de negocio de reservas: creación con control de solapes, consulta con
 * permisos por rol, transiciones de estado auditadas y publicación de eventos.
 */
class ReservaService {
  /**
   * @param {import('./reserva.repository')} reservaRepository
   * @param {import('../catalogo/catalogo.repository')} catalogoRepository
   * @param {import('./reserva.availability.client')} disponibilidadClient
   * @param {import('../../jobs/producers/reserva.producer').ReservaProducer} eventProducer
   */
  constructor(reservaRepository, catalogoRepository, disponibilidadClient, eventProducer) {
    this.reservaRepository = reservaRepository;
    this.catalogoRepository = catalogoRepository;
    this.disponibilidadClient = disponibilidadClient;
    this.eventProducer = eventProducer;
  }

  /**
   * Crea una reserva en estado pending.
   * @param {object} dto - Datos validados por crearReservaSchema.
   * @param {object} actor - Usuario autenticado (req.user).
   */
  async crear(dto, actor) {
    const tipo = await this.catalogoRepository.findTipoByCodigo(dto.tipoCodigo);
    if (!tipo || !tipo.activo) {
      throw new NotFoundError(`El tipo de reserva '${dto.tipoCodigo}' no existe o está inactivo`);
    }

    const horaInicio = normalizarHora(dto.horaInicio);
    const horaFin = normalizarHora(dto.horaFin);
    const hoy = new Date().toISOString().slice(0, 10);
    const incumplimientos = validarReglasTipo(tipo, { fecha: dto.fecha, horaInicio, horaFin }, hoy);
    if (incumplimientos.length > 0) {
      throw new ValidationError('La reserva no cumple las reglas de su tipo', incumplimientos);
    }

    const disponibilidad = await this.disponibilidadClient.verificarDisponibilidad({
      recursoUuid: dto.recursoUuid,
      fecha: dto.fecha,
      horaInicio,
      horaFin,
      tokenUsuario: actor.token,
    });
    if (!disponibilidad.disponible) {
      throw new ConflictError(
        disponibilidad.motivo || 'El recurso no está disponible en el horario solicitado',
      );
    }

    const reserva = await this.reservaRepository.withTransaction(async (conn) => {
      const activas = await this.reservaRepository.findActivasPorRecursoYFecha(
        dto.recursoUuid,
        dto.fecha,
        ESTADOS_BLOQUEANTES,
        conn,
      );
      if (activas.some((existente) => haySolape(existente, { horaInicio, horaFin }))) {
        throw new ConflictError(
          'El recurso ya tiene una reserva activa que se solapa con el horario solicitado',
        );
      }

      const estadoPendiente = await this.catalogoRepository.findEstadoByCodigo(
        ESTADOS.PENDING,
        conn,
      );

      let reservaId;
      try {
        reservaId = await this.reservaRepository.insert(
          {
            tipoId: tipo.id,
            estadoId: estadoPendiente.id,
            referencia: generarReferencia(),
            recursoUuid: dto.recursoUuid,
            recursoNombre: recortar(disponibilidad.recursoNombre || 'Recurso sin nombre', 100),
            solicitanteUuid: actor.uuid,
            solicitanteNombre: recortar(actor.nombre, 120),
            titulo: dto.titulo,
            descripcion: dto.descripcion || null,
            fecha: dto.fecha,
            horaInicio,
            horaFin,
            asistentesEsperados: dto.asistentesEsperados || null,
          },
          conn,
        );
      } catch (error) {
        // La restricción uq_bookings_slot impide dos reservas con el mismo inicio.
        if (error.code === 'ER_DUP_ENTRY') {
          throw new ConflictError('El recurso ya está reservado en esa fecha y hora de inicio');
        }
        throw error;
      }

      await this.reservaRepository.insertAuditoria(
        {
          reservaId,
          estadoOrigenId: null,
          estadoDestinoId: estadoPendiente.id,
          actorUuid: actor.uuid,
          actorNombre: recortar(actor.nombre, 120),
          comentario: 'Solicitud creada',
        },
        conn,
      );

      return this.reservaRepository.findById(reservaId, conn);
    });

    return presentarReserva(reserva);
  }

  /**
   * Listado paginado. Los usuarios sin rol de gestión solo ven sus propias reservas.
   */
  async listar(filtros, actor) {
    const { rows, total } = await this.reservaRepository.findAll({
      page: filtros.page,
      limit: filtros.limit,
      estado: filtros.estado,
      recursoUuid: filtros.recursoUuid,
      solicitanteUuid: esGestor(actor) ? undefined : actor.uuid,
    });

    return {
      data: rows.map(presentarReserva),
      meta: getPaginationMeta(filtros.page, filtros.limit, total),
    };
  }

  /**
   * Detalle de una reserva con su historial de transiciones.
   * Solo el solicitante o un usuario de gestión puede consultarla.
   */
  async obtener(uuid, actor) {
    const reserva = await this.reservaRepository.findByUuid(uuid);
    if (!reserva) {
      throw new NotFoundError(`La reserva ${uuid} no existe`);
    }
    if (!esGestor(actor) && reserva.solicitanteUuid !== actor.uuid) {
      throw new ForbiddenError('No tiene permisos para consultar esta reserva');
    }

    const historial = await this.reservaRepository.findAuditTrail(reserva.id);
    return { ...presentarReserva(reserva), historial: historial.map(presentarAuditoria) };
  }

  /**
   * Cambia el estado de una reserva (solo ADMIN o STAFF, validado en la ruta).
   */
  async cambiarEstado(uuid, { estado, comentario }, actor) {
    return this.transicionar(uuid, estado, actor, {
      comentario,
      validarAcceso: () => esGestor(actor),
    });
  }

  /**
   * Cancela una reserva confirmada. Puede hacerlo el solicitante o un ADMIN.
   */
  async cancelar(uuid, { comentario }, actor) {
    return this.transicionar(uuid, ESTADOS.CANCELLED, actor, {
      comentario,
      validarAcceso: (reserva) => esAdmin(actor) || reserva.solicitanteUuid === actor.uuid,
    });
  }

  /**
   * Ejecuta una transición validada, con bloqueo de la fila, actualización y auditoría
   * en la misma transacción. El evento se publica después del commit.
   */
  async transicionar(uuid, destino, actor, { comentario = null, validarAcceso = null }) {
    const actualizada = await this.reservaRepository.withTransaction(async (conn) => {
      const reserva = await this.reservaRepository.findByUuid(uuid, conn, { bloquear: true });
      if (!reserva) {
        throw new NotFoundError(`La reserva ${uuid} no existe`);
      }
      if (validarAcceso && !validarAcceso(reserva)) {
        throw new ForbiddenError('No tiene permisos para cambiar el estado de esta reserva');
      }

      assertTransicion(reserva.estadoCodigo, destino);

      const estadoDestino = await this.catalogoRepository.findEstadoByCodigo(destino, conn);
      await this.reservaRepository.updateEstado(
        reserva.id,
        {
          estadoId: estadoDestino.id,
          aprobadorUuid: ESTADOS_CON_APROBADOR.includes(destino) ? actor.uuid : undefined,
          columnaFecha: COLUMNA_FECHA_POR_ESTADO[destino],
          motivoCancelacion: destino === ESTADOS.CANCELLED ? comentario : undefined,
        },
        conn,
      );

      await this.reservaRepository.insertAuditoria(
        {
          reservaId: reserva.id,
          estadoOrigenId: reserva.estadoId,
          estadoDestinoId: estadoDestino.id,
          actorUuid: actor.uuid,
          actorNombre: recortar(actor.nombre, 120),
          comentario,
        },
        conn,
      );

      return this.reservaRepository.findById(reserva.id, conn);
    });

    if (destino === ESTADOS.CONFIRMED) {
      await this.publicarReservaConfirmada(actualizada);
    }

    return presentarReserva(actualizada);
  }

  /**
   * Publica ReservaConfirmadaEvent. Si falla, solo se registra: la reserva ya está confirmada.
   */
  async publicarReservaConfirmada(reserva) {
    try {
      await this.eventProducer.publicarReservaConfirmada({
        reservaUuid: reserva.uuid,
        recursoId: reserva.recursoUuid,
        usuarioId: reserva.solicitanteUuid,
        fechaReserva: reserva.fecha,
        horaInicio: reserva.horaInicio,
        horaFin: reserva.horaFin,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error('No se pudo publicar ReservaConfirmadaEvent; la reserva sigue confirmada', {
        reservaUuid: reserva.uuid,
        error: error.message,
      });
    }
  }
}

module.exports = ReservaService;
