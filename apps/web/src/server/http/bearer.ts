/**
 * The token of an `Authorization: Bearer <jwt>` header, `null` when the header is missing, and
 * `undefined` when it's present but malformed (which must not fall back to the cookie session).
 */
export function bearerToken(header: string | null): string | null | undefined {
  if (header === null) return null;
  const match = /^Bearer\s+(\S+)\s*$/i.exec(header);
  return match?.[1];
}
