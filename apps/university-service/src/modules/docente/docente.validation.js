const { z } = require('zod');

const createDocenteSchema = z.object({
  personaId: z.coerce
    .number()
    .int()
    .positive('El ID de la persona (tercero) es requerido y debe ser entero positivo'),
  facultadId: z.coerce
    .number()
    .int()
    .positive('El ID de la facultad es requerido y debe ser entero positivo'),
  userUuid: z.string().uuid().optional().nullable(),
  password: z.string().min(6).optional(),
  codigoDocente: z.string().min(2, 'El código de docente es requerido').max(20),
  tipoContrato: z.enum(['full_time', 'part_time', 'visiting', 'honorary']).default('full_time'),
  fechaContratacion: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato de fecha inválido (YYYY-MM-DD)')
    .default(() => new Date().toISOString().split('T')[0]),
  fechaTerminacion: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .nullable(),
  tituloAcademico: z.string().max(80).optional().nullable(),
  estado: z.enum(['active', 'inactive', 'retired']).default('active'),
  activo: z.boolean().default(true),
});

const updateDocenteSchema = z.object({
  facultadId: z.coerce.number().int().positive().optional(),
  userUuid: z.string().uuid().optional().nullable(),
  codigoDocente: z.string().min(2).max(20).optional(),
  tipoContrato: z.enum(['full_time', 'part_time', 'visiting', 'honorary']).optional(),
  fechaContratacion: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  fechaTerminacion: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .nullable(),
  tituloAcademico: z.string().max(80).optional().nullable(),
  estado: z.enum(['active', 'inactive', 'retired']).optional(),
  activo: z.boolean().optional(),
});

const queryDocenteSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100)
    .default(20),
  search: z.string().optional(),
  facultadId: z.coerce.number().int().positive().optional(),
  personaId: z.coerce.number().int().positive().optional(),
  estado: z.string().optional(),
  tipoContrato: z.string().optional(),
});

module.exports = {
  createDocenteSchema,
  updateDocenteSchema,
  queryDocenteSchema,
};
