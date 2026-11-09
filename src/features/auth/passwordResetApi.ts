import { sendWithCsrf } from '../../lib/http'

/**
 * Password reset, the one auth call other features may use (the profile page sends a reset link
 * to the signed-in user). Everything else of the session API stays in `authApi`.
 */

/** Request a password reset link. Every address receives the same accepted status. */
export async function forgotPassword(email: string): Promise<void> {
  await sendWithCsrf('post', '/auth/password/forgot', { email }, 202)
}

/**
 * Choose a new password with a one-time reset token. Does not sign in: the
 * backend revokes every session, so the user signs in with the new password.
 */
export async function resetPassword(token: string, newPassword: string): Promise<void> {
  await sendWithCsrf('post', '/auth/password/reset', { token, newPassword }, 204)
}
