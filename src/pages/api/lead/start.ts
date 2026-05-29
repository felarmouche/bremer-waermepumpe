import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { currentConsentVersion } from "../../../lib/consent";
import {
  insertLead,
  updateLeadReference,
  updateLeadStatus,
  insertConsent,
  insertSmsVerification,
} from "../../../lib/leads";
import {
  pick,
  sanitizeText,
  clientIp,
  checkAndIncrementRate,
  jsonResponse,
  type KvLike,
} from "../../../lib/lead-flow";
import {
  normalizeDePhone,
  generateNumericCode,
  hashCode,
  maskPhoneDisplay,
  sendVerificationSms,
} from "../../../lib/sms";
import { currentPartnerVersion } from "../../../data/partners";

export const prerender = false;

type Env = {
  DB?: D1Like;
  SESSION?: KvLike;
  BREVO_API_KEY?: string;
  BREVO_SMS_SENDER?: string;
  WEBOTP_HOST?: string;
  SMS_PEPPER?: string;
  SMS_CODE_TTL_SECONDS?: string;
};

type D1Like = {
  prepare(query: string): {
    bind(...values: unknown[]): {
      run(): Promise<{ meta: { last_row_id: number } }>;
      first<T = unknown>(): Promise<T | null>;
      all<T = unknown>(): Promise<{ results: T[] }>;
    };
  };
};

const FUNNEL_VALUES = {
  heatingCurrent: ["Gas", "Öl", "Strom", "Anderes"],
  heatingAge: [
    "Unter 10 Jahre",
    "10-15 Jahre",
    "15-20 Jahre",
    "20-25 Jahre",
    "Älter als 25 Jahre",
    "Weiß nicht",
  ],
  buildingType: [
    "Einfamilienhaus",
    "Mehrfamilienhaus",
    "Reihenhaus",
    "Anderes",
  ],
  heatingLocation: ["Keller", "Erdgeschoss", "Obergeschoss", "Dachgeschoss"],
  timeline: [
    "Sofort",
    "In 1-3 Monaten",
    "In 3-6 Monaten",
    "In 6-12 Monaten",
    "Heizungswechsel nicht geplant",
  ],
  salutation: ["Herr", "Frau"],
} as const;

