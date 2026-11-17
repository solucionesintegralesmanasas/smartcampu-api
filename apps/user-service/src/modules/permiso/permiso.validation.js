const { z } = require('zod');

const createSchema = z.object({
  name: z.string().min(3).max(100),
  module: z.string().min(2).max(50),
  resource: z.string().min(2).max(50),
  action: z.enum(['create', 'read', 'update', 'delete', 'approve', 'export']),
  description: z.string().max(255).optional(),
});

const updateSchema = z.object({
  description: z.string().max(255).optional(),
});

module.exports = { createSchema, updateSchema };
