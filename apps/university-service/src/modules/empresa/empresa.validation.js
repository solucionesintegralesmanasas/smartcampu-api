const { z } = require('zod');

const createEmpresaSchema = z.object({
  razonSocial: z.string().min(2, 'La razón social debe tener al menos 2 caracteres').max(200),
  nombreComercial: z.string().max(200).optional().nullable(),
  nit: z.string().min(3, 'El NIT o identificación fiscal es requerido').max(20),
  digitoVerificacion: z.string().max(2).optional().nullable(),
  direccion: z.string().max(200).optional().nullable(),
  telefono: z.string().max(20).optional().nullable(),
  email: z.string().email('El correo electrónico no es válido').optional().nullable(),
  cityUuid: z.string().uuid().optional().nullable(),
  cityName: z.string().max(100).optional().nullable(),
  activo: z.boolean().default(true),
});

const updateEmpresaSchema = z.object({
  razonSocial: z.string().min(2).max(200).optional(),
  nombreComercial: z.string().max(200).optional().nullable(),
  nit: z.string().min(3).max(20).optional(),
  digitoVerificacion: z.string().max(2).optional().nullable(),
  direccion: z.string().max(200).optional().nullable(),
  telefono: z.string().max(20).optional().nullable(),
  email: z.string().email().optional().nullable(),
  cityUuid: z.string().uuid().optional().nullable(),
  cityName: z.string().max(100).optional().nullable(),
  activo: z.boolean().optional(),
});

const queryEmpresaSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100)
    .default(20),
  search: z.string().optional(),
});

module.exports = {
  createEmpresaSchema,
  updateEmpresaSchema,
  queryEmpresaSchema,
};
