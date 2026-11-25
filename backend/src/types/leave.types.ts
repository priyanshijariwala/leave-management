import { ApprovalStatus, LeaveDurationType, LeaveRequestStatus, UserRole } from '@prisma/client';

export interface LeaveTypeWithBalance {
  id: string;
  code: string;
  name: string;
  annualAllowance: number;
  available: number;
}

export interface LeaveBalanceItem {
  leaveTypeId: string;
  leaveType: string;
  leaveTypeName: string;
  allocated: number;
  used: number;
  reserved: number;
  available: number;
}

export interface LeaveCalculationInput {
  startDate: string;
  endDate: string;
  durationType: LeaveDurationType;
  startTime?: string;
}

export interface CalculatedDuration {
  year: number;
  requestedDays: number;
  calculatedEndTime: string | null;
}

export interface LeavePreviewResult {
  requestedDays: number;
  calculatedEndTime: string | null;
  availableDays: number;
  projectedAvailableDays: number;
  maxEndDate: string | null;
  canSubmit: boolean;
}

export interface CreateLeaveInput {
  leaveTypeId: string;
  startDate: string;
  endDate: string;
  durationType: LeaveDurationType;
  startTime?: string;
  reason: string;
}

export interface CreateLeaveResult {
  id: string;
  status: LeaveRequestStatus;
  totalDays: number;
  reservedDays: number;
  approvalSteps: Array<{
    role: UserRole;
    status: ApprovalStatus;
  }>;
}

export interface MyLeavesQuery {
  page: number;
  limit: number;
  status?: LeaveRequestStatus;
  year?: number;
}

