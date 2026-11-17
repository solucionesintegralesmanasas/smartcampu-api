const { z } = require('zod');

const uuidParamSchema = z.object({
  uuid: z.string().uuid('El identificador no es un UUID válido'),
});

const paginacionSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

module.exports = { uuidParamSchema, paginacionSchema };
