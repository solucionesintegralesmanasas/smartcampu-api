const { z } = require('zod');

const createSchema = z.object({
  code: z.string().min(1).max(20),
  name: z.string().min(2).max(50),
  colorHex: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  icon: z.string().max(60).optional(),
});

const updateSchema = z.object({
  name: z.string().min(2).max(50).optional(),
  colorHex: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  icon: z.string().max(60).optional(),
});

module.exports = { createSchema, updateSchema };
