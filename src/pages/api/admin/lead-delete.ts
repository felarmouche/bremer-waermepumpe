import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import {
  ADMIN_SESSION_COOKIE,
  applyAdminResponseHeaders,
  isSameOrigin,
  isValidAdminSession,
} from "../../../lib/admin-auth";
import { jsonResponse, type KvLike } from "../../../lib/lead-flow";
import { anonymizeLead, deleteLeadFull, getLeadById } from "../../../lib/leads";

export const prerender = false;

type Env = { DB?: unknown; SESSION?: KvLike };

// Zwei Löschwege gemäß Datenschutzerklärung Ziffer 5:
//
//   mode "anonymize" — Stammdaten-Löschung (Regelfall, Art. 17 DSGVO):
//     PII wird geleert, Referenz + Zeitstempel bleiben pseudonymisiert.
//     Einwilligungs-/SMS-Nachweis bleibt 5 Jahre (§ 7a Abs. 2 UWG).
//
//   mode "full" — restlose Löschung inkl. Nachweise:
//     nur für Einträge OHNE verifizierte Einwilligung (Spam, Tests,
//     abgebrochene SMS-Verifizierung). Für verifizierte Leads gesperrt,
//     damit die gesetzliche Nachweispflicht nicht verletzt werden kann.
//
// Als Schutz vor Verwechslung muss der Client die Referenz mitschicken.
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

  let body: { id?: unknown; reference?: unknown; mode?: unknown };
  try {
    body = (await request.json()) as never;
  } catch {
    return new Response("Bad Request", { status: 400 });
  }

  const id =
    typeof body.id === "number" && Number.isInteger(body.id) && body.id > 0
      ? body.id
      : null;
  const reference =
    typeof body.reference === "string" ? body.reference.trim() : "";
  const mode =
    body.mode === "anonymize" || body.mode === "full" ? body.mode : null;

  if (!id || !mode || !reference) {
    return jsonResponse({ error: "id, reference und mode erforderlich." }, 400);
  }

  const lead = await getLeadById(db, id);
  if (!lead) return jsonResponse({ error: "Lead nicht gefunden." }, 404);
  if (lead.reference !== reference) {
    return jsonResponse(
      { error: "Referenz stimmt nicht überein — Löschung abgebrochen." },
      409,
    );
  }

  if (mode === "anonymize") {
    if (lead.status === "deleted") {
      return jsonResponse({ error: "Stammdaten sind bereits gelöscht." }, 409);
    }
    try {
      await anonymizeLead(db, id);
    } catch (err) {
      console.error("Anonymize failed:", err);
      return new Response("Delete failed", { status: 500 });
    }
    console.log(
      `DSGVO: Stammdaten von ${lead.reference} gelöscht (Nachweis bleibt).`,
    );
  } else {
    if (lead.sms_verified_at) {
      return jsonResponse(
        {
          error:
            "Dieser Lead hat eine verifizierte Einwilligung — der Nachweis muss 5 Jahre aufbewahrt werden (§ 7a Abs. 2 UWG). Bitte „Stammdaten löschen“ verwenden.",
        },
        409,
      );
    }
    try {
      await deleteLeadFull(db, id);
    } catch (err) {
      console.error("Full delete failed:", err);
      return new Response("Delete failed", { status: 500 });
    }
    console.log(`DSGVO: ${lead.reference} vollständig gelöscht (unverifiziert).`);
  }

  const res = jsonResponse({ ok: true, mode }, 200);
  applyAdminResponseHeaders(res.headers);
  return res;
};
