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
};

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
