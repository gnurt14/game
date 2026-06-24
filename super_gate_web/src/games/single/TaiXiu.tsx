import React, { useEffect, useState } from 'react';
import { CoinService } from '../../services/coinService';
import confetti from 'canvas-confetti';

interface TaiXiuProps {
  onClose: () => void;
}

type BetKey =
  | 'tai'
  | 'xiu'
  | `sum_${number}`
  | 'any_triple'
  | `triple_${number}`;

// Odds for sum bets (3-dice). Source: classic Sicbo payouts.
const SUM_PAYOUT: Record<number, number> = {
  4: 60, 17: 60,
  5: 30, 16: 30,
  6: 17, 15: 17,
  7: 12, 14: 12,
  8: 8, 13: 8,
  9: 6, 12: 6,
  10: 6, 11: 6,
};

const DICE_FACES = ['⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];

export const TaiXiu: React.FC<TaiXiuProps> = ({ onClose }) => {
  const [balance, setBalance] = useState<number>(0);
  const [chip, setChip] = useState<number>(50);
  const [bets, setBets] = useState<Record<string, number>>({});
  const [rolling, setRolling] = useState<boolean>(false);
  const [shake, setShake] = useState<boolean>(false);
  const [dice, setDice] = useState<number[] | null>(null);
  const [message, setMessage] = useState<string>('Đặt cược và lắc chén để bắt đầu!');
  const [winDelta, setWinDelta] = useState<number | null>(null);

  useEffect(() => {
    setBalance(CoinService.getData().balance);
    const unsub = CoinService.subscribe((d) => setBalance(d.balance));
    return unsub;
  }, []);

  const totalBet = Object.values(bets).reduce((s, v) => s + v, 0);

  const placeBet = async (key: BetKey) => {
    if (rolling) return;
    if (balance < chip) {
      alert('❌ Không đủ xu cược!');
      return;
    }
    const ok = await CoinService.spendCoins(chip);
    if (ok) {
      setBets((b) => ({ ...b, [key]: (b[key] || 0) + chip }));
    }
  };

  const clearAll = async () => {
    if (rolling || totalBet === 0) return;
    await CoinService.earnCoins(totalBet);
    setBets({});
    setMessage('Đã hủy & hoàn cược.');
  };

  const rollDice = () => {
    if (rolling) return;
    if (totalBet === 0) {
      alert('⚠️ Cược trước đã nhé!');
      return;
    }

    setRolling(true);
    setShake(true);
    setDice(null);
    setMessage('Đang lắc... 🎲');
    setWinDelta(null);

    // shake animation duration ~1.5s
    let ticks = 0;
    const shakeInt = setInterval(() => {
      setDice([
        1 + Math.floor(Math.random() * 6),
        1 + Math.floor(Math.random() * 6),
        1 + Math.floor(Math.random() * 6),
      ]);
      ticks++;
      if (ticks >= 12) {
        clearInterval(shakeInt);
        finalize();
      }
    }, 110);
  };

  const finalize = async () => {
    const finalDice = [
      1 + Math.floor(Math.random() * 6),
      1 + Math.floor(Math.random() * 6),
      1 + Math.floor(Math.random() * 6),
    ];
    setDice(finalDice);
    setShake(false);
    setRolling(false);

    const sum = finalDice[0] + finalDice[1] + finalDice[2];
    const isTriple = finalDice[0] === finalDice[1] && finalDice[1] === finalDice[2];
    const tripleVal = isTriple ? finalDice[0] : null;

    const capturedBets = { ...bets };
    const capturedTotal = totalBet;

    let win = 0;
    const reasons: string[] = [];

    Object.entries(capturedBets).forEach(([key, amt]) => {
      if (amt <= 0) return;

      if (key === 'tai') {
        if (!isTriple && sum >= 11 && sum <= 17) {
          win += amt * 2;
          reasons.push(`Tài x2 (+${amt})`);
        }
      } else if (key === 'xiu') {
        if (!isTriple && sum >= 4 && sum <= 10) {
          win += amt * 2;
          reasons.push(`Xỉu x2 (+${amt})`);
        }
      } else if (key.startsWith('sum_')) {
        const target = parseInt(key.slice(4));
        if (sum === target) {
          const mul = SUM_PAYOUT[target] ?? 6;
          win += amt * mul;
          reasons.push(`Tổng ${target} x${mul}`);
        }
      } else if (key === 'any_triple') {
        if (isTriple) {
          win += amt * 30;
          reasons.push('Bộ ba bất kỳ x30');
        }
      } else if (key.startsWith('triple_')) {
        const target = parseInt(key.slice(7));
        if (isTriple && tripleVal === target) {
          win += amt * 150;
          reasons.push(`Bộ ba ${target} x150`);
        }
      }
    });

    const net = win - capturedTotal;
    setWinDelta(net);

    if (win > 0) {
      await CoinService.earnCoins(win);
      setMessage(`🎉 ${reasons.join(', ')} — Ròng ${net >= 0 ? '+' : ''}${net} xu`);
      if (net > 0) {
        confetti({ particleCount: 80, spread: 70, origin: { y: 0.5 } });
      }
    } else {
      setMessage(`💸 Tổng ${sum}${isTriple ? ` (Bộ ba ${tripleVal})` : ''} — Mất ${capturedTotal} xu.`);
    }

    setBets({});
    await CoinService.recordGamePlayed('Tài Xỉu');
  };

  const BetButton: React.FC<{ k: BetKey; label: string; sub?: string; bg: string }> = ({ k, label, sub, bg }) => {
    const amt = bets[k] || 0;
    return (
      <button
        onClick={() => placeBet(k)}
        disabled={rolling}
        style={{
          background: amt > 0 ? `linear-gradient(135deg, ${bg}, rgba(241,196,15,0.4))` : bg,
          border: amt > 0 ? '2px solid #f1c40f' : '1px solid rgba(255,255,255,0.1)',
          borderRadius: '10px',
          padding: '10px 6px',
          color: 'white',
          fontWeight: 700,
          fontSize: '0.85rem',
          cursor: rolling ? 'default' : 'pointer',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '2px',
          minHeight: '60px',
          transition: 'all 0.15s',
          transform: amt > 0 ? 'scale(1.04)' : 'none',
        }}
      >
        <span>{label}</span>
        {sub && <span style={{ fontSize: '0.65rem', opacity: 0.85 }}>{sub}</span>}
        {amt > 0 && (
          <span style={{ background: '#f1c40f', color: '#000', padding: '1px 6px', borderRadius: '8px', fontSize: '0.7rem', marginTop: '2px' }}>
            🪙 {amt}
          </span>
        )}
      </button>
    );
  };

  return (
    <div className="glass fullscreen-game-container">
      <style>{`
        @keyframes tx-shake { 0%,100%{transform:rotate(-8deg) translateY(0)} 25%{transform:rotate(8deg) translateY(-10px)} 50%{transform:rotate(-12deg) translateY(0)} 75%{transform:rotate(10deg) translateY(-8px)} }
        @keyframes tx-dice-pop { 0%{transform:scale(0.4) rotate(-180deg);opacity:0} 70%{transform:scale(1.15)} 100%{transform:scale(1) rotate(0);opacity:1} }
      `}</style>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: 'var(--border-glass)', paddingBottom: '14px', marginBottom: '16px' }}>
        <div>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 800 }}>🎲 Tài Xỉu</h2>
          <span style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)' }}>
            Số dư: <strong style={{ color: '#f1c40f' }}>🪙 {balance} xu</strong> · Cược: <strong>🪙 {totalBet}</strong>
          </span>
        </div>
        <button onClick={onClose} className="btn btn-danger">Quay lại</button>
      </div>

      <div style={{ flexGrow: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', overflowY: 'auto' }}>
        {/* Bowl + dice */}
        <div style={{
          width: '320px',
          height: '180px',
          background: 'radial-gradient(circle at 50% 30%, #8B4513, #3e1f0a)',
          borderRadius: '50% 50% 50% 50% / 60% 60% 40% 40%',
          border: '4px solid #d4a574',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '14px',
          boxShadow: 'inset 0 -10px 20px rgba(0,0,0,0.5), 0 8px 20px rgba(0,0,0,0.4)',
          animation: shake ? 'tx-shake 0.18s infinite' : 'none',
          position: 'relative',
        }}>
          {dice ? dice.map((d, i) => (
            <div key={i} style={{
              width: '60px',
              height: '60px',
              background: 'white',
              color: '#000',
              borderRadius: '12px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '3rem',
              boxShadow: '0 4px 12px rgba(0,0,0,0.5), inset 0 -3px 6px rgba(0,0,0,0.2)',
              animation: !rolling ? `tx-dice-pop 0.45s ${i * 0.12}s both` : 'none',
            }}>
              {DICE_FACES[d - 1]}
            </div>
          )) : <span style={{ fontSize: '4rem' }}>🥣</span>}
        </div>

        {/* Result message */}
        <div style={{
          fontSize: '1rem',
          fontWeight: 800,
          color: winDelta !== null && winDelta > 0 ? '#2ecc71' : winDelta !== null && winDelta < 0 ? '#e74c3c' : 'var(--color-text-secondary)',
          textAlign: 'center',
          minHeight: '24px',
        }}>
          {message}
        </div>

        {/* Bet zones */}
        <div style={{ width: '100%', maxWidth: '640px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {/* Tài / Xỉu */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <BetButton k="tai" label="TÀI (11-17)" sub="x2" bg="#c0392b" />
            <BetButton k="xiu" label="XỈU (4-10)" sub="x2" bg="#2c3e50" />
          </div>

          {/* Sum bets */}
          <div>
            <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', fontWeight: 700, marginBottom: '6px' }}>Cược tổng số:</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '6px' }}>
              {[4,5,6,7,8,9,10,11,12,13,14,15,16,17].map((s) => (
                <BetButton key={s} k={`sum_${s}` as BetKey} label={`${s}`} sub={`x${SUM_PAYOUT[s] ?? 6}`} bg="rgba(52,73,94,0.5)" />
              ))}
            </div>
          </div>

          {/* Triple bets */}
          <div>
            <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', fontWeight: 700, marginBottom: '6px' }}>Cược bộ ba:</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '6px' }}>
              <BetButton k="any_triple" label="Bất kỳ" sub="x30" bg="#8e44ad" />
              {[1,2,3,4,5,6].map((n) => (
                <BetButton key={n} k={`triple_${n}` as BetKey} label={`${n}${n}${n}`} sub="x150" bg="#6c3483" />
              ))}
            </div>
          </div>
        </div>

        {/* Chip + actions */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px', paddingTop: '10px', borderTop: 'var(--border-glass)', width: '100%', maxWidth: '640px' }}>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)' }}>Chip:</span>
            {[10, 50, 100, 500].map((v) => (
              <button
                key={v}
                disabled={rolling}
                onClick={() => setChip(v)}
                style={{
                  width: '40px', height: '40px', borderRadius: '50%',
                  background: v === 10 ? '#3498db' : v === 50 ? '#2ecc71' : v === 100 ? '#e67e22' : '#e74c3c',
                  color: 'white', fontWeight: 900, fontSize: '0.7rem',
                  border: chip === v ? '3px solid white' : '1px solid rgba(255,255,255,0.1)',
                  cursor: rolling ? 'default' : 'pointer',
                  transform: chip === v ? 'scale(1.1)' : 'none',
                  transition: 'all 0.15s',
                }}
              >
                {v}
              </button>
            ))}
          </div>
          <div style={{ display: 'flex', gap: '10px', width: '100%' }}>
            <button onClick={clearAll} disabled={rolling || totalBet === 0} className="btn btn-secondary" style={{ flex: 1 }}>
              🗑 Hủy cược
            </button>
            <button onClick={rollDice} disabled={rolling || totalBet === 0} className="btn btn-primary" style={{ flex: 2, fontWeight: 800 }}>
              🎲 LẮC CHÉN
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
