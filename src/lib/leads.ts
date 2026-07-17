// Minimal D1 shape we rely on. Avoids depending on @cloudflare/workers-types,
// which is not installed and pulls in a heavy `globalThis` declaration that
// conflicts with Astro's bundled worker types.
type D1Database = {
  prepare(query: string): {
    bind(...values: unknown[]): {
      run(): Promise<{ meta: { last_row_id: number } }>;
      first<T = unknown>(): Promise<T | null>;
      all<T = unknown>(): Promise<{ results: T[] }>;
    };
  };
};

export type LeadRow = {
  id: number;
  reference: string;
  created_at: string;

  salutation: string;
  vorname: string;
  nachname: string;
  email: string | null;
  telefon: string;
  telefon_raw: string;

  strasse: string;
  hausnummer: string;
  plz: string;
  ort: string;

  heating_current: string | null;
  heating_age: string | null;
  building_type: string | null;
  is_owner: number | null;
  heating_location: string | null;
  timeline: string | null;

  sms_verified_at: string | null;
  sms_phone_verified: string | null;
  admin_email_sent_at: string | null;
  status: string;
  revoked_at: string | null;

  crm_status: string;
  crm_notes: string | null;
  crm_updated_at: string | null;
};

/** Bearbeitungsstatus im Lead-Dashboard (unabhängig vom Funnel-`status`). */
export const CRM_STATUSES = [
  "neu",
  "kontaktiert",
  "termin",
  "uebergeben",
  "abgeschlossen",
  "verloren",
  "spam",
] as const;
export type CrmStatus = (typeof CRM_STATUSES)[number];

export type AdminNotifiedRow = {
  id: number;
  lead_id: number;
  admin_email: string;
  notified_at: string;
  email_message_id: string | null;
  send_status: string;
};

export type SmsVerificationRow = {
  id: number;
  lead_id: number;
  phone_e164: string;
  code_hash: string;
  sent_at: string;
  expires_at: string;
  verified_at: string | null;
  attempts: number;
  ip: string | null;
  user_agent: string | null;
  brevo_message_id: string | null;
  superseded_at: string | null;
};

export type LeadInsert = {
  reference: string;
  salutation: string;
  vorname: string;
  nachname: string;
  email: string | null;
  telefon: string;
  telefon_raw: string;
  strasse: string;
  hausnummer: string;
  plz: string;
  ort: string;
  heating_current: string | null;
  heating_age: string | null;
  building_type: string | null;
  is_owner: number | null;
  heating_location: string | null;
  timeline: string | null;
};

