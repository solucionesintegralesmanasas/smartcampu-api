const { z } = require('zod');

const createFacultadSchema = z.object({
  campusId: z.coerce
    .number()
    .int()
    .positive('El ID de la sede debe ser un entero positivo')
    .default(1),
  codigo: z.string().min(2, 'El código debe tener al menos 2 caracteres').max(20),
  nombre: z.string().min(2, 'El nombre debe tener al menos 2 caracteres').max(150),
  decano: z.string().max(100).optional().nullable(),
  email: z.string().email('Correo electrónico no válido').optional().nullable(),
  activo: z.boolean().default(true),
});

const updateFacultadSchema = z.object({
  campusId: z.coerce.number().int().positive().optional(),
  codigo: z.string().min(2).max(20).optional(),
  nombre: z.string().min(2).max(150).optional(),
  decano: z.string().max(100).optional().nullable(),
  email: z.string().email().optional().nullable(),
  activo: z.boolean().optional(),
});

const queryFacultadSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100)
    .default(20),
  search: z.string().optional(),
  campusId: z.coerce.number().int().positive().optional(),
});

module.exports = {
  createFacultadSchema,
  updateFacultadSchema,
  queryFacultadSchema,
};
