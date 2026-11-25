import { Request, Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import * as leaveCalculationService from './leaveCalculation.service';

export const calculateLeave = asyncHandler(async (req: Request, res: Response) => {
  const result = await leaveCalculationService.previewLeaveCalculation(req.user!.id, req.body);
  res.status(200).json(result);
});

