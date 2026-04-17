'use client'
import { useState, useEffect, use } from 'react'
import Link from 'next/link'

const CSS = `
@keyframes sweep{from{transform:rotate(0)}to{transform:rotate(360deg)}}
@keyframes spin{to{transform:rotate(360deg)}}
@keyframes pulse{0%,100%{opacity:1}50%{opacity:.3}}
`

function Spinner() {
  return <span style={{ display:'inline-block', width:14, height:14, border:'2px solid #333', borderTopColor:'#c9a84c', borderRadius:'50%', animation:'spin .7s linear infinite' }}/>
}

function WavesLogo({ size=18 }: { size?:number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none">
      <path d="M14 18 C14 18 24 10 34 18" stroke="#c9a84c" strokeWidth="2.5" fill="none" strokeLinecap="round"/>
      <path d="M14 24 C14 24 24 16 34 24" stroke="#c9a84c" strokeWidth="2.5" fill="none" strokeLinecap="round"/>
      <path d="M14 30 C14 30 24 22 34 30" stroke="#c9a84c" strokeWidth="2.5" fill="none" strokeLinecap="round"/>
    </svg>
  )
}

export default function PayPage({ params }: { params: Promise<{ username: string }> }) {
  const { username } = use(params)
  const handle = username.toLowerCase()

  const [walletAddress, setWalletAddress] = useState('')
  const [profile, setProfile] = useState<{ name: string; avatar: string } | null>(null)
  const [amount, setAmount] = useState('')
  const [paying, setPaying] = useState(false)
  const [txHash, setTxHash] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`/api/profile?handle=${handle}`)
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data?.address) {
          setWalletAddress(data.address)
          setProfile({ name: data.name || handle, avatar: data.avatar || '' })
        }
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [handle])

  const send = async () => {
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
      setAmount('')
    } catch (e: any) {
      setError(e.message)
    }
    setPaying(false)
  }

  const initials = (profile?.name || handle).slice(0, 1).toUpperCase()

  return (
    <div style={{ minHeight:'100vh', background:'#0a0a0a', color:'#fff', fontFamily:'-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif', display:'flex', flexDirection:'column' }}>
      <style>{CSS}</style>

      {/* NAV */}
      <nav style={{ borderBottom:'1px solid #141414', padding:'11px 20px', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <Link href="/" style={{ display:'flex', alignItems:'center', gap:8, textDecoration:'none' }}>
          <div style={{ width:28, height:28, background:'#111', border:'1px solid #1e1e1e', borderRadius:8, display:'flex', alignItems:'center', justifyContent:'center' }}>
            <WavesLogo size={16}/>
          </div>
          <span style={{ fontSize:12, fontWeight:700, color:'#fff' }}>Arc Global Payouts</span>
        </Link>
        <Link href="/" style={{ fontSize:11, color:'#444', textDecoration:'none', padding:'4px 10px', background:'#111', border:'1px solid #1a1a1a', borderRadius:7 }}>← Dashboard</Link>
      </nav>

      {/* MAIN */}
      <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', padding:'32px 16px' }}>

        {loading ? (
          <div style={{ display:'flex', alignItems:'center', gap:8, color:'#444', fontSize:13 }}>
            <Spinner/> Loading...
          </div>
        ) : !walletAddress ? (
          <div style={{ textAlign:'center' }}>
            <div style={{ fontSize:32, marginBottom:12, opacity:.2 }}>?</div>
            <div style={{ fontSize:14, color:'#444' }}>@{handle} hasn't set up their pay link yet.</div>
            <Link href="/" style={{ display:'inline-block', marginTop:16, fontSize:12, color:'#c9a84c', textDecoration:'none' }}>Create yours →</Link>
          </div>
        ) : (
          <div style={{ width:'100%', maxWidth:400 }}>

            {/* Profile mini */}
            <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:28, justifyContent:'center' }}>
              {profile?.avatar ? (
                <img src={profile.avatar} alt="" style={{ width:48, height:48, borderRadius:'50%', border:'2px solid #c9a84c33' }}/>
              ) : (
                <div style={{ width:48, height:48, borderRadius:'50%', background:'linear-gradient(135deg,#c9a84c,#a07830)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:20, fontWeight:800, color:'#000' }}>{initials}</div>
              )}
              <div>
                <div style={{ fontSize:16, fontWeight:700, color:'#fff' }}>{profile?.name || handle}</div>
                <div style={{ fontSize:12, color:'#555' }}>@{handle}</div>
              </div>
            </div>

            {/* Card */}
            <div style={{ background:'#0e0e0e', border:'1px solid #1a1a1a', borderRadius:20, padding:24 }}>

              {/* Amount input */}
              <div style={{ background:'#080808', border:'1px solid #181818', borderRadius:14, padding:'16px 18px', marginBottom:12 }}>
                <div style={{ fontSize:9, color:'#444', fontWeight:700, letterSpacing:'.4px', marginBottom:8 }}>YOU PAY</div>
                <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                  <input
                    type="number"
                    value={amount}
                    onChange={e => setAmount(e.target.value)}
                    placeholder="0"
                    style={{ fontSize:36, fontWeight:300, flex:1, background:'transparent', border:'none', color:'#fff', outline:'none', letterSpacing:'-1px' }}
                  />
                  <div style={{ background:'#141414', border:'1px solid #1e1e1e', borderRadius:20, padding:'5px 12px', display:'flex', alignItems:'center', gap:5 }}>
                    <div style={{ width:7, height:7, borderRadius:'50%', background:'#6366f1' }}/>
                    <span style={{ fontSize:12, fontWeight:700, color:'#fff' }}>USDC</span>
                  </div>
                </div>
              </div>

              {/* Quick amounts */}
              <div style={{ display:'flex', gap:6, marginBottom:16 }}>
                {['10','25','50','100'].map(v => (
                  <button key={v} onClick={() => setAmount(v)}
                    style={{ flex:1, padding:'7px 0', borderRadius:8, border:`1px solid ${amount===v?'#c9a84c':'#1a1a1a'}`, background:amount===v?'#1a1500':'#080808', color:amount===v?'#c9a84c':'#444', fontSize:12, fontWeight:700, cursor:'pointer' }}>
                    ${v}
                  </button>
                ))}
              </div>

              {/* Send button */}
              {txHash ? (
                <div style={{ background:'#0a1a0a', border:'1px solid #1a3a1a', borderRadius:12, padding:16, textAlign:'center' }}>
                  <div style={{ fontSize:13, color:'#4ade80', fontWeight:700, marginBottom:6 }}>✓ Sent successfully!</div>
                  <a href={`https://testnet.arcscan.app/tx/${txHash}`} target="_blank" rel="noopener noreferrer"
                    style={{ fontSize:11, color:'#c9a84c', textDecoration:'none' }}>View on ArcScan →</a>
                  <button onClick={() => setTxHash('')}
                    style={{ display:'block', width:'100%', marginTop:10, padding:'8px 0', background:'transparent', border:'1px solid #1a3a1a', borderRadius:8, fontSize:12, color:'#4ade80', cursor:'pointer' }}>
                    Send again
                  </button>
                </div>
              ) : (
                <button onClick={send} disabled={paying || !amount}
                  style={{ width:'100%', padding:14, borderRadius:12, fontWeight:800, fontSize:14, border:'none', cursor: paying||!amount ? 'default':'pointer', background: paying||!amount ? '#111':'linear-gradient(135deg,#c9a84c,#a07830)', color: paying||!amount ? '#333':'#000', letterSpacing:.3 }}>
                  {paying ? <span style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:8 }}><Spinner/>Sending...</span> : `Send ${amount||'0'} USDC to @${handle}`}
                </button>
              )}

              {error && (
                <div style={{ marginTop:10, padding:'10px 12px', background:'#1a0a0a', border:'1px solid #3a1a1a', borderRadius:10, fontSize:12, color:'#f87171' }}>
                  {error}
                </div>
              )}
            </div>

            {/* Footer */}
            <div style={{ textAlign:'center', marginTop:16, fontSize:10, color:'#222' }}>
              Powered by Arc Network · No fees · Instant
            </div>
          </div>
        )}
      </div>
    </div>
  )
}