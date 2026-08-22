// Utility module for Google Chat (Internal Leaders/Serving) & Facebook Messenger (Public Congregation) integrations

export interface GoogleChatConfig {
  webhookUrl: string;
  spaceName?: string;
}

// Default/stored Google Chat Webhook URL from localStorage
export const getStoredGoogleChatWebhook = (): string => {
  return localStorage.getItem('kc_kalvarija_google_chat_webhook') || '';
};

export const setStoredGoogleChatWebhook = (url: string) => {
  localStorage.setItem('kc_kalvarija_google_chat_webhook', url);
};

// 1. Google Chat Webhook Dispatcher (For Leaders & Serving Team)
export async function sendGoogleChatMessage(messageText: string, webhookUrl?: string): Promise<{ success: boolean; error?: string }> {
  const targetUrl = webhookUrl || getStoredGoogleChatWebhook();

  if (!targetUrl) {
    return { success: false, error: 'No Google Chat Webhook URL provided. Please enter your Google Chat Space Webhook URL.' };
  }

  try {
    const response = await fetch(targetUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: messageText })
    });

    if (response.ok) {
      return { success: true };
    } else {
      const errText = await response.text();
      return { success: false, error: `Google Chat API returned status ${response.status}: ${errText}` };
    }
  } catch (err: any) {
    console.error('Failed to post to Google Chat:', err);
    return { success: false, error: err?.message || 'Network error sending message to Google Chat.' };
  }
}

// Format Leader & Serving Team Roster for Google Chat
export function formatRosterForGoogleChat(sundayDate: string, themeSl?: string, assignments?: Record<string, string[]>, currentLanguage: 'sl' | 'en' = 'sl'): string {
  let text = `💬 *KC KALVARIJA • ROSTER & SLUŽENJE ZA NEDELJO (${sundayDate})*\n`;
  if (themeSl) text += `📖 *Tema / Pridiga:* ${themeSl}\n`;
  text += `--------------------------------------------------\n\n`;

  text += `👥 *RAZPORED SLUŽABNIKOV (LEADERS & SERVING TEAM):*\n`;

  if (assignments && Object.keys(assignments).length > 0) {
    Object.entries(assignments).forEach(([ministry, names]) => {
      if (Array.isArray(names) && names.length > 0) {
        text += `• *${ministry}:* ${names.join(', ')}\n`;
      }
    });
  } else {
    text += `(Razpored je v pripravi)\n`;
  }

  text += `\n⏰ *Opomnik:* Prosimo potrdite svojo prisotnost v KC Kalvarija Aplikaciji ali v primeru zadržanosti javite zamenjavo.\n`;
  text += `🏛️ _Google Chat sporočilo za voditelje in služabnike • KC Kalvarija_`;

  return text;
}

// Format Worship Setlist & Rundown for Google Chat
export function formatSetlistForGoogleChat(sundayDate: string, themeSl: string, setlist: any[], rundown: any[], currentLanguage: 'sl' | 'en' = 'sl'): string {
  let text = `🎶 *KC KALVARIJA • SLAVILNI PROGRAM & URIKAR (${sundayDate})*\n`;
  if (themeSl) text += `📖 *Tema:* ${themeSl}\n`;
  text += `==================================================\n\n`;

  text += `🎵 *SLAVILNE PESMI (WORSHIP SETLIST):*\n`;
  if (setlist.length === 0) {
    text += `(Pesmi še niso izbrane)\n`;
  } else {
    setlist.forEach((s, idx) => {
      text += `${idx + 1}. *${s.titleSl}* ${s.key ? `[Key: ${s.key}]` : ''} ${s.bpm ? `(${s.bpm} BPM)` : ''}\n`;
      if (s.leadSinger) text += `   👤 Voditelj/ica: ${s.leadSinger}\n`;
      if (s.docLink) text += `   📄 Akordi / Note: ${s.docLink}\n`;
      if (s.youtubeUrl) text += `   ▶️ Posnetek: ${s.youtubeUrl}\n`;
    });
  }

  text += `\n⏱️ *ČASOVNICA BOGOSLUŽJA (RUNDOWN):*\n`;
  rundown.forEach((r) => {
    text += `• *${r.time}* (${r.durationMinutes} min) — ${r.titleSl} ${r.leaderOrTeam ? `[${r.leaderOrTeam}]` : ''}\n`;
  });

  text += `\n---\n_Poslano v Google Chat prostor za slavilno & AV ekipo_`;
  return text;
}

// 2. Facebook Messenger Public Invitation Formatter (For Public / Congregation)
export function formatPublicInvitationForMessenger(sundayDate: string, themeSl?: string, guest?: string, currentLanguage: 'sl' | 'en' = 'sl'): string {
  let text = `✨ *VABLJENI NA NEDELJSKO BOGOSLUŽJE • KC KALVARIJA!* ✨\n\n`;
  text += `📅 *Kdaj:* Nedelja, ${sundayDate} ob 10:00\n`;
  text += `📍 *Kje:* KC Kalvarija (Trg mladosti 7, Velenje)\n`;
  if (themeSl) text += `📖 *Tema nagovora:* ${themeSl}\n`;
  if (guest) text += `🎙️ *Gost / Govornik:* ${guest}\n`;

  text += `\nPridružite se nam ob slavljenju, molitvi in navdihujočem sporočilu! Za otroke je poskrbljeno v Otroški cerkvi. Po bogoslužju vas toplo vabimo na kavo in druženje.\n\n`;
  text += `Vsi ste prisrčno dobrodošli! ❤️\n`;
  text += `📲 Sporočite nam, če vas lahko pričakujemo!`;

  return text;
}

// Launch Facebook Messenger with pre-filled content / link
export function openFacebookMessenger(pageUsername: string = 'kc.kalvarija', customText?: string) {
  // If customText is provided, copy to clipboard for quick paste in Messenger
  if (customText) {
    navigator.clipboard.writeText(customText);
  }
  
  // Open Messenger conversation link (m.me works on both desktop and mobile app)
  const messengerUrl = `https://m.me/${pageUsername.replace('@', '')}`;
  window.open(messengerUrl, '_blank', 'noopener,noreferrer');
}

// Open Google Chat direct web link
export function openGoogleChatSpace() {
  window.open('https://chat.google.com', '_blank', 'noopener,noreferrer');
}
