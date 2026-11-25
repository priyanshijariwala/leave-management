import { LeaveDurationType } from '@prisma/client';

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

