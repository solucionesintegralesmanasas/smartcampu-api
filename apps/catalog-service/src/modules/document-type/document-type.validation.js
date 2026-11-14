const { z } = require('zod');

const createSchema = z.object({
  code: z
    .string()
    .trim()
    .min(1, 'El código es obligatorio')
    .max(10, 'El código no puede superar 10 caracteres')
    .transform((value) => value.toUpperCase()),
  name: z
    .string()
    .trim()
    .min(2, 'El nombre debe tener al menos 2 caracteres')
    .max(50, 'El nombre no puede superar 50 caracteres'),
  requiresCheckDigit: z.boolean().optional(),
  appliesToNaturalPerson: z.boolean().optional(),
  appliesToLegalEntity: z.boolean().optional(),
});

const updateSchema = createSchema.partial();

module.exports = { createSchema, updateSchema };
