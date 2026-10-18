# Feature Specification: Browser Authentication for the Dashboard

**Feature Branch**: `main` (no feature branch was created)

**Created**: 2026-10-17

**Status**: Draft

**Input**: User description: "the auth is jwt http-only"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Sign In and Enter the Workspace (Priority: P1)

A registered construction-company user signs in and reaches only the dashboard content that their
account is allowed to see. An unauthenticated visitor cannot view protected site, people, product,
finance, or CRM pages.

**Why this priority**: Company and employee data must not appear before the user is authenticated.

**Independent Test**: With a valid account, sign in and open a protected page; with no session or an
invalid password, try the same page and verify that its content remains unavailable.

**Acceptance Scenarios**:

1. **Given** a visitor opens a protected dashboard page without a valid session, **When** the page
   loads, **Then** the visitor sees sign-in rather than protected content.
2. **Given** a registered user enters valid credentials, **When** sign-in succeeds, **Then** the user
   reaches the intended authorized page and remains signed in on subsequent navigation.
3. **Given** invalid credentials, **When** sign-in fails, **Then** a clear error is shown, no
   protected content is displayed, and the entered password is not retained in persistent storage.
4. **Given** sign-in succeeds, **When** browser scripts inspect accessible storage, **Then** no
   authentication JWT is available there; the browser manages the HttpOnly authentication cookie.

---

### User Story 2 - Continue an Existing Session (Priority: P2)

A signed-in user reloads the dashboard or returns while their session remains valid. The product
checks their current session rather than assuming that a remembered screen means they are still
signed in. If the short-lived access expires but the session is still renewable, the user can keep
working without re-entering credentials.

**Why this priority**: A dashboard session must remain reliable across refreshes and normal token
expiry without exposing tokens to frontend code.

**Independent Test**: Start with a valid session, reload a protected page, let access expire while
renewal remains valid, and verify the user can continue; repeat with an invalid renewal and verify
access is denied.

**Acceptance Scenarios**:

1. **Given** a valid signed-in session, **When** the user reloads a protected page, **Then** their
   identity is confirmed and the page remains available.
2. **Given** access has expired but renewal is valid, **When** the user requests protected content,
   **Then** the session is renewed and the request completes without exposing token values.
3. **Given** both access and renewal are invalid, **When** the user opens protected content, **Then**
   the product returns to sign-in and does not show stale protected data as current.

---

### User Story 3 - Sign Out and Handle Denied Access (Priority: P3)

A user signs out when finished. Their previous protected view cannot be used to access data after
sign-out. If they are signed in but lack permission for a page, they receive an access-denied state
rather than being treated as signed out.

**Why this priority**: Shared devices and company-specific permissions require clear session
termination and understandable access feedback.

**Independent Test**: Sign in, sign out, then revisit the protected page; separately open a page
forbidden to a signed-in user and verify the two outcomes differ.

**Acceptance Scenarios**:

1. **Given** a signed-in user, **When** they sign out, **Then** the session ends and a protected page
   requires sign-in again, including after a reload.
2. **Given** a signed-in user requests a page they are not allowed to view, **When** access is denied,
   **Then** the page shows an access-denied message without disclosing its protected data.
3. **Given** a session has expired, **When** the user attempts a change, **Then** the change is not
   applied and the user is prompted to sign in again.

### Edge Cases

- While session status is being checked, protected content stays hidden; a delayed response must not
  briefly expose data from a previous user.
- A failed renewal or network error must not trigger an endless retry or report success for a change
  that was not confirmed.
- After sign-out, cached protected data must not be presented as current to the next browser user.
- An authentication failure and a permission denial must lead to distinct, non-revealing messages.
- Unsafe actions without valid request-forgery protection must be rejected even when a browser sends
  an authentication cookie automatically.
- Switching company context must not make another company's records visible without authorization.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The product MUST require a verified signed-in session before displaying protected
  dashboard content or allowing protected actions.
- **FR-002**: Users MUST be able to sign in with their registered credentials and receive an
  authenticated browser session without handling an authentication token manually.
- **FR-003**: The access credential MUST be a JWT carried in an HttpOnly browser cookie; frontend
  code MUST NOT read, copy, log, or persist its value in browser-accessible storage.
- **FR-004**: The product MUST determine the current user's identity and signed-in status from the
  server, not from decoding a browser-accessible token or trusting a saved UI flag.
- **FR-005**: A valid session MUST survive page reload and normal navigation; expired access MUST be
  renewed through the existing browser-managed session without exposing token values.
- **FR-006**: If session renewal fails, the product MUST stop protected requests, clear protected
  client-side views, and direct the user to sign-in without an unbounded retry loop.
- **FR-007**: Signing out MUST invalidate the server-side browser session and prevent further access
  to protected content with that session.
- **FR-008**: State-changing requests made with browser-managed authentication MUST include the
  server-required request-forgery proof; requests lacking valid proof MUST NOT change data.
- **FR-009**: The product MUST distinguish unauthenticated access from authenticated but forbidden
  access without revealing protected records in either state.
- **FR-010**: Sign-in and session errors MUST be understandable to users and MUST NOT expose token
  values, passwords, or sensitive account details.
- **FR-011**: Authentication and authorization MUST respect the selected company workspace so a
  valid login alone never grants access to another company's records.

### Key Entities *(include if feature involves data)*

- **User account**: A registered person who can sign in and has identity and company permissions.
- **Browser session**: The authenticated, revocable relationship between a user and one browser.
- **Access credential**: A short-lived JWT carried only as an HttpOnly cookie for protected access.
- **Renewal credential**: A separate browser-managed credential used to continue a valid session;
  it is not assumed to be a JWT.
- **Request-forgery proof**: The server-issued value required to authorize state-changing browser
  requests that use cookies.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: At least 90% of registered test users can sign in and reach an authorized dashboard
  page in under 1 minute without assistance.
- **SC-002**: In all tested unauthenticated and forbidden access attempts, protected records remain
  hidden from the page and the attempted action is not applied.
- **SC-003**: In all tested sign-in, reload, renewal, and sign-out flows, no authentication JWT is
  readable through browser-accessible storage or displayed in the interface.
- **SC-004**: In at least 95% of valid-session reload tests, users return to their authorized page
  without signing in again.
- **SC-005**: In all tested expired-session and sign-out flows, a later request for protected data
  requires a new valid session and does not display previously cached records as current.
- **SC-006**: At least 90% of usability-test participants can tell the difference between a sign-in
  failure and an access-denied state without assistance.

## Assumptions

- This feature specifies browser authentication for the dashboard; registration, email verification,
  password recovery, and third-party sign-in are separate features.
- The existing backend is the source of truth for account identity, session validity, permissions,
  session renewal, and sign-out.
- The backend currently places a JWT access credential in an HttpOnly cookie and uses a separate
  opaque renewal credential in another HttpOnly cookie. The user's "jwt http-only" instruction applies
  to the access credential; it does not imply that the renewal credential is also a JWT.
- The backend supplies request-forgery protection for state-changing browser requests. Exact cookie,
  request, and response details are confirmed against the documented backend contract during planning.
- Company access rules remain those specified by the construction operations workspace feature;
  this feature does not define a new company role model.
