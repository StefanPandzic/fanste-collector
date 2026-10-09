import type { JwtPayload } from '@fanste/supabase';

/** How long after opening a password reset link the user may still set a new password. */
export const RECOVERY_WINDOW_SECONDS = 60 * 60;

/**
 * `true` if the session was started by an email link (password reset) within the last hour. Opening
 * a reset link via `/auth/confirm` gives the session an `otp` entry in its `amr` claim, while a
 * normal sign-in has `password` or `oauth`. Other email links (sign-up confirmation) also count:
 * like a reset, they prove the user controls the address. Without this check, anyone with access to
 * a signed-in window could change the password and lock the owner out.
 */
export function isRecentRecoverySession(
  claims: Pick<JwtPayload, 'amr'> | null,
  nowSeconds = Math.floor(Date.now() / 1000),
): boolean {
  return (claims?.amr ?? []).some(
    (entry) =>
      typeof entry === 'object' &&
      entry.method === 'otp' &&
      nowSeconds - entry.timestamp <= RECOVERY_WINDOW_SECONDS,
  );
}
