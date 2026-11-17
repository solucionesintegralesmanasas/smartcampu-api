/**
 * Convierte una hora HH:mm:ss (o HH:mm) a segundos desde medianoche.
 * @param {string} hora
 * @returns {number}
 */
const toSegundos = (hora) => {
  const [horas, minutos, segundos = '0'] = hora.split(':');
  return Number(horas) * 3600 + Number(minutos) * 60 + Number(segundos);
};

/**
 * Asegura el formato HH:mm:ss que usa la columna TIME.
 * @param {string} hora
 * @returns {string}
 */
const normalizarHora = (hora) => (hora.length === 5 ? `${hora}:00` : hora);

/**
 * Indica si dos franjas horarias del mismo día se solapan (intervalos semiabiertos).
 * @param {{horaInicio: string, horaFin: string}} existente
 * @param {{horaInicio: string, horaFin: string}} nueva
 * @returns {boolean}
 */
const haySolape = (existente, nueva) =>
  toSegundos(existente.horaInicio) < toSegundos(nueva.horaFin) &&
  toSegundos(nueva.horaInicio) < toSegundos(existente.horaFin);

const diasEntre = (desde, hasta) =>
  (Date.parse(`${hasta}T00:00:00Z`) - Date.parse(`${desde}T00:00:00Z`)) / 86400000;

/**
 * Evalúa las reglas de booking_types: fecha no pasada, antelación máxima y duración máxima.
 * @param {{antelacionMaximaDias: number|null, maxDuracionMinutos: number|null}} tipo
 * @param {{fecha: string, horaInicio: string, horaFin: string}} reserva
 * @param {string} hoy - Fecha actual en formato YYYY-MM-DD.
 * @returns {Array<{field: string, message: string}>} Incumplimientos (vacío si cumple).
 */
const validarReglasTipo = (tipo, { fecha, horaInicio, horaFin }, hoy) => {
  const incumplimientos = [];

  if (fecha < hoy) {
    incumplimientos.push({
      field: 'fecha',
      message: 'La fecha de la reserva no puede ser anterior a hoy',
    });
  }

  if (
    Number.isInteger(tipo.antelacionMaximaDias) &&
    diasEntre(hoy, fecha) > tipo.antelacionMaximaDias
  ) {
    incumplimientos.push({
      field: 'fecha',
      message: `Este tipo de reserva admite una antelación máxima de ${tipo.antelacionMaximaDias} días`,
    });
  }

  const duracionMinutos = (toSegundos(horaFin) - toSegundos(horaInicio)) / 60;
  if (Number.isInteger(tipo.maxDuracionMinutos) && duracionMinutos > tipo.maxDuracionMinutos) {
    incumplimientos.push({
      field: 'horaFin',
      message: `La duración máxima para este tipo de reserva es de ${tipo.maxDuracionMinutos} minutos`,
    });
  }

  return incumplimientos;
};

module.exports = { toSegundos, normalizarHora, haySolape, validarReglasTipo };
