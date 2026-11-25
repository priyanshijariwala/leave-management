import { Router } from 'express';
import { authenticate } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import * as leavesController from './leaves.controller';
import { calculateLeaveSchema } from './leaves.schema';

export const leavesRouter = Router();

/**
 * @openapi
 * /leaves/calculate:
 *   post:
 *     summary: Preview leave duration, end time, and projected balance
 *     tags: [Leaves]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [leaveTypeId, startDate, endDate, durationType]
 *             properties:
 *               leaveTypeId:
 *                 type: string
 *                 format: uuid
 *               startDate:
 *                 type: string
 *                 example: "2026-11-26"
 *               endDate:
 *                 type: string
 *                 example: "2026-11-26"
 *               durationType:
 *                 type: string
 *                 enum: [FULL_DAY, HALF_DAY]
 *               startTime:
 *                 type: string
 *                 example: "09:00"
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

