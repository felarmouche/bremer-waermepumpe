import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import {
  ADMIN_SESSION_COOKIE,
  applyAdminResponseHeaders,
  isSameOrigin,
  isValidAdminSession,
} from "../../../lib/admin-auth";
import { jsonResponse, type KvLike } from "../../../lib/lead-flow";
import {
  CRM_STATUSES,
  getLeadById,
  updateLeadCrm,
  type CrmStatus,
} from "../../../lib/leads";

export const prerender = false;

type Env = { DB?: unknown; SESSION?: KvLike };

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

  let body: { id?: unknown; crm_status?: unknown; crm_notes?: unknown };
  try {
    body = (await request.json()) as never;
  } catch {
    return new Response("Bad Request", { status: 400 });
  }

  const id = typeof body.id === "number" && Number.isInteger(body.id) && body.id > 0
    ? body.id
    : null;
  if (!id) return jsonResponse({ error: "Ungültige Lead-ID." }, 400);

  const fields: { crm_status?: CrmStatus; crm_notes?: string } = {};

  if (body.crm_status !== undefined) {
    if (
      typeof body.crm_status !== "string" ||
      !(CRM_STATUSES as readonly string[]).includes(body.crm_status)
    ) {
      return jsonResponse({ error: "Ungültiger Status." }, 400);
    }
    fields.crm_status = body.crm_status as CrmStatus;
  }

  if (body.crm_notes !== undefined) {
    if (typeof body.crm_notes !== "string" || body.crm_notes.length > 2000) {
      return jsonResponse({ error: "Notiz ungültig (max. 2000 Zeichen)." }, 400);
    }
    // Steuerzeichen raus, Zeilenumbrüche bleiben.
    fields.crm_notes = body.crm_notes.replace(
      /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g,
      '',
    );
  }

  if (fields.crm_status === undefined && fields.crm_notes === undefined) {
    return jsonResponse({ error: "Keine Änderungen übergeben." }, 400);
  }

  const lead = await getLeadById(db, id);
  if (!lead) return jsonResponse({ error: "Lead nicht gefunden." }, 404);
  if (lead.status === "deleted") {
    return jsonResponse(
      { error: "Stammdaten gelöscht — keine Bearbeitung mehr möglich." },
      409,
    );
  }

  try {
    await updateLeadCrm(db, id, fields);
  } catch (err) {
    console.error("CRM update failed:", err);
    return new Response("Update failed", { status: 500 });
  }

  const res = jsonResponse(
    {
      ok: true,
      lead: {
        id,
        crm_status: fields.crm_status ?? lead.crm_status,
        crm_notes: fields.crm_notes ?? lead.crm_notes,
        crm_updated_at: new Date().toISOString(),
      },
    },
    200,
  );
  applyAdminResponseHeaders(res.headers);
  return res;
};
