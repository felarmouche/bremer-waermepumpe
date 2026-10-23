import { existsSync, readFileSync } from 'node:fs';
import { parseEnv } from 'node:util';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

export const ROOT = fileURLToPath(new URL('../../../', import.meta.url));
export function localEnvironment(root = ROOT, inherited = process.env) {
  const file = resolve(root, '.env.local');
  const local = existsSync(file) ? parseEnv(readFileSync(file, 'utf8')) : {};
  return { ...local, ...inherited };
}
export function credentials(env) {
  const login = env.DATAFORSEO_LOGIN || env.DATAFORSEO_USERNAME;
  if (!login || !env.DATAFORSEO_PASSWORD) {
    throw new Error('DataForSEO-Zugang fehlt. DATAFORSEO_LOGIN und DATAFORSEO_PASSWORD lokal in .env.local setzen.');
  }
  return { DATAFORSEO_LOGIN: login, DATAFORSEO_PASSWORD: env.DATAFORSEO_PASSWORD };
}
export function gscKeyPath(env, root = ROOT) {
  return resolve(root, env.GSC_SERVICE_ACCOUNT_FILE || env.GOOGLE_APPLICATION_CREDENTIALS || '.secrets/gsc-service-account.json');
}
