/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { ServiceSunday, Ministry, Person } from '../types';

export interface CalendarEventResult {
  eventId: string;
  htmlLink: string;
  summary: string;
}

/**
 * Parses Slovenian date format "DD. MM. YYYY" or "D. M. YYYY" into "YYYY-MM-DD"
 */
export function formatToISODate(dateStr: string): string | null {
  const parts = dateStr.split('.').map(p => p.trim()).filter(Boolean);
  if (parts.length === 3) {
    const day = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10);
    let year = parseInt(parts[2], 10);
    if (year < 100) year += 2000;
    if (!isNaN(day) && !isNaN(month) && !isNaN(year)) {
      const dd = day < 10 ? `0${day}` : `${day}`;
      const mm = month < 10 ? `0${month}` : `${month}`;
      return `${year}-${mm}-${dd}`;
    }
  }
  
  // Fallback check for YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return dateStr;
  }
  return null;
}

/**
 * Builds Description text for Google Calendar Event
 */
function buildDescription(
  isSl: boolean,
  sunday: ServiceSunday,
  ministries: Ministry[]
): string {
  const lines: string[] = [];

  // Theme & Preacher
  lines.push(isSl ? `📖 TEMA / PRIDIGA: ${sunday.themeSl || '/'}` : `📖 SERMON THEME: ${sunday.themeEn || '/'}`);
  lines.push(isSl ? `🗣️ GOVORNIK / GOST: ${sunday.guest || '/'}` : `🗣️ SPEAKER / GUEST: ${sunday.guest || '/'}`);
  lines.push(isSl ? `📌 STATUS NAČRTOVANJA: ${sunday.status.toUpperCase()}` : `📌 PLANNING STATUS: ${sunday.status.toUpperCase()}`);
  lines.push('');

  // Roster / Assignments
  lines.push(isSl ? '👥 RAZPORED SODELAVCEV:' : '👥 VOLUNTEER ROSTER:');
  lines.push('----------------------------------------');

  ministries.forEach(min => {
    const assignedNames = sunday.assignments[min.id] || [];
    const minName = isSl ? min.nameSl : min.nameEn;
    if (assignedNames.length > 0) {
      const details = sunday.assignmentDetails?.[min.id] || [];
      const formattedNames = assignedNames.map(name => {
        const detail = details.find(d => d.personName === name);
        const statusStr = detail 
          ? ` (${detail.status === 'confirmed' ? (isSl ? 'potrjeno' : 'confirmed') : detail.status === 'declined' ? (isSl ? 'zavrnjeno' : 'declined') : (isSl ? 'v čakanju' : 'pending')})`
          : '';
        const notesStr = detail?.notes ? ` - "${detail.notes}"` : '';
        return `${name}${statusStr}${notesStr}`;
      }).join(', ');
      lines.push(`• ${minName}: ${formattedNames}`);
    } else {
      lines.push(`• ${minName}: ${isSl ? 'ni dodeljenega sodelavca' : 'no scheduled volunteer'}`);
    }
  });

  if (sunday.absentOrNotes) {
    lines.push('');
    lines.push(isSl ? '📝 POMEMBNE OPOMBE / ODSOTNOSTI:' : '📝 IMPORTANT ROSTER NOTES / ABSENCES:');
    lines.push('----------------------------------------');
    lines.push(sunday.absentOrNotes);
  }

  lines.push('');
  lines.push('---');
  lines.push(isSl 
    ? 'Ustvarjeno s pomočjo aplikacije Church Ministry Planner.'
    : 'Exported automatically from Church Ministry Planner.'
  );

  return lines.join('\n');
}

/**
 * Creates or updates Google Calendar Event for a Sunday Service
 */
