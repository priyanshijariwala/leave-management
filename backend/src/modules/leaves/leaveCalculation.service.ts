import { LeaveDurationType } from '@prisma/client';
import { prisma } from '../../config/prisma';
import {
  CalculatedDuration,
  LeaveCalculationInput,
  LeavePreviewResult,
} from '../../types/leave.types';
import { NotFoundError, UnprocessableEntityError } from '../../utils/appError';
import { addDaysToDate, addHoursToTime, calculateInclusiveCalendarDays } from '../../utils/dateTime';

const isValidCalendarDate = (dateStr: string): boolean => {
  const date = new Date(`${dateStr}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) {
    return false;
  }
  return date.toISOString().slice(0, 10) === dateStr;
};

const isValidHalfDayStartTime = (timeStr: string): boolean => {
  const [hourStr, minuteStr] = timeStr.split(':');
  const totalMinutes = Number(hourStr) * 60 + Number(minuteStr);
  // 00:00 through 20:00 so that +4 hours ends by 24:00 on the same day
  return totalMinutes >= 0 && totalMinutes <= 20 * 60;
};

export const calculateLeaveDuration = (input: LeaveCalculationInput): CalculatedDuration => {
  if (!isValidCalendarDate(input.startDate) || !isValidCalendarDate(input.endDate)) {
    throw new UnprocessableEntityError('Invalid start or end calendar date', 'INVALID_DATE_RANGE');
  }

  if (input.endDate < input.startDate) {
    throw new UnprocessableEntityError(
      'End date must be on or after start date',
      'INVALID_DATE_RANGE'
    );
  }

  const startYear = Number(input.startDate.slice(0, 4));
  const endYear = Number(input.endDate.slice(0, 4));
  if (startYear !== endYear) {
    throw new UnprocessableEntityError(
      'Cross-year leave requests are not supported in this version',
      'CROSS_YEAR_LEAVE_NOT_SUPPORTED'
    );
  }

  const isSameDay = input.startDate === input.endDate;

  if (isSameDay) {
    if (input.durationType === LeaveDurationType.FULL_DAY) {
      return {
        year: startYear,
        requestedDays: 1,
        calculatedEndTime: null,
      };
    }

    if (!input.startTime) {
      throw new UnprocessableEntityError(
        'Start time is required for a half-day leave',
        'INVALID_HALF_DAY_TIME'
      );
    }

    if (!isValidHalfDayStartTime(input.startTime)) {
      throw new UnprocessableEntityError(
        'Half-day start time must be between 00:00 and 20:00',
        'INVALID_HALF_DAY_TIME'
      );
    }

    return {
      year: startYear,
      requestedDays: 0.5,
      calculatedEndTime: addHoursToTime(input.startTime, 4),
    };
  }

  // Multi-day request
  if (input.durationType === LeaveDurationType.HALF_DAY) {
    throw new UnprocessableEntityError(
      'Half-day leave is only allowed for single-day requests',
      'MULTI_DAY_HALF_DAY_NOT_ALLOWED'
    );
  }

  return {
    year: startYear,
    requestedDays: calculateInclusiveCalendarDays(input.startDate, input.endDate),
    calculatedEndTime: null,
  };
};

export const previewLeaveCalculation = async (
  userId: string,
  input: LeaveCalculationInput & { leaveTypeId: string }
): Promise<LeavePreviewResult> => {
  const { year, requestedDays, calculatedEndTime } = calculateLeaveDuration(input);

  const leaveType = await prisma.leaveType.findFirst({
    where: { id: input.leaveTypeId, isActive: true },
  });

  if (!leaveType) {
    throw new NotFoundError('Leave type not found', 'LEAVE_TYPE_NOT_FOUND');
  }

  const balance = await prisma.leaveBalance.findUnique({
    where: {
      userId_leaveTypeId_year: {
        userId,
        leaveTypeId: input.leaveTypeId,
        year,
      },
    },
  });

  const availableDays = balance
    ? Number((Number(balance.allocated) - Number(balance.used) - Number(balance.reserved)).toFixed(2))
    : 0;

  const projectedAvailableDays = Number((availableDays - requestedDays).toFixed(2));
  const canSubmit = availableDays > 0 && availableDays >= requestedDays;

  let maxEndDate: string | null = null;
  if (availableDays > 0) {
    const extraDays = availableDays >= 1 ? Math.floor(availableDays) - 1 : 0;
    const balanceLimitDate = addDaysToDate(input.startDate, extraDays);
    const yearEndDate = `${year}-12-31`;
    maxEndDate = balanceLimitDate < yearEndDate ? balanceLimitDate : yearEndDate;
  }

  return {
    requestedDays,
    calculatedEndTime,
    availableDays,
    projectedAvailableDays,
    maxEndDate,
    canSubmit,
  };
};

