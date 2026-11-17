const { z } = require('zod');

const createSchema = z.object({
  code: z.string().min(1).max(20),
  name: z.string().min(2).max(50),
  description: z.string().max(2000).optional(),
  requiresApproval: z.boolean().optional(),
  maxDurationMinutes: z.coerce.number().int().positive().optional(),
  advanceDaysLimit: z.coerce.number().int().positive().optional(),
});

const updateSchema = z.object({
  name: z.string().min(2).max(50).optional(),
  description: z.string().max(2000).optional(),
  maxDurationMinutes: z.coerce.number().int().positive().optional(),
  advanceDaysLimit: z.coerce.number().int().positive().optional(),
});

module.exports = { createSchema, updateSchema };
