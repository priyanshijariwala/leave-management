import { LeaveDurationType, LeaveRequestStatus } from '@prisma/client';
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

export const createLeaveSchema = calculateLeaveSchema.extend({
  reason: z
    .string()
    .trim()
    .min(10, 'Reason must be at least 10 characters')
    .max(500, 'Reason must be at most 500 characters'),
});

export const leaveIdParamsSchema = z.object({
  id: z.string().uuid('Valid leave request ID is required'),
});

export const myLeavesQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(10),
  status: z.nativeEnum(LeaveRequestStatus).optional(),
  year: z.coerce.number().int().min(2000).max(2100).optional(),
});

export type CalculateLeaveInput = z.infer<typeof calculateLeaveSchema>;
