'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

interface Transaction {
  id: string
  name: string
  address: string
  amount: string
  txHash: string
  explorerUrl?: string
  nftUrl?: string
  timestamp: string
}

const WavesLogo = ({ size = 20 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 48 48" fill="none">
    <path d="M14 18 C14 18 24 10 34 18" stroke="#c9a84c" strokeWidth="2.5" fill="none" strokeLinecap="round"/>
    <path d="M14 24 C14 24 24 16 34 24" stroke="#c9a84c" strokeWidth="2.5" fill="none" strokeLinecap="round"/>
    <path d="M14 30 C14 30 24 22 34 30" stroke="#c9a84c" strokeWidth="2.5" fill="none" strokeLinecap="round"/>
  </svg>
)

export default function History() {
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [filter, setFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [darkMode, setDarkMode] = useState(true)

  const D = darkMode
  const bg = D ? '#080808' : '#f8f9fa'
  const card = D ? '#0e0e0e' : '#ffffff'
  const border = D ? '#1a1a1a' : '#e8e8e8'
  const text = D ? '#ffffff' : '#000000'
  const muted = D ? '#444444' : '#999999'
  const subtle = D ? '#333333' : '#bbbbbb'
  const field = D ? '#080808' : '#f5f5f5'

  useEffect(() => {
    const stored = localStorage.getItem('arc_transactions')
    if (stored) setTransactions(JSON.parse(stored))
  }, [])

  const filtered = transactions.filter(t => {
    const matchFilter =
      filter === 'all' ? true :
      filter === 'bridge' ? t.name.toLowerCase().includes('bridge') :
      filter === 'swap' ? t.name.toLowerCase().includes('swap') :
      filter === 'game' ? t.name.toLowerCase().includes('game') || t.name.toLowerCase().includes('flappy') :
      !t.name.toLowerCase().includes('bridge') && !t.name.toLowerCase().includes('swap')
    const matchSearch = search === '' ||
      t.name.toLowerCase().includes(search.toLowerCase()) ||
      t.address.toLowerCase().includes(search.toLowerCase()) ||
      t.txHash.toLowerCase().includes(search.toLowerCase())
    return matchFilter && matchSearch
  })

  const totalSent = transactions.reduce((s, t) => s + parseFloat(t.amount || '0'), 0)
  const nftCount = transactions.filter(t => t.nftUrl).length
  const bridgeCount = transactions.filter(t => t.name.toLowerCase().includes('bridge')).length
  const swapCount = transactions.filter(t => t.name.toLowerCase().includes('swap')).length

  const shareOnTwitter = (t: Transaction) => {
    const text = `Just sent ${t.amount} USDC on Arc Network! ⚡\n\nTx: https://testnet.arcscan.app/tx/${t.txHash}\n\nBuilt with Arc Global Payouts by GoGo\n#ArcNetwork #USDC #DeFi`
    window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`, '_blank')
  }

  const clearHistory = () => {
    if (!confirm('Clear all transaction history?')) return
    localStorage.removeItem('arc_transactions')
    setTransactions([])
  }

  const formatDate = (iso: string) => {
    const d = new Date(iso)
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
  }

  const getTxType = (name: string) => {
    if (name.toLowerCase().includes('bridge')) return { label: 'Bridge', color: '#6366f1' }
    if (name.toLowerCase().includes('swap')) return { label: 'Swap', color: '#22c55e' }
    if (name.toLowerCase().includes('game') || name.toLowerCase().includes('flappy')) return { label: 'Game', color: '#f59e0b' }
    if (name.toLowerCase().includes('batch')) return { label: 'Batch', color: '#a78bfa' }
    return { label: 'Send', color: '#c9a84c' }
  }

  return (
    <div style={{ minHeight:'100vh', background:bg, color:text, fontFamily:'-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif' }}>

      {/* NAV */}
      <nav style={{ borderBottom:`1px solid ${border}`, padding:'12px 20px', display:'flex', alignItems:'center', justifyContent:'space-between', background: D?'#080808':'#fff' }}>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <div style={{ width:30, height:30, background: D?'#111':'#f5f5f5', border:`1px solid ${border}`, borderRadius:9, display:'flex', alignItems:'center', justifyContent:'center' }}>
            <WavesLogo size={16} />
          </div>
          <div>
            <div style={{ fontWeight:700, fontSize:13, color:text }}>Arc Global Payouts</div>
            <div style={{ fontSize:8, color:'#c9a84c', fontWeight:700, letterSpacing:'.8px' }}>
              ARC NETWORK <span style={{ color:muted }}>· by GoGo</span>
            </div>
          </div>
        </div>
        <div style={{ display:'flex', gap:8, alignItems:'center' }}>
          <Link href="/" style={{ fontSize:11, color:muted, textDecoration:'none', padding:'5px 10px', background: D?'#111':'#f5f5f5', border:`1px solid ${border}`, borderRadius:8 }}>
            ← Dashboard
          </Link>
          <a href="https://testnet.arcscan.app" target="_blank" rel="noopener noreferrer"
            style={{ fontSize:11, color:'#c9a84c', textDecoration:'none', padding:'5px 10px', background: D?'#1a1500':'#fef9ec', border:'1px solid #2a2500', borderRadius:8 }}>
            ArcScan ↗
          </a>
          <button onClick={() => setDarkMode(!D)}
            style={{ fontSize:13, padding:'4px 8px', background: D?'#111':'#f5f5f5', border:`1px solid ${border}`, borderRadius:8, cursor:'pointer' }}>
            {D ? '☀️' : '🌙'}
          </button>
        </div>
      </nav>

      <div style={{ padding:'20px' }}>

        {/* STATS */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:10, marginBottom:20 }}>
          {[
            { label:'TOTAL SENT', value:`$${totalSent.toFixed(2)}`, color:'#c9a84c' },
            { label:'TRANSACTIONS', value:transactions.length.toString(), color:text },
            { label:'NFT RECEIPTS', value:nftCount.toString(), color:'#a78bfa' },
            { label:'BRIDGES', value:bridgeCount.toString(), color:'#6366f1' },
          ].map(s => (
            <div key={s.label} style={{ background:card, border:`1px solid ${border}`, borderRadius:14, padding:'14px 16px' }}>
              <div style={{ fontSize:9, color:muted, fontWeight:700, letterSpacing:'.5px', marginBottom:4 }}>{s.label}</div>
              <div style={{ fontSize:26, fontWeight:300, color:s.color, letterSpacing:'-1px' }}>{s.value}</div>
            </div>
          ))}
        </div>

        {/* FILTERS + SEARCH */}
        <div style={{ display:'flex', gap:8, marginBottom:14, flexWrap:'wrap', alignItems:'center' }}>
          <div style={{ display:'flex', gap:5 }}>
            {['all','send','bridge','swap','game'].map(f => (
              <button key={f} onClick={() => setFilter(f)}
                style={{
                  padding:'5px 12px', borderRadius:8, fontSize:11, fontWeight:600, border:'1px solid', cursor:'pointer',
                  borderColor: filter === f ? '#c9a84c' : border,
                  background: filter === f ? '#1a1500' : card,
                  color: filter === f ? '#c9a84c' : muted,
                }}>
                {f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search by name, address, hash..."
            style={{ flex:1, minWidth:200, padding:'6px 12px', borderRadius:8, fontSize:12, background:field, border:`1px solid ${border}`, color:text, outline:'none' }}
          />
          {transactions.length > 0 && (
            <button onClick={clearHistory}
              style={{ padding:'5px 12px', borderRadius:8, fontSize:11, border:'1px solid #2a1a1a', background: D?'#1a0a0a':'#fff5f5', color:'#f87171', cursor:'pointer' }}>
              Clear All
            </button>
          )}
        </div>

        {/* TABLE */}
        <div style={{ background:card, border:`1px solid ${border}`, borderRadius:16, overflow:'hidden', marginBottom:20 }}>
          {filtered.length === 0 ? (
            <div style={{ padding:'60px 24px', textAlign:'center' }}>
              <div style={{ fontSize:40, marginBottom:12 }}>📋</div>
              <div style={{ color:muted, fontSize:14 }}>No transactions yet</div>
              <Link href="/" style={{ display:'inline-block', marginTop:12, fontSize:12, color:'#c9a84c', textDecoration:'none' }}>
                Go to Dashboard →
              </Link>
            </div>
          ) : (
            <div style={{ overflowX:'auto' }}>
              <table style={{ width:'100%', minWidth:700, borderCollapse:'collapse' }}>
                <thead>
                  <tr style={{ borderBottom:`1px solid ${border}` }}>
                    {['TYPE','NAME','ADDRESS','AMOUNT','DATE','NFT','TX','SHARE'].map(h => (
                      <th key={h} style={{ textAlign:'left', padding:'10px 14px', fontSize:9, fontWeight:700, letterSpacing:'.5px', color:muted }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((t, i) => {
                    const type = getTxType(t.name)
                    return (
                      <tr key={t.id}
                        style={{ borderBottom: i < filtered.length-1 ? `1px solid ${border}` : 'none' }}
                        onMouseEnter={e => (e.currentTarget.style.background = D?'#111':'#fafafa')}
                        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                        <td style={{ padding:'12px 14px' }}>
                          <span style={{ padding:'2px 8px', borderRadius:6, fontSize:10, fontWeight:700, background:`${type.color}22`, color:type.color }}>
                            {type.label}
                          </span>
                        </td>
                        <td style={{ padding:'12px 14px', fontSize:12, color:text, fontWeight:500 }}>{t.name}</td>
                        <td style={{ padding:'12px 14px', fontSize:11, color:muted, fontFamily:'monospace' }}>
                          {t.address ? `${t.address.slice(0,6)}...${t.address.slice(-4)}` : '—'}
                        </td>
                        <td style={{ padding:'12px 14px', fontSize:12, fontWeight:700, color:'#c9a84c' }}>
                          {t.amount} USDC
                        </td>
                        <td style={{ padding:'12px 14px', fontSize:11, color:muted }}>
                          {t.timestamp ? formatDate(t.timestamp) : '—'}
                        </td>
                        <td style={{ padding:'12px 14px' }}>
                          {t.nftUrl
                            ? <a href={t.nftUrl} target="_blank" rel="noopener noreferrer" style={{ fontSize:11, color:'#a78bfa', textDecoration:'none' }}>View ↗</a>
                            : <span style={{ fontSize:11, color:subtle }}>—</span>}
                        </td>
                        <td style={{ padding:'12px 14px' }}>
                          {t.txHash
                            ? <a href={`https://testnet.arcscan.app/tx/${t.txHash}`} target="_blank" rel="noopener noreferrer"
                                style={{ fontSize:11, color:'#6366f1', textDecoration:'none' }}>
                                {t.txHash.slice(0,8)}... ↗
                              </a>
                            : <span style={{ fontSize:11, color:subtle }}>—</span>}
                        </td>
                        <td style={{ padding:'12px 14px' }}>
                          <button onClick={() => shareOnTwitter(t)}
                            style={{ padding:'3px 8px', borderRadius:6, fontSize:10, border:'1px solid #1e3a5f', background:'#0a1628', color:'#60a5fa', cursor:'pointer', fontWeight:700 }}>
                            𝕏
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* MINI STATS BAR */}
        <div style={{ display:'flex', gap:10, flexWrap:'wrap' }}>
          <div style={{ background:card, border:`1px solid ${border}`, borderRadius:10, padding:'10px 14px', fontSize:11, color:muted }}>
            Total volume: <span style={{ color:'#c9a84c', fontWeight:700 }}>${totalSent.toFixed(2)} USDC</span>
          </div>
          <div style={{ background:card, border:`1px solid ${border}`, borderRadius:10, padding:'10px 14px', fontSize:11, color:muted }}>
            Bridges: <span style={{ color:'#6366f1', fontWeight:700 }}>{bridgeCount}</span>
          </div>
          <div style={{ background:card, border:`1px solid ${border}`, borderRadius:10, padding:'10px 14px', fontSize:11, color:muted }}>
            Swaps: <span style={{ color:'#22c55e', fontWeight:700 }}>{swapCount}</span>
          </div>
          <div style={{ background:card, border:`1px solid ${border}`, borderRadius:10, padding:'10px 14px', fontSize:11, color:muted }}>
            NFT Receipts: <span style={{ color:'#a78bfa', fontWeight:700 }}>{nftCount}</span>
          </div>
        </div>
      </div>
    </div>
  )
}