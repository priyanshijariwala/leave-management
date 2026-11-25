import express from 'express';
import request from 'supertest';
import { afterAll, describe, expect, it } from 'vitest';
import { createApp } from '../../app';
import { prisma } from '../../config/prisma';
import { authenticate, authorize } from '../../middleware/auth';
import { errorHandler } from '../../middleware/errorHandler';

const app = createApp();

const rbacTestApp = express();
rbacTestApp.get('/hr-only', authenticate, authorize('HR'), (_req, res) => {
  res.status(200).json({ ok: true });
});
rbacTestApp.use(errorHandler);

afterAll(async () => {
  await prisma.$disconnect();
});

describe('Auth endpoints & RBAC middleware', () => {
  it('POST /api/v1/auth/login returns token and user for valid credentials', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'asha@leaveflow.local', password: 'Password123!' });

    expect(res.status).toBe(200);
    expect(res.body.accessToken).toBeTypeOf('string');
    expect(res.body.user).toMatchObject({
      email: 'asha@leaveflow.local',
      role: 'EMPLOYEE',
    });
  });

  it('POST /api/v1/auth/login returns 401 for wrong password', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'asha@leaveflow.local', password: 'WrongPassword!' });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
  });

  it('GET /api/v1/auth/me returns 401 when no token is provided', async () => {
    const res = await request(app).get('/api/v1/auth/me');

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it('GET /api/v1/auth/me returns authenticated user profile', async () => {
    const loginRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'pm@leaveflow.local', password: 'Password123!' });

    const res = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${loginRes.body.accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      email: 'pm@leaveflow.local',
      role: 'PROJECT_MANAGER',
      isActive: true,
    });
  });

  it('authorize middleware returns 403 when role does not match', async () => {
    const loginRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'asha@leaveflow.local', password: 'Password123!' });

    const res = await request(rbacTestApp)
      .get('/hr-only')
      .set('Authorization', `Bearer ${loginRes.body.accessToken}`);

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });
});
