import { z } from 'zod';

// The parts of IGDB and Twitch responses the adapter reads (FC-11). Lenient on purpose: IGDB leaves
// out fields it has no value for, and the mappers drop what's left empty. Unknown keys are stripped.

const optionalText = z.string().nullish();

/** `POST https://id.twitch.tv/oauth2/token` with `grant_type=client_credentials`. */
export const twitchTokenSchema = z.object({
  access_token: z.string().min(1),
  /** Seconds. */
  expires_in: z.number().positive(),
});

export const igdbPlatformSchema = z.object({
  id: z.int().positive(),
  name: optionalText,
  abbreviation: optionalText,
});
export type IgdbPlatform = z.output<typeof igdbPlatformSchema>;

const involvedCompanySchema = z.object({
  company: z.object({ name: optionalText }).nullish(),
  developer: z.boolean().nullish(),
  publisher: z.boolean().nullish(),
});
export type IgdbInvolvedCompany = z.output<typeof involvedCompanySchema>;

/** A game from `/v4/games`; a search asks for fewer fields than `getById`. */
export const igdbGameSchema = z.object({
  id: z.int().positive(),
  name: optionalText,
  summary: optionalText,
  /** Unix seconds. */
  first_release_date: z.number().nullish(),
  cover: z.object({ image_id: optionalText }).nullish(),
  genres: z.array(z.object({ name: optionalText })).nullish(),
  platforms: z.array(igdbPlatformSchema).nullish(),
  involved_companies: z.array(involvedCompanySchema).nullish(),
  game_type: z.int().nullish(),
  url: optionalText,
});
export type IgdbGame = z.output<typeof igdbGameSchema>;

export const igdbGamesSchema = z.array(igdbGameSchema);
export const igdbPlatformsSchema = z.array(igdbPlatformSchema);
