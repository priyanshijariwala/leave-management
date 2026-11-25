import { prisma } from '../../config/prisma';
import { LeaveTypeWithBalance } from '../../types/leave.types';

export const getActiveLeaveTypesForUser = async (
  userId: string
): Promise<{ year: number; items: LeaveTypeWithBalance[] }> => {
  const currentYear = new Date().getUTCFullYear();

  const leaveTypes = await prisma.leaveType.findMany({
    where: { isActive: true },
    orderBy: { name: 'asc' },
    include: {
      balances: {
        where: { userId, year: currentYear },
      },
    },
  });

  const items: LeaveTypeWithBalance[] = leaveTypes.map((lt) => {
    const balance = lt.balances[0];
    const available = balance
      ? Number(balance.allocated) - Number(balance.used) - Number(balance.reserved)
      : 0;

    return {
      id: lt.id,
      code: lt.code,
      name: lt.name,
      annualAllowance: Number(lt.annualAllowance),
      available: Number(available.toFixed(2)),
    };
  });

  return { year: currentYear, items };
};

