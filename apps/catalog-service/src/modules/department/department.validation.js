const { z } = require('zod');

const createSchema = z.object({
  countryId: z.coerce.number().int().positive().optional()
    .default(1),
  name: z.string().min(2, 'Name must be at least 2 characters'),
  daneCode: z.string().max(10).optional(),
});

const updateSchema = z.object({
  countryId: z.coerce.number().int().positive().optional(),
  name: z.string().min(2, 'Name must be at least 2 characters').optional(),
  daneCode: z.string().max(10).optional(),
});

module.exports = { createSchema, updateSchema };
