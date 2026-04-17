'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import Link from 'next/link'
import Papa from 'papaparse'
import { useAccount, useConnect, useDisconnect, useBalance } from 'wagmi'
import { injected } from 'wagmi/connectors'
import { uploadImageToIPFS } from '@/lib/pinata'

interface Recipient { id:string; name:string; address:string; amount:string; status:'pending'|'paid'; txHash?:string }
interface Toast { id:string; type:'success'|'error'|'loading'; message:string }
interface LiveTx { id:string; handle:string; to:string; amount:string; type:string; time:string }
type Tab = 'send'|'batch'|'nft'|'bridge'|'swap'

const CHAINS = [
  { id:'Ethereum_Sepolia', label:'ETH Sepolia', color:'#60a5fa' },
  { id:'Arbitrum_Sepolia', label:'ARB Sepolia', color:'#22d3ee' },
  { id:'Optimism_Sepolia', label:'OP Sepolia', color:'#f87171' },
  { id:'Base_Sepolia', label:'Base Sepolia', color:'#818cf8' },
  { id:'Arc_Testnet', label:'Arc Testnet', color:'#4ade80' },
]
const TOKENS = ['USDC','EURC','ETH']
const RATES: Record<string,Record<string,number>> = {
  USDC:{ EURC:0.92, ETH:0.00038, USDC:1 },
  EURC:{ USDC:1.087, ETH:0.00041, EURC:1 },
  ETH:{ USDC:2630, EURC:2420, ETH:1 },
}

const FEATURES = [
  { href:'/game', label:'Tetris', short:'T', color:'#c9a84c', bg:'#1a1500', dark:'#2a2000', border:'#c9a84c44' },
  { href:'/ai', label:'AI', short:'AI', color:'#60a5fa', bg:'#0a1628', dark:'#0d2040', border:'#60a5fa33' },
  { href:'/pay/gogo', label:'Pay Link', short:'P', color:'#4ade80', bg:'#0a1a0a', dark:'#0d280d', border:'#1a3a1a' },
  { href:'/contacts', label:'Contacts', short:'C', color:'#a78bfa', bg:'#1a0a2a', dark:'#1a0a2a', border:'#2a1a3a' },
  { href:'/schedule', label:'Schedule', short:'Sc', color:'#f59e0b', bg:'#1a1000', dark:'#1a1000', border:'#2a2000' },
  { href:'/split', label:'Split', short:'Sp', color:'#f87171', bg:'#1a0a0a', dark:'#1a0a0a', border:'#2a1a1a' },
]

const GLOBAL_CSS = `
@keyframes sweep{from{transform:rotate(0)}to{transform:rotate(360deg)}}
@keyframes pulse{0%,100%{opacity:1}50%{opacity:.3}}
@keyframes float{0%,100%{transform:translateY(0)}50%{transform:translateY(-5px)}}
@keyframes ticker{from{transform:translateX(0)}to{transform:translateX(-50%)}}
@keyframes glow{0%,100%{opacity:.8}50%{opacity:1}}
@keyframes breathe{0%,100%{box-shadow:0 0 0 2px #c9a84c33}50%{box-shadow:0 0 0 4px #c9a84c88,0 0 20px #c9a84c22}}
@keyframes spin{to{transform:rotate(360deg)}}
@keyframes fadeUp{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}
@keyframes gridGlow{0%,100%{opacity:.25}50%{opacity:.4}}
`

