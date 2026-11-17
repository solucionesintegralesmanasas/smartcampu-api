const { z } = require('zod');

const createSchema = z.object({
  legalName: z.string().min(2).max(200),
  tradeName: z.string().max(200).optional(),
  taxId: z.string().min(3).max(20),
  address: z.string().max(200).optional(),
  phone: z.string().max(20).optional(),
  email: z.string().email().max(100).optional(),
  cityUuid: z.string().uuid().optional(),
  cityName: z.string().max(100).optional(),
});

const updateSchema = z.object({
  legalName: z.string().min(2).max(200).optional(),
  tradeName: z.string().max(200).optional(),
  address: z.string().max(200).optional(),
  phone: z.string().max(20).optional(),
  email: z.string().email().max(100).optional(),
});

module.exports = { createSchema, updateSchema };
