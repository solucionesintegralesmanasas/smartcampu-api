const { z } = require('zod');

const createSchema = z.object({
  categoryId: z.coerce.number().int().positive(),
  statusId: z.coerce.number().int().positive(),
  campusUuid: z.string().uuid(),
  campusName: z.string().min(1).max(100),
  code: z.string().min(1).max(30),
  name: z.string().min(2).max(100),
  description: z.string().max(2000).optional(),
  capacity: z.coerce.number().int().positive().optional(),
  floor: z.string().max(10).optional(),
  building: z.string().max(50).optional(),
  hasInventory: z.boolean().optional(),
  attributes: z.record(z.any()).optional(),
});

const updateSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  description: z.string().max(2000).optional(),
  capacity: z.coerce.number().int().positive().optional(),
  floor: z.string().max(10).optional(),
  building: z.string().max(50).optional(),
  statusId: z.coerce.number().int().positive().optional(),
  attributes: z.record(z.any()).optional(),
});

const availabilityQuerySchema = z.object({
  date: z.string().date(),
  startTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/),
  endTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/),
});

module.exports = { createSchema, updateSchema, availabilityQuerySchema };
