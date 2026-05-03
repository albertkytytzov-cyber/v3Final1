import type { IncomingHttpHeaders } from "node:http";

export function readIdempotencyKey(headers: IncomingHttpHeaders) {
  const value = headers["x-idempotency-key"];

  if (Array.isArray(value)) {
    return value[0]?.trim() || null;
  }

  return typeof value === "string" ? value.trim() || null : null;
}
