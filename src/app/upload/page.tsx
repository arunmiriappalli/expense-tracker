'use client'

import { Suspense, useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { UploadDropzone } from '@/components/UploadDropzone'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

interface AccountStatus {
  connected: boolean
  lastSyncAt: string | null
}

function ConnectButton({ account, label, status }: { account: 'self' | 'spouse'; label: string; status: AccountStatus | null }) {
  const lastSync = status?.lastSyncAt
    ? new Date(status.lastSyncAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })
    : null

  return (
    <div className="flex items-center justify-between py-1">
      <div>
        <p className="text-sm font-medium text-gray-800">{label}</p>
        {lastSync && <p className="text-xs text-gray-400">Last synced {lastSync}</p>}
        {status?.connected && !lastSync && <p className="text-xs text-gray-400">Never synced</p>}
      </div>
      <a
        href={`/api/gmail/auth?account=${account}`}
        className={`text-xs font-medium px-3 py-1.5 rounded-lg transition-colors ${
          status?.connected
            ? 'bg-green-50 text-green-700 hover:bg-green-100'
            : 'bg-gray-900 text-white hover:bg-gray-700'
        }`}
      >
        {status?.connected ? 'Reconnect' : 'Connect'}
      </a>
    </div>
  )
}

function GmailSection() {
  const searchParams = useSearchParams()
  const [status, setStatus] = useState<{ self: AccountStatus; spouse: AccountStatus } | null>(null)
  const [syncing, setSyncing] = useState(false)
  const [syncResult, setSyncResult] = useState<{
    scanned: number; parsed: number; inserted: number; skipped: number; errors: string[]
  } | null>(null)
  const [flashMsg, setFlashMsg] = useState<string | null>(null)

  useEffect(() => {
    const gmailParam = searchParams.get('gmail')
    const accountParam = searchParams.get('account')
    if (gmailParam === 'connected') {
      setFlashMsg(`${accountParam === 'spouse' ? "Spouse's" : 'Your'} Gmail connected successfully.`)
    }
    if (gmailParam === 'error') {
      setFlashMsg('Gmail connection failed — check your Google Cloud credentials.')
    }

    fetch('/api/gmail/status')
      .then(r => r.json())
      .then(setStatus)
      .catch(() => setStatus({ self: { connected: false, lastSyncAt: null }, spouse: { connected: false, lastSyncAt: null } }))
  }, [searchParams])

  async function handleSync() {
    setSyncing(true)
    setSyncResult(null)
    try {
      const res = await fetch('/api/gmail/sync', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) {
        setFlashMsg(data.error ?? 'Sync failed')
      } else {
        setSyncResult(data)
        // Refresh last-sync timestamps
        fetch('/api/gmail/status').then(r => r.json()).then(setStatus).catch(() => {})
      }
    } catch {
      setFlashMsg('Sync failed — check the server logs.')
    } finally {
      setSyncing(false)
    }
  }

  const anyConnected = status?.self.connected || status?.spouse.connected

  return (
    <Card>
      <CardHeader className="pb-2 pt-4">
        <CardTitle className="text-sm text-gray-500 font-medium">Sync from Gmail</CardTitle>
      </CardHeader>
      <CardContent className="pb-4 space-y-3">
        {flashMsg && (
          <p className="text-sm px-3 py-2 rounded-lg bg-blue-50 text-blue-700">{flashMsg}</p>
        )}

        {status === null ? (
          <p className="text-sm text-gray-400">Checking Gmail connections…</p>
        ) : (
          <div className="divide-y divide-gray-100">
            <ConnectButton account="self" label="Your Gmail" status={status.self} />
            <ConnectButton account="spouse" label="Spouse's Gmail" status={status.spouse} />
          </div>
        )}

        {anyConnected && (
          <div className="space-y-2 pt-1">
            <button
              onClick={handleSync}
              disabled={syncing}
              className="inline-flex items-center gap-2 text-sm font-medium px-4 py-2 rounded-lg bg-gray-900 text-white hover:bg-gray-700 disabled:opacity-50 transition-colors"
            >
              {syncing ? 'Syncing…' : 'Sync both accounts'}
            </button>
            {syncResult && (
              <div className="text-sm space-y-1">
                <p className="text-gray-700">
                  Scanned <span className="font-medium">{syncResult.scanned}</span> emails →{' '}
                  <span className="font-medium">{syncResult.parsed}</span> statements →{' '}
                  <span className="font-medium text-green-700">{syncResult.inserted}</span> new transactions
                  {syncResult.skipped > 0 && <span className="text-gray-400"> · {syncResult.skipped} skipped</span>}
                </p>
                {syncResult.errors.length > 0 && (
                  <ul className="text-xs text-red-600 space-y-0.5 mt-1">
                    {syncResult.errors.map((e, i) => <li key={i}>{e}</li>)}
                  </ul>
                )}
              </div>
            )}
          </div>
        )}

        <p className="text-xs text-gray-400 border-t border-gray-100 pt-3">
          Only statement emails with PDF attachments are fetched. Gmail is accessed read-only; no emails are modified or deleted.
        </p>
      </CardContent>
    </Card>
  )
}

export default function UploadPage() {
  const router = useRouter()

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold text-gray-900">Upload Statement</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          PDF statements from ICICI, Axis, Union Bank, or Yes Bank
        </p>
      </div>

      <Card>
        <CardContent className="pt-5 pb-5">
          <UploadDropzone onComplete={() => setTimeout(() => router.push('/'), 1500)} />
        </CardContent>
      </Card>

      <Suspense fallback={null}>
        <GmailSection />
      </Suspense>

      <Card>
        <CardHeader className="pb-2 pt-4">
          <CardTitle className="text-sm text-gray-500 font-medium">How to export statements</CardTitle>
        </CardHeader>
        <CardContent className="pb-4 space-y-3 text-sm text-gray-600">
          <div>
            <p className="font-medium text-gray-800">ICICI Bank Account</p>
            <p>iMobile Pay → Account → Statements → Download PDF</p>
          </div>
          <div>
            <p className="font-medium text-gray-800">ICICI Credit Cards (Amazon / Emeralde)</p>
            <p>Email from ICICI → Statement PDF attachment · Or: iMobile Pay → Credit Card → Statements</p>
          </div>
          <div>
            <p className="font-medium text-gray-800">Axis Bank / Credit Cards</p>
            <p>Email from Axis → Statement PDF · Or: Axis Mobile → Statements</p>
          </div>
          <div>
            <p className="font-medium text-gray-800">Union Bank / Yes Bank</p>
            <p>Email from bank → Statement PDF attachment</p>
          </div>
          <div className="border-t border-gray-100 pt-3">
            <p className="text-xs text-gray-400">
              Statements are processed on-device and only transaction data is stored. PDFs are not retained.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