export const POST: APIRoute = async ({ request }) => {
  if (!request.headers.get("content-type")?.includes("application/json")) {
    return new Response("Bad Request", { status: 400 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return new Response("Bad Request", { status: 400 });
  }

  // Honeypot
  if (body.website) {
    return new Response(null, { status: 204 });
  }

  // PII
  const salutation = pick(body.salutation, FUNNEL_VALUES.salutation);
  const vorname = sanitizeText(body.vorname, 100);
  const nachname = sanitizeText(body.nachname, 100);
  const telefonRaw = typeof body.telefon === "string" ? body.telefon.trim() : "";

  // Address
  const strasse = sanitizeText(body.strasse, 200);
  const hausnummer = sanitizeText(body.hausnummer, 20);
  const plzRaw = typeof body.plz === "string" ? body.plz.trim() : "";
  const ort = sanitizeText(body.ort, 100);

  if (!salutation) {
    return jsonResponse({ error: "Anrede erforderlich." }, 400);
  }
  if (!vorname || !nachname) {
    return jsonResponse({ error: "Vor- und Nachname erforderlich." }, 400);
  }
  if (!strasse || !hausnummer || !ort) {
    return jsonResponse({ error: "Vollständige Anschrift erforderlich." }, 400);
  }

  const phone = normalizeDePhone(telefonRaw);
  if (!phone) {
    return jsonResponse(
      {
        error:
          "Bitte geben Sie eine gültige deutsche Mobilfunknummer ein (z. B. 0151 12345678).",
      },
      400,
    );
  }

  // Consent
  if (body.consent_marketing !== true || body.consent_terms !== true) {
    return jsonResponse({ error: "Beide Einwilligungen sind erforderlich." }, 400);
  }
  if (body.consent_version !== currentConsentVersion.version) {
    return jsonResponse(
      { error: "Veraltete Einwilligungsversion. Bitte Seite neu laden." },
      400,
    );
  }

  const e = env as Env;
  const db = e.DB;
  const kv = e.SESSION;
  if (!db) {
    return new Response("Server misconfigured", { status: 500 });
  }

  const ip = clientIp(request);

  // Rate limits
  const startRate = await checkAndIncrementRate(kv, `rate:lead:start:${ip}`, 3, 3600);
  if (!startRate.ok) {
    return jsonResponse(
      { error: "Zu viele Anfragen. Bitte später erneut versuchen.", retryAfter: startRate.retryAfter },
      429,
    );
  }

  const phoneRateRaw = kv ? await kv.get(`sms:rl:phone:${phone.e164}`) : null;
  const phoneRateCount = phoneRateRaw ? parseInt(phoneRateRaw, 10) : 0;
  if (phoneRateCount >= 3) {
    return jsonResponse(
      {
        error:
          "Sie haben bereits 3 Codes an diese Nummer erhalten. Bitte versuchen Sie es morgen erneut oder kontaktieren Sie uns direkt unter 0176 34690188.",
      },
      429,
    );
  }

  const ipSmsRate = await checkAndIncrementRate(kv, `sms:rl:ip:${ip}`, 5, 3600);
  if (!ipSmsRate.ok) {
    return jsonResponse(
      { error: "Zu viele SMS-Anfragen. Bitte später erneut versuchen.", retryAfter: ipSmsRate.retryAfter },
      429,
    );
  }

  // Funnel fields
  const funnel = {
    heating_current: pick(body.heatingCurrent, FUNNEL_VALUES.heatingCurrent),
    heating_age: pick(body.heatingAge, FUNNEL_VALUES.heatingAge),
    building_type: pick(body.buildingType, FUNNEL_VALUES.buildingType),
    is_owner: body.isOwner === true ? 1 : body.isOwner === false ? 0 : null,
    heating_location: pick(body.heatingLocation, FUNNEL_VALUES.heatingLocation),
    timeline: pick(body.timeline, FUNNEL_VALUES.timeline),
  };

  // Disqualified leads (non-owners) must never reach the DB / SMS pipeline.
  if (funnel.is_owner === 0) {
    return jsonResponse(
      { error: "Eine Beratung ist nur für Eigentümer möglich." },
      400,
    );
  }

  const consentTimestamp = new Date().toISOString();
  const tempRef = `TEMP-${crypto.randomUUID()}`;

  let leadId: number;
  try {
    leadId = await insertLead(db as never, {
      reference: tempRef,
      salutation,
      vorname,
      nachname,
      email: null,
      telefon: phone.e164,
      telefon_raw: phone.raw,
      strasse,
      hausnummer,
      plz: plzRaw,
      ort,
      heating_current: funnel.heating_current,
      heating_age: funnel.heating_age,
      building_type: funnel.building_type,
      is_owner: funnel.is_owner,
      heating_location: funnel.heating_location,
      timeline: funnel.timeline,
    });
  } catch (err) {
    console.error("Lead insert failed:", err);
    return new Response("Insert failed", { status: 500 });
  }

  const year = new Date().getFullYear();
  const reference = `BWP-${year}-${String(leadId).padStart(5, "0")}`;
  try {
    await updateLeadReference(db as never, leadId, reference);
  } catch (err) {
    console.error("Reference update failed:", err);
  }

  // Consent proof
  const consentText = `[1] ${currentConsentVersion.marketingLabel}\n[2] ${currentConsentVersion.termsLabel}\n[3-info] ${currentConsentVersion.smsNoticeLabel ?? ""}`;
  const partnerSnapshot = JSON.stringify(currentPartnerVersion.partners);

  try {
    await insertConsent(db as never, {
      lead_id: leadId,
      consent_version: currentConsentVersion.version,
      consent_text: consentText,
      consent_timestamp: consentTimestamp,
      consent_ip: ip,
      consent_user_agent: request.headers.get("user-agent") ?? "",
      partners_version: currentPartnerVersion.version,
      partners_snapshot: partnerSnapshot,
    });
  } catch (err) {
    console.error("Consent insert failed:", err);
  }

  // Generate + send SMS code
  const ttlSeconds = parseInt(e.SMS_CODE_TTL_SECONDS ?? "600", 10);
  const pepper = e.SMS_PEPPER ?? "dev-pepper-only";
  const webOtpHost = e.WEBOTP_HOST ?? "bremer-waermepumpe.de";
  const code = generateNumericCode(6);
  const codeHash = await hashCode(code, leadId, phone.e164, pepper);
  const expiresAt = new Date(Date.now() + ttlSeconds * 1000).toISOString();

  const smsResult = await sendVerificationSms(
    e.BREVO_API_KEY ?? "",
    phone.e164,
    code,
    e.BREVO_SMS_SENDER ?? "BremerWP",
    webOtpHost,
  );

  if (!smsResult.ok) {
    console.error("SMS send failed:", smsResult.error);
    try {
      await updateLeadStatus(db as never, leadId, "failed");
    } catch { }
    return jsonResponse(
      {
        error:
          "SMS-Versand aktuell nicht möglich. Bitte später erneut versuchen oder telefonisch melden: 0176 34690188.",
      },
      502,
    );
  }

  let smsVerifId = 0;
  try {
    smsVerifId = await insertSmsVerification(db as never, {
      lead_id: leadId,
      phone_e164: phone.e164,
      code_hash: codeHash,
      expires_at: expiresAt,
      ip,
      user_agent: request.headers.get("user-agent") ?? null,
      brevo_message_id: smsResult.messageId,
    });
  } catch (err) {
    console.error("SMS verification insert failed:", err);
  }

  // Increment phone-rate counter (24h)
  if (kv) {
    await kv.put(`sms:rl:phone:${phone.e164}`, String(phoneRateCount + 1), {
      expirationTtl: 86400,
    });
  }

  // Store pending token
  const pendingToken = crypto.randomUUID();
  if (kv) {
    await kv.put(`pending:${pendingToken}`, String(leadId), {
      expirationTtl: 1800, // 30 min
    });
  }

  return jsonResponse(
    {
      ok: true,
      pendingToken,
      phoneMasked: maskPhoneDisplay(phone.e164),
      expiresInSeconds: ttlSeconds,
      resendAvailableInSeconds: 60,
      smsVerificationId: smsVerifId || null,
    },
    200,
  );
};
