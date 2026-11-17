const { z } = require('zod');

const timeRegex = /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/;

const createSchema = z.object({
  bookingTypeId: z.coerce.number().int().positive(),
  resourceId: z.coerce.number().int().positive(),
  title: z.string().min(3).max(200),
  description: z.string().max(2000).optional(),
  bookingDate: z.string().date(),
  startTime: z.string().regex(timeRegex),
  endTime: z.string().regex(timeRegex),
  expectedAttendees: z.coerce.number().int().positive().optional(),
  metadata: z.record(z.any()).optional(),
}).refine((data) => data.endTime > data.startTime, {
  message: 'endTime must be after startTime',
  path: ['endTime'],
});

const reasonSchema = z.object({
  reason: z.string().min(3).max(500),
});

module.exports = { createSchema, reasonSchema };
