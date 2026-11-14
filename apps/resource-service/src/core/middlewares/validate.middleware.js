const { ValidationError } = require('../exceptions');

/**
 * Valida una propiedad de la petición (body, query o params) con un esquema Zod.
 * @param {import('zod').ZodTypeAny} schema - Esquema de validación.
 * @param {'body'|'query'|'params'} property - Propiedad de la petición a validar.
 * @returns {import('express').RequestHandler}
 */
const validate = (schema, property = 'body') => (req, res, next) => {
  const result = schema.safeParse(req[property]);
  if (!result.success) {
    const details = result.error.errors.map((issue) => ({
      field: issue.path.join('.'),
      message: issue.message,
    }));
    next(new ValidationError('Error de validación en los datos suministrados', details));
    return;
  }
  req[property] = result.data;
  next();
};

module.exports = { validate };
