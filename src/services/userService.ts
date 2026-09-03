/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { supabase, IS_SUPABASE_CONFIGURED } from '../supabaseClient';
import { Person, User, UserRole } from '../types';
import { upsertPersonToSupabase, deletePersonFromSupabase } from './supabaseDataService';

/**
 * Sanitizes an object before persisting (strips undefined values).
 */
export function sanitizeForFirestore<T extends Record<string, any>>(obj: T): Record<string, any> {
  const result: Record<string, any> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined) {
      if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
        result[key] = sanitizeForFirestore(value);
      } else {
        result[key] = value;
      }
    }
  }
  return result;
}

/**
 * Normalizes a name string for flexible matching:
 * 1. Strips aliases/nicknames in parentheses e.g. "Stella (Estelle) Kreiner" -> "Stella Kreiner"
 * 2. Removes diacritics (š->s, č->c, ž->z)
 * 3. Removes punctuation and collapses whitespace
 */
export function normalizeNameForMatching(name?: string | null): string {
  if (!name || typeof name !== 'string') return '';
  return name
    .toLowerCase()
    .replace(/\s*\([^)]*\)/g, ' ') // Remove parentheses like (Estelle)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove accents / diacritics
    .replace(/[^a-z0-9\s]/g, ' ') // Replace punctuation with space
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Checks whether two person names match intelligently:
 * - Exact string match
 * - Normalized match (without diacritics or parenthesized nicknames)
 * - Substring containment
 * - First + Last name token match
 */
export function isNameMatch(name1?: string | null, name2?: string | null): boolean {
  if (!name1 || !name2) return false;
  
  const raw1 = name1.toLowerCase().trim();
  const raw2 = name2.toLowerCase().trim();
  if (raw1 === raw2) return true;
  
  const norm1 = normalizeNameForMatching(name1);
  const norm2 = normalizeNameForMatching(name2);
  if (!norm1 || !norm2) return false;
  if (norm1 === norm2) return true;
  
  // Direct containment
  if (norm1.length >= 4 && norm2.includes(norm1)) return true;
  if (norm2.length >= 4 && norm1.includes(norm2)) return true;

  // First & Last name matching
  const tokens1 = norm1.split(' ').filter(t => t.length >= 2);
  const tokens2 = norm2.split(' ').filter(t => t.length >= 2);
  
  if (tokens1.length >= 2 && tokens2.length >= 2) {
    const first1 = tokens1[0];
    const last1 = tokens1[tokens1.length - 1];
    const first2 = tokens2[0];
    const last2 = tokens2[tokens2.length - 1];
    
    if (first1 === first2 && last1 === last2) {
      return true;
    }
  }

  return false;
}

/**
 * Finds matching Person record by Auth User email or UID, prioritizing exact email match.
 */
