/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Parses a date string in various formats (European D. M. YYYY, D. M. YY, DD/MM/YYYY, ISO YYYY-MM-DD)
 * and returns a standard Date object at local midnight (00:00:00.000).
 */
export function parseEuropeanDate(dateStr?: string | Date | number | null): Date {
  if (!dateStr) return new Date(0);
  if (dateStr instanceof Date) return new Date(dateStr.getFullYear(), dateStr.getMonth(), dateStr.getDate(), 0, 0, 0, 0);
  if (typeof dateStr === 'number') {
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? new Date(0) : new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
  }

  const trimmed = dateStr.trim();
  if (!trimmed) return new Date(0);

  // 1. Handles Slovenian / European dot format: "6. 9. 26", "31. 8. 2025", "06.09.2026", "6.9.2026"
  if (trimmed.includes('.')) {
    const parts = trimmed.split('.').map(p => p.trim()).filter(Boolean);
    if (parts.length >= 3) {
      const day = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1; // 0-indexed
      let year = parseInt(parts[2], 10);
      if (year < 100) year += 2000;
      if (!isNaN(day) && !isNaN(month) && !isNaN(year)) {
        return new Date(year, month, day, 0, 0, 0, 0);
      }
    }
  }

  // 2. Handles European slash format: "31/08/2025", "6/9/26"
  if (trimmed.includes('/')) {
    const parts = trimmed.split('/').map(p => p.trim()).filter(Boolean);
    if (parts.length >= 3) {
      const day = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1;
      let year = parseInt(parts[2], 10);
      if (year < 100) year += 2000;
      if (!isNaN(day) && !isNaN(month) && !isNaN(year)) {
        return new Date(year, month, day, 0, 0, 0, 0);
      }
    }
  }

  // 3. Handles ISO "YYYY-MM-DD" or "YYYY-MM-DDTHH:mm:ss"
  if (trimmed.includes('-')) {
    const cleanDatePart = trimmed.split('T')[0];
    const parts = cleanDatePart.split('-').map(p => parseInt(p.trim(), 10));
    // Check if ISO (year is first part: 4 digits)
    if (parts.length === 3 && parts[0] > 1000) {
      return new Date(parts[0], parts[1] - 1, parts[2], 0, 0, 0, 0);
    }
    // European dash "DD-MM-YYYY"
    if (parts.length === 3) {
      let year = parts[2];
      if (year < 100) year += 2000;
      return new Date(year, parts[1] - 1, parts[0], 0, 0, 0, 0);
    }
  }

  // Fallback to standard JS Date parser
  const d = new Date(trimmed);
  return isNaN(d.getTime()) ? new Date(0) : new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
}

/**
 * Formats any input (ISO string, Date, European string, timestamp) into European format: "D. M. YYYY"
 * Examples:
 * - "2025-08-15" -> "15. 8. 2025"
 * - "31. 8. 25" -> "31. 8. 2025" (or if shortYear: "31. 8. 25")
 */
export function formatToEuropeanDate(
  input?: string | Date | number | null,
  options?: { padZero?: boolean; shortYear?: boolean }
): string {
  if (!input) return '';
  const parsed = parseEuropeanDate(input);
  if (parsed.getTime() === 0 || isNaN(parsed.getTime())) {
    return typeof input === 'string' ? input : '';
  }

  const day = parsed.getDate();
  const month = parsed.getMonth() + 1;
  const fullYear = parsed.getFullYear();
  const year = options?.shortYear ? fullYear % 100 : fullYear;

  const dStr = options?.padZero && day < 10 ? `0${day}` : `${day}`;
  const mStr = options?.padZero && month < 10 ? `0${month}` : `${month}`;

  return `${dStr}. ${mStr}. ${year}`;
}

/**
 * Formats a date range into European format.
 * Examples:
 * - ("2025-08-15", "2025-08-25") -> "15. 8. 2025 ➔ 25. 8. 2025"
 * - ("2025-08-15", "2025-08-15") -> "15. 8. 2025"
 * - ("2025-08-15") -> "15. 8. 2025"
 */
export function formatEuropeanDateRange(
  startDate?: string | Date | null,
  endDate?: string | Date | null,
  separator: string = '➔'
): string {
  if (!startDate) return '';
  const formattedStart = formatToEuropeanDate(startDate);
  if (!endDate) return formattedStart;
  const formattedEnd = formatToEuropeanDate(endDate);

  if (!formattedEnd || formattedStart === formattedEnd) {
    return formattedStart;
  }

  return `${formattedStart} ${separator} ${formattedEnd}`;
}

/**
 * Formats date and time into European format.
 * Examples:
 * - (ISO timestamp) -> "26. 8. 2026 21:20"
 * - If already formatted like "Danes ob 18:20" or "Včeraj, 18:20", preserves it.
 */
export function formatEuropeanDateTime(
  input?: string | Date | number | null,
  includeTime: boolean = true
): string {
  if (!input) return '';
  if (typeof input === 'string') {
    const trimmed = input.trim();
    if (trimmed.startsWith('Danes') || trimmed.startsWith('Včeraj') || trimmed.startsWith('Today') || trimmed.startsWith('Yesterday')) {
      return trimmed;
    }
  }

  const d = typeof input === 'number' || typeof input === 'string' ? new Date(input) : input;
  if (!d || isNaN(d.getTime())) {
    return typeof input === 'string' ? input : '';
  }

  const datePart = formatToEuropeanDate(d);
  if (!includeTime) return datePart;

  const hours = d.getHours().toString().padStart(2, '0');
  const minutes = d.getMinutes().toString().padStart(2, '0');

  return `${datePart} ${hours}:${minutes}`;
}

/**
 * Converts a European date string ("15. 8. 2025" or "15. 8. 25") to ISO "YYYY-MM-DD"
 * Useful for HTML5 <input type="date"> values and APIs.
 */
export function formatToISODate(dateStr?: string | Date | null): string {
  if (!dateStr) return '';
  const parsed = parseEuropeanDate(dateStr);
  if (parsed.getTime() === 0 || isNaN(parsed.getTime())) return '';

  const y = parsed.getFullYear();
  const m = (parsed.getMonth() + 1).toString().padStart(2, '0');
  const d = parsed.getDate().toString().padStart(2, '0');
  return `${y}-${m}-${d}`;
}
