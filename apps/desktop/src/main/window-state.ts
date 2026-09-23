import { readFileSync, writeFileSync } from 'node:fs';

/** Same shape as Electron's `Rectangle`. */
export interface Bounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Window position and size remembered between launches. */
export interface WindowState {
  /** Bounds of the restored (not maximized) window. */
  bounds: Bounds;
  isMaximized: boolean;
}

/** How much of the window must overlap a display for the saved position to be reused. */
const MIN_VISIBLE = { width: 100, height: 50 };

/** Validates data read from disk; `undefined` if it isn't a {@link WindowState}. */
export function parseWindowState(value: unknown): WindowState | undefined {
  if (typeof value !== 'object' || value === null) return undefined;
  const { bounds, isMaximized } = value as Partial<Record<keyof WindowState, unknown>>;
  if (typeof isMaximized !== 'boolean' || typeof bounds !== 'object' || bounds === null) {
    return undefined;
  }
  const { x, y, width, height } = bounds as Partial<Record<keyof Bounds, unknown>>;
  const values = [x, y, width, height];
  if (!values.every((n): n is number => typeof n === 'number' && Number.isFinite(n))) {
    return undefined;
  }
  const [bx, by, bw, bh] = values as [number, number, number, number];
  if (bw <= 0 || bh <= 0) return undefined;
  return { bounds: { x: bx, y: by, width: bw, height: bh }, isMaximized };
}

/**
 * `true` if enough of `bounds` lies on one of the displays' work areas to grab the window.
 * Saved positions can point off-screen after a monitor is disconnected or rearranged.
 */
export function isOnScreen(bounds: Bounds, workAreas: readonly Bounds[]): boolean {
  return workAreas.some((area) => {
    const overlapWidth =
      Math.min(bounds.x + bounds.width, area.x + area.width) - Math.max(bounds.x, area.x);
    const overlapHeight =
      Math.min(bounds.y + bounds.height, area.y + area.height) - Math.max(bounds.y, area.y);
    return overlapWidth >= MIN_VISIBLE.width && overlapHeight >= MIN_VISIBLE.height;
  });
}

/** Reads the saved state; `undefined` if there is none or the file is unreadable. */
export function readWindowState(filePath: string): WindowState | undefined {
  try {
    return parseWindowState(JSON.parse(readFileSync(filePath, 'utf8')));
  } catch {
    return undefined;
  }
}

/** Saves the state. Synchronous, because it runs while the window closes and the app may be quitting. */
export function writeWindowState(filePath: string, state: WindowState): void {
  writeFileSync(filePath, JSON.stringify(state));
}
