import { jsPDF } from 'jspdf';
import { autoTable } from 'jspdf-autotable';

import { categoryLabel, formatDate, formatMoney, ownershipLabel } from '@fanste/core';

import { exportFileName } from './files';
import { fontFor, PDF_FONT_NAMES } from './pdf-fonts';
import {
  COVER_TEXT_GAP,
  FONT_SIZE,
  FOOTER_BASELINE,
  fitImage,
  gridGeometry,
  HEADER_BASELINE,
  lineHeight,
  PAGE_MARGIN,
  PAPER_MM,
  SECTION_HEADING_HEIGHT,
} from './pdf-layout';
import { attributionLine, DETAIL_SEPARATOR, modelTexts, PDF_LAYOUT_LABELS } from './pdf-model';

import type { ExportFile } from './collection-export';
import type { PdfFontName, PdfFonts } from './pdf-fonts';
import type { PaperSize } from './pdf-layout';
import type { MoneyTotal, PdfEntry, PdfModel, PdfSection } from './pdf-model';
import type { CellHookData, RowInput, UserOptions } from 'jspdf-autotable';

// The PDF catalog (FC-26), built on the client with jsPDF: a cover page, then a grid of covers or an
// insurance table, grouped by category with headings, a header and page numbers on every page.

/** A cover, already downscaled by the app (FC-26 loads them through a canvas). */
export interface PdfCover {
  data: Uint8Array;
  format: 'JPEG' | 'PNG';
  width: number;
  height: number;
}

export interface CollectionPdfOptions {
  paper: PaperSize;
  /** Values on the grid and the cover page; the insurance list always has them. */
  includePrices: boolean;
  /** Printed on the cover page and in the header. */
  userName: string;
  /** The export's date, for the cover page and the file name. */
  date: Date;
  /** Locale of dates and amounts; the device's when left out. */
  locale?: string;
  /** Covers by URL (`PdfEntry.coverUrl`); a missing or `null` one is drawn as a placeholder. */
  covers?: ReadonlyMap<string, PdfCover | null>;
  /** Without fonts the PDF uses Helvetica, which only has Latin-1 characters. */
  fonts?: PdfFonts;
  /** Entries drawn so far, of all. */
  onProgress?: (done: number, total: number) => void;
  signal?: AbortSignal;
}

type Rgb = [number, number, number];

const COLOR = {
  text: [31, 41, 55] as Rgb,
  muted: [107, 114, 128] as Rgb,
  rule: [209, 213, 219] as Rgb,
  placeholder: [243, 244, 246] as Rgb,
  headFill: [31, 41, 55] as Rgb,
  sectionFill: [243, 244, 246] as Rgb,
};

/** Entries drawn between two pauses that let the page repaint (progress, Cancel). */
const YIELD_EVERY = 25;
const EMPTY = '—';
/** Room per note at the bottom of the cover page (two lines of small text). */
const NOTE_STEP = 8;
const ELLIPSIS = '…';

/** jsPDF's virtual file system takes fonts as base64. */
function toBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunk = 0x8000;
  for (let index = 0; index < bytes.length; index += chunk) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunk));
  }
  return btoa(binary);
}

function pause(signal?: AbortSignal): Promise<void> {
  signal?.throwIfAborted();
  return new Promise((resolve) => setTimeout(resolve, 0));
}

function plural(count: number, word: string): string {
  return `${count.toLocaleString('en-US')} ${word}${count === 1 ? '' : 's'}`;
}

/** Text drawing with the right font per run (Latin, Chinese/Japanese or Korean). */
class Writer {
  private readonly loaded: { latin: boolean; sc: boolean; kr: boolean };

  constructor(
    readonly doc: jsPDF,
    fonts: PdfFonts | undefined,
  ) {
    this.loaded = { latin: fonts !== undefined, sc: !!fonts?.sc, kr: !!fonts?.kr };
    if (!fonts) return;
    const add = (file: string, bytes: Uint8Array, name: PdfFontName, style: string) => {
      doc.addFileToVFS(file, toBase64(bytes));
      doc.addFont(file, name, style);
    };
    add('NotoSans-Regular.ttf', fonts.regular, PDF_FONT_NAMES.latin, 'normal');
    add('NotoSans-Bold.ttf', fonts.bold, PDF_FONT_NAMES.latin, 'bold');
    if (fonts.sc) add('NotoSansSC-Regular.ttf', fonts.sc, PDF_FONT_NAMES.sc, 'normal');
    if (fonts.kr) add('NotoSansKR-Regular.ttf', fonts.kr, PDF_FONT_NAMES.kr, 'normal');
  }

