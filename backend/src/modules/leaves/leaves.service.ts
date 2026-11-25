import { ApprovalStatus, LeaveRequestStatus, Prisma, UserRole } from '@prisma/client';
import { prisma } from '../../config/prisma';
import { AuthUser } from '../../types/auth.types';
import { CreateLeaveInput, CreateLeaveResult, MyLeavesQuery } from '../../types/leave.types';
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  UnprocessableEntityError,
} from '../../utils/appError';
import { calculateLeaveDuration } from './leaveCalculation.service';

export const createLeaveRequest = async (
  user: AuthUser,
  input: CreateLeaveInput
): Promise<CreateLeaveResult> => {
  const { year, requestedDays, calculatedEndTime } = calculateLeaveDuration(input);

  const leaveType = await prisma.leaveType.findFirst({
    where: { id: input.leaveTypeId, isActive: true },
  });
  if (!leaveType) {
    throw new NotFoundError('Leave type not found', 'LEAVE_TYPE_NOT_FOUND');
  }

  const startDateObj = new Date(`${input.startDate}T00:00:00.000Z`);
  const endDateObj = new Date(`${input.endDate}T00:00:00.000Z`);

  return prisma.$transaction(async (tx) => {
    // Lock the employee row to serialize concurrent submissions for the same user
    await tx.$queryRaw`SELECT id FROM users WHERE id = ${user.id}::uuid FOR UPDATE`;

    // Check overlapping PENDING or APPROVED requests
    const overlapping = await tx.leaveRequest.findFirst({
      where: {
        employeeId: user.id,
        status: { in: [LeaveRequestStatus.PENDING, LeaveRequestStatus.APPROVED] },
        startDate: { lte: endDateObj },
        endDate: { gte: startDateObj },
      },
    });

    if (overlapping) {
      throw new ConflictError(
        'You already have an active leave request overlapping these dates',
        'OVERLAPPING_LEAVE_REQUEST'
      );
    }

    // Atomically reserve balance only if enough available days exist
    const updatedBalances = await tx.$queryRaw<Array<{ id: string }>>`
      UPDATE leave_balances
      SET reserved = reserved + ${requestedDays}::decimal,
          updated_at = NOW()
      WHERE user_id = ${user.id}::uuid
        AND leave_type_id = ${input.leaveTypeId}::uuid
        AND year = ${year}
        AND allocated - used - reserved >= ${requestedDays}::decimal
      RETURNING id
    `;

    if (updatedBalances.length === 0) {
      const balance = await tx.leaveBalance.findUnique({
        where: {
          userId_leaveTypeId_year: {
            userId: user.id,
            leaveTypeId: input.leaveTypeId,
            year,
          },
        },
      });

      const availableDays = balance
        ? Number(
            (Number(balance.allocated) - Number(balance.used) - Number(balance.reserved)).toFixed(2)
          )
        : 0;

      throw new UnprocessableEntityError(
        `You have ${availableDays} days available, but this request needs ${requestedDays} days.`,
        'INSUFFICIENT_LEAVE_BALANCE',
        { availableDays, requestedDays }
      );
    }

    // Determine required approvers
    const hrApprover = await tx.user.findFirst({
      where: { role: UserRole.HR, isActive: true },
      orderBy: { createdAt: 'asc' },
    });

    if (!hrApprover) {
      throw new UnprocessableEntityError(
        'No active HR approver is configured',
        'APPROVER_NOT_CONFIGURED'
      );
    }

    const stepsToCreate: Array<{ approverId: string; approverRole: UserRole }> = [];

    if (user.role === UserRole.EMPLOYEE) {
      if (!user.managerId) {
        throw new UnprocessableEntityError(
          'No project manager is assigned to your account',
          'MANAGER_NOT_ASSIGNED'
        );
      }

      const manager = await tx.user.findFirst({
        where: { id: user.managerId, isActive: true },
      });

      if (!manager) {
        throw new UnprocessableEntityError(
          'Assigned project manager is inactive or not found',
          'MANAGER_NOT_ASSIGNED'
        );
      }

      stepsToCreate.push({
        approverId: manager.id,
        approverRole: UserRole.PROJECT_MANAGER,
      });
      stepsToCreate.push({
        approverId: hrApprover.id,
        approverRole: UserRole.HR,
      });
    } else {
      // Project Manager leave routes directly to HR only
      stepsToCreate.push({
        approverId: hrApprover.id,
        approverRole: UserRole.HR,
      });
    }

    const createdRequest = await tx.leaveRequest.create({
      data: {
        employeeId: user.id,
        leaveTypeId: input.leaveTypeId,
        startDate: startDateObj,
        endDate: endDateObj,
        durationType: input.durationType,
        startTime: input.durationType === 'HALF_DAY' ? input.startTime ?? null : null,
        endTime: calculatedEndTime,
        totalDays: new Prisma.Decimal(requestedDays),
        reason: input.reason,
        status: LeaveRequestStatus.PENDING,
        approvalSteps: {
          create: stepsToCreate.map((step) => ({
            approverId: step.approverId,
            approverRole: step.approverRole,
            status: ApprovalStatus.PENDING,
          })),
        },
        history: {
          create: {
            actorId: user.id,
            action: 'REQUEST_SUBMITTED',
            comments: input.reason,
          },
        },
      },
      include: {
        approvalSteps: {
          select: {
            approverRole: true,
            status: true,
          },
        },
      },
    });

    return {
      id: createdRequest.id,
      status: createdRequest.status,
      totalDays: Number(createdRequest.totalDays),
      reservedDays: Number(createdRequest.totalDays),
      approvalSteps: createdRequest.approvalSteps.map((step) => ({
        role: step.approverRole,
        status: step.status,
      })),
    };
  });
};

