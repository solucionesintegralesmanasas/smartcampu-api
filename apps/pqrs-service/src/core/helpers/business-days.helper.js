const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * America/Bogotá no tiene horario de verano: UTC-5 fijo.
 */
const UTC_OFFSET_MS = -5 * 60 * 60 * 1000;

/**
 * Convierte la lista separada por comas de la variable HOLIDAYS en un conjunto de fechas.
 * @param {string} raw - Fechas YYYY-MM-DD separadas por coma.
 * @returns {Set<string>}
 */
const parseFestivos = (raw = '') =>
  new Set(
    raw
      .split(',')
      .map((fecha) => fecha.trim())
      .filter(Boolean),
  );

/**
 * Obtiene la fecha calendario local (America/Bogotá) de un instante.
 * @param {Date} [fecha=new Date()]
 * @returns {string} Fecha en formato YYYY-MM-DD.
 */
const obtenerFechaLocal = (fecha = new Date()) =>
  new Date(fecha.getTime() + UTC_OFFSET_MS).toISOString().slice(0, 10);

/**
 * Convierte una fecha YYYY-MM-DD a Date en UTC a medianoche.
 * @param {string} iso
 * @returns {Date}
 */
const aFechaUtc = (iso) => {
  const [anio, mes, dia] = iso.split('-').map(Number);
  return new Date(Date.UTC(anio, mes - 1, dia));
};

/**
 * Indica si una fecha es día hábil: lunes a viernes y no festivo.
 * @param {string} iso - Fecha YYYY-MM-DD.
 * @param {Set<string>} [festivos=new Set()]
 * @returns {boolean}
 */
const esDiaHabil = (iso, festivos = new Set()) => {
  const diaSemana = aFechaUtc(iso).getUTCDay();
  return diaSemana !== 0 && diaSemana !== 6 && !festivos.has(iso);
};

/**
 * Suma días hábiles a una fecha. El conteo inicia el día siguiente a la fecha de origen,
 * por lo que una PQRS radicada un lunes con plazo de 2 días vence el miércoles.
 * @param {string} iso - Fecha de origen (YYYY-MM-DD).
 * @param {number} dias - Cantidad de días hábiles a sumar (entero no negativo).
 * @param {Set<string>} [festivos=new Set()] - Fechas festivas a excluir.
 * @returns {string} Fecha resultante en formato YYYY-MM-DD.
 */
const sumarDiasHabiles = (iso, dias, festivos = new Set()) => {
  let fecha = aFechaUtc(iso);
  let contados = 0;
  while (contados < dias) {
    fecha = new Date(fecha.getTime() + DAY_MS);
    if (esDiaHabil(fecha.toISOString().slice(0, 10), festivos)) {
      contados += 1;
    }
  }
  return fecha.toISOString().slice(0, 10);
};

module.exports = {
  parseFestivos,
  obtenerFechaLocal,
  esDiaHabil,
  sumarDiasHabiles,
};
