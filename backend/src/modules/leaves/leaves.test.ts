import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../../app';
import { prisma } from '../../config/prisma';

const app = createApp();

let ashaToken = '';
let vikramToken = '';
let pmToken = '';
let casualLeaveTypeId = '';
const createdLeaveIds: string[] = [];

beforeAll(async () => {
  const [ashaRes, vikramRes, pmRes] = await Promise.all([
    request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'asha@leaveflow.local', password: 'Password123!' }),
    request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'vikram@leaveflow.local', password: 'Password123!' }),
    request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'pm@leaveflow.local', password: 'Password123!' }),
  ]);

  ashaToken = ashaRes.body.accessToken;
  vikramToken = vikramRes.body.accessToken;
  pmToken = pmRes.body.accessToken;

  const casual = await prisma.leaveType.findUniqueOrThrow({
    where: { code: 'CASUAL_LEAVE' },
  });
  casualLeaveTypeId = casual.id;
});

afterAll(async () => {
  // Clean up test leave requests and reset balances for test users
  for (const id of createdLeaveIds) {
    await prisma.approvalHistory.deleteMany({ where: { leaveRequestId: id } });
    await prisma.approvalStep.deleteMany({ where: { leaveRequestId: id } });
    await prisma.leaveRequest.deleteMany({ where: { id } });
  }
  await prisma.leaveBalance.updateMany({
    data: { used: 0, reserved: 0 },
  });
  await prisma.$disconnect();
});

