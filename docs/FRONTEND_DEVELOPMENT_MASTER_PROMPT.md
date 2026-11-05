# WorkSphere — Frontend Development Master Prompt

Use this document as the implementation brief for the WorkSphere frontend. Build a polished, production-minded SaaS application that integrates with the separately developed WorkSphere Backend. Follow the phases in order, complete one phase at a time, and do not move forward until that phase's checks and deliverable are complete.

## 1. Project Overview

Build a modern, multi-tenant project-management frontend for WorkSphere, inspired by Linear, Jira, ClickUp, and Asana. It should help users manage organizations, teams, projects, tasks, collaboration, notifications, and analytics through one professional workspace.

The frontend must integrate with the WorkSphere Backend only through its published API. Start integration after the API contracts are available. Treat the backend as authoritative for data and authorization.

**Product name:** WorkSphere
**Tagline:** One workspace. Every project. Better collaboration.

## 2. Required Technology Stack

- Language: JavaScript (ES2022+) and JSX
- UI: React
- Build tool: Vite
- Routing: React Router
- Styling: Tailwind CSS
- UI primitives: shadcn/ui
- Icons: Lucide React
- Server state and caching: TanStack Query
- Client/UI state: Zustand
- Forms: React Hook Form
- Client-side form validation: Zod
- HTTP client: Axios
- Charts: Recharts
- Toasts: Sonner
- Dates: date-fns
- Unit/component tests: Vitest and React Testing Library
- End-to-end tests: Playwright
- Quality: ESLint and Prettier
- CI: GitHub Actions

**Use JavaScript and JSX only. Do not add TypeScript, TS, or TSX.** Do not use Docker, Docker Compose, or container-based development. Keep dependencies focused and avoid replacing an existing package without a concrete need.

## 3. Design Requirements

Create a premium SaaS interface: minimal, professional, clean, responsive, consistent, accessible, and intuitive. Avoid generic tutorial/dashboard templates.

Implement:

- Light and dark themes, with persisted user preference.
- Reusable design tokens for color, typography, spacing, radius, elevation, and focus states.
- Consistent page headers, typography, spacing, buttons, forms, dialogs, dropdowns, cards, tables, badges, tooltips, and navigation.
- Loading skeletons, empty states, inline validation, success feedback, and useful error states.
- Keyboard navigation, visible focus indicators, semantic HTML, accessible names, and reduced-motion support.

Do not sacrifice accessibility or usability for visual effects. Keep layout and interaction patterns consistent across features.

## 4. Application Layout

Build an authenticated dashboard shell with:

### Sidebar

- WorkSphere logo and organization switcher.
- Dashboard, My Tasks, Projects, Team Members, Notifications, and Settings navigation.
- Collapsible desktop navigation and a usable mobile navigation drawer.
- Current route and organization context shown clearly.

### Header

- Breadcrumbs and current page title/context.
- Global search where supported by the backend; do not simulate unsupported search APIs as if they were real.
- Notification entry point/unread indicator, theme switcher, and profile menu.

### Main content

Use a responsive content area with consistent page headers, actions, filters, and spacing. Preserve context when navigating between organizations, projects, and tasks.

## 5. Core Features

Implement only features supported by the backend API, and surface unavailable capabilities as documented dependencies rather than pretending they work.

### Authentication

- Registration, login, logout, forgot-password, reset-password, protected routes, and session handling.
- Use HttpOnly refresh-token cookies where supported. Never expose or persist the refresh token in JavaScript storage.
- The backend currently has email verification disabled by default (`EMAIL_VERIFICATION_ENABLED=false`). Do not block the frontend registration/login flow on email verification while the backend reports verification is not required. Keep the UI/API integration adaptable for the later mailer-backed verification flow, and follow the actual API response and OpenAPI contract.
- Handle expired sessions, failed refreshes, and logout consistently.

### Dashboard

Show backend-supported metrics such as total/active projects, task totals and completion, overdue work, recent activities, upcoming deadlines, project progress, and productivity trends. Use analytics endpoints and explain empty or unavailable data clearly.

### Organization management

- Create and list organizations; switch organization context.
- View and update organization details/settings.
- Invite members, list invitations, and revoke pending invitations.
- Accept an invitation through the backend's invitation token flow.

### Team management

- Paginated member list with supported search/filter options.
- Member details where supported, role assignment, and member removal.
- Display invitation state and role information.
- Render actions according to backend permissions, while still handling backend 403 responses safely.

### Project management

