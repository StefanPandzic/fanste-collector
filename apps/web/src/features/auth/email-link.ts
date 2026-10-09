import type { EmailOtpType } from '@fanste/supabase';

/** Link types the email templates send to `/auth/confirm` (see `supabase/templates/`). */
const EMAIL_LINK_TYPES = new Set<string>([
  'signup',
  'email',
  'recovery',
  'email_change',
  'invite',
  'magiclink',
]);

/** `true` if `value` is a `type` that `/auth/confirm` accepts from an email link. */
export function isEmailLinkType(value: string | null): value is EmailOtpType {
  return value !== null && EMAIL_LINK_TYPES.has(value);
}
