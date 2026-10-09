import { describe, expect, it } from 'vitest';

import { languageLabel } from './copy-options';

describe('languageLabel', () => {
  it('names a language code', () => {
    expect(languageLabel('sr')).toBe('Serbian');
    expect(languageLabel('en')).toBe('English');
  });

  it('returns a malformed code as it is', () => {
    expect(languageLabel('not a code')).toBe('not a code');
  });
});
