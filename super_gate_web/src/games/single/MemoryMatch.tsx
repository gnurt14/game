import React, { useState, useEffect } from 'react';
import { RefreshCw } from 'lucide-react';
import { CoinService } from '../../services/coinService';
import confetti from 'canvas-confetti';

interface MemoryMatchProps {
  onClose: () => void;
}

interface Card {
  id: number;
  emoji: string;
  isFlipped: boolean;
  isMatched: boolean;
}

const EMOJI_POOL = [
  '🐶', '🐱', '🐭', '🐹', '🐰', '🦊', '🐻', '🐼', 
  '🐨', '🐯', '🦁', '🐮', '🐷', '🐸', '🐵', '🐔',
  '🐧', '🐦', '🦆', '🦅', '🦉', '🦇', '🐺', '🐗',
  '🐴', '🦄', '🐝', '🐛', '🦋', '🐌', '🐞', '🐜',
];

export const MemoryMatch: React.FC<MemoryMatchProps> = ({ onClose }) => {
  const [gridSize, setGridSize] = useState<number>(4); // 4x4 or 6x6
  const [cards, setCards] = useState<Card[]>([]);
  const [selectedCards, setSelectedCards] = useState<number[]>([]);
  const [moves, setMoves] = useState<number>(0);
  const [isBusy, setIsBusy] = useState<boolean>(false);
  const [won, setWon] = useState<boolean>(false);
  const [earnedCoins, setEarnedCoins] = useState<number | null>(null);

  const initGame = (size: number) => {
    const pairCount = (size * size) / 2;
    // Get unique emojis
    const selectedEmojis = EMOJI_POOL.slice(0, pairCount);
    // Double them
    const cardsEmojis = [...selectedEmojis, ...selectedEmojis];
    
    // Shuffle cardsEmojis
    for (let i = cardsEmojis.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const temp = cardsEmojis[i];
      cardsEmojis[i] = cardsEmojis[j];
      cardsEmojis[j] = temp;
    }

    const initialCards: Card[] = cardsEmojis.map((emoji, idx) => ({
      id: idx,
      emoji,
      isFlipped: false,
      isMatched: false
    }));

    setCards(initialCards);
    setGridSize(size);
    setSelectedCards([]);
    setMoves(0);
    setIsBusy(false);
    setWon(false);
    setEarnedCoins(null);
  };

  useEffect(() => {
    initGame(4);
  }, []);

  const handleCardClick = (id: number) => {
    if (isBusy || won) return;
    const clickedCard = cards.find(c => c.id === id);
    if (!clickedCard || clickedCard.isFlipped || clickedCard.isMatched) return;

    // Flip card
    const nextCards = cards.map(c => c.id === id ? { ...c, isFlipped: true } : c);
    setCards(nextCards);

    const nextSelected = [...selectedCards, id];
    setSelectedCards(nextSelected);

    if (nextSelected.length === 2) {
      setMoves(prev => prev + 1);
      const [firstId, secondId] = nextSelected;
      const firstCard = cards.find(c => c.id === firstId);
      const secondCard = cards.find(c => c.id === secondId);

      if (firstCard && secondCard) {
        if (firstCard.emoji === secondCard.emoji) {
          // Matched
          setTimeout(() => {
            const matchedCards = nextCards.map(c => 
              (c.id === firstId || c.id === secondId)
                ? { ...c, isMatched: true }
                : c
            );
            setCards(matchedCards);
            setSelectedCards([]);
            checkWinCondition(matchedCards);
          }, 400);
        } else {
          // No match, flip back
          setIsBusy(true);
          setTimeout(() => {
            const flippedBackCards = nextCards.map(c => 
              (c.id === firstId || c.id === secondId)
                ? { ...c, isFlipped: false }
                : c
            );
            setCards(flippedBackCards);
            setSelectedCards([]);
            setIsBusy(false);
          }, 1000);
        }
      }
    }
  };

  const checkWinCondition = async (currentCards: Card[]) => {
    const allMatched = currentCards.every(c => c.isMatched);
    if (allMatched) {
      setWon(true);
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 }
      });
      // Award coins
      const coins = await CoinService.reportGameScore('memory', { won: true, level: gridSize, moves });
      setEarnedCoins(coins);
      await CoinService.recordGamePlayed('Memory Match');
    }
  };

  return (
    <div className="glass fullscreen-game-container">
      
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: 'var(--border-glass)', paddingBottom: '14px', marginBottom: '20px' }}>
        <div>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 800 }}>Memory Match</h2>
          <span style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)' }}>
            Lượt ghép: <strong style={{ color: 'var(--primary-color)' }}>{moves}</strong> | Kích thước: {gridSize}x{gridSize}
          </span>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button onClick={() => initGame(gridSize === 4 ? 6 : 4)} className="btn btn-secondary" style={{ fontSize: '0.85rem' }}>
            Đổi sang {gridSize === 4 ? '6x6' : '4x4'}
          </button>
          <button onClick={() => initGame(gridSize)} className="btn btn-secondary" style={{ padding: '8px 12px' }}>
            <RefreshCw size={16} />
          </button>
          <button onClick={onClose} className="btn btn-danger" style={{ fontSize: '0.85rem' }}>
            Thoát
          </button>
        </div>
      </div>

      {/* Main Play Area */}
      <div style={{ flexGrow: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
        
        {/* Memory Grid */}
        <div 
          style={{
            display: 'grid',
            gridTemplateColumns: `repeat(${gridSize}, 1fr)`,
            gap: gridSize === 4 ? '12px' : '8px',
            width: '100%',
            maxWidth: gridSize === 4 ? 'min(440px, 80vh - 180px, 90vw)' : 'min(560px, 80vh - 180px, 90vw)',
            aspectRatio: '1',
            background: 'rgba(0,0,0,0.2)',
            padding: '16px',
            borderRadius: '16px',
            border: 'var(--border-glass)'
          }}
        >
          {cards.map((card) => {
            const isRevealed = card.isFlipped || card.isMatched;
            return (
              <div
                key={card.id}
                onClick={() => handleCardClick(card.id)}
                style={{
                  perspective: '1000px',
                  cursor: isRevealed ? 'default' : 'pointer',
                  userSelect: 'none',
                  aspectRatio: '1',
                }}
              >
                {/* 3D Flip Card Container */}
                <div style={{
                  position: 'relative',
                  width: '100%',
                  height: '100%',
                  transformStyle: 'preserve-3d',
                  transition: 'transform 0.5s ease-in-out',
                  transform: isRevealed ? 'rotateY(180deg)' : 'rotateY(0deg)',
                }}>
                  {/* Card Front Side (Back of the face, i.e. hidden state) */}
                  <div style={{
                    position: 'absolute',
                    inset: 0,
                    borderRadius: '8px',
                    background: 'linear-gradient(135deg, #2b1f55 0%, #150f33 100%)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    boxShadow: '0 4px 8px rgba(0,0,0,0.2)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    backfaceVisibility: 'hidden',
                    fontSize: gridSize === 4 ? '1.5rem' : '1.1rem',
                    color: 'var(--primary-color)',
                    fontWeight: 800,
                  }}>
                    ❓
                  </div>

                  {/* Card Back Side (Emoji revealed) */}
                  <div style={{
                    position: 'absolute',
                    inset: 0,
                    borderRadius: '8px',
                    background: card.isMatched 
                      ? 'linear-gradient(135deg, #1b5e20 0%, #0d3c13 100%)' 
                      : 'linear-gradient(135deg, var(--primary-color) 0%, #584bbf 100%)',
                    border: card.isMatched ? '1px solid rgba(46, 204, 113, 0.4)' : '1px solid rgba(255,255,255,0.2)',
                    boxShadow: '0 4px 8px rgba(0,0,0,0.2)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    backfaceVisibility: 'hidden',
                    transform: 'rotateY(180deg)',
                    fontSize: gridSize === 4 ? '2rem' : '1.5rem',
                  }}>
                    {card.emoji}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Win Modal Overlay */}
        {won && (
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(10,8,20,0.85)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', borderRadius: '12px', zIndex: 10 }}>
            <span style={{ fontSize: '3rem', marginBottom: '10px' }}>🏆</span>
            <h3 style={{ color: '#2ecc71', fontSize: '1.8rem', fontWeight: 800, marginBottom: '6px' }}>Chiến Thắng!</h3>
            <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.9rem', marginBottom: '16px' }}>
              Bạn ghép hết lưới {gridSize}x{gridSize} trong **{moves}** lượt ghép.
            </p>
            {earnedCoins !== null && (
              <span style={{ fontSize: '1.2rem', fontWeight: 800, color: '#f1c40f', marginBottom: '24px' }}>
                🪙 +{earnedCoins} xu thưởng!
              </span>
            )}
            
            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={() => initGame(gridSize)} className="btn btn-primary">
                Chơi Ván Mới
              </button>
              <button onClick={onClose} className="btn btn-secondary">
                Về Sảnh
              </button>
            </div>
          </div>
        )}

      </div>

      <div style={{ textAlign: 'center', fontSize: '0.75rem', color: 'var(--color-text-muted)', fontWeight: 500 }}>
        💡 Nhấp chuột vào thẻ bài để lật và tìm các cặp emoji giống hệt nhau.
      </div>
    </div>
  );
};
