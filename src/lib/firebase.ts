/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, setPersistence, browserLocalPersistence, indexedDBLocalPersistence } from 'firebase/auth';
import { getFirestore, initializeFirestore, doc, getDocFromServer } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

const env = (import.meta as any).env || {};

// Environment variable fallbacks for production deployments
const resolvedConfig = {
  apiKey: env.VITE_FIREBASE_API_KEY || firebaseConfig?.apiKey || '',
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN || firebaseConfig?.authDomain || 'gen-lang-client-0213713833.firebaseapp.com',
  projectId: env.VITE_FIREBASE_PROJECT_ID || firebaseConfig?.projectId || 'gen-lang-client-0213713833',
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET || firebaseConfig?.storageBucket || 'gen-lang-client-0213713833.firebasestorage.app',
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID || firebaseConfig?.messagingSenderId || '782356518133',
  appId: env.VITE_FIREBASE_APP_ID || firebaseConfig?.appId || '1:782356518133:web:5be1a4080fbbeb719461bc',
  firestoreDatabaseId: env.VITE_FIREBASE_DATABASE_ID || (firebaseConfig as any)?.firestoreDatabaseId || 'default'
};

// Detect if real Firebase credentials are provided or if keeping placeholder state
export const IS_FIREBASE_ENABLED = Boolean(resolvedConfig.apiKey && resolvedConfig.apiKey !== 'placeholder');

let app: any;
let auth: any = null;
let db: any = null;
// Standard Google Sign-In Provider (Authentication only - no sensitive scopes required)
const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({
  prompt: 'select_account'
});

// Dedicated Google Workspace OAuth Provider for optional Workspace features (Calendar, Docs, Tasks, Gmail, Chat)
const workspaceGoogleProvider = new GoogleAuthProvider();
workspaceGoogleProvider.setCustomParameters({
  prompt: 'select_account'
});
workspaceGoogleProvider.addScope('https://www.googleapis.com/auth/documents');
workspaceGoogleProvider.addScope('https://www.googleapis.com/auth/drive.file');
workspaceGoogleProvider.addScope('https://www.googleapis.com/auth/drive.readonly');
workspaceGoogleProvider.addScope('https://www.googleapis.com/auth/calendar');
workspaceGoogleProvider.addScope('https://www.googleapis.com/auth/calendar.events');
workspaceGoogleProvider.addScope('https://www.googleapis.com/auth/tasks');
workspaceGoogleProvider.addScope('https://www.googleapis.com/auth/spreadsheets');
workspaceGoogleProvider.addScope('https://www.googleapis.com/auth/gmail.send');
workspaceGoogleProvider.addScope('https://www.googleapis.com/auth/chat.messages');
workspaceGoogleProvider.addScope('https://www.googleapis.com/auth/chat.spaces.readonly');

if (IS_FIREBASE_ENABLED) {
  try {
    app = getApps().length === 0 ? initializeApp(resolvedConfig) : getApp();
    auth = getAuth(app);
    setPersistence(auth, indexedDBLocalPersistence).catch(() => {
      setPersistence(auth, browserLocalPersistence).catch((error) => {
        console.warn('Failed to set browserLocalPersistence on Firebase Auth:', error);
      });
    });

    const targetDbId = (resolvedConfig.firestoreDatabaseId || 'default').trim() || 'default';

    try {
      db = initializeFirestore(app, { ignoreUndefinedProperties: true }, targetDbId);
    } catch (e) {
      db = getFirestore(app, targetDbId);
    }
  } catch (error) {
    console.error('Failed to initialize real Firebase services:', error);
  }
}

export { auth, db, googleProvider, workspaceGoogleProvider };

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

// Custom Error Handler conforming with system guidelines
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
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  }
}

export function handleFirestoreError(error: any, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth?.currentUser?.uid || null,
      email: auth?.currentUser?.email || null,
      emailVerified: auth?.currentUser?.emailVerified || null,
      isAnonymous: auth?.currentUser?.isAnonymous || null,
      tenantId: auth?.currentUser?.tenantId || null,
      providerInfo: auth?.currentUser?.providerData?.map((provider: any) => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Test validation connection to Firestore (manual on demand)
export async function testConnection() {
  if (!IS_FIREBASE_ENABLED || !db) return;
  if (typeof window === 'undefined') return;
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error: any) {
    // Silently capture if test doc does not exist
  }
}

