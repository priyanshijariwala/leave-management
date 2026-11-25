import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { env } from './config/env';
import { errorHandler } from './middleware/errorHandler';
import { notFoundHandler } from './middleware/notFound';
import { approvalsRouter } from './modules/approvals/approvals.routes';
import { authRouter } from './modules/auth/auth.routes';
import { dashboardRouter } from './modules/dashboard/dashboard.routes';
import { healthRouter } from './modules/health/health.routes';
import { hrRouter } from './modules/hr/hr.routes';
import { leaveBalancesRouter } from './modules/leave-balances/leaveBalances.routes';
import { leaveTypesRouter } from './modules/leave-types/leaveTypes.routes';
import { leavesRouter } from './modules/leaves/leaves.routes';

export const createApp = () => {
  const app = express();

  app.use(helmet());
  app.use(
    cors({
      origin: env.CORS_ORIGIN,
      credentials: true,
    })
  );
  app.use(express.json({ limit: '1mb' }));

  app.use('/health', healthRouter);
  app.use('/api/v1/health', healthRouter);
  app.use('/api/v1/auth', authRouter);
  app.use('/api/v1/leave-types', leaveTypesRouter);
  app.use('/api/v1/leave-balances', leaveBalancesRouter);
  app.use('/api/v1/leaves', leavesRouter);
  app.use('/api/v1/approvals', approvalsRouter);
  app.use('/api/v1/hr', hrRouter);
  app.use('/api/v1/dashboard', dashboardRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
};

