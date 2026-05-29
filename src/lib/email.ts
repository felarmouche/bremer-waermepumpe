const BREVO_API = "https://api.brevo.com/v3/smtp/email";

export type LeadEmailPayload = {
  reference: string;
  salutation: string;
  vorname: string;
  nachname: string;
  telefon: string;
  plz: string;
  ort: string;
  strasse: string;
  hausnummer: string;
  heatingCurrent: string;
  heatingAge: string;
  buildingType: string;
  isOwner: boolean;
  heatingLocation: string;
  timeline: string;
  consentTimestamp: string;
  consentVersion: string;
  consentMarketingText: string;
  consentTermsText: string;
  consentIp: string;
  smsPhoneVerified: string;
  smsSentAt: string;
  smsVerifiedAt: string;
};

function labelFunnel(payload: LeadEmailPayload): string {
  const rows: Array<[string, string]> = [
    ["Aktuelle Heizung", payload.heatingCurrent],
    ["Heizungsalter", payload.heatingAge],
    ["Gebäudetyp", payload.buildingType],
    ["Eigentumsverhältnis", payload.isOwner ? "Eigentümer" : "Mieter / kein Eigentum"],
    ["Aufstellort Heizung", payload.heatingLocation],
    ["Zeitlicher Horizont", payload.timeline],
  ];
  return rows.map(([k, v]) => `  ${k.padEnd(22)}${v || "—"}`).join("\n");
}

async function brevoPost(
  apiKey: string,
  payload: object,
): Promise<{ messageId: string }> {
  const res = await fetch(BREVO_API, {
    method: "POST",
    headers: { "api-key": apiKey, "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Brevo ${res.status}: ${text}`);
  }
  const json = (await res.json()) as { messageId?: string };
  return { messageId: json.messageId ?? "" };
}

/**
 * Sends the lead notification e-mail to internal admin recipients.
 *
 * `adminEmails` is the list of internal mailboxes that receive the lead
 * briefing. Each address gets a separate To: send (not BCC) so that delivery
 * failures of one address don't silently drop the others.
 *
 * The user has NOT received an e-mail copy (the funnel doesn't collect
 * e-mail). Lead confirmation is delivered via SMS — see sendConfirmationSms.
 */
export async function sendAdminNotification(
  apiKey: string,
  sender: { name: string; email: string },
  adminEmails: string[],
  lead: LeadEmailPayload,
): Promise<Array<{ email: string; ok: true; messageId: string } | { email: string; ok: false; error: string }>> {
  const briefing = labelFunnel(lead);
  const urgencyTag = lead.timeline === "defekt_jetzt" ? " [DRINGEND]" : "";
  const consentLocal = new Date(lead.consentTimestamp).toLocaleString("de-DE", {
    timeZone: "Europe/Berlin",
  });

  const body = `Neue Anfrage für kostenlose Wärmepumpen-Erstberatung: ${lead.reference}${urgencyTag}
Eingegangen: ${consentLocal} (Europe/Berlin)

Kontakt:
  ${lead.salutation} ${lead.vorname} ${lead.nachname}
  Telefon: ${lead.telefon} (SMS-verifiziert)
  Anschrift: ${lead.strasse} ${lead.hausnummer}, ${lead.plz} ${lead.ort}

Angaben aus dem Check (keine automatische Bewertung):
${briefing}

Identitätsnachweis (SMS-Code-Ident, BGH I ZR 164/09 „Telefonaktion II“):
  SMS-Bestätigung erfolgreich an    ${lead.smsPhoneVerified}
  Code-Versand                      ${lead.smsSentAt} UTC
  Code-Bestätigung                  ${lead.smsVerifiedAt} UTC

Einwilligung (Art. 6 Abs. 1 lit. a DSGVO, Art. 7 Abs. 1 DSGVO):
  Erteilt am:        ${lead.consentTimestamp} UTC
  Version:           ${lead.consentVersion}
  IP zum Zeitpunkt:  ${lead.consentIp}

  Einwilligungs-Text (Datenweitergabe + Kontaktaufnahme):
  ${lead.consentMarketingText.replace(/\n/g, "\n  ")}

  Bestätigung Nutzungsbedingungen / Datenschutz:
  ${lead.consentTermsText.replace(/\n/g, "\n  ")}

Auftrag an den SHK-Betrieb:
  Kostenlose und unverbindliche Einschätzung zu Eignung, Machbarkeit,
  Kosten und Förderung; ggf. unverbindliches Angebot. Kein Vertrag
  entsteht durch die Anfrage.

Widerruf: Der Nutzer kann seine Einwilligung jederzeit unter
  /widerruf/ widerrufen. Bei Widerruf wird der Lead in D1 als revoked
  markiert; bitte stoppen Sie dann jegliche Kontaktaufnahme.

—
Bremer Wärmepumpe – Ferris El-Armouche
bremerwaermepumpen@web.de | 0176 34690188`;

  const subject = `Neue Anfrage ${lead.reference}${urgencyTag} – PLZ ${lead.plz} – Bremer Wärmepumpe`;

  const results = await Promise.all(
    adminEmails.map(async (email) => {
      try {
        const r = await brevoPost(apiKey, {
          sender,
          to: [{ email }],
          subject,
          textContent: body,
        });
        return { email, ok: true as const, messageId: r.messageId };
      } catch (e) {
        return { email, ok: false as const, error: (e as Error).message };
      }
    }),
  );
  return results;
}

/**
 * Notifies internal admin recipients that a lead has revoked their consent.
 * Sent in place of the earlier partner-revocation notice while the funnel
 * routes to internal mailboxes rather than an external partner.
 */
export async function sendRevocationNoticeToAdmins(
  apiKey: string,
  sender: { name: string; email: string },
  adminEmails: string[],
  reference: string,
): Promise<void> {
  const body = `Widerruf der Einwilligung: ${reference}

Der Anfragende der Anfrage ${reference} hat seine Einwilligung zur
Datenverarbeitung und Kontaktaufnahme widerrufen (Art. 7 Abs. 3 DSGVO).

Bitte ab sofort keine weitere Kontaktaufnahme zu diesem Lead und keine
Weitergabe an Dritte. Die Daten sind in D1 als revoked markiert.

—
Bremer Wärmepumpe`;

  await Promise.all(
    adminEmails.map((email) =>
      brevoPost(apiKey, {
        sender,
        to: [{ email }],
        subject: `Widerruf der Einwilligung – ${reference}`,
        textContent: body,
      }).catch((err) => {
        console.error(`Revocation notice to ${email} failed:`, err);
      }),
    ),
  );
}
