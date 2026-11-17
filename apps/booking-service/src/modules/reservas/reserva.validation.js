const { z } = require('zod');

const { toSegundos } = require('./reserva.rules');
const { ESTADOS_VALIDOS } = require('./reserva.state-machine');

const HORA_REGEX = /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/;
const FECHA_REGEX = /^\d{4}-\d{2}-\d{2}$/;

const hora = z.string().regex(HORA_REGEX, 'La hora debe tener formato HH:mm o HH:mm:ss');

const crearReservaSchema = z
  .object({
    recursoUuid: z.string().uuid('El identificador del recurso no es válido'),
    tipoCodigo: z.string().trim().min(1, 'El tipo de reserva es obligatorio').max(20),
    titulo: z.string().trim().min(3, 'El título debe tener al menos 3 caracteres').max(200),
    descripcion: z.string().trim().max(2000).optional(),
    fecha: z.string().regex(FECHA_REGEX, 'La fecha debe tener formato YYYY-MM-DD'),
    horaInicio: hora,
    horaFin: hora,
    asistentesEsperados: z.number().int().positive().max(65535).optional(),
  })
  .refine((datos) => toSegundos(datos.horaFin) > toSegundos(datos.horaInicio), {
    message: 'La hora de fin debe ser posterior a la hora de inicio',
    path: ['horaFin'],
  });

const listarReservasQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  estado: z.enum(ESTADOS_VALIDOS, { errorMap: () => ({ message: 'Estado de reserva no válido' }) })
    .optional(),
  recursoUuid: z.string().uuid('El identificador del recurso no es válido').optional(),
});

const uuidParamSchema = z.object({
  uuid: z.string().uuid('El identificador de la reserva no es válido'),
});

const cambiarEstadoSchema = z.object({
  estado: z.enum(ESTADOS_VALIDOS, { errorMap: () => ({ message: 'Estado de reserva no válido' }) }),
  comentario: z.string().trim().max(1000).optional(),
});

const cancelarReservaSchema = z.object({
  comentario: z.string().trim().max(1000).optional(),
});

module.exports = {
  crearReservaSchema,
  listarReservasQuerySchema,
  uuidParamSchema,
  cambiarEstadoSchema,
  cancelarReservaSchema,
};
