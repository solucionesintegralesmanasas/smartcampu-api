const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const TIME_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/;
const DATETIME_REGEX = /^\d{4}-\d{2}-\d{2}[T ]([01]\d|2[0-3]):[0-5]\d$/;

/**
 * Indica si una cadena YYYY-MM-DD es una fecha real del calendario.
 * @param {string} value
 * @returns {boolean}
 */
const isValidDate = (value) => {
  if (!DATE_REGEX.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
  );
};

/**
 * Convierte una hora HH:mm (o HH:mm:ss) a minutos desde medianoche.
 * @param {string} value
 * @returns {number}
 */
const timeToMinutes = (value) => {
  const [hours, minutes] = value.split(':').map(Number);
  return hours * 60 + minutes;
};

/**
 * Día de la semana de una fecha YYYY-MM-DD: 0=Domingo … 6=Sábado (igual que la migración).
 * @param {string} fecha
 * @returns {number}
 */
const getDayOfWeek = (fecha) => {
  const [year, month, day] = fecha.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
};

/**
 * Suma días a una fecha YYYY-MM-DD y devuelve la nueva fecha en el mismo formato.
 * @param {string} fecha
 * @param {number} days
 * @returns {string}
 */
const addDays = (fecha, days) => {
  const [year, month, day] = fecha.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + days));
  return date.toISOString().slice(0, 10);
};

/**
 * Convierte YYYY-MM-DDTHH:mm a 'YYYY-MM-DD HH:mm:00' para comparar y guardar en DATETIME.
 * @param {string} value
 * @returns {string}
 */
const toMysqlDateTime = (value) => `${value.replace('T', ' ')}:00`;

/**
 * Convierte HH:mm a HH:mm:00 para guardar en columnas TIME.
 * @param {string} value
 * @returns {string}
 */
const toMysqlTime = (value) => `${value}:00`;

module.exports = {
  DATE_REGEX,
  TIME_REGEX,
  DATETIME_REGEX,
  isValidDate,
  timeToMinutes,
  getDayOfWeek,
  addDays,
  toMysqlDateTime,
  toMysqlTime,
};
