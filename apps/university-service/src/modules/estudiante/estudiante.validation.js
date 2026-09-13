const { z } = require('zod');

const createEstudianteSchema = z.object({
  personaId: z.coerce
    .number()
    .int()
    .positive('El ID de la persona (tercero) es requerido y debe ser entero positivo'),
  programaId: z.coerce
    .number()
    .int()
    .positive('El ID del programa es requerido y debe ser entero positivo'),
  userUuid: z.string().uuid().optional().nullable(),
  password: z.string().min(6).optional(),
  codigoEstudiante: z.string().min(2, 'El código de estudiante es requerido').max(20),
  fechaMatricula: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato de fecha inválido (YYYY-MM-DD)')
    .default(() => new Date().toISOString().split('T')[0]),
  fechaGraduacion: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .nullable(),
  semestreActual: z.coerce.number().int().min(1).max(20)
    .default(1),
  promedio: z.coerce.number().min(0).max(5).optional()
    .nullable(),
  estado: z.enum(['active', 'inactive', 'graduated', 'withdrawn', 'suspended']).default('active'),
  activo: z.boolean().default(true),
});

const updateEstudianteSchema = z.object({
  programaId: z.coerce.number().int().positive().optional(),
  userUuid: z.string().uuid().optional().nullable(),
  codigoEstudiante: z.string().min(2).max(20).optional(),
  fechaMatricula: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  fechaGraduacion: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .nullable(),
  semestreActual: z.coerce.number().int().min(1).max(20)
    .optional(),
  promedio: z.coerce.number().min(0).max(5).optional()
    .nullable(),
  estado: z.enum(['active', 'inactive', 'graduated', 'withdrawn', 'suspended']).optional(),
  activo: z.boolean().optional(),
});

const queryEstudianteSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100)
    .default(20),
  search: z.string().optional(),
  programaId: z.coerce.number().int().positive().optional(),
  personaId: z.coerce.number().int().positive().optional(),
  estado: z.string().optional(),
});

module.exports = {
  createEstudianteSchema,
  updateEstudianteSchema,
  queryEstudianteSchema,
};
