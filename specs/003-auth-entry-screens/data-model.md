# Data Model: Login and Registration Screens

This frontend slice does not own or persist user accounts, passwords, or auth tokens. It owns only
transient form state and validates backend representations at the request boundary.

## Login form

| Field | Rule | Lifetime |
| --- | --- | --- |
| email | Required, valid email; trim surrounding whitespace before submission. | Active form only |
| password | Required, non-empty. | Active form only |
| status | Idle, invalid, submitting, or recoverable error. | Active form only |

Success transitions to the existing application landing route after the backend confirms login.
The password is discarded when leaving the screen.

## Registration form

| Field | Rule | Lifetime |
| --- | --- | --- |
| email | Required, valid email; trim surrounding whitespace before submission. | Active form only |
| password | Required, at least 12 characters in the observed backend contract. | Active form only |
| status | Idle, invalid, submitting, accepted, or recoverable error. | Active form only |

Accepted registration shows neutral check-email guidance. It does not create a frontend signed-in
state. The password is discarded when leaving the screen.

## Backend representations

- CSRF response: `headerName` and `token` strings, validated before use.
- Optional current-user response after login: `id` and `email` strings, validated before use.
- Error response: may be a JSON problem object; validate safe display fields and fall back to a
  generic message for malformed or absent data.
- Login and registration success: status plus browser-managed cookies or email action, with no JSON
  response body in the currently observed backend.
