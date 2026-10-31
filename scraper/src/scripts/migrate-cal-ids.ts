// One-off: moves Cal connections' national IDs from plain-text metadata into encrypted storage.
// Run on the server, inside the scraper container (it has the service role key and ENCRYPTION_KEY):
//   docker compose -f docker-compose.prod.yml exec scraper node dist/scripts/migrate-cal-ids.js          # dry run
//   docker compose -f docker-compose.prod.yml exec scraper node dist/scripts/migrate-cal-ids.js --apply  # move them
// Prints counts and connection ids only, never an ID. See docs/SCRAPER_DEPLOY.md.
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { encrypt } from '../encryption.js';
import { migrateCalIds } from '../cal-id-migration.js';

const apply = process.argv.includes('--apply');
if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.ENCRYPTION_KEY?.length !== 64) {
  console.error('Needs SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY and ENCRYPTION_KEY (run it inside the scraper container).');
  process.exit(1);
}

const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const result = await migrateCalIds(db, { apply, encrypt });

console.log(`Cal connections with the ID in plain text: ${result.found}`);
for (const id of result.connectionIds) console.log(`  connection ${id}`);
if (result.skippedNoHousehold > 0) console.log(`Left as they are (no household): ${result.skippedNoHousehold}`);
console.log(apply ? `Moved to encrypted storage: ${result.moved}` : 'Dry run: nothing changed. Run again with --apply to move them.');
