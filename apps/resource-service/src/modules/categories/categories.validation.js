const { z } = require('zod');

const createCategorySchema = z.object({
  codigo: z
    .string()
    .trim()
    .min(2, 'El código debe tener al menos 2 caracteres')
    .max(20, 'El código no puede superar 20 caracteres')
    .regex(/^[A-Z0-9_]+$/, 'El código solo admite mayúsculas, números y guion bajo'),
  nombre: z.string().trim().min(2, 'El nombre es obligatorio').max(50),
  icono: z.string().trim().max(60).nullable().optional(),
  descripcion: z.string().trim().max(2000).nullable().optional(),
  activo: z.boolean().optional(),
});

const updateCategorySchema = createCategorySchema
  .partial()
  .refine((data) => Object.keys(data).length > 0, {
    message: 'Debe enviar al menos un campo para actualizar',
  });

module.exports = { createCategorySchema, updateCategorySchema };
