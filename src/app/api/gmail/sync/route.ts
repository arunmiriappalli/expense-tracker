import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase/client'
import { getAccessToken, searchMessages, getMessage, downloadAttachment } from '@/lib/gmail'
import { extractTextFromPdf } from '@/lib/pdf'
import { parseStatement } from '@/lib/parsers'

type SyncAccount = 'self' | 'spouse'

type SenderRuleKey =
  | 'icici_bank'
  | 'icici_cc'
  | 'yes_cc'
  | 'axis_cc'
  | 'axis_bank'
  | 'union_bank'

interface SenderRule {
  key: SenderRuleKey
  account: SyncAccount
  senders: string[]
  passwords: string[]
}

const SENDER_RULES: SenderRule[] = [
  {
    key: 'icici_bank',
    account: 'self',
    senders: [
      'estatement@icicibank.com',
      'estatement@icici.bank.in',
    ],
    passwords: ['PDF_PASSWORD_ICICI_BANK'],
  },
  {
    key: 'icici_cc',
    account: 'self',
    senders: [
      'credit_cards@icicibank.com',
      'credit_cards@icici.bank.in',
    ],
    passwords: ['PDF_PASSWORD_ICICI_AMAZON_CC', 'PDF_PASSWORD_ICICI_CC'],
  },
  {
    key: 'yes_cc',
    account: 'self',
    senders: [
      'estatement@yesbank.in',
      'estatement@yes.bank.in',
    ],
    passwords: ['PDF_PASSWORD_YES_CC', 'PDF_PASSWORD_YES_BANK'],
  },
  {
    key: 'axis_cc',
    account: 'self',
    senders: [
      'cc.statements@axisbank.com',
      'cc.statements@axis.bank.in',
    ],
    passwords: ['PDF_PASSWORD_AXIS_AIRTEL_CC', 'PDF_PASSWORD_AXIS_MYZONE_CC', 'PDF_PASSWORD_AXIS_CC'],
  },
  {
    key: 'axis_bank',
    account: 'spouse',
    senders: [
      'statements@axisbank.com',
      'statements@axis.bank.in',
    ],
    passwords: ['PDF_PASSWORD_AXIS_BANK'],
  },
  {
    key: 'union_bank',
    account: 'spouse',
    senders: [
      'noreplyunionbank@unionbankofindia.com',
      'noreplyunionbank@ubi.bank.in',
    ],
    passwords: ['PDF_PASSWORD_UNION_BANK'],
  },
]

