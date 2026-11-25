import { UserRole } from '@prisma/client';
import { Router } from 'express';
import { authenticate, authorize } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import * as leavesController from './leaves.controller';
import {
  calculateLeaveSchema,
  createLeaveSchema,
  leaveIdParamsSchema,
  myLeavesQuerySchema,
} from './leaves.schema';

export const leavesRouter = Router();

leavesRouter.post(
  '/calculate',
  authenticate,
  validate({ body: calculateLeaveSchema }),
  leavesController.calculateLeave
);

leavesRouter.post(
  '/',
  authenticate,
  authorize(UserRole.EMPLOYEE, UserRole.PROJECT_MANAGER),
  validate({ body: createLeaveSchema }),
  leavesController.createLeave
);

leavesRouter.get(
  '/my',
  authenticate,
  validate({ query: myLeavesQuerySchema }),
  leavesController.getMyLeaves
);

leavesRouter.get(
  '/:id',
  authenticate,
  validate({ params: leaveIdParamsSchema }),
  leavesController.getLeaveById
);

leavesRouter.get(
  '/:id/history',
  authenticate,
  validate({ params: leaveIdParamsSchema }),
  leavesController.getLeaveHistory
);

leavesRouter.post(
  '/:id/cancel',
  authenticate,
  validate({ params: leaveIdParamsSchema }),
  leavesController.cancelLeave
);
