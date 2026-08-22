import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
dotenv.config();

import { migrateFirestoreToSupabase } from '../src/utils/firestoreMigrationBridge';

async function main() {
  console.log('================================================================');
  console.log('🚀 FIRESTORE TO SUPABASE ONE-TIME MIGRATION BRIDGE');
  console.log('================================================================');
  
  const summary = await migrateFirestoreToSupabase();
  
  console.log('\n📊 Migration Report:');
  console.log('----------------------------------------------------------------');
  console.log(`• Ministries Migrated:    ${summary.ministriesCount}`);
  console.log(`• Profiles / People:      ${summary.peopleCount}`);
  console.log(`• Sundays (Services):     ${summary.sundaysCount}`);
  console.log(`• Individual Assignments: ${summary.assignmentsCount}`);
  console.log(`• Blackout Dates / Off:   ${summary.blackoutsCount}`);
  console.log(`• Shift Swap Requests:    ${summary.swapsCount}`);
  console.log(`• Worship Schedules:      ${summary.worshipCount}`);
  console.log(`• Sunday School Lessons:  ${summary.lessonsCount}`);
  console.log(`• Visitor Connections:    ${summary.visitorsCount}`);
  console.log(`• Data Source Mode:       ${summary.source}`);
  console.log('----------------------------------------------------------------');

  if (summary.errors.length > 0) {
    console.warn('⚠️ Completed with notices/warnings:');
    summary.errors.forEach(e => console.warn(`  - ${e}`));
  } else {
    console.log('✅ SUCCESS: Supabase PostgreSQL database is fully populated and verified!');
  }
}

main().catch(err => {
  console.error('❌ Fatal migration error:', err);
  process.exit(1);
});
