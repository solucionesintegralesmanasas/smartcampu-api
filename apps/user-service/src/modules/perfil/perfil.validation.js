const { z } = require('zod');

// Deliberadamente sin isActive: un usuario no puede (des)activarse a sí mismo,
// eso es un endpoint de administración (ver usuario.routes.js).
const updateSchema = z.object({
  firstName: z.string().min(1).max(50).optional(),
  middleName: z.string().max(50).optional(),
  lastName: z.string().min(1).max(50).optional(),
  secondLastName: z.string().max(50).optional(),
  phone: z.string().max(20).optional(),
});

module.exports = { updateSchema };
