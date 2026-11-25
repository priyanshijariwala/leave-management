import { Request, Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import * as leaveBalancesService from './leaveBalances.service';

export const getMyBalances = asyncHandler(async (req: Request, res: Response) => {
  const yearParam = req.query.year ? Number(req.query.year) : undefined;
  const result = await leaveBalancesService.getMyLeaveBalances(req.user!.id, yearParam);
  res.status(200).json(result);
});

