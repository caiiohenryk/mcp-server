/**
 * Only same-origin, absolute paths are accepted as post-login destinations
 * (prevents open redirects through `?next=`).
 */
export function safeNextPath(next: unknown, fallback = "/tokens"): string {
  if (typeof next !== "string") return fallback;
  if (!next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return fallback;
  if (/[\r\n]/.test(next)) return fallback;
  if (next === "/login" || next.startsWith("/login?") || next.startsWith("/api/")) return fallback;
  return next;
}
