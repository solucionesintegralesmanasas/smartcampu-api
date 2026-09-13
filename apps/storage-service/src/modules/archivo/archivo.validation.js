const { z } = require('zod');

/**
 * Esquemas de validación Zod para el módulo de archivos.
 */
const createFileMetadataSchema = z.object({
  entidadAsociada: z.string().optional(),
  uuidAsociado: z.string().uuid('UUID asociado inválido').optional(),
  usuarioId: z.coerce.number().int().positive().optional(),
  usuarioNombre: z.string().optional(),
  carpeta: z.string().default('general'),
  publico: z.coerce.boolean().default(false),
});

const updateFileSchema = z.object({
  nombreOriginal: z.string().min(1).max(255).optional(),
  entidadAsociada: z.string().optional(),
  uuidAsociado: z.string().uuid('UUID asociado inválido').optional(),
  carpeta: z.string().optional(),
  publico: z.coerce.boolean().optional(),
  activo: z.coerce.boolean().optional(),
});

const listFilesQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100)
    .default(20),
  usuarioId: z.coerce.number().int().positive().optional(),
  tipo: z.string().optional(),
  entidad: z.string().optional(),
  activo: z.coerce.boolean().optional(),
});

const searchFilesQuerySchema = z.object({
  q: z.string().min(1, 'El término de búsqueda es requerido').optional(),
  search: z.string().min(1, 'El término de búsqueda es requerido').optional(),
  usuarioId: z.coerce.number().int().positive().optional(),
  tipo: z.string().optional(),
  entidad: z.string().optional(),
  activo: z.coerce.boolean().optional(),
  offset: z.coerce.number().int().min(0).default(0),
  limit: z.coerce.number().int().positive().max(100)
    .default(20),
});

module.exports = {
  createFileMetadataSchema,
  updateFileSchema,
  listFilesQuerySchema,
  searchFilesQuerySchema,
};
