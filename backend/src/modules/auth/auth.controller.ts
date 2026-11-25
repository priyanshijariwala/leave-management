import { Request, Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import * as authService from './auth.service';

export const login = asyncHandler(async (req: Request, res: Response) => {
  const result = await authService.loginUser(req.body);
  res.status(200).json(result);
});

export const getMe = asyncHandler(async (req: Request, res: Response) => {
  res.status(200).json(req.user);
});

