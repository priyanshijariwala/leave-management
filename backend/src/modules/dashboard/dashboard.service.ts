import { ApprovalStatus, LeaveRequestStatus } from '@prisma/client';
import { prisma } from '../../config/prisma';

export const getEmployeeDashboard = async (userId: string) => {
  const currentYear = new Date().getUTCFullYear();

  const [balances, statusGroups, recentRequests] = await Promise.all([
    prisma.leaveBalance.findMany({
      where: { userId, year: currentYear },
    }),
    prisma.leaveRequest.groupBy({
      by: ['status'],
      where: { employeeId: userId },
      _count: { status: true },
    }),
    prisma.leaveRequest.findMany({
      where: { employeeId: userId },
      take: 5,
      orderBy: { createdAt: 'desc' },
      include: {
        leaveType: { select: { id: true, code: true, name: true } },
        approvalSteps: {
          select: { approverRole: true, status: true, actionAt: true },
        },
      },
    }),
  ]);

  const summary = balances.reduce(
    (acc, b) => {
      acc.allocated += Number(b.allocated);
      acc.used += Number(b.used);
      acc.reserved += Number(b.reserved);
      return acc;
    },
    { allocated: 0, used: 0, reserved: 0 }
  );

  const counts = { pending: 0, approved: 0, rejected: 0, cancelled: 0 };
  for (const group of statusGroups) {
    if (group.status === LeaveRequestStatus.PENDING) counts.pending = group._count.status;
    if (group.status === LeaveRequestStatus.APPROVED) counts.approved = group._count.status;
    if (group.status === LeaveRequestStatus.REJECTED) counts.rejected = group._count.status;
    if (group.status === LeaveRequestStatus.CANCELLED) counts.cancelled = group._count.status;
  }

  return {
    year: currentYear,
    balanceSummary: {
      allocated: Number(summary.allocated.toFixed(2)),
      used: Number(summary.used.toFixed(2)),
      reserved: Number(summary.reserved.toFixed(2)),
      available: Number((summary.allocated - summary.used - summary.reserved).toFixed(2)),
    },
    requestCounts: counts,
    recentRequests: recentRequests.map((req) => ({
      ...req,
      totalDays: Number(req.totalDays),
      startDate: req.startDate.toISOString().slice(0, 10),
      endDate: req.endDate.toISOString().slice(0, 10),
    })),
  };
};

export const getManagerDashboard = async (managerId: string) => {
  const [pendingCount, teamCount, recentDecisions, pendingSteps] = await Promise.all([
    prisma.approvalStep.count({
      where: { approverId: managerId, status: ApprovalStatus.PENDING },
    }),
    prisma.user.count({
      where: { managerId, isActive: true },
    }),
    prisma.approvalStep.findMany({
      where: {
        approverId: managerId,
        status: { in: [ApprovalStatus.APPROVED, ApprovalStatus.REJECTED] },
      },
      take: 10,
      orderBy: { actionAt: 'desc' },
      include: {
        leaveRequest: {
          include: {
            employee: { select: { id: true, name: true, email: true } },
            leaveType: { select: { id: true, code: true, name: true } },
          },
        },
      },
    }),
    prisma.approvalStep.findMany({
      where: { approverId: managerId, status: ApprovalStatus.PENDING },
      take: 10,
      orderBy: { createdAt: 'desc' },
      include: {
        leaveRequest: {
          include: {
            employee: { select: { id: true, name: true, email: true } },
            leaveType: { select: { id: true, code: true, name: true } },
          },
        },
      },
    }),
  ]);

  return {
    pendingApprovalsCount: pendingCount,
    teamMembersCount: teamCount,
    pendingApprovals: pendingSteps.map((s) => ({
      approvalStepId: s.id,
      leaveRequest: {
        ...s.leaveRequest,
        totalDays: Number(s.leaveRequest.totalDays),
        startDate: s.leaveRequest.startDate.toISOString().slice(0, 10),
        endDate: s.leaveRequest.endDate.toISOString().slice(0, 10),
      },
    })),
    recentDecisions: recentDecisions.map((s) => ({
      approvalStepId: s.id,
      status: s.status,
      actionAt: s.actionAt,
      comments: s.comments,
      leaveRequest: {
        ...s.leaveRequest,
        totalDays: Number(s.leaveRequest.totalDays),
        startDate: s.leaveRequest.startDate.toISOString().slice(0, 10),
        endDate: s.leaveRequest.endDate.toISOString().slice(0, 10),
      },
    })),
  };
};

export const getHrDashboard = async (hrUserId: string) => {
  const [pendingApprovalsCount, activeEmployeesCount, statusGroups, recentRequests] =
    await Promise.all([
      prisma.approvalStep.count({
        where: { approverId: hrUserId, status: ApprovalStatus.PENDING },
      }),
      prisma.user.count({
        where: { isActive: true },
      }),
      prisma.leaveRequest.groupBy({
        by: ['status'],
        _count: { status: true },
      }),
      prisma.leaveRequest.findMany({
        take: 10,
        orderBy: { createdAt: 'desc' },
        include: {
          employee: { select: { id: true, name: true, email: true, role: true } },
          leaveType: { select: { id: true, code: true, name: true } },
          approvalSteps: {
            select: { approverRole: true, status: true },
          },
        },
      }),
    ]);

  const requestCounts = { pending: 0, approved: 0, rejected: 0, cancelled: 0 };
  for (const group of statusGroups) {
    if (group.status === LeaveRequestStatus.PENDING) requestCounts.pending = group._count.status;
    if (group.status === LeaveRequestStatus.APPROVED) requestCounts.approved = group._count.status;
    if (group.status === LeaveRequestStatus.REJECTED) requestCounts.rejected = group._count.status;
    if (group.status === LeaveRequestStatus.CANCELLED) requestCounts.cancelled = group._count.status;
  }

  return {
    pendingApprovalsCount,
    activeEmployeesCount,
    requestCounts,
    recentRequests: recentRequests.map((req) => ({
      ...req,
      totalDays: Number(req.totalDays),
      startDate: req.startDate.toISOString().slice(0, 10),
      endDate: req.endDate.toISOString().slice(0, 10),
    })),
  };
};

