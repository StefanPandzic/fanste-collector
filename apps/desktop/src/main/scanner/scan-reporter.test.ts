import { describe, expect, it } from 'vitest';

import { createScanReporter } from './scan-reporter';

import type { ScanWorkerMessage } from './scan-reporter';
import type { ScannedFileInfo } from '@fanste/core';

const scanId = 'scan-2026-10-10';

function video(index: number): ScannedFileInfo {
  return {
    path: `E:\\Movies\\Movie ${index}.mkv`,
    pathKey: `e:/movies/movie ${index}.mkv`,
    size: 1_500_000_000,
    modifiedAt: '2026-09-01T18:30:00.000Z',
    subtitleLanguages: [],
  };
}

function setup() {
  const messages: ScanWorkerMessage[] = [];
  let time = 0;
  const reporter = createScanReporter(
    scanId,
    (message) => messages.push(message),
    () => time,
  );
  const advance = (ms: number) => {
    time += ms;
  };
  return { messages, reporter, advance };
}

describe('createScanReporter', () => {
  it('sends found files in batches', () => {
    const { messages, reporter } = setup();
    for (let index = 0; index < 450; index += 1) reporter.file(video(index));
    const batches = messages.filter((message) => message.type === 'files');
    expect(batches.map((batch) => batch.files.length)).toEqual([200, 200]);
  });

  it('sends files after the flush interval', () => {
    const { messages, reporter, advance } = setup();
    reporter.file(video(1));
    expect(messages.filter((message) => message.type === 'files')).toEqual([]);
    advance(250);
    reporter.file(video(2));
    expect(messages.filter((message) => message.type === 'files')).toEqual([
      { type: 'files', files: [video(1), video(2)], tooSmallKeys: [] },
    ]);
  });

  it('sends the rest and the latest progress on flush', () => {
    const { messages, reporter } = setup();
    reporter.directory('E:\\Movies');
    reporter.file(video(1));
    messages.length = 0;
    reporter.flush();
    expect(messages).toEqual([
      { type: 'files', files: [video(1)], tooSmallKeys: [] },
      {
        type: 'progress',
        progress: { scanId, filesFound: 1, directoriesScanned: 1, currentDirectory: 'E:\\Movies' },
      },
    ]);
  });

  it('sends the keys of too-small videos with the files', () => {
    const { messages, reporter } = setup();
    reporter.file(video(1));
    reporter.tooSmall('e:/movies/extra.mkv');
    messages.length = 0;
    reporter.flush();
    expect(messages[0]).toEqual({
      type: 'files',
      files: [video(1)],
      tooSmallKeys: ['e:/movies/extra.mkv'],
    });
  });
});