export function findPersonByAuthUser(
  people: Person[],
  authUser: { uid?: string; id?: string; email?: string | null; displayName?: string | null; user_metadata?: any }
): Person | undefined {
  if (!people || people.length === 0) return undefined;

  const authEmail = (authUser.email || '').toLowerCase().trim();
  const authUid = authUser.uid || authUser.id;
  const authName = (authUser.displayName || authUser.user_metadata?.full_name || authUser.user_metadata?.name || '').toLowerCase().trim();
  const isAles = authEmail === 'ales.lajlar@gmail.com' || authName === 'aleš' || authName === 'ales' || authName.includes('aleš lajlar') || authName.includes('ales lajlar');

  // 1. Superadmin special matching for ales.lajlar@gmail.com or name Aleš / Ales
  if (isAles) {
    const alesMatch = people.find(p => p && (
      p.id === 'p-ales' ||
      p.id === 'p1' ||
      p.id === 'ales-lajlar' ||
      (p.name && (p.name.trim() === 'Aleš' || p.name.trim() === 'Aleš Lajlar' || p.name.toLowerCase().trim() === 'aleš')) ||
      (p.email && p.email.toLowerCase().trim() === 'ales.lajlar@gmail.com')
    ));
    if (alesMatch) return alesMatch;
  }

  // 2. Direct ID / UID match
  if (authUid) {
    const idMatch = people.find(p => p && (p.id === authUid || (p as any).auth_user_id === authUid));
    if (idMatch) return idMatch;
  }

  // 3. Exact email match (highest confidence)
  if (authEmail) {
    const emailMatch = people.find(p => p && p.email && p.email.toLowerCase().trim() === authEmail);
    if (emailMatch) return emailMatch;
  }

  // 4. Exact full display name match
  if (authName) {
    const nameMatch = people.find(p => {
      if (!p || !p.name) return false;
      if (!isAles && (p.name.toLowerCase().includes('aleš lajlar') || p.id === 'p-ales_lajlar' || (p.email && p.email.toLowerCase() === 'ales.lajlar@gmail.com'))) {
        return false;
      }
      return p.name.toLowerCase().trim() === authName;
    });
    if (nameMatch) return nameMatch;
  }

  // 5. Intelligent fuzzy / nickname name match (e.g. "Stella Kreiner" -> "Stella (Estelle) Kreiner")
  if (authName) {
    const fuzzyMatch = people.find(p => {
      if (!p || !p.name) return false;
      if (!isAles && (p.name.toLowerCase().includes('aleš lajlar') || p.id === 'p-ales_lajlar' || (p.email && p.email.toLowerCase() === 'ales.lajlar@gmail.com'))) {
        return false;
      }
      return isNameMatch(p.name, authName);
    });
    if (fuzzyMatch) return fuzzyMatch;
  }

  return undefined;
}

/**
 * Updates a Person document in place by its immutable ID in Supabase profiles.
 */
export async function updatePersonRecord(personId: string, updatedPerson: Person): Promise<void> {
  if (!personId || !updatedPerson) return;
  const personWithId: Person = { ...updatedPerson, id: personId };
  await upsertPersonToSupabase(personWithId);
}

/**
 * Creates a new Person document in Supabase profiles using a dedicated immutable ID.
 */
export async function createPersonRecord(newPerson: Person): Promise<void> {
  if (!newPerson || !newPerson.id) return;
  await upsertPersonToSupabase(newPerson);
}

/**
 * Deletes a Person document by its immutable ID in Supabase profiles.
 */
export async function deletePersonRecord(personId: string): Promise<void> {
  if (!personId) return;
  await deletePersonFromSupabase(personId);
}

/**
 * Links a registered User account to a Person document in Supabase, synchronizing roles without clobbering.
 */
export async function linkUserToPerson(
  userId: string,
  person: Person | undefined,
  targetRole?: UserRole
): Promise<void> {
  if (!userId || !IS_SUPABASE_CONFIGURED) return;

  const roleToApply = targetRole || person?.role || 'Servant';
  const personName = person?.name || null;
  const personId = person?.id || null;

  try {
    if (personId) {
      // 1. Set auth_user_id on the actual person card row (e.g. 'p-denis')
      await supabase
        .from('profiles')
        .update({
          auth_user_id: userId,
          role: roleToApply,
          name: personName,
          full_name: personName,
          email: person?.email || undefined,
          updated_at: new Date().toISOString()
        })
        .eq('id', personId);

      // 2. If an orphan row with id = userId (UUID) was created, clean it up!
      if (personId !== userId) {
        await supabase
          .from('profiles')
          .delete()
          .eq('id', userId);
      }
    } else {
      // Unlink: remove auth_user_id from profile
      await supabase
        .from('profiles')
        .update({
          auth_user_id: null,
          role: roleToApply,
          updated_at: new Date().toISOString()
        })
        .eq('auth_user_id', userId);
    }
  } catch (err) {
    console.warn('[Supabase] linkUserToPerson error:', err);
  }
}

// ==============================================================================
// GOOGLE CONTACTS SYNC & CSV IMPORT HELPERS
// ==============================================================================

export interface RawContact {
  name: string;
  email?: string;
  phone?: string;
}