  fontOf(value: string): PdfFontName {
    return fontFor(value, this.loaded);
  }

  /** The font of the base text (table cells start with it). */
  get baseFont(): PdfFontName {
    return this.loaded.latin ? PDF_FONT_NAMES.latin : PDF_FONT_NAMES.builtIn;
  }

  /** Sets the font for `value`; the CJK fonts have no bold, so they stay regular. */
  use(value: string, size: number, bold = false, color: Rgb = COLOR.text): void {
    const font = this.fontOf(value);
    const cjk = font === PDF_FONT_NAMES.sc || font === PDF_FONT_NAMES.kr;
    this.doc.setFont(font, bold && !cjk ? 'bold' : 'normal');
    this.doc.setFontSize(size);
    this.doc.setTextColor(...color);
  }

  /** At most `maxLines` lines of `value` within `width`; a cut last line ends in `…`. */
  lines(value: string, width: number, maxLines: number): string[] {
    const lines = this.doc.splitTextToSize(value, width) as string[];
    if (lines.length <= maxLines) return lines;
    const kept = lines.slice(0, maxLines);
    let last = Array.from(kept[maxLines - 1] ?? '');
    while (last.length > 0 && this.doc.getTextWidth(`${last.join('')}${ELLIPSIS}`) > width) {
      last = last.slice(0, -1);
    }
    kept[maxLines - 1] = `${last.join('').trimEnd()}${ELLIPSIS}`;
    return kept;
  }

  text(
    value: string,
    x: number,
    y: number,
    {
      size,
      bold = false,
      color = COLOR.text,
      align = 'left',
      width,
      maxLines = 1,
    }: {
      size: number;
      bold?: boolean;
      color?: Rgb;
      align?: 'left' | 'center' | 'right';
      width?: number;
      maxLines?: number;
    },
  ): number {
    this.use(value, size, bold, color);
    const lines = width === undefined ? [value] : this.lines(value, width, maxLines);
    const step = lineHeight(size);
    lines.forEach((line, index) => this.doc.text(line, x, y + index * step, { align }));
    return lines.length * step;
  }
}

/** e.g. `€1,200.00 · $35.00`; `—` without values. */
function totalsText(totals: readonly MoneyTotal[], locale?: string, separator = DETAIL_SEPARATOR) {
  if (totals.length === 0) return EMPTY;
  return totals.map((total) => formatMoney(total.total, total.currency, locale)).join(separator);
}

function longDate(date: Date, locale?: string): string {
  return date.toLocaleDateString(locale, { dateStyle: 'long' });
}

/**
 * Every text `buildCollectionPdf` prints, to pick its fonts (`fontNeeds`): the model's texts plus
 * the name, dates and amounts, which some locales write in CJK characters (`2026年10月15日`, `￥`).
 */
export function printedTexts(
  model: PdfModel,
  { userName, date, locale }: Pick<CollectionPdfOptions, 'userName' | 'date' | 'locale'>,
): string[] {
  const texts = [
    ...modelTexts(model),
    userName,
    longDate(date, locale),
    totalsText(model.totals, locale),
  ];
  for (const section of model.sections) {
    texts.push(totalsText(section.totals, locale));
    for (const entry of section.entries) {
      texts.push(valueCell(entry, locale));
      if (entry.acquiredAt) texts.push(formatDate(entry.acquiredAt, locale));
      if (entry.purchasePrice !== null) {
        texts.push(formatMoney(entry.purchasePrice, entry.currency, locale));
      }
    }
  }
  return texts;
}

