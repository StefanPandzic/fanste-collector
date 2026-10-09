import { describe, expect, it } from 'vitest';

import { escapeLike } from './items';

describe('escapeLike', () => {
  it('escapes LIKE wildcards and backslashes', () => {
    expect(escapeLike('100% Pure_Rock')).toBe('100\\% Pure\\_Rock');
    expect(escapeLike('AC\\DC')).toBe('AC\\\\DC');
    expect(escapeLike('The Matrix')).toBe('The Matrix');
  });

  it('turns * into a single-character wildcard', () => {
    expect(escapeLike('M*A*S*H')).toBe('M_A_S_H');
  });
});
