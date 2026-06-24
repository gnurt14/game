import React, { useState, useEffect } from 'react';
import { RefreshCw, Play } from 'lucide-react';
import { CoinService } from '../../services/coinService';
import confetti from 'canvas-confetti';

interface MastermindProps {
  onClose: () => void;
}

const PEGS_COLORS = ['#e74c3c', '#3498db', '#2ecc71', '#f1c40f', '#e67e22', '#9b59b6']; // 6 colors

interface GuessRow {
  pegs: number[]; // Index in PEGS_COLORS (0 to 5) or -1 if empty
  blackPegs: number; // Correct color & spot
  whitePegs: number; // Correct color, wrong spot
}

export const Mastermind: React.FC<MastermindProps> = ({ onClose }) => {
  const [secretCode, setSecretCode] = useState<number[]>([]);
  const [guesses, setGuesses] = useState<GuessRow[]>([]);
  const [currentGuess, setCurrentGuess] = useState<number[]>([-1, -1, -1, -1]);
  const [activeSlot, setActiveSlot] = useState<number>(0); // 0 to 3
  const [gameOver, setGameOver] = useState<boolean>(false);
  const [won, setWon] = useState<boolean>(false);
  const [earnedCoins, setEarnedCoins] = useState<number | null>(null);

  const initGame = () => {
    // Generate 4 secret colors (duplicates allowed)
    const code = Array.from({ length: 4 }, () => Math.floor(Math.random() * PEGS_COLORS.length));
    setSecretCode(code);
    setGuesses(Array.from({ length: 10 }, () => ({ pegs: [-1, -1, -1, -1], blackPegs: 0, whitePegs: 0 })));
    setCurrentGuess([-1, -1, -1, -1]);
    setActiveSlot(0);
    setGameOver(false);
    setWon(false);
    setEarnedCoins(null);
  };

  useEffect(() => {
    initGame();
  }, []);

  const handleSelectColor = (colorIdx: number) => {
    if (gameOver || won) return;
    const nextGuess = [...currentGuess];
    nextGuess[activeSlot] = colorIdx;
    setCurrentGuess(nextGuess);
    // Auto-advance slot
    setActiveSlot((prev) => (prev + 1) % 4);
  };

  const handleSubmitGuess = async () => {
    if (currentGuess.includes(-1)) return; // Complete all 4 slots

    // Calculate feedback
    let blackPegs = 0;
    let whitePegs = 0;

    const secretCopy = [...secretCode];
    const guessCopy = [...currentGuess];

    // First pass: check for black pegs (exact match)
    for (let i = 0; i < 4; i++) {
      if (guessCopy[i] === secretCopy[i]) {
        blackPegs++;
        secretCopy[i] = -1; // Mark checked
        guessCopy[i] = -2;  // Mark checked
      }
    }

    // Second pass: check for white pegs (color match in wrong spot)
    for (let i = 0; i < 4; i++) {
      if (guessCopy[i] < 0) continue;
      const matchIdx = secretCopy.indexOf(guessCopy[i]);
      if (matchIdx !== -1) {
        whitePegs++;
        secretCopy[matchIdx] = -1; // Mark checked
      }
    }

    // Add guess to history list (fill from bottom index)
    const firstEmptyIdx = guesses.findIndex(g => g.pegs[0] === -1);
    if (firstEmptyIdx !== -1) {
      const nextGuesses = [...guesses];
      nextGuesses[firstEmptyIdx] = {
        pegs: currentGuess,
        blackPegs,
        whitePegs
      };
      setGuesses(nextGuesses);
    }

    if (blackPegs === 4) {
      setWon(true);
      setGameOver(true);
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 }
      });
      
      const attemptCount = guesses.findIndex(g => g.pegs[0] === -1) + 1;
      const coins = await CoinService.reportGameScore('mastermind', { won: true, level: 0, moves: attemptCount });
      setEarnedCoins(coins);
      await CoinService.recordGamePlayed('Mastermind');
    } else {
      const activeGuessesCount = guesses.filter(g => g.pegs[0] !== -1).length + 1;
      if (activeGuessesCount >= 10) {
        setGameOver(true);
        const coins = await CoinService.reportGameScore('mastermind', { won: false });
        setEarnedCoins(coins);
        await CoinService.recordGamePlayed('Mastermind');
      } else {
        // Reset current guess
        setCurrentGuess([-1, -1, -1, -1]);
        setActiveSlot(0);
      }
    }
  };

  return (
    <div className="glass fullscreen-game-container">
      
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: 'var(--border-glass)', paddingBottom: '14px', marginBottom: '20px' }}>
        <div>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 800 }}>Mastermind</h2>
          <span style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)' }}>
            Giải mã chuỗi 4 nút màu bí ẩn. Lượt đoán: <strong>{guesses.filter(g => g.pegs[0] !== -1).length + 1}/10</strong>
          </span>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button onClick={initGame} className="btn btn-secondary" style={{ padding: '8px 12px' }}>
            <RefreshCw size={16} />
          </button>
          <button onClick={onClose} className="btn btn-danger" style={{ fontSize: '0.85rem' }}>
            Thoát
          </button>
        </div>
      </div>

      {/* Play Area */}
      <div style={{ flexGrow: 1, display: 'flex', gap: '40px', justifyContent: 'center', alignItems: 'center', flexWrap: 'wrap', overflowY: 'auto' }}>
        
        {/* Main Board (History & Clues) */}
        <div 
          style={{
            background: 'rgba(0,0,0,0.3)',
            borderRadius: '16px',
            border: 'var(--border-glass)',
            padding: '16px',
            display: 'flex',
            flexDirection: 'column-reverse', // Current guess index on top or bottom
            gap: '8px',
            width: '100%',
            maxWidth: '400px',
          }}
        >
          {guesses.map((row, idx) => {
            return (
              <div 
                key={idx} 
                style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'center',
                  background: 'rgba(255,255,255,0.02)',
                  padding: '6px 10px',
                  borderRadius: '8px',
                  border: '1px solid rgba(255,255,255,0.01)'
                }}
              >
                {/* Row Index */}
                <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', fontWeight: 800, width: '20px' }}>
                  {idx + 1}
                </span>

                {/* Color Pegs */}
                <div style={{ display: 'flex', gap: '8px' }}>
                  {row.pegs.map((pegIdx, pIdx) => {
                    const color = pegIdx !== -1 ? PEGS_COLORS[pegIdx] : 'rgba(255,255,255,0.1)';
                    return (
                      <div
                        key={pIdx}
                        style={{
                          width: '24px',
                          height: '24px',
                          borderRadius: '50%',
                          background: color,
                          border: pegIdx !== -1 ? '1px solid rgba(255,255,255,0.3)' : '1px dashed rgba(255,255,255,0.2)',
                          boxShadow: pegIdx !== -1 ? '0 2px 4px rgba(0,0,0,0.3)' : 'none',
                        }}
                      />
                    );
                  })}
                </div>

                {/* Clues */}
                <div style={{ 
                  display: 'grid', 
                  gridTemplateColumns: '1fr 1fr', 
                  gap: '4px',
                  width: '32px',
                  height: '24px',
                  alignContent: 'center',
                  justifyItems: 'center'
                }}>
                  {/* Black pegs indicators */}
                  {Array.from({ length: row.blackPegs }).map((_, c) => (
                    <div key={`b-${c}`} style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#ff3f34', border: '1px solid rgba(255,255,255,0.2)' }} />
                  ))}
                  {/* White pegs indicators */}
                  {Array.from({ length: row.whitePegs }).map((_, c) => (
                    <div key={`w-${c}`} style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#ffffff', border: '1px solid rgba(0,0,0,0.2)' }} />
                  ))}
                  {/* Blank slots */}
                  {Array.from({ length: 4 - row.blackPegs - row.whitePegs }).map((_, c) => (
                    <div key={`e-${c}`} style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'rgba(255,255,255,0.05)' }} />
                  ))}
                </div>

              </div>
            );
          })}
        </div>

        {/* Input Panel (Colors Selector & Current Guess Control) */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', width: '100%', maxWidth: '240px' }}>
          
          {/* Current Guess Slot Editor */}
          <div style={{ background: 'rgba(255,255,255,0.04)', padding: '16px', borderRadius: '12px', border: 'var(--border-glass)', textAlign: 'center' }}>
            <h4 style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)', marginBottom: '12px', fontWeight: 700 }}>Đang chọn nước đi</h4>
            
            <div style={{ display: 'flex', justifyContent: 'center', gap: '10px' }}>
              {currentGuess.map((pegIdx, idx) => {
                const isSelected = activeSlot === idx;
                const color = pegIdx !== -1 ? PEGS_COLORS[pegIdx] : 'rgba(0,0,0,0.3)';
                
                return (
                  <div
                    key={idx}
                    onClick={() => setActiveSlot(idx)}
                    style={{
                      width: '36px',
                      height: '36px',
                      borderRadius: '50%',
                      background: color,
                      border: isSelected ? '2px solid var(--primary-color)' : '1px solid rgba(255,255,255,0.2)',
                      cursor: 'pointer',
                      transform: isSelected ? 'scale(1.15)' : 'scale(1)',
                      transition: 'all 0.15s ease',
                      boxShadow: isSelected ? '0 0 10px var(--primary-color)' : 'none',
                    }}
                  />
                );
              })}
            </div>
          </div>

          {/* Peg Colors Palette Selection */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
            {PEGS_COLORS.map((color, idx) => (
              <button
                key={idx}
                onClick={() => handleSelectColor(idx)}
                className="btn btn-secondary glass-interactive"
                style={{
                  height: '42px',
                  background: color,
                  border: '1px solid rgba(255,255,255,0.4)',
                  padding: 0,
                  boxShadow: '0 4px 6px rgba(0,0,0,0.2)',
                }}
              />
            ))}
          </div>

          {/* Submit Guess Button */}
          <button
            onClick={handleSubmitGuess}
            disabled={currentGuess.includes(-1)}
            className="btn btn-primary"
            style={{ width: '100%', height: '46px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', fontSize: '0.9rem', fontWeight: 800 }}
          >
            <Play size={16} fill="white" /> Kiểm Tra Guess
          </button>
        </div>

        {/* Game Over Overlay */}
        {gameOver && (
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(10,8,20,0.85)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', borderRadius: '12px', zIndex: 10 }}>
            <span style={{ fontSize: '3rem', marginBottom: '10px' }}>{won ? '🏆' : '🔒'}</span>
            <h3 style={{ color: won ? '#2ecc71' : '#e74c3c', fontSize: '1.8rem', fontWeight: 800, marginBottom: '6px' }}>
              {won ? 'Thắng Cuộc!' : 'Khóa Bí Mật!'}
            </h3>
            <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.9rem', marginBottom: '16px' }}>
              {won ? 'Bạn đã giải mã thành công!' : 'Hết lượt đoán. Mã số đúng là:'}
            </p>
            
            {/* Show Secret Code */}
            <div style={{ display: 'flex', gap: '10px', marginBottom: '24px' }}>
              {secretCode.map((pegIdx, idx) => (
                <div
                  key={idx}
                  style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '50%',
                    background: PEGS_COLORS[pegIdx],
                    border: '1px solid rgba(255,255,255,0.3)',
                    boxShadow: '0 4px 8px rgba(0,0,0,0.3)'
                  }}
                />
              ))}
            </div>

            {earnedCoins !== null && (
              <span style={{ fontSize: '1.2rem', fontWeight: 800, color: '#f1c40f', marginBottom: '24px' }}>
                🪙 +{earnedCoins} xu thưởng!
              </span>
            )}
            
            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={initGame} className="btn btn-primary">
                Chơi Ván Mới
              </button>
              <button onClick={onClose} className="btn btn-secondary">
                Thoát
              </button>
            </div>
          </div>
        )}

      </div>

      <div style={{ textAlign: 'center', fontSize: '0.75rem', color: 'var(--color-text-muted)', fontWeight: 500 }}>
        💡 Chọn từng ô tròn trong khu vực "Đang chọn nước đi" và nhấn chọn các màu sắc bên dưới. Khi đã lấp đầy 4 ô, nhấn "Kiểm Tra Guess".
        <br />
        Chốt đỏ (<div style={{ display: 'inline-block', width: '6px', height: '6px', borderRadius: '50%', background: '#ff3f34' }} />) = Đúng màu & Đúng vị trí | Chốt trắng (<div style={{ display: 'inline-block', width: '6px', height: '6px', borderRadius: '50%', background: '#fff' }} />) = Đúng màu nhưng Sai vị trí.
      </div>
    </div>
  );
};
