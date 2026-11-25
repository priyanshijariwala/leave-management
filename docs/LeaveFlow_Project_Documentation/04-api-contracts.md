# 4. API Contracts

Base path: `/api/v1`

All private endpoints require:
`Authorization: Bearer <access_token>`

Use JSON request and response bodies. Use a consistent error shape:

```json
{
  "success": false,
  "error": {
    "code": "INSUFFICIENT_LEAVE_BALANCE",
    "message": "You have 1.5 days available, but this request needs 2 days.",
    "details": {
      "availableDays": 1.5,
      "requestedDays": 2
    }
  }
}
```

## 4.1 Authentication

### POST `/auth/login`
Request:
```json
{ "email": "employee@example.com", "password": "password" }
```
Response:
```json
{
  "accessToken": "<jwt>",
  "user": { "id": "uuid", "name": "Asha", "email": "employee@example.com", "role": "EMPLOYEE" }
}
```

### GET `/auth/me`
Returns the authenticated user's profile, role, manager ID, and active status.

## 4.2 Leave types and balances

### GET `/leave-types`
Returns active leave types and the user's available balance for the current leave year.

### GET `/leave-balances/my`
Returns the authenticated user's balance rows:
```json
{
  "year": 2026,
  "items": [
    { "leaveType": "CASUAL_LEAVE", "allocated": 4, "used": 0.5, "reserved": 0.5, "available": 3 }
  ]
}
```

### GET `/hr/leave-balances?employeeId=<uuid>&year=2026`
HR-only. Returns balances for one employee or all employees with pagination.

## 4.3 Leave calculation preview

### POST `/leaves/calculate`
Preview only. Does not reserve balance or create a request.

Same-day half-day request:
```json
{
  "leaveTypeId": "uuid",
  "startDate": "2026-11-26",
  "endDate": "2026-11-26",
  "durationType": "HALF_DAY",
  "startTime": "09:00"
}
```

Response:
```json
{
  "requestedDays": 0.5,
  "calculatedEndTime": "13:00",
  "availableDays": 4,
  "projectedAvailableDays": 3.5,
  "canSubmit": true
}
```

For multi-day full-day requests, omit `startTime`; backend calculates inclusive calendar days.

## 4.4 Leave requests

### POST `/leaves`
Creates a request and reserves balance atomically.

Request:
```json
{
  "leaveTypeId": "uuid",
  "startDate": "2026-11-26",
  "endDate": "2026-11-26",
  "durationType": "HALF_DAY",
  "startTime": "09:00",
  "reason": "Personal appointment"
}
```

The client must not send `employeeId`, `approverId`, `totalDays`, `endTime`, or final status. The backend derives these values.

Response:
```json
{
  "id": "uuid",
  "status": "PENDING",
  "totalDays": 0.5,
  "reservedDays": 0.5,
  "approvalSteps": [
    { "role": "PROJECT_MANAGER", "status": "PENDING" },
    { "role": "HR", "status": "PENDING" }
  ]
}
```

### GET `/leaves/my`
Employee/PM: own requests, paginated, filterable by status/year.

### GET `/leaves/:id`
Returns request details, approval steps, and history. Enforce ownership or authorized HR/assigned approver access.

### POST `/leaves/:id/cancel`
Employee/PM can cancel own PENDING request only. Releases reserved days and cancels pending steps.

## 4.5 Approvals

### GET `/approvals/pending`
Returns approval steps assigned to the authenticated PM or HR. Filter by date, employee, and leave type.

### GET `/approvals/:approvalStepId`
Returns request details and approval context for the assigned approver.

### POST `/approvals/:approvalStepId/approve`
Request:
```json
{ "comments": "Approved." }
```

### POST `/approvals/:approvalStepId/reject`
Request:
```json
{ "comments": "Please provide an alternate date." }
```

Approver identity comes from the JWT. Never accept approver identity from request JSON.

### GET `/leaves/:id/history`
Returns chronological approval history.

## 4.6 HR employee management

### GET `/hr/employees`
HR-only. Paginated employee list with search and role/status filters.

### POST `/hr/employees`
HR-only. Creates user, hashes password or issues a setup flow, assigns manager if applicable, and provisions four leave-balance rows for the current leave year.

### PATCH `/hr/employees/:id`
HR-only. Updates allowed profile fields, manager assignment, or active status. Do not allow arbitrary role escalation without explicit validation.

## 4.7 Dashboards

- `GET /dashboard/employee`
- `GET /dashboard/manager`
- `GET /dashboard/hr`

Return only data permitted for the authenticated role.

## 4.8 HTTP status guidance
- `200 OK`: successful reads or actions.
- `201 Created`: new leave request or employee.
- `400 Bad Request`: malformed payload.
- `401 Unauthorized`: missing/invalid token.
- `403 Forbidden`: authenticated but not permitted.
- `404 Not Found`: resource not found or intentionally hidden due to access policy.
- `409 Conflict`: overlapping request, already-actioned approval, or invalid state transition.
- `422 Unprocessable Entity`: valid JSON but invalid business input (dates, duration, insufficient balance).
- `500 Internal Server Error`: unexpected server failure; do not expose stack traces.
