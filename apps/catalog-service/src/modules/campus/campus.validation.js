const { z } = require('zod');

const createSchema = z.object({
  cityId: z.number().int().positive('cityId debe ser un entero positivo'),
  name: z
    .string()
    .trim()
    .min(2, 'El nombre debe tener al menos 2 caracteres')
    .max(100, 'El nombre no puede superar 100 caracteres'),
  address: z.string().max(200, 'La dirección no puede superar 200 caracteres').nullable().optional(),
  phone: z.string().max(20, 'El teléfono no puede superar 20 caracteres').nullable().optional(),
});

const updateSchema = createSchema.partial();

module.exports = { createSchema, updateSchema };
