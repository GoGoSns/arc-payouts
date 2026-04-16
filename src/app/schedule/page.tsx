'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useAccount, useConnect } from 'wagmi'
import { injected } from 'wagmi/connectors'

interface ScheduledPayment {
  id: string
  name: string
  address: string
  amount: string
  frequency: 'daily' | 'weekly' | 'monthly'
  nextDate: string
  active: boolean
  totalSent: number
  executionCount: number
  createdAt: string
}

const WavesLogo = ({ size = 20 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 48 48" fill="none">
    <path d="M14 18 C14 18 24 10 34 18" stroke="#c9a84c" strokeWidth="2.5" fill="none" strokeLinecap="round"/>
    <path d="M14 24 C14 24 24 16 34 24" stroke="#c9a84c" strokeWidth="2.5" fill="none" strokeLinecap="round"/>
    <path d="M14 30 C14 30 24 22 34 30" stroke="#c9a84c" strokeWidth="2.5" fill="none" strokeLinecap="round"/>
  </svg>
)

const getNextDate = (frequency: string, from?: Date): string => {
  const d = from ? new Date(from) : new Date()
  if (frequency === 'daily') d.setDate(d.getDate() + 1)
  else if (frequency === 'weekly') d.setDate(d.getDate() + 7)
  else if (frequency === 'monthly') d.setMonth(d.getMonth() + 1)
  return d.toISOString()
}

const getDaysUntil = (dateStr: string): number => {
  const diff = new Date(dateStr).getTime() - new Date().getTime()
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)))
}

const FREQ_LABELS: Record<string, string> = {
  daily: 'Daily',
  weekly: 'Weekly',
  monthly: 'Monthly',
}

