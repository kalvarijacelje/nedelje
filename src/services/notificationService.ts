/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { ServiceSunday, MinistryAssignment, Ministry, Person } from '../types';

/**
 * Generates a unique, secure confirmation token for one-click URL responses without login
 */
export function generateConfirmationToken(sundayId?: string, ministryId?: string, personName?: string): string {
  if (sundayId && ministryId && personName) {
    const slug = `${sundayId}_${ministryId}_${personName}`.toLowerCase().replace(/[^a-z0-9]/g, '_');
    return `tok_${slug}_${Math.random().toString(36).substring(2, 8)}`;
  }
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID().replace(/-/g, '') + Math.random().toString(36).substring(2, 10);
  }
  return 'tok_' + Date.now().toString(36) + Math.random().toString(36).substring(2, 12);
}

/**
 * Returns the public root URL of the application (window.location.origin or production domain)
 */
export function getPublicAppBaseUrl(): string {
  if (typeof window !== 'undefined' && window.location && window.location.origin) {
    return window.location.origin;
  }
  return 'https://kck-nedelje.web.app';
}

/**
 * Creates a public confirmation link for a token
 */
export function generatePublicConfirmationUrl(
  token: string,
  action?: 'accept' | 'decline',
  baseUrl?: string
): string {
  const root = baseUrl || getPublicAppBaseUrl();
  const baseConfirm = `${root.replace(/\/$/, '')}/potrdi?token=${encodeURIComponent(token)}`;
  if (action) {
    return `${baseConfirm}&action=${action}`;
  }
  return baseConfirm;
}

/**
 * Helper to create a new MinistryAssignment with default 'pending' status and confirmation token
 */
export function createMinistryAssignment(params: {
  personName: string;
  status?: 'pending' | 'confirmed' | 'declined' | 'tentative';
  leaderId?: string;
  leaderName?: string;
  notes?: string;
}): MinistryAssignment {
  return {
    personName: params.personName.trim(),
    status: params.status || 'pending',
    notes: params.notes || '',
    assignedByLeaderId: params.leaderId || '',
    assignedByLeaderName: params.leaderName || 'Vodja službe',
    assignedAt: new Date().toISOString(),
    confirmationToken: generateConfirmationToken(),
  };
}

export interface SingleInviteEmailParams {
  volunteerName: string;
  ministryName: string;
  sundayDate: string;
  leaderName: string;
  token: string;
  baseUrl?: string;
}

export interface BatchInviteEmailParams {
  volunteerName: string;
  ministryName: string;
  items: {
    sundayDate: string;
    token: string;
  }[];
  leaderName: string;
  baseUrl?: string;
}

/**
 * Generates Subject and HTML/Plaintext body for Single Date volunteer invitation
 */
