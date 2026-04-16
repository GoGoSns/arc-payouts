'use client'

import { useState, useEffect, useCallback, useRef, Suspense } from 'react'
import Link from 'next/link'
import { useAccount, useConnect } from 'wagmi'
import { injected } from 'wagmi/connectors'
import { useSearchParams } from 'next/navigation'

const WavesLogo = ({ size = 20 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 48 48" fill="none">
    <path d="M14 18 C14 18 24 10 34 18" stroke="#c9a84c" strokeWidth="2.5" fill="none" strokeLinecap="round"/>
    <path d="M14 24 C14 24 24 16 34 24" stroke="#c9a84c" strokeWidth="2.5" fill="none" strokeLinecap="round"/>
    <path d="M14 30 C14 30 24 22 34 30" stroke="#c9a84c" strokeWidth="2.5" fill="none" strokeLinecap="round"/>
  </svg>
)

const COLS = 10, ROWS = 20, BLOCK = 26

const PIECES = [
  { shape:[[1,1,1,1]], color:'#60a5fa' },
  { shape:[[1,1],[1,1]], color:'#c9a84c' },
  { shape:[[1,1,1],[0,1,0]], color:'#a78bfa' },
  { shape:[[1,1,1],[1,0,0]], color:'#f87171' },
  { shape:[[1,1,1],[0,0,1]], color:'#4ade80' },
  { shape:[[1,1,0],[0,1,1]], color:'#fb923c' },
  { shape:[[0,1,1],[1,1,0]], color:'#e879f9' },
]

const emptyBoard = () => Array.from({length:ROWS}, () => Array(COLS).fill(0))
const rotate = (m: number[][]) => Array.from({length:m[0].length}, (_,i) => Array.from({length:m.length}, (_,j) => m[m.length-1-j][i]))
const randPiece = () => { const p=PIECES[Math.floor(Math.random()*PIECES.length)]; return {shape:p.shape,color:p.color,x:Math.floor(COLS/2)-Math.floor(p.shape[0].length/2),y:0} }

function GameContent() {
  const searchParams = useSearchParams()
  const { address, isConnected } = useAccount()
  const { connect } = useConnect()

  const betAmount = searchParams.get('bet') || ''
  const betTo = searchParams.get('to') || ''
  const betTarget = parseInt(searchParams.get('target') || '0')
  const betFrom = searchParams.get('from') || ''
  const isChallengeMode = !!(betAmount && betTo && betTarget)

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [board, setBoard] = useState(emptyBoard())
  const [current, setCurrent] = useState(randPiece())
  const [next, setNext] = useState(randPiece())
  const [score, setScore] = useState(0)
  const [lines, setLines] = useState(0)
  const [level, setLevel] = useState(1)
  const [gameState, setGameState] = useState<'idle'|'running'|'over'|'won'>('idle')
  const [highScore, setHighScore] = useState(0)
  const [sending, setSending] = useState(false)
  const [txHash, setTxHash] = useState('')
  const [timeLeft, setTimeLeft] = useState(180)
  const [createBet, setCreateBet] = useState(false)
  const [betAmountInput, setBetAmountInput] = useState('10')
  const [betTargetInput, setBetTargetInput] = useState('20')
  const [betToInput, setBetToInput] = useState('')
  const [betLink, setBetLink] = useState('')
  const [copied, setCopied] = useState(false)

  const boardRef = useRef(board)
  const currentRef = useRef(current)
  const gsRef = useRef(gameState)
  const scoreRef = useRef(score)
  const linesRef = useRef(lines)
  const levelRef = useRef(level)

  useEffect(() => { boardRef.current=board }, [board])
  useEffect(() => { currentRef.current=current }, [current])
  useEffect(() => { gsRef.current=gameState }, [gameState])
  useEffect(() => { scoreRef.current=score }, [score])
  useEffect(() => { linesRef.current=lines }, [lines])
  useEffect(() => { levelRef.current=level }, [level])
  useEffect(() => { const hs=localStorage.getItem('tetris_hs'); if(hs)setHighScore(parseInt(hs)) }, [])

  useEffect(() => {
    if (!isChallengeMode||gameState!=='running') return
    if (timeLeft<=0) { setGameState('over'); return }
    const t=setInterval(()=>setTimeLeft(p=>p-1),1000)
    return ()=>clearInterval(t)
  }, [isChallengeMode,gameState,timeLeft])

  const isValid = useCallback((shape:number[][], x:number, y:number, b:number[][]) => {
    for (let r=0;r<shape.length;r++)
      for (let c=0;c<shape[r].length;c++)
        if (shape[r][c]) { const nr=y+r,nc=x+c; if(nr<0||nr>=ROWS||nc<0||nc>=COLS||b[nr][nc])return false }
    return true
  }, [])

  const placePiece = useCallback((shape:number[][], x:number, y:number, color:string, b:number[][]) => {
    const nb=b.map(r=>[...r])
    for (let r=0;r<shape.length;r++) for (let c=0;c<shape[r].length;c++) if(shape[r][c]) nb[y+r][x+c]=color as any
    return nb
  }, [])

  const clearLines = useCallback((b:number[][]) => {
    const kept=b.filter(row=>row.some(c=>!c))
    return { newBoard:[...Array.from({length:ROWS-kept.length},()=>Array(COLS).fill(0)),...kept], cleared:ROWS-kept.length }
  }, [])

  const sendPrize = useCallback(async () => {
    if (!isConnected||!betTo||!betAmount) return
    setSending(true)
    try {
      const {AppKit}=await import('@circle-fin/app-kit')
      const {createViemAdapterFromProvider}=await import('@circle-fin/adapter-viem-v2')
      const kit=new AppKit()
      const adapter=await createViemAdapterFromProvider({provider:(window as any).ethereum})
      const res=await kit.send({from:{adapter,chain:'Arc_Testnet' as never},to:betTo,amount:betAmount,token:'USDC'})
      const hash=(res as any)?.hash||''
      setTxHash(hash)
      const stored=localStorage.getItem('arc_transactions')
      const existing=stored?JSON.parse(stored):[]
      localStorage.setItem('arc_transactions',JSON.stringify([{id:Math.random().toString(36).slice(2),name:`🎮 Bet Prize`,address:betTo,amount:betAmount,txHash:hash,timestamp:new Date().toISOString()},...existing]))
    } catch(e:any){alert('Error: '+e.message)}
    setSending(false)
  }, [isConnected,betTo,betAmount])

  const lockAndNext = useCallback(() => {
    const cur=currentRef.current, b=boardRef.current
    if (!isValid(cur.shape,cur.x,cur.y,b)) {
      const fs=scoreRef.current
      if (fs>highScore){setHighScore(fs);localStorage.setItem('tetris_hs',fs.toString())}
      setGameState('over'); return
    }
    const nb=placePiece(cur.shape,cur.x,cur.y,cur.color,b)
    const {newBoard,cleared}=clearLines(nb)
    setBoard(newBoard)
    if (cleared>0) {
      const pts=[0,100,300,500,800][cleared]*levelRef.current
      const nl=linesRef.current+cleared
      setScore(p=>p+pts); setLines(nl); setLevel(Math.floor(nl/10)+1)
      if (isChallengeMode&&nl>=betTarget) { setGameState('won'); return }
    }
    setCurrent(next); setNext(randPiece())
  }, [isValid,placePiece,clearLines,next,highScore,isChallengeMode,betTarget])

  const moveDown = useCallback(() => {
    if (gsRef.current!=='running') return
    const cur=currentRef.current, b=boardRef.current
    if (isValid(cur.shape,cur.x,cur.y+1,b)) setCurrent(p=>({...p,y:p.y+1}))
    else lockAndNext()
  }, [isValid,lockAndNext])

  useEffect(() => {
    if (gameState!=='running') return
    const i=setInterval(moveDown, Math.max(100,800-(level-1)*70))
    return ()=>clearInterval(i)
  }, [gameState,level,moveDown])

  useEffect(() => {
    const handleKey = (e:KeyboardEvent) => {
      if (gsRef.current!=='running') { if(e.code==='Space'||e.code==='Enter')startGame(); return }
      const cur=currentRef.current, b=boardRef.current
      if (e.code==='ArrowLeft'){if(isValid(cur.shape,cur.x-1,cur.y,b))setCurrent(p=>({...p,x:p.x-1}))}
      else if(e.code==='ArrowRight'){if(isValid(cur.shape,cur.x+1,cur.y,b))setCurrent(p=>({...p,x:p.x+1}))}
      else if(e.code==='ArrowDown') moveDown()
      else if(e.code==='ArrowUp'){const r=rotate(cur.shape);if(isValid(r,cur.x,cur.y,b))setCurrent(p=>({...p,shape:r}))}
      else if(e.code==='Space'){
        e.preventDefault()
        let ny=cur.y; while(isValid(cur.shape,cur.x,ny+1,b))ny++
        setCurrent(p=>({...p,y:ny})); setTimeout(lockAndNext,50)
      }
    }
    window.addEventListener('keydown',handleKey)
    return ()=>window.removeEventListener('keydown',handleKey)
  }, [isValid,moveDown,lockAndNext])

  const startGame = () => {
    const nb=emptyBoard(); setBoard(nb); boardRef.current=nb
    const nc=randPiece(); setCurrent(nc); currentRef.current=nc
    setNext(randPiece()); setScore(0); setLines(0); setLevel(1)
    scoreRef.current=0; linesRef.current=0; levelRef.current=1
    setTimeLeft(180); setTxHash(''); setGameState('running'); gsRef.current='running'
  }

  const generateLink = () => {
    if (!betToInput||!betAmountInput||!betTargetInput||!address) return
    setBetLink(`${window.location.origin}/game?bet=${betAmountInput}&to=${betToInput}&target=${betTargetInput}&from=${address}`)
  }

  const copyLink = () => { navigator.clipboard.writeText(betLink); setCopied(true); setTimeout(()=>setCopied(false),2000) }

  const shareChallenge = () => {
    const t=`🎮 USDC Tetris Challenge!\n\nClear ${betTargetInput} lines → win ${betAmountInput} USDC instantly!\n\n${betLink}\n\n#ArcNetwork #USDC`
    window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(t)}`,'_blank')
  }

  const shareWin = () => {
    const t=`🏆 I won ${betAmount} USDC playing Tetris on Arc Network!\n\nCleared ${betTarget} lines and earned the prize! 🎮⚡\n\narc-payouts.vercel.app/game\n\n#ArcNetwork #USDC`
    window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(t)}`,'_blank')
  }

  useEffect(() => {
    const canvas=canvasRef.current; if(!canvas)return
    const ctx=canvas.getContext('2d')!
    ctx.fillStyle='#050810'; ctx.fillRect(0,0,COLS*BLOCK,ROWS*BLOCK)
    for (let r=0;r<ROWS;r++) for (let c=0;c<COLS;c++) {
      if (board[r][c]) {
        ctx.fillStyle=board[r][c] as any; ctx.fillRect(c*BLOCK+1,r*BLOCK+1,BLOCK-2,BLOCK-2)
        ctx.fillStyle='rgba(255,255,255,0.1)'; ctx.fillRect(c*BLOCK+1,r*BLOCK+1,BLOCK-2,4)
      } else { ctx.fillStyle='#0a0a14'; ctx.fillRect(c*BLOCK+1,r*BLOCK+1,BLOCK-2,BLOCK-2) }
    }
    if (current&&gameState==='running') {
      let gy=current.y; while(isValid(current.shape,current.x,gy+1,board))gy++
      for (let r=0;r<current.shape.length;r++) for (let c=0;c<current.shape[r].length;c++) if(current.shape[r][c]) {
        ctx.fillStyle=current.color+'33'; ctx.fillRect((current.x+c)*BLOCK+1,(gy+r)*BLOCK+1,BLOCK-2,BLOCK-2)
      }
      for (let r=0;r<current.shape.length;r++) for (let c=0;c<current.shape[r].length;c++) if(current.shape[r][c]) {
        ctx.fillStyle=current.color; ctx.fillRect((current.x+c)*BLOCK+1,(current.y+r)*BLOCK+1,BLOCK-2,BLOCK-2)
        ctx.fillStyle='rgba(255,255,255,0.2)'; ctx.fillRect((current.x+c)*BLOCK+1,(current.y+r)*BLOCK+1,BLOCK-2,4)
      }
    }
    if (gameState==='idle') {
      ctx.fillStyle='rgba(0,0,0,0.78)'; ctx.fillRect(0,0,COLS*BLOCK,ROWS*BLOCK)
      ctx.textAlign='center'
      if (isChallengeMode) {
        ctx.fillStyle='#c9a84c'; ctx.font='bold 16px system-ui'; ctx.fillText('CHALLENGE!',COLS*BLOCK/2,ROWS*BLOCK/2-38)
        ctx.fillStyle='#fff'; ctx.font='bold 13px system-ui'; ctx.fillText(`Clear ${betTarget} lines`,COLS*BLOCK/2,ROWS*BLOCK/2-16)
        ctx.fillStyle='#4ade80'; ctx.font='bold 18px system-ui'; ctx.fillText(`Win ${betAmount} USDC`,COLS*BLOCK/2,ROWS*BLOCK/2+8)
        ctx.fillStyle='#555'; ctx.font='11px system-ui'; ctx.fillText('SPACE to start',COLS*BLOCK/2,ROWS*BLOCK/2+28)
      } else {
        ctx.fillStyle='#c9a84c'; ctx.font='bold 18px system-ui'; ctx.fillText('USDC TETRIS',COLS*BLOCK/2,ROWS*BLOCK/2-10)
        ctx.fillStyle='#555'; ctx.font='12px system-ui'; ctx.fillText('SPACE to start',COLS*BLOCK/2,ROWS*BLOCK/2+14)
      }
      ctx.textAlign='left'
    }
    if (gameState==='over') {
      ctx.fillStyle='rgba(0,0,0,0.82)'; ctx.fillRect(0,0,COLS*BLOCK,ROWS*BLOCK)
      ctx.textAlign='center'
      ctx.fillStyle='#f87171'; ctx.font='bold 20px system-ui'; ctx.fillText('GAME OVER',COLS*BLOCK/2,ROWS*BLOCK/2-22)
      ctx.fillStyle='#888'; ctx.font='12px system-ui'
      ctx.fillText(isChallengeMode?`${lines}/${betTarget} lines`:`Score: ${score}`,COLS*BLOCK/2,ROWS*BLOCK/2+2)
      ctx.fillStyle='#555'; ctx.font='11px system-ui'; ctx.fillText('SPACE to retry',COLS*BLOCK/2,ROWS*BLOCK/2+22)
      ctx.textAlign='left'
    }
    if (gameState==='won') {
      ctx.fillStyle='rgba(0,0,0,0.82)'; ctx.fillRect(0,0,COLS*BLOCK,ROWS*BLOCK)
      ctx.textAlign='center'
      ctx.fillStyle='#c9a84c'; ctx.font='bold 20px system-ui'; ctx.fillText('YOU WON!',COLS*BLOCK/2,ROWS*BLOCK/2-22)
      ctx.fillStyle='#4ade80'; ctx.font='bold 15px system-ui'; ctx.fillText(`${betAmount} USDC prize!`,COLS*BLOCK/2,ROWS*BLOCK/2+4)
      ctx.fillStyle='#555'; ctx.font='11px system-ui'; ctx.fillText('Claim below',COLS*BLOCK/2,ROWS*BLOCK/2+24)
      ctx.textAlign='left'
    }
  }, [board,current,gameState,score,lines,isValid,isChallengeMode,betTarget,betAmount])

  const NextPiece = () => {
    const sz=4, grid=Array.from({length:sz},()=>Array(sz).fill(0))
    const s=next.shape, oy=Math.floor((sz-s.length)/2), ox=Math.floor((sz-s[0].length)/2)
    return (
      <div style={{display:'grid',gridTemplateColumns:`repeat(${sz},16px)`,gap:2}}>
        {grid.map((row,r)=>row.map((_,c)=>{
          const sr=r-oy,sc=c-ox, filled=sr>=0&&sr<s.length&&sc>=0&&sc<s[0].length&&s[sr][sc]
          return <div key={`${r}-${c}`} style={{width:16,height:16,borderRadius:3,background:filled?next.color:'#0a0a14'}}/>
        }))}
      </div>
    )
  }

  const mins=Math.floor(timeLeft/60), secs=timeLeft%60
  const prog=betTarget>0?Math.min((lines/betTarget)*100,100):0

  return (
    <div style={{minHeight:'100vh',background:'#080808',color:'#fff',fontFamily:'-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif'}}>

      <nav style={{borderBottom:'1px solid #141414',padding:'11px 16px',display:'flex',alignItems:'center',justifyContent:'space-between',background:'#080808',flexWrap:'wrap',gap:8}}>
        <div style={{display:'flex',alignItems:'center',gap:10}}>
          <div style={{width:30,height:30,background:'#111',border:'1px solid #1e1e1e',borderRadius:8,display:'flex',alignItems:'center',justifyContent:'center'}}>
            <WavesLogo size={16}/>
          </div>
          <div>
            <div style={{fontWeight:700,fontSize:13}}>{isChallengeMode?'🎮 USDC Challenge':'USDC Tetris'}</div>
            <div style={{fontSize:8,color:'#c9a84c',fontWeight:700,letterSpacing:'.8px'}}>ARC NETWORK <span style={{color:'#444'}}>· by GoGo</span></div>
          </div>
        </div>
        <div style={{display:'flex',gap:8,alignItems:'center'}}>
          {!isChallengeMode&&(
            <button onClick={()=>setCreateBet(!createBet)}
              style={{padding:'5px 12px',background:createBet?'#1a1500':'#111',border:`1px solid ${createBet?'#c9a84c':'#1e1e1e'}`,borderRadius:8,fontSize:11,color:createBet?'#c9a84c':'#888',cursor:'pointer',fontWeight:700}}>
              🎯 Challenge a Friend
            </button>
          )}
          <Link href="/" style={{fontSize:11,color:'#555',textDecoration:'none',padding:'5px 10px',background:'#111',border:'1px solid #1e1e1e',borderRadius:8}}>← Back</Link>
        </div>
      </nav>

      {isChallengeMode&&(
        <div style={{background:'#0a0800',borderBottom:'1px solid #2a2500',padding:'10px 16px',display:'flex',alignItems:'center',justifyContent:'space-between',flexWrap:'wrap',gap:8}}>
          <div style={{display:'flex',alignItems:'center',gap:10,flexWrap:'wrap'}}>
            <span style={{fontSize:11,color:'#888'}}>From <span style={{color:'#c9a84c',fontWeight:700}}>{betFrom?betFrom.slice(0,8)+'...':'Anonymous'}</span></span>
            <span style={{background:'#0a1a0a',border:'1px solid #1a3a1a',borderRadius:20,padding:'3px 10px',fontSize:11,color:'#4ade80',fontWeight:700}}>🏆 Prize: {betAmount} USDC</span>
            <span style={{background:'#1a1500',border:'1px solid #2a2500',borderRadius:20,padding:'3px 10px',fontSize:11,color:'#c9a84c',fontWeight:700}}>🎯 Target: {betTarget} lines</span>
          </div>
          {gameState==='running'&&(
            <span style={{background:timeLeft<30?'#1a0a0a':'#111',border:`1px solid ${timeLeft<30?'#f87171':'#333'}`,borderRadius:20,padding:'3px 10px',fontSize:12,color:timeLeft<30?'#f87171':'#888',fontWeight:700}}>
              ⏱ {mins}:{secs.toString().padStart(2,'0')}
            </span>
          )}
        </div>
      )}

      {isChallengeMode&&gameState==='running'&&(
        <div style={{padding:'6px 16px',background:'#080808'}}>
          <div style={{maxWidth:280,margin:'0 auto'}}>
            <div style={{display:'flex',justifyContent:'space-between',fontSize:10,color:'#555',marginBottom:3}}>
              <span>Progress</span><span style={{color:'#c9a84c'}}>{lines}/{betTarget}</span>
            </div>
            <div style={{background:'#1a1a1a',borderRadius:4,height:5}}>
              <div style={{width:`${prog}%`,height:'100%',background:'linear-gradient(90deg,#c9a84c,#4ade80)',borderRadius:4,transition:'width .3s'}}/>
            </div>
          </div>
        </div>
      )}

      <div style={{display:'flex',justifyContent:'center',alignItems:'flex-start',gap:14,padding:'14px 16px',flexWrap:'wrap'}}>
        <canvas ref={canvasRef} width={COLS*BLOCK} height={ROWS*BLOCK}
          style={{display:'block',borderRadius:12,border:`1px solid ${isChallengeMode?'#2a2500':'#1a1a1a'}`,cursor:'pointer'}}
          onClick={()=>gameState!=='running'&&startGame()}/>

        <div style={{display:'flex',flexDirection:'column',gap:8,width:148}}>
          {[{l:'SCORE',v:score.toLocaleString(),c:'#fff'},{l:'LINES',v:lines,c:'#60a5fa'},{l:'LEVEL',v:level,c:'#c9a84c'},{l:'BEST',v:highScore.toLocaleString(),c:'#c9a84c'}].map(s=>(
            <div key={s.l} style={{background:'#0e0e0e',border:'1px solid #1a1a1a',borderRadius:10,padding:'9px 12px'}}>
              <div style={{fontSize:9,color:'#444',fontWeight:700,letterSpacing:'.4px',marginBottom:2}}>{s.l}</div>
              <div style={{fontSize:18,fontWeight:300,color:s.c,letterSpacing:'-1px'}}>{s.v}</div>
            </div>
          ))}
          <div style={{background:'#0e0e0e',border:'1px solid #1a1a1a',borderRadius:10,padding:'9px 12px'}}>
            <div style={{fontSize:9,color:'#444',fontWeight:700,letterSpacing:'.4px',marginBottom:6}}>NEXT</div>
            <NextPiece/>
          </div>
          <div style={{background:'#0e0e0e',border:'1px solid #1a1a1a',borderRadius:10,padding:'9px 12px'}}>
            <div style={{fontSize:9,color:'#444',fontWeight:700,letterSpacing:'.4px',marginBottom:5}}>CONTROLS</div>
            {[['←→','Move'],['↑','Rotate'],['↓','Drop'],['SPC','Hard drop']].map(([k,v])=>(
              <div key={k} style={{display:'flex',justifyContent:'space-between',fontSize:10,marginBottom:2}}>
                <span style={{color:'#c9a84c',fontWeight:700}}>{k}</span><span style={{color:'#444'}}>{v}</span>
              </div>
            ))}
          </div>
          {gameState==='idle'&&<button onClick={startGame} style={{padding:'10px',background:'linear-gradient(135deg,#c9a84c,#a07830)',color:'#000',border:'none',borderRadius:10,fontSize:12,fontWeight:800,cursor:'pointer'}}>▶ Start</button>}
          {gameState==='over'&&<button onClick={startGame} style={{padding:'10px',background:'linear-gradient(135deg,#c9a84c,#a07830)',color:'#000',border:'none',borderRadius:10,fontSize:12,fontWeight:800,cursor:'pointer'}}>↺ Retry</button>}
          {gameState==='running'&&<button onClick={()=>setGameState('over')} style={{padding:'8px',background:'#1a0a0a',border:'1px solid #2a1a1a',borderRadius:10,fontSize:11,color:'#f87171',cursor:'pointer'}}>■ Quit</button>}
        </div>
      </div>

      {gameState==='won'&&(
        <div style={{maxWidth:480,margin:'0 auto',padding:'0 16px 20px'}}>
          <div style={{background:'#0a1a0a',border:'2px solid #c9a84c',borderRadius:16,padding:20,textAlign:'center'}}>
            <div style={{fontSize:36,marginBottom:8}}>🏆</div>
            <div style={{fontSize:20,fontWeight:800,color:'#c9a84c',marginBottom:6}}>Challenge Complete!</div>
            <div style={{fontSize:13,color:'#888',marginBottom:12}}>You cleared {lines} lines and won!</div>
            <div style={{fontSize:28,fontWeight:300,color:'#4ade80',letterSpacing:'-1px',marginBottom:16}}>{betAmount} USDC</div>
            {!txHash?(
              isConnected?(
                <button onClick={sendPrize} disabled={sending}
                  style={{width:'100%',padding:13,background:sending?'#333':'linear-gradient(135deg,#c9a84c,#a07830)',color:sending?'#666':'#000',border:'none',borderRadius:12,fontSize:14,fontWeight:800,cursor:sending?'default':'pointer',marginBottom:8}}>
                  {sending?'Sending...':` Claim ${betAmount} USDC →`}
                </button>
              ):(
                <button onClick={()=>connect({connector:injected()})}
                  style={{width:'100%',padding:13,background:'linear-gradient(135deg,#c9a84c,#a07830)',color:'#000',border:'none',borderRadius:12,fontSize:14,fontWeight:800,cursor:'pointer',marginBottom:8}}>
                  Connect Wallet to Claim
                </button>
              )
            ):(
              <div style={{background:'#080808',border:'1px solid #1a3a1a',borderRadius:10,padding:12,marginBottom:8}}>
                <div style={{fontSize:13,color:'#4ade80',fontWeight:700,marginBottom:4}}>✓ Prize Sent!</div>
                <a href={`https://testnet.arcscan.app/tx/${txHash}`} target="_blank" rel="noopener noreferrer" style={{fontSize:11,color:'#c9a84c',textDecoration:'none'}}>View on ArcScan →</a>
              </div>
            )}
            <button onClick={shareWin} style={{width:'100%',padding:10,background:'#0a1628',border:'1px solid #1e3a5f',borderRadius:12,fontSize:12,color:'#60a5fa',cursor:'pointer',fontWeight:700}}>
              𝕏 Share your win!
            </button>
          </div>
        </div>
      )}

      {!isChallengeMode&&createBet&&(
        <div style={{maxWidth:480,margin:'0 auto',padding:'0 16px 20px'}}>
          <div style={{background:'#0e0e0e',border:'1px solid #1a1a1a',borderRadius:16,padding:18}}>
            <div style={{fontWeight:700,fontSize:14,color:'#fff',marginBottom:14}}>🎯 Create USDC Challenge</div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:10}}>
              <div>
                <div style={{fontSize:9,color:'#444',fontWeight:700,letterSpacing:'.4px',marginBottom:5}}>PRIZE (USDC)</div>
                <input type="number" value={betAmountInput} onChange={e=>setBetAmountInput(e.target.value)}
                  style={{width:'100%',padding:'9px 12px',background:'#080808',border:'1px solid #181818',borderRadius:10,fontSize:13,color:'#fff',outline:'none',boxSizing:'border-box'}}/>
              </div>
              <div>
                <div style={{fontSize:9,color:'#444',fontWeight:700,letterSpacing:'.4px',marginBottom:5}}>TARGET LINES</div>
                <input type="number" value={betTargetInput} onChange={e=>setBetTargetInput(e.target.value)}
                  style={{width:'100%',padding:'9px 12px',background:'#080808',border:'1px solid #181818',borderRadius:10,fontSize:13,color:'#fff',outline:'none',boxSizing:'border-box'}}/>
              </div>
            </div>
            <div style={{marginBottom:14}}>
              <div style={{fontSize:9,color:'#444',fontWeight:700,letterSpacing:'.4px',marginBottom:5}}>FRIEND'S WALLET ADDRESS</div>
              <input value={betToInput} onChange={e=>setBetToInput(e.target.value)} placeholder="0x..."
                style={{width:'100%',padding:'9px 12px',background:'#080808',border:'1px solid #181818',borderRadius:10,fontSize:13,color:'#fff',outline:'none',boxSizing:'border-box'}}/>
            </div>
            {!betLink?(
              <button onClick={generateLink} disabled={!betToInput||!address}
                style={{width:'100%',padding:12,background:!betToInput||!address?'#1a1a1a':'linear-gradient(135deg,#c9a84c,#a07830)',color:!betToInput||!address?'#444':'#000',border:'none',borderRadius:12,fontSize:13,fontWeight:800,cursor:!betToInput||!address?'default':'pointer'}}>
                {!address?'Connect wallet first':'Generate Challenge Link →'}
              </button>
            ):(
              <div style={{display:'flex',flexDirection:'column',gap:8}}>
                <div style={{background:'#080808',border:'1px solid #1a1a1a',borderRadius:10,padding:'10px 12px',fontSize:11,color:'#888',fontFamily:'monospace',wordBreak:'break-all'}}>{betLink}</div>
                <div style={{display:'flex',gap:8}}>
                  <button onClick={copyLink} style={{flex:1,padding:10,background:copied?'#0a1a0a':'#111',border:`1px solid ${copied?'#1a3a1a':'#222'}`,borderRadius:10,fontSize:12,color:copied?'#4ade80':'#888',cursor:'pointer',fontWeight:700}}>
                    {copied?'✓ Copied!':'⎘ Copy Link'}
                  </button>
                  <button onClick={shareChallenge} style={{flex:1,padding:10,background:'#0a1628',border:'1px solid #1e3a5f',borderRadius:10,fontSize:12,color:'#60a5fa',cursor:'pointer',fontWeight:700}}>
                    𝕏 Share
                  </button>
                </div>
                <button onClick={()=>setBetLink('')} style={{padding:8,background:'transparent',border:'1px solid #1a1a1a',borderRadius:10,fontSize:11,color:'#444',cursor:'pointer'}}>← New Challenge</button>
              </div>
            )}
          </div>
        </div>
      )}

      <div style={{textAlign:'center',padding:'12px',fontSize:10,color:'#1a1a1a'}}>
        Arc Global Payouts · USDC Tetris · by GoGo
      </div>
    </div>
  )
}

export default function GamePage() {
  return (
    <Suspense fallback={<div style={{minHeight:'100vh',background:'#080808'}}/>}>
      <GameContent/>
    </Suspense>
  )
}