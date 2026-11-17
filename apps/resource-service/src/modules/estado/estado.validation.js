const { z } = require('zod');

const createSchema = z.object({
  code: z.string().min(1).max(20),
  name: z.string().min(2).max(50),
  isBookable: z.boolean().optional(),
  colorHex: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
});

const updateSchema = z.object({
  name: z.string().min(2).max(50).optional(),
  isBookable: z.boolean().optional(),
  colorHex: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
});

module.exports = { createSchema, updateSchema };
