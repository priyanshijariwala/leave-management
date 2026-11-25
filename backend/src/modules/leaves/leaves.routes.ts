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

/**
 * @openapi
 * /leaves/calculate:
 *   post:
 *     summary: Preview leave duration, end time, and projected balance
 *     tags: [Leaves]
 *     responses:
 *       200:
 *         description: Calculated preview result
 *       422:
 *         description: Invalid dates or duration rules
 */
leavesRouter.post(
  '/calculate',
  authenticate,
  validate({ body: calculateLeaveSchema }),
  leavesController.calculateLeave
);

/**
 * @openapi
 * /leaves:
 *   post:
 *     summary: Submit a leave request and reserve balance atomically
 *     tags: [Leaves]
 *     responses:
 *       201:
 *         description: Leave request created
 *       409:
 *         description: Overlapping active leave request
 *       422:
 *         description: Insufficient balance or invalid input
 */
leavesRouter.post(
  '/',
  authenticate,
  authorize(UserRole.EMPLOYEE, UserRole.PROJECT_MANAGER),
  validate({ body: createLeaveSchema }),
  leavesController.createLeave
);

/**
 * @openapi
 * /leaves/my:
 *   get:
 *     summary: List authenticated user's leave requests
 *     tags: [Leaves]
 *     responses:
 *       200:
 *         description: Paginated leave requests
 */
leavesRouter.get(
  '/my',
  authenticate,
  validate({ query: myLeavesQuerySchema }),
  leavesController.getMyLeaves
);

/**
 * @openapi
 * /leaves/{id}:
 *   get:
 *     summary: Get leave request details, approval steps, and history
 *     tags: [Leaves]
 *     responses:
 *       200:
 *         description: Leave request details
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Not found
 */
leavesRouter.get(
  '/:id',
  authenticate,
  validate({ params: leaveIdParamsSchema }),
  leavesController.getLeaveById
);

/**
 * @openapi
 * /leaves/{id}/history:
 *   get:
 *     summary: Get chronological approval history for a leave request
 *     tags: [Leaves]
 *     responses:
 *       200:
 *         description: Chronological approval history
 */
leavesRouter.get(
  '/:id/history',
  authenticate,
  validate({ params: leaveIdParamsSchema }),
  leavesController.getLeaveHistory
);

/**
 * @openapi
 * /leaves/{id}/cancel:
 *   post:
 *     summary: Cancel a pending leave request and release reserved balance
 *     tags: [Leaves]
 *     responses:
 *       200:
 *         description: Leave request cancelled
 *       409:
 *         description: Request is not pending
 */
leavesRouter.post(
  '/:id/cancel',
  authenticate,
  validate({ params: leaveIdParamsSchema }),
  leavesController.cancelLeave
);
