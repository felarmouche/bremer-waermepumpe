import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import {
  getLeadById,
  getLatestSmsVerification,
  incrementSmsAttempts,
  markSmsVerified,
  markLeadSmsVerified,
  updateLeadStatus,
  updateConsentSmsVerification,
  insertAdminNotified,
} from "../../../lib/leads";
import {
  clientIp,
  jsonResponse,
  type KvLike,
} from "../../../lib/lead-flow";
import { hashCode, sendConfirmationSms } from "../../../lib/sms";
import { sendAdminNotification, type LeadEmailPayload } from "../../../lib/email";
import { currentConsentVersion } from "../../../lib/consent";

export const prerender = false;

type Env = {
  DB?: D1Like;
  SESSION?: KvLike;
  BREVO_API_KEY?: string;
  BREVO_SENDER_EMAIL?: string;
  BREVO_SENDER_NAME?: string;
  BREVO_SMS_SENDER?: string;
  BETREIBER_DATENSCHUTZ_EMAIL?: string;
  BETREIBER_TEL?: string;
  SITE_URL?: string;
  ADMIN_NOTIFICATION_EMAILS?: string;
  SMS_PEPPER?: string;
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

function parseAdminEmails(raw: string | undefined): string[] {
  if (!raw) return [];
  return raw
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter((s) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s));
}

