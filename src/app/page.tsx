'use client'

import { useState, useRef } from 'react'
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

type Tab = 'send' | 'batch' | 'nft' | 'bridge' | 'swap'

const USDC_ADDRESS_ARC = '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238'

const CHAINS = [
  { id: 'Ethereum_Sepolia', label: 'ETH Sepolia',  dot: 'bg-blue-400' },
  { id: 'Arbitrum_Sepolia', label: 'ARB Sepolia',  dot: 'bg-cyan-400' },
  { id: 'Optimism_Sepolia', label: 'OP Sepolia',   dot: 'bg-red-400'  },
  { id: 'Base_Sepolia',     label: 'Base Sepolia', dot: 'bg-indigo-400' },
  { id: 'Arc_Testnet',      label: 'Arc Testnet',  dot: 'bg-green-400' },
]

export default function Home() {
  const { address, isConnected } = useAccount()
  const { connect } = useConnect()
  const { disconnect } = useDisconnect()

const { data: usdcBalance, isLoading: balanceLoading } = useBalance({ address })
const balanceFormatted = balanceLoading ? null : usdcBalance ? (Number(usdcBalance.value) / 1e18).toFixed(2) : '0.00'

  const [tab, setTab] = useState<Tab>('send')
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

  const [swapAmount, setSwapAmount] = useState('')
  const [swapPaying, setSwapPaying] = useState(false)
  const [swapResult, setSwapResult] = useState<{txHash: string, explorerUrl?: string} | null>(null)
  const [showHelp, setShowHelp] = useState(false)

  const connectWallet = () => connect({ connector: injected() })

  const flipBridge = () => {
    const tmp = bridgeFrom
    setBridgeFrom(bridgeTo)
    setBridgeTo(tmp)
  }

  const handleNFTImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setNftImagePreview(URL.createObjectURL(file))
    setUploadingImage(true)
    try {
      const url = await uploadImageToIPFS(file)
      setNftImageUrl(url)
    } catch (e: any) { alert('Gorsel yuklenemedi: ' + e.message) }
    setUploadingImage(false)
  }

  const saveTransaction = (name: string, addr: string, amount: string, txHash: string, explorerUrl?: string, nftUrl?: string) => {
    const tx = { id: Math.random().toString(36).slice(2), name, address: addr, amount, txHash, explorerUrl, nftUrl, timestamp: new Date().toISOString() }
    setTransactions(prev => [tx, ...prev])
    const stored = localStorage.getItem('arc_transactions')
    const existing = stored ? JSON.parse(stored) : []
    localStorage.setItem('arc_transactions', JSON.stringify([tx, ...existing]))
  }

  const sendSingle = async () => {
    if (!singleAddress || !singleAmount) { alert('Adres ve miktar girin!'); return }
    setPaying(true); setTxResult(null)
    try {
      const { AppKit } = await import('@circle-fin/app-kit')
      const { createViemAdapterFromProvider } = await import('@circle-fin/adapter-viem-v2')
      const kit = new AppKit()
      const adapter = await createViemAdapterFromProvider({ provider: (window as any).ethereum })
      const res = await kit.send({ from: { adapter, chain: 'Arc_Testnet' as never }, to: singleAddress, amount: singleAmount, token: 'USDC' })
      const txHash = (res as any)?.hash || (res as any)?.txHash || ''
      let nftUrl = ''
      if (nftImageUrl) {
        nftUrl = await uploadNFTMetadata('Payment Receipt', `${singleAmount} USDC odeme`, nftImageUrl, [
          { trait_type: 'Amount', value: `${singleAmount} USDC` },
          { trait_type: 'Network', value: 'Arc Testnet' },
        ])
      }
      saveTransaction('Manuel Odeme', singleAddress, singleAmount, txHash, undefined, nftUrl)
      setTxResult({ txHash, explorerUrl: `https://testnet.arcscan.app/tx/${txHash}` })
      setSingleAddress(''); setSingleAmount('')
    } catch (e: any) { alert('Hata: ' + e.message) }
    setPaying(false)
  }

  const sendBridge = async () => {
    if (!bridgeAmount) { alert('Miktar girin!'); return }
    setBridgePaying(true); setBridgeResult(null)
    try {
      const { AppKit } = await import('@circle-fin/app-kit')
      const { createViemAdapterFromProvider } = await import('@circle-fin/adapter-viem-v2')
      const kit = new AppKit()
      const adapter = await createViemAdapterFromProvider({ provider: (window as any).ethereum })
      const res = await kit.bridge({
        from: { adapter, chain: bridgeFrom as never },
        to: { adapter, chain: bridgeTo as never },
        amount: bridgeAmount, token: 'USDC',
      })
      const txHash = (res as any)?.hash || (res as any)?.txHash || ''
      const fromLabel = CHAINS.find(c => c.id === bridgeFrom)?.label || bridgeFrom
      const toLabel = CHAINS.find(c => c.id === bridgeTo)?.label || bridgeTo
      saveTransaction(`Bridge ${fromLabel} to ${toLabel}`, address || '', bridgeAmount, txHash, `https://testnet.arcscan.app/tx/${txHash}`)
      setBridgeResult({ txHash, explorerUrl: `https://testnet.arcscan.app/tx/${txHash}` })
      setBridgeAmount('')
    } catch (e: any) { alert('Hata: ' + e.message) }
    setBridgePaying(false)
  }

  const sendSwap = async () => {
    if (!swapAmount) { alert('Miktar girin!'); return }
    setSwapPaying(true); setSwapResult(null)
    try {
      const { AppKit } = await import('@circle-fin/app-kit')
      const { createViemAdapterFromProvider } = await import('@circle-fin/adapter-viem-v2')
      const kit = new AppKit()
      const adapter = await createViemAdapterFromProvider({ provider: (window as any).ethereum })
      const res = await kit.swap({ from: { adapter, chain: 'Arc_Testnet' as never }, tokenIn: 'USDC', tokenOut: 'EURC', amountIn: swapAmount, config: { slippageBps: 300 } })
      const txHash = (res as any)?.hash || (res as any)?.txHash || ''
      saveTransaction('Swap USDC to EURC', address || '', swapAmount, txHash, `https://testnet.arcscan.app/tx/${txHash}`)
      setSwapResult({ txHash, explorerUrl: `https://testnet.arcscan.app/tx/${txHash}` })
      setSwapAmount('')
    } catch (e: any) { alert('Hata: ' + e.message) }
    setSwapPaying(false)
  }

  const addRecipient = () => {
    if (!newName || !newAddress || !newAmount) { alert('Tum alanlari doldurun!'); return }
    setRecipients([...recipients, { id: Math.random().toString(36).slice(2), name: newName, address: newAddress, amount: newAmount, status: 'pending' }])
    setNewName(''); setNewAddress(''); setNewAmount('')
  }

  const importCSV = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    Papa.parse(file, {
      header: true,
      complete: (results) => {
        const imported = (results.data as any[]).filter(r => r.address && r.amount).map(r => ({
          id: Math.random().toString(36).slice(2), name: r.name || 'Isimsiz', address: r.address, amount: r.amount, status: 'pending' as const
        }))
        setRecipients(prev => [...prev, ...imported])
        alert(`${imported.length} alici eklendi!`)
      }
    })
  }

  const sendBatch = async () => {
    const pending = recipients.filter(r => r.status === 'pending')
    if (!pending.length) { alert('Bekleyen alici yok!'); return }
    if (!confirm(`${pending.length} kisiye odeme gonderilecek. Devam?`)) return
    setBatchPaying(true)
    const { AppKit } = await import('@circle-fin/app-kit')
    const { createViemAdapterFromProvider } = await import('@circle-fin/adapter-viem-v2')
    const kit = new AppKit()
    const adapter = await createViemAdapterFromProvider({ provider: (window as any).ethereum })
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
      } catch (e: any) { console.error(e) }
    }
    setBatchPaying(false)
    alert('Tum odemeler tamamlandi!')
  }

  const downloadTemplate = () => {
    const csv = 'name,address,amount\nAhmet Yilmaz,0x1234567890123456789012345678901234567890,100'
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = 'template.csv'; a.click()
  }

  const totalPaid = transactions.reduce((s, t) => s + parseFloat(t.amount || '0'), 0)
  const pendingCount = recipients.filter(r => r.status === 'pending').length
  const showSidePanel = tab === 'send' || tab === 'nft' || tab === 'bridge' || tab === 'swap'
  
  const TAB_LABELS: Record<Tab, string> = { send: 'Send', batch: 'Batch Payout', nft: 'NFT Receipt', bridge: 'Bridge', swap: 'Swap' }

  const TxBox = ({ result }: { result: { txHash: string; explorerUrl?: string } }) => (
    <div className="rounded-xl p-4 bg-gray-800 border-l-4 border-green-500">
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
        <div className="text-center">
          <div className="text-6xl mb-6">🌐</div>
          <h1 className="text-4xl font-bold text-white mb-4">Arc Global Payouts</h1>
          <p className="text-gray-400 mb-8">USDC ile global odeme platformu</p>
          <div className="flex flex-col gap-3 mb-8 max-w-xs mx-auto text-left">
            <p className="text-xs text-gray-500 text-center mb-1">Ilk kez mi? Once sunlari yap:</p>
            <a href="https://thirdweb.com/arc-testnet" target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-3 bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 hover:border-gray-500 transition-colors">
              <span className="text-xl">⚙️</span>
              <div><div className="text-sm font-medium text-white">1. Arc Testnet Agini Kur</div><div className="text-xs text-gray-500">MetaMask a otomatik ekle</div></div>
              <span className="ml-auto text-gray-600 text-xs">↗</span>
            </a>
            <a href="https://faucet.circle.com" target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-3 bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 hover:border-gray-500 transition-colors">
              <span className="text-xl">🚰</span>
              <div><div className="text-sm font-medium text-white">2. Test USDC Al</div><div className="text-xs text-gray-500">Circle Faucet - ucretsiz</div></div>
              <span className="ml-auto text-gray-600 text-xs">↗</span>
            </a>
          </div>
          <button onClick={connectWallet} className="px-8 py-4 bg-white text-black rounded-xl font-bold text-lg hover:bg-gray-100">
            3. Cuzdani Bagla
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-black text-white flex flex-col">
      <nav className="border-b border-gray-800 px-6 py-4 flex justify-between items-center">
        <div className="flex items-center gap-2">
          <span className="text-xl">🌐</span>
          <div>
            <div className="font-bold text-sm">Arc Global Payouts</div>
            <div className="text-xs text-gray-500">ARC NETWORK</div>
          </div>
        </div>
        <div className="flex items-center gap-3">
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
          <Link href="/history" className="text-xs text-gray-400 hover:text-white">Gecmis</Link>
          <div className="relative">
            <button onClick={() => setShowHelp(!showHelp)}
              className="w-6 h-6 rounded-full bg-gray-800 border border-gray-700 text-xs text-gray-400 hover:text-white hover:border-gray-500 transition-colors flex items-center justify-center">?</button>
            {showHelp && (
              <div className="absolute right-0 top-8 w-64 bg-gray-900 border border-gray-700 rounded-xl shadow-2xl z-50 p-3">
                <div className="text-xs text-gray-400 font-medium mb-3 px-1">🛠 Gelistirici Araclari</div>
                <div className="flex flex-col gap-1">
                  {[
                    { href: 'https://faucet.circle.com', icon: '🚰', title: 'Test USDC Faucet', sub: 'faucet.circle.com' },
                    { href: 'https://thirdweb.com/arc-testnet', icon: '⚙️', title: 'Arc Testnet Ag Kurulumu', sub: 'thirdweb.com/arc-testnet' },
                    { href: 'https://testnet.arcscan.app', icon: '🔍', title: 'ArcScan Explorer', sub: 'testnet.arcscan.app' },
                  ].map(item => (
                    <a key={item.href} href={item.href} target="_blank" rel="noopener noreferrer" onClick={() => setShowHelp(false)}
                      className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-gray-800 transition-colors">
                      <span>{item.icon}</span>
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
          <button onClick={() => disconnect()} className="text-xs text-gray-500 hover:text-red-400">Cikis</button>
        </div>
      </nav>

      <div className="border-b border-gray-800 px-6">
        <div className="flex gap-6">
          {(['send', 'batch', 'nft', 'bridge', 'swap'] as Tab[]).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`py-3 text-sm font-medium transition-colors border-b-2 ${tab === t ? 'text-white border-white' : 'text-gray-500 border-transparent hover:text-gray-300'}`}>
              {TAB_LABELS[t]}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-1" onClick={() => showHelp && setShowHelp(false)}>

        {showSidePanel && (
          <div className="flex-1 flex items-start justify-center p-8">
            <div className="w-full max-w-md bg-gray-900 rounded-2xl border border-gray-800 p-6">

              {tab === 'send' && (
                <div className="space-y-4">
                  <div>
                    <label className="text-xs text-gray-400 mb-1 block">YOU PAY</label>
                    <div className="flex items-center gap-3 bg-gray-800 rounded-xl p-4">
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
                    <input type="text" value={singleAddress} onChange={e => setSingleAddress(e.target.value)} placeholder="0x..." className="w-full bg-gray-800 rounded-xl p-4 text-sm outline-none placeholder-gray-600" />
                    <div className="text-xs text-gray-500 mt-1 px-1">Arc Testnet</div>
                  </div>
                  {singleAmount && (
                    <div className="bg-gray-800 rounded-xl p-3 space-y-2 text-sm">
                      <div className="flex justify-between text-gray-400"><span>Network gas</span><span>~0.009 USDC</span></div>
                      <div className="flex justify-between text-gray-400"><span>Rate</span><span>1 USDC = 1 USDC</span></div>
                      <div className="flex justify-between font-bold"><span>Total sent</span><span>{singleAmount} USDC</span></div>
                    </div>
                  )}
                  <button onClick={sendSingle} disabled={paying} className="w-full py-4 bg-white text-black rounded-xl font-bold hover:bg-gray-100 disabled:opacity-50">
                    {paying ? <span className="flex items-center justify-center gap-2"><span className="w-4 h-4 border-2 border-gray-400 border-t-black rounded-full animate-spin"></span>Gonderiliyor...</span> : 'Confirm transfer'}
                  </button>
                  {txResult && <TxBox result={txResult} />}
                  <div className="text-center text-xs text-gray-600">Arc Testnet · sub-second finality · USDC-native gas · Powered by Arc App Kit</div>
                </div>
              )}

              {tab === 'nft' && (
                <div className="space-y-4">
                  <h2 className="font-bold text-lg">🎨 NFT Receipt Gorseli</h2>
                  <p className="text-gray-400 text-sm">Her odeme sonrasi bu gorsel ile NFT receipt olusturulacak</p>
                  <div className="border-2 border-dashed border-gray-700 rounded-xl p-8 text-center">
                    {nftImagePreview ? <img src={nftImagePreview} alt="NFT" className="w-32 h-32 rounded-xl object-cover mx-auto mb-3" /> : <div className="text-4xl mb-3">🎨</div>}
                    <button onClick={() => nftImageRef.current?.click()} disabled={uploadingImage} className="px-4 py-2 bg-purple-600 rounded-lg text-sm hover:bg-purple-700 disabled:opacity-50">
                      {uploadingImage ? '⏳ Yukleniyor...' : nftImageUrl ? '✅ Gorsel Yuklendi' : 'Gorsel Sec'}
                    </button>
                    <input ref={nftImageRef} type="file" accept="image/*" onChange={handleNFTImageSelect} className="hidden" />
                  </div>
                  {nftImageUrl && <div className="bg-green-900/30 border border-green-800 rounded-lg p-3 text-sm text-green-400">✅ IPFS e yuklendi — odemeler bu gorsel ile NFT receipt alacak</div>}
                </div>
              )}

              {tab === 'bridge' && (
                <div className="space-y-4">
                  <div>
                    <label className="text-xs text-gray-400 mb-2 block">FROM</label>
                    <div className="grid grid-cols-3 gap-2">
                      {CHAINS.filter(c => c.id !== bridgeTo).map(chain => (
                        <button key={chain.id} onClick={() => setBridgeFrom(chain.id)}
                          className={`py-2 px-2 rounded-xl text-xs font-medium border transition-colors ${bridgeFrom === chain.id ? 'border-white text-white bg-gray-700' : 'border-gray-700 text-gray-400 hover:border-gray-500'}`}>
                          <div className={`w-2 h-2 rounded-full ${chain.dot} inline-block mr-1`}></div>
                          {chain.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="text-xs text-gray-400 mb-1 block">YOU SEND</label>
                    <div className="flex items-center gap-3 bg-gray-800 rounded-xl p-4">
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
                    <button onClick={flipBridge} className="w-10 h-10 bg-gray-800 border border-gray-700 rounded-full flex items-center justify-center text-gray-400 hover:text-white hover:bg-gray-700 hover:border-gray-500 transition-colors text-lg">⇅</button>
                  </div>
                  <div>
                    <label className="text-xs text-gray-400 mb-2 block">TO</label>
                    <div className="grid grid-cols-3 gap-2">
                      {CHAINS.filter(c => c.id !== bridgeFrom).map(chain => (
                        <button key={chain.id} onClick={() => setBridgeTo(chain.id)}
                          className={`py-2 px-2 rounded-xl text-xs font-medium border transition-colors ${bridgeTo === chain.id ? 'border-white text-white bg-gray-700' : 'border-gray-700 text-gray-400 hover:border-gray-500'}`}>
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
                  <button onClick={sendBridge} disabled={bridgePaying} className="w-full py-4 bg-white text-black rounded-xl font-bold hover:bg-gray-100 disabled:opacity-50">
                    {bridgePaying ? <span className="flex items-center justify-center gap-2"><span className="w-4 h-4 border-2 border-gray-400 border-t-black rounded-full animate-spin"></span>Bridge yapiliyor...</span> : 'Confirm bridge'}
                  </button>
                  {bridgeResult && <TxBox result={bridgeResult} />}
                  <div className="text-center text-xs text-gray-600">{CHAINS.find(c=>c.id===bridgeFrom)?.label} → {CHAINS.find(c=>c.id===bridgeTo)?.label} · USDC · Powered by Arc App Kit</div>
                </div>
              )}

              {tab === 'swap' && (
                <div className="space-y-4">
                  <div>
                    <label className="text-xs text-gray-400 mb-1 block">YOU PAY</label>
                    <div className="flex items-center gap-3 bg-gray-800 rounded-xl p-4">
                      <input type="number" value={swapAmount} onChange={e => setSwapAmount(e.target.value)} placeholder="0" className="bg-transparent text-3xl font-bold flex-1 outline-none" />
                      <div className="flex items-center gap-2 bg-gray-700 rounded-full px-3 py-1">
                        <span className="text-blue-400">●</span><span className="text-sm font-medium">USDC</span>
                      </div>
                    </div>
                    <div className="text-xs text-gray-500 mt-1 px-1">Arc Testnet</div>
                  </div>
                  <div className="flex justify-center">
                    <div className="w-8 h-8 bg-gray-800 rounded-full flex items-center justify-center text-gray-400">⇅</div>
                  </div>
                  <div>
                    <label className="text-xs text-gray-400 mb-1 block">YOU RECEIVE</label>
                    <div className="flex items-center gap-3 bg-gray-800 rounded-xl p-4">
                      <span className="text-3xl font-bold flex-1 text-gray-500">{swapAmount || '0'}</span>
                      <div className="flex items-center gap-2 bg-gray-700 rounded-full px-3 py-1">
                        <span className="text-yellow-400">●</span><span className="text-sm font-medium">EURC</span>
                      </div>
                    </div>
                    <div className="text-xs text-gray-500 mt-1 px-1">Arc Testnet</div>
                  </div>
                  {swapAmount && (
                    <div className="bg-gray-800 rounded-xl p-3 space-y-2 text-sm">
                      <div className="flex justify-between text-gray-400"><span>Rate</span><span>1 USDC ≈ 1 EURC</span></div>
                      <div className="flex justify-between text-gray-400"><span>Slippage</span><span>3%</span></div>
                      <div className="flex justify-between text-gray-400"><span>Network gas</span><span>~0.009 USDC</span></div>
                      <div className="flex justify-between font-bold"><span>You receive</span><span>~{swapAmount} EURC</span></div>
                    </div>
                  )}
                  <button onClick={sendSwap} disabled={swapPaying} className="w-full py-4 bg-white text-black rounded-xl font-bold hover:bg-gray-100 disabled:opacity-50">
                    {swapPaying ? <span className="flex items-center justify-center gap-2"><span className="w-4 h-4 border-2 border-gray-400 border-t-black rounded-full animate-spin"></span>Swap yapiliyor...</span> : 'Confirm swap'}
                  </button>
                  {swapResult && <TxBox result={swapResult} />}
                  <div className="text-center text-xs text-gray-600">Arc Testnet · USDC → EURC · Slippage 3% · Powered by Arc App Kit</div>
                </div>
              )}

            </div>
          </div>
        )}

        {tab === 'batch' && (
          <div className="flex-1 p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold">Batch Payout</h2>
              <div className="flex gap-3">
                <button onClick={downloadTemplate} className="px-4 py-2 bg-gray-800 rounded-lg text-sm hover:bg-gray-700">📥 Sablon</button>
                <button onClick={() => fileRef.current?.click()} className="px-4 py-2 bg-gray-800 rounded-lg text-sm hover:bg-gray-700">📤 CSV Yukle</button>
                <input ref={fileRef} type="file" accept=".csv" onChange={importCSV} className="hidden" />
                {pendingCount > 0 && (
                  <button onClick={sendBatch} disabled={batchPaying} className="px-4 py-2 bg-white text-black rounded-lg text-sm font-bold hover:bg-gray-100 disabled:opacity-50">
                    {batchPaying ? '⏳ Gonderiliyor...' : `🚀 ${pendingCount} Kisiye Gonder`}
                  </button>
                )}
              </div>
            </div>
            <div className="bg-gray-900 rounded-xl border border-gray-800 p-4 mb-4">
              <div className="grid grid-cols-4 gap-3">
                <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Ad Soyad" className="bg-gray-800 rounded-lg px-3 py-2 text-sm outline-none placeholder-gray-600" />
                <input value={newAddress} onChange={e => setNewAddress(e.target.value)} placeholder="0x..." className="bg-gray-800 rounded-lg px-3 py-2 text-sm outline-none placeholder-gray-600 col-span-2" />
                <div className="flex gap-2">
                  <input value={newAmount} onChange={e => setNewAmount(e.target.value)} placeholder="USDC" type="number" className="bg-gray-800 rounded-lg px-3 py-2 text-sm outline-none placeholder-gray-600 flex-1" />
                  <button onClick={addRecipient} className="px-4 py-2 bg-blue-600 rounded-lg text-sm hover:bg-blue-700">+</button>
                </div>
              </div>
            </div>
            <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
              {recipients.length === 0 ? (
                <div className="p-12 text-center text-gray-600">
                  <div className="text-4xl mb-3">👥</div>
                  <p>Henuz alici eklenmedi</p>
                  <p className="text-sm mt-1">Manuel ekle veya CSV yukle</p>
                </div>
              ) : (
                <table className="w-full">
                  <thead className="border-b border-gray-800">
                    <tr>
                      <th className="text-left p-4 text-xs text-gray-400">AD</th>
                      <th className="text-left p-4 text-xs text-gray-400">ADRES</th>
                      <th className="text-left p-4 text-xs text-gray-400">MIKTAR</th>
                      <th className="text-left p-4 text-xs text-gray-400">DURUM</th>
                      <th className="text-left p-4 text-xs text-gray-400">NFT</th>
                      <th className="text-left p-4 text-xs text-gray-400">TX</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recipients.map(r => (
                      <tr key={r.id} className="border-b border-gray-800 hover:bg-gray-800/50">
                        <td className="p-4 text-sm font-medium">{r.name}</td>
                        <td className="p-4 text-sm text-gray-400 font-mono">{r.address.slice(0,6)}...{r.address.slice(-4)}</td>
                        <td className="p-4 text-sm font-bold">{r.amount} USDC</td>
                        <td className="p-4">
                          <span className={`px-2 py-1 rounded text-xs ${r.status === 'paid' ? 'bg-green-900 text-green-400' : 'bg-yellow-900 text-yellow-400'}`}>
                            {r.status === 'paid' ? '✅ Odendi' : '⏳ Bekliyor'}
                          </span>
                        </td>
                        <td className="p-4">{r.nftUrl ? <a href={r.nftUrl} target="_blank" rel="noopener noreferrer" className="text-purple-400 text-xs hover:underline">🎨 Gor</a> : <span className="text-gray-600 text-xs">—</span>}</td>
                        <td className="p-4">{r.txHash ? <a href={`https://testnet.arcscan.app/tx/${r.txHash}`} target="_blank" rel="noopener noreferrer" className="text-blue-400 text-xs hover:underline">Explorer</a> : <span className="text-gray-600 text-xs">—</span>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}

        {showSidePanel && (
          <div className="w-72 border-l border-gray-800 p-5 flex flex-col gap-4">
            <div className="bg-gray-900 rounded-xl p-4 border border-gray-800">
              <div className="text-xs text-gray-400 mb-1">USDC BAKIYESI</div>
              <div className="text-3xl font-bold">${${balanceFormatted}}</div>
              <div className="text-xs text-blue-400 mt-1">Arc Testnet · Gercek Bakiye</div>
            </div>
            <div className="bg-gray-900 rounded-xl p-4 border border-gray-800">
              <div className="text-xs text-gray-400 mb-1">TOPLAM GONDERILEN</div>
              <div className="text-2xl font-bold">${totalPaid.toFixed(2)}</div>
              <div className="text-xs text-green-400 mt-1">Bu oturumda</div>
            </div>
            <div className="bg-gray-900 rounded-xl p-4 border border-gray-800">
              <div className="text-xs text-gray-400 mb-3">HOLDINGS</div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-xs font-bold">$</div>
                  <div><div className="text-sm font-medium">USDC</div><div className="text-xs text-gray-500">Arc Testnet</div></div>
                </div>
                <div className="text-sm font-medium">${usdcFormatted}</div>
              </div>
            </div>
            <div className="bg-gray-900 rounded-xl p-4 border border-gray-800">
              <div className="text-xs text-gray-400 mb-3">ARACLAR</div>
              <div className="flex flex-col gap-2">
                <a href="https://faucet.circle.com" target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-2 px-3 py-2 bg-blue-900/30 border border-blue-800/50 rounded-lg hover:bg-blue-900/50 transition-colors">
                  <span className="text-sm">🚰</span>
                  <div className="flex-1"><div className="text-xs font-medium text-blue-300">Test USDC Al</div><div className="text-xs text-gray-500">faucet.circle.com</div></div>
                  <span className="text-blue-600 text-xs">↗</span>
                </a>
                <a href="https://thirdweb.com/arc-testnet" target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-2 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg hover:bg-gray-700 transition-colors">
                  <span className="text-sm">⚙️</span>
                  <div className="flex-1"><div className="text-xs font-medium text-gray-300">Ag Kurulumu</div><div className="text-xs text-gray-500">Arc Testnet ekle</div></div>
                  <span className="text-gray-600 text-xs">↗</span>
                </a>
                <a href="https://testnet.arcscan.app" target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-2 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg hover:bg-gray-700 transition-colors">
                  <span className="text-sm">🔍</span>
                  <div className="flex-1"><div className="text-xs font-medium text-gray-300">ArcScan Explorer</div><div className="text-xs text-gray-500">Islemleri takip et</div></div>
                  <span className="text-gray-600 text-xs">↗</span>
                </a>
              </div>
            </div>
            <div className="bg-gray-900 rounded-xl p-4 border border-gray-800 flex-1">
              <div className="flex justify-between items-center mb-3">
                <div className="text-xs text-gray-400">ACTIVITY</div>
                <div className="flex gap-2 items-center">
                  <a href="https://testnet.arcscan.app" target="_blank" rel="noopener noreferrer" className="text-xs text-gray-500 hover:text-white">ArcScan</a>
                  <span className="text-gray-700">·</span>
                  <Link href="/history" className="text-xs text-gray-500 hover:text-white">All txns</Link>
                </div>
              </div>
              {transactions.length === 0 ? (
                <div className="text-center text-gray-600 text-sm py-4">Henuz islem yok</div>
              ) : (
                <div className="space-y-3">
                  {transactions.slice(0, 5).map(t => (
                    <div key={t.id} className="flex items-center justify-between">
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