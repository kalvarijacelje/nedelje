/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { supabase } from '../supabaseClient';
import { 
  ServiceSunday, 
  Person, 
  Ministry, 
  MinistryAssignment, 
  BlackoutDate, 
  ShiftSwapRequest, 
  WorshipRosterEntry, 
  SundaySchoolLesson, 
  SundaySchoolSupply, 
  VisitorConnection 
} from '../types';

const envUrl = 
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SUPABASE_URL) ||
  (typeof process !== 'undefined' && process.env?.VITE_SUPABASE_URL) ||
  'https://ptdvcobgplmngnhkjqag.supabase.co';

const envKey = 
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SUPABASE_ANON_KEY) ||
  (typeof process !== 'undefined' && process.env?.VITE_SUPABASE_ANON_KEY) ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB0ZHZjb2JncGxtbmduaGtqcWFnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc0MTIwNzcsImV4cCI6MjEwMjk4ODA3N30.i9-UFVwAavIuDZO51YEkL0-yt6Rzmg6ZkMGqkRl_JMo';

export const IS_SUPABASE_CONFIGURED = Boolean(
  envUrl && 
  envKey &&
  !envUrl.includes('placeholder')
);

// ==============================================================================
// 1. SUNDAYS & ASSIGNMENTS SERVICE (nedelje_services, nedelje_assignments)
// ==============================================================================

export async function fetchSundaysFromSupabase(): Promise<ServiceSunday[]> {
  if (!IS_SUPABASE_CONFIGURED) return [];
  try {
    const { data: sundaysData, error: sundaysErr } = await supabase
      .from('nedelje_services')
      .select('*')
      .order('date', { ascending: true });

    if (sundaysErr) {
      console.warn('[Supabase] fetchSundays notice:', sundaysErr.message);
      return [];
    }

    if (!sundaysData || sundaysData.length === 0) return [];

    const { data: assignmentsData, error: assignErr } = await supabase
      .from('nedelje_assignments')
      .select('*');

    if (assignErr) {
      console.warn('[Supabase] fetchAssignments notice:', assignErr.message);
    }

    // Map relational rows into the standard ServiceSunday object format
    return (sundaysData || []).map((row: any) => {
      const sundayAssignments: Record<string, string[]> = {};
      const assignmentDetails: Record<string, MinistryAssignment[]> = {};

      const relatedAssignments = (assignmentsData || []).filter((a: any) => a.sunday_id === row.id);

      relatedAssignments.forEach((a: any) => {
        const mId = a.ministry_id;
        if (!sundayAssignments[mId]) sundayAssignments[mId] = [];
        if (!assignmentDetails[mId]) assignmentDetails[mId] = [];

        if (a.status !== 'declined') {
          sundayAssignments[mId].push(a.person_name);
        }

        assignmentDetails[mId].push({
          personName: a.person_name,
          status: a.status,
          notes: a.notes || undefined,
          declineReason: a.decline_reason || undefined,
          assignedByLeaderId: a.assigned_by_id || undefined,
          assignedByLeaderName: a.assigned_by_name || undefined,
          assignedAt: a.assigned_at || undefined,
          confirmationToken: a.confirmation_token || undefined,
          responseAt: a.response_at || undefined
        });
      });

      return {
        id: row.id,
        date: row.date,
        themeSl: row.theme_sl || '',
        themeEn: row.theme_en || '',
        status: row.status || 'draft',
        guest: row.guest || '',
        absentOrNotes: row.absent_or_notes || '',
        specialFocus: row.special_focus || undefined,
        worshipSetlist: row.worship_setlist || undefined,
        assignments: sundayAssignments,
        assignmentDetails: assignmentDetails
      };
    });
  } catch (err) {
    console.warn('[Supabase] Error in fetchSundaysFromSupabase:', err);
    return [];
  }
}

