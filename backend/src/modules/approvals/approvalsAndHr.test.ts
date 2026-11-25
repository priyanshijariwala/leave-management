import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../../app';
import { prisma } from '../../config/prisma';

const app = createApp();

let ashaToken = '';
let pmToken = '';
let hrToken = '';
let casualLeaveTypeId = '';
let pmId = '';
const createdLeaveIds: string[] = [];
const createdUserIds: string[] = [];

beforeAll(async () => {
  const [ashaRes, pmRes, hrRes] = await Promise.all([
    request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'asha@leaveflow.local', password: 'Password123!' }),
    request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'pm@leaveflow.local', password: 'Password123!' }),
    request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'hr@leaveflow.local', password: 'Password123!' }),
  ]);

  ashaToken = ashaRes.body.accessToken;
  pmToken = pmRes.body.accessToken;
  hrToken = hrRes.body.accessToken;
  pmId = pmRes.body.user.id;

  const casual = await prisma.leaveType.findUniqueOrThrow({
    where: { code: 'CASUAL_LEAVE' },
  });
  casualLeaveTypeId = casual.id;
});

afterAll(async () => {
  for (const id of createdLeaveIds) {
    await prisma.approvalHistory.deleteMany({ where: { leaveRequestId: id } });
    await prisma.approvalStep.deleteMany({ where: { leaveRequestId: id } });
    await prisma.leaveRequest.deleteMany({ where: { id } });
  }
  for (const userId of createdUserIds) {
    await prisma.leaveBalance.deleteMany({ where: { userId } });
    await prisma.user.deleteMany({ where: { id: userId } });
  }
  await prisma.leaveBalance.updateMany({
    data: { used: 0, reserved: 0 },
  });
  await prisma.$disconnect();
});

