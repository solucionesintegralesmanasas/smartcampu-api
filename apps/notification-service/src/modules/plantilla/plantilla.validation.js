const { z } = require('zod');

const CHANNELS = ['in_app', 'email', 'push', 'sms'];

const createSchema = z.object({
  code: z.string().min(1).max(60),
  name: z.string().min(2).max(100),
  channel: z.enum(CHANNELS),
  subject: z.string().max(200).optional(),
  bodyText: z.string().optional(),
  bodyHtml: z.string().optional(),
  variables: z.record(z.any()).optional(),
});

const updateSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  subject: z.string().max(200).optional(),
  bodyText: z.string().optional(),
  bodyHtml: z.string().optional(),
  variables: z.record(z.any()).optional(),
});

module.exports = { createSchema, updateSchema, CHANNELS };
