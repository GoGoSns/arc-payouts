// Arc Global Payouts v3.1 — Dark Premium Gold
'use client'

import { useState, useRef, useCallback } from 'react'
import Link from 'next/link'
import Papa from 'papaparse'
import { useAccount, useConnect, useDisconnect, useBalance } from 'wagmi'
import { injected } from 'wagmi/connectors'
import { uploadImageToIPFS, uploadNFTMetadata } from '@/lib/pinata'

interface Recipient {
  id: string; name: string; address: string; amount: string
  status: 'pending' | 'paid'; txHash?: string; nftMinted?: boolean; nftUrl?: string
}
interface Toast { id: string; type: 'success' | 'error' | 'loading'; message: string }
type Tab = 'send' | 'batch' | 'nft' | 'bridge' | 'swap'

const CHAINS = [
  { id: 'Ethereum_Sepolia', label: 'ETH Sepolia', dot: 'bg-blue-400' },
  { id: 'Arbitrum_Sepolia', label: 'ARB Sepolia', dot: 'bg-cyan-400' },
  { id: 'Optimism_Sepolia', label: 'OP Sepolia',  dot: 'bg-red-400'  },
  { id: 'Base_Sepolia',     label: 'Base Sepolia', dot: 'bg-indigo-400' },
  { id: 'Arc_Testnet',      label: 'Arc Testnet', dot: 'bg-green-400' },
]
const TOKENS = ['USDC', 'EURC', 'ETH']
const RATES: Record<string, Record<string, number>> = {
  USDC: { EURC: 0.92, ETH: 0.00038, USDC: 1 },
  EURC: { USDC: 1.087, ETH: 0.00041, EURC: 1 },
  ETH:  { USDC: 2630, EURC: 2420, ETH: 1 },
}
const TAB_CONFIG = [
  { id: 'send',   label: 'Send',        short: 'S'  },
  { id: 'batch',  label: 'Batch',       short: 'B'  },
  { id: 'nft',    label: 'NFT Receipt', short: 'N'  },
  { id: 'bridge', label: 'Bridge',      short: 'Br' },
  { id: 'swap',   label: 'Swap',        short: 'Sw' },
]