export async function insertLead(
  db: D1Database,
  data: LeadInsert,
): Promise<number> {
  const result = await db
    .prepare(
      `INSERT INTO leads (
        reference, salutation, vorname, nachname, email, telefon, telefon_raw,
        strasse, hausnummer, plz, ort,
        heating_current, heating_age, building_type, is_owner,
        heating_location, timeline
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      data.reference,
      data.salutation,
      data.vorname,
      data.nachname,
      data.email,
      data.telefon,
      data.telefon_raw,
      data.strasse,
      data.hausnummer,
      data.plz,
      data.ort,
      data.heating_current,
      data.heating_age,
      data.building_type,
      data.is_owner,
      data.heating_location,
      data.timeline,
    )
    .run();
  return result.meta.last_row_id as number;
}

export async function updateLeadReference(
  db: D1Database,
  id: number,
  reference: string,
): Promise<void> {
  await db
    .prepare(`UPDATE leads SET reference = ? WHERE id = ?`)
    .bind(reference, id)
    .run();
}

export async function updateLeadStatus(
  db: D1Database,
  id: number,
  status: string,
  adminEmailSentAt?: string,
): Promise<void> {
  if (adminEmailSentAt) {
    await db
      .prepare(
        `UPDATE leads SET status = ?, admin_email_sent_at = ? WHERE id = ?`,
      )
      .bind(status, adminEmailSentAt, id)
      .run();
  } else {
    await db
      .prepare(`UPDATE leads SET status = ? WHERE id = ?`)
      .bind(status, id)
      .run();
  }
}

export async function markLeadSmsVerified(
  db: D1Database,
  id: number,
  phoneE164: string,
): Promise<void> {
  const now = new Date().toISOString();
  await db
    .prepare(
      `UPDATE leads SET sms_verified_at = ?, sms_phone_verified = ?, status = 'sms_verified' WHERE id = ?`,
    )
    .bind(now, phoneE164, id)
    .run();
}

export async function getLeadById(
  db: D1Database,
  id: number,
): Promise<LeadRow | null> {
  return db
    .prepare(`SELECT * FROM leads WHERE id = ?`)
    .bind(id)
    .first<LeadRow>();
}

export async function getLeadByReference(
  db: D1Database,
  reference: string,
): Promise<LeadRow | null> {
  return db
    .prepare(`SELECT * FROM leads WHERE reference = ?`)
    .bind(reference)
    .first<LeadRow>();
}

export async function getLeadsByPhone(
  db: D1Database,
  phoneE164: string,
): Promise<LeadRow[]> {
  const result = await db
    .prepare(
      `SELECT * FROM leads WHERE telefon = ? AND revoked_at IS NULL ORDER BY id DESC`,
    )
    .bind(phoneE164)
    .all<LeadRow>();
  return result.results;
}

export type ConsentRow = {
  id: number;
  lead_id: number;
  consent_version: string;
  consent_text: string;
  consent_timestamp: string;
  consent_ip: string;
  consent_user_agent: string | null;
  partners_version: string;
  partners_snapshot: string;
  sms_verification_id: number | null;
};

export type RevocationRow = {
  id: number;
  lead_id: number;
  revoked_at: string;
  revocation_channel: string | null;
  revocation_ip: string | null;
  revocation_token: string | null;
  notes: string | null;
};

export async function getConsentsByLeadId(
  db: D1Database,
  lead_id: number,
): Promise<ConsentRow[]> {
  const result = await db
    .prepare(`SELECT * FROM lead_consents WHERE lead_id = ?`)
    .bind(lead_id)
    .all<ConsentRow>();
  return result.results;
}

export async function getSmsVerificationsByLeadId(
  db: D1Database,
  lead_id: number,
): Promise<SmsVerificationRow[]> {
  const result = await db
    .prepare(`SELECT * FROM sms_verifications WHERE lead_id = ? ORDER BY id`)
    .bind(lead_id)
    .all<SmsVerificationRow>();
  return result.results;
}

export async function getRevocationsByLeadId(
  db: D1Database,
  lead_id: number,
): Promise<RevocationRow[]> {
  const result = await db
    .prepare(`SELECT * FROM revocations WHERE lead_id = ? ORDER BY id`)
    .bind(lead_id)
    .all<RevocationRow>();
  return result.results;
}

export type SmsAggregate = {
  codes_sent: number;
  codes_verified: number;
  avg_attempts: number | null;
};

/** Aggregat über alle SMS-Codes — für die Dashboard-Statistik (keine PII). */
export async function getSmsAggregate(db: D1Database): Promise<SmsAggregate> {
  const row = await db
    .prepare(
      `SELECT COUNT(*) AS codes_sent,
              COALESCE(SUM(CASE WHEN verified_at IS NOT NULL THEN 1 ELSE 0 END), 0) AS codes_verified,
              AVG(attempts) AS avg_attempts
       FROM sms_verifications`,
    )
    .bind()
    .first<SmsAggregate>();
  return row ?? { codes_sent: 0, codes_verified: 0, avg_attempts: null };
}

/**
 * Nachweis-Suche: findet alle Lead-IDs zu einer Telefonnummer — auch nach
 * Stammdaten-Löschung, denn sms_verifications behält die Nummer als Teil
 * des Einwilligungs-Nachweises (§ 7a Abs. 2 UWG).
 */
export async function findLeadIdsByPhone(
  db: D1Database,
  phoneE164: string,
): Promise<number[]> {
  const result = await db
    .prepare(
      `SELECT DISTINCT lead_id AS id FROM sms_verifications WHERE phone_e164 = ?
       UNION
       SELECT id FROM leads WHERE telefon = ?
       ORDER BY id`,
    )
    .bind(phoneE164, phoneE164)
    .all<{ id: number }>();
  return result.results.map((r) => r.id);
}

/**
 * Löscht die Lead-Stammdaten DSGVO-konform (Datenschutzerklärung Ziffer 5):
 * personenbezogene Felder werden geleert, nur Referenz + Zeitstempel bleiben
 * als pseudonymisierte Audit-Daten. Einwilligungs- und SMS-Nachweis in
 * lead_consents/sms_verifications bleiben unberührt (5 Jahre, § 7a Abs. 2 UWG).
 */
export async function anonymizeLead(db: D1Database, id: number): Promise<void> {
  await db
    .prepare(
      `UPDATE leads SET
        salutation = '', vorname = '', nachname = '', email = NULL,
        telefon = '', telefon_raw = '', sms_phone_verified = NULL,
        strasse = '', hausnummer = '', plz = '', ort = '',
        heating_current = NULL, heating_age = NULL, building_type = NULL,
        is_owner = NULL, heating_location = NULL, timeline = NULL,
        crm_notes = NULL, status = 'deleted', crm_updated_at = ?
      WHERE id = ?`,
    )
    .bind(new Date().toISOString(), id)
    .run();
}

/**
 * Entfernt einen Lead restlos inklusive aller Nachweise. Nur für Einträge
 * ohne verifizierte Einwilligung (Spam, Tests, abgebrochene Verifizierung) —
 * bei verifizierten Leads gilt die 5-Jahres-Aufbewahrung des Nachweises,
 * dort anonymizeLead verwenden.
 */
export async function deleteLeadFull(db: D1Database, id: number): Promise<void> {
  await db.prepare(`DELETE FROM lead_admin_notified WHERE lead_id = ?`).bind(id).run();
  await db.prepare(`DELETE FROM lead_consents WHERE lead_id = ?`).bind(id).run();
  await db.prepare(`DELETE FROM revocations WHERE lead_id = ?`).bind(id).run();
  await db.prepare(`DELETE FROM sms_verifications WHERE lead_id = ?`).bind(id).run();
  await db.prepare(`DELETE FROM leads WHERE id = ?`).bind(id).run();
}

export async function getAllLeads(db: D1Database): Promise<LeadRow[]> {
  const result = await db
    .prepare(`SELECT * FROM leads ORDER BY id DESC`)
    .bind()
    .all<LeadRow>();
  return result.results;
}

export async function updateLeadCrm(
  db: D1Database,
  id: number,
  fields: { crm_status?: CrmStatus; crm_notes?: string },
): Promise<void> {
  const now = new Date().toISOString();
  if (fields.crm_status !== undefined && fields.crm_notes !== undefined) {
    await db
      .prepare(
        `UPDATE leads SET crm_status = ?, crm_notes = ?, crm_updated_at = ? WHERE id = ?`,
      )
      .bind(fields.crm_status, fields.crm_notes, now, id)
      .run();
  } else if (fields.crm_status !== undefined) {
    await db
      .prepare(`UPDATE leads SET crm_status = ?, crm_updated_at = ? WHERE id = ?`)
      .bind(fields.crm_status, now, id)
      .run();
  } else if (fields.crm_notes !== undefined) {
    await db
      .prepare(`UPDATE leads SET crm_notes = ?, crm_updated_at = ? WHERE id = ?`)
      .bind(fields.crm_notes, now, id)
      .run();
  }
}

export async function insertConsent(
  db: D1Database,
  data: {
    lead_id: number;
    consent_version: string;
    consent_text: string;
    consent_timestamp: string;
    consent_ip: string;
    consent_user_agent: string;
    partners_version: string;
    partners_snapshot: string;
  },
): Promise<number> {
  const result = await db
    .prepare(
      `INSERT INTO lead_consents (
        lead_id, consent_version, consent_text, consent_timestamp,
        consent_ip, consent_user_agent, partners_version, partners_snapshot
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      data.lead_id,
      data.consent_version,
      data.consent_text,
      data.consent_timestamp,
      data.consent_ip,
      data.consent_user_agent,
      data.partners_version,
      data.partners_snapshot,
    )
    .run();
  return result.meta.last_row_id as number;
}

export async function updateConsentSmsVerification(
  db: D1Database,
  lead_id: number,
  sms_verification_id: number,
): Promise<void> {
  await db
    .prepare(
      `UPDATE lead_consents SET sms_verification_id = ? WHERE lead_id = ?`,
    )
    .bind(sms_verification_id, lead_id)
    .run();
}

export async function insertAdminNotified(
  db: D1Database,
  lead_id: number,
  admin_email: string,
  email_message_id: string | null,
  send_status: string,
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO lead_admin_notified (lead_id, admin_email, email_message_id, send_status)
       VALUES (?, ?, ?, ?)`,
    )
    .bind(lead_id, admin_email, email_message_id, send_status)
    .run();
}

export async function getAdminNotified(
  db: D1Database,
  lead_id: number,
): Promise<AdminNotifiedRow[]> {
  const result = await db
    .prepare(`SELECT * FROM lead_admin_notified WHERE lead_id = ?`)
    .bind(lead_id)
    .all<AdminNotifiedRow>();
  return result.results;
}

export async function revokeLead(
  db: D1Database,
  lead_id: number,
  channel: string,
  ip: string,
  token?: string,
): Promise<void> {
  const now = new Date().toISOString();
  await db
    .prepare(`UPDATE leads SET status = 'revoked', revoked_at = ? WHERE id = ?`)
    .bind(now, lead_id)
    .run();
  await db
    .prepare(
      `INSERT INTO revocations (lead_id, revoked_at, revocation_channel, revocation_ip, revocation_token)
       VALUES (?, ?, ?, ?, ?)`,
    )
    .bind(lead_id, now, channel, ip, token ?? null)
    .run();
}

export async function insertSmsVerification(
  db: D1Database,
  data: {
    lead_id: number;
    phone_e164: string;
    code_hash: string;
    expires_at: string;
    ip: string | null;
    user_agent: string | null;
    brevo_message_id: string | null;
  },
): Promise<number> {
  const result = await db
    .prepare(
      `INSERT INTO sms_verifications (
        lead_id, phone_e164, code_hash, expires_at, ip, user_agent, brevo_message_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      data.lead_id,
      data.phone_e164,
      data.code_hash,
      data.expires_at,
      data.ip,
      data.user_agent,
      data.brevo_message_id,
    )
    .run();
  return result.meta.last_row_id as number;
}

export async function getLatestSmsVerification(
  db: D1Database,
  lead_id: number,
): Promise<SmsVerificationRow | null> {
  return db
    .prepare(
      `SELECT * FROM sms_verifications
       WHERE lead_id = ? AND superseded_at IS NULL
       ORDER BY id DESC LIMIT 1`,
    )
    .bind(lead_id)
    .first<SmsVerificationRow>();
}

export async function incrementSmsAttempts(
  db: D1Database,
  id: number,
): Promise<number> {
  await db
    .prepare(`UPDATE sms_verifications SET attempts = attempts + 1 WHERE id = ?`)
    .bind(id)
    .run();
  const row = await db
    .prepare(`SELECT attempts FROM sms_verifications WHERE id = ?`)
    .bind(id)
    .first<{ attempts: number }>();
  return row?.attempts ?? 0;
}

export async function markSmsVerified(
  db: D1Database,
  id: number,
): Promise<void> {
  await db
    .prepare(`UPDATE sms_verifications SET verified_at = ? WHERE id = ?`)
    .bind(new Date().toISOString(), id)
    .run();
}

export async function markSmsSuperseded(
  db: D1Database,
  id: number,
): Promise<void> {
  await db
    .prepare(`UPDATE sms_verifications SET superseded_at = ? WHERE id = ?`)
    .bind(new Date().toISOString(), id)
    .run();
}
