'use client'

import { useState, useRef } from 'react'
import Link from 'next/link'
import Papa from 'papaparse'
import { useAccount, useConnect, useDisconnect, useSendTransaction } from 'wagmi'
import { injected } from 'wagmi/connectors'
import { parseEther } from 'viem'
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

type Tab = 'send' | 'batch' | 'nft'

export default function Home() {
  const { address, isConnected } = useAccount()
  const { connect } = useConnect()
  const { disconnect } = useDisconnect()
  const { sendTransactionAsync } = useSendTransaction()

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
  const fileRef = useRef<HTMLInputElement>(null)
  const nftImageRef = useRef<HTMLInputElement>(null)

  const connectWallet = () => connect({ connector: injected() })

  const handleNFTImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setNftImagePreview(URL.createObjectURL(file))
    setUploadingImage(true)
    try {
      const url = await uploadImageToIPFS(file)
      setNftImageUrl(url)
    } catch (e: any) {
      alert('Gorsel yuklenemedi: ' + e.message)
    }
    setUploadingImage(false)
  }

  const saveTransaction = (name: string, addr: string, amount: string, txHash: string, nftUrl?: string) => {
    const tx = { id: Math.random().toString(36).slice(2), name, address: addr, amount, txHash, nftUrl, timestamp: new Date().toISOString() }
    setTransactions(prev => [tx, ...prev])
    const stored = localStorage.getItem('arc_transactions')
    const existing = stored ? JSON.parse(stored) : []
    localStorage.setItem('arc_transactions', JSON.stringify([tx, ...existing]))
  }

  const sendSingle = async () => {
    if (!singleAddress || !singleAmount) { alert('Adres ve miktar girin!'); return }
    setPaying(true)
    try {
      const tx = await sendTransactionAsync({
        to: singleAddress as `0x${string}`,
        value: parseEther(singleAmount),
      })
      let nftUrl = ''
      if (nftImageUrl) {
        nftUrl = await uploadNFTMetadata(`Payment Receipt`, `${singleAmount} USDC odeme`, nftImageUrl, [
          { trait_type: 'Amount', value: `${singleAmount} USDC` },
          { trait_type: 'Network', value: 'Arc Testnet' },
        ])
      }
      saveTransaction('Manuel Odeme', singleAddress, singleAmount, tx, nftUrl)
      setSingleAddress(''); setSingleAmount('')
      alert('Odeme basarili! 🎉')
    } catch (e: any) {
      alert('Hata: ' + e.message)
    }
    setPaying(false)
  }

  const addRecipient = () => {
    if (!newName || !newAddress || !newAmount) { alert('Tum alanlari doldurun!'); return }
    setRecipients([...recipients, {
      id: Math.random().toString(36).slice(2),
      name: newName, address: newAddress, amount: newAmount, status: 'pending'
    }])
    setNewName(''); setNewAddress(''); setNewAmount('')
  }

  const importCSV = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    Papa.parse(file, {
      header: true,
      complete: (results) => {
        const imported = (results.data as any[]).filter(r => r.address && r.amount).map(r => ({
          id: Math.random().toString(36).slice(2),
          name: r.name || 'Isimsiz', address: r.address, amount: r.amount, status: 'pending' as const
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
    for (const r of pending) {
      try {
        const tx = await sendTransactionAsync({
          to: r.address as `0x${string}`,
          value: parseEther(r.amount),
        })
        let nftUrl = ''
        if (nftImageUrl) {
          nftUrl = await uploadNFTMetadata(`Receipt - ${r.name}`, `${r.amount} USDC`, nftImageUrl, [
            { trait_type: 'Recipient', value: r.name },
            { trait_type: 'Amount', value: `${r.amount} USDC` },
          ])
        }
        saveTransaction(r.name, r.address, r.amount, tx, nftUrl)
        setRecipients(prev => prev.map(x => x.id === r.id ? { ...x, status: 'paid', txHash: tx, nftMinted: !!nftUrl, nftUrl } : x))
      } catch (e: any) {
        console.error(e)
      }
    }
    setBatchPaying(false)
    alert('Tum odemeler tamamlandi!')
  }

  const totalPaid = transactions.reduce((s, t) => s + parseFloat(t.amount || '0'), 0)
  const pendingCount = recipients.filter(r => r.status === 'pending').length

  if (!isConnected) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center px-4">
        <div className="text-center">
          <div className="text-6xl mb-6">🌐</div>
          <h1 className="text-4xl font-bold text-white mb-4">Arc Global Payouts</h1>
          <p className="text-gray-400 mb-8">USDC ile global odeme platformu</p>
          <button onClick={connectWallet} className="px-8 py-4 bg-white text-black rounded-xl font-bold text-lg hover:bg-gray-100">
            Cuzdani Bagla
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header */}
      <nav className="border-b border-gray-800 px-6 py-4 flex justify-between items-center">
        <div className="flex items-center gap-2">
          <span className="text-xl">🌐</span>
          <div>
            <div className="font-bold text-sm">Arc Global Payouts</div>
            <div className="text-xs text-gray-500">ARC NETWORK</div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-gray-900 rounded-full px-3 py-1">
            <div className="w-2 h-2 bg-green-400 rounded-full"></div>
            <span className="text-xs">Arc Testnet</span>
          </div>
          <div className="bg-gray-900 rounded-full px-3 py-1 text-xs">
            USDC
          </div>
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-purple-500 rounded-full"></div>
            <span className="text-xs text-gray-400">{address?.slice(0,6)}...{address?.slice(-4)}</span>
          </div>
          <Link href="/history" className="text-xs text-gray-400 hover:text-white">Gecmis</Link>
          <button onClick={() => disconnect()} className="text-xs text-gray-500 hover:text-red-400">Cikis</button>
        </div>
      </nav>

      <div className="flex h-[calc(100vh-65px)]">
        {/* Sol Panel */}
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="w-full max-w-md bg-gray-900 rounded-2xl border border-gray-800 overflow-hidden">
            {/* Sekmeler */}
            <div className="flex border-b border-gray-800">
              {(['send', 'batch', 'nft'] as Tab[]).map(t => (
                <button key={t} onClick={() => setTab(t)}
                  className={`flex-1 py-3 text-sm font-medium capitalize transition-colors ${tab === t ? 'text-white border-b-2 border-white' : 'text-gray-500 hover:text-gray-300'}`}>
                  {t === 'send' ? 'Send' : t === 'batch' ? 'Batch' : 'NFT'}
                </button>
              ))}
            </div>

            <div className="p-6">
              {/* SEND TAB */}
              {tab === 'send' && (
                <div className="space-y-4">
                  <div>
                    <label className="text-xs text-gray-400 mb-1 block">YOU PAY</label>
                    <div className="flex items-center gap-3 bg-gray-800 rounded-xl p-4">
                      <input
                        type="number"
                        value={singleAmount}
                        onChange={e => setSingleAmount(e.target.value)}
                        placeholder="0"
                        className="bg-transparent text-3xl font-bold flex-1 outline-none"
                      />
                      <div className="flex items-center gap-2 bg-gray-700 rounded-full px-3 py-1">
                        <span className="text-blue-400">●</span>
                        <span className="text-sm font-medium">USDC</span>
                      </div>
                    </div>
                    <div className="text-xs text-gray-500 mt-1 px-1">Arc Testnet</div>
                  </div>

                  <div className="flex justify-center">
                    <div className="w-8 h-8 bg-gray-800 rounded-full flex items-center justify-center text-gray-400">↓</div>
                  </div>

                  <div>
                    <label className="text-xs text-gray-400 mb-1 block">TO</label>
                    <input
                      type="text"
                      value={singleAddress}
                      onChange={e => setSingleAddress(e.target.value)}
                      placeholder="0x..."
                      className="w-full bg-gray-800 rounded-xl p-4 text-sm outline-none placeholder-gray-600"
                    />
                    <div className="text-xs text-gray-500 mt-1 px-1">Arc Testnet</div>
                  </div>

                  {singleAmount && (
                    <div className="bg-gray-800 rounded-xl p-3 space-y-2 text-sm">
                      <div className="flex justify-between text-gray-400">
                        <span>Network gas</span>
                        <span>~0.009 USDC</span>
                      </div>
                      <div className="flex justify-between text-gray-400">
                        <span>Rate</span>
                        <span>1 USDC = 1 USDC</span>
                      </div>
                      <div className="flex justify-between font-bold">
                        <span>Total sent</span>
                        <span>{singleAmount} USDC</span>
                      </div>
                    </div>
                  )}

                  <button onClick={sendSingle} disabled={paying}
                    className="w-full py-4 bg-white text-black rounded-xl font-bold hover:bg-gray-100 disabled:opacity-50">
                    {paying ? 'Gonderiliyor...' : 'Confirm transfer'}
                  </button>

                  <div className="text-center text-xs text-gray-600">
                    Arc Testnet · sub-second finality · USDC-native gas
                  </div>
                </div>
              )}

              {/* BATCH TAB */}
              {tab === 'batch' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-3 gap-2">
                    <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Ad" className="bg-gray-800 rounded-lg px-3 py-2 text-sm outline-none placeholder-gray-600" />
                    <input value={newAddress} onChange={e => setNewAddress(e.target.value)} placeholder="0x..." className="bg-gray-800 rounded-lg px-3 py-2 text-sm outline-none placeholder-gray-600" />
                    <input value={newAmount} onChange={e => setNewAmount(e.target.value)} placeholder="USDC" type="number" className="bg-gray-800 rounded-lg px-3 py-2 text-sm outline-none placeholder-gray-600" />
                  </div>
                  <div className="flex gap-2">
                    <button onClick={addRecipient} className="flex-1 py-2 bg-gray-700 rounded-lg text-sm hover:bg-gray-600">+ Ekle</button>
                    <button onClick={() => fileRef.current?.click()} className="flex-1 py-2 bg-gray-700 rounded-lg text-sm hover:bg-gray-600">📤 CSV</button>
                    <input ref={fileRef} type="file" accept=".csv" onChange={importCSV} className="hidden" />
                  </div>

                  {recipients.length > 0 && (
                    <div className="space-y-2 max-h-40 overflow-y-auto">
                      {recipients.map(r => (
                        <div key={r.id} className="flex justify-between items-center bg-gray-800 rounded-lg px-3 py-2 text-sm">
                          <span>{r.name}</span>
                          <span className="text-gray-400">{r.amount} USDC</span>
                          <span className={r.status === 'paid' ? 'text-green-400' : 'text-yellow-400'}>
                            {r.status === 'paid' ? '✅' : '⏳'}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}

                  {pendingCount > 0 && (
                    <button onClick={sendBatch} disabled={batchPaying}
                      className="w-full py-4 bg-white text-black rounded-xl font-bold hover:bg-gray-100 disabled:opacity-50">
                      {batchPaying ? 'Gonderiliyor...' : `🚀 ${pendingCount} Kisiye Gonder`}
                    </button>
                  )}
                </div>
              )}

              {/* NFT TAB */}
              {tab === 'nft' && (
                <div className="space-y-4">
                  <p className="text-gray-400 text-sm">Her odeme sonrasi bu gorsel ile NFT receipt olusturulacak</p>
                  <div className="border-2 border-dashed border-gray-700 rounded-xl p-8 text-center">
                    {nftImagePreview ? (
                      <img src={nftImagePreview} alt="NFT" className="w-32 h-32 rounded-xl object-cover mx-auto mb-3" />
                    ) : (
                      <div className="text-4xl mb-3">🎨</div>
                    )}
                    <button onClick={() => nftImageRef.current?.click()} disabled={uploadingImage}
                      className="px-4 py-2 bg-purple-600 rounded-lg text-sm hover:bg-purple-700 disabled:opacity-50">
                      {uploadingImage ? '⏳ Yukleniyor...' : nftImageUrl ? '✅ Gorsel Yuklendi' : 'Gorsel Sec'}
                    </button>
                    <input ref={nftImageRef} type="file" accept="image/*" onChange={handleNFTImageSelect} className="hidden" />
                  </div>
                  {nftImageUrl && (
                    <div className="bg-green-900/30 border border-green-800 rounded-lg p-3 text-sm text-green-400">
                      ✅ IPFS e yuklendi — odemeler bu gorsel ile NFT receipt alacak
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Sag Panel */}
        <div className="w-80 border-l border-gray-800 p-6 flex flex-col gap-6">
          <div className="bg-gray-900 rounded-xl p-4 border border-gray-800">
            <div className="text-xs text-gray-400 mb-1">BALANCE</div>
            <div className="text-3xl font-bold">${totalPaid.toFixed(2)}</div>
            <div className="text-xs text-green-400 mt-1">Toplam Gonderilen</div>
          </div>

          <div className="bg-gray-900 rounded-xl p-4 border border-gray-800">
            <div className="text-xs text-gray-400 mb-3">HOLDINGS</div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-xs font-bold">$</div>
                <div>
                  <div className="text-sm font-medium">USDC</div>
                  <div className="text-xs text-gray-500">Arc Testnet</div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-sm font-medium">${totalPaid.toFixed(2)}</div>
              </div>
            </div>
          </div>

          <div className="bg-gray-900 rounded-xl p-4 border border-gray-800 flex-1">
            <div className="flex justify-between items-center mb-3">
              <div className="text-xs text-gray-400">ACTIVITY</div>
              <Link href="/history" className="text-xs text-gray-500 hover:text-white">All txns</Link>
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
                        <div className="text-xs font-medium">Send USDC</div>
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
      </div>
    </div>
  )
}