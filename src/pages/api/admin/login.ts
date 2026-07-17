import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import {
  ADMIN_SESSION_COOKIE,
  ADMIN_SESSION_TTL_SECONDS,
  applyAdminResponseHeaders,
  createAdminSession,
  isSameOrigin,
  safeStringEqual,
  verifyPassword,
} from "../../../lib/admin-auth";
import {
  checkAndIncrementRate,
  clientIp,
  jsonResponse,
  type KvLike,
} from "../../../lib/lead-flow";

export const prerender = false;

type Env = {
  SESSION?: KvLike;
  ADMIN_EMAIL?: string;
  ADMIN_PASSWORD_HASH?: string;
};

export const POST: APIRoute = async ({ request, cookies }) => {
  if (!request.headers.get("content-type")?.includes("application/json")) {
    return new Response("Bad Request", { status: 400 });
  }
  if (!isSameOrigin(request)) {
    return new Response("Forbidden", { status: 403 });
  }

  let body: { email?: unknown; password?: unknown };
  try {
    body = (await request.json()) as never;
  } catch {
    return new Response("Bad Request", { status: 400 });
  }

  const email =
    typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body.password === "string" ? body.password : "";
  if (!email || !password || email.length > 200 || password.length > 200) {
    return jsonResponse({ error: "E-Mail oder Passwort falsch." }, 401);
  }

  const e = env as Env;
  const kv = e.SESSION;
  if (!kv || !e.ADMIN_EMAIL || !e.ADMIN_PASSWORD_HASH) {
    console.error("Admin login: SESSION/ADMIN_EMAIL/ADMIN_PASSWORD_HASH fehlt.");
    return new Response("Server misconfigured", { status: 500 });
  }

  // Bruteforce-Schutz: pro IP und global (gegen verteilte Versuche).
  const ip = clientIp(request);
  const ipRate = await checkAndIncrementRate(
    kv,
    `rate:admin:login:ip:${ip}`,
    5,
    900,
  );
  const globalRate = await checkAndIncrementRate(
    kv,
    `rate:admin:login:global`,
    30,
    3600,
  );
  if (!ipRate.ok || !globalRate.ok) {
    return jsonResponse(
      { error: "Zu viele Login-Versuche. Bitte später erneut versuchen." },
      429,
    );
  }

  // Passwort-Hash immer prüfen (auch bei falscher E-Mail): kein Timing-Orakel.
  const emailOk = safeStringEqual(email, e.ADMIN_EMAIL.trim().toLowerCase());
  const passwordOk = await verifyPassword(e.ADMIN_PASSWORD_HASH, password);
  if (!emailOk || !passwordOk) {
    return jsonResponse({ error: "E-Mail oder Passwort falsch." }, 401);
  }

  // Erfolgreicher Login gibt die IP wieder frei — sonst sperrt sich der
  // Betreiber nach 5 regulären Anmeldungen selbst für 15 Minuten aus.
  // Der globale Zähler bleibt bestehen (Schutz vor verteilten Versuchen).
  try {
    await kv.delete(`rate:admin:login:ip:${ip}`);
  } catch {
    /* nicht kritisch */
  }

  const token = await createAdminSession(kv);
  cookies.set(ADMIN_SESSION_COOKIE, token, {
    httpOnly: true,
    secure: true,
    sameSite: "strict",
    path: "/",
    maxAge: ADMIN_SESSION_TTL_SECONDS,
  });

  const res = jsonResponse({ ok: true }, 200);
  applyAdminResponseHeaders(res.headers);
  return res;
};
