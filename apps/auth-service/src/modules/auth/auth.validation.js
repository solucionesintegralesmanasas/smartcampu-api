const { z } = require('zod');

/**
 * Esquemas de validación Zod para el módulo de autenticación.
 */
const registerSchema = z.object({
  email: z.string().email('Correo electrónico inválido'),
  password: z.string().min(8, 'La contraseña debe tener al menos 8 caracteres'),
  firstName: z.string().min(2, 'Los nombres son obligatorios'),
  middleName: z.string().optional(),
  lastName: z.string().min(2, 'Los apellidos son obligatorios'),
  secondLastName: z.string().optional(),
  documentTypeCode: z.string().min(1, 'El tipo de documento es obligatorio'),
  documentNumber: z.string().min(5, 'Número de documento inválido'),
  phone: z.string().optional(),
});

const loginSchema = z.object({
  email: z.string().email('Correo electrónico inválido'),
  password: z.string().min(1, 'La contraseña es obligatoria'),
});

const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1, 'El token de renovación es obligatorio'),
});

const logoutSchema = z.object({
  refreshToken: z.string().min(1, 'El token de renovación es obligatorio'),
});

const requestResetSchema = z.object({
  email: z.string().email('Correo electrónico inválido'),
});

const confirmResetSchema = z.object({
  token: z.string().min(1, 'El token es obligatorio'),
  password: z.string().min(8, 'La contraseña debe tener al menos 8 caracteres'),
});

module.exports = {
  registerSchema,
  loginSchema,
  refreshTokenSchema,
  logoutSchema,
  requestResetSchema,
  confirmResetSchema,
};
