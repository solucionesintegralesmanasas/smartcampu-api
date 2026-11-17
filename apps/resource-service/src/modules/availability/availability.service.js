const { NotFoundError } = require('../../core/exceptions');
const { getDayOfWeek } = require('../../core/helpers/time.helper');
const { evaluarDisponibilidad } = require('./availability.rules');

/**
 * Servicio de consulta de disponibilidad de recursos. Es el contrato interno que
 * consume booking-service antes de crear una reserva.
 */
class AvailabilityService {
  /**
   * @param {import('../resources/resources.repository')} resourcesRepository
   * @param {import('../schedules/schedules.repository')} schedulesRepository
   * @param {import('../blackouts/blackouts.repository')} blackoutsRepository
   */
  constructor(resourcesRepository, schedulesRepository, blackoutsRepository) {
    this.resourcesRepository = resourcesRepository;
    this.schedulesRepository = schedulesRepository;
    this.blackoutsRepository = blackoutsRepository;
  }

  /**
   * @param {string|number} identifier - Id interno o UUID del recurso.
   * @param {{fecha: string, horaInicio: string, horaFin: string}} consulta
   * @returns {Promise<{disponible: boolean, motivo: string|null, recurso: object}>}
   */
  async consultar(identifier, { fecha, horaInicio, horaFin }) {
    const recurso = await this.resourcesRepository.findOne(identifier);
    if (!recurso) {
      throw new NotFoundError(`Recurso con ID ${identifier} no encontrado`);
    }

    const diaSemana = getDayOfWeek(fecha);
    const [horario, bloqueos] = await Promise.all([
      this.schedulesRepository.findByResourceAndDay(recurso.id, diaSemana),
      this.blackoutsRepository.findOverlappingDay(recurso.id, fecha),
    ]);

    const resultado = evaluarDisponibilidad({
      recurso,
      horario,
      bloqueos,
      fecha,
      horaInicio,
      horaFin,
    });

    return {
      ...resultado,
      recurso: { id: recurso.id, uuid: recurso.uuid, nombre: recurso.nombre },
    };
  }
}

module.exports = AvailabilityService;
