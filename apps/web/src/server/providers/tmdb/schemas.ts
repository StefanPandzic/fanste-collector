import { z } from 'zod';

// The parts of TMDB v3 responses the adapter reads (FC-09). Lenient on purpose: TMDB sends `null` or
// `""` for unknown values, and the mappers drop those. Unknown keys are stripped.

const optionalText = z.string().nullish();
const named = z.object({ name: optionalText });

export const tmdbConfigurationSchema = z.object({
  images: z.object({
    secure_base_url: z.url({ protocol: /^https$/ }),
    poster_sizes: z.array(z.string()),
  }),
});

export const tmdbMovieSearchResultSchema = z.object({
  id: z.int().positive(),
  title: optionalText,
  original_title: optionalText,
  release_date: optionalText,
  poster_path: optionalText,
  popularity: z.number().nullish(),
});
export type TmdbMovieSearchResult = z.output<typeof tmdbMovieSearchResultSchema>;

export const tmdbTvSearchResultSchema = z.object({
  id: z.int().positive(),
  name: optionalText,
  original_name: optionalText,
  first_air_date: optionalText,
  poster_path: optionalText,
  popularity: z.number().nullish(),
});
export type TmdbTvSearchResult = z.output<typeof tmdbTvSearchResultSchema>;

function searchPageSchema<T extends z.ZodType>(result: T) {
  return z.object({
    page: z.int().min(1),
    total_pages: z.int().min(0),
    total_results: z.int().min(0),
    results: z.array(result),
  });
}

export const tmdbMovieSearchSchema = searchPageSchema(tmdbMovieSearchResultSchema);
export const tmdbTvSearchSchema = searchPageSchema(tmdbTvSearchResultSchema);

const externalIds = z.object({ imdb_id: optionalText });

/** `/movie/{id}?append_to_response=credits,external_ids`. */
export const tmdbMovieSchema = z.object({
  id: z.int().positive(),
  title: optionalText,
  original_title: optionalText,
  original_language: optionalText,
  release_date: optionalText,
  overview: optionalText,
  tagline: optionalText,
  runtime: z.number().nullish(),
  imdb_id: optionalText,
  poster_path: optionalText,
  genres: z.array(named).nullish(),
  credits: z.object({ crew: z.array(named.extend({ job: optionalText })) }).nullish(),
  external_ids: externalIds.nullish(),
});
export type TmdbMovie = z.output<typeof tmdbMovieSchema>;

/** `/tv/{id}?append_to_response=external_ids`. */
export const tmdbTvSchema = z.object({
  id: z.int().positive(),
  name: optionalText,
  original_name: optionalText,
  original_language: optionalText,
  first_air_date: optionalText,
  overview: optionalText,
  status: optionalText,
  number_of_seasons: z.number().nullish(),
  number_of_episodes: z.number().nullish(),
  episode_run_time: z.array(z.number()).nullish(),
  poster_path: optionalText,
  genres: z.array(named).nullish(),
  networks: z.array(named).nullish(),
  created_by: z.array(named).nullish(),
  seasons: z
    .array(
      z.object({
        season_number: z.number(),
        name: optionalText,
        episode_count: z.number().nullish(),
        air_date: optionalText,
      }),
    )
    .nullish(),
  external_ids: externalIds.nullish(),
});
export type TmdbTv = z.output<typeof tmdbTvSchema>;
