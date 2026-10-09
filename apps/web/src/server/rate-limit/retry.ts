export interface RetryOptions {
  maxRetries: number;
  baseDelayMs: number;
  /** Longest single wait. A `Retry-After` above it ends the retries and returns the response. */
  maxDelayMs: number;
  /** Status codes worth retrying. Default: 429 Too Many Requests and 503 Service Unavailable. */
  retryStatuses?: readonly number[];
  /** Waits between attempts; replaced in tests. */
  sleep?: (ms: number) => Promise<void>;
  /** A number in [0, 1) for the jitter; replaced in tests. */
  random?: () => number;
  /** Called before each retry, e.g. for logging. */
  onRetry?: (info: { attempt: number; status: number; delayMs: number }) => void;
}

const DEFAULT_RETRY_STATUSES = [429, 503];

const defaultSleep = (ms: number) =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });

/**
 * Milliseconds to wait from a `Retry-After` header, which holds either seconds or an HTTP date.
 * `undefined` when it's missing or malformed.
 */
export function parseRetryAfter(value: string | null, now = Date.now()): number | undefined {
  if (!value) return undefined;
  const trimmed = value.trim();
  if (/^\d+$/.test(trimmed)) return Number(trimmed) * 1000;
  const date = Date.parse(trimmed);
  return Number.isNaN(date) ? undefined : Math.max(0, date - now);
}

/** Exponential backoff with jitter: `base * 2^attempt`, scaled by 50–100 %, capped at `max`. */
export function backoffDelay(
  attempt: number,
  { baseDelayMs, maxDelayMs }: Pick<RetryOptions, 'baseDelayMs' | 'maxDelayMs'>,
  random: () => number = Math.random,
): number {
  const exponential = baseDelayMs * 2 ** attempt;
  return Math.min(maxDelayMs, Math.round(exponential * (0.5 + random() / 2)));
}

/**
 * Calls `request` and retries it with exponential backoff while it answers with a retryable status,
 * honouring `Retry-After`. Returns the last response, so the caller decides what a failure means.
 */
export async function fetchWithRetry(
  request: () => Promise<Response>,
  options: RetryOptions,
): Promise<Response> {
  const {
    maxRetries,
    maxDelayMs,
    retryStatuses = DEFAULT_RETRY_STATUSES,
    sleep = defaultSleep,
    random = Math.random,
    onRetry,
  } = options;

  for (let attempt = 0; ; attempt++) {
    const response = await request();
    if (!retryStatuses.includes(response.status) || attempt >= maxRetries) return response;

    const retryAfter = parseRetryAfter(response.headers.get('retry-after'));
    if (retryAfter !== undefined && retryAfter > maxDelayMs) return response;
    const delayMs = retryAfter ?? backoffDelay(attempt, options, random);

    // Free the connection before waiting.
    await response.body?.cancel();
    onRetry?.({ attempt: attempt + 1, status: response.status, delayMs });
    await sleep(delayMs);
  }
}
