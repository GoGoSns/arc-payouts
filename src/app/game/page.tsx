'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useAccount, useConnect } from 'wagmi'
import { injected } from 'wagmi/connectors'

const WavesLogo = ({ size = 20 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 48 48" fill="none">
    <path d="M14 18 C14 18 24 10 34 18" stroke="#c9a84c" strokeWidth="2.5" fill="none" strokeLinecap="round"/>
    <path d="M14 24 C14 24 24 16 34 24" stroke="#c9a84c" strokeWidth="2.5" fill="none" strokeLinecap="round"/>
    <path d="M14 30 C14 30 24 22 34 30" stroke="#c9a84c" strokeWidth="2.5" fill="none" strokeLinecap="round"/>
  </svg>
)

const DIFFS = {
  easy:   { speed:1.2, gap:110, grav:0.22, jump:-6.0, pipeInterval:280, maxUsdc:3,  mult:0.5 },
  medium: { speed:2.0, gap:80,  grav:0.32, jump:-7.0, pipeInterval:200, maxUsdc:5,  mult:1   },
  hard:   { speed:2.8, gap:65,  grav:0.38, jump:-7.5, pipeInterval:175, maxUsdc:10, mult:2   },
}

export default function GamePage() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const gameRef = useRef<any>({})
  const animRef = useRef<number>(0)
  const { isConnected } = useAccount()
  const { connect } = useConnect()

  const [diff, setDiff] = useState<'easy'|'medium'|'hard'>('easy')
  const [score, setScore] = useState(0)
  const [usdc, setUsdc] = useState(0)
  const [combo, setCombo] = useState(1)
  const [lives, setLives] = useState(3)
  const [best, setBest] = useState(0)
  const [gameState, setGameState] = useState<'idle'|'running'|'over'>('idle')
  const [shieldActive, setShieldActive] = useState(false)
  const [slowActive, setSlowActive] = useState(false)
  const [doubleActive, setDoubleActive] = useState(false)
  const [comboMsg, setComboMsg] = useState('')
  const [leaderboard, setLeaderboard] = useState<{name:string,score:number,usdc:number}[]>([])
  const [sending, setSending] = useState(false)
  const [txHash, setTxHash] = useState('')
  const [sendTarget, setSendTarget] = useState('')

  const stateRef = useRef({
    score:0, usdc:0, combo:1, lives:3, best:0,
    gameState:'idle' as 'idle'|'running'|'over',
    shieldActive:false, slowActive:false, doubleActive:false,
    diff:'easy' as 'easy'|'medium'|'hard'
  })

  const syncState = () => {
    setScore(stateRef.current.score)
    setUsdc(stateRef.current.usdc)
    setCombo(stateRef.current.combo)
    setLives(stateRef.current.lives)
    setBest(stateRef.current.best)
    setShieldActive(stateRef.current.shieldActive)
    setSlowActive(stateRef.current.slowActive)
    setDoubleActive(stateRef.current.doubleActive)
  }

  const initGame = (d: 'easy'|'medium'|'hard') => {
    const cfg = DIFFS[d]
    const g = gameRef.current
    g.bird = { x:90, y:200, vy:0, r:13, angle:0 }
    g.pipes = []; g.powerups = []; g.particles = []
    g.stars = Array.from({length:50}, () => ({
      x:Math.random()*560, y:Math.random()*400*.7,
      r:Math.random()*1.5+.3, spd:Math.random()*.2+.05
    }))
    g.buildings = Array.from({length:10}, (_,i) => ({
      x:i*60, w:30+Math.random()*25, h:15+Math.random()*45
    }))
    g.frame = 0
    g.cfg = cfg
    stateRef.current = {
      ...stateRef.current,
      score:0, usdc:0, combo:1, lives:3,
      gameState:'idle', shieldActive:false,
      slowActive:false, doubleActive:false, diff:d
    }
    syncState()
    setGameState('idle')
    setComboMsg('')
    setTxHash('')
  }

  const flapGame = () => {
    const s = stateRef.current
    if (s.gameState === 'over') { initGame(s.diff); return }
    if (s.gameState === 'idle') {
      stateRef.current.gameState = 'running'
      setGameState('running')
    }
    gameRef.current.bird.vy = gameRef.current.cfg.jump
    gameRef.current.bird.angle = -0.4
  }

  const spawnParticles = (x:number, y:number, color:string, n=8) => {
    for (let i=0;i<n;i++) {
      const a = Math.random()*Math.PI*2
      gameRef.current.particles.push({
        x, y,
        vx: Math.cos(a)*(2+Math.random()*2),
        vy: Math.sin(a)*(2+Math.random()*2),
        life: 1, color
      })
    }
  }

  const loseLife = () => {
    const s = stateRef.current
    spawnParticles(gameRef.current.bird.x, gameRef.current.bird.y, '#f87171', 16)
    const newLives = s.lives - 1
    stateRef.current.lives = newLives
    stateRef.current.combo = 1
    if (newLives <= 0) {
      stateRef.current.gameState = 'over'
      setGameState('over')
      const newBest = Math.max(s.best, s.score)
      stateRef.current.best = newBest
      if (s.usdc > 0) {
        setLeaderboard(prev => {
          return [...prev, { name:'GoGo', score:s.score, usdc:s.usdc }]
            .sort((a,b) => b.score-a.score).slice(0,5)
        })
        const stored = localStorage.getItem('arc_transactions')
        const existing = stored ? JSON.parse(stored) : []
        localStorage.setItem('arc_transactions', JSON.stringify([
          { id:Math.random().toString(36).slice(2), name:'Flappy USDC Game', address:'', amount:s.usdc.toFixed(2), txHash:'', timestamp:new Date().toISOString() },
          ...existing
        ]))
      }
    } else {
      gameRef.current.bird = { ...gameRef.current.bird, y:200, vy:0 }
    }
    syncState()
  }

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')!
    initGame('easy')

    const handleKey = (e:KeyboardEvent) => {
      if (e.code === 'Space') { e.preventDefault(); flapGame() }
    }
    window.addEventListener('keydown', handleKey)

    const loop = () => {
      const W = canvas.width, H = canvas.height
      const s = stateRef.current
      const g = gameRef.current
      const cfg = g.cfg || DIFFS.easy

      ctx.clearRect(0,0,W,H)
      ctx.fillStyle = '#050810'
      ctx.fillRect(0,0,W,H)

      g.stars?.forEach((st:any) => {
        if (s.gameState === 'running') { st.x -= st.spd; if (st.x < 0) st.x = W }
        ctx.beginPath(); ctx.arc(st.x,st.y,st.r,0,Math.PI*2)
        ctx.fillStyle = `rgba(201,168,76,${0.2+st.r*.15})`; ctx.fill()
      })

      g.buildings?.forEach((b:any) => {
        if (s.gameState === 'running') {
          b.x -= 0.4
          if (b.x+b.w < 0) { b.x = W+10; b.h = 15+Math.random()*45 }
        }
        ctx.fillStyle = '#0d0d14'; ctx.fillRect(b.x,H-b.h,b.w,b.h)
        for (let wy=H-b.h+5;wy<H-4;wy+=10)
          for (let wx=b.x+3;wx<b.x+b.w-3;wx+=7)
            if (Math.random() > .75) { ctx.fillStyle='#c9a84c22'; ctx.fillRect(wx,wy,3,4) }
      })

      ctx.fillStyle = '#1a1a1a'; ctx.fillRect(0,H-2,W,2)

      if (s.gameState === 'idle') {
        ctx.fillStyle = '#c9a84c'; ctx.font = '700 15px system-ui'; ctx.textAlign = 'center'
        ctx.fillText('Tap or SPACE to start', W/2, H/2-4)
        ctx.fillStyle = '#555'; ctx.font = '11px system-ui'
        ctx.fillText('Pass pipes to earn USDC!', W/2, H/2+16)
        ctx.textAlign = 'left'
      }

      if (s.gameState === 'running') {
        g.frame++
        const spd = s.slowActive ? cfg.speed*.5 : cfg.speed
        g.bird.vy += cfg.grav
        g.bird.y += g.bird.vy
        g.bird.angle = Math.max(-0.45, Math.min(1.3, g.bird.vy*.08))

        if (s.shieldActive) { g.shieldTimer=(g.shieldTimer||0)-1; if(g.shieldTimer<=0){stateRef.current.shieldActive=false;setShieldActive(false)} }
        if (s.slowActive)   { g.slowTimer=(g.slowTimer||0)-1;   if(g.slowTimer<=0){stateRef.current.slowActive=false;setSlowActive(false)} }
        if (s.doubleActive) { g.doubleTimer=(g.doubleTimer||0)-1; if(g.doubleTimer<=0){stateRef.current.doubleActive=false;setDoubleActive(false)} }

        if (!g.pipes.length || g.pipes[g.pipes.length-1].x < W-cfg.pipeInterval) {
          g.pipes.push({ x:W, topH:40+Math.random()*(H-cfg.gap-80), passed:false })
        }

        if (g.frame%280 === 0) {
          const types = ['shield','slow','double']
          g.powerups.push({ x:W, y:40+Math.random()*(H-80), type:types[Math.floor(Math.random()*3)], r:11 })
        }

        g.powerups.forEach((p:any, i:number) => {
          p.x -= spd
          const dx=g.bird.x-p.x, dy=g.bird.y-p.y
          if (Math.sqrt(dx*dx+dy*dy) < g.bird.r+p.r) {
            if (p.type==='shield') { stateRef.current.shieldActive=true; g.shieldTimer=360; setShieldActive(true) }
            else if (p.type==='slow') { stateRef.current.slowActive=true; g.slowTimer=360; setSlowActive(true) }
            else { stateRef.current.doubleActive=true; g.doubleTimer=360; setDoubleActive(true) }
            spawnParticles(p.x,p.y,'#c9a84c',14)
            g.powerups.splice(i,1)
          }
        })
        g.powerups = g.powerups.filter((p:any) => p.x > -30)

        g.pipes.forEach((p:any) => {
          p.x -= spd
          if (!p.passed && p.x+28 < g.bird.x) {
            p.passed = true
            const newScore = s.score+1
            const newCombo = Math.min(s.combo+1, 5)
            const mul = s.doubleActive ? 2 : 1
            const earned = parseFloat((cfg.mult*0.5*mul*(newCombo>=3?1+newCombo*.2:1)).toFixed(2))
            const newUsdc = Math.min(parseFloat((s.usdc+earned).toFixed(2)), cfg.maxUsdc)
            stateRef.current.score = newScore
            stateRef.current.combo = newCombo
            stateRef.current.usdc = newUsdc
            spawnParticles(g.bird.x,g.bird.y,'#c9a84c',8)
            if (newCombo>=3) { setComboMsg(`COMBO x${newCombo}! +${earned} USDC`); setTimeout(()=>setComboMsg(''),1000) }
            syncState()
          }
          const hb = g.bird.r-3
          if (g.bird.x+hb>p.x+3 && g.bird.x-hb<p.x+25) {
            if (g.bird.y-hb<p.topH || g.bird.y+hb>p.topH+cfg.gap) {
              if (s.shieldActive) {
                stateRef.current.shieldActive=false; g.shieldTimer=0; setShieldActive(false)
                spawnParticles(g.bird.x,g.bird.y,'#60a5fa',12)
              } else loseLife()
            }
          }
        })
        g.pipes = g.pipes.filter((p:any) => p.x > -35)
        if (g.bird.y-g.bird.r+2<0 || g.bird.y+g.bird.r-2>H) loseLife()
      }

      g.pipes?.forEach((p:any) => {
        const pc = s.shieldActive?'#1e3a5f':'#1a1500'
        const bc = s.shieldActive?'#60a5fa':'#c9a84c'
        ctx.fillStyle=pc; ctx.fillRect(p.x,0,28,p.topH); ctx.fillRect(p.x,p.topH+cfg.gap,28,H-p.topH-cfg.gap)
        ctx.fillStyle=bc; ctx.fillRect(p.x-3,p.topH-9,34,9); ctx.fillRect(p.x-3,p.topH+cfg.gap,34,9)
        ctx.strokeStyle=bc+'44'; ctx.lineWidth=1.5; ctx.lineCap='round'
        const mx=p.x+14, my=p.topH/2
        ;[-6,0,6].forEach((dy:number) => {
          ctx.beginPath(); ctx.moveTo(mx-5,my+dy); ctx.quadraticCurveTo(mx,my+dy-5,mx+5,my+dy); ctx.stroke()
        })
      })

      g.powerups?.forEach((p:any) => {
        const colors:Record<string,string>={shield:'#60a5fa',slow:'#c9a84c',double:'#4ade80'}
        const c=colors[p.type]
        ctx.beginPath(); ctx.arc(p.x,p.y,p.r,0,Math.PI*2)
        ctx.fillStyle=c+'33'; ctx.fill()
        ctx.strokeStyle=c; ctx.lineWidth=1.5; ctx.stroke()
        ctx.fillStyle=c; ctx.font='700 8px system-ui'; ctx.textAlign='center'; ctx.textBaseline='middle'
        ctx.fillText(p.type==='shield'?'S':p.type==='slow'?'T':'2x',p.x,p.y)
        ctx.textAlign='left'; ctx.textBaseline='alphabetic'
      })

      g.particles?.forEach((p:any) => {
        p.x+=p.vx; p.y+=p.vy; p.life-=0.05; p.vy+=.08
        ctx.beginPath(); ctx.arc(p.x,p.y,3*p.life,0,Math.PI*2)
        ctx.fillStyle=p.color+Math.floor(p.life*255).toString(16).padStart(2,'0'); ctx.fill()
      })
      if (g.particles) g.particles=g.particles.filter((p:any)=>p.life>0)

      const b = g.bird
      if (b) {
        ctx.save(); ctx.translate(b.x,b.y); ctx.rotate(b.angle)
        if (s.shieldActive) { ctx.beginPath(); ctx.arc(0,0,b.r+6,0,Math.PI*2); ctx.fillStyle='#60a5fa22'; ctx.fill() }
        ctx.beginPath(); ctx.arc(0,0,b.r,0,Math.PI*2)
        ctx.fillStyle=s.gameState==='over'?'#f87171':s.shieldActive?'#60a5fa':'#c9a84c'; ctx.fill()
        ctx.strokeStyle=s.gameState==='over'?'#7f1d1d':s.shieldActive?'#1e3a5f':'#a07830'; ctx.lineWidth=2; ctx.stroke()
        ctx.fillStyle='#000'; ctx.font='700 12px system-ui'; ctx.textAlign='center'; ctx.textBaseline='middle'
        ctx.fillText('$',0,0); ctx.restore()
      }

      if (s.gameState==='over') {
        ctx.fillStyle='rgba(0,0,0,.72)'; ctx.fillRect(0,0,W,H)
        ctx.fillStyle='#f87171'; ctx.font='700 20px system-ui'; ctx.textAlign='center'
        ctx.fillText('GAME OVER',W/2,H/2-20)
        ctx.fillStyle='#c9a84c'; ctx.font='700 14px system-ui'
        ctx.fillText(`${s.score} pipes → ${s.usdc.toFixed(2)} USDC earned`,W/2,H/2+4)
        ctx.fillStyle='#555'; ctx.font='12px system-ui'
        ctx.fillText('Tap or SPACE to retry',W/2,H/2+26)
        ctx.textAlign='left'
      }

      animRef.current = requestAnimationFrame(loop)
    }

    animRef.current = requestAnimationFrame(loop)
    return () => { cancelAnimationFrame(animRef.current); window.removeEventListener('keydown', handleKey) }
  }, [])

  const handleDiff = (d:'easy'|'medium'|'hard') => { setDiff(d); stateRef.current.diff=d; initGame(d) }

  const sendUsdc = async () => {
    if (!isConnected||!sendTarget||stateRef.current.usdc<=0) return
    setSending(true)
    try {
      const {AppKit}=await import('@circle-fin/app-kit')
      const {createViemAdapterFromProvider}=await import('@circle-fin/adapter-viem-v2')
      const kit=new AppKit()
      const adapter=await createViemAdapterFromProvider({provider:(window as any).ethereum})
      const res=await kit.send({from:{adapter,chain:'Arc_Testnet' as never},to:sendTarget,amount:stateRef.current.usdc.toFixed(2),token:'USDC'})
      setTxHash((res as any)?.hash||(res as any)?.txHash||'')
    } catch(e:any) { alert('Error: '+e.message) }
    setSending(false)
  }

  const shareScore = () => {
    const s = stateRef.current
    const t = `I just earned ${s.usdc.toFixed(2)} USDC playing Flappy USDC on Arc Network! 🎮⚡\n\nScore: ${s.score} pipes\n\narc-payouts.vercel.app/game\n\n#ArcNetwork #USDC #DeFi`
    window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(t)}`,'_blank')
  }

  const medals = ['🥇','🥈','🥉','4.','5.']

  return (
    <div style={{minHeight:'100vh',background:'#080808',color:'#fff',fontFamily:'-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif'}}>
      <nav style={{borderBottom:'1px solid #141414',padding:'11px 16px',display:'flex',alignItems:'center',justifyContent:'space-between',background:'#080808'}}>
        <div style={{display:'flex',alignItems:'center',gap:10}}>
          <div style={{width:30,height:30,background:'#111',border:'1px solid #1e1e1e',borderRadius:8,display:'flex',alignItems:'center',justifyContent:'center'}}>
            <WavesLogo size={16}/>
          </div>
          <div>
            <div style={{fontWeight:700,fontSize:13,color:'#fff'}}>Flappy USDC</div>
            <div style={{fontSize:8,color:'#c9a84c',fontWeight:700,letterSpacing:'.8px'}}>ARC NETWORK <span style={{color:'#444'}}>· by GoGo</span></div>
          </div>
        </div>
        <div style={{display:'flex',alignItems:'center',gap:8}}>
          {(['easy','medium','hard'] as const).map(d=>(
            <button key={d} onClick={()=>handleDiff(d)}
              style={{padding:'5px 12px',borderRadius:8,fontSize:11,fontWeight:700,border:'1px solid',cursor:'pointer',
                borderColor:diff===d?'#c9a84c':'#1a1a1a',background:diff===d?'#1a1500':'#0e0e0e',color:diff===d?'#c9a84c':'#555'}}>
              {d.charAt(0).toUpperCase()+d.slice(1)}
            </button>
          ))}
          <Link href="/" style={{fontSize:11,color:'#555',textDecoration:'none',padding:'5px 10px',background:'#111',border:'1px solid #1e1e1e',borderRadius:8}}>← Back</Link>
        </div>
      </nav>

      <div style={{padding:'12px 16px',maxWidth:640,margin:'0 auto'}}>
        <div style={{display:'flex',gap:8,marginBottom:10}}>
          {[
            {label:'PIPES',value:score,color:'#fff'},
            {label:'USDC',value:usdc.toFixed(2),color:'#c9a84c'},
            {label:'COMBO',value:`x${combo}`,color:'#c9a84c'},
            {label:'LIVES',value:'♥'.repeat(Math.max(0,lives)),color:'#f87171'},
            {label:'BEST',value:best,color:'#c9a84c'},
          ].map(s=>(
            <div key={s.label} style={{flex:1,background:'#0e0e0e',border:'1px solid #1a1a1a',borderRadius:10,padding:'7px 8px',textAlign:'center'}}>
              <div style={{fontSize:8,color:'#444',fontWeight:700,letterSpacing:'.4px'}}>{s.label}</div>
              <div style={{fontSize:15,fontWeight:300,color:s.color,letterSpacing:'-1px'}}>{s.value}</div>
            </div>
          ))}
        </div>

        <div style={{position:'relative',marginBottom:8}}>
          <canvas ref={canvasRef} width={560} height={220} onClick={flapGame}
            style={{width:'100%',borderRadius:12,border:'1px solid #1a1a1a',cursor:'pointer',display:'block'}}/>
          {comboMsg&&(
            <div style={{position:'absolute',top:14,left:'50%',transform:'translateX(-50%)',background:'#c9a84c',color:'#000',padding:'4px 14px',borderRadius:20,fontSize:12,fontWeight:800,whiteSpace:'nowrap',pointerEvents:'none'}}>
              {comboMsg}
            </div>
          )}
        </div>

        <div style={{display:'flex',gap:6,marginBottom:10,flexWrap:'wrap'}}>
          {[
            {id:'shield',label:'🛡 Shield',active:shieldActive,color:'#60a5fa',bg:'#0a1628',border:'#1e3a5f'},
            {id:'slow',label:'⏰ Slow',active:slowActive,color:'#c9a84c',bg:'#1a1500',border:'#2a2500'},
            {id:'double',label:'2x USDC',active:doubleActive,color:'#4ade80',bg:'#0a1a0a',border:'#1a3a1a'},
          ].map(p=>(
            <div key={p.id} style={{padding:'4px 10px',borderRadius:8,fontSize:10,fontWeight:700,border:`1px solid ${p.border}`,background:p.bg,color:p.color,opacity:p.active?1:.35,transition:'opacity .3s'}}>
              {p.label}{p.active?' ACTIVE':''}
            </div>
          ))}
          <div style={{marginLeft:'auto',fontSize:10,color:'#333',alignSelf:'center'}}>SPACE / tap to flap</div>
        </div>

        <div style={{display:'flex',gap:8,marginBottom:10,flexWrap:'wrap'}}>
          {gameState==='over'&&usdc>0&&(
            isConnected?(
              <div style={{flex:1,display:'flex',gap:6}}>
                <input value={sendTarget} onChange={e=>setSendTarget(e.target.value)} placeholder="Send to address (0x...)"
                  style={{flex:1,padding:'10px 12px',background:'#0e0e0e',border:'1px solid #1a1a1a',borderRadius:10,fontSize:12,color:'#fff',outline:'none'}}/>
                <button onClick={sendUsdc} disabled={sending||!sendTarget}
                  style={{padding:'10px 16px',borderRadius:10,fontSize:12,fontWeight:800,border:'none',
                    cursor:sending||!sendTarget?'default':'pointer',
                    background:sending||!sendTarget?'#1a1a1a':'linear-gradient(135deg,#c9a84c,#a07830)',
                    color:sending||!sendTarget?'#444':'#000'}}>
                  {sending?'Sending...':`Send ${usdc.toFixed(2)} USDC →`}
                </button>
              </div>
            ):(
              <button onClick={()=>connect({connector:injected()})}
                style={{flex:1,padding:'10px',background:'linear-gradient(135deg,#c9a84c,#a07830)',color:'#000',border:'none',borderRadius:10,fontSize:12,fontWeight:800,cursor:'pointer'}}>
                Connect Wallet to Send {usdc.toFixed(2)} USDC
              </button>
            )
          )}
          {gameState!=='over'&&(
            <div style={{flex:1,padding:'10px',background:'#1a1a1a',borderRadius:10,fontSize:12,color:'#444',textAlign:'center'}}>
              🎮 Play to earn USDC
            </div>
          )}
          <button onClick={shareScore}
            style={{padding:'10px 14px',background:'#0a1628',border:'1px solid #1e3a5f',borderRadius:10,fontSize:12,color:'#60a5fa',cursor:'pointer',fontWeight:700}}>
            𝕏 Share
          </button>
          <button onClick={()=>{stateRef.current.diff=diff;initGame(diff)}}
            style={{padding:'10px 14px',background:'#111',border:'1px solid #222',borderRadius:10,fontSize:12,color:'#888',cursor:'pointer'}}>
            ↺ Retry
          </button>
        </div>

        {txHash&&(
          <div style={{background:'#0e0e0e',border:'1px solid #1a3a1a',borderRadius:10,padding:'10px 14px',marginBottom:10}}>
            <div style={{fontSize:12,fontWeight:700,color:'#4ade80',marginBottom:4}}>✓ USDC Sent!</div>
            <a href={`https://testnet.arcscan.app/tx/${txHash}`} target="_blank" rel="noopener noreferrer"
              style={{fontSize:11,color:'#c9a84c',textDecoration:'none'}}>View on ArcScan →</a>
          </div>
        )}

        {leaderboard.length>0&&(
          <div style={{background:'#0e0e0e',border:'1px solid #1a1a1a',borderRadius:14,padding:14}}>
            <div style={{fontSize:10,fontWeight:700,letterSpacing:'.5px',color:'#444',marginBottom:12}}>🏆 LEADERBOARD</div>
            {leaderboard.map((r,i)=>(
              <div key={i} style={{display:'flex',alignItems:'center',gap:10,padding:'7px 0',borderBottom:i<leaderboard.length-1?'1px solid #141414':'none'}}>
                <div style={{width:22,fontSize:11,fontWeight:700,color:i===0?'#c9a84c':'#444'}}>{medals[i]}</div>
                <div style={{flex:1,fontSize:12,color:'#ccc'}}>GoGo</div>
                <div style={{fontSize:12,fontWeight:700,color:'#c9a84c'}}>{r.score} pipes</div>
                <div style={{fontSize:11,color:'#555',marginLeft:6}}>= {r.usdc.toFixed(2)} USDC</div>
              </div>
            ))}
          </div>
        )}

        <div style={{textAlign:'center',marginTop:12,fontSize:10,color:'#1a1a1a'}}>
          Arc Global Payouts · Flappy USDC · by GoGo
        </div>
      </div>
    </div>
  )
}