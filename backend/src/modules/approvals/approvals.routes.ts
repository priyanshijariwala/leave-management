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

approvalsRouter.get(
  '/pending',
  validate({ query: pendingApprovalsQuerySchema }),
  approvalsController.getPending
);

approvalsRouter.get(
  '/:approvalStepId',
  validate({ params: approvalStepParamsSchema }),
  approvalsController.getStepDetail
);

approvalsRouter.post(
  '/:approvalStepId/approve',
  validate({ params: approvalStepParamsSchema, body: approvalDecisionSchema }),
  approvalsController.approve
);

approvalsRouter.post(
  '/:approvalStepId/reject',
  validate({ params: approvalStepParamsSchema, body: approvalDecisionSchema }),
  approvalsController.reject
);