describe('Approvals, HR administration, and Dashboards', () => {
  it('Employee request requires both PM and HR approvals; final approval moves reserved to used', async () => {
    const createRes = await request(app)
      .post('/api/v1/leaves')
      .set('Authorization', `Bearer ${ashaToken}`)
      .send({
        leaveTypeId: casualLeaveTypeId,
        startDate: '2026-11-26',
        endDate: '2026-11-26',
        durationType: 'FULL_DAY',
        reason: 'Full day casual leave for family event',
      });

    expect(createRes.status).toBe(201);
    const leaveId = createRes.body.id;
    createdLeaveIds.push(leaveId);

    const [pmPendingRes, hrPendingRes] = await Promise.all([
      request(app).get('/api/v1/approvals/pending').set('Authorization', `Bearer ${pmToken}`),
      request(app).get('/api/v1/approvals/pending').set('Authorization', `Bearer ${hrToken}`),
    ]);

    const pmStep = pmPendingRes.body.items.find(
      (i: { leaveRequest: { id: string } }) => i.leaveRequest.id === leaveId
    );
    const hrStep = hrPendingRes.body.items.find(
      (i: { leaveRequest: { id: string } }) => i.leaveRequest.id === leaveId
    );

    expect(pmStep).toBeDefined();
    expect(hrStep).toBeDefined();

    // Unassigned approver (PM trying to approve HR step) gets 403
    const wrongApproverRes = await request(app)
      .post(`/api/v1/approvals/${hrStep.approvalStepId}/approve`)
      .set('Authorization', `Bearer ${pmToken}`)
      .send({ comments: 'Should fail' });
    expect(wrongApproverRes.status).toBe(403);

    // PM approves first -> leave stays PENDING
    const pmApproveRes = await request(app)
      .post(`/api/v1/approvals/${pmStep.approvalStepId}/approve`)
      .set('Authorization', `Bearer ${pmToken}`)
      .send({ comments: 'PM approved' });
    expect(pmApproveRes.status).toBe(200);
    expect(pmApproveRes.body.leaveRequestStatus).toBe('PENDING');

    // Duplicate PM approval returns 409
    const dupRes = await request(app)
      .post(`/api/v1/approvals/${pmStep.approvalStepId}/approve`)
      .set('Authorization', `Bearer ${pmToken}`)
      .send({ comments: 'Duplicate' });
    expect(dupRes.status).toBe(409);

    // HR approves second -> leave becomes APPROVED, reserved moves to used
    const hrApproveRes = await request(app)
      .post(`/api/v1/approvals/${hrStep.approvalStepId}/approve`)
      .set('Authorization', `Bearer ${hrToken}`)
      .send({ comments: 'HR approved' });
    expect(hrApproveRes.status).toBe(200);
    expect(hrApproveRes.body.leaveRequestStatus).toBe('APPROVED');

    const balRes = await request(app)
      .get('/api/v1/leave-balances/my?year=2026')
      .set('Authorization', `Bearer ${ashaToken}`);
    const casual = balRes.body.items.find(
      (i: { leaveType: string }) => i.leaveType === 'CASUAL_LEAVE'
    );
    expect(casual.reserved).toBe(0);
    expect(casual.used).toBe(1);
    expect(casual.available).toBe(3);
  });

  it('Rejection by one approver rejects request, cancels other pending step, and releases reserved', async () => {
    const createRes = await request(app)
      .post('/api/v1/leaves')
      .set('Authorization', `Bearer ${ashaToken}`)
      .send({
        leaveTypeId: casualLeaveTypeId,
        startDate: '2026-12-02',
        endDate: '2026-12-02',
        durationType: 'FULL_DAY',
        reason: 'Another casual leave to test rejection',
      });
    const leaveId = createRes.body.id;
    createdLeaveIds.push(leaveId);

    const pmPendingRes = await request(app)
      .get('/api/v1/approvals/pending')
      .set('Authorization', `Bearer ${pmToken}`);
    const pmStep = pmPendingRes.body.items.find(
      (i: { leaveRequest: { id: string } }) => i.leaveRequest.id === leaveId
    );

    const rejectRes = await request(app)
      .post(`/api/v1/approvals/${pmStep.approvalStepId}/reject`)
      .set('Authorization', `Bearer ${pmToken}`)
      .send({ comments: 'Sprint deadline on Dec 2' });

    expect(rejectRes.status).toBe(200);
    expect(rejectRes.body.leaveRequestStatus).toBe('REJECTED');

    const detailRes = await request(app)
      .get(`/api/v1/leaves/${leaveId}`)
      .set('Authorization', `Bearer ${ashaToken}`);
    const hrStep = detailRes.body.approvalSteps.find(
      (s: { approverRole: string }) => s.approverRole === 'HR'
    );
    expect(hrStep.status).toBe('CANCELLED');

    const balRes = await request(app)
      .get('/api/v1/leave-balances/my?year=2026')
      .set('Authorization', `Bearer ${ashaToken}`);
    const casual = balRes.body.items.find(
      (i: { leaveType: string }) => i.leaveType === 'CASUAL_LEAVE'
    );
    expect(casual.reserved).toBe(0);
    expect(casual.used).toBe(1);
    expect(casual.available).toBe(3);
  });

  it('HR can create, list, update employees and view balances; non-HR receives 403', async () => {
    const forbiddenRes = await request(app)
      .get('/api/v1/hr/employees')
      .set('Authorization', `Bearer ${ashaToken}`);
    expect(forbiddenRes.status).toBe(403);

    const email = `neha.${Date.now()}@leaveflow.local`;
    const createEmpRes = await request(app)
      .post('/api/v1/hr/employees')
      .set('Authorization', `Bearer ${hrToken}`)
      .send({
        name: 'Neha Developer',
        email,
        password: 'Password123!',
        role: 'EMPLOYEE',
        managerId: pmId,
      });

    expect(createEmpRes.status).toBe(201);
    const newEmpId = createEmpRes.body.id;
    createdUserIds.push(newEmpId);

    const balancesRes = await request(app)
      .get(`/api/v1/hr/leave-balances?employeeId=${newEmpId}`)
      .set('Authorization', `Bearer ${hrToken}`);
    expect(balancesRes.status).toBe(200);
    expect(balancesRes.body.items).toHaveLength(4);

    const patchRes = await request(app)
      .patch(`/api/v1/hr/employees/${newEmpId}`)
      .set('Authorization', `Bearer ${hrToken}`)
      .send({ isActive: false });
    expect(patchRes.status).toBe(200);
    expect(patchRes.body.isActive).toBe(false);
  });

  it('Role dashboards enforce access and return role-appropriate data', async () => {
    const [empDash, pmDash, hrDash, forbiddenDash] = await Promise.all([
      request(app).get('/api/v1/dashboard/employee').set('Authorization', `Bearer ${ashaToken}`),
      request(app).get('/api/v1/dashboard/manager').set('Authorization', `Bearer ${pmToken}`),
      request(app).get('/api/v1/dashboard/hr').set('Authorization', `Bearer ${hrToken}`),
      request(app).get('/api/v1/dashboard/hr').set('Authorization', `Bearer ${ashaToken}`),
    ]);

    expect(empDash.status).toBe(200);
    expect(empDash.body.balanceSummary).toBeDefined();
    expect(pmDash.status).toBe(200);
    expect(pmDash.body.teamMembersCount).toBeGreaterThanOrEqual(2);
    expect(hrDash.status).toBe(200);
    expect(hrDash.body.activeEmployeesCount).toBeGreaterThanOrEqual(4);
    expect(forbiddenDash.status).toBe(403);
  });
});

