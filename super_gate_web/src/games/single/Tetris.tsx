import React, { useState, useEffect, useRef } from 'react';
import { Play } from 'lucide-react';
import { CoinService } from '../../services/coinService';
import { ContinueModal } from '../../components/ContinueModal';

interface TetrisProps {
  onClose: () => void;
}

// 10x20 grid
const COLS = 10;
const ROWS = 20;

// Tetromino definitions
const SHAPES = {
  I: [[1, 1, 1, 1]],
  J: [
    [1, 0, 0],
    [1, 1, 1],
  ],
  L: [
    [0, 0, 1],
    [1, 1, 1],
  ],
  O: [
    [1, 1],
    [1, 1],
  ],
  S: [
    [0, 1, 1],
    [1, 1, 0],
  ],
  T: [
    [0, 1, 0],
    [1, 1, 1],
  ],
  Z: [
    [1, 1, 0],
    [0, 1, 1],
  ],
};

const COLORS: Record<string, string> = {
  I: '#00f0f0',
  J: '#0000f0',
  L: '#f0a000',
  O: '#f0f000',
  S: '#00f000',
  T: '#a000f0',
  Z: '#f00000',
};

type Piece = {
  shape: number[][];
  color: string;
  x: number;
  y: number;
};

const HOLD_COST = 20;
const CONTINUE_COST = 50;

const randomShape = (): { shape: number[][]; color: string } => {
  const keys = Object.keys(SHAPES);
  const k = keys[Math.floor(Math.random() * keys.length)] as keyof typeof SHAPES;
  // Deep clone shape so rotations don't mutate template
  const shape = SHAPES[k].map((row) => [...row]);
  return { shape, color: COLORS[k] };
};

