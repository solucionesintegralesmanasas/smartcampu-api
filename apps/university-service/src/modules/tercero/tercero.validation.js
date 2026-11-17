const { z } = require('zod');

const createSchema = z.object({
  documentTypeCode: z.string().min(1).max(10),
  documentNumber: z.string().min(1).max(30),
  firstName: z.string().min(1).max(50),
  middleName: z.string().max(50).optional(),
  lastName: z.string().min(1).max(50),
  secondLastName: z.string().max(50).optional(),
  dateOfBirth: z.string().date().optional(),
  gender: z.enum(['M', 'F', 'X']).optional(),
  email: z.string().email().max(150).optional(),
  phone: z.string().max(20).optional(),
  address: z.string().max(200).optional(),
  cityUuid: z.string().uuid().optional(),
  cityName: z.string().max(100).optional(),
});

const updateSchema = z.object({
  firstName: z.string().min(1).max(50).optional(),
  middleName: z.string().max(50).optional(),
  lastName: z.string().min(1).max(50).optional(),
  secondLastName: z.string().max(50).optional(),
  email: z.string().email().max(150).optional(),
  phone: z.string().max(20).optional(),
  address: z.string().max(200).optional(),
});

module.exports = { createSchema, updateSchema };
