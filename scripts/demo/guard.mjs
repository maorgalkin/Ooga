// Shared by the demo scripts: resolves the test Supabase project and refuses to go on unless
// it can show that project is not the app's own. Fails closed: an unknown app URL is a refusal.
import { readFileSync, existsSync } from 'node:fs';
import { parse } from 'dotenv';

const read = (file) => (existsSync(file) ? parse(readFileSync(file)) : {});
const projectRef = (url) => new URL(url).hostname.split('.')[0];

/**
 * Returns the test project's URL, anon key, service-role key (may be undefined) and ref.
 * Throws when the test project can't be told apart from the app's project.
 */
export function testProject({ needServiceKey = false } = {}) {
  const test = read('.env.test.local');
  const appUrl = read('.env.local').VITE_SUPABASE_URL;
  const url = test.VITE_SUPABASE_TEST_URL;
  const anonKey = test.VITE_SUPABASE_TEST_ANON_KEY;
  const serviceKey = test.VITE_SUPABASE_TEST_SERVICE_ROLE_KEY;

  if (!url || !anonKey || (needServiceKey && !serviceKey)) {
    throw new Error('Set the VITE_SUPABASE_TEST_* variables in .env.test.local.');
  }
  if (!appUrl) {
    throw new Error("Can't confirm .env.test.local isn't production: .env.local has no VITE_SUPABASE_URL.");
  }
  const ref = projectRef(url);
  if (ref === projectRef(appUrl)) {
    throw new Error(".env.test.local points at the app's own Supabase project. Refusing to run.");
  }
  // Legacy JWT keys name their project, so a key copied from another project is caught here
  if (serviceKey?.startsWith('eyJ')) {
    const claims = JSON.parse(Buffer.from(serviceKey.split('.')[1], 'base64url').toString());
    if (claims.ref !== ref || claims.role !== 'service_role') {
      throw new Error("The test service-role key doesn't belong to the test project. Refusing to run.");
    }
  }
  return { url, anonKey, serviceKey, ref };
}
