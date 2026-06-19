import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase/client'

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const code = searchParams.get('code')
  const error = searchParams.get('error')

  if (error || !code) {
    return NextResponse.redirect(new URL('/upload?gmail=error', req.url))
  }

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      redirect_uri: process.env.GMAIL_REDIRECT_URI!,
      grant_type: 'authorization_code',
    }),
  })

  if (!res.ok) return NextResponse.redirect(new URL('/upload?gmail=error', req.url))

  const { refresh_token } = await res.json()
  if (!refresh_token) {
    // Google only returns a refresh_token on first authorization; shouldn't happen with prompt=consent
    return NextResponse.redirect(new URL('/upload?gmail=error&reason=no_refresh_token', req.url))
  }

  const account = searchParams.get('state') === 'spouse' ? 'spouse' : 'self'
  const { error: dbError } = await supabase
    .from('settings')
    .upsert({ key: `gmail_refresh_token_${account}`, value: refresh_token })
  if (dbError) return NextResponse.redirect(new URL(`/upload?gmail=error&reason=${encodeURIComponent(dbError.message)}`, req.url))
  return NextResponse.redirect(new URL(`/upload?gmail=connected&account=${account}`, req.url))
}
