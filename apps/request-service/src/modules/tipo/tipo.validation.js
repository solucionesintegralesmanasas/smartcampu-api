const { z } = require('zod');

const createSchema = z.object({
  categoryId: z.coerce.number().int().positive(),
  code: z.string().min(1).max(20),
  name: z.string().min(2).max(80),
  description: z.string().max(2000).optional(),
  requiresApproval: z.boolean().optional(),
  slaDays: z.coerce.number().int().positive().optional(),
  cost: z.coerce.number().min(0).optional(),
  formSchema: z.record(z.any()).optional(),
});

const updateSchema = z.object({
  name: z.string().min(2).max(80).optional(),
  description: z.string().max(2000).optional(),
  slaDays: z.coerce.number().int().positive().optional(),
  cost: z.coerce.number().min(0).optional(),
  formSchema: z.record(z.any()).optional(),
});

module.exports = { createSchema, updateSchema };
