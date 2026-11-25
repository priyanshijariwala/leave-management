import { UserRole } from '@prisma/client';
import { Router } from 'express';
import { authenticate, authorize } from '../../middleware/auth';
import * as dashboardController from './dashboard.controller';

export const dashboardRouter = Router();

dashboardRouter.get('/employee', authenticate, dashboardController.employeeDashboard);

dashboardRouter.get(
  '/manager',
  authenticate,
  authorize(UserRole.PROJECT_MANAGER),
  dashboardController.managerDashboard
);

dashboardRouter.get(
  '/hr',
  authenticate,
  authorize(UserRole.HR),
  dashboardController.hrDashboard
);
