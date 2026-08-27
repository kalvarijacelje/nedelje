import { WorshipRosterEntry, ServiceSunday, Person, BlackoutDate, Ministry } from '../types';
import { INITIAL_WORSHIP_ROSTER } from '../data/worshipData';
import { checkPersonAbsenceOnSunday, getMinistryIconEmoji } from '../components/SundayDetail';

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

export interface ExtractedWorshipPerson {
  name: string;
  roleOrInstrument: string; // e.g. "Vodja slavljenja", "Akustika", "Bobni", "Bas", "Klaviature", "Vokali"
}

/**
 * Unpacks compound worship strings (e.g. "Band: Whitney Lajlar (Akustika), Nina Čičič (Klaviature)...")
 * into individual volunteer objects with their instrument/role.
 */
export function unpackWorshipCompoundString(rawString: string): ExtractedWorshipPerson[] {
  const result: ExtractedWorshipPerson[] = [];
  const trimmed = (rawString || '').trim();
  if (!trimmed || trimmed === '/' || trimmed === '-') return [];

  if (trimmed.startsWith('Vodja:')) {
    const leaderName = trimmed.replace(/^Vodja:\s*/, '').trim();
    if (leaderName) result.push({ name: leaderName, roleOrInstrument: 'Vodja slavljenja' });
  } else if (trimmed.startsWith('Band:')) {
    const bandContent = trimmed.replace(/^Band:\s*/, '');
    const parts = bandContent.split(',').map(p => p.trim());
    parts.forEach(p => {
      if (p.includes('(Akustika)')) {
        result.push({ name: p.replace(/\s*\(Akustika\)/, '').trim(), roleOrInstrument: 'Akustika' });
      } else if (p.includes('(Klaviature)')) {
        result.push({ name: p.replace(/\s*\(Klaviature\)/, '').trim(), roleOrInstrument: 'Klaviature' });
      } else if (p.includes('(Bobni)')) {
        result.push({ name: p.replace(/\s*\(Bobni\)/, '').trim(), roleOrInstrument: 'Bobni' });
      } else if (p.includes('(Bas)')) {
        result.push({ name: p.replace(/\s*\(Bas\)/, '').trim(), roleOrInstrument: 'Bas' });
      } else if (p) {
        result.push({ name: p, roleOrInstrument: 'Band' });
      }
    });
  } else if (trimmed.startsWith('Vokali:')) {
    const vocalContent = trimmed.replace(/^Vokali:\s*/, '');
    vocalContent.split(',').map(p => p.trim()).forEach(v => {
      if (v) result.push({ name: v, roleOrInstrument: 'Vokali' });
    });
  } else {
    // Standard individual person name
    result.push({ name: trimmed, roleOrInstrument: 'Slavilna ekipa' });
  }

  return result;
}

/**
 * Extracts all individual musicians and vocalists from a WorshipRosterEntry
 */
export function extractWorshipVolunteersFromEntry(entry: WorshipRosterEntry): ExtractedWorshipPerson[] {
  const list: ExtractedWorshipPerson[] = [];

  const addPerson = (name: string, role: string) => {
    const trimmed = (name || '').trim();
    if (!trimmed || trimmed === '-' || trimmed === '/' || trimmed.toLowerCase() === 'all') return;
    const clean = trimmed.toLowerCase();
    const existing = list.find(item => item.name.toLowerCase() === clean);
    if (existing) {
      existing.roleOrInstrument += `, ${role}`;
    } else {
      list.push({ name: trimmed, roleOrInstrument: role });
    }
  };

  if (entry.leader) addPerson(entry.leader, 'Vodja slavljenja');
  if (entry.acoustic) addPerson(entry.acoustic, 'Akustika');
  if (entry.keys) addPerson(entry.keys, 'Klaviature');
  if (entry.drums) addPerson(entry.drums, 'Bobni');
  if (entry.bass) addPerson(entry.bass, 'Bas');
  if (entry.vocals) {
    entry.vocals.split(',').forEach(v => addPerson(v, 'Vokali'));
  }

  return list;
}

/**
 * Formats a WorshipRosterEntry into a clear summary list of assigned members:
 * - Worship Leader
 * - Band Members (Akustika, Bobni, Bas, Klaviature)
 * - Vocals (Vokali)
 */