export async function createOrUpdateServiceEvent(
  accessToken: string,
  sunday: ServiceSunday,
  ministries: Ministry[],
  language: 'sl' | 'en',
  options: {
    serviceStartTime: string; // "10:00"
    serviceEndTime: string;   // "11:30"
    location: string;
    existingEventId?: string | null;
  }
): Promise<CalendarEventResult> {
  const isSl = language === 'sl';
  const isoDate = formatToISODate(sunday.date);
  if (!isoDate) {
    throw new Error(isSl ? 'Napačen format datuma!' : 'Invalid date format!');
  }

  // Summary
  const summaryPrefix = isSl ? 'Nedeljsko bogoslužje' : 'Sunday Service';
  const themeText = isSl ? sunday.themeSl : sunday.themeEn;
  const summary = themeText 
    ? `${summaryPrefix}: ${themeText}` 
    : `${summaryPrefix} (${sunday.date})`;

  // Description
  const description = buildDescription(isSl, sunday, ministries);

  // Time Setup
  const startDateTime = `${isoDate}T${options.serviceStartTime}:00`;
  const endDateTime = `${isoDate}T${options.serviceEndTime}:00`;

  const eventBody = {
    summary,
    description,
    location: options.location,
    start: {
      dateTime: startDateTime,
      timeZone: 'Europe/Ljubljana'
    },
    end: {
      dateTime: endDateTime,
      timeZone: 'Europe/Ljubljana'
    },
    reminders: {
      useDefault: true
    }
  };

  const eventId = options.existingEventId;
  const url = eventId 
    ? `https://www.googleapis.com/calendar/v3/calendars/primary/events/${eventId}`
    : `https://www.googleapis.com/calendar/v3/calendars/primary/events`;

  const response = await fetch(url, {
    method: eventId ? 'PUT' : 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(eventBody)
  });

  if (!response.ok) {
    const errorMsg = await response.text();
    console.error('Failed to create/update Google Calendar event:', errorMsg);
    throw new Error(`Google Calendar API Error: ${errorMsg}`);
  }

  const data = await response.json();
  return {
    eventId: data.id,
    htmlLink: data.htmlLink,
    summary: data.summary || summary
  };
}

/**
 * Creates or updates Google Calendar Event for Rehearsal / Soundcheck
 */
export async function createOrUpdateRehearsalEvent(
  accessToken: string,
  sunday: ServiceSunday,
  language: 'sl' | 'en',
  options: {
    rehearsalStartTime: string; // "09:00"
    rehearsalEndTime: string;   // "09:45"
    location: string;
    existingEventId?: string | null;
  }
): Promise<CalendarEventResult> {
  const isSl = language === 'sl';
  const isoDate = formatToISODate(sunday.date);
  if (!isoDate) {
    throw new Error(isSl ? 'Napačen format datuma!' : 'Invalid date format!');
  }

  const summary = isSl 
    ? `Vaja & Soundcheck ekipa za slavljenje - ${sunday.date}`
    : `Worship Team Rehearsal & Soundcheck - ${sunday.date}`;

  let description = isSl
    ? `Priprava in tehnična preizkušnja pred bogoslužjem.\n• Datum: ${sunday.date}\n• Gost: ${sunday.guest || '/'}`
    : `Technical setup, tuning, and stage check before Sunday service.\n• Date: ${sunday.date}\n• Guest: ${sunday.guest || '/'}`;

  // Grab assigned worship team members if any are found in the list
  const worshipTeam: string[] = [];
  const details = sunday.assignmentDetails;
  if (details) {
    // Collect all unique volunteers serving this Sunday
    const uniqueVolunteersStr = Object.values(sunday.assignments).flat();
    if (uniqueVolunteersStr.length > 0) {
      const listStr = uniqueVolunteersStr.map(name => `• ${name}`).join('\n');
      description += '\n\n' + (isSl ? 'Sodelujoči prostovoljci:' : ' Roster Volunteers:') + '\n' + listStr;
    }
  }

  const startDateTime = `${isoDate}T${options.rehearsalStartTime}:00`;
  const endDateTime = `${isoDate}T${options.rehearsalEndTime}:00`;

  const eventBody = {
    summary,
    description,
    location: options.location,
    start: {
      dateTime: startDateTime,
      timeZone: 'Europe/Ljubljana'
    },
    end: {
      dateTime: endDateTime,
      timeZone: 'Europe/Ljubljana'
    },
    reminders: {
      useDefault: true
    }
  };

  const eventId = options.existingEventId;
  const url = eventId 
    ? `https://www.googleapis.com/calendar/v3/calendars/primary/events/${eventId}`
    : `https://www.googleapis.com/calendar/v3/calendars/primary/events`;

  const response = await fetch(url, {
    method: eventId ? 'PUT' : 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(eventBody)
  });

  if (!response.ok) {
    const errorMsg = await response.text();
    console.error('Failed to create/update Google Calendar rehearsal event:', errorMsg);
    throw new Error(`Google Calendar Rehearsal API Error: ${errorMsg}`);
  }

  const data = await response.json();
  return {
    eventId: data.id,
    htmlLink: data.htmlLink,
    summary: data.summary || summary
  };
}

/**
 * Deletes a Google Calendar Event
 */
export async function deleteCalendarEvent(
  accessToken: string,
  eventId: string
): Promise<void> {
  const url = `https://www.googleapis.com/calendar/v3/calendars/primary/events/${eventId}`;
  const response = await fetch(url, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${accessToken}`
    }
  });

  // If already gone (410 gone, 404 not found) we can consider it successful
  if (!response.ok && response.status !== 404 && response.status !== 410) {
    const errorMsg = await response.text();
    console.error('Failed to delete Google Calendar event:', errorMsg);
    throw new Error(`Google Calendar API Delete Error: ${errorMsg}`);
  }
}
