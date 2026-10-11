'use client';

import { DesktopOnly } from '@/components/desktop-only';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

import { AutoAddSetting } from './match-panel';

/** The scanner settings on the Settings page (FC-23); only the desktop app has a scanner. */
export function ScannerSettingsCard() {
  return (
    <DesktopOnly fallback={null}>
      <Card>
        <CardHeader>
          <CardTitle>Scanner</CardTitle>
          <CardDescription>How scanned video files are added to your collection.</CardDescription>
        </CardHeader>
        <CardContent>
          <AutoAddSetting />
        </CardContent>
      </Card>
    </DesktopOnly>
  );
}
