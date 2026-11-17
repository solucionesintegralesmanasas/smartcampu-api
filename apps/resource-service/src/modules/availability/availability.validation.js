const { z } = require('zod');

const { DATE_REGEX, TIME_REGEX, isValidDate } = require('../../core/helpers/time.helper');

const disponibilidadQuerySchema = z
  .object({
    fecha: z.string().regex(DATE_REGEX, 'fecha debe tener formato YYYY-MM-DD'),
    horaInicio: z.string().regex(TIME_REGEX, 'horaInicio debe tener formato HH:mm'),
    horaFin: z.string().regex(TIME_REGEX, 'horaFin debe tener formato HH:mm'),
  })
  .refine((q) => isValidDate(q.fecha), { message: 'fecha no es una fecha válida', path: ['fecha'] });

module.exports = { disponibilidadQuerySchema };
