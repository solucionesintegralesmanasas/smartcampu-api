const { z } = require('zod');

const CHANNELS = ['in_app', 'email', 'push', 'sms'];

const setSchema = z.object({
  category: z.string().min(1).max(60),
  channel: z.enum(CHANNELS),
  isEnabled: z.boolean(),
});

module.exports = { setSchema, CHANNELS };
