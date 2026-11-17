const { z } = require('zod');

const updateSchema = z.object({
  firstName: z.string().min(1).max(50).optional(),
  middleName: z.string().max(50).optional(),
  lastName: z.string().min(1).max(50).optional(),
  secondLastName: z.string().max(50).optional(),
  phone: z.string().max(20).optional(),
  isActive: z.boolean().optional(),
});

const ROLE_NAMES = ['SUPERADMIN', 'ADMIN', 'STAFF', 'TEACHER', 'STUDENT'];

const updateRolesSchema = z.object({
  roles: z.array(z.enum(ROLE_NAMES)).min(1, 'Debe indicar al menos un rol'),
});

const listQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100)
    .default(10),
  isActive: z
    .enum(['true', 'false'])
    .optional()
    .transform((val) => (val === undefined ? undefined : val === 'true')),
  role: z.string().optional(),
});

module.exports = {
  updateSchema, updateRolesSchema, listQuerySchema, ROLE_NAMES,
};
