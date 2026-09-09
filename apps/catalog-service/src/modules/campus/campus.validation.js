const { z } = require('zod');

const createSchema = z.object({
  cityId: z.number().int().positive('cityId must be a positive integer'),
  name: z.string().min(2, 'Name must be at least 2 characters'),
  address: z.string().optional(),
  phone: z.string().max(20).optional(),
});

const updateSchema = z.object({
  cityId: z.number().int().positive('cityId must be a positive integer').optional(),
  name: z.string().min(2, 'Name must be at least 2 characters').optional(),
  address: z.string().optional(),
  phone: z.string().max(20).optional(),
});

module.exports = { createSchema, updateSchema };