export function getWorshipTeamAssignedNames(entry: WorshipRosterEntry): string[] {
  const names: string[] = [];

  if (entry.leader && entry.leader.trim() && entry.leader.trim() !== '-') {
    names.push(`Vodja: ${entry.leader.trim()}`);
  }

  const band: string[] = [];
  if (entry.acoustic && entry.acoustic.trim() && entry.acoustic.trim() !== '-') band.push(`${entry.acoustic.trim()} (Akustika)`);
  if (entry.keys && entry.keys.trim() && entry.keys.trim() !== '-') band.push(`${entry.keys.trim()} (Klaviature)`);
  if (entry.drums && entry.drums.trim() && entry.drums.trim() !== '-') band.push(`${entry.drums.trim()} (Bobni)`);
  if (entry.bass && entry.bass.trim() && entry.bass.trim() !== '-') band.push(`${entry.bass.trim()} (Bas)`);

  if (band.length > 0) {
    names.push(`Band: ${band.join(', ')}`);
  }

  if (entry.vocals && entry.vocals.trim() && entry.vocals.trim() !== '-') {
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
 * assignments for 'slavilna_ekipa', 'zvok', 'besedila', or 'uvod_slavljenje' are edited in /sluzbe or /urnik.
 * Preserves roles: parses "Vodja: ...", "Band: ...", "Vokali: ..." or updates leader/acoustic/drums/bass/keys/vocals/sound/slides.
 */
export function syncWorshipRosterFromSundayAssignments(
  sunday: ServiceSunday,
  currentRoster: WorshipRosterEntry[]
): WorshipRosterEntry[] {
  const names = sunday.assignments['slavilna_ekipa'] || sunday.assignments['slavilna'] || [];
  const soundAssignments = sunday.assignments['zvok'] || [];
  const slideAssignments = sunday.assignments['besedila'] || [];
  const worshipIntro = sunday.assignments['uvod_slavljenje'] || [];

  const existingEntry = matchWorshipRosterEntry(sunday.date, currentRoster);
  const entryId = existingEntry ? existingEntry.id : 'worship_roster_' + Date.now();

  let leader = existingEntry?.leader || (worshipIntro[0] || '');
  let acoustic = existingEntry?.acoustic || '';
  let drums = existingEntry?.drums || '';
  let bass = existingEntry?.bass || '';
  let keys = existingEntry?.keys || '';
  let vocals = existingEntry?.vocals || '';
  let sound = soundAssignments[0] !== undefined ? soundAssignments[0] : (existingEntry?.sound || '');
  let slides = slideAssignments[0] !== undefined ? slideAssignments[0] : (existingEntry?.slides || '');

  // Parse structured string items or plain names
  if (names.length > 0) {
    let parsedBandAcoustic = '';
    let parsedBandKeys = '';
    let parsedBandDrums = '';
    let parsedBandBass = '';
    let parsedLeader = '';
    let parsedVocals: string[] = [];

    names.forEach((item) => {
      const trimmed = item.trim();
      if (!trimmed) return;

      if (trimmed.startsWith('Vodja:')) {
        parsedLeader = trimmed.replace(/^Vodja:\s*/, '').trim();
      } else if (trimmed.startsWith('Vokali:')) {
        const vPart = trimmed.replace(/^Vokali:\s*/, '').trim();
        if (vPart) parsedVocals.push(vPart);
      } else if (trimmed.startsWith('Band:')) {
        const bandContent = trimmed.replace(/^Band:\s*/, '');
        const parts = bandContent.split(',').map(p => p.trim());
        parts.forEach(p => {
          if (p.includes('(Akustika)')) parsedBandAcoustic = p.replace(/\s*\(Akustika\)/, '').trim();
          else if (p.includes('(Klaviature)')) parsedBandKeys = p.replace(/\s*\(Klaviature\)/, '').trim();
          else if (p.includes('(Bobni)')) parsedBandDrums = p.replace(/\s*\(Bobni\)/, '').trim();
          else if (p.includes('(Bas)')) parsedBandBass = p.replace(/\s*\(Bas\)/, '').trim();
        });
      } else {
        // Plain name fallback
        if (!parsedLeader && !leader) parsedLeader = trimmed;
        else parsedVocals.push(trimmed);
      }
    });

    if (parsedLeader) leader = parsedLeader;
    if (parsedBandAcoustic) acoustic = parsedBandAcoustic;
    if (parsedBandKeys) keys = parsedBandKeys;
    if (parsedBandDrums) drums = parsedBandDrums;
    if (parsedBandBass) bass = parsedBandBass;
    if (parsedVocals.length > 0) vocals = parsedVocals.join(', ');
  }

  // Also check structured assignmentDetails for direct instrument and vocal roles
  const details = sunday.assignmentDetails?.['slavilna_ekipa'] || sunday.assignmentDetails?.['slavilna'] || [];
  if (details.length > 0) {
    const detailVocals: string[] = [];
    details.forEach(d => {
      if (!d || !d.personName) return;
      const pName = d.personName.trim();
      const n = (d.notes || '').toLowerCase();
      if (n.includes('vodja')) leader = pName;
      if (n.includes('akustika') || n.includes('kitara')) acoustic = pName;
      if (n.includes('klavir') || n.includes('klaviatur')) keys = pName;
      if (n.includes('bobni')) drums = pName;
      if (n.includes('bas')) bass = pName;
      if (n.includes('vokal')) {
        if (!detailVocals.includes(pName)) detailVocals.push(pName);
      }
    });
    if (detailVocals.length > 0) {
      vocals = detailVocals.join(', ');
    }
  }

  const updatedEntry: WorshipRosterEntry = {
    id: entryId,
    date: existingEntry ? existingEntry.date : sunday.date,
    leader,
    acoustic,
    drums,
    bass,
    keys,
    vocals,
    sound,
    slides,
    vocalTechAbsent: existingEntry?.vocalTechAbsent || sunday.absentOrNotes || '',
    monitors: existingEntry?.monitors || '',
    sundaySchool: existingEntry?.sundaySchool || (sunday.assignments?.['nedeljska_sola_mlajsa'] || sunday.assignments?.['nedeljska_sola'] || [])[0] || ''
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
  if (entry.leader && entry.leader.trim() && entry.leader.trim() !== '-') {
    teamItems.push(`Vodja: ${entry.leader.trim()}`);
  }

  const band: string[] = [];
  if (entry.acoustic && entry.acoustic.trim() && entry.acoustic.trim() !== '-') band.push(`${entry.acoustic.trim()} (Akustika)`);
  if (entry.keys && entry.keys.trim() && entry.keys.trim() !== '-') band.push(`${entry.keys.trim()} (Klaviature)`);
  if (entry.drums && entry.drums.trim() && entry.drums.trim() !== '-') band.push(`${entry.drums.trim()} (Bobni)`);
  if (entry.bass && entry.bass.trim() && entry.bass.trim() !== '-') band.push(`${entry.bass.trim()} (Bas)`);

  if (band.length > 0) {
    teamItems.push(`Band: ${band.join(', ')}`);
  }

  if (entry.vocals && entry.vocals.trim() && entry.vocals.trim() !== '-') {
    teamItems.push(`Vokali: ${entry.vocals.trim()}`);
  }

  nextAssignments['slavilna_ekipa'] = teamItems;
  nextAssignments['slavilna'] = teamItems;

  // 2. Build structured assignmentDetails with individual musicians and instrument notes
  const extractedVolunteers = extractWorshipVolunteersFromEntry(entry);
  const nextDetails = { ...(sunday.assignmentDetails || {}) };
  const existingWorshipDetails = nextDetails['slavilna_ekipa'] || nextDetails['slavilna'] || [];

  const newWorshipDetails: MinistryAssignment[] = extractedVolunteers.map(vol => {
    const existing = existingWorshipDetails.find(d => d && d.personName && d.personName.toLowerCase() === vol.name.toLowerCase());
    return {
      personName: vol.name,
      status: existing?.status || 'confirmed',
      notes: vol.roleOrInstrument,
      assignedByLeaderId: existing?.assignedByLeaderId || '',
      assignedByLeaderName: existing?.assignedByLeaderName || 'Vodja slavljenja',
      assignedAt: existing?.assignedAt || new Date().toISOString(),
      confirmationToken: existing?.confirmationToken || `token_${Date.now()}_${vol.name.replace(/[^a-z0-9]/gi, '')}`,
      responseAt: existing?.responseAt || null,
      declineReason: existing?.declineReason || undefined
    };
  });

  nextDetails['slavilna_ekipa'] = newWorshipDetails;
  nextDetails['slavilna'] = newWorshipDetails;

  // 3. Sync tech roles and worship intro
  if (entry.sound !== undefined) {
    nextAssignments['zvok'] = entry.sound && entry.sound.trim() && entry.sound.trim() !== '-' && entry.sound !== '/' ? [entry.sound.trim()] : [];
  }
  if (entry.slides !== undefined) {
    nextAssignments['besedila'] = entry.slides && entry.slides.trim() && entry.slides.trim() !== '-' && entry.slides !== '/' ? [entry.slides.trim()] : [];
  }
  if (entry.leader !== undefined) {
    nextAssignments['uvod_slavljenje'] = entry.leader && entry.leader.trim() && entry.leader.trim() !== '-' ? [entry.leader.trim()] : [];
  }

  return {
    ...sunday,
    assignments: nextAssignments,
    assignmentDetails: nextDetails
  };
}

export type WorshipRoleKey = 'leader' | 'acoustic' | 'drums' | 'bass' | 'keys' | 'vocals' | 'sound' | 'slides';

export interface WorshipCandidate {
  person: Person;
  tier: 1 | 2 | 3;
  conflictLabel?: string;
  isAbsent: boolean;
  otherAssignments: Array<{ minId: string; name: string; emoji: string }>;
}

/**
 * Generates a sorted candidate list for a specific worship role with tiering:
 * Tier 1: Preferred / Worship members
 * Tier 2: Other available volunteers (with other assignment badges on that Sunday)
 * Tier 3: Unavailable / Absent
 */
export function getWorshipRoleCandidates(
  roleKey: WorshipRoleKey,
  targetSunday: ServiceSunday | undefined,
  people: Person[],
  blackoutDates: BlackoutDate[] = [],
  ministries: Ministry[] = []
): WorshipCandidate[] {
  if (!Array.isArray(people)) return [];

  const worshipRelatedKeys = ['slavilna_ekipa', 'slavilna', 'glasba', 'worship', 'zvok', 'besedila', 'uvod_slavljenje'];
  
  const roleSpecificKeywords: Record<WorshipRoleKey, string[]> = {
    leader: ['vodja', 'slavilna', 'worship', 'petje', 'kitara', 'klaviature', 'uvod_slavljenje'],
    acoustic: ['akustika', 'kitara', 'guitar', 'slavilna'],
    drums: ['bobni', 'drums', 'cajon', 'tolkala', 'slavilna'],
    bass: ['bas', 'bass', 'kitara', 'slavilna'],
    keys: ['klaviature', 'klavir', 'piano', 'keys', 'slavilna'],
    vocals: ['vokal', 'petje', 'vocals', 'slavilna'],
    sound: ['zvok', 'ton', 'mikser', 'sound', 'av_tech', 'audio'],
    slides: ['besedila', 'projekcija', 'slides', 'ppt', 'av_tech']
  };

  const keywords = roleSpecificKeywords[roleKey] || ['slavilna'];

  const results: WorshipCandidate[] = people.map((person) => {
    const prefs = Array.isArray(person.preferredMinistries) ? person.preferredMinistries.map(p => p.toLowerCase()) : [];
    
    // Check preferred / musician membership
    const isPreferredForRole = prefs.some(p => 
      keywords.some(k => p.includes(k)) || 
      worshipRelatedKeys.some(w => p.includes(w))
    );

    // Check absence
    let isAbsent = false;
    let conflictLabel = '';
    if (targetSunday && targetSunday.date) {
      const absence = checkPersonAbsenceOnSunday(person.name, targetSunday.date, blackoutDates);
      if (absence.isAbsent) {
        isAbsent = true;
        conflictLabel = absence.reason ? `Odsoten (${absence.reason})` : 'Odsoten (dopust/zadržan)';
      }
    }

    // Check other assignments on that Sunday
    const otherAssignments: Array<{ minId: string; name: string; emoji: string }> = [];
    if (targetSunday && targetSunday.assignments) {
      Object.entries(targetSunday.assignments).forEach(([mId, assigned]) => {
        if (mId === 'slavilna_ekipa' || mId === 'slavilna') return;
        if (Array.isArray(assigned)) {
          const isServingHere = assigned.some(nameStr => 
            typeof nameStr === 'string' && nameStr.toLowerCase().includes(person.name.toLowerCase())
          );
          if (isServingHere) {
            const minObj = ministries.find(m => m.id === mId || m.nameSl?.toLowerCase() === mId.toLowerCase());
            otherAssignments.push({
              minId: mId,
              name: minObj ? minObj.nameSl : mId,
              emoji: getMinistryIconEmoji(mId)
            });
          }
        }
      });
    }

    let tier: 1 | 2 | 3 = 2;
    if (isAbsent) {
      tier = 3;
    } else if (isPreferredForRole) {
      tier = 1;
    } else {
      tier = 2;
    }

    return {
      person,
      tier,
      conflictLabel: conflictLabel || (otherAssignments.length > 0 ? otherAssignments.map(o => `${o.emoji} ${o.name}`).join(', ') : undefined),
      isAbsent,
      otherAssignments
    };
  });

  // Sort: Tier 1 first, then Tier 2, then Tier 3. Alphabetical within each tier.
  return results.sort((a, b) => {
    if (a.tier !== b.tier) return a.tier - b.tier;
    return a.person.name.localeCompare(b.person.name, 'sl');
  });
}

