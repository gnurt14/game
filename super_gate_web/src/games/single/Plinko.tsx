import React, { useEffect, useRef, useState } from 'react';
import { CoinService } from '../../services/coinService';
import confetti from 'canvas-confetti';

interface PlinkoProps {
  onClose: () => void;
}

const ROWS = 8;
// 9 buckets at the bottom = ROWS + 1
// Đã nerf để có house edge ~11% (EV ≈ 0.89 cost):
//   bucket prob = C(8,k)/256: [0.39%, 3.13%, 10.94%, 21.88%, 27.34%, ...]
//   Ô giữa thường xuyên nhất → multiplier thấp (player thường thua nhẹ)
//   Ô biên hiếm → jackpot 10x giữ nguyên cho cảm giác kích thích
const BUCKET_MULTIPLIERS = [10, 3, 1.5, 0.5, 0.3, 0.5, 1.5, 3, 10];

// Layout config
const WIDTH = 440;
const HEIGHT = 520;
const TOP_PADDING = 40;
const BOTTOM_PADDING = 70;
const PEG_RADIUS = 4;
const BALL_RADIUS = 7;

// Derived layout: row r has r+1 pegs.
// Horizontal spacing between adjacent pegs in same row.
const PEG_SPACING = WIDTH / (ROWS + 2);
const ROW_GAP = (HEIGHT - TOP_PADDING - BOTTOM_PADDING) / (ROWS + 1);

function pegPos(row: number, col: number): { x: number; y: number } {
  // row r has r+1 pegs, centered horizontally
  const count = row + 1;
  const startX = WIDTH / 2 - ((count - 1) * PEG_SPACING) / 2;
  return {
    x: startX + col * PEG_SPACING,
    y: TOP_PADDING + (row + 1) * ROW_GAP,
  };
}

const ALL_PEGS = (() => {
  const arr: { x: number; y: number }[] = [];
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c <= r; c++) {
      arr.push(pegPos(r, c));
    }
  }
  return arr;
})();

interface Ball {
  id: number;
  x: number;
  y: number;
  vy: number;
  vx: number;
  row: number;          // next peg row to interact with (0..ROWS)
  col: number;          // col of the peg we last bounced off (0..row)
  path: number[];       // 0 = left, 1 = right per row
  finalBucket: number;  // pre-computed bucket index = sum(path)
  bucket: number;       // -1 until landed
  done: boolean;
  bet: number;
  color: string;
  landedAt: number;     // timestamp when landed (for cleanup)
}

const BALL_COLORS = ['#f1c40f', '#e74c3c', '#3498db', '#2ecc71', '#9b59b6'];

