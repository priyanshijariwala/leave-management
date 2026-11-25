import { UserRole } from '@prisma/client';
import { Router } from 'express';
import { authenticate, authorize } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import * as hrController from './hr.controller';
import {
  createEmployeeSchema,
  employeeIdParamsSchema,
  hrBalancesQuerySchema,
  hrLeaveRequestsQuerySchema,
  listEmployeesQuerySchema,
  updateEmployeeSchema,
} from './hr.schema';

export const hrRouter = Router();

hrRouter.use(authenticate, authorize(UserRole.HR));

hrRouter.get(
  '/employees',
  validate({ query: listEmployeesQuerySchema }),
  hrController.getEmployees
);

hrRouter.post(
  '/employees',
  validate({ body: createEmployeeSchema }),
  hrController.postEmployee
);

hrRouter.patch(
  '/employees/:id',
  validate({ params: employeeIdParamsSchema, body: updateEmployeeSchema }),
  hrController.patchEmployee
);

hrRouter.get(
  '/leave-balances',
  validate({ query: hrBalancesQuerySchema }),
  hrController.getLeaveBalances
);

hrRouter.get(
  '/leave-requests',
  validate({ query: hrLeaveRequestsQuerySchema }),
  hrController.getLeaveRequests
);
