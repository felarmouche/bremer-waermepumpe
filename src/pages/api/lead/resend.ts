import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import {
  getLeadById,
  getLatestSmsVerification,
  markSmsSuperseded,
  insertSmsVerification,
} from "../../../lib/leads";
import {
  clientIp,
  jsonResponse,
  type KvLike,
} from "../../../lib/lead-flow";
import {
  generateNumericCode,
  hashCode,
  sendVerificationSms,
} from "../../../lib/sms";

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

export const POST: APIRoute = async ({ request }) => {
  if (!request.headers.get("content-type")?.includes("application/json")) {
    return new Response("Bad Request", { status: 400 });
  }

  let body: { pendingToken?: string };
  try {
    body = (await request.json()) as never;
  } catch {
    return new Response("Bad Request", { status: 400 });
  }

  const pendingToken = typeof body.pendingToken === "string" ? body.pendingToken.trim() : "";
  if (!/^[a-f0-9-]{36}$/i.test(pendingToken)) {
    return jsonResponse({ error: "Ungültiges Token." }, 400);
  }

  const e = env as Env;
  const db = e.DB;
  const kv = e.SESSION;
  if (!db) return new Response("Server misconfigured", { status: 500 });

  const ip = clientIp(request);
  const leadIdStr = kv ? await kv.get(`pending:${pendingToken}`) : null;
  if (!leadIdStr) {
    return jsonResponse({ error: "Sitzung abgelaufen. Bitte erneut starten." }, 410);
  }
  const leadId = parseInt(leadIdStr, 10);
  if (!Number.isFinite(leadId)) {
    return jsonResponse({ error: "Ungültiges Token." }, 400);
  }

  // Resend min-distance 60s
  if (kv) {
    const resendKey = `sms:resend:${leadId}`;
    const exists = await kv.get(resendKey);
    if (exists) {
      return jsonResponse(
        { error: "Bitte 60 Sekunden warten, bevor Sie einen neuen Code anfordern." },
        429,
      );
    }
    await kv.put(resendKey, "1", { expirationTtl: 60 });
  }

  // Resend count per token: max 2
  if (kv) {
    const cntKey = `sms:resendcount:${pendingToken}`;
    const raw = await kv.get(cntKey);
    const count = raw ? parseInt(raw, 10) : 0;
    if (count >= 2) {
      return jsonResponse(
        { error: "Maximalanzahl an Wiederholungen erreicht. Bitte starten Sie erneut." },
        429,
      );
    }
    await kv.put(cntKey, String(count + 1), { expirationTtl: 1800 });
  }

  const lead = await getLeadById(db as never, leadId);
  if (!lead || lead.status !== "sms_pending") {
    return jsonResponse({ error: "Anfrage befindet sich im falschen Status." }, 409);
  }

  // Per-phone 24h rate
  const phoneRateKey = `sms:rl:phone:${lead.telefon}`;
  if (kv) {
    const raw = await kv.get(phoneRateKey);
    const count = raw ? parseInt(raw, 10) : 0;
    if (count >= 3) {
      return jsonResponse(
        {
          error:
            "Sie haben bereits 3 Codes an diese Nummer erhalten. Bitte morgen erneut versuchen oder anrufen: 0176 34690188.",
        },
        429,
      );
    }
    await kv.put(phoneRateKey, String(count + 1), { expirationTtl: 86400 });
  }

  // Mark old code superseded
  const prev = await getLatestSmsVerification(db as never, leadId);
  if (prev) {
    try {
      await markSmsSuperseded(db as never, prev.id);
    } catch {}
  }

  // Send new code
  const ttlSeconds = parseInt(e.SMS_CODE_TTL_SECONDS ?? "600", 10);
  const pepper = e.SMS_PEPPER ?? "dev-pepper-only";
  const code = generateNumericCode(6);
  const codeHash = await hashCode(code, leadId, lead.telefon, pepper);
  const expiresAt = new Date(Date.now() + ttlSeconds * 1000).toISOString();

  const webOtpHost = e.WEBOTP_HOST ?? "bremer-waermepumpe.de";
  const smsResult = await sendVerificationSms(
    e.BREVO_API_KEY ?? "",
    lead.telefon,
    code,
    e.BREVO_SMS_SENDER ?? "BremerWP",
    webOtpHost,
  );

  if (!smsResult.ok) {
    return jsonResponse(
      { error: "SMS-Versand aktuell nicht möglich. Bitte später erneut versuchen." },
      502,
    );
  }

  try {
    await insertSmsVerification(db as never, {
      lead_id: leadId,
      phone_e164: lead.telefon,
      code_hash: codeHash,
      expires_at: expiresAt,
      ip,
      user_agent: request.headers.get("user-agent") ?? null,
      brevo_message_id: smsResult.messageId,
    });
  } catch (err) {
    console.error("SMS verification insert failed:", err);
  }

  return jsonResponse(
    {
      ok: true,
      expiresInSeconds: ttlSeconds,
      resendAvailableInSeconds: 60,
    },
    200,
  );
};
