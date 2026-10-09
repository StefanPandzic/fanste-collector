import { describe, expect, it } from 'vitest';

import { isEmailLinkType } from './email-link';

describe('isEmailLinkType', () => {
  it('accepts the link types the email templates send', () => {
    expect(isEmailLinkType('signup')).toBe(true);
    expect(isEmailLinkType('recovery')).toBe(true);
  });

  it('rejects other values', () => {
    expect(isEmailLinkType('sms')).toBe(false);
    expect(isEmailLinkType(null)).toBe(false);
  });
});
