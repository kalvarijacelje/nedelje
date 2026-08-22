/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "https://placeholder.supabase.co";
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || "placeholder-anon-key";

if (!import.meta.env.VITE_SUPABASE_URL || !import.meta.env.VITE_SUPABASE_ANON_KEY) {
  console.warn(
    "[Supabase] VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY is not defined. Please set these in your .env.local file."
  );
}

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

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: rootDomainCookieStorage,
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    flowType: 'pkce'
  }
});
