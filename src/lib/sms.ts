export type SmsSendResult = { ok: true; messageId: string } | { ok: false; error: string };

export type NormalizedPhone = { e164: string; raw: string };

const BREVO_SMS_ENDPOINT = "https://api.brevo.com/v3/transactionalSMS/sms";

export function normalizeDePhone(raw: string): NormalizedPhone | null {
  const trimmed = String(raw ?? "").trim();
  if (!trimmed) return null;
  const cleaned = trimmed.replace(/[\s\-\/()]/g, "");
  let e164: string | null = null;
  if (cleaned.startsWith("+49")) {
    e164 = "+49" + cleaned.slice(3).replace(/^0+/, "");
  } else if (cleaned.startsWith("0049")) {
    e164 = "+49" + cleaned.slice(4).replace(/^0+/, "");
  } else if (cleaned.startsWith("49") && cleaned.length >= 11) {
    e164 = "+49" + cleaned.slice(2).replace(/^0+/, "");
  } else if (cleaned.startsWith("0")) {
    e164 = "+49" + cleaned.slice(1).replace(/^0+/, "");
  } else {
    return null;
  }
  if (!/^\+49[1-9][0-9]{6,13}$/.test(e164)) return null;
  if (!/^\+491[5-7][0-9]{7,12}$/.test(e164)) {
    return null;
  }
  return { e164, raw: trimmed };
}

export function maskPhone(e164: string): string {
  if (e164.length < 6) return e164;
  return e164.slice(0, e164.length - 4).replace(/.(?=.{0}$)/g, "•") + e164.slice(-2);
}

export function maskPhoneDisplay(e164: string): string {
  if (!e164.startsWith("+")) return e164;
  const cc = e164.slice(0, 3);
  const rest = e164.slice(3);
  if (rest.length <= 4) return e164;
  const head = rest.slice(0, 3);
  const tail = rest.slice(-2);
  return `${cc} ${head} •••• ${tail}`;
}

export function generateNumericCode(digits: number = 6): string {
  const max = 10 ** digits;
  const bytes = new Uint8Array(4);
  crypto.getRandomValues(bytes);
  const value =
    ((bytes[0] << 24) | (bytes[1] << 16) | (bytes[2] << 8) | bytes[3]) >>> 0;
  const code = (value % max).toString().padStart(digits, "0");
  return code;
}

export async function hashCode(
  code: string,
  leadId: number,
  phone: string,
  pepper: string,
): Promise<string> {
  const enc = new TextEncoder();
  const input = `${code}:${leadId}:${phone}:${pepper}`;
  const data = enc.encode(input);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function brevoSmsPost(
  apiKey: string,
  payload: object,
): Promise<SmsSendResult> {
  try {
    const res = await fetch(BREVO_SMS_ENDPOINT, {
      method: "POST",
      headers: {
        "api-key": apiKey,
        "content-type": "application/json",
        accept: "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return { ok: false, error: `brevo_${res.status}:${text.slice(0, 200)}` };
    }

    const json = (await res.json().catch(() => null)) as
      | { messageId?: string | number; reference?: string }
      | null;
    const messageId = json?.messageId ? String(json.messageId) : json?.reference ?? "";
    return { ok: true, messageId };
  } catch (e) {
    return { ok: false, error: `network:${(e as Error).message}` };
  }
}

/**
 * Sends the 6-digit verification SMS.
 *
 * The trailing `@<host> #<code>` line is the WebOTP API / iOS Quick-Type
 * binding: it tells the browser the code is bound to this origin and may be
 * auto-filled into `<input autocomplete="one-time-code">`. `webOtpHost` must
 * be the bare host of the rendering page (e.g. "bremer-waermepumpe.de"),
 * without scheme or trailing slash, and must match the page origin exactly —
 * otherwise the browser silently ignores the code.
 */
export async function sendVerificationSms(
  apiKey: string,
  phoneE164: string,
  code: string,
  sender: string,
  webOtpHost: string,
): Promise<SmsSendResult> {
  const content =
    `Ihr Bestaetigungscode fuer den Bremer Waermepumpen-Check: ${code}` +
    ` (10 Min. gueltig, nicht weitergeben).\n\n@${webOtpHost} #${code}`;

  if (!apiKey) return { ok: false, error: "missing_api_key" };

  return brevoSmsPost(apiKey, {
    sender,
    recipient: phoneE164,
    content,
    type: "transactional",
    tag: "doi-verify",
  });
}

/**
 * Sends the post-verification confirmation SMS containing the reference and
 * pointers to the revocation channels (web form + phone). This replaces the
 * previous confirmation e-mail since the funnel no longer collects an
 * e-mail address.
 */
export async function sendConfirmationSms(
  apiKey: string,
  phoneE164: string,
  sender: string,
  reference: string,
  widerrufSite: string,
  betreiberTel: string,
): Promise<SmsSendResult> {
  const content =
    `Bremer Waermepumpe: Anfrage ${reference} eingegangen.` +
    ` Antwort innerhalb von 24 Std.` +
    ` Widerruf jederzeit unter ${widerrufSite} (Ref. ${reference}) oder ${betreiberTel}.`;

  if (!apiKey) return { ok: false, error: "missing_api_key" };

  return brevoSmsPost(apiKey, {
    sender,
    recipient: phoneE164,
    content,
    type: "transactional",
    tag: "doi-confirm",
  });
}
