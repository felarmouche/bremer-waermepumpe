import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import {
  ADMIN_SESSION_COOKIE,
  applyAdminResponseHeaders,
  deleteAdminSession,
  isSameOrigin,
} from "../../../lib/admin-auth";
import { jsonResponse, type KvLike } from "../../../lib/lead-flow";

export const prerender = false;

type Env = { SESSION?: KvLike };

export const POST: APIRoute = async ({ request, cookies }) => {
  if (!isSameOrigin(request)) {
    return new Response("Forbidden", { status: 403 });
  }

  const token = cookies.get(ADMIN_SESSION_COOKIE)?.value;
  await deleteAdminSession((env as Env).SESSION, token);
  cookies.delete(ADMIN_SESSION_COOKIE, { path: "/" });

  const res = jsonResponse({ ok: true }, 200);
  applyAdminResponseHeaders(res.headers);
  return res;
};
