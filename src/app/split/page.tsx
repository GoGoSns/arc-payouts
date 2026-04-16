'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useAccount, useConnect } from 'wagmi'
import { injected } from 'wagmi/connectors'

interface Participant {
  id: string
  name: string
  address: string
  amount: number
  paid: boolean
  txHash?: string
}

interface SplitBill {
  id: string
  description: string
  total: number
  participants: Participant[]
  createdAt: string
}

const WavesLogo = ({ size = 20 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 48 48" fill="none">
    <path d="M14 18 C14 18 24 10 34 18" stroke="#c9a84c" strokeWidth="2.5" fill="none" strokeLinecap="round"/>
    <path d="M14 24 C14 24 24 16 34 24" stroke="#c9a84c" strokeWidth="2.5" fill="none" strokeLinecap="round"/>
    <path d="M14 30 C14 30 24 22 34 30" stroke="#c9a84c" strokeWidth="2.5" fill="none" strokeLinecap="round"/>
  </svg>
)

export default function SplitPage() {
  const { isConnected } = useAccount()
  const { connect } = useConnect()
  const [bills, setBills] = useState<SplitBill[]>([])
  const [showNew, setShowNew] = useState(false)
  const [darkMode, setDarkMode] = useState(true)
  const [description, setDescription] = useState('')
  const [total, setTotal] = useState('')
  const [participants, setParticipants] = useState([
    { name:'', address:'' },
    { name:'', address:'' },
  ])
  const [paying, setPaying] = useState<string | null>(null)
  const [copied, setCopied] = useState<string | null>(null)

  const D = darkMode
  const bg = D ? '#080808' : '#f8f9fa'
  const card = D ? '#0e0e0e' : '#ffffff'
  const border = D ? '#1a1a1a' : '#e8e8e8'
  const text = D ? '#ffffff' : '#000000'
  const muted = D ? '#444444' : '#999999'
  const field = D ? '#080808' : '#f5f5f5'
  const fieldBorder = D ? '#181818' : '#e0e0e0'

  useEffect(() => {
    const stored = localStorage.getItem('arc_splits')
    if (stored) setBills(JSON.parse(stored))
  }, [])

  const saveBills = (b: SplitBill[]) => {
    setBills(b)
    localStorage.setItem('arc_splits', JSON.stringify(b))
  }

  const createSplit = () => {
    if (!description || !total || participants.filter(p => p.address).length < 2) return
    const valid = participants.filter(p => p.address)
    const perPerson = parseFloat(total) / valid.length
    const newBill: SplitBill = {
      id: Math.random().toString(36).slice(2),
      description,
      total: parseFloat(total),
      participants: valid.map(p => ({
        id: Math.random().toString(36).slice(2),
        name: p.name || p.address.slice(0,8),
        address: p.address,
        amount: perPerson,
        paid: false,
      })),
      createdAt: new Date().toISOString(),
    }
    saveBills([newBill, ...bills])
    setShowNew(false)
    setDescription(''); setTotal('')
    setParticipants([{name:'',address:''},{name:'',address:''}])
  }

  const payShare = async (billId: string, participantId: string, toAddress: string, amount: number) => {
    if (!isConnected) { connect({ connector: injected() }); return }
    setPaying(participantId)
    try {
      const { AppKit } = await import('@circle-fin/app-kit')
      const { createViemAdapterFromProvider } = await import('@circle-fin/adapter-viem-v2')
      const kit = new AppKit()
      const adapter = await createViemAdapterFromProvider({ provider: (window as any).ethereum })
      const res = await kit.send({ from:{ adapter, chain:'Arc_Testnet' as never }, to:toAddress, amount:amount.toFixed(2), token:'USDC' })
      const txHash = (res as any)?.hash || ''
      const stored = localStorage.getItem('arc_transactions')
      const existing = stored ? JSON.parse(stored) : []
      localStorage.setItem('arc_transactions', JSON.stringify([
        { id:Math.random().toString(36).slice(2), name:`Split: ${description}`, address:toAddress, amount:amount.toFixed(2), txHash, timestamp:new Date().toISOString() },
        ...existing
      ]))
      saveBills(bills.map(b => b.id===billId ? {
        ...b,
        participants: b.participants.map(p => p.id===participantId ? {...p, paid:true, txHash} : p)
      } : b))
    } catch(e:any) { alert('Error: '+e.message) }
    setPaying(null)
  }

  const copyLink = (billId: string) => {
    navigator.clipboard.writeText(`${window.location.origin}/split/${billId}`)
    setCopied(billId)
    setTimeout(() => setCopied(null), 2000)
  }

  const shareOnTwitter = (bill: SplitBill) => {
    const t = `Splitting $${bill.total} USDC for "${bill.description}" on Arc Network! ⚡\n\nPay your share instantly — no signup needed.\n\n#ArcNetwork #USDC`
    window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(t)}`, '_blank')
  }

  const getPaidCount = (bill: SplitBill) => bill.participants.filter(p => p.paid).length
  const getPaidAmount = (bill: SplitBill) => bill.participants.filter(p => p.paid).reduce((s,p) => s+p.amount, 0)

  return (
    <div style={{ minHeight:'100vh', background:bg, color:text, fontFamily:'-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif' }}>
      <style>{`@keyframes sweep{from{transform:rotate(0)}to{transform:rotate(360deg)}}`}</style>

      {/* NAV */}
      <nav style={{ borderBottom:`1px solid ${border}`, padding:'11px 16px', display:'flex', alignItems:'center', justifyContent:'space-between', background:D?'#080808':'#fff', flexWrap:'wrap', gap:8 }}>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <div style={{ width:30, height:30, background:D?'#111':'#f5f5f5', border:`1px solid ${border}`, borderRadius:8, display:'flex', alignItems:'center', justifyContent:'center' }}>
            <WavesLogo size={16}/>
          </div>
          <div>
            <div style={{ fontWeight:700, fontSize:13, color:text }}>Split Payment</div>
            <div style={{ fontSize:8, color:'#c9a84c', fontWeight:700, letterSpacing:'.8px' }}>ARC NETWORK <span style={{ color:muted }}>· by GoGo</span></div>
          </div>
        </div>
        <div style={{ display:'flex', gap:8, alignItems:'center' }}>
          <Link href="/" style={{ fontSize:11, color:muted, textDecoration:'none', padding:'4px 10px', background:D?'#111':'#f5f5f5', border:`1px solid ${border}`, borderRadius:8 }}>← Dashboard</Link>
          <button onClick={() => setDarkMode(!D)} style={{ fontSize:12, padding:'4px 8px', background:D?'#111':'#f5f5f5', border:`1px solid ${border}`, borderRadius:8, cursor:'pointer' }}>{D?'☀️':'🌙'}</button>
          <button onClick={() => setShowNew(true)}
            style={{ padding:'5px 14px', background:'linear-gradient(135deg,#c9a84c,#a07830)', color:'#000', border:'none', borderRadius:8, fontSize:11, fontWeight:800, cursor:'pointer' }}>
            + New Split
          </button>
        </div>
      </nav>

      <div style={{ padding:16, maxWidth:800, margin:'0 auto' }}>

        {/* STATS */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:10, marginBottom:16 }}>
          {[
            { label:'TOTAL BILLS', value:bills.length.toString(), color:text },
            { label:'TOTAL SPLIT', value:`$${bills.reduce((s,b)=>s+b.total,0).toFixed(0)}`, color:'#c9a84c' },
            { label:'FULLY PAID', value:bills.filter(b=>b.participants.every(p=>p.paid)).length.toString(), color:'#4ade80' },
          ].map(s => (
            <div key={s.label} style={{ background:card, border:`1px solid ${border}`, borderRadius:12, padding:'12px 14px' }}>
              <div style={{ fontSize:9, color:muted, fontWeight:700, letterSpacing:'.4px', marginBottom:3 }}>{s.label}</div>
              <div style={{ fontSize:22, fontWeight:300, color:s.color, letterSpacing:'-1px' }}>{s.value}</div>
            </div>
          ))}
        </div>

        {/* NEW FORM */}
        {showNew && (
          <div style={{ background:card, border:`1px solid ${border}`, borderRadius:16, padding:20, marginBottom:16 }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14 }}>
              <div style={{ fontWeight:700, fontSize:14, color:text }}>New Split Bill</div>
              <button onClick={() => setShowNew(false)} style={{ color:muted, background:'none', border:'none', cursor:'pointer', fontSize:16 }}>✕</button>
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'2fr 1fr', gap:10, marginBottom:12 }}>
              <div>
                <div style={{ fontSize:9, color:muted, fontWeight:700, letterSpacing:'.4px', marginBottom:5 }}>DESCRIPTION *</div>
                <input value={description} onChange={e => setDescription(e.target.value)} placeholder="e.g. Dinner, Trip, Rent..."
                  style={{ width:'100%', padding:'9px 12px', background:field, border:`1px solid ${fieldBorder}`, borderRadius:10, fontSize:13, color:text, outline:'none', boxSizing:'border-box' }}/>
              </div>
              <div>
                <div style={{ fontSize:9, color:muted, fontWeight:700, letterSpacing:'.4px', marginBottom:5 }}>TOTAL USDC *</div>
                <input type="number" value={total} onChange={e => setTotal(e.target.value)} placeholder="0"
                  style={{ width:'100%', padding:'9px 12px', background:field, border:`1px solid ${fieldBorder}`, borderRadius:10, fontSize:13, color:text, outline:'none', boxSizing:'border-box' }}/>
              </div>
            </div>

            <div style={{ fontSize:9, color:muted, fontWeight:700, letterSpacing:'.4px', marginBottom:8 }}>PARTICIPANTS (min 2)</div>
            <div style={{ display:'flex', flexDirection:'column', gap:6, marginBottom:10 }}>
              {participants.map((p, i) => (
                <div key={i} style={{ display:'grid', gridTemplateColumns:'1fr 2fr auto', gap:8 }}>
                  <input value={p.name} onChange={e => setParticipants(prev => prev.map((x,j) => j===i?{...x,name:e.target.value}:x))}
                    placeholder={`Name ${i+1}`}
                    style={{ padding:'8px 10px', background:field, border:`1px solid ${fieldBorder}`, borderRadius:9, fontSize:12, color:text, outline:'none' }}/>
                  <input value={p.address} onChange={e => setParticipants(prev => prev.map((x,j) => j===i?{...x,address:e.target.value}:x))}
                    placeholder="0x... wallet address"
                    style={{ padding:'8px 10px', background:field, border:`1px solid ${fieldBorder}`, borderRadius:9, fontSize:12, color:text, outline:'none' }}/>
                  <button onClick={() => setParticipants(prev => prev.filter((_,j) => j!==i))}
                    style={{ padding:'8px 10px', background:'transparent', border:`1px solid ${border}`, borderRadius:9, fontSize:12, color:'#f87171', cursor:'pointer' }}>✕</button>
                </div>
              ))}
            </div>

            <div style={{ display:'flex', gap:8, marginBottom:14, flexWrap:'wrap' }}>
              <button onClick={() => setParticipants(prev => [...prev, {name:'',address:''}])}
                style={{ padding:'7px 14px', background:D?'#111':'#f5f5f5', border:`1px solid ${border}`, borderRadius:8, fontSize:11, color:muted, cursor:'pointer' }}>
                + Add Person
              </button>
              {total && participants.filter(p=>p.address).length > 0 && (
                <div style={{ padding:'7px 14px', background:D?'#1a1500':'#fef9ec', border:'1px solid #2a2500', borderRadius:8, fontSize:11, color:'#c9a84c' }}>
                  Each pays: {(parseFloat(total)/participants.filter(p=>p.address).length).toFixed(2)} USDC
                </div>
              )}
            </div>
            <button onClick={createSplit}
              style={{ width:'100%', padding:12, background:'linear-gradient(135deg,#c9a84c,#a07830)', color:'#000', border:'none', borderRadius:12, fontSize:13, fontWeight:800, cursor:'pointer' }}>
              Create Split Bill
            </button>
          </div>
        )}

        {/* BILLS */}
        {bills.length === 0 && !showNew ? (
          <div style={{ textAlign:'center', padding:'60px 20px' }}>
            <div style={{ fontSize:48, marginBottom:12 }}>🍽️</div>
            <div style={{ fontSize:16, fontWeight:700, color:text, marginBottom:6 }}>No split bills yet</div>
            <div style={{ fontSize:13, color:muted, marginBottom:20 }}>Split expenses with friends on Arc Network</div>
            <button onClick={() => setShowNew(true)}
              style={{ padding:'10px 24px', background:'linear-gradient(135deg,#c9a84c,#a07830)', color:'#000', border:'none', borderRadius:12, fontSize:13, fontWeight:800, cursor:'pointer' }}>
              + Create Split Bill
            </button>
          </div>
        ) : (
          <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
            {bills.map(bill => (
              <div key={bill.id} style={{ background:card, border:`1px solid ${border}`, borderRadius:16, overflow:'hidden' }}>
                <div style={{ padding:'14px 16px', borderBottom:`1px solid ${border}`, display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:8 }}>
                  <div>
                    <div style={{ fontWeight:700, fontSize:15, color:text }}>{bill.description}</div>
                    <div style={{ fontSize:11, color:muted, marginTop:2 }}>
                      {new Date(bill.createdAt).toLocaleDateString('en-US', { month:'short', day:'numeric', year:'numeric' })}
                    </div>
                  </div>
                  <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                    <div style={{ textAlign:'right' }}>
                      <div style={{ fontSize:20, fontWeight:300, color:'#c9a84c', letterSpacing:'-1px' }}>${bill.total}</div>
                      <div style={{ fontSize:10, color:muted }}>total USDC</div>
                    </div>
                    <button onClick={() => copyLink(bill.id)}
                      style={{ padding:'5px 10px', background:D?'#111':'#f5f5f5', border:`1px solid ${border}`, borderRadius:8, fontSize:10, color:copied===bill.id?'#c9a84c':muted, cursor:'pointer', fontWeight:copied===bill.id?700:400 }}>
                      {copied===bill.id?'✓ Copied!':'Copy Link'}
                    </button>
                    <button onClick={() => shareOnTwitter(bill)}
                      style={{ padding:'5px 10px', background:'#0a1628', border:'1px solid #1e3a5f', borderRadius:8, fontSize:10, color:'#60a5fa', cursor:'pointer', fontWeight:700 }}>
                      𝕏
                    </button>
                  </div>
                </div>

                <div style={{ padding:'10px 16px', background:D?'#080808':'#fafafa', borderBottom:`1px solid ${border}` }}>
                  <div style={{ display:'flex', justifyContent:'space-between', fontSize:11, marginBottom:5 }}>
                    <span style={{ color:muted }}>{getPaidCount(bill)} of {bill.participants.length} paid</span>
                    <span style={{ color:'#c9a84c', fontWeight:700 }}>${getPaidAmount(bill).toFixed(2)} / ${bill.total}</span>
                  </div>
                  <div style={{ background:D?'#1a1a1a':'#e8e8e8', borderRadius:4, height:6 }}>
                    <div style={{ width:`${(getPaidAmount(bill)/bill.total)*100}%`, height:'100%', background:'linear-gradient(90deg,#c9a84c,#a07830)', borderRadius:4, transition:'width .5s' }}/>
                  </div>
                </div>

                <div style={{ padding:'10px 16px' }}>
                  <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                    {bill.participants.map(p => (
                      <div key={p.id} style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 12px', background:D?'#080808':'#f9f9f9', border:`1px solid ${border}`, borderRadius:10, flexWrap:'wrap' }}>
                        <div style={{ width:30, height:30, borderRadius:'50%', background:'linear-gradient(135deg,#c9a84c,#a07830)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:12, fontWeight:800, color:'#000', flexShrink:0 }}>
                          {p.name[0]?.toUpperCase()||'?'}
                        </div>
                        <div style={{ flex:1, minWidth:80 }}>
                          <div style={{ fontSize:12, fontWeight:600, color:text }}>{p.name}</div>
                          <div style={{ fontSize:10, color:muted, fontFamily:'monospace' }}>{p.address.slice(0,6)}...{p.address.slice(-4)}</div>
                        </div>
                        <div style={{ fontSize:13, fontWeight:700, color:'#c9a84c' }}>{p.amount.toFixed(2)} USDC</div>
                        {p.paid ? (
                          <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                            <span style={{ padding:'3px 8px', background:'#0a1a0a', border:'1px solid #1a3a1a', borderRadius:6, fontSize:10, fontWeight:700, color:'#4ade80' }}>✓ Paid</span>
                            {p.txHash && (
                              <a href={`https://testnet.arcscan.app/tx/${p.txHash}`} target="_blank" rel="noopener noreferrer"
                                style={{ fontSize:10, color:'#6366f1', textDecoration:'none' }}>ArcScan ↗</a>
                            )}
                          </div>
                        ) : (
                          <button onClick={() => payShare(bill.id, p.id, p.address, p.amount)} disabled={paying===p.id}
                            style={{ padding:'6px 12px', borderRadius:8, fontSize:11, fontWeight:700, border:'none', cursor:paying===p.id?'default':'pointer',
                              background:paying===p.id?D?'#333':'#ccc':'linear-gradient(135deg,#c9a84c,#a07830)',
                              color:paying===p.id?D?'#666':'#999':'#000' }}>
                            {paying===p.id?'Paying...':'Pay Share'}
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}