'use client'

import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import { useAccount, useConnect } from 'wagmi'
import { injected } from 'wagmi/connectors'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  action?: {
    type: 'send' | 'bridge' | 'swap' | 'balance'
    amount?: string
    to?: string
    token?: string
    confirmed?: boolean
  }
}

const WavesLogo = ({ size = 20 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 48 48" fill="none">
    <path d="M14 18 C14 18 24 10 34 18" stroke="#c9a84c" strokeWidth="2.5" fill="none" strokeLinecap="round"/>
    <path d="M14 24 C14 24 24 16 34 24" stroke="#c9a84c" strokeWidth="2.5" fill="none" strokeLinecap="round"/>
    <path d="M14 30 C14 30 24 22 34 30" stroke="#c9a84c" strokeWidth="2.5" fill="none" strokeLinecap="round"/>
  </svg>
)

const QUICK_SUGGESTIONS = [
  'Send 50 USDC to Alice',
  'Check my balance',
  'Bridge 20 USDC to Arc',
  'Show spending this week',
  'Swap USDC to EURC',
  'What is my best Flappy score?',
]

export default function AIPage() {
  const { address, isConnected } = useAccount()
  const { connect } = useConnect()
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'assistant',
      content: `Hey! I'm your Arc AI payment assistant. I can help you:\n\n• Send USDC to anyone\n• Check your balances\n• Analyze your spending\n• Bridge or swap tokens\n• Answer questions about Arc Network\n\nWhat would you like to do?`,
    }
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [darkMode, setDarkMode] = useState(true)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const D = darkMode
  const bg = D ? '#080808' : '#f8f9fa'
  const card = D ? '#0e0e0e' : '#ffffff'
  const border = D ? '#1a1a1a' : '#e8e8e8'
  const text = D ? '#ffffff' : '#000000'
  const muted = D ? '#444444' : '#999999'
  const field = D ? '#111111' : '#f5f5f5'

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const getTransactionHistory = () => {
    const stored = localStorage.getItem('arc_transactions')
    return stored ? JSON.parse(stored) : []
  }

  const buildSystemPrompt = () => {
    const txs = getTransactionHistory()
    const totalSent = txs.reduce((s: number, t: any) => s + parseFloat(t.amount || '0'), 0)
    const txCount = txs.length
    const recentTxs = txs.slice(0, 5).map((t: any) => `- ${t.name}: ${t.amount} USDC (${new Date(t.timestamp).toLocaleDateString()})`).join('\n')

    return `You are Arc AI, a friendly and knowledgeable DeFi payment assistant for Arc Global Payouts — a USDC payment platform built on Arc Network by GoGo.

User wallet: ${address || 'Not connected'}
Total sent: $${totalSent.toFixed(2)} USDC
Total transactions: ${txCount}
Recent transactions:
${recentTxs || 'No transactions yet'}

Arc Network info:
- Testnet explorer: https://testnet.arcscan.app
- Faucet: https://faucet.circle.com
- Network setup: https://thirdweb.com/arc-testnet
- Features: Send, Bridge (ETH/ARB/OP/Base → Arc), Swap (USDC↔EURC↔ETH), Batch payments, NFT receipts, Payment links (/pay/username), Flappy USDC game

Your personality:
- Friendly, concise, helpful
- Crypto-native but explains things clearly
- Use $ for USDC amounts
- Give spending insights when relevant
- Always mention Arc Network when appropriate

When user wants to send/bridge/swap:
- Extract the action details
- Format response as: "I'll help you [action]. Here's what I'll do: [details]"
- End with: "ACTION: {type: 'send', amount: 'X', to: 'address_or_name', token: 'USDC'}"
- For balance queries, respond with insights from their transaction history
- Keep responses under 150 words
- Use bullet points sparingly`
  }

  const parseAction = (content: string): Message['action'] | undefined => {
    const actionMatch = content.match(/ACTION:\s*(\{[^}]+\})/)
    if (!actionMatch) return undefined
    try {
      const actionStr = actionMatch[1]
        .replace(/'/g, '"')
        .replace(/(\w+):/g, '"$1":')
      return JSON.parse(actionStr)
    } catch { return undefined }
  }

  const sendMessage = async (text?: string) => {
    const userText = text || input.trim()
    if (!userText || loading) return
    setInput('')

    const userMsg: Message = {
      id: Math.random().toString(36).slice(2),
      role: 'user',
      content: userText,
    }
    setMessages(prev => [...prev, userMsg])
    setLoading(true)

    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 1000,
          system: buildSystemPrompt(),
          messages: [
            ...messages.filter(m => m.id !== '1').map(m => ({
              role: m.role,
              content: m.content,
            })),
            { role: 'user', content: userText },
          ],
        }),
      })

      const data = await response.json()
      const rawContent = data.content?.[0]?.text || "Sorry, I couldn't process that. Please try again."
      const cleanContent = rawContent.replace(/ACTION:\s*\{[^}]+\}/s, '').trim()
      const action = parseAction(rawContent)

      const assistantMsg: Message = {
        id: Math.random().toString(36).slice(2),
        role: 'assistant',
        content: cleanContent,
        action,
      }
      setMessages(prev => [...prev, assistantMsg])
    } catch (e: any) {
      const errorMsg: Message = {
        id: Math.random().toString(36).slice(2),
        role: 'assistant',
        content: 'Connection error. Please check your internet and try again.',
      }
      setMessages(prev => [...prev, errorMsg])
    }
    setLoading(false)
  }

  const confirmAction = async (msgId: string, action: Message['action']) => {
    if (!action || !isConnected) return
    setMessages(prev => prev.map(m => m.id === msgId ? { ...m, action: { ...m.action!, confirmed: true } } : m))

    try {
      const { AppKit } = await import('@circle-fin/app-kit')
      const { createViemAdapterFromProvider } = await import('@circle-fin/adapter-viem-v2')
      const kit = new AppKit()
      const adapter = await createViemAdapterFromProvider({ provider: (window as any).ethereum })

      if (action.type === 'send' && action.amount && action.to) {
        const res = await kit.send({ from: { adapter, chain: 'Arc_Testnet' as never }, to: action.to, amount: action.amount, token: 'USDC' })
        const txHash = (res as any)?.hash || ''
        const stored = localStorage.getItem('arc_transactions')
        const existing = stored ? JSON.parse(stored) : []
        localStorage.setItem('arc_transactions', JSON.stringify([
          { id: Math.random().toString(36).slice(2), name: `AI: Send to ${action.to}`, address: action.to, amount: action.amount, txHash, timestamp: new Date().toISOString() },
          ...existing
        ]))
        const successMsg: Message = {
          id: Math.random().toString(36).slice(2),
          role: 'assistant',
          content: `✅ Done! Sent ${action.amount} USDC successfully.\n\nTx: ${txHash.slice(0, 20)}...\n\n[View on ArcScan](https://testnet.arcscan.app/tx/${txHash})`,
        }
        setMessages(prev => [...prev, successMsg])
      }
    } catch (e: any) {
      const errorMsg: Message = {
        id: Math.random().toString(36).slice(2),
        role: 'assistant',
        content: `❌ Transaction failed: ${e.message}`,
      }
      setMessages(prev => [...prev, errorMsg])
    }
  }

  const formatContent = (content: string) => {
    return content.split('\n').map((line, i) => (
      <span key={i}>
        {line.startsWith('•') || line.startsWith('-')
          ? <span style={{ display:'block', paddingLeft:8, marginBottom:2 }}>{line}</span>
          : <span style={{ display:'block', marginBottom: line === '' ? 6 : 2 }}>{line}</span>
        }
      </span>
    ))
  }

  return (
    <div style={{ minHeight:'100vh', display:'flex', flexDirection:'column', background:bg, color:text, fontFamily:'-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif' }}>
      <style>{`@keyframes sweep{from{transform:rotate(0)}to{transform:rotate(360deg)}} @keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}} @keyframes spin{to{transform:rotate(360deg)}}`}</style>

      {/* NAV */}
      <nav style={{ borderBottom:`1px solid ${border}`, padding:'11px 16px', display:'flex', alignItems:'center', justifyContent:'space-between', background: D?'#080808':'#fff' }}>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <div style={{ width:30, height:30, background: D?'#111':'#f5f5f5', border:`1px solid ${border}`, borderRadius:8, display:'flex', alignItems:'center', justifyContent:'center' }}>
            <WavesLogo size={16} />
          </div>
          <div>
            <div style={{ fontWeight:700, fontSize:13, color:text }}>Arc AI Assistant</div>
            <div style={{ fontSize:8, color:'#c9a84c', fontWeight:700, letterSpacing:'.8px' }}>
              ARC NETWORK <span style={{ color:muted }}>· by GoGo</span>
            </div>
          </div>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          <div style={{ display:'flex', alignItems:'center', gap:5, padding:'4px 10px', background: D?'#0a1a0a':'#f0faf5', border:'1px solid #1a3a1a', borderRadius:20 }}>
            <div style={{ width:5, height:5, borderRadius:'50%', background:'#4ade80', animation:'pulse 2s infinite' }}></div>
            <span style={{ fontSize:10, color:'#4ade80', fontWeight:700 }}>AI Online</span>
          </div>
          <Link href="/" style={{ fontSize:11, color:muted, textDecoration:'none', padding:'4px 10px', background: D?'#111':'#f5f5f5', border:`1px solid ${border}`, borderRadius:8 }}>
            ← Dashboard
          </Link>
          <button onClick={() => setDarkMode(!D)}
            style={{ fontSize:12, padding:'4px 8px', background: D?'#111':'#f5f5f5', border:`1px solid ${border}`, borderRadius:8, cursor:'pointer' }}>
            {D ? '☀️' : '🌙'}
          </button>
        </div>
      </nav>

      {/* MESSAGES */}
      <div style={{ flex:1, overflowY:'auto', padding:'16px', display:'flex', flexDirection:'column', gap:12, maxWidth:700, width:'100%', margin:'0 auto' }}>

        {!isConnected && (
          <div style={{ background: D?'#1a1500':'#fef9ec', border:'1px solid #2a2500', borderRadius:12, padding:'12px 14px', display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:8 }}>
            <span style={{ fontSize:12, color:'#c9a84c' }}>Connect your wallet to unlock send/bridge/swap actions</span>
            <button onClick={() => connect({ connector: injected() })}
              style={{ fontSize:11, padding:'5px 12px', background:'linear-gradient(135deg,#c9a84c,#a07830)', color:'#000', border:'none', borderRadius:8, cursor:'pointer', fontWeight:700 }}>
              Connect Wallet
            </button>
          </div>
        )}

        {messages.map(msg => (
          <div key={msg.id} style={{ display:'flex', flexDirection:'column', alignItems: msg.role==='user'?'flex-end':'flex-start' }}>
            {msg.role === 'assistant' && (
              <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:4 }}>
                <div style={{ position:'relative', width:22, height:22 }}>
                  <div style={{ position:'absolute', inset:-1, borderRadius:'50%', background:'conic-gradient(transparent 0deg,#c9a84c 60deg,transparent 120deg)', animation:'sweep 3s linear infinite', opacity:.5 }} />
                  <div style={{ position:'absolute', inset:1, borderRadius:'50%', background: D?'#111':'#f5f5f5', display:'flex', alignItems:'center', justifyContent:'center' }}>
                    <WavesLogo size={12} />
                  </div>
                </div>
                <span style={{ fontSize:10, fontWeight:700, color:'#c9a84c' }}>Arc AI</span>
              </div>
            )}
            <div style={{
              maxWidth:'85%',
              padding:'10px 14px',
              borderRadius: msg.role==='user' ? '16px 16px 4px 16px' : '4px 16px 16px 16px',
              fontSize:13,
              lineHeight:1.6,
              background: msg.role==='user'
                ? D?'#1a1500':'#fef9ec'
                : D?'#0e0e0e':'#fff',
              border: msg.role==='user'
                ? '1px solid #2a2500'
                : `1px solid ${border}`,
              color: msg.role==='user' ? '#c9a84c' : text,
            }}>
              {formatContent(msg.content)}

              {msg.action && !msg.action.confirmed && (
                <div style={{ marginTop:12, padding:'10px 12px', background: D?'#080808':'#f8f8f8', border:`1px solid ${border}`, borderRadius:10 }}>
                  <div style={{ fontSize:11, color:muted, marginBottom:8 }}>
                    {msg.action.type === 'send' && `Send ${msg.action.amount} USDC to ${msg.action.to}`}
                    {msg.action.type === 'bridge' && `Bridge ${msg.action.amount} USDC`}
                    {msg.action.type === 'swap' && `Swap ${msg.action.amount} ${msg.action.token}`}
                  </div>
                  <div style={{ display:'flex', gap:6 }}>
                    <button onClick={() => confirmAction(msg.id, msg.action)}
                      style={{ flex:1, padding:'7px 12px', background:'linear-gradient(135deg,#c9a84c,#a07830)', color:'#000', border:'none', borderRadius:8, fontSize:12, fontWeight:800, cursor:'pointer' }}>
                      ✓ Confirm
                    </button>
                    <button onClick={() => setMessages(prev => prev.map(m => m.id===msg.id ? {...m, action:{...m.action!, confirmed:true}} : m))}
                      style={{ padding:'7px 12px', background: D?'#1a0a0a':'#fff5f5', border:'1px solid #3a1a1a', borderRadius:8, fontSize:12, color:'#f87171', cursor:'pointer' }}>
                      ✕ Cancel
                    </button>
                  </div>
                </div>
              )}

              {msg.action?.confirmed && (
                <div style={{ marginTop:8, fontSize:11, color:'#4ade80' }}>✓ Action confirmed</div>
              )}
            </div>
          </div>
        ))}

        {loading && (
          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
            <div style={{ position:'relative', width:22, height:22 }}>
              <div style={{ position:'absolute', inset:-1, borderRadius:'50%', background:'conic-gradient(transparent 0deg,#c9a84c 60deg,transparent 120deg)', animation:'sweep 3s linear infinite', opacity:.5 }} />
              <div style={{ position:'absolute', inset:1, borderRadius:'50%', background: D?'#111':'#f5f5f5', display:'flex', alignItems:'center', justifyContent:'center' }}>
                <WavesLogo size={12} />
              </div>
            </div>
            <div style={{ background: D?'#0e0e0e':'#fff', border:`1px solid ${border}`, borderRadius:'4px 16px 16px 16px', padding:'10px 14px', display:'flex', gap:4 }}>
              {[0,1,2].map(i => (
                <div key={i} style={{ width:6, height:6, borderRadius:'50%', background:'#c9a84c', animation:`pulse 1.2s ease ${i*.2}s infinite` }} />
              ))}
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* QUICK SUGGESTIONS */}
      <div style={{ padding:'8px 16px', maxWidth:700, width:'100%', margin:'0 auto' }}>
        <div style={{ display:'flex', gap:6, overflowX:'auto', paddingBottom:4 }}>
          {QUICK_SUGGESTIONS.map(s => (
            <button key={s} onClick={() => sendMessage(s)}
              style={{ padding:'5px 10px', background: D?'#111':'#f5f5f5', border:`1px solid ${border}`, borderRadius:20, fontSize:10, color:muted, cursor:'pointer', whiteSpace:'nowrap', flexShrink:0, transition:'all .15s' }}
              onMouseEnter={e => { (e.target as HTMLElement).style.borderColor='#c9a84c'; (e.target as HTMLElement).style.color='#c9a84c' }}
              onMouseLeave={e => { (e.target as HTMLElement).style.borderColor=border; (e.target as HTMLElement).style.color=muted }}>
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* INPUT */}
      <div style={{ padding:'8px 16px 16px', maxWidth:700, width:'100%', margin:'0 auto' }}>
        <div style={{ display:'flex', gap:8, background: D?'#0e0e0e':'#fff', border:`1px solid ${border}`, borderRadius:14, padding:'8px 8px 8px 14px' }}>
          <input
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key==='Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() } }}
            placeholder="Ask AI: 'Send 10 USDC to Bob' or 'What's my balance?'"
            style={{ flex:1, background:'transparent', border:'none', color:text, fontSize:13, outline:'none' }}
          />
          <button onClick={() => sendMessage()} disabled={!input.trim() || loading}
            style={{ padding:'8px 16px', borderRadius:10, fontSize:12, fontWeight:800, border:'none', cursor: !input.trim()||loading?'default':'pointer',
              background: !input.trim()||loading?D?'#1a1a1a':'#e8e8e8':'linear-gradient(135deg,#c9a84c,#a07830)',
              color: !input.trim()||loading?D?'#444':'#bbb':'#000',
            }}>
            {loading ? (
              <span style={{ display:'inline-block', width:14, height:14, border:'2px solid #333', borderTopColor:'#c9a84c', borderRadius:'50%', animation:'spin .7s linear infinite' }} />
            ) : 'Send ↗'}
          </button>
        </div>
        <div style={{ textAlign:'center', fontSize:10, color: D?'#222':'#ccc', marginTop:6 }}>
          Arc AI · Powered by Claude · Arc Network
        </div>
      </div>
    </div>
  )
}