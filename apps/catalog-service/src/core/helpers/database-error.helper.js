const ConflictError = require('../exceptions/ConflictError');
const ValidationError = require('../exceptions/ValidationError');

const DUPLICATE_CODES = ['ER_DUP_ENTRY'];
const MISSING_REFERENCE_CODES = ['ER_NO_REFERENCED_ROW', 'ER_NO_REFERENCED_ROW_2'];
const REFERENCED_ROW_CODES = ['ER_ROW_IS_REFERENCED', 'ER_ROW_IS_REFERENCED_2'];

/**
 * Traduce errores de restricciones de MySQL a errores de negocio (HTTP).
 * @param {Error} error - Error original lanzado por mysql2.
 * @returns {Error|null} Error de aplicación o null si no es una restricción conocida.
 */
const mapDatabaseError = (error) => {
  if (!error || !error.code) return null;

  if (DUPLICATE_CODES.includes(error.code)) {
    return new ConflictError('Ya existe un registro con los mismos datos únicos');
  }
  if (MISSING_REFERENCE_CODES.includes(error.code)) {
    return new ValidationError('La referencia indicada no existe');
  }
  if (REFERENCED_ROW_CODES.includes(error.code)) {
    return new ConflictError('El registro está referenciado por otros datos');
  }
  return null;
};

module.exports = { mapDatabaseError };
