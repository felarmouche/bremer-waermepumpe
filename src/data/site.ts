/**
 * Herkunftskennung dieser Website in der gemeinsamen D1-Datenbank `anonymous-leads`.
 *
 * Mehrere Websites (bremer-waermepumpe.de, duesseldorfer-waermepumpe.de) schreiben in
 * dieselbe Tabelle `leads`. Jede Abfrage in `src/lib/leads.ts` ist auf diese Kennung
 * beschränkt: Dashboard, Export, Admin-APIs und Widerruf sehen und ändern nur Leads
 * der eigenen Website. Der Wert ist bewusst eine Code-Konstante (kein Client-Input,
 * keine optionale Umgebungsvariable), damit er nicht fehlen oder manipuliert werden kann.
 *
 * Spalte: `leads.origin_site` (Migration scripts/d1-migration-2026-10-31-origin-site.sql).
 */
export const ORIGIN_SITE = "bremen" as const;

/** Präfix der Lead-Referenz, z. B. BWP-2026-00042. */
export const LEAD_REFERENCE_PREFIX = "BWP" as const;
