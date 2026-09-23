import { describe, expect, it } from 'vitest';

import { APP_NAME } from './index';

describe('constants', () => {
  it('exposes the product name', () => {
    expect(APP_NAME).toBe('Fanste Collector');
  });
});
