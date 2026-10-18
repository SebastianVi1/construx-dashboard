# Research: Login and Registration Screens

## Decisions

| Topic | Decision and rationale | Alternative considered |
| --- | --- | --- |
| Feature boundary | Keep this as a separate two-screen feature from the broader `002-jwt-cookie-auth` spec. Registration was intentionally excluded from that earlier feature, while this request is only about entry screens. | Expanding the broad auth feature would force unrelated renewal, logout, and route-guard tasks into this list. |
| Routing | Use React Router's declarative browser routes for `/login` and `/register`; it supports a small client-side route tree without a data-router layer. [React Router routing](https://reactrouter.com/start/declarative/routing) | Manual URL switching would violate the constitution's router choice. |
| State | Keep each form's input and status local. Do not add Redux until state must cross routes or features. | Global auth-form state would add complexity and increase the chance of retaining passwords. |
| API transport | Use a single frontend auth adapter with browser-managed credentials and the backend-issued CSRF header for unsafe calls. Never read or store the JWT. | Reading a token from a response or browser storage contradicts the verified HttpOnly-cookie contract. |
| API location | Use a non-secret public API base URL from environment configuration; prefer same-origin `/api` routing in development and deployment to avoid relying on unconfirmed credentialed CORS. Vite supports both public env variables and a development proxy. [Vite env](https://vite.dev/guide/env-and-mode), [Vite proxy](https://vite.dev/config/server-options.html#server-proxy) | Hard-coded deployment URLs violate the constitution; assuming cross-origin cookies work would be unverified. |
| Registration result | Treat accepted registration as a neutral check-email state, not login. The current backend returns the same accepted status for a new or duplicate email and sends verification only for a new account. | Auto-login or an account-existence message would be wrong for the current backend and may disclose account status. |
| Success and error bodies | Handle register `202` and login `204` without parsing a body; validate only JSON representations such as CSRF, identity, and problem responses. This is an explicit constitution exception to review. | Parsing an empty response as JSON would fail. |
| Endpoint authority | On 2026-10-17, the user approved `contracts/auth-api-observed.openapi.yaml` as the contract for this frontend slice: `GET /api/auth/csrf` returns `headerName` and `token`; `POST /api/auth/login` accepts `email` and `password`, returns bodyless `204`; `POST /api/auth/register` accepts `email` and a password of at least 12 characters, returns bodyless `202`. This does not make the mirror a backend-owned publication. | Deferring implementation until a separate published artifact exists would block the now-approved frontend contract. |
| Verification | Use lint, build, and manual browser scenarios because this repository has no runnable test script or framework. | Adding a test framework solely for this planning slice is outside the requested screen scope. |
| Visual direction | Use the project-root `design.md` as the proposed blue visual system: one compact, single-column auth shell with shared spacing, type, controls, and accessible states. Keep a system font fallback until local font assets are available. | A marketing split-screen or stock imagery would add weight without helping a two-field sign-in task. |

## Verified Backend Evidence

The user also approved the documented exception to the constitution's JSON-success wording for
bodyless login `204` and registration `202` responses on 2026-10-17. CSRF and problem JSON remain
subject to boundary validation. This approval applies to this frontend integration only.

- `AuthController` currently exposes registration, login, CSRF, and current-user routes under
  `/api/auth`. Register returns `202`; login returns `204` and sets cookies; CSRF and current-user
  return JSON.
- `AuthCookies` sets HttpOnly, Secure, SameSite=Lax access and refresh cookies. The access cookie
  contains the JWT; the refresh cookie is opaque.
- `SecurityConfig` protects unsafe API requests with CSRF. `AccountService` returns accepted for an
  already-existing email and sends a verification email only for a newly registered account.
- No Swagger/OpenAPI configuration was found in the local backend source inspected for this plan.
