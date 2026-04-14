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

const WavesLogo = ({ size = 20, color = '#c9a84c' }: { size?: number, color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 48 48" fill="none">
    <path d="M14 18 C14 18 24 10 34 18" stroke={color} strokeWidth="2.5" fill="none" strokeLinecap="round"/>
    <path d="M14 24 C14 24 24 16 34 24" stroke={color} strokeWidth="2.5" fill="none" strokeLinecap="round"/>
    <path d="M14 30 C14 30 24 22 34 30" stroke={color} strokeWidth="2.5" fill="none" strokeLinecap="round"/>
  </svg>
)

export default function History() {
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [filter, setFilter] = useState('all')
  const [search, setSearch] = useState('')

  useEffect(() => {
    const stored = localStorage.getItem('arc_transactions')
    if (stored) setTransactions(JSON.parse(stored))
  }, [])

  const filtered = transactions.filter(t => {
    const matchFilter =
      filter === 'all' ? true :
      filter === 'bridge' ? t.name.toLowerCase().includes('bridge') :
      filter === 'swap' ? t.name.toLowerCase().includes('swap') :
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
    if (name.toLowerCase().includes('batch')) return { label: 'Batch', color: '#f59e0b' }
    return { label: 'Send', color: '#c9a84c' }
  }

  return (
    <div className="min-h-screen" style={{background:'#080808', color:'#fff', fontFamily:'-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif'}}>

      {/* NAV */}
      <nav style={{borderBottom:'1px solid #141414', padding:'14px 24px', display:'flex', alignItems:'center', justifyContent:'space-between'}}>
        <div style={{display:'flex', alignItems:'center', gap:12}}>
          <div style={{width:36, height:36, background:'#111', border:'1px solid #1e1e1e', borderRadius:10, display:'flex', alignItems:'center', justifyContent:'center'}}>
            <WavesLogo size={20} />
          </div>
          <div>
            <div style={{fontWeight:700, fontSize:14}}>Arc Global Payouts</div>
            <div style={{fontSize:9, color:'#c9a84c', fontWeight:700, letterSpacing:'.8px'}}>
              ARC NETWORK <span style={{color:'#444'}}>· by GoGo</span>
            </div>
          </div>
        </div>
        <div style={{display:'flex', alignItems:'center', gap:12}}>
          <Link href="/" style={{fontSize:12, color:'#666', textDecoration:'none', padding:'5px 12px', background:'#111', border:'1px solid #1e1e1e', borderRadius:8}}>
            ← Dashboard
          </Link>
          <a href="https://testnet.arcscan.app" target="_blank" rel="noopener noreferrer"
            style={{fontSize:12, color:'#c9a84c', textDecoration:'none', padding:'5px 12px', background:'#1a1500', border:'1px solid #2a2500', borderRadius:8}}>
            ArcScan ↗
          </a>
        </div>
      </nav>

      <div style={{padding:'24px 24px 0'}}>

        {/* STATS */}
        <div style={{display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12, marginBottom:24}}>
          {[
            { label: 'TOTAL SENT', value: `$${totalSent.toFixed(2)}`, color: '#c9a84c' },
            { label: 'TRANSACTIONS', value: transactions.length.toString(), color: '#fff' },
            { label: 'NFT RECEIPTS', value: nftCount.toString(), color: '#a78bfa' },
            { label: 'BRIDGES', value: bridgeCount.toString(), color: '#6366f1' },
          ].map(s => (
            <div key={s.label} style={{background:'#0e0e0e', border:'1px solid #1a1a1a', borderRadius:14, padding:'16px 20px'}}>
              <div style={{fontSize:10, color:'#444', fontWeight:700, letterSpacing:'.5px', marginBottom:6}}>{s.label}</div>
              <div style={{fontSize:28, fontWeight:300, color:s.color, letterSpacing:'-1px'}}>{s.value}</div>
            </div>
          ))}
        </div>

        {/* FILTERS + SEARCH */}
        <div style={{display:'flex', gap:12, marginBottom:16, flexWrap:'wrap', alignItems:'center'}}>
          <div style={{display:'flex', gap:6}}>
            {['all','send','bridge','swap'].map(f => (
              <button key={f} onClick={() => setFilter(f)}
                style={{
                  padding:'6px 14px', borderRadius:8, fontSize:12, fontWeight:600, border:'1px solid',
                  cursor:'pointer', transition:'all .15s',
                  borderColor: filter === f ? '#c9a84c' : '#1a1a1a',
                  background: filter === f ? '#1a1500' : '#0e0e0e',
                  color: filter === f ? '#c9a84c' : '#444',
                }}>
                {f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>
          <input
            value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search by name, address, hash..."
            style={{
              flex:1, minWidth:200, padding:'7px 14px', borderRadius:8, fontSize:12,
              background:'#0e0e0e', border:'1px solid #1a1a1a', color:'#fff', outline:'none',
            }}
          />
          {transactions.length > 0 && (
            <button onClick={clearHistory}
              style={{padding:'6px 14px', borderRadius:8, fontSize:12, border:'1px solid #2a1a1a', background:'#1a0a0a', color:'#f87171', cursor:'pointer'}}>
              Clear All
            </button>
          )}
        </div>

        {/* TABLE */}
        <div style={{background:'#0e0e0e', border:'1px solid #1a1a1a', borderRadius:16, overflow:'hidden', marginBottom:24}}>
          {filtered.length === 0 ? (
            <div style={{padding:'60px 24px', textAlign:'center'}}>
              <div style={{fontSize:40, marginBottom:12}}>📋</div>
              <div style={{color:'#444', fontSize:14}}>No transactions yet</div>
              <Link href="/" style={{display:'inline-block', marginTop:12, fontSize:12, color:'#c9a84c', textDecoration:'none'}}>
                Go to Dashboard →
              </Link>
            </div>
          ) : (
            <div style={{overflowX:'auto'}}>
              <table style={{width:'100%', minWidth:700, borderCollapse:'collapse'}}>
                <thead>
                  <tr style={{borderBottom:'1px solid #1a1a1a'}}>
                    {['TYPE','NAME','ADDRESS','AMOUNT','DATE','NFT','TX','SHARE'].map(h => (
                      <th key={h} style={{textAlign:'left', padding:'12px 16px', fontSize:10, color:'#444', fontWeight:700, letterSpacing:'.5px'}}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((t, i) => {
                    const type = getTxType(t.name)
                    return (
                      <tr key={t.id} style={{borderBottom: i < filtered.length-1 ? '1px solid #141414' : 'none', transition:'background .15s'}}
                        onMouseEnter={e => (e.currentTarget.style.background='#111')}
                        onMouseLeave={e => (e.currentTarget.style.background='transparent')}>
                        <td style={{padding:'14px 16px'}}>
                          <span style={{
                            padding:'3px 8px', borderRadius:6, fontSize:11, fontWeight:700,
                            background: type.color + '22', color: type.color,
                          }}>{type.label}</span>
                        </td>
                        <td style={{padding:'14px 16px', fontSize:13, color:'#ccc', fontWeight:500}}>{t.name}</td>
                        <td style={{padding:'14px 16px', fontSize:12, color:'#555', fontFamily:'monospace'}}>
                          {t.address.slice(0,6)}...{t.address.slice(-4)}
                        </td>
                        <td style={{padding:'14px 16px', fontSize:13, fontWeight:700, color:'#c9a84c'}}>
                          {t.amount} USDC
                        </td>
                        <td style={{padding:'14px 16px', fontSize:11, color:'#444'}}>
                          {formatDate(t.timestamp)}
                        </td>
                        <td style={{padding:'14px 16px'}}>
                          {t.nftUrl
                            ? <a href={t.nftUrl} target="_blank" rel="noopener noreferrer" style={{fontSize:11, color:'#a78bfa', textDecoration:'none'}}>View ↗</a>
                            : <span style={{fontSize:11, color:'#222'}}>—</span>}
                        </td>
                        <td style={{padding:'14px 16px'}}>
                          {t.txHash
                            ? <a href={`https://testnet.arcscan.app/tx/${t.txHash}`} target="_blank" rel="noopener noreferrer"
                                style={{fontSize:11, color:'#6366f1', textDecoration:'none'}}>
                                {t.txHash.slice(0,8)}... ↗
                              </a>
                            : <span style={{fontSize:11, color:'#222'}}>—</span>}
                        </td>
                        <td style={{padding:'14px 16px'}}>
                          <button onClick={() => shareOnTwitter(t)}
                            style={{padding:'4px 10px', borderRadius:6, fontSize:11, border:'1px solid #1e3a5f', background:'#0a1628', color:'#60a5fa', cursor:'pointer'}}>
                            𝕏 Share
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
      </div>
    </div>
  )
}