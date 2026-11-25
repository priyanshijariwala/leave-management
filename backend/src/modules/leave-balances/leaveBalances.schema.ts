import { z } from 'zod';

export const myBalancesQuerySchema = z.object({
  year: z.coerce.number().int().min(2000).max(2100).optional(),
});

