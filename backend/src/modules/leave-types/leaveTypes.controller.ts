import { Request, Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import * as leaveTypesService from './leaveTypes.service';

export const listLeaveTypes = asyncHandler(async (req: Request, res: Response) => {
  const result = await leaveTypesService.getActiveLeaveTypesForUser(req.user!.id);
  res.status(200).json(result);
});

