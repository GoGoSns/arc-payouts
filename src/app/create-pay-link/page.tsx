'use client'

import { useState } from 'react'
import Link from 'next/link'

export default function CreatePayLink() {
  const [handle, setHandle] = useState('')
  const [wallet, setWallet] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  const WavesLogo = () => (
    <svg width="18" height="18" viewBox="0 0 48 48" fill="none">
      <path d="M14 18 C14 18 24 10 34 18" stroke="#c9a84c" strokeWidth="2.5" fill="none" strokeLinecap="round"/>
      <path d="M14 24 C14 24 24 16 34 24" stroke="#c9a84c" strokeWidth="2.5" fill="none" strokeLinecap="round"/>
      <path d="M14 30 C14 30 24 22 34 30" stroke="#c9a84c" strokeWidth="2.5" fill="none" strokeLinecap="round"/>
    </svg>
  )

  const createLink = async () => {
    if (!handle || !wallet) { setError('Please fill all fields'); return }
    if (!/^[a-zA-Z0-9_-]+$/.test(handle)) { setError('Only letters, numbers, - and _ allowed'); return }
    setSaving(true); setError('')
    try {
      const res = await fetch('/api/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          handle: handle.toLowerCase(),
          address: wallet,
          name: handle,
          avatar: '',
          username: handle.toLowerCase(),
        })
      })
      if (res.ok) { setSaved(true) }
      else { setError('Something went wrong, try again') }
    } catch { setError('Network error') }
    setSaving(false)
  }

  const shareOnX = () => {
    const text = `Send me USDC instantly!\n\narc-payouts.vercel.app/pay/${handle.toLowerCase()}\n\n#ArcNetwork #USDC #Web3`
    window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`, '_blank')
  }

  return (
    <div style={{ minHeight:'100vh', background:'#0a0a0a', color:'#fff', fontFamily:'-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif', display:'flex', flexDirection:'column' }}>
      <style>{`@keyframes sweep{from{transform:rotate(0)}to{transform:rotate(360deg)}} @keyframes breathe{0%,100%{box-shadow:0 0 0 2px #c9a84c33}50%{box-shadow:0 0 0 4px #c9a84c88}}`}</style>

      <nav style={{ borderBottom:'1px solid #1a1a1a', padding:'12px 24px', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <Link href="/" style={{ display:'flex', alignItems:'center', gap:10, textDecoration:'none' }}>
          <div style={{ width:32, height:32, background:'#111', border:'1px solid #1e1e1e', borderRadius:9, display:'flex', alignItems:'center', justifyContent:'center' }}>
            <WavesLogo/>
          </div>
          <div>
            <div style={{ fontWeight:700, fontSize:13, color:'#fff' }}>Arc Global Payouts</div>
            <div style={{ fontSize:8, color:'#c9a84c', fontWeight:700, letterSpacing:'.8px' }}>ARC NETWORK · by GoGo</div>
          </div>
        </Link>
        <Link href="/" style={{ fontSize:11, color:'#555', textDecoration:'none', padding:'5px 12px', background:'#111', border:'1px solid #1a1a1a', borderRadius:8 }}>← Dashboard</Link>
      </nav>

      <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', padding:'24px 16px' }}>
        <div style={{ width:'100%', maxWidth:420, background:'#0e0e0e', border:'1px solid #1a1a1a', borderRadius:24, padding:28, position:'relative', overflow:'hidden' }}>
          <div style={{ position:'absolute', top:0, left:0, right:0, height:3, background:'linear-gradient(90deg,#c9a84c,#a07830,#c9a84c)' }}/>

          <div style={{ fontSize:22, fontWeight:800, marginBottom:6 }}>Create Pay Link</div>
          <div style={{ fontSize:12, color:'#555', marginBottom:24, display:'flex', alignItems:'center', gap:6 }}>
            <span style={{ width:5, height:5, borderRadius:'50%', background:'#4ade80', display:'inline-block' }}/>
            No X account needed. Completely anonymous.
          </div>

          {!saved ? (
            <>
              <div style={{ fontSize:9, fontWeight:700, letterSpacing:'.5px', color:'#444', marginBottom:6 }}>YOUR PAY LINK</div>
              <div style={{ background:'#080808', border:'1px solid #181818', borderRadius:12, padding:'11px 14px', marginBottom:12 }}>
                <div style={{ display:'flex', alignItems:'center', gap:0 }}>
                  <span style={{ fontSize:11, color:'#444', whiteSpace:'nowrap', flexShrink:0 }}>arc-payouts.vercel.app/pay/</span>
                  <input
                    value={handle}
                    onChange={e => { setHandle(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g,'')); setSaved(false) }}
                    placeholder="yourname"
                    maxLength={20}
                    style={{ fontSize:13, fontWeight:700, color:'#c9a84c', background:'transparent', border:'none', outline:'none', flex:1, minWidth:0 }}
                  />
                </div>
              </div>

              <div style={{ fontSize:9, fontWeight:700, letterSpacing:'.5px', color:'#444', marginBottom:6 }}>WALLET ADDRESS</div>
              <input
                value={wallet}
                onChange={e => setWallet(e.target.value)}
                placeholder="0x... your wallet address"
                style={{ width:'100%', padding:'11px 14px', background:'#080808', border:'1px solid #181818', borderRadius:12, color:'#fff', fontSize:12, outline:'none', marginBottom:10, boxSizing:'border-box' }}
              />

              <div style={{ background:'#0e0e0e', border:'1px solid #1a1a1a', borderRadius:10, padding:'10px 12px', marginBottom:16, display:'flex', alignItems:'flex-start', gap:8 }}>
                <div style={{ width:16, height:16, background:'#1a1500', border:'1px solid #2a2500', borderRadius:5, display:'flex', alignItems:'center', justifyContent:'center', fontSize:9, color:'#c9a84c', flexShrink:0, marginTop:1 }}>i</div>
                <div style={{ fontSize:10, color:'#555', lineHeight:1.6 }}>
                  Your wallet address will be visible to senders. Your identity stays anonymous — only your chosen name shows.
                </div>
              </div>

              {error && (
                <div style={{ padding:'10px 12px', background:'#1a0a0a', border:'1px solid #3a1a1a', borderRadius:10, fontSize:12, color:'#f87171', marginBottom:12 }}>{error}</div>
              )}

              <button onClick={createLink} disabled={saving || !handle || !wallet}
                style={{ width:'100%', padding:14, background:saving||!handle||!wallet?'#1a1a1a':'linear-gradient(135deg,#c9a84c,#a07830)', color:saving||!handle||!wallet?'#444':'#000', border:'none', borderRadius:14, fontSize:14, fontWeight:800, cursor:saving||!handle||!wallet?'default':'pointer', animation:handle&&wallet?'breathe 2.5s ease infinite':'none' }}>
                {saving ? 'Creating...' : 'Create My Pay Link →'}
              </button>
            </>
          ) : (
            <>
              <div style={{ background:'#0a1a0a', border:'1px solid #1a3a1a', borderRadius:14, padding:16, marginBottom:16, textAlign:'center' }}>
                <div style={{ fontSize:13, color:'#4ade80', fontWeight:700, marginBottom:8 }}>✓ Your pay link is ready!</div>
                <div style={{ fontSize:14, color:'#c9a84c', fontWeight:800, marginBottom:6 }}>arc-payouts.vercel.app/pay/{handle}</div>
                <button onClick={() => { navigator.clipboard.writeText(`https://arc-payouts.vercel.app/pay/${handle}`) }}
                  style={{ fontSize:11, padding:'6px 16px', background:'#111', border:'1px solid #1a3a1a', borderRadius:8, color:'#4ade80', cursor:'pointer', fontWeight:700 }}>
                  Copy Link
                </button>
              </div>

              <Link href={`/pay/${handle}`}
                style={{ display:'block', padding:'13px', background:'linear-gradient(135deg,#c9a84c,#a07830)', color:'#000', borderRadius:14, fontSize:14, fontWeight:800, textDecoration:'none', textAlign:'center', marginBottom:10 }}>
                Preview My Pay Page →
              </Link>

              <button onClick={shareOnX}
                style={{ width:'100%', padding:'11px', background:'#0a1628', border:'1px solid #1e3a5f', borderRadius:12, color:'#60a5fa', fontSize:12, fontWeight:700, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:6 }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="#60a5fa"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.73-8.835L1.254 2.25H8.08l4.253 5.622 5.911-5.622zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
                Share on X
              </button>

              <button onClick={() => { setHandle(''); setWallet(''); setSaved(false) }}
                style={{ width:'100%', padding:'10px', background:'transparent', border:'1px solid #1a1a1a', borderRadius:12, color:'#555', fontSize:12, cursor:'pointer', marginTop:8 }}>
                Create Another Link
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}