export default function Home() {
  const { address, isConnected } = useAccount()
  const { connect } = useConnect()
  const { disconnect } = useDisconnect()
  const { data: usdcBalance, isLoading: balanceLoading } = useBalance({ address })

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
  const [txResult, setTxResult] = useState<{txHash: string, explorerUrl?: string} | null>(null)
  const [showQR, setShowQR] = useState(false)
  const [favorites, setFavorites] = useState<{name: string, address: string}[]>([])
  const [showFavInput, setShowFavInput] = useState(false)
  const [favName, setFavName] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)
  const nftImageRef = useRef<HTMLInputElement>(null)

  const [bridgeAmount, setBridgeAmount] = useState('')
  const [bridgePaying, setBridgePaying] = useState(false)
  const [bridgeResult, setBridgeResult] = useState<{txHash: string, explorerUrl?: string} | null>(null)
  const [bridgeFrom, setBridgeFrom] = useState('Ethereum_Sepolia')
  const [bridgeTo, setBridgeTo] = useState('Arc_Testnet')

  const [swapAmountIn, setSwapAmountIn] = useState('')
  const [swapTokenIn, setSwapTokenIn] = useState('USDC')
  const [swapTokenOut, setSwapTokenOut] = useState('EURC')
  const [swapSlippage, setSwapSlippage] = useState('1')
  const [swapPaying, setSwapPaying] = useState(false)
  const [swapResult, setSwapResult] = useState<{txHash: string, explorerUrl?: string} | null>(null)
  const [showHelp, setShowHelp] = useState(false)

  const connectWallet = () => connect({ connector: injected() })
  const flipBridge = () => { const t = bridgeFrom; setBridgeFrom(bridgeTo); setBridgeTo(t) }
  const flipSwap = () => { const t = swapTokenIn; setSwapTokenIn(swapTokenOut); setSwapTokenOut(t) }
  const swapAmountOut = swapAmountIn ? (parseFloat(swapAmountIn) * (RATES[swapTokenIn]?.[swapTokenOut] || 1)).toFixed(4) : '0'
  const priceImpactHigh = parseFloat(swapAmountIn) > 1000

  const addToast = useCallback((type: Toast['type'], message: string) => {
    const id = Math.random().toString(36).slice(2)
    setToasts(prev => [...prev, { id, type, message }])
    if (type !== 'loading') setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000)
    return id
  }, [])
  const removeToast = (id: string) => setToasts(prev => prev.filter(t => t.id !== id))

  const saveTransaction = (name: string, addr: string, amount: string, txHash: string, explorerUrl?: string, nftUrl?: string) => {
    const tx = { id: Math.random().toString(36).slice(2), name, address: addr, amount, txHash, explorerUrl, nftUrl, timestamp: new Date().toISOString() }
    setTransactions(prev => [tx, ...prev])
    const stored = localStorage.getItem('arc_transactions')
    const existing = stored ? JSON.parse(stored) : []
    localStorage.setItem('arc_transactions', JSON.stringify([tx, ...existing]))
  }

  const sendSingle = async () => {
    if (!singleAddress || !singleAmount) { addToast('error', 'Please enter address and amount'); return }
    setPaying(true); setTxResult(null)
    const tid = addToast('loading', 'Sending USDC...')
    try {
      const { AppKit } = await import('@circle-fin/app-kit')
      const { createViemAdapterFromProvider } = await import('@circle-fin/adapter-viem-v2')
      const kit = new AppKit()
      const adapter = await createViemAdapterFromProvider({ provider: (window as any).ethereum })
      const res = await kit.send({ from: { adapter, chain: 'Arc_Testnet' as never }, to: singleAddress, amount: singleAmount, token: 'USDC' })
      const txHash = (res as any)?.hash || (res as any)?.txHash || ''
      let nftUrl = ''
      if (nftImageUrl) {
        nftUrl = await uploadNFTMetadata('Payment Receipt', `${singleAmount} USDC payment`, nftImageUrl, [
          { trait_type: 'Amount', value: `${singleAmount} USDC` },
          { trait_type: 'Network', value: 'Arc Testnet' },
        ])
      }
      saveTransaction('Payment', singleAddress, singleAmount, txHash, undefined, nftUrl)
      setTxResult({ txHash, explorerUrl: `https://testnet.arcscan.app/tx/${txHash}` })
      setSingleAddress(''); setSingleAmount('')
      removeToast(tid); addToast('success', `Sent ${singleAmount} USDC!`)
    } catch (e: any) { removeToast(tid); addToast('error', 'Error: ' + e.message) }
    setPaying(false)
  }

  const sendBridge = async () => {
    if (!bridgeAmount) { addToast('error', 'Please enter amount'); return }
    setBridgePaying(true); setBridgeResult(null)
    const tid = addToast('loading', 'Bridging USDC...')
    try {
      const { AppKit } = await import('@circle-fin/app-kit')
      const { createViemAdapterFromProvider } = await import('@circle-fin/adapter-viem-v2')
      const kit = new AppKit()
      const adapter = await createViemAdapterFromProvider({ provider: (window as any).ethereum })
      const res = await kit.bridge({ from: { adapter, chain: bridgeFrom as never }, to: { adapter, chain: bridgeTo as never }, amount: bridgeAmount, token: 'USDC' })
      const txHash = (res as any)?.hash || (res as any)?.txHash || ''
      const fromLabel = CHAINS.find(c => c.id === bridgeFrom)?.label || bridgeFrom
      const toLabel = CHAINS.find(c => c.id === bridgeTo)?.label || bridgeTo
      saveTransaction(`Bridge ${fromLabel} → ${toLabel}`, address || '', bridgeAmount, txHash, `https://testnet.arcscan.app/tx/${txHash}`)
      setBridgeResult({ txHash, explorerUrl: `https://testnet.arcscan.app/tx/${txHash}` })
      setBridgeAmount('')
      removeToast(tid); addToast('success', `Bridged ${bridgeAmount} USDC!`)
    } catch (e: any) { removeToast(tid); addToast('error', 'Bridge failed: ' + e.message) }
    setBridgePaying(false)
  }

  const sendSwap = async () => {
    if (!swapAmountIn) { addToast('error', 'Please enter amount'); return }
    setSwapPaying(true); setSwapResult(null)
    const tid = addToast('loading', `Swapping ${swapTokenIn} → ${swapTokenOut}...`)
    try {
      const { AppKit } = await import('@circle-fin/app-kit')
      const { createViemAdapterFromProvider } = await import('@circle-fin/adapter-viem-v2')
      const kit = new AppKit()
      const adapter = await createViemAdapterFromProvider({ provider: (window as any).ethereum })
      const res = await kit.swap({ from: { adapter, chain: 'Arc_Testnet' as never }, tokenIn: swapTokenIn, tokenOut: swapTokenOut, amountIn: swapAmountIn, config: { slippageBps: Math.round(parseFloat(swapSlippage) * 100) } })
      const txHash = (res as any)?.hash || (res as any)?.txHash || ''
      saveTransaction(`Swap ${swapTokenIn} → ${swapTokenOut}`, address || '', swapAmountIn, txHash, `https://testnet.arcscan.app/tx/${txHash}`)
      setSwapResult({ txHash, explorerUrl: `https://testnet.arcscan.app/tx/${txHash}` })
      setSwapAmountIn('')
      removeToast(tid); addToast('success', `Swapped ${swapAmountIn} ${swapTokenIn}!`)
    } catch (e: any) { removeToast(tid); addToast('error', 'Swap failed: ' + e.message) }
    setSwapPaying(false)
  }

  const addRecipient = () => {
    if (!newName || !newAddress || !newAmount) { addToast('error', 'Please fill all fields'); return }
    setRecipients([...recipients, { id: Math.random().toString(36).slice(2), name: newName, address: newAddress, amount: newAmount, status: 'pending' }])
    setNewName(''); setNewAddress(''); setNewAmount('')
    addToast('success', 'Recipient added!')
  }

  const importCSV = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    Papa.parse(file, {
      header: true,
      complete: (results) => {
        const imported = (results.data as any[]).filter(r => r.address && r.amount).map(r => ({
          id: Math.random().toString(36).slice(2), name: r.name || 'Unknown', address: r.address, amount: r.amount, status: 'pending' as const
        }))
        setRecipients(prev => [...prev, ...imported])
        addToast('success', `${imported.length} recipients imported!`)
      }
    })
  }

  const sendBatch = async () => {
    const pending = recipients.filter(r => r.status === 'pending')
    if (!pending.length) { addToast('error', 'No pending recipients'); return }
    if (!confirm(`Send to ${pending.length} recipients?`)) return
    setBatchPaying(true)
    const tid = addToast('loading', `Sending to ${pending.length} recipients...`)
    const { AppKit } = await import('@circle-fin/app-kit')
    const { createViemAdapterFromProvider } = await import('@circle-fin/adapter-viem-v2')
    const kit = new AppKit()
    const adapter = await createViemAdapterFromProvider({ provider: (window as any).ethereum })
    let success = 0
    for (const r of pending) {
      try {
        const res = await kit.send({ from: { adapter, chain: 'Arc_Testnet' as never }, to: r.address, amount: r.amount, token: 'USDC' })
        const txHash = (res as any)?.hash || (res as any)?.txHash || ''
        let nftUrl = ''
        if (nftImageUrl) {
          nftUrl = await uploadNFTMetadata(`Receipt - ${r.name}`, `${r.amount} USDC`, nftImageUrl, [
            { trait_type: 'Recipient', value: r.name }, { trait_type: 'Amount', value: `${r.amount} USDC` },
          ])
        }
        saveTransaction(r.name, r.address, r.amount, txHash, undefined, nftUrl)
        setRecipients(prev => prev.map(x => x.id === r.id ? { ...x, status: 'paid', txHash, nftMinted: !!nftUrl, nftUrl } : x))
        success++
      } catch (e: any) { console.error(e) }
    }
    removeToast(tid); addToast('success', `${success}/${pending.length} payments sent!`)
    setBatchPaying(false)
  }

  const handleNFTImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setNftImagePreview(URL.createObjectURL(file))
    setUploadingImage(true)
    const tid = addToast('loading', 'Uploading to IPFS...')
    try {
      const url = await uploadImageToIPFS(file)
      setNftImageUrl(url)
      removeToast(tid); addToast('success', 'Uploaded to IPFS!')
    } catch (e: any) { removeToast(tid); addToast('error', 'Upload failed: ' + e.message) }
    setUploadingImage(false)
  }

  const downloadTemplate = () => {
    const csv = 'name,address,amount\nJohn Doe,0x1234567890123456789012345678901234567890,100'
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = 'template.csv'; a.click()
  }

  const shareOnTwitter = (txHash: string, amount: string, token: string) => {
    const text = `Just sent ${amount} ${token} instantly on Arc Network! ⚡\n\nTx: https://testnet.arcscan.app/tx/${txHash}\n\nBuilt with Arc Global Payouts by GoGo\n#ArcNetwork #USDC #DeFi`
    window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`, '_blank')
  }

  const addFavorite = () => {
    if (!favName || !singleAddress) { addToast('error', 'Enter name and address first'); return }
    const newFav = { name: favName, address: singleAddress }
    const updated = [...favorites, newFav]
    setFavorites(updated)
    localStorage.setItem('arc_favorites', JSON.stringify(updated))
    setFavName(''); setShowFavInput(false)
    addToast('success', 'Address saved!')
  }

  const totalPaid = transactions.reduce((s, t) => s + parseFloat(t.amount || '0'), 0)
  const pendingCount = recipients.filter(r => r.status === 'pending').length
  const showSidePanel = tab === 'send' || tab === 'nft' || tab === 'bridge' || tab === 'swap'
  const balanceFormatted = balanceLoading ? null : usdcBalance ? (Number(usdcBalance.value) / 1e18).toFixed(2) : '0.00'

  const Spinner = () => <span className="inline-block w-4 h-4 border-2 border-yellow-900 border-t-yellow-400 rounded-full animate-spin"></span>
  const SkeletonBox = ({ w = 'w-full', h = 'h-4' }: { w?: string; h?: string }) => (
    <div className={`${w} ${h} bg-gray-900 rounded animate-pulse`}></div>
  )

  const TxBox = ({ result, amount, token }: { result: { txHash: string; explorerUrl?: string }, amount?: string, token?: string }) => (
    <div className="rounded-xl p-4 border-l-4" style={{background:'#0e0e0e', borderLeftColor:'#c9a84c'}}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-bold" style={{color:'#c9a84c'}}>✓ Transaction confirmed</span>
        {amount && token && (
          <button onClick={() => shareOnTwitter(result.txHash, amount, token)}
            className="text-xs px-2 py-1 rounded-lg border transition-colors"
            style={{borderColor:'#1e3a5f', color:'#60a5fa', background:'#0a1628'}}>
            𝕏 Share
          </button>
        )}
      </div>
      <p className="text-xs font-mono truncate" style={{color:'#555'}}>{result.txHash}</p>
      {result.explorerUrl && (
        <a href={result.explorerUrl} target="_blank" rel="noopener noreferrer"
          className="text-xs hover:underline mt-1 block" style={{color:'#c9a84c'}}>
          View on ArcScan →
        </a>
      )}
    </div>
  )

  const WavesLogo = ({ size = 20, color = '#c9a84c' }: { size?: number, color?: string }) => (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none">
      <path d="M14 18 C14 18 24 10 34 18" stroke={color} strokeWidth="2.5" fill="none" strokeLinecap="round"/>
      <path d="M14 24 C14 24 24 16 34 24" stroke={color} strokeWidth="2.5" fill="none" strokeLinecap="round"/>
      <path d="M14 30 C14 30 24 22 34 30" stroke={color} strokeWidth="2.5" fill="none" strokeLinecap="round"/>
    </svg>
  )

  const TabIcon = ({ short, active }: { short: string, active: boolean }) => (
    <span style={{
      position: 'relative',
      width: 18, height: 18,
      border: `1px solid ${active ? '#c9a84c44' : '#1a1a1a'}`,
      borderRadius: 4,
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
      flexShrink: 0,
      fontSize: 8,
      fontWeight: 800,
      color: active ? '#c9a84c' : '#333',
      transition: 'all .3s',
    }}>
      {active && (
        <span style={{
          position: 'absolute',
          width: '200%', height: '200%',
          top: '-50%', left: '-50%',
          background: 'conic-gradient(transparent 0deg, #c9a84c 60deg, transparent 120deg)',
          animation: 'tabSweep 2s linear infinite',
        }} />
      )}
      <span style={{
        position: 'absolute',
        inset: 2,
        background: '#080808',
        borderRadius: 2,
        zIndex: 1,
      }} />
      <span style={{position: 'relative', zIndex: 2}}>{short}</span>
    </span>
  )

  if (!isConnected) {
    return (
      <div className="min-h-screen flex flex-col" style={{background:'#080808'}}>
        <nav className="border-b px-6 py-4 flex justify-between items-center" style={{borderColor:'#141414'}}>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 border rounded-xl flex items-center justify-center" style={{background:'#111', borderColor:'#222'}}>
              <WavesLogo size={20} />
            </div>
            <div>
              <div className="font-bold text-sm text-white">Arc Global Payouts</div>
              <div className="text-xs font-bold tracking-widest" style={{color:'#c9a84c'}}>ARC NETWORK <span style={{color:'#444'}}>· by GoGo</span></div>
            </div>
          </div>
          <a href="https://github.com/GoGoSns/arc-payouts" target="_blank" rel="noopener noreferrer"
            className="text-xs px-3 py-1.5 rounded-lg border" style={{borderColor:'#222', color:'#888', background:'#111'}}>
            GitHub ↗
          </a>
        </nav>
        <div className="flex-1 flex flex-col items-center justify-center px-4 py-16 text-center">
          <div className="w-20 h-20 border rounded-2xl flex items-center justify-center mb-8" style={{background:'#111', borderColor:'#2a2a2a'}}>
            <WavesLogo size={40} />
          </div>
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-4 leading-tight">
            Global USDC Payments<br/>
            <span style={{color:'#c9a84c'}}>on Arc Network</span>
          </h1>
          <p className="mb-12 max-w-md text-lg leading-relaxed" style={{color:'#555'}}>
            Send, bridge, swap and batch pay with USDC. Sub-second finality. Zero complexity.
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-12 w-full max-w-2xl">
            {[
              { icon: '💸', label: 'Send', desc: 'Instant USDC transfers' },
              { icon: '🌉', label: 'Bridge', desc: 'Cross-chain in seconds' },
              { icon: '🔄', label: 'Swap', desc: 'USDC ↔ EURC ↔ ETH' },
              { icon: '📋', label: 'Batch', desc: 'Pay hundreds at once' },
            ].map(f => (
              <div key={f.label} className="rounded-xl p-4 border text-left transition-colors hover:border-yellow-900"
                style={{background:'#0e0e0e', borderColor:'#1a1a1a'}}>
                <div className="text-2xl mb-2">{f.icon}</div>
                <div className="text-sm font-bold text-white">{f.label}</div>
                <div className="text-xs mt-1" style={{color:'#555'}}>{f.desc}</div>
              </div>
            ))}
          </div>
          <div className="flex flex-col gap-3 w-full max-w-xs mb-8">
            <p className="text-xs font-bold tracking-widest" style={{color:'#444'}}>GETTING STARTED</p>
            <a href="https://thirdweb.com/arc-testnet" target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-3 border rounded-xl px-4 py-3 hover:border-yellow-900 transition-colors"
              style={{background:'#0e0e0e', borderColor:'#1a1a1a'}}>
              <span className="text-lg">⚙️</span>
              <div className="text-left">
                <div className="text-sm font-medium text-white">1. Add Arc Testnet</div>
                <div className="text-xs" style={{color:'#555'}}>Auto-add to MetaMask</div>
              </div>
              <span className="ml-auto text-xs" style={{color:'#333'}}>↗</span>
            </a>
            <a href="https://faucet.circle.com" target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-3 border rounded-xl px-4 py-3 hover:border-yellow-900 transition-colors"
              style={{background:'#0e0e0e', borderColor:'#1a1a1a'}}>
              <span className="text-lg">🚰</span>
              <div className="text-left">
                <div className="text-sm font-medium text-white">2. Get Test USDC</div>
                <div className="text-xs" style={{color:'#555'}}>Free from Circle Faucet</div>
              </div>
              <span className="ml-auto text-xs" style={{color:'#333'}}>↗</span>
            </a>
          </div>
          <button onClick={connectWallet}
            className="px-10 py-4 rounded-xl font-bold text-lg active:scale-95 transition-all"
            style={{background:'linear-gradient(135deg,#c9a84c,#a07830)', color:'#000'}}>
            3. Connect Wallet →
          </button>
          <p className="text-xs mt-4" style={{color:'#333'}}>MetaMask · WalletConnect · Coinbase Wallet</p>
        </div>
        <div className="text-center py-6 text-xs border-t" style={{color:'#2a2a2a', borderColor:'#111'}}>
          Arc Global Payouts · Built on Arc Network · by GoGo
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col" style={{background:'#080808', color:'#fff'}}>

      {/* tabSweep animation */}
      <style>{`@keyframes tabSweep { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>

      {/* TOASTS */}
      <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 pointer-events-none">
        {toasts.map(t => (
          <div key={t.id} className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium pointer-events-auto border"
            style={{
              background: t.type === 'success' ? '#0a1a0a' : t.type === 'error' ? '#1a0a0a' : '#111',
              borderColor: t.type === 'success' ? '#1a3a1a' : t.type === 'error' ? '#3a1a1a' : '#222',
              color: t.type === 'success' ? '#4ade80' : t.type === 'error' ? '#f87171' : '#888',
            }}>
            <span>{t.type === 'success' ? '✓' : t.type === 'error' ? '✕' : <Spinner />}</span>
            <span>{t.message}</span>
            <button onClick={() => removeToast(t.id)} className="ml-2 text-xs opacity-40 hover:opacity-100">✕</button>
          </div>
        ))}
      </div>

      {/* QR MODAL */}
      {showQR && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{background:'rgba(0,0,0,0.85)'}}>
          <div className="rounded-2xl p-6 border w-80" style={{background:'#0e0e0e', borderColor:'#1a1a1a'}}>
            <div className="flex justify-between items-center mb-4">
              <span className="font-bold text-sm text-white">Your Wallet Address</span>
              <button onClick={() => setShowQR(false)} style={{color:'#555'}}>✕</button>
            </div>
            <div className="bg-white p-6 rounded-xl mb-4 flex flex-col items-center justify-center gap-3">
              <div className="grid grid-cols-8 gap-0.5">
                {Array.from({length: 64}).map((_, i) => (
                  <div key={i} style={{
                    width: 8, height: 8,
                    background: Math.random() > 0.5 ? '#000' : '#fff',
                    borderRadius: 1,
                  }} />
                ))}
              </div>
              <div className="text-xs text-gray-400 font-mono break-all text-center">{address}</div>
            </div>
            <button onClick={() => { navigator.clipboard.writeText(address || ''); addToast('success', 'Address copied!'); setShowQR(false) }}
              className="w-full py-3 rounded-xl font-bold text-sm active:scale-95 transition-all"
              style={{background:'linear-gradient(135deg,#c9a84c,#a07830)', color:'#000'}}>
              Copy Address
            </button>
          </div>
        </div>
      )}

      {/* NAVBAR */}
      <nav className="border-b px-4 md:px-6 py-4 flex justify-between items-center" style={{borderColor:'#141414'}}>
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 border rounded-xl flex items-center justify-center" style={{background:'#111', borderColor:'#1e1e1e'}}>
            <WavesLogo size={20} />
          </div>
          <div>
            <div className="font-bold text-sm text-white">Arc Global Payouts</div>
            <div className="text-xs font-bold tracking-widest" style={{color:'#c9a84c'}}>
              ARC NETWORK <span style={{color:'#444'}}>· by GoGo</span>
            </div>
          </div>
        </div>
        <div className="hidden md:flex items-center gap-3">
          <a href="https://thirdweb.com/arc-testnet" target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-2 border rounded-full px-3 py-1" style={{background:'#111', borderColor:'#1e1e1e'}}>
            <div className="w-2 h-2 rounded-full animate-pulse" style={{background:'#c9a84c'}}></div>
            <span className="text-xs" style={{color:'#666'}}>Arc Testnet</span>
          </a>
          <div className="border rounded-full px-3 py-1 text-xs" style={{background:'#111', borderColor:'#1e1e1e', color:'#c9a84c'}}>USDC</div>
          <button onClick={() => setShowQR(true)} className="flex items-center gap-2 border rounded-full px-3 py-1 transition-colors hover:border-yellow-900"
            style={{background:'#111', borderColor:'#1e1e1e'}}>
            <div className="w-6 h-6 rounded-full" style={{background:'linear-gradient(135deg,#c9a84c,#a07830)'}}></div>
            <span className="text-xs" style={{color:'#666'}}>{address?.slice(0,6)}...{address?.slice(-4)}</span>
            <span className="text-xs" style={{color:'#333'}}>▾</span>
          </button>
          <Link href="/history" className="text-xs transition-colors" style={{color:'#666'}}>History</Link>
          <div className="relative">
            <button onClick={() => setShowHelp(!showHelp)}
              className="w-6 h-6 rounded-full border text-xs flex items-center justify-center"
              style={{background:'#111', borderColor:'#222', color:'#666'}}>?</button>
            {showHelp && (
              <div className="absolute right-0 top-8 w-64 border rounded-xl shadow-2xl z-50 p-3" style={{background:'#0e0e0e', borderColor:'#1a1a1a'}}>
                <div className="text-xs font-bold mb-3 px-1" style={{color:'#c9a84c'}}>🛠 Developer Tools</div>
                {[
                  { href: 'https://faucet.circle.com', icon: '🚰', title: 'Test USDC Faucet', sub: 'faucet.circle.com' },
                  { href: 'https://thirdweb.com/arc-testnet', icon: '⚙️', title: 'Arc Testnet Setup', sub: 'thirdweb.com' },
                  { href: 'https://testnet.arcscan.app', icon: '🔍', title: 'ArcScan Explorer', sub: 'testnet.arcscan.app' },
                ].map(item => (
                  <a key={item.href} href={item.href} target="_blank" rel="noopener noreferrer" onClick={() => setShowHelp(false)}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:opacity-80">
                    <span className="text-sm">{item.icon}</span>
                    <div><div className="text-sm font-medium text-white">{item.title}</div><div className="text-xs" style={{color:'#444'}}>{item.sub}</div></div>
                  </a>
                ))}
                <div className="border-t mt-2 pt-2 px-1" style={{borderColor:'#141414'}}>
                  <div className="text-xs" style={{color:'#333'}}>Arc Global Payouts v3.1 · by GoGo</div>
                </div>
              </div>
            )}
          </div>
          <button onClick={() => disconnect()} className="text-xs transition-colors hover:text-red-400" style={{color:'#444'}}>Disconnect</button>
        </div>
        <button className="md:hidden flex flex-col gap-1.5 p-2" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
          <span className={`block w-5 h-0.5 transition-all ${mobileMenuOpen ? 'rotate-45 translate-y-2' : ''}`} style={{background:'#888'}}></span>
          <span className={`block w-5 h-0.5 transition-all ${mobileMenuOpen ? 'opacity-0' : ''}`} style={{background:'#888'}}></span>
          <span className={`block w-5 h-0.5 transition-all ${mobileMenuOpen ? '-rotate-45 -translate-y-2' : ''}`} style={{background:'#888'}}></span>
        </button>
      </nav>

      {/* MOBILE MENU */}
      {mobileMenuOpen && (
        <div className="md:hidden border-b px-4 py-4 flex flex-col gap-3" style={{background:'#0a0a0a', borderColor:'#141414'}}>
          <div className="flex items-center gap-2 text-sm">
            <div className="w-2 h-2 rounded-full" style={{background:'#c9a84c'}}></div>
            <span style={{color:'#888'}}>Arc Testnet</span>
            <span className="ml-auto text-xs font-mono" style={{color:'#444'}}>{address?.slice(0,6)}...{address?.slice(-4)}</span>
          </div>
          <button onClick={() => { setShowQR(true); setMobileMenuOpen(false) }} className="text-sm py-1 text-left" style={{color:'#888'}}>📱 Show QR Code</button>
          {[
            { href: 'https://faucet.circle.com', label: '🚰 Get Test USDC' },
            { href: 'https://thirdweb.com/arc-testnet', label: '⚙️ Network Setup' },
            { href: 'https://testnet.arcscan.app', label: '🔍 ArcScan Explorer' },
          ].map(item => (
            <a key={item.href} href={item.href} target="_blank" rel="noopener noreferrer" className="text-sm py-1" style={{color:'#666'}}>{item.label}</a>
          ))}
          <Link href="/history" className="text-sm py-1" style={{color:'#666'}}>📋 Transaction History</Link>
          <button onClick={() => disconnect()} className="text-sm py-1 text-left text-red-500">Disconnect Wallet</button>
        </div>
      )}

      {/* TABS */}
      <div className="border-b px-4 md:px-6 overflow-x-auto" style={{borderColor:'#111'}}>
        <div className="flex gap-0 min-w-max">
          {TAB_CONFIG.map(t => (
            <button key={t.id} onClick={() => setTab(t.id as Tab)}
              className="py-3 px-4 text-sm font-medium border-b-2 transition-all flex items-center gap-2 whitespace-nowrap"
              style={{
                color: tab === t.id ? '#c9a84c' : '#444',
                borderBottomColor: tab === t.id ? '#c9a84c' : 'transparent',
              }}>
              <TabIcon short={t.short} active={tab === t.id} />
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* CONTENT */}
      <div className="flex flex-1 flex-col md:flex-row" onClick={() => showHelp && setShowHelp(false)}>

        {showSidePanel && (
          <div className="flex-1 flex items-start justify-center p-4 md:p-8">
            <div className="w-full max-w-md border rounded-2xl p-5 md:p-6" style={{background:'#0e0e0e', borderColor:'#1a1a1a'}}>

              {/* SEND */}
              {tab === 'send' && (
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <label className="text-xs font-bold tracking-wider" style={{color:'#444'}}>YOU PAY</label>
                    <span className="text-xs" style={{color:'#444'}}>Balance: ${balanceFormatted || '—'}</span>
                  </div>
                  <div className="rounded-xl p-4 border transition-all" style={{background:'#080808', borderColor:'#181818'}}>
                    <div className="flex items-center gap-3">
                      <input type="number" value={singleAmount} onChange={e => setSingleAmount(e.target.value)} placeholder="0"
                        className="bg-transparent text-4xl font-light flex-1 outline-none text-white" style={{letterSpacing:'-1px'}} />
                      <div className="flex items-center gap-2 border rounded-full px-3 py-1.5" style={{background:'#141414', borderColor:'#222'}}>
                        <div className="w-2 h-2 rounded-full" style={{background:'#6366f1'}}></div>
                        <span className="text-sm font-bold" style={{color:'#ddd'}}>USDC</span>
                      </div>
                    </div>
                    <div className="text-xs mt-2" style={{color:'#333'}}>Arc Testnet</div>
                  </div>
                  <div className="flex justify-center">
                    <div className="w-8 h-8 border rounded-lg flex items-center justify-center text-sm" style={{background:'#0e0e0e', borderColor:'#1a1a1a', color:'#333'}}>↓</div>
                  </div>
                  <label className="text-xs font-bold tracking-wider block" style={{color:'#444'}}>TO</label>
                  <div className="rounded-xl p-4 border transition-all" style={{background:'#080808', borderColor:'#181818'}}>
                    <input type="text" value={singleAddress} onChange={e => setSingleAddress(e.target.value)} placeholder="Wallet address or ENS"
                      className="bg-transparent text-sm outline-none w-full" style={{color:'#888'}} />
                    <div className="text-xs mt-2" style={{color:'#333'}}>Arc Testnet</div>
                  </div>
                  {favorites.length > 0 && (
                    <div>
                      <div className="text-xs font-bold tracking-wider mb-2" style={{color:'#444'}}>FAVORITES</div>
                      <div className="flex flex-wrap gap-2">
                        {favorites.map((f, i) => (
                          <button key={i} onClick={() => setSingleAddress(f.address)}
                            className="text-xs px-2 py-1 border rounded-lg hover:border-yellow-900 transition-colors"
                            style={{background:'#141414', borderColor:'#222', color:'#888'}}>
                            ⭐ {f.name}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  {singleAddress && !showFavInput && (
                    <button onClick={() => setShowFavInput(true)} className="text-xs transition-colors hover:opacity-80" style={{color:'#444'}}>
                      + Save to favorites
                    </button>
                  )}
                  {showFavInput && (
                    <div className="flex gap-2">
                      <input value={favName} onChange={e => setFavName(e.target.value)} placeholder="Label (e.g. Alice)"
                        className="flex-1 text-xs px-3 py-2 border rounded-lg outline-none" style={{background:'#141414', borderColor:'#222', color:'#fff'}} />
                      <button onClick={addFavorite} className="text-xs px-3 py-2 rounded-lg font-bold" style={{background:'linear-gradient(135deg,#c9a84c,#a07830)', color:'#000'}}>Save</button>
                      <button onClick={() => setShowFavInput(false)} className="text-xs" style={{color:'#444'}}>✕</button>
                    </div>
                  )}
                  {singleAmount && (
                    <div className="border rounded-xl p-3 space-y-2 text-sm" style={{background:'#080808', borderColor:'#111'}}>
                      <div className="flex justify-between"><span style={{color:'#444'}}>Network fee</span><span style={{color:'#666'}}>~0.009 USDC</span></div>
                      <div className="flex justify-between"><span style={{color:'#444'}}>Rate</span><span style={{color:'#666'}}>1 USDC = 1 USDC</span></div>
                      <div className="flex justify-between font-bold border-t pt-2" style={{borderColor:'#141414'}}>
                        <span className="text-white">Total sent</span><span style={{color:'#c9a84c'}}>{singleAmount} USDC</span>
                      </div>
                    </div>
                  )}
                  <button onClick={sendSingle} disabled={paying}
                    className="w-full py-4 rounded-xl font-black text-sm tracking-wider active:scale-95 disabled:opacity-50 transition-all"
                    style={{background: paying ? '#333' : 'linear-gradient(135deg,#c9a84c,#a07830)', color:'#000'}}>
                    {paying ? <span className="flex items-center justify-center gap-2"><Spinner />SENDING...</span> : 'CONFIRM TRANSFER'}
                  </button>
                  {txResult && <TxBox result={txResult} amount={singleAmount} token="USDC" />}
                  <div className="text-center text-xs" style={{color:'#222'}}>Arc Testnet · sub-second finality · Powered by Arc App Kit</div>
                </div>
              )}

              {/* NFT */}
              {tab === 'nft' && (
                <div className="space-y-4">
                  <h2 className="font-bold text-lg text-white">NFT Receipt Image</h2>
                  <p className="text-sm" style={{color:'#555'}}>This image will be minted as an NFT receipt after each payment.</p>
                  <div className="border-2 border-dashed rounded-xl p-8 text-center hover:border-yellow-900 transition-colors" style={{borderColor:'#1a1a1a'}}>
                    {nftImagePreview
                      ? <img src={nftImagePreview} alt="NFT" className="w-32 h-32 rounded-xl object-cover mx-auto mb-3" />
                      : <div className="text-4xl mb-3">🎨</div>}
                    <button onClick={() => nftImageRef.current?.click()} disabled={uploadingImage}
                      className="px-4 py-2 rounded-lg text-sm font-bold active:scale-95 disabled:opacity-50 transition-all"
                      style={{background:'linear-gradient(135deg,#c9a84c,#a07830)', color:'#000'}}>
                      {uploadingImage ? <span className="flex items-center gap-2"><Spinner />Uploading...</span> : nftImageUrl ? '✅ Image Uploaded' : 'Select Image'}
                    </button>
                    <input ref={nftImageRef} type="file" accept="image/*" onChange={handleNFTImageSelect} className="hidden" />
                  </div>
                  {nftImageUrl && (
                    <div className="border rounded-lg p-3 text-sm" style={{background:'#0a1a0a', borderColor:'#1a3a1a', color:'#4ade80'}}>
                      ✅ Uploaded to IPFS — payments will include this NFT receipt
                    </div>
                  )}
                </div>
              )}

              {/* BRIDGE */}
              {tab === 'bridge' && (
                <div className="space-y-4">
                  <div>
                    <label className="text-xs font-bold tracking-wider mb-2 block" style={{color:'#444'}}>FROM</label>
                    <div className="grid grid-cols-3 gap-2">
                      {CHAINS.filter(c => c.id !== bridgeTo).map(chain => (
                        <button key={chain.id} onClick={() => setBridgeFrom(chain.id)}
                          className="py-2 px-2 rounded-xl text-xs font-medium border transition-all active:scale-95"
                          style={{
                            borderColor: bridgeFrom === chain.id ? '#c9a84c' : '#1a1a1a',
                            color: bridgeFrom === chain.id ? '#c9a84c' : '#444',
                            background: bridgeFrom === chain.id ? '#1a1500' : '#080808',
                          }}>
                          <div className={`w-2 h-2 rounded-full ${chain.dot} inline-block mr-1`}></div>
                          {chain.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="rounded-xl p-4 border" style={{background:'#080808', borderColor:'#181818'}}>
                    <div className="flex items-center gap-3">
                      <input type="number" value={bridgeAmount} onChange={e => setBridgeAmount(e.target.value)} placeholder="0"
                        className="bg-transparent text-4xl font-light flex-1 outline-none text-white" style={{letterSpacing:'-1px'}} />
                      <div className="flex items-center gap-2 border rounded-full px-3 py-1.5" style={{background:'#141414', borderColor:'#222'}}>
                        <div className="w-2 h-2 rounded-full" style={{background:'#6366f1'}}></div>
                        <span className="text-sm font-bold" style={{color:'#ddd'}}>USDC</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 mt-2">
                      <div className={`w-2 h-2 rounded-full ${CHAINS.find(c => c.id === bridgeFrom)?.dot}`}></div>
                      <span className="text-xs" style={{color:'#333'}}>{CHAINS.find(c => c.id === bridgeFrom)?.label}</span>
                    </div>
                  </div>
                  <div className="flex justify-center">
                    <button onClick={flipBridge} className="w-10 h-10 border rounded-full flex items-center justify-center text-lg transition-all active:scale-95 hover:border-yellow-900"
                      style={{background:'#0e0e0e', borderColor:'#1a1a1a', color:'#444'}}>⇅</button>
                  </div>
                  <div>
                    <label className="text-xs font-bold tracking-wider mb-2 block" style={{color:'#444'}}>TO</label>
                    <div className="grid grid-cols-3 gap-2">
                      {CHAINS.filter(c => c.id !== bridgeFrom).map(chain => (
                        <button key={chain.id} onClick={() => setBridgeTo(chain.id)}
                          className="py-2 px-2 rounded-xl text-xs font-medium border transition-all active:scale-95"
                          style={{
                            borderColor: bridgeTo === chain.id ? '#c9a84c' : '#1a1a1a',
                            color: bridgeTo === chain.id ? '#c9a84c' : '#444',
                            background: bridgeTo === chain.id ? '#1a1500' : '#080808',
                          }}>
                          <div className={`w-2 h-2 rounded-full ${chain.dot} inline-block mr-1`}></div>
                          {chain.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="rounded-xl p-4 border" style={{background:'#080808', borderColor:'#141414'}}>
                    <div className="flex items-center gap-3">
                      <span className="text-4xl font-light flex-1" style={{letterSpacing:'-1px', color:'#444'}}>{bridgeAmount || '0'}</span>
                      <div className="flex items-center gap-2 border rounded-full px-3 py-1.5" style={{background:'#141414', borderColor:'#222'}}>
                        <div className="w-2 h-2 rounded-full" style={{background:'#6366f1'}}></div>
                        <span className="text-sm font-bold" style={{color:'#ddd'}}>USDC</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 mt-2">
                      <div className={`w-2 h-2 rounded-full ${CHAINS.find(c => c.id === bridgeTo)?.dot}`}></div>
                      <span className="text-xs" style={{color:'#333'}}>{CHAINS.find(c => c.id === bridgeTo)?.label}</span>
                    </div>
                  </div>
                  {bridgeAmount && (
                    <div className="border rounded-xl p-3 space-y-2 text-sm" style={{background:'#080808', borderColor:'#111'}}>
                      <div className="flex justify-between"><span style={{color:'#444'}}>From</span><span style={{color:'#666'}}>{CHAINS.find(c => c.id === bridgeFrom)?.label}</span></div>
                      <div className="flex justify-between"><span style={{color:'#444'}}>To</span><span style={{color:'#666'}}>{CHAINS.find(c => c.id === bridgeTo)?.label}</span></div>
                      <div className="flex justify-between"><span style={{color:'#444'}}>Bridge fee</span><span style={{color:'#666'}}>~0.01 USDC</span></div>
                      <div className="flex justify-between font-bold border-t pt-2" style={{borderColor:'#141414'}}>
                        <span className="text-white">You receive</span><span style={{color:'#c9a84c'}}>{bridgeAmount} USDC</span>
                      </div>
                    </div>
                  )}
                  <button onClick={sendBridge} disabled={bridgePaying}
                    className="w-full py-4 rounded-xl font-black text-sm tracking-wider active:scale-95 disabled:opacity-50 transition-all"
                    style={{background: bridgePaying ? '#333' : 'linear-gradient(135deg,#c9a84c,#a07830)', color:'#000'}}>
                    {bridgePaying ? <span className="flex items-center justify-center gap-2"><Spinner />BRIDGING...</span> : 'CONFIRM BRIDGE'}
                  </button>
                  {bridgeResult && <TxBox result={bridgeResult} amount={bridgeAmount} token="USDC" />}
                </div>
              )}

              {/* SWAP */}
              {tab === 'swap' && (
                <div className="space-y-4">
                  <div>
                    <label className="text-xs font-bold tracking-wider mb-2 block" style={{color:'#444'}}>YOU PAY</label>
                    <div className="rounded-xl p-4 border" style={{background:'#080808', borderColor:'#181818'}}>
                      <div className="flex items-center gap-3">
                        <input type="number" value={swapAmountIn} onChange={e => setSwapAmountIn(e.target.value)} placeholder="0"
                          className="bg-transparent text-4xl font-light flex-1 outline-none text-white" style={{letterSpacing:'-1px'}} />
                        <select value={swapTokenIn} onChange={e => setSwapTokenIn(e.target.value)}
                          className="border rounded-full px-3 py-1.5 text-sm font-bold outline-none cursor-pointer"
                          style={{background:'#141414', borderColor:'#222', color:'#ddd'}}>
                          {TOKENS.filter(t => t !== swapTokenOut).map(t => <option key={t} value={t}>{t}</option>)}
                        </select>
                      </div>
                      <div className="text-xs mt-2" style={{color:'#333'}}>Arc Testnet</div>
                    </div>
                  </div>
                  <div className="flex justify-center">
                    <button onClick={flipSwap} className="w-10 h-10 border rounded-full flex items-center justify-center text-lg transition-all active:scale-95 hover:border-yellow-900"
                      style={{background:'#0e0e0e', borderColor:'#1a1a1a', color:'#444'}}>⇅</button>
                  </div>
                  <div>
                    <label className="text-xs font-bold tracking-wider mb-2 block" style={{color:'#444'}}>YOU RECEIVE</label>
                    <div className="rounded-xl p-4 border" style={{background:'#080808', borderColor:'#141414'}}>
                      <div className="flex items-center gap-3">
                        <span className="text-4xl font-light flex-1" style={{letterSpacing:'-1px', color:'#444'}}>{swapAmountOut}</span>
                        <select value={swapTokenOut} onChange={e => setSwapTokenOut(e.target.value)}
                          className="border rounded-full px-3 py-1.5 text-sm font-bold outline-none cursor-pointer"
                          style={{background:'#141414', borderColor:'#222', color:'#ddd'}}>
                          {TOKENS.filter(t => t !== swapTokenIn).map(t => <option key={t} value={t}>{t}</option>)}
                        </select>
                      </div>
                      <div className="text-xs mt-2" style={{color:'#333'}}>Arc Testnet</div>
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-bold tracking-wider mb-2 block" style={{color:'#444'}}>SLIPPAGE</label>
                    <div className="flex gap-2 items-center flex-wrap">
                      {['0.5', '1', '3'].map(s => (
                        <button key={s} onClick={() => setSwapSlippage(s)}
                          className="px-3 py-1.5 rounded-lg text-xs font-bold border transition-all active:scale-95"
                          style={{
                            borderColor: swapSlippage === s ? '#c9a84c' : '#1a1a1a',
                            color: swapSlippage === s ? '#c9a84c' : '#444',
                            background: swapSlippage === s ? '#1a1500' : '#080808',
                          }}>
                          {s}%
                        </button>
                      ))}
                      <input type="number" placeholder="Custom"
                        value={['0.5','1','3'].includes(swapSlippage) ? '' : swapSlippage}
                        onChange={e => setSwapSlippage(e.target.value)}
                        className="w-20 border rounded-lg px-2 py-1.5 text-xs outline-none"
                        style={{background:'#080808', borderColor:'#1a1a1a', color:'#888'}} />
                      {priceImpactHigh && <span className="text-xs font-bold text-red-400">⚠ High impact</span>}
                    </div>
                  </div>
                  {swapAmountIn && (
                    <div className="border rounded-xl p-3 space-y-2 text-sm" style={{background:'#080808', borderColor:'#111'}}>
                      <div className="flex justify-between"><span style={{color:'#444'}}>Rate</span><span style={{color:'#666'}}>1 {swapTokenIn} = {(RATES[swapTokenIn]?.[swapTokenOut] || 1).toFixed(4)} {swapTokenOut}</span></div>
                      <div className="flex justify-between"><span style={{color:'#444'}}>Price impact</span><span className={priceImpactHigh ? 'text-red-400' : 'text-green-400'}>{priceImpactHigh ? '> 2%' : '< 0.1%'}</span></div>
                      <div className="flex justify-between"><span style={{color:'#444'}}>Slippage</span><span style={{color:'#666'}}>{swapSlippage}%</span></div>
                      <div className="flex justify-between font-bold border-t pt-2" style={{borderColor:'#141414'}}>
                        <span className="text-white">Min. received</span>
                        <span style={{color:'#c9a84c'}}>{(parseFloat(swapAmountOut) * (1 - parseFloat(swapSlippage)/100)).toFixed(4)} {swapTokenOut}</span>
                      </div>
                    </div>
                  )}
                  <div className="border rounded-xl p-3" style={{background:'#080808', borderColor:'#111'}}>
                    <div className="text-xs font-bold tracking-wider mb-2" style={{color:'#444'}}>ROUTE</div>
                    <div className="flex items-center gap-2 text-xs flex-wrap">
                      <span className="border rounded-lg px-2 py-1 font-bold" style={{background:'#141414', borderColor:'#1a1a1a', color:'#c9a84c'}}>{swapTokenIn}</span>
                      <span style={{color:'#333'}}>→</span>
                      <span className="border rounded-lg px-2 py-1 font-bold" style={{background:'#0a1a0a', borderColor:'#1a3a1a', color:'#4ade80'}}>Arc Pool</span>
                      <span style={{color:'#333'}}>→</span>
                      <span className="border rounded-lg px-2 py-1 font-bold" style={{background:'#141414', borderColor:'#1a1a1a', color:'#c9a84c'}}>{swapTokenOut}</span>
                    </div>
                    <div className="text-xs mt-2" style={{color:'#333'}}>Best route · Arc DEX · 0.3% fee</div>
                  </div>
                  <button onClick={sendSwap} disabled={swapPaying}
                    className="w-full py-4 rounded-xl font-black text-sm tracking-wider active:scale-95 disabled:opacity-50 transition-all"
                    style={{background: swapPaying ? '#333' : 'linear-gradient(135deg,#c9a84c,#a07830)', color:'#000'}}>
                    {swapPaying ? <span className="flex items-center justify-center gap-2"><Spinner />SWAPPING...</span> : 'CONFIRM SWAP'}
                  </button>
                  {swapResult && <TxBox result={swapResult} amount={swapAmountIn} token={swapTokenIn} />}
                </div>
              )}
            </div>
          </div>
        )}

        {/* BATCH */}
        {tab === 'batch' && (
          <div className="flex-1 p-4 md:p-6">
            <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-3 mb-4">
              <h2 className="text-xl font-bold text-white">Batch Payout</h2>
              <div className="flex gap-2 flex-wrap">
                <button onClick={downloadTemplate} className="px-3 py-2 border rounded-lg text-sm transition-all active:scale-95 hover:border-yellow-900"
                  style={{background:'#0e0e0e', borderColor:'#1a1a1a', color:'#888'}}>Template</button>
                <button onClick={() => fileRef.current?.click()} className="px-3 py-2 border rounded-lg text-sm transition-all active:scale-95 hover:border-yellow-900"
                  style={{background:'#0e0e0e', borderColor:'#1a1a1a', color:'#888'}}>Import CSV</button>
                <input ref={fileRef} type="file" accept=".csv" onChange={importCSV} className="hidden" />
                {pendingCount > 0 && (
                  <button onClick={sendBatch} disabled={batchPaying}
                    className="px-3 py-2 rounded-lg text-sm font-bold active:scale-95 disabled:opacity-50 transition-all"
                    style={{background:'linear-gradient(135deg,#c9a84c,#a07830)', color:'#000'}}>
                    {batchPaying ? <span className="flex items-center gap-2"><Spinner />Sending...</span> : `Send to ${pendingCount}`}
                  </button>
                )}
              </div>
            </div>
            <div className="border rounded-xl p-4 mb-4" style={{background:'#0e0e0e', borderColor:'#1a1a1a'}}>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Full name"
                  className="border rounded-lg px-3 py-2 text-sm outline-none" style={{background:'#080808', borderColor:'#1a1a1a', color:'#fff'}} />
                <input value={newAddress} onChange={e => setNewAddress(e.target.value)} placeholder="0x..."
                  className="border rounded-lg px-3 py-2 text-sm outline-none md:col-span-2" style={{background:'#080808', borderColor:'#1a1a1a', color:'#fff'}} />
                <div className="flex gap-2">
                  <input value={newAmount} onChange={e => setNewAmount(e.target.value)} placeholder="USDC" type="number"
                    className="border rounded-lg px-3 py-2 text-sm outline-none flex-1" style={{background:'#080808', borderColor:'#1a1a1a', color:'#fff'}} />
                  <button onClick={addRecipient} className="px-4 py-2 rounded-lg text-sm font-bold active:scale-95"
                    style={{background:'linear-gradient(135deg,#c9a84c,#a07830)', color:'#000'}}>+</button>
                </div>
              </div>
            </div>
            <div className="border rounded-xl overflow-hidden overflow-x-auto" style={{background:'#0e0e0e', borderColor:'#1a1a1a'}}>
              {recipients.length === 0 ? (
                <div className="p-12 text-center">
                  <div className="text-4xl mb-3">👥</div>
                  <p style={{color:'#444'}}>No recipients yet</p>
                  <p className="text-sm mt-1" style={{color:'#333'}}>Add manually or import CSV</p>
                </div>
              ) : (
                <table className="w-full min-w-[600px]">
                  <thead className="border-b" style={{borderColor:'#1a1a1a'}}>
                    <tr>
                      {['NAME','ADDRESS','AMOUNT','STATUS','NFT','TX'].map(h => (
                        <th key={h} className="text-left p-4 text-xs font-bold tracking-wider" style={{color:'#444'}}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {recipients.map(r => (
                      <tr key={r.id} className="border-b transition-colors" style={{borderColor:'#141414'}}>
                        <td className="p-4 text-sm font-medium text-white">{r.name}</td>
                        <td className="p-4 text-sm font-mono" style={{color:'#555'}}>{r.address.slice(0,6)}...{r.address.slice(-4)}</td>
                        <td className="p-4 text-sm font-bold" style={{color:'#c9a84c'}}>{r.amount} USDC</td>
                        <td className="p-4">
                          <span className="px-2 py-1 rounded text-xs font-bold"
                            style={r.status === 'paid' ? {background:'#0a1a0a', color:'#4ade80'} : {background:'#1a1500', color:'#c9a84c'}}>
                            {r.status === 'paid' ? '✅ Paid' : '⏳ Pending'}
                          </span>
                        </td>
                        <td className="p-4">{r.nftUrl ? <a href={r.nftUrl} target="_blank" rel="noopener noreferrer" className="text-xs hover:underline" style={{color:'#c9a84c'}}>View</a> : <span className="text-xs" style={{color:'#333'}}>—</span>}</td>
                        <td className="p-4">{r.txHash ? <a href={`https://testnet.arcscan.app/tx/${r.txHash}`} target="_blank" rel="noopener noreferrer" className="text-xs hover:underline" style={{color:'#6366f1'}}>Explorer</a> : <span className="text-xs" style={{color:'#333'}}>—</span>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}

        {/* RIGHT PANEL */}
        {showSidePanel && (
          <div className="w-full md:w-72 border-t md:border-t-0 md:border-l p-4 md:p-5 flex flex-col gap-4" style={{borderColor:'#111'}}>
            <div className="border rounded-xl p-4" style={{background:'#0e0e0e', borderColor:'#1a1a1a'}}>
              <div className="text-xs font-bold tracking-wider mb-2" style={{color:'#444'}}>USDC BALANCE</div>
              {balanceLoading
                ? <div className="space-y-2"><SkeletonBox h="h-8" w="w-24" /><SkeletonBox h="h-3" w="w-32" /></div>
                : <>
                    <div className="text-3xl font-light text-white" style={{letterSpacing:'-1px'}}>${balanceFormatted}</div>
                    <div className="text-xs mt-1 font-bold" style={{color:'#c9a84c'}}>Arc Testnet · Live</div>
                  </>
              }
            </div>
            <div className="border rounded-xl p-4" style={{background:'#0e0e0e', borderColor:'#1a1a1a'}}>
              <div className="text-xs font-bold tracking-wider mb-3" style={{color:'#444'}}>ANALYTICS</div>
              <div className="grid grid-cols-2 gap-2 mb-3">
                <div className="rounded-lg p-2" style={{background:'#080808'}}>
                  <div className="text-xs" style={{color:'#444'}}>Total sent</div>
                  <div className="text-sm font-bold" style={{color:'#c9a84c'}}>${totalPaid.toFixed(2)}</div>
                </div>
                <div className="rounded-lg p-2" style={{background:'#080808'}}>
                  <div className="text-xs" style={{color:'#444'}}>Transactions</div>
                  <div className="text-sm font-bold text-white">{transactions.length}</div>
                </div>
              </div>
              {transactions.length > 0 && (
                <div>
                  <div className="text-xs mb-2" style={{color:'#333'}}>Recent volume</div>
                  <div className="flex items-end gap-1 h-10">
                    {transactions.slice(-7).map((t, i) => {
                      const maxAmt = Math.max(...transactions.slice(-7).map(x => parseFloat(x.amount || '0')))
                      const h = maxAmt > 0 ? Math.max(4, (parseFloat(t.amount || '0') / maxAmt) * 36) : 4
                      return <div key={i} style={{height: h, background: i === transactions.slice(-7).length - 1 ? '#c9a84c' : '#1a1500'}}
                        className="flex-1 rounded-sm transition-colors cursor-pointer" title={`$${t.amount}`}></div>
                    })}
                  </div>
                </div>
              )}
            </div>
            <div className="border rounded-xl p-4" style={{background:'#0e0e0e', borderColor:'#1a1a1a'}}>
              <div className="text-xs font-bold tracking-wider mb-3" style={{color:'#444'}}>HOLDINGS</div>
              {balanceLoading
                ? <div className="flex items-center gap-2"><SkeletonBox w="w-8" h="h-8" /><div className="flex-1 space-y-1"><SkeletonBox h="h-3" /><SkeletonBox h="h-3" w="w-16" /></div></div>
                : <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold"
                        style={{background:'linear-gradient(135deg,#c9a84c,#a07830)', color:'#000'}}>$</div>
                      <div><div className="text-sm font-medium text-white">USDC</div><div className="text-xs" style={{color:'#444'}}>Arc Testnet</div></div>
                    </div>
                    <div className="text-sm font-bold" style={{color:'#c9a84c'}}>${balanceFormatted}</div>
                  </div>
              }
            </div>
            <div className="border rounded-xl p-4" style={{background:'#0e0e0e', borderColor:'#1a1a1a'}}>
              <div className="text-xs font-bold tracking-wider mb-3" style={{color:'#444'}}>TOOLS</div>
              <div className="flex flex-col gap-2">
                {[
                  { href: 'https://faucet.circle.com', icon: '🚰', title: 'Get Test USDC', sub: 'faucet.circle.com', gold: true },
                  { href: 'https://thirdweb.com/arc-testnet', icon: '⚙️', title: 'Network Setup', sub: 'Arc Testnet', gold: false },
                  { href: 'https://testnet.arcscan.app', icon: '🔍', title: 'ArcScan Explorer', sub: 'Track transactions', gold: false },
                ].map(item => (
                  <a key={item.href} href={item.href} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-2 px-3 py-2 border rounded-lg hover:border-yellow-900 transition-colors"
                    style={{background: item.gold ? '#1a1500' : '#080808', borderColor: item.gold ? '#2a2500' : '#141414'}}>
                    <span className="text-sm">{item.icon}</span>
                    <div className="flex-1">
                      <div className="text-xs font-medium" style={{color: item.gold ? '#c9a84c' : '#888'}}>{item.title}</div>
                      <div className="text-xs" style={{color:'#333'}}>{item.sub}</div>
                    </div>
                    <span className="text-xs" style={{color:'#222'}}>↗</span>
                  </a>
                ))}
              </div>
            </div>
            <div className="border rounded-xl p-4 flex-1" style={{background:'#0e0e0e', borderColor:'#1a1a1a'}}>
              <div className="flex justify-between items-center mb-3">
                <div className="text-xs font-bold tracking-wider" style={{color:'#444'}}>ACTIVITY</div>
                <div className="flex gap-2 items-center">
                  <a href="https://testnet.arcscan.app" target="_blank" rel="noopener noreferrer" className="text-xs" style={{color:'#333'}}>ArcScan</a>
                  <span style={{color:'#222'}}>·</span>
                  <Link href="/history" className="text-xs" style={{color:'#333'}}>All txns</Link>
                </div>
              </div>
              {transactions.length === 0
                ? <div className="text-center text-sm py-4" style={{color:'#333'}}>No transactions yet</div>
                : <div className="space-y-3">
                    {transactions.slice(0, 5).map(t => (
                      <div key={t.id} className="flex items-center justify-between p-1 rounded-lg">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-lg flex items-center justify-center text-xs" style={{background:'#1a1500', color:'#c9a84c'}}>↗</div>
                          <div>
                            <div className="text-xs font-medium text-white">{t.name || 'Send USDC'}</div>
                            <div className="text-xs" style={{color:'#333'}}>confirmed</div>
                          </div>
                        </div>
                        <div className="text-sm font-bold" style={{color:'#c9a84c'}}>-{t.amount}</div>
                      </div>
                    ))}
                  </div>
              }
            </div>
          </div>
        )}
      </div>
    </div>
  )
}