'use client';

import { cn } from 'cn';

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';

import type { TvSeason, TvSeasonDetails } from '@fanste/core';

interface SeasonPickerProps {
  /** The show's seasons from TMDB. */
  seasons: readonly TvSeason[];
  /** The owned seasons; a season missing here isn't owned. */
  value: readonly TvSeasonDetails[];
  onChange: (value: TvSeasonDetails[]) => void;
  invalid?: boolean;
}

function seasonName(season: TvSeason): string {
  return season.name ?? (season.seasonNumber === 0 ? 'Specials' : `Season ${season.seasonNumber}`);
}

/**
 * The owned seasons of a TV copy: tick a season, then keep "All episodes" or pick some. Per-season
 * languages and quality are edited on the item page (FC-19).
 */
export function SeasonPicker({ seasons, value, onChange, invalid }: SeasonPickerProps) {
  const owned = new Map(value.map((season) => [season.seasonNumber, season]));

  function update(seasonNumber: number, entry: TvSeasonDetails | undefined) {
    const rest = value.filter((season) => season.seasonNumber !== seasonNumber);
    onChange((entry ? [...rest, entry] : rest).toSorted((a, b) => a.seasonNumber - b.seasonNumber));
  }

  function toggleEpisode(season: TvSeasonDetails, episode: number) {
    const list = season.episodesOwned === 'all' ? [] : season.episodesOwned;
    const next = list.includes(episode)
      ? list.filter((number) => number !== episode)
      : [...list, episode].sort((a, b) => a - b);
    update(season.seasonNumber, { ...season, episodesOwned: next });
  }

  const regular = seasons.filter((season) => season.seasonNumber > 0);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-2">
        <Button
          type="button"
          variant="outline"
          size="xs"
          onClick={() =>
            onChange(
              regular.map((season) => ({
                ...owned.get(season.seasonNumber),
                seasonNumber: season.seasonNumber,
                episodesOwned: 'all',
              })),
            )
          }
        >
          All seasons
        </Button>
        <Button type="button" variant="outline" size="xs" onClick={() => onChange([])}>
          None
        </Button>
      </div>

      <ul className="flex flex-col divide-y rounded-lg border">
        {seasons.map((season) => {
          const entry = owned.get(season.seasonNumber);
          const checkboxId = `season-${season.seasonNumber}`;
          const episodeCount = season.episodeCount ?? 0;
          const picked = entry && entry.episodesOwned !== 'all' ? entry.episodesOwned : [];
          return (
            <li key={season.seasonNumber} className="flex flex-col gap-2 p-3">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                <Checkbox
                  id={checkboxId}
                  checked={entry !== undefined}
                  onCheckedChange={(checked) =>
                    update(
                      season.seasonNumber,
                      checked === true
                        ? { seasonNumber: season.seasonNumber, episodesOwned: 'all' }
                        : undefined,
                    )
                  }
                />
                <Label htmlFor={checkboxId} className="font-medium">
                  {seasonName(season)}
                </Label>
                <span className="text-caption text-muted-foreground">
                  {season.episodeCount !== undefined &&
                    `${season.episodeCount} episode${season.episodeCount === 1 ? '' : 's'}`}
                  {season.airYear !== undefined && ` · ${season.airYear}`}
                </span>
                {entry && episodeCount > 0 && (
                  <div
                    className="ml-auto flex gap-1"
                    role="radiogroup"
                    aria-label={`Episodes of ${seasonName(season)}`}
                  >
                    {(['all', 'some'] as const).map((mode) => {
                      const active = (entry.episodesOwned === 'all') === (mode === 'all');
                      return (
                        <Button
                          key={mode}
                          type="button"
                          role="radio"
                          aria-checked={active}
                          variant={active ? 'secondary' : 'ghost'}
                          size="xs"
                          onClick={() =>
                            update(season.seasonNumber, {
                              ...entry,
                              episodesOwned: mode === 'all' ? 'all' : picked,
                            })
                          }
                        >
                          {mode === 'all' ? 'All episodes' : 'Some episodes'}
                        </Button>
                      );
                    })}
                  </div>
                )}
              </div>

              {entry && entry.episodesOwned !== 'all' && (
                <div
                  className="flex flex-wrap gap-1"
                  role="group"
                  aria-label={`Owned episodes of ${seasonName(season)}`}
                >
                  {Array.from({ length: episodeCount }, (_, index) => index + 1).map((episode) => {
                    const on = picked.includes(episode);
                    return (
                      <Button
                        key={episode}
                        type="button"
                        variant={on ? 'default' : 'outline'}
                        size="icon-sm"
                        aria-pressed={on}
                        aria-label={`Episode ${episode}`}
                        onClick={() => toggleEpisode(entry, episode)}
                        className={cn(
                          'tabular-nums',
                          invalid && picked.length === 0 && 'border-destructive',
                        )}
                      >
                        {episode}
                      </Button>
                    );
                  })}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
