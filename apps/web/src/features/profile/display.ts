/** The name to show for a user: their display name, else the part of the email before `@`. */
export function displayName(profileName: string | null | undefined, email: string | undefined) {
  return profileName?.trim() || email?.split('@')[0] || 'You';
}

/** Up to two initials for an avatar fallback, e.g. `Ada Lovelace` → `AL`, `ada` → `A`. */
export function initials(name: string): string {
  const letters = name
    .trim()
    .split(/\s+/)
    .map((word) => Array.from(word)[0] ?? '')
    .join('');
  const chars = Array.from(letters);
  const result = chars.length > 1 ? `${chars[0]}${chars.at(-1)}` : (chars[0] ?? '?');
  return result.toUpperCase();
}
