import { WorshipRosterEntry, ServiceSunday } from '../types';
import { INITIAL_WORSHIP_ROSTER } from '../data/worshipData';

/**
 * Match a Sunday date string against worship roster entry dates.
 * Handles different date string formats like "7. 9. 2025", "07. 09. 2025", "7. 9. 25", etc.
 */
export function matchWorshipRosterEntry(
  sundayDateStr: string,
  worshipRoster?: WorshipRosterEntry[]
): WorshipRosterEntry | undefined {
  if (!sundayDateStr) return undefined;

  const rosterList = (worshipRoster && worshipRoster.length > 0) ? worshipRoster : INITIAL_WORSHIP_ROSTER;
  const cleanStr = (s: string) => s.replace(/\./g, ' ').replace(/\s+/g, ' ').trim();
  const targetClean = cleanStr(sundayDateStr);

  // Exact clean string match
  let found = rosterList.find(entry => cleanStr(entry.date) === targetClean);
  if (found) return found;

  // Numeric day / month / year matching
  const targetNums = sundayDateStr.match(/\d+/g)?.map(Number);
  if (!targetNums || targetNums.length < 2) return undefined;

  return rosterList.find(entry => {
    const entryNums = entry.date.match(/\d+/g)?.map(Number);
    if (!entryNums || entryNums.length < 2) return false;

    const dayMatch = targetNums[0] === entryNums[0];
    const monthMatch = targetNums[1] === entryNums[1];

    let yearMatch = true;
    if (targetNums.length >= 3 && entryNums.length >= 3) {
      const y1 = targetNums[2] % 100;
      const y2 = entryNums[2] % 100;
      yearMatch = y1 === y2;
    }

    return dayMatch && monthMatch && yearMatch;
  });
}

/**
 * Formats a WorshipRosterEntry into a clear summary list of assigned members:
 * - Worship Leader
 * - Band Members (Akustika, Bobni, Bas, Klaviature)
 * - Vocals (Vokali)
 */
export function getWorshipTeamAssignedNames(entry: WorshipRosterEntry): string[] {
  const names: string[] = [];

  if (entry.leader && entry.leader.trim()) {
    names.push(`Vodja: ${entry.leader.trim()}`);
  }

  const band: string[] = [];
  if (entry.acoustic && entry.acoustic.trim()) band.push(`${entry.acoustic.trim()} (Akustika)`);
  if (entry.keys && entry.keys.trim()) band.push(`${entry.keys.trim()} (Klaviature)`);
  if (entry.drums && entry.drums.trim()) band.push(`${entry.drums.trim()} (Bobni)`);
  if (entry.bass && entry.bass.trim()) band.push(`${entry.bass.trim()} (Bas)`);

  if (band.length > 0) {
    names.push(`Band: ${band.join(', ')}`);
  }

  if (entry.vocals && entry.vocals.trim()) {
    names.push(`Vokali: ${entry.vocals.trim()}`);
  }

  return names;
}

/**
 * Resolves assignment names for a ministry on a given Sunday.
 * Automatically falls back to slavilna schedule data if ministryId is 'slavilna_ekipa' or 'slavilna'
 * and no manual assignments exist.
 */
export function resolveMinistryAssignments(
  sunday: ServiceSunday,
  ministryId: string,
  worshipRoster?: WorshipRosterEntry[]
): string[] {
  if (!sunday) return [];
  const directAssignments = sunday.assignments?.[ministryId] || [];
  if (Array.isArray(directAssignments) && directAssignments.length > 0) {
    return directAssignments;
  }

  // Auto-sync Slavilna ekipa from Worship schedule data
  if (ministryId === 'slavilna_ekipa' || ministryId === 'slavilna') {
    const entry = matchWorshipRosterEntry(sunday.date, worshipRoster);
    if (entry) {
      const summaryList = getWorshipTeamAssignedNames(entry);
      if (summaryList.length > 0) {
        return summaryList;
      }
    }
  }

  // Fallback for legacy split keys
  if (ministryId === 'nedeljska_sola_mlajsa' || ministryId === 'nedeljska_sola_starejsa') {
    const legacyNames = sunday.assignments?.['nedeljska_sola'] || [];
    if (Array.isArray(legacyNames) && legacyNames.length > 0) {
      if (ministryId === 'nedeljska_sola_mlajsa') {
        return [legacyNames[0]];
      } else {
        return legacyNames.length > 1 ? [legacyNames[1]] : [legacyNames[0]];
      }
    }
  } else if (ministryId === 'sprejem_reditelji') {
    const legacySprejem = sunday.assignments?.['zgornja_dvorana_sprejem'] || [];
    if (Array.isArray(legacySprejem) && legacySprejem.length > 0) {
      return legacySprejem;
    }
  }

  return [];
}

/**
 * Bi-directional sync helper: updates a WorshipRosterEntry in worshipRoster when
 * assignments for 'slavilna_ekipa' are edited in /sluzbe.
 * Preserves roles: parses "Vodja: ...", "Band: ...", "Vokali: ..." or updates leader/acoustic/drums/bass/keys/vocals.
 */
