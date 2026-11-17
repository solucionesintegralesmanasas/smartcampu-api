const { z } = require('zod');

const createSchema = z.object({
  campusId: z.coerce.number().int().positive(),
  code: z.string().min(1).max(20),
  name: z.string().min(2).max(150),
  deanName: z.string().max(100).optional(),
  email: z.string().email().max(100).optional(),
});

const updateSchema = z.object({
  name: z.string().min(2).max(150).optional(),
  deanName: z.string().max(100).optional(),
  email: z.string().email().max(100).optional(),
});

module.exports = { createSchema, updateSchema };