function drawCoverPage(
  writer: Writer,
  model: PdfModel,
  options: CollectionPdfOptions,
  showValues: boolean,
): void {
  const { doc } = writer;
  const { width, height } = PAPER_MM[options.paper];
  const left = PAGE_MARGIN.side;
  let y = 64;
  writer.text('Fanste Collector', left, y, { size: FONT_SIZE.coverTitle, bold: true });
  y += 12;
  const title = model.layout === 'insurance' ? 'Insurance list' : 'Collection catalog';
  writer.text(title, left, y, { size: FONT_SIZE.coverSubtitle, color: COLOR.muted });
  y += 8;
  doc.setDrawColor(...COLOR.rule);
  doc.setLineWidth(0.3);
  doc.line(left, y, width - left, y);
  y += 10;

  const facts: [string, string][] = [
    ['Prepared for', options.userName],
    ['Exported', longDate(options.date, options.locale)],
    ['Items', plural(model.itemCount, 'item')],
  ];
  if (showValues) {
    facts.push(['Total estimated value', totalsText(model.totals, options.locale)]);
  }
  for (const [label, value] of facts) {
    writer.text(label, left, y, { size: 9, color: COLOR.muted });
    writer.text(value, left + 45, y, { size: 10, bold: true, width: width - left * 2 - 45 });
    y += 7;
  }

  const notes: string[] = [];
  if (showValues) {
    notes.push(
      'Values are the owner’s estimates in each item’s currency; totals in different currencies are listed apart, not converted.',
    );
  }
  if (model.layout === 'insurance') {
    notes.push(
      'Lists the copies the owner has: owned, preordered and lent out. Wishlist and sold items are left out.',
    );
  } else if (showValues) {
    notes.push(
      'Only the copies the owner has (owned, preordered, lent out) show a value and count towards the totals.',
    );
  }
  if (model.providers.includes('tmdb')) {
    notes.push('This product uses the TMDB API but is not endorsed or certified by TMDB.');
  }
  // The notes sit at the bottom of the cover page; the section table stops above them.
  const notesHeight = notes.length * NOTE_STEP;
  let noteY = height - PAGE_MARGIN.bottom - notesHeight + NOTE_STEP - 2;
  for (const note of notes) {
    writer.text(note, left, noteY, {
      size: FONT_SIZE.small,
      color: COLOR.muted,
      width: width - left * 2,
      maxLines: 2,
    });
    noteY += NOTE_STEP;
  }

  const sections = model.sections.filter((section) => section.entries.length > 0);
  if (sections.length > 0) {
    autoTable(doc, {
      ...tableBase(writer),
      margin: {
        top: PAGE_MARGIN.top,
        bottom: PAGE_MARGIN.bottom + notesHeight + 4,
        left: PAGE_MARGIN.side,
        right: PAGE_MARGIN.side,
      },
      startY: y + 6,
      head: [showValues ? ['Section', 'Items', 'Estimated value'] : ['Section', 'Items']],
      body: sections.map((section) => {
        const row = [section.label, section.entries.length.toLocaleString('en-US')];
        return showValues ? [...row, totalsText(section.totals, options.locale, '\n')] : row;
      }),
      columnStyles: { 1: { halign: 'right', cellWidth: 20 }, 2: { halign: 'right' } },
    });
  }
}

/** Shared table settings: margins clear of the header and footer, the app's fonts per cell. */
function tableBase(writer: Writer): Partial<UserOptions> {
  return {
    theme: 'plain',
    margin: {
      top: PAGE_MARGIN.top,
      bottom: PAGE_MARGIN.bottom,
      left: PAGE_MARGIN.side,
      right: PAGE_MARGIN.side,
    },
    styles: {
      font: writer.baseFont,
      fontSize: FONT_SIZE.table,
      textColor: COLOR.text,
      cellPadding: 1.5,
      lineColor: COLOR.rule,
      lineWidth: { bottom: 0.1, top: 0, left: 0, right: 0 },
      overflow: 'linebreak',
      valign: 'top',
    },
    headStyles: { fillColor: COLOR.headFill, textColor: [255, 255, 255], fontStyle: 'bold' },
    didParseCell: (data: CellHookData) => {
      // Column headings line up with their column (amounts on the right).
      const halign = data.table.styles.columnStyles[data.column.index]?.halign;
      if (data.section === 'head' && data.cell.colSpan === 1 && halign) {
        data.cell.styles.halign = halign;
      }
      const font = writer.fontOf(data.cell.text.join(' '));
      if (font === writer.baseFont) return;
      data.cell.styles.font = font;
      data.cell.styles.fontStyle = 'normal';
    },
  };
}

