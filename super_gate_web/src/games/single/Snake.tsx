import React, { useState, useEffect, useRef } from 'react';
import { Play } from 'lucide-react';
import { CoinService } from '../../services/coinService';
import { ContinueModal } from '../../components/ContinueModal';

interface SnakeProps {
  onClose: () => void;
}

type Point = { x: number; y: number };
type Direction = 'UP' | 'DOWN' | 'LEFT' | 'RIGHT';
type GameMode = 'classic' | 'wraparound' | 'mega_fruit' | 'speed_up' | 'obstacle';

interface Food extends Point {
  mega: boolean;
}

const CELL_COUNT = 20;
const BASE_INTERVAL = 110;
const CONTINUE_COST = 50;
const SLOWMO_COST = 30;
const SLOWMO_DURATION_MS = 5000;

const MODE_INFO: Record<GameMode, { label: string; emoji: string; desc: string }> = {
  classic: { label: 'Classic', emoji: '🐍', desc: 'Rắn kinh điển — đụng tường thua' },
  wraparound: { label: 'Xuyên Tường', emoji: '🌀', desc: 'Đi qua tường sang phía đối diện' },
  mega_fruit: { label: 'Mega Fruit', emoji: '🍅', desc: 'Quả vàng cho +3 dài & +3 điểm' },
  speed_up: { label: 'Tăng Tốc', emoji: '⚡', desc: 'Mỗi 5 quả → nhanh hơn 8%' },
  obstacle: { label: 'Chướng ngại', emoji: '🧱', desc: '3 obstacle ban đầu, +1 sau mỗi 10 quả' },
};