export function syncWorshipRosterFromSundayAssignments(
  sunday: ServiceSunday,
  currentRoster: WorshipRosterEntry[]
): WorshipRosterEntry[] {
  const names = sunday.assignments['slavilna_ekipa'] || sunday.assignments['slavilna'] || [];
  if (names.length === 0) return currentRoster;

  const existingEntry = matchWorshipRosterEntry(sunday.date, currentRoster);
  const entryId = existingEntry ? existingEntry.id : 'worship_roster_' + Date.now();

  let leader = existingEntry?.leader || '';
  let acoustic = existingEntry?.acoustic || '';
  let drums = existingEntry?.drums || '';
  let bass = existingEntry?.bass || '';
  let keys = existingEntry?.keys || '';
  let vocals = existingEntry?.vocals || '';

  // Parse structured string items or plain names
  names.forEach((item) => {
    const trimmed = item.trim();
    if (trimmed.startsWith('Vodja:')) {
      leader = trimmed.replace(/^Vodja:\s*/, '');
    } else if (trimmed.startsWith('Vokali:')) {
      vocals = trimmed.replace(/^Vokali:\s*/, '');
    } else if (trimmed.startsWith('Band:')) {
      const bandContent = trimmed.replace(/^Band:\s*/, '');
      const parts = bandContent.split(',').map(p => p.trim());
      parts.forEach(p => {
        if (p.includes('(Akustika)')) acoustic = p.replace(/\s*\(Akustika\)/, '');
        else if (p.includes('(Klaviature)')) keys = p.replace(/\s*\(Klaviature\)/, '');
        else if (p.includes('(Bobni)')) drums = p.replace(/\s*\(Bobni\)/, '');
        else if (p.includes('(Bas)')) bass = p.replace(/\s*\(Bas\)/, '');
      });
    } else {
      // Plain name fallback: if not already set, assign as leader or vocals
      if (!leader) leader = trimmed;
      else if (!vocals) vocals = trimmed;
      else vocals += `, ${trimmed}`;
    }
  });

  const updatedEntry: WorshipRosterEntry = {
    id: entryId,
    date: existingEntry ? existingEntry.date : sunday.date,
    leader,
    acoustic,
    drums,
    bass,
    keys,
    vocals,
    sound: existingEntry?.sound || '',
    slides: existingEntry?.slides || '',
    vocalTechAbsent: existingEntry?.vocalTechAbsent || '',
    monitors: existingEntry?.monitors || '',
    sundaySchool: existingEntry?.sundaySchool || ''
  };

  if (existingEntry) {
    return currentRoster.map(e => e.id === entryId ? updatedEntry : e);
  } else {
    return [updatedEntry, ...currentRoster];
  }
}

/**
 * Bi-directional sync helper: updates a ServiceSunday's assignments when
 * a WorshipRosterEntry is modified from /slavilna.
 */
export function syncSundayFromWorshipRosterEntry(
  entry: WorshipRosterEntry,
  sunday: ServiceSunday
): ServiceSunday {
  const nextAssignments = { ...(sunday.assignments || {}) };

  // 1. Build slavilna_ekipa items
  const teamItems: string[] = [];
  if (entry.leader && entry.leader.trim()) {
    teamItems.push(`Vodja: ${entry.leader.trim()}`);
  }

  const band: string[] = [];
  if (entry.acoustic && entry.acoustic.trim()) band.push(`${entry.acoustic.trim()} (Akustika)`);
  if (entry.keys && entry.keys.trim()) band.push(`${entry.keys.trim()} (Klaviature)`);
  if (entry.drums && entry.drums.trim()) band.push(`${entry.drums.trim()} (Bobni)`);
  if (entry.bass && entry.bass.trim()) band.push(`${entry.bass.trim()} (Bas)`);

  if (band.length > 0) {
    teamItems.push(`Band: ${band.join(', ')}`);
  }

  if (entry.vocals && entry.vocals.trim()) {
    teamItems.push(`Vokali: ${entry.vocals.trim()}`);
  }

  nextAssignments['slavilna_ekipa'] = teamItems;
  if (nextAssignments['slavilna']) {
    nextAssignments['slavilna'] = teamItems;
  }

  // 2. Sync tech roles and worship intro
  if (entry.sound !== undefined) {
    nextAssignments['zvok'] = entry.sound && entry.sound.trim() && entry.sound !== '/' ? [entry.sound.trim()] : [];
  }
  if (entry.slides !== undefined) {
    nextAssignments['besedila'] = entry.slides && entry.slides.trim() && entry.slides !== '/' ? [entry.slides.trim()] : [];
  }
  if (entry.leader && entry.leader.trim()) {
    nextAssignments['uvod_slavljenje'] = [entry.leader.trim()];
  }

  return {
    ...sunday,
    assignments: nextAssignments
  };
}
