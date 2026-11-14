const { z } = require('zod');

const { ESTADOS_EVENTO } = require('./evento.state-machine');

const CODIGOS_ESTADO = Object.values(ESTADOS_EVENTO);

const fechaIso = z
  .string({ required_error: 'La fecha es obligatoria' })
  .datetime({ offset: true, message: 'Formato de fecha inválido (ISO 8601 con zona horaria)' })
  .transform((valor) => new Date(valor));

const fechaFiltro = z
  .string()
  .refine((valor) => !Number.isNaN(Date.parse(valor)), 'Formato de fecha inválido')
  .transform((valor) => new Date(valor));

const camposEvento = {
  titulo: z.string().trim().min(3, 'El título debe tener al menos 3 caracteres').max(200),
  descripcion: z.string().trim().max(5000).nullable().optional(),
  lugar: z.string().trim().max(200).nullable().optional(),
  categoriaUuid: z.string().uuid('La categoría debe ser un UUID válido'),
  sedeUuid: z.string().uuid('La sede debe ser un UUID válido'),
  sedeNombre: z.string().trim().min(1, 'El nombre de la sede es obligatorio').max(100),
  fechaInicio: fechaIso,
  fechaFin: fechaIso,
  capacidadMaxima: z.number().int().positive().max(1000000).nullable().optional(),
  costo: z.number().nonnegative().max(9999999999.99).optional(),
  requiereInscripcion: z.boolean().optional(),
  fechaLimiteInscripcion: fechaIso.nullable().optional(),
};

const validarRangoFechas = (datos) =>
  !datos.fechaInicio || !datos.fechaFin || datos.fechaFin > datos.fechaInicio;

const validarLimiteInscripcion = (datos) =>
  !datos.fechaLimiteInscripcion ||
  !datos.fechaInicio ||
  datos.fechaLimiteInscripcion <= datos.fechaInicio;

const MENSAJE_RANGO = 'La fecha de fin debe ser posterior a la de inicio';
const MENSAJE_LIMITE = 'La fecha límite de inscripción no puede ser posterior al inicio del evento';

const createEventoSchema = z
  .object(camposEvento)
  .refine(validarRangoFechas, { message: MENSAJE_RANGO, path: ['fechaFin'] })
  .refine(validarLimiteInscripcion, {
    message: MENSAJE_LIMITE,
    path: ['fechaLimiteInscripcion'],
  });

const updateEventoSchema = z
  .object(camposEvento)
  .partial()
  .refine((datos) => Object.values(datos).some((valor) => valor !== undefined), {
    message: 'Debe enviar al menos un campo a modificar',
  })
  .refine(validarRangoFechas, { message: MENSAJE_RANGO, path: ['fechaFin'] })
  .refine(validarLimiteInscripcion, {
    message: MENSAJE_LIMITE,
    path: ['fechaLimiteInscripcion'],
  });

const listarEventosQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  categoriaUuid: z.string().uuid('La categoría debe ser un UUID válido').optional(),
  fechaDesde: fechaFiltro.optional(),
  fechaHasta: fechaFiltro.optional(),
  estado: z.enum(CODIGOS_ESTADO).optional(),
});

const cambiarEstadoSchema = z.object({
  estado: z.enum(CODIGOS_ESTADO, {
    errorMap: () => ({ message: `El estado debe ser uno de: ${CODIGOS_ESTADO.join(', ')}` }),
  }),
});

module.exports = {
  createEventoSchema,
  updateEventoSchema,
  listarEventosQuerySchema,
  cambiarEstadoSchema,
};
