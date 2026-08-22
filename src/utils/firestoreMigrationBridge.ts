/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { supabase, IS_SUPABASE_CONFIGURED } from '../supabaseClient';
import { db, IS_FIREBASE_ENABLED } from '../lib/firebase';
import { collection, getDocs } from 'firebase/firestore';
import { INITIAL_MINISTRIES, INITIAL_PEOPLE, INITIAL_SUNDAYS } from '../data/initialData';
import { INITIAL_WORSHIP_ROSTER } from '../data/worshipData';
import { INITIAL_SUNDAY_SCHOOL_LESSONS } from '../data/sundaySchoolData';
import { INITIAL_VISITOR_CONNECTIONS } from '../data/visitorData';
import { generateConfirmationToken } from '../services/notificationService';

export interface MigrationSummary {
  ministriesCount: number;
  peopleCount: number;
  sundaysCount: number;
  assignmentsCount: number;
  blackoutsCount: number;
  swapsCount: number;
  worshipCount: number;
  lessonsCount: number;
  visitorsCount: number;
  source: 'firestore' | 'default_dataset' | 'hybrid';
  errors: string[];
}

/**
 * Reads all documents from a Firestore collection safely, returning empty array if offline or missing.
 */
async function fetchFirestoreCollection(collectionName: string): Promise<any[]> {
  if (!IS_FIREBASE_ENABLED || !db) return [];
  try {
    const colRef = collection(db, collectionName);
    const snap = await getDocs(colRef);
    const results: any[] = [];
    snap.forEach(doc => {
      results.push({ id: doc.id, ...doc.data() });
    });
    return results;
  } catch (err: any) {
    console.warn(`[Firestore Bridge] Notice reading collection "${collectionName}":`, err?.message || err);
    return [];
  }
}

/**
 * One-time Firestore to Supabase Migration Bridge.
 * Extracts all documents from original Firebase collections and maps/upserts them into PostgreSQL tables in Supabase.
 */
