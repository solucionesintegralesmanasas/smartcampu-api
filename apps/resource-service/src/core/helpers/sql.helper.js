const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const NUMERIC_ID_REGEX = /^\d+$/;

/**
 * Determina si un identificador de ruta es el id interno (numérico) o el uuid público.
 * @param {number|string} value
 * @returns {'id'|'uuid'}
 */
const identifierField = (value) => (NUMERIC_ID_REGEX.test(String(value)) ? 'id' : 'uuid');

/**
 * Construye la cláusula SET de un UPDATE a partir de los campos presentes en `data`.
 * Los booleanos se convierten a 0/1 para MySQL.
 * @param {object} data - Campos a actualizar (solo los definidos se incluyen).
 * @param {Record<string, string>} columnMap - Mapa campo de DTO → columna SQL.
 * @returns {{ clause: string, params: Array }}
 */
const buildSetClause = (data, columnMap) => {
  const assignments = [];
  const params = [];
  Object.entries(columnMap).forEach(([key, column]) => {
    if (data[key] !== undefined) {
      assignments.push(`${column} = ?`);
      params.push(typeof data[key] === 'boolean' ? Number(data[key]) : data[key]);
    }
  });
  return { clause: assignments.join(', '), params };
};

/**
 * Serializa un objeto para una columna JSON. Devuelve null cuando no hay valor.
 * @param {object|null|undefined} value
 * @returns {string|null}
 */
const toJsonColumn = (value) => (value === undefined || value === null ? null : JSON.stringify(value));

module.exports = {
  UUID_REGEX,
  NUMERIC_ID_REGEX,
  identifierField,
  buildSetClause,
  toJsonColumn,
};
