import { Router } from 'express';
import { authenticate } from '../../middleware/auth';
import * as leaveTypesController from './leaveTypes.controller';

export const leaveTypesRouter = Router();

leaveTypesRouter.get('/', authenticate, leaveTypesController.listLeaveTypes);
