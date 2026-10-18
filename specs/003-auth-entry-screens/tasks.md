---
description: "Frontend-only tasks for login and registration screens"
---

# Tasks: Login and Registration Screens

**Input**: Design documents from `specs/003-auth-entry-screens/`

**Prerequisites**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md), [data-model.md](data-model.md), [contracts/](contracts/)

**Tests**: Bun's built-in runner now covers input schemas and the API boundary without a new test
framework. Manual browser checks and lint/build remain required; live backend checks are pending.

**Organization**: Tasks are grouped by the two user stories. No backend implementation is included.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel with other marked tasks after its prerequisites are satisfied.
- **[Story]**: Maps to User Story 1 (Login) or User Story 2 (Registration).
- Every task names exact frontend or feature-document paths.

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Confirm the user-owned backend contract and prepare frontend routing/configuration.

- [x] T001 Confirm the user-owned Swagger/OpenAPI definitions for CSRF, Login, and Registration against `specs/003-auth-entry-screens/contracts/auth-api-observed.openapi.yaml`; record confirmed paths, fields, statuses, and review of the bodyless `202`/`204` governance exception in `specs/003-auth-entry-screens/research.md` before wiring requests.
- [x] T002 [P] Add the constitution-required React Router dependency with Bun in `package.json` and `bun.lock`, without adding Redux for local-only form state.
- [x] T003 [P] Document a non-secret public API base URL in `.env.example`, validate it in `src/config/env.ts`, and configure same-origin development `/api` proxying in `vite.config.ts` if the confirmed backend runs on another local origin.

**Checkpoint**: Endpoint contract and frontend configuration are ready; no backend file is changed.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Shared validation, transport, and visual shell for both screens.

- [x] T004 [P] Define Zod schemas for Login email/password, Registration email/password (observed minimum 12 characters), CSRF JSON, and safe problem-response fields in `src/features/auth/schemas.ts`; align constraints with the confirmed contract from T001.
- [x] T005 [P] Create a small shared blue, responsive and keyboard-accessible form shell in `src/features/auth/AuthLayout.tsx` and `src/features/auth/auth.css`, without retaining the Vite starter presentation in auth routes.
- [x] T006 Implement one cookie-aware request adapter in `src/features/auth/authApi.ts` using `src/config/env.ts` and `src/features/auth/schemas.ts`: obtain the backend CSRF proof, attach its returned header to unsafe requests, include browser credentials, handle bodyless success statuses, validate JSON error data, and never read or store JWT values.

**Checkpoint**: Both screens can use one verified backend boundary and one visual system.

---

## Phase 3: User Story 1 - Sign In from the Login Screen (Priority: P1) 🎯 MVP

**Goal**: A registered user can submit the Login form and leave it after confirmed backend success.

**Independent Test**: Submit valid, invalid, and empty credentials from a fresh browser; only valid
credentials leave Login, duplicate clicks do not duplicate requests, and no readable token appears.

- [x] T007 [US1] Build `src/features/auth/LoginPage.tsx` with labeled email/password fields, local Zod validation from `src/features/auth/schemas.ts`, one in-flight submit through `src/features/auth/authApi.ts`, non-revealing errors, password cleanup, and success handoff to the existing app landing route.
- [x] T008 [US1] Mount React Router in `src/main.tsx` and route `/login` plus the existing app landing in `src/App.tsx`; use `src/features/auth/AuthLayout.tsx` for Login without building protected-route guards or a new dashboard.

**Checkpoint**: User Story 1 works independently; follow Login scenarios in `quickstart.md`.

---

## Phase 4: User Story 2 - Request an Account from the Registration Screen (Priority: P2)

**Goal**: A new user can submit Registration and receive neutral check-email guidance.

**Independent Test**: Submit valid, invalid, and already-used email details; valid and already-used
requests show the same accepted state, invalid input makes no request, and no login is implied.