export async function upsertSundayToSupabase(sunday: ServiceSunday): Promise<boolean> {
  if (!IS_SUPABASE_CONFIGURED) return false;
  try {
    const { error: sundayErr } = await supabase
      .from('nedelje_services')
      .upsert({
        id: sunday.id,
        date: sunday.date,
        theme_sl: sunday.themeSl || '',
        theme_en: sunday.themeEn || '',
        status: sunday.status || 'draft',
        guest: sunday.guest || '',
        absent_or_notes: sunday.absentOrNotes || '',
        special_focus: sunday.specialFocus || null,
        worship_setlist: sunday.worshipSetlist || [],
        updated_at: new Date().toISOString()
      });

    if (sundayErr) {
      console.warn('[Supabase] upsertSunday error:', sundayErr.message);
      return false;
    }

    // Synchronize assignment details
    if (sunday.assignmentDetails) {
      const assignmentRows: any[] = [];

      Object.entries(sunday.assignmentDetails).forEach(([ministryId, details]) => {
        if (Array.isArray(details)) {
          details.forEach((d) => {
            assignmentRows.push({
              sunday_id: sunday.id,
              ministry_id: ministryId,
              person_name: d.personName,
              status: d.status || 'pending',
              notes: d.notes || null,
              decline_reason: d.declineReason || null,
              assigned_by_id: d.assignedByLeaderId || null,
              assigned_by_name: d.assignedByLeaderName || null,
              confirmation_token: d.confirmationToken || null,
              assigned_at: d.assignedAt || new Date().toISOString(),
              response_at: d.responseAt || null
            });
          });
        }
      });

      // Clear existing assignments for this sunday and re-insert
      await supabase.from('nedelje_assignments').delete().eq('sunday_id', sunday.id);
      if (assignmentRows.length > 0) {
        await supabase.from('nedelje_assignments').insert(assignmentRows);
      }
    }

    return true;
  } catch (err) {
    console.warn('[Supabase] upsertSundayToSupabase error:', err);
    return false;
  }
}

// Token-based Confirmation & Lookup for /potrdi
export async function fetchAssignmentByToken(token: string): Promise<{
  sunday: ServiceSunday;
  ministryId: string;
  assignment: MinistryAssignment;
} | null> {
  if (!IS_SUPABASE_CONFIGURED || !token) return null;
  const cleanToken = token.trim();

  try {
    const { data: assignmentRow, error: assignErr } = await supabase
      .from('nedelje_assignments')
      .select('*')
      .eq('confirmation_token', cleanToken)
      .maybeSingle();

    if (assignErr || !assignmentRow) {
      return null;
    }

    // Fetch the corresponding service row
    const { data: serviceRow } = await supabase
      .from('nedelje_services')
      .select('*')
      .eq('id', assignmentRow.sunday_id)
      .maybeSingle();

    // Fetch all assignments for this sunday to build a complete ServiceSunday
    const { data: allAssignments } = await supabase
      .from('nedelje_assignments')
      .select('*')
      .eq('sunday_id', assignmentRow.sunday_id);

    const sundayAssignments: Record<string, string[]> = {};
    const assignmentDetails: Record<string, MinistryAssignment[]> = {};

    (allAssignments || [assignmentRow]).forEach((a: any) => {
      const mId = a.ministry_id;
      if (!sundayAssignments[mId]) sundayAssignments[mId] = [];
      if (!assignmentDetails[mId]) assignmentDetails[mId] = [];

      if (a.status !== 'declined') {
        sundayAssignments[mId].push(a.person_name);
      }

      assignmentDetails[mId].push({
        personName: a.person_name,
        status: a.status,
        notes: a.notes || undefined,
        declineReason: a.decline_reason || undefined,
        assignedByLeaderId: a.assigned_by_id || undefined,
        assignedByLeaderName: a.assigned_by_name || undefined,
        assignedAt: a.assigned_at || undefined,
        confirmationToken: a.confirmation_token || undefined,
        responseAt: a.response_at || undefined
      });
    });

    const targetAssignment: MinistryAssignment = {
      personName: assignmentRow.person_name,
      status: assignmentRow.status,
      notes: assignmentRow.notes || undefined,
      declineReason: assignmentRow.decline_reason || undefined,
      assignedByLeaderId: assignmentRow.assigned_by_id || undefined,
      assignedByLeaderName: assignmentRow.assigned_by_name || undefined,
      assignedAt: assignmentRow.assigned_at || undefined,
      confirmationToken: assignmentRow.confirmation_token || undefined,
      responseAt: assignmentRow.response_at || undefined
    };

    const constructedSunday: ServiceSunday = {
      id: assignmentRow.sunday_id,
      date: serviceRow?.date || assignmentRow.sunday_id.replace(/^s-/, ''),
      themeSl: serviceRow?.theme_sl || '',
      themeEn: serviceRow?.theme_en || '',
      status: serviceRow?.status || 'draft',
      guest: serviceRow?.guest || '',
      absentOrNotes: serviceRow?.absent_or_notes || '',
      specialFocus: serviceRow?.special_focus || undefined,
      worshipSetlist: serviceRow?.worship_setlist || undefined,
      assignments: sundayAssignments,
      assignmentDetails: assignmentDetails
    };

    return {
      sunday: constructedSunday,
      ministryId: assignmentRow.ministry_id,
      assignment: targetAssignment
    };
  } catch (err) {
    console.warn('[Supabase] fetchAssignmentByToken error:', err);
    return null;
  }
}

