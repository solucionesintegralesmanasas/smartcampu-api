const { z } = require('zod');

const createSchema = z.object({
  requestTypeId: z.coerce.number().int().positive(),
  title: z.string().min(3).max(200),
  description: z.string().min(1).max(4000),
  formData: z.record(z.any()).optional(),
});

const resolutionSchema = z.object({
  resolutionNotes: z.string().min(3).max(2000),
});

module.exports = { createSchema, resolutionSchema };
