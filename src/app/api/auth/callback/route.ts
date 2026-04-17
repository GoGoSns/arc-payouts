import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const code = searchParams.get('code')
  const error = searchParams.get('error')
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://arc-payouts.vercel.app'

  if (error) return NextResponse.redirect(`${appUrl}?auth_error=${error}`)
  if (!code) return NextResponse.redirect(`${appUrl}?auth_error=no_code`)

  try {
    const clientId = process.env.TWITTER_CLIENT_ID!
    const redirectUri = `${appUrl}/api/auth/callback`

    const body = new URLSearchParams({
      code,
      grant_type: 'authorization_code',
      redirect_uri: redirectUri,
      code_verifier: 'challenge',
      client_id: clientId,
    })

    const tokenResponse = await fetch('https://api.twitter.com/2/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    })

    const tokenText = await tokenResponse.text()
    console.log('Token response:', tokenText)

    if (!tokenResponse.ok) {
      console.error('Token error:', tokenText)
      return NextResponse.redirect(`${appUrl}?auth_error=token_failed`)
    }

    const tokenData = JSON.parse(tokenText)
    const accessToken = tokenData.access_token

    const userResponse = await fetch(
      'https://api.twitter.com/2/users/me?user.fields=username,name,profile_image_url',
      { headers: { Authorization: `Bearer ${accessToken}` } }
    )

    if (!userResponse.ok) {
      return NextResponse.redirect(`${appUrl}?auth_error=user_fetch_failed`)
    }

    const userData = await userResponse.json()
    const user = userData.data
    // Redis'e profil kaydet (address olmadan)
    try {
      const { Redis } = await import('@upstash/redis')
      const redis = Redis.fromEnv()
      const cleanHandle = user.username.toLowerCase()
      const existing = await redis.get(`profile:${cleanHandle}`) as any
      const profile = {
        handle: cleanHandle,
        address: existing?.address || '',
        name: user.name,
        avatar: user.profile_image_url?.replace('_normal', '_bigger') || '',
        username: user.username,
        updatedAt: new Date().toISOString(),
      }
      await redis.set(`profile:${cleanHandle}`, JSON.stringify(profile))
    } catch (e) {
      console.error('Redis save error:', e)
    }
    // Profil sayfasına yönlendir
    const response = NextResponse.redirect(`${appUrl}/u/${user.username.toLowerCase()}`)

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