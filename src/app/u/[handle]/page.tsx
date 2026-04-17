'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

export default function ArcProfile({ params }: { params: { handle: string } }) {
  const [xUser, setXUser] = useState<{id:string,username:string,name:string,avatar:string}|null>(null)
  const [walletAddress, setWalletAddress] = useState('')
  const [copied, setCopied] = useState(false)
  const [isOwner, setIsOwner] = useState(false)

  const handle = params.handle.toLowerCase()

  useEffect(() => {
    // Cookie'den X kullanıcısını al
    const cookie = document.cookie.split(';').find(c => c.trim().startsWith('arc_x_user='))
    if (cookie) {
      try {
        const val = decodeURIComponent(cookie.split('=').slice(1).join('='))
        const user = JSON.parse(val)
        setXUser(user)
        if (user.username.toLowerCase() === handle) setIsOwner(true)
      } catch {}
    }

    // localStorage'dan profil bilgilerini al
    const profiles = JSON.parse(localStorage.getItem('arc_profiles') || '{}')
    if (profiles[handle]) {
      setWalletAddress(profiles[handle].address || '')
    }
  }, [handle])

  const saveWallet = () => {
    if (!walletAddress) return
    const profiles = JSON.parse(localStorage.getItem('arc_profiles') || '{}')
    profiles[handle] = { ...profiles[handle], address: walletAddress, username: xUser?.username, avatar: xUser?.avatar, name: xUser?.name }
    localStorage.setItem('arc_profiles', JSON.stringify(profiles))
    alert('Wallet saved!')
  }

  const copyAddress = () => {
    navigator.clipboard.writeText(walletAddress)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
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
      <style>{`@keyframes sweep{from{transform:rotate(0)}to{transform:rotate(360deg)}}`}</style>

      {/* NAVBAR */}
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

      <div style={{ maxWidth: 520, margin: '0 auto', padding: '40px 20px' }}>

        {/* PROFİL KARTI */}
        <div style={{ background: '#0e0e0e', border: '1px solid #1a1a1a', borderRadius: 24, padding: 32, marginBottom: 20, textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: 'linear-gradient(90deg,#c9a84c,#a07830,#c9a84c)' }} />

          {/* AVATAR */}
          <div style={{ position: 'relative', width: 80, height: 80, margin: '0 auto 16px' }}>
            <div style={{ position: 'absolute', inset: -2, borderRadius: '50%', background: 'conic-gradient(transparent 0deg,#c9a84c 60deg,transparent 120deg)', animation: 'sweep 3s linear infinite', opacity: .6 }} />
            <div style={{ position: 'absolute', inset: 1, borderRadius: '50%', background: '#0e0e0e' }} />
            {xUser?.avatar && isOwner ? (
              <img src={xUser.avatar} alt="" style={{ position: 'absolute', inset: 2, width: 'calc(100% - 4px)', height: 'calc(100% - 4px)', borderRadius: '50%', objectFit: 'cover' }} />
            ) : (
              <div style={{ position: 'absolute', inset: 2, borderRadius: '50%', background: 'linear-gradient(135deg,#c9a84c,#a07830)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, fontWeight: 800, color: '#000' }}>
                {handle[0].toUpperCase()}
              </div>
            )}
          </div>

          <div style={{ fontSize: 22, fontWeight: 800, color: '#fff', marginBottom: 4 }}>
            {isOwner && xUser ? xUser.name : `@${handle}`}
          </div>
          <div style={{ fontSize: 13, color: '#c9a84c', fontWeight: 700, marginBottom: 8 }}>@{handle}</div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, marginBottom: 20 }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#4ade80' }} />
            <span style={{ fontSize: 11, color: '#555' }}>Arc Network</span>
          </div>

          {/* CÜZDAN ADRESİ */}
          {walletAddress ? (
            <div style={{ background: '#080808', border: '1px solid #1a1a1a', borderRadius: 12, padding: '12px 16px', marginBottom: 16 }}>
              <div style={{ fontSize: 9, color: '#555', fontWeight: 700, letterSpacing: '.4px', marginBottom: 6 }}>WALLET ADDRESS</div>
              <div style={{ fontSize: 12, color: '#888', fontFamily: 'monospace', wordBreak: 'break-all', marginBottom: 8 }}>{walletAddress}</div>
              <button onClick={copyAddress} style={{ fontSize: 11, padding: '6px 16px', background: copied ? '#0a1a0a' : '#111', border: `1px solid ${copied ? '#1a3a1a' : '#222'}`, borderRadius: 8, color: copied ? '#4ade80' : '#666', cursor: 'pointer', fontWeight: 700 }}>
                {copied ? '✓ Copied!' : 'Copy Address'}
              </button>
            </div>
          ) : (
            <div style={{ background: '#080808', border: '1px solid #1a1a1a', borderRadius: 12, padding: '12px 16px', marginBottom: 16 }}>
              <div style={{ fontSize: 12, color: '#333' }}>No wallet connected yet</div>
            </div>
          )}

          {/* ÖDEME BUTONU */}
          {walletAddress && (
            <Link href={`/pay/${handle}`} style={{ display: 'block', padding: '13px', background: 'linear-gradient(135deg,#c9a84c,#a07830)', color: '#000', borderRadius: 14, fontSize: 14, fontWeight: 800, textDecoration: 'none', marginBottom: 10 }}>
              Send USDC to @{handle} →
            </Link>
          )}

          {/* X PAYLAŞ */}
          <button onClick={() => {
            const text = `Send me USDC instantly on Arc Network!\n\narc-payouts.vercel.app/u/${handle}\n\n#ArcNetwork #USDC`
            window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`, '_blank')
          }} style={{ width: '100%', padding: '10px', background: '#0a1628', border: '1px solid #1e3a5f', borderRadius: 12, color: '#60a5fa', fontSize: 12, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="#60a5fa"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.73-8.835L1.254 2.25H8.08l4.253 5.622 5.911-5.622zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
            Share on X
          </button>
        </div>

        {/* SAHİP PANELİ */}
        {isOwner && (
          <div style={{ background: '#0e0e0e', border: '1px solid #c9a84c33', borderRadius: 20, padding: 24 }}>
            <div style={{ fontSize: 11, color: '#c9a84c', fontWeight: 700, letterSpacing: '.4px', marginBottom: 16 }}>⚙ YOUR PROFILE SETTINGS</div>
            <div style={{ fontSize: 11, color: '#555', marginBottom: 8 }}>WALLET ADDRESS</div>
            <input
              value={walletAddress}
              onChange={e => setWalletAddress(e.target.value)}
              placeholder="0x... your wallet address"
              style={{ width: '100%', padding: '12px 14px', background: '#080808', border: '1px solid #1a1a1a', borderRadius: 12, color: '#fff', fontSize: 13, outline: 'none', marginBottom: 12, boxSizing: 'border-box' }}
            />
            <button onClick={saveWallet} style={{ width: '100%', padding: 13, background: 'linear-gradient(135deg,#c9a84c,#a07830)', color: '#000', border: 'none', borderRadius: 12, fontSize: 13, fontWeight: 800, cursor: 'pointer' }}>
              Save Profile
            </button>
          </div>
        )}

      </div>
    </div>
  )
}