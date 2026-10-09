/**
 * User-facing messages for Supabase Auth errors. Unknown errors get a generic message, so internal
 * details never reach the page (they are logged on the server instead).
 */
const AUTH_ERROR_MESSAGES: Record<string, string> = {
  invalid_credentials: 'Wrong email or password.',
  email_not_confirmed: 'Confirm your email address first. Check your inbox for the link.',
  weak_password: 'Choose a stronger password.',
  same_password: 'Choose a password that is different from your current one.',
  over_email_send_rate_limit: 'Too many emails were sent. Wait a few minutes and try again.',
  over_request_rate_limit: 'Too many attempts. Wait a few minutes and try again.',
  signup_disabled: 'Sign-ups are currently closed.',
  session_not_found: 'Your session has expired. Sign in again.',
};

export const GENERIC_AUTH_ERROR = 'Something went wrong. Please try again.';

/** Maps a Supabase Auth error (by its `code`) to a message that is safe to show. */
export function authErrorMessage(error: { code?: string | undefined }): string {
  return (error.code && AUTH_ERROR_MESSAGES[error.code]) || GENERIC_AUTH_ERROR;
}

/** Messages for the `?error=` codes that the auth route handlers redirect to the sign-in page with. */
const CALLBACK_ERROR_MESSAGES: Record<string, string> = {
  link_invalid: 'This link is invalid or has expired. Request a new one.',
  oauth_failed: 'Signing in with Google failed. Please try again.',
  oauth_cancelled: 'Google sign-in was cancelled.',
};

export type CallbackErrorCode = 'link_invalid' | 'oauth_failed' | 'oauth_cancelled';

/** The message for a sign-in page `?error=` code, or `undefined` for unknown codes. */
export function callbackErrorMessage(code: string | undefined): string | undefined {
  return code ? CALLBACK_ERROR_MESSAGES[code] : undefined;
}
