const { z } = require('zod');

const { DATE_REGEX, isValidDate } = require('../../core/helpers/time.helper');

const CONDITIONS = ['new', 'good', 'fair', 'damaged', 'decommissioned'];

const createInventorySchema = z.object({
  numeroSerie: z.string().trim().max(80).nullable().optional(),
  descripcion: z.string().trim().min(2, 'La descripción es obligatoria').max(200),
  cantidad: z.number().int().min(0, 'La cantidad no puede ser negativa').optional(),
  unidad: z.string().trim().min(1).max(20).optional(),
  condicion: z.enum(CONDITIONS, {
    errorMap: () => ({ message: `condicion debe ser uno de: ${CONDITIONS.join(', ')}` }),
  }).optional(),
  fechaAdquisicion: z
    .string()
    .regex(DATE_REGEX, 'fechaAdquisicion debe tener formato YYYY-MM-DD')
    .refine(isValidDate, 'fechaAdquisicion no es una fecha válida')
    .nullable()
    .optional(),
  atributos: z.record(z.unknown()).nullable().optional(),
});

const updateInventorySchema = createInventorySchema
  .partial()
  .extend({ activo: z.boolean().optional() })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'Debe enviar al menos un campo para actualizar',
  });

module.exports = { createInventorySchema, updateInventorySchema };
