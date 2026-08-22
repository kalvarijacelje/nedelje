import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
dotenv.config();

import { seedSupabaseDatabase } from '../src/utils/supabaseSeeder';

async function main() {
  console.log('--- Starting automated Supabase database seeding ---');
  const summary = await seedSupabaseDatabase();
  console.log('Seeding Summary Result:', JSON.stringify(summary, null, 2));
  if (summary.errors.length > 0) {
    console.error('Seeding completed with some warnings/errors:', summary.errors);
  } else {
    console.log('SUCCESS: All tables populated successfully!');
  }
}

main().catch(err => {
  console.error('Fatal seeding error:', err);
});
