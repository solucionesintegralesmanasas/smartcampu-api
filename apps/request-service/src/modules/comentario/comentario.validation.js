const { z } = require('zod');

const createSchema = z.object({
  body: z.string().min(1).max(4000),
  isInternal: z.boolean().optional(),
});

module.exports = { createSchema };
