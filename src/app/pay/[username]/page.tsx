'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useAccount, useConnect } from 'wagmi'
import { injected } from 'wagmi/connectors'

const WALLET_MAP: Record<string, { address: string; name: string; bio?: string }> = {
  'gogo': {
    address: '0xB87B7e8a3dE8cD1a6F3d3f3D3F3d3f3D3f3D3f3D',
    name: 'GoGo',
    bio: 'Arc Global Payouts · Builder on Arc Network 🌐',
  },
}

const WavesLogo = ({ size = 20 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 48 48" fill="none">
    <path d="M14 18 C14 18 24 10 34 18" stroke="#c9a84c" strokeWidth="2.5" fill="none" strokeLinecap="round"/>
    <path d="M14 24 C14 24 24 16 34 24" stroke="#c9a84c" strokeWidth="2.5" fill="none" strokeLinecap="round"/>
    <path d="M14 30 C14 30 24 22 34 30" stroke="#c9a84c" strokeWidth="2.5" fill="none" strokeLinecap="round"/>
  </svg>
)

export default function PayPage({ params }: { params: { username: string } }) {
  const username = params.username.toLowerCase()
  const profile = WALLET_MAP[username]
  const { address, isConnected } = useAccount()
  const { connect } = useConnect()

  const [amount, setAmount] = useState('')
  const [message, setMessage] = useState('')
  const [paying, setPaying] = useState(false)
  const [txResult, setTxResult] = useState<{ txHash: string } | null>(null)
  const [copied, setCopied] = useState(false)

  const connectWallet = () => connect({ connector: injected() })

  const sendPayment = async () => {
    if (!amount || !profile) return
    setPaying(true)
    try {
      const { AppKit } = await import('@circle-fin/app-kit')
      const { createViemAdapterFromProvider } = await import('@circle-fin/adapter-viem-v2')
      const kit = new AppKit()
      const adapter = await createViemAdapterFromProvider({ provider: (window as any).ethereum })
      const res = await kit.send({
        from: { adapter, chain: 'Arc_Testnet' as never },
        to: profile.address,
        amount,
        token: 'USDC',
      })
      const txHash = (res as any)?.hash || (res as any)?.txHash || ''
      const stored = localStorage.getItem('arc_transactions')
      const existing = stored ? JSON.parse(stored) : []
      localStorage.setItem('arc_transactions', JSON.stringify([
        { id: Math.random().toString(36).slice(2), name: `Payment to @${username}`, address: profile.address, amount, txHash, timestamp: new Date().toISOString() },
        ...existing
      ]))
      setTxResult({ txHash })
      setAmount('')
      setMessage('')
    } catch (e: any) {
      alert('Error: ' + e.message)
    }
    setPaying(false)
  }

  const copyLink = () => {
    navigator.clipboard.writeText(window.location.href)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const shareOnTwitter = () => {
    const text = `Send me USDC instantly on Arc Network! ⚡\n\n${window.location.href}\n\nNo signup. No KYC. Just connect & send.\n#ArcNetwork #USDC`
    window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`, '_blank')
  }

  if (!profile) {
    return (
      <div style={{ minHeight:'100vh', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', background:'#080808', fontFamily:'-apple-system,sans-serif' }}>
        <style>{`@keyframes sweep{from{transform:rotate(0)}to{transform:rotate(360deg)}}`}</style>
        <div style={{ position:'relative', width:60, height:60, marginBottom:20 }}>
          <div style={{ position:'absolute', inset:-1, borderRadius:14, background:'conic-gradient(transparent 0deg,#c9a84c 60deg,transparent 120deg)', animation:'sweep 3s linear infinite', opacity:.5 }} />
          <div style={{ position:'absolute', inset:1, background:'#111', borderRadius:13, display:'flex', alignItems:'center', justifyContent:'center' }}>
            <WavesLogo size={28} />
          </div>
        </div>
        <h1 style={{ fontSize:22, fontWeight:800, color:'#fff', marginBottom:8 }}>Profile not found</h1>
        <p style={{ fontSize:13, color:'#555', marginBottom:20 }}>@{username} does not exist on Arc Payouts</p>
        <Link href="/" style={{ fontSize:13, padding:'10px 20px', background:'linear-gradient(135deg,#c9a84c,#a07830)', color:'#000', borderRadius:10, textDecoration:'none', fontWeight:800 }}>
          Go to Dashboard →
        </Link>
      </div>
    )
  }

  return (
    <div style={{ minHeight:'100vh', display:'flex', flexDirection:'column', background:'#080808', color:'#fff', fontFamily:'-apple-system,sans-serif' }}>
      <style>{`@keyframes sweep{from{transform:rotate(0)}to{transform:rotate(360deg)}}`}</style>

      <nav style={{ borderBottom:'1px solid #111', padding:'12px 20px', display:'flex', alignItems:'center', justifyContent:'space-between', background:'#080808' }}>
        <Link href="/" style={{ display:'flex', alignItems:'center', gap:10, textDecoration:'none' }}>
          <div style={{ width:30, height:30, background:'#111', border:'1px solid #1e1e1e', borderRadius:8, display:'flex', alignItems:'center', justifyContent:'center' }}>
            <WavesLogo size={16} />
          </div>
          <div>
            <div style={{ fontSize:13, fontWeight:700, color:'#fff' }}>Arc Global Payouts</div>
            <div style={{ fontSize:8, color:'#c9a84c', fontWeight:700, letterSpacing:'.8px' }}>
              ARC NETWORK <span style={{ color:'#444' }}>· by GoGo</span>
            </div>
          </div>
        </Link>
        <div style={{ display:'flex', gap:8 }}>
          <button onClick={copyLink}
            style={{ fontSize:11, padding:'5px 12px', background:'#111', border:'1px solid #1e1e1e', borderRadius:8, color: copied?'#c9a84c':'#888', cursor:'pointer', fontWeight: copied?700:400 }}>
            {copied ? '✓ Copied!' : 'Copy Link'}
          </button>
          <button onClick={shareOnTwitter}
            style={{ fontSize:11, padding:'5px 12px', background:'#0a1628', border:'1px solid #1e3a5f', borderRadius:8, color:'#60a5fa', cursor:'pointer', fontWeight:700 }}>
            𝕏 Share
          </button>
        </div>
      </nav>

      <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', padding:'32px 20px' }}>
        <div style={{ width:'100%', maxWidth:400 }}>

          <div style={{ background:'#0e0e0e', border:'1px solid #1a1a1a', borderRadius:20, padding:'24px 20px', marginBottom:12, textAlign:'center' }}>
            <div style={{ position:'relative', width:64, height:64, margin:'0 auto 14px' }}>
              <div style={{ position:'absolute', inset:-1, borderRadius:'50%', background:'conic-gradient(transparent 0deg,#c9a84c 60deg,transparent 120deg)', animation:'sweep 3s linear infinite', opacity:.6 }} />
              <div style={{ position:'absolute', inset:2, borderRadius:'50%', background:'linear-gradient(135deg,#1a1500,#2a2500)', display:'flex', alignItems:'center', justifyContent:'center' }}>
                <WavesLogo size={28} />
              </div>
            </div>
            <h1 style={{ fontSize:20, fontWeight:800, color:'#fff', marginBottom:4 }}>@{username}</h1>
            <p style={{ fontSize:12, color:'#c9a84c', fontWeight:600, marginBottom:6 }}>{profile.name}</p>
            {profile.bio && <p style={{ fontSize:11, color:'#555', lineHeight:1.6, marginBottom:10 }}>{profile.bio}</p>}
            <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:6 }}>
              <div style={{ width:6, height:6, borderRadius:'50%', background:'#c9a84c' }}></div>
              <span style={{ fontSize:10, color:'#666' }}>Arc Testnet</span>
            </div>
          </div>

          {!txResult ? (
            <div style={{ background:'#0e0e0e', border:'1px solid #1a1a1a', borderRadius:20, padding:20 }}>
              <div style={{ fontSize:9, color:'#444', fontWeight:700, letterSpacing:'.4px', marginBottom:6 }}>AMOUNT</div>
              <div style={{ background:'#080808', border:'1px solid #181818', borderRadius:12, padding:'11px 14px', marginBottom:10 }}>
                <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                  <input type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0"
                    style={{ fontSize:30, fontWeight:300, flex:1, background:'transparent', border:'none', color:'#fff', outline:'none', letterSpacing:'-1px' }} />
                  <div style={{ background:'#141414', border:'1px solid #222', borderRadius:20, padding:'5px 11px', display:'flex', alignItems:'center', gap:5 }}>
                    <div style={{ width:7, height:7, borderRadius:'50%', background:'#6366f1' }}></div>
                    <span style={{ fontSize:12, fontWeight:700, color:'#ddd' }}>USDC</span>
                  </div>
                </div>
                <div style={{ fontSize:9, color:'#333', marginTop:5 }}>Arc Testnet</div>
              </div>

              <div style={{ display:'flex', gap:6, marginBottom:12 }}>
                {['10','50','100','500'].map(a => (
                  <button key={a} onClick={() => setAmount(a)}
                    style={{ flex:1, padding:'6px 0', borderRadius:8, fontSize:11, fontWeight:700, border:'1px solid', cursor:'pointer',
                      borderColor: amount===a?'#c9a84c':'#1a1a1a',
                      background: amount===a?'#1a1500':'#080808',
                      color: amount===a?'#c9a84c':'#444',
                    }}>
                    ${a}
                  </button>
                ))}
              </div>

              <div style={{ fontSize:9, color:'#444', fontWeight:700, letterSpacing:'.4px', marginBottom:6 }}>MESSAGE (optional)</div>
              <input value={message} onChange={e => setMessage(e.target.value)} placeholder="Add a note..."
                style={{ width:'100%', background:'#080808', border:'1px solid #181818', borderRadius:10, padding:'10px 12px', fontSize:12, color:'#888', outline:'none', marginBottom:14, boxSizing:'border-box' }} />

              {amount && (
                <div style={{ background:'#080808', border:'1px solid #111', borderRadius:10, padding:'10px 12px', marginBottom:14 }}>
                  <div style={{ display:'flex', justifyContent:'space-between', fontSize:11, marginBottom:3 }}>
                    <span style={{ color:'#444' }}>Sending to</span>
                    <span style={{ color:'#888' }}>@{username}</span>
                  </div>
                  <div style={{ display:'flex', justifyContent:'space-between', fontSize:11, marginBottom:3 }}>
                    <span style={{ color:'#444' }}>Network fee</span>
                    <span style={{ color:'#666' }}>~0.009 USDC</span>
                  </div>
                  <div style={{ display:'flex', justifyContent:'space-between', fontSize:12, fontWeight:700, borderTop:'1px solid #141414', paddingTop:7, marginTop:5 }}>
                    <span style={{ color:'#fff' }}>Total</span>
                    <span style={{ color:'#c9a84c' }}>{amount} USDC</span>
                  </div>
                </div>
              )}

              {!isConnected ? (
                <button onClick={connectWallet}
                  style={{ width:'100%', padding:13, background:'linear-gradient(135deg,#c9a84c,#a07830)', color:'#000', border:'none', borderRadius:12, fontSize:13, fontWeight:800, cursor:'pointer' }}>
                  Connect Wallet to Send
                </button>
              ) : (
                <button onClick={sendPayment} disabled={!amount || paying}
                  style={{ width:'100%', padding:13,
                    background: (!amount||paying)?'#1a1a1a':'linear-gradient(135deg,#c9a84c,#a07830)',
                    color: (!amount||paying)?'#444':'#000',
                    border:'none', borderRadius:12, fontSize:13, fontWeight:800,
                    cursor: (!amount||paying)?'default':'pointer' }}>
                  {paying ? 'Sending...' : amount ? `Send ${amount} USDC to @${username}` : 'Enter amount'}
                </button>
              )}
              <div style={{ textAlign:'center', fontSize:10, color:'#222', marginTop:10 }}>
                Powered by Arc App Kit · Arc Testnet
              </div>
            </div>
          ) : (
            <div style={{ background:'#0e0e0e', border:'1px solid #1a3a1a', borderRadius:20, padding:'28px 20px', textAlign:'center' }}>
              <div style={{ width:60, height:60, borderRadius:'50%', background:'#0a1a0a', border:'2px solid #c9a84c', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 14px', fontSize:26, color:'#c9a84c' }}>✓</div>
              <h2 style={{ fontSize:18, fontWeight:800, color:'#fff', marginBottom:6 }}>Payment Sent!</h2>
              <p style={{ fontSize:12, color:'#555', marginBottom:16 }}>Successfully sent to @{username}</p>
              <p style={{ fontSize:10, color:'#444', fontFamily:'monospace', marginBottom:16, wordBreak:'break-all' }}>{txResult.txHash}</p>
              <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                <a href={`https://testnet.arcscan.app/tx/${txResult.txHash}`} target="_blank" rel="noopener noreferrer"
                  style={{ display:'block', padding:10, background:'#1a1500', border:'1px solid #2a2500', borderRadius:10, fontSize:12, color:'#c9a84c', textDecoration:'none', fontWeight:600 }}>
                  View on ArcScan →
                </a>
                <button onClick={() => setTxResult(null)}
                  style={{ padding:10, background:'#111', border:'1px solid #1e1e1e', borderRadius:10, fontSize:12, color:'#888', cursor:'pointer' }}>
                  Send Another Payment
                </button>
                <button onClick={() => {
                  const t = `Just sent USDC on Arc Network! ⚡\n\narc-payouts.vercel.app/pay/${username}\n\n#ArcNetwork #USDC`
                  window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(t)}`,'_blank')
                }} style={{ padding:10, background:'#0a1628', border:'1px solid #1e3a5f', borderRadius:10, fontSize:12, color:'#60a5fa', cursor:'pointer', fontWeight:700 }}>
                  𝕏 Share on Twitter
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <div style={{ textAlign:'center', padding:14, fontSize:10, color:'#1a1a1a', borderTop:'1px solid #111' }}>
        Arc Global Payouts · Built on Arc Network · by GoGo
      </div>
    </div>
  )
}