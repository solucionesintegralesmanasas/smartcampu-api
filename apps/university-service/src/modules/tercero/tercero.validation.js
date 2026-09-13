const { z } = require('zod');

const createTerceroSchema = z.object({
  tipoDocumento: z.string().min(1, 'El tipo de documento es requerido').max(10),
  numeroDocumento: z.string().min(3, 'El número de documento es requerido').max(30),
  digitoVerificacion: z.string().max(2).optional().nullable(),
  primerNombre: z.string().min(1, 'El primer nombre es requerido').max(50),
  segundoNombre: z.string().max(50).optional().nullable(),
  primerApellido: z.string().min(1, 'El primer apellido es requerido').max(50),
  segundoApellido: z.string().max(50).optional().nullable(),
  fechaNacimiento: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato de fecha inválido (YYYY-MM-DD)')
    .optional()
    .nullable(),
  genero: z.enum(['M', 'F', 'X']).optional().nullable(),
  email: z.string().email('Correo electrónico inválido').optional().nullable(),
  telefono: z.string().max(20).optional().nullable(),
  direccion: z.string().max(200).optional().nullable(),
  cityUuid: z.string().uuid().optional().nullable(),
  cityName: z.string().max(100).optional().nullable(),
  empresaId: z.coerce.number().int().positive().optional()
    .nullable(),
  activo: z.boolean().default(true),
});

const updateTerceroSchema = z.object({
  tipoDocumento: z.string().min(1).max(10).optional(),
  numeroDocumento: z.string().min(3).max(30).optional(),
  digitoVerificacion: z.string().max(2).optional().nullable(),
  primerNombre: z.string().min(1).max(50).optional(),
  segundoNombre: z.string().max(50).optional().nullable(),
  primerApellido: z.string().min(1).max(50).optional(),
  segundoApellido: z.string().max(50).optional().nullable(),
  fechaNacimiento: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .nullable(),
  genero: z.enum(['M', 'F', 'X']).optional().nullable(),
  email: z.string().email().optional().nullable(),
  telefono: z.string().max(20).optional().nullable(),
  direccion: z.string().max(200).optional().nullable(),
  cityUuid: z.string().uuid().optional().nullable(),
  cityName: z.string().max(100).optional().nullable(),
  empresaId: z.coerce.number().int().positive().optional()
    .nullable(),
  activo: z.boolean().optional(),
});

const queryTerceroSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100)
    .default(20),
  search: z.string().optional(),
  tipoDocumento: z.string().optional(),
  empresaId: z.coerce.number().int().positive().optional(),
});

module.exports = {
  createTerceroSchema,
  updateTerceroSchema,
  queryTerceroSchema,
};
