import { LeaveRequestStatus, UserRole } from '@prisma/client';
import { Request, Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import * as hrService from './hr.service';

export const getEmployees = asyncHandler(async (req: Request, res: Response) => {
  const isActiveParam = req.query.isActive as string | undefined;
  const result = await hrService.listEmployees({
    page: req.query.page ? Number(req.query.page) : 1,
    limit: req.query.limit ? Number(req.query.limit) : 10,
    search: req.query.search as string | undefined,
    role: req.query.role as UserRole | undefined,
    isActive: isActiveParam !== undefined ? isActiveParam === 'true' : undefined,
  });
  res.status(200).json(result);
});

export const postEmployee = asyncHandler(async (req: Request, res: Response) => {
  const created = await hrService.createEmployee(req.body);
  res.status(201).json(created);
});

export const patchEmployee = asyncHandler(async (req: Request, res: Response) => {
  const updated = await hrService.updateEmployee(String(req.params.id), req.body);
  res.status(200).json(updated);
});

export const getLeaveBalances = asyncHandler(async (req: Request, res: Response) => {
  const result = await hrService.getEmployeeBalances({
    page: req.query.page ? Number(req.query.page) : 1,
    limit: req.query.limit ? Number(req.query.limit) : 20,
    employeeId: req.query.employeeId as string | undefined,
    year: req.query.year ? Number(req.query.year) : undefined,
  });
  res.status(200).json(result);
});

export const getLeaveRequests = asyncHandler(async (req: Request, res: Response) => {
  const page = req.query.page ? Number(req.query.page) : 1;
  const limit = req.query.limit ? Number(req.query.limit) : 10;
  const status = req.query.status as LeaveRequestStatus | undefined;

  const result = await hrService.listAllLeaveRequests(page, limit, status);
  res.status(200).json(result);
});

