// Auth für das interne Lead-Dashboard (/dashboard).
//
// Credentials liegen ausschließlich in Worker-Secrets (Repo ist öffentlich!):
//   ADMIN_EMAIL          – Login-E-Mail
//   ADMIN_PASSWORD_HASH  – "pbkdf2:<iterations>:<salt-hex>:<hash-hex>",
//                          erzeugt mit `node scripts/hash-admin-password.mjs`
//
// Die Iterationszahl ist bewusst moderat (10.000): der Worker läuft auf dem
// Cloudflare Free Plan (~10 ms CPU/Request). Online-Bruteforce wird primär
// durch das KV-Rate-Limit (5 Versuche / 15 min pro IP + globales Limit)
// verhindert; der Hash selbst verlässt Cloudflare nie.

import type { KvLike } from "./lead-flow";

export const ADMIN_SESSION_COOKIE = "__Host-bwp_admin";
export const ADMIN_SESSION_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 Tage

const SESSION_KV_PREFIX = "admin:sess:";

// Dummy-Hash, damit auch bei falscher E-Mail eine PBKDF2-Ableitung läuft
// (kein Timing-Orakel, das die korrekte E-Mail verrät).
const DUMMY_HASH =
  "pbkdf2:10000:00000000000000000000000000000000:0000000000000000000000000000000000000000000000000000000000000000";

function hexToBytes(hex: string): Uint8Array | null {
  if (hex.length % 2 !== 0 || /[^0-9a-f]/i.test(hex)) return null;
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

async function derivePbkdf2(
  password: string,
  salt: Uint8Array,
  iterations: number,
): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt: salt as BufferSource, iterations },
    key,
    256,
  );
  return new Uint8Array(bits);
}

/** Prüft ein Passwort gegen "pbkdf2:<iterations>:<salt-hex>:<hash-hex>". */
export async function verifyPassword(
  stored: string | undefined,
  password: string,
): Promise<boolean> {
  const parts = (stored ?? "").split(":");
  const iterations = parseInt(parts[1], 10);
  const salt = parts.length === 4 ? hexToBytes(parts[2]) : null;
  const expected = parts.length === 4 ? hexToBytes(parts[3]) : null;

  const storedIsValid =
    parts.length === 4 &&
    parts[0] === "pbkdf2" &&
    Number.isFinite(iterations) &&
    iterations >= 1000 &&
    iterations <= 200000 &&
    salt !== null &&
    expected !== null &&
    expected.length === 32;

  // Bei fehlendem/kaputtem Secret trotzdem gegen den Dummy ableiten, damit die
  // Antwortzeit nichts verrät — das Ergebnis wird danach hart verworfen.
  const dummy = DUMMY_HASH.split(":");
  const derived = await derivePbkdf2(
    password,
    storedIsValid ? salt : hexToBytes(dummy[2])!,
    storedIsValid ? iterations : parseInt(dummy[1], 10),
  );
  const match = timingSafeEqual(
    derived,
    storedIsValid ? expected : hexToBytes(dummy[3])!,
  );
  return storedIsValid && match;
}

/** Konstant-Zeit-Vergleich zweier Strings (z. B. E-Mail). */
export function safeStringEqual(a: string, b: string): boolean {
  const enc = new TextEncoder();
  const ab = enc.encode(a);
  const bb = enc.encode(b);
  if (ab.length !== bb.length) {
    // Trotzdem vergleichen, damit die Länge kein präzises Orakel wird.
    timingSafeEqual(ab, ab);
    return false;
  }
  return timingSafeEqual(ab, bb);
}

export async function createAdminSession(kv: KvLike): Promise<string> {
  const raw = new Uint8Array(32);
  crypto.getRandomValues(raw);
  const token = bytesToHex(raw);
  await kv.put(
    `${SESSION_KV_PREFIX}${token}`,
    JSON.stringify({ createdAt: new Date().toISOString() }),
    { expirationTtl: ADMIN_SESSION_TTL_SECONDS },
  );
  return token;
}

export async function isValidAdminSession(
  kv: KvLike | undefined,
  token: string | undefined,
): Promise<boolean> {
  if (!kv || !token || !/^[0-9a-f]{64}$/.test(token)) return false;
  return (await kv.get(`${SESSION_KV_PREFIX}${token}`)) !== null;
}

export async function deleteAdminSession(
  kv: KvLike | undefined,
  token: string | undefined,
): Promise<void> {
  if (!kv || !token || !/^[0-9a-f]{64}$/.test(token)) return;
  try {
    await kv.delete(`${SESSION_KV_PREFIX}${token}`);
  } catch {
    /* Cookie wird trotzdem gelöscht */
  }
}

/**
 * CSRF-Schutz für mutierende Admin-Requests: Browser senden bei
 * Cross-Site-POSTs immer einen fremden Origin-Header. Zusammen mit
 * SameSite=Strict auf dem Session-Cookie reicht dieser Check aus.
 */
export function isSameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  return origin === new URL(request.url).origin;
}

/** Header, die jede Dashboard-/Admin-Response tragen muss. */
export function applyAdminResponseHeaders(headers: Headers): void {
  headers.set("X-Robots-Tag", "noindex, nofollow, noarchive");
  headers.set("Cache-Control", "no-store");
  headers.set("Referrer-Policy", "no-referrer");
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("X-Frame-Options", "DENY");
}
