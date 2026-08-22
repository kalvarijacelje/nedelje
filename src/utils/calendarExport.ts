/**
 * Calendar Export Utilities (.ics download & Google Calendar link)
 */

export function parseSundayDate(dateStr: string): Date {
  const parts = dateStr.split('.').map((p) => parseInt(p.trim(), 10));
  if (parts.length < 3 || isNaN(parts[0]) || isNaN(parts[1])) {
    return new Date();
  }
  const day = parts[0];
  const month = parts[1] - 1; // 0-indexed
  let year = parts[2];
  if (year < 100) {
    year += 2000;
  }
  // Sunday service default start time: 10:00 AM
  return new Date(year, month, day, 10, 0, 0);
}

function formatDateToICS(date: Date): string {
  const pad = (n: number) => (n < 10 ? '0' + n : '' + n);
  return (
    date.getUTCFullYear() +
    pad(date.getUTCMonth() + 1) +
    pad(date.getUTCDate()) +
    'T' +
    pad(date.getUTCHours()) +
    pad(date.getUTCMinutes()) +
    '00Z'
  );
}

export function downloadICSFile(
  title: string,
  dateStr: string,
  description: string,
  location: string = 'Krščanska cerkev Kalvarija, Celje'
) {
  const startDate = parseSundayDate(dateStr);
  const endDate = new Date(startDate.getTime() + 2 * 60 * 60 * 1000); // 2 hours duration (10:00 - 12:00)

  const startFormatted = formatDateToICS(startDate);
  const endFormatted = formatDateToICS(endDate);

  const icsContent = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//KC Kalvarija//Church Ministry Planner//SL',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `SUMMARY:${title}`,
    `DESCRIPTION:${description.replace(/\n/g, '\\n')}`,
    `LOCATION:${location}`,
    `DTSTART:${startFormatted}`,
    `DTEND:${endFormatted}`,
    'STATUS:CONFIRMED',
    'BEGIN:VALARM',
    'TRIGGER:-P2D', // 2 days before (Friday gentle reminder)
    'ACTION:DISPLAY',
    `DESCRIPTION:Gentle Reminder: ${title} on Sunday`,
    'END:VALARM',
    'BEGIN:VALARM',
    'TRIGGER:-P1D', // 1 day before (Saturday reminder)
    'ACTION:DISPLAY',
    `DESCRIPTION:Tomorrow Reminder: ${title} on Sunday`,
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');

  const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
  const link = document.createElement('a');
  link.href = window.URL.createObjectURL(blob);
  link.setAttribute('download', `kc_kalvarija_${dateStr.replace(/[\s.]+/g, '_')}.ics`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export function getGoogleCalendarUrl(
  title: string,
  dateStr: string,
  description: string,
  location: string = 'Krščanska cerkev Kalvarija, Celje'
): string {
  const parts = dateStr.split('.').map((p) => parseInt(p.trim(), 10));
  let startIso: string;
  let endIso: string;

  if (parts.length >= 3 && !isNaN(parts[0]) && !isNaN(parts[1]) && !isNaN(parts[2])) {
    const day = parts[0];
    const month = parts[1];
    let year = parts[2];
    if (year < 100) year += 2000;
    const pad = (n: number) => (n < 10 ? '0' + n : '' + n);
    const dStr = `${year}${pad(month)}${pad(day)}`;
    startIso = `${dStr}T100000`;
    endIso = `${dStr}T120000`;
  } else {
    const startDate = parseSundayDate(dateStr);
    const endDate = new Date(startDate.getTime() + 2 * 60 * 60 * 1000);
    startIso = formatDateToICS(startDate);
    endIso = formatDateToICS(endDate);
  }

  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: title,
    dates: `${startIso}/${endIso}`,
    details: description,
    location: location,
  });

  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

