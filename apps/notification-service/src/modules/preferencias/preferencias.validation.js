const { z } = require('zod');

const { CANALES_ENTREGA, CATEGORIAS } = require('../../core/constants/notification.constants');

const actualizarSchema = z.object({
  preferencias: z
    .array(
      z.object({
        categoria: z.enum(CATEGORIAS, {
          errorMap: () => ({ message: 'Categoría de preferencia inválida' }),
        }),
        canal: z.enum(CANALES_ENTREGA, {
          errorMap: () => ({ message: 'Canal de preferencia inválido' }),
        }),
        habilitado: z.boolean(),
      }),
    )
    .min(1, 'Debe enviar al menos una preferencia'),
});

module.exports = { actualizarSchema };
