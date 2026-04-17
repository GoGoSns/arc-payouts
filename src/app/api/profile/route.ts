import { NextRequest, NextResponse } from 'next/server'
import { Redis } from '@upstash/redis'

const redis = Redis.fromEnv()

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const handle = searchParams.get('handle')?.toLowerCase()

  if (!handle) return NextResponse.json({ error: 'Handle required' }, { status: 400 })

  const profile = await redis.get(`profile:${handle}`)
  if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 })

  return NextResponse.json(profile)
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { handle, address, name, avatar, username } = body

    if (!handle || !address) return NextResponse.json({ error: 'Handle and address required' }, { status: 400 })

    const cleanHandle = handle.toLowerCase().replace('@', '')

    const profile = { handle: cleanHandle, address, name: name || cleanHandle, avatar: avatar || '', username: username || cleanHandle, updatedAt: new Date().toISOString() }

    await redis.set(`profile:${cleanHandle}`, JSON.stringify(profile))

    return NextResponse.json({ success: true, profile })
  } catch (e) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }
}