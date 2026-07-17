// Erzeugt den ADMIN_PASSWORD_HASH für das Lead-Dashboard.
//
//   node scripts/hash-admin-password.mjs            → fragt auf stdin
//   ADMIN_PW=... node scripts/hash-admin-password.mjs
//
// Ausgabe-Format: pbkdf2:<iterations>:<salt-hex>:<hash-hex>
// Danach setzen:  wrangler secret put ADMIN_PASSWORD_HASH
// und lokal in .dev.vars eintragen. Das Klartext-Passwort nie committen!

import { pbkdf2Sync, randomBytes } from "node:crypto";
import { createInterface } from "node:readline";

// 10.000 Iterationen: bewusst moderat, damit die Verifikation im Worker
// unter dem CPU-Limit des Cloudflare Free Plans bleibt (siehe admin-auth.ts).
const ITERATIONS = 10000;

async function readPassword() {
  if (process.env.ADMIN_PW) return process.env.ADMIN_PW;
  const rl = createInterface({ input: process.stdin, output: process.stderr });
  const answer = await new Promise((resolve) =>
    rl.question("Passwort: ", resolve),
  );
  rl.close();
  return answer;
}

const password = (await readPassword()).trim();
if (password.length < 10) {
  console.error("Passwort zu kurz (mind. 10 Zeichen).");
  process.exit(1);
}

const salt = randomBytes(16);
const hash = pbkdf2Sync(password, salt, ITERATIONS, 32, "sha256");
console.log(
  `pbkdf2:${ITERATIONS}:${salt.toString("hex")}:${hash.toString("hex")}`,
);
