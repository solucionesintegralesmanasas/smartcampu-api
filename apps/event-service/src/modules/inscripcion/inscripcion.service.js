const { ConflictError, NotFoundError } = require('../../core/exceptions');
const { getPaginationMeta } = require('../../core/helpers/pagination.helper');
const { ESTADOS_EVENTO } = require('../evento/evento.state-machine');
const { ESTADOS_INSCRIPCION } = require('./inscripcion.constants');

const toInscripcionResponse = (row) => ({
  uuid: row.uuid,
  registrante: { uuid: row.registranteUuid, nombre: row.registranteNombre },
  estado: row.estado,
  fechaRegistro: row.fechaRegistro,
  fechaConfirmacion: row.fechaConfirmacion,
  fechaCancelacion: row.fechaCancelacion,
  fechaAsistencia: row.fechaAsistencia,
});

/**
 * Lógica de negocio de inscripciones a eventos: control de aforo con bloqueo
 * transaccional, reactivación de inscripciones canceladas y listado.
 */
class InscripcionService {
  constructor({ eventoRepository, inscripcionRepository }) {
    this.eventoRepository = eventoRepository;
    this.inscripcionRepository = inscripcionRepository;
  }

  async inscribir(uuid, usuario) {
    return this.eventoRepository.withTransaction(async (conn) => {
      const evento = await this.eventoRepository.findByUuid(uuid, { conn, lock: true });
      if (!evento) {
        throw new NotFoundError(`El evento ${uuid} no existe`);
      }
      if (evento.estado !== ESTADOS_EVENTO.PUBLISHED) {
        throw new ConflictError('Solo se puede uno inscribir a un evento publicado');
      }
      if (!evento.requiereInscripcion) {
        throw new ConflictError('Este evento no requiere inscripción');
      }
      if (evento.fechaLimiteInscripcion && new Date() > new Date(evento.fechaLimiteInscripcion)) {
        throw new ConflictError('El plazo de inscripción ya cerró');
      }

      const existente = await this.inscripcionRepository.findByParticipante(
        evento.id,
        usuario.uuid,
        conn,
      );
      if (existente && existente.estado !== ESTADOS_INSCRIPCION.CANCELLED) {
        throw new ConflictError('Ya estás inscrito en este evento');
      }

      const ocupados = await this.inscripcionRepository.contarOcupados(evento.id, conn);
      if (Number.isInteger(evento.capacidadMaxima) && ocupados >= evento.capacidadMaxima) {
        throw new ConflictError('El evento alcanzó su aforo máximo');
      }

      const nombre = usuario.nombre || 'Participante';
      if (existente) {
        await this.inscripcionRepository.reactivar(existente.id, nombre, conn);
      } else {
        await this.inscripcionRepository.insert(
          { eventId: evento.id, registranteUuid: usuario.uuid, registranteNombre: nombre },
          conn,
        );
      }
      return { uuid, inscrito: true };
    });
  }

  async listar(uuid, filtros) {
    const evento = await this.eventoRepository.findByUuid(uuid);
    if (!evento) {
      throw new NotFoundError(`El evento ${uuid} no existe`);
    }
    const { rows, total } = await this.inscripcionRepository.findByEvento({
      eventId: evento.id,
      page: filtros.page,
      limit: filtros.limit,
    });
    return {
      data: rows.map(toInscripcionResponse),
      meta: getPaginationMeta(filtros.page, filtros.limit, total),
    };
  }

  async cancelar(uuid, usuario) {
    return this.eventoRepository.withTransaction(async (conn) => {
      const evento = await this.eventoRepository.findByUuid(uuid, { conn, lock: true });
      if (!evento) {
        throw new NotFoundError(`El evento ${uuid} no existe`);
      }
      const existente = await this.inscripcionRepository.findByParticipante(
        evento.id,
        usuario.uuid,
        conn,
      );
      if (!existente) {
        throw new NotFoundError('No tienes una inscripción en este evento');
      }
      if (existente.estado === ESTADOS_INSCRIPCION.CANCELLED) {
        throw new ConflictError('Tu inscripción ya está cancelada');
      }
      await this.inscripcionRepository.cancelar(existente.id, conn);
      return { uuid, cancelado: true };
    });
  }
}

module.exports = InscripcionService;
