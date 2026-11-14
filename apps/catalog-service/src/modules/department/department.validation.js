const { z } = require('zod');

const createSchema = z.object({
  countryId: z.number().int().positive('countryId debe ser un entero positivo'),
  name: z
    .string()
    .trim()
    .min(2, 'El nombre debe tener al menos 2 caracteres')
    .max(100, 'El nombre no puede superar 100 caracteres'),
  daneCode: z.string().max(10, 'daneCode no puede superar 10 caracteres').nullable().optional(),
});

const updateSchema = createSchema.partial();

module.exports = { createSchema, updateSchema };