- List, create, view, update, archive, restore, and delete projects where the API permits.
- Manage project members and supported project roles.
- Provide grid/list views and project progress. Do not persist a frontend view preference as backend data unless the API supports it.

### Task management

- Create, read, update, and delete tasks.
- Assign/unassign members; edit status, priority, deadline, labels, subtasks, and dependencies as supported.
- Search, filter, sort, and paginate using backend-supported parameters.
- Provide My Tasks and project-scoped task views.

### Task views

- List/table, Kanban, calendar, and My Tasks views.
- For Kanban drag-and-drop, persist status changes through the API; use optimistic updates only when rollback is implemented and testable.
- Do not assume a calendar endpoint exists. Build the calendar view from available task data and server pagination/filtering, or document the API dependency.

### Task details and collaboration

Show task title, description, status, priority, assignee, deadline, labels, subtasks, dependencies, comments, and activity history as available. Support comment creation/editing/deletion and mentions according to the backend contract.

### Notifications

- Notification center, unread count, mark-as-read, mark-all-as-read, filtering, and navigation to related resources.
- Implement real-time updates only if the backend supports them; otherwise use a sensible refetch/polling strategy with no unnecessary requests.

### Analytics and settings

- Analytics for project completion, task distribution, overdue tasks, member workload, and productivity trends, with supported date filters.
- User profile, password management, notification/theme preferences, account settings, and organization settings only where API support exists. Keep purely local preferences clearly client-side.

## 6. Frontend Architecture

Use feature-based modular architecture. Keep components small and composable; separate UI primitives, feature components, API services, hooks, schemas, and state.

Suggested structure:

```text
worksphere-frontend/
├── public/
├── src/
│   ├── main.jsx
│   ├── App.jsx
│   ├── app/
│   │   ├── router/
│   │   ├── providers/
│   │   └── layouts/
│   ├── components/
│   │   ├── ui/
│   │   ├── common/
│   │   ├── forms/
│   │   ├── tables/
│   │   └── charts/
│   ├── features/
│   │   ├── auth/
│   │   ├── dashboard/
│   │   ├── organizations/
│   │   ├── members/
│   │   ├── projects/
│   │   ├── tasks/
│   │   ├── comments/
│   │   ├── notifications/
│   │   ├── activity/
│   │   ├── analytics/
│   │   └── settings/
│   ├── hooks/
│   ├── lib/
│   ├── services/
│   ├── stores/
│   ├── schemas/
│   ├── styles/
│   └── utils/
├── tests/
├── .env.example
├── package.json
└── README.md
```

Adjust the structure when the project size warrants it, but keep feature boundaries and import direction clear. Do not place all business logic in page components.

## 7. API Integration

The local development API base is typically:

```env
VITE_API_BASE_URL=http://localhost:3000/api/v1
```

Use a same-origin relative URL or Vite proxy when appropriate. Never make browser code call a sandbox's `localhost` to reach a remote service. Keep `.env.example` free of real secrets.

Create a centralized Axios client and typed-by-contract (but JavaScript) service layer. Implement:

- Request/response interceptors and consistent API-envelope handling.
- `withCredentials` for refresh-cookie operations.
- A concurrency-safe refresh flow so parallel 401 responses do not trigger multiple refresh requests.
- Global error normalization, request cancellation, and sensible timeout behavior.
- TanStack Query for server state, caching, invalidation, and pagination; Zustand only for client/UI state that is not server-owned.
- No unnecessary copies of server data in Zustand.

**Contract rules:**

