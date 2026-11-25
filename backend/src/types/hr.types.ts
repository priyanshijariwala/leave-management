import { UserRole } from '@prisma/client';

export interface ListEmployeesQuery {
  page: number;
  limit: number;
  search?: string;
  role?: UserRole;
  isActive?: boolean;
}

export interface CreateEmployeeInput {
  name: string;
  email: string;
  password: string;
  role: UserRole;
  managerId?: string | null;
  isActive?: boolean;
}

export interface UpdateEmployeeInput {
  name?: string;
  role?: UserRole;
  managerId?: string | null;
  isActive?: boolean;
}

export interface HrBalancesQuery {
  page: number;
  limit: number;
  employeeId?: string;
  year?: number;
}

