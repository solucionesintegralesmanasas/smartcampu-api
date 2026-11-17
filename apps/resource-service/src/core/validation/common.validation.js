const { z } = require('zod');

const { NUMERIC_ID_REGEX, UUID_REGEX } = require('../helpers/sql.helper');

/**
 * Identificador de ruta: id numérico interno o uuid público.
 */
const identifierSchema = z
  .string()
  .refine((value) => NUMERIC_ID_REGEX.test(value) || UUID_REGEX.test(value), {
    message: 'El identificador debe ser un id numérico o un UUID válido',
  });

const idParamsSchema = z.object({ id: identifierSchema });

const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1, 'page debe ser mayor o igual a 1').default(1),
  limit: z.coerce
    .number()
    .int()
    .min(1, 'limit debe ser mayor o igual a 1')
    .max(100, 'limit no puede superar 100')
    .default(20),
});

module.exports = { identifierSchema, idParamsSchema, paginationQuerySchema };
