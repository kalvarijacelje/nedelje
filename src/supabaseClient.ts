import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 
  (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_SUPABASE_URL) || 
  (typeof process !== 'undefined' && process.env?.VITE_SUPABASE_URL) || 
  'https://ptdvcobgplmngnhkjqag.supabase.co';

const SUPABASE_ANON_KEY = 
  (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_SUPABASE_ANON_KEY) || 
  (typeof process !== 'undefined' && process.env?.VITE_SUPABASE_ANON_KEY) || 
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB0ZHZjb2JncGxtbmduaGtqcWFnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc0MTIwNzcsImV4cCI6MjEwMjk4ODA3N30.i9-UFVwAavIuDZO51YEkL0-yt6Rzmg6ZkMGqkRl_JMo';

export const IS_SUPABASE_CONFIGURED = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

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

export const broadcastAuthChange = (type: 'GLOBAL_SIGNIN' | 'GLOBAL_SIGNOUT') => {
  const channel = getAuthBroadcastChannel();
  if (channel) {
    try {
      channel.postMessage({ type, timestamp: Date.now() });
      channel.close();
    } catch {}
  }
};

const MAX_CHUNK_SIZE = 3000;

/**
 * Root-domain cookie adapter for Single Sign-On (SSO) across *.kalvarija.si subdomains & localhost
 */
export const rootDomainCookieStorage = {
  getItem: (key: string): string | null => {
    if (typeof document === 'undefined') return null;
    const encodedKey = encodeURIComponent(key);
    const cookies = document.cookie.split(';');

    // 1. Check single unchunked cookie
    const namePrefix = `${encodedKey}=`;
    for (let i = 0; i < cookies.length; i++) {
      const c = cookies[i].trim();
      if (c.indexOf(namePrefix) === 0) {
        try {
          return decodeURIComponent(c.substring(namePrefix.length));
        } catch {
          return c.substring(namePrefix.length);
        }
      }
    }

    // 2. Check chunked cookies (key.0, key.1, ...)
    let chunkedValue = '';
    let idx = 0;
    while (true) {
      const chunkPrefix = `${encodeURIComponent(`${key}.${idx}`)}=`;
      let found = false;
      for (let i = 0; i < cookies.length; i++) {
        const c = cookies[i].trim();
        if (c.indexOf(chunkPrefix) === 0) {
          try {
            chunkedValue += decodeURIComponent(c.substring(chunkPrefix.length));
          } catch {
            chunkedValue += c.substring(chunkPrefix.length);
          }
          found = true;
          break;
        }
      }
      if (!found) break;
      idx++;
    }

    if (chunkedValue) {
      return chunkedValue;
    }

    // 3. Fallback to localStorage
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
    const maxAge = 60 * 60 * 24 * 365; // 1 year

    try {
      localStorage.setItem(key, value);
    } catch {}

    const encodedVal = encodeURIComponent(value);

    // If value fits in a single cookie
    if (encodedVal.length <= MAX_CHUNK_SIZE) {
      document.cookie = `${encodeURIComponent(key)}=${encodedVal}; path=/; max-age=${maxAge}; SameSite=Lax${domainPart}${securePart}`;
      
      // Clean up any stale chunks
      let idx = 0;
      while (idx < 5) {
        document.cookie = `${encodeURIComponent(`${key}.${idx}`)}=; path=/; max-age=0; SameSite=Lax${domainPart}`;
        idx++;
      }
      return;
    }

    // Chunk large cookies
    let offset = 0;
    let chunkIdx = 0;
    while (offset < encodedVal.length) {
      const chunk = encodedVal.substring(offset, offset + MAX_CHUNK_SIZE);
      document.cookie = `${encodeURIComponent(`${key}.${chunkIdx}`)}=${chunk}; path=/; max-age=${maxAge}; SameSite=Lax${domainPart}${securePart}`;
      offset += MAX_CHUNK_SIZE;
      chunkIdx++;
    }
    // Delete raw unchunked key if chunked
    document.cookie = `${encodeURIComponent(key)}=; path=/; max-age=0; SameSite=Lax${domainPart}`;
  },

  removeItem: (key: string): void => {
    if (typeof document === 'undefined') return;
    const isKalvarija = typeof window !== 'undefined' && window.location.hostname.includes('kalvarija.si');
    const currentHost = typeof window !== 'undefined' ? window.location.hostname : '';

    const removeSingle = (k: string) => {
      const enc = encodeURIComponent(k);
      if (isKalvarija) {
        document.cookie = `${enc}=; path=/; domain=.kalvarija.si; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax`;
      }
      if (currentHost) {
        document.cookie = `${enc}=; path=/; domain=${currentHost}; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax`;
      }
      document.cookie = `${enc}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax`;
      try {
        localStorage.removeItem(k);
      } catch {}
    };

    removeSingle(key);
    for (let i = 0; i < 10; i++) {
      removeSingle(`${key}.${i}`);
    }
  }
};

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

  const cookieKeysToWipe = [
    'sb-ptdvcobgplmngnhkjqag-auth-token',
    'sb-ptdvcobgplmngnhkjqag-auth-token-code-verifier',
    'supabase.auth.token',
    'kck_user_session',
    'church_roster_user_v1'
  ];

  cookieKeysToWipe.forEach(k => rootDomainCookieStorage.removeItem(k));

  try {
    localStorage.removeItem('kck_user_session');
    localStorage.removeItem('church_roster_user_v1');
    localStorage.removeItem('sb-ptdvcobgplmngnhkjqag-auth-token');
    localStorage.removeItem('sb-ptdvcobgplmngnhkjqag-auth-token-code-verifier');
    localStorage.removeItem('supabase.auth.token');
  } catch {
    // ignore
  }

  broadcastAuthChange('GLOBAL_SIGNOUT');
};

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: rootDomainCookieStorage,
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    flowType: 'pkce'
  }
});
