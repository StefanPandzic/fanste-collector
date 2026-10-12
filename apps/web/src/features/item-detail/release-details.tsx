import { matrixCodesOf, mediaFacts, tracklistOf } from './item-detail-view';
import { Tracklist } from './tracklist';

import type { NormalizedItem } from '@fanste/core';

/**
 * The category's facts (runtime, seasons, label, barcode, ...) and, for a record (FC-10), its
 * matrix / runout codes and tracklist. Shown on the item page and in the add dialog, so almost
 * identical pressings can be told apart before one is added.
 */
export function ReleaseDetails({
  item,
  heading: Heading = 'h2',
}: {
  item: NormalizedItem;
  /** The level of the lists' headings: `h2` on the item page, `h4` in the add dialog. */
  heading?: 'h2' | 'h4';
}) {
  const facts = mediaFacts(item);
  const matrix = matrixCodesOf(item);

  return (
    <>
      {facts.length > 0 && (
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
          {facts.map((fact) => (
            <div key={fact.label} className="contents">
              <dt className="text-muted-foreground">{fact.label}</dt>
              <dd className="min-w-0 break-words">{fact.value}</dd>
            </div>
          ))}
        </dl>
      )}

      {matrix.length > 0 && (
        <section className="flex max-w-prose flex-col gap-2" aria-label="Matrix / runout">
          <Heading className="text-sm font-medium">Matrix / runout</Heading>
          <ul className="flex flex-col text-sm">
            {matrix.map((code, index) => (
              <li
                key={`${index}-${code.value}`}
                className="flex flex-wrap gap-x-2 border-b py-1 last:border-b-0"
              >
                <span className="font-mono break-all">{code.value}</span>
                {code.description && (
                  <span className="text-muted-foreground">{code.description}</span>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      <Tracklist tracks={tracklistOf(item)} heading={Heading} />
    </>
  );
}
