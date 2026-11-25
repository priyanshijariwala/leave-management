import { z } from 'zod';

const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

export const approvalStepParamsSchema = z.object({
  approvalStepId: z.string().uuid('Valid approvalStepId is required'),
});

export const pendingApprovalsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(10),
  employeeId: z.string().uuid().optional(),
  leaveTypeId: z.string().uuid().optional(),
  startDate: z.string().regex(dateRegex, 'startDate must be YYYY-MM-DD').optional(),
  endDate: z.string().regex(dateRegex, 'endDate must be YYYY-MM-DD').optional(),
});

export const approvalDecisionSchema = z.object({
  comments: z.string().trim().max(500, 'Comments must be at most 500 characters').optional(),
});