export function generateSingleInviteEmail({
  volunteerName,
  ministryName,
  sundayDate,
  leaderName,
  token,
  baseUrl
}: SingleInviteEmailParams): { subject: string; html: string; text: string } {
  const subject = `Povabilo k služenju: ${ministryName} na dan ${sundayDate} - KC Kalvarija`;
  const acceptUrl = generatePublicConfirmationUrl(token, 'accept', baseUrl);
  const declineUrl = generatePublicConfirmationUrl(token, 'decline', baseUrl);

  const text = `Pozdravljeni ${volunteerName},

Vodja službe ${leaderName} vas vabi k sodelovanju pri službi ${ministryName}.

📅 ${sundayDate} – ${ministryName}

Za potrditev ali zavrnitev kliknite spodnjo povezavo:
✅ SPREJMI ZADOLŽITEV: ${acceptUrl}
❌ NE MOREM / ZAVRNI: ${declineUrl}

Če ne utegnete, preprosto kliknite 'Ne morem' – vsako pravočasno obvestilo nam je v veliko pomoč.

Za vprašanja se obrnite na vodjo službe: ${leaderName}.

Lep pozdrav,
Ekipa KC Kalvarija
`;

  const html = `<!DOCTYPE html>
<html lang="sl">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1e293b; line-height: 1.6;">
  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #f8fafc; padding: 24px 12px;">
    <tr>
      <td align="center">
        <table width="100%" max-width="580" border="0" cellspacing="0" cellpadding="0" style="max-width: 580px; background-color: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
          <!-- Header Banner -->
          <tr>
            <td style="background-color: #312e81; padding: 28px 24px; text-align: center;">
              <h1 style="margin: 0; color: #ffffff; font-size: 20px; font-weight: 700; letter-spacing: -0.025em;">KC KALVARIJA</h1>
              <p style="margin: 4px 0 0 0; color: #c7d2fe; font-size: 13px; font-weight: 500;">Organizacija nedeljskih služb</p>
            </td>
          </tr>
          
          <!-- Content Body -->
          <tr>
            <td style="padding: 32px 28px 24px 28px;">
              <p style="font-size: 16px; margin-top: 0; margin-bottom: 16px;">
                Pozdravljeni <strong>${volunteerName}</strong>,
              </p>
              
              <p style="font-size: 15px; color: #334155; margin-bottom: 24px; line-height: 1.6;">
                Vodja službe <strong>${leaderName}</strong> vas vabi k sodelovanju pri službi <strong>${ministryName}</strong>.
              </p>
              
              <!-- Date Card Item -->
              <div style="background-color: #f1f5f9; border-left: 4px solid #4f46e5; border-radius: 10px; padding: 16px 20px; margin-bottom: 28px;">
                <div style="font-size: 17px; font-weight: 700; color: #1e1b4b; margin-bottom: 4px;">
                  📅 ${sundayDate}
                </div>
                <div style="font-size: 14px; color: #475569; font-weight: 600;">
                  ${ministryName}
                </div>
              </div>

              <!-- One-Click Action Buttons -->
              <div style="text-align: center; margin-bottom: 28px;">
                <table width="100%" border="0" cellspacing="0" cellpadding="0">
                  <tr>
                    <td align="center" style="padding-bottom: 12px;">
                      <a href="${acceptUrl}" target="_blank" style="display: block; width: 100%; max-width: 320px; background-color: #059669; color: #ffffff; font-size: 15px; font-weight: 700; text-decoration: none; padding: 14px 20px; border-radius: 10px; text-align: center; box-shadow: 0 2px 4px rgba(5, 150, 105, 0.2);">
                        ✅ Sprejmi zadolžitev
                      </a>
                    </td>
                  </tr>
                  <tr>
                    <td align="center">
                      <a href="${declineUrl}" target="_blank" style="display: inline-block; color: #64748b; background-color: #f8fafc; border: 1px solid #cbd5e1; font-size: 13px; font-weight: 600; text-decoration: none; padding: 10px 18px; border-radius: 8px; text-align: center;">
                        ❌ Ne morem / Zavrni
                      </a>
                    </td>
                  </tr>
                </table>
              </div>

              <!-- Reassuring Note -->
              <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 14px 16px; margin-bottom: 24px;">
                <p style="font-size: 13px; color: #475569; margin: 0; text-align: center; font-style: italic;">
                  "Če ne utegnete, preprosto kliknite 'Ne morem' – vsako pravočasno obvestilo nam je v veliko pomoč."
                </p>
              </div>

              <!-- Footer info -->
              <p style="font-size: 13px; color: #64748b; margin: 0; border-top: 1px solid #f1f5f9; padding-top: 18px;">
                Za vprašanja se obrnite na vodjo službe: <strong>${leaderName}</strong>.
              </p>
            </td>
          </tr>

          <!-- Footer bottom note -->
          <tr>
            <td style="background-color: #f8fafc; border-top: 1px solid #e2e8f0; padding: 16px 24px; text-align: center;">
              <p style="margin: 0; font-size: 11px; color: #94a3b8;">
                Krščanska cerkev Kalvarija • Organizacija nedeljskih služb
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  return { subject, html, text };
}

/**
 * Generates Subject and HTML/Plaintext body for Multi-Date Batch volunteer invitation
 */
export function generateBatchInviteEmail({
  volunteerName,
  ministryName,
  items,
  leaderName,
  baseUrl
}: BatchInviteEmailParams): { subject: string; html: string; text: string } {
  // Deduplicate items by sundayDate so no duplicate dates can appear
  const seenDates = new Set<string>();
  const uniqueItems: { sundayDate: string; token: string }[] = [];
  items.forEach(item => {
    const key = item.sundayDate.trim();
    if (!seenDates.has(key)) {
      seenDates.add(key);
      uniqueItems.push(item);
    }
  });

  const effectiveItems = uniqueItems.length > 0 ? uniqueItems : items;
  const count = effectiveItems.length;
  const subject = `Povabilo k služenju: ${ministryName} (${count} terminov) - KC Kalvarija`;

  let itemsText = '';
  effectiveItems.forEach((item, idx) => {
    const accUrl = generatePublicConfirmationUrl(item.token, 'accept', baseUrl);
    const decUrl = generatePublicConfirmationUrl(item.token, 'decline', baseUrl);
    itemsText += `\n${idx + 1}. 📅 ${item.sundayDate} – ${ministryName}\n   [ Sprejmi ]: ${accUrl}\n   [ Zavrni ]: ${decUrl}\n`;
  });

  const text = `Pozdravljeni ${volunteerName},

Vodja službe ${leaderName} vas vabi k sodelovanju pri službi ${ministryName} za ${count} terminov:
${itemsText}

Če ne utegnete, preprosto kliknite 'Ne morem' pri posameznem terminu – vsako pravočasno obvestilo nam je v veliko pomoč.

Za vprašanja se obrnite na vodjo službe: ${leaderName}.

Lep pozdrav,
Ekipa KC Kalvarija
`;

  const itemRowsHtml = effectiveItems.map(item => {
    const accUrl = generatePublicConfirmationUrl(item.token, 'accept', baseUrl);
    const decUrl = generatePublicConfirmationUrl(item.token, 'decline', baseUrl);
    return `
      <div style="background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 10px; padding: 14px 16px; margin-bottom: 12px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
          <div>
            <span style="font-size: 15px; font-weight: 700; color: #1e1b4b;">📅 ${item.sundayDate}</span>
            <span style="font-size: 13px; color: #64748b; margin-left: 8px;">${ministryName}</span>
          </div>
        </div>
        <table border="0" cellspacing="0" cellpadding="0">
          <tr>
            <td style="padding-right: 8px;">
              <a href="${accUrl}" target="_blank" style="display: inline-block; background-color: #059669; color: #ffffff; font-size: 12px; font-weight: 700; text-decoration: none; padding: 8px 14px; border-radius: 6px;">
                ✅ Sprejmi
              </a>
            </td>
            <td>
              <a href="${decUrl}" target="_blank" style="display: inline-block; color: #64748b; background-color: #f1f5f9; border: 1px solid #cbd5e1; font-size: 12px; font-weight: 600; text-decoration: none; padding: 7px 12px; border-radius: 6px;">
                ❌ Ne morem
              </a>
            </td>
          </tr>
        </table>
      </div>
    `;
  }).join('');

  const html = `<!DOCTYPE html>
<html lang="sl">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1e293b; line-height: 1.6;">
  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #f8fafc; padding: 24px 12px;">
    <tr>
      <td align="center">
        <table width="100%" max-width="580" border="0" cellspacing="0" cellpadding="0" style="max-width: 580px; background-color: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
          <!-- Header Banner -->
          <tr>
            <td style="background-color: #312e81; padding: 28px 24px; text-align: center;">
              <h1 style="margin: 0; color: #ffffff; font-size: 20px; font-weight: 700; letter-spacing: -0.025em;">KC KALVARIJA</h1>
              <p style="margin: 4px 0 0 0; color: #c7d2fe; font-size: 13px; font-weight: 500;">Organizacija nedeljskih služb</p>
            </td>
          </tr>
          
          <!-- Content Body -->
          <tr>
            <td style="padding: 32px 28px 24px 28px;">
              <p style="font-size: 16px; margin-top: 0; margin-bottom: 16px;">
                Pozdravljeni <strong>${volunteerName}</strong>,
              </p>
              
              <p style="font-size: 15px; color: #334155; margin-bottom: 20px; line-height: 1.6;">
                Vodja službe <strong>${leaderName}</strong> vas vabi k sodelovanju pri službi <strong>${ministryName}</strong> za naslednjih <strong>${count} terminov</strong>:
              </p>

              <!-- List of Dates -->
              <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px; margin-bottom: 24px;">
                ${itemRowsHtml}
              </div>

              <!-- Reassuring Note -->
              <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 14px 16px; margin-bottom: 24px;">
                <p style="font-size: 13px; color: #475569; margin: 0; text-align: center; font-style: italic;">
                  "Če ne utegnete, preprosto kliknite 'Ne morem' – vsako pravočasno obvestilo nam je v veliko pomoč."
                </p>
              </div>

              <!-- Footer info -->
              <p style="font-size: 13px; color: #64748b; margin: 0; border-top: 1px solid #f1f5f9; padding-top: 18px;">
                Za vprašanja se obrnite na vodjo službe: <strong>${leaderName}</strong>.
              </p>
            </td>
          </tr>

          <!-- Footer bottom note -->
          <tr>
            <td style="background-color: #f8fafc; border-top: 1px solid #e2e8f0; padding: 16px 24px; text-align: center;">
              <p style="margin: 0; font-size: 11px; color: #94a3b8;">
                Krščanska cerkev Kalvarija • Organizacija nedeljskih služb
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  return { subject, html, text };
}

