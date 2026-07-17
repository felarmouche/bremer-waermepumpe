import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import {
  ADMIN_SESSION_COOKIE,
  applyAdminResponseHeaders,
  isValidAdminSession,
} from "../../../lib/admin-auth";
import { type KvLike } from "../../../lib/lead-flow";
import { getAllLeads, type LeadRow } from "../../../lib/leads";

export const prerender = false;

type Env = { DB?: unknown; SESSION?: KvLike };

const COLUMNS: { header: string; get: (l: LeadRow) => string | null }[] = [
  { header: "Referenz", get: (l) => l.reference },
  { header: "Eingegangen (UTC)", get: (l) => l.created_at },
  { header: "Bearbeitungsstatus", get: (l) => l.crm_status },
  { header: "Anrede", get: (l) => l.salutation },
  { header: "Vorname", get: (l) => l.vorname },
  { header: "Nachname", get: (l) => l.nachname },
  { header: "Telefon", get: (l) => l.telefon },
  { header: "Straße", get: (l) => l.strasse },
  { header: "Hausnummer", get: (l) => l.hausnummer },
  { header: "PLZ", get: (l) => l.plz },
  { header: "Ort", get: (l) => l.ort },
  { header: "Gebäudetyp", get: (l) => l.building_type },
  { header: "Heizung aktuell", get: (l) => l.heating_current },
  { header: "Heizungsalter", get: (l) => l.heating_age },
  { header: "Standort Heizung", get: (l) => l.heating_location },
  { header: "Zeitplan", get: (l) => l.timeline },
  { header: "Funnel-Status", get: (l) => l.status },
  { header: "SMS verifiziert am", get: (l) => l.sms_verified_at },
  { header: "Widerrufen am", get: (l) => l.revoked_at },
  { header: "Notizen", get: (l) => l.crm_notes },
];

// Semikolon + BOM: öffnet in deutschem Excel direkt korrekt.
function csvCell(value: string | null): string {
  let v = value ?? "";
  // Formel-Injection in Tabellenkalkulationen verhindern.
  if (/^[=+\-@\t\r]/.test(v)) v = `'${v}`;
  if (/[";\r\n]/.test(v)) v = `"${v.replace(/"/g, '""')}"`;
  return v;
}

export const GET: APIRoute = async ({ cookies }) => {
  const e = env as Env;
  const token = cookies.get(ADMIN_SESSION_COOKIE)?.value;
  if (!(await isValidAdminSession(e.SESSION, token))) {
    return new Response("Nicht angemeldet.", { status: 401 });
  }
  if (!e.DB) return new Response("Server misconfigured", { status: 500 });

  const leads = await getAllLeads(e.DB as never);
  const lines = [
    COLUMNS.map((c) => csvCell(c.header)).join(";"),
    ...leads.map((l) => COLUMNS.map((c) => csvCell(c.get(l))).join(";")),
  ];
  const csv = "\uFEFF" + lines.join("\r\n");

  const today = new Date().toISOString().slice(0, 10);
  const res = new Response(csv, {
    status: 200,
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="leads-${today}.csv"`,
    },
  });
  applyAdminResponseHeaders(res.headers);
  return res;
};
