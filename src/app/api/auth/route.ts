import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const clientId = process.env.TWITTER_CLIENT_ID!
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://arc-payouts.vercel.app'
  const redirectUri = `${appUrl}/api/auth/callback`

  const state = Math.random().toString(36).slice(2)

  const authUrl = new URL('https://twitter.com/i/oauth2/authorize')
  authUrl.searchParams.set('response_type', 'code')
  authUrl.searchParams.set('client_id', clientId)
  authUrl.searchParams.set('redirect_uri', redirectUri)
  authUrl.searchParams.set('scope', 'tweet.read users.read offline.access')
  authUrl.searchParams.set('state', state)
  authUrl.searchParams.set('code_challenge', 'challenge')
  authUrl.searchParams.set('code_challenge_method', 'plain')

  return NextResponse.redirect(authUrl.toString())
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { handle, address, bio, name } = body
    if (!handle || !address) {
      return NextResponse.json({ error: 'Handle and address required' }, { status: 400 })
    }
    const cleanHandle = handle.toLowerCase().replace('@', '')
    return NextResponse.json({
      success: true,
      profile: { handle: cleanHandle, address, name: name || cleanHandle, bio: bio || '', verified: false, createdAt: new Date().toISOString() }
    })
  } catch (e) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }
}