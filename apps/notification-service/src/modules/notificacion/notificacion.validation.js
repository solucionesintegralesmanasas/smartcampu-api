const { z } = require('zod');

const CHANNELS = ['in_app', 'email', 'push', 'sms'];

const createSchema = z.object({
  recipientUuid: z.string().uuid(),
  recipientEmail: z.string().email().optional(),
  channel: z.enum(CHANNELS).optional(),
  subject: z.string().max(200).optional(),
  body: z.string().min(1),
  sourceService: z.string().max(50).optional(),
  sourceEntity: z.string().max(50).optional(),
  sourceUuid: z.string().uuid().optional(),
  metadata: z.record(z.any()).optional(),
});

module.exports = { createSchema };
