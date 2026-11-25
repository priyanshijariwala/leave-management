import { PrismaClient, UserRole } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

const LEAVE_TYPES = [
  { code: 'PAID_LEAVE', name: 'Paid Leave', annualAllowance: 6 },
  { code: 'CASUAL_LEAVE', name: 'Casual Leave', annualAllowance: 4 },
  { code: 'SICK_LEAVE', name: 'Sick Leave', annualAllowance: 4 },
  { code: 'UNPAID_LEAVE', name: 'Unpaid Leave', annualAllowance: 10 },
];

async function main() {
  const currentYear = new Date().getUTCFullYear();
  const defaultPasswordHash = await bcrypt.hash('Password123!', 10);

  // 1. Seed fixed leave types
  const seededLeaveTypes = [];
  for (const lt of LEAVE_TYPES) {
    const leaveType = await prisma.leaveType.upsert({
      where: { code: lt.code },
      update: {
        name: lt.name,
        annualAllowance: lt.annualAllowance,
        isActive: true,
      },
      create: {
        code: lt.code,
        name: lt.name,
        annualAllowance: lt.annualAllowance,
        isActive: true,
      },
    });
    seededLeaveTypes.push(leaveType);
  }

  // 2. Seed HR user
  const hrUser = await prisma.user.upsert({
    where: { email: 'hr@leaveflow.local' },
    update: { name: 'Priya HR', role: UserRole.HR, isActive: true },
    create: {
      name: 'Priya HR',
      email: 'hr@leaveflow.local',
      passwordHash: defaultPasswordHash,
      role: UserRole.HR,
      isActive: true,
    },
  });

  // 3. Seed Project Manager user
  const pmUser = await prisma.user.upsert({
    where: { email: 'pm@leaveflow.local' },
    update: { name: 'Rohan Manager', role: UserRole.PROJECT_MANAGER, isActive: true },
    create: {
      name: 'Rohan Manager',
      email: 'pm@leaveflow.local',
      passwordHash: defaultPasswordHash,
      role: UserRole.PROJECT_MANAGER,
      isActive: true,
    },
  });

  // 4. Seed Employee users assigned to PM
  const employee1 = await prisma.user.upsert({
    where: { email: 'asha@leaveflow.local' },
    update: {
      name: 'Asha Employee',
      role: UserRole.EMPLOYEE,
      managerId: pmUser.id,
      isActive: true,
    },
    create: {
      name: 'Asha Employee',
      email: 'asha@leaveflow.local',
      passwordHash: defaultPasswordHash,
      role: UserRole.EMPLOYEE,
      managerId: pmUser.id,
      isActive: true,
    },
  });

  const employee2 = await prisma.user.upsert({
    where: { email: 'vikram@leaveflow.local' },
    update: {
      name: 'Vikram Employee',
      role: UserRole.EMPLOYEE,
      managerId: pmUser.id,
      isActive: true,
    },
    create: {
      name: 'Vikram Employee',
      email: 'vikram@leaveflow.local',
      passwordHash: defaultPasswordHash,
      role: UserRole.EMPLOYEE,
      managerId: pmUser.id,
      isActive: true,
    },
  });

  // 5. Provision leave balances for the current year for all users
  const users = [hrUser, pmUser, employee1, employee2];
  for (const user of users) {
    for (const leaveType of seededLeaveTypes) {
      await prisma.leaveBalance.upsert({
        where: {
          userId_leaveTypeId_year: {
            userId: user.id,
            leaveTypeId: leaveType.id,
            year: currentYear,
          },
        },
        update: {},
        create: {
          userId: user.id,
          leaveTypeId: leaveType.id,
          year: currentYear,
          allocated: leaveType.annualAllowance,
          used: 0,
          reserved: 0,
        },
      });
    }
  }

  console.log(`Seeded ${seededLeaveTypes.length} leave types, ${users.length} users, and ${currentYear} leave balances.`);
  console.log('Demo credentials (password: Password123!):');
  console.log('  HR:       hr@leaveflow.local');
  console.log('  PM:       pm@leaveflow.local');
  console.log('  Employee: asha@leaveflow.local');
  console.log('  Employee: vikram@leaveflow.local');
}

main()
  .catch((err) => {
    console.error('Seed failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

