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

export default function Home() {
  const { address, isConnected } = useAccount()
  const { connect } = useConnect()
  const { disconnect } = useDisconnect()
  const { sendTransactionAsync } = useSendTransaction()

  const [recipients, setRecipients] = useState<Recipient[]>([])
  const [showAddForm, setShowAddForm] = useState(false)
  const [newName, setNewName] = useState('')
  const [newAddress, setNewAddress] = useState('')
  const [newAmount, setNewAmount] = useState('')
  const [paying, setPaying] = useState<string | null>(null)
  const [batchPaying, setBatchPaying] = useState(false)
  const [nftImage, setNftImage] = useState<File | null>(null)
  const [nftImagePreview, setNftImagePreview] = useState<string>('')
  const [uploadingImage, setUploadingImage] = useState(false)
  const [nftImageUrl, setNftImageUrl] = useState<string>('')
  const fileRef = useRef<HTMLInputElement>(null)
  const nftImageRef = useRef<HTMLInputElement>(null)

  const connectWallet = () => connect({ connector: injected() })

  const handleNFTImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setNftImage(file)
    setNftImagePreview(URL.createObjectURL(file))
    setUploadingImage(true)
    try {
      const url = await uploadImageToIPFS(file)
      setNftImageUrl(url)
      alert('Gorsel IPFS e yuklendi! ✅')
    } catch (e: any) {
      alert('Gorsel yuklenemedi: ' + e.message)
    }
    setUploadingImage(false)
  }

  const addRecipient = () => {
    if (!newName || !newAddress || !newAmount) { alert('Tum alanlari doldurun!'); return }
    setRecipients([...recipients, {
      id: Math.random().toString(36).slice(2),
      name: newName, address: newAddress, amount: newAmount, status: 'pending'
    }])
    setNewName(''); setNewAddress(''); setNewAmount('')
    setShowAddForm(false)
  }

  const importCSV = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    Papa.parse(file, {
      header: true,
      complete: (results) => {
        const imported = (results.data as any[]).filter(r => r.address && r.amount).map(r => ({
          id: Math.random().toString(36).slice(2),
          name: r.name || 'Isimsiz',
          address: r.address,
          amount: r.amount,
          status: 'pending' as const
        }))
        setRecipients(prev => [...prev, ...imported])
        alert(`${imported.length} alici eklendi!`)
      }
    })
  }

  const saveToHistory = (recipient: Recipient, txHash: string, nftUrl?: string) => {
    const stored = localStorage.getItem('arc_transactions')
    const existing = stored ? JSON.parse(stored) : []
    const newTx = {
      id: Math.random().toString(36).slice(2),
      name: recipient.name,
      address: recipient.address,
      amount: recipient.amount,
      txHash,
      nftUrl,
      timestamp: new Date().toISOString(),
      nftMinted: !!nftUrl
    }
    localStorage.setItem('arc_transactions', JSON.stringify([newTx, ...existing]))
  }

  const sendPayment = async (recipient: Recipient) => {
    setPaying(recipient.id)
    try {
      const tx = await sendTransactionAsync({
        to: recipient.address as `0x${string}`,
        value: parseEther(recipient.amount),
      })

      let nftUrl = ''
      if (nftImageUrl) {
        try {
          nftUrl = await uploadNFTMetadata(
            `Payment Receipt - ${recipient.name}`,
            `${recipient.amount} USDC payment to ${recipient.name} on Arc Testnet`,
            nftImageUrl,
            [
              { trait_type: 'Recipient', value: recipient.name },
              { trait_type: 'Amount', value: `${recipient.amount} USDC` },
              { trait_type: 'Network', value: 'Arc Testnet' },
              { trait_type: 'TxHash', value: tx },
            ]
          )
        } catch (e) {
          console.error('NFT mint error:', e)
        }
      }

      saveToHistory(recipient, tx, nftUrl)
      setRecipients(prev => prev.map(r => r.id === recipient.id ? {
        ...r, status: 'paid', txHash: tx, nftMinted: !!nftUrl, nftUrl
      } : r))
      alert(`Odeme basarili! 🎉${nftUrl ? '\nNFT Receipt olusturuldu! 🎨' : ''}`)
    } catch (e: any) {
      alert('Hata: ' + e.message)
    }
    setPaying(null)
  }

  const sendBatchPayments = async () => {
    const pending = recipients.filter(r => r.status === 'pending')
    if (pending.length === 0) { alert('Bekleyen alici yok!'); return }
    if (!confirm(`${pending.length} kisiye odeme gonderilecek. Devam?`)) return
    setBatchPaying(true)
    for (const recipient of pending) {
      await sendPayment(recipient)
    }
    setBatchPaying(false)
  }

  const downloadTemplate = () => {
    const csv = 'name,address,amount\nAhmet Yilmaz,0x1234567890123456789012345678901234567890,100\nAyse Kaya,0x0987654321098765432109876543210987654321,50'
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = 'payout-template.csv'; a.click()
  }

  const totalAmount = recipients.reduce((sum, r) => sum + parseFloat(r.amount || '0'), 0)
  const pendingCount = recipients.filter(r => r.status === 'pending').length
  const paidCount = recipients.filter(r => r.status === 'paid').length

  if (!isConnected) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center px-4">
        <div className="text-center">
          <div className="text-6xl mb-6">🌐</div>
          <h1 className="text-4xl font-bold text-white mb-4">Arc Global Payouts</h1>
          <p className="text-gray-400 mb-2">USDC ile global odeme platformu</p>
          <p className="text-gray-600 text-sm mb-8">Her odeme icin otomatik NFT receipt</p>
          <button onClick={connectWallet} className="px-8 py-4 bg-blue-600 text-white rounded-xl font-bold text-lg hover:bg-blue-700">
            MetaMask Bagla
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <nav className="border-b border-gray-800 px-6 py-4 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <span className="text-2xl">🌐</span>
          <h1 className="text-xl font-bold">Arc Global Payouts</h1>
        </div>
        <div className="flex items-center gap-4">
          <Link href="/" className="text-white text-sm font-bold border-b border-blue-500">Dashboard</Link>
          <Link href="/history" className="text-gray-400 hover:text-white text-sm">Gecmis</Link>
          <span className="text-xs bg-green-900 text-green-400 px-2 py-1 rounded">Arc Testnet</span>
          <span className="text-gray-400 text-sm">{address?.slice(0,6)}...{address?.slice(-4)}</span>
          <button onClick={() => disconnect()} className="text-xs text-red-400 hover:text-red-300">Cikis</button>
        </div>
      </nav>

      <div className="p-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
            <p className="text-gray-400 text-sm">Toplam Odeme</p>
            <p className="text-3xl font-bold mt-2">${totalAmount.toFixed(2)}</p>
          </div>
          <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
            <p className="text-gray-400 text-sm">Alici Sayisi</p>
            <p className="text-3xl font-bold mt-2">{recipients.length}</p>
          </div>
          <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
            <p className="text-gray-400 text-sm">Bekleyen</p>
            <p className="text-3xl font-bold mt-2 text-yellow-400">{pendingCount}</p>
          </div>
          <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
            <p className="text-gray-400 text-sm">Tamamlanan</p>
            <p className="text-3xl font-bold mt-2 text-green-400">{paidCount}</p>
          </div>
        </div>

        {/* NFT Receipt Gorsel */}
        <div className="bg-gray-900 rounded-xl p-6 border border-gray-800 mb-6">
          <h2 className="text-lg font-bold mb-3">🎨 NFT Receipt Gorseli</h2>
          <p className="text-gray-400 text-sm mb-4">Her odeme sonrasi bu gorsel ile NFT receipt olusturulacak</p>
          <div className="flex items-center gap-4">
            {nftImagePreview && (
              <img src={nftImagePreview} alt="NFT" className="w-16 h-16 rounded-lg object-cover border border-gray-700" />
            )}
            <button onClick={() => nftImageRef.current?.click()} disabled={uploadingImage} className="px-4 py-2 bg-purple-600 rounded-lg hover:bg-purple-700 disabled:opacity-50 text-sm">
              {uploadingImage ? '⏳ Yukleniyor...' : nftImageUrl ? '✅ Gorsel Yuklendi' : '📁 Gorsel Sec'}
            </button>
            <input ref={nftImageRef} type="file" accept="image/*" onChange={handleNFTImageSelect} className="hidden" />
            {nftImageUrl && <span className="text-green-400 text-xs">IPFS e yuklendi ✅</span>}
          </div>
        </div>

        <div className="flex flex-wrap gap-3 justify-between items-center mb-4">
          <h2 className="text-xl font-bold">Alicilar</h2>
          <div className="flex gap-3 flex-wrap">
            <button onClick={downloadTemplate} className="px-4 py-2 bg-gray-700 rounded-lg hover:bg-gray-600 text-sm">📥 CSV Sablonu</button>
            <button onClick={() => fileRef.current?.click()} className="px-4 py-2 bg-gray-700 rounded-lg hover:bg-gray-600 text-sm">📤 CSV Yukle</button>
            <input ref={fileRef} type="file" accept=".csv" onChange={importCSV} className="hidden" />
            <button onClick={() => setShowAddForm(!showAddForm)} className="px-4 py-2 bg-blue-600 rounded-lg hover:bg-blue-700 text-sm">+ Alici Ekle</button>
            {pendingCount > 0 && (
              <button onClick={sendBatchPayments} disabled={batchPaying} className="px-4 py-2 bg-green-600 rounded-lg hover:bg-green-700 text-sm disabled:opacity-50">
                {batchPaying ? '⏳ Gonderiliyor...' : `🚀 Tumune Gonder (${pendingCount})`}
              </button>
            )}
          </div>
        </div>

        {showAddForm && (
          <div className="bg-gray-900 rounded-xl p-6 border border-gray-800 mb-6">
            <h3 className="font-bold mb-4">Yeni Alici</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Ad Soyad" className="bg-gray-800 rounded-lg px-4 py-2 text-white placeholder-gray-500" />
              <input value={newAddress} onChange={e => setNewAddress(e.target.value)} placeholder="0x..." className="bg-gray-800 rounded-lg px-4 py-2 text-white placeholder-gray-500" />
              <input value={newAmount} onChange={e => setNewAmount(e.target.value)} placeholder="Miktar (USDC)" type="number" className="bg-gray-800 rounded-lg px-4 py-2 text-white placeholder-gray-500" />
            </div>
            <button onClick={addRecipient} className="px-6 py-2 bg-green-600 rounded-lg hover:bg-green-700">Ekle</button>
          </div>
        )}

        <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
          {recipients.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              <div className="text-4xl mb-3">👥</div>
              <p>Henuz alici eklenmedi</p>
              <p className="text-sm mt-2">Manuel ekle veya CSV yukle</p>
            </div>
          ) : (
            <table className="w-full">
              <thead className="border-b border-gray-800">
                <tr>
                  <th className="text-left p-4 text-gray-400">Ad</th>
                  <th className="text-left p-4 text-gray-400">Adres</th>
                  <th className="text-left p-4 text-gray-400">Miktar</th>
                  <th className="text-left p-4 text-gray-400">Durum</th>
                  <th className="text-left p-4 text-gray-400">NFT</th>
                  <th className="text-left p-4 text-gray-400">Islem</th>
                </tr>
              </thead>
              <tbody>
                {recipients.map(r => (
                  <tr key={r.id} className="border-b border-gray-800 hover:bg-gray-800/50">
                    <td className="p-4 font-medium">{r.name}</td>
                    <td className="p-4 text-gray-400 font-mono text-sm">{r.address.slice(0,6)}...{r.address.slice(-4)}</td>
                    <td className="p-4 font-bold">{r.amount} USDC</td>
                    <td className="p-4">
                      <span className={`px-2 py-1 rounded text-sm ${r.status === 'paid' ? 'bg-green-900 text-green-400' : 'bg-yellow-900 text-yellow-400'}`}>
                        {r.status === 'paid' ? '✅ Odendi' : '⏳ Bekliyor'}
                      </span>
                    </td>
                    <td className="p-4">
                      {r.nftUrl ? (
                        <a href={r.nftUrl} target="_blank" rel="noopener noreferrer" className="text-purple-400 text-sm hover:underline">🎨 Gor</a>
                      ) : r.nftMinted ? (
                        <span className="text-purple-400 text-sm">🎨 Minted</span>
                      ) : (
                        <span className="text-gray-600 text-sm">—</span>
                      )}
                    </td>
                    <td className="p-4">
                      {r.status === 'pending' ? (
                        <button onClick={() => sendPayment(r)} disabled={paying === r.id} className="px-4 py-1 bg-blue-600 rounded hover:bg-blue-700 disabled:opacity-50 text-sm">
                          {paying === r.id ? '⏳' : 'Gonder'}
                        </button>
                      ) : r.txHash ? (
                        <a href={`https://testnet.arcscan.app/tx/${r.txHash}`} target="_blank" rel="noopener noreferrer" className="text-blue-400 text-sm hover:underline">Explorer</a>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}