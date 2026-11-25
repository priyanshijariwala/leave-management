import { ApprovalStatus, LeaveRequestStatus, Prisma } from '@prisma/client';
import { prisma } from '../../config/prisma';
import { ApprovalDecisionInput, PendingApprovalsQuery } from '../../types/approval.types';
import { ConflictError, ForbiddenError, NotFoundError } from '../../utils/appError';

export const getPendingApprovals = async (approverId: string, query: PendingApprovalsQuery) => {
  const leaveRequestWhere: Prisma.LeaveRequestWhereInput = {
    ...(query.employeeId ? { employeeId: query.employeeId } : {}),
    ...(query.leaveTypeId ? { leaveTypeId: query.leaveTypeId } : {}),
    ...(query.startDate ? { endDate: { gte: new Date(`${query.startDate}T00:00:00.000Z`) } } : {}),
    ...(query.endDate ? { startDate: { lte: new Date(`${query.endDate}T00:00:00.000Z`) } } : {}),
  };

  const where: Prisma.ApprovalStepWhereInput = {
    approverId,
    status: ApprovalStatus.PENDING,
    leaveRequest: leaveRequestWhere,
  };

  const skip = (query.page - 1) * query.limit;

  const [total, steps] = await Promise.all([
    prisma.approvalStep.count({ where }),
    prisma.approvalStep.findMany({
      where,
      skip,
      take: query.limit,
      orderBy: { createdAt: 'desc' },
      include: {
        leaveRequest: {
          include: {
            employee: { select: { id: true, name: true, email: true, role: true } },
            leaveType: { select: { id: true, code: true, name: true } },
            approvalSteps: {
              select: {
                id: true,
                approverRole: true,
                status: true,
                actionAt: true,
              },
            },
          },
        },
      },
    }),
  ]);

  return {
    items: steps.map((step) => ({
      approvalStepId: step.id,
      approverRole: step.approverRole,
      status: step.status,
      createdAt: step.createdAt,
      leaveRequest: {
        id: step.leaveRequest.id,
        startDate: step.leaveRequest.startDate.toISOString().slice(0, 10),
        endDate: step.leaveRequest.endDate.toISOString().slice(0, 10),
        durationType: step.leaveRequest.durationType,
        startTime: step.leaveRequest.startTime,
        endTime: step.leaveRequest.endTime,
        totalDays: Number(step.leaveRequest.totalDays),
        reason: step.leaveRequest.reason,
        status: step.leaveRequest.status,
        createdAt: step.leaveRequest.createdAt,
        employee: step.leaveRequest.employee,
        leaveType: step.leaveRequest.leaveType,
        approvalSteps: step.leaveRequest.approvalSteps,
      },
    })),
    pagination: {
      page: query.page,
      limit: query.limit,
      total,
      totalPages: Math.ceil(total / query.limit),
    },
  };
};

export const getApprovalStepDetail = async (approvalStepId: string, approverId: string) => {
  const step = await prisma.approvalStep.findUnique({
    where: { id: approvalStepId },
    include: {
      leaveRequest: {
        include: {
          employee: { select: { id: true, name: true, email: true, role: true } },
          leaveType: { select: { id: true, code: true, name: true } },
          approvalSteps: {
            include: {
              approver: { select: { id: true, name: true, role: true } },
            },
            orderBy: { createdAt: 'asc' },
          },
          history: {
            include: {
              actor: { select: { id: true, name: true, role: true } },
            },
            orderBy: { createdAt: 'asc' },
          },
        },
      },
    },
  });

  if (!step) {
    throw new NotFoundError('Approval step not found', 'APPROVAL_STEP_NOT_FOUND');
  }

  if (step.approverId !== approverId) {
    throw new ForbiddenError('You are not assigned to this approval step');
  }

  const leaveYear = step.leaveRequest.startDate.getUTCFullYear();
  const balance = await prisma.leaveBalance.findUnique({
    where: {
      userId_leaveTypeId_year: {
        userId: step.leaveRequest.employeeId,
        leaveTypeId: step.leaveRequest.leaveTypeId,
        year: leaveYear,
      },
    },
  });

  const balanceContext = balance
    ? {
        allocated: Number(balance.allocated),
        used: Number(balance.used),
        reserved: Number(balance.reserved),
        available: Number(
          (Number(balance.allocated) - Number(balance.used) - Number(balance.reserved)).toFixed(2)
        ),
      }
    : null;

  return {
    approvalStepId: step.id,
    approverRole: step.approverRole,
    status: step.status,
    comments: step.comments,
    actionAt: step.actionAt,
    balanceContext,
    leaveRequest: {
      ...step.leaveRequest,
      totalDays: Number(step.leaveRequest.totalDays),
      startDate: step.leaveRequest.startDate.toISOString().slice(0, 10),
      endDate: step.leaveRequest.endDate.toISOString().slice(0, 10),
    },
  };
};

