'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import Link from 'next/link'
import Papa from 'papaparse'
import { useAccount, useConnect, useDisconnect, useBalance } from 'wagmi'
import { injected } from 'wagmi/connectors'
import { uploadImageToIPFS, uploadNFTMetadata } from '@/lib/pinata'

interface Recipient {
  id: string; name: string; address: string; amount: string
  status: 'pending' | 'paid'; txHash?: string
}
interface Toast { id: string; type: 'success' | 'error' | 'loading'; message: string }
type Tab = 'send' | 'batch' | 'nft' | 'bridge' | 'swap'

const CHAINS = [
  { id:'Ethereum_Sepolia', label:'ETH Sepolia', color:'#60a5fa' },
  { id:'Arbitrum_Sepolia', label:'ARB Sepolia', color:'#22d3ee' },
  { id:'Optimism_Sepolia', label:'OP Sepolia',  color:'#f87171' },
  { id:'Base_Sepolia',     label:'Base Sepolia', color:'#818cf8' },
  { id:'Arc_Testnet',      label:'Arc Testnet',  color:'#4ade80' },
]
const TOKENS = ['USDC','EURC','ETH']
const RATES: Record<string,Record<string,number>> = {
  USDC:{ EURC:0.92, ETH:0.00038, USDC:1 },
  EURC:{ USDC:1.087, ETH:0.00041, EURC:1 },
  ETH:{ USDC:2630, EURC:2420, ETH:1 },
}
const TAB_CONFIG = [
  { id:'send',   label:'Send',        short:'S'  },
  { id:'batch',  label:'Batch',       short:'B'  },
  { id:'nft',    label:'NFT Receipt', short:'N'  },
  { id:'bridge', label:'Bridge',      short:'Br' },
  { id:'swap',   label:'Swap',        short:'Sw' },
]
const QUICK_LINKS = [
  { href:'/game',     label:'USDC Tetris',  emoji:'🎮', color:'#c9a84c', bg:'#1a1500', border:'#2a2500' },
  { href:'/ai',       label:'AI Assistant', emoji:'🤖', color:'#60a5fa', bg:'#0a1628', border:'#1e3a5f' },
  { href:'/pay/gogo', label:'Payment Link', emoji:'🔗', color:'#4ade80', bg:'#0a1a0a', border:'#1a3a1a' },
  { href:'/contacts', label:'Contacts',     emoji:'👥', color:'#a78bfa', bg:'#1a0a2a', border:'#2a1a3a' },
  { href:'/schedule', label:'Schedule',     emoji:'⏰', color:'#f59e0b', bg:'#1a1000', border:'#2a2000' },
  { href:'/split',    label:'Split',        emoji:'🍽️', color:'#f87171', bg:'#1a0a0a', border:'#2a1a1a' },
]

