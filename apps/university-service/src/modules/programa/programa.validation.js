const { z } = require('zod');

const LEVELS = ['undergraduate', 'specialization', 'masters', 'doctorate', 'technologist', 'technician'];

const createSchema = z.object({
  facultyId: z.coerce.number().int().positive(),
  code: z.string().min(1).max(20),
  name: z.string().min(2).max(150),
  level: z.enum(LEVELS),
  durationSemesters: z.coerce.number().int().positive().max(20),
  totalCredits: z.coerce.number().int().positive(),
  sniesCode: z.string().max(20).optional(),
});

const updateSchema = z.object({
  name: z.string().min(2).max(150).optional(),
  durationSemesters: z.coerce.number().int().positive().max(20)
    .optional(),
  totalCredits: z.coerce.number().int().positive().optional(),
  sniesCode: z.string().max(20).optional(),
});

module.exports = { createSchema, updateSchema, LEVELS };