1. Use the WorkSphere backend OpenAPI document and API documentation as the source of truth (`/openapi.json`, `/api-docs`, and the backend repository's `docs/API_DOCUMENTATION.md`).
2. Never invent endpoint paths, query parameters, role rules, or response shapes.
3. If the contract is unclear, inspect the backend OpenAPI definition and ask for clarification rather than guessing.
4. If a feature is unavailable, document the dependency. Isolated mock data may be used only for development/storybook/tests and must be clearly identified as mock data.

## 8. Authentication and Security

- Separate public and protected routes; handle deep links and post-login return paths safely.
- Use role/permission information only to improve UX. The backend remains the security boundary and authoritative source for authorization.
- Hide or disable actions the user cannot perform when permission information is available, but always handle backend 401/403 responses.
- Handle session expiration, failed refresh, logout, and revoked sessions without redirect loops.
- Never store passwords, access tokens unnecessarily, or refresh tokens in localStorage/sessionStorage. Prefer the backend's HttpOnly refresh cookie.
- Protect against XSS, unsafe URL rendering, leaking personal data into logs, and accidental exposure of environment secrets.
- Do not rely on frontend checks for organization isolation, project visibility, or role enforcement.

## 9. Performance

Implement route-based lazy loading, debounced search, server-side pagination, efficient rendering, query caching, request cancellation, and careful invalidation. Use optimistic updates only where conflict/error rollback is correct. Avoid duplicate fetches, oversized bundles, and unnecessary global state.

## 10. Responsive Design

Support desktop, laptop, tablet, and mobile. Design mobile navigation, forms, tables, Kanban interactions, dialogs, and dashboards for touch and narrow viewports; do not merely shrink the desktop layout. Test keyboard, touch, and screen-reader behavior where feasible.

## 11. Testing

Use Vitest and React Testing Library for components, hooks, forms, state, API service behavior, and utilities. Use Playwright for workflows such as:

- Registration, login, session refresh, and logout.
- Organization creation/switching and member/invitation workflows.
- Project creation and task CRUD/assignment/status changes.
- Comments, notifications, and permission-aware actions.

Test loading, success, empty, validation, network-error, expired-session, and forbidden states. Add responsive and accessibility checks. Use mocked APIs for deterministic UI tests; run end-to-end tests against an isolated backend/test environment, never production.

## 12. Git and GitHub Workflow

Maintain a separate GitHub repository for the frontend. Branch from the latest `develop`; never implement directly on `main` or `develop`, and never push feature implementation directly to `develop`.

Suggested feature branches:

```text
feature/frontend-foundation
feature/dashboard-layout
feature/authentication
feature/organization-management
feature/team-management
feature/project-management
feature/task-management
feature/kanban-calendar
feature/collaboration
feature/notifications
feature/analytics-dashboard
feature/user-settings
feature/frontend-testing
feature/production-readiness
```

Suggested fixes/refactors/docs branches:

```text
bugfix/fix-login-validation
bugfix/fix-mobile-sidebar
bugfix/fix-task-filtering
refactor/api-service-layer
refactor/component-architecture
refactor/state-management
docs/update-frontend-readme
docs/add-component-guidelines
```

Rules:

- Keep branches focused; use Conventional Commits.
- Push feature branches and open pull requests targeting `develop`.
- Review changes, address comments, pass required CI, and merge only after approval.
- Delete merged feature branches. Protect `main` and `develop` with branch protection and required checks.
- Solo development still requires a self-review; seek independent approval when collaborating.

Commit examples:

```text
feat(auth): implement login page
feat(dashboard): add analytics cards
feat(tasks): implement kanban board
fix(tasks): fix status update
refactor(api): centralize axios configuration
test(auth): add login tests
docs(readme): update setup instructions
```

Every PR must contain an overview, implemented changes, screenshots for UI changes, API integration details, tests performed, known limitations, and a checklist.

## 13. CI/CD

Use GitHub Actions without Docker/container-based workflows. On every PR, run dependency installation, ESLint, unit/component tests, build verification, relevant integration tests, and dependency security checks. Keep CI reproducible and fail on lint, test, or production-build errors. Document deployment configuration; do not invent a deployment provider or commit deployment secrets.

## 14. Phase-by-Phase Development

Complete one phase at a time. Each phase must include a working implementation, relevant tests, documentation updates, a successful production build, and a PR to `develop` before proceeding.

### Phase 1 — Project Foundation

Initialize React with Vite; configure JavaScript/JSX, dependencies, Tailwind, shadcn/ui, routing, ESLint, Prettier, environment variables, and the feature-based folder structure.

**Deliverable:** running React application with verified development server and production build.
**Branch:** `feature/frontend-foundation`

### Phase 2 — Design System and Layout

Create reusable design tokens/components, sidebar, header, breadcrumbs, organization switcher, profile dropdown, theme support, and responsive dashboard shell.

**Deliverable:** complete responsive dashboard shell.
**Branch:** `feature/dashboard-layout`

### Phase 3 — Authentication

Implement registration, login, logout, forgot/reset password, Axios client, auth/session state, protected/public routes, cookie-aware refresh, and error handling. Email verification must follow the backend's current configuration and contract: it is disabled by default; do not block signup/login until the backend enables it and provides a working mail flow.

**Deliverable:** tested authentication flow matching the backend.
**Branch:** `feature/authentication`

### Phase 4 — Organization Management

Implement organization creation/listing/switching/details/settings and invitation list/create/revoke/accept flows supported by the API.

**Deliverable:** organization management interface.
**Branch:** `feature/organization-management`

### Phase 5 — Team Management

Implement member listing, supported search/filtering/pagination, invitation status, role management, and member removal with permission-aware UI.

**Deliverable:** team management interface.
**Branch:** `feature/team-management`

### Phase 6 — Project Management

Implement project list/create/edit/archive/restore/details/deletion and project membership. Add grid/list views and project progress from real API data.

**Deliverable:** project management interface.
**Branch:** `feature/project-management`

### Phase 7 — Task Management

Implement task CRUD, assignment, priority/status/deadline/labels, subtasks, dependencies, My Tasks, and backend-supported search/filter/sort/pagination.

**Deliverable:** complete task management interface.
**Branch:** `feature/task-management`

### Phase 8 — Kanban and Calendar

Implement drag-and-drop Kanban with backend synchronization, optimistic update rollback, and calendar view from supported task data. Document any missing backend calendar capability.

**Deliverable:** tested Kanban and calendar interfaces.
**Branch:** `feature/kanban-calendar`

### Phase 9 — Collaboration

Implement task comments, mentions, editing/deletion, and activity timeline using backend contracts and permissions.

**Deliverable:** collaboration interface.
**Branch:** `feature/collaboration`

### Phase 10 — Notifications

Implement notification center, unread count, read/read-all, filtering, and notification navigation. Add real-time updates only if the backend supports them.

**Deliverable:** notification system.
**Branch:** `feature/notifications`

### Phase 11 — Dashboard and Analytics

Implement dashboard statistics, project progress, task distributions, completion metrics, member workload, productivity trends, and supported date filters.

**Deliverable:** analytics dashboard backed by API data.
**Branch:** `feature/analytics-dashboard`

### Phase 12 — Settings

Implement profile settings, password management, theme/local preferences, account settings, and supported organization settings.

**Deliverable:** settings interfaces.
**Branch:** `feature/user-settings`

### Phase 13 — Testing and QA

Complete component/hook/form/API tests, authentication tests, end-to-end workflows, responsive checks, accessibility review, and error/loading/empty-state coverage.

**Deliverable:** reliable test suite and QA report.
**Branch:** `feature/frontend-testing`

### Phase 14 — Production Readiness

Optimize performance, lazy loading, bundle size, accessibility, and request behavior. Perform security review, validate environment configuration, document deployment, and configure CI/CD.

**Deliverable:** production-ready frontend candidate.
**Branch:** `feature/production-readiness`

### Phase 15 — Final Integration and Release

Verify all backend integrations and API consistency; test complete user workflows; fix integration issues; update documentation; and perform final responsive, accessibility, and security QA.

**Workflow:** `feature/* → develop → release PR → main`
**Deliverable:** complete WorkSphere frontend release.
**Branch:** `feature/frontend-release`

## 15. Documentation Requirements

Maintain and update these files as the frontend evolves:

```text
README.md
ARCHITECTURE.md
CONTRIBUTING.md
API_INTEGRATION.md
COMPONENT_GUIDELINES.md
TESTING.md
CHANGELOG.md
```

Document setup, required software, environment configuration, frontend architecture, API authentication/refresh behavior, API conventions, testing, Git workflow, and deployment. Keep examples accurate to the actual backend contract. Never include real secrets.

## 16. AI Development Rules

- Work on one phase at a time; do not silently proceed to later phases.
- Before implementation, explain the phase's architecture, dependencies, folder impact, backend dependencies, and verification plan.
- Provide complete runnable code; use JavaScript/JSX only.
- Never introduce TypeScript or Docker.
- Never invent backend endpoints, fields, permissions, or response structures.
- Follow the backend API contracts; clearly identify any mock data and unsupported backend dependency.
- Implement loading, success, empty, validation, and failure states.
- Write relevant tests and explain how to run them.
- Follow the Git/PR standards and update documentation.
- Do not claim a phase is complete until its acceptance checks pass.
- Avoid unnecessary dependencies, abstractions, and unrelated changes.

## 17. Starting Instruction

Start with **Phase 1 only**. Before changing files, explain:

1. The frontend architecture and dependency choices.
2. The proposed folder structure.
3. How the frontend will integrate with the backend OpenAPI contract and cookie-based refresh flow.
4. Project initialization, routing, and providers.
5. The design-system setup and how the app will be verified.

Then implement the foundation incrementally. Verify that the application starts and the production build succeeds before proceeding to Phase 2.
