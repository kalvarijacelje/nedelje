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
 * Idempotently seeds default data and local storage cache into Supabase PostgreSQL tables.
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
    // 1. Seed Ministries
    const ministryRows = INITIAL_MINISTRIES.map(m => ({
      id: m.id,
      name_sl: m.nameSl,
      name_en: m.nameEn,
      category: m.category || 'other',
      color: m.color || 'indigo',
      required_count: 1
    }));

    const { error: minErr } = await supabase.from('ministries').upsert(ministryRows);
    if (minErr) summary.errors.push(`Ministries error: ${minErr.message}`);
    else summary.ministriesCount = ministryRows.length;

    // 2. Seed People / Profiles
    const peopleList = customPeople && customPeople.length > 0 ? customPeople : INITIAL_PEOPLE;
    const profileRows = peopleList.map(p => ({
      id: p.id || ('p-' + p.name.toLowerCase().trim().replace(/[^a-z0-9]/g, '_')),
      name: p.name,
      email: p.email || null,
      phone: p.phone || null,
      role: p.role || 'Viewer',
      preferred_ministries: p.preferredMinistries || [],
      family_members: p.familyMembers || [],
      is_exempt_from_burnout: Boolean(p.isExemptFromBurnout)
    }));

    const { error: peopleErr } = await supabase.from('profiles').upsert(profileRows);
    if (peopleErr) summary.errors.push(`People error: ${peopleErr.message}`);
    else summary.peopleCount = profileRows.length;

    // 3. Seed Sundays & Assignments
    const sundaysList = customSundays && customSundays.length > 0 ? customSundays : INITIAL_SUNDAYS;
    const sundayRows = sundaysList.map(s => ({
      id: s.id,
      date: s.date,
      theme_sl: s.themeSl || '',
      theme_en: s.themeEn || '',
      status: s.status || 'draft',
      guest: s.guest || '',
      absent_or_notes: s.absentOrNotes || '',
      special_focus: s.specialFocus || null,
      worship_setlist: s.worshipSetlist || []
    }));

    const { error: sunErr } = await supabase.from('service_sundays').upsert(sundayRows);
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
        const { error: assignErr } = await supabase.from('sunday_assignments').upsert(allAssignments);
        if (assignErr) summary.errors.push(`Assignments error: ${assignErr.message}`);
      }
    }

    // 4. Seed Worship Roster
    const worshipRows = INITIAL_WORSHIP_ROSTER.map(w => ({
      id: w.id,
      date: w.date,
      worship_leader: w.worshipLeader,
      band_members: w.bandMembers || [],
      vocalists: w.vocalists || [],
      notes: w.notes || null
    }));

    const { error: worErr } = await supabase.from('worship_schedules').upsert(worshipRows);
    if (worErr) summary.errors.push(`Worship error: ${worErr.message}`);
    else summary.worshipCount = worshipRows.length;

    // 5. Seed Sunday School
    const lessonRows = INITIAL_SUNDAY_SCHOOL_LESSONS.map(l => ({
      id: l.id,
      date: l.date,
      topic_sl: l.topicSl || '',
      topic_en: l.topicEn || '',
      teachers_younger: l.teachersYounger || [],
      teachers_older: l.teachersOlder || [],
      materials_needed: l.materialsNeeded || [],
      notes: l.notes || null
    }));

    const { error: nslErr } = await supabase.from('sunday_school_lessons').upsert(lessonRows);
    if (nslErr) summary.errors.push(`Sunday School error: ${nslErr.message}`);
    else summary.lessonsCount = lessonRows.length;

    // 6. Seed Visitors
    const visitorRows = INITIAL_VISITOR_CONNECTIONS.map(v => ({
      id: v.id,
      full_name: v.fullName,
      contact_info: v.contactInfo || null,
      notes: v.notes || null,
      visited_date: v.visitedDate || null,
      status: v.status || 'new',
      assigned_to: v.assignedTo || null
    }));

    const { error: visErr } = await supabase.from('visitor_connections').upsert(visitorRows);
    if (visErr) summary.errors.push(`Visitors error: ${visErr.message}`);
    else summary.visitorsCount = visitorRows.length;

  } catch (err: any) {
    summary.errors.push(`Unexpected error during seeding: ${err?.message || err}`);
  }

  return summary;
}
