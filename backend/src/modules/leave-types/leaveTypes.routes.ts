import { Router } from 'express';
import { authenticate } from '../../middleware/auth';
import * as leaveTypesController from './leaveTypes.controller';

export const leaveTypesRouter = Router();

/**
 * @openapi
 * /leave-types:
 *   get:
 *     summary: Get active leave types with user's available balance for current year
 *     tags: [Leave Types]
 *     responses:
 *       200:
 *         description: Active leave types and available balances
 *       401:
 *         description: Unauthorized
 */
leaveTypesRouter.get('/', authenticate, leaveTypesController.listLeaveTypes);

