const { z } = require('zod');

const createSchema = z.object({
  name: z.string().min(2).max(100),
  address: z.string().max(200).optional(),
  phone: z.string().max(20).optional(),
  email: z.string().email().max(100).optional(),
  cityUuid: z.string().uuid(),
  cityName: z.string().min(1).max(100),
  stateName: z.string().min(1).max(100),
  isMain: z.boolean().optional(),
});

const updateSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  address: z.string().max(200).optional(),
  phone: z.string().max(20).optional(),
  email: z.string().email().max(100).optional(),
  isMain: z.boolean().optional(),
});

module.exports = { createSchema, updateSchema };
