import { GatewayError } from '../errors';
import { PROVIDER_LIMITS, PROVIDER_RETRY } from '../limits';
import { gatewayLog } from '../log';
import { fetchWithRetry } from '../rate-limit/retry';
import { createThrottle, ThrottleFullError } from '../rate-limit/throttle';

import type { Throttle } from '../rate-limit/throttle';
import type { ExternalProvider } from '@fanste/core';

export interface ProviderFetchOptions {
  /** Statuses to retry besides 429/503, e.g. BGG's `202 Accepted` "request queued" (FC-12). */
  retryStatuses?: readonly number[];
}

// One throttle per provider and server instance, shared by all requests.
const throttles = new Map<ExternalProvider, Throttle>();

function throttleFor(provider: ExternalProvider): Throttle {
  let throttle = throttles.get(provider);
  if (!throttle) {
    throttle = createThrottle(PROVIDER_LIMITS[provider]);
    throttles.set(provider, throttle);
  }
  return throttle;
}

/**
 * `fetch` for provider adapters: every attempt waits for the provider's throttle, 429/503 are retried
 * with backoff, and latency and failures are logged. Returns the response when it's OK; throws a
 * `GatewayError` (`not_found` for 404, `provider_error` otherwise) when it isn't.
 *
 * Never log `url` query strings that carry secrets: pass keys in headers.
 */
export async function providerFetch(
  provider: ExternalProvider,
  url: URL | string,
  init: RequestInit = {},
  { retryStatuses = [429, 503] }: ProviderFetchOptions = {},
): Promise<Response> {
  const throttle = throttleFor(provider);
  const path = new URL(url).pathname;
  const started = Date.now();

  let response: Response;
  try {
    response = await fetchWithRetry(
      () =>
        throttle.schedule(() => {
          const timeout = AbortSignal.timeout(PROVIDER_RETRY.timeoutMs);
          const signal = init.signal ? AbortSignal.any([init.signal, timeout]) : timeout;
          return fetch(url, { ...init, signal });
        }),
      {
        ...PROVIDER_RETRY,
        retryStatuses,
        onRetry: ({ attempt, status, delayMs }) =>
          gatewayLog.warn('provider.retry', { provider, path, status, attempt, delayMs }),
      },
    );
  } catch (error) {
    if (error instanceof ThrottleFullError) {
      gatewayLog.warn('provider.queue_full', { provider, path });
      throw new GatewayError('provider_error', `${provider} is busy. Try again shortly.`, {
        provider,
        cause: error,
      });
    }
    gatewayLog.error('provider.failed', { provider, path, ms: Date.now() - started }, error);
    throw new GatewayError('provider_error', `${provider} could not be reached.`, {
      provider,
      cause: error,
    });
  }

  const ms = Date.now() - started;
  if (response.ok && !retryStatuses.includes(response.status)) {
    gatewayLog.info('provider.ok', { provider, path, status: response.status, ms });
    return response;
  }

  await response.body?.cancel();
  if (response.status === 404) {
    gatewayLog.info('provider.not_found', { provider, path, ms });
    throw new GatewayError('not_found', `${provider} has no such item.`, { provider });
  }
  gatewayLog.error('provider.error', { provider, path, status: response.status, ms });
  throw new GatewayError('provider_error', `${provider} answered with HTTP ${response.status}.`, {
    provider,
  });
}
