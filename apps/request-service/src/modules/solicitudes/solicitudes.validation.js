const { z } = require('zod');

const { ESTADOS } = require('./solicitudes.state-machine');

const TAMANO_MAXIMO_ADJUNTO = 100 * 1024 * 1024;

const uuidParamSchema = z.object({
  uuid: z.string().uuid('El identificador de la solicitud no es válido'),
});

const crearSolicitudSchema = z.object({
  tipoUuid: z.string().uuid('El tipo de solicitud no es válido'),
  titulo: z
    .string()
    .trim()
    .min(3, 'El título debe tener al menos 3 caracteres')
    .max(200, 'El título no puede superar 200 caracteres'),
  descripcion: z
    .string()
    .trim()
    .min(10, 'La descripción debe tener al menos 10 caracteres')
    .max(5000, 'La descripción no puede superar 5000 caracteres'),
  formData: z.record(z.unknown()).optional().nullable(),
});

const listarSolicitudesSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  estado: z.enum(Object.values(ESTADOS)).optional(),
  tipoUuid: z.string().uuid('El tipo de solicitud no es válido').optional(),
  asignadoUuid: z.string().uuid('El identificador del asignado no es válido').optional(),
});

const crearComentarioSchema = z.object({
  contenido: z
    .string()
    .trim()
    .min(1, 'El comentario no puede estar vacío')
    .max(5000, 'El comentario no puede superar 5000 caracteres'),
  esInterno: z.boolean().default(false),
});

const crearAdjuntoSchema = z.object({
  fileUuid: z.string().uuid('El identificador del archivo no es válido'),
  nombreOriginal: z.string().trim().min(1).max(255),
  mimeType: z.string().trim().min(3).max(100),
  tamanoBytes: z.coerce
    .number()
    .int()
    .positive('El tamaño del archivo debe ser mayor a cero')
    .max(TAMANO_MAXIMO_ADJUNTO, 'El archivo no puede superar 100 MB'),
});

const cambiarEstadoSchema = z.object({
  estado: z.enum(Object.values(ESTADOS), {
    errorMap: () => ({ message: 'El estado no es válido' }),
  }),
  comentario: z.string().trim().max(2000).optional().nullable(),
  asignadoUuid: z.string().uuid('El identificador del asignado no es válido').optional().nullable(),
});

module.exports = {
  uuidParamSchema,
  crearSolicitudSchema,
  listarSolicitudesSchema,
  crearComentarioSchema,
  crearAdjuntoSchema,
  cambiarEstadoSchema,
};
