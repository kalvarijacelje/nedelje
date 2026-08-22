/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface GoogleTaskResult {
  id: string;
  title: string;
  selfLink?: string;
  status?: string;
}

/**
 * Creates a Task in the primary Google Tasks list for a assigned volunteer or leader
 */
export async function createGoogleTask(
  accessToken: string,
  title: string,
  notes?: string,
  dueDateIso?: string
): Promise<GoogleTaskResult> {
  const url = 'https://tasks.googleapis.com/tasks/v1/lists/@default/tasks';

  const body: Record<string, any> = {
    title,
    notes: notes || '',
  };

  if (dueDateIso) {
    // Google Tasks RFC 3339 timestamp formatted date (e.g. 2026-08-10T00:00:00.000Z)
    body.due = dueDateIso.includes('T') ? dueDateIso : `${dueDateIso}T09:00:00.000Z`;
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('Failed to create Google Task:', errorText);
    throw new Error(`Google Tasks API error: ${errorText}`);
  }

  const data = await response.json();
  return {
    id: data.id,
    title: data.title,
    selfLink: data.selfLink,
    status: data.status
  };
}