export interface MatchedContact {
  person: Person;
  matchedName: string;
  suggestedEmail?: string;
  suggestedPhone?: string;
  selected: boolean;
}

/**
 * Clean and format phone numbers (e.g. "+386 41 850 651" -> "041 850 651")
 */
export function cleanPhoneNumber(rawPhone: string): string {
  let cleaned = rawPhone.replace(/[^\d+]/g, ' ').trim().replace(/\s+/g, ' ');
  if (cleaned.startsWith('+386')) {
    cleaned = '0' + cleaned.substring(4).trim();
  }
  return cleaned;
}

/**
 * Fetch contacts directly using the Google People API
 */
export async function fetchGoogleContacts(googleToken: string): Promise<RawContact[]> {
  if (!googleToken) throw new Error('Missing Google access token');

  const response = await fetch(
    'https://people.googleapis.com/v1/people/me/connections?personFields=names,emailAddresses,phoneNumbers&pageSize=1000',
    {
      headers: {
        Authorization: `Bearer ${googleToken}`,
        Accept: 'application/json',
      },
    }
  );

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData?.error?.message || `Google People API failed with status ${response.status}`);
  }

  const data = await response.json();
  const connections = data.connections || [];

  const contacts: RawContact[] = [];

  for (const person of connections) {
    const displayName = person.names?.[0]?.displayName || person.names?.[0]?.givenName || '';
    if (!displayName) continue;

    const email = person.emailAddresses?.[0]?.value;
    const phone = person.phoneNumbers?.[0]?.value;

    if (email || phone) {
      contacts.push({
        name: displayName.trim(),
        email: email ? email.trim() : undefined,
        phone: phone ? cleanPhoneNumber(phone) : undefined,
      });
    }
  }

  return contacts;
}

/**
 * Parses Google Contacts CSV export format (RFC 4180 / Google Contacts Export / Outlook CSV)
 */
export function parseGoogleContactsCSV(csvText: string): RawContact[] {
  const lines = csvText.split(/\r\n|\n|\r/).filter(l => l.trim().length > 0);
  if (lines.length < 2) return [];

  const parseCSVLine = (line: string): string[] => {
    const values: string[] = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        values.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    values.push(current.trim());
    return values;
  };

  const rawHeaders = parseCSVLine(lines[0]);
  const cleanedHeaders = rawHeaders.map(h => h.toLowerCase().replace(/[^a-z0-9]/g, ''));
  
  // Find Name column indices
  let nameIdx = cleanedHeaders.findIndex(h => h === 'name' || h === 'displayname' || h === 'fullname');
  if (nameIdx === -1) {
    nameIdx = cleanedHeaders.findIndex(h => h.includes('givenname') || h.includes('firstname'));
  }
  const familyIdx = cleanedHeaders.findIndex(h => h.includes('familyname') || h.includes('lastname') || h.includes('surname'));

  // Find Email columns that hold actual values (NOT -type or -label)
  const emailIndices: number[] = [];
  cleanedHeaders.forEach((h, idx) => {
    if (h.includes('email') || h.includes('eposta') || h.includes('mail')) {
      if (!h.includes('type') && !h.includes('label')) {
        emailIndices.push(idx);
      }
    }
  });

  // Find Phone columns that hold actual values (NOT -type or -label)
  const phoneIndices: number[] = [];
  cleanedHeaders.forEach((h, idx) => {
    if (h.includes('phone') || h.includes('telefon') || h.includes('mobile') || h.includes('cell')) {
      if (!h.includes('type') && !h.includes('label')) {
        phoneIndices.push(idx);
      }
    }
  });

  const results: RawContact[] = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = parseCSVLine(lines[i]);
    if (cols.length === 0) continue;

    // Extract Name
    let fullName = '';
    if (nameIdx !== -1 && cols[nameIdx]) {
      fullName = cols[nameIdx].trim();
      if (familyIdx !== -1 && cols[familyIdx] && !fullName.toLowerCase().includes(cols[familyIdx].toLowerCase())) {
        fullName += ' ' + cols[familyIdx].trim();
      }
    } else if (familyIdx !== -1 && cols[familyIdx]) {
      fullName = cols[familyIdx].trim();
    }

    // Extract valid Email (must contain @)
    let email: string | undefined = undefined;
    for (const eIdx of emailIndices) {
      const val = cols[eIdx]?.trim();
      if (val && val.includes('@') && !val.startsWith('*')) {
        email = val;
        break;
      }
    }

    // Extract valid Phone (must have digits)
    let phone: string | undefined = undefined;
    for (const pIdx of phoneIndices) {
      const rawVal = cols[pIdx]?.trim();
      if (rawVal && /\d{5,}/.test(rawVal) && !rawVal.startsWith('*')) {
        phone = cleanPhoneNumber(rawVal);
        break;
      }
    }

    // Fallback: scan all columns in row for email and phone if headers didn't catch them
    if (!email) {
      for (const col of cols) {
        const trimmed = col.trim();
        if (trimmed.includes('@') && !trimmed.includes(' ') && !trimmed.startsWith('*')) {
          email = trimmed;
          break;
        }
      }
    }

    if (!phone) {
      for (const col of cols) {
        const trimmed = col.trim();
        if (/^(\+386|0)[1-7]\d[\s\-/]?\d{3}[\s\-/]?\d{3}$/.test(trimmed) || /^(\+?\d{8,15})$/.test(trimmed.replace(/\s+/g, ''))) {
          phone = cleanPhoneNumber(trimmed);
          break;
        }
      }
    }

    if (fullName && (email || phone)) {
      results.push({
        name: fullName,
        email: email || undefined,
        phone: phone || undefined
      });
    }
  }

  return results;
}

