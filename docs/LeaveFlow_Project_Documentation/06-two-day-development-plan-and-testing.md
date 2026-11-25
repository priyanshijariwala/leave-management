# 6. Two-Day Development Plan and Testing

## Day 1 — Backend, database, and workflow
**Goal:** Complete the API and verify core business rules using Postman/Swagger.

1. Initialize Node.js + Express + TypeScript project.
2. Configure environment variables and PostgreSQL.
3. Install/configure Prisma and create migrations.
4. Create the six tables and seed four leave types.
5. Seed sample HR, PM, and employee accounts.
6. Implement password hashing, login, JWT middleware, and role middleware.
7. Implement leave type and balance APIs.
8. Implement server-side leave calculation:
   - same-day full day = 1
   - same-day half day = 0.5
   - multi-day full day = inclusive calendar days
   - half-day end time = start + 4 hours
9. Implement overlap validation.
10. Implement atomic balance reservation and request creation.
11. Implement parallel approval-step creation for employee requests.
12. Implement HR-only approval routing for PM requests.
13. Implement approve/reject/cancel transitions and balance release/commit.
14. Implement approval history and dashboard endpoints.
15. Test role access, insufficient balance, overlaps, duplicate decisions, and concurrent submissions.

## Day 2 — Angular 21 UI and integration
**Goal:** Complete the main user journeys for all three roles.

1. Create Angular 21 standalone application.
2. Configure app shell, routing, auth service, guards, and JWT interceptor.
3. Build login.
4. Build employee dashboard and balance cards.
5. Build Apply Leave form with dynamic controls and live preview.
6. Build My Requests list and request detail/history.
7. Build PM pending approvals and decision screen.
8. Build HR dashboard, all requests, employee management, and balances.
9. Integrate APIs and implement loading/empty/error/success states.
10. Test complete journeys with Employee, PM, and HR accounts.
11. Fix responsive layout and validation issues.
12. Add README, setup commands, environment example, API documentation, and screenshots.

## Test checklist

### Leave calculation
- [ ] Same date + FULL_DAY calculates 1.0.
- [ ] Same date + HALF_DAY calculates 0.5.
- [ ] Start 09:00 calculates end 13:00.
- [ ] Start 10:00 calculates end 14:00.
- [ ] Start 11:00 calculates end 15:00.
- [ ] Multi-day range counts both start and end dates.
- [ ] Multi-day half-day is rejected.
- [ ] Cross-year request is rejected in MVP.

### Balance
- [ ] Seed balances are Paid 6, Casual 4, Sick 4, Unpaid 10.
- [ ] Zero-available leave type is disabled in UI.
- [ ] Backend rejects zero/insufficient balance.
- [ ] Exact available balance is accepted.
- [ ] Submission increases reserved, not used.
- [ ] Final approval moves reserved to used.
- [ ] Rejection releases reserved.
- [ ] Cancellation releases reserved exactly once.

### Workflow
- [ ] Employee request creates PM and HR pending steps.
- [ ] PM approval alone leaves request PENDING.
- [ ] HR approval alone leaves request PENDING.
- [ ] Both approvals set request APPROVED.
- [ ] Either rejection sets request REJECTED.
- [ ] Rejection cancels the other pending step.
- [ ] PM request creates HR step only.
- [ ] PM cannot approve own request.
- [ ] Unassigned approver receives 403.
- [ ] Duplicate decision receives 409 and does not alter balance twice.

### Security and data integrity
- [ ] Unauthenticated API returns 401.
- [ ] Wrong role returns 403.
- [ ] Employee cannot read another employee's private request.
- [ ] Client cannot override employee ID, approver ID, total days, end time, or status.
- [ ] Two simultaneous requests cannot over-reserve a balance.
- [ ] Request, approval steps, history, and balance changes roll back together on failure.

## Definition of Done
- All three roles can log in and see role-appropriate screens.
- Employee/PM can submit valid leave requests.
- Balance reservation and approval transitions are atomic.
- PM and HR approvals work independently for employee requests.
- HR-only approval works for PM leave.
- Leave history is visible.
- No notifications, reports, or balance transaction module are present.
- README includes setup, migrations, seed, run, and test instructions.
