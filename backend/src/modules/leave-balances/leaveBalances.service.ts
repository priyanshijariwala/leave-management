import { prisma } from '../../config/prisma';
import { LeaveBalanceItem } from '../../types/leave.types';

export const getMyLeaveBalances = async (
  userId: string,
  year?: number
): Promise<{ year: number; items: LeaveBalanceItem[] }> => {
  const targetYear = year ?? new Date().getUTCFullYear();

  const balances = await prisma.leaveBalance.findMany({
    where: { userId, year: targetYear },
    include: { leaveType: true },
    orderBy: { leaveType: { name: 'asc' } },
  });

  const items: LeaveBalanceItem[] = balances.map((b) => {
    const allocated = Number(b.allocated);
    const used = Number(b.used);
    const reserved = Number(b.reserved);
    const available = Number((allocated - used - reserved).toFixed(2));

    return {
      leaveTypeId: b.leaveTypeId,
      leaveType: b.leaveType.code,
      leaveTypeName: b.leaveType.name,
      allocated,
      used,
      reserved,
      available,
    };
  });

  return { year: targetYear, items };
};

