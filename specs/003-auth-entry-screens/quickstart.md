# Validation Quickstart: Login and Registration Screens

This guide validates the frontend Login and Registration implementation.

## Prerequisites

1. Use the user-approved `contracts/auth-api-observed.openapi.yaml` for this frontend slice. Check
   any future backend contract revision against it before changing request wiring.
2. Run the existing backend with its email-delivery configuration and a test account. Use a safe
   disposable environment; never expose credentials in logs or screenshots.
3. Set only non-secret public API configuration using the frontend `.env.example` contract. Ensure
   the browser can reach the backend through the planned same-origin route or an explicitly
   configured credentialed cross-origin setup.

## Checks

1. Run `bun run lint` and `bun run build`; both must pass.
2. Start the frontend with `bun run dev`; open `/login` and `/register` on desktop and a narrow
   mobile viewport (including 360 px). Check the `design.md` blue system, readable labels, keyboard
   order, visible focus, error focus, cross-links, no horizontal overflow, and reduced-motion mode.
3. Submit invalid email or empty password on Login; no network request is sent. Submit bad
   credentials; the screen shows a recoverable error and no protected content.
4. Submit valid Login credentials. Confirm the backend response succeeds, authentication cookies
   are HttpOnly in browser tools, no token appears in script-readable storage, and the screen hands
   off to the existing application route.
5. Submit an invalid Registration email or password shorter than 12 characters; no request is sent.
   Submit valid details; the screen shows neutral check-email guidance and does not sign in.
6. Repeat Registration with an already-used address; the same neutral accepted guidance appears.
   Test network failure and repeated clicks; no false success or duplicate in-flight submission.
7. Confirm unsafe requests include the backend-issued CSRF proof. A missing or invalid proof must
   not be treated as success.

## Expected limitations

Email verification UI, session renewal, sign-out, protected-route guards, and the post-login
dashboard are separate work. This slice only provides the two entry screens and their direct backend
submissions.

## Implementation check record (2026-10-17)

- `bun run test`: passed five focused schema and API-boundary checks.
- `bun run lint`: passed.
- `bun run build`: passed TypeScript and Vite production build.
- Headless Chromium with mocked backend responses: passed invalid-input/no-request, first-invalid-field
  focus, generic login failure, duplicate-submit prevention, login navigation, registration minimum
  length, network-error recovery, neutral accepted result, and CSRF header checks.
- Headless Chromium layout: `/login` and `/register` had no horizontal overflow at 360, 768, and
  1440 px; controls measured 44 px high. Keyboard entry and existing landing route were checked.
- **Pending live backend verification**: Cookie attributes, actual email delivery, new-versus-duplicate
  registration equivalence, and the deployed same-origin proxy/CORS arrangement cannot be confirmed
  from mocked responses. Re-run checks 4–7 against a disposable backend before release. The mock
  checks do not prove those backend behaviors or the user success metrics in `spec.md`.
