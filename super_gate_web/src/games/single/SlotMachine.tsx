import React, { useEffect, useRef, useState } from 'react';
import { Play } from 'lucide-react';
import { CoinService } from '../../services/coinService';
import confetti from 'canvas-confetti';
import { CustomBetButton } from '../../components/CustomBetButton';

interface SlotMachineProps {
  onClose: () => void;
}

// Reel symbols. Index used for "near-miss" math (adjacent cells).
const SYMBOLS = ['🍒', '🍋', '🍇', '🔔', '⭐', '💎', '7️⃣', '🎰'];

// Generate a long strip to make the reel feel like it's spinning many cycles.
const buildStrip = (loops: number = 8) => {
  const strip: number[] = [];
  for (let i = 0; i < loops; i++) {
    for (let s = 0; s < SYMBOLS.length; s++) strip.push(s);
  }
  return strip;
};

const SYMBOL_HEIGHT = 96; // px — height of each cell shown in reel
const REEL_VISIBLE = 1; // we show 1 main row per reel

interface HistoryEntry {
  result: number[];
  payout: number;
  bet: number;
}

export const SlotMachine: React.FC<SlotMachineProps> = ({ onClose }) => {
  const [balance, setBalance] = useState<number>(0);
  const [bet, setBet] = useState<number>(50);
  const [spinning, setSpinning] = useState<boolean>(false);
  const [reels, setReels] = useState<number[]>([0, 1, 2]);
  const [reelOffsets, setReelOffsets] = useState<number[]>([0, 0, 0]);
  const [reelStopped, setReelStopped] = useState<boolean[]>([true, true, true]);
  const [message, setMessage] = useState<string>('Đặt cược và nhấn SPIN để thử vận may!');
  const [lastWin, setLastWin] = useState<number>(0);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [flash, setFlash] = useState<boolean>(false);

  const stripRef = useRef<number[]>(buildStrip(10));

  useEffect(() => {
    setBalance(CoinService.getData().balance);
    const unsub = CoinService.subscribe((d) => setBalance(d.balance));
    return unsub;
  }, []);

  const clampBet = (v: number) =>
    Math.max(1, Math.min(Math.max(balance, 1), Math.floor(v) || 1));

  const computePayout = (result: number[], betAmount: number): { win: number; label: string; jackpot: boolean } => {
    const [a, b, c] = result;
    if (a === b && b === c) {
      const sym = SYMBOLS[a];
      if (sym === '🎰') return { win: betAmount * 100, label: 'JACKPOT! 🎰🎰🎰 ×100', jackpot: true };
      if (sym === '7️⃣') return { win: betAmount * 50, label: 'TRIPLE 7! ×50', jackpot: true };
      if (sym === '💎') return { win: betAmount * 30, label: 'BA KIM CƯƠNG ×30', jackpot: true };
      return { win: betAmount * 10, label: `BA ${sym} ×10`, jackpot: false };
    }
    if (a === b || b === c) {
      return { win: Math.floor(betAmount * 1.5), label: 'Đôi cạnh nhau ×1.5', jackpot: false };
    }
    return { win: 0, label: 'Trượt — Chúc may mắn lần sau!', jackpot: false };
  };

  // Pick the final result. ~12% chance of forced near-miss when first 2 reels match
  // and third otherwise would be random — push it to an adjacent cell.
  const pickResult = (): number[] => {
    const r0 = Math.floor(Math.random() * SYMBOLS.length);
    const r1 = Math.floor(Math.random() * SYMBOLS.length);
    let r2 = Math.floor(Math.random() * SYMBOLS.length);

    if (r0 === r1) {
      // base chance of an actual triple
      const tripleRoll = Math.random();
      if (tripleRoll < 0.18) {
        r2 = r0; // genuine triple
      } else {
        // Force near-miss: pick adjacent cell (wrap-around) so the player "almost" hits.
        const dir = Math.random() < 0.5 ? -1 : 1;
        r2 = (r0 + dir + SYMBOLS.length) % SYMBOLS.length;
      }
    }
    return [r0, r1, r2];
  };

  const handleSpin = async () => {
    if (spinning) return;
    if (bet > balance) {
      alert('❌ Số dư không đủ để cược!');
      return;
    }
    const ok = await CoinService.spendCoins(bet);
    if (!ok) {
      alert('❌ Không thể trừ xu cược.');
      return;
    }

    const finalResult = pickResult();
    setSpinning(true);
    setMessage('Đang quay... 🎰');
    setLastWin(0);
    setReelStopped([false, false, false]);

    // Animate each reel. Strip is repeated, we move offset upwards then snap to final.
    const strip = stripRef.current;

    // For each reel, compute target offset: stop on finalResult[i] in the last loop.
    const targets = finalResult.map((sym, idx) => {
      // pick an index in last quarter of strip that equals sym
      const startWindow = Math.floor(strip.length * 0.7);
      let target = startWindow + idx * 4;
      while (target < strip.length && strip[target] !== sym) target++;
      if (target >= strip.length) target = strip.length - (SYMBOLS.length - sym);
      return target * SYMBOL_HEIGHT;
    });

    const startTime = performance.now();
    const reelDurations = [1500, 1700, 1900]; // each reel stops later

    const animate = (now: number) => {
      const elapsed = now - startTime;
      const nextOffsets: number[] = [0, 0, 0];
      const nextStopped: boolean[] = [false, false, false];

      for (let i = 0; i < 3; i++) {
        const dur = reelDurations[i];
        if (elapsed >= dur) {
          nextOffsets[i] = targets[i];
          nextStopped[i] = true;
        } else {
          const t = elapsed / dur;
          // ease-out cubic
          const eased = 1 - Math.pow(1 - t, 3);
          nextOffsets[i] = eased * targets[i];
        }
      }
      setReelOffsets(nextOffsets);
      setReelStopped(nextStopped);

      if (elapsed < reelDurations[2]) {
        requestAnimationFrame(animate);
      } else {
        finalizeSpin(finalResult);
      }
    };
    requestAnimationFrame(animate);
  };

  const finalizeSpin = async (result: number[]) => {
    setReels(result);
    setSpinning(false);
    const { win, label, jackpot } = computePayout(result, bet);
    setLastWin(win);
    setMessage(label);

    if (win > 0) {
      await CoinService.earnCoins(win);
    }

    setHistory((h) => [{ result, payout: win, bet }, ...h].slice(0, 8));

    if (jackpot) {
      setFlash(true);
      setTimeout(() => setFlash(false), 1200);
      confetti({ particleCount: 120, spread: 80, origin: { x: 0.5, y: 0.5 } });
      setTimeout(() => confetti({ particleCount: 80, spread: 100, origin: { x: 0.2, y: 0.5 } }), 200);
      setTimeout(() => confetti({ particleCount: 80, spread: 100, origin: { x: 0.8, y: 0.5 } }), 400);
    } else if (win > 0) {
      confetti({ particleCount: 40, spread: 50, origin: { y: 0.6 } });
    }

    await CoinService.recordGamePlayed('Slot Machine');
  };

  const strip = stripRef.current;

  return (
    <div className="glass fullscreen-game-container">
      <style>{`
        @keyframes slot-flash { 0%{opacity:1} 100%{opacity:0} }
        @keyframes slot-glow { 0%,100%{box-shadow:0 0 20px rgba(241,196,15,0.5)} 50%{box-shadow:0 0 50px rgba(241,196,15,1),0 0 80px rgba(241,196,15,0.4)} }
      `}</style>

      {flash && (
        <div style={{
          position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 9999,
          background: 'radial-gradient(circle, rgba(241,196,15,0.3), transparent 70%)',
          animation: 'slot-flash 1.2s ease-out forwards',
        }} />
      )}

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: 'var(--border-glass)', paddingBottom: '14px', marginBottom: '20px' }}>
        <div>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 800 }}>🎰 Slot Machine</h2>
          <span style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)' }}>
            Số dư: <strong style={{ color: '#f1c40f' }}>🪙 {balance} xu</strong>
          </span>
        </div>
        <button onClick={onClose} className="btn btn-danger">Quay lại</button>
      </div>

      <div style={{ flexGrow: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '20px' }}>
        {/* Slot frame */}
        <div style={{
          background: 'linear-gradient(180deg, #2c1810, #1a0d08)',
          padding: '20px',
          borderRadius: '20px',
          border: '4px solid #f1c40f',
          boxShadow: '0 0 30px rgba(241,196,15,0.4), inset 0 0 20px rgba(0,0,0,0.6)',
          display: 'flex',
          gap: '12px',
        }}>
          {[0, 1, 2].map((reelIdx) => (
            <div key={reelIdx} style={{
              width: '100px',
              height: `${SYMBOL_HEIGHT * REEL_VISIBLE}px`,
              overflow: 'hidden',
              background: 'linear-gradient(180deg, #fff, #ddd)',
              borderRadius: '10px',
              position: 'relative',
              boxShadow: 'inset 0 4px 12px rgba(0,0,0,0.4)',
              animation: reelStopped[reelIdx] && reels[0] === reels[1] && reels[1] === reels[2] && !spinning ? 'slot-glow 1.2s infinite' : 'none',
            }}>
              <div style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                transform: `translateY(${-reelOffsets[reelIdx]}px)`,
                willChange: 'transform',
              }}>
                {strip.map((symIdx, i) => (
                  <div key={i} style={{
                    height: `${SYMBOL_HEIGHT}px`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '3.5rem',
                    lineHeight: 1,
                  }}>
                    {SYMBOLS[symIdx]}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Result message */}
        <div style={{
          minHeight: '30px',
          fontSize: '1.1rem',
          fontWeight: 800,
          color: lastWin > 0 ? '#2ecc71' : 'var(--color-text-secondary)',
          textAlign: 'center',
        }}>
          {message} {lastWin > 0 && <span style={{ color: '#f1c40f' }}>(+{lastWin} xu)</span>}
        </div>

        {/* Bet controls */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', alignItems: 'center', width: '100%', maxWidth: '420px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)', fontWeight: 600 }}>Cược:</span>
            {[10, 50, 100, 500, 1000].map((v) => (
              <button
                key={v}
                disabled={spinning}
                onClick={() => setBet(v)}
                className="btn"
                style={{
                  padding: '6px 12px',
                  fontSize: '0.75rem',
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
            <input
              type="number"
              value={bet}
              onChange={(e) => setBet(clampBet(parseInt(e.target.value)))}
              disabled={spinning}
              style={{ width: '90px', height: '36px', borderRadius: '8px', textAlign: 'center', fontWeight: 700 }}
              min={1}
              max={Math.max(balance, 1)}
            />
            <CustomBetButton
              balance={balance}
              value={bet}
              onChange={(v) => setBet(clampBet(v))}
              disabled={spinning}
              presetValues={[10, 50, 100, 500, 1000]}
            />
          </div>

          <button
            onClick={handleSpin}
            disabled={spinning || bet > balance}
            className="btn btn-primary"
            style={{
              width: '100%',
              height: '56px',
              fontSize: '1.1rem',
              fontWeight: 900,
              background: 'linear-gradient(135deg, #e74c3c, #f1c40f)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
            }}
          >
            <Play size={20} fill="white" /> {spinning ? 'ĐANG QUAY...' : `SPIN (${bet} xu)`}
          </button>
        </div>

        {/* History */}
        {history.length > 0 && (
          <div style={{ width: '100%', maxWidth: '420px' }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', fontWeight: 700, marginBottom: '6px' }}>Lịch sử gần đây:</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {history.map((h, i) => (
                <div key={i} style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  background: 'rgba(255,255,255,0.03)',
                  padding: '4px 10px',
                  borderRadius: '6px',
                  fontSize: '0.8rem',
                }}>
                  <span>{h.result.map((s) => SYMBOLS[s]).join(' ')}</span>
                  <span style={{ color: h.payout > 0 ? '#2ecc71' : '#e74c3c', fontWeight: 700 }}>
                    {h.payout > 0 ? `+${h.payout - h.bet}` : `-${h.bet}`}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
