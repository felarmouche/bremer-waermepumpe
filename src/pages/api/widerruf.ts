import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import {
  getLeadByReference,
  getLeadsByPhone,
  revokeLead,
  insertSmsVerification,
  getLatestSmsVerification,
  markSmsSuperseded,
} from "../../lib/leads";
import { sendRevocationNoticeToAdmins } from "../../lib/email";
import {
  normalizeDePhone,
  generateNumericCode,
  hashCode,
  maskPhoneDisplay,
  sendVerificationSms,
} from "../../lib/sms";
import {
  clientIp,
  jsonResponse,
  checkAndIncrementRate,
  type KvLike,
} from "../../lib/lead-flow";

export const prerender = false;

type Env = {
  DB?: D1Like;
  SESSION?: KvLike;
  BREVO_API_KEY?: string;
  BREVO_SENDER_EMAIL?: string;
  BREVO_SENDER_NAME?: string;
  BREVO_SMS_SENDER?: string;
  WEBOTP_HOST?: string;
  SMS_PEPPER?: string;
  SMS_CODE_TTL_SECONDS?: string;
  ADMIN_NOTIFICATION_EMAILS?: string;
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

async function notifyAdminsRevoked(
  e: Env,
  references: string[],
): Promise<void> {
  const adminEmails = parseAdminEmails(e.ADMIN_NOTIFICATION_EMAILS);
  if (!e.BREVO_API_KEY || adminEmails.length === 0) return;
  const sender = {
    name: e.BREVO_SENDER_NAME ?? "Bremer Wärmepumpe",
    email: e.BREVO_SENDER_EMAIL ?? "kontakt@bremer-waermepumpe.de",
  };
  for (const ref of references) {
    await sendRevocationNoticeToAdmins(e.BREVO_API_KEY, sender, adminEmails, ref);
  }
}

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

  const e = env as unknown as Env;
  const db = e.DB;
  const kv = e.SESSION;
  if (!db) {
    return new Response("Server misconfigured", { status: 500 });
  }

  const ip = clientIp(request);
  const action = typeof body.action === "string" ? body.action : "revoke";

  // ───────────────────────────────────────────────────────────
  // Mode 1: Telefon-Lookup → SMS-Code-Versand
  // ───────────────────────────────────────────────────────────
  if (action === "phone_request") {
    const telefonRaw = typeof body.telefon === "string" ? body.telefon.trim() : "";
    const phone = normalizeDePhone(telefonRaw);
    if (!phone) {
      return jsonResponse(
        { error: "Bitte geben Sie eine gültige deutsche Mobilfunknummer ein." },
        400,
      );
    }

    const rate = await checkAndIncrementRate(kv, `rate:wf:phone:${ip}`, 5, 3600);
    if (!rate.ok) {
      return jsonResponse(
        { error: "Zu viele Anfragen. Bitte später erneut versuchen." },
        429,
      );
    }

    const leads = await getLeadsByPhone(db as never, phone.e164);
    if (leads.length === 0) {
      // Don't leak which numbers are in the DB — always claim success.
      const fakeToken = crypto.randomUUID();
      if (kv) {
        await kv.put(`wf:phone:${fakeToken}`, "no-match", { expirationTtl: 600 });
      }
      return jsonResponse(
        {
          ok: true,
          token: fakeToken,
          phoneMasked: maskPhoneDisplay(phone.e164),
          message: "Wenn die Nummer bei uns hinterlegt ist, erhalten Sie gleich einen Code.",
        },
        200,
      );
    }

    // Use the most recent lead for code binding (latest id wins from getLeadsByPhone DESC)
    const lead = leads[0];
    const ttlSeconds = parseInt(e.SMS_CODE_TTL_SECONDS ?? "600", 10);
    const pepper = e.SMS_PEPPER ?? "dev-pepper-only";
    const webOtpHost = e.WEBOTP_HOST ?? "bremer-waermepumpe.de";
    const code = generateNumericCode(6);
    const codeHash = await hashCode(code, lead.id, phone.e164, pepper);
    const expiresAt = new Date(Date.now() + ttlSeconds * 1000).toISOString();

    const smsResult = await sendVerificationSms(
      e.BREVO_API_KEY ?? "",
      phone.e164,
      code,
      e.BREVO_SMS_SENDER ?? "BremerWP",
      webOtpHost,
    );
    if (!smsResult.ok) {
      return jsonResponse(
        { error: "SMS-Versand aktuell nicht möglich. Bitte telefonisch widerrufen: 0176 34690188." },
        502,
      );
    }

    // Mark previous code superseded
    const prev = await getLatestSmsVerification(db as never, lead.id);
    if (prev) {
      try { await markSmsSuperseded(db as never, prev.id); } catch { }
    }
    await insertSmsVerification(db as never, {
      lead_id: lead.id,
      phone_e164: phone.e164,
      code_hash: codeHash,
      expires_at: expiresAt,
      ip,
      user_agent: request.headers.get("user-agent") ?? null,
      brevo_message_id: smsResult.messageId,
    }).catch((err) => console.error("widerruf sms insert failed:", err));

    const token = crypto.randomUUID();
    if (kv) {
      // Token binds to all leads on this number (we revoke all on confirm)
      const ids = leads.map((l) => l.id).join(",");
      await kv.put(`wf:phone:${token}`, ids, { expirationTtl: ttlSeconds });
      await kv.put(`wf:phone:phone:${token}`, phone.e164, { expirationTtl: ttlSeconds });
    }

    return jsonResponse(
      {
        ok: true,
        token,
        phoneMasked: maskPhoneDisplay(phone.e164),
        expiresInSeconds: ttlSeconds,
      },
      200,
    );
  }

  // ───────────────────────────────────────────────────────────
  // Mode 2: Telefon-Code-Verifizierung → Widerruf wirksam
  // ───────────────────────────────────────────────────────────
  if (action === "phone_confirm") {
    const token = typeof body.token === "string" ? body.token.trim() : "";
    const code = typeof body.code === "string" ? body.code.trim() : "";
    if (!/^[a-f0-9-]{36}$/i.test(token) || !/^[0-9]{6}$/.test(code)) {
      return jsonResponse({ error: "Ungültige Eingabe." }, 400);
    }

    if (!kv) {
      return jsonResponse({ error: "Server misconfigured" }, 500);
    }
    const idsRaw = await kv.get(`wf:phone:${token}`);
    const phoneE164 = await kv.get(`wf:phone:phone:${token}`);
    if (!idsRaw) {
      return jsonResponse({ error: "Code abgelaufen. Bitte erneut starten." }, 410);
    }
    if (idsRaw === "no-match") {
      // Ghost confirm to keep the response shape consistent
      return jsonResponse({ ok: true, revoked: "", message: "Kein aktiver Datensatz unter dieser Nummer." }, 200);
    }
    if (!phoneE164) {
      return jsonResponse({ error: "Sitzung abgelaufen." }, 410);
    }

    const ids = idsRaw.split(",").map((s) => parseInt(s, 10)).filter(Number.isFinite);
    if (ids.length === 0) {
      return jsonResponse({ error: "Keine Anfrage gefunden." }, 404);
    }

    // Verify code against the latest sms_verification of the FIRST (most recent) lead.
    const primaryLeadId = ids[0];
    const smsRow = await getLatestSmsVerification(db as never, primaryLeadId);
    if (!smsRow || new Date(smsRow.expires_at).getTime() < Date.now()) {
      return jsonResponse({ error: "Code abgelaufen. Bitte erneut starten." }, 410);
    }
    const pepper = e.SMS_PEPPER ?? "dev-pepper-only";
    const inputHash = await hashCode(code, primaryLeadId, smsRow.phone_e164, pepper);
    if (inputHash !== smsRow.code_hash) {
      return jsonResponse({ error: "Falscher Code." }, 401);
    }

    const revokedRefs: string[] = [];
    for (const id of ids) {
      const lead = await (db as never as D1Like).prepare(
        `SELECT id, reference, revoked_at FROM leads WHERE id = ?`,
      ).bind(id).first<{ id: number; reference: string; revoked_at: string | null }>();
      if (!lead || lead.revoked_at) continue;
      await revokeLead(db as never, lead.id, "phone_verify", ip, undefined);
      revokedRefs.push(lead.reference);
    }

    await kv.delete(`wf:phone:${token}`).catch(() => { });
    await kv.delete(`wf:phone:phone:${token}`).catch(() => { });
    await notifyAdminsRevoked(e, revokedRefs);

    return jsonResponse(
      { ok: true, revoked: revokedRefs.join(", ") },
      200,
    );
  }

  // ───────────────────────────────────────────────────────────
  // Mode 3 (default): Referenznummer
  // ───────────────────────────────────────────────────────────
  const reference = typeof body.reference === "string" ? body.reference.trim().toUpperCase() : null;

  type LeadLite = { id: number; reference: string; status: string; revoked_at: string | null };
  let leads: LeadLite[] = [];

  if (reference) {
    const lead = await getLeadByReference(db as never, reference);
    if (lead) {
      leads = [{
        id: lead.id,
        reference: lead.reference,
        status: lead.status,
        revoked_at: lead.revoked_at,
      }];
    }
  }

  if (leads.length === 0) {
    return jsonResponse(
      { ok: true, message: "Kein aktiver Datensatz unter dieser Angabe gefunden." },
      200,
    );
  }

  const revokedRefs: string[] = [];
  for (const lead of leads) {
    if (lead.revoked_at) continue;
    await revokeLead(db as never, lead.id, "form_reference", ip, undefined);
    revokedRefs.push(lead.reference);
  }

  await notifyAdminsRevoked(e, revokedRefs);

  return jsonResponse(
    { ok: true, revoked: revokedRefs.join(", ") },
    200,
  );
};
