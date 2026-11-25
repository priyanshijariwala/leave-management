import { Router } from 'express';
import { authenticate } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import * as leaveBalancesController from './leaveBalances.controller';
import { myBalancesQuerySchema } from './leaveBalances.schema';

export const leaveBalancesRouter = Router();

leaveBalancesRouter.get(
  '/my',
  authenticate,
  validate({ query: myBalancesQuerySchema }),
  leaveBalancesController.getMyBalances
);
