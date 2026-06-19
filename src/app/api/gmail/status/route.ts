import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase/client'

export async function GET() {
  const { data: rows } = await supabase
    .from('settings')
    .select('key, value')
    .in('key', [
      'gmail_refresh_token_self',
      'gmail_refresh_token_spouse',
      'gmail_last_sync_at_self',
      'gmail_last_sync_at_spouse',
    ])

  const get = (key: string) => rows?.find(r => r.key === key)?.value ?? null

  return NextResponse.json({
    self: {
      connected: !!get('gmail_refresh_token_self'),
      lastSyncAt: get('gmail_last_sync_at_self'),
    },
    spouse: {
      connected: !!get('gmail_refresh_token_spouse'),
      lastSyncAt: get('gmail_last_sync_at_spouse'),
    },
  })
}
