import React, { useEffect, useRef, useState } from 'react';
import { CoinService } from '../../services/coinService';
import confetti from 'canvas-confetti';

interface PlinkoProps {
  onClose: () => void;
}

const ROWS = 8;
// 9 buckets at the bottom (rows + 1)
const BUCKET_MULTIPLIERS = [10, 4, 2, 1, 0.5, 1, 2, 4, 10];

// Layout config
const WIDTH = 460;
const HEIGHT = 480;
const TOP_PADDING = 30;
const BOTTOM_PADDING = 60;
const PEG_RADIUS = 5;
const BALL_RADIUS = 9;

interface Ball {
  id: number;
  x: number;
  y: number;
  vy: number;
  row: number;
  path: number[]; // -1 left, 1 right for each row
  bucket: number;
  done: boolean;
  bet: number;
  color: string;
}

interface PegPos { x: number; y: number; row: number; col: number; }

// Pre-compute peg positions: row r has r+1 pegs
const computePegs = (): PegPos[] => {
  const pegs: PegPos[] = [];
  const verticalSpan = HEIGHT - TOP_PADDING - BOTTOM_PADDING;
  const rowGap = verticalSpan / ROWS;
  for (let r = 0; r < ROWS; r++) {
    const count = r + 2; // row 0 has 2 pegs
    const rowWidth = (count - 1) * (WIDTH / (ROWS + 2));
    const startX = (WIDTH - rowWidth) / 2;
    const y = TOP_PADDING + (r + 1) * rowGap;
    for (let c = 0; c < count; c++) {
      const x = startX + c * (WIDTH / (ROWS + 2));
      pegs.push({ x, y, row: r, col: c });
    }
  }
  return pegs;
};

const PEGS = computePegs();
const BALL_COLORS = ['#f1c40f', '#e74c3c', '#3498db', '#2ecc71', '#9b59b6'];

