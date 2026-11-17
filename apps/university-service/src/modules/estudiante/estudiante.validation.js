const { z } = require('zod');

const createSchema = z.object({
  personId: z.coerce.number().int().positive(),
  programId: z.coerce.number().int().positive(),
  userUuid: z.string().uuid().optional(),
  studentCode: z.string().min(1).max(20),
  enrollmentDate: z.string().date(),
  currentSemester: z.coerce.number().int().positive().max(30)
    .optional(),
});

const updateSchema = z.object({
  currentSemester: z.coerce.number().int().positive().max(30)
    .optional(),
  gpa: z.coerce.number().min(0).max(5).optional(),
  status: z.enum(['active', 'inactive', 'graduated', 'withdrawn', 'suspended']).optional(),
  graduationDate: z.string().date().optional(),
});

module.exports = { createSchema, updateSchema };
