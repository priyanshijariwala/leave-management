export interface PendingApprovalsQuery {
  page: number;
  limit: number;
  employeeId?: string;
  leaveTypeId?: string;
  startDate?: string;
  endDate?: string;
}

export interface ApprovalDecisionInput {
  comments?: string;
}

