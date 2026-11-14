const { z } = require('zod');

const {
  DATETIME_REGEX,
  isValidDate,
  toMysqlDateTime,
} = require('../../core/helpers/time.helper');

const dateTimeSchema = z
  .string()
  .regex(DATETIME_REGEX, 'La fecha y hora debe tener formato YYYY-MM-DDTHH:mm')
  .refine((value) => isValidDate(value.slice(0, 10)), 'La fecha no es válida');

const createBlackoutSchema = z
  .object({
    inicio: dateTimeSchema,
    fin: dateTimeSchema,
    motivo: z.string().trim().min(3, 'El motivo es obligatorio').max(200),
  })
  .refine((data) => toMysqlDateTime(data.fin) > toMysqlDateTime(data.inicio), {
    message: 'fin debe ser posterior a inicio',
    path: ['fin'],
  });

module.exports = { createBlackoutSchema };
