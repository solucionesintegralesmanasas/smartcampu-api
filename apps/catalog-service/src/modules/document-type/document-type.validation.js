const { z } = require('zod');

const createSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  code: z.string().max(10).optional(),
  requiresCheckDigit: z.boolean().optional(),
});

const updateSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').optional(),
  code: z.string().max(10).optional(),
  requiresCheckDigit: z.boolean().optional(),
});

module.exports = { createSchema, updateSchema };
