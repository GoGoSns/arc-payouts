'use client'

import { useState, useEffect, use } from 'react'
import Link from 'next/link'

export default function PayPage({ params }: { params: Promise<{ username: string }> }) {
  const { username } = use(params)
  const handle = username.toLowerCase()

  const [walletAddress, setWalletAddress] = useState('')
  const [xProfile, setXProfile] = useState<{name:string,avatar:string}|null>(null)
  const [amount, setAmount] = useState('')
  const [paying, setPaying] = useState(false)
  const [txHash, setTxHash] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    const profiles = JSON.parse(localStorage.getItem('arc_profiles') || '{}')
    if (profiles[handle]) {
      setWalletAddress(profiles[handle].address || '')
      setXProfile({ name: profiles[handle].name || handle, avatar: profiles[handle].avatar || '' })
    }
  }, [handle])

  const sendUSDC = async () => {
    if (!amount || !walletAddress) return
    setPaying(true); setError(''); setTxHash('')
    try {
      const { AppKit } = await import('@circle-fin/app-kit')
      const { createViemAdapterFromProvider } = await import('@circle-fin/adapter-viem-v2')
      const kit = new AppKit()
      const adapter = await createViemAdapterFromProvider({ provider: (window as any).ethereum })
      const res = await kit.send({ from: { adapter, chain: 'Arc_Testnet' as never }, to: walletAddress, amount, token: 'USDC' })
      const hash = (res as any)?.hash || (res as any)?.txHash || ''
      setTxHash(hash)
    } catch (e: any) {
      setError(e.message)
    }
    setPaying(false)
  }

  const WavesLogo = () => (
    <svg width="18" height="18" viewBox="0 0 48 48" fill="none">
      <path d="M14 18 C14 18 24 10 34 18" stroke="#c9a84c" strokeWidth="2.5" fill="none" strokeLinecap="round"/>
      <path d="M14 24 C14 24 24 16 34 24" stroke="#c9a84c" strokeWidth="2.5" fill="none" strokeLinecap="round"/>
      <path d="M14 30 C14 30 24 22 34 30" stroke="#c9a84c" strokeWidth="2.5" fill="none" strokeLinecap="round"/>
    </svg>
  )

  return (
    <div style={{ minHeight: '100vh', background: '#0a0a0a', color: '#fff', fontFamily: '-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif' }}>
      <nav style={{ borderBottom: '1px solid #1a1a1a', padding: '12px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}>
          <div style={{ width: 32, height: 32, background: '#111', border: '1px solid #1e1e1e', borderRadius: 9, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <WavesLogo />
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 13, color: '#fff' }}>Arc Global Payouts</div>
            <div style={{ fontSize: 8, color: '#c9a84c', fontWeight: 700, letterSpacing: '.8px' }}>ARC NETWORK · by GoGo</div>
          </div>
        </Link>
        <Link href="/" style={{ fontSize: 11, color: '#555', textDecoration: 'none', padding: '5px 12px', background: '#111', border: '1px solid #1e1e1e', borderRadius: 8 }}>← Dashboard</Link>
      </nav>

      <div style={{ maxWidth: 440, margin: '0 auto', padding: '40px 20px' }}>
        <div style={{ background: '#0e0e0e', border: '1px solid #1a1a1a', borderRadius: 24, padding: 28, position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: 'linear-gradient(90deg,#c9a84c,#a07830,#c9a84c)' }} />

          {/* PROFİL */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 24 }}>
            {xProfile?.avatar ? (
              <img src={xProfile.avatar} alt="" style={{ width: 48, height: 48, borderRadius: '50%', border: '2px solid #c9a84c33' }} />
            ) : (
              <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'linear-gradient(135deg,#c9a84c,#a07830)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, fontWeight: 800, color: '#000' }}>
                {handle[0].toUpperCase()}
              </div>
            )}
            <div>
              <div style={{ fontSize: 16, fontWeight: 800, color: '#fff' }}>{xProfile?.name || handle}</div>
              <div style={{ fontSize: 12, color: '#c9a84c' }}>@{handle}</div>
            </div>
          </div>

          {!walletAddress ? (
            <div style={{ textAlign: 'center', padding: '20px 0' }}>
              <div style={{ fontSize: 14, color: '#444', marginBottom: 12 }}>This user hasn't connected a wallet yet</div>
              <Link href={`/u/${handle}`} style={{ fontSize: 12, color: '#c9a84c', textDecoration: 'none' }}>View Profile →</Link>
            </div>
          ) : (
            <>
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 10, color: '#555', fontWeight: 700, letterSpacing: '.4px', marginBottom: 6 }}>YOU PAY</div>
                <div style={{ background: '#080808', border: '1px solid #1a1a1a', borderRadius: 14, padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
                  <input type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0"
                    style={{ fontSize: 32, fontWeight: 300, flex: 1, background: 'transparent', border: 'none', color: '#fff', outline: 'none', letterSpacing: '-1px' }} />
                  <div style={{ background: '#141414', border: '1px solid #1a1a1a', borderRadius: 20, padding: '5px 11px', display: 'flex', alignItems: 'center', gap: 5 }}>
                    <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#6366f1' }} />
                    <span style={{ fontSize: 12, fontWeight: 700, color: '#fff' }}>USDC</span>
                  </div>
                </div>
              </div>

              <div style={{ background: '#080808', border: '1px solid #1a1a1a', borderRadius: 12, padding: '10px 14px', marginBottom: 16 }}>
                <div style={{ fontSize: 9, color: '#555', marginBottom: 4 }}>TO</div>
                <div style={{ fontSize: 11, color: '#666', fontFamily: 'monospace' }}>{walletAddress.slice(0, 10)}...{walletAddress.slice(-8)}</div>
              </div>

              {[10, 25, 50, 100].map(v => (
                <button key={v} onClick={() => setAmount(String(v))}
                  style={{ marginRight: 6, marginBottom: 12, padding: '5px 12px', background: amount === String(v) ? '#1a1500' : '#111', border: `1px solid ${amount === String(v) ? '#c9a84c' : '#1a1a1a'}`, borderRadius: 8, color: amount === String(v) ? '#c9a84c' : '#555', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
                  ${v}
                </button>
              ))}

              <button onClick={sendUSDC} disabled={paying || !amount}
                style={{ width: '100%', padding: 14, background: paying ? '#333' : 'linear-gradient(135deg,#c9a84c,#a07830)', color: paying ? '#666' : '#000', border: 'none', borderRadius: 14, fontSize: 14, fontWeight: 800, cursor: paying ? 'default' : 'pointer' }}>
                {paying ? 'Sending...' : `Send ${amount || '0'} USDC to @${handle}`}
              </button>

              {error && <div style={{ marginTop: 12, padding: 12, background: '#1a0a0a', border: '1px solid #3a1a1a', borderRadius: 10, fontSize: 12, color: '#f87171' }}>{error}</div>}

              {txHash && (
                <div style={{ marginTop: 12, padding: 12, background: '#0a1a0a', border: '1px solid #1a3a1a', borderRadius: 10 }}>
                  <div style={{ fontSize: 12, color: '#4ade80', fontWeight: 700, marginBottom: 4 }}>✓ Sent!</div>
                  <a href={`https://testnet.arcscan.app/tx/${txHash}`} target="_blank" rel="noopener noreferrer" style={{ fontSize: 11, color: '#c9a84c' }}>View on ArcScan →</a>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}