/**
 * Searches across all Sundays for a specific confirmation token
 */
export function findAssignmentByToken(
  sundays: ServiceSunday[],
  token: string
): { sunday: ServiceSunday; ministryId: string; assignment: MinistryAssignment } | null {
  if (!token) return null;
  const cleanToken = token.trim();

  for (const sunday of sundays) {
    if (!sunday.assignmentDetails) continue;
    for (const [ministryId, details] of Object.entries(sunday.assignmentDetails)) {
      if (!Array.isArray(details)) continue;
      const found = details.find(d => d.confirmationToken === cleanToken);
      if (found) {
        return { sunday, ministryId, assignment: found };
      }
    }
  }
  return null;
}

/**
 * Updates assignment status and returns updated sundays list
 */
export function updateAssignmentStatusByToken(
  sundays: ServiceSunday[],
  token: string,
  status: 'confirmed' | 'declined',
  declineReason?: string,
  fallbackMatch?: { sunday: ServiceSunday; ministryId: string; assignment: MinistryAssignment } | null
): { updatedSundays: ServiceSunday[]; modifiedSunday: ServiceSunday; assignment: MinistryAssignment; ministryId: string } | null {
  const match = findAssignmentByToken(sundays, token) || fallbackMatch;
  if (!match) return null;

  const { sunday, ministryId, assignment } = match;
  const nowIso = new Date().toISOString();

  const currentDetails = sunday.assignmentDetails?.[ministryId] || [];
  const updatedDetails = currentDetails.map(d => {
    if (d.confirmationToken === token) {
      return {
        ...d,
        status,
        declineReason: status === 'declined' ? (declineReason || d.declineReason || '') : undefined,
        responseAt: nowIso,
      };
    }
    return d;
  });

  // When declined, should we keep them in assignments array or filter them out?
  // We keep them in assignmentDetails with status 'declined' so leaders can see who declined and why,
  // while in assignments[ministryId], we keep only confirmed and pending so the slot is considered open for new assignees if desired,
  // or we keep them visible with the declined indicator.
  const confirmedAndPendingNames = updatedDetails
    .filter(d => d.status !== 'declined')
    .map(d => d.personName);

  const modifiedSunday: ServiceSunday = {
    ...sunday,
    assignments: {
      ...sunday.assignments,
      [ministryId]: confirmedAndPendingNames,
    },
    assignmentDetails: {
      ...(sunday.assignmentDetails || {}),
      [ministryId]: updatedDetails,
    },
  };

  const hasInSundays = sundays.some(s => s.id === sunday.id);
  const updatedSundays = hasInSundays
    ? sundays.map(s => s.id === sunday.id ? modifiedSunday : s)
    : [...sundays, modifiedSunday];

  const updatedAssignment: MinistryAssignment = {
    ...assignment,
    status,
    declineReason: status === 'declined' ? (declineReason || assignment.declineReason || '') : undefined,
    responseAt: nowIso,
  };

  return {
    updatedSundays,
    modifiedSunday,
    assignment: updatedAssignment,
    ministryId,
  };
}

