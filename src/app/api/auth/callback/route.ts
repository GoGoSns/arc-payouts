import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const code = searchParams.get('code')
  const state = searchParams.get('state')
  const error = searchParams.get('error')

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://arc-payouts.vercel.app'

  if (error) {
    return NextResponse.redirect(`${appUrl}?auth_error=${error}`)
  }

  if (!code) {
    return NextResponse.redirect(`${appUrl}?auth_error=no_code`)
  }

  try {
    const clientId = process.env.TWITTER_CLIENT_ID!
    const clientSecret = process.env.TWITTER_CLIENT_SECRET!
    const redirectUri = `${appUrl}/api/auth/callback`

    let codeVerifier = ''
    if (state) {
      try {
        const decoded = Buffer.from(state, 'base64').toString('utf-8')
        codeVerifier = decoded.split(':')[0]
      } catch {
        codeVerifier = ''
      }
    }

    const tokenResponse = await fetch('https://api.twitter.com/2/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
      },
      body: new URLSearchParams({
        code,
        grant_type: 'authorization_code',
        redirect_uri: redirectUri,
        code_verifier: codeVerifier || 'challenge',
      }),
    })

    if (!tokenResponse.ok) {
      const errText = await tokenResponse.text()
      console.error('Token error:', errText)
      return NextResponse.redirect(`${appUrl}?auth_error=token_failed`)
    }

    const tokenData = await tokenResponse.json()
    const accessToken = tokenData.access_token

    const userResponse = await fetch(
      'https://api.twitter.com/2/users/me?user.fields=username,name,profile_image_url',
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    )

    if (!userResponse.ok) {
      return NextResponse.redirect(`${appUrl}?auth_error=user_fetch_failed`)
    }

    const userData = await userResponse.json()
    const user = userData.data

    const response = NextResponse.redirect(`${appUrl}?auth_success=true`)

    response.cookies.set(
      'arc_x_user',
      JSON.stringify({
        id: user.id,
        username: user.username,
        name: user.name,
        avatar: user.profile_image_url?.replace('_normal', '_bigger') || '',
      }),
      {
        maxAge: 60 * 60 * 24 * 7,
        httpOnly: false,
        secure: true,
        sameSite: 'lax',
        path: '/',
      }
    )

    return response
  } catch (err) {
    console.error('OAuth callback error:', err)
    return NextResponse.redirect(`${appUrl}?auth_error=unknown`)
  }
}