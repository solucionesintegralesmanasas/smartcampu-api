const { z } = require('zod');

const createSchema = z.object({
  isoCode: z
    .string()
    .regex(/^[A-Za-z]{2}$/, 'isoCode debe tener 2 letras (ISO 3166-1 alpha-2)')
    .transform((value) => value.toUpperCase()),
  isoCode3: z
    .string()
    .regex(/^[A-Za-z]{3}$/, 'isoCode3 debe tener 3 letras (ISO 3166-1 alpha-3)')
    .transform((value) => value.toUpperCase())
    .nullable()
    .optional(),
  name: z
    .string()
    .trim()
    .min(2, 'El nombre debe tener al menos 2 caracteres')
    .max(100, 'El nombre no puede superar 100 caracteres'),
  phoneCode: z.string().max(10, 'phoneCode no puede superar 10 caracteres').nullable().optional(),
});

const updateSchema = createSchema.partial();

module.exports = { createSchema, updateSchema };
