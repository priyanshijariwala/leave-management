import { UserRole } from '@prisma/client';
import { Router } from 'express';
import { authenticate, authorize } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import * as approvalsController from './approvals.controller';
import {
  approvalDecisionSchema,
  approvalStepParamsSchema,
  pendingApprovalsQuerySchema,
} from './approvals.schema';

export const approvalsRouter = Router();

approvalsRouter.use(authenticate, authorize(UserRole.PROJECT_MANAGER, UserRole.HR));

/**
 * @openapi
 * /approvals/pending:
 *   get:
 *     summary: List pending approval steps assigned to the authenticated PM or HR user
 *     tags: [Approvals]
 *     responses:
 *       200:
 *         description: Paginated pending approval steps
 */
approvalsRouter.get(
  '/pending',
  validate({ query: pendingApprovalsQuerySchema }),
  approvalsController.getPending
);

/**
 * @openapi
 * /approvals/{approvalStepId}:
 *   get:
 *     summary: Get approval step details and balance context
 *     tags: [Approvals]
 *     responses:
 *       200:
 *         description: Approval step detail
 *       403:
 *         description: Forbidden
 */
approvalsRouter.get(
  '/:approvalStepId',
  validate({ params: approvalStepParamsSchema }),
  approvalsController.getStepDetail
);

/**
 * @openapi
 * /approvals/{approvalStepId}/approve:
 *   post:
 *     summary: Approve an assigned pending approval step
 *     tags: [Approvals]
 *     responses:
 *       200:
 *         description: Approval recorded
 *       409:
 *         description: Approval step already actioned
 */
approvalsRouter.post(
  '/:approvalStepId/approve',
  validate({ params: approvalStepParamsSchema, body: approvalDecisionSchema }),
  approvalsController.approve
);

/**
 * @openapi
 * /approvals/{approvalStepId}/reject:
 *   post:
 *     summary: Reject an assigned pending approval step
 *     tags: [Approvals]
 *     responses:
 *       200:
 *         description: Rejection recorded and reserved balance released
 *       409:
 *         description: Approval step already actioned
 */
approvalsRouter.post(
  '/:approvalStepId/reject',
  validate({ params: approvalStepParamsSchema, body: approvalDecisionSchema }),
  approvalsController.reject
);