export const Plinko: React.FC<PlinkoProps> = ({ onClose }) => {
  const [balance, setBalance] = useState<number>(0);
  const [bet, setBet] = useState<number>(50);
  const [message, setMessage] = useState<string>('Đặt cược rồi thả bóng xem rơi vào ô nào!');
  const [recentBuckets, setRecentBuckets] = useState<number[]>([]);
  const [activeCount, setActiveCount] = useState<number>(0);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const ballsRef = useRef<Ball[]>([]);
  const animRef = useRef<number>(0);
  const idRef = useRef<number>(0);
  const lastTickRef = useRef<number>(0);

  useEffect(() => {
    setBalance(CoinService.getData().balance);
    const unsub = CoinService.subscribe((d) => setBalance(d.balance));
    return () => {
      unsub();
      cancelAnimationFrame(animRef.current);
    };
  }, []);

  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, WIDTH, HEIGHT);

    // Background gradient
    const grad = ctx.createLinearGradient(0, 0, 0, HEIGHT);
    grad.addColorStop(0, 'rgba(40, 20, 60, 0.6)');
    grad.addColorStop(1, 'rgba(20, 10, 30, 0.85)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    // Pegs
    ALL_PEGS.forEach((p) => {
      ctx.beginPath();
      ctx.arc(p.x, p.y, PEG_RADIUS, 0, Math.PI * 2);
      ctx.fillStyle = '#d6dbdf';
      ctx.shadowBlur = 4;
      ctx.shadowColor = 'rgba(255,255,255,0.4)';
      ctx.fill();
      ctx.shadowBlur = 0;
    });

    // Buckets — 9 boxes spanning full bottom
    const bucketCount = BUCKET_MULTIPLIERS.length;
    const bucketWidth = WIDTH / bucketCount;
    const bucketY = HEIGHT - BOTTOM_PADDING + 6;
    const bucketHeight = BOTTOM_PADDING - 12;
    BUCKET_MULTIPLIERS.forEach((mul, i) => {
      const x = i * bucketWidth;
      const color =
        mul >= 10 ? '#e74c3c' : mul >= 4 ? '#f39c12' : mul >= 2 ? '#f1c40f' : mul >= 1 ? '#2ecc71' : '#3498db';
      // gradient fill
      const g = ctx.createLinearGradient(x, bucketY, x, bucketY + bucketHeight);
      g.addColorStop(0, color);
      g.addColorStop(1, color + 'b0');
      ctx.fillStyle = g;
      ctx.fillRect(x + 2, bucketY, bucketWidth - 4, bucketHeight);

      ctx.fillStyle = 'white';
      ctx.font = 'bold 14px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.shadowBlur = 4;
      ctx.shadowColor = 'rgba(0,0,0,0.5)';
      ctx.fillText(`${mul}x`, x + bucketWidth / 2, bucketY + bucketHeight / 2);
      ctx.shadowBlur = 0;
    });

    // Balls
    ballsRef.current.forEach((b) => {
      // glow
      ctx.beginPath();
      ctx.arc(b.x, b.y, BALL_RADIUS + 3, 0, Math.PI * 2);
      ctx.fillStyle = b.color + '40';
      ctx.fill();
      // body
      ctx.beginPath();
      ctx.arc(b.x, b.y, BALL_RADIUS, 0, Math.PI * 2);
      ctx.fillStyle = b.color;
      ctx.shadowBlur = 14;
      ctx.shadowColor = b.color;
      ctx.fill();
      ctx.shadowBlur = 0;
      // highlight
      ctx.beginPath();
      ctx.arc(b.x - 2, b.y - 2, BALL_RADIUS / 3, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255,255,255,0.6)';
      ctx.fill();
    });
  };

  const stepPhysics = (now: number) => {
    if (lastTickRef.current === 0) lastTickRef.current = now;
    const dt = Math.min(32, now - lastTickRef.current) / 16; // normalize to 60fps frames
    lastTickRef.current = now;

    let anyMoving = false;
    const bucketWidth = WIDTH / BUCKET_MULTIPLIERS.length;
    const bucketBottomY = HEIGHT - BOTTOM_PADDING / 2 - 4;

    for (const b of ballsRef.current) {
      if (b.done) continue;

      // Gravity
      b.vy = Math.min(b.vy + 0.22 * dt, 6.5);
      b.x += b.vx * dt;
      b.y += b.vy * dt;

      // Friction on vx
      b.vx *= 0.92;

      // Check collision with next peg row
      if (b.row < ROWS) {
        const targetPeg = pegPos(b.row, b.col);
        // Ball crosses the peg row → deflect
        if (b.y >= targetPeg.y - 1) {
          const dir = b.path[b.row] === 1 ? 1 : -1;
          // Set horizontal velocity to glide to next peg over a few frames
          b.vx = (dir * PEG_SPACING) / 8; // covers half-spacing in ~4 frames
          // Snap y above next row to avoid sliding through pegs visually
          b.y = targetPeg.y + 2;
          // Reset vy a bit (bounce)
          b.vy = Math.max(1.0, b.vy * 0.55);
          // Move to next row, col follows path
          b.row += 1;
          b.col = b.col + (b.path[b.row - 1] === 1 ? 1 : 0);
        }
      }

      // Ball reaches bucket zone
      if (b.y >= HEIGHT - BOTTOM_PADDING + 4) {
        b.done = true;
        b.bucket = b.finalBucket;
        // Snap to bucket center for visual consistency
        b.x = b.finalBucket * bucketWidth + bucketWidth / 2;
        b.y = bucketBottomY;
        b.vx = 0;
        b.vy = 0;
        b.landedAt = now;
        // schedule reward outside the loop to avoid mutating during iteration
        queueMicrotask(() => onBallLanded(b));
      } else {
        anyMoving = true;
      }

      // Soft clamp x (only when ball is past the peg field)
      const minX = BALL_RADIUS;
      const maxX = WIDTH - BALL_RADIUS;
      if (b.x < minX) {
        b.x = minX;
        b.vx = Math.abs(b.vx) * 0.4;
      } else if (b.x > maxX) {
        b.x = maxX;
        b.vx = -Math.abs(b.vx) * 0.4;
      }
    }

    // Cleanup balls that have been settled > 1500ms
    const cleanupBefore = now - 1500;
    const before = ballsRef.current.length;
    ballsRef.current = ballsRef.current.filter((b) => !b.done || b.landedAt > cleanupBefore);
    if (ballsRef.current.length !== before) {
      setActiveCount(ballsRef.current.filter((b) => !b.done).length);
    }

    draw();

    if (anyMoving || ballsRef.current.some((b) => b.done)) {
      animRef.current = requestAnimationFrame(stepPhysics);
    } else {
      lastTickRef.current = 0;
    }
  };

  const onBallLanded = async (b: Ball) => {
    const mul = BUCKET_MULTIPLIERS[b.bucket];
    const win = Math.floor(b.bet * mul);
    if (win > 0) {
      await CoinService.earnCoins(win);
    }
    const net = win - b.bet;
    setMessage(`🎯 Ô ${mul}x — ${net >= 0 ? `+${net}` : net} xu (cược ${b.bet})`);
    setRecentBuckets((r) => [b.bucket, ...r].slice(0, 12));
    setActiveCount(ballsRef.current.filter((x) => !x.done).length);
    if (mul >= 10) {
      confetti({ particleCount: 100, spread: 80, origin: { x: 0.5, y: 0.7 } });
    } else if (mul >= 4) {
      confetti({ particleCount: 40, spread: 50, origin: { y: 0.7 } });
    } else if (mul >= 2) {
      confetti({ particleCount: 18, spread: 30, origin: { y: 0.7 } });
    }
    await CoinService.recordGamePlayed('Plinko');
  };

  const dropBall = async () => {
    const active = ballsRef.current.filter((b) => !b.done).length;
    if (active >= 5) {
      setMessage('⚠️ Tối đa 5 bóng đang rơi cùng lúc.');
      return;
    }
    if (bet > balance) {
      setMessage('❌ Không đủ xu cược!');
      return;
    }
    const ok = await CoinService.spendCoins(bet);
    if (!ok) return;

    // Pre-compute random path (0=left, 1=right) for each row
    const path: number[] = [];
    let bucketIdx = 0;
    for (let r = 0; r < ROWS; r++) {
      const bit = Math.random() < 0.5 ? 0 : 1;
      path.push(bit);
      bucketIdx += bit;
    }

    const topPeg = pegPos(0, 0); // top peg
    const newBall: Ball = {
      id: ++idRef.current,
      x: topPeg.x + (Math.random() - 0.5) * 4,
      y: TOP_PADDING - 10,
      vy: 1.0,
      vx: 0,
      row: 0,
      col: 0,
      path,
      finalBucket: bucketIdx,
      bucket: -1,
      done: false,
      bet,
      color: BALL_COLORS[idRef.current % BALL_COLORS.length],
      landedAt: 0,
    };

    ballsRef.current = [...ballsRef.current, newBall];
    setActiveCount(ballsRef.current.filter((b) => !b.done).length);
    setMessage(`🎲 Đang rơi… cược ${bet} xu`);

    // start animation if not running
    if (lastTickRef.current === 0) {
      animRef.current = requestAnimationFrame(stepPhysics);
    }
  };

  // Initial draw
  useEffect(() => {
    draw();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      className="glass fullscreen-game-container"
      style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          borderBottom: 'var(--border-glass)',
          paddingBottom: '12px',
          marginBottom: '10px',
          flexShrink: 0,
        }}
      >
        <div>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 800 }}>🎯 Plinko</h2>
          <span style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)' }}>
            Số dư:{' '}
            <strong style={{ color: '#f1c40f' }}>🪙 {balance.toLocaleString('vi-VN')} xu</strong>
            {activeCount > 0 && (
              <span style={{ marginLeft: 12, color: '#7c6fff' }}>● {activeCount} bóng đang rơi</span>
            )}
          </span>
        </div>
        <button onClick={onClose} className="btn btn-danger">
          Quay lại
        </button>
      </div>

      <div
        style={{
          flexGrow: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '10px',
          overflowY: 'auto',
          paddingBottom: '12px',
          minHeight: 0,
        }}
      >
        <canvas
          ref={canvasRef}
          width={WIDTH}
          height={HEIGHT}
          style={{
            borderRadius: '14px',
            border: 'var(--border-glass)',
            background: 'rgba(0,0,0,0.3)',
            width: '100%',
            maxWidth: `${WIDTH}px`,
            height: 'auto',
            aspectRatio: `${WIDTH} / ${HEIGHT}`,
            flexShrink: 0,
          }}
        />

        <div
          style={{
            fontSize: '0.95rem',
            fontWeight: 700,
            textAlign: 'center',
            minHeight: '22px',
            color: 'var(--color-text-secondary)',
          }}
        >
          {message}
        </div>

        {/* Recent landings */}
        {recentBuckets.length > 0 && (
          <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap', justifyContent: 'center' }}>
            <span style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', alignSelf: 'center' }}>
              Gần đây:
            </span>
            {recentBuckets.map((b, i) => {
              const mul = BUCKET_MULTIPLIERS[b];
              const color =
                mul >= 10 ? '#e74c3c' : mul >= 4 ? '#f39c12' : mul >= 2 ? '#f1c40f' : mul >= 1 ? '#2ecc71' : '#3498db';
              return (
                <span
                  key={i}
                  style={{
                    padding: '3px 9px',
                    borderRadius: '10px',
                    background: color,
                    color: 'white',
                    fontWeight: 800,
                    fontSize: '0.7rem',
                  }}
                >
                  {mul}x
                </span>
              );
            })}
          </div>
        )}

        {/* Controls */}
        <div
          style={{
            display: 'flex',
            gap: '10px',
            alignItems: 'center',
            flexWrap: 'wrap',
            justifyContent: 'center',
            width: '100%',
            maxWidth: WIDTH,
          }}
        >
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
            style={{
              height: '44px',
              padding: '0 24px',
              fontWeight: 800,
              background: 'linear-gradient(135deg, #8e44ad, #3498db)',
              opacity: bet > balance ? 0.5 : 1,
            }}
          >
            ⬇ THẢ BÓNG ({bet} xu)
          </button>
        </div>
      </div>
    </div>
  );
};
