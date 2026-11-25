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

/**
 * @openapi
 * /hr/employees:
 *   get:
 *     summary: List employees with search and filters (HR only)
 *     tags: [HR]
 *     responses:
 *       200:
 *         description: Paginated employee list
 */
hrRouter.get(
  '/employees',
  validate({ query: listEmployeesQuerySchema }),
  hrController.getEmployees
);

/**
 * @openapi
 * /hr/employees:
 *   post:
 *     summary: Create employee and provision current-year leave balances (HR only)
 *     tags: [HR]
 *     responses:
 *       201:
 *         description: Employee created
 */
hrRouter.post(
  '/employees',
  validate({ body: createEmployeeSchema }),
  hrController.postEmployee
);

/**
 * @openapi
 * /hr/employees/{id}:
 *   patch:
 *     summary: Update employee profile, manager, or active status (HR only)
 *     tags: [HR]
 *     responses:
 *       200:
 *         description: Employee updated
 */
hrRouter.patch(
  '/employees/:id',
  validate({ params: employeeIdParamsSchema, body: updateEmployeeSchema }),
  hrController.patchEmployee
);

/**
 * @openapi
 * /hr/leave-balances:
 *   get:
 *     summary: View employee leave balances (HR only)
 *     tags: [HR]
 *     responses:
 *       200:
 *         description: Paginated leave balances
 */
hrRouter.get(
  '/leave-balances',
  validate({ query: hrBalancesQuerySchema }),
  hrController.getLeaveBalances
);

/**
 * @openapi
 * /hr/leave-requests:
 *   get:
 *     summary: View all leave requests across the organization (HR only)
 *     tags: [HR]
 *     responses:
 *       200:
 *         description: Paginated leave requests
 */
hrRouter.get(
  '/leave-requests',
  validate({ query: hrLeaveRequestsQuerySchema }),
  hrController.getLeaveRequests
);

