# LeaveFlow — Project Documentation

LeaveFlow is a role-based leave management and approval workflow application.

## Technology stack
- **Frontend:** Angular 21 (standalone components, Angular Router, Reactive Forms, Signals, HttpClient)
- **Backend:** Node.js + Express
- **Database:** PostgreSQL
- **ORM:** Prisma
- **Authentication:** JWT access token + password hashing
- **Validation:** Zod (or an equivalent schema validator)
- **API documentation:** Swagger / OpenAPI

## Roles
- `EMPLOYEE`
- `PROJECT_MANAGER`
- `HR`

## MVP decisions
- Employee leave requests require independent approvals from Project Manager and HR. Both must approve.
- Project Manager leave requests go directly to HR.
- A rejection by either required approver rejects the request and cancels any other pending approval step.
- Leave balance is reserved immediately when a request is submitted.
- On final approval, reserved days move to used days. On rejection/cancellation, reserved days are released.
- Four fixed leave types: Paid (6), Casual (4), Sick (4), Unpaid (10) days per employee per leave year.
- Same-day requests can be Full Day (1 day) or Half Day (0.5 day).
- Half-day duration is exactly four hours. The employee chooses the start time; end time is calculated and read-only.
- Multi-day requests are full-day only and use calendar-day counting in the MVP.
- No notifications, HR reports, or leave-balance transaction module in this MVP.

## Documentation
1. `01-project-scope-and-requirements.md`
2. `02-business-rules-and-workflows.md`
3. `03-database-schema.md`
4. `04-api-contracts.md`
5. `05-ui-screens-and-frontend-flow.md`
6. `06-two-day-development-plan-and-testing.md`

See `LeaveFlow_Project_Specification.docx` for the consolidated implementation-ready specification.
