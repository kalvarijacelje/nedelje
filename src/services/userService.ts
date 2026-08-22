/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { doc, getDoc, setDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Person, User, UserRole } from '../types';

/**
 * Sanitizes an object before persisting to Firestore (strips undefined values).
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
  authUser: { uid?: string; email?: string | null; displayName?: string | null }
): Person | undefined {
  if (!people || people.length === 0) return undefined;

  const authEmail = (authUser.email || '').toLowerCase().trim();
  const authUid = authUser.uid;
  const authName = (authUser.displayName || '').toLowerCase().trim();

  // 1. Direct ID / UID match
  if (authUid) {
    const idMatch = people.find(p => p && p.id === authUid);
    if (idMatch) return idMatch;
  }

  // 2. Exact email match (highest confidence)
  if (authEmail) {
    const emailMatch = people.find(p => p && p.email && p.email.toLowerCase().trim() === authEmail);
    if (emailMatch) return emailMatch;
  }

  // 3. Exact full display name match
  if (authName) {
    const nameMatch = people.find(p => p && p.name && p.name.toLowerCase().trim() === authName);
    if (nameMatch) return nameMatch;
  }

  // 4. Superadmin fallback matching for ales.lajlar@gmail.com
  if (authEmail === 'ales.lajlar@gmail.com') {
    const alesMatch = people.find(p => p && p.name && p.name.toLowerCase().includes('aleš'));
    if (alesMatch) return alesMatch;
  }

  return undefined;
}

/**
 * Updates a Person document in place by its immutable ID without duplicating or creating clones.
 */
export async function updatePersonRecord(personId: string, updatedPerson: Person): Promise<void> {
  if (!personId || !updatedPerson) return;
  if (!db) return;

  const docRef = doc(db, 'people', personId);
  await setDoc(docRef, sanitizeForFirestore({ ...updatedPerson, id: personId }), { merge: true });
}

/**
 * Creates a new Person document in Firestore using a dedicated immutable ID.
 */
export async function createPersonRecord(newPerson: Person): Promise<void> {
  if (!newPerson || !newPerson.id) return;
  if (!db) return;

  const docRef = doc(db, 'people', newPerson.id);
  await setDoc(docRef, sanitizeForFirestore(newPerson));
}

/**
 * Deletes a Person document by its immutable ID.
 */
export async function deletePersonRecord(personId: string): Promise<void> {
  if (!personId || !db) return;

  const docRef = doc(db, 'people', personId);
  await deleteDoc(docRef);
}

/**
 * Links a registered Firebase User account to a Person document, synchronizing roles without clobbering.
 */
export async function linkUserToPerson(
  userId: string,
  person: Person | undefined,
  targetRole?: UserRole
): Promise<void> {
  if (!userId || !db) return;

  const userDocRef = doc(db, 'users', userId);
  const updatePayload: Record<string, any> = {
    personName: person?.name || null,
    personId: person?.id || null
  };

  if (targetRole) {
    updatePayload.role = targetRole;
  } else if (person?.role) {
    updatePayload.role = person.role;
  }

  await setDoc(userDocRef, sanitizeForFirestore(updatePayload), { merge: true });

  // If person exists and doesn't have an email, update the person's email with user's email
  if (person && person.id) {
    const userSnap = await getDoc(userDocRef);
    if (userSnap.exists()) {
      const userData = userSnap.data() as User;
      if (userData.email && (!person.email || person.email.trim() === '')) {
        await updatePersonRecord(person.id, { ...person, email: userData.email });
      }
    }
  }
}
