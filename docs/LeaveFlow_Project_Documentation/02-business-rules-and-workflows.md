# 2. Business Rules and Workflows

## 2.1 Balance definitions

For a user, leave type, and leave year:

`available = allocated - used - reserved`

- `allocated`: annual allowance assigned to the employee.
- `used`: leave days from finally approved requests.
- `reserved`: leave days held by submitted requests that are awaiting a final decision.
- `available`: balance the employee can still request.

Initial allowance per employee:
- Paid Leave: 6
- Casual Leave: 4
- Sick Leave: 4
- Unpaid Leave: 10

Unpaid Leave is balance-based in this MVP. It is **not unlimited**.

### Balance lifecycle
1. On submission: `reserved += requestedDays`.
2. When all required approvals are approved: `reserved -= requestedDays`, `used += requestedDays`.
3. When request is rejected: `reserved -= requestedDays`.
4. When a pending request is cancelled by its employee: `reserved -= requestedDays`.
5. A rejected/cancelled request does not increase `used`.

The balance update and related request state change must happen in one database transaction.

## 2.2 Leave duration calculation

### Same start and end date
Show Duration:
- `FULL_DAY`: 1.0 day.
- `HALF_DAY`: 0.5 day.

For half day:
- Employee selects a start time.
- End time is automatically calculated as start time + 4 hours.
- End time is read-only/disabled in the UI.
- Examples: 09:00 → 13:00; 10:00 → 14:00; 11:00 → 15:00; 12:00 → 16:00.
- Backend recalculates end time. Do not trust a client-supplied end time.

### Different start and end dates
- Only full-day leave is supported.
- `totalDays = calendar date difference + 1`.
- Example: 10th through 12th inclusive = 3 days.
- Hide or omit the half-day duration control for multi-day requests.
- For this MVP, weekends and public holidays are counted as calendar days.

### Validation
- Start date is required.
- End date is required and must be on/after start date.
- Same-day requests must specify FULL_DAY or HALF_DAY.
- Multi-day requests must be FULL_DAY.
- Half-day start time is required and must produce a valid end time within the same day. A practical UI rule is to allow start times from 00:00 through 20:00, so the four-hour period ends by 24:00; alternatively apply the organization's working-hour window if defined later.
- Reason is required and must be within a sensible length (e.g. 10–500 characters).
- Requested days must be greater than zero.
- Requested days must not exceed available balance.
- If available balance is zero, disable that leave type in the selector.
- If available balance is positive but less than the requested duration, keep the type selectable but block submission and show the shortfall.
- Exact balance is allowed: available 0.5 and request 0.5 is valid.
- The backend must recalculate days and validate all conditions.

## 2.3 Live preview and leave-type availability
On every relevant form change (leave type, dates, duration, start time):
1. Calculate requested duration.
2. Read the selected leave type's available balance.
3. Calculate projected balance: `available - requestedDays`.
4. Display requested days and projected balance.
5. If balance is zero, disable the leave type in the dropdown.
6. If requested days exceed available balance, disable Submit and show a clear message, e.g. "You have 1.5 days available, but this request needs 2 days."
7. Do not reserve balance during preview. Reservation occurs only after successful submission.

Example:
- Casual Leave available: 4 days.
- Request: half day = 0.5.
- Projected available after submission: 3.5 days.

## 2.4 Overlap rule
An employee cannot have overlapping active leave requests. Active means `PENDING` or `APPROVED`.
- Reject a new request if its date range overlaps an existing PENDING or APPROVED request.
- Rejected and cancelled requests do not block a new request.
- For MVP, use date-range overlap: `new.start_date <= existing.end_date AND new.end_date >= existing.start_date`.
- This intentionally blocks same-date requests even if half-day time windows do not overlap. More granular AM/PM/time overlap can be a future enhancement.
- Perform the check in the backend inside the submission transaction. Consider serializing submissions per employee to reduce race conditions.

## 2.5 Approval routing

### Employee submits leave
1. Authenticate the employee/PM.
2. Validate input and calculate duration on the server.
3. Check overlapping active requests.
4. Atomically reserve balance.
5. Create the leave request with status `PENDING`.
6. Create two approval steps:
   - Project Manager: `PENDING`
   - HR: `PENDING`
7. Add `REQUEST_SUBMITTED` history.
8. Commit the transaction.
9. Both approvers can see the request independently.

### Project Manager submits leave
1. Validate and reserve balance using the same rules.
2. Create the leave request with status `PENDING`.
3. Create one approval step assigned to HR.
4. Do not create a PM approval step for the PM's own request.
5. Add submission history and commit.

### Approver approves
1. Identify the approver from the JWT-authenticated user. Never accept `approverId` from the client.
2. Confirm the approver owns a PENDING approval step for this request.
3. Change that step to `APPROVED`, store comments and `action_at`.
4. If another required step is still PENDING, leave request status as `PENDING`.
5. If every required step is APPROVED:
   - set request status to `APPROVED`;
   - move days from reserved to used;
   - write history.
6. Commit all updates in one transaction.

### Approver rejects
1. Confirm the approver owns a PENDING approval step.
2. Change that step to `REJECTED`, store comments and timestamp.
3. Set request status to `REJECTED`.
4. Change every other PENDING approval step to `CANCELLED`.
5. Release reserved days.
6. Write history.
7. Commit atomically.

### Idempotency and race conditions
- A decision endpoint must only transition an approval step from PENDING once.
- Repeated approval/rejection requests must not deduct or release balance again.
- Use a transaction and conditional update (`WHERE status = 'PENDING'`) or row locking.
- If the step is no longer pending, return `409 Conflict`.
- If two approvers act at nearly the same time, lock the leave request and approval rows in a consistent order, then evaluate final status once.

## 2.6 Employee cancellation
- Employee may cancel only a PENDING request.
- On cancellation:
  - set request to `CANCELLED`;
  - set remaining PENDING approval steps to `CANCELLED`;
  - release reserved days;
  - write history.
- Do not allow cancellation after final approval in MVP.
- Do not allow cancellation of already rejected/cancelled requests.

## 2.7 Error conditions and expected responses
| Condition | Expected behavior |
|---|---|
| No balance row for selected type/year | Treat as unavailable; return validation error or provision balance during employee setup |
| Zero available balance | Leave type disabled in UI; backend rejects submission |
| Insufficient balance | `422` with available and requested days |
| Overlapping pending/approved request | `409 Conflict` |
| Invalid date range | `422 Unprocessable Entity` |
| Multi-day half-day attempt | `422 Unprocessable Entity` |
| Wrong approver | `403 Forbidden` |
| Approval step already actioned | `409 Conflict` |
| Request already final | `409 Conflict` |
| Employee cancels approved request | `409 Conflict` |
| Unauthenticated request | `401 Unauthorized` |
| Wrong role | `403 Forbidden` |

## 2.8 Important implementation note: annual leave year
For the MVP, define the leave year as a calendar year (January 1–December 31). A request that crosses December 31 should either be rejected with a clear message or split across leave-year balance rows. To keep the two-day scope small, **reject cross-year requests** in the MVP. Provision balance rows for the current year when HR creates an employee.
