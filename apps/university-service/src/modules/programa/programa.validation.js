const { z } = require('zod');

const createProgramaSchema = z.object({
  facultadId: z.coerce
    .number()
    .int()
    .positive('El ID de la facultad es obligatorio y debe ser un entero positivo'),
  codigo: z.string().min(2, 'El código debe tener al menos 2 caracteres').max(20),
  nombre: z.string().min(2, 'El nombre debe tener al menos 2 caracteres').max(150),
  nivel: z
    .enum(['undergraduate', 'specialization', 'masters', 'doctorate', 'technologist', 'technician'])
    .default('undergraduate'),
  duracionSemestres: z.coerce.number().int().min(1, 'La duración mínima es de 1 semestre').max(20),
  creditosTotales: z.coerce
    .number()
    .int()
    .min(1, 'El total de créditos debe ser mayor a 0')
    .max(500),
  codigoSnies: z.string().max(20).optional().nullable(),
  activo: z.boolean().default(true),
});

const updateProgramaSchema = z.object({
  facultadId: z.coerce.number().int().positive().optional(),
  codigo: z.string().min(2).max(20).optional(),
  nombre: z.string().min(2).max(150).optional(),
  nivel: z
    .enum(['undergraduate', 'specialization', 'masters', 'doctorate', 'technologist', 'technician'])
    .optional(),
  duracionSemestres: z.coerce.number().int().min(1).max(20)
    .optional(),
  creditosTotales: z.coerce.number().int().min(1).max(500)
    .optional(),
  codigoSnies: z.string().max(20).optional().nullable(),
  activo: z.boolean().optional(),
});

const queryProgramaSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100)
    .default(20),
  search: z.string().optional(),
  facultadId: z.coerce.number().int().positive().optional(),
  nivel: z.string().optional(),
});

module.exports = {
  createProgramaSchema,
  updateProgramaSchema,
  queryProgramaSchema,
};