export async function confirmAssignmentByToken(
  token: string,
  newStatus: 'confirmed' | 'declined',
  declineReason?: string,
  notes?: string
): Promise<{ success: boolean; assignment?: any; error?: string }> {
  if (!IS_SUPABASE_CONFIGURED || !token) {
    return { success: false, error: 'Supabase client not configured or token missing' };
  }

  try {
    const { data: matched, error: findErr } = await supabase
      .from('nedelje_assignments')
      .select('*')
      .eq('confirmation_token', token.trim())
      .maybeSingle();

    if (findErr || !matched) {
      return { success: false, error: 'Invalid or expired confirmation token' };
    }

    const { data: updated, error: updateErr } = await supabase
      .from('nedelje_assignments')
      .update({
        status: newStatus,
        decline_reason: declineReason || null,
        notes: notes || matched.notes,
        response_at: new Date().toISOString()
      })
      .eq('confirmation_token', token.trim())
      .select()
      .single();

    if (updateErr) {
      return { success: false, error: updateErr.message };
    }

    return { success: true, assignment: updated };
  } catch (e: any) {
    return { success: false, error: e.message || String(e) };
  }
}

// ==============================================================================
// 2. PEOPLE & PROFILES SERVICE (public.profiles)
// ==============================================================================

export async function fetchPeopleFromSupabase(): Promise<Person[]> {
  if (!IS_SUPABASE_CONFIGURED) return [];
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .order('full_name', { ascending: true });

    if (error) {
      console.warn('[Supabase] fetchPeople notice:', error.message);
      return [];
    }

    const rows = data || [];
    return rows
      .filter((row: any) => row && (row.full_name || row.name))
      .map((row: any) => ({
        id: row.id,
        name: (row.full_name || row.name || '').trim(),
        email: row.email ? row.email.trim() : undefined,
        phone: row.phone ? row.phone.trim() : undefined,
        avatarUrl: row.avatar_url || undefined,
        role: normalizeUserRole(row.role),
        memberType: row.member_type || (row.role === 'minor' ? 'minor' : (row.role === 'visitor' ? 'visitor' : (row.role === 'member' || row.role === 'viewer' ? 'member' : 'adult'))),
        birthDate: row.birth_date || undefined,
        isVisitor: row.role === 'visitor' || row.member_type === 'visitor',
        preferredMinistries: Array.isArray(row.preferred_ministries) ? row.preferred_ministries : [],
        ledMinistries: Array.isArray(row.led_ministries) ? row.led_ministries : (Array.isArray(row.ledMinistries) ? row.ledMinistries : []),
        familyMembers: Array.isArray(row.family_members) ? row.family_members : [],
        isExemptFromBurnout: Boolean(row.is_exempt_from_burnout),
        isPastorOrStaff: Boolean(row.is_exempt_from_burnout),
        isArchived: Boolean(row.is_archived || row.active === false),
        auth_user_id: row.auth_user_id || undefined
      }));
  } catch (err) {
    console.warn('[Supabase] Error in fetchPeopleFromSupabase:', err);
    return [];
  }
}

export function toCanonicalPersonId(idOrName: string): string {
  if (!idOrName) return 'p-unknown';
  let str = idOrName.trim();
  if (str.startsWith('p-')) {
    str = str.substring(2);
  }
  // Transliterate Slovenian characters to standard latin
  str = str
    .replace(/[čČ]/g, 'c')
    .replace(/[šŠ]/g, 's')
    .replace(/[žŽ]/g, 'z')
    .replace(/[ćĆ]/g, 'c')
    .replace(/[đĐ]/g, 'd');
  const clean = str.toLowerCase().replace(/[^a-z0-9]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '');
  return `p-${clean}`;
}

