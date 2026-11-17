const { z } = require('zod');

const createSchema = z.object({
  endpoint: z.string().url().max(500),
  authKey: z.string().min(1).max(255),
  p256dhKey: z.string().min(1).max(255),
  deviceType: z.enum(['web', 'android', 'ios']).optional(),
  deviceLabel: z.string().max(100).optional(),
});

module.exports = { createSchema };
