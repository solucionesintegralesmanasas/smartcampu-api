const { z } = require('zod');

const { TIME_REGEX, timeToMinutes } = require('../../core/helpers/time.helper');

const horarioSchema = z
  .object({
    diaSemana: z
      .number()
      .int()
      .min(0, 'diaSemana debe estar entre 0 (Domingo) y 6 (Sábado)')
      .max(6, 'diaSemana debe estar entre 0 (Domingo) y 6 (Sábado)'),
    horaApertura: z.string().regex(TIME_REGEX, 'horaApertura debe tener formato HH:mm'),
    horaCierre: z.string().regex(TIME_REGEX, 'horaCierre debe tener formato HH:mm'),
  })
  .refine((horario) => timeToMinutes(horario.horaCierre) > timeToMinutes(horario.horaApertura), {
    message: 'horaCierre debe ser posterior a horaApertura',
    path: ['horaCierre'],
  });

const replaceSchedulesSchema = z.object({
  horarios: z
    .array(horarioSchema)
    .max(7, 'Un recurso admite como máximo un horario por día')
    .superRefine((horarios, ctx) => {
      const seen = new Set();
      horarios.forEach((horario, index) => {
        if (seen.has(horario.diaSemana)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'El día de la semana está repetido',
            path: [index, 'diaSemana'],
          });
        }
        seen.add(horario.diaSemana);
      });
    }),
});

module.exports = { replaceSchedulesSchema };
