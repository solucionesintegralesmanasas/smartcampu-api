const { z } = require('zod');

const createSchema = z.object({
  name: z.string().min(2).max(50),
  description: z.string().max(255).optional(),
});

const updateSchema = z.object({
  name: z.string().min(2).max(50).optional(),
  description: z.string().max(255).optional(),
});

const assignPermissionSchema = z.object({
  permissionId: z.coerce.number().int().positive(),
});

module.exports = { createSchema, updateSchema, assignPermissionSchema };