/**
 * Fuzzy matches contacts from Google with our church roster volunteers
 */
export function matchContactsWithPeople(
  contacts: RawContact[],
  people: Person[]
): MatchedContact[] {
  const matches: MatchedContact[] = [];

  for (const person of people) {
    if (!person || !person.name) continue;

    const personClean = person.name.toLowerCase().trim();
    const personParts = personClean.split(' ').map(p => p.trim()).filter(Boolean);

    let bestMatch: RawContact | null = null;

    for (const contact of contacts) {
      const contactClean = contact.name.toLowerCase().trim();
      const contactParts = contactClean.split(' ').map(p => p.trim()).filter(Boolean);

      // Exact full name match
      if (personClean === contactClean) {
        bestMatch = contact;
        break;
      }

      // First name match if single name in roster (e.g. "Stella" matches "Stella Kalvarija" or "Stella Novak")
      if (personParts.length === 1 && contactParts.length > 0 && contactParts[0] === personParts[0]) {
        bestMatch = contact;
        break;
      }

      // First + Last match
      if (personParts.length >= 2 && contactParts.length >= 2) {
        if (personParts[0] === contactParts[0] && personParts[1] === contactParts[1]) {
          bestMatch = contact;
          break;
        }
      }

      // Substring match
      if (contactClean.includes(personClean) || personClean.includes(contactClean)) {
        bestMatch = contact;
        break;
      }
    }

    if (bestMatch) {
      const isValidEmail = Boolean(bestMatch.email && bestMatch.email.includes('@') && !bestMatch.email.startsWith('*') && !bestMatch.email.includes('example.com'));
      const isValidPhone = Boolean(bestMatch.phone && /\d{6,}/.test(bestMatch.phone) && !bestMatch.phone.startsWith('*') && !bestMatch.phone.startsWith('040 000'));

      if (isValidEmail || isValidPhone) {
        const isNewEmail = Boolean(isValidEmail && (!person.email || person.email !== bestMatch.email));
        const isNewPhone = Boolean(isValidPhone && (!person.phone || person.phone !== bestMatch.phone));

        matches.push({
          person,
          matchedName: bestMatch.name,
          suggestedEmail: isValidEmail ? bestMatch.email : person.email,
          suggestedPhone: isValidPhone ? bestMatch.phone : person.phone,
          selected: isNewEmail || isNewPhone,
        });
      }
    }
  }

  return matches;
}

