# 5. UI Screens and Angular 21 Frontend Flow

## 5.1 Angular 21 architecture
Use Angular 21 with standalone components and lazy-loaded feature routes.

Suggested structure:

```text
frontend/src/app/
  core/
    auth/
    guards/
    interceptors/
    services/
    models/
  shared/
    components/
      app-shell/
      status-badge/
      data-table/
      confirmation-dialog/
      approval-timeline/
    pipes/
  features/
    auth/
      login/
    employee/
      dashboard/
      apply-leave/
      my-requests/
      leave-balance/
    manager/
      dashboard/
      pending-approvals/
      team-calendar/
      approval-history/
    hr/
      dashboard/
      employees/
      employee-form/
      leave-requests/
      leave-balances/
  app.config.ts
  app.routes.ts
```

Recommended practices:
- Reactive Forms for leave and employee forms.
- Signals for local UI state and derived preview state.
- HttpClient for API communication; RxJS for asynchronous requests.
- Functional route guards for navigation experience.
- HTTP interceptor for attaching JWT and handling common unauthorized responses.
- Centralized API error mapping.
- Keep business rules on the backend; frontend calculations are previews only.

## 5.2 Shared application shell
- Left sidebar based on role.
- Top bar with page title and profile/logout.
- Main content area.
- Responsive layout for desktop/tablet.
- No notification bell in this MVP.

## 5.3 Employee screens

### Employee dashboard
Cards:
- Allocated
- Used
- Reserved / Pending
- Available

Sections:
- Recent leave requests.
- Pending approval status (PM and HR separately).
- Quick action: Apply Leave.

### Apply Leave screen
Fields:
1. Leave Type dropdown. Show available balance beside each option. Disable options with available balance `<= 0`.
2. Start Date.
3. End Date.
4. Duration dropdown appears only when start date equals end date:
   - Full Day
   - Half Day
5. For Half Day:
   - Start Time: editable time input.
   - End Time: disabled/read-only; calculated as Start Time + 4 hours.
6. Reason textarea.
7. Live calculation preview.
8. Submit button.

Preview example:
- Casual Leave available: 4.0 days
- Requested: 0.5 day
- Projected available after submission: 3.5 days

Validation states:
- Zero balance: disable leave type.
- Insufficient balance for current request: show message and disable Submit.
- Invalid date range: show field-level validation.
- Multi-day half-day: not available.
- Overlap: show backend conflict message.
- While submitting: disable button and show progress.
- On success: show confirmation and navigate to My Requests.

### My Leave Requests
Table columns:
- Request ID
- Leave Type
- Date / date range
- Duration
- Days
- Status
- PM approval
- HR approval
- Actions: View; Cancel only while PENDING

### Leave Balance
Display four leave types with allocated, used, reserved, available values.

## 5.4 Project Manager screens
Sidebar:
- Dashboard
- Pending Approvals
- Team Leave Calendar
- Approval History

Pending approvals table:
- Employee
- Leave type
- Dates
- Duration/days
- Reason
- Submitted date
- View / Approve / Reject

Approval detail:
- Employee and request details.
- Current balance context if permitted.
- Other approver's status (PM/HR).
- Comment box.
- Approve and Reject actions.
- Timeline of decisions.

PM cannot approve their own leave. Their own request routes to HR only.

## 5.5 HR screens
Sidebar:
- Dashboard
- All Leave Requests
- Pending Approvals
- Employees
- Leave Balances

HR can:
- View all requests.
- Approve/reject all employee requests independently of PM.
- Approve/reject PM requests (only required approver for PM leave).
- Create/update/deactivate employees.
- View balances.

Do not include Reports or Analytics.

## 5.6 Routing outline

```ts
export const routes: Routes = [
  { path: 'login', loadComponent: () => import('./features/auth/login/login.component').then(m => m.LoginComponent) },
  {
    path: '',
    canActivate: [authGuard],
    children: [
      { path: 'employee', canActivate: [roleGuard('EMPLOYEE')], loadChildren: () => import('./features/employee/employee.routes').then(m => m.EMPLOYEE_ROUTES) },
      { path: 'manager', canActivate: [roleGuard('PROJECT_MANAGER')], loadChildren: () => import('./features/manager/manager.routes').then(m => m.MANAGER_ROUTES) },
      { path: 'hr', canActivate: [roleGuard('HR')], loadChildren: () => import('./features/hr/hr.routes').then(m => m.HR_ROUTES) },
      { path: '', pathMatch: 'full', redirectTo: 'login' }
    ]
  }
];
```

Adapt route typing to your actual functional guard implementation; guards improve UX but backend middleware must enforce permissions.

## 5.7 UI states to implement
- Initial loading/skeleton.
- Empty state (no requests).
- Form validation errors.
- Insufficient balance state.
- API/server error state.
- Permission denied state.
- Confirmation dialog for reject/cancel.
- Success toast/banner.
- Disabled action for already actioned approval.