/**
 * Dispatches an email via Resend API / serverless route
 */
export async function sendEmail({
  toEmail,
  to,
  subject,
  html,
  text
}: {
  toEmail?: string;
  to?: string | string[];
  subject: string;
  html?: string;
  text?: string;
}): Promise<{ success: boolean; data?: any; error?: string }> {
  const apiKey = (import.meta as any).env?.VITE_RESEND_API_KEY;
  const rawRecipient = toEmail || (Array.isArray(to) ? to[0] : to) || '';
  const recipient = (rawRecipient && rawRecipient.includes('@')) ? rawRecipient.trim() : '';

  if (!recipient) {
    return { success: false, error: 'Veljaven e-poštni naslov ni bil podan.' };
  }

  const payload = {
    from: 'KCK Organizacija Nedelje <nedelje@kalvarija.si>',
    to: [recipient],
    subject,
    html: html || (text ? `<pre>${text}</pre>` : '<p>Obvestilo za služenje - KC Kalvarija</p>'),
    text,
  };

  // 1. Attempt Vercel / serverless /api/send-email first
  try {
    const apiRes = await fetch('/api/send-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const data = await apiRes.json();
    if (apiRes.ok && (data.success || data.id)) {
      return { success: true, data };
    }
    if (data.error) {
      console.warn('[Email Dispatch] Serverless endpoint returned error:', data.error);
      // If serverless endpoint responded with explicit error, return it unless apiKey fallback is available
      if (!apiKey) {
        return { success: false, error: data.error };
      }
    }
  } catch (err: any) {
    console.warn('[Email Dispatch] Serverless endpoint /api/send-email unreachable:', err);
  }

  // 2. Direct client Resend API call if VITE_RESEND_API_KEY is present
  if (apiKey) {
    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (res.ok) {
        return { success: true, data };
      }
      return { success: false, error: data.message || 'Resend error' };
    } catch (err: any) {
      return { success: false, error: err.message || 'Fetch failed' };
    }
  }

  return { success: false, error: 'Resend API key ni nastavljen na strežniku' };
}

