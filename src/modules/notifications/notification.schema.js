import { z } from 'zod';

export const manualNotificationSchema = z.object({
  type: z.string().min(2).max(80),
  to_address: z.string().email(),
  subject: z.string().min(2).max(255),
  message: z.string().min(2).max(5000),
  metadata: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])).default({})
});
