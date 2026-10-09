import { describe, expect, it } from 'vitest';

import {
  MAX_GRID_COLUMNS,
  gridColumns,
  gridRowCount,
  gridRowHeight,
  gridRowRange,
  nextGridIndex,
} from './grid-layout';

const columns = 4;
const itemCount = 10;

describe('gridColumns', () => {
  it('fits as many columns as the width allows', () => {
    expect(gridColumns(343)).toBe(2);
    expect(gridColumns(1280)).toBe(8);
  });

  it('keeps between 1 and MAX_GRID_COLUMNS columns', () => {
    expect(gridColumns(100)).toBe(1);
    expect(gridColumns(10000)).toBe(MAX_GRID_COLUMNS);
  });
});

describe('gridRowHeight', () => {
  it('adds the caption to the cover height of one card', () => {
    expect(gridRowHeight(343, 2)).toBe(297);
  });
});

describe('gridRowCount', () => {
  it('counts a partial last row', () => {
    expect(gridRowCount(itemCount, columns)).toBe(3);
    expect(gridRowCount(8, columns)).toBe(2);
  });
});

describe('gridRowRange', () => {
  it('returns the item indexes of a row', () => {
    expect(gridRowRange(0, columns, itemCount)).toEqual([0, 4]);
    expect(gridRowRange(2, columns, itemCount)).toEqual([8, 10]);
  });
});

describe('nextGridIndex', () => {
  it('moves with the arrow keys, Home and End', () => {
    expect(nextGridIndex(0, 'ArrowRight', columns, itemCount)).toBe(1);
    expect(nextGridIndex(1, 'ArrowLeft', columns, itemCount)).toBe(0);
    expect(nextGridIndex(1, 'ArrowDown', columns, itemCount)).toBe(5);
    expect(nextGridIndex(5, 'ArrowUp', columns, itemCount)).toBe(1);
    expect(nextGridIndex(5, 'Home', columns, itemCount)).toBe(0);
    expect(nextGridIndex(5, 'End', columns, itemCount)).toBe(9);
  });

  it('lands on the last item when moving down into a shorter last row', () => {
    expect(nextGridIndex(6, 'ArrowDown', columns, itemCount)).toBe(9);
  });

  it('returns null when there is nothing in that direction or the key is unknown', () => {
    expect(nextGridIndex(0, 'ArrowLeft', columns, itemCount)).toBeNull();
    expect(nextGridIndex(9, 'ArrowRight', columns, itemCount)).toBeNull();
    expect(nextGridIndex(1, 'ArrowUp', columns, itemCount)).toBeNull();
    expect(nextGridIndex(9, 'ArrowDown', columns, itemCount)).toBeNull();
    expect(nextGridIndex(0, 'Enter', columns, itemCount)).toBeNull();
  });
});
