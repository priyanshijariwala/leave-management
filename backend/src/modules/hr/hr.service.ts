import { LeaveRequestStatus, Prisma, UserRole } from '@prisma/client';
import bcrypt from 'bcrypt';
import { prisma } from '../../config/prisma';
import {
  CreateEmployeeInput,
  HrBalancesQuery,
  ListEmployeesQuery,
  UpdateEmployeeInput,
} from '../../types/hr.types';
import {
  ConflictError,
  NotFoundError,
  UnprocessableEntityError,
} from '../../utils/appError';

export const listEmployees = async (query: ListEmployeesQuery) => {
  const where: Prisma.UserWhereInput = {
    ...(query.role ? { role: query.role } : {}),
    ...(query.isActive !== undefined ? { isActive: query.isActive } : {}),
    ...(query.search
      ? {
          OR: [
            { name: { contains: query.search, mode: 'insensitive' } },
            { email: { contains: query.search, mode: 'insensitive' } },
          ],
        }
      : {}),
  };

  const skip = (query.page - 1) * query.limit;

  const [total, users] = await Promise.all([
    prisma.user.count({ where }),
    prisma.user.findMany({
      where,
      skip,
      take: query.limit,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        managerId: true,
        isActive: true,
        createdAt: true,
        manager: { select: { id: true, name: true, email: true } },
      },
    }),
  ]);

  return {
    items: users,
    pagination: {
      page: query.page,
      limit: query.limit,
      total,
      totalPages: Math.ceil(total / query.limit),
    },
  };
};

export const createEmployee = async (input: CreateEmployeeInput) => {
  const existing = await prisma.user.findUnique({
    where: { email: input.email },
  });

  if (existing) {
    throw new ConflictError('An account with this email already exists', 'EMAIL_ALREADY_EXISTS');
  }

  if (input.role === UserRole.EMPLOYEE && !input.managerId) {
    throw new UnprocessableEntityError(
      'An employee must be assigned a project manager',
      'MANAGER_REQUIRED'
    );
  }

  if (input.managerId) {
    const manager = await prisma.user.findFirst({
      where: {
        id: input.managerId,
        role: UserRole.PROJECT_MANAGER,
        isActive: true,
      },
    });
    if (!manager) {
      throw new UnprocessableEntityError(
        'Assigned manager must be an active Project Manager',
        'INVALID_MANAGER'
      );
    }
  }

  const passwordHash = await bcrypt.hash(input.password, 10);
  const currentYear = new Date().getUTCFullYear();

  return prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        name: input.name,
        email: input.email,
        passwordHash,
        role: input.role,
        managerId: input.managerId ?? null,
        isActive: input.isActive ?? true,
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        managerId: true,
        isActive: true,
        createdAt: true,
      },
    });

    const leaveTypes = await tx.leaveType.findMany({
      where: { isActive: true },
    });

    if (leaveTypes.length > 0) {
      await tx.leaveBalance.createMany({
        data: leaveTypes.map((lt) => ({
          userId: user.id,
          leaveTypeId: lt.id,
          year: currentYear,
          allocated: lt.annualAllowance,
          used: 0,
          reserved: 0,
        })),
      });
    }

    return user;
  });
};

export const updateEmployee = async (id: string, input: UpdateEmployeeInput) => {
  const existing = await prisma.user.findUnique({ where: { id } });
  if (!existing) {
    throw new NotFoundError('Employee not found', 'EMPLOYEE_NOT_FOUND');
  }

  if (input.managerId) {
    if (input.managerId === id) {
      throw new UnprocessableEntityError('User cannot be their own manager', 'INVALID_MANAGER');
    }
    const manager = await prisma.user.findFirst({
      where: {
        id: input.managerId,
        role: UserRole.PROJECT_MANAGER,
        isActive: true,
      },
    });
    if (!manager) {
      throw new UnprocessableEntityError(
        'Assigned manager must be an active Project Manager',
        'INVALID_MANAGER'
      );
    }
  }

  return prisma.user.update({
    where: { id },
    data: {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.role !== undefined ? { role: input.role } : {}),
      ...(input.managerId !== undefined ? { managerId: input.managerId } : {}),
      ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
    },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      managerId: true,
      isActive: true,
      updatedAt: true,
    },
  });
};

export const getEmployeeBalances = async (query: HrBalancesQuery) => {
  const targetYear = query.year ?? new Date().getUTCFullYear();
  const where: Prisma.LeaveBalanceWhereInput = {
    year: targetYear,
    ...(query.employeeId ? { userId: query.employeeId } : {}),
  };

  const skip = (query.page - 1) * query.limit;

  const [total, balances] = await Promise.all([
    prisma.leaveBalance.count({ where }),
    prisma.leaveBalance.findMany({
      where,
      skip,
      take: query.limit,
      orderBy: [{ user: { name: 'asc' } }, { leaveType: { name: 'asc' } }],
      include: {
        user: { select: { id: true, name: true, email: true, role: true, isActive: true } },
        leaveType: { select: { id: true, code: true, name: true } },
      },
    }),
  ]);

  return {
    year: targetYear,
    items: balances.map((b) => {
      const allocated = Number(b.allocated);
      const used = Number(b.used);
      const reserved = Number(b.reserved);
      return {
        id: b.id,
        user: b.user,
        leaveType: b.leaveType,
        allocated,
        used,
        reserved,
        available: Number((allocated - used - reserved).toFixed(2)),
      };
    }),
    pagination: {
      page: query.page,
      limit: query.limit,
      total,
      totalPages: Math.ceil(total / query.limit),
    },
  };
};

export const listAllLeaveRequests = async (
  page: number,
  limit: number,
  status?: LeaveRequestStatus
) => {
  const where: Prisma.LeaveRequestWhereInput = {
    ...(status ? { status } : {}),
  };
  const skip = (page - 1) * limit;

  const [total, requests] = await Promise.all([
    prisma.leaveRequest.count({ where }),
    prisma.leaveRequest.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        employee: { select: { id: true, name: true, email: true, role: true } },
        leaveType: { select: { id: true, code: true, name: true } },
        approvalSteps: {
          select: {
            id: true,
            approverId: true,
            approverRole: true,
            status: true,
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
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
};

