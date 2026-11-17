const { z } = require('zod');

const createSchema = z.object({
  categoryId: z.coerce.number().int().positive(),
  campusUuid: z.string().uuid(),
  campusName: z.string().min(1).max(100),
  title: z.string().min(3).max(200),
  description: z.string().max(4000).optional(),
  venue: z.string().max(200).optional(),
  startsAt: z.string().datetime({ offset: true }).or(z.string().min(1)),
  endsAt: z.string().datetime({ offset: true }).or(z.string().min(1)),
  maxCapacity: z.coerce.number().int().positive().optional(),
  cost: z.coerce.number().min(0).optional(),
  requiresRegistration: z.boolean().optional(),
  registrationDeadline: z.string().datetime({ offset: true }).or(z.string().min(1)).optional(),
  metadata: z.record(z.any()).optional(),
}).refine((data) => new Date(data.endsAt) > new Date(data.startsAt), {
  message: 'endsAt must be after startsAt',
  path: ['endsAt'],
});

const updateSchema = z.object({
  title: z.string().min(3).max(200).optional(),
  description: z.string().max(4000).optional(),
  venue: z.string().max(200).optional(),
  startsAt: z.string().min(1).optional(),
  endsAt: z.string().min(1).optional(),
  maxCapacity: z.coerce.number().int().positive().optional(),
  cost: z.coerce.number().min(0).optional(),
  registrationDeadline: z.string().min(1).optional(),
  metadata: z.record(z.any()).optional(),
});

module.exports = { createSchema, updateSchema };
