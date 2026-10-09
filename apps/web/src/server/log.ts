// Gateway logging. Console only in v1 (FC-08); the host collects stdout/stderr.

type Fields = Record<string, string | number | boolean | undefined>;

function format(event: string, fields: Fields): string {
  const parts = Object.entries(fields)
    .filter(([, value]) => value !== undefined)
    .map(([key, value]) => `${key}=${String(value)}`);
  return `[gateway] ${event} ${parts.join(' ')}`.trimEnd();
}

export const gatewayLog = {
  info(event: string, fields: Fields = {}): void {
    console.info(format(event, fields));
  },
  warn(event: string, fields: Fields = {}): void {
    console.warn(format(event, fields));
  },
  error(event: string, fields: Fields = {}, error?: unknown): void {
    console.error(format(event, fields), ...(error === undefined ? [] : [error]));
  },
};
