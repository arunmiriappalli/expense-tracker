import { NextRequest, NextResponse } from 'next/server'

export function GET(req: NextRequest) {
  const account = req.nextUrl.searchParams.get('account') === 'spouse' ? 'spouse' : 'self'
  const url = new URL('https://accounts.google.com/o/oauth2/v2/auth')
  url.searchParams.set('client_id', process.env.GOOGLE_CLIENT_ID!)
  url.searchParams.set('redirect_uri', process.env.GMAIL_REDIRECT_URI!)
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('scope', 'https://www.googleapis.com/auth/gmail.readonly')
  url.searchParams.set('access_type', 'offline')
  url.searchParams.set('prompt', 'consent') // required to always get a refresh_token
  url.searchParams.set('state', account) // passed back unchanged by Google
  return NextResponse.redirect(url.toString())
}