export default function SchedulePage() {
  const { address, isConnected } = useAccount()
  const { connect } = useConnect()
  const [schedules, setSchedules] = useState<ScheduledPayment[]>([])
  const [showNew, setShowNew] = useState(false)
  const [darkMode, setDarkMode] = useState(true)
  const [newName, setNewName] = useState('')
  const [newAddress, setNewAddress] = useState('')
  const [newAmount, setNewAmount] = useState('')
  const [newFreq, setNewFreq] = useState<'daily'|'weekly'|'monthly'>('monthly')
  const [newStartDate, setNewStartDate] = useState('')
  const [executing, setExecuting] = useState<string | null>(null)

  const D = darkMode
  const bg = D ? '#080808' : '#f8f9fa'
  const card = D ? '#0e0e0e' : '#ffffff'
  const border = D ? '#1a1a1a' : '#e8e8e8'
  const text = D ? '#ffffff' : '#000000'
  const muted = D ? '#444444' : '#999999'
  const field = D ? '#080808' : '#f5f5f5'
  const fieldBorder = D ? '#181818' : '#e0e0e0'

  useEffect(() => {
    const stored = localStorage.getItem('arc_schedules')
    if (stored) setSchedules(JSON.parse(stored))
  }, [])

  const saveSchedules = (s: ScheduledPayment[]) => {
    setSchedules(s)
    localStorage.setItem('arc_schedules', JSON.stringify(s))
  }

  const createSchedule = () => {
    if (!newName || !newAddress || !newAmount) return
    const schedule: ScheduledPayment = {
      id: Math.random().toString(36).slice(2),
      name: newName,
      address: newAddress,
      amount: newAmount,
      frequency: newFreq,
      nextDate: newStartDate ? new Date(newStartDate).toISOString() : getNextDate(newFreq),
      active: true,
      totalSent: 0,
      executionCount: 0,
      createdAt: new Date().toISOString(),
    }
    saveSchedules([schedule, ...schedules])
    setShowNew(false)
    setNewName(''); setNewAddress(''); setNewAmount(''); setNewFreq('monthly'); setNewStartDate('')
  }

  const toggleActive = (id: string) => {
    saveSchedules(schedules.map(s => s.id === id ? { ...s, active: !s.active } : s))
  }

  const deleteSchedule = (id: string) => {
    if (!confirm('Delete this scheduled payment?')) return
    saveSchedules(schedules.filter(s => s.id !== id))
  }

  const executeNow = async (schedule: ScheduledPayment) => {
    if (!isConnected) { connect({ connector: injected() }); return }
    setExecuting(schedule.id)
    try {
      const { AppKit } = await import('@circle-fin/app-kit')
      const { createViemAdapterFromProvider } = await import('@circle-fin/adapter-viem-v2')
      const kit = new AppKit()
      const adapter = await createViemAdapterFromProvider({ provider: (window as any).ethereum })
      const res = await kit.send({ from: { adapter, chain: 'Arc_Testnet' as never }, to: schedule.address, amount: schedule.amount, token: 'USDC' })
      const txHash = (res as any)?.hash || ''
      const stored = localStorage.getItem('arc_transactions')
      const existing = stored ? JSON.parse(stored) : []
      localStorage.setItem('arc_transactions', JSON.stringify([
        { id: Math.random().toString(36).slice(2), name: `Scheduled: ${schedule.name}`, address: schedule.address, amount: schedule.amount, txHash, timestamp: new Date().toISOString() },
        ...existing
      ]))
      saveSchedules(schedules.map(s => s.id === schedule.id ? {
        ...s,
        totalSent: s.totalSent + parseFloat(s.amount),
        executionCount: s.executionCount + 1,
        nextDate: getNextDate(s.frequency),
      } : s))
    } catch (e: any) { alert('Error: ' + e.message) }
    setExecuting(null)
  }

  const activeCount = schedules.filter(s => s.active).length
  const totalSent = schedules.reduce((sum, s) => sum + s.totalSent, 0)
  const nextPayment = schedules.filter(s => s.active).sort((a, b) => new Date(a.nextDate).getTime() - new Date(b.nextDate).getTime())[0]

  return (
    <div style={{ minHeight:'100vh', background:bg, color:text, fontFamily:'-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif' }}>
      <style>{`@keyframes sweep{from{transform:rotate(0)}to{transform:rotate(360deg)}} @keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}`}</style>

      {/* NAV */}
      <nav style={{ borderBottom:`1px solid ${border}`, padding:'11px 16px', display:'flex', alignItems:'center', justifyContent:'space-between', background:D?'#080808':'#fff', flexWrap:'wrap', gap:8 }}>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <div style={{ width:30, height:30, background:D?'#111':'#f5f5f5', border:`1px solid ${border}`, borderRadius:8, display:'flex', alignItems:'center', justifyContent:'center' }}>
            <WavesLogo size={16} />
          </div>
          <div>
            <div style={{ fontWeight:700, fontSize:13, color:text }}>Scheduled Payments</div>
            <div style={{ fontSize:8, color:'#c9a84c', fontWeight:700, letterSpacing:'.8px' }}>ARC NETWORK <span style={{ color:muted }}>· by GoGo</span></div>
          </div>
        </div>
        <div style={{ display:'flex', gap:8, alignItems:'center' }}>
          <Link href="/" style={{ fontSize:11, color:muted, textDecoration:'none', padding:'4px 10px', background:D?'#111':'#f5f5f5', border:`1px solid ${border}`, borderRadius:8 }}>← Dashboard</Link>
          <button onClick={() => setDarkMode(!D)} style={{ fontSize:12, padding:'4px 8px', background:D?'#111':'#f5f5f5', border:`1px solid ${border}`, borderRadius:8, cursor:'pointer' }}>{D?'☀️':'🌙'}</button>
          <button onClick={() => setShowNew(true)}
            style={{ padding:'5px 14px', background:'linear-gradient(135deg,#c9a84c,#a07830)', color:'#000', border:'none', borderRadius:8, fontSize:11, fontWeight:800, cursor:'pointer' }}>
            + New Schedule
          </button>
        </div>
      </nav>

      <div style={{ padding:16, maxWidth:800, margin:'0 auto' }}>

        {/* STATS */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:10, marginBottom:16 }}>
          {[
            { label:'ACTIVE', value:activeCount.toString(), color:'#4ade80' },
            { label:'TOTAL SENT', value:`$${totalSent.toFixed(2)}`, color:'#c9a84c' },
            { label:'NEXT IN', value: nextPayment ? `${getDaysUntil(nextPayment.nextDate)}d` : '—', color:text },
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
              <div style={{ fontWeight:700, fontSize:14, color:text }}>New Scheduled Payment</div>
              <button onClick={() => setShowNew(false)} style={{ color:muted, background:'none', border:'none', cursor:'pointer', fontSize:16 }}>✕</button>
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:10 }}>
              <div>
                <div style={{ fontSize:9, color:muted, fontWeight:700, letterSpacing:'.4px', marginBottom:5 }}>LABEL *</div>
                <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="e.g. Monthly Rent"
                  style={{ width:'100%', padding:'9px 12px', background:field, border:`1px solid ${fieldBorder}`, borderRadius:10, fontSize:13, color:text, outline:'none', boxSizing:'border-box' }} />
              </div>
              <div>
                <div style={{ fontSize:9, color:muted, fontWeight:700, letterSpacing:'.4px', marginBottom:5 }}>AMOUNT (USDC) *</div>
                <input type="number" value={newAmount} onChange={e => setNewAmount(e.target.value)} placeholder="0"
                  style={{ width:'100%', padding:'9px 12px', background:field, border:`1px solid ${fieldBorder}`, borderRadius:10, fontSize:13, color:text, outline:'none', boxSizing:'border-box' }} />
              </div>
            </div>
            <div style={{ marginBottom:10 }}>
              <div style={{ fontSize:9, color:muted, fontWeight:700, letterSpacing:'.4px', marginBottom:5 }}>RECIPIENT ADDRESS *</div>
              <input value={newAddress} onChange={e => setNewAddress(e.target.value)} placeholder="0x..."
                style={{ width:'100%', padding:'9px 12px', background:field, border:`1px solid ${fieldBorder}`, borderRadius:10, fontSize:13, color:text, outline:'none', boxSizing:'border-box' }} />
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:14 }}>
              <div>
                <div style={{ fontSize:9, color:muted, fontWeight:700, letterSpacing:'.4px', marginBottom:5 }}>FREQUENCY</div>
                <div style={{ display:'flex', gap:6 }}>
                  {(['daily','weekly','monthly'] as const).map(f => (
                    <button key={f} onClick={() => setNewFreq(f)}
                      style={{ flex:1, padding:'8px 4px', borderRadius:8, fontSize:11, fontWeight:700, border:'1px solid', cursor:'pointer',
                        borderColor: newFreq===f?'#c9a84c':border,
                        background: newFreq===f?'#1a1500':field,
                        color: newFreq===f?'#c9a84c':muted }}>
                      {FREQ_LABELS[f]}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <div style={{ fontSize:9, color:muted, fontWeight:700, letterSpacing:'.4px', marginBottom:5 }}>START DATE</div>
                <input type="date" value={newStartDate} onChange={e => setNewStartDate(e.target.value)}
                  style={{ width:'100%', padding:'9px 12px', background:field, border:`1px solid ${fieldBorder}`, borderRadius:10, fontSize:13, color:text, outline:'none', boxSizing:'border-box' }} />
              </div>
            </div>
            <button onClick={createSchedule}
              style={{ width:'100%', padding:12, background:'linear-gradient(135deg,#c9a84c,#a07830)', color:'#000', border:'none', borderRadius:12, fontSize:13, fontWeight:800, cursor:'pointer' }}>
              Create Scheduled Payment
            </button>
          </div>
        )}

        {/* SCHEDULES LIST */}
        {schedules.length === 0 && !showNew ? (
          <div style={{ textAlign:'center', padding:'60px 20px' }}>
            <div style={{ fontSize:48, marginBottom:12 }}>⏰</div>
            <div style={{ fontSize:16, fontWeight:700, color:text, marginBottom:6 }}>No scheduled payments</div>
            <div style={{ fontSize:13, color:muted, marginBottom:20 }}>Automate recurring USDC payments</div>
            <button onClick={() => setShowNew(true)}
              style={{ padding:'10px 24px', background:'linear-gradient(135deg,#c9a84c,#a07830)', color:'#000', border:'none', borderRadius:12, fontSize:13, fontWeight:800, cursor:'pointer' }}>
              + Create Schedule
            </button>
          </div>
        ) : (
          <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
            {schedules.map(s => {
              const daysUntil = getDaysUntil(s.nextDate)
              const isOverdue = daysUntil === 0
              return (
                <div key={s.id} style={{ background:card, border:`1px solid ${s.active ? (isOverdue?'#c9a84c':border) : border}`, borderRadius:14, overflow:'hidden' }}>
                  <div style={{ padding:'12px 14px', display:'flex', alignItems:'center', gap:12, flexWrap:'wrap' }}>
                    <div style={{ width:36, height:36, borderRadius:'50%', background: s.active?'linear-gradient(135deg,#c9a84c,#a07830)':'#1a1a1a', display:'flex', alignItems:'center', justifyContent:'center', fontSize:14, flexShrink:0 }}>
                      {s.active ? '⏰' : '⏸'}
                    </div>
                    <div style={{ flex:1, minWidth:120 }}>
                      <div style={{ fontWeight:700, fontSize:13, color:text }}>{s.name}</div>
                      <div style={{ fontSize:10, color:muted, fontFamily:'monospace', marginTop:1 }}>
                        {s.address.slice(0,8)}...{s.address.slice(-6)}
                      </div>
                    </div>
                    <div style={{ textAlign:'center' }}>
                      <div style={{ fontSize:16, fontWeight:700, color:'#c9a84c' }}>{s.amount} USDC</div>
                      <div style={{ fontSize:10, color:muted }}>{FREQ_LABELS[s.frequency]}</div>
                    </div>
                    <div style={{ textAlign:'center' }}>
                      <div style={{ fontSize:11, color: isOverdue?'#f87171':text, fontWeight: isOverdue?700:400 }}>
                        {isOverdue ? 'Due now!' : `In ${daysUntil} day${daysUntil!==1?'s':''}`}
                      </div>
                      <div style={{ fontSize:10, color:muted }}>
                        {new Date(s.nextDate).toLocaleDateString('en-US', { month:'short', day:'numeric' })}
                      </div>
                    </div>
                    <div style={{ textAlign:'center' }}>
                      <div style={{ fontSize:11, color:muted }}>Sent {s.executionCount}x</div>
                      <div style={{ fontSize:10, color:'#c9a84c' }}>${s.totalSent.toFixed(2)} total</div>
                    </div>
                    <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
                      {s.active && (
                        <button onClick={() => executeNow(s)} disabled={executing===s.id}
                          style={{ padding:'6px 12px', background: executing===s.id?D?'#333':'#ccc':'linear-gradient(135deg,#c9a84c,#a07830)', color: executing===s.id?D?'#666':'#999':'#000', border:'none', borderRadius:8, fontSize:11, fontWeight:700, cursor: executing===s.id?'default':'pointer' }}>
                          {executing===s.id ? 'Sending...' : 'Send Now'}
                        </button>
                      )}
                      <button onClick={() => toggleActive(s.id)}
                        style={{ padding:'6px 12px', background:D?'#111':'#f5f5f5', border:`1px solid ${border}`, borderRadius:8, fontSize:11, color:muted, cursor:'pointer' }}>
                        {s.active ? 'Pause' : 'Resume'}
                      </button>
                      <button onClick={() => deleteSchedule(s.id)}
                        style={{ padding:'6px 10px', background:D?'#1a0a0a':'#fff5f5', border:'1px solid #2a1a1a', borderRadius:8, fontSize:11, color:'#f87171', cursor:'pointer' }}>
                        ✕
                      </button>
                    </div>
                  </div>
                  {s.active && (
                    <div style={{ padding:'8px 14px', background:D?'#080808':'#fafafa', borderTop:`1px solid ${border}` }}>
                      <div style={{ display:'flex', justifyContent:'space-between', fontSize:10, color:muted, marginBottom:4 }}>
                        <span>Progress to next payment</span>
                        <span>{daysUntil === 0 ? 'Due!' : `${daysUntil} day${daysUntil!==1?'s':''} left`}</span>
                      </div>
                      <div style={{ background:D?'#1a1a1a':'#e8e8e8', borderRadius:4, height:4 }}>
                        <div style={{
                          width: `${Math.max(5, 100 - (daysUntil / (s.frequency==='daily'?1:s.frequency==='weekly'?7:30)) * 100)}%`,
                          height:'100%',
                          background:'linear-gradient(90deg,#c9a84c,#a07830)',
                          borderRadius:4,
                          transition:'width .5s'
                        }} />
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {!isConnected && schedules.length > 0 && (
          <div style={{ marginTop:12, background:D?'#1a1500':'#fef9ec', border:'1px solid #2a2500', borderRadius:12, padding:'12px 14px', display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:8 }}>
            <span style={{ fontSize:12, color:'#c9a84c' }}>Connect wallet to execute scheduled payments</span>
            <button onClick={() => connect({ connector: injected() })}
              style={{ fontSize:11, padding:'5px 12px', background:'linear-gradient(135deg,#c9a84c,#a07830)', color:'#000', border:'none', borderRadius:8, cursor:'pointer', fontWeight:700 }}>
              Connect Wallet
            </button>
          </div>
        )}
      </div>
    </div>
  )
}