function SweepIcon({ short, color, bg, dark, size=22 }: { short:string; color:string; bg:string; dark:string; size?:number }) {
  const r = Math.round(size * 0.27)
  return (
    <span style={{ position:'relative', width:size, height:size, borderRadius:r, overflow:'hidden', display:'inline-flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
      <span style={{ position:'absolute', inset:-4, background:`conic-gradient(transparent 0deg,${color} 55deg,transparent 110deg)`, animation:'sweep 2.5s linear infinite' }}/>
      <span style={{ position:'absolute', inset:1.5, background:dark, borderRadius:r-2, display:'flex', alignItems:'center', justifyContent:'center', zIndex:1, fontSize:size<20?7:9, fontWeight:800, color }}>{short}</span>
    </span>
  )
}

function Spinner() {
  return <span style={{ display:'inline-block', width:13, height:13, border:'2px solid #333', borderTopColor:'#c9a84c', borderRadius:'50%', animation:'spin .7s linear infinite' }}/>
}

export default function Home() {
  const { address, isConnected } = useAccount()
  const { connect } = useConnect()
  const { disconnect } = useDisconnect()
  const { data: usdcBalance, isLoading: balanceLoading } = useBalance({ address })

  const [darkMode, setDarkMode] = useState(true)
  const [tab, setTab] = useState<Tab>('send')
  const [toasts, setToasts] = useState<Toast[]>([])
  const [recipients, setRecipients] = useState<Recipient[]>([])
  const [newName, setNewName] = useState('')
  const [newAddress, setNewAddress] = useState('')
  const [newAmount, setNewAmount] = useState('')
  const [singleAddress, setSingleAddress] = useState('')
  const [singleAmount, setSingleAmount] = useState('')
  const [paying, setPaying] = useState(false)
  const [batchPaying, setBatchPaying] = useState(false)
  const [transactions, setTransactions] = useState<any[]>([])
  const [txResult, setTxResult] = useState<{txHash:string,explorerUrl?:string}|null>(null)
  const [favorites, setFavorites] = useState<{name:string,address:string}[]>([])
  const [bridgeAmount, setBridgeAmount] = useState('')
  const [bridgePaying, setBridgePaying] = useState(false)
  const [bridgeResult, setBridgeResult] = useState<{txHash:string,explorerUrl?:string}|null>(null)
  const [bridgeFrom, setBridgeFrom] = useState('Ethereum_Sepolia')
  const [bridgeTo, setBridgeTo] = useState('Arc_Testnet')
  const [swapAmountIn, setSwapAmountIn] = useState('')
  const [swapTokenIn, setSwapTokenIn] = useState('USDC')
  const [swapTokenOut, setSwapTokenOut] = useState('EURC')
  const [swapSlippage, setSwapSlippage] = useState('1')
  const [swapPaying, setSwapPaying] = useState(false)
  const [swapResult, setSwapResult] = useState<{txHash:string,explorerUrl?:string}|null>(null)
  const [nftImageUrl, setNftImageUrl] = useState('')
  const [nftImagePreview, setNftImagePreview] = useState('')
  const [uploadingImage, setUploadingImage] = useState(false)
  const [liveTxs, setLiveTxs] = useState<LiveTx[]>([])
  const [xUser, setXUser] = useState<{id:string,username:string,name:string,avatar:string}|null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const nftImageRef = useRef<HTMLInputElement>(null)

  const D = darkMode
  const bg = D ? '#0a0a0a' : '#f5f5f5'
  const card = D ? '#0e0e0e' : '#ffffff'
  const border = D ? '#1a1a1a' : '#e0e0e0'
  const text = D ? '#ffffff' : '#111111'
  const muted = D ? '#444444' : '#888888'
  const subtle = D ? '#333333' : '#bbbbbb'
  const field = D ? '#080808' : '#f8f8f8'
  const fieldBorder = D ? '#181818' : '#e8e8e8'
  const navBg = D ? '#0a0a0a' : '#ffffff'

  useEffect(() => {
    const favs = localStorage.getItem('arc_favorites')
    if (favs) setFavorites(JSON.parse(favs))
    const txs = localStorage.getItem('arc_transactions')
    if (txs) setTransactions(JSON.parse(txs))
    const cookie = document.cookie.split(';').find(c => c.trim().startsWith('arc_x_user='))
    if (cookie) {
      try {
        const val = decodeURIComponent(cookie.split('=').slice(1).join('='))
        setXUser(JSON.parse(val))
      } catch {}
    }
    fetchLiveTxs()
    const interval = setInterval(fetchLiveTxs, 10000)
    return () => clearInterval(interval)
  }, [])

  const fetchLiveTxs = async () => {
    try {
      const res = await fetch('/api/live-txs')
      if (res.ok) {
        const data = await res.json()
        setLiveTxs(data.txs || [])
      }
    } catch {}
  }

  const balanceFormatted = balanceLoading ? null : usdcBalance ? (Number(usdcBalance.value)/1e18).toFixed(2) : '0.00'
  const totalPaid = transactions.reduce((s,t) => s+parseFloat(t.amount||'0'), 0)
  const pendingCount = recipients.filter(r => r.status==='pending').length
  const swapAmountOut = swapAmountIn ? (parseFloat(swapAmountIn)*(RATES[swapTokenIn]?.[swapTokenOut]||1)).toFixed(4) : '0'

  const addToast = useCallback((type: Toast['type'], message: string) => {
    const id = Math.random().toString(36).slice(2)
    setToasts(prev => [...prev, {id,type,message}])
    if (type!=='loading') setTimeout(() => setToasts(prev => prev.filter(t => t.id!==id)), 4000)
    return id
  }, [])
  const removeToast = (id: string) => setToasts(prev => prev.filter(t => t.id!==id))

  const saveTransaction = async (name:string, addr:string, amount:string, txHash:string, explorerUrl?:string, type='Send') => {
    const tx = { id:Math.random().toString(36).slice(2), name, address:addr, amount, txHash, explorerUrl, timestamp:new Date().toISOString() }
    setTransactions(prev => [tx,...prev])
    const stored = localStorage.getItem('arc_transactions')
    const existing = stored ? JSON.parse(stored) : []
    localStorage.setItem('arc_transactions', JSON.stringify([tx,...existing]))
    // Redis'e kaydet (live feed için)
    try {
      await fetch('/api/live-txs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          handle: xUser?.username || addr.slice(0,6),
          to: addr,
          amount,
          type,
        })
      })
    } catch {}
  }

  const sendSingle = async () => {
    if (!singleAddress||!singleAmount) { addToast('error','Please enter address and amount'); return }
    setPaying(true); setTxResult(null)
    const tid = addToast('loading','Sending USDC...')
    try {
      const {AppKit} = await import('@circle-fin/app-kit')
      const {createViemAdapterFromProvider} = await import('@circle-fin/adapter-viem-v2')
      const kit = new AppKit()
      const adapter = await createViemAdapterFromProvider({provider:(window as any).ethereum})
      const res = await kit.send({from:{adapter,chain:'Arc_Testnet' as never},to:singleAddress,amount:singleAmount,token:'USDC'})
      const txHash = (res as any)?.hash||(res as any)?.txHash||''
      await saveTransaction('Payment',singleAddress,singleAmount,txHash,`https://testnet.arcscan.app/tx/${txHash}`)
      setTxResult({txHash,explorerUrl:`https://testnet.arcscan.app/tx/${txHash}`})
      setSingleAddress(''); setSingleAmount('')
      removeToast(tid); addToast('success',`Sent ${singleAmount} USDC!`)
    } catch(e:any) { removeToast(tid); addToast('error','Error: '+e.message) }
    setPaying(false)
  }

  const sendBridge = async () => {
    if (!bridgeAmount) { addToast('error','Please enter amount'); return }
    setBridgePaying(true); setBridgeResult(null)
    const tid = addToast('loading','Bridging USDC...')
    try {
      const {AppKit} = await import('@circle-fin/app-kit')
      const {createViemAdapterFromProvider} = await import('@circle-fin/adapter-viem-v2')
      const kit = new AppKit()
      const adapter = await createViemAdapterFromProvider({provider:(window as any).ethereum})
      const res = await kit.bridge({from:{adapter,chain:bridgeFrom as never},to:{adapter,chain:bridgeTo as never},amount:bridgeAmount,token:'USDC'})
      const txHash = (res as any)?.hash||(res as any)?.txHash||''
      await saveTransaction('Bridge',address||'',bridgeAmount,txHash,`https://testnet.arcscan.app/tx/${txHash}`,'Bridge')
      setBridgeResult({txHash,explorerUrl:`https://testnet.arcscan.app/tx/${txHash}`})
      setBridgeAmount('')
      removeToast(tid); addToast('success',`Bridged ${bridgeAmount} USDC!`)
    } catch(e:any) { removeToast(tid); addToast('error','Bridge failed: '+e.message) }
    setBridgePaying(false)
  }

  const sendSwap = async () => {
    if (!swapAmountIn) { addToast('error','Please enter amount'); return }
    setSwapPaying(true); setSwapResult(null)
    const tid = addToast('loading','Swapping...')
    try {
      const {AppKit} = await import('@circle-fin/app-kit')
      const {createViemAdapterFromProvider} = await import('@circle-fin/adapter-viem-v2')
      const kit = new AppKit()
      const adapter = await createViemAdapterFromProvider({provider:(window as any).ethereum})
      const res = await kit.swap({from:{adapter,chain:'Arc_Testnet' as never},tokenIn:swapTokenIn,tokenOut:swapTokenOut,amountIn:swapAmountIn,config:{slippageBps:Math.round(parseFloat(swapSlippage)*100)}})
      const txHash = (res as any)?.hash||(res as any)?.txHash||''
      await saveTransaction(`Swap ${swapTokenIn}→${swapTokenOut}`,address||'',swapAmountIn,txHash,`https://testnet.arcscan.app/tx/${txHash}`,'Swap')
      setSwapResult({txHash,explorerUrl:`https://testnet.arcscan.app/tx/${txHash}`})
      setSwapAmountIn('')
      removeToast(tid); addToast('success','Swapped!')
    } catch(e:any) { removeToast(tid); addToast('error','Swap failed: '+e.message) }
    setSwapPaying(false)
  }

  const addRecipient = () => {
    if (!newName||!newAddress||!newAmount) { addToast('error','Fill all fields'); return }
    setRecipients([...recipients,{id:Math.random().toString(36).slice(2),name:newName,address:newAddress,amount:newAmount,status:'pending'}])
    setNewName(''); setNewAddress(''); setNewAmount('')
  }

  const sendBatch = async () => {
    const pending = recipients.filter(r=>r.status==='pending')
    if (!pending.length) return
    if (!confirm(`Send to ${pending.length} recipients?`)) return
    setBatchPaying(true)
    const {AppKit} = await import('@circle-fin/app-kit')
    const {createViemAdapterFromProvider} = await import('@circle-fin/adapter-viem-v2')
    const kit = new AppKit()
    const adapter = await createViemAdapterFromProvider({provider:(window as any).ethereum})
    let success = 0
    for (const r of pending) {
      try {
        const res = await kit.send({from:{adapter,chain:'Arc_Testnet' as never},to:r.address,amount:r.amount,token:'USDC'})
        const txHash = (res as any)?.hash||''
        await saveTransaction(r.name,r.address,r.amount,txHash,undefined,'Batch')
        setRecipients(prev=>prev.map(x=>x.id===r.id?{...x,status:'paid',txHash}:x))
        success++
      } catch {}
    }
    addToast('success',`${success}/${pending.length} sent!`)
    setBatchPaying(false)
  }

  const handleNFTImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return
    setNftImagePreview(URL.createObjectURL(file))
    setUploadingImage(true)
    const tid = addToast('loading','Uploading to IPFS...')
    try {
      const url = await uploadImageToIPFS(file)
      setNftImageUrl(url)
      removeToast(tid); addToast('success','Uploaded!')
    } catch { removeToast(tid); addToast('error','Upload failed') }
    setUploadingImage(false)
  }

  const importCSV = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return
    Papa.parse(file,{header:true,complete:(results)=>{
      const imported = (results.data as any[]).filter(r=>r.address&&r.amount).map(r=>({
        id:Math.random().toString(36).slice(2),name:r.name||'Unknown',address:r.address,amount:r.amount,status:'pending' as const
      }))
      setRecipients(prev=>[...prev,...imported])
      addToast('success',`${imported.length} imported!`)
    }})
  }

  const downloadTemplate = () => {
    const csv = 'name,address,amount\nJohn,0x1234567890123456789012345678901234567890,100'
    const blob = new Blob([csv],{type:'text/csv'})
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href=url; a.download='template.csv'; a.click()
  }

  const TxBox = ({result,amount,token}:{result:{txHash:string,explorerUrl?:string},amount?:string,token?:string}) => (
    <div style={{borderRadius:12,padding:12,background:'#0a1a0a',border:'1px solid #1a3a1a',marginTop:10}}>
      <div style={{fontSize:12,color:'#4ade80',fontWeight:700,marginBottom:4}}>✓ Confirmed</div>
      <p style={{fontSize:11,color:muted,fontFamily:'monospace',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{result.txHash}</p>
      {result.explorerUrl&&<a href={result.explorerUrl} target="_blank" rel="noopener noreferrer" style={{fontSize:11,color:'#c9a84c',textDecoration:'none',marginTop:4,display:'block'}}>View on ArcScan →</a>}
    </div>
  )

  const WavesLogo = ({size=20}:{size?:number}) => (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none">
      <path d="M14 18 C14 18 24 10 34 18" stroke="#c9a84c" strokeWidth="2.5" fill="none" strokeLinecap="round"/>
      <path d="M14 24 C14 24 24 16 34 24" stroke="#c9a84c" strokeWidth="2.5" fill="none" strokeLinecap="round"/>
      <path d="M14 30 C14 30 24 22 34 30" stroke="#c9a84c" strokeWidth="2.5" fill="none" strokeLinecap="round"/>
    </svg>
  )

  // ============ LOGIN SAYFASI ============
  if (!isConnected) {
    const tickerItems = liveTxs.length > 0 ? liveTxs : [
      { id:'1', handle:'GoGo', to:'0x1234', amount:'50', type:'Send', time:'2s' },
      { id:'2', handle:'alice', to:'0x5678', amount:'1000', type:'Bridge', time:'14s' },
      { id:'3', handle:'crypto_joe', to:'batch', amount:'5400', type:'Batch', time:'1m' },
      { id:'4', handle:'defi_sara', to:'EURC', amount:'800', type:'Swap', time:'2m' },
    ]

    return (
      <div style={{ minHeight:'100vh', background:'#0a0a0a', color:'#fff', fontFamily:'-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif', display:'flex', flexDirection:'column', position:'relative', overflow:'hidden' }}>
        <style>{GLOBAL_CSS}</style>

        {/* Grid bg */}
        <div style={{ position:'absolute', inset:0, backgroundImage:'linear-gradient(#151515 1px,transparent 1px),linear-gradient(90deg,#151515 1px,transparent 1px)', backgroundSize:'44px 44px', opacity:.35, pointerEvents:'none', animation:'gridGlow 6s ease infinite' }}/>
        {/* Center glow */}
        <div style={{ position:'absolute', top:'42%', left:'50%', transform:'translate(-50%,-50%)', width:600, height:600, background:'radial-gradient(circle,#c9a84c08 0%,transparent 65%)', pointerEvents:'none', animation:'glow 5s ease infinite' }}/>

        {/* NAV */}
        <nav style={{ borderBottom:'1px solid #141414', padding:'13px 24px', display:'flex', alignItems:'center', justifyContent:'space-between', position:'relative', zIndex:10 }}>
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            <div style={{ width:34, height:34, background:'#111', border:'1px solid #1e1e1e', borderRadius:10, display:'flex', alignItems:'center', justifyContent:'center' }}>
              <WavesLogo size={20}/>
            </div>
            <div>
              <div style={{ fontWeight:700, fontSize:13 }}>Arc Global Payouts</div>
              <div style={{ fontSize:8, color:'#c9a84c', fontWeight:700, letterSpacing:1 }}>ARC NETWORK · by GoGo</div>
            </div>
          </div>
          <a href="https://github.com/GoGoSns/arc-payouts" target="_blank" rel="noopener noreferrer" style={{ fontSize:11, color:'#333', padding:'5px 12px', background:'#111', border:'1px solid #1a1a1a', borderRadius:8, textDecoration:'none' }}>GitHub ↗</a>
        </nav>

        {/* LIVE TICKER */}
        <div style={{ borderBottom:'1px solid #141414', background:'#080808', overflow:'hidden', padding:'7px 0', position:'relative', zIndex:10 }}>
          <div style={{ display:'flex', gap:32, whiteSpace:'nowrap', animation:'ticker 20s linear infinite', width:'max-content' }}>
            {[...tickerItems,...tickerItems].map((t,i) => (
              <span key={i} style={{ display:'inline-flex', alignItems:'center', gap:8, fontSize:11, color:'#444' }}>
                <span style={{ width:5, height:5, borderRadius:'50%', background: t.type==='Bridge'?'#60a5fa':t.type==='Swap'?'#f59e0b':t.type==='Batch'?'#a78bfa':'#4ade80', display:'inline-block' }}/>
                <strong style={{ color:'#fff' }}>@{t.handle}</strong>
                <span>{t.type==='Batch'?'batch paid':`${t.type.toLowerCase()}ed`}</span>
                <span style={{ color:'#c9a84c', fontWeight:700 }}>${t.amount} USDC</span>
                <span style={{ color:'#333' }}>{t.time} ago</span>
              </span>
            ))}
          </div>
        </div>

        {/* HERO */}
        <div style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:'36px 24px 24px', textAlign:'center', position:'relative', zIndex:10 }}>

          {/* Büyük logo */}
          <div style={{ position:'relative', width:88, height:88, margin:'0 auto 28px', animation:'float 4s ease infinite' }}>
            <div style={{ position:'absolute', inset:-4, borderRadius:26, background:'conic-gradient(transparent 0deg,#c9a84c 70deg,transparent 130deg)', animation:'sweep 2.5s linear infinite' }}/>
            <div style={{ position:'absolute', inset:2, background:'#111', borderRadius:22, display:'flex', alignItems:'center', justifyContent:'center', border:'1px solid #1e1e1e' }}>
              <WavesLogo size={40}/>
            </div>
          </div>

          <div style={{ fontSize:10, fontWeight:700, color:'#c9a84c', letterSpacing:2.5, marginBottom:14, display:'flex', alignItems:'center', gap:8 }}>
            <span style={{ width:5, height:5, borderRadius:'50%', background:'#c9a84c', display:'inline-block', animation:'pulse 2s infinite' }}/>
            BUILT ON ARC NETWORK
            <span style={{ width:5, height:5, borderRadius:'50%', background:'#c9a84c', display:'inline-block', animation:'pulse 2s infinite' }}/>
          </div>

          <h1 style={{ fontSize:50, fontWeight:800, letterSpacing:'-2px', lineHeight:1.05, marginBottom:16, animation:'fadeUp .5s ease both' }}>
            Send USDC<br/>
            <span style={{ color:'#c9a84c' }}>Instantly.</span>{' '}
            <span style={{ color:'#222' }}>Globally.</span>
          </h1>

          <p style={{ fontSize:15, color:'#444', lineHeight:1.8, marginBottom:28, maxWidth:400, animation:'fadeUp .5s .1s ease both' }}>
            No banks. No delays. No limits.<br/>Just your wallet and a @handle.
          </p>

          {/* Stats — gerçek veriler */}
          <div style={{ display:'flex', gap:0, marginBottom:32, background:'#0e0e0e', border:'1px solid #1a1a1a', borderRadius:14, overflow:'hidden', animation:'fadeUp .5s .15s ease both' }}>
            {[
              { val:'$0', label:'FEES', color:'#4ade80' },
              { val:'<1s', label:'FINALITY', color:'#60a5fa' },
              { val:'∞', label:'RECIPIENTS', color:'#a78bfa' },
              { val:'24/7', label:'UPTIME', color:'#f59e0b' },
            ].map((s,i) => (
              <div key={i} style={{ flex:1, padding:'14px 10px', textAlign:'center', borderRight: i<3 ? '1px solid #1a1a1a' : 'none' }}>
                <div style={{ fontSize:20, fontWeight:300, color:s.color, letterSpacing:'-0.5px' }}>{s.val}</div>
                <div style={{ fontSize:9, color:'#333', marginTop:3, fontWeight:700, letterSpacing:.5 }}>{s.label}</div>
              </div>
            ))}
          </div>

          {/* Connect butonu — parlayan border */}
          <button
            onClick={() => connect({ connector: injected() })}
            style={{ padding:'15px 52px', background:'linear-gradient(135deg,#c9a84c,#a07830)', color:'#000', border:'none', borderRadius:16, fontSize:15, fontWeight:800, cursor:'pointer', marginBottom:28, animation:'breathe 2.5s ease infinite', letterSpacing:.3 }}>
            Connect Wallet →
          </button>

          {/* Steps */}
          <div style={{ display:'flex', gap:6, marginBottom:28, animation:'fadeUp .5s .25s ease both' }}>
            {[
              { n:'1', title:'Add Arc Testnet', sub:'MetaMask ↗', href:'https://thirdweb.com/arc-testnet' },
              { n:'2', title:'Get Test USDC', sub:'Circle Faucet ↗', href:'https://faucet.circle.com' },
            ].map(s => (
              <a key={s.n} href={s.href} target="_blank" rel="noopener noreferrer" style={{ display:'flex', alignItems:'center', gap:8, padding:'9px 14px', background:'#0e0e0e', border:'1px solid #1a1a1a', borderRadius:12, textDecoration:'none' }}>
                <span style={{ position:'relative', width:22, height:22, borderRadius:7, overflow:'hidden', display:'inline-flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                  <span style={{ position:'absolute', inset:-3, background:'conic-gradient(transparent 0deg,#c9a84c 55deg,transparent 110deg)', animation:'sweep 2.5s linear infinite' }}/>
                  <span style={{ position:'absolute', inset:1, background:'#1a1500', borderRadius:6, display:'flex', alignItems:'center', justifyContent:'center', zIndex:1, fontSize:9, fontWeight:800, color:'#c9a84c' }}>{s.n}</span>
                </span>
                <div>
                  <div style={{ fontSize:11, fontWeight:700, color:'#fff' }}>{s.title}</div>
                  <div style={{ fontSize:9, color:'#444' }}>{s.sub}</div>
                </div>
              </a>
            ))}
          </div>

          {/* Feature pills */}
          <div style={{ display:'flex', gap:5, flexWrap:'wrap', justifyContent:'center', animation:'fadeUp .5s .3s ease both' }}>
            {FEATURES.map(f => (
              <Link key={f.href} href={f.href} style={{ display:'flex', alignItems:'center', gap:6, padding:'5px 11px', borderRadius:20, border:`1px solid ${f.border}`, background:f.bg, textDecoration:'none' }}>
                <SweepIcon short={f.short} color={f.color} bg={f.bg} dark={f.dark} size={16}/>
                <span style={{ fontSize:10, fontWeight:600, color:f.color }}>{f.label}</span>
              </Link>
            ))}
          </div>
        </div>

        <div style={{ textAlign:'center', padding:12, fontSize:10, color:'#1a1a1a', borderTop:'1px solid #111', position:'relative', zIndex:10 }}>
          Arc Global Payouts · Built on Arc Network · by GoGo
        </div>
      </div>
    )
  }

  // ============ DASHBOARD ============
  return (
    <div style={{ minHeight:'100vh', display:'flex', flexDirection:'column', background:bg, color:text, fontFamily:'-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif' }}>
      <style>{GLOBAL_CSS}</style>

      {/* TOASTS */}
      <div style={{ position:'fixed', top:16, right:16, zIndex:50, display:'flex', flexDirection:'column', gap:8, pointerEvents:'none' }}>
        {toasts.map(t => (
          <div key={t.id} style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 14px', borderRadius:12, fontSize:13, fontWeight:500, pointerEvents:'auto', border:'1px solid', background:t.type==='success'?'#0a1a0a':t.type==='error'?'#1a0a0a':'#111', borderColor:t.type==='success'?'#1a3a1a':t.type==='error'?'#3a1a1a':'#222', color:t.type==='success'?'#4ade80':t.type==='error'?'#f87171':'#888' }}>
            <span>{t.type==='success'?'✓':t.type==='error'?'✕':<Spinner/>}</span>
            <span>{t.message}</span>
            <button onClick={()=>removeToast(t.id)} style={{ marginLeft:8, fontSize:11, opacity:.4, background:'none', border:'none', cursor:'pointer', color:'inherit' }}>✕</button>
          </div>
        ))}
      </div>

      {/* NAVBAR */}
      <nav style={{ borderBottom:`1px solid ${border}`, padding:'11px 16px', display:'flex', justifyContent:'space-between', alignItems:'center', background:navBg }}>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <div style={{ width:32, height:32, background:D?'#111':'#f0f0f0', border:`1px solid ${border}`, borderRadius:9, display:'flex', alignItems:'center', justifyContent:'center' }}>
            <WavesLogo size={18}/>
          </div>
          <div>
            <div style={{ fontWeight:700, fontSize:13, color:text }}>Arc Global Payouts</div>
            <div style={{ fontSize:8, color:'#c9a84c', fontWeight:700, letterSpacing:'.8px' }}>ARC NETWORK <span style={{ color:muted }}>· by GoGo</span></div>
          </div>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:6, flexWrap:'wrap' }}>
          <div style={{ display:'flex', alignItems:'center', gap:5, background:D?'#111':'#f0f0f0', border:`1px solid ${border}`, borderRadius:20, padding:'3px 9px' }}>
            <div style={{ width:6, height:6, borderRadius:'50%', background:'#c9a84c', animation:'pulse 2s infinite' }}/>
            <span style={{ fontSize:10, color:muted }}>Arc Testnet</span>
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:5, background:D?'#111':'#f0f0f0', border:`1px solid ${border}`, borderRadius:20, padding:'3px 9px' }}>
            <div style={{ width:20, height:20, borderRadius:'50%', background:'linear-gradient(135deg,#c9a84c,#a07830)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:9, fontWeight:800, color:'#000' }}>G</div>
            <span style={{ fontSize:10, color:muted }}>{address?.slice(0,6)}...{address?.slice(-4)}</span>
          </div>
          <Link href="/history" style={{ fontSize:10, color:muted, textDecoration:'none', padding:'3px 8px', background:D?'#111':'#f0f0f0', border:`1px solid ${border}`, borderRadius:6 }}>History</Link>

          {/* X kullanıcısı */}
          {xUser ? (
            <div style={{ display:'flex', alignItems:'center', gap:5, padding:'3px 9px', background:'#0a1628', border:'1px solid #1e3a5f', borderRadius:20 }}>
              {xUser.avatar && <img src={xUser.avatar} alt="" style={{ width:18, height:18, borderRadius:'50%' }}/>}
              <span style={{ fontSize:10, color:'#60a5fa', fontWeight:700 }}>@{xUser.username}</span>
            </div>
          ) : (
            <a href="/api/auth" style={{ fontSize:10, padding:'4px 10px', background:'linear-gradient(135deg,#c9a84c,#a07830)', borderRadius:6, color:'#000', fontWeight:800, textDecoration:'none', display:'flex', alignItems:'center', gap:4 }}>
              <svg width="9" height="9" viewBox="0 0 24 24" fill="#000"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.73-8.835L1.254 2.25H8.08l4.253 5.622 5.911-5.622zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
              Create My Profile
            </a>
          )}

          <button onClick={()=>setDarkMode(!D)} style={{ fontSize:11, padding:'3px 7px', background:D?'#111':'#f0f0f0', border:`1px solid ${border}`, borderRadius:6, cursor:'pointer', color:text }}>
            {D?'☀':'🌙'}
          </button>
          <button onClick={()=>disconnect()} style={{ fontSize:10, color:muted, cursor:'pointer', background:'none', border:'none' }}>Disconnect</button>
        </div>
      </nav>

      {/* FEATURE BAR */}
      <div style={{ borderBottom:`1px solid ${border}`, padding:'0 16px', overflowX:'auto', background:navBg }}>
        <div style={{ display:'flex', gap:6, minWidth:'max-content', padding:'10px 0', alignItems:'center' }}>
          {/* Main tabs */}
          {(['send','batch','nft','bridge','swap'] as Tab[]).map((t,i) => {
            const labels = ['Send','Batch','NFT','Bridge','Swap']
            const shorts = ['S','B','N','Br','Sw']
            const isActive = tab === t
            return (
              <button key={t} onClick={()=>setTab(t)}
                style={{ display:'flex', alignItems:'center', gap:7, padding:'7px 13px', borderRadius:10, border:`1px solid ${isActive?'#c9a84c55':border}`, background:isActive?'#1a1500':D?'#0e0e0e':'#f8f8f8', cursor:'pointer', flexShrink:0 }}>
                <SweepIcon short={shorts[i]} color={isActive?'#c9a84c':'#555'} bg={isActive?'#1a1500':D?'#0e0e0e':'#f0f0f0'} dark={isActive?'#2a2000':D?'#141414':'#e8e8e8'} size={22}/>
                <span style={{ fontSize:11, fontWeight:isActive?700:500, color:isActive?'#c9a84c':muted, whiteSpace:'nowrap' }}>{labels[i]}</span>
              </button>
            )
          })}

          <div style={{ width:1, height:26, background:border, flexShrink:0, margin:'0 3px' }}/>

          {/* Feature tabs */}
          {FEATURES.map(f => (
            <Link key={f.href} href={f.href} style={{ display:'flex', alignItems:'center', gap:7, padding:'7px 13px', borderRadius:10, border:`1px solid ${f.border}`, background:f.bg, textDecoration:'none', flexShrink:0 }}>
              <SweepIcon short={f.short} color={f.color} bg={f.bg} dark={f.dark} size={22}/>
              <span style={{ fontSize:11, fontWeight:700, color:f.color, whiteSpace:'nowrap' }}>{f.label}</span>
            </Link>
          ))}
        </div>
      </div>

      <div style={{ display:'flex', flex:1 }}>

        {/* MAIN CONTENT */}
        <div style={{ flex:1, display:'flex', alignItems:'flex-start', justifyContent:'center', padding:'20px 16px' }}>

          {/* SEND TAB */}
          {tab==='send' && (
            <div style={{ width:'100%', maxWidth:440, background:card, border:`1px solid ${border}`, borderRadius:20, padding:20 }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8 }}>
                <label style={{ fontSize:9, fontWeight:700, letterSpacing:'.4px', color:muted }}>YOU PAY</label>
                <span style={{ fontSize:10, color:muted }}>Balance: ${balanceFormatted||'—'}</span>
              </div>
              <div style={{ background:field, border:`1px solid ${fieldBorder}`, borderRadius:14, padding:'12px 14px', marginBottom:8 }}>
                <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                  <input type="number" value={singleAmount} onChange={e=>setSingleAmount(e.target.value)} placeholder="0"
                    style={{ fontSize:32, fontWeight:300, flex:1, background:'transparent', border:'none', color:text, outline:'none', letterSpacing:'-1px' }}/>
                  <div style={{ background:D?'#141414':'#f0f0f0', border:`1px solid ${border}`, borderRadius:20, padding:'5px 11px', display:'flex', alignItems:'center', gap:5 }}>
                    <div style={{ width:7, height:7, borderRadius:'50%', background:'#6366f1' }}/>
                    <span style={{ fontSize:12, fontWeight:700, color:text }}>USDC</span>
                  </div>
                </div>
                <div style={{ fontSize:10, color:subtle, marginTop:5 }}>Arc Testnet</div>
              </div>
              {/* Quick amounts */}
              <div style={{ display:'flex', gap:5, marginBottom:8 }}>
                {['10','25','50','100'].map(v => (
                  <button key={v} onClick={()=>setSingleAmount(v)}
                    style={{ flex:1, padding:'5px 0', borderRadius:8, border:`1px solid ${singleAmount===v?'#c9a84c':border}`, background:singleAmount===v?'#1a1500':field, color:singleAmount===v?'#c9a84c':muted, fontSize:11, fontWeight:700, cursor:'pointer' }}>
                    ${v}
                  </button>
                ))}
              </div>
              <div style={{ display:'flex', justifyContent:'center', marginBottom:8 }}>
                <div style={{ width:28, height:28, background:D?'#080808':field, border:`1px solid ${border}`, borderRadius:8, display:'flex', alignItems:'center', justifyContent:'center', fontSize:12, color:subtle }}>↓</div>
              </div>
              <label style={{ fontSize:9, fontWeight:700, letterSpacing:'.4px', color:muted, display:'block', marginBottom:8 }}>TO</label>
              <div style={{ background:field, border:`1px solid ${fieldBorder}`, borderRadius:14, padding:'12px 14px', marginBottom:14 }}>
                <input type="text" value={singleAddress} onChange={e=>setSingleAddress(e.target.value)} placeholder="Wallet address or @handle"
                  style={{ fontSize:13, background:'transparent', border:'none', color:singleAddress?text:muted, outline:'none', width:'100%' }}/>
                <div style={{ fontSize:10, color:subtle, marginTop:4 }}>Arc Testnet</div>
              </div>
              <button onClick={sendSingle} disabled={paying}
                style={{ width:'100%', padding:13, borderRadius:12, fontWeight:800, fontSize:13, border:'none', cursor:paying?'default':'pointer', background:paying?D?'#333':'#ccc':'linear-gradient(135deg,#c9a84c,#a07830)', color:paying?D?'#666':'#999':'#000' }}>
                {paying?<span style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:8 }}><Spinner/>SENDING...</span>:'CONFIRM TRANSFER'}
              </button>
              {txResult && <TxBox result={txResult} amount={singleAmount} token="USDC"/>}
            </div>
          )}

          {/* BRIDGE TAB */}
          {tab==='bridge' && (
            <div style={{ width:'100%', maxWidth:440, background:card, border:`1px solid ${border}`, borderRadius:20, padding:20 }}>
              <label style={{ fontSize:9, fontWeight:700, letterSpacing:'.4px', color:muted, display:'block', marginBottom:8 }}>FROM</label>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:6, marginBottom:12 }}>
                {CHAINS.filter(c=>c.id!==bridgeTo).map(chain => (
                  <button key={chain.id} onClick={()=>setBridgeFrom(chain.id)}
                    style={{ padding:'7px 4px', borderRadius:10, fontSize:10, fontWeight:600, border:'1px solid', cursor:'pointer', borderColor:bridgeFrom===chain.id?'#c9a84c':border, color:bridgeFrom===chain.id?'#c9a84c':muted, background:bridgeFrom===chain.id?'#1a1500':field }}>
                    <span style={{ display:'inline-block', width:7, height:7, borderRadius:'50%', marginRight:4, background:chain.color }}/>
                    {chain.label}
                  </button>
                ))}
              </div>
              <div style={{ background:field, border:`1px solid ${fieldBorder}`, borderRadius:14, padding:'12px 14px', marginBottom:10 }}>
                <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                  <input type="number" value={bridgeAmount} onChange={e=>setBridgeAmount(e.target.value)} placeholder="0"
                    style={{ fontSize:32, fontWeight:300, flex:1, background:'transparent', border:'none', color:text, outline:'none', letterSpacing:'-1px' }}/>
                  <div style={{ background:D?'#141414':'#f0f0f0', border:`1px solid ${border}`, borderRadius:20, padding:'5px 11px', display:'flex', alignItems:'center', gap:5 }}>
                    <div style={{ width:7, height:7, borderRadius:'50%', background:'#6366f1' }}/>
                    <span style={{ fontSize:12, fontWeight:700, color:text }}>USDC</span>
                  </div>
                </div>
              </div>
              <div style={{ display:'flex', justifyContent:'center', marginBottom:10 }}>
                <button onClick={()=>{ const t=bridgeFrom; setBridgeFrom(bridgeTo); setBridgeTo(t) }}
                  style={{ width:36, height:36, border:`1px solid ${border}`, borderRadius:'50%', background:card, fontSize:16, color:muted, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}>⇅</button>
              </div>
              <label style={{ fontSize:9, fontWeight:700, letterSpacing:'.4px', color:muted, display:'block', marginBottom:8 }}>TO</label>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:6, marginBottom:14 }}>
                {CHAINS.filter(c=>c.id!==bridgeFrom).map(chain => (
                  <button key={chain.id} onClick={()=>setBridgeTo(chain.id)}
                    style={{ padding:'7px 4px', borderRadius:10, fontSize:10, fontWeight:600, border:'1px solid', cursor:'pointer', borderColor:bridgeTo===chain.id?'#c9a84c':border, color:bridgeTo===chain.id?'#c9a84c':muted, background:bridgeTo===chain.id?'#1a1500':field }}>
                    <span style={{ display:'inline-block', width:7, height:7, borderRadius:'50%', marginRight:4, background:chain.color }}/>
                    {chain.label}
                  </button>
                ))}
              </div>
              <button onClick={sendBridge} disabled={bridgePaying}
                style={{ width:'100%', padding:13, borderRadius:12, fontWeight:800, fontSize:13, border:'none', cursor:bridgePaying?'default':'pointer', background:bridgePaying?D?'#333':'#ccc':'linear-gradient(135deg,#c9a84c,#a07830)', color:bridgePaying?D?'#666':'#999':'#000' }}>
                {bridgePaying?<span style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:8 }}><Spinner/>BRIDGING...</span>:'CONFIRM BRIDGE'}
              </button>
              {bridgeResult && <TxBox result={bridgeResult} amount={bridgeAmount} token="USDC"/>}
            </div>
          )}

          {/* SWAP TAB */}
          {tab==='swap' && (
            <div style={{ width:'100%', maxWidth:440, background:card, border:`1px solid ${border}`, borderRadius:20, padding:20 }}>
              <label style={{ fontSize:9, fontWeight:700, letterSpacing:'.4px', color:muted, display:'block', marginBottom:6 }}>YOU PAY</label>
              <div style={{ background:field, border:`1px solid ${fieldBorder}`, borderRadius:14, padding:'12px 14px', marginBottom:10 }}>
                <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                  <input type="number" value={swapAmountIn} onChange={e=>setSwapAmountIn(e.target.value)} placeholder="0"
                    style={{ fontSize:32, fontWeight:300, flex:1, background:'transparent', border:'none', color:text, outline:'none', letterSpacing:'-1px' }}/>
                  <select value={swapTokenIn} onChange={e=>setSwapTokenIn(e.target.value)}
                    style={{ background:D?'#141414':'#f0f0f0', border:`1px solid ${border}`, borderRadius:20, padding:'5px 11px', fontSize:12, fontWeight:700, color:text, outline:'none', cursor:'pointer' }}>
                    {TOKENS.filter(t=>t!==swapTokenOut).map(t=><option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
              </div>
              <div style={{ display:'flex', justifyContent:'center', marginBottom:10 }}>
                <button onClick={()=>{ const t=swapTokenIn; setSwapTokenIn(swapTokenOut); setSwapTokenOut(t) }}
                  style={{ width:36, height:36, border:`1px solid ${border}`, borderRadius:'50%', background:card, fontSize:16, color:muted, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}>⇅</button>
              </div>
              <label style={{ fontSize:9, fontWeight:700, letterSpacing:'.4px', color:muted, display:'block', marginBottom:6 }}>YOU RECEIVE</label>
              <div style={{ background:field, border:`1px solid ${fieldBorder}`, borderRadius:14, padding:'12px 14px', marginBottom:10 }}>
                <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                  <span style={{ fontSize:32, fontWeight:300, flex:1, color:muted, letterSpacing:'-1px' }}>{swapAmountOut}</span>
                  <select value={swapTokenOut} onChange={e=>setSwapTokenOut(e.target.value)}
                    style={{ background:D?'#141414':'#f0f0f0', border:`1px solid ${border}`, borderRadius:20, padding:'5px 11px', fontSize:12, fontWeight:700, color:text, outline:'none', cursor:'pointer' }}>
                    {TOKENS.filter(t=>t!==swapTokenIn).map(t=><option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
              </div>
              <div style={{ display:'flex', gap:6, marginBottom:14 }}>
                {['0.5','1','3'].map(s => (
                  <button key={s} onClick={()=>setSwapSlippage(s)}
                    style={{ padding:'5px 12px', borderRadius:8, fontSize:11, fontWeight:700, border:'1px solid', cursor:'pointer', borderColor:swapSlippage===s?'#c9a84c':border, color:swapSlippage===s?'#c9a84c':muted, background:swapSlippage===s?'#1a1500':field }}>{s}%</button>
                ))}
              </div>
              <button onClick={sendSwap} disabled={swapPaying}
                style={{ width:'100%', padding:13, borderRadius:12, fontWeight:800, fontSize:13, border:'none', cursor:swapPaying?'default':'pointer', background:swapPaying?D?'#333':'#ccc':'linear-gradient(135deg,#c9a84c,#a07830)', color:swapPaying?D?'#666':'#999':'#000' }}>
                {swapPaying?<span style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:8 }}><Spinner/>SWAPPING...</span>:'CONFIRM SWAP'}
              </button>
              {swapResult && <TxBox result={swapResult} amount={swapAmountIn} token={swapTokenIn}/>}
            </div>
          )}

          {/* NFT TAB */}
          {tab==='nft' && (
            <div style={{ width:'100%', maxWidth:440, background:card, border:`1px solid ${border}`, borderRadius:20, padding:20 }}>
              <h2 style={{ fontSize:16, fontWeight:700, color:text, marginBottom:14 }}>NFT Receipt</h2>
              <div style={{ display:'flex', gap:10, alignItems:'center', marginBottom:14 }}>
                {nftImagePreview && <img src={nftImagePreview} alt="" style={{ width:60, height:60, borderRadius:10, objectFit:'cover', border:`1px solid ${border}` }}/>}
                <button onClick={()=>nftImageRef.current?.click()} disabled={uploadingImage}
                  style={{ padding:'8px 16px', borderRadius:8, fontSize:12, fontWeight:700, background:'linear-gradient(135deg,#c9a84c,#a07830)', color:'#000', border:'none', cursor:'pointer' }}>
                  {uploadingImage?<span style={{ display:'flex', alignItems:'center', gap:6 }}><Spinner/>Uploading...</span>:nftImageUrl?'✅ Uploaded':'Select Image'}
                </button>
                <input ref={nftImageRef} type="file" accept="image/*" onChange={handleNFTImageSelect} style={{ display:'none' }}/>
              </div>
              {nftImageUrl && <div style={{ background:'#0a1a0a', border:'1px solid #1a3a1a', borderRadius:10, padding:10, fontSize:12, color:'#4ade80' }}>✅ Uploaded to IPFS</div>}
            </div>
          )}

          {/* BATCH TAB */}
          {tab==='batch' && (
            <div style={{ flex:1, padding:'0 16px', maxWidth:900, width:'100%' }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14, flexWrap:'wrap', gap:8 }}>
                <h2 style={{ fontSize:18, fontWeight:700, color:text }}>Batch Payout</h2>
                <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
                  <button onClick={downloadTemplate} style={{ padding:'7px 12px', background:card, border:`1px solid ${border}`, borderRadius:8, fontSize:12, color:muted, cursor:'pointer' }}>Template</button>
                  <button onClick={()=>fileRef.current?.click()} style={{ padding:'7px 12px', background:card, border:`1px solid ${border}`, borderRadius:8, fontSize:12, color:muted, cursor:'pointer' }}>Import CSV</button>
                  <input ref={fileRef} type="file" accept=".csv" onChange={importCSV} style={{ display:'none' }}/>
                  {pendingCount>0 && (
                    <button onClick={sendBatch} disabled={batchPaying}
                      style={{ padding:'7px 14px', borderRadius:8, fontSize:12, fontWeight:800, border:'none', cursor:batchPaying?'default':'pointer', background:batchPaying?D?'#333':'#ccc':'linear-gradient(135deg,#c9a84c,#a07830)', color:batchPaying?D?'#666':'#999':'#000' }}>
                      {batchPaying?<span style={{ display:'flex', alignItems:'center', gap:6 }}><Spinner/>Sending...</span>:`Send to ${pendingCount}`}
                    </button>
                  )}
                </div>
              </div>
              <div style={{ background:card, border:`1px solid ${border}`, borderRadius:14, padding:14, marginBottom:12 }}>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 2fr 1fr auto', gap:8 }}>
                  <input value={newName} onChange={e=>setNewName(e.target.value)} placeholder="Name" style={{ padding:'8px 10px', border:`1px solid ${border}`, borderRadius:8, fontSize:12, background:field, color:text, outline:'none' }}/>
                  <input value={newAddress} onChange={e=>setNewAddress(e.target.value)} placeholder="0x..." style={{ padding:'8px 10px', border:`1px solid ${border}`, borderRadius:8, fontSize:12, background:field, color:text, outline:'none' }}/>
                  <input value={newAmount} onChange={e=>setNewAmount(e.target.value)} placeholder="USDC" type="number" style={{ padding:'8px 10px', border:`1px solid ${border}`, borderRadius:8, fontSize:12, background:field, color:text, outline:'none' }}/>
                  <button onClick={addRecipient} style={{ padding:'8px 14px', borderRadius:8, fontSize:13, fontWeight:800, background:'linear-gradient(135deg,#c9a84c,#a07830)', color:'#000', border:'none', cursor:'pointer' }}>+</button>
                </div>
              </div>
              <div style={{ background:card, border:`1px solid ${border}`, borderRadius:14, overflow:'hidden' }}>
                {recipients.length===0 ? (
                  <div style={{ padding:48, textAlign:'center' }}>
                    <div style={{ fontSize:36, marginBottom:10, opacity:.3 }}>⬜</div>
                    <p style={{ color:muted }}>No recipients yet</p>
                  </div>
                ) : (
                  <table style={{ width:'100%', minWidth:600, borderCollapse:'collapse' }}>
                    <thead>
                      <tr style={{ borderBottom:`1px solid ${border}` }}>
                        {['NAME','ADDRESS','AMOUNT','STATUS','TX'].map(h => (
                          <th key={h} style={{ textAlign:'left', padding:'10px 14px', fontSize:10, fontWeight:700, letterSpacing:'.4px', color:muted }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {recipients.map(r => (
                        <tr key={r.id} style={{ borderBottom:`1px solid ${border}` }}>
                          <td style={{ padding:'12px 14px', fontSize:12, color:text }}>{r.name}</td>
                          <td style={{ padding:'12px 14px', fontSize:11, color:muted, fontFamily:'monospace' }}>{r.address.slice(0,6)}...{r.address.slice(-4)}</td>
                          <td style={{ padding:'12px 14px', fontSize:12, fontWeight:700, color:'#c9a84c' }}>{r.amount} USDC</td>
                          <td style={{ padding:'12px 14px' }}>
                            <span style={{ padding:'2px 8px', borderRadius:6, fontSize:11, fontWeight:700, background:r.status==='paid'?'#0a1a0a':'#1a1500', color:r.status==='paid'?'#4ade80':'#c9a84c' }}>
                              {r.status==='paid'?'✅ Paid':'⏳ Pending'}
                            </span>
                          </td>
                          <td style={{ padding:'12px 14px' }}>
                            {r.txHash ? <a href={`https://testnet.arcscan.app/tx/${r.txHash}`} target="_blank" rel="noopener noreferrer" style={{ fontSize:11, color:'#6366f1', textDecoration:'none' }}>Explorer</a> : <span style={{ fontSize:11, color:subtle }}>—</span>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          )}
        </div>

        {/* RIGHT PANEL */}
        {tab !== 'batch' && (
          <div style={{ width:230, borderLeft:`1px solid ${border}`, padding:12, display:'flex', flexDirection:'column', gap:8, background:D?'#080808':'#fafafa' }}>

            <div style={{ background:card, border:`1px solid ${border}`, borderRadius:12, padding:'11px 12px' }}>
              <div style={{ fontSize:9, color:muted, fontWeight:700, letterSpacing:'.4px', marginBottom:3 }}>USDC BALANCE</div>
              {balanceLoading ? <div style={{ height:28, width:80, background:D?'#1a1a1a':'#e8e8e8', borderRadius:6, animation:'pulse 1.5s infinite' }}/> : (
                <>
                  <div style={{ fontSize:22, fontWeight:300, color:text, letterSpacing:'-1px' }}>${balanceFormatted}</div>
                  <div style={{ fontSize:9, color:'#c9a84c', fontWeight:700, marginTop:2 }}>Arc Testnet · Live</div>
                </>
              )}
            </div>

            {/* My Profile / Create My Profile */}
            {xUser ? (
              <Link href={`/u/${xUser.username.toLowerCase()}`} style={{ display:'flex', alignItems:'center', gap:8, padding:'9px 10px', background:'#1a1500', border:'1px solid #c9a84c44', borderRadius:10, textDecoration:'none' }}>
                {xUser.avatar && <img src={xUser.avatar} alt="" style={{ width:24, height:24, borderRadius:'50%', border:'1px solid #c9a84c33' }}/>}
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:11, fontWeight:800, color:'#c9a84c' }}>My Arc Profile</div>
                  <div style={{ fontSize:9, color:'#555' }}>/u/{xUser.username.toLowerCase()}</div>
                </div>
                <span style={{ fontSize:11, color:'#c9a84c' }}>↗</span>
              </Link>
            ) : (
              <a href="/api/auth" style={{ display:'flex', alignItems:'center', gap:8, padding:'9px 10px', background:'#0a1628', border:'1px solid #1e3a5f', borderRadius:10, textDecoration:'none' }}>
                <SweepIcon short="X" color="#60a5fa" bg="#0a1628" dark="#0d2040" size={20}/>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:11, fontWeight:800, color:'#60a5fa' }}>Create My Profile</div>
                  <div style={{ fontSize:9, color:'#1e3a5f' }}>Login with X to get your link</div>
                </div>
              </a>
            )}

            {/* Challenge widget */}
            <div style={{ background:card, border:'2px solid #c9a84c33', borderRadius:12, padding:'11px 12px', position:'relative', overflow:'hidden' }}>
              <div style={{ position:'absolute', top:0, left:0, right:0, height:2, background:'linear-gradient(90deg,#c9a84c,#4ade80,#c9a84c)' }}/>
              <div style={{ fontSize:9, color:'#c9a84c', fontWeight:700, letterSpacing:'.4px', marginBottom:6 }}>CHALLENGE A FRIEND</div>
              <div style={{ fontSize:11, color:text, fontWeight:600, marginBottom:3 }}>USDC Tetris Bet</div>
              <div style={{ fontSize:10, color:muted, marginBottom:8 }}>Set a target → friend plays → winner gets USDC!</div>
              <Link href="/game" style={{ display:'block', padding:'7px 0', background:'linear-gradient(135deg,#c9a84c,#a07830)', color:'#000', borderRadius:8, fontSize:11, fontWeight:800, cursor:'pointer', textAlign:'center', textDecoration:'none' }}>
                Create Challenge →
              </Link>
            </div>

            {/* Features */}
            <div style={{ background:card, border:`1px solid ${border}`, borderRadius:12, padding:'11px 12px' }}>
              <div style={{ fontSize:9, color:muted, fontWeight:700, letterSpacing:'.4px', marginBottom:8 }}>FEATURES</div>
              <div style={{ display:'flex', flexDirection:'column', gap:5 }}>
                {FEATURES.map(f => (
                  <Link key={f.href} href={f.href} style={{ display:'flex', alignItems:'center', gap:7, padding:'7px 8px', background:f.bg, border:`1px solid ${f.border}`, borderRadius:8, textDecoration:'none' }}>
                    <SweepIcon short={f.short} color={f.color} bg={f.bg} dark={f.dark} size={20}/>
                    <span style={{ fontSize:11, fontWeight:600, color:f.color }}>{f.label}</span>
                    <span style={{ marginLeft:'auto', fontSize:10, color:muted }}>↗</span>
                  </Link>
                ))}
              </div>
            </div>

            {/* Analytics */}
            <div style={{ background:card, border:`1px solid ${border}`, borderRadius:12, padding:'11px 12px' }}>
              <div style={{ fontSize:9, color:muted, fontWeight:700, letterSpacing:'.4px', marginBottom:8 }}>ANALYTICS</div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:6 }}>
                <div style={{ background:field, borderRadius:8, padding:8 }}>
                  <div style={{ fontSize:9, color:muted }}>Total sent</div>
                  <div style={{ fontSize:14, fontWeight:700, color:'#c9a84c' }}>${totalPaid.toFixed(2)}</div>
                </div>
                <div style={{ background:field, borderRadius:8, padding:8 }}>
                  <div style={{ fontSize:9, color:muted }}>Transactions</div>
                  <div style={{ fontSize:14, fontWeight:700, color:text }}>{transactions.length}</div>
                </div>
              </div>
            </div>

            {/* Tools */}
            <div style={{ background:card, border:`1px solid ${border}`, borderRadius:12, padding:'11px 12px' }}>
              <div style={{ fontSize:9, color:muted, fontWeight:700, letterSpacing:'.4px', marginBottom:8 }}>TOOLS</div>
              <div style={{ display:'flex', flexDirection:'column', gap:5 }}>
                {[
                  { href:'https://faucet.circle.com', title:'Get Test USDC', sub:'faucet.circle.com', gold:true },
                  { href:'https://thirdweb.com/arc-testnet', title:'Network Setup', sub:'Arc Testnet', gold:false },
                  { href:'https://testnet.arcscan.app', title:'ArcScan Explorer', sub:'Track transactions', gold:false },
                ].map(item => (
                  <a key={item.href} href={item.href} target="_blank" rel="noopener noreferrer"
                    style={{ display:'flex', alignItems:'center', gap:7, padding:'7px 8px', border:`1px solid ${item.gold?'#2a2500':border}`, borderRadius:8, textDecoration:'none', background:item.gold?D?'#1a1500':'#fef9ec':D?'#080808':'#f5f5f5' }}>
                    <div style={{ flex:1 }}>
                      <div style={{ fontSize:10, fontWeight:600, color:item.gold?'#c9a84c':text }}>{item.title}</div>
                      <div style={{ fontSize:9, color:muted }}>{item.sub}</div>
                    </div>
                    <span style={{ fontSize:10, color:subtle }}>↗</span>
                  </a>
                ))}
              </div>
            </div>

          </div>
        )}
      </div>
    </div>
  )
}