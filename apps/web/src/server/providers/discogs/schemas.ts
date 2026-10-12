import { z } from 'zod';

// The parts of Discogs API responses the adapter reads (FC-10). Lenient on purpose: Discogs sends
// `""`, `0` or `"none"` for unknown values, and the mappers drop those. Unknown keys are stripped.

const optionalText = z.string().nullish();
/** Discogs sends some numbers as strings (`qty: "2"`, a search result's `year: "1969"`). */
const looseNumber = z.union([z.number(), z.string()]).nullish();

export const discogsArtistSchema = z.object({
  /** Notes refer to artists by it (`[a82730]`). */
  id: z.int().nullish(),
  name: optionalText,
  /** "Artist name variation": how the release credits the artist. */
  anv: optionalText,
  /** Joins this artist to the next one, e.g. `&`, `,`, `Feat.`. */
  join: optionalText,
});
export type DiscogsArtist = z.output<typeof discogsArtistSchema>;

export const discogsFormatSchema = z.object({
  name: optionalText,
  qty: looseNumber,
  descriptions: z.array(z.string()).nullish(),
  text: optionalText,
});
export type DiscogsFormat = z.output<typeof discogsFormatSchema>;

const labelSchema = z.object({ name: optionalText, catno: optionalText });
export type DiscogsLabel = z.output<typeof labelSchema>;

const subTrackSchema = z.object({
  position: optionalText,
  type_: optionalText,
  title: optionalText,
  duration: optionalText,
});

/** A tracklist entry: a `track`, a `heading`, or an `index` track with `sub_tracks`. */
const trackSchema = subTrackSchema.extend({ sub_tracks: z.array(subTrackSchema).nullish() });
export type DiscogsTrack = z.output<typeof trackSchema>;

const imageSchema = z.object({
  /** `primary` or `secondary`. */
  type: optionalText,
  uri: optionalText,
  uri150: optionalText,
});
export type DiscogsImage = z.output<typeof imageSchema>;

/** One `/database/search` result. `title` is `"Artist - Title"`. */
export const discogsSearchResultSchema = z.object({
  id: z.int().positive(),
  type: optionalText,
  title: optionalText,
  year: looseNumber,
  country: optionalText,
  /** Format names and descriptions in one list, e.g. `["Vinyl", "LP", "Album"]`. */
  format: z.array(z.string()).nullish(),
  /** The same with quantities, when Discogs sends it. */
  formats: z.array(discogsFormatSchema).nullish(),
  catno: optionalText,
  thumb: optionalText,
  cover_image: optionalText,
});
export type DiscogsSearchResult = z.output<typeof discogsSearchResultSchema>;

export const discogsSearchSchema = z.object({
  pagination: z.object({
    page: z.int().min(1),
    pages: z.int().min(0),
    items: z.int().min(0),
  }),
  results: z.array(discogsSearchResultSchema),
});

const itemFields = {
  id: z.int().positive(),
  title: optionalText,
  artists: z.array(discogsArtistSchema).nullish(),
  /** `0` when unknown. */
  year: z.number().nullish(),
  genres: z.array(z.string()).nullish(),
  styles: z.array(z.string()).nullish(),
  tracklist: z.array(trackSchema).nullish(),
  images: z.array(imageSchema).nullish(),
  /** With Discogs markup, e.g. `[a=The Beatles]`. */
  notes: optionalText,
  uri: optionalText,
};

/** A barcode, matrix / runout code, rights society, ... of a release. */
const identifierSchema = z.object({
  /** e.g. `Barcode`, `Matrix / Runout`, `Rights Society`. */
  type: optionalText,
  value: optionalText,
  description: optionalText,
});
export type DiscogsIdentifier = z.output<typeof identifierSchema>;

/** `/releases/{id}`: one pressing. */
export const discogsReleaseSchema = z.object({
  ...itemFields,
  identifiers: z.array(identifierSchema).nullish(),
  country: optionalText,
  labels: z.array(labelSchema).nullish(),
  formats: z.array(discogsFormatSchema).nullish(),
  thumb: optionalText,
  master_id: z.int().nullish(),
});
export type DiscogsRelease = z.output<typeof discogsReleaseSchema>;

/** `/masters/{id}`: the album across its pressings. */
export const discogsMasterSchema = z.object(itemFields);
export type DiscogsMaster = z.output<typeof discogsMasterSchema>;