function drawGridCell(
  writer: Writer,
  entry: PdfEntry,
  origin: { x: number; y: number },
  geometry: ReturnType<typeof gridGeometry>,
  options: CollectionPdfOptions,
): void {
  const { doc } = writer;
  const box = {
    x: origin.x + (geometry.cellWidth - geometry.coverBox.width) / 2,
    y: origin.y,
    ...geometry.coverBox,
  };
  const cover = entry.coverUrl ? options.covers?.get(entry.coverUrl) : undefined;
  if (cover) {
    const fitted = fitImage(box, cover);
    // The URL as alias: two copies of one title embed the image once.
    doc.addImage(
      cover.data,
      cover.format,
      fitted.x,
      fitted.y,
      fitted.width,
      fitted.height,
      entry.coverUrl,
      'FAST',
    );
    doc.setDrawColor(...COLOR.rule);
    doc.setLineWidth(0.1);
    doc.rect(fitted.x, fitted.y, fitted.width, fitted.height);
  } else {
    doc.setFillColor(...COLOR.placeholder);
    doc.roundedRect(box.x, box.y, box.width, box.height, 1.5, 1.5, 'F');
    writer.text(categoryLabel(entry.category), box.x + box.width / 2, box.y + box.height / 2, {
      size: FONT_SIZE.small,
      color: COLOR.muted,
      align: 'center',
    });
  }

  const center = origin.x + geometry.cellWidth / 2;
  const width = geometry.cellWidth;
  let y = box.y + box.height + COVER_TEXT_GAP + lineHeight(FONT_SIZE.title) * 0.8;
  y += writer.text(entry.title, center, y, {
    size: FONT_SIZE.title,
    bold: true,
    align: 'center',
    width,
    maxLines: 2,
  });
  const small = { size: FONT_SIZE.small, align: 'center' as const, width };
  if (entry.byline) y += writer.text(entry.byline, center, y, { ...small, color: COLOR.muted });
  if (entry.badges) y += writer.text(entry.badges, center, y, small);
  // Wishlist and sold copies have no value in the totals, so none is printed either.
  if (options.includePrices && entry.valued && entry.lineValue !== null) {
    writer.text(formatMoney(entry.lineValue, entry.currency, options.locale), center, y, {
      ...small,
      bold: true,
    });
  }
}

function drawSectionHeading(
  writer: Writer,
  section: PdfSection,
  paper: PaperSize,
  continued: boolean,
): void {
  const label = `${section.label}${continued ? ' (continued)' : ''}`;
  const y = PAGE_MARGIN.top + SECTION_HEADING_HEIGHT - 3.5;
  writer.text(label, PAGE_MARGIN.side, y, { size: FONT_SIZE.heading, bold: true });
  const right = PAPER_MM[paper].width - PAGE_MARGIN.side;
  writer.text(plural(section.entries.length, 'item'), right, y, {
    size: FONT_SIZE.small,
    color: COLOR.muted,
    align: 'right',
  });
}

async function drawGrid(
  writer: Writer,
  model: PdfModel,
  options: CollectionPdfOptions,
  progress: () => Promise<void>,
): Promise<void> {
  const geometry = gridGeometry(options.paper, options.includePrices);
  for (const section of model.sections) {
    for (const [index, entry] of section.entries.entries()) {
      const slot = index % geometry.perPage;
      if (slot === 0) {
        writer.doc.addPage();
        drawSectionHeading(writer, section, options.paper, index > 0);
      }
      drawGridCell(writer, entry, geometry.cell(slot), geometry, options);
      await progress();
    }
  }
}

function valueCell(entry: PdfEntry, locale?: string): string {
  if (entry.lineValue === null || entry.estimatedValue === null) return EMPTY;
  const line = formatMoney(entry.lineValue, entry.currency, locale);
  return entry.quantity > 1
    ? `${line}\n${entry.quantity} × ${formatMoney(entry.estimatedValue, entry.currency, locale)}`
    : line;
}

function insuranceRow(entry: PdfEntry, locale?: string): RowInput {
  const details = [
    entry.details,
    entry.ownership === 'owned' ? undefined : ownershipLabel(entry.ownership),
  ]
    .filter((part) => part !== undefined)
    .join(DETAIL_SEPARATOR);
  return [
    entry.byline ? `${entry.title}\n${entry.byline}` : entry.title,
    entry.format ?? EMPTY,
    details || EMPTY,
    entry.quantity.toLocaleString('en-US'),
    entry.acquiredAt ? formatDate(entry.acquiredAt, locale) : EMPTY,
    entry.purchasePrice === null ? EMPTY : formatMoney(entry.purchasePrice, entry.currency, locale),
    valueCell(entry, locale),
  ];
}

const INSURANCE_HEAD = ['Title', 'Format', 'Details', 'Qty', 'Acquired', 'Paid', 'Est. value'];
const INSURANCE_COLUMNS: UserOptions['columnStyles'] = {
  1: { cellWidth: 22 },
  3: { cellWidth: 9, halign: 'right' },
  4: { cellWidth: 19 },
  5: { cellWidth: 19, halign: 'right' },
  6: { cellWidth: 23, halign: 'right' },
};

