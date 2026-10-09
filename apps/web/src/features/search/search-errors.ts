import { ApiClientError } from '@fanste/api-client';

/** `fetch` rejects with a TypeError ("Failed to fetch", "NetworkError …") when there is no connection. */
function isNetworkError(error: unknown): boolean {
  return error instanceof TypeError && /fetch|network/i.test(error.message);
}

/** Whether a failed search is worth retrying on its own: a busy provider or a dropped connection. */
export function isRetryableSearchError(error: unknown): boolean {
  if (error instanceof ApiClientError) {
    return error.code === 'provider_error' || error.code === 'rate_limited';
  }
  return isNetworkError(error);
}

export interface SearchErrorText {
  title: string;
  description: string;
}

/** What to tell the user about a failed search. Gateway messages are never shown as they are. */
export function searchErrorText(error: unknown, providerName: string): SearchErrorText {
  if (error instanceof ApiClientError) {
    switch (error.code) {
      case 'provider_error':
        return {
          title: `${providerName} is not responding`,
          description: `${providerName} is busy or down. Try again in a moment.`,
        };
      case 'rate_limited':
        return error.provider
          ? {
              title: `${providerName} is busy`,
              description: `${providerName} is limiting requests. Try again in a moment.`,
            }
          : {
              title: 'Too many searches',
              description: 'Wait a few seconds, then try again.',
            };
      case 'provider_not_configured':
      case 'unsupported_category':
        return {
          title: 'Search is not available',
          description: `Searching ${providerName} isn't set up on this server yet.`,
        };
      case 'unauthorized':
        return {
          title: 'You were signed out',
          description: 'Sign in again to keep searching.',
        };
      case 'bad_request':
        return {
          title: 'Search not possible',
          description: 'Check the search text and the year, then try again.',
        };
      default:
        break;
    }
  }
  if (isNetworkError(error)) {
    return {
      title: 'You seem to be offline',
      description: 'Check your connection and try again.',
    };
  }
  return { title: 'Search failed', description: 'Something went wrong. Try again.' };
}

/** The banner shown while a failed search is retried, e.g. `TMDB is busy, retrying…`. */
export function retryingText(error: unknown, providerName: string): string {
  if (error instanceof ApiClientError && error.code === 'rate_limited' && !error.provider) {
    return 'Too many searches, retrying…';
  }
  if (isNetworkError(error)) return 'Connection lost, retrying…';
  return `${providerName} is busy, retrying…`;
}