export const Snake: React.FC<SnakeProps> = ({ onClose }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const [phase, setPhase] = useState<'select' | 'play'>('select');
  const [selectedMode, setSelectedMode] = useState<GameMode>('classic');
  const [mode, setMode] = useState<GameMode>('classic');

  const [score, setScore] = useState<number>(0);
  const [isStarted, setIsStarted] = useState<boolean>(false);
  const [gameOver, setGameOver] = useState<boolean>(false);
  const [earnedCoins, setEarnedCoins] = useState<number | null>(null);
  const [showContinueModal, setShowContinueModal] = useState<boolean>(false);
  const [slowMoActive, setSlowMoActive] = useState<boolean>(false);

  // Use refs for game loop mutable state
  const snakeRef = useRef<Point[]>([]);
  const directionRef = useRef<Direction>('RIGHT');
  const nextDirectionRef = useRef<Direction>('RIGHT');
  const foodRef = useRef<Food>({ x: 0, y: 0, mega: false });
  const obstaclesRef = useRef<Point[]>([]);
  const gameIntervalRef = useRef<any>(null);
  const scoreRef = useRef<number>(0);
  const fruitEatenRef = useRef<number>(0);
  const baseIntervalRef = useRef<number>(BASE_INTERVAL);
  const slowMoTimeoutRef = useRef<any>(null);
  const continueUsedRef = useRef<boolean>(false);
  const modeRef = useRef<GameMode>('classic');

  const initGame = (m: GameMode, keepScore: boolean = false) => {
    if (gameIntervalRef.current) clearInterval(gameIntervalRef.current);
    if (slowMoTimeoutRef.current) clearTimeout(slowMoTimeoutRef.current);

    snakeRef.current = [
      { x: 10, y: 10 },
      { x: 9, y: 10 },
      { x: 8, y: 10 },
    ];
    directionRef.current = 'RIGHT';
    nextDirectionRef.current = 'RIGHT';

    if (!keepScore) {
      scoreRef.current = 0;
      setScore(0);
      fruitEatenRef.current = 0;
      baseIntervalRef.current = BASE_INTERVAL;
      continueUsedRef.current = false;
      obstaclesRef.current = [];
      if (m === 'obstacle') {
        spawnInitialObstacles(3);
      }
    }

    modeRef.current = m;
    setMode(m);
    setGameOver(false);
    setIsStarted(false);
    setEarnedCoins(null);
    setSlowMoActive(false);
    spawnFood();
    draw();
  };

  const startFromSelect = () => {
    initGame(selectedMode);
    setPhase('play');
  };

  const goBackToSelect = () => {
    if (gameIntervalRef.current) clearInterval(gameIntervalRef.current);
    if (slowMoTimeoutRef.current) clearTimeout(slowMoTimeoutRef.current);
    setPhase('select');
    setGameOver(false);
    setShowContinueModal(false);
  };

  const isCellBlocked = (p: Point): boolean => {
    if (snakeRef.current.some((part) => part.x === p.x && part.y === p.y)) return true;
    if (obstaclesRef.current.some((o) => o.x === p.x && o.y === p.y)) return true;
    return false;
  };

  const randomEmptyCell = (): Point | null => {
    const empty: Point[] = [];
    for (let x = 0; x < CELL_COUNT; x++) {
      for (let y = 0; y < CELL_COUNT; y++) {
        if (!isCellBlocked({ x, y })) empty.push({ x, y });
      }
    }
    if (empty.length === 0) return null;
    return empty[Math.floor(Math.random() * empty.length)];
  };

  const spawnInitialObstacles = (count: number) => {
    obstaclesRef.current = [];
    for (let i = 0; i < count; i++) {
      const cell = randomEmptyCell();
      if (cell) obstaclesRef.current.push(cell);
    }
  };

  const spawnFood = () => {
    const cell = randomEmptyCell();
    if (!cell) return;
    const mega = modeRef.current === 'mega_fruit' && Math.random() < 0.2;
    foodRef.current = { x: cell.x, y: cell.y, mega };
  };

  const getCurrentInterval = (): number => {
    let v = baseIntervalRef.current;
    if (slowMoTimeoutRef.current) v = Math.round(v * 1.6);
    return Math.max(40, v);
  };

  const restartLoop = () => {
    if (gameIntervalRef.current) clearInterval(gameIntervalRef.current);
    gameIntervalRef.current = setInterval(gameLoop, getCurrentInterval());
  };

  const startGame = () => {
    setIsStarted(true);
    restartLoop();
  };

  const gameLoop = () => {
    directionRef.current = nextDirectionRef.current;
    const head = { ...snakeRef.current[0] };

    switch (directionRef.current) {
      case 'UP': head.y -= 1; break;
      case 'DOWN': head.y += 1; break;
      case 'LEFT': head.x -= 1; break;
      case 'RIGHT': head.x += 1; break;
    }

    // Wall handling
    if (modeRef.current === 'wraparound') {
      head.x = (head.x + CELL_COUNT) % CELL_COUNT;
      head.y = (head.y + CELL_COUNT) % CELL_COUNT;
    } else {
      const hitWall = head.x < 0 || head.x >= CELL_COUNT || head.y < 0 || head.y >= CELL_COUNT;
      if (hitWall) {
        handleGameOver();
        return;
      }
    }

    const hitSelf = snakeRef.current.some((part) => part.x === head.x && part.y === head.y);
    const hitObstacle = obstaclesRef.current.some((o) => o.x === head.x && o.y === head.y);

    if (hitSelf || hitObstacle) {
      handleGameOver();
      return;
    }

    const newSnake = [head, ...snakeRef.current];

    // Food eaten
    if (head.x === foodRef.current.x && head.y === foodRef.current.y) {
      const wasMega = foodRef.current.mega;
      const gain = wasMega ? 3 : 1;
      scoreRef.current += gain;
      setScore(scoreRef.current);
      fruitEatenRef.current += 1;

      // Add length: gain - 1 extra segments (we already keep tail this tick = +1)
      // For gain=3, we need to keep tail this tick and add 2 extra duplicates
      for (let i = 1; i < gain; i++) {
        newSnake.push({ ...newSnake[newSnake.length - 1] });
      }

      // Speed up mode
      if (modeRef.current === 'speed_up' && fruitEatenRef.current % 5 === 0) {
        baseIntervalRef.current = Math.max(40, Math.round(baseIntervalRef.current * 0.92));
        restartLoop();
      }

      // Obstacle mode — add one obstacle every 10 fruit
      if (modeRef.current === 'obstacle' && fruitEatenRef.current % 10 === 0) {
        snakeRef.current = newSnake;
        const cell = randomEmptyCell();
        if (cell) obstaclesRef.current.push(cell);
      }

      spawnFood();
    } else {
      newSnake.pop();
    }

    snakeRef.current = newSnake;
    draw();
  };

  const handleGameOver = () => {
    if (gameIntervalRef.current) clearInterval(gameIntervalRef.current);
    if (slowMoTimeoutRef.current) {
      clearTimeout(slowMoTimeoutRef.current);
      slowMoTimeoutRef.current = null;
      setSlowMoActive(false);
    }

    if (!continueUsedRef.current) {
      setShowContinueModal(true);
      return;
    }

    finalizeGameOver();
  };

  const finalizeGameOver = async () => {
    setGameOver(true);
    setIsStarted(false);

    const coins = await CoinService.reportGameScore('snake', { won: false, score: scoreRef.current });
    setEarnedCoins(coins);
    await CoinService.recordGamePlayed('Snake');
  };

  const handleContinue = () => {
    continueUsedRef.current = true;
    setShowContinueModal(false);

    // Reset snake to center, length 3, keep score & obstacles & mode state
    snakeRef.current = [
      { x: 10, y: 10 },
      { x: 9, y: 10 },
      { x: 8, y: 10 },
    ];
    directionRef.current = 'RIGHT';
    nextDirectionRef.current = 'RIGHT';

    // If snake spawn collides with obstacle, clear those obstacles
    obstaclesRef.current = obstaclesRef.current.filter(
      (o) => !snakeRef.current.some((p) => p.x === o.x && p.y === o.y),
    );

    spawnFood();
    draw();

    // Resume loop
    gameIntervalRef.current = setInterval(gameLoop, getCurrentInterval());
  };

  const handleSkipContinue = () => {
    setShowContinueModal(false);
    finalizeGameOver();
  };

  const activateSlowMo = async () => {
    if (slowMoTimeoutRef.current) return; // already active
    if (!isStarted || gameOver) return;
    const ok = await CoinService.spendCoins(SLOWMO_COST);
    if (!ok) return;

    setSlowMoActive(true);
    restartLoop();

    slowMoTimeoutRef.current = setTimeout(() => {
      slowMoTimeoutRef.current = null;
      setSlowMoActive(false);
      restartLoop();
    }, SLOWMO_DURATION_MS);
  };

  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const cellSize = width / CELL_COUNT;

    ctx.fillStyle = '#0a0814';
    ctx.fillRect(0, 0, width, width);

    // Grid lines
    ctx.strokeStyle = 'rgba(255,255,255,0.015)';
    ctx.lineWidth = 1;
    for (let i = 0; i <= CELL_COUNT; i++) {
      ctx.beginPath();
      ctx.moveTo(i * cellSize, 0);
      ctx.lineTo(i * cellSize, width);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(0, i * cellSize);
      ctx.lineTo(width, i * cellSize);
      ctx.stroke();
    }

    // Obstacles
    obstaclesRef.current.forEach((o) => {
      ctx.fillStyle = '#4a4a55';
      ctx.shadowBlur = 0;
      ctx.fillRect(o.x * cellSize + 1, o.y * cellSize + 1, cellSize - 2, cellSize - 2);
      ctx.strokeStyle = 'rgba(255,255,255,0.1)';
      ctx.lineWidth = 1;
      ctx.strokeRect(o.x * cellSize + 1, o.y * cellSize + 1, cellSize - 2, cellSize - 2);
    });

    // Food
    const isMega = foodRef.current.mega;
    ctx.shadowBlur = isMega ? 18 : 10;
    ctx.shadowColor = isMega ? '#f1c40f' : '#e74c3c';
    ctx.fillStyle = isMega ? '#f1c40f' : '#e74c3c';
    ctx.beginPath();
    const foodX = foodRef.current.x * cellSize + cellSize / 2;
    const foodY = foodRef.current.y * cellSize + cellSize / 2;
    ctx.arc(foodX, foodY, (cellSize / 2 - 2) * (isMega ? 1.05 : 1), 0, Math.PI * 2);
    ctx.fill();

    if (isMega) {
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#1a1138';
      ctx.font = `bold ${Math.floor(cellSize * 0.7)}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('★', foodX, foodY);
    }

    ctx.shadowBlur = 0;

    // Snake
    snakeRef.current.forEach((part, idx) => {
      const isHead = idx === 0;
      if (isHead) {
        ctx.fillStyle = '#2ecc71';
        ctx.shadowBlur = 8;
        ctx.shadowColor = '#2ecc71';
      } else {
        ctx.fillStyle = `rgba(46, 204, 113, ${1 - idx / (snakeRef.current.length * 1.2)})`;
        ctx.shadowBlur = 0;
      }

      ctx.beginPath();
      ctx.roundRect(
        part.x * cellSize + 1,
        part.y * cellSize + 1,
        cellSize - 2,
        cellSize - 2,
        isHead ? 6 : 4,
      );
      ctx.fill();
    });

    ctx.shadowBlur = 0;
  };

  // Keyboard controls
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const key = e.key;
      const currentDir = directionRef.current;

      if ((key === 'ArrowUp' || key === 'w') && currentDir !== 'DOWN') {
        nextDirectionRef.current = 'UP';
      } else if ((key === 'ArrowDown' || key === 's') && currentDir !== 'UP') {
        nextDirectionRef.current = 'DOWN';
      } else if ((key === 'ArrowLeft' || key === 'a') && currentDir !== 'RIGHT') {
        nextDirectionRef.current = 'LEFT';
      } else if ((key === 'ArrowRight' || key === 'd') && currentDir !== 'LEFT') {
        nextDirectionRef.current = 'RIGHT';
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Setup on play phase enter
  useEffect(() => {
    if (phase === 'play') {
      draw();
    }
    return () => {
      // No-op
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (gameIntervalRef.current) clearInterval(gameIntervalRef.current);
      if (slowMoTimeoutRef.current) clearTimeout(slowMoTimeoutRef.current);
    };
  }, []);

  // ── Render: Select phase ─────────────────────────────────────────────────────
  if (phase === 'select') {
    return (
      <div className="glass fullscreen-game-container">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: 'var(--border-glass)', paddingBottom: '14px', marginBottom: '20px' }}>
          <div>
            <h2 style={{ fontSize: '1.4rem', fontWeight: 800 }}>Rắn Săn Mồi (Snake)</h2>
            <span style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)' }}>
              Chọn chế độ chơi
            </span>
          </div>
          <button onClick={onClose} className="btn btn-danger" style={{ fontSize: '0.85rem' }}>
            Thoát
          </button>
        </div>

        <div style={{ flexGrow: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '20px' }}>
          <div style={{ width: '100%', maxWidth: '520px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '10px' }}>
            {(Object.keys(MODE_INFO) as GameMode[]).map((m) => {
              const info = MODE_INFO[m];
              const active = selectedMode === m;
              return (
                <button
                  key={m}
                  onClick={() => setSelectedMode(m)}
                  className={active ? 'btn btn-primary' : 'btn btn-secondary'}
                  style={{ padding: '12px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', textAlign: 'center' }}
                >
                  <span style={{ fontSize: '1.6rem' }}>{info.emoji}</span>
                  <span style={{ fontSize: '0.95rem', fontWeight: 800 }}>{info.label}</span>
                  <span style={{ fontSize: '0.7rem', opacity: 0.8, lineHeight: 1.3 }}>{info.desc}</span>
                </button>
              );
            })}
          </div>

          <button onClick={startFromSelect} className="btn btn-primary" style={{ fontSize: '1rem', padding: '12px 36px' }}>
            ▶ Bắt đầu
          </button>
        </div>

        <div style={{ textAlign: 'center', fontSize: '0.75rem', color: 'var(--color-text-muted)', fontWeight: 500 }}>
          💡 Slow-mo (30 xu) trong game làm rắn chậm lại 5s. Game over có thể tiếp tục với 50 xu.
        </div>
      </div>
    );
  }

  // ── Render: Play phase ───────────────────────────────────────────────────────
  return (
    <div className="glass fullscreen-game-container">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: 'var(--border-glass)', paddingBottom: '14px', marginBottom: '20px', flexWrap: 'wrap', gap: '8px' }}>
        <div>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 800 }}>Rắn Săn Mồi (Snake)</h2>
          <span style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)' }}>
            {MODE_INFO[mode].emoji} {MODE_INFO[mode].label} • Điểm: <strong style={{ color: 'var(--primary-color)', fontSize: '1rem' }}>{score}</strong>
            {slowMoActive && <span style={{ marginLeft: '8px', color: '#5dade2' }}>🐌 Slow-mo!</span>}
          </span>
        </div>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button
            onClick={activateSlowMo}
            disabled={!isStarted || slowMoActive || gameOver}
            className="btn btn-secondary"
            style={{ fontSize: '0.85rem', opacity: (!isStarted || slowMoActive || gameOver) ? 0.5 : 1 }}
          >
            🐌 Slow-mo ({SLOWMO_COST} xu)
          </button>
          <button onClick={goBackToSelect} className="btn btn-secondary" style={{ fontSize: '0.85rem' }}>
            Đổi mode
          </button>
          <button onClick={onClose} className="btn btn-danger" style={{ fontSize: '0.85rem' }}>
            Thoát
          </button>
        </div>
      </div>

      <div style={{ flexGrow: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
        <canvas
          ref={canvasRef}
          width={440}
          height={440}
          style={{
            background: '#0a0814',
            borderRadius: '12px',
            border: '2px solid rgba(255, 255, 255, 0.1)',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
          }}
        />

        {!isStarted && !gameOver && !showContinueModal && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', zIndex: 10, background: 'rgba(10,8,20,0.5)' }}>
            <span style={{ fontSize: '3rem', marginBottom: '14px' }}>{MODE_INFO[mode].emoji}</span>
            <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.85rem', marginBottom: '12px', textAlign: 'center', maxWidth: '300px' }}>
              {MODE_INFO[mode].desc}
            </p>
            <button onClick={startGame} className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Play size={16} fill="white" /> Bắt đầu chơi
            </button>
          </div>
        )}

        {gameOver && (
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(10,8,20,0.85)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', borderRadius: '12px', zIndex: 10 }}>
            <span style={{ fontSize: '3rem', marginBottom: '10px' }}>💀</span>
            <h3 style={{ color: '#e74c3c', fontSize: '1.8rem', fontWeight: 800, marginBottom: '6px' }}>Kết Thúc Ván!</h3>
            <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.9rem', marginBottom: '16px' }}>
              Điểm số của bạn: <strong>{score}</strong>
            </p>
            {earnedCoins !== null && (
              <span style={{ fontSize: '1.2rem', fontWeight: 800, color: '#f1c40f', marginBottom: '24px' }}>
                🪙 +{earnedCoins} xu thưởng!
              </span>
            )}

            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={() => initGame(mode)} className="btn btn-primary">
                Chơi Lại
              </button>
              <button onClick={goBackToSelect} className="btn btn-secondary">
                Đổi mode
              </button>
              <button onClick={onClose} className="btn btn-secondary">
                Thoát
              </button>
            </div>
          </div>
        )}
      </div>

      <ContinueModal
        isOpen={showContinueModal}
        cost={CONTINUE_COST}
        title="GAME OVER"
        subtitle="Hồi sinh rắn ở giữa, giữ điểm hiện tại?"
        onContinue={handleContinue}
        onSkip={handleSkipContinue}
      />

      <div style={{ textAlign: 'center', fontSize: '0.75rem', color: 'var(--color-text-muted)', fontWeight: 500 }}>
        💡 Nhấn mũi tên ⬅️ ⬆️ ➡️ ⬇️ hoặc WASD để điều khiển. Slow-mo giúp tránh va chạm khi cấp tốc.
      </div>
    </div>
  );
};
