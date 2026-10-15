// Page geometry of the PDF catalog (FC-26), in millimetres. A4 and Letter get the same margins, wide
// enough for any printer (at least 12 mm), and the grid is worked out from each paper's real size.

export const PAPER_SIZES = ['a4', 'letter'] as const;
export type PaperSize = (typeof PAPER_SIZES)[number];

export const PAPER_SIZE_LABELS: Record<PaperSize, string> = {
  a4: 'A4',
  letter: 'US Letter',
};

/** Regions that print on US Letter; everyone else uses A4. */
const LETTER_REGIONS = new Set(['US', 'CA', 'MX', 'PH', 'CL', 'CO', 'VE']);

/** The paper of a locale, e.g. `letter` for `en-US`, `a4` for `en-GB` or `sr`. */
export function defaultPaperSize(locale: string | undefined): PaperSize {
  if (!locale) return 'a4';
  try {
    const region = new Intl.Locale(locale).maximize().region;
    return region && LETTER_REGIONS.has(region) ? 'letter' : 'a4';
  } catch {
    return 'a4';
  }
}

export const PAPER_MM: Record<PaperSize, { width: number; height: number }> = {
  a4: { width: 210, height: 297 },
  letter: { width: 215.9, height: 279.4 },
};

/** Page margins; the header and footer sit inside the top and bottom ones. */
export const PAGE_MARGIN = { side: 14, top: 20, bottom: 18 };
/** Baselines of the header (from the top) and the footer (from the bottom). */
export const HEADER_BASELINE = 12;
export const FOOTER_BASELINE = 10;

/** Font sizes in points. */
export const FONT_SIZE = {
  coverTitle: 30,
  coverSubtitle: 14,
  heading: 12,
  title: 8,
  small: 6.5,
  table: 7.5,
  header: 7,
};

/** Height of a line of `points`-sized text, in mm (1.2 line height). */
export function lineHeight(points: number): number {
  return points * 0.3528 * 1.2;
}

export const GRID_COLUMNS = 4;
export const GRID_ROWS = 5;
const GRID_GAP = { x: 4, y: 3 };
/** Space for the section heading above the grid. */
export const SECTION_HEADING_HEIGHT = 9;
/** Lines of title under each cover. */
export const GRID_TITLE_LINES = 2;
/** Space between the cover and its text. */
export const COVER_TEXT_GAP = 1.5;

export interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface GridGeometry {
  cellWidth: number;
  cellHeight: number;
  /** The box a cover is fitted into (2:3, centred in the cell's top part). */
  coverBox: { width: number; height: number };
  /** Height of the text block under the cover. */
  textHeight: number;
  perPage: number;
  /** The top-left corner of the `index`th cell of a page (row by row). */
  cell: (index: number) => { x: number; y: number };
}

/**
 * The 4×5 grid of a page. Each cell has the cover, up to two lines of title, the byline and the
 * badges, plus the value with `withValues`.
 */
export function gridGeometry(paper: PaperSize, withValues: boolean): GridGeometry {
  const { width, height } = PAPER_MM[paper];
  const top = PAGE_MARGIN.top + SECTION_HEADING_HEIGHT;
  const contentWidth = width - 2 * PAGE_MARGIN.side;
  const contentHeight = height - top - PAGE_MARGIN.bottom;
  const cellWidth = (contentWidth - (GRID_COLUMNS - 1) * GRID_GAP.x) / GRID_COLUMNS;
  const cellHeight = (contentHeight - (GRID_ROWS - 1) * GRID_GAP.y) / GRID_ROWS;
  const smallLines = withValues ? 3 : 2;
  const textHeight =
    GRID_TITLE_LINES * lineHeight(FONT_SIZE.title) + smallLines * lineHeight(FONT_SIZE.small);
  const coverHeight = cellHeight - textHeight - COVER_TEXT_GAP;
  const coverWidth = Math.min(cellWidth, (coverHeight * 2) / 3);
  return {
    cellWidth,
    cellHeight,
    coverBox: { width: coverWidth, height: coverHeight },
    textHeight,
    perPage: GRID_COLUMNS * GRID_ROWS,
    cell: (index) => ({
      x: PAGE_MARGIN.side + (index % GRID_COLUMNS) * (cellWidth + GRID_GAP.x),
      y: top + Math.floor(index / GRID_COLUMNS) * (cellHeight + GRID_GAP.y),
    }),
  };
}

/**
 * An image of `size` fitted into `box` without cropping, centred horizontally and resting on the
 * box's bottom edge, so covers of different shapes line up above their titles.
 */
export function fitImage(box: Box, size: { width: number; height: number }): Box {
  const scale = Math.min(box.width / size.width, box.height / size.height);
  const width = size.width * scale;
  const height = size.height * scale;
  return {
    x: box.x + (box.width - width) / 2,
    y: box.y + box.height - height,
    width,
    height,
  };
}
