'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import Link from 'next/link'

const WavesLogo = ({ size = 20 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 48 48" fill="none">
    <path d="M14 18 C14 18 24 10 34 18" stroke="#c9a84c" strokeWidth="2.5" fill="none" strokeLinecap="round"/>
    <path d="M14 24 C14 24 24 16 34 24" stroke="#c9a84c" strokeWidth="2.5" fill="none" strokeLinecap="round"/>
    <path d="M14 30 C14 30 24 22 34 30" stroke="#c9a84c" strokeWidth="2.5" fill="none" strokeLinecap="round"/>
  </svg>
)

const COLS = 10
const ROWS = 20
const BLOCK = 28

const PIECES = [
  { shape: [[1,1,1,1]], color: '#60a5fa' },
  { shape: [[1,1],[1,1]], color: '#c9a84c' },
  { shape: [[1,1,1],[0,1,0]], color: '#a78bfa' },
  { shape: [[1,1,1],[1,0,0]], color: '#f87171' },
  { shape: [[1,1,1],[0,0,1]], color: '#4ade80' },
  { shape: [[1,1,0],[0,1,1]], color: '#fb923c' },
  { shape: [[0,1,1],[1,1,0]], color: '#e879f9' },
]

const emptyBoard = () => Array.from({length:ROWS}, () => Array(COLS).fill(0))

const rotate = (matrix: number[][]) => {
  const rows = matrix.length, cols = matrix[0].length
  return Array.from({length:cols}, (_,i) => Array.from({length:rows}, (_,j) => matrix[rows-1-j][i]))
}

const randomPiece = () => {
  const p = PIECES[Math.floor(Math.random()*PIECES.length)]
  return { shape: p.shape, color: p.color, x: Math.floor(COLS/2) - Math.floor(p.shape[0].length/2), y: 0 }
}

export default function GamePage() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [board, setBoard] = useState(emptyBoard())
  const [current, setCurrent] = useState(randomPiece())
  const [next, setNext] = useState(randomPiece())
  const [score, setScore] = useState(0)
  const [lines, setLines] = useState(0)
  const [level, setLevel] = useState(1)
  const [gameState, setGameState] = useState<'idle'|'running'|'over'>('idle')
  const [usdc, setUsdc] = useState(0)
  const [highScore, setHighScore] = useState(0)

  const boardRef = useRef(board)
  const currentRef = useRef(current)
  const gameStateRef = useRef(gameState)
  const scoreRef = useRef(score)
  const linesRef = useRef(lines)
  const levelRef = useRef(level)
  const usdcRef = useRef(usdc)

  useEffect(() => { boardRef.current = board }, [board])
  useEffect(() => { currentRef.current = current }, [current])
  useEffect(() => { gameStateRef.current = gameState }, [gameState])
  useEffect(() => { scoreRef.current = score }, [score])
  useEffect(() => { linesRef.current = lines }, [lines])
  useEffect(() => { levelRef.current = level }, [level])
  useEffect(() => { usdcRef.current = usdc }, [usdc])

  useEffect(() => {
    const hs = localStorage.getItem('tetris_highscore')
    if (hs) setHighScore(parseInt(hs))
  }, [])

  const isValid = useCallback((shape: number[][], x: number, y: number, b: number[][]) => {
    for (let r=0;r<shape.length;r++)
      for (let c=0;c<shape[r].length;c++)
        if (shape[r][c]) {
          const nr = y+r, nc = x+c
          if (nr<0||nr>=ROWS||nc<0||nc>=COLS||b[nr][nc]) return false
        }
    return true
  }, [])

  const placePiece = useCallback((shape: number[][], x: number, y: number, color: string, b: number[][]) => {
    const nb = b.map(r => [...r])
    for (let r=0;r<shape.length;r++)
      for (let c=0;c<shape[r].length;c++)
        if (shape[r][c]) nb[y+r][x+c] = color as any
    return nb
  }, [])

  const clearLines = useCallback((b: number[][]) => {
    const kept = b.filter(row => row.some(c => !c))
    const cleared = ROWS - kept.length
    const newBoard = [...Array.from({length:cleared}, () => Array(COLS).fill(0)), ...kept]
    return { newBoard, cleared }
  }, [])

  const lockAndNext = useCallback(() => {
    const cur = currentRef.current
    const b = boardRef.current
    if (!isValid(cur.shape, cur.x, cur.y, b)) {
      setGameState('over')
      const finalScore = scoreRef.current
      if (finalScore > highScore) {
        setHighScore(finalScore)
        localStorage.setItem('tetris_highscore', finalScore.toString())
      }
      const stored = localStorage.getItem('arc_transactions')
      const existing = stored ? JSON.parse(stored) : []
      if (usdcRef.current > 0) {
        localStorage.setItem('arc_transactions', JSON.stringify([
          { id: Math.random().toString(36).slice(2), name:'Tetris USDC', address:'', amount:usdcRef.current.toFixed(2), txHash:'', timestamp:new Date().toISOString() },
          ...existing
        ]))
      }
      return
    }
    const newBoard = placePiece(cur.shape, cur.x, cur.y, cur.color, b)
    const { newBoard: cleared, cleared: numCleared } = clearLines(newBoard)
    setBoard(cleared)
    if (numCleared > 0) {
      const pts = [0,100,300,500,800][numCleared] * levelRef.current
      const newScore = scoreRef.current + pts
      const newLines = linesRef.current + numCleared
      const newLevel = Math.floor(newLines / 10) + 1
      const earned = parseFloat((numCleared * 0.1 * levelRef.current).toFixed(2))
      setScore(newScore)
      setLines(newLines)
      setLevel(newLevel)
      setUsdc(prev => parseFloat((prev + earned).toFixed(2)))
    }
    setCurrent(next)
    setNext(randomPiece())
  }, [isValid, placePiece, clearLines, next, highScore])

  const moveDown = useCallback(() => {
    if (gameStateRef.current !== 'running') return
    const cur = currentRef.current
    const b = boardRef.current
    if (isValid(cur.shape, cur.x, cur.y+1, b)) {
      setCurrent(prev => ({...prev, y: prev.y+1}))
    } else {
      lockAndNext()
    }
  }, [isValid, lockAndNext])

  useEffect(() => {
    if (gameState !== 'running') return
    const speed = Math.max(100, 800 - (level-1)*70)
    const interval = setInterval(moveDown, speed)
    return () => clearInterval(interval)
  }, [gameState, level, moveDown])

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (gameStateRef.current === 'over') {
        if (e.code === 'Space' || e.code === 'Enter') startGame()
        return
      }
      if (gameStateRef.current === 'idle') {
        if (e.code === 'Space' || e.code === 'Enter') startGame()
        return
      }
      const cur = currentRef.current
      const b = boardRef.current
      if (e.code === 'ArrowLeft') {
        if (isValid(cur.shape, cur.x-1, cur.y, b)) setCurrent(prev => ({...prev, x: prev.x-1}))
      } else if (e.code === 'ArrowRight') {
        if (isValid(cur.shape, cur.x+1, cur.y, b)) setCurrent(prev => ({...prev, x: prev.x+1}))
      } else if (e.code === 'ArrowDown') {
        moveDown()
      } else if (e.code === 'ArrowUp') {
        const rotated = rotate(cur.shape)
        if (isValid(rotated, cur.x, cur.y, b)) setCurrent(prev => ({...prev, shape: rotated}))
      } else if (e.code === 'Space') {
        e.preventDefault()
        let ny = cur.y
        while (isValid(cur.shape, cur.x, ny+1, b)) ny++
        setCurrent(prev => ({...prev, y: ny}))
        setTimeout(lockAndNext, 50)
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [isValid, moveDown, lockAndNext])

  const startGame = () => {
    const newBoard = emptyBoard()
    setBoard(newBoard)
    boardRef.current = newBoard
    const newCurrent = randomPiece()
    setCurrent(newCurrent)
    currentRef.current = newCurrent
    setNext(randomPiece())
    setScore(0); setLines(0); setLevel(1); setUsdc(0)
    scoreRef.current = 0; linesRef.current = 0; levelRef.current = 1; usdcRef.current = 0
    setGameState('running')
    gameStateRef.current = 'running'
  }

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')!
    ctx.fillStyle = '#050810'
    ctx.fillRect(0, 0, COLS*BLOCK, ROWS*BLOCK)

    for (let r=0;r<ROWS;r++)
      for (let c=0;c<COLS;c++) {
        if (board[r][c]) {
          ctx.fillStyle = board[r][c] as any
          ctx.fillRect(c*BLOCK+1, r*BLOCK+1, BLOCK-2, BLOCK-2)
          ctx.fillStyle = 'rgba(255,255,255,0.1)'
          ctx.fillRect(c*BLOCK+1, r*BLOCK+1, BLOCK-2, 4)
        } else {
          ctx.fillStyle = '#0a0a14'
          ctx.fillRect(c*BLOCK+1, r*BLOCK+1, BLOCK-2, BLOCK-2)
        }
      }

    if (current && gameState === 'running') {
      // Ghost piece
      let ghostY = current.y
      while (isValid(current.shape, current.x, ghostY+1, board)) ghostY++
      for (let r=0;r<current.shape.length;r++)
        for (let c=0;c<current.shape[r].length;c++)
          if (current.shape[r][c]) {
            ctx.fillStyle = current.color + '33'
            ctx.fillRect((current.x+c)*BLOCK+1, (ghostY+r)*BLOCK+1, BLOCK-2, BLOCK-2)
            ctx.strokeStyle = current.color + '66'
            ctx.lineWidth = 1
            ctx.strokeRect((current.x+c)*BLOCK+1, (ghostY+r)*BLOCK+1, BLOCK-2, BLOCK-2)
          }

      for (let r=0;r<current.shape.length;r++)
        for (let c=0;c<current.shape[r].length;c++)
          if (current.shape[r][c]) {
            ctx.fillStyle = current.color
            ctx.fillRect((current.x+c)*BLOCK+1, (current.y+r)*BLOCK+1, BLOCK-2, BLOCK-2)
            ctx.fillStyle = 'rgba(255,255,255,0.2)'
            ctx.fillRect((current.x+c)*BLOCK+1, (current.y+r)*BLOCK+1, BLOCK-2, 4)
          }
    }

    if (gameState === 'idle') {
      ctx.fillStyle = 'rgba(0,0,0,0.7)'
      ctx.fillRect(0, 0, COLS*BLOCK, ROWS*BLOCK)
      ctx.fillStyle = '#c9a84c'
      ctx.font = 'bold 20px system-ui'
      ctx.textAlign = 'center'
      ctx.fillText('USDC TETRIS', COLS*BLOCK/2, ROWS*BLOCK/2-20)
      ctx.fillStyle = '#888'
      ctx.font = '13px system-ui'
      ctx.fillText('Press SPACE to start', COLS*BLOCK/2, ROWS*BLOCK/2+10)
      ctx.textAlign = 'left'
    }

    if (gameState === 'over') {
      ctx.fillStyle = 'rgba(0,0,0,0.8)'
      ctx.fillRect(0, 0, COLS*BLOCK, ROWS*BLOCK)
      ctx.fillStyle = '#f87171'
      ctx.font = 'bold 22px system-ui'
      ctx.textAlign = 'center'
      ctx.fillText('GAME OVER', COLS*BLOCK/2, ROWS*BLOCK/2-30)
      ctx.fillStyle = '#c9a84c'
      ctx.font = 'bold 14px system-ui'
      ctx.fillText(`Score: ${score}`, COLS*BLOCK/2, ROWS*BLOCK/2)
      ctx.fillText(`USDC: ${usdc.toFixed(2)}`, COLS*BLOCK/2, ROWS*BLOCK/2+22)
      ctx.fillStyle = '#888'
      ctx.font = '12px system-ui'
      ctx.fillText('SPACE to retry', COLS*BLOCK/2, ROWS*BLOCK/2+48)
      ctx.textAlign = 'left'
    }
  }, [board, current, gameState, score, usdc, isValid])

  const shareScore = () => {
    const t = `I just scored ${score} points and earned ${usdc.toFixed(2)} USDC playing USDC Tetris on Arc Network! 🎮⚡\n\narc-payouts.vercel.app/game\n\n#ArcNetwork #USDC #DeFi`
    window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(t)}`, '_blank')
  }

  const NextPiece = () => {
    const size = 4
    const grid = Array.from({length:size}, () => Array(size).fill(0))
    const shape = next.shape
    const offsetY = Math.floor((size - shape.length) / 2)
    const offsetX = Math.floor((size - shape[0].length) / 2)
    return (
      <div style={{ display:'grid', gridTemplateColumns:`repeat(${size}, 18px)`, gap:2 }}>
        {grid.map((row, r) => row.map((_, c) => {
          const sr = r - offsetY, sc = c - offsetX
          const filled = sr>=0 && sr<shape.length && sc>=0 && sc<shape[0].length && shape[sr][sc]
          return <div key={`${r}-${c}`} style={{ width:18, height:18, borderRadius:3, background: filled ? next.color : '#0a0a14', boxShadow: filled ? `0 0 6px ${next.color}44` : 'none' }}/>
        }))}
      </div>
    )
  }

  return (
    <div style={{ minHeight:'100vh', background:'#080808', color:'#fff', fontFamily:'-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif' }}>
      <nav style={{ borderBottom:'1px solid #141414', padding:'11px 16px', display:'flex', alignItems:'center', justifyContent:'space-between', background:'#080808' }}>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <div style={{ width:30, height:30, background:'#111', border:'1px solid #1e1e1e', borderRadius:8, display:'flex', alignItems:'center', justifyContent:'center' }}>
            <WavesLogo size={16}/>
          </div>
          <div>
            <div style={{ fontWeight:700, fontSize:13 }}>USDC Tetris</div>
            <div style={{ fontSize:8, color:'#c9a84c', fontWeight:700, letterSpacing:'.8px' }}>ARC NETWORK <span style={{ color:'#444' }}>· by GoGo</span></div>
          </div>
        </div>
        <Link href="/" style={{ fontSize:11, color:'#555', textDecoration:'none', padding:'5px 10px', background:'#111', border:'1px solid #1e1e1e', borderRadius:8 }}>← Back</Link>
      </nav>

      <div style={{ display:'flex', justifyContent:'center', alignItems:'flex-start', gap:16, padding:'16px', flexWrap:'wrap' }}>
        <div style={{ position:'relative' }}>
          <canvas ref={canvasRef} width={COLS*BLOCK} height={ROWS*BLOCK}
            style={{ display:'block', borderRadius:12, border:'1px solid #1a1a1a', cursor:'pointer' }}
            onClick={() => gameState !== 'running' && startGame()}/>
        </div>

        <div style={{ display:'flex', flexDirection:'column', gap:10, width:140 }}>
          {[
            { label:'SCORE', value:score.toLocaleString(), color:'#fff' },
            { label:'LINES', value:lines, color:'#60a5fa' },
            { label:'LEVEL', value:level, color:'#c9a84c' },
            { label:'BEST', value:highScore.toLocaleString(), color:'#c9a84c' },
            { label:'USDC', value:`${usdc.toFixed(2)} 💰`, color:'#c9a84c' },
          ].map(s => (
            <div key={s.label} style={{ background:'#0e0e0e', border:'1px solid #1a1a1a', borderRadius:10, padding:'10px 12px' }}>
              <div style={{ fontSize:9, color:'#444', fontWeight:700, letterSpacing:'.4px', marginBottom:3 }}>{s.label}</div>
              <div style={{ fontSize:18, fontWeight:300, color:s.color, letterSpacing:'-1px' }}>{s.value}</div>
            </div>
          ))}

          <div style={{ background:'#0e0e0e', border:'1px solid #1a1a1a', borderRadius:10, padding:'10px 12px' }}>
            <div style={{ fontSize:9, color:'#444', fontWeight:700, letterSpacing:'.4px', marginBottom:8 }}>NEXT</div>
            <NextPiece/>
          </div>

          <div style={{ background:'#0e0e0e', border:'1px solid #1a1a1a', borderRadius:10, padding:'10px 12px' }}>
            <div style={{ fontSize:9, color:'#444', fontWeight:700, letterSpacing:'.4px', marginBottom:6 }}>CONTROLS</div>
            {[
              ['←→', 'Move'],
              ['↑', 'Rotate'],
              ['↓', 'Soft drop'],
              ['SPACE', 'Hard drop'],
            ].map(([k,v]) => (
              <div key={k} style={{ display:'flex', justifyContent:'space-between', fontSize:10, marginBottom:3 }}>
                <span style={{ color:'#c9a84c', fontWeight:700 }}>{k}</span>
                <span style={{ color:'#555' }}>{v}</span>
              </div>
            ))}
          </div>

          {gameState === 'idle' && (
            <button onClick={startGame}
              style={{ padding:'10px', background:'linear-gradient(135deg,#c9a84c,#a07830)', color:'#000', border:'none', borderRadius:10, fontSize:12, fontWeight:800, cursor:'pointer' }}>
              ▶ Start
            </button>
          )}
          {gameState === 'over' && (
            <>
              <button onClick={startGame}
                style={{ padding:'10px', background:'linear-gradient(135deg,#c9a84c,#a07830)', color:'#000', border:'none', borderRadius:10, fontSize:12, fontWeight:800, cursor:'pointer' }}>
                ↺ Retry
              </button>
              <button onClick={shareScore}
                style={{ padding:'10px', background:'#0a1628', border:'1px solid #1e3a5f', borderRadius:10, fontSize:12, color:'#60a5fa', cursor:'pointer', fontWeight:700 }}>
                𝕏 Share
              </button>
            </>
          )}
          {gameState === 'running' && (
            <button onClick={() => setGameState('over')}
              style={{ padding:'10px', background:'#1a0a0a', border:'1px solid #2a1a1a', borderRadius:10, fontSize:12, color:'#f87171', cursor:'pointer' }}>
              ■ Quit
            </button>
          )}

          <div style={{ fontSize:9, color:'#222', textAlign:'center', lineHeight:1.6 }}>
            Clear lines to<br/>earn USDC!<br/>Arc Network · by GoGo
          </div>
        </div>
      </div>
    </div>
  )
}