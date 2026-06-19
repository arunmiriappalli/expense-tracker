const GMAIL_API = 'https://gmail.googleapis.com/gmail/v1'

function extractEmailAddress(fromHeader: string): string {
  const match = fromHeader.match(/<([^>]+)>/)
  return (match?.[1] ?? fromHeader).trim().toLowerCase()
}

export async function getAccessToken(refreshToken: string): Promise<string> {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      grant_type: 'refresh_token',
    }),
  })
  if (!res.ok) throw new Error(`Token refresh failed: ${await res.text()}`)
  const { access_token } = await res.json()
  return access_token
}

interface MessageRef { id: string }

export async function searchMessages(
  accessToken: string,
  query: string,
  maxResults = 200,
): Promise<MessageRef[]> {
  const all: MessageRef[] = []
  let pageToken: string | undefined
  do {
    const url = new URL(`${GMAIL_API}/users/me/messages`)
    url.searchParams.set('q', query)
    url.searchParams.set('maxResults', String(Math.min(maxResults - all.length, 100)))
    if (pageToken) url.searchParams.set('pageToken', pageToken)
    const res = await fetch(url.toString(), { headers: { Authorization: `Bearer ${accessToken}` } })
    if (!res.ok) throw new Error(`Gmail search failed: ${await res.text()}`)
    const data = await res.json()
    all.push(...(data.messages ?? []))
    pageToken = data.nextPageToken
  } while (pageToken && all.length < maxResults)
  return all
}

export interface GmailPart {
  mimeType: string
  filename?: string
  body: { attachmentId?: string; data?: string; size: number }
  parts?: GmailPart[]
}

function findPdfParts(parts: GmailPart[]): GmailPart[] {
  const pdfs: GmailPart[] = []
  for (const part of parts) {
    const isPdf =
      part.mimeType === 'application/pdf' ||
      part.mimeType === 'application/octet-stream' && part.filename?.toLowerCase().endsWith('.pdf')
    if (isPdf && part.body.size > 0) pdfs.push(part)
    if (part.parts) pdfs.push(...findPdfParts(part.parts))
  }
  return pdfs
}

export interface GmailMessage {
  id: string
  from: string
  fromEmail: string
  subject: string
  pdfParts: GmailPart[]
}

export async function getMessage(accessToken: string, messageId: string): Promise<GmailMessage | null> {
  const res = await fetch(`${GMAIL_API}/users/me/messages/${messageId}?format=full`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!res.ok) return null
  const msg = await res.json()

  const headers: Record<string, string> = {}
  for (const h of (msg.payload?.headers ?? [])) {
    headers[(h.name as string).toLowerCase()] = h.value
  }

  const parts: GmailPart[] = msg.payload?.parts ?? (msg.payload ? [msg.payload] : [])
  return {
    id: messageId,
    from: headers['from'] ?? '',
    fromEmail: extractEmailAddress(headers['from'] ?? ''),
    subject: headers['subject'] ?? '',
    pdfParts: findPdfParts(parts),
  }
}

export async function downloadAttachment(
  accessToken: string,
  messageId: string,
  part: GmailPart,
): Promise<Buffer> {
  let base64: string
  if (part.body.data) {
    base64 = part.body.data
  } else if (part.body.attachmentId) {
    const res = await fetch(
      `${GMAIL_API}/users/me/messages/${messageId}/attachments/${part.body.attachmentId}`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
    )
    if (!res.ok) throw new Error(`Attachment download failed: ${await res.text()}`)
    const data = await res.json()
    base64 = data.data
  } else {
    throw new Error('No attachment data')
  }
  // Gmail uses URL-safe base64
  return Buffer.from(base64.replace(/-/g, '+').replace(/_/g, '/'), 'base64')
}
