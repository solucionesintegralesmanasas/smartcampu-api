const { z } = require('zod');

const createSchema = z.object({
  code: z.string().min(1).max(20),
  name: z.string().min(2).max(50),
  isTerminal: z.boolean().optional(),
});

module.exports = { createSchema };
