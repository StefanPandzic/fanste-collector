import type { ApiErrorCode, MetadataProvider } from '@fanste/core';

/** HTTP status of each gateway error code. */
export const API_ERROR_STATUS: Record<ApiErrorCode, number> = {
  unauthorized: 401,
  rate_limited: 429,
  bad_request: 400,
  not_found: 404,
  unsupported_category: 400,
  provider_error: 502,
  provider_not_configured: 501,
  not_implemented: 501,
  internal: 500,
};

/**
 * An error the gateway reports to the client as `{ error: { code, message, provider? } }`. The
 * message is shown to clients, so never put secrets or raw provider responses in it.
 */
export class GatewayError extends Error {
  readonly code: ApiErrorCode;
  readonly provider?: MetadataProvider;
  /** Seconds the client should wait before retrying (`Retry-After`), for `rate_limited`. */
  readonly retryAfterSeconds?: number;

  constructor(
    code: ApiErrorCode,
    message: string,
    options: { provider?: MetadataProvider; retryAfterSeconds?: number; cause?: unknown } = {},
  ) {
    super(message, { cause: options.cause });
    this.name = 'GatewayError';
    this.code = code;
    this.provider = options.provider;
    this.retryAfterSeconds = options.retryAfterSeconds;
  }

  get status(): number {
    return API_ERROR_STATUS[this.code];
  }
}
