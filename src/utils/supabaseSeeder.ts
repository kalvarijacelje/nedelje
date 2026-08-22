/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { supabase } from '../supabaseClient';
import { 
  INITIAL_MINISTRIES, 
  INITIAL_PEOPLE, 
  INITIAL_SUNDAYS 
} from '../data/initialData';
import { INITIAL_WORSHIP_ROSTER } from '../data/worshipData';
import { INITIAL_SUNDAY_SCHOOL_LESSONS, INITIAL_SUNDAY_SCHOOL_SUPPLIES } from '../data/sundaySchoolData';
import { INITIAL_VISITOR_CONNECTIONS } from '../data/visitorData';
import { ServiceSunday, Person } from '../types';

export interface SeedSummary {
  sundaysCount: number;
  peopleCount: number;
  ministriesCount: number;
  worshipCount: number;
  lessonsCount: number;
  visitorsCount: number;
  errors: string[];
}

/**
 * Idempotently seeds default data into Supabase PostgreSQL prefixed tables and shared profiles.
 */
export async function seedSupabaseDatabase(
  customSundays?: ServiceSunday[],
  customPeople?: Person[]
): Promise<SeedSummary> {
  const summary: SeedSummary = {
    sundaysCount: 0,
    peopleCount: 0,
    ministriesCount: 0,
    worshipCount: 0,
    lessonsCount: 0,
    visitorsCount: 0,
    errors: []
  };

  try {
    // 1. Seed Ministries -> nedelje_ministries
    const ministryRows = INITIAL_MINISTRIES.map(m => ({
      id: m.id,
      name: m.nameSl,
      description: m.nameEn || m.nameSl,
      icon: m.icon || 'Sparkles',
      color: m.color || 'indigo',
      active: true
    }));

    const { error: minErr } = await supabase.from('nedelje_ministries').upsert(ministryRows);
    if (minErr) summary.errors.push(`Ministries error: ${minErr.message}`);
    else summary.ministriesCount = ministryRows.length;

    // 2. Seed People / Profiles -> public.profiles
    const peopleList = customPeople && customPeople.length > 0 ? customPeople : INITIAL_PEOPLE;
    const profileRows = peopleList.map(p => ({
      id: p.id || ('p-' + p.name.toLowerCase().trim().replace(/[^a-z0-9]/g, '_')),
      full_name: p.name,
      name: p.name,
      email: p.email || null,
      phone: p.phone || null,
      role: p.role || 'Viewer',
      preferred_ministries: p.preferredMinistries || [],
      family_members: p.familyMembers || [],
      is_exempt_from_burnout: Boolean(p.isExemptFromBurnout)
    }));

    const { error: peopleErr } = await supabase.from('profiles').upsert(profileRows);
    if (peopleErr) summary.errors.push(`Profiles error: ${peopleErr.message}`);
    else summary.peopleCount = profileRows.length;

    // 3. Seed Sundays & Assignments -> nedelje_services & nedelje_assignments
    const sundaysList = customSundays && customSundays.length > 0 ? customSundays : INITIAL_SUNDAYS;
    const sundayRows = sundaysList.map(s => ({
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

    const { error: sunErr } = await supabase.from('nedelje_services').upsert(sundayRows);
    if (sunErr) {
      summary.errors.push(`Sundays error: ${sunErr.message}`);
    } else {
      summary.sundaysCount = sundayRows.length;

      // Extract and batch insert assignments
      const allAssignments: any[] = [];
      sundaysList.forEach(s => {
        if (s.assignments) {
          Object.entries(s.assignments).forEach(([mId, names]) => {
            if (Array.isArray(names)) {
              names.forEach(name => {
                if (!name || name === '/' || name.toLowerCase() === 'all') return;
                const details = s.assignmentDetails?.[mId] || [];
                const detail = details.find(d => d.personName.toLowerCase().trim() === name.toLowerCase().trim());

                allAssignments.push({
                  sunday_id: s.id,
                  ministry_id: mId,
                  person_name: name,
                  status: detail?.status || 'pending',
                  notes: detail?.notes || null,
                  decline_reason: detail?.declineReason || null,
                  confirmation_token: detail?.confirmationToken || null,
                  assigned_by_id: detail?.assignedByLeaderId || null,
                  assigned_by_name: detail?.assignedByLeaderName || null,
                  assigned_at: detail?.assignedAt || new Date().toISOString()
                });
              });
            }
          });
        }
      });

      if (allAssignments.length > 0) {
        const { error: assignErr } = await supabase.from('nedelje_assignments').upsert(allAssignments);
        if (assignErr) summary.errors.push(`Assignments error: ${assignErr.message}`);
      }
    }

    // 4. Seed Worship Roster -> nedelje_worship_schedules
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

    const { error: worErr } = await supabase.from('nedelje_worship_schedules').upsert(worshipRows);
    if (worErr) summary.errors.push(`Worship error: ${worErr.message}`);
    else summary.worshipCount = worshipRows.length;

    // 5. Seed Sunday School -> nedelje_school_lessons
    const lessonRows = INITIAL_SUNDAY_SCHOOL_LESSONS.map(l => ({
      id: l.id,
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

    const { error: nslErr } = await supabase.from('nedelje_school_lessons').upsert(lessonRows);
    if (nslErr) summary.errors.push(`Sunday School error: ${nslErr.message}`);
    else summary.lessonsCount = lessonRows.length;

    // 6. Seed Visitors -> nedelje_visitors
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

    const { error: visErr } = await supabase.from('nedelje_visitors').upsert(visitorRows);
    if (visErr) summary.errors.push(`Visitors error: ${visErr.message}`);
    else summary.visitorsCount = visitorRows.length;

  } catch (err: any) {
    summary.errors.push(`Unexpected error during seeding: ${err?.message || err}`);
  }

  return summary;
}

// Expose seeder on window object for browser console execution
if (typeof window !== 'undefined') {
  (window as any).seedSupabaseDatabase = seedSupabaseDatabase;
}
