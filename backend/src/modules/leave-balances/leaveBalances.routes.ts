import { Router } from 'express';
import { authenticate } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import * as leaveBalancesController from './leaveBalances.controller';
import { myBalancesQuerySchema } from './leaveBalances.schema';

export const leaveBalancesRouter = Router();

/**
 * @openapi
 * /leave-balances/my:
 *   get:
 *     summary: Get authenticated user's leave balances
 *     tags: [Leave Balances]
 *     parameters:
 *       - in: query
 *         name: year
 *         schema:
 *           type: integer
 *           example: 2026
 *     responses:
 *       200:
 *         description: Leave balance rows for the user
 *       401:
 *         description: Unauthorized
 */
leaveBalancesRouter.get(
  '/my',
  authenticate,
  validate({ query: myBalancesQuerySchema }),
  leaveBalancesController.getMyBalances
);

