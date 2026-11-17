const { z } = require('zod');

const { UUID_REGEX } = require('../../core/helpers/sql.helper');
const { paginationQuerySchema } = require('../../core/validation/common.validation');

const createResourceSchema = z.object({
  categoriaId: z.number().int().positive('categoriaId debe ser un entero positivo'),
  estadoId: z.number().int().positive().optional(),
  campusUuid: z.string().regex(UUID_REGEX, 'campusUuid debe ser un UUID válido'),
  campusNombre: z.string().trim().min(2).max(100),
  codigo: z.string().trim().min(2).max(30),
  nombre: z.string().trim().min(2).max(100),
  descripcion: z.string().trim().max(5000).nullable().optional(),
  capacidad: z.number().int().min(0).nullable().optional(),
  piso: z.string().trim().max(10).nullable().optional(),
  edificio: z.string().trim().max(50).nullable().optional(),
  tieneInventario: z.boolean().optional(),
  atributos: z.record(z.unknown()).nullable().optional(),
});

const updateResourceSchema = createResourceSchema
  .partial()
  .extend({ activo: z.boolean().optional() })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'Debe enviar al menos un campo para actualizar',
  });

const searchResourcesSchema = paginationQuerySchema.extend({
  search: z.string().trim().max(100).optional(),
  categoriaId: z.coerce.number().int().positive().optional(),
  estadoId: z.coerce.number().int().positive().optional(),
});

module.exports = { createResourceSchema, updateResourceSchema, searchResourcesSchema };
