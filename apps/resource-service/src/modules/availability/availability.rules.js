const { timeToMinutes, getDayOfWeek } = require('../../core/helpers/time.helper');

/**
 * Construye el instante 'YYYY-MM-DD HH:mm:ss' de una hora de un día.
 * @param {string} fecha - YYYY-MM-DD.
 * @param {string} hora - HH:mm.
 * @returns {string}
 */
const instante = (fecha, hora) => `${fecha} ${hora.slice(0, 5)}:00`;

/**
 * Evalúa la disponibilidad de un recurso en una franja concreta.
 *
 * Reglas (en orden):
 *  1. El recurso debe estar activo y su estado debe permitir reservas.
 *  2. Debe existir horario para ese día de la semana que cubra el intervalo.
 *  3. Ningún bloqueo debe solaparse con el intervalo solicitado.
 *
 * Los bloqueos se comparan como cadenas 'YYYY-MM-DD HH:mm:ss', formato ordenable.
 *
 * @param {object} params
 * @param {object} params.recurso - Recurso con { activo, estadoReservable }.
 * @param {{horaApertura: string, horaCierre: string}|null} params.horario - Horario del día.
 * @param {Array<{inicio: string, fin: string, motivo?: string}>} params.bloqueos - Bloqueos que intersecan el día.
 * @param {string} params.fecha - YYYY-MM-DD.
 * @param {string} params.horaInicio - HH:mm.
 * @param {string} params.horaFin - HH:mm.
 * @returns {{disponible: boolean, motivo: string|null}}
 */
const evaluarDisponibilidad = ({ recurso, horario, bloqueos, fecha, horaInicio, horaFin }) => {
  if (!recurso || !recurso.activo) {
    return { disponible: false, motivo: 'El recurso no existe o está inactivo' };
  }
  if (!recurso.estadoReservable) {
    return { disponible: false, motivo: 'El estado del recurso no permite reservas' };
  }
  if (!horario) {
    return { disponible: false, motivo: 'No hay horario configurado para ese día' };
  }

  const inicio = timeToMinutes(horaInicio);
  const fin = timeToMinutes(horaFin);
  if (inicio >= fin) {
    return { disponible: false, motivo: 'La hora de fin debe ser posterior a la de inicio' };
  }
  if (inicio < timeToMinutes(horario.horaApertura) || fin > timeToMinutes(horario.horaCierre)) {
    return { disponible: false, motivo: 'La franja solicitada está fuera del horario del recurso' };
  }

  const reqInicio = instante(fecha, horaInicio);
  const reqFin = instante(fecha, horaFin);
  const bloqueo = (bloqueos || []).find((b) => b.inicio < reqFin && reqInicio < b.fin);
  if (bloqueo) {
    return {
      disponible: false,
      motivo: bloqueo.motivo
        ? `El recurso está bloqueado: ${bloqueo.motivo}`
        : 'El recurso está bloqueado en el horario solicitado',
    };
  }

  return { disponible: true, motivo: null };
};

module.exports = { evaluarDisponibilidad, getDayOfWeek };
