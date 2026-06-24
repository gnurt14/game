import React, { useState, useEffect } from 'react';
import { Play, RotateCcw, Trash2 } from 'lucide-react';
import { CoinService } from '../../services/coinService';
import confetti from 'canvas-confetti';

interface DoDenOfflineProps {
  onClose: () => void;
}

type CardSuit = 'hearts' | 'diamonds' | 'clubs' | 'spades';
type CardRank = 'A' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K';

type Card = {
  rank: CardRank;
  suit: CardSuit;
  isRed: boolean;
};

const SUITS: CardSuit[] = ['hearts', 'diamonds', 'clubs', 'spades'];
const RANKS: CardRank[] = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

export const DoDenOffline: React.FC<DoDenOfflineProps> = ({ onClose }) => {
  const [balance, setBalance] = useState<number>(0);
  const [selectedChip, setSelectedChip] = useState<number>(50);
  const [betChoice, setBetChoice] = useState<'red' | 'black' | null>(null);
  const [betAmount, setBetAmount] = useState<number>(0);

  const [lastBetChoice, setLastBetChoice] = useState<'red' | 'black' | null>(null);
  const [lastBetAmount, setLastBetAmount] = useState<number>(0);

  const [isFlipping, setIsFlipping] = useState<boolean>(false);
  const [flipFast, setFlipFast] = useState<boolean>(false);
  const [revealedCard, setRevealedCard] = useState<Card | null>(null);
  const [flipAnimating, setFlipAnimating] = useState<boolean>(false);
  const [colorFlash, setColorFlash] = useState<'red' | 'black' | null>(null);
  const [message, setMessage] = useState<string>('🔴 Đặt cược vào Đỏ hoặc Đen ⚫');
  const [winDelta, setWinDelta] = useState<number | null>(null);

  useEffect(() => {
    setBalance(CoinService.getData().balance);
    const unsub = CoinService.subscribe((data) => {
      setBalance(data.balance);
    });
    return unsub;
  }, []);

  const handlePlaceBet = async (choice: 'red' | 'black') => {
    if (isFlipping) return;
    if (balance < selectedChip) {
      alert('❌ Bạn không đủ xu cược!');
      return;
    }
    const success = await CoinService.spendCoins(selectedChip);
    if (success) {
      if (betChoice === choice) {
        setBetAmount(prev => prev + selectedChip);
      } else {
        if (betAmount > 0) await CoinService.earnCoins(betAmount);
        setBetChoice(choice);
        setBetAmount(selectedChip);
      }
      setMessage(`Đã cược ${betAmount + selectedChip} xu vào ô ${choice === 'red' ? 'ĐỎ 🔴' : 'ĐEN ⚫'}`);
    }
  };

  const handleClearBets = async () => {
    if (isFlipping || betAmount === 0) return;
    await CoinService.earnCoins(betAmount);
    setBetChoice(null);
    setBetAmount(0);
    setMessage('Đã hủy cược và hoàn tiền.');
  };

  const handleRebet = async () => {
    if (isFlipping || !lastBetChoice || lastBetAmount === 0) return;
    if (balance < lastBetAmount) {
      alert('❌ Số dư không đủ để đặt lại cược ván trước!');
      return;
    }
    const success = await CoinService.spendCoins(lastBetAmount);
    if (success) {
      setBetChoice(lastBetChoice);
      setBetAmount(lastBetAmount);
      setMessage(`Đã đặt lại cược ${lastBetAmount} xu vào ${lastBetChoice === 'red' ? 'ĐỎ 🔴' : 'ĐEN ⚫'}`);
    }
  };

  const handleFlip = () => {
    if (isFlipping) return;
    if (betAmount === 0 || !betChoice) {
      alert('⚠️ Bạn phải đặt cược vào Đỏ hoặc Đen!');
      return;
    }

    setIsFlipping(true);
    setFlipFast(false);
    setRevealedCard(null);
    setWinDelta(null);
    setColorFlash(null);
    setMessage('Đang xáo bài...');

    // Phase 1: slow spin (800ms) → Phase 2: fast spin → reveal
    setTimeout(() => setFlipFast(true), 800);
    setTimeout(() => resolveGame(), 1600);
  };

  const resolveGame = async () => {
    const capturedChoice = betChoice;
    const capturedAmount = betAmount;

    const randomSuit = SUITS[Math.floor(Math.random() * SUITS.length)];
    const randomRank = RANKS[Math.floor(Math.random() * RANKS.length)];
    const isRed = randomSuit === 'hearts' || randomSuit === 'diamonds';

    const card: Card = { rank: randomRank, suit: randomSuit, isRed };

    setRevealedCard(card);
    setFlipAnimating(true);
    setFlipFast(false);
    setIsFlipping(false);
    setTimeout(() => setFlipAnimating(false), 500);

    setLastBetChoice(capturedChoice);
    setLastBetAmount(capturedAmount);

    // Color wash matching revealed card
    setColorFlash(isRed ? 'red' : 'black');
    setTimeout(() => setColorFlash(null), 900);

    const isWin = (capturedChoice === 'red' && isRed) || (capturedChoice === 'black' && !isRed);

    if (isWin) {
      const winPayout = capturedAmount * 2;
      const netWin = capturedAmount;
      await CoinService.earnCoins(winPayout);
      setWinDelta(netWin);
      setMessage(`🎉 Thắng cược! Nhận +${netWin} xu thưởng!`);
      confetti({ particleCount: 70, spread: 70, origin: { x: 0.3, y: 0.6 } });
      setTimeout(() => confetti({ particleCount: 50, spread: 60, origin: { x: 0.7, y: 0.6 } }), 250);
    } else {
      setWinDelta(-capturedAmount);
      setMessage(`💸 Thua cược. Lá bài màu ${isRed ? 'Đỏ 🔴' : 'Đen ⚫'}!`);
    }

    setBetChoice(null);
    setBetAmount(0);

    await CoinService.recordGamePlayed('Đỏ Đen Offline');
  };

  return (
    <div className="glass fullscreen-game-container">
      <style>{`
        @keyframes dd-spin-slow { 0%{transform:rotateY(0deg)} 100%{transform:rotateY(360deg)} }
        @keyframes dd-spin-fast { 0%{transform:rotateY(0deg)} 100%{transform:rotateY(360deg)} }
        @keyframes dd-flip-reveal { 0%{transform:perspective(600px) rotateY(90deg) scale(0.8);opacity:0} 60%{transform:perspective(600px) rotateY(-8deg) scale(1.06)} 100%{transform:perspective(600px) rotateY(0deg) scale(1);opacity:1} }
        @keyframes dd-color-wash { 0%{opacity:0.8} 100%{opacity:0} }
      `}</style>

      {/* Color flash overlay */}
      {colorFlash && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: colorFlash === 'red' ? 'rgba(231,76,60,0.18)' : 'rgba(20,20,40,0.45)',
          pointerEvents: 'none',
          zIndex: 9999,
          animation: 'dd-color-wash 0.9s ease-out forwards',
        }} />
      )}

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: 'var(--border-glass)', paddingBottom: '14px', marginBottom: '20px' }}>
        <div>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 800 }}>Đỏ Đen (Offline vs Máy)</h2>
          <span style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)' }}>
            Số dư của bạn: <strong style={{ color: '#f1c40f', fontSize: '1rem' }}>🪙 {balance} xu</strong>
          </span>
        </div>
        <button onClick={onClose} className="btn btn-danger" style={{ fontSize: '0.85rem' }}>
          Thoát
        </button>
      </div>

      {/* Card area */}
      <div style={{ flexGrow: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '30px', position: 'relative' }}>

        {/* The Card View Container */}
        <div style={{
          width: '100%',
          maxWidth: '440px',
          height: '160px',
          background: 'rgba(0,0,0,0.3)',
          borderRadius: '16px',
          border: 'var(--border-glass)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: 'inset 0 4px 20px rgba(0,0,0,0.6)',
        }}>
          {isFlipping ? (
            <div style={{
              fontSize: '3.5rem',
              animation: flipFast
                ? 'dd-spin-fast 0.18s linear infinite'
                : 'dd-spin-slow 0.5s linear infinite',
            }}>🃏</div>
          ) : revealedCard ? (
            <div style={{
              width: '80px',
              height: '114px',
              background: 'white',
              borderRadius: '8px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              padding: '10px',
              color: revealedCard.isRed ? '#e74c3c' : '#2d3436',
              fontWeight: 800,
              fontSize: '1.4rem',
              border: `3px solid ${revealedCard.isRed ? '#e74c3c' : '#2d3436'}`,
              boxShadow: revealedCard.isRed
                ? '0 8px 24px rgba(231,76,60,0.4), 0 0 20px rgba(231,76,60,0.2)'
                : '0 8px 24px rgba(0,0,0,0.6)',
              animation: flipAnimating ? 'dd-flip-reveal 0.5s ease-out' : 'none',
            }}>
              <div style={{ alignSelf: 'flex-start', fontSize: '1.1rem' }}>{revealedCard.rank}</div>
              <div style={{ fontSize: '2.5rem', alignSelf: 'center', lineHeight: 1 }}>
                {revealedCard.suit === 'hearts' ? '♥' : revealedCard.suit === 'diamonds' ? '♦' : revealedCard.suit === 'clubs' ? '♣' : '♠'}
              </div>
              <div style={{ alignSelf: 'flex-end', fontSize: '1.1rem' }}>{revealedCard.rank}</div>
            </div>
          ) : (
            <span style={{ fontSize: '1rem', color: 'var(--color-text-secondary)', fontWeight: 600 }}>
              {message}
            </span>
          )}
        </div>

        {/* Message Delta Indicator */}
        {revealedCard && (
          <div style={{
            fontSize: '1.05rem',
            fontWeight: 800,
            color: winDelta !== null && winDelta > 0 ? '#2ecc71' : '#e74c3c',
            textAlign: 'center',
          }}>
            {message}
          </div>
        )}

        {/* Red & Black choice layout */}
        <div style={{ display: 'flex', gap: '20px', width: '100%', maxWidth: '440px' }}>

          {/* RED Box */}
          <div
            onClick={() => handlePlaceBet('red')}
            style={{
              flex: 1,
              height: '120px',
              borderRadius: '12px',
              background: betChoice === 'red' ? 'rgba(231, 76, 60, 0.22)' : 'rgba(231, 76, 60, 0.05)',
              border: betChoice === 'red' ? '2.5px solid #e74c3c' : '1px solid rgba(231, 76, 60, 0.2)',
              cursor: isFlipping ? 'default' : 'pointer',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.15s ease',
              position: 'relative',
              boxShadow: betChoice === 'red' ? '0 0 20px rgba(231, 76, 60, 0.35)' : 'none',
              transform: betChoice === 'red' ? 'scale(1.03)' : 'none',
            }}
          >
            <span style={{ fontSize: '2.5rem' }}>🔴</span>
            <span style={{ fontWeight: 800, fontSize: '0.95rem', marginTop: '6px', color: '#e74c3c' }}>ĐỎ (RED)</span>
            {betChoice === 'red' && betAmount > 0 && (
              <span style={{
                position: 'absolute',
                top: '8px',
                right: '8px',
                fontSize: '0.75rem',
                fontWeight: 800,
                background: '#f1c40f',
                color: '#000',
                padding: '3px 8px',
                borderRadius: '12px',
                boxShadow: '0 2px 4px rgba(0,0,0,0.3)',
                animation: 'pulse 1.5s infinite',
              }}>
                🪙 {betAmount}
              </span>
            )}
          </div>

          {/* BLACK Box */}
          <div
            onClick={() => handlePlaceBet('black')}
            style={{
              flex: 1,
              height: '120px',
              borderRadius: '12px',
              background: betChoice === 'black' ? 'rgba(255, 255, 255, 0.15)' : 'rgba(255, 255, 255, 0.02)',
              border: betChoice === 'black' ? '2.5px solid white' : '1px solid rgba(255, 255, 255, 0.1)',
              cursor: isFlipping ? 'default' : 'pointer',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.15s ease',
              position: 'relative',
              boxShadow: betChoice === 'black' ? '0 0 20px rgba(255, 255, 255, 0.2)' : 'none',
              transform: betChoice === 'black' ? 'scale(1.03)' : 'none',
            }}
          >
            <span style={{ fontSize: '2.5rem' }}>⚫</span>
            <span style={{ fontWeight: 800, fontSize: '0.95rem', marginTop: '6px', color: 'white' }}>ĐEN (BLACK)</span>
            {betChoice === 'black' && betAmount > 0 && (
              <span style={{
                position: 'absolute',
                top: '8px',
                right: '8px',
                fontSize: '0.75rem',
                fontWeight: 800,
                background: '#f1c40f',
                color: '#000',
                padding: '3px 8px',
                borderRadius: '12px',
                boxShadow: '0 2px 4px rgba(0,0,0,0.3)',
                animation: 'pulse 1.5s infinite',
              }}>
                🪙 {betAmount}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Action control drawer */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', borderTop: 'var(--border-glass)', paddingTop: '20px', alignItems: 'center' }}>
        {/* Chip selector */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)', fontWeight: 600 }}>Chọn chip cược:</span>
          <div style={{ display: 'flex', gap: '8px' }}>
            {[10, 50, 100, 500].map(val => (
              <button
                key={val}
                disabled={isFlipping}
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
                  cursor: isFlipping ? 'default' : 'pointer',
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
            disabled={isFlipping || betAmount === 0}
            className="btn btn-secondary"
            style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
          >
            <Trash2 size={16} /> Hủy cược
          </button>
          <button
            onClick={handleRebet}
            disabled={isFlipping || lastBetAmount === 0}
            className="btn btn-secondary"
            style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
          >
            <RotateCcw size={16} /> Cược lại
          </button>
          <button
            onClick={handleFlip}
            disabled={isFlipping || betAmount === 0}
            className="btn btn-primary"
            style={{ flex: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', fontWeight: 800 }}
          >
            <Play size={16} fill="white" /> Mở Bài (Flip)
          </button>
        </div>

        <div style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', textAlign: 'center' }}>
          💡 Chọn chip cược rồi nhấn ĐỎ hoặc ĐEN để cược màu lá bài sẽ rút ra. Thắng cược nhận x1 tiền thưởng cược (tỷ lệ 1 ăn 1).
        </div>
      </div>
    </div>
  );
};
