'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

interface Transaction {
  id: string
  name: string
  address: string
  amount: string
  txHash: string
  timestamp: string
  nftMinted: boolean
}

export default function HistoryPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([])

  useEffect(() => {
    const stored = localStorage.getItem('arc_transactions')
    if (stored) setTransactions(JSON.parse(stored))
  }, [])

  const totalPaid = transactions.reduce((sum, t) => sum + parseFloat(t.amount || '0'), 0)

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <nav className="border-b border-gray-800 px-6 py-4 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <span className="text-2xl">🌐</span>
          <h1 className="text-xl font-bold">Arc Global Payouts</h1>
        </div>
        <div className="flex items-center gap-4">
          <Link href="/" className="text-gray-400 hover:text-white text-sm">Dashboard</Link>
          <Link href="/history" className="text-white text-sm font-bold border-b border-blue-500">Gecmis</Link>
          <span className="text-xs bg-green-900 text-green-400 px-2 py-1 rounded">Arc Testnet</span>
        </div>
      </nav>

      <div className="p-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
            <p className="text-gray-400 text-sm">Toplam Gonderilen</p>
            <p className="text-3xl font-bold mt-2">${totalPaid.toFixed(2)}</p>
          </div>
          <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
            <p className="text-gray-400 text-sm">Islem Sayisi</p>
            <p className="text-3xl font-bold mt-2">{transactions.length}</p>
          </div>
          <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
            <p className="text-gray-400 text-sm">NFT Receipts</p>
            <p className="text-3xl font-bold mt-2 text-purple-400">{transactions.filter(t => t.nftMinted).length}</p>
          </div>
        </div>

        <h2 className="text-xl font-bold mb-4">Tum Islemler</h2>

        <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
          {transactions.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              <div className="text-4xl mb-3">📋</div>
              <p>Henuz islem yok</p>
              <Link href="/" className="text-blue-400 text-sm mt-2 block hover:underline">
                Dashboard a don
              </Link>
            </div>
          ) : (
            <table className="w-full">
              <thead className="border-b border-gray-800">
                <tr>
                  <th className="text-left p-4 text-gray-400">Alici</th>
                  <th className="text-left p-4 text-gray-400">Adres</th>
                  <th className="text-left p-4 text-gray-400">Miktar</th>
                  <th className="text-left p-4 text-gray-400">Tarih</th>
                  <th className="text-left p-4 text-gray-400">NFT</th>
                  <th className="text-left p-4 text-gray-400">Tx</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map(t => (
                  <tr key={t.id} className="border-b border-gray-800 hover:bg-gray-800/50">
                    <td className="p-4 font-medium">{t.name}</td>
                    <td className="p-4 text-gray-400 font-mono text-sm">{t.address.slice(0,6)}...{t.address.slice(-4)}</td>
                    <td className="p-4 font-bold text-green-400">{t.amount} USDC</td>
                    <td className="p-4 text-gray-400 text-sm">{new Date(t.timestamp).toLocaleDateString('tr-TR')}</td>
                    <td className="p-4">{t.nftMinted ? <span className="text-purple-400">🎨 Minted</span> : <span className="text-gray-600">—</span>}</td>
                    <td className="p-4">
                      <a href={`https://testnet.arcscan.app/tx/${t.txHash}`} target="_blank" rel="noopener noreferrer" className="text-blue-400 text-sm hover:underline">
                        Explorer
                      </a>
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