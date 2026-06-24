import React, { useState, useEffect } from 'react';
import { Play, RotateCcw, Trash2 } from 'lucide-react';
import { CoinService } from '../../services/coinService';
import confetti from 'canvas-confetti';

interface BauCuaOfflineProps {
  onClose: () => void;
}

const BC_ICONS = ['🦌', '🦀', '🦐', '🐟', '🐓', '🐗'];
const BC_NAMES = ['Nai', 'Cua', 'Tôm', 'Cá', 'Gà', 'Bầu'];

export const BauCuaOffline: React.FC<BauCuaOfflineProps> = ({ onClose }) => {
  const [balance, setBalance] = useState<number>(0);
  const [selectedChip, setSelectedChip] = useState<number>(50);
  const [bets, setBets] = useState<Record<number, number>>({
    0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0,
  });
  const [lastBets, setLastBets] = useState<Record<number, number> | null>(null);

  const [isShaking, setIsShaking] = useState<boolean>(false);
  const [shakeFast, setShakeFast] = useState<boolean>(false);
  const [diceResults, setDiceResults] = useState<number[] | null>(null);
  const [revealedCount, setRevealedCount] = useState<number>(0);
  const [winningIndices, setWinningIndices] = useState<Set<number>>(new Set());
  const [showWinFlash, setShowWinFlash] = useState<boolean>(false);
  const [message, setMessage] = useState<string>('Hãy đặt cược vào các ô linh vật!');
  const [winDelta, setWinDelta] = useState<number | null>(null);

  useEffect(() => {
    setBalance(CoinService.getData().balance);
    const unsub = CoinService.subscribe((data) => {
      setBalance(data.balance);
    });
    return unsub;
  }, []);

  const totalBetAmount = Object.values(bets).reduce((sum, val) => sum + val, 0);

  const handlePlaceBet = async (idx: number) => {
    if (isShaking) return;
    if (balance < selectedChip) {
      alert('❌ Bạn không đủ xu cược!');
      return;
    }
    const success = await CoinService.spendCoins(selectedChip);
    if (success) {
      setBets(prev => ({ ...prev, [idx]: prev[idx] + selectedChip }));
      setMessage(`Đã cược thêm ${selectedChip} xu vào ô ${BC_NAMES[idx]}`);
    }
  };

  const handleClearBets = async () => {
    if (isShaking || totalBetAmount === 0) return;
    await CoinService.earnCoins(totalBetAmount);
    setBets({ 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 });
    setMessage('Đã hủy toàn bộ cược và hoàn tiền.');
  };

  const handleRebet = async () => {
    if (isShaking || !lastBets) return;
    const lastTotal = Object.values(lastBets).reduce((sum, val) => sum + val, 0);
    if (lastTotal === 0) return;
    if (balance < lastTotal) {
      alert('❌ Số dư không đủ để đặt lại cược ván trước!');
      return;
    }
    const success = await CoinService.spendCoins(lastTotal);
    if (success) {
      setBets({ ...lastBets });
      setMessage('Đã đặt lại cược giống ván trước.');
    }
  };

  const handleRoll = () => {
    if (isShaking) return;
    if (totalBetAmount === 0) {
      alert('⚠️ Bạn phải đặt cược ít nhất một ô linh vật!');
      return;
    }

    setIsShaking(true);
    setShakeFast(false);
    setDiceResults(null);
    setRevealedCount(0);
    setWinDelta(null);
    setWinningIndices(new Set());
    setMessage('Đang lắc đĩa... 🫨');

    // Phase 1: slow shake (6 ticks × 180ms ≈ 1.1s)
    let tick = 0;
    const slowInterval = setInterval(() => {
      setDiceResults([
        Math.floor(Math.random() * 6),
        Math.floor(Math.random() * 6),
        Math.floor(Math.random() * 6),
      ]);
      tick++;
      if (tick >= 6) {
        clearInterval(slowInterval);
        setShakeFast(true);
        // Phase 2: frantic shake (8 ticks × 80ms ≈ 640ms)
        let fastTick = 0;
        const fastInterval = setInterval(() => {
          setDiceResults([
            Math.floor(Math.random() * 6),
            Math.floor(Math.random() * 6),
            Math.floor(Math.random() * 6),
          ]);
          fastTick++;
          if (fastTick >= 8) {
            clearInterval(fastInterval);
            resolveGame();
          }
        }, 80);
      }
    }, 180);
  };

  const resolveGame = async () => {
    const finalDice = [
      Math.floor(Math.random() * 6),
      Math.floor(Math.random() * 6),
      Math.floor(Math.random() * 6),
    ];

    const capturedBets = { ...bets };
    const capturedTotal = Object.values(capturedBets).reduce((s, v) => s + v, 0);

    setLastBets(capturedBets);
    setShakeFast(false);
    setIsShaking(false);

    // Count matched dice
    const matchCounts: Record<number, number> = {};
    finalDice.forEach(die => { matchCounts[die] = (matchCounts[die] || 0) + 1; });

    // Which dice positions match a placed bet
    const winIdx = new Set<number>();
    finalDice.forEach((die, i) => { if (capturedBets[die] > 0) winIdx.add(i); });
    setWinningIndices(winIdx);

    // Stagger dice reveal: one per 350ms
    setDiceResults(finalDice);
    setRevealedCount(0);
    setTimeout(() => setRevealedCount(1), 0);
    setTimeout(() => setRevealedCount(2), 350);
    setTimeout(() => setRevealedCount(3), 700);

    // Calculate payouts
    let totalWin = 0;
    Object.entries(capturedBets).forEach(([key, betVal]) => {
      const idx = parseInt(key);
      if (betVal > 0) {
        const matches = matchCounts[idx] || 0;
        if (matches > 0) totalWin += betVal * (matches + 1);
      }
    });

    const netResult = totalWin - capturedTotal;
    setWinDelta(netResult);

    // Delay payouts until all dice revealed
    setTimeout(async () => {
      if (totalWin > 0) {
        await CoinService.earnCoins(totalWin);
        if (netResult > 0) {
          setMessage(`🎉 Chúc mừng! Bạn thắng ròng +${netResult} xu!`);
          setShowWinFlash(true);
          setTimeout(() => setShowWinFlash(false), 1500);
          confetti({ particleCount: 80, spread: 70, origin: { x: 0.3, y: 0.6 } });
          setTimeout(() => confetti({ particleCount: 60, spread: 60, origin: { x: 0.7, y: 0.6 } }), 200);
          setTimeout(() => confetti({ particleCount: 40, spread: 90, origin: { x: 0.5, y: 0.4 } }), 400);
        } else {
          setMessage(`🤝 Hòa vốn (Hoàn trả ${totalWin} xu cược).`);
        }
      } else {
        setMessage(`💸 Bạn đã mất ${capturedTotal} xu cược. Chúc bạn may mắn lần sau!`);
      }
      setBets({ 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 });
      await CoinService.recordGamePlayed('Bầu Cua Offline');
    }, 900);
  };

  return (
    <div className="glass fullscreen-game-container">
      <style>{`
        @keyframes bc-shake-slow { 0%,100%{transform:translateY(0) rotate(0deg)} 25%{transform:translateY(-7px) rotate(-4deg)} 75%{transform:translateY(-7px) rotate(4deg)} }
        @keyframes bc-shake-fast { 0%,100%{transform:translateY(0) rotate(0deg)} 25%{transform:translateY(-14px) rotate(-8deg)} 75%{transform:translateY(-14px) rotate(8deg)} }
        @keyframes bc-dice-drop { 0%{transform:translateY(-30px) scale(0.6);opacity:0} 70%{transform:translateY(4px) scale(1.06)} 100%{transform:translateY(0) scale(1);opacity:1} }
        @keyframes bc-win-glow { 0%,100%{box-shadow:0 0 14px rgba(241,196,15,0.6)} 50%{box-shadow:0 0 32px rgba(241,196,15,1),0 0 60px rgba(241,196,15,0.35)} }
        @keyframes bc-win-flash { 0%{opacity:1} 100%{opacity:0} }
      `}</style>

      {/* Win flash overlay */}
      {showWinFlash && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'radial-gradient(circle at center, rgba(241,196,15,0.22) 0%, rgba(241,196,15,0.04) 100%)',
          pointerEvents: 'none',
          zIndex: 9999,
          animation: 'bc-win-flash 1.5s ease-out forwards',
        }} />
      )}

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: 'var(--border-glass)', paddingBottom: '14px', marginBottom: '20px' }}>
        <div>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 800 }}>Bầu Cua Tôm Cá (Offline vs Máy)</h2>
          <span style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)' }}>
            Số dư của bạn: <strong style={{ color: '#f1c40f', fontSize: '1rem' }}>🪙 {balance} xu</strong>
          </span>
        </div>
        <button onClick={onClose} className="btn btn-danger" style={{ fontSize: '0.85rem' }}>
          Thoát
        </button>
      </div>

      {/* Shaker / Dices Area */}
      <div style={{ flexGrow: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '20px', position: 'relative' }}>
        <div style={{
          width: '100%',
          maxWidth: '440px',
          height: '140px',
          background: 'rgba(0,0,0,0.3)',
          borderRadius: '16px',
          border: 'var(--border-glass)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: 'inset 0 4px 20px rgba(0,0,0,0.6)',
        }}>
          {isShaking ? (
            <div style={{
              fontSize: '4.5rem',
              animation: shakeFast ? 'bc-shake-fast 0.09s infinite' : 'bc-shake-slow 0.22s infinite',
            }}>🫨🥤</div>
          ) : diceResults ? (
            <div style={{ display: 'flex', gap: '20px' }}>
              {diceResults.map((dieVal, idx) => (
                idx < revealedCount ? (
                  <div key={idx} style={{
                    fontSize: '3rem',
                    background: winningIndices.has(idx) ? 'rgba(241, 196, 15, 0.18)' : 'rgba(255, 255, 255, 0.08)',
                    width: '70px',
                    height: '70px',
                    borderRadius: '16px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    border: winningIndices.has(idx) ? '2px solid #f1c40f' : '2px solid rgba(255, 255, 255, 0.15)',
                    animation: winningIndices.has(idx)
                      ? 'bc-dice-drop 0.4s ease-out, bc-win-glow 1.5s 0.5s infinite'
                      : 'bc-dice-drop 0.4s ease-out',
                  }}>
                    {BC_ICONS[dieVal]}
                  </div>
                ) : (
                  <div key={idx} style={{
                    width: '70px',
                    height: '70px',
                    borderRadius: '16px',
                    border: '2px dashed rgba(255,255,255,0.08)',
                    background: 'rgba(255,255,255,0.02)',
                  }} />
                )
              ))}
            </div>
          ) : (
            <span style={{ fontSize: '1rem', color: 'var(--color-text-secondary)', fontWeight: 600 }}>
              {message}
            </span>
          )}
        </div>

        {/* Message Indicator */}
        {diceResults && revealedCount >= 3 && (
          <div style={{
            fontSize: '1.05rem',
            fontWeight: 800,
            textAlign: 'center',
            color: winDelta !== null && winDelta > 0 ? '#2ecc71' : winDelta === 0 ? '#f1c40f' : 'var(--color-text-secondary)',
          }}>
            {message}
          </div>
        )}

        {/* 6 Icons Betting Board */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 2fr)',
          gap: '16px',
          width: '100%',
          maxWidth: '440px',
        }}>
          {BC_ICONS.map((icon, idx) => {
            const currentBet = bets[idx] || 0;
            return (
              <div
                key={idx}
                onClick={() => handlePlaceBet(idx)}
                style={{
                  background: currentBet > 0 ? 'rgba(124, 111, 255, 0.12)' : 'rgba(255,255,255,0.03)',
                  border: currentBet > 0 ? '2px solid var(--primary-color)' : '1px solid rgba(255,255,255,0.08)',
                  borderRadius: '12px',
                  padding: '16px 10px',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  cursor: isShaking ? 'default' : 'pointer',
                  transition: 'all 0.15s ease',
                  transform: currentBet > 0 ? 'scale(1.03)' : 'none',
                  boxShadow: currentBet > 0 ? '0 0 15px rgba(124,111,255,0.2)' : 'none',
                }}
              >
                <span style={{ fontSize: '2.5rem', marginBottom: '6px' }}>{icon}</span>
                <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'white' }}>{BC_NAMES[idx]}</span>
                {currentBet > 0 ? (
                  <div style={{
                    marginTop: '8px',
                    background: '#f1c40f',
                    color: '#000',
                    fontWeight: 800,
                    fontSize: '0.75rem',
                    padding: '3px 8px',
                    borderRadius: '12px',
                    boxShadow: '0 2px 6px rgba(0,0,0,0.3)',
                    animation: 'pulse 1.5s infinite',
                  }}>
                    🪙 {currentBet}
                  </div>
                ) : (
                  <span style={{ fontSize: '0.65rem', color: 'var(--color-text-muted)', marginTop: '8px' }}>Chưa cược</span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Control panel & Chip Selection */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', borderTop: 'var(--border-glass)', paddingTop: '20px', alignItems: 'center' }}>
        {/* Chip selector */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)', fontWeight: 600 }}>Chọn chip cược:</span>
          <div style={{ display: 'flex', gap: '8px' }}>
            {[10, 50, 100, 500].map(val => (
              <button
                key={val}
                disabled={isShaking}
                onClick={() => setSelectedChip(val)}
                style={{
                  width: '46px',
                  height: '46px',
                  borderRadius: '50%',
                  border: selectedChip === val ? '3px solid white' : '1px solid rgba(255,255,255,0.1)',
                  background: val === 10 ? '#3498db' : val === 50 ? '#2ecc71' : val === 100 ? '#e67e22' : '#e74c3c',
                  color: 'white',
                  fontWeight: 900,
                  fontSize: '0.75rem',
                  cursor: isShaking ? 'default' : 'pointer',
                  transform: selectedChip === val ? 'scale(1.1)' : 'none',
                  boxShadow: selectedChip === val ? '0 0 10px rgba(255,255,255,0.4)' : 'none',
                  transition: 'all 0.15s ease',
                }}
              >
                {val}
              </button>
            ))}
          </div>
        </div>

        {/* Operational buttons */}
        <div style={{ display: 'flex', gap: '12px', width: '100%', maxWidth: '440px' }}>
          <button
            onClick={handleClearBets}
            disabled={isShaking || totalBetAmount === 0}
            className="btn btn-secondary"
            style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
          >
            <Trash2 size={16} /> Hủy cược
          </button>
          <button
            onClick={handleRebet}
            disabled={isShaking || !lastBets}
            className="btn btn-secondary"
            style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
          >
            <RotateCcw size={16} /> Cược lại
          </button>
          <button
            onClick={handleRoll}
            disabled={isShaking || totalBetAmount === 0}
            className="btn btn-primary"
            style={{ flex: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', fontWeight: 800 }}
          >
            <Play size={16} fill="white" /> Lắc Đĩa (Roll)
          </button>
        </div>

        <div style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', textAlign: 'center' }}>
          💡 Chọn chip cược rồi nhấn vào các ô linh vật để đặt cược. Nhấn "Lắc Đĩa" để máy quay xúc xắc. Trùng 1 nhận x1 cược, trùng 2 x2, trùng 3 x3 và được hoàn trả lại tiền gốc cược trúng.
        </div>
      </div>
    </div>
  );
};
