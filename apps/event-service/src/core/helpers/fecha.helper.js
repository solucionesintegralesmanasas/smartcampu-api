const ZONA_HORARIA = 'America/Bogota';

/**
 * Fecha calendario (YYYY-MM-DD) en la zona horaria institucional.
 * @param {Date|string} fecha - Fecha en UTC.
 * @returns {string}
 */
const formatFecha = (fecha) =>
  new Date(fecha).toLocaleDateString('en-CA', { timeZone: ZONA_HORARIA });

/**
 * Hora local (HH:mm) en la zona horaria institucional.
 * @param {Date|string} fecha - Fecha en UTC.
 * @returns {string}
 */
const formatHora = (fecha) =>
  new Date(fecha).toLocaleTimeString('en-GB', {
    timeZone: ZONA_HORARIA,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  });

module.exports = { ZONA_HORARIA, formatFecha, formatHora };
