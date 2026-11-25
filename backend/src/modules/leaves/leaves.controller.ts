import { LeaveRequestStatus } from '@prisma/client';
import { Request, Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import * as leaveCalculationService from './leaveCalculation.service';
import * as leavesService from './leaves.service';

export const calculateLeave = asyncHandler(async (req: Request, res: Response) => {
  const result = await leaveCalculationService.previewLeaveCalculation(req.user!.id, req.body);
  res.status(200).json(result);
});

export const createLeave = asyncHandler(async (req: Request, res: Response) => {
  const result = await leavesService.createLeaveRequest(req.user!, req.body);
  res.status(201).json(result);
});

export const getMyLeaves = asyncHandler(async (req: Request, res: Response) => {
  const page = req.query.page ? Number(req.query.page) : 1;
  const limit = req.query.limit ? Number(req.query.limit) : 10;
  const status = req.query.status as LeaveRequestStatus | undefined;
  const year = req.query.year ? Number(req.query.year) : undefined;

  const result = await leavesService.getMyLeaveRequests(req.user!.id, {
    page,
    limit,
    status,
    year,
  });
  res.status(200).json(result);
});

export const getLeaveById = asyncHandler(async (req: Request, res: Response) => {
  const result = await leavesService.getLeaveRequestById(String(req.params.id), req.user!);
  res.status(200).json(result);
});

export const getLeaveHistory = asyncHandler(async (req: Request, res: Response) => {
  const result = await leavesService.getLeaveRequestHistory(String(req.params.id), req.user!);
  res.status(200).json(result);
});

export const cancelLeave = asyncHandler(async (req: Request, res: Response) => {
  const result = await leavesService.cancelLeaveRequest(String(req.params.id), req.user!);
  res.status(200).json(result);
});
