# Feature Specification: Login and Registration Screens

**Feature Branch**: `main` (no feature branch was created)

**Created**: 2026-10-17

**Status**: Draft

**Input**: User descriptions: "I need the task needed for just the login register screens" and "just the screens and the nedded connections to backend y would define the endpoints and everithyng i just need frontend"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Sign In from the Login Screen (Priority: P1)

A registered user opens a dedicated login screen, enters email and password, and submits the form.
The screen uses the existing backend authentication service and hands a successful user back to the
application without displaying or storing a token in frontend code.

**Why this priority**: A functional login screen is the smallest useful entry point to the dashboard.

**Independent Test**: From a fresh browser, use valid and invalid credentials; verify success leaves
the login screen, failure stays on it with a useful message, and no token appears in readable storage.

**Acceptance Scenarios**:

1. **Given** a user opens Login, **When** they enter a valid email and password and submit, **Then**
   the form authenticates with the backend and directs them to the application's existing landing
   route without showing or storing the authentication token.
2. **Given** invalid credentials, **When** the user submits, **Then** the screen remains available,
   shows a non-revealing error, and allows another attempt.
3. **Given** an invalid email or empty password, **When** the user submits, **Then** field-level
   guidance appears and no authentication request is sent.
4. **Given** a request is in progress, **When** the user submits again, **Then** a second request is
   not sent and the form communicates that it is working.

---

### User Story 2 - Request an Account from the Registration Screen (Priority: P2)

A new user opens a dedicated registration screen, enters an email and password, and submits the form.
The screen sends the request to the existing backend and shows neutral guidance to check email for
verification. It does not imply the account is signed in or reveal whether the email was already
registered.

**Why this priority**: New users need an accessible way to start account creation, but email
verification is handled outside these two screens.

**Independent Test**: Submit valid, invalid, and already-used email details; verify validation,
backend request handling, and the same neutral accepted state for valid and already-used addresses.

**Acceptance Scenarios**:

1. **Given** a new user enters a valid email and a password meeting backend requirements, **When**
   they submit Registration, **Then** the request is accepted and the screen tells them to check
   email for the next step without claiming they are signed in.
2. **Given** an already-used email is submitted, **When** the backend accepts the request, **Then**
   the screen shows the same neutral check-email guidance as for a new address.
3. **Given** an invalid email or password shorter than the required minimum, **When** the user
   submits, **Then** field-level guidance appears and no registration request is sent.
4. **Given** a request fails or cannot reach the backend, **When** Registration remains open,
   **Then** the user sees a recoverable error and can retry without duplicate submissions.

### Edge Cases

- A backend validation or authentication error must not expose credentials, cookie values, or
  whether a registration email already belongs to an account.
- The form must not treat an accepted registration response as an authenticated session.
- Network failure, slow response, or malformed error data must produce a clear recoverable state;
  success must not be shown without a confirmed backend response.
- Login and Registration remain usable with keyboard navigation, screen readers, narrow screens,
  and reduced-motion preferences.
- Switching between screens does not carry a password into the other form or persist it in browser
  storage.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The frontend MUST offer distinct Login and Registration screens with clear navigation
  between them and back to the existing application entry point.
- **FR-002**: Login MUST collect email and password, validate required input before submission, send
  one backend authentication request, and handle success and failure distinctly.
- **FR-003**: On successful Login, the frontend MUST rely on the backend-managed JWT in an HttpOnly
  cookie; it MUST NOT read, display, log, or persist an authentication token.
- **FR-004**: Registration MUST collect email and password, validate email format and the backend's
  minimum password length before submission, and send one backend registration request.
- **FR-005**: An accepted Registration request MUST show neutral check-email guidance, including for
  an already-used address, and MUST NOT treat the user as signed in.
- **FR-006**: Both forms MUST provide accessible field labels, validation feedback, submit progress,
  and recoverable network/server error states without exposing sensitive details.
- **FR-007**: Both backend submissions MUST include the server-required request-forgery proof and
  browser-managed credentials when required by the confirmed endpoint contract.
- **FR-008**: Both screens MUST use the dashboard's simple blue visual system, work on desktop and
  narrow mobile screens, and respect reduced-motion preferences.
- **FR-009**: Password values MUST remain local to the active form, MUST NOT be saved in persistent
  browser storage, and MUST NOT be transferred between Login and Registration.

### Key Entities *(include if feature involves data)*

- **Login submission**: Email and password provided for one sign-in attempt; no token is returned
  to frontend code for storage.
- **Registration submission**: Email and password provided to request account creation; acceptance
  leads to email verification outside these screens.
- **Form status**: Each screen's idle, invalid, submitting, accepted, or recoverable-error state.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: At least 90% of registered test users can complete Login in under 1 minute without
  assistance.
- **SC-002**: At least 90% of new test users can submit a valid Registration request in under
  2 minutes and correctly understand that email verification is still required.
- **SC-003**: In all tested submissions, invalid input sends no backend request and a repeated click
  while submitting sends no duplicate request.
- **SC-004**: In all tested Login and Registration flows, passwords and authentication tokens are
  absent from browser-accessible persistent storage and visible error messages.
- **SC-005**: In keyboard and narrow-screen checks, both forms can be completed without losing
  access to labels, validation messages, or the submit action.

## Assumptions

- This is a frontend-only slice: backend endpoints, account creation, email delivery, verification,
  and the post-login dashboard are owned by other work.
- The user will define or confirm the backend endpoint contract. Existing local backend source
  currently exposes login, registration, and request-forgery endpoints, but these are not assumed
  to be the final published contract.
- The existing backend currently requires a valid email and a password of at least 12 characters
  for registration; the confirmed backend contract takes precedence if that rule changes.
- Registration acceptance does not sign the user in; an email verification step follows elsewhere.
- Broader session restoration, renewal, sign-out, protected-route authorization, password recovery,
  and third-party sign-in remain in the separate browser-authentication feature, not this slice.