export const approveStep = async (
  approvalStepId: string,
  approverId: string,
  input: ApprovalDecisionInput
) => {
  return prisma.$transaction(async (tx) => {
    const existingStep = await tx.approvalStep.findUnique({
      where: { id: approvalStepId },
      include: { leaveRequest: true },
    });

    if (!existingStep) {
      throw new NotFoundError('Approval step not found', 'APPROVAL_STEP_NOT_FOUND');
    }

    if (existingStep.approverId !== approverId) {
      throw new ForbiddenError('You are not assigned to this approval step');
    }

    // Lock parent leave request row so concurrent PM & HR approvals serialize cleanly
    await tx.$queryRaw`
      SELECT id FROM leave_requests WHERE id = ${existingStep.leaveRequestId}::uuid FOR UPDATE
    `;

    const updated = await tx.approvalStep.updateMany({
      where: {
        id: approvalStepId,
        approverId,
        status: ApprovalStatus.PENDING,
      },
      data: {
        status: ApprovalStatus.APPROVED,
        comments: input.comments ?? null,
        actionAt: new Date(),
      },
    });

    if (updated.count === 0) {
      throw new ConflictError(
        `Approval step is already ${existingStep.status}`,
        'APPROVAL_ALREADY_ACTIONED'
      );
    }

    await tx.approvalHistory.create({
      data: {
        leaveRequestId: existingStep.leaveRequestId,
        actorId: approverId,
        action: 'APPROVED',
        comments: input.comments ?? null,
      },
    });

    const remainingPendingSteps = await tx.approvalStep.count({
      where: {
        leaveRequestId: existingStep.leaveRequestId,
        status: ApprovalStatus.PENDING,
      },
    });

    let finalStatus: LeaveRequestStatus = LeaveRequestStatus.PENDING;

    if (remainingPendingSteps === 0) {
      finalStatus = LeaveRequestStatus.APPROVED;
      await tx.leaveRequest.update({
        where: { id: existingStep.leaveRequestId },
        data: { status: LeaveRequestStatus.APPROVED },
      });

      const leaveYear = existingStep.leaveRequest.startDate.getUTCFullYear();
      await tx.leaveBalance.update({
        where: {
          userId_leaveTypeId_year: {
            userId: existingStep.leaveRequest.employeeId,
            leaveTypeId: existingStep.leaveRequest.leaveTypeId,
            year: leaveYear,
          },
        },
        data: {
          reserved: { decrement: existingStep.leaveRequest.totalDays },
          used: { increment: existingStep.leaveRequest.totalDays },
        },
      });
    }

    return {
      approvalStepId,
      stepStatus: ApprovalStatus.APPROVED,
      leaveRequestId: existingStep.leaveRequestId,
      leaveRequestStatus: finalStatus,
    };
  });
};

export const rejectStep = async (
  approvalStepId: string,
  approverId: string,
  input: ApprovalDecisionInput
) => {
  return prisma.$transaction(async (tx) => {
    const existingStep = await tx.approvalStep.findUnique({
      where: { id: approvalStepId },
      include: { leaveRequest: true },
    });

    if (!existingStep) {
      throw new NotFoundError('Approval step not found', 'APPROVAL_STEP_NOT_FOUND');
    }

    if (existingStep.approverId !== approverId) {
      throw new ForbiddenError('You are not assigned to this approval step');
    }

    // Lock parent leave request row
    await tx.$queryRaw`
      SELECT id FROM leave_requests WHERE id = ${existingStep.leaveRequestId}::uuid FOR UPDATE
    `;

    const updated = await tx.approvalStep.updateMany({
      where: {
        id: approvalStepId,
        approverId,
        status: ApprovalStatus.PENDING,
      },
      data: {
        status: ApprovalStatus.REJECTED,
        comments: input.comments ?? null,
        actionAt: new Date(),
      },
    });

    if (updated.count === 0) {
      throw new ConflictError(
        `Approval step is already ${existingStep.status}`,
        'APPROVAL_ALREADY_ACTIONED'
      );
    }

    // Reject the leave request and cancel any other pending approval steps
    await tx.leaveRequest.update({
      where: { id: existingStep.leaveRequestId },
      data: { status: LeaveRequestStatus.REJECTED },
    });

    await tx.approvalStep.updateMany({
      where: {
        leaveRequestId: existingStep.leaveRequestId,
        status: ApprovalStatus.PENDING,
      },
      data: { status: ApprovalStatus.CANCELLED },
    });

    const leaveYear = existingStep.leaveRequest.startDate.getUTCFullYear();
    await tx.leaveBalance.update({
      where: {
        userId_leaveTypeId_year: {
          userId: existingStep.leaveRequest.employeeId,
          leaveTypeId: existingStep.leaveRequest.leaveTypeId,
          year: leaveYear,
        },
      },
      data: {
        reserved: { decrement: existingStep.leaveRequest.totalDays },
      },
    });

    await tx.approvalHistory.create({
      data: {
        leaveRequestId: existingStep.leaveRequestId,
        actorId: approverId,
        action: 'REJECTED',
        comments: input.comments ?? null,
      },
    });

    return {
      approvalStepId,
      stepStatus: ApprovalStatus.REJECTED,
      leaveRequestId: existingStep.leaveRequestId,
      leaveRequestStatus: LeaveRequestStatus.REJECTED,
    };
  });
};