async function drawInsurance(
  writer: Writer,
  model: PdfModel,
  options: CollectionPdfOptions,
  progress: (count: number) => Promise<void>,
): Promise<void> {
  const { doc } = writer;
  const { locale } = options;
  const span = INSURANCE_HEAD.length - 1;
  doc.addPage();
  let y = PAGE_MARGIN.top;
  const trackEnd: Partial<UserOptions> = {
    didDrawPage: (data) => {
      if (data.cursor) y = data.cursor.y;
    },
  };

  for (const section of model.sections) {
    autoTable(doc, {
      ...tableBase(writer),
      ...trackEnd,
      startY: y + 2,
      head: [
        [
          {
            content: `${section.label} · ${plural(section.entries.length, 'item')}`,
            colSpan: INSURANCE_HEAD.length,
            styles: {
              fontSize: FONT_SIZE.heading - 2,
              fillColor: COLOR.sectionFill,
              textColor: COLOR.text,
            },
          },
        ],
        INSURANCE_HEAD,
      ],
      body: section.entries.map((entry) => insuranceRow(entry, locale)),
      foot: [
        [
          { content: `${section.label} subtotal`, colSpan: span, styles: { halign: 'right' } },
          { content: totalsText(section.totals, locale, '\n'), styles: { halign: 'right' } },
        ],
      ],
      footStyles: { fontStyle: 'bold' },
      showFoot: 'lastPage',
      rowPageBreak: 'avoid',
      columnStyles: INSURANCE_COLUMNS,
    });
    y += 4;
    await progress(section.entries.length);
  }

  autoTable(doc, {
    ...tableBase(writer),
    startY: y + 2,
    body: [
      [
        { content: 'Total estimated value', colSpan: span, styles: { halign: 'right' } },
        { content: totalsText(model.totals, locale, '\n'), styles: { halign: 'right' } },
      ],
    ],
    bodyStyles: { fontStyle: 'bold', fillColor: COLOR.sectionFill, fontSize: FONT_SIZE.table + 1 },
    rowPageBreak: 'avoid',
    columnStyles: INSURANCE_COLUMNS,
  });
}

/** The header (not on the cover page) and the footer with the attribution and page numbers. */
function drawPageFrames(writer: Writer, model: PdfModel, options: CollectionPdfOptions): void {
  const { doc } = writer;
  const { width, height } = PAPER_MM[options.paper];
  const left = PAGE_MARGIN.side;
  const right = width - PAGE_MARGIN.side;
  const pages = doc.getNumberOfPages();
  const attribution = attributionLine(model.providers);
  const title = [
    PDF_LAYOUT_LABELS[model.layout],
    options.userName,
    longDate(options.date, options.locale),
  ].join(DETAIL_SEPARATOR);
  const small = { size: FONT_SIZE.header, color: COLOR.muted };
  for (let page = 1; page <= pages; page += 1) {
    doc.setPage(page);
    if (page > 1) {
      writer.text('Fanste Collector', left, HEADER_BASELINE, { ...small, bold: true });
      writer.text(title, right, HEADER_BASELINE, {
        ...small,
        align: 'right',
        width: width / 2,
        maxLines: 1,
      });
      doc.setDrawColor(...COLOR.rule);
      doc.setLineWidth(0.2);
      doc.line(left, HEADER_BASELINE + 2, right, HEADER_BASELINE + 2);
    }
    const footerY = height - FOOTER_BASELINE;
    if (attribution) writer.text(attribution, left, footerY, small);
    writer.text(`Page ${page} of ${pages}`, right, footerY, { ...small, align: 'right' });
  }
}

/**
 * The PDF of a catalog model (`buildPdfModel`): `fanste-collection-YYYY-MM-DD.pdf`. Pauses every
 * few entries so the page stays responsive; rejects when `signal` aborts.
 */
export async function buildCollectionPdf(
  model: PdfModel,
  options: CollectionPdfOptions,
): Promise<ExportFile> {
  const doc = new jsPDF({
    unit: 'mm',
    format: options.paper,
    orientation: 'portrait',
    compress: true,
  });
  doc.setProperties({
    title: `Fanste Collector ${PDF_LAYOUT_LABELS[model.layout].toLowerCase()}`,
    author: options.userName,
    creator: 'Fanste Collector',
  });
  const writer = new Writer(doc, options.fonts);
  const showValues = model.layout === 'insurance' || options.includePrices;
  drawCoverPage(writer, model, options, showValues);

  let done = 0;
  let sincePause = 0;
  const progress = async (count = 1) => {
    done += count;
    sincePause += count;
    options.onProgress?.(done, model.itemCount);
    if (sincePause >= YIELD_EVERY) {
      sincePause = 0;
      await pause(options.signal);
    }
  };
  if (model.layout === 'grid') await drawGrid(writer, model, options, progress);
  else await drawInsurance(writer, model, options, progress);

  drawPageFrames(writer, model, options);
  options.signal?.throwIfAborted();
  return {
    name: exportFileName(options.date, 'pdf'),
    type: 'pdf',
    mimeType: 'application/pdf',
    data: new Uint8Array(doc.output('arraybuffer')),
  };
}
