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
  VisitorConnection,
  User,
  normalizeUserRole,
  toCanonicalMinistryId
} from '../types';
import { getAutoSundayStatus } from '../utils/academicYear';
import { unpackWorshipCompoundString } from '../utils/worshipSync';
import { parseEuropeanDate } from '../utils/dateUtils';

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
      .select('id, date, theme_sl, theme_en, status, guest, absent_or_notes, special_focus, worship_setlist')
      .limit(1000);

    if (sundaysErr) {
      console.warn('[Supabase] fetchSundays notice:', sundaysErr.message);
      return [];
    }

    if (!sundaysData || sundaysData.length === 0) return [];

    const { data: assignmentsData, error: assignErr } = await supabase
      .from('nedelje_assignments')
      .select('id, sunday_id, ministry_id, person_name, status, notes, decline_reason, assigned_by_id, assigned_by_name, assigned_at, confirmation_token, response_at')
      .limit(10000);

    if (assignErr) {
      console.warn('[Supabase] fetchAssignments notice:', assignErr.message);
    }

    // Map relational rows into the standard ServiceSunday object format
    const mappedSundays = (sundaysData || []).map((row: any) => {
      const sundayAssignments: Record<string, string[]> = {};
      const assignmentDetails: Record<string, MinistryAssignment[]> = {};

      const cleanRowId = (row.id || '').replace(/_/g, '-');
      const relatedAssignments = (assignmentsData || []).filter((a: any) => {
        if (!a || !a.sunday_id) return false;
        if (a.sunday_id === row.id) return true;
        if (a.sunday_id.replace(/_/g, '-') === cleanRowId) return true;
        return false;
      });

      relatedAssignments.forEach((a: any) => {
        const mId = toCanonicalMinistryId(a.ministry_id);
        if (!sundayAssignments[mId]) sundayAssignments[mId] = [];
        if (!assignmentDetails[mId]) assignmentDetails[mId] = [];

        if (a.status !== 'declined') {
          if (!sundayAssignments[mId].includes(a.person_name)) {
            sundayAssignments[mId].push(a.person_name);
          }
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

    return mappedSundays.sort((a, b) => {
      return parseEuropeanDate(a.date).getTime() - parseEuropeanDate(b.date).getTime();
    });
  } catch (err) {
    console.warn('[Supabase] Error in fetchSundaysFromSupabase:', err);
    return [];
  }
}

export async function upsertSundayToSupabase(sunday: ServiceSunday): Promise<boolean> {
  if (!IS_SUPABASE_CONFIGURED) return false;
  try {
    const autoStatus = getAutoSundayStatus(sunday.date);

    const { error: sundayErr } = await supabase
      .from('nedelje_services')
      .upsert({
        id: sunday.id,
        date: sunday.date,
        service_date: sunday.date,
        theme_sl: sunday.themeSl || '',
        theme_en: sunday.themeEn || '',
        status: autoStatus,
        guest: sunday.guest || '',
        absent_or_notes: sunday.absentOrNotes || '',
        special_focus: sunday.specialFocus || { type: 'none' },
        worship_setlist: sunday.worshipSetlist || [],
        updated_at: new Date().toISOString()
      }, { onConflict: 'id' });

    if (sundayErr) {
      console.warn('[Supabase] upsertSunday error:', sundayErr.message);
      return false;
    }

    const resolvePersonId = (name: string): string | null => {
      if (!name) return null;
      const clean = name.toLowerCase().trim();
      try {
        const raw = typeof localStorage !== 'undefined' ? localStorage.getItem('church_roster_people_v2') : null;
        if (raw) {
          const parsed: Person[] = JSON.parse(raw);
          const found = parsed.find(p => p && p.name && p.name.toLowerCase().trim() === clean);
          if (found?.id) return found.id;
        }
      } catch {}
      return 'p-' + clean.replace(/[^a-z0-9]/g, '_');
    };

    // Synchronize assignment details reliably (reconcile assignmentDetails + assignments)
    const assignmentRows: any[] = [];
    const processedPersonMinistryKeys = new Set<string>();

    const ensureToken = (existingToken?: string | null, sundayId?: string, ministryId?: string, personName?: string): string => {
      if (existingToken && existingToken.trim()) return existingToken.trim();
      if (sundayId && ministryId && personName) {
        const slug = `${sundayId}_${ministryId}_${personName}`.toLowerCase().replace(/[^a-z0-9]/g, '_');
        return `tok_${slug}_${Math.random().toString(36).substring(2, 8)}`;
      }
      if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        return crypto.randomUUID().replace(/-/g, '') + Math.random().toString(36).substring(2, 10);
      }
      return 'tok_' + Date.now().toString(36) + Math.random().toString(36).substring(2, 12);
    };

    // 1. Reconcile from assignmentDetails if present
    if (sunday.assignmentDetails) {
      Object.entries(sunday.assignmentDetails).forEach(([rawMinistryId, details]) => {
        const ministryId = toCanonicalMinistryId(rawMinistryId);
        if (Array.isArray(details)) {
          details.forEach((d) => {
            if (!d.personName) return;

            const isWorship = ministryId === 'slavilna_ekipa' || ministryId === 'slavilna';
            const unpacked = isWorship 
              ? unpackWorshipCompoundString(d.personName) 
              : [{ name: d.personName, roleOrInstrument: d.notes || '' }];

            unpacked.forEach(({ name: realName, roleOrInstrument }) => {
              if (!realName || realName === '/' || realName === '-') return;
              const key = `${ministryId}_${realName.toLowerCase().trim()}`;
              if (processedPersonMinistryKeys.has(key)) return;
              processedPersonMinistryKeys.add(key);

              const token = ensureToken(d.confirmationToken, sunday.id, ministryId, realName);
              d.confirmationToken = token;

              const cleanSlug = toCanonicalPersonId(realName).replace(/^p-/, '');
              const rowId = `${sunday.id}_${ministryId}_${cleanSlug}`;
              const personId = resolvePersonId(realName);

              assignmentRows.push({
                id: rowId,
                sunday_id: sunday.id,
                ministry_id: ministryId,
                person_name: realName.trim(),
                person_id: personId,
                status: d.status || 'pending',
                notes: roleOrInstrument || d.notes || null,
                decline_reason: d.declineReason || null,
                assigned_by_id: d.assignedByLeaderId || null,
                assigned_by_name: d.assignedByLeaderName || null,
                confirmation_token: token,
                assigned_at: d.assignedAt || new Date().toISOString(),
                response_at: d.responseAt || null
              });
            });
          });
        }
      });
    }

    // 2. Also ensure any person in sunday.assignments has an assignment row
    if (sunday.assignments) {
      Object.entries(sunday.assignments).forEach(([rawMinistryId, names]) => {
        const ministryId = toCanonicalMinistryId(rawMinistryId);
        if (Array.isArray(names)) {
          names.forEach(rawName => {
            if (!rawName || typeof rawName !== 'string') return;

            const isWorship = ministryId === 'slavilna_ekipa' || ministryId === 'slavilna';
            const unpacked = isWorship 
              ? unpackWorshipCompoundString(rawName) 
              : [{ name: rawName, roleOrInstrument: '' }];

            unpacked.forEach(({ name: realName, roleOrInstrument }) => {
              if (!realName || realName === '/' || realName === '-') return;
              const key = `${ministryId}_${realName.toLowerCase().trim()}`;
              if (!processedPersonMinistryKeys.has(key)) {
                processedPersonMinistryKeys.add(key);
                const token = ensureToken(undefined, sunday.id, ministryId, realName);
                const cleanSlug = toCanonicalPersonId(realName).replace(/^p-/, '');
                const rowId = `${sunday.id}_${ministryId}_${cleanSlug}`;
                const personId = resolvePersonId(realName);

                assignmentRows.push({
                  id: rowId,
                  sunday_id: sunday.id,
                  ministry_id: ministryId,
                  person_name: realName.trim(),
                  person_id: personId,
                  status: 'confirmed',
                  notes: roleOrInstrument || null,
                  decline_reason: null,
                  assigned_by_id: null,
                  assigned_by_name: 'Vodja slavljenja',
                  confirmation_token: token,
                  assigned_at: new Date().toISOString(),
                  response_at: null
                });
              }
            });
          });
        }
      });
    }

    // Upsert all active assignments for this sunday
    if (assignmentRows.length > 0) {
      const { error: upsertErr } = await supabase.from('nedelje_assignments').upsert(assignmentRows, { onConflict: 'id' });
      if (upsertErr) {
        console.warn('[Supabase] upsert assignments error:', upsertErr.message);
      }

      // Safely delete only assignments that were removed from this specific Sunday
      const activeIds = assignmentRows.map(r => r.id);
      if (activeIds.length > 0) {
        const idListStr = `(${activeIds.map(id => `"${id}"`).join(',')})`;
        await supabase
          .from('nedelje_assignments')
          .delete()
          .eq('sunday_id', sunday.id)
          .not('id', 'in', idListStr);
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
      .select('id, sunday_id, ministry_id, person_name, status, notes, decline_reason, assigned_by_id, assigned_by_name, assigned_at, confirmation_token, response_at')
      .eq('confirmation_token', cleanToken)
      .maybeSingle();

    if (assignErr || !assignmentRow) {
      return null;
    }

    // Fetch the corresponding service row
    const { data: serviceRow } = await supabase
      .from('nedelje_services')
      .select('id, date, theme_sl, theme_en, status, guest, absent_or_notes, special_focus, worship_setlist')
      .eq('id', assignmentRow.sunday_id)
      .maybeSingle();

    // Fetch all assignments for this sunday to build a complete ServiceSunday
    const { data: allAssignments } = await supabase
      .from('nedelje_assignments')
      .select('id, sunday_id, ministry_id, person_name, status, notes, decline_reason, assigned_by_id, assigned_by_name, assigned_at, confirmation_token, response_at')
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

  const cleanToken = token.trim();

  try {
    const { data: matched, error: findErr } = await supabase
      .from('nedelje_assignments')
      .select('id, notes')
      .eq('confirmation_token', cleanToken)
      .maybeSingle();

    if (findErr) {
      console.warn('[Supabase] confirmAssignmentByToken findErr:', findErr);
    }

    if (matched) {
      const { data: updated, error: updateErr } = await supabase
        .from('nedelje_assignments')
        .update({
          status: newStatus,
          decline_reason: newStatus === 'declined' ? (declineReason || null) : null,
          notes: notes || matched.notes,
          response_at: new Date().toISOString()
        })
        .eq('id', matched.id)
        .select('id, sunday_id, ministry_id, person_name, status, notes, decline_reason, response_at')
        .single();

      if (updateErr) {
        console.warn('[Supabase] confirmAssignmentByToken updateErr:', updateErr);
        return { success: false, error: updateErr.message };
      }

      return { success: true, assignment: updated };
    }

    return { success: false, error: 'Invalid or expired confirmation token' };
  } catch (e: any) {
    console.warn('[Supabase] confirmAssignmentByToken caught exception:', e);
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
      .select('id, full_name, name, email, phone, avatar_url, role, member_type, birth_date, preferred_ministries, led_ministries, family_members, is_exempt_from_burnout, is_archived, active, created_by_name, created_by, created_at, auth_user_id')
      .order('full_name', { ascending: true })
      .limit(300);

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
        createdBy: row.created_by_name || row.created_by || undefined,
        createdAt: row.created_at || undefined,
        auth_user_id: row.auth_user_id || undefined
      }));
  } catch (err) {
    console.warn('[Supabase] Error in fetchPeopleFromSupabase:', err);
    return [];
  }
}

export async function fetchRegisteredUsersFromSupabase(): Promise<User[]> {
  if (!IS_SUPABASE_CONFIGURED) return [];
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, auth_user_id, email, full_name, name, role, approval_status')
      .not('auth_user_id', 'is', null)
      .order('full_name', { ascending: true })
      .limit(100);

    if (error) {
      console.warn('[Supabase] fetchRegisteredUsers notice:', error.message);
      return [];
    }

    const rows = data || [];
    const usersMap = new Map<string, User>();

    const getRoleWeight = (r?: string | null): number => {
      const s = (r || '').toLowerCase().trim();
      if (s === 'superadmin' || s === 'admin') return 4;
      if (s === 'leader') return 3;
      if (s === 'servant' || s === 'volunteer') return 2;
      return 1;
    };

    // ONLY include people who have ACTUALLY logged in via Supabase Auth (have auth_user_id)
    rows
      .filter((row: any) => row && Boolean(row.auth_user_id))
      .forEach((row: any) => {
        const uid = row.auth_user_id;
        const email = (row.email || '').trim();
        const displayName = (row.full_name || row.name || email.split('@')[0] || 'Google User').trim();
        let role = normalizeUserRole(row.role);
        
        // Special check for designated leaders
        if (
          email.toLowerCase() === 'nina.cizic@gmail.com' ||
          email.toLowerCase() === 'dkolar@drustvovec.si' ||
          email.toLowerCase() === 'doroteja.kolar@gmail.com' ||
          displayName.toLowerCase().includes('nina čižič') ||
          displayName.toLowerCase().includes('doroteja kolar')
        ) {
          role = 'Leader';
        }

        const personName = (row.name || row.full_name || '').trim() || undefined;

        if (uid) {
          const existing = usersMap.get(uid);
          const finalRole = existing && getRoleWeight(existing.role) > getRoleWeight(role) ? existing.role : role;
          usersMap.set(uid, {
            uid,
            email: email || existing?.email || '',
            displayName: existing?.displayName || displayName,
            role: finalRole,
            personName: existing?.personName || personName,
            approval_status: row.approval_status || existing?.approval_status
          });
        }
      });

    return Array.from(usersMap.values());
  } catch (err) {
    console.warn('[Supabase] Error in fetchRegisteredUsersFromSupabase:', err);
    return [];
  }
}

export function toCanonicalPersonId(idOrName?: string | null): string {
  if (!idOrName || typeof idOrName !== 'string') return 'p-unknown';
  let str = idOrName.trim();
  if (str.startsWith('p-')) {
    str = str.substring(2);
  }
  // Strip trailing random hash / timestamp suffixes
  str = str.replace(/[-_][a-z0-9]{7,15}$/i, '');

  // Transliterate Slovenian & Balkan diacritics
  str = str
    .replace(/[čČ]/g, 'c')
    .replace(/[šŠ]/g, 's')
    .replace(/[žŽ]/g, 'z')
    .replace(/[ćĆ]/g, 'c')
    .replace(/[đĐ]/g, 'd');

  const clean = str
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');

  return `p-${clean || 'user'}`;
}

export async function upsertPersonToSupabase(person: Person): Promise<boolean> {
  if (!IS_SUPABASE_CONFIGURED) return false;
  try {
    const canonicalId = (person.name && (!person.id || person.id.startsWith('p-') || person.id.includes('_mu_i_') || /[-_][a-z0-9]{7,15}$/i.test(person.id)))
      ? toCanonicalPersonId(person.name)
      : toCanonicalPersonId(person.id || person.name);
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
      created_by_name: person.createdBy || undefined,
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
      .select('id, person_name, person_id, family_member_names, family_members, start_date, end_date, reason, created_at')
      .order('start_date', { ascending: true })
      .limit(100);

    if (error) return [];
    return (data || []).map((row: any) => ({
      id: row.id,
      personName: row.person_name,
      personId: row.person_id || undefined,
      familyMemberNames: row.family_member_names || (row.family_members ? (Array.isArray(row.family_members) ? row.family_members : undefined) : undefined),
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
    const payload: any = {
      person_name: b.personName,
      person_id: b.personId || null,
      start_date: b.startDate,
      end_date: b.endDate || b.startDate,
      reason: b.reason || null
    };
    if (b.familyMemberNames && b.familyMemberNames.length > 0) {
      payload.family_member_names = b.familyMemberNames;
    }
    const { error } = await supabase
      .from('nedelje_blackout_dates')
      .insert(payload);
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
      .select('id, sunday_id, sunday_date, ministry_id, ministry_name, requester_name, reason, status, accepted_by_name, created_at')
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) return [];
    return (data || []).map((row: any) => {
      let reason = row.reason || '';
      let targetPersonName: string | undefined = undefined;
      let targetPersonId: string | undefined = undefined;
      let targetPersonEmail: string | undefined = undefined;
      let confirmationToken: string | undefined = undefined;
      let swapType: 'direct' | 'open' = 'open';
      let requesterEmail: string | undefined = undefined;
      let declinedByName: string | undefined = undefined;
      let declineReason: string | undefined = undefined;

      if (typeof reason === 'string' && reason.startsWith('__SWAP_META__:')) {
        try {
          const meta = JSON.parse(reason.replace('__SWAP_META__:', ''));
          targetPersonName = meta.targetPersonName;
          targetPersonId = meta.targetPersonId;
          targetPersonEmail = meta.targetPersonEmail;
          confirmationToken = meta.confirmationToken;
          swapType = meta.swapType || (targetPersonName ? 'direct' : 'open');
          requesterEmail = meta.requesterEmail;
          declinedByName = meta.declinedByName;
          declineReason = meta.declineReason;
          reason = meta.cleanReason || '';
        } catch (e) {}
      }

      return {
        id: row.id,
        sundayId: row.sunday_id,
        sundayDate: row.sunday_date,
        ministryId: row.ministry_id,
        ministryName: row.ministry_name,
        requesterName: row.requester_name,
        requesterEmail,
        reason,
        status: row.status || 'open',
        swapType,
        targetPersonName,
        targetPersonId,
        targetPersonEmail,
        confirmationToken,
        acceptedByName: row.accepted_by_name || undefined,
        declinedByName,
        declineReason,
        createdAt: row.created_at
      };
    });
  } catch {
    return [];
  }
}

export async function upsertShiftSwapToSupabase(swap: ShiftSwapRequest): Promise<boolean> {
  if (!IS_SUPABASE_CONFIGURED) return false;
  try {
    const meta = {
      targetPersonName: swap.targetPersonName,
      targetPersonId: swap.targetPersonId,
      targetPersonEmail: swap.targetPersonEmail,
      confirmationToken: swap.confirmationToken,
      swapType: swap.swapType || (swap.targetPersonName ? 'direct' : 'open'),
      requesterEmail: swap.requesterEmail,
      declinedByName: swap.declinedByName,
      declineReason: swap.declineReason,
      cleanReason: swap.reason || '',
    };
    const storedReason = `__SWAP_META__:${JSON.stringify(meta)}`;

    const { error } = await supabase
      .from('nedelje_shift_swaps')
      .upsert({
        id: swap.id,
        sunday_id: swap.sundayId,
        sunday_date: swap.sundayDate,
        ministry_id: swap.ministryId,
        ministry_name: swap.ministryName,
        requester_name: swap.requesterName,
        reason: storedReason,
        status: swap.status,
        accepted_by_name: swap.acceptedByName || null,
        updated_at: new Date().toISOString()
      });

    // Also register the token into nedelje_assignments table for universal confirmation link resolution
    if (swap.confirmationToken && swap.targetPersonName) {
      const cleanSlug = toCanonicalPersonId(swap.targetPersonName).replace(/^p-/, '');
      const assignRowId = `${swap.sundayId}_${swap.ministryId}_swap_${cleanSlug}`;
      await supabase
        .from('nedelje_assignments')
        .upsert({
          id: assignRowId,
          sunday_id: swap.sundayId,
          ministry_id: swap.ministryId,
          person_name: swap.targetPersonName,
          person_id: swap.targetPersonId || null,
          status: swap.status === 'accepted' ? 'confirmed' : swap.status === 'declined' ? 'declined' : 'pending',
          notes: swap.reason || `Prošnja za zamenjavo s strani: ${swap.requesterName}`,
          decline_reason: swap.declineReason || null,
          assigned_by_name: swap.requesterName,
          confirmation_token: swap.confirmationToken,
          assigned_at: new Date().toISOString(),
          response_at: swap.status === 'accepted' || swap.status === 'declined' ? new Date().toISOString() : null
        });
    }

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
      .select('id, date, worship_leader, leader, acoustic, drums, bass, keys, vocalists, vocals, sound, slides, vocal_tech_absent, monitors, sunday_school')
      .limit(100);

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

export async function upsertWorshipScheduleToSupabase(entry: WorshipRosterEntry): Promise<boolean> {
  if (!IS_SUPABASE_CONFIGURED) return false;
  try {
    const { error } = await supabase
      .from('nedelje_worship_schedules')
      .upsert({
        id: entry.id,
        date: entry.date,
        worship_leader: entry.leader || null,
        acoustic: entry.acoustic || null,
        drums: entry.drums || null,
        bass: entry.bass || null,
        keys: entry.keys || null,
        vocals: entry.vocals || null,
        sound: entry.sound || null,
        slides: entry.slides || null,
        vocal_tech_absent: entry.vocalTechAbsent || null,
        monitors: entry.monitors || null,
        sunday_school: entry.sundaySchool || null,
        updated_at: new Date().toISOString()
      });
    return !error;
  } catch {
    return false;
  }
}

export async function fetchSundaySchoolLessonsFromSupabase(): Promise<SundaySchoolLesson[]> {
  if (!IS_SUPABASE_CONFIGURED) return [];
  try {
    const { data, error } = await supabase
      .from('nedelje_school_lessons')
      .select('id, date, title, teacher, helper, theme, memory_verse, materials')
      .limit(100);

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
      .select('id, sunday_id, visitor_name, contacted_by, notes, follow_up_needed, created_at')
      .limit(100);

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