function sanitizeSourceFileName(fileName: string | undefined, subject: string): string {
  const trimmed = fileName?.trim()
  if (trimmed) return trimmed
  const fallback = subject.trim().replace(/[<>:"/\\|?*\x00-\x1F]+/g, ' ')
  return fallback ? `${fallback}.pdf` : 'gmail_statement.pdf'
}

function uniquePasswords(values: Array<string | undefined>): string[] {
  const passwords: string[] = []
  const seen = new Set<string>()
  for (const value of values) {
    const password = value?.trim()
    if (!password || seen.has(password)) continue
    seen.add(password)
    passwords.push(password)
  }
  return passwords
}

function buildSenderClause(account: SyncAccount): string {
  const senders = SENDER_RULES.filter(rule => rule.account === account).flatMap(rule => rule.senders)
  if (senders.length === 0) return ''
  if (senders.length === 1) return `from:${senders[0]}`
  return `(${senders.map((sender) => `from:${sender}`).join(' OR ')})`
}

function clonePdfBytes(bytes: Buffer): Buffer {
  return Buffer.from(bytes)
}

function resolveSenderRule(fromEmail: string, account?: SyncAccount): SenderRule | null {
  const from = fromEmail.toLowerCase()
  const rules = SENDER_RULES.filter(rule => !account || rule.account === account)
  return rules.find(rule => rule.senders.includes(from)) ?? null
}

function passwordLookupError(from: string, account: SyncAccount): string {
  return `[${account}] Password required but not configured for: ${from}`
}

function passwordMismatchError(subject: string, from: string, account: SyncAccount): string {
  return `[${account}] Wrong password for: "${subject}" (from: ${from})`
}

function extractionFailureError(subject: string, account: SyncAccount): string {
  return `[${account}] PDF extraction failed: "${subject}"`
}

function downloadFailureError(subject: string, account: SyncAccount): string {
  return `[${account}] Download failed: "${subject}"`
}

function parseFailureError(source: string, account: SyncAccount): string {
  return `[${account}] ${source} parsed but 0 transactions — will retry next sync`
}

function dbFailureError(source: string, account: SyncAccount, message: string): string {
  return `[${account}] DB error (${source}): ${message}`
}

function isAnnualIciciStatement(subject: string): boolean {
  return /icici bank statement from .* to .*march 31, \d{4}/i.test(subject) || /annual statement/i.test(subject)
}

function logProcessing(account: SyncAccount, subject: string, from: string, rule: SenderRule | null) {
  console.log(`[gmail:${account}] processing "${subject}" from ${from}${rule ? ` [${rule.key}]` : ''}`)
}

function logParsed(account: SyncAccount, source: string, count: number, rule: SenderRule | null) {
  console.log(`[gmail:${account}] parsed ${source} → ${count} transactions${rule ? ` [${rule.key}]` : ''}`)
}

function logFound(account: SyncAccount, count: number, afterStr: string) {
  console.log(`[gmail:${account}] found ${count} emails after ${afterStr}`)
}

function logSeen(account: SyncAccount, total: number, seen: number) {
  console.log(`[gmail:${account}] ${total} new (${seen} already seen)`)
}

function buildQuery(account: SyncAccount, afterStr: string): string {
  return [
    'has:attachment',
    'filename:pdf',
    buildSenderClause(account),
    '(subject:statement OR subject:"credit card" OR subject:"bank statement" OR subject:"account statement")',
    `after:${afterStr}`,
  ].filter(Boolean).join(' ')
}

function passwordsForMessage(fromEmail: string, account?: SyncAccount): string[] {
  const rule = resolveSenderRule(fromEmail, account)
  if (!rule) return []
  return uniquePasswords(rule.passwords.map(name => process.env[name]))
}

async function syncAccount(
  account: SyncAccount,
  refreshToken: string,
  results: { scanned: number; parsed: number; inserted: number; skipped: number; errors: string[] },
) {
  const accessToken = await getAccessToken(refreshToken)

  // First sync: fetch from Jan 2024. Subsequent syncs: from last sync date minus 7 days.
  // The 7-day overlap catches late-arriving emails; message-ID dedup below ensures
  // nothing in that window is processed twice.
  const { data: lastSyncRow } = await supabase
    .from('settings')
    .select('value')
    .eq('key', `gmail_last_sync_at_${account}`)
    .single()

  const afterDate = lastSyncRow?.value
    ? (() => { const d = new Date(lastSyncRow.value); d.setDate(d.getDate() - 7); return d })()
    : new Date('2024-01-01')

  const afterStr = [
    afterDate.getFullYear(),
    String(afterDate.getMonth() + 1).padStart(2, '0'),
    String(afterDate.getDate()).padStart(2, '0'),
  ].join('/')

  const query = buildQuery(account, afterStr)

  const messageRefs = await searchMessages(accessToken, query, 500)
  logFound(account, messageRefs.length, afterStr)
  results.scanned += messageRefs.length

  // Filter out already-processed message IDs so we never re-download them.
  // A message is only recorded after successful extraction; password failures
  // are NOT recorded so fixing the password in .env.local and re-syncing retries them.
  const allIds = messageRefs.map(r => r.id)
  let newRefs = messageRefs
  if (allIds.length > 0) {
    const { data: seen } = await supabase
      .from('gmail_synced_messages')
      .select('message_id')
      .in('message_id', allIds)
    const seenSet = new Set((seen ?? []).map(r => r.message_id as string))
    newRefs = messageRefs.filter(r => !seenSet.has(r.id))
  }

  logSeen(account, newRefs.length, messageRefs.length - newRefs.length)
  const seenIds: string[] = [] // message IDs to mark as done after this sync

  for (const ref of newRefs) {
    let msg
    try {
      msg = await getMessage(accessToken, ref.id)
    } catch {
      continue // transient error — don't mark as seen, will retry next sync
    }
 
    if (!msg || msg.pdfParts.length === 0) {
      seenIds.push(ref.id) // not a statement email, no point revisiting
      results.skipped++
      continue
    }
    const rule = resolveSenderRule(msg.fromEmail, account)
    logProcessing(account, msg.subject, msg.from, rule)

    if (rule?.key === 'icici_bank' && isAnnualIciciStatement(msg.subject)) {
      console.log(`[gmail:${account}] skipping annual ICICI statement "${msg.subject}"`)
      seenIds.push(ref.id)
      continue
    }

    let shouldRetry = false

    for (const part of msg.pdfParts) {
      let attachmentBytes: Buffer
      try {
        attachmentBytes = await downloadAttachment(accessToken, ref.id, part)
      } catch {
        results.errors.push(downloadFailureError(msg.subject, account))
        continue
      }

      let text = ''
      try {
        text = await extractTextFromPdf(clonePdfBytes(attachmentBytes))
      } catch (err: unknown) {
        const e = err as { name?: string }
        if (e.name === 'PasswordException') {
          const passwords = passwordsForMessage(msg.fromEmail, account)
          if (passwords.length === 0) {
            results.errors.push(passwordLookupError(msg.from, account))
            shouldRetry = true
            continue
          }
          let unlocked = false
          for (const pw of passwords) {
            try {
              text = await extractTextFromPdf(clonePdfBytes(attachmentBytes), pw, { logPasswordErrors: false })
              unlocked = true
              break
            } catch {
              // wrong password — try next
            }
          }
          if (!unlocked) {
            const msg2 = passwordMismatchError(msg.subject, msg.from, account)
            console.error(msg2)
            results.errors.push(msg2)
            shouldRetry = true
            continue
          }
        } else {
          const msg2 = extractionFailureError(msg.subject, account)
          console.error(msg2)
          results.errors.push(msg2)
          continue
        }
      }

      const parsed = parseStatement(text)
      if (!parsed) { results.skipped++; continue }

      results.parsed++
      logParsed(account, parsed.source, parsed.transactions.length, rule)
      if (parsed.transactions.length === 0) {
        // A recognised statement with 0 transactions almost always means a parser/format
        // mismatch. Don't mark as seen so a fixed parser can pick it up on the next sync.
        const preview = text.split('\n').map(l => l.trim()).filter(Boolean).slice(0, 80).join('\n')
        console.warn(`[gmail:${account}] 0 transactions from ${parsed.source} — first 80 lines:\n${preview}`)
        results.errors.push(parseFailureError(parsed.source, account))
        shouldRetry = true // don't mark as seen — retry next sync after parser fix
        continue
      }
      const { transactions } = parsed

      const dates = transactions.map(t => t.date).sort()
      const refDate = new Date(dates[dates.length - 1] ?? new Date().toISOString())
      const statementMonth = refDate.getMonth() + 1
      const statementYear = refDate.getFullYear()

      const rows = transactions.map(t => ({
        date: t.date,
        description: t.description,
        amount: t.amount,
        type: t.type,
        category: t.category,
        source: t.source,
        source_file_name: sanitizeSourceFileName(part.filename, msg.subject),
        card_holder: t.cardHolder,
        statement_month: statementMonth,
        statement_year: statementYear,
      }))

      const { data, error } = await supabase
        .from('transactions')
        .upsert(rows, { onConflict: 'date,amount,description,source', ignoreDuplicates: true })
        .select('id')

      if (error) {
        results.errors.push(dbFailureError(parsed.source, account, error.message))
      } else {
        results.inserted += data?.length ?? 0
      }
    }

    // Mark as seen unless: password error (user can fix and re-sync), or 0 transactions
    // from a recognised source (parser may have been broken — will retry next sync).
    if (!shouldRetry) seenIds.push(ref.id)
  }

  // Persist seen message IDs in a single batch
  if (seenIds.length > 0) {
    await supabase
      .from('gmail_synced_messages')
      .upsert(
        seenIds.map(id => ({ message_id: id, account })),
        { ignoreDuplicates: true },
      )
  }

  await supabase
    .from('settings')
    .upsert({ key: `gmail_last_sync_at_${account}`, value: new Date().toISOString() })
}

export async function POST() {
  const { data: tokenRows } = await supabase
    .from('settings')
    .select('key, value')
    .in('key', ['gmail_refresh_token_self', 'gmail_refresh_token_spouse'])

  const getToken = (account: string) =>
    tokenRows?.find(r => r.key === `gmail_refresh_token_${account}`)?.value ?? null

  const selfToken = getToken('self')
  const spouseToken = getToken('spouse')

  if (!selfToken && !spouseToken) {
    return NextResponse.json({ error: 'No Gmail accounts connected' }, { status: 401 })
  }

  const results = { scanned: 0, parsed: 0, inserted: 0, skipped: 0, errors: [] as string[] }

  if (selfToken) {
    try {
      await syncAccount('self', selfToken, results)
    } catch (err: unknown) {
      results.errors.push(`[self] ${(err as Error).message}`)
    }
  }

  if (spouseToken) {
    try {
      await syncAccount('spouse', spouseToken, results)
    } catch (err: unknown) {
      results.errors.push(`[spouse] ${(err as Error).message}`)
    }
  }

  return NextResponse.json(results)
}
