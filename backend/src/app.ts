import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import swaggerUi from 'swagger-ui-express';
import { env } from './config/env';
import { swaggerSpec } from './config/swagger';
import { errorHandler } from './middleware/errorHandler';
import { notFoundHandler } from './middleware/notFound';
import { authRouter } from './modules/auth/auth.routes';
import { healthRouter } from './modules/health/health.routes';
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

  app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

  app.use('/health', healthRouter);
  app.use('/api/v1/health', healthRouter);
  app.use('/api/v1/auth', authRouter);
  app.use('/api/v1/leave-types', leaveTypesRouter);
  app.use('/api/v1/leave-balances', leaveBalancesRouter);
  app.use('/api/v1/leaves', leavesRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
};

