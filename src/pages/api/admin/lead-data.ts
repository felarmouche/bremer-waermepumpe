import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import {
  ADMIN_SESSION_COOKIE,
  applyAdminResponseHeaders,
  isValidAdminSession,
} from "../../../lib/admin-auth";
import { type KvLike } from "../../../lib/lead-flow";
import { normalizeDePhone } from "../../../lib/sms";
import {
  findLeadIdsByPhone,
  getAdminNotified,
  getConsentsByLeadId,
  getLeadById,
  getRevocationsByLeadId,
  getSmsVerificationsByLeadId,
  type LeadRow,
} from "../../../lib/leads";

export const prerender = false;

type Env = { DB?: unknown; SESSION?: KvLike };

// Vollständiger Datenauszug als Text. Zwei Zugänge:
//   ?id=<lead-id>      — Auskunft nach Art. 15 DSGVO für einen Lead
//   ?phone=<nummer>    — Nachweis-Suche: belegt die Einwilligung zu einer
//                        Telefonnummer (§ 7a Abs. 2 UWG), funktioniert auch
//                        nach Stammdaten-Löschung über sms_verifications.
async function buildExtract(db: never, lead: LeadRow): Promise<string[]> {
  const [consents, smsRows, revocations, notified] = await Promise.all([
    getConsentsByLeadId(db, lead.id),
    getSmsVerificationsByLeadId(db, lead.id),
    getRevocationsByLeadId(db, lead.id),
    getAdminNotified(db, lead.id),
  ]);

  const v = (s: string | null | undefined) => (s && s !== "" ? s : "—");
  const lines: string[] = [
    `Referenz: ${lead.reference}`,
    `Anfrage eingegangen: ${lead.created_at} (UTC)`,
    ...(lead.status === "deleted"
      ? [
          `Hinweis: Stammdaten wurden gemäß Art. 17 DSGVO gelöscht — es folgen die`,
          `aufbewahrungspflichtigen Nachweise (§ 7a Abs. 2 UWG, 5 Jahre).`,
        ]
      : []),
    ``,
    `── Stammdaten ─────────────────────────────`,
    `Anrede:        ${v(lead.salutation)}`,
    `Name:          ${v(lead.vorname)} ${v(lead.nachname)}`,
    `Telefon:       ${v(lead.telefon)} (Eingabe: ${v(lead.telefon_raw)})`,
    `Anschrift:     ${v(lead.strasse)} ${v(lead.hausnummer)}, ${v(lead.plz)} ${v(lead.ort)}`,
    ``,
    `── Angaben aus dem Wärmepumpen-Check ──────`,
    `Aktuelle Heizung:  ${v(lead.heating_current)}`,
    `Heizungsalter:     ${v(lead.heating_age)}`,
    `Gebäudetyp:        ${v(lead.building_type)}`,
    `Eigentümer:        ${lead.is_owner === 1 ? "ja" : lead.is_owner === 0 ? "nein" : "—"}`,
    `Aufstellort:       ${v(lead.heating_location)}`,
    `Zeitlicher Rahmen: ${v(lead.timeline)}`,
    ``,
    `── Status ─────────────────────────────────`,
    `Funnel-Status:       ${lead.status}`,
    `SMS verifiziert am:  ${v(lead.sms_verified_at)}`,
    `Lead-Mail versandt:  ${v(lead.admin_email_sent_at)}`,
    `Widerrufen am:       ${v(lead.revoked_at)}`,
    `Bearbeitungsstatus:  ${lead.crm_status} (zuletzt: ${v(lead.crm_updated_at)})`,
    `Interne Notizen:     ${v(lead.crm_notes)}`,
    ``,
    `── Einwilligungs-Nachweis (Art. 7 Abs. 1 DSGVO, § 7a UWG: 5 J. Aufbewahrung) ──`,
  ];

  if (consents.length === 0) lines.push(`(kein Eintrag)`);
  for (const c of consents) {
    lines.push(
      `Version: ${c.consent_version} | Partner-Version: ${c.partners_version}`,
      `Erteilt: ${c.consent_timestamp} | IP: ${c.consent_ip}`,
      `User-Agent: ${v(c.consent_user_agent)}`,
      `Verknüpfte SMS-Verifizierung: ${c.sms_verification_id ?? "—"} (siehe unten)`,
      `Bestätigte Texte:`,
      ...c.consent_text.split("\n").map((l) => `  ${l}`),
      `Partner-Snapshot: ${c.partners_snapshot}`,
      ``,
    );
  }

  lines.push(
    `── SMS-Verifizierungen (Code-Ident, BGH „Telefonaktion II“; Code nur als Hash) ──`,
  );
  if (smsRows.length === 0) lines.push(`(kein Eintrag)`);
  for (const s of smsRows) {
    lines.push(
      `[#${s.id}] Nummer: ${s.phone_e164} | gesendet: ${s.sent_at} | bestätigt: ${v(s.verified_at)} | Versuche: ${s.attempts}`,
      `     IP: ${v(s.ip)} | User-Agent: ${v(s.user_agent)} | Brevo-ID: ${v(s.brevo_message_id)}`,
    );
  }

  lines.push(``, `── Widerrufe ──`);
  if (revocations.length === 0) lines.push(`(kein Eintrag)`);
  for (const r of revocations) {
    lines.push(
      `Widerrufen: ${r.revoked_at} | Weg: ${v(r.revocation_channel)} | IP: ${v(r.revocation_ip)}`,
    );
  }

  lines.push(``, `── Übermittlung der Lead-Mail ──`);
  if (notified.length === 0) lines.push(`(keine Übermittlung erfolgt)`);
  for (const n of notified) {
    lines.push(
      `An: ${n.admin_email} | am: ${n.notified_at} | Status: ${n.send_status}`,
    );
  }

  return lines;
}

