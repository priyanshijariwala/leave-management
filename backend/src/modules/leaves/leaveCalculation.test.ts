import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../../app';
import { prisma } from '../../config/prisma';

const app = createApp();

let token = '';
let casualLeaveTypeId = '';

beforeAll(async () => {
  const loginRes = await request(app)
    .post('/api/v1/auth/login')
    .send({ email: 'asha@leaveflow.local', password: 'Password123!' });
  token = loginRes.body.accessToken;

  const casual = await prisma.leaveType.findUniqueOrThrow({
    where: { code: 'CASUAL_LEAVE' },
  });
  casualLeaveTypeId = casual.id;
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('Leave types, balances, and calculation preview', () => {
  it('GET /api/v1/leave-types returns 4 active leave types with available balances', async () => {
    const res = await request(app)
      .get('/api/v1/leave-types')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(4);
    const casual = res.body.items.find((i: { code: string }) => i.code === 'CASUAL_LEAVE');
    expect(casual.available).toBe(4);
  });

  it('GET /api/v1/leave-balances/my returns current year balances', async () => {
    const res = await request(app)
      .get('/api/v1/leave-balances/my')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.year).toBe(new Date().getUTCFullYear());
    expect(res.body.items).toHaveLength(4);
  });

  it('POST /api/v1/leaves/calculate computes same-day FULL_DAY as 1 day', async () => {
    const res = await request(app)
      .post('/api/v1/leaves/calculate')
      .set('Authorization', `Bearer ${token}`)
      .send({
        leaveTypeId: casualLeaveTypeId,
        startDate: '2026-11-26',
        endDate: '2026-11-26',
        durationType: 'FULL_DAY',
      });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      requestedDays: 1,
      calculatedEndTime: null,
      availableDays: 4,
      projectedAvailableDays: 3,
      maxEndDate: '2026-11-29',
      canSubmit: true,
    });
  });

  it('POST /api/v1/leaves/calculate computes same-day HALF_DAY as 0.5 day and +4h end time', async () => {
    const res = await request(app)
      .post('/api/v1/leaves/calculate')
      .set('Authorization', `Bearer ${token}`)
      .send({
        leaveTypeId: casualLeaveTypeId,
        startDate: '2026-11-26',
        endDate: '2026-11-26',
        durationType: 'HALF_DAY',
        startTime: '09:00',
      });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      requestedDays: 0.5,
      calculatedEndTime: '13:00',
      availableDays: 4,
      projectedAvailableDays: 3.5,
      maxEndDate: '2026-11-29',
      canSubmit: true,
    });
  });

  it('POST /api/v1/leaves/calculate counts inclusive calendar days for multi-day FULL_DAY', async () => {
    const res = await request(app)
      .post('/api/v1/leaves/calculate')
      .set('Authorization', `Bearer ${token}`)
      .send({
        leaveTypeId: casualLeaveTypeId,
        startDate: '2026-11-10',
        endDate: '2026-11-12',
        durationType: 'FULL_DAY',
      });

    expect(res.status).toBe(200);
    expect(res.body.requestedDays).toBe(3);
    expect(res.body.projectedAvailableDays).toBe(1);
    expect(res.body.canSubmit).toBe(true);
  });

  it('POST /api/v1/leaves/calculate sets canSubmit=false when balance is insufficient', async () => {
    const res = await request(app)
      .post('/api/v1/leaves/calculate')
      .set('Authorization', `Bearer ${token}`)
      .send({
        leaveTypeId: casualLeaveTypeId,
        startDate: '2026-11-10',
        endDate: '2026-11-15',
        durationType: 'FULL_DAY',
      });

    expect(res.status).toBe(200);
    expect(res.body.requestedDays).toBe(6);
    expect(res.body.projectedAvailableDays).toBe(-2);
    expect(res.body.canSubmit).toBe(false);
  });

  it('POST /api/v1/leaves/calculate rejects multi-day HALF_DAY with 422', async () => {
    const res = await request(app)
      .post('/api/v1/leaves/calculate')
      .set('Authorization', `Bearer ${token}`)
      .send({
        leaveTypeId: casualLeaveTypeId,
        startDate: '2026-11-10',
        endDate: '2026-11-11',
        durationType: 'HALF_DAY',
        startTime: '09:00',
      });

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('MULTI_DAY_HALF_DAY_NOT_ALLOWED');
  });

  it('POST /api/v1/leaves/calculate rejects cross-year requests with 422', async () => {
    const res = await request(app)
      .post('/api/v1/leaves/calculate')
      .set('Authorization', `Bearer ${token}`)
      .send({
        leaveTypeId: casualLeaveTypeId,
        startDate: '2026-12-30',
        endDate: '2027-01-02',
        durationType: 'FULL_DAY',
      });

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('CROSS_YEAR_LEAVE_NOT_SUPPORTED');
  });

  it('POST /api/v1/leaves/calculate rejects invalid date range with 422', async () => {
    const res = await request(app)
      .post('/api/v1/leaves/calculate')
      .set('Authorization', `Bearer ${token}`)
      .send({
        leaveTypeId: casualLeaveTypeId,
        startDate: '2026-11-12',
        endDate: '2026-11-10',
        durationType: 'FULL_DAY',
      });

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('INVALID_DATE_RANGE');
  });

  it('POST /api/v1/leaves/calculate rejects half-day startTime after 20:00 with 422', async () => {
    const res = await request(app)
      .post('/api/v1/leaves/calculate')
      .set('Authorization', `Bearer ${token}`)
      .send({
        leaveTypeId: casualLeaveTypeId,
        startDate: '2026-11-26',
        endDate: '2026-11-26',
        durationType: 'HALF_DAY',
        startTime: '21:00',
      });

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('INVALID_HALF_DAY_TIME');
  });
});