describe('Leave submission, overlap guard, read, and cancellation', () => {
  let ashaLeaveId = '';

  it('POST /api/v1/leaves creates employee request with PM + HR steps and reserves balance', async () => {
    const res = await request(app)
      .post('/api/v1/leaves')
      .set('Authorization', `Bearer ${ashaToken}`)
      .send({
        leaveTypeId: casualLeaveTypeId,
        startDate: '2026-11-26',
        endDate: '2026-11-26',
        durationType: 'HALF_DAY',
        startTime: '09:00',
        reason: 'Personal appointment in the morning',
      });

    expect(res.status).toBe(201);
    expect(res.body.status).toBe('PENDING');
    expect(res.body.totalDays).toBe(0.5);
    expect(res.body.reservedDays).toBe(0.5);
    expect(res.body.approvalSteps).toHaveLength(2);
    expect(res.body.approvalSteps.map((s: { role: string }) => s.role).sort()).toEqual([
      'HR',
      'PROJECT_MANAGER',
    ]);

    ashaLeaveId = res.body.id;
    createdLeaveIds.push(ashaLeaveId);

    const balRes = await request(app)
      .get('/api/v1/leave-balances/my?year=2026')
      .set('Authorization', `Bearer ${ashaToken}`);
    const casualBal = balRes.body.items.find(
      (i: { leaveType: string }) => i.leaveType === 'CASUAL_LEAVE'
    );
    expect(casualBal.reserved).toBe(0.5);
    expect(casualBal.available).toBe(3.5);
  });

  it('POST /api/v1/leaves rejects overlapping active request with 409', async () => {
    const res = await request(app)
      .post('/api/v1/leaves')
      .set('Authorization', `Bearer ${ashaToken}`)
      .send({
        leaveTypeId: casualLeaveTypeId,
        startDate: '2026-11-26',
        endDate: '2026-11-26',
        durationType: 'FULL_DAY',
        reason: 'Trying to book overlapping day',
      });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('OVERLAPPING_LEAVE_REQUEST');
  });

  it('POST /api/v1/leaves rejects insufficient balance with 422', async () => {
    const res = await request(app)
      .post('/api/v1/leaves')
      .set('Authorization', `Bearer ${ashaToken}`)
      .send({
        leaveTypeId: casualLeaveTypeId,
        startDate: '2026-12-01',
        endDate: '2026-12-05',
        durationType: 'FULL_DAY',
        reason: 'Five day vacation exceeding balance',
      });

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('INSUFFICIENT_LEAVE_BALANCE');
  });

  it('GET /api/v1/leaves/my, /:id, and /:id/history work for owner and forbid other employees', async () => {
    const myRes = await request(app)
      .get('/api/v1/leaves/my')
      .set('Authorization', `Bearer ${ashaToken}`);
    expect(myRes.status).toBe(200);
    expect(myRes.body.items.some((r: { id: string }) => r.id === ashaLeaveId)).toBe(true);

    const detailRes = await request(app)
      .get(`/api/v1/leaves/${ashaLeaveId}`)
      .set('Authorization', `Bearer ${ashaToken}`);
    expect(detailRes.status).toBe(200);
    expect(detailRes.body.endTime).toBe('13:00');

    const historyRes = await request(app)
      .get(`/api/v1/leaves/${ashaLeaveId}/history`)
      .set('Authorization', `Bearer ${ashaToken}`);
    expect(historyRes.status).toBe(200);
    expect(historyRes.body.items).toHaveLength(1);
    expect(historyRes.body.items[0].action).toBe('REQUEST_SUBMITTED');

    const forbiddenRes = await request(app)
      .get(`/api/v1/leaves/${ashaLeaveId}`)
      .set('Authorization', `Bearer ${vikramToken}`);
    expect(forbiddenRes.status).toBe(403);
  });

  it('POST /api/v1/leaves/:id/cancel releases reserved balance once and rejects repeat cancel', async () => {
    const cancelRes = await request(app)
      .post(`/api/v1/leaves/${ashaLeaveId}/cancel`)
      .set('Authorization', `Bearer ${ashaToken}`);
    expect(cancelRes.status).toBe(200);
    expect(cancelRes.body.status).toBe('CANCELLED');
    expect(cancelRes.body.releasedDays).toBe(0.5);

    const balRes = await request(app)
      .get('/api/v1/leave-balances/my?year=2026')
      .set('Authorization', `Bearer ${ashaToken}`);
    const casualBal = balRes.body.items.find(
      (i: { leaveType: string }) => i.leaveType === 'CASUAL_LEAVE'
    );
    expect(casualBal.reserved).toBe(0);
    expect(casualBal.available).toBe(4);

    const repeatRes = await request(app)
      .post(`/api/v1/leaves/${ashaLeaveId}/cancel`)
      .set('Authorization', `Bearer ${ashaToken}`);
    expect(repeatRes.status).toBe(409);
    expect(repeatRes.body.error.code).toBe('REQUEST_NOT_CANCELLABLE');
  });

  it('POST /api/v1/leaves routes Project Manager request to HR only', async () => {
    const res = await request(app)
      .post('/api/v1/leaves')
      .set('Authorization', `Bearer ${pmToken}`)
      .send({
        leaveTypeId: casualLeaveTypeId,
        startDate: '2026-11-27',
        endDate: '2026-11-27',
        durationType: 'FULL_DAY',
        reason: 'Project manager personal day off',
      });

    expect(res.status).toBe(201);
    expect(res.body.approvalSteps).toEqual([{ role: 'HR', status: 'PENDING' }]);
    createdLeaveIds.push(res.body.id);
  });

  it('Concurrent submissions by the same employee cannot over-reserve balance', async () => {
    const req1 = request(app)
      .post('/api/v1/leaves')
      .set('Authorization', `Bearer ${vikramToken}`)
      .send({
        leaveTypeId: casualLeaveTypeId,
        startDate: '2026-12-01',
        endDate: '2026-12-03',
        durationType: 'FULL_DAY',
        reason: 'Concurrent request one for three days',
      });

    const req2 = request(app)
      .post('/api/v1/leaves')
      .set('Authorization', `Bearer ${vikramToken}`)
      .send({
        leaveTypeId: casualLeaveTypeId,
        startDate: '2026-12-10',
        endDate: '2026-12-12',
        durationType: 'FULL_DAY',
        reason: 'Concurrent request two for three days',
      });

    const [r1, r2] = await Promise.all([req1, req2]);
    const statuses = [r1.status, r2.status].sort();
    expect(statuses).toEqual([201, 422]);

    if (r1.status === 201) createdLeaveIds.push(r1.body.id);
    if (r2.status === 201) createdLeaveIds.push(r2.body.id);
  });
});