const FOOTER = [
  ``,
  `── Hinweise ──`,
  `Beweiskette Einwilligung: Telefonnummer → SMS-Verifizierung (Zeitpunkt der`,
  `Code-Bestätigung) → verknüpfter Einwilligungs-Eintrag (Volltext, Version,`,
  `IP, Zeitstempel). Diese Kette bleibt nach Stammdaten-Löschung erhalten.`,
  `Empfänger der Daten: der unter /fachpartner/ benannte SHK-Betrieb`,
  `(nach Übermittlung eigenständig Verantwortlicher, Art. 4 Nr. 7 DSGVO).`,
  `Auftragsverarbeiter: Cloudflare (Hosting, EU-Region), Brevo (E-Mail/SMS, EU).`,
  `Keine automatisierte Entscheidungsfindung (Art. 22 DSGVO).`,
  `Beschwerderecht: LfDI Bremen, datenschutz.bremen.de.`,
];

export const GET: APIRoute = async ({ url, cookies }) => {
  const e = env as Env;
  const token = cookies.get(ADMIN_SESSION_COOKIE)?.value;
  if (!(await isValidAdminSession(e.SESSION, token))) {
    return new Response("Nicht angemeldet.", { status: 401 });
  }
  if (!e.DB) return new Response("Server misconfigured", { status: 500 });
  const db = e.DB as never;

  const head = [
    `DATENAUSZUG (Auskunft Art. 15 DSGVO / Einwilligungs-Nachweis § 7a UWG)`,
    `Erstellt: ${new Date().toISOString()} (UTC)`,
    `Verantwortlicher: Ferris El-Armouche, Spittaler Straße 1c, 28359 Bremen`,
  ];

  const textResponse = (lines: string[], status = 200) => {
    const res = new Response(lines.join("\n"), {
      status,
      headers: { "content-type": "text/plain; charset=utf-8" },
    });
    applyAdminResponseHeaders(res.headers);
    return res;
  };

  const phoneParam = url.searchParams.get("phone");
  if (phoneParam !== null) {
    const phone = normalizeDePhone(phoneParam);
    if (!phone) {
      return textResponse(
        [
          ...head,
          ``,
          `Ungültige Telefonnummer: "${phoneParam.slice(0, 40)}"`,
          `Erwartet wird eine deutsche Mobilfunknummer (z. B. 0151 12345678).`,
        ],
        400,
      );
    }
    const ids = await findLeadIdsByPhone(db, phone.e164);
    const out = [
      ...head,
      ``,
      `NACHWEIS-SUCHE für ${phone.e164} — ${ids.length} Treffer`,
      `═══════════════════════════════════════════`,
    ];
    if (ids.length === 0) {
      out.push(
        ``,
        `Zu dieser Nummer liegen keine Einträge vor — weder ein Lead noch`,
        `ein SMS-Verifizierungs-Nachweis. Es wurde also keine Einwilligung`,
        `über diese Website erfasst.`,
      );
    }
    for (const id of ids) {
      const lead = await getLeadById(db, id);
      if (!lead) continue;
      out.push(``, ...(await buildExtract(db, lead)));
    }
    out.push(...FOOTER);
    return textResponse(out);
  }

  const id = parseInt(url.searchParams.get("id") ?? "", 10);
  if (!Number.isInteger(id) || id <= 0) {
    return new Response("Ungültige Lead-ID.", { status: 400 });
  }
  const lead = await getLeadById(db, id);
  if (!lead) return new Response("Lead nicht gefunden.", { status: 404 });

  return textResponse([...head, ``, ...(await buildExtract(db, lead)), ...FOOTER]);
};
