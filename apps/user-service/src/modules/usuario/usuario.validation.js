const { z } = require('zod');

const DEFAULT_TIMEZONE = 'America/Bogota';
const DEFAULT_LOCALE = 'es-CO';

const esFechaExistente = (value) => {
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year
    && date.getUTCMonth() === month - 1
    && date.getUTCDate() === day;
};

const birthDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'La fecha de nacimiento debe tener formato AAAA-MM-DD')
  .refine(esFechaExistente, 'La fecha de nacimiento no es válida')
  .refine((value) => value <= new Date().toISOString().slice(0, 10), {
    message: 'La fecha de nacimiento no puede estar en el futuro',
  });

const timeSchema = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/, 'La hora debe tener formato HH:mm');

const updatePerfilSchema = z.object({
  firstName: z.string().trim().min(2, 'Los nombres son obligatorios').max(80),
  lastName: z.string().trim().min(2, 'Los apellidos son obligatorios').max(80),
  documentNumber: z.string().trim().min(5, 'Número de documento inválido').max(20)
    .nullable()
    .default(null),
  phone: z.string().trim().min(7, 'Teléfono inválido').max(20)
    .nullable()
    .default(null),
  avatarFileUuid: z.string().uuid('El identificador del avatar no es válido').nullable()
    .default(null),
  birthDate: birthDateSchema.nullable().default(null),
  cityCode: z.string().trim().min(1).max(10)
    .nullable()
    .default(null),
  timezone: z.string().trim().min(1).max(50)
    .default(DEFAULT_TIMEZONE),
  locale: z
    .string()
    .trim()
    .max(10)
    .regex(/^[a-z]{2}(-[A-Z]{2})?$/, 'El idioma debe tener formato BCP 47 (ej. es-CO)')
    .default(DEFAULT_LOCALE),
});

const updatePreferenciasSchema = z
  .object({
    notifyEmail: z.boolean().default(true),
    notifyPush: z.boolean().default(true),
    quietHoursStart: timeSchema.nullable().default(null),
    quietHoursEnd: timeSchema.nullable().default(null),
  })
  .refine((data) => (data.quietHoursStart === null) === (data.quietHoursEnd === null), {
    message: 'quietHoursStart y quietHoursEnd deben informarse juntos o dejarse en null',
    path: ['quietHoursEnd'],
  });

const listUsuariosQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100)
    .default(20),
  search: z.string().trim().max(100).optional(),
});

const userIdParamSchema = z.object({
  userId: z.coerce.number().int().positive('El ID de usuario debe ser un entero positivo'),
});

module.exports = {
  updatePerfilSchema,
  updatePreferenciasSchema,
  listUsuariosQuerySchema,
  userIdParamSchema,
};
