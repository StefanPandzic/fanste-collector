import { describe, expect, it } from 'vitest';

import { displayName, initials } from './display';

describe('displayName', () => {
  it('prefers the profile name, then the email name', () => {
    expect(displayName(' Ada Lovelace ', 'ada@example.com')).toBe('Ada Lovelace');
    expect(displayName(null, 'ada@example.com')).toBe('ada');
  });
});

describe('initials', () => {
  it('uses the first letters of the first and last word', () => {
    expect(initials('Ada Lovelace')).toBe('AL');
    expect(initials('Ada King Lovelace')).toBe('AL');
    expect(initials('ada')).toBe('A');
  });
});
