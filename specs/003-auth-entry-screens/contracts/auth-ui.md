# UI Contract: Login and Registration

| Route | Inputs | Success | Failure |
| --- | --- | --- | --- |
| `/login` | Email, password | Leave auth screen for existing app landing route after backend confirms login. | Keep form available; show non-revealing, recoverable message. |
| `/register` | Email, password | Show neutral check-email guidance; do not sign in. | Keep form available; show recoverable message. |

Both routes provide a link to the other. Both use explicit labels, inline validation, a single
in-flight submission, keyboard focus management, and a responsive blue visual system. No password or
authentication token may be persisted in browser storage. The email-verification destination is out
of scope for this feature.
