/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface GmailSendResult {
  id: string;
  threadId: string;
}

/**
 * Encodes string to URL-safe base64 for Gmail API RFC 2822 format
 */
function base64UrlEncode(str: string): string {
  return btoa(unescape(encodeURIComponent(str)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

/**
 * Sends an email notification using Gmail API
 */
export async function sendGmailMessage(
  accessToken: string,
  toEmail: string,
  subject: string,
  bodyText: string
): Promise<GmailSendResult> {
  const emailLines = [
    `To: ${toEmail}`,
    `Subject: ${subject}`,
    'Content-Type: text/plain; charset=utf-8',
    'MIME-Version: 1.0',
    '',
    bodyText
  ];

  const rawEmail = emailLines.join('\r\n');
  const encodedEmail = base64UrlEncode(rawEmail);

  const url = 'https://gmail.googleapis.com/gmail/v1/users/me/messages/send';

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      raw: encodedEmail
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('Failed to send email via Gmail API:', errorText);
    throw new Error(`Gmail API error: ${errorText}`);
  }

  const data = await response.json();
  return {
    id: data.id,
    threadId: data.threadId
  };
}
