const { z } = require('zod');

const createSchema = z.object({
  stateId: z.number().int().positive('stateId must be a positive integer'),
  name: z.string().min(2, 'Name must be at least 2 characters'),
  daneCode: z.string().max(10).optional(),
});

const updateSchema = z.object({
  stateId: z.number().int().positive('stateId must be a positive integer').optional(),
  name: z.string().min(2, 'Name must be at least 2 characters').optional(),
  daneCode: z.string().max(10).optional(),
});

module.exports = { createSchema, updateSchema };
