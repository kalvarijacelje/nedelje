/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });
dotenv.config();

import { createClient } from '@supabase/supabase-js';
import { INITIAL_MINISTRIES, INITIAL_PEOPLE, INITIAL_SUNDAYS } from '../src/data/initialData';
import { INITIAL_WORSHIP_ROSTER } from '../src/data/worshipData';
import { INITIAL_SUNDAY_SCHOOL_LESSONS } from '../src/data/sundaySchoolData';
import { INITIAL_VISITOR_CONNECTIONS } from '../src/data/visitorData';
import { generateConfirmationToken } from '../src/services/notificationService';

async function main() {
  const url = process.env.VITE_SUPABASE_URL || '';
  const key = process.env.VITE_SUPABASE_ANON_KEY || '';

  console.log('================================================================');
  console.log('🌱 DIRECT SUPABASE SEEDER (Bypassing Remote Firestore Fetch)');
  console.log('================================================================');
  console.log(`• Target Supabase URL: ${url ? url : '⚠️ Missing'}`);
  console.log(`• Supabase Key Loaded: ${key ? 'Yes (Length: ' + key.length + ')' : '⚠️ Missing'}`);
  console.log('----------------------------------------------------------------');

  if (!url || !key) {
    console.error('❌ Supabase URL or Anon Key is missing from environment variables.');
    process.exit(1);
  }

  const supabase = createClient(url, key);

  // 1. Seed Ministries -> nedelje_ministries
  console.log('1️⃣ Seeding Ministries (nedelje_ministries)...');
  const ministryRows = INITIAL_MINISTRIES.map(m => ({
    id: m.id,
    name: m.nameSl,
    description: m.nameEn || m.nameSl,
    icon: m.icon || 'Sparkles',
    color: m.color || 'indigo',
    active: true,
    required_count: 1,
    default_leader: null
  }));

  const { error: minErr } = await supabase.from('nedelje_ministries').upsert(ministryRows, { onConflict: 'id' });
  if (minErr) {
    console.error('   ❌ Ministries error:', minErr.message);
  } else {
    console.log(`   ✅ Seeded ${ministryRows.length} ministries`);
  }

  // 2. Seed People & Profiles -> public.profiles
  console.log('2️⃣ Seeding People / Profiles (public.profiles)...');
  const profileRows = INITIAL_PEOPLE.map(p => {
    const isSuperAdmin = (p.email || '').toLowerCase().trim() === 'ales.lajlar@gmail.com' || p.name === 'Aleš';
    return {
      id: p.id || ('p-' + p.name.toLowerCase().trim().replace(/[^a-z0-9]/g, '_')),
      full_name: p.name,
      name: p.name,
      email: p.email || (isSuperAdmin ? 'ales.lajlar@gmail.com' : null),
      phone: p.phone || null,
      avatar_url: p.avatarUrl || null,
      role: isSuperAdmin ? 'Admin' : (p.role || 'Servant'),
      preferred_ministries: p.preferredMinistries || [],
      led_ministries: p.ledMinistries || [],
      family_members: p.familyMembers || [],
      is_exempt_from_burnout: Boolean(p.isPastorOrStaff || p.isExemptFromBurnout || isSuperAdmin)
    };
  });

  const { error: peopleErr } = await supabase.from('profiles').upsert(profileRows, { onConflict: 'id' });
  if (peopleErr) {
    console.error('   ❌ Profiles error:', peopleErr.message);
  } else {
    console.log(`   ✅ Seeded ${profileRows.length} people / volunteer profiles`);
  }

  // 3. Seed Sundays & Assignments -> nedelje_services & nedelje_assignments
  console.log('3️⃣ Seeding Sundays (nedelje_services) & Assignments (nedelje_assignments)...');
  const sundayRows = INITIAL_SUNDAYS.map(s => ({
    id: s.id,
    date: s.date,
    service_date: s.date,
    title: s.themeSl || 'Nedeljsko bogoslužje',
    theme_sl: s.themeSl || '',
    theme_en: s.themeEn || '',
    status: s.status || 'draft',
    guest: s.guest || '',
    absent_or_notes: s.absentOrNotes || '',
    special_focus: s.specialFocus || null,
    worship_setlist: s.worshipSetlist || []
  }));

  const { error: sunErr } = await supabase.from('nedelje_services').upsert(sundayRows, { onConflict: 'id' });
  if (sunErr) {
    console.error('   ❌ Sundays error:', sunErr.message);
  } else {
    console.log(`   ✅ Seeded ${sundayRows.length} Sunday services`);

    // Relational assignments (parsing both assignmentDetails and assignments)
    const allAssignments: any[] = [];
    INITIAL_SUNDAYS.forEach(s => {
      if (s.assignmentDetails && Object.keys(s.assignmentDetails).length > 0) {
        Object.entries(s.assignmentDetails).forEach(([mId, detailsList]: [string, any]) => {
          if (Array.isArray(detailsList)) {
            detailsList.forEach(det => {
              if (!det || !det.personName || det.personName === '/' || det.personName.toLowerCase() === 'all') return;
              const token = det.confirmationToken || generateConfirmationToken(s.id, mId, det.personName.trim());
              const matchedP = profileRows.find(p => p.name.toLowerCase().trim() === det.personName.trim().toLowerCase());
              const cleanSlug = det.personName.trim().toLowerCase().replace(/[^a-z0-9]/g, '_');

              allAssignments.push({
                id: `${s.id}_${mId}_${cleanSlug}`,
                sunday_id: s.id,
                ministry_id: mId,
                person_name: det.personName.trim(),
                person_id: matchedP?.id || null,
                status: det.status || 'confirmed',
                confirmation_token: token
              });
            });
          }
        });
      }
      if (s.assignments) {
        Object.entries(s.assignments).forEach(([mId, names]) => {
          if (Array.isArray(names)) {
            names.forEach(name => {
              if (!name || name === '/' || name.toLowerCase() === 'all') return;
              const token = generateConfirmationToken(s.id, mId, name.trim());
              const matchedP = profileRows.find(p => p.name.toLowerCase().trim() === name.trim().toLowerCase());
              const cleanSlug = name.trim().toLowerCase().replace(/[^a-z0-9]/g, '_');

              allAssignments.push({
                id: `${s.id}_${mId}_${cleanSlug}`,
                sunday_id: s.id,
                ministry_id: mId,
                person_name: name.trim(),
                person_id: matchedP?.id || null,
                status: 'confirmed',
                confirmation_token: token
              });
            });
          }
        });
      }
    });

    if (allAssignments.length > 0) {
      const uniqueAssignments = Array.from(
        new Map(allAssignments.map((item) => [item.id, item])).values()
      );
      const { error: assignErr } = await supabase.from('nedelje_assignments').upsert(uniqueAssignments, { onConflict: 'id' });
      if (assignErr) {
        console.error('   ❌ Assignments error:', assignErr.message);
      } else {
        console.log(`   ✅ Seeded ${uniqueAssignments.length} relational ministry assignments (deduplicated)`);
      }
    }
  }

  // 4. Seed Worship Roster -> nedelje_worship_schedules
  console.log('4️⃣ Seeding Worship Schedules (nedelje_worship_schedules)...');
  const worshipRows = INITIAL_WORSHIP_ROSTER.map(w => ({
    id: w.id,
    date: w.date,
    worship_leader: w.leader || '',
    leader: w.leader || '',
    acoustic: w.acoustic || '',
    drums: w.drums || '',
    bass: w.bass || '',
    keys: w.keys || '',
    vocals: w.vocals || '',
    sound: w.sound || '',
    slides: w.slides || '',
    vocal_tech_absent: w.vocalTechAbsent || '',
    monitors: w.monitors || '',
    sunday_school: w.sundaySchool || ''
  }));

  const { error: worErr } = await supabase.from('nedelje_worship_schedules').upsert(worshipRows, { onConflict: 'id' });
  if (worErr) {
    console.error('   ❌ Worship error:', worErr.message);
  } else {
    console.log(`   ✅ Seeded ${worshipRows.length} worship schedules`);
  }

  // 5. Seed Sunday School -> nedelje_school_lessons
  console.log('5️⃣ Seeding Sunday School Lessons (nedelje_school_lessons)...');
  const lessonRows = INITIAL_SUNDAY_SCHOOL_LESSONS.map((l, idx) => ({
    id: l.id || `lesson-${idx}`,
    sunday_id: l.sundayId,
    sunday_date: l.sundayDate,
    group_name: l.group,
    topic_sl: l.topicSl || '',
    bible_story_sl: l.bibleStorySl || '',
    memory_verse_sl: l.memoryVerseSl || '',
    craft_and_games_sl: l.craftAndGamesSl || '',
    materials_needed: l.materialsNeeded || [],
    google_doc_url: l.googleDocUrl || '',
    teachers: l.teachers || [],
    helpers: l.helpers || [],
    notes: l.notes || '',
    status: l.status || 'planned'
  }));

  const { error: nslErr } = await supabase.from('nedelje_school_lessons').upsert(lessonRows, { onConflict: 'id' });
  if (nslErr) {
    console.error('   ❌ Sunday School error:', nslErr.message);
  } else {
    console.log(`   ✅ Seeded ${lessonRows.length} Sunday School lessons`);
  }

  // 6. Seed Visitors -> nedelje_visitors
  console.log('6️⃣ Seeding Visitor Connections (nedelje_visitors)...');
  const visitorRows = INITIAL_VISITOR_CONNECTIONS.map(v => ({
    id: v.id,
    sunday_id: v.sundayId,
    sunday_date: v.sundayDate,
    visitor_name: v.visitorName,
    contact_info: v.contactInfo || '',
    invited_by: v.invitedBy || '',
    notes: v.notes || '',
    interests: v.interests || [],
    assigned_follow_up_person: v.assignedFollowUpPerson || '',
    follow_up_status: v.followUpStatus || 'new',
    coffee_shop_notes: v.coffeeShopNotes || '',
    created_at: v.createdAt || new Date().toISOString()
  }));

  const { error: visErr } = await supabase.from('nedelje_visitors').upsert(visitorRows, { onConflict: 'id' });
  if (visErr) {
    console.error('   ❌ Visitors error:', visErr.message);
  } else {
    console.log(`   ✅ Seeded ${visitorRows.length} visitor connections`);
  }

  console.log('\n================================================================');
  console.log('🎉 DIRECT SEEDING COMPLETED SUCCESSFULLY!');
  console.log('================================================================');
}

main().catch(err => {
  console.error('❌ Fatal seeder error:', err);
  process.exit(1);
});
