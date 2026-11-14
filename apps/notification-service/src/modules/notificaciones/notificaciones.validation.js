const { z } = require('zod');

const uuidParamSchema = z.object({
  uuid: z.string().uuid('Identificador inválido'),
});

const listarQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  leida: z
    .enum(['true', 'false'])
    .optional()
    .transform((valor) => (valor === undefined ? undefined : valor === 'true')),
});

const difusionSchema = z.object({
  titulo: z
    .string()
    .trim()
    .min(3, 'El título debe tener al menos 3 caracteres')
    .max(150, 'El título no puede superar 150 caracteres'),
  mensaje: z
    .string()
    .trim()
    .min(5, 'El mensaje debe tener al menos 5 caracteres')
    .max(5000, 'El mensaje no puede superar 5000 caracteres'),
});

module.exports = { uuidParamSchema, listarQuerySchema, difusionSchema };
