'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import Link from 'next/link'
import Papa from 'papaparse'
import { useAccount, useConnect, useDisconnect, useBalance } from 'wagmi'
import { injected } from 'wagmi/connectors'
import { uploadImageToIPFS, uploadNFTMetadata } from '@/lib/pinata'

interface Recipient {
  id: string
  name: string
  address: string
  amount: string
  status: 'pending' | 'paid'
  txHash?: string
  nftMinted?: boolean
  nftUrl?: string
}

interface Toast {
  id: string
  type: 'success' | 'error' | 'loading'
  message: string
}

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

  const swapAmountOut = swapAmountIn
    ? (parseFloat(swapAmountIn) * (RATES[swapTokenIn]?.[swapTokenOut] || 1)).toFixed(4)
    : '0'
  const priceImpactHigh = parseFloat(swapAmountIn) > 1000

  // ─── TOAST ────────────────────────────────────────────────────
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
      removeToast(tid)
      addToast('success', `Sent ${singleAmount} USDC successfully!`)
    } catch (e: any) {
      removeToast(tid)
      addToast('error', 'Transaction failed: ' + e.message)
    }
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
      removeToast(tid)
      addToast('success', `Bridged ${bridgeAmount} USDC successfully!`)
    } catch (e: any) {
      removeToast(tid)
      addToast('error', 'Bridge failed: ' + e.message)
    }
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
      removeToast(tid)
      addToast('success', `Swapped ${swapAmountIn} ${swapTokenIn} successfully!`)
    } catch (e: any) {
      removeToast(tid)
      addToast('error', 'Swap failed: ' + e.message)
    }
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
    removeToast(tid)
    addToast('success', `${success}/${pending.length} payments sent!`)
    setBatchPaying(false)
  }

  const downloadTemplate = () => {
    const csv = 'name,address,amount\nJohn Doe,0x1234567890123456789012345678901234567890,100'
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = 'template.csv'; a.click()
  }

  const handleNFTImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setNftImagePreview(URL.createObjectURL(file))
    setUploadingImage(true)
    const tid = addToast('loading', 'Uploading image to IPFS...')
    try {
      const url = await uploadImageToIPFS(file)
      setNftImageUrl(url)
      removeToast(tid)
      addToast('success', 'Image uploaded to IPFS!')
    } catch (e: any) {
      removeToast(tid)
      addToast('error', 'Upload failed: ' + e.message)
    }
    setUploadingImage(false)
  }

  const totalPaid = transactions.reduce((s, t) => s + parseFloat(t.amount || '0'), 0)
  const pendingCount = recipients.filter(r => r.status === 'pending').length
  const showSidePanel = tab === 'send' || tab === 'nft' || tab === 'bridge' || tab === 'swap'
  const balanceFormatted = balanceLoading ? null : usdcBalance ? (Number(usdcBalance.value) / 1e18).toFixed(2) : '0.00'

  const TAB_LABELS: Record<Tab, string> = { send: 'Send', batch: 'Batch', nft: 'NFT Receipt', bridge: 'Bridge', swap: 'Swap' }

  const Spinner = () => (
    <span className="inline-block w-4 h-4 border-2 border-gray-400 border-t-black rounded-full animate-spin"></span>
  )

  const SkeletonBox = ({ w = 'w-full', h = 'h-4' }: { w?: string; h?: string }) => (
    <div className={`${w} ${h} bg-gray-800 rounded animate-pulse`}></div>
  )

  const TxBox = ({ result }: { result: { txHash: string; explorerUrl?: string } }) => (
    <div className="rounded-xl p-4 bg-gray-800 border-l-4 border-green-500 animate-in fade-in slide-in-from-bottom-2">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-green-400 text-sm font-bold">✓ Transaction confirmed</span>
      </div>
      <p className="text-xs text-gray-400 font-mono truncate">{result.txHash}</p>
      {result.explorerUrl && (
        <a href={result.explorerUrl} target="_blank" rel="noopener noreferrer" className="text-green-400 text-xs hover:underline mt-1 block">
          View on ArcScan →
        </a>
      )}
    </div>
  )

  if (!isConnected) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center px-4">
        <div className="text-center w-full max-w-sm">
          <div className="text-6xl mb-6">🌐</div>
          <h1 className="text-3xl md:text-4xl font-bold text-white mb-4">Arc Global Payouts</h1>
          <p className="text-gray-400 mb-8 text-sm">Global USDC payment platform on Arc Network</p>
          <div className="flex flex-col gap-3 mb-8 text-left">
            <p className="text-xs text-gray-600 text-center mb-1">First time? Complete these steps:</p>
            <a href="https://thirdweb.com/arc-testnet" target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-3 bg-gray-900 border border-gray-800 rounded-xl px-4 py-3 hover:border-gray-600 transition-colors">
              <span className="text-lg">⚙️</span>
              <div><div className="text-sm font-medium text-white">1. Add Arc Testnet</div><div className="text-xs text-gray-500">Auto-add to MetaMask</div></div>
              <span className="ml-auto text-gray-600 text-xs">↗</span>
            </a>
            <a href="https://faucet.circle.com" target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-3 bg-gray-900 border border-gray-800 rounded-xl px-4 py-3 hover:border-gray-600 transition-colors">
              <span className="text-lg">🚰</span>
              <div><div className="text-sm font-medium text-white">2. Get Test USDC</div><div className="text-xs text-gray-500">Free from Circle Faucet</div></div>
              <span className="ml-auto text-gray-600 text-xs">↗</span>
            </a>
          </div>
          <button onClick={connectWallet} className="w-full px-8 py-4 bg-white text-black rounded-xl font-bold text-lg hover:bg-gray-100 active:scale-95 transition-all">
            3. Connect Wallet
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-black text-white flex flex-col">

      {/* TOAST NOTIFICATIONS */}
      <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 pointer-events-none">
        {toasts.map(t => (
          <div key={t.id} className={`flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg text-sm font-medium pointer-events-auto transition-all animate-in slide-in-from-right-4 fade-in ${
            t.type === 'success' ? 'bg-green-900 border border-green-700 text-green-300' :
            t.type === 'error'   ? 'bg-red-900 border border-red-700 text-red-300' :
                                   'bg-gray-900 border border-gray-700 text-gray-300'
          }`}>
            <span>{t.type === 'success' ? '✓' : t.type === 'error' ? '✕' : <Spinner />}</span>
            <span>{t.message}</span>
            <button onClick={() => removeToast(t.id)} className="ml-2 text-xs opacity-60 hover:opacity-100">✕</button>
          </div>
        ))}
      </div>

      {/* NAVBAR */}
      <nav className="border-b border-gray-800 px-4 md:px-6 py-4 flex justify-between items-center">
        <div className="flex items-center gap-2">
          <span className="text-xl">🌐</span>
          <div>
            <div className="font-bold text-sm">Arc Global Payouts</div>
            <div className="text-xs text-gray-500 hidden md:block">ARC NETWORK</div>
          </div>
        </div>

        {/* Desktop nav */}
        <div className="hidden md:flex items-center gap-3">
          <a href="https://thirdweb.com/arc-testnet" target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-2 bg-gray-900 rounded-full px-3 py-1 hover:bg-gray-800 transition-colors">
            <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
            <span className="text-xs">Arc Testnet</span>
            <span className="text-xs text-gray-600">⚙</span>
          </a>
          <div className="bg-gray-900 rounded-full px-3 py-1 text-xs">USDC</div>
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-purple-500 rounded-full"></div>
            <span className="text-xs text-gray-400">{address?.slice(0,6)}...{address?.slice(-4)}</span>
          </div>
          <Link href="/history" className="text-xs text-gray-400 hover:text-white transition-colors">History</Link>
          <div className="relative">
            <button onClick={() => setShowHelp(!showHelp)}
              className="w-6 h-6 rounded-full bg-gray-800 border border-gray-700 text-xs text-gray-400 hover:text-white hover:border-gray-500 transition-colors flex items-center justify-center">?</button>
            {showHelp && (
              <div className="absolute right-0 top-8 w-64 bg-gray-900 border border-gray-700 rounded-xl shadow-2xl z-50 p-3">
                <div className="text-xs text-gray-400 font-medium mb-3 px-1">🛠 Developer Tools</div>
                <div className="flex flex-col gap-1">
                  {[
                    { href: 'https://faucet.circle.com', icon: '🚰', title: 'Test USDC Faucet', sub: 'faucet.circle.com' },
                    { href: 'https://thirdweb.com/arc-testnet', icon: '⚙️', title: 'Arc Testnet Setup', sub: 'thirdweb.com/arc-testnet' },
                    { href: 'https://testnet.arcscan.app', icon: '🔍', title: 'ArcScan Explorer', sub: 'testnet.arcscan.app' },
                  ].map(item => (
                    <a key={item.href} href={item.href} target="_blank" rel="noopener noreferrer" onClick={() => setShowHelp(false)}
                      className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-gray-800 transition-colors">
                      <span className="text-sm">{item.icon}</span>
                      <div><div className="text-sm font-medium text-white">{item.title}</div><div className="text-xs text-gray-500">{item.sub}</div></div>
                    </a>
                  ))}
                </div>
                <div className="border-t border-gray-800 mt-2 pt-2 px-1">
                  <div className="text-xs text-gray-600">Arc Global Payouts v1.0</div>
                </div>
              </div>
            )}
          </div>
          <button onClick={() => disconnect()} className="text-xs text-gray-500 hover:text-red-400 transition-colors">Disconnect</button>
        </div>

        {/* Mobile hamburger */}
        <button className="md:hidden flex flex-col gap-1.5 p-2" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
          <span className={`block w-5 h-0.5 bg-white transition-all ${mobileMenuOpen ? 'rotate-45 translate-y-2' : ''}`}></span>
          <span className={`block w-5 h-0.5 bg-white transition-all ${mobileMenuOpen ? 'opacity-0' : ''}`}></span>
          <span className={`block w-5 h-0.5 bg-white transition-all ${mobileMenuOpen ? '-rotate-45 -translate-y-2' : ''}`}></span>
        </button>
      </nav>

      {/* Mobile menu */}
      {mobileMenuOpen && (
        <div className="md:hidden bg-gray-950 border-b border-gray-800 px-4 py-4 flex flex-col gap-3">
          <div className="flex items-center gap-2 text-sm">
            <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
            <span className="text-gray-300">Arc Testnet</span>
            <span className="ml-auto text-gray-400 text-xs font-mono">{address?.slice(0,6)}...{address?.slice(-4)}</span>
          </div>
          <div className="flex flex-col gap-2">
            <a href="https://faucet.circle.com" target="_blank" rel="noopener noreferrer" className="text-sm text-gray-400 hover:text-white py-1">🚰 Get Test USDC</a>
            <a href="https://thirdweb.com/arc-testnet" target="_blank" rel="noopener noreferrer" className="text-sm text-gray-400 hover:text-white py-1">⚙️ Network Setup</a>
            <a href="https://testnet.arcscan.app" target="_blank" rel="noopener noreferrer" className="text-sm text-gray-400 hover:text-white py-1">🔍 ArcScan Explorer</a>
            <Link href="/history" className="text-sm text-gray-400 hover:text-white py-1">📋 Transaction History</Link>
          </div>
          <button onClick={() => disconnect()} className="text-sm text-red-400 hover:text-red-300 text-left py-1">Disconnect Wallet</button>
        </div>
      )}

      {/* TABS */}
      <div className="border-b border-gray-800 px-4 md:px-6 overflow-x-auto">
        <div className="flex gap-4 md:gap-6 min-w-max">
          {(['send', 'batch', 'nft', 'bridge', 'swap'] as Tab[]).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`py-3 text-sm font-medium transition-all border-b-2 whitespace-nowrap ${tab === t ? 'text-white border-white' : 'text-gray-500 border-transparent hover:text-gray-300'}`}>
              {TAB_LABELS[t]}
            </button>
          ))}
        </div>
      </div>

      {/* CONTENT */}
      <div className="flex flex-1 flex-col md:flex-row" onClick={() => showHelp && setShowHelp(false)}>

        {showSidePanel && (
          <div className="flex-1 flex items-start justify-center p-4 md:p-8">
            <div className="w-full max-w-md bg-gray-900 rounded-2xl border border-gray-800 p-5 md:p-6">

              {/* SEND */}
              {tab === 'send' && (
                <div className="space-y-4">
                  <div>
                    <label className="text-xs text-gray-400 mb-1 block">YOU PAY</label>
                    <div className="flex items-center gap-3 bg-gray-800 rounded-xl p-4 focus-within:ring-1 focus-within:ring-gray-600 transition-all">
                      <input type="number" value={singleAmount} onChange={e => setSingleAmount(e.target.value)} placeholder="0" className="bg-transparent text-3xl font-bold flex-1 outline-none" />
                      <div className="flex items-center gap-2 bg-gray-700 rounded-full px-3 py-1">
                        <span className="text-blue-400">●</span><span className="text-sm font-medium">USDC</span>
                      </div>
                    </div>
                    <div className="text-xs text-gray-500 mt-1 px-1">Arc Testnet</div>
                  </div>
                  <div className="flex justify-center">
                    <div className="w-8 h-8 bg-gray-800 rounded-full flex items-center justify-center text-gray-400">↓</div>
                  </div>
                  <div>
                    <label className="text-xs text-gray-400 mb-1 block">TO</label>
                    <input type="text" value={singleAddress} onChange={e => setSingleAddress(e.target.value)} placeholder="0x..." className="w-full bg-gray-800 rounded-xl p-4 text-sm outline-none placeholder-gray-600 focus:ring-1 focus:ring-gray-600 transition-all" />
                    <div className="text-xs text-gray-500 mt-1 px-1">Arc Testnet</div>
                  </div>
                  {singleAmount && (
                    <div className="bg-gray-800 rounded-xl p-3 space-y-2 text-sm">
                      <div className="flex justify-between text-gray-400"><span>Network fee</span><span>~0.009 USDC</span></div>
                      <div className="flex justify-between text-gray-400"><span>Rate</span><span>1 USDC = 1 USDC</span></div>
                      <div className="flex justify-between font-bold"><span>Total sent</span><span>{singleAmount} USDC</span></div>
                    </div>
                  )}
                  <button onClick={sendSingle} disabled={paying}
                    className="w-full py-4 bg-white text-black rounded-xl font-bold hover:bg-gray-100 active:scale-95 disabled:opacity-50 transition-all">
                    {paying ? <span className="flex items-center justify-center gap-2"><Spinner />Sending...</span> : 'Confirm transfer'}
                  </button>
                  {txResult && <TxBox result={txResult} />}
                  <div className="text-center text-xs text-gray-600">Arc Testnet · sub-second finality · Powered by Arc App Kit</div>
                </div>
              )}

              {/* NFT */}
              {tab === 'nft' && (
                <div className="space-y-4">
                  <h2 className="font-bold text-lg">🎨 NFT Receipt Image</h2>
                  <p className="text-gray-400 text-sm">This image will be minted as an NFT receipt after each payment.</p>
                  <div className="border-2 border-dashed border-gray-700 rounded-xl p-8 text-center hover:border-gray-600 transition-colors">
                    {nftImagePreview ? <img src={nftImagePreview} alt="NFT" className="w-32 h-32 rounded-xl object-cover mx-auto mb-3" /> : <div className="text-4xl mb-3">🎨</div>}
                    <button onClick={() => nftImageRef.current?.click()} disabled={uploadingImage}
                      className="px-4 py-2 bg-purple-600 rounded-lg text-sm hover:bg-purple-700 active:scale-95 disabled:opacity-50 transition-all">
                      {uploadingImage ? <span className="flex items-center gap-2"><Spinner />Uploading...</span> : nftImageUrl ? '✅ Image Uploaded' : 'Select Image'}
                    </button>
                    <input ref={nftImageRef} type="file" accept="image/*" onChange={handleNFTImageSelect} className="hidden" />
                  </div>
                  {nftImageUrl && <div className="bg-green-900/30 border border-green-800 rounded-lg p-3 text-sm text-green-400">✅ Uploaded to IPFS — payments will include this NFT receipt</div>}
                </div>
              )}

              {/* BRIDGE */}
              {tab === 'bridge' && (
                <div className="space-y-4">
                  <div>
                    <label className="text-xs text-gray-400 mb-2 block">FROM</label>
                    <div className="grid grid-cols-3 gap-2">
                      {CHAINS.filter(c => c.id !== bridgeTo).map(chain => (
                        <button key={chain.id} onClick={() => setBridgeFrom(chain.id)}
                          className={`py-2 px-2 rounded-xl text-xs font-medium border transition-all active:scale-95 ${bridgeFrom === chain.id ? 'border-white text-white bg-gray-700' : 'border-gray-700 text-gray-400 hover:border-gray-500'}`}>
                          <div className={`w-2 h-2 rounded-full ${chain.dot} inline-block mr-1`}></div>
                          {chain.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="text-xs text-gray-400 mb-1 block">YOU SEND</label>
                    <div className="flex items-center gap-3 bg-gray-800 rounded-xl p-4 focus-within:ring-1 focus-within:ring-gray-600 transition-all">
                      <input type="number" value={bridgeAmount} onChange={e => setBridgeAmount(e.target.value)} placeholder="0" className="bg-transparent text-3xl font-bold flex-1 outline-none" />
                      <div className="flex items-center gap-2 bg-gray-700 rounded-full px-3 py-1">
                        <span className="text-blue-400">●</span><span className="text-sm font-medium">USDC</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 mt-1 px-1">
                      <div className={`w-2 h-2 rounded-full ${CHAINS.find(c => c.id === bridgeFrom)?.dot}`}></div>
                      <span className="text-xs text-gray-500">{CHAINS.find(c => c.id === bridgeFrom)?.label}</span>
                    </div>
                  </div>
                  <div className="flex justify-center">
                    <button onClick={flipBridge} className="w-10 h-10 bg-gray-800 border border-gray-700 rounded-full flex items-center justify-center text-gray-400 hover:text-white hover:bg-gray-700 hover:border-gray-500 active:scale-95 transition-all text-lg">⇅</button>
                  </div>
                  <div>
                    <label className="text-xs text-gray-400 mb-2 block">TO</label>
                    <div className="grid grid-cols-3 gap-2">
                      {CHAINS.filter(c => c.id !== bridgeFrom).map(chain => (
                        <button key={chain.id} onClick={() => setBridgeTo(chain.id)}
                          className={`py-2 px-2 rounded-xl text-xs font-medium border transition-all active:scale-95 ${bridgeTo === chain.id ? 'border-white text-white bg-gray-700' : 'border-gray-700 text-gray-400 hover:border-gray-500'}`}>
                          <div className={`w-2 h-2 rounded-full ${chain.dot} inline-block mr-1`}></div>
                          {chain.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="text-xs text-gray-400 mb-1 block">YOU RECEIVE</label>
                    <div className="flex items-center gap-3 bg-gray-800 rounded-xl p-4">
                      <span className="text-3xl font-bold flex-1 text-gray-500">{bridgeAmount || '0'}</span>
                      <div className="flex items-center gap-2 bg-gray-700 rounded-full px-3 py-1">
                        <span className="text-blue-400">●</span><span className="text-sm font-medium">USDC</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 mt-1 px-1">
                      <div className={`w-2 h-2 rounded-full ${CHAINS.find(c => c.id === bridgeTo)?.dot}`}></div>
                      <span className="text-xs text-gray-500">{CHAINS.find(c => c.id === bridgeTo)?.label}</span>
                    </div>
                  </div>
                  {bridgeAmount && (
                    <div className="bg-gray-800 rounded-xl p-3 space-y-2 text-sm">
                      <div className="flex justify-between text-gray-400"><span>From</span><span>{CHAINS.find(c => c.id === bridgeFrom)?.label}</span></div>
                      <div className="flex justify-between text-gray-400"><span>To</span><span>{CHAINS.find(c => c.id === bridgeTo)?.label}</span></div>
                      <div className="flex justify-between text-gray-400"><span>Bridge fee</span><span>~0.01 USDC</span></div>
                      <div className="flex justify-between font-bold"><span>You receive</span><span>{bridgeAmount} USDC</span></div>
                    </div>
                  )}
                  <button onClick={sendBridge} disabled={bridgePaying}
                    className="w-full py-4 bg-white text-black rounded-xl font-bold hover:bg-gray-100 active:scale-95 disabled:opacity-50 transition-all">
                    {bridgePaying ? <span className="flex items-center justify-center gap-2"><Spinner />Bridging...</span> : 'Confirm bridge'}
                  </button>
                  {bridgeResult && <TxBox result={bridgeResult} />}
                  <div className="text-center text-xs text-gray-600">{CHAINS.find(c=>c.id===bridgeFrom)?.label} → {CHAINS.find(c=>c.id===bridgeTo)?.label} · USDC · Powered by Arc App Kit</div>
                </div>
              )}

              {/* SWAP */}
              {tab === 'swap' && (
                <div className="space-y-4">
                  <div>
                    <label className="text-xs text-gray-400 mb-1 block">YOU PAY</label>
                    <div className="flex items-center gap-3 bg-gray-800 rounded-xl p-4 focus-within:ring-1 focus-within:ring-gray-600 transition-all">
                      <input type="number" value={swapAmountIn} onChange={e => setSwapAmountIn(e.target.value)} placeholder="0" className="bg-transparent text-3xl font-bold flex-1 outline-none" />
                      <select value={swapTokenIn} onChange={e => setSwapTokenIn(e.target.value)}
                        className="bg-gray-700 border border-gray-600 rounded-full px-3 py-1 text-sm font-medium outline-none cursor-pointer hover:bg-gray-600 transition-colors">
                        {TOKENS.filter(t => t !== swapTokenOut).map(t => <option key={t} value={t}>{t}</option>)}
                      </select>
                    </div>
                    <div className="text-xs text-gray-500 mt-1 px-1">Arc Testnet</div>
                  </div>
                  <div className="flex justify-center">
                    <button onClick={flipSwap} className="w-10 h-10 bg-gray-800 border border-gray-700 rounded-full flex items-center justify-center text-gray-400 hover:text-white hover:bg-gray-700 active:scale-95 transition-all text-lg">⇅</button>
                  </div>
                  <div>
                    <label className="text-xs text-gray-400 mb-1 block">YOU RECEIVE</label>
                    <div className="flex items-center gap-3 bg-gray-800 rounded-xl p-4">
                      <span className="text-3xl font-bold flex-1 text-gray-500">{swapAmountOut}</span>
                      <select value={swapTokenOut} onChange={e => setSwapTokenOut(e.target.value)}
                        className="bg-gray-700 border border-gray-600 rounded-full px-3 py-1 text-sm font-medium outline-none cursor-pointer hover:bg-gray-600 transition-colors">
                        {TOKENS.filter(t => t !== swapTokenIn).map(t => <option key={t} value={t}>{t}</option>)}
                      </select>
                    </div>
                    <div className="text-xs text-gray-500 mt-1 px-1">Arc Testnet</div>
                  </div>

                  {/* Slippage */}
                  <div>
                    <label className="text-xs text-gray-400 mb-2 block">SLIPPAGE TOLERANCE</label>
                    <div className="flex gap-2 items-center flex-wrap">
                      {['0.5', '1', '3'].map(s => (
                        <button key={s} onClick={() => setSwapSlippage(s)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all active:scale-95 ${swapSlippage === s ? 'border-white text-white bg-gray-700' : 'border-gray-700 text-gray-400 hover:border-gray-500'}`}>
                          {s}%
                        </button>
                      ))}
                      <input type="number" placeholder="Custom" value={['0.5','1','3'].includes(swapSlippage) ? '' : swapSlippage}
                        onChange={e => setSwapSlippage(e.target.value)}
                        className="w-20 bg-gray-800 border border-gray-700 rounded-lg px-2 py-1.5 text-xs outline-none focus:border-gray-500 transition-colors" />
                      {priceImpactHigh && (
                        <span className="text-xs text-red-400 font-medium">⚠ High impact</span>
                      )}
                    </div>
                  </div>

                  {swapAmountIn && (
                    <div className="bg-gray-800 rounded-xl p-3 space-y-2 text-sm">
                      <div className="flex justify-between text-gray-400"><span>Rate</span><span>1 {swapTokenIn} = {(RATES[swapTokenIn]?.[swapTokenOut] || 1).toFixed(4)} {swapTokenOut}</span></div>
                      <div className="flex justify-between text-gray-400"><span>Price impact</span><span className={priceImpactHigh ? 'text-red-400' : 'text-green-400'}>{priceImpactHigh ? '> 2%' : '< 0.1%'}</span></div>
                      <div className="flex justify-between text-gray-400"><span>Slippage</span><span>{swapSlippage}%</span></div>
                      <div className="flex justify-between text-gray-400"><span>Network fee</span><span>~0.009 USDC</span></div>
                      <div className="flex justify-between font-bold border-t border-gray-700 pt-2"><span>Min. received</span><span>{(parseFloat(swapAmountOut) * (1 - parseFloat(swapSlippage)/100)).toFixed(4)} {swapTokenOut}</span></div>
                    </div>
                  )}

                  {/* Route */}
                  <div className="bg-gray-800/50 rounded-xl p-3">
                    <div className="text-xs text-gray-500 mb-2">ROUTE</div>
                    <div className="flex items-center gap-2 text-xs flex-wrap">
                      <span className="bg-gray-800 border border-gray-700 rounded-lg px-2 py-1 font-medium">{swapTokenIn}</span>
                      <span className="text-gray-600">→</span>
                      <span className="bg-gray-800 border border-green-900 text-green-400 rounded-lg px-2 py-1 font-medium">Arc Pool</span>
                      <span className="text-gray-600">→</span>
                      <span className="bg-gray-800 border border-gray-700 rounded-lg px-2 py-1 font-medium">{swapTokenOut}</span>
                    </div>
                    <div className="text-xs text-gray-600 mt-2">Best route · Arc DEX · 0.3% fee</div>
                  </div>

                  <button onClick={sendSwap} disabled={swapPaying}
                    className="w-full py-4 bg-white text-black rounded-xl font-bold hover:bg-gray-100 active:scale-95 disabled:opacity-50 transition-all">
                    {swapPaying ? <span className="flex items-center justify-center gap-2"><Spinner />Swapping...</span> : 'Confirm swap'}
                  </button>
                  {swapResult && <TxBox result={swapResult} />}
                  <div className="text-center text-xs text-gray-600">Arc Testnet · {swapTokenIn} → {swapTokenOut} · Slippage {swapSlippage}% · Powered by Arc App Kit</div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* BATCH */}
        {tab === 'batch' && (
          <div className="flex-1 p-4 md:p-6">
            <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-3 mb-4">
              <h2 className="text-xl font-bold">Batch Payout</h2>
              <div className="flex gap-2 flex-wrap">
                <button onClick={downloadTemplate} className="px-3 py-2 bg-gray-800 rounded-lg text-sm hover:bg-gray-700 active:scale-95 transition-all">📥 Template</button>
                <button onClick={() => fileRef.current?.click()} className="px-3 py-2 bg-gray-800 rounded-lg text-sm hover:bg-gray-700 active:scale-95 transition-all">📤 Import CSV</button>
                <input ref={fileRef} type="file" accept=".csv" onChange={importCSV} className="hidden" />
                {pendingCount > 0 && (
                  <button onClick={sendBatch} disabled={batchPaying} className="px-3 py-2 bg-white text-black rounded-lg text-sm font-bold hover:bg-gray-100 active:scale-95 disabled:opacity-50 transition-all">
                    {batchPaying ? <span className="flex items-center gap-2"><Spinner />Sending...</span> : `🚀 Send to ${pendingCount}`}
                  </button>
                )}
              </div>
            </div>
            <div className="bg-gray-900 rounded-xl border border-gray-800 p-4 mb-4">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Full name" className="bg-gray-800 rounded-lg px-3 py-2 text-sm outline-none placeholder-gray-600" />
                <input value={newAddress} onChange={e => setNewAddress(e.target.value)} placeholder="0x..." className="bg-gray-800 rounded-lg px-3 py-2 text-sm outline-none placeholder-gray-600 md:col-span-2" />
                <div className="flex gap-2">
                  <input value={newAmount} onChange={e => setNewAmount(e.target.value)} placeholder="USDC" type="number" className="bg-gray-800 rounded-lg px-3 py-2 text-sm outline-none placeholder-gray-600 flex-1" />
                  <button onClick={addRecipient} className="px-4 py-2 bg-blue-600 rounded-lg text-sm hover:bg-blue-700 active:scale-95 transition-all font-bold">+</button>
                </div>
              </div>
            </div>
            <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden overflow-x-auto">
              {recipients.length === 0 ? (
                <div className="p-12 text-center text-gray-600">
                  <div className="text-4xl mb-3">👥</div>
                  <p>No recipients yet</p>
                  <p className="text-sm mt-1">Add manually or import CSV</p>
                </div>
              ) : (
                <table className="w-full min-w-[600px]">
                  <thead className="border-b border-gray-800">
                    <tr>
                      {['NAME','ADDRESS','AMOUNT','STATUS','NFT','TX'].map(h => (
                        <th key={h} className="text-left p-4 text-xs text-gray-400">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {recipients.map(r => (
                      <tr key={r.id} className="border-b border-gray-800 hover:bg-gray-800/50 transition-colors">
                        <td className="p-4 text-sm font-medium">{r.name}</td>
                        <td className="p-4 text-sm text-gray-400 font-mono">{r.address.slice(0,6)}...{r.address.slice(-4)}</td>
                        <td className="p-4 text-sm font-bold">{r.amount} USDC</td>
                        <td className="p-4">
                          <span className={`px-2 py-1 rounded text-xs ${r.status === 'paid' ? 'bg-green-900 text-green-400' : 'bg-yellow-900 text-yellow-400'}`}>
                            {r.status === 'paid' ? '✅ Paid' : '⏳ Pending'}
                          </span>
                        </td>
                        <td className="p-4">{r.nftUrl ? <a href={r.nftUrl} target="_blank" rel="noopener noreferrer" className="text-purple-400 text-xs hover:underline">View</a> : <span className="text-gray-600 text-xs">—</span>}</td>
                        <td className="p-4">{r.txHash ? <a href={`https://testnet.arcscan.app/tx/${r.txHash}`} target="_blank" rel="noopener noreferrer" className="text-blue-400 text-xs hover:underline">Explorer</a> : <span className="text-gray-600 text-xs">—</span>}</td>
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
          <div className="w-full md:w-72 border-t md:border-t-0 md:border-l border-gray-800 p-4 md:p-5 flex flex-col gap-4">

            {/* Balance */}
            <div className="bg-gray-900 rounded-xl p-4 border border-gray-800">
              <div className="text-xs text-gray-400 mb-1">USDC BALANCE</div>
              {balanceLoading ? (
                <div className="space-y-2 mt-1"><SkeletonBox h="h-8" w="w-24" /><SkeletonBox h="h-3" w="w-32" /></div>
              ) : (
                <>
                  <div className="text-3xl font-bold">${balanceFormatted}</div>
                  <div className="text-xs text-blue-400 mt-1">Arc Testnet · Live balance</div>
                </>
              )}
            </div>

            {/* Analytics */}
            <div className="bg-gray-900 rounded-xl p-4 border border-gray-800">
              <div className="text-xs text-gray-400 mb-3">ANALYTICS</div>
              <div className="grid grid-cols-2 gap-2 mb-3">
                <div className="bg-gray-800 rounded-lg p-2">
                  <div className="text-xs text-gray-500">Total sent</div>
                  <div className="text-sm font-bold">${totalPaid.toFixed(2)}</div>
                </div>
                <div className="bg-gray-800 rounded-lg p-2">
                  <div className="text-xs text-gray-500">Transactions</div>
                  <div className="text-sm font-bold">{transactions.length}</div>
                </div>
              </div>
              {/* Mini bar chart */}
              {transactions.length > 0 && (
                <div>
                  <div className="text-xs text-gray-600 mb-2">Recent volume</div>
                  <div className="flex items-end gap-1 h-10">
                    {transactions.slice(-7).map((t, i) => {
                      const maxAmt = Math.max(...transactions.slice(-7).map(x => parseFloat(x.amount || '0')))
                      const h = maxAmt > 0 ? Math.max(4, (parseFloat(t.amount || '0') / maxAmt) * 36) : 4
                      return <div key={i} style={{ height: h }} className="flex-1 bg-gray-600 rounded-sm hover:bg-gray-400 transition-colors cursor-pointer" title={`$${t.amount}`}></div>
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Holdings */}
            <div className="bg-gray-900 rounded-xl p-4 border border-gray-800">
              <div className="text-xs text-gray-400 mb-3">HOLDINGS</div>
              {balanceLoading ? (
                <div className="flex items-center gap-2"><SkeletonBox w="w-8" h="h-8" /><div className="flex-1 space-y-1"><SkeletonBox h="h-3" /><SkeletonBox h="h-3" w="w-16" /></div></div>
              ) : (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-xs font-bold">$</div>
                    <div><div className="text-sm font-medium">USDC</div><div className="text-xs text-gray-500">Arc Testnet</div></div>
                  </div>
                  <div className="text-sm font-medium">${balanceFormatted}</div>
                </div>
              )}
            </div>

            {/* Tools */}
            <div className="bg-gray-900 rounded-xl p-4 border border-gray-800">
              <div className="text-xs text-gray-400 mb-3">TOOLS</div>
              <div className="flex flex-col gap-2">
                {[
                  { href: 'https://faucet.circle.com', icon: '🚰', title: 'Get Test USDC', sub: 'faucet.circle.com', accent: true },
                  { href: 'https://thirdweb.com/arc-testnet', icon: '⚙️', title: 'Network Setup', sub: 'Arc Testnet', accent: false },
                  { href: 'https://testnet.arcscan.app', icon: '🔍', title: 'ArcScan Explorer', sub: 'Track transactions', accent: false },
                ].map(item => (
                  <a key={item.href} href={item.href} target="_blank" rel="noopener noreferrer"
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors ${item.accent ? 'bg-blue-900/30 border border-blue-800/50 hover:bg-blue-900/50' : 'bg-gray-800 border border-gray-700 hover:bg-gray-700'}`}>
                    <span className="text-sm">{item.icon}</span>
                    <div className="flex-1">
                      <div className={`text-xs font-medium ${item.accent ? 'text-blue-300' : 'text-gray-300'}`}>{item.title}</div>
                      <div className="text-xs text-gray-500">{item.sub}</div>
                    </div>
                    <span className="text-gray-600 text-xs">↗</span>
                  </a>
                ))}
              </div>
            </div>

            {/* Activity */}
            <div className="bg-gray-900 rounded-xl p-4 border border-gray-800 flex-1">
              <div className="flex justify-between items-center mb-3">
                <div className="text-xs text-gray-400">ACTIVITY</div>
                <div className="flex gap-2 items-center">
                  <a href="https://testnet.arcscan.app" target="_blank" rel="noopener noreferrer" className="text-xs text-gray-500 hover:text-white transition-colors">ArcScan</a>
                  <span className="text-gray-700">·</span>
                  <Link href="/history" className="text-xs text-gray-500 hover:text-white transition-colors">All txns</Link>
                </div>
              </div>
              {transactions.length === 0 ? (
                <div className="text-center text-gray-600 text-sm py-4">No transactions yet</div>
              ) : (
                <div className="space-y-3">
                  {transactions.slice(0, 5).map(t => (
                    <div key={t.id} className="flex items-center justify-between hover:bg-gray-800/50 rounded-lg p-1 transition-colors">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 bg-red-900 rounded-full flex items-center justify-center text-xs">↗</div>
                        <div>
                          <div className="text-xs font-medium">{t.name || 'Send USDC'}</div>
                          <div className="text-xs text-gray-500">confirmed</div>
                        </div>
                      </div>
                      <div className="text-sm font-medium text-red-400">-{t.amount}</div>
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