const { z } = require('zod');

const timeRegex = /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/;

const createSchema = z.object({
  dayOfWeek: z.coerce.number().int().min(0).max(6),
  openTime: z.string().regex(timeRegex, 'openTime must be HH:MM or HH:MM:SS'),
  closeTime: z.string().regex(timeRegex, 'closeTime must be HH:MM or HH:MM:SS'),
}).refine((data) => data.closeTime > data.openTime, {
  message: 'closeTime must be after openTime',
  path: ['closeTime'],
});

const updateSchema = z.object({
  openTime: z.string().regex(timeRegex).optional(),
  closeTime: z.string().regex(timeRegex).optional(),
});

module.exports = { createSchema, updateSchema };
