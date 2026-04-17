import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const clientId = process.env.TWITTER_CLIENT_ID!
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://arc-payouts.vercel.app'
  const redirectUri = `${appUrl}/api/auth/callback`

  // PKCE code verifier oluştur
  const codeVerifier = generateCodeVerifier()
  const codeChallenge = await generateCodeChallenge(codeVerifier)

  // State = base64(codeVerifier:randomString)
  const state = Buffer.from(`${codeVerifier}:${Math.random().toString(36)}`).toString('base64')

  // X OAuth 2.0 URL
  const authUrl = new URL('https://twitter.com/i/oauth2/authorize')
  authUrl.searchParams.set('response_type', 'code')
  authUrl.searchParams.set('client_id', clientId)
  authUrl.searchParams.set('redirect_uri', redirectUri)
  authUrl.searchParams.set('scope', 'tweet.read users.read offline.access')
  authUrl.searchParams.set('state', state)
  authUrl.searchParams.set('code_challenge', codeChallenge)
  authUrl.searchParams.set('code_challenge_method', 'S256')

  return NextResponse.redirect(authUrl.toString())
}

// PKCE helper fonksiyonları
function generateCodeVerifier(): string {
  const array = new Uint8Array(32)
  crypto.getRandomValues(array)
  return Buffer.from(array).toString('base64url')
}

async function generateCodeChallenge(verifier: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(verifier)
  const digest = await crypto.subtle.digest('SHA-256', data)
  return Buffer.from(digest).toString('base64url')
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
      profile: {
        handle: cleanHandle,
        address,
        name: name || cleanHandle,
        bio: bio || '',
        verified: false,
        createdAt: new Date().toISOString(),
      }
    })
  } catch (e) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }
}