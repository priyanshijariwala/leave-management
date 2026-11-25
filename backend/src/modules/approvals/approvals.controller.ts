import { Request, Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import * as approvalsService from './approvals.service';

export const getPending = asyncHandler(async (req: Request, res: Response) => {
  const result = await approvalsService.getPendingApprovals(req.user!.id, {
    page: req.query.page ? Number(req.query.page) : 1,
    limit: req.query.limit ? Number(req.query.limit) : 10,
    employeeId: req.query.employeeId as string | undefined,
    leaveTypeId: req.query.leaveTypeId as string | undefined,
    startDate: req.query.startDate as string | undefined,
    endDate: req.query.endDate as string | undefined,
  });
  res.status(200).json(result);
});

export const getStepDetail = asyncHandler(async (req: Request, res: Response) => {
  const result = await approvalsService.getApprovalStepDetail(
    String(req.params.approvalStepId),
    req.user!.id
  );
  res.status(200).json(result);
});

export const approve = asyncHandler(async (req: Request, res: Response) => {
  const result = await approvalsService.approveStep(
    String(req.params.approvalStepId),
    req.user!.id,
    req.body
  );
  res.status(200).json(result);
});

export const reject = asyncHandler(async (req: Request, res: Response) => {
  const result = await approvalsService.rejectStep(
    String(req.params.approvalStepId),
    req.user!.id,
    req.body
  );
  res.status(200).json(result);
});

