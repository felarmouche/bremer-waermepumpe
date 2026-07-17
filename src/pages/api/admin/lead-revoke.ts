import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import {
  ADMIN_SESSION_COOKIE,
  applyAdminResponseHeaders,
  isSameOrigin,
  isValidAdminSession,
} from "../../../lib/admin-auth";
import { clientIp, jsonResponse, type KvLike } from "../../../lib/lead-flow";
import { getLeadById, revokeLead } from "../../../lib/leads";
import { sendRevocationNoticeToAdmins } from "../../../lib/email";

export const prerender = false;

type Env = {
  DB?: unknown;
  SESSION?: KvLike;
  BREVO_API_KEY?: string;
  BREVO_SENDER_EMAIL?: string;
  BREVO_SENDER_NAME?: string;
  ADMIN_NOTIFICATION_EMAILS?: string;
};

// Erfasst einen Widerruf, der außerhalb des /widerruf/-Formulars eingegangen
// ist (formlose E-Mail, Telefon, Post — Art. 7 Abs. 3 DSGVO ist formfrei).
// Sperrt den Lead sofort und informiert die Empfänger der Lead-Mail
// nachrichtlich (Zusage aus Datenschutzerklärung Ziffer 11).
export const POST: APIRoute = async ({ request, cookies }) => {
  if (!request.headers.get("content-type")?.includes("application/json")) {
    return new Response("Bad Request", { status: 400 });
  }
  if (!isSameOrigin(request)) {
    return new Response("Forbidden", { status: 403 });
  }

  const e = env as Env;
  const token = cookies.get(ADMIN_SESSION_COOKIE)?.value;
  if (!(await isValidAdminSession(e.SESSION, token))) {
    return jsonResponse({ error: "Nicht angemeldet." }, 401);
  }
  if (!e.DB) return new Response("Server misconfigured", { status: 500 });
  const db = e.DB as never;

  let body: { id?: unknown; channel?: unknown };
  try {
    body = (await request.json()) as never;
  } catch {
    return new Response("Bad Request", { status: 400 });
  }

  const id =
    typeof body.id === "number" && Number.isInteger(body.id) && body.id > 0
      ? body.id
      : null;
  if (!id) return jsonResponse({ error: "Ungültige Lead-ID." }, 400);

  const ALLOWED_CHANNELS = ["email", "telefon", "post", "sonstig"] as const;
  const channel =
    typeof body.channel === "string" &&
    (ALLOWED_CHANNELS as readonly string[]).includes(body.channel)
      ? body.channel
      : "sonstig";

  const lead = await getLeadById(db, id);
  if (!lead) return jsonResponse({ error: "Lead nicht gefunden." }, 404);
  if (lead.revoked_at || lead.status === "revoked") {
    return jsonResponse({ error: "Lead ist bereits widerrufen." }, 409);
  }
  if (lead.status === "deleted") {
    return jsonResponse({ error: "Lead ist bereits gelöscht." }, 409);
  }

  try {
    await revokeLead(db, id, `admin:${channel}`, clientIp(request));
  } catch (err) {
    console.error("Admin revoke failed:", err);
    return new Response("Revoke failed", { status: 500 });
  }

  // Partner-Info nur nötig, wenn die Lead-Mail bereits raus war.
  let noticeSent = false;
  if (lead.admin_email_sent_at && e.BREVO_API_KEY) {
    const adminEmails = (e.ADMIN_NOTIFICATION_EMAILS ?? "")
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter((s) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s));
    if (adminEmails.length > 0) {
      try {
        await sendRevocationNoticeToAdmins(
          e.BREVO_API_KEY,
          {
            name: e.BREVO_SENDER_NAME ?? "Bremer Wärmepumpe",
            email: e.BREVO_SENDER_EMAIL ?? "kontakt@bremer-waermepumpe.de",
          },
          adminEmails,
          lead.reference,
        );
        noticeSent = true;
      } catch (err) {
        console.error("Revocation notice failed:", err);
      }
    }
  }

  const res = jsonResponse({ ok: true, noticeSent }, 200);
  applyAdminResponseHeaders(res.headers);
  return res;
};
