const { z } = require('zod');

const { CANALES_PLANTILLA } = require('../../core/constants/notification.constants');

const codeParamSchema = z.object({
  code: z
    .string()
    .trim()
    .regex(/^[a-z]+\.[a-z_]+$/, 'El código debe tener el formato categoria.accion'),
});

const listarQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

const upsertSchema = z.object({
  name: z.string().trim().min(3, 'El nombre debe tener al menos 3 caracteres').max(120),
  channel: z.enum(CANALES_PLANTILLA, {
    errorMap: () => ({ message: 'Canal de plantilla inválido' }),
  }),
  subject: z.string().trim().max(200).optional().nullable(),
  bodyText: z
    .string()
    .trim()
    .min(1, 'El cuerpo de texto es obligatorio')
    .max(10000, 'El cuerpo no puede superar 10000 caracteres'),
  bodyHtml: z.string().trim().max(20000).optional().nullable(),
  variables: z.array(z.string().trim().min(1)).default([]),
  isActive: z.boolean().default(true),
});

module.exports = { codeParamSchema, listarQuerySchema, upsertSchema };
