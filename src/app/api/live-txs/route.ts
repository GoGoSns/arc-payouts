import { NextRequest, NextResponse } from 'next/server'
import { Redis } from '@upstash/redis'

const redis = Redis.fromEnv()

export async function GET() {
  try {
    const txs = await redis.lrange('live_txs', 0, 9)
    const parsed = txs.map((t: any) => typeof t === 'string' ? JSON.parse(t) : t)
    return NextResponse.json({ txs: parsed })
  } catch {
    return NextResponse.json({ txs: [] })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { handle, to, amount, type } = body
    const tx = {
      id: Math.random().toString(36).slice(2),
      handle: handle || 'anon',
      to: to || '',
      amount: amount || '0',
      type: type || 'Send',
      time: 'just now'
    }
    await redis.lpush('live_txs', JSON.stringify(tx))
    await redis.ltrim('live_txs', 0, 19)
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}