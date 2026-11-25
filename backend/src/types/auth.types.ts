import { UserRole } from '@prisma/client';

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  managerId: string | null;
  isActive: boolean;
}

export interface JwtPayload {
  sub: string;
  role: UserRole;
}