export async function upsertPersonToSupabase(person: Person): Promise<boolean> {
  if (!IS_SUPABASE_CONFIGURED) return false;
  try {
    const canonicalId = toCanonicalPersonId(person.id || person.name);
    const emailToMatch = (person.email || '').trim().toLowerCase();
    const nameToMatch = person.name.trim();

    const cleanMemberType = (person.memberType === 'minor' || person.role === 'Minor') 
      ? 'minor' 
      : (person.memberType === 'visitor' || person.role === 'Visitor') 
      ? 'visitor' 
      : (person.memberType === 'member' || person.role === 'Viewer') 
      ? 'member' 
      : 'adult';
    const cleanRole = (person.role === 'Admin' || emailToMatch === 'ales.lajlar@gmail.com') 
      ? 'superadmin' 
      : (person.role === 'Leader' ? 'leader' : (person.role === 'Servant' ? 'servant' : (person.role === 'Visitor' ? 'visitor' : (person.role === 'Minor' ? 'minor' : 'member'))));

    // Check avatar size - if giant base64 (> 80KB), avoid sending in standard update to prevent payload timeouts
    const isBase64Avatar = person.avatarUrl && person.avatarUrl.startsWith('data:image');
    const safeAvatarUrl = (isBase64Avatar && person.avatarUrl!.length > 80000) ? undefined : (person.avatarUrl || null);

    const payload: any = {
      full_name: person.name,
      email: person.email || null,
      phone: person.phone || null,
      role: cleanRole,
      member_type: cleanMemberType,
      birth_date: person.birthDate || null,
      preferred_ministries: person.preferredMinistries || [],
      led_ministries: person.ledMinistries || [],
      family_members: person.familyMembers || [],
      is_exempt_from_burnout: Boolean(person.isExemptFromBurnout || person.isPastorOrStaff),
      updated_at: new Date().toISOString()
    };

    if (safeAvatarUrl !== undefined) {
      payload.avatar_url = safeAvatarUrl;
    }

    // 1. Try updating directly by canonical ID
    let { error: updErr, count } = await supabase
      .from('profiles')
      .update(payload, { count: 'exact' })
      .eq('id', canonicalId);

    // 2. If ID didn't update any row, update directly by email (handles auth UUIDs & email matches)
    if ((!count || count === 0) && emailToMatch) {
      const byEmailRes = await supabase
        .from('profiles')
        .update(payload, { count: 'exact' })
        .ilike('email', emailToMatch);
      count = byEmailRes.count;
      updErr = byEmailRes.error;
    }

    // 3. If still 0 rows, update by full_name
    if ((!count || count === 0) && nameToMatch) {
      const byNameRes = await supabase
        .from('profiles')
        .update(payload, { count: 'exact' })
        .ilike('full_name', nameToMatch);
      count = byNameRes.count;
      updErr = byNameRes.error;
    }

    if (!updErr && count && count > 0) {
      console.log(`[Supabase] Successfully updated profile for ${person.name} (${count} row(s) updated)`);
      return true;
    }

    // 4. If no existing row matched, upsert
    const { error: upsertErr } = await supabase
      .from('profiles')
      .upsert({ id: canonicalId, ...payload }, { onConflict: 'id' });

    if (!upsertErr) {
      console.log(`[Supabase] Successfully upserted profile for ${person.name}`);
      return true;
    }

    console.error('[Supabase] Profile save notice:', updErr?.message || upsertErr?.message);
    return false;
  } catch (err) {
    console.error('[Supabase] Error in upsertPersonToSupabase:', err);
    return false;
  }
}

export async function deletePersonFromSupabase(personId: string): Promise<boolean> {
  if (!IS_SUPABASE_CONFIGURED || !personId) return false;
  try {
    const { error } = await supabase
      .from('profiles')
      .delete()
      .eq('id', personId);
    return !error;
  } catch {
    return false;
  }
}

// ==============================================================================
// 3. BLACKOUT DATES / VACATIONS SERVICE (nedelje_blackout_dates)
// ==============================================================================

export async function fetchBlackoutsFromSupabase(): Promise<BlackoutDate[]> {
  if (!IS_SUPABASE_CONFIGURED) return [];
  try {
    const { data, error } = await supabase
      .from('nedelje_blackout_dates')
      .select('*')
      .order('start_date', { ascending: true });

    if (error) return [];
    return (data || []).map((row: any) => ({
      id: row.id,
      personName: row.person_name,
      personId: row.person_id || undefined,
      startDate: row.start_date,
      endDate: row.end_date,
      reason: row.reason || undefined,
      createdAt: row.created_at
    }));
  } catch {
    return [];
  }
}

export async function insertBlackoutToSupabase(b: Omit<BlackoutDate, 'id' | 'createdAt'>): Promise<boolean> {
  if (!IS_SUPABASE_CONFIGURED) return false;
  try {
    const { error } = await supabase
      .from('nedelje_blackout_dates')
      .insert({
        person_name: b.personName,
        person_id: b.personId || null,
        start_date: b.startDate,
        end_date: b.endDate || b.startDate,
        reason: b.reason || null
      });
    return !error;
  } catch {
    return false;
  }
}

