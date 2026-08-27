/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { ServiceSunday } from '../types';
import { parseEuropeanDate } from './dateUtils';
import { supabase, IS_SUPABASE_CONFIGURED } from '../supabaseClient';

const pad = (n: number) => n < 10 ? `0${n}` : `${n}`;

/**
 * Automatically computes whether a Sunday is 'ready' or 'completed' based on date.
 * If Sunday date has passed (yesterday or earlier), it's automatically 'completed'.
 * Otherwise, it's 'ready'.
 */
export function getAutoSundayStatus(sundayDateStr?: string): 'ready' | 'completed' {
  if (!sundayDateStr) return 'ready';
  const d = parseEuropeanDate(sundayDateStr);
  if (!d || isNaN(d.getTime()) || d.getTime() === 0) return 'ready';

  const now = new Date();
  // Set end of today (23:59:59) so current Sunday stays 'ready' during Sunday itself
  const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
  return d.getTime() < endOfToday.getTime() ? 'completed' : 'ready';
}

/**
 * Generates all 53 Sundays for Academic Year 2026/2027 (Aug 30, 2026 -> Aug 29, 2027)
 * with clean, standardized ISO IDs: s-2026-08-30, s-2026-09-06, etc.
 */
export function generateAcademicYear2026_2027(): ServiceSunday[] {
  const sundays: ServiceSunday[] = [];
  const startDate = new Date(2026, 7, 30); // 30. 8. 2026 (Month 7 is August in JS 0-indexed)
  const endDate = new Date(2027, 7, 29);   // 29. 8. 2027
  const current = new Date(startDate);

  while (current <= endDate) {
    const d = current.getDate();
    const m = current.getMonth() + 1;
    const y = current.getFullYear() % 100;
    const formattedDate = `${d}. ${m}. ${y}`;
    const isoDate = `${current.getFullYear()}-${pad(m)}-${pad(d)}`;
    const sundayId = `s-${isoDate}`;

    sundays.push({
      id: sundayId,
      date: formattedDate,
      themeSl: 'Nedeljsko bogoslužje',
      themeEn: 'Sunday Service',
      status: getAutoSundayStatus(formattedDate),
      guest: '',
      assignments: {},
      assignmentDetails: {},
      absentOrNotes: ''
    });

    current.setDate(current.getDate() + 7);
  }

  return sundays;
}

/**
 * Seeds or synchronizes the entire 2026/2027 academic year into Supabase nedelje_services table.
 * Also cleans up any obsolete/funky test IDs (like s_ay2627_...).
 */
export async function seedAcademicYearToSupabase(existingSundays: ServiceSunday[]): Promise<{
  success: boolean;
  syncedSundays: ServiceSunday[];
  insertedCount: number;
  error?: string;
}> {
  try {
    const standardYearSundays = generateAcademicYear2026_2027();
    const existingMap = new Map<string, ServiceSunday>();
    
    // Index existing by normalized date so we preserve existing assignments
    existingSundays.forEach(s => {
      if (s && s.date) {
        existingMap.set(s.date.replace(/\s+/g, ''), s);
      }
    });

    const mergedYearSundays: ServiceSunday[] = standardYearSundays.map(standard => {
      const normDate = standard.date.replace(/\s+/g, '');
      const existing = existingMap.get(normDate);
      if (existing) {
        return {
          ...standard,
          id: standard.id, // Ensure standardized clean ID
          themeSl: existing.themeSl || standard.themeSl,
          themeEn: existing.themeEn || standard.themeEn,
          guest: existing.guest || '',
          absentOrNotes: existing.absentOrNotes || '',
          specialFocus: existing.specialFocus,
          worshipSetlist: existing.worshipSetlist,
          assignments: existing.assignments || {},
          assignmentDetails: existing.assignmentDetails || {},
          status: getAutoSundayStatus(standard.date)
        };
      }
      return standard;
    });

    // If Supabase is configured, upsert into nedelje_services table
    if (IS_SUPABASE_CONFIGURED) {
      // 1. Delete any temporary/funky test IDs like s_ay2627_%
      await supabase.from('nedelje_services').delete().like('id', 's_ay2627_%');

      // 2. Upsert all standard Sundays
      const rows = mergedYearSundays.map(s => ({
        id: s.id,
        date: s.date,
        service_date: s.date,
        title: s.themeSl || 'Nedeljsko bogoslužje',
        theme_sl: s.themeSl || '',
        theme_en: s.themeEn || '',
        status: s.status || 'ready',
        guest: s.guest || '',
        absent_or_notes: s.absentOrNotes || '',
        special_focus: s.specialFocus || null,
        worship_setlist: s.worshipSetlist || [],
        updated_at: new Date().toISOString()
      }));

      const { error: upsertErr } = await supabase.from('nedelje_services').upsert(rows, { onConflict: 'id' });
      if (upsertErr) {
        console.warn('[Supabase] seedAcademicYear upsert error:', upsertErr.message);
        return { success: false, syncedSundays: mergedYearSundays, insertedCount: 0, error: upsertErr.message };
      }
    }

    return {
      success: true,
      syncedSundays: mergedYearSundays,
      insertedCount: mergedYearSundays.length
    };
  } catch (err: any) {
    console.warn('[AcademicYear] seed error:', err);
    return { success: false, syncedSundays: existingSundays, insertedCount: 0, error: err.message || String(err) };
  }
}
