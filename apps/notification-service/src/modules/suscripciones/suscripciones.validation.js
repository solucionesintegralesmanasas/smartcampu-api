const { z } = require('zod');

const uuidParamSchema = z.object({
  uuid: z.string().uuid('Identificador inválido'),
});

const crearSchema = z.object({
  endpoint: z.string().trim().url('El endpoint debe ser una URL válida').max(500),
  authKey: z.string().trim().min(1, 'authKey es obligatorio').max(255),
  p256dhKey: z.string().trim().min(1, 'p256dhKey es obligatorio').max(255),
  deviceType: z.enum(['web', 'android', 'ios'], {
    errorMap: () => ({ message: 'Tipo de dispositivo inválido' }),
  }),
  deviceLabel: z.string().trim().max(120).optional().nullable(),
});

module.exports = { uuidParamSchema, crearSchema };