- [x] T009 [US2] Build `src/features/auth/RegisterPage.tsx` with labeled fields, local Zod validation from `src/features/auth/schemas.ts`, one in-flight submit through `src/features/auth/authApi.ts`, neutral accepted guidance, recoverable errors, and password cleanup.
- [x] T010 [US2] Add `/register` to `src/App.tsx` and cross-links in `src/features/auth/LoginPage.tsx` and `src/features/auth/RegisterPage.tsx`; keep verification, password recovery, and other auth flows out of this change.

**Checkpoint**: Both screens work independently; follow Registration scenarios in `quickstart.md`.

---

## Phase 5: Polish & Cross-Cutting Concerns

**Purpose**: Verify the two-screen slice without expanding its scope.

- [x] T011 Check desktop/mobile layout, keyboard order, visible focus, accessible error announcements, and reduced motion on both screens; correct only affected styles in `src/features/auth/auth.css` and global conflicts in `src/App.css` or `src/index.css`.
- [ ] T012 Run `bun run lint`, `bun run build`, and the manual browser scenarios in `specs/003-auth-entry-screens/quickstart.md`; record observed pass/fail and any backend-contract dependency in `specs/003-auth-entry-screens/quickstart.md` without claiming automated behavior coverage.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup**: T001 is a blocking contract gate for API wiring. T002 and T003 can proceed in parallel.
- **Foundational**: T004 follows T001; T005 can run after setup independently; T006 follows T001,
  T003, and T004.
- **User Story 1**: T007 follows T004-T006; T008 follows T002, T005, and T007.
- **User Story 2**: T009 follows T004-T006; T010 follows T002, T005, T008, and T009 because it
  extends the shared route and Login link.
- **Polish**: T011-T012 follow both desired stories.

### User Story Dependencies

- **US1 (P1)**: Can complete after the foundation; this is the suggested MVP.
- **US2 (P2)**: Its form can be built after the foundation independently of US1, but route/link
  integration follows US1 because both touch `src/App.tsx` and `src/features/auth/LoginPage.tsx`.

### Parallel Opportunities

- T002 and T003 touch disjoint setup files and can proceed together.
- T004 and T005 touch disjoint foundation files and can proceed together after their prerequisites.
- T007 (Login page) and T009 (Registration page) touch different files and can be built together
  after T006, but route/link integration stays sequential.

## Parallel Example: User Story 1

After T006, build `src/features/auth/LoginPage.tsx` (T007). There is no safe parallel task inside
US1 because T008 imports that page and owns `src/App.tsx`.

## Parallel Example: User Story 2

After T006, build `src/features/auth/RegisterPage.tsx` (T009) alongside T007 if desired. Integrate
its route and cross-links (T010) only after both page files exist.

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete T001-T006, including confirmation of the user-owned API contract and governance exception.
2. Complete T007-T008 and manually validate Login in `quickstart.md`.
3. Stop before Registration if only a login MVP is needed; do not add broader auth infrastructure.

### Incremental Delivery

1. Add T009-T010 for Registration and its neutral check-email result.
2. Complete T011-T012 for responsive, accessible, security-conscious verification of both screens.
3. Leave email verification, session renewal, logout, route guards, and backend work for their own
   authorized features.

## Notes

- `contracts/auth-api-observed.openapi.yaml` was approved by the user as the integration contract
  for this frontend slice on 2026-10-17. It remains a frontend mirror, not a backend publication.
  If the backend contract later differs, reconcile the adapter before deployment.
- Current backend source returns `202` without a body for Registration and `204` without a body for
  Login; parse JSON only when a representation exists. The constitution exception is explicit in
  `plan.md` and was accepted by the user on 2026-10-17.
- Current backend sends verification email after a new registration; this slice shows check-email
  guidance but does not build the verification destination.
- T007, T009, and T010 use `src/features/auth/AuthForm.tsx` for their shared form behavior and
  cross-links; `LoginPage.tsx` and `RegisterPage.tsx` are route-specific wrappers. T012 remains
  open until the live backend checks recorded in `quickstart.md` can be run.
