import { ServiceSunday, MinistryAssignment } from '../types';
import { generateConfirmationToken } from '../services/notificationService';

/**
 * Helper to reliably parse date string (e.g. "6. 9. 26", "06. 09. 2026", "2026-09-06") into timestamp
 */
export function parseSundayDateTimestamp(dStr: string): number {
  if (!dStr) return 0;
  const parts = dStr.split('.').map(p => p.trim()).filter(Boolean);
  if (parts.length >= 3) {
    const day = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1;
    let year = parseInt(parts[2], 10);
    if (year < 100) year += 2000;
    if (!isNaN(day) && !isNaN(month) && !isNaN(year)) {
      return new Date(year, month, day, 0, 0, 0, 0).getTime();
    }
  }
  if (dStr.includes('-')) {
    const parts = dStr.split('-').map(p => parseInt(p.trim(), 10));
    if (parts.length === 3 && !isNaN(parts[0]) && !isNaN(parts[1]) && !isNaN(parts[2])) {
      return new Date(parts[0], parts[1] - 1, parts[2], 0, 0, 0, 0).getTime();
    }
  }
  return 0;
}

/**
 * Returns array of date strings for N consecutive Sundays starting from startSundayId
 */
export function getConsecutiveSundayDates(
  allSundays: ServiceSunday[],
  startSundayId: string,
  weekCount: number
): { id: string; date: string }[] {
  if (!startSundayId || weekCount < 1) return [];

  // Deduplicate and sort sundays by timestamp
  const seenDates = new Set<string>();
  const uniqueSundays: ServiceSunday[] = [];
  
  const sortedSundays = [...allSundays].sort((a, b) => parseSundayDateTimestamp(a.date) - parseSundayDateTimestamp(b.date));
  
  for (const s of sortedSundays) {
    const normDate = s.date.trim();
    if (!seenDates.has(normDate)) {
      seenDates.add(normDate);
      uniqueSundays.push(s);
    }
  }

  const startIndex = uniqueSundays.findIndex(s => s.id === startSundayId);
  if (startIndex === -1) {
    // If not found by id, try matching by date
    const startObj = allSundays.find(s => s.id === startSundayId);
    if (!startObj) return [];
    const dateIdx = uniqueSundays.findIndex(s => s.date.trim() === startObj.date.trim());
    if (dateIdx === -1) return [];
    return uniqueSundays.slice(dateIdx, dateIdx + weekCount).map(s => ({
      id: s.id,
      date: s.date
    }));
  }

  return uniqueSundays.slice(startIndex, startIndex + weekCount).map(s => ({
    id: s.id,
    date: s.date
  }));
}

/**
 * Batch assigns a person to a ministry role across N consecutive Sundays
 */
export function batchAssignPersonToConsecutiveSundays({
  allSundays,
  startSundayId,
  ministryId,
  personName,
  weekCount,
  leaderId,
  leaderName,
  onUpdateSunday
}: {
  allSundays: ServiceSunday[];
  startSundayId: string;
  ministryId: string;
  personName: string;
  weekCount: number;
  leaderId?: string;
  leaderName?: string;
  onUpdateSunday: (sunday: ServiceSunday) => void;
}): { sundayDate: string; token: string }[] {
  if (!startSundayId || !ministryId || !personName || weekCount < 1) return [];

  // Deduplicate and sort sundays
  const seenDates = new Set<string>();
  const uniqueSundays: ServiceSunday[] = [];
  
  const sortedSundays = [...allSundays].sort((a, b) => parseSundayDateTimestamp(a.date) - parseSundayDateTimestamp(b.date));
  
  for (const s of sortedSundays) {
    const normDate = s.date.trim();
    if (!seenDates.has(normDate)) {
      seenDates.add(normDate);
      uniqueSundays.push(s);
    }
  }

  let startIndex = uniqueSundays.findIndex(s => s.id === startSundayId);
  if (startIndex === -1) {
    const startObj = allSundays.find(s => s.id === startSundayId);
    if (startObj) {
      startIndex = uniqueSundays.findIndex(s => s.date.trim() === startObj.date.trim());
    }
  }

  if (startIndex === -1) return [];

  const targetSundays = uniqueSundays.slice(startIndex, startIndex + weekCount);
  const trimmed = personName.trim();
  const assignedItems: { sundayDate: string; token: string }[] = [];
  const assignedDates = new Set<string>();

  targetSundays.forEach((targetSunday) => {
    const normDate = targetSunday.date.trim();
    if (assignedDates.has(normDate)) return; // Prevent any duplicate dates in the same batch

    const existingAssignments = targetSunday.assignments[ministryId] || [];
    
    // Check if already assigned ignoring casing
    if (existingAssignments.some(n => n.toLowerCase() === trimmed.toLowerCase())) {
      return;
    }

    const isSelfAssign = Boolean(
      leaderName && 
      leaderName.toLowerCase().trim() !== 'vodja službe' && 
      trimmed.toLowerCase() === leaderName.toLowerCase().trim()
    );

    const token = generateConfirmationToken(targetSunday.id, ministryId, trimmed);
    assignedDates.add(normDate);
    if (!isSelfAssign) {
      assignedItems.push({ sundayDate: targetSunday.date, token });
    }

    const updatedAssignments = [...existingAssignments, trimmed];
    const existingDetails = targetSunday.assignmentDetails?.[ministryId] || [];
    const newDetail: MinistryAssignment = {
      personName: trimmed,
      status: isSelfAssign ? 'confirmed' : 'pending',
      notes: '',
      assignedByLeaderId: leaderId || '',
      assignedByLeaderName: leaderName || 'Vodja službe',
      assignedAt: new Date().toISOString(),
      confirmationToken: token,
      responseAt: isSelfAssign ? new Date().toISOString() : undefined,
    };
    const updatedDetails = [...existingDetails, newDetail];

    const updatedSunday: ServiceSunday = {
      ...targetSunday,
      assignments: {
        ...targetSunday.assignments,
        [ministryId]: updatedAssignments
      },
      assignmentDetails: {
        ...(targetSunday.assignmentDetails || {}),
        [ministryId]: updatedDetails
      }
    };

    onUpdateSunday(updatedSunday);
  });

  return assignedItems;
}
