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

export const IS_SUPABASE_CONFIGURED = Boolean(
  import.meta.env.VITE_SUPABASE_URL && 
  import.meta.env.VITE_SUPABASE_ANON_KEY &&
  !import.meta.env.VITE_SUPABASE_URL.includes('placeholder')
);

// ==============================================================================
// 1. SUNDAYS & ASSIGNMENTS SERVICE
// ==============================================================================

export async function fetchSundaysFromSupabase(): Promise<ServiceSunday[]> {
  if (!IS_SUPABASE_CONFIGURED) return [];
  try {
    const { data: sundaysData, error: sundaysErr } = await supabase
      .from('service_sundays')
      .select('*')
      .order('date', { ascending: true });

    if (sundaysErr) {
      console.warn('[Supabase] fetchSundays notice:', sundaysErr.message);
      return [];
    }

    if (!sundaysData || sundaysData.length === 0) return [];

    const { data: assignmentsData, error: assignErr } = await supabase
      .from('sunday_assignments')
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
      .from('service_sundays')
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
      await supabase.from('sunday_assignments').delete().eq('sunday_id', sunday.id);
      if (assignmentRows.length > 0) {
        await supabase.from('sunday_assignments').insert(assignmentRows);
      }
    }

    return true;
  } catch (err) {
    console.warn('[Supabase] upsertSundayToSupabase error:', err);
    return false;
  }
}

// Token-based Confirmation for /potrdi
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
      .from('sunday_assignments')
      .select('*')
      .eq('confirmation_token', token)
      .single();

    if (findErr || !matched) {
      return { success: false, error: 'Invalid or expired confirmation token' };
    }

    const { data: updated, error: updateErr } = await supabase
      .from('sunday_assignments')
      .update({
        status: newStatus,
        decline_reason: declineReason || null,
        notes: notes || matched.notes,
        response_at: new Date().toISOString()
      })
      .eq('confirmation_token', token)
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
// 2. PEOPLE & PROFILES SERVICE
// ==============================================================================

export async function fetchPeopleFromSupabase(): Promise<Person[]> {
  if (!IS_SUPABASE_CONFIGURED) return [];
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .order('name', { ascending: true });

    if (error) {
      console.warn('[Supabase] fetchPeople notice:', error.message);
      return [];
    }

    return (data || []).map((row: any) => ({
      id: row.id,
      name: row.name,
      email: row.email || undefined,
      phone: row.phone || undefined,
      role: row.role || 'Viewer',
      preferredMinistries: row.preferred_ministries || [],
      familyMembers: row.family_members || [],
      isExemptFromBurnout: Boolean(row.is_exempt_from_burnout)
    }));
  } catch (err) {
    console.warn('[Supabase] Error in fetchPeopleFromSupabase:', err);
    return [];
  }
}

export async function upsertPersonToSupabase(person: Person): Promise<boolean> {
  if (!IS_SUPABASE_CONFIGURED) return false;
  try {
    const cleanId = person.id || ('p-' + person.name.toLowerCase().trim().replace(/[^a-z0-9]/g, '_'));
    const { error } = await supabase
      .from('profiles')
      .upsert({
        id: cleanId,
        name: person.name,
        email: person.email || null,
        phone: person.phone || null,
        role: person.role || 'Viewer',
        preferred_ministries: person.preferredMinistries || [],
        family_members: person.familyMembers || [],
        is_exempt_from_burnout: Boolean(person.isExemptFromBurnout),
        updated_at: new Date().toISOString()
      });

    if (error) {
      console.warn('[Supabase] upsertPerson error:', error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.warn('[Supabase] Error in upsertPersonToSupabase:', err);
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
// 3. BLACKOUT DATES / VACATIONS SERVICE
// ==============================================================================

export async function fetchBlackoutsFromSupabase(): Promise<BlackoutDate[]> {
  if (!IS_SUPABASE_CONFIGURED) return [];
  try {
    const { data, error } = await supabase
      .from('blackout_dates')
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
      .from('blackout_dates')
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
      .from('blackout_dates')
      .delete()
      .eq('id', id);
    return !error;
  } catch {
    return false;
  }
}

// ==============================================================================
// 4. SHIFT SWAPS SERVICE
// ==============================================================================

export async function fetchShiftSwapsFromSupabase(): Promise<ShiftSwapRequest[]> {
  if (!IS_SUPABASE_CONFIGURED) return [];
  try {
    const { data, error } = await supabase
      .from('shift_swaps')
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
      .from('shift_swaps')
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
// 5. REALTIME SUBSCRIPTIONS HELPER
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
    .on('postgres_changes', { event: '*', schema: 'public', table: 'service_sundays' }, onSundayChange)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'sunday_assignments' }, onSundayChange)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, onPeopleChange)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'blackout_dates' }, () => onBlackoutChange?.())
    .on('postgres_changes', { event: '*', schema: 'public', table: 'shift_swaps' }, () => onSwapChange?.())
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}
