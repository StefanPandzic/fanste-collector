import { describe, expect, it } from 'vitest';

import { defaultPaperSize, fitImage, gridGeometry, PAGE_MARGIN, PAPER_MM } from './pdf-layout';

describe('gridGeometry', () => {
  it('fits a 4×5 grid of 2:3 covers inside the margins of A4 and Letter', () => {
    for (const paper of ['a4', 'letter'] as const) {
      const { width, height } = PAPER_MM[paper];
      const grid = gridGeometry(paper, true);
      expect(grid.perPage).toBe(20);
      expect(grid.cell(0).x).toBe(PAGE_MARGIN.side);
      const last = grid.cell(19);
      expect(last.x + grid.cellWidth).toBeCloseTo(width - PAGE_MARGIN.side);
      expect(last.y + grid.cellHeight).toBeCloseTo(height - PAGE_MARGIN.bottom);
      expect(grid.coverBox.width).toBeLessThanOrEqual(grid.cellWidth);
      expect(grid.coverBox.width / grid.coverBox.height).toBeLessThanOrEqual(2 / 3 + 1e-9);
    }
  });
});

describe('fitImage', () => {
  it('fits the image without cropping, centred and on the bottom edge', () => {
    const box = { x: 10, y: 20, width: 40, height: 60 };
    expect(fitImage(box, { width: 600, height: 600 })).toEqual({
      x: 10,
      y: 40,
      width: 40,
      height: 40,
    });
    expect(fitImage(box, { width: 300, height: 600 })).toEqual({
      x: 15,
      y: 20,
      width: 30,
      height: 60,
    });
  });
});

describe('defaultPaperSize', () => {
  it('picks Letter for US locales and A4 elsewhere', () => {
    expect(defaultPaperSize('en-US')).toBe('letter');
    expect(defaultPaperSize('en-GB')).toBe('a4');
    expect(defaultPaperSize('sr')).toBe('a4');
    expect(defaultPaperSize(undefined)).toBe('a4');
  });
});
