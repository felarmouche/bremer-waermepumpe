export const ALLOWED_QUIZ = {
  gebaeudetyp: [
    "einfamilienhaus",
    "reihenhaus",
    "doppelhaushaelfte",
    "mehrfamilienhaus",
    "sonstiges",
  ],
  baujahr: ["vor1977", "1977_1995", "1996_2020", "nach2020"],
  flaeche: ["bis100", "100_150", "150_220", "ueber220"],
  heizung: [
    "oel",
    "gas",
    "gasetage",
    "fernwaerme",
    "nachtspeicher",
    "biomasse",
    "kohle",
    "waermepumpe",
    "andere",
  ],
  heizungsalter: ["u5", "5_15", "15_20", "20_25", "ueber25", "unbekannt"],
  waermeabgabe: ["heizkoerper", "gemischt", "fbh"],
  daemmung: ["unsaniert", "teilsaniert", "saniert", "neubau", "unsicher"],
  eigentum: ["selbstgenutzt", "vermietet", "weg", "mieter"],
  einkommen: ["bis40", "40_90", "ueber90", "keine", ""],
  antrag: ["ja", "planung", "nein"],
  horizon: ["defekt_jetzt", "3m", "6m", "dieses_jahr", "1_2_jahre", "spaeter"],
  motivation: ["defekt", "sparen", "umwelt", "foerderung", "informieren"],
} as const;

export function pick(
  value: unknown,
  allowed: readonly string[],
): string | null {
  if (typeof value !== "string") return null;
  return allowed.includes(value) ? value : null;
}

export function validEmail(v: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v);
}


export function sanitizeText(v: unknown, max: number): string | null {
  if (typeof v !== "string") return null;
  const s = v.trim().replace(/[<>&"']/g, "");
  return s.length > 0 && s.length <= max ? s : null;
}

// Nur cf-connecting-ip: wird von Cloudflare gesetzt und kann vom Client nicht
// überschrieben werden. X-Forwarded-For ist frei fälschbar und würde jedes
// IP-basierte Rate-Limit aushebeln.
export function clientIp(request: Request): string {
  return request.headers.get("cf-connecting-ip") ?? "unknown";
}

/**
 * Pepper für SMS-Code-Hashes. In Produktion zwingend als Secret gesetzt —
 * fehlt es, wird der Request abgelehnt statt mit einem öffentlich bekannten
 * Fallback zu hashen.
 */
export function smsPepper(value: string | undefined): string | null {
  if (value && value.length >= 16) return value;
  return import.meta.env.DEV ? "dev-pepper-only" : null;
}

/** Konstant-Zeit-Vergleich zweier Hex-Hashes. */
export function hashEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/**
 * Globales Tageslimit für ausgehende SMS (Schutz vor SMS-Pumping / Kosten-
 * Missbrauch über viele IPs und Nummern). Zählt jede SMS, die gleich
 * versendet wird. Limit über SMS_DAILY_LIMIT (Default 200) anpassbar.
 */
export async function checkGlobalSmsBudget(
  kv: KvLike | undefined,
  limitRaw: string | undefined,
): Promise<boolean> {
  const limit = parseInt(limitRaw ?? "", 10);
  const day = new Date().toISOString().slice(0, 10);
  const res = await checkAndIncrementRate(
    kv,
    `rate:sms:global:${day}`,
    Number.isFinite(limit) && limit > 0 ? limit : 200,
    90000,
  );
  return res.ok;
}

export type KvLike = {
  get(key: string): Promise<string | null>;
  put(
    key: string,
    value: string,
    options?: { expirationTtl?: number },
  ): Promise<void>;
  delete(key: string): Promise<void>;
};

export async function checkAndIncrementRate(
  kv: KvLike | undefined,
  key: string,
  limit: number,
  ttlSeconds: number,
): Promise<{ ok: true } | { ok: false; retryAfter: number }> {
  if (!kv) return { ok: true };
  const raw = await kv.get(key);
  const count = raw ? parseInt(raw, 10) : 0;
  if (count >= limit) {
    return { ok: false, retryAfter: ttlSeconds };
  }
  await kv.put(key, String(count + 1), { expirationTtl: ttlSeconds });
  return { ok: true };
}

export function jsonResponse(
  body: object,
  status: number,
  extraHeaders?: Record<string, string>,
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...(extraHeaders ?? {}) },
  });
}
