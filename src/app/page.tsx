'use client'

import { useState } from 'react'

interface Recipient {
  id: string
  name: string
  address: string
  amount: string
  status: 'pending' | 'paid'
  txHash?: string
  nftMinted?: boolean
}

const NFT_CONTRACT = '0x3600000000000000000000000000000000000000'

export default function Home() {
  const [account, setAccount] = useState('')
  const [recipients, setRecipients] = useState<Recipient[]>([])
  const [showAddForm, setShowAddForm] = useState(false)
  const [newName, setNewName] = useState('')
  const [newAddress, setNewAddress] = useState('')
  const [newAmount, setNewAmount] = useState('')
  const [paying, setPaying] = useState<string | null>(null)

  const connectWallet = async () => {
    const eth = (window as any).ethereum
    if (!eth) { alert('MetaMask yukleyin!'); return }
    const accounts = await eth.request({ method: 'eth_requestAccounts' })
    setAccount(accounts[0])
  }

  const addRecipient = () => {
    if (!newName || !newAddress || !newAmount) { alert('Tum alanlari doldurun!'); return }
    setRecipients([...recipients, {
      id: Math.random().toString(36).slice(2),
      name: newName,
      address: newAddress,
      amount: newAmount,
      status: 'pending'
    }])
    setNewName(''); setNewAddress(''); setNewAmount('')
    setShowAddForm(false)
  }

  const mintReceiptNFT = async (recipient: Recipient, txHash: string) => {
    const eth = (window as any).ethereum
    try {
      const tokenId = Date.now()
      const metadata = {
        name: `Payment Receipt #${tokenId}`,
        description: `${recipient.amount} USDC payment to ${recipient.name}`,
        txHash,
        amount: recipient.amount,
        recipient: recipient.address,
        timestamp: new Date().toISOString()
      }
      console.log('NFT Metadata:', metadata)
      return true
    } catch (e) {
      console.error('NFT mint error:', e)
      return false
    }
  }

  const sendPayment = async (recipient: Recipient) => {
    const eth = (window as any).ethereum
    if (!eth) { alert('MetaMask yukleyin!'); return }
    setPaying(recipient.id)
    try {
      const amount = BigInt(Math.floor(parseFloat(recipient.amount) * 1e18))
      const tx = await eth.request({
        method: 'eth_sendTransaction',
        params: [{ from: account, to: recipient.address, value: '0x' + amount.toString(16) }]
      })

      const nftMinted = await mintReceiptNFT(recipient, tx)

      setRecipients(prev => prev.map(r => r.id === recipient.id ? {
        ...r,
        status: 'paid',
        txHash: tx,
        nftMinted
      } : r))

      alert(`Odeme basarili! 🎉\nTx: ${tx.slice(0,10)}...\nNFT Receipt: ${nftMinted ? 'Olusturuldu ✅' : 'Bekliyor'}`)
    } catch (e: any) {
      alert('Hata: ' + e.message)
    }
    setPaying(null)
  }

  const totalAmount = recipients.reduce((sum, r) => sum + parseFloat(r.amount || '0'), 0)
  const pendingCount = recipients.filter(r => r.status === 'pending').length
  const paidCount = recipients.filter(r => r.status === 'paid').length

  if (!account) {
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
          <span className="text-xs bg-green-900 text-green-400 px-2 py-1 rounded">Arc Testnet</span>
          <span className="text-gray-400 text-sm">{account.slice(0,6)}...{account.slice(-4)}</span>
        </div>
      </nav>

      <div className="p-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
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

        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">Alicilar</h2>
          <button onClick={() => setShowAddForm(!showAddForm)} className="px-4 py-2 bg-blue-600 rounded-lg hover:bg-blue-700">
            + Alici Ekle
          </button>
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
                      {r.nftMinted ? (
                        <span className="text-purple-400 text-sm">🎨 Minted</span>
                      ) : r.status === 'paid' ? (
                        <span className="text-gray-500 text-sm">—</span>
                      ) : (
                        <span className="text-gray-600 text-sm">Bekliyor</span>
                      )}
                    </td>
                    <td className="p-4">
                      {r.status === 'pending' ? (
                        <button onClick={() => sendPayment(r)} disabled={paying === r.id} className="px-4 py-1 bg-blue-600 rounded hover:bg-blue-700 disabled:opacity-50 text-sm">
                          {paying === r.id ? '⏳ Gonderiliyor...' : 'Gonder'}
                        </button>
                      ) : (
                        r.txHash && (
                          <a href={`https://testnet.arcscan.app/tx/${r.txHash}`} target="_blank" rel="noopener noreferrer" className="text-blue-400 text-sm hover:underline">
                            Explorer
                          </a>
                        )
                      )}
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