export const getMyLeaveRequests = async (userId: string, query: MyLeavesQuery) => {
  const where: Prisma.LeaveRequestWhereInput = {
    employeeId: userId,
    ...(query.status ? { status: query.status } : {}),
    ...(query.year
      ? {
          startDate: {
            gte: new Date(`${query.year}-01-01T00:00:00.000Z`),
            lte: new Date(`${query.year}-12-31T00:00:00.000Z`),
          },
        }
      : {}),
  };

  const skip = (query.page - 1) * query.limit;

  const [total, requests] = await Promise.all([
    prisma.leaveRequest.count({ where }),
    prisma.leaveRequest.findMany({
      where,
      skip,
      take: query.limit,
      orderBy: { createdAt: 'desc' },
      include: {
        leaveType: { select: { id: true, code: true, name: true } },
        approvalSteps: {
          select: {
            id: true,
            approverRole: true,
            status: true,
            comments: true,
            actionAt: true,
          },
        },
      },
    }),
  ]);

  return {
    items: requests.map((req) => ({
      ...req,
      totalDays: Number(req.totalDays),
      startDate: req.startDate.toISOString().slice(0, 10),
      endDate: req.endDate.toISOString().slice(0, 10),
    })),
    pagination: {
      page: query.page,
      limit: query.limit,
      total,
      totalPages: Math.ceil(total / query.limit),
    },
  };
};

const getAuthorizedLeaveRequest = async (leaveId: string, user: AuthUser) => {
  const leaveRequest = await prisma.leaveRequest.findUnique({
    where: { id: leaveId },
    include: {
      employee: { select: { id: true, name: true, email: true, role: true } },
      leaveType: { select: { id: true, code: true, name: true } },
      approvalSteps: {
        include: {
          approver: { select: { id: true, name: true, email: true, role: true } },
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
  });

  if (!leaveRequest) {
    throw new NotFoundError('Leave request not found', 'LEAVE_REQUEST_NOT_FOUND');
  }

  const isOwner = leaveRequest.employeeId === user.id;
  const isHr = user.role === UserRole.HR;
  const isAssignedApprover = leaveRequest.approvalSteps.some((s) => s.approverId === user.id);

  if (!isOwner && !isHr && !isAssignedApprover) {
    throw new ForbiddenError('You do not have permission to view this leave request');
  }

  return leaveRequest;
};

export const getLeaveRequestById = async (leaveId: string, user: AuthUser) => {
  const leaveRequest = await getAuthorizedLeaveRequest(leaveId, user);
  return {
    ...leaveRequest,
    totalDays: Number(leaveRequest.totalDays),
    startDate: leaveRequest.startDate.toISOString().slice(0, 10),
    endDate: leaveRequest.endDate.toISOString().slice(0, 10),
  };
};

export const getLeaveRequestHistory = async (leaveId: string, user: AuthUser) => {
  const leaveRequest = await getAuthorizedLeaveRequest(leaveId, user);
  return {
    leaveRequestId: leaveRequest.id,
    items: leaveRequest.history,
  };
};

export const cancelLeaveRequest = async (leaveId: string, user: AuthUser) => {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.leaveRequest.findUnique({
      where: { id: leaveId },
    });

    if (!existing) {
      throw new NotFoundError('Leave request not found', 'LEAVE_REQUEST_NOT_FOUND');
    }

    if (existing.employeeId !== user.id) {
      throw new ForbiddenError('You can only cancel your own leave requests');
    }

    // Conditionally transition PENDING -> CANCELLED to prevent double release
    const updated = await tx.leaveRequest.updateMany({
      where: { id: leaveId, status: LeaveRequestStatus.PENDING },
      data: { status: LeaveRequestStatus.CANCELLED },
    });

    if (updated.count === 0) {
      throw new ConflictError(
        `Cannot cancel a leave request with status ${existing.status}`,
        'REQUEST_NOT_CANCELLABLE'
      );
    }

    await tx.approvalStep.updateMany({
      where: { leaveRequestId: leaveId, status: ApprovalStatus.PENDING },
      data: { status: ApprovalStatus.CANCELLED },
    });

    const leaveYear = existing.startDate.getUTCFullYear();
    await tx.leaveBalance.update({
      where: {
        userId_leaveTypeId_year: {
          userId: existing.employeeId,
          leaveTypeId: existing.leaveTypeId,
          year: leaveYear,
        },
      },
      data: {
        reserved: { decrement: existing.totalDays },
      },
    });

    await tx.approvalHistory.create({
      data: {
        leaveRequestId: leaveId,
        actorId: user.id,
        action: 'CANCELLED',
        comments: 'Cancelled by employee',
      },
    });

    return {
      id: leaveId,
      status: LeaveRequestStatus.CANCELLED,
      releasedDays: Number(existing.totalDays),
    };
  });
};

