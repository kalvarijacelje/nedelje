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

  // 1. Superadmin special matching for ales.lajlar@gmail.com or name Aleš / Ales
  if (
    authEmail === 'ales.lajlar@gmail.com' ||
    authName === 'aleš' ||
    authName === 'ales' ||
    authName.includes('aleš lajlar') ||
    authName.includes('ales lajlar')
  ) {
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
    const nameMatch = people.find(p => p && p.name && p.name.toLowerCase().trim() === authName);
    if (nameMatch) return nameMatch;
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
    const { error } = await supabase
      .from('profiles')
      .update({
        role: roleToApply,
        name: personName,
        full_name: personName,
        updated_at: new Date().toISOString()
      })
      .eq('id', userId);

    if (error) {
      console.warn('[Supabase] linkUserToPerson notice:', error.message);
    }
  } catch (err) {
    console.warn('[Supabase] linkUserToPerson error:', err);
  }
}
