/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { ServiceSunday, Ministry } from '../types';

export interface GoogleSheetResult {
  spreadsheetId: string;
  spreadsheetUrl: string;
}

/**
 * Creates a formatted Google Sheet for Church Rosters or Sunday Schedule exports
 */
export async function exportRosterToGoogleSheet(
  accessToken: string,
  title: string,
  sundays: ServiceSunday[],
  ministries: Ministry[],
  language: 'sl' | 'en' = 'sl'
): Promise<GoogleSheetResult> {
  const isSl = language === 'sl';

  // 1. Create a blank spreadsheet
  const createUrl = 'https://sheets.googleapis.com/v4/spreadsheets';
  const createBody = {
    properties: {
      title: title || (isSl ? 'KC Kalvarija - Razpored Služb' : 'Church Service Roster Matrix')
    }
  };

  const createRes = await fetch(createUrl, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(createBody)
  });

  if (!createRes.ok) {
    const errText = await createRes.text();
    console.error('Failed to create Google Sheet:', errText);
    throw new Error(`Google Sheets API error: ${errText}`);
  }

  const sheetData = await createRes.json();
  const spreadsheetId = sheetData.spreadsheetId;
  const spreadsheetUrl = sheetData.spreadsheetUrl || `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`;

  // 2. Build rows
  const headerRow = [
    isSl ? 'Datum' : 'Date',
    isSl ? 'Tema / Pridiga' : 'Sermon Theme',
    isSl ? 'Govornik' : 'Speaker',
    ...ministries.map(m => isSl ? m.nameSl : m.nameEn)
  ];

  const dataRows = sundays.map(s => {
    const theme = isSl ? (s.themeSl || '') : (s.themeEn || '');
    const guest = s.guest || '';
    const ministryCols = ministries.map(m => {
      const assigned = s.assignments[m.id] || [];
      return assigned.join(', ');
    });
    return [s.date, theme, guest, ...ministryCols];
  });

  const values = [headerRow, ...dataRows];

  // 3. Write data to sheet
  const updateUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Sheet1!A1?valueInputOption=USER_ENTERED`;
  const updateRes = await fetch(updateUrl, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ values })
  });

  if (!updateRes.ok) {
    const errText = await updateRes.text();
    console.error('Failed to write values to Google Sheet:', errText);
    throw new Error(`Google Sheets API write error: ${errText}`);
  }

  return {
    spreadsheetId,
    spreadsheetUrl
  };
}
