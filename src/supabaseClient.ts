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

/**
 * Root-domain cookie adapter for Single Sign-On (SSO) across *.kalvarija.si subdomains
 */
const rootDomainCookieStorage = {
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
    const domain = isKalvarija ? '; domain=.kalvarija.si' : '';
    const secure = typeof window !== 'undefined' && window.location.protocol === 'https:' ? '; Secure' : '';
    document.cookie = `${encodeURIComponent(key)}=${encodeURIComponent(value)}; path=/${domain}; max-age=${60 * 60 * 24 * 365}; SameSite=Lax${secure}`;
    try {
      localStorage.setItem(key, value);
    } catch {
      // ignore
    }
  },
  removeItem: (key: string): void => {
    if (typeof document === 'undefined') return;
    const isKalvarija = typeof window !== 'undefined' && window.location.hostname.includes('kalvarija.si');
    const domain = isKalvarija ? '; domain=.kalvarija.si' : '';
    document.cookie = `${encodeURIComponent(key)}=; path=/${domain}; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax`;
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

