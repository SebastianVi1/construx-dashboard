# Implementation Plan: Login and Registration Screens

**Branch**: `main` (feature directory `003-auth-entry-screens`) | **Date**: 2026-10-17 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/003-auth-entry-screens/spec.md`

## Summary

Build only two frontend routes, Login and Registration, using the existing React/Vite app. Both forms
validate input locally, call the user-owned authentication backend with browser-managed cookies and
CSRF proof, and expose loading, success, and recoverable error states. Registration ends with neutral
check-email guidance; it does not create a signed-in frontend session or a verification screen.
The two screens share the proposed visual language in the project-root [`design.md`](../../design.md),
without redesigning the existing application landing route.

## Technical Context

**Language/Version**: TypeScript 6, React 19

**Primary Dependencies**: Vite 8, Zod 4 (already installed), React Router declarative mode (to add)

**Storage**: No frontend persistence of passwords or tokens; backend owns accounts and cookies

**Testing**: `bun run test` (Bun's built-in runner), `bun run lint`, `bun run build`, and browser checks in `quickstart.md`

**Target Platform**: Modern desktop and mobile browsers

**Project Type**: Single frontend application; backend remains outside this repository

**Performance Goals**: Forms remain interactive during requests; no large animation, remote font dependency, or new UI library

**Constraints**: Frontend-only edits; simple blue visual system; accessible forms; HttpOnly JWT access
cookie; CSRF for unsafe requests; public API base URL from environment configuration

**Scale/Scope**: Two routes (`/login`, `/register`), one small auth API adapter, no other auth flows

## Constitution Check

| Principle or rule | Planning result |
| --- | --- |
| Clear, consistent blue UI; purposeful motion; speed and KISS | Pass: two routes, one shared auth layout, native form controls, and the restrained tokens in `design.md`; no motion is required for access. |
| Public environment configuration, no secrets | Pass: public API base URL documented in `.env.example`; no credential or secret stored there. |
| Zod at external-data boundaries | Pass: validate CSRF JSON, optional identity JSON, and JSON error bodies before use. |
| React Router navigation | Pass: declarative routes for `/login` and `/register`. |
| Redux for shared cross-feature state | Not needed in this slice: form state stays local; no shared cross-route state is introduced. |
| Swagger/OpenAPI contract | Approved for this frontend slice: the user accepted `contracts/auth-api-observed.openapi.yaml` as the integration contract on 2026-10-17. Reconcile it before a later backend-contract change; this approval does not authorize backend edits. |
| JSON success and error responses | Reviewed exception approved by the user on 2026-10-17: register returns bodyless `202` and login returns bodyless `204`. A `204` response cannot carry JSON. JSON CSRF and problem representations are validated. |

**Post-design check**: The design uses only frontend files. The user accepted the observed API mirror
and bodyless-success exception for this implementation; neither decision changes backend ownership.

## Screen and Interaction Design

### Shared visual shell

- Use a single-column form surface on the `design.md` canvas, approximately 400–440 px wide on
  desktop and fluid with 16–24 px page gutters on narrow screens. The reading order is brand,
  page title, one-sentence instruction, labelled fields, feedback, primary action, then the
  alternate-screen link and link back to the existing application entry point. No marketing split
  panel, stock construction image, or decorative chart is needed for a two-field task.
- Map `design.md` semantic colors to global CSS properties once; the auth stylesheet consumes those
  roles rather than copying hex values. Use its IBM Plex Sans stack with immediate system fallback;
  do not block rendering on a remote font or add a font package just for these screens.
- Use the documented 44 px control height, medium control radius, visible blue focus treatment,
  restrained border/surface hierarchy, and sentence-case labels. Avoid motion beyond brief feedback;
  reduced-motion users receive equivalent immediate state changes.

### Route content

| Route | Main content | Confirmed outcome |
| --- | --- | --- |
| `/login` | “Sign in” heading, email and password fields, “Sign in” action, and a “Create an account” link. | After backend-confirmed login, navigate to the existing app landing route; do not display a token or imply that this slice built a protected dashboard. |
| `/register` | “Create an account” heading, email and password fields, “Create account” action, and a “Sign in” link. | Replace the form result with the same neutral “Check your email” guidance for newly registered and already-used addresses; do not sign in. |

Use native email and password inputs with persistent labels and appropriate autocomplete values.
Do not add a password-confirmation field, password-reset route, or email-verification screen: none
belongs to this specification. Passwords remain in the active form only and are cleared on exit.

### State behavior

| State | Both screens | Route-specific detail |
| --- | --- | --- |
| Invalid input | Show field-level guidance beside the field; focus the first invalid field; send no request. | Registration uses the confirmed backend minimum password length, currently observed as 12. |
| Submitting | Keep labels and button geometry stable, show progress in text, and prevent a second submission. | Do not change routes before the backend confirms success. |
| Request or server failure | Keep the form available with a non-revealing, recoverable message; do not echo secrets or raw server errors. | Login does not disclose which credential was wrong; Registration does not disclose account existence. |
| Success | Announce the outcome accessibly, then follow the route contract. | Login leaves the form; Registration stays on a neutral check-email state. |

Inline errors need programmatic association with their fields; form-level status needs a live
announcement without moving the primary action. Keyboard order, visible focus, and screen-reader
labels must hold at desktop and narrow widths.

### Integration sequence and gates

1. Use the user-approved `contracts/auth-api-observed.openapi.yaml` for this frontend slice and
   retain the bodyless-success constitution exception recorded above.
2. Add React Router and the public API URL configuration, then the Zod schemas and one cookie/CSRF
   request adapter. Keep form state local; Redux is not needed for values that never cross routes.
3. Build the shared auth shell, Login, then Registration. Wire `/login` and `/register` without
   adding session restoration, route guards, logout, or any backend implementation.
4. Check the scenarios in `quickstart.md`, including invalid input, pending state, network errors,
   neutral registration acceptance, cookies/CSRF, keyboard access, reduced motion, and 360 px,
   768 px, and desktop-width layouts. Run lint and build; do not call those behavior tests.

## Project Structure

### Documentation (this feature)

```text
specs/003-auth-entry-screens/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── auth-api-observed.openapi.yaml
│   └── auth-ui.md
└── tasks.md
```

### Source Code (repository root)

```text
src/
├── main.tsx                         # Mount router
├── App.tsx                          # Preserve app landing; add auth routes
├── index.css                        # Single semantic token mapping for auth screens
├── config/env.ts                    # Public API base URL validation
└── features/auth/
    ├── AuthLayout.tsx               # Shared visual shell
    ├── AuthForm.tsx                 # Shared form interaction and state
    ├── LoginPage.tsx                # Login form
    ├── RegisterPage.tsx             # Registration form
    ├── authApi.ts                   # Cookie/CSRF-aware backend calls
    ├── schemas.ts                   # Zod input and response schemas
    ├── auth.test.ts                 # Focused Bun schema and API boundary checks
    └── auth.css                     # Blue, responsive auth styles
.env.example                         # Non-secret public API and local proxy configuration
vite.config.ts                       # Development-only API proxy if same-origin dev is used
```

**Structure Decision**: Keep the two screens and their adapter together in one feature directory.
Use local form state, one small request boundary, and no new global state layer for this slice.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
| --- | --- | --- |
| Bodyless `202`/`204` auth success conflicts with the constitution's JSON-success wording | Existing user-owned backend contract is status-and-cookie based; login `204` legally has no body. The frontend must handle it rather than invent a JSON payload. | Treating empty success as JSON would create a parse failure or require out-of-scope backend changes. Record and review this exception before implementation. |
