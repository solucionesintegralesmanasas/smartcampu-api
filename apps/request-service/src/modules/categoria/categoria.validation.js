const { z } = require('zod');

const createSchema = z.object({
  code: z.string().min(1).max(20),
  name: z.string().min(2).max(80),
  icon: z.string().max(60).optional(),
  sortOrder: z.coerce.number().int().min(0).optional(),
});

const updateSchema = z.object({
  name: z.string().min(2).max(80).optional(),
  icon: z.string().max(60).optional(),
  sortOrder: z.coerce.number().int().min(0).optional(),
});

module.exports = { createSchema, updateSchema };
