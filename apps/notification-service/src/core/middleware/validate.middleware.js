const { ValidationError } = require('../exceptions');

/**
 * Valida `req[property]` con un esquema Zod y reemplaza el valor por el resultado parseado.
 * @param {import('zod').ZodSchema} schema
 * @param {'body'|'query'|'params'} [property='body']
 */
const validate = (schema, property = 'body') => (req, res, next) => {
  const result = schema.safeParse(req[property]);
  if (!result.success) {
    const details = result.error.errors.map((e) => ({
      field: e.path.join('.'),
      message: e.message,
    }));
    next(new ValidationError('Error de validación en los datos suministrados', details));
    return;
  }
  req[property] = result.data;
  next();
};

module.exports = { validate };
