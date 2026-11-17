const { z } = require('zod');

const uploadMetaSchema = z.object({
  ownerType: z.enum(['pqrs', 'solicitud', 'evento', 'perfil']).optional(),
  ownerReferenceUuid: z.string().uuid().optional(),
  // Llega como string en multipart/form-data; se parsea antes de validar.
  metadata: z.record(z.any()).optional(),
});

const listQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100)
    .default(10),
  ownerType: z.enum(['pqrs', 'solicitud', 'evento', 'perfil']).optional(),
});

module.exports = { uploadMetaSchema, listQuerySchema };
