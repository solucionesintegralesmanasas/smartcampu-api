const { z } = require('zod');

const createSchema = z.object({
  personId: z.coerce.number().int().positive(),
  facultyId: z.coerce.number().int().positive(),
  userUuid: z.string().uuid().optional(),
  teacherCode: z.string().min(1).max(20),
  contractType: z.enum(['full_time', 'part_time', 'visiting', 'honorary']),
  hireDate: z.string().date(),
  academicDegree: z.string().max(80).optional(),
});

const updateSchema = z.object({
  academicDegree: z.string().max(80).optional(),
  status: z.enum(['active', 'inactive', 'retired']).optional(),
  terminationDate: z.string().date().optional(),
});

module.exports = { createSchema, updateSchema };
