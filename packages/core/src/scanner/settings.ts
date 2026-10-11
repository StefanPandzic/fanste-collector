import { z } from 'zod';

/** The scanner settings (FC-23), stored per user in `profiles.preferences.scanner`. */
export const scannerSettingsSchema = z.object({
  /** Add confident matches to the collection on their own; off sends every match to review. */
  autoAdd: z.boolean(),
});

export type ScannerSettings = z.output<typeof scannerSettingsSchema>;

export const DEFAULT_SCANNER_SETTINGS: ScannerSettings = { autoAdd: true };

/** Reads the scanner settings from `profiles.preferences`; missing or invalid values get defaults. */
export function parseScannerSettings(preferences: unknown): ScannerSettings {
  const stored = (preferences as { scanner?: unknown } | null)?.scanner;
  const autoAdd = scannerSettingsSchema.shape.autoAdd.safeParse(
    (stored as { autoAdd?: unknown } | null)?.autoAdd,
  );
  return { autoAdd: autoAdd.success ? autoAdd.data : DEFAULT_SCANNER_SETTINGS.autoAdd };
}
