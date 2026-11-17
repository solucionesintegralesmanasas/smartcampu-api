const { z } = require('zod');

const createSchema = z.object({
  fileId: z.coerce.number().int().positive(),
});

module.exports = { createSchema };
