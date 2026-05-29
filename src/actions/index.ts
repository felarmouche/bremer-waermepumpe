// Astro Actions surface intentionally left empty. The funnel uses dedicated
// API routes under /api/lead/* (start, resend, verify) so that the
// DSGVO-required side effects — D1 persistence, consent log, peppered SMS
// code hashing, rate limits, admin notification, confirmation SMS — all run
// in the same edge worker request as the user action.
export const server = {};