/**
 * Generates an .ics calendar file content for a Sunday assignment
 */
export function generateICSContent(sundayDate: string, ministryName: string, notes?: string): string {
  // Parse date "DD. MM. YYYY"
  const parts = sundayDate.split('.').map(p => p.trim()).filter(Boolean);
  let year = 2026;
  let month = 9;
  let day = 6;
  if (parts.length >= 3) {
    day = parseInt(parts[0], 10) || 6;
    month = parseInt(parts[1], 10) || 9;
    year = parseInt(parts[2], 10) || 2026;
    if (year < 100) year += 2000;
  }

  const pad = (n: number) => n < 10 ? `0${n}` : `${n}`;
  const dtStart = `${year}${pad(month)}${pad(day)}T080000Z`; // 10:00 local ~ 08:00 UTC
  const dtEnd = `${year}${pad(month)}${pad(day)}T100000Z`; // 12:00 local ~ 10:00 UTC
  const nowStamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');

  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//KC Kalvarija//Organizacija Nedelje//SL',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:kck-${year}${pad(month)}${pad(day)}-${Date.now()}@kckalvarija.si`,
    `DTSTAMP:${nowStamp}`,
    `DTSTART:${dtStart}`,
    `DTEND:${dtEnd}`,
    `SUMMARY:KCK Služenje: ${ministryName}`,
    `DESCRIPTION:Služenje pri nedeljskem bogoslužju v KC Kalvarija: ${ministryName}${notes ? `\\nOpombe: ${notes}` : ''}`,
    'LOCATION:KC Kalvarija, Celje',
    'STATUS:CONFIRMED',
    'END:VEVENT',
    'END:VCALENDAR'
  ].join('\r\n');
}

/**
 * Triggers a browser download of the .ics file for Apple Calendar, Outlook, etc.
 */
