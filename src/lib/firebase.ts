/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore, initializeFirestore, doc, getDocFromServer } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

const env = (import.meta as any).env || {};

// Environment variable fallbacks for production deployments
const resolvedConfig = {
  apiKey: env.VITE_FIREBASE_API_KEY || firebaseConfig?.apiKey || '',
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN || firebaseConfig?.authDomain || '',
  projectId: env.VITE_FIREBASE_PROJECT_ID || firebaseConfig?.projectId || '',
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET || firebaseConfig?.storageBucket || '',
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID || firebaseConfig?.messagingSenderId || '',
  appId: env.VITE_FIREBASE_APP_ID || firebaseConfig?.appId || '',
  firestoreDatabaseId: env.VITE_FIREBASE_DATABASE_ID || (firebaseConfig as any)?.firestoreDatabaseId || 'default'
};

// Pure Supabase setup: Firebase Auth is completely disabled to eliminate identitytoolkit calls
export const IS_FIREBASE_ENABLED = Boolean(
  resolvedConfig.apiKey && 
  resolvedConfig.apiKey !== 'placeholder' && 
  resolvedConfig.apiKey !== 'placeholder-api-key' &&
  resolvedConfig.projectId &&
  resolvedConfig.projectId !== 'placeholder-project-id'
);

let app: any = null;
export const auth: any = null;
export const googleProvider: any = null;
export const workspaceGoogleProvider: any = null;
let db: any = null;

if (IS_FIREBASE_ENABLED) {
  try {
    app = getApps().length === 0 ? initializeApp(resolvedConfig) : getApp();
    const targetDbId = (resolvedConfig.firestoreDatabaseId || 'default').trim() || 'default';
    try {
      db = initializeFirestore(app, { ignoreUndefinedProperties: true }, targetDbId);
    } catch (e) {
      db = getFirestore(app, targetDbId);
    }
  } catch (error) {
    console.warn('[Firebase] Firestore init notice (using Supabase primary):', error);
  }
}

export { db };

/**
 * Deeply strips undefined properties from an object/array so Firestore setDoc/updateDoc never fails.
 */
export function sanitizeForFirestore<T>(data: T): T {
  if (data === null || data === undefined) return data;
  if (Array.isArray(data)) {
    return data.map(item => sanitizeForFirestore(item)) as unknown as T;
  }
  if (typeof data === 'object') {
    const cleaned: Record<string, any> = {};
    for (const key of Object.keys(data)) {
      const val = (data as any)[key];
      if (val !== undefined) {
        cleaned[key] = sanitizeForFirestore(val);
      }
    }
    return cleaned as T;
  }
  return data;
}

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
  }
}

export function handleFirestoreError(error: any, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: null,
      email: null,
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
}

// Test validation connection to Firestore (manual on demand)
export async function testConnection() {
  if (!IS_FIREBASE_ENABLED || !db) return;
  if (typeof window === 'undefined') return;
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error: any) {
    // Silently capture
  }
}
