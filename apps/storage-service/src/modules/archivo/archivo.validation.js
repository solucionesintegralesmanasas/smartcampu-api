const { z } = require('zod');

/**
 * Extensiones permitidas para la carga de archivos.
 */
const ALLOWED_EXTENSIONS = Object.freeze(['.pdf', '.jpg', '.jpeg', '.png', '.gif']);

/**
 * Los campos multipart llegan como texto ('true'/'false'); z.coerce.boolean()
 * convertiría 'false' en true, por eso se parsea explícitamente.
 */
const flagSchema = z
  .union([z.boolean(), z.enum(['true', 'false'])])
  .transform((value) => value === true || value === 'true');

const uuidParamSchema = z.object({
  uuid: z.string().uuid('UUID inválido'),
});

const createArchivoSchema = z
  .object({
    entidadAsociada: z.string().trim().min(1).max(50)
      .optional(),
    uuidAsociado: z.string().uuid('UUID asociado inválido').optional(),
    carpeta: z.string().trim().min(1).max(100)
      .default('general'),
    publico: flagSchema.default(false),
  })
  .refine((data) => !data.uuidAsociado || Boolean(data.entidadAsociada), {
    message: 'entidadAsociada es obligatoria cuando se envía uuidAsociado',
    path: ['entidadAsociada'],
  });

const updateArchivoSchema = z
  .object({
    nombreOriginal: z.string().trim().min(1).max(255)
      .optional(),
    entidadAsociada: z.string().trim().min(1).max(50)
      .nullable()
      .optional(),
    uuidAsociado: z.string().uuid('UUID asociado inválido').nullable().optional(),
    carpeta: z.string().trim().min(1).max(100)
      .optional(),
    publico: flagSchema.optional(),
    activo: flagSchema.optional(),
  })
  .refine((data) => Object.values(data).some((value) => value !== undefined), {
    message: 'Debe enviar al menos un campo a actualizar',
  });

const listArchivosQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100)
    .default(20),
  usuarioId: z.coerce.number().int().positive().optional(),
  tipo: z.string().trim().min(1).optional(),
  entidad: z.string().trim().min(1).max(50)
    .optional(),
  uuidAsociado: z.string().uuid('UUID asociado inválido').optional(),
  carpeta: z.string().trim().min(1).max(100)
    .optional(),
  activo: flagSchema.optional(),
});

const buscarArchivosQuerySchema = listArchivosQuerySchema.extend({
  search: z.string().trim().min(1, 'El término de búsqueda es requerido'),
});

module.exports = {
  ALLOWED_EXTENSIONS,
  createArchivoSchema,
  updateArchivoSchema,
  listArchivosQuerySchema,
  buscarArchivosQuerySchema,
  uuidParamSchema,
};