export const POST: APIRoute = async ({ request }) => {
  if (!request.headers.get("content-type")?.includes("application/json")) {
    return new Response("Bad Request", { status: 400 });
  }

  let body: { pendingToken?: string; code?: string };
  try {
    body = (await request.json()) as never;
  } catch {
    return new Response("Bad Request", { status: 400 });
  }

  const pendingToken = typeof body.pendingToken === "string" ? body.pendingToken.trim() : "";
  const code = typeof body.code === "string" ? body.code.trim() : "";

  if (!/^[a-f0-9-]{36}$/i.test(pendingToken)) {
    return jsonResponse({ error: "Ungültiges Token." }, 400);
  }
  if (!/^[0-9]{6}$/.test(code)) {
    return jsonResponse({ error: "Bitte den 6-stelligen Code eingeben." }, 400);
  }

  const e = env as Env;
  const db = e.DB;
  const kv = e.SESSION;
  if (!db) return new Response("Server misconfigured", { status: 500 });

  const leadIdStr = kv ? await kv.get(`pending:${pendingToken}`) : null;
  if (!leadIdStr) {
    return jsonResponse({ error: "Code abgelaufen. Bitte erneut anfordern." }, 410);
  }
  const leadId = parseInt(leadIdStr, 10);
  if (!Number.isFinite(leadId)) {
    return jsonResponse({ error: "Ungültiges Token." }, 400);
  }

  // Brute-force rate per token
  if (kv) {
    const verifyRateKey = `sms:verify:${leadId}`;
    const raw = await kv.get(verifyRateKey);
    const count = raw ? parseInt(raw, 10) : 0;
    if (count >= 6) {
      return jsonResponse({ error: "Zu viele Versuche. Bitte später erneut." }, 429);
    }
    await kv.put(verifyRateKey, String(count + 1), { expirationTtl: 600 });
  }

  const lead = await getLeadById(db as never, leadId);
  if (!lead) {
    return jsonResponse({ error: "Anfrage nicht gefunden." }, 404);
  }
  if (lead.status !== "sms_pending") {
    return jsonResponse({ error: "Anfrage befindet sich im falschen Status." }, 409);
  }

  const smsRow = await getLatestSmsVerification(db as never, leadId);
  if (!smsRow) {
    return jsonResponse({ error: "Kein aktiver Code gefunden." }, 410);
  }
  if (new Date(smsRow.expires_at).getTime() < Date.now()) {
    return jsonResponse({ error: "Code abgelaufen. Bitte erneut anfordern." }, 410);
  }
  if (smsRow.attempts >= 3) {
    try {
      await updateLeadStatus(db as never, leadId, "failed");
    } catch { }
    return jsonResponse(
      { error: "Zu viele Fehlversuche. Bitte starten Sie die Anfrage erneut." },
      429,
    );
  }

  const pepper = e.SMS_PEPPER ?? "dev-pepper-only";
  const inputHash = await hashCode(code, leadId, smsRow.phone_e164, pepper);
  if (inputHash !== smsRow.code_hash) {
    const attempts = await incrementSmsAttempts(db as never, smsRow.id);
    const left = Math.max(0, 3 - attempts);
    if (left === 0) {
      try {
        await updateLeadStatus(db as never, leadId, "failed");
      } catch { }
      return jsonResponse(
        { error: "Falscher Code. Maximalanzahl erreicht — bitte erneut starten." },
        401,
      );
    }
    return jsonResponse(
      { error: `Falscher Code. Noch ${left} Versuch${left === 1 ? "" : "e"}.`, attemptsLeft: left },
      401,
    );
  }

  // Success path: mark verified
  try {
    await markSmsVerified(db as never, smsRow.id);
    await markLeadSmsVerified(db as never, leadId, smsRow.phone_e164);
    await updateConsentSmsVerification(db as never, leadId, smsRow.id);
  } catch (err) {
    console.error("SMS verify update failed:", err);
  }

  // Admin notification (e-mail) + user confirmation (SMS)
  const brevoKey = e.BREVO_API_KEY ?? "";
  const senderEmail = e.BREVO_SENDER_EMAIL ?? "kontakt@bremer-waermepumpe.de";
  const senderName = e.BREVO_SENDER_NAME ?? "Bremer Wärmepumpe";
  const smsSender = e.BREVO_SMS_SENDER ?? "BremerWP";
  const betreiberTel = e.BETREIBER_TEL ?? "0176 34690188";
  const siteUrl = (e.SITE_URL ?? "https://bremer-waermepumpe.de").replace(/\/$/, "");
  const widerrufSite = `${siteUrl.replace(/^https?:\/\//, "")}/widerruf`;
  const adminEmails = parseAdminEmails(e.ADMIN_NOTIFICATION_EMAILS);

  const sender = { name: senderName, email: senderEmail };
  const smsVerifiedAtIso = new Date().toISOString();

  const leadPayload: LeadEmailPayload = {
    reference: lead.reference,
    salutation: lead.salutation,
    vorname: lead.vorname,
    nachname: lead.nachname,
    telefon: lead.telefon,
    plz: lead.plz,
    ort: lead.ort,
    strasse: lead.strasse,
    hausnummer: lead.hausnummer,
    heatingCurrent: lead.heating_current ?? "",
    heatingAge: lead.heating_age ?? "",
    buildingType: lead.building_type ?? "",
    isOwner: lead.is_owner === 1,
    heatingLocation: lead.heating_location ?? "",
    timeline: lead.timeline ?? "",
    consentTimestamp: lead.created_at,
    consentVersion: currentConsentVersion.version,
    consentMarketingText: currentConsentVersion.marketingLabel,
    consentTermsText: currentConsentVersion.termsLabel,
    consentIp: smsRow.ip ?? "",
    smsPhoneVerified: smsRow.phone_e164,
    smsSentAt: smsRow.sent_at,
    smsVerifiedAt: smsVerifiedAtIso,
    dashboardUrl: `${siteUrl}/dashboard?lead=${encodeURIComponent(lead.reference)}`,
  };

  let anyEmailOk = false;
  if (brevoKey && adminEmails.length > 0) {
    try {
      const results = await sendAdminNotification(
        brevoKey,
        sender,
        adminEmails,
        leadPayload,
      );
      for (const r of results) {
        if (r.ok) {
          anyEmailOk = true;
          await insertAdminNotified(
            db as never,
            leadId,
            r.email,
            r.messageId,
            "sent",
          ).catch(() => { });
        } else {
          console.error(`Admin mail to ${r.email} failed:`, r.error);
          await insertAdminNotified(
            db as never,
            leadId,
            r.email,
            null,
            `failed:${r.error.slice(0, 200)}`,
          ).catch(() => { });
        }
      }
    } catch (err) {
      console.error("Admin notification send failed:", err);
    }
  } else if (!brevoKey) {
    console.warn("BREVO_API_KEY not set — admin notification skipped.");
  } else {
    console.warn("ADMIN_NOTIFICATION_EMAILS empty — admin notification skipped.");
  }

  // Confirmation SMS to the user
  const confirmResult = await sendConfirmationSms(
    brevoKey,
    lead.telefon,
    smsSender,
    lead.reference,
    widerrufSite,
    betreiberTel,
  );
  if (!confirmResult.ok) {
    console.warn("Confirmation SMS failed:", confirmResult.error);
  }

  try {
    await updateLeadStatus(
      db as never,
      leadId,
      anyEmailOk ? "admin_notified" : "failed",
      anyEmailOk ? new Date().toISOString() : undefined,
    );
  } catch { }

  // Delete pending token
  if (kv) {
    try {
      await kv.delete(`pending:${pendingToken}`);
    } catch { }
  }

  return jsonResponse(
    {
      ok: true,
      reference: lead.reference,
      adminNotified: anyEmailOk,
      confirmationSms: confirmResult.ok,
    },
    200,
  );
};
