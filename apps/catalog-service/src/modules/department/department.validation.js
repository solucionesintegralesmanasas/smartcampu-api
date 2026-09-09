const { z } = require('zod');

const createSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  daneCode: z.string().max(10).optional(),
});

const updateSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').optional(),
  daneCode: z.string().max(10).optional(),
});

module.exports = { createSchema, updateSchema };