export function downloadICS(sundayDate: string, ministryName: string, notes?: string): void {
  if (typeof window === 'undefined') return;
  const content = generateICSContent(sundayDate, ministryName, notes);
  const blob = new Blob([content], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  const cleanDate = sundayDate.replace(/[\s.]+/g, '-').replace(/-+$/, '');
  link.setAttribute('download', `kck-sluzenje-${cleanDate}.ics`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Creates a Google Calendar Add Event URL
 */
export function getGoogleCalendarAddUrl(sundayDate: string, ministryName: string, notes?: string): string {
  const parts = sundayDate.split('.').map(p => p.trim()).filter(Boolean);
  let year = 2026;
  let month = 9;
  let day = 6;
  if (parts.length >= 3) {
    day = parseInt(parts[0], 10) || 6;
    month = parseInt(parts[1], 10) || 9;
    year = parseInt(parts[2], 10) || 2026;
    if (year < 100) year += 2000;
  }
  const pad = (n: number) => n < 10 ? `0${n}` : `${n}`;
  const startStr = `${year}${pad(month)}${pad(day)}T100000`;
  const endStr = `${year}${pad(month)}${pad(day)}T120000`;

  const title = encodeURIComponent(`KC Kalvarija - Služenje: ${ministryName}`);
  const details = encodeURIComponent(`Nedeljsko služenje pri službi: ${ministryName}${notes ? `\nOpombe: ${notes}` : ''}\n\nKC Kalvarija`);
  const location = encodeURIComponent('KC Kalvarija, Celje');

  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${startStr}/${endStr}&details=${details}&location=${location}`;
}

/**
 * Generates clean, friendly WhatsApp / Chat message template with single confirm link
 */
export function generateVolunteerChatInviteMessage({
  volunteerName,
  leaderName,
  ministryName,
  sundayDate,
  token,
  baseUrl,
}: {
  volunteerName: string;
  leaderName: string;
  ministryName: string;
  sundayDate: string;
  token: string;
  baseUrl?: string;
}): string {
  const root = baseUrl || getPublicAppBaseUrl();
  const confirmUrl = `${root.replace(/\/$/, '')}/potrdi?token=${encodeURIComponent(token)}`;
  return `Živjo ${volunteerName}!\n\nVodja službe ${leaderName} vas vabi k sodelovanju pri službi *${ministryName}* dne *${sundayDate}*.\n\nProsimo za potrditev s klikom na povezavo:\n${confirmUrl}`;
}

/**
 * Generates WhatsApp reminder/invitation url with clean encoded text
 */
export function getWhatsAppInvitationUrl({
  leaderName,
  volunteerName,
  ministryName,
  sundayDate,
  token,
  phone,
  baseUrl
}: {
  leaderName: string;
  volunteerName: string;
  ministryName: string;
  sundayDate: string;
  token: string;
  phone?: string;
  baseUrl?: string;
}): string {
  const message = generateVolunteerChatInviteMessage({
    volunteerName,
    leaderName,
    ministryName,
    sundayDate,
    token,
    baseUrl,
  });
  const encoded = encodeURIComponent(message);

  if (phone) {
    let clean = phone.replace(/[^0-9+]/g, '');
    if (clean.startsWith('0')) clean = '386' + clean.substring(1);
    clean = clean.replace(/\+/g, '');
    if (clean) return `https://wa.me/${clean}?text=${encoded}`;
  }
  return `https://wa.me/?text=${encoded}`;
}

/**
 * Automatically sends transactional invitation email when a leader assigns a volunteer
 */
export async function sendLeaderAssignmentNotification(params: {
  volunteerName: string;
  volunteerEmail: string;
  ministryName: string;
  sundayDate: string;
  leaderName: string;
  token: string;
  baseUrl?: string;
}): Promise<{ success: boolean; error?: string }> {
  if (!params.volunteerEmail || !params.volunteerEmail.includes('@')) {
    return { success: false, error: 'No email address' };
  }
  const emailContent = generateSingleInviteEmail({
    volunteerName: params.volunteerName,
    ministryName: params.ministryName,
    sundayDate: params.sundayDate,
    leaderName: params.leaderName,
    token: params.token,
    baseUrl: params.baseUrl || getPublicAppBaseUrl(),
  });
  return sendEmail({
    to: params.volunteerEmail,
    subject: emailContent.subject,
    html: emailContent.html,
    text: emailContent.text,
  });
}

/**
 * Sends transactional multi-date batch invitation email when a leader assigns a recurring series
 */
export async function sendBatchLeaderAssignmentNotification(params: {
  volunteerName: string;
  volunteerEmail: string;
  ministryName: string;
  items: { sundayDate: string; token: string }[];
  leaderName: string;
  baseUrl?: string;
}): Promise<{ success: boolean; error?: string }> {
  if (!params.volunteerEmail || !params.volunteerEmail.includes('@')) {
    return { success: false, error: 'No email address' };
  }
  const emailContent = generateBatchInviteEmail({
    volunteerName: params.volunteerName,
    ministryName: params.ministryName,
    items: params.items,
    leaderName: params.leaderName,
    baseUrl: params.baseUrl || getPublicAppBaseUrl(),
  });
  return sendEmail({
    to: params.volunteerEmail,
    subject: emailContent.subject,
    html: emailContent.html,
    text: emailContent.text,
  });
}

/**
 * Sends transactional email notification to ministry leader when a volunteer confirms or declines an assignment
 */
export interface LeaderResponseNotificationParams {
  volunteerName: string;
  leaderName: string;
  leaderEmail: string;
  ministryName: string;
  sundayDate: string;
  action: 'confirmed' | 'declined';
  note?: string;
  baseUrl?: string;
}

export async function sendLeaderResponseNotification({
  volunteerName,
  leaderName,
  leaderEmail,
  ministryName,
  sundayDate,
  action,
  note,
  baseUrl,
}: LeaderResponseNotificationParams): Promise<{ success: boolean; error?: string }> {
  if (!leaderEmail || !leaderEmail.includes('@')) {
    return { success: false, error: 'Vodja nima veljavnega e-poštnega naslova' };
  }

  const root = baseUrl || getPublicAppBaseUrl();
  const scheduleUrl = `${root.replace(/\/$/, '')}/urnik`;

  const isConfirmed = action === 'confirmed';
  const subject = isConfirmed
    ? `✓ ${volunteerName} je potrdil/a: ${ministryName} (${sundayDate})`
    : `❌ ${volunteerName} ne more služiti: ${ministryName} (${sundayDate})`;

  const statusBadge = isConfirmed
    ? `<span style="display: inline-block; background-color: #d1fae5; color: #065f46; font-size: 13px; font-weight: 700; padding: 4px 12px; border-radius: 9999px;">✓ Potrjeno</span>`
    : `<span style="display: inline-block; background-color: #ffe4e6; color: #9f1239; font-size: 13px; font-weight: 700; padding: 4px 12px; border-radius: 9999px;">❌ Zavrnjeno</span>`;

  const html = `<!DOCTYPE html>
<html lang="sl">
<head>
  <meta charset="utf-8">
  <title>${subject}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1e293b; line-height: 1.6;">
  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #f8fafc; padding: 24px 12px;">
    <tr>
      <td align="center">
        <table width="100%" max-width="580" border="0" cellspacing="0" cellpadding="0" style="max-width: 580px; background-color: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
          <tr>
            <td style="background-color: #312e81; padding: 24px; text-align: center;">
              <h1 style="margin: 0; color: #ffffff; font-size: 18px; font-weight: 700;">KC KALVARIJA • ODZIV SODELAVCA</h1>
            </td>
          </tr>
          <tr>
            <td style="padding: 28px;">
              <div style="margin-bottom: 16px;">
                ${statusBadge}
              </div>
              <p style="font-size: 16px; margin: 0 0 16px 0;">
                Pozdravljeni <strong>${leaderName}</strong>,
              </p>
              <p style="font-size: 15px; color: #334155; margin-bottom: 20px;">
                ${isConfirmed
                  ? `Sodelavec <strong>${volunteerName}</strong> je pravkar <strong>potrdil/a</strong> sodelovanje pri službi <strong>${ministryName}</strong> za nedeljo, <strong>${sundayDate}</strong>.`
                  : `Sodelavec <strong>${volunteerName}</strong> je sporočil/a, da <strong>ne more prevzeti</strong> službe <strong>${ministryName}</strong> za nedeljo, <strong>${sundayDate}</strong>.`
                }
              </p>
              ${note ? `
                <div style="background-color: #f1f5f9; border-left: 4px solid #4f46e5; border-radius: 8px; padding: 14px 16px; margin: 20px 0;">
                  <div style="font-size: 12px; font-weight: 700; color: #475569; text-transform: uppercase; margin-bottom: 4px;">Opomba sodelavca:</div>
                  <div style="font-size: 14px; color: #1e293b; font-style: italic;">"${note}"</div>
                </div>
              ` : ''}
              <div style="text-align: center; margin: 28px 0 16px 0;">
                <a href="${scheduleUrl}" target="_blank" style="display: inline-block; background-color: #4f46e5; color: #ffffff; font-size: 14px; font-weight: 700; text-decoration: none; padding: 12px 24px; border-radius: 10px;">
                  📅 Odpri urnik
                </a>
              </div>
            </td>
          </tr>
          <tr>
            <td style="background-color: #f8fafc; border-top: 1px solid #e2e8f0; padding: 14px 24px; text-align: center;">
              <p style="margin: 0; font-size: 11px; color: #94a3b8;">
                Krščanska cerkev Kalvarija • Avtomatsko obvestilo sistema
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  const text = `Pozdravljeni ${leaderName},\n\n${volunteerName} je ${isConfirmed ? 'potrdil/a' : 'zavrnil/a'} sodelovanje pri službi ${ministryName} (${sundayDate}).${note ? `\n\nOpomba: "${note}"` : ''}\n\nOdpri urnik: ${scheduleUrl}`;

  return sendEmail({
    toEmail: leaderEmail,
    subject,
    html,
    text,
  });
}

export interface AppNotification {
  id: string;
  type: 'volunteer_response' | 'assignment' | 'swap' | 'system';
  title: string;
  message: string;
  action?: 'confirmed' | 'declined';
  volunteerName?: string;
  ministryName?: string;
  sundayDate?: string;
  note?: string;
  timestamp: string;
  read: boolean;
}

export function logInAppNotification(notif: Omit<AppNotification, 'id' | 'timestamp' | 'read'>): AppNotification {
  try {
    const KEY = 'church_roster_in_app_notifications_v1';
    const existing: AppNotification[] = JSON.parse(localStorage.getItem(KEY) || '[]');
    const newEntry: AppNotification = {
      ...notif,
      id: 'notif_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
      timestamp: new Date().toISOString(),
      read: false,
    };
    localStorage.setItem(KEY, JSON.stringify([newEntry, ...existing.slice(0, 49)]));
    return newEntry;
  } catch (e) {
    console.warn('Failed to log in-app notification:', e);
    return {
      ...notif,
      id: 'notif_' + Date.now(),
      timestamp: new Date().toISOString(),
      read: false,
    };
  }
}

export function getInAppNotifications(): AppNotification[] {
  try {
    const KEY = 'church_roster_in_app_notifications_v1';
    return JSON.parse(localStorage.getItem(KEY) || '[]');
  } catch (e) {
    return [];
  }
}

export function markInAppNotificationRead(id: string): void {
  try {
    const KEY = 'church_roster_in_app_notifications_v1';
    const existing: AppNotification[] = JSON.parse(localStorage.getItem(KEY) || '[]');
    const updated = existing.map(n => n.id === id ? { ...n, read: true } : n);
    localStorage.setItem(KEY, JSON.stringify(updated));
  } catch (e) {}
}

export function markAllInAppNotificationsRead(): void {
  try {
    const KEY = 'church_roster_in_app_notifications_v1';
    const existing: AppNotification[] = JSON.parse(localStorage.getItem(KEY) || '[]');
    const updated = existing.map(n => ({ ...n, read: true }));
    localStorage.setItem(KEY, JSON.stringify(updated));
  } catch (e) {}
}

/**
 * Alias for sendLeaderAssignmentNotification
 */
export const sendAssignmentEmailNotification = sendLeaderAssignmentNotification;