export default function Home() {
  const { address, isConnected } = useAccount()
  const { connect } = useConnect()
  const { disconnect } = useDisconnect()
  const { data: usdcBalance, isLoading: balanceLoading } = useBalance({ address })

  const [darkMode, setDarkMode] = useState(true)
  const [tab, setTab] = useState<Tab>('send')
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [toasts, setToasts] = useState<Toast[]>([])
  const [recipients, setRecipients] = useState<Recipient[]>([])
  const [newName, setNewName] = useState('')
  const [newAddress, setNewAddress] = useState('')
  const [newAmount, setNewAmount] = useState('')
  const [singleAddress, setSingleAddress] = useState('')
  const [singleAmount, setSingleAmount] = useState('')
  const [paying, setPaying] = useState(false)
  const [batchPaying, setBatchPaying] = useState(false)
  const [nftImageUrl, setNftImageUrl] = useState('')
  const [nftImagePreview, setNftImagePreview] = useState('')
  const [uploadingImage, setUploadingImage] = useState(false)
  const [transactions, setTransactions] = useState<any[]>([])
  const [txResult, setTxResult] = useState<{txHash:string,explorerUrl?:string}|null>(null)
  const [showQR, setShowQR] = useState(false)
  const [favorites, setFavorites] = useState<{name:string,address:string}[]>([])
  const [showFavInput, setShowFavInput] = useState(false)
  const [favName, setFavName] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)
  const nftImageRef = useRef<HTMLInputElement>(null)
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
  const [showHelp, setShowHelp] = useState(false)

  const D = darkMode
  const bg = D?'#080808':'#f8f9fa'
  const card = D?'#0e0e0e':'#ffffff'
  const border = D?'#1a1a1a':'#e8e8e8'
  const text = D?'#ffffff':'#000000'
  const muted = D?'#444444':'#999999'
  const subtle = D?'#333333':'#bbbbbb'
  const field = D?'#080808':'#f5f5f5'
  const fieldBorder = D?'#181818':'#e0e0e0'

  useEffect(() => {
    const favs = localStorage.getItem('arc_favorites')
    if (favs) setFavorites(JSON.parse(favs))
    const txs = localStorage.getItem('arc_transactions')
    if (txs) setTransactions(JSON.parse(txs))
  }, [])

  const connectWallet = () => connect({ connector: injected() })
  const flipBridge = () => { const t=bridgeFrom; setBridgeFrom(bridgeTo); setBridgeTo(t) }
  const flipSwap = () => { const t=swapTokenIn; setSwapTokenIn(swapTokenOut); setSwapTokenOut(t) }
  const swapAmountOut = swapAmountIn ? (parseFloat(swapAmountIn)*(RATES[swapTokenIn]?.[swapTokenOut]||1)).toFixed(4) : '0'
  const priceImpactHigh = parseFloat(swapAmountIn) > 1000
  const balanceFormatted = balanceLoading ? null : usdcBalance ? (Number(usdcBalance.value)/1e18).toFixed(2) : '0.00'
  const totalPaid = transactions.reduce((s,t) => s+parseFloat(t.amount||'0'), 0)
  const pendingCount = recipients.filter(r => r.status==='pending').length
  const showSidePanel = tab==='send'||tab==='nft'||tab==='bridge'||tab==='swap'

  const addToast = useCallback((type: Toast['type'], message: string) => {
    const id = Math.random().toString(36).slice(2)
    setToasts(prev => [...prev, {id,type,message}])
    if (type!=='loading') setTimeout(() => setToasts(prev => prev.filter(t => t.id!==id)), 4000)
    return id
  }, [])
  const removeToast = (id: string) => setToasts(prev => prev.filter(t => t.id!==id))

  const saveTransaction = (name:string,addr:string,amount:string,txHash:string,explorerUrl?:string) => {
    const tx = {id:Math.random().toString(36).slice(2),name,address:addr,amount,txHash,explorerUrl,timestamp:new Date().toISOString()}
    setTransactions(prev => [tx,...prev])
    const stored = localStorage.getItem('arc_transactions')
    const existing = stored ? JSON.parse(stored) : []
    localStorage.setItem('arc_transactions', JSON.stringify([tx,...existing]))
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
      saveTransaction('Payment',singleAddress,singleAmount,txHash,`https://testnet.arcscan.app/tx/${txHash}`)
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
      saveTransaction(`Bridge`,address||'',bridgeAmount,txHash,`https://testnet.arcscan.app/tx/${txHash}`)
      setBridgeResult({txHash,explorerUrl:`https://testnet.arcscan.app/tx/${txHash}`})
      setBridgeAmount('')
      removeToast(tid); addToast('success',`Bridged ${bridgeAmount} USDC!`)
    } catch(e:any) { removeToast(tid); addToast('error','Bridge failed: '+e.message) }
    setBridgePaying(false)
  }

  const sendSwap = async () => {
    if (!swapAmountIn) { addToast('error','Please enter amount'); return }
    setSwapPaying(true); setSwapResult(null)
    const tid = addToast('loading',`Swapping...`)
    try {
      const {AppKit} = await import('@circle-fin/app-kit')
      const {createViemAdapterFromProvider} = await import('@circle-fin/adapter-viem-v2')
      const kit = new AppKit()
      const adapter = await createViemAdapterFromProvider({provider:(window as any).ethereum})
      const res = await kit.swap({from:{adapter,chain:'Arc_Testnet' as never},tokenIn:swapTokenIn,tokenOut:swapTokenOut,amountIn:swapAmountIn,config:{slippageBps:Math.round(parseFloat(swapSlippage)*100)}})
      const txHash = (res as any)?.hash||(res as any)?.txHash||''
      saveTransaction(`Swap ${swapTokenIn}→${swapTokenOut}`,address||'',swapAmountIn,txHash,`https://testnet.arcscan.app/tx/${txHash}`)
      setSwapResult({txHash,explorerUrl:`https://testnet.arcscan.app/tx/${txHash}`})
      setSwapAmountIn('')
      removeToast(tid); addToast('success',`Swapped!`)
    } catch(e:any) { removeToast(tid); addToast('error','Swap failed: '+e.message) }
    setSwapPaying(false)
  }

  const addRecipient = () => {
    if (!newName||!newAddress||!newAmount) { addToast('error','Fill all fields'); return }
    setRecipients([...recipients,{id:Math.random().toString(36).slice(2),name:newName,address:newAddress,amount:newAmount,status:'pending'}])
    setNewName(''); setNewAddress(''); setNewAmount('')
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
        saveTransaction(r.name,r.address,r.amount,txHash)
        setRecipients(prev=>prev.map(x=>x.id===r.id?{...x,status:'paid',txHash}:x))
        success++
      } catch(e) {}
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
    } catch(e:any) { removeToast(tid); addToast('error','Upload failed') }
    setUploadingImage(false)
  }

  const downloadTemplate = () => {
    const csv = 'name,address,amount\nJohn,0x1234567890123456789012345678901234567890,100'
    const blob = new Blob([csv],{type:'text/csv'})
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href=url; a.download='template.csv'; a.click()
  }

  const shareOnTwitter = (txHash:string,amount:string,token:string) => {
    const t = `Just sent ${amount} ${token} on Arc Network! ⚡\n\nTx: https://testnet.arcscan.app/tx/${txHash}\n\n#ArcNetwork #USDC`
    window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(t)}`,'_blank')
  }

  const addFavorite = () => {
    if (!favName||!singleAddress) return
    const updated = [...favorites,{name:favName,address:singleAddress}]
    setFavorites(updated)
    localStorage.setItem('arc_favorites',JSON.stringify(updated))
    setFavName(''); setShowFavInput(false)
    addToast('success','Saved!')
  }

  const Spinner = () => (
    <span style={{display:'inline-block',width:14,height:14,border:'2px solid #333',borderTopColor:'#c9a84c',borderRadius:'50%',animation:'spin 0.7s linear infinite'}}/>
  )

  const TxBox = ({result,amount,token}:{result:{txHash:string,explorerUrl?:string},amount?:string,token?:string}) => (
    <div style={{borderRadius:12,padding:14,background:D?'#0a1a0a':'#f0faf5',borderLeft:'3px solid #c9a84c'}}>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:6}}>
        <span style={{fontSize:12,fontWeight:700,color:'#c9a84c'}}>✓ Confirmed</span>
        {amount&&token&&(
          <button onClick={()=>shareOnTwitter(result.txHash,amount,token)}
            style={{fontSize:10,padding:'3px 8px',borderRadius:6,border:'1px solid #1e3a5f',color:'#60a5fa',background:'#0a1628',cursor:'pointer'}}>
            𝕏 Share
          </button>
        )}
      </div>
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

  const TabIcon = ({short,active}:{short:string,active:boolean}) => (
    <span style={{position:'relative',width:16,height:16,border:`1px solid ${active?'#c9a84c44':border}`,borderRadius:3,display:'inline-flex',alignItems:'center',justifyContent:'center',overflow:'hidden',flexShrink:0,fontSize:7,fontWeight:800,color:active?'#c9a84c':muted,transition:'all .3s'}}>
      {active&&<span style={{position:'absolute',width:'200%',height:'200%',top:'-50%',left:'-50%',background:'conic-gradient(transparent 0deg,#c9a84c 60deg,transparent 120deg)',animation:'tabSweep 2s linear infinite'}}/>}
      <span style={{position:'absolute',inset:1,background:D?'#080808':'#ffffff',borderRadius:2,zIndex:1}}/>
      <span style={{position:'relative',zIndex:2}}>{short}</span>
    </span>
  )

  if (!isConnected) {
    return (
      <div style={{minHeight:'100vh',display:'flex',flexDirection:'column',background:'#080808'}}>
        <style>{`@keyframes tabSweep{from{transform:rotate(0deg)}to{transform:rotate(360deg)}} @keyframes spin{to{transform:rotate(360deg)}} @keyframes pulse{0%,100%{opacity:1}50%{opacity:.5}} @keyframes sweepAnim{from{transform:rotate(0)}to{transform:rotate(360deg)}}`}</style>
        <nav style={{borderBottom:'1px solid #141414',padding:'14px 24px',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
          <div style={{display:'flex',alignItems:'center',gap:10}}>
            <div style={{width:34,height:34,background:'#111',border:'1px solid #1e1e1e',borderRadius:10,display:'flex',alignItems:'center',justifyContent:'center'}}>
              <WavesLogo size={18}/>
            </div>
            <div>
              <div style={{fontWeight:700,fontSize:14,color:'#fff'}}>Arc Global Payouts</div>
              <div style={{fontSize:9,color:'#c9a84c',fontWeight:700,letterSpacing:'.8px'}}>ARC NETWORK <span style={{color:'#444'}}>· by GoGo</span></div>
            </div>
          </div>
          <a href="https://github.com/GoGoSns/arc-payouts" target="_blank" rel="noopener noreferrer"
            style={{fontSize:11,padding:'5px 12px',background:'#111',border:'1px solid #1e1e1e',borderRadius:8,color:'#888',textDecoration:'none'}}>GitHub ↗</a>
        </nav>
        <div style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:'40px 24px',textAlign:'center'}}>
          <div style={{position:'relative',width:72,height:72,marginBottom:28}}>
            <div style={{position:'absolute',inset:-1,borderRadius:18,background:'conic-gradient(transparent 0deg,#c9a84c 60deg,transparent 120deg)',animation:'sweepAnim 3s linear infinite',opacity:.5}}/>
            <div style={{position:'absolute',inset:1,background:'#111',borderRadius:17,display:'flex',alignItems:'center',justifyContent:'center'}}>
              <WavesLogo size={36}/>
            </div>
          </div>
          <h1 style={{fontSize:40,fontWeight:800,letterSpacing:'-1px',marginBottom:12,lineHeight:1.1,color:'#fff'}}>
            Global USDC Payments<br/><span style={{color:'#c9a84c'}}>on Arc Network</span>
          </h1>
          <p style={{color:'#555',marginBottom:40,fontSize:16,lineHeight:1.7,maxWidth:420}}>
            Send, bridge, swap and batch pay with USDC.<br/>Sub-second finality. Zero complexity.
          </p>
          <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:12,marginBottom:40,width:'100%',maxWidth:560}}>
            {[
              {path:'M22 2L11 13M22 2L15 22l-4-9-9-4 20-7z',label:'Send',desc:'Instant USDC'},
              {path:'M8 3H5a2 2 0 00-2 2v3m18 0V5a2 2 0 00-2-2h-3M3 16v3a2 2 0 002 2h3m10 0h3a2 2 0 002-2v-3',label:'Bridge',desc:'Cross-chain'},
              {path:'M7 16V4m0 0L3 8m4-4l4 4M17 8v12m0 0l4-4m-4 4l-4-4',label:'Swap',desc:'USDC↔EURC'},
              {path:'M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 11a4 4 0 100-8 4 4 0 000 8z',label:'Batch',desc:'Pay hundreds'},
            ].map(f=>(
              <div key={f.label} style={{background:'#0e0e0e',border:'1px solid #1a1a1a',borderRadius:14,padding:'14px 10px',textAlign:'left'}}>
                <div style={{width:28,height:28,background:'#1a1500',border:'1px solid #2a2500',borderRadius:8,display:'flex',alignItems:'center',justifyContent:'center',marginBottom:8}}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#c9a84c" strokeWidth="2" strokeLinecap="round"><path d={f.path}/></svg>
                </div>
                <div style={{fontSize:12,fontWeight:700,color:'#fff'}}>{f.label}</div>
                <div style={{fontSize:10,color:'#555',marginTop:2}}>{f.desc}</div>
              </div>
            ))}
          </div>
          <div style={{display:'flex',flexDirection:'column',gap:8,width:'100%',maxWidth:300,marginBottom:24}}>
            {[
              {n:'1',t:'Add Arc Testnet',s:'Auto-add to MetaMask',href:'https://thirdweb.com/arc-testnet'},
              {n:'2',t:'Get Test USDC',s:'Free from Circle Faucet',href:'https://faucet.circle.com'},
            ].map(step=>(
              <a key={step.n} href={step.href} target="_blank" rel="noopener noreferrer"
                style={{display:'flex',alignItems:'center',gap:10,padding:'10px 14px',background:'#0e0e0e',border:'1px solid #1a1a1a',borderRadius:12,textDecoration:'none'}}>
                <div style={{width:20,height:20,background:'#1a1500',border:'1px solid #2a2500',borderRadius:6,display:'flex',alignItems:'center',justifyContent:'center',fontSize:10,fontWeight:800,color:'#c9a84c',flexShrink:0}}>{step.n}</div>
                <div>
                  <div style={{fontSize:12,fontWeight:600,color:'#fff'}}>{step.t}</div>
                  <div style={{fontSize:10,color:'#555'}}>{step.s}</div>
                </div>
                <span style={{marginLeft:'auto',fontSize:10,color:'#333'}}>↗</span>
              </a>
            ))}
          </div>
          <button onClick={connectWallet}
            style={{padding:'14px 36px',background:'linear-gradient(135deg,#c9a84c,#a07830)',color:'#000',border:'none',borderRadius:14,fontSize:15,fontWeight:800,cursor:'pointer'}}>
            3. Connect Wallet →
          </button>
          <div style={{display:'flex',gap:12,marginTop:24,flexWrap:'wrap',justifyContent:'center'}}>
            {QUICK_LINKS.map(l=>(
              <Link key={l.href} href={l.href}
                style={{fontSize:12,color:l.color,textDecoration:'none',padding:'5px 12px',background:l.bg,border:`1px solid ${l.border}`,borderRadius:20}}>
                {l.emoji} {l.label}
              </Link>
            ))}
          </div>
        </div>
        <div style={{textAlign:'center',padding:'16px',fontSize:10,color:'#1a1a1a',borderTop:'1px solid #111'}}>
          Arc Global Payouts · Built on Arc Network · by GoGo
        </div>
      </div>
    )
  }

  return (
    <div style={{minHeight:'100vh',display:'flex',flexDirection:'column',background:bg,color:text,fontFamily:'-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif'}}>
      <style>{`@keyframes tabSweep{from{transform:rotate(0deg)}to{transform:rotate(360deg)}} @keyframes spin{to{transform:rotate(360deg)}} @keyframes pulse{0%,100%{opacity:1}50%{opacity:.5}}`}</style>

      {/* TOASTS */}
      <div style={{position:'fixed',top:16,right:16,zIndex:50,display:'flex',flexDirection:'column',gap:8,pointerEvents:'none'}}>
        {toasts.map(t=>(
          <div key={t.id} style={{display:'flex',alignItems:'center',gap:10,padding:'10px 14px',borderRadius:12,fontSize:13,fontWeight:500,pointerEvents:'auto',border:'1px solid',
            background:t.type==='success'?'#0a1a0a':t.type==='error'?'#1a0a0a':D?'#111':'#f9f9f9',
            borderColor:t.type==='success'?'#1a3a1a':t.type==='error'?'#3a1a1a':D?'#222':'#e8e8e8',
            color:t.type==='success'?'#4ade80':t.type==='error'?'#f87171':D?'#888':'#666'}}>
            <span>{t.type==='success'?'✓':t.type==='error'?'✕':<Spinner/>}</span>
            <span>{t.message}</span>
            <button onClick={()=>removeToast(t.id)} style={{marginLeft:8,fontSize:11,opacity:.4,background:'none',border:'none',cursor:'pointer',color:'inherit'}}>✕</button>
          </div>
        ))}
      </div>

      {/* QR MODAL */}
      {showQR&&(
        <div style={{position:'fixed',inset:0,zIndex:50,display:'flex',alignItems:'center',justifyContent:'center',background:'rgba(0,0,0,.85)'}}>
          <div style={{borderRadius:20,padding:24,border:`1px solid ${border}`,width:300,background:card}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16}}>
              <span style={{fontWeight:700,fontSize:13,color:text}}>Your Wallet Address</span>
              <button onClick={()=>setShowQR(false)} style={{color:muted,background:'none',border:'none',cursor:'pointer',fontSize:16}}>✕</button>
            </div>
            <div style={{background:'#fff',padding:16,borderRadius:12,marginBottom:14,textAlign:'center'}}>
              <div style={{fontSize:9,color:'#666',fontFamily:'monospace',wordBreak:'break-all'}}>{address}</div>
            </div>
            <button onClick={()=>{navigator.clipboard.writeText(address||'');addToast('success','Copied!');setShowQR(false)}}
              style={{width:'100%',padding:12,borderRadius:12,fontWeight:800,fontSize:13,background:'linear-gradient(135deg,#c9a84c,#a07830)',color:'#000',border:'none',cursor:'pointer'}}>
              Copy Address
            </button>
          </div>
        </div>
      )}

      {/* NAVBAR */}
      <nav style={{borderBottom:`1px solid ${border}`,padding:'11px 16px',display:'flex',justifyContent:'space-between',alignItems:'center',background:D?'#080808':'#fff'}}>
        <div style={{display:'flex',alignItems:'center',gap:10}}>
          <div style={{width:32,height:32,background:D?'#111':'#f5f5f5',border:`1px solid ${border}`,borderRadius:9,display:'flex',alignItems:'center',justifyContent:'center'}}>
            <WavesLogo size={18}/>
          </div>
          <div>
            <div style={{fontWeight:700,fontSize:13,color:text}}>Arc Global Payouts</div>
            <div style={{fontSize:8,color:'#c9a84c',fontWeight:700,letterSpacing:'.8px'}}>ARC NETWORK <span style={{color:muted}}>· by GoGo</span></div>
          </div>
        </div>
        <div style={{display:'flex',alignItems:'center',gap:6,flexWrap:'wrap'}}>
          <div style={{display:'flex',alignItems:'center',gap:5,background:D?'#111':'#f5f5f5',border:`1px solid ${border}`,borderRadius:20,padding:'3px 9px'}}>
            <div style={{width:6,height:6,borderRadius:'50%',background:'#c9a84c',animation:'pulse 2s infinite'}}></div>
            <span style={{fontSize:10,color:muted}}>Arc Testnet</span>
          </div>
          <button onClick={()=>setShowQR(true)} style={{display:'flex',alignItems:'center',gap:5,background:D?'#111':'#f5f5f5',border:`1px solid ${border}`,borderRadius:20,padding:'3px 9px',cursor:'pointer'}}>
            <div style={{width:20,height:20,borderRadius:'50%',background:'linear-gradient(135deg,#c9a84c,#a07830)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:9,fontWeight:800,color:'#000'}}>G</div>
            <span style={{fontSize:10,color:muted}}>{address?.slice(0,6)}...{address?.slice(-4)}</span>
          </button>
          <Link href="/history" style={{fontSize:10,color:muted,textDecoration:'none',padding:'3px 8px',background:D?'#111':'#f5f5f5',border:`1px solid ${border}`,borderRadius:6}}>History</Link>
          <Link href="/game" style={{fontSize:10,textDecoration:'none',padding:'3px 8px',background:'#1a1500',border:'1px solid #2a2500',borderRadius:6,color:'#c9a84c',fontWeight:700}}>🎮 Tetris</Link>
          <Link href="/ai" style={{fontSize:10,textDecoration:'none',padding:'3px 8px',background:'#0a1628',border:'1px solid #1e3a5f',borderRadius:6,color:'#60a5fa',fontWeight:700}}>🤖 AI</Link>
          <div style={{position:'relative'}}>
            <button onClick={()=>setShowHelp(!showHelp)}
              style={{width:22,height:22,borderRadius:'50%',background:D?'#111':'#f5f5f5',border:`1px solid ${border}`,fontSize:11,color:muted,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center'}}>?</button>
            {showHelp&&(
              <div style={{position:'absolute',right:0,top:28,width:220,background:D?'#0e0e0e':'#fff',border:`1px solid ${border}`,borderRadius:14,zIndex:50,padding:12}}>
                <div style={{fontSize:10,color:'#c9a84c',fontWeight:700,marginBottom:10}}>Quick Links</div>
                {QUICK_LINKS.map(item=>(
                  <Link key={item.href} href={item.href} onClick={()=>setShowHelp(false)}
                    style={{display:'flex',alignItems:'center',gap:8,padding:'6px 8px',borderRadius:8,textDecoration:'none',color:item.color}}>
                    <span style={{fontSize:13}}>{item.emoji}</span>
                    <span style={{fontSize:12}}>{item.label}</span>
                  </Link>
                ))}
              </div>
            )}
          </div>
          <button onClick={()=>setDarkMode(!D)} style={{fontSize:12,padding:'3px 7px',background:D?'#111':'#f5f5f5',border:`1px solid ${border}`,borderRadius:6,cursor:'pointer'}}>{D?'☀️':'🌙'}</button>
          <a href="/api/auth" style={{fontSize:10,padding:'3px 9px',background:'#0a1628',border:'1px solid #1e3a5f',borderRadius:6,color:'#60a5fa',fontWeight:700,textDecoration:'none',display:'flex',alignItems:'center',gap:4}}><svg width="10" height="10" viewBox="0 0 24 24" fill="#60a5fa"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.73-8.835L1.254 2.25H8.08l4.253 5.622 5.911-5.622zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>Login</a><button onClick={()=>disconnect()} style={{fontSize:10,color:'#666',cursor:'pointer',background:'none',border:'none'}}>Disconnect</button>
          <button style={{display:'flex',flexDirection:'column',gap:3,padding:6,background:'none',border:'none',cursor:'pointer'}} onClick={()=>setMobileMenuOpen(!mobileMenuOpen)}>
            <span style={{display:'block',width:16,height:2,background:muted}}></span>
            <span style={{display:'block',width:16,height:2,background:muted,opacity:mobileMenuOpen?0:1}}></span>
            <span style={{display:'block',width:16,height:2,background:muted}}></span>
          </button>
        </div>
      </nav>

      {mobileMenuOpen&&(
        <div style={{borderBottom:`1px solid ${border}`,padding:'12px 16px',display:'flex',flexDirection:'column',gap:10,background:D?'#0a0a0a':'#fafafa'}}>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:6}}>
            {QUICK_LINKS.map(l=>(
              <Link key={l.href} href={l.href} onClick={()=>setMobileMenuOpen(false)}
                style={{fontSize:12,color:l.color,textDecoration:'none',padding:'7px 10px',background:l.bg,border:`1px solid ${l.border}`,borderRadius:8,textAlign:'center'}}>
                {l.emoji} {l.label}
              </Link>
            ))}
          </div>
          <button onClick={()=>disconnect()} style={{fontSize:12,color:'#f87171',background:'none',border:'none',cursor:'pointer',textAlign:'left'}}>Disconnect</button>
        </div>
      )}

      {/* TABS */}
      <div style={{borderBottom:`1px solid ${border}`,padding:'0 16px',overflowX:'auto',background:D?'#080808':'#fff'}}>
        <div style={{display:'flex',minWidth:'max-content'}}>
          {TAB_CONFIG.map(t=>(
            <button key={t.id} onClick={()=>setTab(t.id as Tab)}
              style={{padding:'10px 14px',fontSize:12,fontWeight:500,borderBottom:'2px solid',display:'flex',alignItems:'center',gap:6,whiteSpace:'nowrap',background:'none',cursor:'pointer',transition:'all .2s',
                color:tab===t.id?'#c9a84c':muted, borderBottomColor:tab===t.id?'#c9a84c':'transparent'}}>
              <TabIcon short={t.short} active={tab===t.id}/>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div style={{display:'flex',flex:1}} onClick={()=>showHelp&&setShowHelp(false)}>
        {showSidePanel&&(
          <div style={{flex:1,display:'flex',alignItems:'flex-start',justifyContent:'center',padding:'20px 16px'}}>
            <div style={{width:'100%',maxWidth:440,background:card,border:`1px solid ${border}`,borderRadius:20,padding:20}}>

              {/* SEND */}
              {tab==='send'&&(
                <div style={{display:'flex',flexDirection:'column',gap:12}}>
                  <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                    <label style={{fontSize:10,fontWeight:700,letterSpacing:'.4px',color:muted}}>YOU PAY</label>
                    <span style={{fontSize:10,color:muted}}>Balance: ${balanceFormatted||'—'}</span>
                  </div>
                  <div style={{background:field,border:`1px solid ${fieldBorder}`,borderRadius:14,padding:'12px 14px'}}>
                    <div style={{display:'flex',alignItems:'center',gap:10}}>
                      <input type="number" value={singleAmount} onChange={e=>setSingleAmount(e.target.value)} placeholder="0"
                        style={{fontSize:32,fontWeight:300,flex:1,background:'transparent',border:'none',color:text,outline:'none',letterSpacing:'-1px'}}/>
                      <div style={{background:D?'#141414':'#f0f0f0',border:`1px solid ${border}`,borderRadius:20,padding:'5px 11px',display:'flex',alignItems:'center',gap:5}}>
                        <div style={{width:7,height:7,borderRadius:'50%',background:'#6366f1'}}></div>
                        <span style={{fontSize:12,fontWeight:700,color:text}}>USDC</span>
                      </div>
                    </div>
                    <div style={{fontSize:10,color:subtle,marginTop:5}}>Arc Testnet</div>
                  </div>
                  <div style={{display:'flex',justifyContent:'center'}}>
                    <div style={{width:28,height:28,background:D?'#0e0e0e':field,border:`1px solid ${border}`,borderRadius:8,display:'flex',alignItems:'center',justifyContent:'center',fontSize:12,color:subtle}}>↓</div>
                  </div>
                  <label style={{fontSize:10,fontWeight:700,letterSpacing:'.4px',color:muted}}>TO</label>
                  <div style={{background:field,border:`1px solid ${fieldBorder}`,borderRadius:14,padding:'12px 14px'}}>
                    <input type="text" value={singleAddress} onChange={e=>setSingleAddress(e.target.value)} placeholder="Wallet address or ENS"
                      style={{fontSize:13,background:'transparent',border:'none',color:singleAddress?text:muted,outline:'none',width:'100%'}}/>
                    <div style={{fontSize:10,color:subtle,marginTop:4}}>Arc Testnet</div>
                  </div>
                  {favorites.length>0&&(
                    <div>
                      <div style={{fontSize:10,fontWeight:700,letterSpacing:'.4px',color:muted,marginBottom:6}}>FAVORITES</div>
                      <div style={{display:'flex',flexWrap:'wrap',gap:6}}>
                        {favorites.map((f,i)=>(
                          <button key={i} onClick={()=>setSingleAddress(f.address)}
                            style={{fontSize:10,padding:'3px 8px',background:D?'#141414':field,border:`1px solid ${border}`,borderRadius:8,color:muted,cursor:'pointer'}}>
                            ⭐ {f.name}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  {singleAddress&&!showFavInput&&(
                    <button onClick={()=>setShowFavInput(true)} style={{fontSize:10,color:subtle,background:'none',border:'none',cursor:'pointer',textAlign:'left'}}>+ Save to favorites</button>
                  )}
                  {showFavInput&&(
                    <div style={{display:'flex',gap:6}}>
                      <input value={favName} onChange={e=>setFavName(e.target.value)} placeholder="Label"
                        style={{flex:1,fontSize:11,padding:'6px 10px',border:`1px solid ${border}`,borderRadius:8,background:D?'#141414':field,color:text,outline:'none'}}/>
                      <button onClick={addFavorite} style={{fontSize:11,padding:'6px 12px',borderRadius:8,fontWeight:800,background:'linear-gradient(135deg,#c9a84c,#a07830)',color:'#000',border:'none',cursor:'pointer'}}>Save</button>
                      <button onClick={()=>setShowFavInput(false)} style={{fontSize:11,color:muted,background:'none',border:'none',cursor:'pointer'}}>✕</button>
                    </div>
                  )}
                  {singleAmount&&(
                    <div style={{background:field,border:`1px solid ${border}`,borderRadius:12,padding:'10px 12px'}}>
                      <div style={{display:'flex',justifyContent:'space-between',fontSize:11,marginBottom:4}}><span style={{color:muted}}>Network fee</span><span style={{color:subtle}}>~0.009 USDC</span></div>
                      <div style={{display:'flex',justifyContent:'space-between',fontSize:12,fontWeight:700,borderTop:`1px solid ${border}`,paddingTop:6,marginTop:4}}>
                        <span style={{color:text}}>Total</span><span style={{color:'#c9a84c'}}>{singleAmount} USDC</span>
                      </div>
                    </div>
                  )}
                  <button onClick={sendSingle} disabled={paying}
                    style={{width:'100%',padding:13,borderRadius:12,fontWeight:800,fontSize:13,border:'none',cursor:paying?'default':'pointer',
                      background:paying?D?'#333':'#ccc':'linear-gradient(135deg,#c9a84c,#a07830)',
                      color:paying?D?'#666':'#999':'#000'}}>
                    {paying?<span style={{display:'flex',alignItems:'center',justifyContent:'center',gap:8}}><Spinner/>SENDING...</span>:'CONFIRM TRANSFER'}
                  </button>
                  {txResult&&<TxBox result={txResult} amount={singleAmount} token="USDC"/>}
                </div>
              )}

              {/* NFT */}
              {tab==='nft'&&(
                <div style={{display:'flex',flexDirection:'column',gap:14}}>
                  <h2 style={{fontWeight:700,fontSize:16,color:text}}>NFT Receipt Image</h2>
                  <p style={{fontSize:12,color:muted}}>Upload an image to mint as NFT receipt after each payment.</p>
                  <div style={{border:`2px dashed ${border}`,borderRadius:14,padding:28,textAlign:'center'}}>
                    {nftImagePreview?<img src={nftImagePreview} alt="NFT" style={{width:120,height:120,borderRadius:12,objectFit:'cover',margin:'0 auto 10px',display:'block'}}/>:<div style={{fontSize:36,marginBottom:10}}>🎨</div>}
                    <button onClick={()=>nftImageRef.current?.click()} disabled={uploadingImage}
                      style={{padding:'8px 16px',borderRadius:8,fontSize:12,fontWeight:700,background:'linear-gradient(135deg,#c9a84c,#a07830)',color:'#000',border:'none',cursor:'pointer'}}>
                      {uploadingImage?<span style={{display:'flex',alignItems:'center',gap:6}}><Spinner/>Uploading...</span>:nftImageUrl?'✅ Uploaded':'Select Image'}
                    </button>
                    <input ref={nftImageRef} type="file" accept="image/*" onChange={handleNFTImageSelect} style={{display:'none'}}/>
                  </div>
                  {nftImageUrl&&<div style={{background:'#0a1a0a',border:'1px solid #1a3a1a',borderRadius:10,padding:10,fontSize:12,color:'#4ade80'}}>✅ Uploaded to IPFS</div>}
                </div>
              )}

              {/* BRIDGE */}
              {tab==='bridge'&&(
                <div style={{display:'flex',flexDirection:'column',gap:12}}>
                  <div>
                    <label style={{fontSize:10,fontWeight:700,letterSpacing:'.4px',color:muted,display:'block',marginBottom:8}}>FROM</label>
                    <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:6}}>
                      {CHAINS.filter(c=>c.id!==bridgeTo).map(chain=>(
                        <button key={chain.id} onClick={()=>setBridgeFrom(chain.id)}
                          style={{padding:'7px 4px',borderRadius:10,fontSize:10,fontWeight:600,border:'1px solid',cursor:'pointer',
                            borderColor:bridgeFrom===chain.id?'#c9a84c':border,color:bridgeFrom===chain.id?'#c9a84c':muted,background:bridgeFrom===chain.id?'#1a1500':field}}>
                          <span style={{display:'inline-block',width:7,height:7,borderRadius:'50%',marginRight:4,background:chain.color}}></span>
                          {chain.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div style={{background:field,border:`1px solid ${fieldBorder}`,borderRadius:14,padding:'12px 14px'}}>
                    <div style={{display:'flex',alignItems:'center',gap:10}}>
                      <input type="number" value={bridgeAmount} onChange={e=>setBridgeAmount(e.target.value)} placeholder="0"
                        style={{fontSize:32,fontWeight:300,flex:1,background:'transparent',border:'none',color:text,outline:'none',letterSpacing:'-1px'}}/>
                      <div style={{background:D?'#141414':'#f0f0f0',border:`1px solid ${border}`,borderRadius:20,padding:'5px 11px',display:'flex',alignItems:'center',gap:5}}>
                        <div style={{width:7,height:7,borderRadius:'50%',background:'#6366f1'}}></div>
                        <span style={{fontSize:12,fontWeight:700,color:text}}>USDC</span>
                      </div>
                    </div>
                  </div>
                  <div style={{display:'flex',justifyContent:'center'}}>
                    <button onClick={flipBridge} style={{width:36,height:36,border:`1px solid ${border}`,borderRadius:'50%',background:card,fontSize:16,color:muted,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center'}}>⇅</button>
                  </div>
                  <div>
                    <label style={{fontSize:10,fontWeight:700,letterSpacing:'.4px',color:muted,display:'block',marginBottom:8}}>TO</label>
                    <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:6}}>
                      {CHAINS.filter(c=>c.id!==bridgeFrom).map(chain=>(
                        <button key={chain.id} onClick={()=>setBridgeTo(chain.id)}
                          style={{padding:'7px 4px',borderRadius:10,fontSize:10,fontWeight:600,border:'1px solid',cursor:'pointer',
                            borderColor:bridgeTo===chain.id?'#c9a84c':border,color:bridgeTo===chain.id?'#c9a84c':muted,background:bridgeTo===chain.id?'#1a1500':field}}>
                          <span style={{display:'inline-block',width:7,height:7,borderRadius:'50%',marginRight:4,background:chain.color}}></span>
                          {chain.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <button onClick={sendBridge} disabled={bridgePaying}
                    style={{width:'100%',padding:13,borderRadius:12,fontWeight:800,fontSize:13,border:'none',cursor:bridgePaying?'default':'pointer',
                      background:bridgePaying?D?'#333':'#ccc':'linear-gradient(135deg,#c9a84c,#a07830)',
                      color:bridgePaying?D?'#666':'#999':'#000'}}>
                    {bridgePaying?<span style={{display:'flex',alignItems:'center',justifyContent:'center',gap:8}}><Spinner/>BRIDGING...</span>:'CONFIRM BRIDGE'}
                  </button>
                  {bridgeResult&&<TxBox result={bridgeResult} amount={bridgeAmount} token="USDC"/>}
                </div>
              )}

              {/* SWAP */}
              {tab==='swap'&&(
                <div style={{display:'flex',flexDirection:'column',gap:12}}>
                  <div>
                    <label style={{fontSize:10,fontWeight:700,letterSpacing:'.4px',color:muted,display:'block',marginBottom:6}}>YOU PAY</label>
                    <div style={{background:field,border:`1px solid ${fieldBorder}`,borderRadius:14,padding:'12px 14px'}}>
                      <div style={{display:'flex',alignItems:'center',gap:10}}>
                        <input type="number" value={swapAmountIn} onChange={e=>setSwapAmountIn(e.target.value)} placeholder="0"
                          style={{fontSize:32,fontWeight:300,flex:1,background:'transparent',border:'none',color:text,outline:'none',letterSpacing:'-1px'}}/>
                        <select value={swapTokenIn} onChange={e=>setSwapTokenIn(e.target.value)}
                          style={{background:D?'#141414':'#f0f0f0',border:`1px solid ${border}`,borderRadius:20,padding:'5px 11px',fontSize:12,fontWeight:700,color:text,outline:'none',cursor:'pointer'}}>
                          {TOKENS.filter(t=>t!==swapTokenOut).map(t=><option key={t} value={t}>{t}</option>)}
                        </select>
                      </div>
                    </div>
                  </div>
                  <div style={{display:'flex',justifyContent:'center'}}>
                    <button onClick={flipSwap} style={{width:36,height:36,border:`1px solid ${border}`,borderRadius:'50%',background:card,fontSize:16,color:muted,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center'}}>⇅</button>
                  </div>
                  <div>
                    <label style={{fontSize:10,fontWeight:700,letterSpacing:'.4px',color:muted,display:'block',marginBottom:6}}>YOU RECEIVE</label>
                    <div style={{background:field,border:`1px solid ${fieldBorder}`,borderRadius:14,padding:'12px 14px'}}>
                      <div style={{display:'flex',alignItems:'center',gap:10}}>
                        <span style={{fontSize:32,fontWeight:300,flex:1,color:muted,letterSpacing:'-1px'}}>{swapAmountOut}</span>
                        <select value={swapTokenOut} onChange={e=>setSwapTokenOut(e.target.value)}
                          style={{background:D?'#141414':'#f0f0f0',border:`1px solid ${border}`,borderRadius:20,padding:'5px 11px',fontSize:12,fontWeight:700,color:text,outline:'none',cursor:'pointer'}}>
                          {TOKENS.filter(t=>t!==swapTokenIn).map(t=><option key={t} value={t}>{t}</option>)}
                        </select>
                      </div>
                    </div>
                  </div>
                  <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
                    {['0.5','1','3'].map(s=>(
                      <button key={s} onClick={()=>setSwapSlippage(s)}
                        style={{padding:'5px 12px',borderRadius:8,fontSize:11,fontWeight:700,border:'1px solid',cursor:'pointer',
                          borderColor:swapSlippage===s?'#c9a84c':border,color:swapSlippage===s?'#c9a84c':muted,background:swapSlippage===s?'#1a1500':field}}>{s}%</button>
                    ))}
                    {priceImpactHigh&&<span style={{fontSize:11,fontWeight:700,color:'#f87171'}}>⚠ High impact</span>}
                  </div>
                  <button onClick={sendSwap} disabled={swapPaying}
                    style={{width:'100%',padding:13,borderRadius:12,fontWeight:800,fontSize:13,border:'none',cursor:swapPaying?'default':'pointer',
                      background:swapPaying?D?'#333':'#ccc':'linear-gradient(135deg,#c9a84c,#a07830)',
                      color:swapPaying?D?'#666':'#999':'#000'}}>
                    {swapPaying?<span style={{display:'flex',alignItems:'center',justifyContent:'center',gap:8}}><Spinner/>SWAPPING...</span>:'CONFIRM SWAP'}
                  </button>
                  {swapResult&&<TxBox result={swapResult} amount={swapAmountIn} token={swapTokenIn}/>}
                </div>
              )}
            </div>
          </div>
        )}

        {/* BATCH */}
        {tab==='batch'&&(
          <div style={{flex:1,padding:'16px'}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:14,flexWrap:'wrap',gap:8}}>
              <h2 style={{fontSize:18,fontWeight:700,color:text}}>Batch Payout</h2>
              <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
                <button onClick={downloadTemplate} style={{padding:'7px 12px',background:card,border:`1px solid ${border}`,borderRadius:8,fontSize:12,color:muted,cursor:'pointer'}}>Template</button>
                <button onClick={()=>fileRef.current?.click()} style={{padding:'7px 12px',background:card,border:`1px solid ${border}`,borderRadius:8,fontSize:12,color:muted,cursor:'pointer'}}>Import CSV</button>
                <input ref={fileRef} type="file" accept=".csv" onChange={importCSV} style={{display:'none'}}/>
                {pendingCount>0&&(
                  <button onClick={sendBatch} disabled={batchPaying}
                    style={{padding:'7px 14px',borderRadius:8,fontSize:12,fontWeight:800,border:'none',cursor:batchPaying?'default':'pointer',
                      background:batchPaying?D?'#333':'#ccc':'linear-gradient(135deg,#c9a84c,#a07830)',
                      color:batchPaying?D?'#666':'#999':'#000'}}>
                    {batchPaying?<span style={{display:'flex',alignItems:'center',gap:6}}><Spinner/>Sending...</span>:`Send to ${pendingCount}`}
                  </button>
                )}
              </div>
            </div>
            <div style={{background:card,border:`1px solid ${border}`,borderRadius:14,padding:14,marginBottom:12}}>
              <div style={{display:'grid',gridTemplateColumns:'1fr 2fr 1fr auto',gap:8}}>
                <input value={newName} onChange={e=>setNewName(e.target.value)} placeholder="Name" style={{padding:'8px 10px',border:`1px solid ${border}`,borderRadius:8,fontSize:12,background:field,color:text,outline:'none'}}/>
                <input value={newAddress} onChange={e=>setNewAddress(e.target.value)} placeholder="0x..." style={{padding:'8px 10px',border:`1px solid ${border}`,borderRadius:8,fontSize:12,background:field,color:text,outline:'none'}}/>
                <input value={newAmount} onChange={e=>setNewAmount(e.target.value)} placeholder="USDC" type="number" style={{padding:'8px 10px',border:`1px solid ${border}`,borderRadius:8,fontSize:12,background:field,color:text,outline:'none'}}/>
                <button onClick={addRecipient} style={{padding:'8px 14px',borderRadius:8,fontSize:13,fontWeight:800,background:'linear-gradient(135deg,#c9a84c,#a07830)',color:'#000',border:'none',cursor:'pointer'}}>+</button>
              </div>
            </div>
            <div style={{background:card,border:`1px solid ${border}`,borderRadius:14,overflow:'hidden',overflowX:'auto'}}>
              {recipients.length===0?(
                <div style={{padding:48,textAlign:'center'}}>
                  <div style={{fontSize:36,marginBottom:10}}>👥</div>
                  <p style={{color:muted}}>No recipients yet</p>
                </div>
              ):(
                <table style={{width:'100%',minWidth:600,borderCollapse:'collapse'}}>
                  <thead>
                    <tr style={{borderBottom:`1px solid ${border}`}}>
                      {['NAME','ADDRESS','AMOUNT','STATUS','TX'].map(h=>(
                        <th key={h} style={{textAlign:'left',padding:'10px 14px',fontSize:10,fontWeight:700,letterSpacing:'.4px',color:muted}}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {recipients.map(r=>(
                      <tr key={r.id} style={{borderBottom:`1px solid ${border}`}}>
                        <td style={{padding:'12px 14px',fontSize:12,color:text}}>{r.name}</td>
                        <td style={{padding:'12px 14px',fontSize:11,color:muted,fontFamily:'monospace'}}>{r.address.slice(0,6)}...{r.address.slice(-4)}</td>
                        <td style={{padding:'12px 14px',fontSize:12,fontWeight:700,color:'#c9a84c'}}>{r.amount} USDC</td>
                        <td style={{padding:'12px 14px'}}>
                          <span style={{padding:'2px 8px',borderRadius:6,fontSize:11,fontWeight:700,background:r.status==='paid'?'#0a1a0a':'#1a1500',color:r.status==='paid'?'#4ade80':'#c9a84c'}}>
                            {r.status==='paid'?'✅ Paid':'⏳ Pending'}
                          </span>
                        </td>
                        <td style={{padding:'12px 14px'}}>{r.txHash?<a href={`https://testnet.arcscan.app/tx/${r.txHash}`} target="_blank" rel="noopener noreferrer" style={{fontSize:11,color:'#6366f1',textDecoration:'none'}}>Explorer</a>:<span style={{fontSize:11,color:subtle}}>—</span>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}

        {/* RIGHT PANEL */}
        {showSidePanel&&(
          <div style={{width:240,borderLeft:`1px solid ${border}`,padding:12,display:'flex',flexDirection:'column',gap:8,background:D?'#080808':'#fafafa'}}>

            <div style={{background:card,border:`1px solid ${border}`,borderRadius:12,padding:'11px 12px'}}>
              <div style={{fontSize:9,color:muted,fontWeight:700,letterSpacing:'.4px',marginBottom:3}}>USDC BALANCE</div>
              {balanceLoading?<div style={{height:28,width:80,background:D?'#1a1a1a':'#e8e8e8',borderRadius:6,animation:'pulse 1.5s infinite'}}/>:(
                <>
                  <div style={{fontSize:22,fontWeight:300,color:text,letterSpacing:'-1px'}}>${balanceFormatted}</div>
                  <div style={{fontSize:9,color:'#c9a84c',fontWeight:700,marginTop:2}}>Arc Testnet · Live</div>
                </>
              )}
            </div>

            <div style={{background:card,border:`1px solid ${border}`,borderRadius:12,padding:'11px 12px'}}>
              <div style={{fontSize:9,color:muted,fontWeight:700,letterSpacing:'.4px',marginBottom:3}}>EURC BALANCE</div>
              <div style={{fontSize:22,fontWeight:300,color:'#facc15',letterSpacing:'-1px'}}>€0.00</div>
              <div style={{fontSize:9,color:'#c9a84c',fontWeight:700,marginTop:2}}>Arc Testnet · Live</div>
            </div>

            {/* CHALLENGE WIDGET */}
            <div style={{background:card,border:'2px solid #c9a84c55',borderRadius:12,padding:'11px 12px',position:'relative',overflow:'hidden'}}>
              <div style={{position:'absolute',top:0,left:0,right:0,height:2,background:'linear-gradient(90deg,#c9a84c,#4ade80,#c9a84c)'}}/>
              <div style={{fontSize:9,color:'#c9a84c',fontWeight:700,letterSpacing:'.4px',marginBottom:6}}>🏆 CHALLENGE A FRIEND</div>
              <div style={{fontSize:11,color:text,fontWeight:600,marginBottom:3}}>USDC Tetris Bet</div>
              <div style={{fontSize:10,color:muted,marginBottom:8}}>Set a target → friend plays → winner gets USDC!</div>
              <Link href="/game"
                style={{display:'block',padding:'7px 0',background:'linear-gradient(135deg,#c9a84c,#a07830)',color:'#000',border:'none',borderRadius:8,fontSize:11,fontWeight:800,cursor:'pointer',textAlign:'center',textDecoration:'none'}}>
                🎮 Create Challenge →
              </Link>
            </div>

            <div style={{background:card,border:`1px solid ${border}`,borderRadius:12,padding:'11px 12px'}}>
              <div style={{fontSize:9,color:muted,fontWeight:700,letterSpacing:'.4px',marginBottom:8}}>FEATURES</div>
              <div style={{display:'flex',flexDirection:'column',gap:5}}>
                {QUICK_LINKS.map(l=>(
                  <Link key={l.href} href={l.href}
                    style={{display:'flex',alignItems:'center',gap:7,padding:'7px 8px',background:l.bg,border:`1px solid ${l.border}`,borderRadius:8,textDecoration:'none'}}>
                    <span style={{fontSize:13}}>{l.emoji}</span>
                    <span style={{fontSize:11,fontWeight:600,color:l.color}}>{l.label}</span>
                    <span style={{marginLeft:'auto',fontSize:10,color:muted}}>↗</span>
                  </Link>
                ))}
              </div>
            </div>

            <div style={{background:card,border:`1px solid ${border}`,borderRadius:12,padding:'11px 12px'}}>
              <div style={{fontSize:9,color:muted,fontWeight:700,letterSpacing:'.4px',marginBottom:8}}>ANALYTICS</div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:6,marginBottom:8}}>
                <div style={{background:field,borderRadius:8,padding:8}}>
                  <div style={{fontSize:9,color:muted}}>Total sent</div>
                  <div style={{fontSize:14,fontWeight:700,color:'#c9a84c'}}>${totalPaid.toFixed(2)}</div>
                </div>
                <div style={{background:field,borderRadius:8,padding:8}}>
                  <div style={{fontSize:9,color:muted}}>Transactions</div>
                  <div style={{fontSize:14,fontWeight:700,color:text}}>{transactions.length}</div>
                </div>
              </div>
            </div>

            <div style={{background:card,border:`1px solid ${border}`,borderRadius:12,padding:'11px 12px'}}>
              <div style={{fontSize:9,color:muted,fontWeight:700,letterSpacing:'.4px',marginBottom:8}}>TOOLS</div>
              <div style={{display:'flex',flexDirection:'column',gap:5}}>
                {[
                  {href:'https://faucet.circle.com',emoji:'🚰',title:'Get Test USDC',sub:'faucet.circle.com',gold:true},
                  {href:'https://thirdweb.com/arc-testnet',emoji:'⚙️',title:'Network Setup',sub:'Arc Testnet',gold:false},
                  {href:'https://testnet.arcscan.app',emoji:'🔍',title:'ArcScan Explorer',sub:'Track transactions',gold:false},
                ].map(item=>(
                  <a key={item.href} href={item.href} target="_blank" rel="noopener noreferrer"
                    style={{display:'flex',alignItems:'center',gap:7,padding:'7px 8px',border:'1px solid',borderRadius:8,textDecoration:'none',
                      background:item.gold?D?'#1a1500':'#fef9ec':D?'#080808':'#f5f5f5',
                      borderColor:item.gold?'#2a2500':border}}>
                    <span style={{fontSize:12}}>{item.emoji}</span>
                    <div style={{flex:1}}>
                      <div style={{fontSize:10,fontWeight:600,color:item.gold?'#c9a84c':text}}>{item.title}</div>
                      <div style={{fontSize:9,color:muted}}>{item.sub}</div>
                    </div>
                    <span style={{fontSize:10,color:subtle}}>↗</span>
                  </a>
                ))}
              </div>
            </div>

            <div style={{background:card,border:`1px solid ${border}`,borderRadius:12,padding:'11px 12px',flex:1}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8}}>
                <div style={{fontSize:9,color:muted,fontWeight:700,letterSpacing:'.4px'}}>ACTIVITY</div>
                <Link href="/history" style={{fontSize:10,color:subtle,textDecoration:'none'}}>All →</Link>
              </div>
              {transactions.length===0?(
                <div style={{textAlign:'center',fontSize:11,padding:'10px 0',color:subtle}}>No transactions yet</div>
              ):(
                <div style={{display:'flex',flexDirection:'column',gap:7}}>
                  {transactions.slice(0,4).map(t=>(
                    <div key={t.id} style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}>
                      <div style={{display:'flex',alignItems:'center',gap:6}}>
                        <div style={{width:20,height:20,borderRadius:6,background:'#1a1500',color:'#c9a84c',display:'flex',alignItems:'center',justifyContent:'center',fontSize:9}}>↗</div>
                        <div style={{fontSize:11,color:text}}>{t.name||'Send'}</div>
                      </div>
                      <div style={{fontSize:11,fontWeight:700,color:'#c9a84c'}}>-{t.amount}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>
        )}
      </div>
    </div>
  )
}