/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface GoogleDriveFile {
  id: string;
  name: string;
  mimeType: string;
  webViewLink?: string;
  iconLink?: string;
  thumbnailLink?: string;
  modifiedTime?: string;
}

/**
 * Lists recent church media files, worship folders or documents from Google Drive
 */
export async function listChurchDriveFiles(
  accessToken: string,
  pageSize: number = 10
): Promise<GoogleDriveFile[]> {
  const params = new URLSearchParams({
    pageSize: pageSize.toString(),
    fields: 'files(id, name, mimeType, webViewLink, iconLink, thumbnailLink, modifiedTime)',
    orderBy: 'modifiedTime desc',
    q: "trashed = false"
  });

  const url = `https://www.googleapis.com/drive/v3/files?${params.toString()}`;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${accessToken}`
    }
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('Failed to list Google Drive files:', errorText);
    throw new Error(`Google Drive API error: ${errorText}`);
  }

  const data = await response.json();
  return data.files || [];
}
