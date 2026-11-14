const { z } = require('zod');

const { ESTADOS, ESTADOS_CALIFICABLES } = require('./pqrs.state-machine');

const uuidParamSchema = z.object({
  uuid: z.string().uuid('El identificador de la PQRS no es válido'),
});

const ticketParamSchema = z.object({
  ticket: z
    .string()
    .trim()
    .regex(/^PQRS-\d{4}-\d{6}$/, 'El número de radicado no tiene el formato esperado'),
});

const emailSchema = z.string().trim().email('El correo electrónico no es válido').max(150);

const crearPqrsSchema = z
  .object({
    tipoCodigo: z
      .string()
      .trim()
      .min(3, 'El tipo de PQRS es obligatorio')
      .max(20)
      .transform((valor) => valor.toUpperCase()),
    asunto: z
      .string()
      .trim()
      .min(3, 'El asunto debe tener al menos 3 caracteres')
      .max(200, 'El asunto no puede superar 200 caracteres'),
    descripcion: z
      .string()
      .trim()
      .min(10, 'La descripción debe tener al menos 10 caracteres')
      .max(5000, 'La descripción no puede superar 5000 caracteres'),
    anonima: z.boolean().default(false),
    email: emailSchema.optional(),
  })
  .refine((data) => !data.anonima || Boolean(data.email), {
    message: 'Debe indicar un correo de contacto para PQRS anónimas',
    path: ['email'],
  });

const consultaSchema = z.object({
  email: emailSchema,
});

const listarPqrsSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  estado: z.enum(Object.values(ESTADOS)).optional(),
  tipoCodigo: z.string().trim().max(20).optional(),
  vencidas: z.coerce.boolean().optional(),
});

const asignacionSchema = z.object({
  asignadoUuid: z.string().uuid('El identificador del funcionario no es válido'),
  asignadoNombre: z.string().trim().min(2).max(120),
});

const respuestaSchema = z.object({
  cuerpo: z
    .string()
    .trim()
    .min(10, 'La respuesta debe tener al menos 10 caracteres')
    .max(10000, 'La respuesta no puede superar 10000 caracteres'),
  esFinal: z.boolean().default(false),
});

const cambiarEstadoSchema = z.object({
  estado: z.enum(Object.values(ESTADOS), {
    errorMap: () => ({ message: 'El estado no es válido' }),
  }),
  comentario: z.string().trim().max(2000).optional().nullable(),
});

const calificacionSchema = z.object({
  puntaje: z.coerce
    .number()
    .int()
    .min(1, 'La calificación mínima es 1')
    .max(5, 'La calificación máxima es 5'),
});

module.exports = {
  uuidParamSchema,
  ticketParamSchema,
  crearPqrsSchema,
  consultaSchema,
  listarPqrsSchema,
  asignacionSchema,
  respuestaSchema,
  cambiarEstadoSchema,
  calificacionSchema,
  ESTADOS_CALIFICABLES,
};
