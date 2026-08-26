/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SUPABASE_URL) ||
  (typeof process !== 'undefined' && process.env?.VITE_SUPABASE_URL) ||
  'https://ptdvcobgplmngnhkjqag.supabase.co';

const supabaseAnonKey = 
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SUPABASE_ANON_KEY) ||
  (typeof process !== 'undefined' && process.env?.VITE_SUPABASE_ANON_KEY) ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB0ZHZjb2JncGxtbmduaGtqcWFnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc0MTIwNzcsImV4cCI6MjEwMjk4ODA3N30.i9-UFVwAavIuDZO51YEkL0-yt6Rzmg6ZkMGqkRl_JMo';

export const IS_SUPABASE_CONFIGURED = Boolean(
  supabaseUrl && 
  supabaseAnonKey &&
  !supabaseUrl.includes('placeholder')
);

// Cross-tab and cross-subdomain BroadcastChannel for immediate synchronization
export const AUTH_CHANNEL_NAME = 'kck_auth_sync_channel';
export const getAuthBroadcastChannel = (): BroadcastChannel | null => {
  if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
    try {
      return new BroadcastChannel(AUTH_CHANNEL_NAME);
    } catch {
      return null;
    }
  }
  return null;
};

/**
 * Root-domain cookie adapter for Single Sign-On (SSO) across *.kalvarija.si subdomains & localhost
 */
export const rootDomainCookieStorage = {
  getItem: (key: string): string | null => {
    if (typeof document === 'undefined') return null;
    const name = encodeURIComponent(key) + '=';
    const parts = document.cookie.split(';');
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i].trim();
      if (part.indexOf(name) === 0) {
        return decodeURIComponent(part.substring(name.length));
      }
    }
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  setItem: (key: string, value: string): void => {
    if (typeof document === 'undefined') return;
    const isKalvarija = typeof window !== 'undefined' && window.location.hostname.includes('kalvarija.si');
    const domainPart = isKalvarija ? '; domain=.kalvarija.si' : '';
    const securePart = typeof window !== 'undefined' && window.location.protocol === 'https:' ? '; Secure' : '';
    document.cookie = `${encodeURIComponent(key)}=${encodeURIComponent(value)}; path=/${domainPart}; max-age=${60 * 60 * 24 * 365}; SameSite=Lax${securePart}`;
    try {
      localStorage.setItem(key, value);
    } catch {
      // ignore
    }
  },
  removeItem: (key: string): void => {
    if (typeof document === 'undefined') return;
    const encodedKey = encodeURIComponent(key);
    // Clear across all potential domain levels
    document.cookie = `${encodedKey}=; path=/; domain=.kalvarija.si; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax`;
    if (typeof window !== 'undefined') {
      document.cookie = `${encodedKey}=; path=/; domain=${window.location.hostname}; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax`;
    }
    document.cookie = `${encodedKey}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax`;
    try {
      localStorage.removeItem(key);
    } catch {
      // ignore
    }
  }
};

export const supabase = createClient(
  supabaseUrl,
  supabaseAnonKey,
  {
    auth: {
      storage: rootDomainCookieStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true,
      flowType: 'pkce'
    }
  }
);

/**
 * Universal Global Sign-Out function:
 * 1. Revokes the session on Supabase server with scope: 'global'
 * 2. Wipes all cookies across .kalvarija.si and current host
 * 3. Wipes localStorage / sessionStorage auth keys
 * 4. Broadcasts GLOBAL_SIGNOUT to all open tabs/subdomains
 */
export const performGlobalSignOut = async (): Promise<void> => {
  try {
    if (supabase) {
      await supabase.auth.signOut({ scope: 'global' }).catch(() => {});
    }
  } catch {
    // ignore
  }

  // Clear all cookie auth keys
  const cookieKeysToWipe = [
    'sb-ptdvcobgplmngnhkjqag-auth-token',
    'sb-ptdvcobgplmngnhkjqag-auth-token-code-verifier',
    'supabase.auth.token',
    'kck_user_session',
    'church_roster_user_v1'
  ];

  cookieKeysToWipe.forEach(k => rootDomainCookieStorage.removeItem(k));

  // Clear localStorage auth keys
  try {
    localStorage.removeItem('kck_user_session');
    localStorage.removeItem('church_roster_user_v1');
    localStorage.removeItem('sb-ptdvcobgplmngnhkjqag-auth-token');
    localStorage.removeItem('sb-ptdvcobgplmngnhkjqag-auth-token-code-verifier');
    localStorage.removeItem('supabase.auth.token');
  } catch {
    // ignore
  }

  // Broadcast to all open tabs and subdomains
  const channel = getAuthBroadcastChannel();
  if (channel) {
    try {
      channel.postMessage({ type: 'GLOBAL_SIGNOUT', timestamp: Date.now() });
      channel.close();
    } catch {
      // ignore
    }
  }
};
