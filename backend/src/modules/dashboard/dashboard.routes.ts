import { UserRole } from '@prisma/client';
import { Router } from 'express';
import { authenticate, authorize } from '../../middleware/auth';
import * as dashboardController from './dashboard.controller';

export const dashboardRouter = Router();

/**
 * @openapi
 * /dashboard/employee:
 *   get:
 *     summary: Get employee dashboard summary
 *     tags: [Dashboard]
 *     responses:
 *       200:
 *         description: Employee dashboard data
 */
dashboardRouter.get('/employee', authenticate, dashboardController.employeeDashboard);

/**
 * @openapi
 * /dashboard/manager:
 *   get:
 *     summary: Get Project Manager dashboard summary
 *     tags: [Dashboard]
 *     responses:
 *       200:
 *         description: Manager dashboard data
 */
dashboardRouter.get(
  '/manager',
  authenticate,
  authorize(UserRole.PROJECT_MANAGER),
  dashboardController.managerDashboard
);

/**
 * @openapi
 * /dashboard/hr:
 *   get:
 *     summary: Get HR dashboard summary
 *     tags: [Dashboard]
 *     responses:
 *       200:
 *         description: HR dashboard data
 */
dashboardRouter.get(
  '/hr',
  authenticate,
  authorize(UserRole.HR),
  dashboardController.hrDashboard
);

