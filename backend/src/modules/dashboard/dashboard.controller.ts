import { Request, Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import * as dashboardService from './dashboard.service';

export const employeeDashboard = asyncHandler(async (req: Request, res: Response) => {
  const result = await dashboardService.getEmployeeDashboard(req.user!.id);
  res.status(200).json(result);
});

export const managerDashboard = asyncHandler(async (req: Request, res: Response) => {
  const result = await dashboardService.getManagerDashboard(req.user!.id);
  res.status(200).json(result);
});

export const hrDashboard = asyncHandler(async (req: Request, res: Response) => {
  const result = await dashboardService.getHrDashboard(req.user!.id);
  res.status(200).json(result);
});

