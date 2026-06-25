import React, { useEffect, useState } from 'react';
import { CoinService } from '../../services/coinService';
import confetti from 'canvas-confetti';
import { CustomBetButton } from '../../components/CustomBetButton';

interface CoinFlipProps {
  onClose: () => void;
}

type Side = 'heads' | 'tails';

interface HistoryEntry {
  pick: Side;
  result: Side;
  win: boolean;
  delta: number;
}

const SIDE_LABEL: Record<Side, string> = {
  heads: 'Mặt (👤)',
  tails: 'Sấp (🦅)',
};

const SIDE_EMOJI: Record<Side, string> = {
  heads: '👤',
  tails: '🦅',
};

export const CoinFlip: React.FC<CoinFlipProps> = ({ onClose }) => {
  const [balance, setBalance] = useState<number>(0);
  const [bet, setBet] = useState<number>(50);
  const [pick, setPick] = useState<Side>('heads');
  const [flipping, setFlipping] = useState<boolean>(false);
  const [resultSide, setResultSide] = useState<Side | null>(null);
  const [message, setMessage] = useState<string>('Chọn Mặt hoặc Sấp, đặt cược, rồi LẬT!');
  const [streak, setStreak] = useState<number>(0);
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  useEffect(() => {
    setBalance(CoinService.getData().balance);
    const unsub = CoinService.subscribe((d) => setBalance(d.balance));
    return unsub;
  }, []);

  const flip = async () => {
    if (flipping) return;
    if (bet > balance || bet < 10) {
      alert('❌ Cược không hợp lệ!');
      return;
    }
    const ok = await CoinService.spendCoins(bet);
    if (!ok) return;

    setFlipping(true);
    setResultSide(null);
    setMessage('Đang lật...');

    const outcome: Side = Math.random() < 0.5 ? 'heads' : 'tails';

    setTimeout(async () => {
      setResultSide(outcome);
      setFlipping(false);

      const won = outcome === pick;
      let win = 0;
      let delta = 0;
      if (won) {
        win = bet * 2;
        delta = bet; // net
        await CoinService.earnCoins(win);
        const nextStreak = streak + 1;
        setStreak(nextStreak);
        if (nextStreak >= 5) {
          await CoinService.earnCoins(500);
          delta += 500;
          setMessage(`🔥 CHUỖI ${nextStreak} THẮNG! +${bet} xu + Bonus 500 xu!`);
          confetti({ particleCount: 100, spread: 90, origin: { y: 0.5 } });
          setStreak(0); // reset after bonus
        } else {
          setMessage(`✅ Thắng! +${bet} xu (chuỗi ${nextStreak}/5)`);
          confetti({ particleCount: 50, spread: 60, origin: { y: 0.5 } });
        }
      } else {
        delta = -bet;
        setStreak(0);
        setMessage(`❌ Thua! Mất ${bet} xu. Chuỗi reset.`);
      }

      setHistory((h) => [{ pick, result: outcome, win: won, delta }, ...h].slice(0, 12));
      await CoinService.recordGamePlayed('Coin Flip');
    }, 1200);
  };

  return (
    <div className="glass fullscreen-game-container">
      <style>{`
        @keyframes coin-flip {
          0% { transform: rotateY(0) scale(1); }
          50% { transform: rotateY(900deg) scale(1.2); }
          100% { transform: rotateY(1800deg) scale(1); }
        }
        @keyframes coin-bounce {
          0% { transform: translateY(0) scale(1); }
          50% { transform: translateY(-20px) scale(1.1); }
          100% { transform: translateY(0) scale(1); }
        }
      `}</style>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: 'var(--border-glass)', paddingBottom: '14px', marginBottom: '16px' }}>
        <div>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 800 }}>🪙 Coin Flip</h2>
          <span style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)' }}>
            Số dư: <strong style={{ color: '#f1c40f' }}>🪙 {balance} xu</strong> · Chuỗi: <strong style={{ color: streak >= 3 ? '#e74c3c' : 'white' }}>🔥 {streak}/5</strong>
          </span>
        </div>
        <button onClick={onClose} className="btn btn-danger">Quay lại</button>
      </div>

      <div style={{ flexGrow: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '24px' }}>
        {/* Coin */}
        <div style={{
          width: '180px',
          height: '180px',
          borderRadius: '50%',
          background: 'linear-gradient(135deg, #f1c40f, #d4a017)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '6rem',
          boxShadow: '0 12px 30px rgba(241,196,15,0.5), inset 0 -6px 16px rgba(0,0,0,0.3)',
          border: '5px solid #f39c12',
          animation: flipping ? 'coin-flip 1.2s ease-in-out' : resultSide ? 'coin-bounce 0.4s ease-out' : 'none',
        }}>
          {flipping ? '🪙' : resultSide ? SIDE_EMOJI[resultSide] : '🪙'}
        </div>

        {/* Streak indicator */}
        <div style={{ display: 'flex', gap: '6px' }}>
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} style={{
              width: '36px',
              height: '8px',
              borderRadius: '4px',
              background: i <= streak ? 'linear-gradient(90deg, #f1c40f, #e74c3c)' : 'rgba(255,255,255,0.1)',
              boxShadow: i <= streak ? '0 0 8px rgba(241,196,15,0.6)' : 'none',
              transition: 'all 0.3s',
            }} />
          ))}
        </div>

        {/* Message */}
        <div style={{
          fontSize: '1.05rem',
          fontWeight: 800,
          textAlign: 'center',
          minHeight: '28px',
          color: resultSide ? (resultSide === pick ? '#2ecc71' : '#e74c3c') : 'var(--color-text-secondary)',
        }}>
          {message}
        </div>

        {/* Side selection */}
        <div style={{ display: 'flex', gap: '12px' }}>
          {(['heads', 'tails'] as Side[]).map((s) => (
            <button
              key={s}
              onClick={() => setPick(s)}
              disabled={flipping}
              style={{
                padding: '14px 28px',
                borderRadius: '14px',
                background: pick === s ? 'linear-gradient(135deg, #f1c40f, #e67e22)' : 'rgba(255,255,255,0.06)',
                color: pick === s ? '#000' : 'white',
                border: pick === s ? '3px solid white' : '1px solid rgba(255,255,255,0.1)',
                fontWeight: 800,
                fontSize: '1rem',
                cursor: flipping ? 'default' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                transition: 'all 0.15s',
                transform: pick === s ? 'scale(1.05)' : 'none',
              }}
            >
              <span style={{ fontSize: '1.6rem' }}>{SIDE_EMOJI[s]}</span>
              {SIDE_LABEL[s]}
            </button>
          ))}
        </div>

        {/* Bet + Flip */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)' }}>Cược:</span>
            {[10, 50, 100, 500, 1000].map((v) => (
              <button
                key={v}
                disabled={flipping}
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
            <CustomBetButton
              balance={balance}
              value={bet}
              onChange={setBet}
              disabled={flipping}
              presetValues={[10, 50, 100, 500, 1000]}
            />
          </div>

          <button
            onClick={flip}
            disabled={flipping || bet > balance}
            className="btn btn-primary"
            style={{
              padding: '14px 60px',
              fontSize: '1.1rem',
              fontWeight: 900,
              background: 'linear-gradient(135deg, #e74c3c, #f1c40f)',
              borderRadius: '30px',
            }}
          >
            {flipping ? '🪙 ĐANG LẬT...' : `🪙 LẬT (${bet} xu)`}
          </button>
        </div>

        {/* History */}
        {history.length > 0 && (
          <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', justifyContent: 'center', maxWidth: '500px' }}>
            {history.map((h, i) => (
              <span key={i} style={{
                padding: '4px 10px',
                borderRadius: '10px',
                fontSize: '0.7rem',
                fontWeight: 800,
                color: 'white',
                background: h.win ? '#2ecc71' : '#e74c3c',
              }}>
                {SIDE_EMOJI[h.result]} {h.win ? `+${h.delta}` : h.delta}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