export const Tetris: React.FC<TetrisProps> = ({ onClose }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const [score, setScore] = useState<number>(0);
  const [lines, setLines] = useState<number>(0);
  const [level, setLevel] = useState<number>(1);
  const [isStarted, setIsStarted] = useState<boolean>(false);
  const [gameOver, setGameOver] = useState<boolean>(false);
  const [earnedCoins, setEarnedCoins] = useState<number | null>(null);

  // Next & Hold UI states (for re-render)
  const [nextPreview, setNextPreview] = useState<{ shape: number[][]; color: string } | null>(null);
  const [heldPreview, setHeldPreview] = useState<{ shape: number[][]; color: string } | null>(null);
  const [balance, setBalance] = useState<number>(CoinService.getData().balance);

  // Continue
  const [showContinue, setShowContinue] = useState<boolean>(false);
  const [continueUsed, setContinueUsed] = useState<boolean>(false);

  // Refs for loop state
  const gridRef = useRef<string[][]>(Array.from({ length: ROWS }, () => Array(COLS).fill('')));
  const currentPieceRef = useRef<Piece | null>(null);
  const gameIntervalRef = useRef<any>(null);

  const nextPieceRef = useRef<{ shape: number[][]; color: string } | null>(null);
  const heldPieceRef = useRef<{ shape: number[][]; color: string } | null>(null);
  const canHoldThisDropRef = useRef<boolean>(true);

  const scoreRef = useRef<number>(0);
  const linesRef = useRef<number>(0);
  const levelRef = useRef<number>(1);
  const speedRef = useRef<number>(800);
  const isStartedRef = useRef<boolean>(false);
  const gameOverRef = useRef<boolean>(false);

  const initGame = () => {
    gridRef.current = Array.from({ length: ROWS }, () => Array(COLS).fill(''));
    currentPieceRef.current = null;
    nextPieceRef.current = null;
    heldPieceRef.current = null;
    canHoldThisDropRef.current = true;
    scoreRef.current = 0;
    linesRef.current = 0;
    levelRef.current = 1;
    speedRef.current = 800;

    setScore(0);
    setLines(0);
    setLevel(1);
    setGameOver(false);
    setIsStarted(false);
    setEarnedCoins(null);
    setNextPreview(null);
    setHeldPreview(null);
    setShowContinue(false);
    setContinueUsed(false);

    isStartedRef.current = false;
    gameOverRef.current = false;

    setTimeout(draw, 50);
  };

  /**
   * Pulls from nextPieceRef into currentPiece, refills nextPieceRef.
   * If a piece is passed in (e.g. from hold swap), uses that instead.
   */
  const spawnPiece = (forcedPiece?: { shape: number[][]; color: string }) => {
    let template: { shape: number[][]; color: string };
    if (forcedPiece) {
      template = forcedPiece;
    } else if (nextPieceRef.current) {
      template = nextPieceRef.current;
      nextPieceRef.current = randomShape();
      setNextPreview(nextPieceRef.current);
    } else {
      // First spawn: pick current and prepare next
      template = randomShape();
      nextPieceRef.current = randomShape();
      setNextPreview(nextPieceRef.current);
    }

    const x = Math.floor((COLS - template.shape[0].length) / 2);
    const y = 0;
    const newPiece: Piece = { shape: template.shape.map((r) => [...r]), color: template.color, x, y };

    if (checkCollision(gridRef.current, newPiece)) {
      currentPieceRef.current = newPiece; // place anyway so it gets drawn
      handleGameOver();
      return;
    }

    currentPieceRef.current = newPiece;
    canHoldThisDropRef.current = true;
  };

  const startGame = () => {
    setIsStarted(true);
    isStartedRef.current = true;
    spawnPiece();
    resetGameInterval();
  };

  const resetGameInterval = () => {
    if (gameIntervalRef.current) clearInterval(gameIntervalRef.current);
    gameIntervalRef.current = setInterval(gameStep, speedRef.current);
  };

  const gameStep = () => {
    if (!isStartedRef.current || gameOverRef.current) return;

    if (!currentPieceRef.current) {
      spawnPiece();
      draw();
      return;
    }

    const moved = movePiece(0, 1);
    if (!moved) {
      lockPiece();
      clearLines();
      spawnPiece();
    }

    draw();
  };

  const checkCollision = (grid: string[][], piece: Piece): boolean => {
    const { shape, x, y } = piece;
    for (let r = 0; r < shape.length; r++) {
      for (let c = 0; c < shape[r].length; c++) {
        if (shape[r][c] !== 0) {
          const nextX = x + c;
          const nextY = y + r;

          if (nextX < 0 || nextX >= COLS || nextY >= ROWS) {
            return true;
          }

          if (nextY >= 0 && grid[nextY][nextX] !== '') {
            return true;
          }
        }
      }
    }
    return false;
  };

  const movePiece = (dx: number, dy: number): boolean => {
    if (!currentPieceRef.current || gameOverRef.current) return false;

    const testPiece = {
      ...currentPieceRef.current,
      x: currentPieceRef.current.x + dx,
      y: currentPieceRef.current.y + dy,
    };

    if (!checkCollision(gridRef.current, testPiece)) {
      currentPieceRef.current = testPiece;
      draw();
      return true;
    }
    return false;
  };

  const rotatePiece = () => {
    if (!currentPieceRef.current || gameOverRef.current) return;

    const shape = currentPieceRef.current.shape;
    const N = shape.length;
    const M = shape[0].length;

    const rotatedShape: number[][] = Array.from({ length: M }, () => Array(N).fill(0));
    for (let r = 0; r < N; r++) {
      for (let c = 0; c < M; c++) {
        rotatedShape[c][N - 1 - r] = shape[r][c];
      }
    }

    const testPiece = {
      ...currentPieceRef.current,
      shape: rotatedShape,
    };

    const kicks = [0, -1, 1, -2, 2];
    for (let i = 0; i < kicks.length; i++) {
      testPiece.x = currentPieceRef.current.x + kicks[i];
      if (!checkCollision(gridRef.current, testPiece)) {
        currentPieceRef.current = testPiece;
        draw();
        break;
      }
    }
  };

  const lockPiece = () => {
    const piece = currentPieceRef.current;
    if (!piece) return;

    const { shape, x, y, color } = piece;
    for (let r = 0; r < shape.length; r++) {
      for (let c = 0; c < shape[r].length; c++) {
        if (shape[r][c] !== 0) {
          const gridY = y + r;
          const gridX = x + c;
          if (gridY >= 0 && gridY < ROWS) {
            gridRef.current[gridY][gridX] = color;
          }
        }
      }
    }
    currentPieceRef.current = null;
  };

  const clearLines = () => {
    let clearedCount = 0;
    const currentGrid = gridRef.current;
    const nextGrid: string[][] = [];

    for (let r = 0; r < ROWS; r++) {
      const isFull = currentGrid[r].every((cell) => cell !== '');
      if (isFull) {
        clearedCount++;
      } else {
        nextGrid.push([...currentGrid[r]]);
      }
    }

    while (nextGrid.length < ROWS) {
      nextGrid.unshift(Array(COLS).fill(''));
    }

    gridRef.current = nextGrid;

    if (clearedCount > 0) {
      linesRef.current += clearedCount;
      setLines(linesRef.current);

      scoreRef.current += [100, 300, 500, 800][Math.min(clearedCount - 1, 3)] * levelRef.current;
      setScore(scoreRef.current);

      const nextLevel = Math.floor(linesRef.current / 10) + 1;
      if (nextLevel > levelRef.current) {
        levelRef.current = nextLevel;
        setLevel(nextLevel);

        speedRef.current = Math.max(100, 800 - (nextLevel - 1) * 100);
        resetGameInterval();
      }
    }
  };

  const hardDrop = () => {
    if (!currentPieceRef.current || gameOverRef.current) return;

    while (movePiece(0, 1)) {
      // keep going until collision
    }

    lockPiece();
    clearLines();
    spawnPiece();
    draw();
  };

  const handleHoldClick = async () => {
    if (!isStartedRef.current || gameOverRef.current) return;
    if (!currentPieceRef.current) return;
    if (!canHoldThisDropRef.current) return;
    if (balance < HOLD_COST) return;

    const ok = await CoinService.spendCoins(HOLD_COST);
    if (!ok) return;

    const cur = currentPieceRef.current;
    // Capture current shape/color (re-clone shape) for hold storage
    const currentTemplate = { shape: cur.shape.map((r) => [...r]), color: cur.color };

    if (heldPieceRef.current) {
      // Swap: spawn the held piece, store current
      const held = heldPieceRef.current;
      heldPieceRef.current = currentTemplate;
      setHeldPreview(currentTemplate);
      spawnPiece(held);
    } else {
      // First hold: store current, spawn the next (from queue)
      heldPieceRef.current = currentTemplate;
      setHeldPreview(currentTemplate);
      spawnPiece();
    }

    canHoldThisDropRef.current = false;
    draw();
  };

  const handleGameOver = async () => {
    if (gameIntervalRef.current) clearInterval(gameIntervalRef.current);

    if (!continueUsed) {
      isStartedRef.current = false;
      setIsStarted(false);
      setShowContinue(true);
      return;
    }

    finalizeGameOver();
  };

  const finalizeGameOver = async () => {
    gameOverRef.current = true;
    setGameOver(true);
    isStartedRef.current = false;
    setIsStarted(false);
    if (gameIntervalRef.current) clearInterval(gameIntervalRef.current);

    const coins = await CoinService.reportGameScore('tetris', { won: false, level: levelRef.current });
    setEarnedCoins(coins);
    await CoinService.recordGamePlayed('Tetris');
  };

  const handleContinueAccept = () => {
    setShowContinue(false);
    setContinueUsed(true);

    // Clear top 4 rows for breathing room
    const g = gridRef.current;
    for (let r = 0; r < 4; r++) {
      g[r] = Array(COLS).fill('');
    }

    gameOverRef.current = false;
    currentPieceRef.current = null;
    isStartedRef.current = true;
    setIsStarted(true);

    spawnPiece();
    resetGameInterval();
    draw();
  };

  const handleContinueSkip = () => {
    setShowContinue(false);
    setContinueUsed(true);
    finalizeGameOver();
  };

  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    const cellSize = width / COLS;

    ctx.fillStyle = '#0a0814';
    ctx.fillRect(0, 0, width, height);

    ctx.strokeStyle = 'rgba(255,255,255,0.02)';
    ctx.lineWidth = 1;
    for (let r = 0; r <= ROWS; r++) {
      ctx.beginPath();
      ctx.moveTo(0, r * cellSize);
      ctx.lineTo(width, r * cellSize);
      ctx.stroke();
    }
    for (let c = 0; c <= COLS; c++) {
      ctx.beginPath();
      ctx.moveTo(c * cellSize, 0);
      ctx.lineTo(c * cellSize, height);
      ctx.stroke();
    }

    const grid = gridRef.current;
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const color = grid[r][c];
        if (color) {
          drawBlock(ctx, c, r, color, cellSize);
        }
      }
    }

    const piece = currentPieceRef.current;
    if (piece) {
      const { shape, color, x, y } = piece;
      for (let r = 0; r < shape.length; r++) {
        for (let c = 0; c < shape[r].length; c++) {
          if (shape[r][c] !== 0) {
            drawBlock(ctx, x + c, y + r, color, cellSize);
          }
        }
      }
    }
  };

  const drawBlock = (ctx: CanvasRenderingContext2D, x: number, y: number, color: string, size: number) => {
    ctx.fillStyle = color;
    ctx.fillRect(x * size + 1, y * size + 1, size - 2, size - 2);

    ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
    ctx.fillRect(x * size + 2, y * size + 2, size - 4, 3);
    ctx.fillRect(x * size + 2, y * size + 2, 3, size - 4);

    ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
    ctx.fillRect(x * size + 1, y * size + size - 3, size - 2, 2);
    ctx.fillRect(x * size + size - 3, y * size + 1, 2, size - 2);
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (gameOverRef.current) return;
      if (!isStartedRef.current) {
        if (e.key === 'Enter') startGame();
        return;
      }

      const key = e.key;
      if (key === 'ArrowLeft' || key === 'a') {
        e.preventDefault();
        movePiece(-1, 0);
      } else if (key === 'ArrowRight' || key === 'd') {
        e.preventDefault();
        movePiece(1, 0);
      } else if (key === 'ArrowDown' || key === 's') {
        e.preventDefault();
        movePiece(0, 1);
      } else if (key === 'ArrowUp' || key === 'w') {
        e.preventDefault();
        rotatePiece();
      } else if (key === ' ' || e.code === 'Space') {
        e.preventDefault();
        hardDrop();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      if (gameIntervalRef.current) clearInterval(gameIntervalRef.current);
    };
  }, []);

  useEffect(() => {
    initGame();
  }, []);

  // Subscribe to balance updates
  useEffect(() => {
    const unsub = CoinService.subscribe((d) => setBalance(d.balance));
    return () => unsub();
  }, []);

  const canHold = isStarted && !gameOver && canHoldThisDropRef.current && balance >= HOLD_COST;

  return (
    <div className="glass fullscreen-game-container">
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: 'var(--border-glass)', paddingBottom: '14px', marginBottom: '20px' }}>
        <div>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 800 }}>Xếp Hình (Tetris)</h2>
          <span style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)' }}>
            Điểm số: <strong style={{ color: 'var(--primary-color)' }}>{score}</strong> | Cấp độ: <strong>{level}</strong> | Dòng đã xóa: <strong>{lines}</strong>
          </span>
        </div>
        <button onClick={onClose} className="btn btn-danger" style={{ fontSize: '0.85rem' }}>
          Thoát
        </button>
      </div>

      {/* Play Area */}
      <div style={{ flexGrow: 1, display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', position: 'relative', gap: '16px', flexWrap: 'wrap' }}>
        {/* Canvas */}
        <div style={{ position: 'relative' }}>
          <canvas
            ref={canvasRef}
            width={280}
            height={560}
            style={{
              background: '#0a0814',
              borderRadius: '12px',
              border: '2px solid rgba(255, 255, 255, 0.1)',
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
            }}
          />

          {/* Start Game overlay */}
          {!isStarted && !gameOver && !showContinue && (
            <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', zIndex: 10, background: 'rgba(10,8,20,0.5)', borderRadius: 12 }}>
              <span style={{ fontSize: '3rem', marginBottom: '14px' }}>🧱</span>
              <button onClick={startGame} className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Play size={16} fill="white" /> Bắt đầu xếp hình
              </button>
            </div>
          )}

          {/* Game Over Screen Overlay */}
          {gameOver && (
            <div style={{ position: 'absolute', inset: 0, background: 'rgba(10,8,20,0.85)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', borderRadius: '12px', zIndex: 10 }}>
              <span style={{ fontSize: '3rem', marginBottom: '10px' }}>💀</span>
              <h3 style={{ color: '#e74c3c', fontSize: '1.8rem', fontWeight: 800, marginBottom: '6px' }}>Game Over!</h3>
              <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.9rem', marginBottom: '16px' }}>
                Cấp độ đạt được: **{level}** | Điểm số: **{score}**
              </p>
              {earnedCoins !== null && (
                <span style={{ fontSize: '1.2rem', fontWeight: 800, color: '#f1c40f', marginBottom: '24px' }}>
                  🪙 +{earnedCoins} xu thưởng!
                </span>
              )}

              <div style={{ display: 'flex', gap: '10px' }}>
                <button onClick={initGame} className="btn btn-primary">
                  Chơi Lại
                </button>
                <button onClick={onClose} className="btn btn-secondary">
                  Thoát
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Side Panel: NEXT + HOLD */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', minWidth: 100 }}>
          <PreviewPanel label="NEXT" piece={nextPreview} />
          <PreviewPanel label="HOLD" piece={heldPreview} />
          <button
            onClick={handleHoldClick}
            disabled={!canHold}
            style={{
              padding: '8px 10px',
              fontSize: '0.78rem',
              fontWeight: 800,
              borderRadius: 8,
              border: '1px solid rgba(241,196,15,0.4)',
              background: canHold
                ? 'linear-gradient(135deg, #f1c40f 0%, #e67e22 100%)'
                : 'rgba(255,255,255,0.05)',
              color: canHold ? '#1a1138' : 'rgba(255,255,255,0.35)',
              cursor: canHold ? 'pointer' : 'not-allowed',
              boxShadow: canHold ? '0 4px 12px rgba(241,196,15,0.3)' : 'none',
            }}
          >
            🔁 Hold ({HOLD_COST} xu)
          </button>
        </div>
      </div>

      <div style={{ textAlign: 'center', fontSize: '0.75rem', color: 'var(--color-text-muted)', fontWeight: 500 }}>
        💡 Các phím A / D hoặc ⬅️ ➡️ để di chuyển trái phải. Phím W hoặc ⬆️ để xoay khối hình. Phím S hoặc ⬇️ để thả nhanh. SPACE để rơi ngay lập tức (Hard Drop).
      </div>

      <ContinueModal
        isOpen={showContinue}
        cost={CONTINUE_COST}
        title="GAME OVER!"
        subtitle="Dọn 4 hàng trên cùng và tiếp tục?"
        onContinue={handleContinueAccept}
        onSkip={handleContinueSkip}
      />
    </div>
  );
};

// Small preview panel for NEXT / HOLD
const PreviewPanel: React.FC<{ label: string; piece: { shape: number[][]; color: string } | null }> = ({ label, piece }) => {
  const cells = 4; // 4x4 grid
  const size = 18;
  const totalSize = cells * size;

  return (
    <div
      style={{
        background: 'rgba(0,0,0,0.25)',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 10,
        padding: 8,
        textAlign: 'center',
      }}
    >
      <div style={{ fontSize: '0.7rem', fontWeight: 800, letterSpacing: 1.5, color: 'rgba(255,255,255,0.55)', marginBottom: 6 }}>
        {label}
      </div>
      <div
        style={{
          position: 'relative',
          width: totalSize,
          height: totalSize,
          margin: '0 auto',
          background: 'rgba(0,0,0,0.35)',
          borderRadius: 6,
        }}
      >
        {piece && (() => {
          const rows = piece.shape.length;
          const cols = piece.shape[0].length;
          const offsetX = ((cells - cols) * size) / 2;
          const offsetY = ((cells - rows) * size) / 2;
          const blocks: React.ReactNode[] = [];
          for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
              if (piece.shape[r][c] !== 0) {
                blocks.push(
                  <div
                    key={`${r}-${c}`}
                    style={{
                      position: 'absolute',
                      left: offsetX + c * size + 1,
                      top: offsetY + r * size + 1,
                      width: size - 2,
                      height: size - 2,
                      background: piece.color,
                      borderRadius: 2,
                      boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.25), inset 0 -3px 0 rgba(0,0,0,0.3)',
                    }}
                  />
                );
              }
            }
          }
          return blocks;
        })()}
      </div>
    </div>
  );
};
