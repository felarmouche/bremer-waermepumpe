import type { APIRoute } from "astro";

export const prerender = false;

const ALLOWED = {
  gebaeudetyp: ["einfamilienhaus", "reihenhaus", "doppelhaushaelfte", "mehrfamilienhaus", "sonstiges"],
  baujahr: ["vor1977", "1977_1995", "1996_2020", "nach2020"],
  flaeche: ["bis100", "100_150", "150_220", "ueber220"],
  heizung: ["oel", "gas", "gasetage", "fernwaerme", "nachtspeicher", "biomasse", "kohle", "waermepumpe", "andere"],
  heizungsalter: ["u5", "5_15", "15_20", "20_25", "ueber25", "unbekannt"],
  waermeabgabe: ["heizkoerper", "gemischt", "fbh"],
  daemmung: ["unsaniert", "teilsaniert", "saniert", "neubau", "unsicher"],
  eigentum: ["selbstgenutzt", "vermietet", "weg", "mieter"],
  einkommen: ["bis40", "40_90", "ueber90", "keine", ""],
  antrag: ["ja", "planung", "nein"],
  eignung_level: ["hoch", "mittel", "niedrig"],
  foerder_level: ["wahrscheinlich", "pruefen", "eingeschraenkt", "nicht_anwendbar", "bereits_gestellt"],
} as const;

function pickAllowed(value: unknown, allowed: readonly string[]): string | null {
  if (typeof value !== "string") return null;
  return allowed.includes(value) ? value : null;
}

export const POST: APIRoute = async ({ request, locals }) => {
  if (request.headers.get("content-type")?.includes("application/json") !== true) {
    return new Response("Bad Request", { status: 400 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return new Response("Bad Request", { status: 400 });
  }

  const env = (locals as { runtime?: { env?: { DB?: D1Database } } }).runtime?.env;
  const db = env?.DB;
  if (!db) {
    return new Response("Server misconfigured", { status: 500 });
  }

  const summe = Number(body.foerder_summe);
  const foerderSumme = Number.isFinite(summe) && summe >= 0 && summe <= 100 ? Math.round(summe) : null;

  try {
    await db
      .prepare(
        `INSERT INTO check_eintraege (
          gebaeudetyp, baujahr, flaeche, heizung, heizungsalter,
          waermeabgabe, daemmung, eigentum, einkommen, antrag,
          eignung_level, foerder_level, foerder_summe
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        pickAllowed(body.gebaeudetyp, ALLOWED.gebaeudetyp),
        pickAllowed(body.baujahr, ALLOWED.baujahr),
        pickAllowed(body.flaeche, ALLOWED.flaeche),
        pickAllowed(body.heizung, ALLOWED.heizung),
        pickAllowed(body.heizungsalter, ALLOWED.heizungsalter),
        pickAllowed(body.waermeabgabe, ALLOWED.waermeabgabe),
        pickAllowed(body.daemmung, ALLOWED.daemmung),
        pickAllowed(body.eigentum, ALLOWED.eigentum),
        pickAllowed(body.einkommen, ALLOWED.einkommen),
        pickAllowed(body.antrag, ALLOWED.antrag),
        pickAllowed(body.eignung_level, ALLOWED.eignung_level),
        pickAllowed(body.foerder_level, ALLOWED.foerder_level),
        foerderSumme,
      )
      .run();
  } catch (err) {
    return new Response("Insert failed", { status: 500 });
  }

  return new Response(null, { status: 204 });
};
