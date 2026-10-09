import { describe, expect, it } from 'vitest';

import { isRecentRecoverySession, RECOVERY_WINDOW_SECONDS } from './recovery';

describe('isRecentRecoverySession', () => {
  const now = 1_800_000_000;

  it('accepts a session from an email link opened within the window', () => {
    expect(isRecentRecoverySession({ amr: [{ method: 'otp', timestamp: now - 60 }] }, now)).toBe(
      true,
    );
  });

  it('rejects password sign-ins, expired links and missing claims', () => {
    expect(isRecentRecoverySession({ amr: [{ method: 'password', timestamp: now }] }, now)).toBe(
      false,
    );
    expect(
      isRecentRecoverySession(
        { amr: [{ method: 'otp', timestamp: now - RECOVERY_WINDOW_SECONDS - 1 }] },
        now,
      ),
    ).toBe(false);
    expect(isRecentRecoverySession(null, now)).toBe(false);
  });
});
