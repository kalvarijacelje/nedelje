import { ServiceSunday, MinistryAssignment } from '../types';

/**
 * Returns array of date strings for N consecutive Sundays starting from startSundayId
 */
export function getConsecutiveSundayDates(
  allSundays: ServiceSunday[],
  startSundayId: string,
  weekCount: number
): { id: string; date: string }[] {
  if (!startSundayId || weekCount < 1) return [];

  // Parse date string (e.g. "6. 9. 2026" or "6.9.2026") into timestamp
  const parseDate = (dStr: string) => {
    const parts = dStr.split('.').map(p => p.trim()).filter(Boolean);
    if (parts.length >= 3) {
      const day = parts[0].padStart(2, '0');
      const month = parts[1].padStart(2, '0');
      const year = parts[2];
      return new Date(`${year}-${month}-${day}`).getTime();
    }
    return 0;
  };

  const sortedSundays = [...allSundays].sort((a, b) => parseDate(a.date) - parseDate(b.date));
  const startIndex = sortedSundays.findIndex(s => s.id === startSundayId);

  if (startIndex === -1) return [];

  return sortedSundays.slice(startIndex, startIndex + weekCount).map(s => ({
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

  const parseDate = (dStr: string) => {
    const parts = dStr.split('.').map(p => p.trim()).filter(Boolean);
    if (parts.length >= 3) {
      const day = parts[0].padStart(2, '0');
      const month = parts[1].padStart(2, '0');
      const year = parts[2];
      return new Date(`${year}-${month}-${day}`).getTime();
    }
    return 0;
  };

  const sortedSundays = [...allSundays].sort((a, b) => parseDate(a.date) - parseDate(b.date));
  const startIndex = sortedSundays.findIndex(s => s.id === startSundayId);

  if (startIndex === -1) return [];

  const targetSundays = sortedSundays.slice(startIndex, startIndex + weekCount);
  const trimmed = personName.trim();
  const assignedItems: { sundayDate: string; token: string }[] = [];

  targetSundays.forEach((targetSunday) => {
    const existingAssignments = targetSunday.assignments[ministryId] || [];
    
    // Check if already assigned ignoring casing
    if (existingAssignments.some(n => n.toLowerCase() === trimmed.toLowerCase())) {
      return;
    }

    const token = Math.random().toString(36).substring(2, 12) + Date.now().toString(36);
    assignedItems.push({ sundayDate: targetSunday.date, token });

    const updatedAssignments = [...existingAssignments, trimmed];
    const existingDetails = targetSunday.assignmentDetails?.[ministryId] || [];
    const newDetail: MinistryAssignment = {
      personName: trimmed,
      status: 'pending',
      notes: '',
      assignedByLeaderId: leaderId || '',
      assignedByLeaderName: leaderName || 'Vodja službe',
      assignedAt: new Date().toISOString(),
      confirmationToken: token,
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