export async function deleteBlackoutFromSupabase(id: string): Promise<boolean> {
  if (!IS_SUPABASE_CONFIGURED || !id) return false;
  try {
    const { error } = await supabase
      .from('nedelje_blackout_dates')
      .delete()
      .eq('id', id);
    return !error;
  } catch {
    return false;
  }
}

// ==============================================================================
// 4. SHIFT SWAPS SERVICE (nedelje_shift_swaps)
// ==============================================================================

export async function fetchShiftSwapsFromSupabase(): Promise<ShiftSwapRequest[]> {
  if (!IS_SUPABASE_CONFIGURED) return [];
  try {
    const { data, error } = await supabase
      .from('nedelje_shift_swaps')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) return [];
    return (data || []).map((row: any) => ({
      id: row.id,
      sundayId: row.sunday_id,
      sundayDate: row.sunday_date,
      ministryId: row.ministry_id,
      ministryName: row.ministry_name,
      requesterName: row.requester_name,
      reason: row.reason || '',
      status: row.status || 'open',
      acceptedByName: row.accepted_by_name || undefined,
      createdAt: row.created_at
    }));
  } catch {
    return [];
  }
}

export async function upsertShiftSwapToSupabase(swap: ShiftSwapRequest): Promise<boolean> {
  if (!IS_SUPABASE_CONFIGURED) return false;
  try {
    const { error } = await supabase
      .from('nedelje_shift_swaps')
      .upsert({
        id: swap.id.startsWith('swap-') ? undefined : swap.id,
        sunday_id: swap.sundayId,
        sunday_date: swap.sundayDate,
        ministry_id: swap.ministryId,
        ministry_name: swap.ministryName,
        requester_name: swap.requesterName,
        reason: swap.reason || null,
        status: swap.status,
        accepted_by_name: swap.acceptedByName || null,
        updated_at: new Date().toISOString()
      });
    return !error;
  } catch {
    return false;
  }
}

// ==============================================================================
// 5. WORSHIP SCHEDULES, LESSONS, VISITORS, INSPECTIONS
// ==============================================================================

export async function fetchWorshipSchedulesFromSupabase(): Promise<WorshipRosterEntry[]> {
  if (!IS_SUPABASE_CONFIGURED) return [];
  try {
    const { data, error } = await supabase
      .from('nedelje_worship_schedules')
      .select('*');

    if (error) return [];
    return (data || []).map((w: any) => ({
      id: w.id,
      date: w.date,
      leader: w.worship_leader || w.leader || '',
      acoustic: w.acoustic || '',
      drums: w.drums || '',
      bass: w.bass || '',
      keys: w.keys || '',
      vocals: Array.isArray(w.vocalists) ? w.vocalists.join(', ') : (w.vocals || ''),
      sound: w.sound || '',
      slides: w.slides || '',
      vocalTechAbsent: w.vocal_tech_absent || '',
      monitors: w.monitors || '',
      sundaySchool: w.sunday_school || ''
    }));
  } catch {
    return [];
  }
}

export async function fetchSundaySchoolLessonsFromSupabase(): Promise<SundaySchoolLesson[]> {
  if (!IS_SUPABASE_CONFIGURED) return [];
  try {
    const { data, error } = await supabase
      .from('nedelje_school_lessons')
      .select('*');

    if (error) return [];
    return data || [];
  } catch {
    return [];
  }
}

export async function fetchVisitorsFromSupabase(): Promise<VisitorConnection[]> {
  if (!IS_SUPABASE_CONFIGURED) return [];
  try {
    const { data, error } = await supabase
      .from('nedelje_visitors')
      .select('*');

    if (error) return [];
    return data || [];
  } catch {
    return [];
  }
}

// ==============================================================================
// 6. REALTIME SUBSCRIPTIONS HELPER (public:nedelje_*, public:profiles)
// ==============================================================================

export function subscribeToSupabaseRealtime(
  onSundayChange: () => void,
  onPeopleChange: () => void,
  onBlackoutChange?: () => void,
  onSwapChange?: () => void
): () => void {
  if (!IS_SUPABASE_CONFIGURED) return () => {};

  const channel = supabase
    .channel('kck-app-realtime')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'nedelje_services' }, onSundayChange)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'nedelje_assignments' }, onSundayChange)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, onPeopleChange)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'nedelje_blackout_dates' }, () => onBlackoutChange?.())
    .on('postgres_changes', { event: '*', schema: 'public', table: 'nedelje_shift_swaps' }, () => onSwapChange?.())
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}
