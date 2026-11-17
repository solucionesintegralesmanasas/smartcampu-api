const { z } = require('zod');

const createSchema = z.object({
  code: z.string().min(1).max(20),
  name: z.string().min(2).max(50),
  icon: z.string().max(60).optional(),
  description: z.string().max(1000).optional(),
});

const updateSchema = z.object({
  name: z.string().min(2).max(50).optional(),
  icon: z.string().max(60).optional(),
  description: z.string().max(1000).optional(),
});

module.exports = { createSchema, updateSchema };
