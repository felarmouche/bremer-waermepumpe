import { defineMiddleware } from "astro:middleware";

// Basis-Security-Header für alle on-demand gerenderten Antworten (API,
// Dashboard, Funnel). Statische Seiten bekommen dieselben Header über
// public/_headers. Bereits gesetzte Header (z. B. X-Frame-Options: DENY und
// die CSP des Dashboards) werden nicht überschrieben.
const SECURITY_HEADERS: Record<string, string> = {
  "Strict-Transport-Security": "max-age=31536000",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "SAMEORIGIN",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy":
    "camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()",
  "Cross-Origin-Opener-Policy": "same-origin",
};

function apply(headers: Headers): void {
  for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
    if (!headers.has(name)) headers.set(name, value);
  }
}

export const onRequest = defineMiddleware(async (_context, next) => {
  const response = await next();
  try {
    apply(response.headers);
    return response;
  } catch {
    // Unveränderliche Header (z. B. bei Response.redirect): Kopie anlegen.
    const copy = new Response(response.body, response);
    apply(copy.headers);
    return copy;
  }
});
