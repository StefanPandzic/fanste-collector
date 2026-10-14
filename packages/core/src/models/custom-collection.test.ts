import { describe, expect, it } from 'vitest';

import {
  customCollectionInputSchema,
  isCollectionNameTaken,
  parseCollectionIcon,
} from './custom-collection';

const collections = [
  { id: '6f1c2a3e-0b1d-4c5e-9f00-111111111111', name: 'Funko Pops' },
  { id: '6f1c2a3e-0b1d-4c5e-9f00-222222222222', name: 'LEGO Sets' },
];

describe('customCollectionInputSchema', () => {
  it('trims the name and stores an empty description as null', () => {
    expect(
      customCollectionInputSchema.parse({ name: '  Funko Pops ', description: '  ', icon: 'box' }),
    ).toEqual({ name: 'Funko Pops', description: null, icon: 'box' });
  });

  it('rejects an empty name and unknown icons', () => {
    expect(customCollectionInputSchema.safeParse({ name: '   ' }).success).toBe(false);
    expect(customCollectionInputSchema.safeParse({ name: 'Coins', icon: 'rocket' }).success).toBe(
      false,
    );
  });
});

describe('parseCollectionIcon', () => {
  it('keeps a known icon and falls back to shapes', () => {
    expect(parseCollectionIcon('toy-brick')).toBe('toy-brick');
    expect(parseCollectionIcon('rocket')).toBe('shapes');
  });
});

describe('isCollectionNameTaken', () => {
  it('matches names ignoring case and surrounding spaces', () => {
    expect(isCollectionNameTaken(' funko pops ', collections)).toBe(true);
    expect(isCollectionNameTaken('Coins', collections)).toBe(false);
  });

  it('ignores the collection being renamed', () => {
    expect(isCollectionNameTaken('LEGO sets', collections, collections[1]?.id)).toBe(false);
  });
});
