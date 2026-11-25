import { LeaveDurationType } from '@prisma/client';
import { z } from 'zod';

const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;

export const calculateLeaveSchema = z.object({
  leaveTypeId: z.string().uuid('Valid leaveTypeId is required'),
  startDate: z.string().regex(dateRegex, 'startDate must be YYYY-MM-DD'),
  endDate: z.string().regex(dateRegex, 'endDate must be YYYY-MM-DD'),
  durationType: z.nativeEnum(LeaveDurationType),
  startTime: z.string().regex(timeRegex, 'startTime must be HH:mm').optional(),
});

export type CalculateLeaveInput = z.infer<typeof calculateLeaveSchema>;

