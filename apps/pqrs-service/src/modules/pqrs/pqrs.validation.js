const { z } = require('zod');

const createSchema = z.object({
  typeId: z.coerce.number().int().positive(),
  subject: z.string().min(3).max(200),
  description: z.string().min(1).max(4000),
  isAnonymous: z.boolean().optional(),
  contactEmail: z.string().email().optional(),
  campusUuid: z.string().uuid().optional(),
  campusName: z.string().max(120).optional(),
});

const respondSchema = z.object({
  body: z.string().min(3).max(4000),
});

module.exports = { createSchema, respondSchema };
