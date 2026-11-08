import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

/**
 * Token format: `pv1_<prefix>_<secret>`
 *  - `pv1`    : version marker, also used by secret scanners
 *  - prefix   : 10 chars base32-ish, public, unique, used for DB lookup
 *  - secret   : 32 random bytes, base64url (43 chars)
 */
export const TOKEN_VERSION = "pv1";
const PREFIX_ALPHABET = "abcdefghijkmnpqrstuvwxyz23456789"; // no ambiguous chars
const PREFIX_LENGTH = 10;
const TOKEN_REGEX = /^pv1_([a-km-np-z2-9]{10})_([A-Za-z0-9_-]{43})$/;

function randomPrefix(): string {
  const bytes = randomBytes(PREFIX_LENGTH);
  let out = "";
  for (const b of bytes) out += PREFIX_ALPHABET[b % PREFIX_ALPHABET.length];
  return out;
}

export function generateToken(): { token: string; prefix: string } {
  const prefix = randomPrefix();
  const secret = randomBytes(32).toString("base64url");
  return { token: `${TOKEN_VERSION}_${prefix}_${secret}`, prefix };
}

export function parseToken(token: string): { prefix: string } | null {
  const m = TOKEN_REGEX.exec(token.trim());
  return m ? { prefix: m[1]! } : null;
}

export function hashToken(token: string, pepper: string): string {
  return createHmac("sha256", pepper).update(token).digest("hex");
}

export function hashesMatch(aHex: string, bHex: string): boolean {
  const a = Buffer.from(aHex, "hex");
  const b = Buffer.from(bHex, "hex");
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Masked representation safe to show in UI/logs. */
export function maskToken(prefix: string): string {
  return `${TOKEN_VERSION}_${prefix}_${"•".repeat(8)}`;
}
