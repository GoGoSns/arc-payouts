'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

interface Contact {
  id: string
  name: string
  address: string
  ens?: string
  tags: string[]
  totalSent: number
  lastSent?: string
  notes?: string
}

const WavesLogo = ({ size = 20 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 48 48" fill="none">
    <path d="M14 18 C14 18 24 10 34 18" stroke="#c9a84c" strokeWidth="2.5" fill="none" strokeLinecap="round"/>
    <path d="M14 24 C14 24 24 16 34 24" stroke="#c9a84c" strokeWidth="2.5" fill="none" strokeLinecap="round"/>
    <path d="M14 30 C14 30 24 22 34 30" stroke="#c9a84c" strokeWidth="2.5" fill="none" strokeLinecap="round"/>
  </svg>
)

export default function ContactsPage() {
  const [contacts, setContacts] = useState<Contact[]>([])
  const [search, setSearch] = useState('')
  const [showNew, setShowNew] = useState(false)
  const [editContact, setEditContact] = useState<Contact | null>(null)
  const [darkMode, setDarkMode] = useState(true)
  const [newName, setNewName] = useState('')
  const [newAddress, setNewAddress] = useState('')
  const [newEns, setNewEns] = useState('')
  const [newTags, setNewTags] = useState('')
  const [newNotes, setNewNotes] = useState('')
  const [copied, setCopied] = useState<string | null>(null)

  const D = darkMode
  const bg = D ? '#080808' : '#f8f9fa'
  const card = D ? '#0e0e0e' : '#ffffff'
  const border = D ? '#1a1a1a' : '#e8e8e8'
  const text = D ? '#ffffff' : '#000000'
  const muted = D ? '#444444' : '#999999'
  const field = D ? '#080808' : '#f5f5f5'
  const fieldBorder = D ? '#181818' : '#e0e0e0'

  useEffect(() => {
    const stored = localStorage.getItem('arc_contacts')
    if (stored) setContacts(JSON.parse(stored))
  }, [])

  const saveContacts = (c: Contact[]) => {
    setContacts(c)
    localStorage.setItem('arc_contacts', JSON.stringify(c))
  }

  const addContact = () => {
    if (!newName || !newAddress) return
    const contact: Contact = {
      id: Math.random().toString(36).slice(2),
      name: newName,
      address: newAddress,
      ens: newEns || undefined,
      tags: newTags ? newTags.split(',').map(t => t.trim()).filter(Boolean) : [],
      totalSent: 0,
      notes: newNotes || undefined,
    }
    saveContacts([contact, ...contacts])
    setShowNew(false)
    resetForm()
  }

  const updateContact = () => {
    if (!editContact) return
    const updated = contacts.map(c => c.id === editContact.id ? {
      ...editContact,
      name: newName || editContact.name,
      address: newAddress || editContact.address,
      ens: newEns || editContact.ens,
      tags: newTags ? newTags.split(',').map(t => t.trim()).filter(Boolean) : editContact.tags,
      notes: newNotes || editContact.notes,
    } : c)
    saveContacts(updated)
    setEditContact(null)
    resetForm()
  }

  const deleteContact = (id: string) => {
    if (!confirm('Delete this contact?')) return
    saveContacts(contacts.filter(c => c.id !== id))
  }

  const resetForm = () => {
    setNewName('')
    setNewAddress('')
    setNewEns('')
    setNewTags('')
    setNewNotes('')
  }

  const startEdit = (contact: Contact) => {
    setEditContact(contact)
    setNewName(contact.name)
    setNewAddress(contact.address)
    setNewEns(contact.ens || '')
    setNewTags(contact.tags.join(', '))
    setNewNotes(contact.notes || '')
    setShowNew(true)
  }

  const copyAddress = (address: string, id: string) => {
    navigator.clipboard.writeText(address)
    setCopied(id)
    setTimeout(() => setCopied(null), 2000)
  }

  const filtered = contacts.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.address.toLowerCase().includes(search.toLowerCase()) ||
    (c.ens || '').toLowerCase().includes(search.toLowerCase()) ||
    c.tags.some(t => t.toLowerCase().includes(search.toLowerCase()))
  )

  const totalVolume = contacts.reduce((s, c) => s + c.totalSent, 0)

  const getTagStyle = (tag: string) => {
    const styles: Record<string, {bg:string,color:string,border:string}> = {
      'Friend':      { bg:'#0a1a0a', color:'#4ade80', border:'#1a3a1a' },
      'Work':        { bg:'#0a1628', color:'#60a5fa', border:'#1e3a5f' },
      'Arc Builder': { bg:'#1a1500', color:'#c9a84c', border:'#2a2500' },
      'Frequent':    { bg:'#1a1000', color:'#f59e0b', border:'#2a2000' },
    }
    return styles[tag] || { bg:'#1a1a1a', color:'#888', border:'#222' }
  }

  return (
    <div style={{ minHeight:'100vh', background:bg, color:text, fontFamily:'-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif' }}>
      <style>{`@keyframes sweep{from{transform:rotate(0)}to{transform:rotate(360deg)}}`}</style>

      {/* NAV */}
      <nav style={{ borderBottom:`1px solid ${border}`, padding:'11px 16px', display:'flex', alignItems:'center', justifyContent:'space-between', background:D?'#080808':'#fff', flexWrap:'wrap', gap:8 }}>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <div style={{ width:30, height:30, background:D?'#111':'#f5f5f5', border:`1px solid ${border}`, borderRadius:8, display:'flex', alignItems:'center', justifyContent:'center' }}>
            <WavesLogo size={16} />
          </div>
          <div>
            <div style={{ fontWeight:700, fontSize:13, color:text }}>Address Book</div>
            <div style={{ fontSize:8, color:'#c9a84c', fontWeight:700, letterSpacing:'.8px' }}>ARC NETWORK <span style={{ color:muted }}>· by GoGo</span></div>
          </div>
        </div>
        <div style={{ display:'flex', gap:8, alignItems:'center' }}>
          <Link href="/" style={{ fontSize:11, color:muted, textDecoration:'none', padding:'4px 10px', background:D?'#111':'#f5f5f5', border:`1px solid ${border}`, borderRadius:8 }}>← Dashboard</Link>
          <button onClick={() => setDarkMode(!D)} style={{ fontSize:12, padding:'4px 8px', background:D?'#111':'#f5f5f5', border:`1px solid ${border}`, borderRadius:8, cursor:'pointer' }}>{D?'☀️':'🌙'}</button>
          <button onClick={() => { setEditContact(null); resetForm(); setShowNew(true) }}
            style={{ padding:'5px 14px', background:'linear-gradient(135deg,#c9a84c,#a07830)', color:'#000', border:'none', borderRadius:8, fontSize:11, fontWeight:800, cursor:'pointer' }}>
            + Add Contact
          </button>
        </div>
      </nav>

      <div style={{ padding:16, maxWidth:900, margin:'0 auto' }}>

        {/* STATS */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:10, marginBottom:16 }}>
          {[
            { label:'CONTACTS', value:contacts.length.toString(), color:text },
            { label:'TOTAL VOLUME', value:`$${totalVolume.toFixed(0)}`, color:'#c9a84c' },
            { label:'WITH ENS', value:contacts.filter(c=>c.ens).length.toString(), color:'#a78bfa' },
          ].map(s => (
            <div key={s.label} style={{ background:card, border:`1px solid ${border}`, borderRadius:12, padding:'12px 14px' }}>
              <div style={{ fontSize:9, color:muted, fontWeight:700, letterSpacing:'.4px', marginBottom:3 }}>{s.label}</div>
              <div style={{ fontSize:22, fontWeight:300, color:s.color, letterSpacing:'-1px' }}>{s.value}</div>
            </div>
          ))}
        </div>

        {/* SEARCH */}
        <div style={{ marginBottom:14 }}>
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search by name, address, ENS, or tag..."
            style={{ width:'100%', padding:'9px 14px', background:D?'#0e0e0e':'#fff', border:`1px solid ${border}`, borderRadius:10, fontSize:13, color:text, outline:'none', boxSizing:'border-box' }} />
        </div>

        {/* FORM */}
        {showNew && (
          <div style={{ background:card, border:`1px solid ${border}`, borderRadius:16, padding:20, marginBottom:16 }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14 }}>
              <div style={{ fontWeight:700, fontSize:14, color:text }}>{editContact ? 'Edit Contact' : 'New Contact'}</div>
              <button onClick={() => { setShowNew(false); setEditContact(null); resetForm() }}
                style={{ color:muted, background:'none', border:'none', cursor:'pointer', fontSize:16 }}>✕</button>
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:10 }}>
              <div>
                <div style={{ fontSize:9, color:muted, fontWeight:700, letterSpacing:'.4px', marginBottom:5 }}>NAME *</div>
                <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Name"
                  style={{ width:'100%', padding:'9px 12px', background:field, border:`1px solid ${fieldBorder}`, borderRadius:10, fontSize:13, color:text, outline:'none', boxSizing:'border-box' }} />
              </div>
              <div>
                <div style={{ fontSize:9, color:muted, fontWeight:700, letterSpacing:'.4px', marginBottom:5 }}>ENS NAME</div>
                <input value={newEns} onChange={e => setNewEns(e.target.value)} placeholder="name.eth"
                  style={{ width:'100%', padding:'9px 12px', background:field, border:`1px solid ${fieldBorder}`, borderRadius:10, fontSize:13, color:text, outline:'none', boxSizing:'border-box' }} />
              </div>
            </div>
            <div style={{ marginBottom:10 }}>
              <div style={{ fontSize:9, color:muted, fontWeight:700, letterSpacing:'.4px', marginBottom:5 }}>WALLET ADDRESS *</div>
              <input value={newAddress} onChange={e => setNewAddress(e.target.value)} placeholder="0x..."
                style={{ width:'100%', padding:'9px 12px', background:field, border:`1px solid ${fieldBorder}`, borderRadius:10, fontSize:13, color:text, outline:'none', boxSizing:'border-box' }} />
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:14 }}>
              <div>
                <div style={{ fontSize:9, color:muted, fontWeight:700, letterSpacing:'.4px', marginBottom:5 }}>TAGS (comma separated)</div>
                <input value={newTags} onChange={e => setNewTags(e.target.value)} placeholder="Friend, Work, Arc Builder"
                  style={{ width:'100%', padding:'9px 12px', background:field, border:`1px solid ${fieldBorder}`, borderRadius:10, fontSize:13, color:text, outline:'none', boxSizing:'border-box' }} />
              </div>
              <div>
                <div style={{ fontSize:9, color:muted, fontWeight:700, letterSpacing:'.4px', marginBottom:5 }}>NOTES</div>
                <input value={newNotes} onChange={e => setNewNotes(e.target.value)} placeholder="Optional notes..."
                  style={{ width:'100%', padding:'9px 12px', background:field, border:`1px solid ${fieldBorder}`, borderRadius:10, fontSize:13, color:text, outline:'none', boxSizing:'border-box' }} />
              </div>
            </div>
            <button onClick={editContact ? updateContact : addContact}
              style={{ width:'100%', padding:12, background:'linear-gradient(135deg,#c9a84c,#a07830)', color:'#000', border:'none', borderRadius:12, fontSize:13, fontWeight:800, cursor:'pointer' }}>
              {editContact ? 'Update Contact' : 'Add Contact'}
            </button>
          </div>
        )}

        {/* CONTACTS */}
        {filtered.length === 0 ? (
          <div style={{ textAlign:'center', padding:'60px 20px' }}>
            <div style={{ fontSize:48, marginBottom:12 }}>👥</div>
            <div style={{ fontSize:16, fontWeight:700, color:text, marginBottom:6 }}>No contacts yet</div>
            <div style={{ fontSize:13, color:muted, marginBottom:20 }}>Add contacts to send USDC faster</div>
            <button onClick={() => setShowNew(true)}
              style={{ padding:'10px 24px', background:'linear-gradient(135deg,#c9a84c,#a07830)', color:'#000', border:'none', borderRadius:12, fontSize:13, fontWeight:800, cursor:'pointer' }}>
              + Add Contact
            </button>
          </div>
        ) : (
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(280px,1fr))', gap:10 }}>
            {filtered.map(contact => (
              <div key={contact.id} style={{ background:card, border:`1px solid ${border}`, borderRadius:14, padding:14 }}>
                <div style={{ display:'flex', alignItems:'flex-start', gap:10, marginBottom:10 }}>
                  <div style={{ width:40, height:40, borderRadius:'50%', background:'linear-gradient(135deg,#c9a84c,#a07830)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:16, fontWeight:800, color:'#000', flexShrink:0 }}>
                    {contact.name[0]?.toUpperCase()}
                  </div>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontWeight:700, fontSize:13, color:text }}>{contact.name}</div>
                    {contact.ens && <div style={{ fontSize:11, color:'#a78bfa', marginTop:1 }}>{contact.ens}</div>}
                    <div style={{ fontSize:10, color:muted, fontFamily:'monospace', marginTop:1 }}>
                      {contact.address.slice(0,8)}...{contact.address.slice(-6)}
                    </div>
                  </div>
                  <button onClick={() => copyAddress(contact.address, contact.id)}
                    style={{ fontSize:10, padding:'3px 7px', background:D?'#141414':'#f0f0f0', border:`1px solid ${border}`, borderRadius:6, color:copied===contact.id?'#c9a84c':muted, cursor:'pointer', flexShrink:0 }}>
                    {copied===contact.id ? '✓' : '⎘'}
                  </button>
                </div>

                {contact.tags.length > 0 && (
                  <div style={{ display:'flex', flexWrap:'wrap', gap:4, marginBottom:10 }}>
                    {contact.tags.map(tag => {
                      const ts = getTagStyle(tag)
                      return (
                        <span key={tag} style={{ padding:'2px 8px', borderRadius:6, fontSize:10, fontWeight:700, background:ts.bg, color:ts.color, border:`1px solid ${ts.border}` }}>
                          {tag}
                        </span>
                      )
                    })}
                  </div>
                )}

                {contact.notes && (
                  <div style={{ fontSize:11, color:muted, marginBottom:10, padding:'6px 8px', background:D?'#080808':'#f9f9f9', borderRadius:8, border:`1px solid ${border}` }}>
                    {contact.notes}
                  </div>
                )}

                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10 }}>
                  <div style={{ fontSize:11, color:muted }}>
                    Total sent: <span style={{ color:'#c9a84c', fontWeight:700 }}>${contact.totalSent.toFixed(0)}</span>
                  </div>
                  {contact.lastSent && (
                    <div style={{ fontSize:10, color:muted }}>
                      {new Date(contact.lastSent).toLocaleDateString('en-US', { month:'short', day:'numeric' })}
                    </div>
                  )}
                </div>

                <div style={{ display:'flex', gap:6 }}>
                  <Link href={`/?to=${contact.address}`}
                    style={{ flex:1, padding:'7px 0', background:'linear-gradient(135deg,#c9a84c,#a07830)', color:'#000', border:'none', borderRadius:8, fontSize:11, fontWeight:800, cursor:'pointer', textAlign:'center', textDecoration:'none' }}>
                    Send USDC
                  </Link>
                  <button onClick={() => startEdit(contact)}
                    style={{ padding:'7px 12px', background:D?'#111':'#f5f5f5', border:`1px solid ${border}`, borderRadius:8, fontSize:11, color:muted, cursor:'pointer' }}>
                    Edit
                  </button>
                  <button onClick={() => deleteContact(contact.id)}
                    style={{ padding:'7px 10px', background:D?'#1a0a0a':'#fff5f5', border:'1px solid #2a1a1a', borderRadius:8, fontSize:11, color:'#f87171', cursor:'pointer' }}>
                    ✕
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}