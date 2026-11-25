# 1. Project Scope and Requirements

## 1.1 Overview
LeaveFlow allows employees to apply for leave, view balances and track approval status. Project Managers and HR review requests through role-specific workspaces.

## 1.2 Goals
- Digitize leave application and approval.
- Enforce leave balances and prevent overbooking.
- Support parallel PM and HR approvals for employee requests.
- Route Project Manager leave directly to HR.
- Keep the MVP small enough to implement in two focused development days.

## 1.3 Roles and permissions

| Capability | Employee | Project Manager | HR |
|---|---:|---:|---:|
| View own dashboard and balance | Yes | Yes | Yes |
| Apply for own leave | Yes | Yes | Optional/not in MVP |
| View own requests | Yes | Yes | Yes |
| View team requests | No | Yes | Yes |
| Approve/reject employee request | No | Yes | Yes |
| Approve/reject PM request | No | No | Yes |
| View employee directory | No | Limited team context | Yes |
| View employee leave balances | Own only | Team context | All employees |
| Manage employees | No | No | Yes |
| View HR reports | No | No | No |

**MVP simplification:** Project Managers can apply for leave using the same leave form. HR is the only approver for a Project Manager's leave. HR may create and manage employee records. Avoid adding additional admin roles.

## 1.4 Functional modules

### Module A — Authentication and access control
- Login using email and password.
- Return a JWT access token.
- `GET /auth/me` returns the authenticated user's profile and role.
- Protect private routes and API endpoints.
- Enforce role authorization on the backend; frontend route guards are not a security boundary.

### Module B — Dashboards
- Employee: allocated, used, reserved, available balances; recent requests; pending/approved/rejected counts.
- Project Manager: pending approvals assigned to the manager; team leave overview; recent decisions.
- HR: pending approvals; all leave requests; employee count; employee balances.
- Do not build reports or analytics pages for HR.

### Module C — Leave types and balances
Fixed initial annual allowances:
| Leave type | Annual allowance |
|---|---:|
| Paid Leave | 6 days |
| Casual Leave | 4 days |
| Sick Leave | 4 days |
| Unpaid Leave | 10 days |
| **Total** | **24 days** |

Seed these leave types. Each employee receives one balance row per leave type and leave year. HR can view balances. No balance transaction table is used.

### Module D — Apply leave
- Select a leave type.
- A leave type with zero available balance is disabled.
- Choose start and end dates.
- If start date equals end date, show a Duration dropdown: `FULL_DAY` or `HALF_DAY`.
- For `HALF_DAY`, show editable Start Time and disabled/read-only End Time.
- End Time = Start Time + exactly 4 hours.
- Show a live preview of requested days, current available balance, and projected available balance after submission.
- Validate balance before submission and revalidate on the backend.
- Require a reason.
- Prevent overlapping active leave requests.

### Module E — Approval workflow
- Employee request: PM and HR approval steps are created at the same time and can be actioned independently.
- Both approvals are required for final approval.
- PM request: only an HR approval step is created.
- If either approver rejects, the request becomes rejected and the other pending step is cancelled.
- Store comments and timestamps for each decision.
- Preserve approval history.

### Module F — Employee and balance administration
- HR can list, create, update, deactivate employees.
- HR can view employee balances.
- Keep employee creation simple: name, email, role, manager assignment, active status, initial balances.
- Do not add HR reports.

## 1.5 Non-functional requirements
- Backend authorization must be enforced for every protected endpoint.
- All balance reservation and workflow creation operations must be atomic.
- Use database transactions for submission and approval state changes.
- Use parameterized ORM queries; never concatenate user input into SQL.
- Validate all request bodies, path parameters, and query parameters.
- Store passwords as secure hashes (Argon2id or bcrypt), never plaintext.
- Use environment variables for secrets and database URLs.
- Return consistent error responses.
- Store timestamps in UTC; display them in the user's local timezone.
- Add database indexes for common filters and foreign keys.
- Keep audit history for request and approval actions.

## 1.6 Out of scope
- Email, SMS, push, or in-app notifications.
- HR reports and analytics.
- Leave-balance transaction ledger.
- Multi-level sequential approvals.
- Half-day requests spanning multiple dates.
- Hourly leave other than the fixed four-hour half-day.
- Holiday/weekend calendar exclusion (MVP counts calendar days).
- Automatic annual carry-forward or accrual engine.
- Editing an already submitted request.
- Cancelling an already approved request.