export const Plinko: React.FC<PlinkoProps> = ({ onClose }) => {
  const [balance, setBalance] = useState<number>(0);
  const [bet, setBet] = useState<number>(50);
  const [balls, setBalls] = useState<Ball[]>([]);
  const [message, setMessage] = useState<string>('Đặt cược rồi thả bóng xem rơi vào ô nào!');
  const [recentBuckets, setRecentBuckets] = useState<number[]>([]);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const ballsRef = useRef<Ball[]>([]);
  const animRef = useRef<number>(0);
  const idRef = useRef<number>(0);

  useEffect(() => {
    setBalance(CoinService.getData().balance);
    const unsub = CoinService.subscribe((d) => setBalance(d.balance));
    return () => {
      unsub();
      cancelAnimationFrame(animRef.current);
    };
  }, []);

  // Sync state -> ref for animation loop
  useEffect(() => {
    ballsRef.current = balls;
  }, [balls]);

  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, WIDTH, HEIGHT);

    // Background gradient
    const grad = ctx.createLinearGradient(0, 0, 0, HEIGHT);
    grad.addColorStop(0, 'rgba(40, 20, 60, 0.4)');
    grad.addColorStop(1, 'rgba(20, 10, 30, 0.6)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    // Pegs
    ctx.fillStyle = '#bdc3c7';
    PEGS.forEach((p) => {
      ctx.beginPath();
      ctx.arc(p.x, p.y, PEG_RADIUS, 0, Math.PI * 2);
      ctx.fill();
    });

    // Buckets
    const bucketCount = BUCKET_MULTIPLIERS.length;
    const bucketWidth = WIDTH / bucketCount;
    const bucketY = HEIGHT - BOTTOM_PADDING + 4;
    BUCKET_MULTIPLIERS.forEach((mul, i) => {
      const x = i * bucketWidth;
      const color = mul >= 10 ? '#e74c3c' : mul >= 4 ? '#f39c12' : mul >= 2 ? '#f1c40f' : mul >= 1 ? '#2ecc71' : '#3498db';
      ctx.fillStyle = color;
      ctx.fillRect(x + 2, bucketY, bucketWidth - 4, BOTTOM_PADDING - 8);
      ctx.fillStyle = 'white';
      ctx.font = 'bold 13px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`${mul}x`, x + bucketWidth / 2, bucketY + (BOTTOM_PADDING - 8) / 2);
    });

    // Balls
    ballsRef.current.forEach((b) => {
      ctx.beginPath();
      ctx.arc(b.x, b.y, BALL_RADIUS, 0, Math.PI * 2);
      ctx.fillStyle = b.color;
      ctx.shadowBlur = 12;
      ctx.shadowColor = b.color;
      ctx.fill();
      ctx.shadowBlur = 0;
    });
  };

  const stepPhysics = () => {
    let anyAlive = false;
    const verticalSpan = HEIGHT - TOP_PADDING - BOTTOM_PADDING;
    const rowGap = verticalSpan / ROWS;
    const bucketCount = BUCKET_MULTIPLIERS.length;
    const bucketWidth = WIDTH / bucketCount;

    const updated = ballsRef.current.map((b) => {
      if (b.done) return b;
      anyAlive = true;

      // accelerate
      b.vy += 0.18;
      b.y += b.vy;

      // If we just crossed a peg row, deflect left/right
      const nextPegRow = b.row;
      if (nextPegRow < ROWS) {
        const targetY = TOP_PADDING + (nextPegRow + 1) * rowGap;
        if (b.y >= targetY) {
          const dir = b.path[nextPegRow];
          // shift horizontally by half peg spacing
          const shift = (WIDTH / (ROWS + 2)) / 2;
          b.x += dir * shift;
          b.y = targetY + 1;
          b.vy = Math.min(b.vy, 3.5); // dampen
          b.row = nextPegRow + 1;
        }
      }

      // Reached bucket zone
      if (b.y >= HEIGHT - BOTTOM_PADDING) {
        b.done = true;
        // Determine bucket index by x
        let bucketIdx = Math.floor(b.x / bucketWidth);
        bucketIdx = Math.max(0, Math.min(bucketCount - 1, bucketIdx));
        // Snap x to bucket center
        b.x = bucketIdx * bucketWidth + bucketWidth / 2;
        b.y = HEIGHT - BOTTOM_PADDING / 2 - 4;
        b.bucket = bucketIdx;
        onBallLanded(b);
      }

      // Clamp x
      b.x = Math.max(BALL_RADIUS, Math.min(WIDTH - BALL_RADIUS, b.x));
      return b;
    });

    ballsRef.current = updated;
    draw();

    if (anyAlive) {
      animRef.current = requestAnimationFrame(stepPhysics);
    } else {
      // schedule cleanup of done balls
      setTimeout(() => {
        setBalls((prev) => prev.filter((b) => !b.done));
        ballsRef.current = ballsRef.current.filter((b) => !b.done);
        draw();
      }, 1500);
    }
  };

  const onBallLanded = async (b: Ball) => {
    const mul = BUCKET_MULTIPLIERS[b.bucket];
    const win = Math.floor(b.bet * mul);
    if (win > 0) {
      await CoinService.earnCoins(win);
    }
    const net = win - b.bet;
    setMessage(`🎯 Ô ${mul}x — ${net >= 0 ? `+${net}` : net} xu`);
    setRecentBuckets((r) => [b.bucket, ...r].slice(0, 10));
    if (mul >= 10) {
      confetti({ particleCount: 80, spread: 70, origin: { x: 0.5, y: 0.7 } });
    } else if (mul >= 4) {
      confetti({ particleCount: 30, spread: 50, origin: { y: 0.7 } });
    }
    await CoinService.recordGamePlayed('Plinko');
  };

  const dropBall = async () => {
    if (ballsRef.current.filter((b) => !b.done).length >= 5) {
      setMessage('⚠️ Tối đa 5 bóng đang rơi.');
      return;
    }
    if (bet > balance) {
      alert('❌ Không đủ xu cược!');
      return;
    }
    const ok = await CoinService.spendCoins(bet);
    if (!ok) return;

    // pre-compute random path (-1 / 1) for each row
    const path: number[] = [];
    for (let r = 0; r < ROWS; r++) {
      path.push(Math.random() < 0.5 ? -1 : 1);
    }

    const newBall: Ball = {
      id: ++idRef.current,
      x: WIDTH / 2 + (Math.random() - 0.5) * 6,
      y: 5,
      vy: 1.5,
      row: 0,
      path,
      bucket: -1,
      done: false,
      bet,
      color: BALL_COLORS[idRef.current % BALL_COLORS.length],
    };

    const next = [...ballsRef.current, newBall];
    ballsRef.current = next;
    setBalls(next);

    // start animation if not running
    cancelAnimationFrame(animRef.current);
    animRef.current = requestAnimationFrame(stepPhysics);
  };

  // Initial draw
  useEffect(() => {
    draw();

  }, []);

  return (
    <div className="glass fullscreen-game-container">
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: 'var(--border-glass)', paddingBottom: '14px', marginBottom: '16px' }}>
        <div>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 800 }}>🎯 Plinko</h2>
          <span style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)' }}>
            Số dư: <strong style={{ color: '#f1c40f' }}>🪙 {balance} xu</strong>
          </span>
        </div>
        <button onClick={onClose} className="btn btn-danger">Quay lại</button>
      </div>

      <div style={{ flexGrow: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '14px' }}>
        <canvas
          ref={canvasRef}
          width={WIDTH}
          height={HEIGHT}
          style={{
            borderRadius: '14px',
            border: 'var(--border-glass)',
            background: 'rgba(0,0,0,0.3)',
            maxWidth: '100%',
          }}
        />

        <div style={{ fontSize: '1rem', fontWeight: 800, textAlign: 'center', minHeight: '24px', color: 'var(--color-text-secondary)' }}>
          {message}
        </div>

        {/* Recent landings */}
        {recentBuckets.length > 0 && (
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', justifyContent: 'center' }}>
            {recentBuckets.map((b, i) => {
              const mul = BUCKET_MULTIPLIERS[b];
              const color = mul >= 10 ? '#e74c3c' : mul >= 4 ? '#f39c12' : mul >= 2 ? '#f1c40f' : mul >= 1 ? '#2ecc71' : '#3498db';
              return (
                <span key={i} style={{ padding: '3px 9px', borderRadius: '10px', background: color, color: 'white', fontWeight: 800, fontSize: '0.7rem' }}>
                  {mul}x
                </span>
              );
            })}
          </div>
        )}

        {/* Controls */}
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap', justifyContent: 'center', width: '100%', maxWidth: WIDTH }}>
          <span style={{ fontSize: '0.85rem' }}>Cược:</span>
          {[10, 50, 100, 500].map((v) => (
            <button
              key={v}
              onClick={() => setBet(v)}
              className="btn"
              style={{
                padding: '6px 14px',
                fontSize: '0.8rem',
                fontWeight: 800,
                borderRadius: '20px',
                background: bet === v ? '#f1c40f' : 'rgba(255,255,255,0.06)',
                color: bet === v ? '#000' : 'white',
                border: 'none',
              }}
            >
              {v}
            </button>
          ))}
          <button
            onClick={dropBall}
            disabled={bet > balance}
            className="btn btn-primary"
            style={{ height: '44px', padding: '0 24px', fontWeight: 800, background: 'linear-gradient(135deg, #8e44ad, #3498db)' }}
          >
            ⬇ THẢ BÓNG ({bet} xu)
          </button>
        </div>
      </div>
    </div>
  );
};