export async function migrateFirestoreToSupabase(): Promise<MigrationSummary> {
  const summary: MigrationSummary = {
    ministriesCount: 0,
    peopleCount: 0,
    sundaysCount: 0,
    assignmentsCount: 0,
    blackoutsCount: 0,
    swapsCount: 0,
    worshipCount: 0,
    lessonsCount: 0,
    visitorsCount: 0,
    source: 'default_dataset',
    errors: []
  };

  if (!IS_SUPABASE_CONFIGURED) {
    summary.errors.push('Supabase is not configured. Check VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.');
    return summary;
  }

  try {
    console.log('🚀 [Firestore -> Supabase Bridge] Starting data migration...');

    // 1. PULL OR PREPARE MINISTRIES
    const fsMinistries = await fetchFirestoreCollection('ministries');
    const rawMinistries = fsMinistries.length > 0 ? fsMinistries : INITIAL_MINISTRIES;
    const ministryRows = rawMinistries.map(m => ({
      id: m.id,
      name: m.nameSl || m.name,
      description: m.nameEn || m.description || m.nameSl || m.name,
      icon: m.icon || 'Sparkles',
      color: m.color || 'indigo',
      active: m.active !== false
    }));

    const { error: minErr } = await supabase.from('nedelje_ministries').upsert(ministryRows);
    if (minErr) summary.errors.push(`Ministries: ${minErr.message}`);
    else summary.ministriesCount = ministryRows.length;

    // 2. PULL OR PREPARE PEOPLE & PROFILES
    const fsPeople = await fetchFirestoreCollection('people');
    const fsProfiles = await fetchFirestoreCollection('profiles');
    const combinedPeopleMap = new Map<string, any>();

    INITIAL_PEOPLE.forEach(p => combinedPeopleMap.set(p.name.toLowerCase().trim(), p));
    fsPeople.forEach(p => {
      const key = (p.name || p.full_name || p.id).toLowerCase().trim();
      combinedPeopleMap.set(key, { ...combinedPeopleMap.get(key), ...p });
    });
    fsProfiles.forEach(p => {
      const key = (p.full_name || p.name || p.id).toLowerCase().trim();
      combinedPeopleMap.set(key, { ...combinedPeopleMap.get(key), ...p });
    });

    const peopleList = Array.from(combinedPeopleMap.values());
    const profileRows = peopleList.map(p => {
      const rawName = p.full_name || p.name || 'Sodelavec';
      const cleanId = p.id || ('p-' + rawName.toLowerCase().trim().replace(/[^a-z0-9]/g, '_'));
      const isSuperAdmin = (p.email || '').toLowerCase().trim() === 'ales.lajlar@gmail.com';

      return {
        id: cleanId,
        full_name: rawName,
        name: rawName,
        email: p.email || (isSuperAdmin ? 'ales.lajlar@gmail.com' : null),
        phone: p.phone || null,
        role: isSuperAdmin ? 'Admin' : (p.role || 'Servant'),
        preferred_ministries: p.preferredMinistries || p.preferred_ministries || [],
        family_members: p.familyMembers || p.family_members || [],
        is_exempt_from_burnout: Boolean(p.isExemptFromBurnout || p.is_exempt_from_burnout || isSuperAdmin)
      };
    });

    const { error: peopleErr } = await supabase.from('profiles').upsert(profileRows);
    if (peopleErr) summary.errors.push(`Profiles: ${peopleErr.message}`);
    else summary.peopleCount = profileRows.length;

    // 3. PULL OR PREPARE SUNDAYS & ASSIGNMENTS
    const fsSundays1 = await fetchFirestoreCollection('sundays');
    const fsSundays2 = await fetchFirestoreCollection('service_sundays');
    const combinedSundaysMap = new Map<string, any>();

    INITIAL_SUNDAYS.forEach(s => combinedSundaysMap.set(s.id, s));
    fsSundays1.forEach(s => combinedSundaysMap.set(s.id, { ...combinedSundaysMap.get(s.id), ...s }));
    fsSundays2.forEach(s => combinedSundaysMap.set(s.id, { ...combinedSundaysMap.get(s.id), ...s }));

    const sundaysList = Array.from(combinedSundaysMap.values());
    const sundayRows = sundaysList.map(s => ({
      id: s.id,
      date: s.date,
      service_date: s.serviceDate || s.service_date || s.date,
      title: s.title || s.themeSl || 'Nedeljsko bogoslužje',
      theme_sl: s.themeSl || s.theme_sl || '',
      theme_en: s.themeEn || s.theme_en || '',
      status: s.status || 'draft',
      guest: s.guest || '',
      absent_or_notes: s.absentOrNotes || s.absent_or_notes || '',
      special_focus: s.specialFocus || s.special_focus || null,
      worship_setlist: s.worshipSetlist || s.worship_setlist || []
    }));

    const { error: sunErr } = await supabase.from('nedelje_services').upsert(sundayRows);
    if (sunErr) {
      summary.errors.push(`Sundays: ${sunErr.message}`);
    } else {
      summary.sundaysCount = sundayRows.length;

      // Extract Relational Assignments
      const assignmentRows: any[] = [];
      sundaysList.forEach(s => {
        if (s.assignments && typeof s.assignments === 'object') {
          Object.entries(s.assignments).forEach(([mId, names]: [string, any]) => {
            if (Array.isArray(names)) {
              names.forEach(name => {
                if (name && typeof name === 'string' && name.trim()) {
                  const token = generateConfirmationToken(s.id, mId, name.trim());
                  const matchedP = profileRows.find(p => p.name.toLowerCase().trim() === name.trim().toLowerCase());

                  assignmentRows.push({
                    sunday_id: s.id,
                    ministry_id: mId,
                    person_name: name.trim(),
                    person_id: matchedP?.id || null,
                    status: (s.assignmentStatuses && s.assignmentStatuses[`${mId}_${name.trim()}`]) || 'confirmed',
                    confirmation_token: token
                  });
                }
              });
            }
          });
        }
      });

      if (assignmentRows.length > 0) {
        const { error: assignErr } = await supabase.from('nedelje_assignments').upsert(assignmentRows);
        if (assignErr) summary.errors.push(`Assignments: ${assignErr.message}`);
        else summary.assignmentsCount = assignmentRows.length;
      }
    }

    // 4. PULL OR PREPARE BLACKOUT DATES / VACATIONS
    const fsBlackouts = await fetchFirestoreCollection('blackout_dates');
    const blackoutList = fsBlackouts.length > 0 ? fsBlackouts : [];
    if (blackoutList.length > 0) {
      const blackoutRows = blackoutList.map(b => ({
        id: b.id.length >= 30 ? b.id : undefined,
        person_name: b.personName || b.person_name,
        person_id: b.personId || b.person_id || null,
        start_date: b.startDate || b.start_date,
        end_date: b.endDate || b.end_date || b.startDate || b.start_date,
        reason: b.reason || null
      }));

      const { error: bErr } = await supabase.from('nedelje_blackout_dates').upsert(blackoutRows);
      if (bErr) summary.errors.push(`Blackouts: ${bErr.message}`);
      else summary.blackoutsCount = blackoutRows.length;
    }

    // 5. PULL OR PREPARE SHIFT SWAPS
    const fsSwaps = await fetchFirestoreCollection('shift_swaps');
    if (fsSwaps.length > 0) {
      const swapRows = fsSwaps.map(s => ({
        id: s.id.length >= 30 ? s.id : undefined,
        sunday_id: s.sundayId || s.sunday_id,
        sunday_date: s.sundayDate || s.sunday_date,
        ministry_id: s.ministryId || s.ministry_id,
        ministry_name: s.ministryName || s.ministry_name,
        requester_name: s.requesterName || s.requester_name,
        reason: s.reason || null,
        status: s.status || 'open',
        accepted_by_name: s.acceptedByName || s.accepted_by_name || null
      }));

      const { error: swapErr } = await supabase.from('nedelje_shift_swaps').upsert(swapRows);
      if (swapErr) summary.errors.push(`Shift swaps: ${swapErr.message}`);
      else summary.swapsCount = swapRows.length;
    }

    // 6. PULL OR PREPARE WORSHIP ROSTER
    const fsWorship = await fetchFirestoreCollection('worship_schedules');
    const rawWorship = fsWorship.length > 0 ? fsWorship : INITIAL_WORSHIP_ROSTER;
    const worshipRows = rawWorship.map((w, idx) => ({
      id: w.id || `worship-${w.date || idx}`,
      date: w.date,
      worship_leader: w.leader || w.worship_leader || w.leaderName || '',
      leader: w.leader || w.worship_leader || '',
      acoustic: w.acoustic || '',
      drums: w.drums || '',
      bass: w.bass || '',
      keys: w.keys || '',
      vocals: Array.isArray(w.vocals) ? w.vocals.join(', ') : (w.vocals || ''),
      sound: w.sound || '',
      slides: w.slides || '',
      vocal_tech_absent: w.vocalTechAbsent || w.vocal_tech_absent || '',
      monitors: w.monitors || '',
      sunday_school: w.sundaySchool || w.sunday_school || ''
    }));

    const { error: worshipErr } = await supabase.from('nedelje_worship_schedules').upsert(worshipRows);
    if (worshipErr) summary.errors.push(`Worship: ${worshipErr.message}`);
    else summary.worshipCount = worshipRows.length;

    // 7. PULL OR PREPARE SUNDAY SCHOOL LESSONS
    const fsLessons = await fetchFirestoreCollection('sunday_school_lessons');
    const rawLessons = fsLessons.length > 0 ? fsLessons : INITIAL_SUNDAY_SCHOOL_LESSONS;
    const lessonRows = rawLessons.map((l: any, idx: number) => ({
      id: l.id || `lesson-${idx}`,
      sunday_id: l.sundayId || l.sunday_id || null,
      sunday_date: l.sundayDate || l.sunday_date || l.date || '',
      group_name: l.groupName || l.group_name || 'Vsi',
      topic_sl: l.topicSl || l.topic_sl || l.topic || '',
      bible_story_sl: l.bibleStorySl || l.bible_story_sl || '',
      memory_verse_sl: l.memoryVerseSl || l.memory_verse_sl || '',
      craft_and_games_sl: l.craftAndGamesSl || l.craft_and_games_sl || '',
      materials_needed: l.materialsNeeded || l.materials_needed || [],
      google_doc_url: l.googleDocUrl || l.google_doc_url || null,
      teachers: l.teachers || [],
      helpers: l.helpers || [],
      notes: l.notes || '',
      status: l.status || 'planned'
    }));

    const { error: lessonErr } = await supabase.from('nedelje_school_lessons').upsert(lessonRows);
    if (lessonErr) summary.errors.push(`Sunday School: ${lessonErr.message}`);
    else summary.lessonsCount = lessonRows.length;

    // 8. PULL OR PREPARE VISITOR CONNECTIONS
    const fsVisitors = await fetchFirestoreCollection('visitor_connections');
    const rawVisitors = fsVisitors.length > 0 ? fsVisitors : INITIAL_VISITOR_CONNECTIONS;
    const visitorRows = rawVisitors.map((v: any, idx: number) => ({
      id: v.id || `visitor-${idx}`,
      sunday_id: v.sundayId || v.sunday_id || '',
      sunday_date: v.sundayDate || v.sunday_date || '',
      visitor_name: v.visitorName || v.visitor_name || 'Obiskovalec',
      contact_info: v.contactInfo || v.contact_info || '',
      invited_by: v.invitedBy || v.invited_by || '',
      notes: v.notes || '',
      interests: v.interests || [],
      assigned_follow_up_person: v.assignedFollowUpPerson || v.assigned_follow_up_person || '',
      follow_up_status: v.followUpStatus || v.follow_up_status || 'new',
      coffee_shop_notes: v.coffeeShopNotes || v.coffee_shop_notes || ''
    }));

    const { error: visErr } = await supabase.from('nedelje_visitors').upsert(visitorRows);
    if (visErr) summary.errors.push(`Visitors: ${visErr.message}`);
    else summary.visitorsCount = visitorRows.length;

    summary.source = fsSundays1.length > 0 || fsPeople.length > 0 ? 'firestore' : 'default_dataset';

    console.log('✅ [Firestore -> Supabase Bridge] Migration completed successfully!', summary);
  } catch (err: any) {
    console.error('❌ [Firestore -> Supabase Bridge] Migration encountered unexpected error:', err);
    summary.errors.push(`Fatal migration error: ${err?.message || err}`);
  }

  return summary;
}

if (typeof window !== 'undefined') {
  (window as any).migrateFirestoreToSupabase = migrateFirestoreToSupabase;
}
