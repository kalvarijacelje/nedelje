/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { ServiceSunday, Ministry, Person } from '../types';

export interface ChatSpace {
  name: string; // e.g. "spaces/AAAA..."
  displayName?: string;
  spaceType?: string;
}

/**
 * Lists Google Chat spaces available to the authenticated user
 */
export async function listChatSpaces(accessToken: string): Promise<ChatSpace[]> {
  if (!accessToken) return [];

  try {
    const response = await fetch('https://chat.googleapis.com/v1/spaces', {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        console.warn('Google Chat API: Invalid or expired access token (401/403).');
        return [];
      }
      const errorMsg = await response.text();
      console.warn('Failed to list Google Chat spaces:', errorMsg);
      return [];
    }

    const data = await response.json();
    return data.spaces || [];
  } catch (error) {
    console.warn('Error fetching Google Chat spaces:', error);
    return [];
  }
}

/**
 * Sends a message to a specific Google Chat space
 */
export async function sendChatMessage(
  accessToken: string,
  spaceName: string,
  text: string
): Promise<any> {
  const url = `https://chat.googleapis.com/v1/${spaceName}/messages`;
  
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ text }),
  });

  if (!response.ok) {
    const errorMsg = await response.text();
    console.error('Failed to send Google Chat message:', errorMsg);
    throw new Error(`Google Chat API error sending message: ${errorMsg}`);
  }

  return response.json();
}

/**
 * Helper to build custom notification messages based on use cases
 */
export function buildWorkflowMessage(
  type: 'missing_assignments' | 'status_ready' | 'roster_snapshot' | 'role_assigned',
  sunday: ServiceSunday,
  ministries: Ministry[],
  language: 'sl' | 'en',
  extraParams?: {
    assignedPerson?: string;
    assignedRole?: string;
  }
): string {
  const isSl = language === 'sl';
  const dateStr = sunday.date;

  switch (type) {
    case 'missing_assignments': {
      // Find ministries that have no assignments
      const missingList: string[] = [];
      ministries.forEach(min => {
        const assigned = sunday.assignments[min.id] || [];
        if (assigned.length === 0) {
          missingList.push(isSl ? min.nameSl : min.nameEn);
        }
      });

      if (missingList.length === 0) {
        return isSl
          ? `✅ Vse vloge za bogoslužje dne ${dateStr} so zapolnjene! Hvala vsem sodelavcem.`
          : `✅ All roles for the service on ${dateStr} are scheduled! Thank you to everyone serving.`;
      }

      return isSl
        ? `⚠️ *Pozor, manjkajoči sodelavci!* Dne *${dateStr}* še nimamo pokritih naslednjih služb:\n` +
          missingList.map(name => `• _${name}_`).join('\n') +
          `\n\nProsimo, če se lahko koordinirate in čim prej zapolnite mesta.`
        : `⚠️ *Attention, missing assignments!* For the Sunday service on *${dateStr}*, the following roles are still vacant:\n` +
          missingList.map(name => `• _${name}_`).join('\n') +
          `\n\nPlease check your availability and sign up as soon as possible.`;
    }

    case 'status_ready': {
      const themeText = isSl ? (sunday.themeSl || '/') : (sunday.themeEn || '/');
      const speakerText = sunday.guest || '/';
      return isSl
        ? `📢 *Nedeljski načrt za ${dateStr} je PRIPRAVLJEN!* 📢\n\n` +
          `📖 Tema / pridiga: *${themeText}*\n` +
          `🗣️ Govornik / gost: *${speakerText}*\n` +
          `📌 Status: *${sunday.status.toUpperCase()}*\n\n` +
          `Vsi sodelavci si prosim poglejte razpored in potrdite svojo prisotnost v aplikaciji.`
        : `📢 *Sunday Service Plan for ${dateStr} is READY!* 📢\n\n` +
          `📖 Sermon Theme: *${themeText}*\n` +
          `🗣️ Speaker / Guest: *${speakerText}*\n` +
          `📌 Status: *${sunday.status.toUpperCase()}*\n\n` +
          `All scheduled volunteers, please verify your assignments and confirm in the app.`;
    }

    case 'role_assigned': {
      const person = extraParams?.assignedPerson || 'Sodelavec';
      const role = extraParams?.assignedRole || 'službo';
      return isSl
        ? `👤 *Nova dodelitev vloge!* @${person} je določen/a za: *${role}* za nedeljo *${dateStr}*.\n` +
          `Prosimo za potrditev prisotnosti.`
        : `👤 *New Role Assignment!* @${person} has been scheduled for: *${role}* on Sunday *${dateStr}*.\n` +
          `Please confirm your availability in the planner.`;
    }

    case 'roster_snapshot':
    default: {
      const lines: string[] = [];
      lines.push(isSl 
        ? `📋 *Pregled razporeda za nedeljo, ${dateStr}*`
        : `📋 *Schedule Roster Snapshot for Sunday, ${dateStr}*`
      );
      lines.push('----------------------------------------');

      const themeText = isSl ? (sunday.themeSl || '/') : (sunday.themeEn || '/');
      lines.push(isSl ? `📖 Tema: *${themeText}*` : `📖 Theme: *${themeText}*`);
      lines.push(isSl ? `🗣️ Gost: *${sunday.guest || '/'}*` : `🗣️ Speaker: *${sunday.guest || '/'}*`);
      lines.push('');

      ministries.forEach(min => {
        const assigned = sunday.assignments[min.id] || [];
        const minName = isSl ? min.nameSl : min.nameEn;
        if (assigned.length > 0) {
          lines.push(`• *${minName}*: ${assigned.join(', ')}`);
        } else {
          lines.push(`• *${minName}*: _${isSl ? 'nimamo sodelavca' : 'unassigned'}_`);
        }
      });

      return lines.join('\n');
    }
  }
}
