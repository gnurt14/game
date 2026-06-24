import React, { useEffect, useRef, useState } from 'react';
import { CoinService } from '../../services/coinService';
import confetti from 'canvas-confetti';

interface CrashGameProps {
  onClose: () => void;
}

type Phase = 'idle' | 'betting' | 'running' | 'crashed' | 'cashed';

interface HistoryEntry {
  crashAt: number;
  cashedAt: number | null;
  win: number;
}

const computeCrashPoint = (): number => {
  // Classic provably-fair-style crash distribution.
  // P(crash >= x) ≈ 0.99 / x  (with a 1% instant-crash chance baked in via clamp).
  const r = Math.random();
  if (r < 0.01) return 1.0; // instant crash
  return Math.max(1.0, 0.99 / (1 - r));
};

export const CrashGame: React.FC<CrashGameProps> = ({ onClose }) => {
  const [balance, setBalance] = useState<number>(0);
  const [bet, setBet] = useState<number>(50);
  const [autoCashOut, setAutoCashOut] = useState<number>(2.0);
  const [autoEnabled, setAutoEnabled] = useState<boolean>(false);

  const [phase, setPhase] = useState<Phase>('idle');
  const [multiplier, setMultiplier] = useState<number>(1.0);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [message, setMessage] = useState<string>('Đặt cược rồi nhấn START để bắt đầu round.');
  const [cashedMultiplier, setCashedMultiplier] = useState<number | null>(null);

  const crashAtRef = useRef<number>(1.0);
  const startTimeRef = useRef<number>(0);
  const animFrameRef = useRef<number>(0);
  const cashedRef = useRef<boolean>(false);
  const phaseRef = useRef<Phase>('idle');
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pointsRef = useRef<{ t: number; m: number }[]>([]);

  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  useEffect(() => {
    setBalance(CoinService.getData().balance);
    const unsub = CoinService.subscribe((d) => setBalance(d.balance));
    return () => {
      unsub();
      cancelAnimationFrame(animFrameRef.current);
    };
  }, []);

  const drawGraph = (currentMul: number, crashed: boolean) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const W = canvas.width;
    const H = canvas.height;
    ctx.clearRect(0, 0, W, H);

    // grid
    ctx.strokeStyle = 'rgba(255,255,255,0.06)';
    ctx.lineWidth = 1;
    for (let i = 1; i < 6; i++) {
      const y = (H / 6) * i;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(W, y);
      ctx.stroke();
    }

    const points = pointsRef.current;
    if (points.length < 2) return;

    const maxT = Math.max(2, points[points.length - 1].t);
    const maxM = Math.max(2, currentMul * 1.1);

    ctx.beginPath();
    ctx.lineWidth = 3;
    ctx.strokeStyle = crashed ? '#e74c3c' : '#2ecc71';
    ctx.shadowBlur = crashed ? 20 : 14;
    ctx.shadowColor = crashed ? 'rgba(231,76,60,0.7)' : 'rgba(46,204,113,0.6)';

    points.forEach((p, i) => {
      const x = (p.t / maxT) * (W - 20) + 10;
      const y = H - ((p.m - 1) / (maxM - 1)) * (H - 20) - 10;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();
    ctx.shadowBlur = 0;

    // fill area
    if (points.length > 0) {
      ctx.lineTo((points[points.length - 1].t / maxT) * (W - 20) + 10, H);
      ctx.lineTo(10, H);
      ctx.closePath();
      ctx.fillStyle = crashed ? 'rgba(231,76,60,0.12)' : 'rgba(46,204,113,0.12)';
      ctx.fill();
    }
  };

  const tick = () => {
    if (phaseRef.current !== 'running') return;
    const elapsed = (performance.now() - startTimeRef.current) / 1000;

    // multiplier grows exponentially with time
    // m(t) = 1.0 * e^(0.10 * t)  → at 5s ~1.65x, 15s ~4.5x, 30s ~20x
    const m = Math.pow(Math.E, 0.10 * elapsed);
    pointsRef.current.push({ t: elapsed, m });
    setMultiplier(m);
    drawGraph(m, false);

    // Auto cash-out
    if (autoEnabled && !cashedRef.current && m >= autoCashOut) {
      doCashOut(m);
    }

    if (m >= crashAtRef.current) {
      doCrash();
      return;
    }
    animFrameRef.current = requestAnimationFrame(tick);
  };

  const startRound = async () => {
    if (phase === 'running') return;
    if (bet > balance || bet < 10) {
      alert('❌ Cược không hợp lệ (10–số dư).');
      return;
    }
    const ok = await CoinService.spendCoins(bet);
    if (!ok) {
      alert('❌ Không trừ được xu.');
      return;
    }

    crashAtRef.current = computeCrashPoint();
    cashedRef.current = false;
    pointsRef.current = [{ t: 0, m: 1.0 }];
    startTimeRef.current = performance.now();
    setMultiplier(1.0);
    setCashedMultiplier(null);
    setMessage('🚀 Đang bay... bấm CASH OUT để rút lời!');
    setPhase('running');
    phaseRef.current = 'running';
    animFrameRef.current = requestAnimationFrame(tick);
  };

  const doCashOut = async (currentMul?: number) => {
    if (cashedRef.current) return;
    if (phaseRef.current !== 'running') return;
    cashedRef.current = true;
    const m = currentMul ?? multiplier;
    setCashedMultiplier(m);
    const win = Math.floor(bet * m);
    await CoinService.earnCoins(win);
    setMessage(`💰 Rút thành công @ ${m.toFixed(2)}x — Nhận ${win} xu!`);
    if (m >= 2) confetti({ particleCount: 60, spread: 70, origin: { y: 0.5 } });
  };

  const doCrash = async () => {
    cancelAnimationFrame(animFrameRef.current);
    setPhase('crashed');
    phaseRef.current = 'crashed';
    drawGraph(crashAtRef.current, true);

    const cashedAt = cashedRef.current ? (cashedMultiplier ?? multiplier) : null;
    const win = cashedAt ? Math.floor(bet * cashedAt) : 0;
    setHistory((h) => [{ crashAt: crashAtRef.current, cashedAt, win }, ...h].slice(0, 10));

    if (!cashedRef.current) {
      setMessage(`💥 BÙM! Crash @ ${crashAtRef.current.toFixed(2)}x — Bạn mất ${bet} xu.`);
    }

    await CoinService.recordGamePlayed('Crash Game');

    setTimeout(() => {
      setPhase('idle');
      phaseRef.current = 'idle';
    }, 2500);
  };

  const cashOut = () => doCashOut();

  return (
    <div className="glass fullscreen-game-container">
      <style>{`
        @keyframes crash-shake { 0%,100%{transform:translate(0,0)} 25%{transform:translate(-4px,2px)} 75%{transform:translate(4px,-2px)} }
        @keyframes crash-pulse { 0%,100%{transform:scale(1)} 50%{transform:scale(1.05)} }
      `}</style>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: 'var(--border-glass)', paddingBottom: '14px', marginBottom: '16px' }}>
        <div>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 800 }}>💥 Crash Game</h2>
          <span style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)' }}>
            Số dư: <strong style={{ color: '#f1c40f' }}>🪙 {balance} xu</strong>
          </span>
        </div>
        <button onClick={onClose} className="btn btn-danger">Quay lại</button>
      </div>

      {/* History bar */}
      <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', marginBottom: '14px', paddingBottom: '4px' }}>
        {history.length === 0 ? (
          <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>Chưa có round nào.</span>
        ) : history.map((h, i) => (
          <span key={i} style={{
            padding: '4px 10px',
            borderRadius: '12px',
            fontSize: '0.75rem',
            fontWeight: 800,
            color: 'white',
            background: h.crashAt >= 10 ? '#8e44ad' : h.crashAt >= 3 ? '#2ecc71' : h.crashAt >= 1.5 ? '#f39c12' : '#e74c3c',
          }}>
            {h.crashAt.toFixed(2)}x
          </span>
        ))}
      </div>

      <div style={{ flexGrow: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
        {/* Graph */}
        <div style={{
          position: 'relative',
          width: '100%',
          maxWidth: '600px',
          background: 'rgba(0,0,0,0.4)',
          borderRadius: '14px',
          padding: '12px',
          border: 'var(--border-glass)',
          animation: phase === 'crashed' ? 'crash-shake 0.4s' : 'none',
        }}>
          <canvas ref={canvasRef} width={580} height={280} style={{ width: '100%', height: '280px', display: 'block' }} />

          {/* Big multiplier overlay */}
          <div style={{
            position: 'absolute',
            top: '50%', left: '50%',
            transform: 'translate(-50%, -50%)',
            fontSize: '4rem',
            fontWeight: 900,
            color: phase === 'crashed' ? '#e74c3c' : cashedRef.current ? '#f1c40f' : '#2ecc71',
            textShadow: '0 0 25px currentColor',
            pointerEvents: 'none',
          }}>
            {phase === 'crashed' ? '💥' : ''}{multiplier.toFixed(2)}x
          </div>
        </div>

        {/* Message */}
        <div style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--color-text-secondary)', textAlign: 'center', minHeight: '24px' }}>
          {message}
        </div>

        {/* Controls */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', width: '100%', maxWidth: '600px' }}>
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
            <label style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)' }}>Cược:</label>
            <input
              type="number"
              value={bet}
              onChange={(e) => setBet(Math.max(10, Math.min(balance, parseInt(e.target.value) || 10)))}
              disabled={phase === 'running'}
              style={{ width: '100px', height: '36px', borderRadius: '8px', textAlign: 'center', fontWeight: 700 }}
              min={10}
            />
            <label style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)' }}>Auto cash @:</label>
            <input
              type="number"
              value={autoCashOut}
              step={0.1}
              min={1.1}
              onChange={(e) => setAutoCashOut(Math.max(1.1, parseFloat(e.target.value) || 1.1))}
              disabled={phase === 'running'}
              style={{ width: '80px', height: '36px', borderRadius: '8px', textAlign: 'center', fontWeight: 700 }}
            />x
            <label style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <input
                type="checkbox"
                checked={autoEnabled}
                onChange={(e) => setAutoEnabled(e.target.checked)}
                disabled={phase === 'running'}
              />
              Bật auto
            </label>
          </div>

          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              onClick={startRound}
              disabled={phase === 'running' || phase === 'crashed'}
              className="btn btn-primary"
              style={{ flex: 1, height: '50px', fontWeight: 800, fontSize: '1rem', background: 'linear-gradient(135deg, #2ecc71, #27ae60)' }}
            >
              🚀 START ({bet} xu)
            </button>
            <button
              onClick={cashOut}
              disabled={phase !== 'running' || cashedRef.current}
              className="btn btn-primary"
              style={{
                flex: 1,
                height: '50px',
                fontWeight: 800,
                fontSize: '1rem',
                background: 'linear-gradient(135deg, #f39c12, #e74c3c)',
                animation: phase === 'running' && !cashedRef.current ? 'crash-pulse 0.6s infinite' : 'none',
              }}
            >
              💰 CASH OUT @ {multiplier.toFixed(2)}x
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
