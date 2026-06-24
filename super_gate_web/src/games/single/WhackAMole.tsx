import React, { useState, useEffect, useRef } from 'react';
import { Play, Clock } from 'lucide-react';
import { CoinService } from '../../services/coinService';
import confetti from 'canvas-confetti';

interface WhackAMoleProps {
  onClose: () => void;
}

type Hole = {
  id: number;
  active: boolean;
  type: 'normal' | 'golden' | 'bomb'; // normal mole, golden mole (x2 score), bomb (minus score)
};

export const WhackAMole: React.FC<WhackAMoleProps> = ({ onClose }) => {
  const [holes, setHoles] = useState<Hole[]>(
    Array.from({ length: 9 }, (_, idx) => ({ id: idx, active: false, type: 'normal' }))
  );
  const [score, setScore] = useState<number>(0);
  const [timeLeft, setTimeLeft] = useState<number>(30); // 30 seconds game round
  const [isStarted, setIsStarted] = useState<boolean>(false);
  const [gameOver, setGameOver] = useState<boolean>(false);
  const [earnedCoins, setEarnedCoins] = useState<number | null>(null);

  const scoreRef = useRef<number>(0);
  const timerIntervalRef = useRef<any>(null);
  const moleIntervalRef = useRef<any>(null);
  
  const initGame = () => {
    scoreRef.current = 0;
    setScore(0);
    setTimeLeft(30);
    setGameOver(false);
    setIsStarted(false);
    setEarnedCoins(null);
    setHoles(Array.from({ length: 9 }, (_, idx) => ({ id: idx, active: false, type: 'normal' })));

    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    if (moleIntervalRef.current) clearInterval(moleIntervalRef.current);
  };

  const startGame = () => {
    setIsStarted(true);
    
    // 30 seconds Countdown Timer
    timerIntervalRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          handleGameOver();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    // Mole popping spawn loop
    spawnMolesLoop();
  };

  const spawnMolesLoop = () => {
    // Spawn interval decreases slightly as score increases to make it speedier
    const currentSpeed = Math.max(450, 900 - scoreRef.current * 8);

    moleIntervalRef.current = setTimeout(() => {
      popRandomMole();
      // Schedule next spawn recursively with updated speed
      spawnMolesLoop();
    }, currentSpeed);
  };

  const popRandomMole = () => {
    setHoles((prevHoles) => {
      // Find empty inactive holes
      const inactiveIndices = prevHoles
        .map((h, idx) => (!h.active ? idx : null))
        .filter((idx): idx is number => idx !== null);

      if (inactiveIndices.length === 0) return prevHoles;

      const randomIndex = inactiveIndices[Math.floor(Math.random() * inactiveIndices.length)];
      
      // Determine mole type
      const roll = Math.random();
      let type: 'normal' | 'golden' | 'bomb' = 'normal';
      if (roll < 0.12) {
        type = 'bomb';
      } else if (roll < 0.25) {
        type = 'golden';
      }

      const nextHoles = [...prevHoles];
      nextHoles[randomIndex] = {
        id: randomIndex,
        active: true,
        type
      };

      // Auto hide mole after custom duration
      const hideDuration = type === 'golden' ? 700 : type === 'bomb' ? 1200 : 1000;
      setTimeout(() => {
        hideMole(randomIndex);
      }, hideDuration);

      return nextHoles;
    });
  };

  const hideMole = (idx: number) => {
    setHoles((prevHoles) => {
      const nextHoles = [...prevHoles];
      if (nextHoles[idx] && nextHoles[idx].active) {
        nextHoles[idx] = { id: idx, active: false, type: 'normal' };
      }
      return nextHoles;
    });
  };

  const handleWhack = (idx: number, e: React.MouseEvent) => {
    e.stopPropagation();
    const targetHole = holes[idx];
    if (!targetHole || !targetHole.active) return;

    // Smashed! Hide it immediately
    hideMole(idx);

    let scoreDelta = 0;
    if (targetHole.type === 'normal') {
      scoreDelta = 1;
    } else if (targetHole.type === 'golden') {
      scoreDelta = 3; // Golden bonus!
    } else if (targetHole.type === 'bomb') {
      scoreDelta = -2; // Hit bomb!
    }

    scoreRef.current = Math.max(0, scoreRef.current + scoreDelta);
    setScore(scoreRef.current);

    // Dynamic scale pop-out effect on hit
    const target = e.currentTarget as HTMLDivElement;
    target.style.transform = 'scale(0.92)';
    setTimeout(() => {
      target.style.transform = 'scale(1)';
    }, 80);
  };

  const handleGameOver = async () => {
    setIsStarted(false);
    setGameOver(true);
    
    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    if (moleIntervalRef.current) clearTimeout(moleIntervalRef.current);

    if (scoreRef.current >= 20) {
      confetti({
        particleCount: 80,
        spread: 60,
        origin: { y: 0.6 }
      });
    }

    // Award coins based on score
    const coins = await CoinService.reportGameScore('whack_mole', { won: false, score: scoreRef.current });
    setEarnedCoins(coins);
    await CoinService.recordGamePlayed('Whack-a-Mole');
  };

  useEffect(() => {
    initGame();
    return () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      if (moleIntervalRef.current) clearTimeout(moleIntervalRef.current);
    };
  }, []);

  return (
    <div className="glass fullscreen-game-container">
      
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: 'var(--border-glass)', paddingBottom: '14px', marginBottom: '20px' }}>
        <div>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 800 }}>Đập Chuột Chũi (Whack-a-Mole)</h2>
          <span style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
            Điểm số: <strong style={{ color: 'var(--primary-color)', fontSize: '1rem' }}>{score}</strong>
            | <Clock size={14} /> Thời gian: <strong style={{ color: timeLeft < 10 ? '#e74c3c' : 'white' }}>{timeLeft}s</strong>
          </span>
        </div>
        <button onClick={onClose} className="btn btn-danger" style={{ fontSize: '0.85rem' }}>
          Thoát
        </button>
      </div>

      {/* Play Area */}
      <div style={{ flexGrow: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
        
        {/* 3x3 Mole Holes Board */}
        <div 
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: '20px',
            width: '100%',
            maxWidth: 'min(420px, 80vh - 180px, 90vw)',
            aspectRatio: '1',
            background: 'rgba(0,0,0,0.2)',
            padding: '20px',
            borderRadius: '16px',
            border: 'var(--border-glass)',
          }}
        >
          {holes.map((hole) => {
            const hasMole = hole.active;
            const isGolden = hole.type === 'golden';
            const isBomb = hole.type === 'bomb';

            return (
              <div
                key={hole.id}
                onClick={(e) => handleWhack(hole.id, e)}
                style={{
                  position: 'relative',
                  background: 'rgba(255, 255, 255, 0.03)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  borderRadius: '50%',
                  aspectRatio: '1',
                  overflow: 'hidden',
                  cursor: hasMole ? 'pointer' : 'default',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: 'inset 0 6px 12px rgba(0,0,0,0.6)',
                  transition: 'transform 0.08s ease-in-out',
                }}
              >
                {/* Hole Soil Rim */}
                <div style={{
                  position: 'absolute',
                  bottom: 0,
                  width: '100%',
                  height: '14px',
                  background: 'rgba(124, 111, 255, 0.1)',
                  borderTop: '2px solid rgba(124, 111, 255, 0.25)',
                  zIndex: 2,
                }} />

                {/* Popping Mole Emoji */}
                <div style={{
                  fontSize: '2.5rem',
                  transition: 'all 0.18s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
                  transform: hasMole ? 'translateY(0)' : 'translateY(50px)',
                  opacity: hasMole ? 1 : 0,
                  zIndex: 1,
                  filter: isGolden 
                    ? 'drop-shadow(0 0 8px #f1c40f)' 
                    : isBomb 
                      ? 'drop-shadow(0 0 8px #e74c3c)' 
                      : 'none',
                }}>
                  {isBomb ? '💣' : isGolden ? '🐹👑' : '🐹'}
                </div>
              </div>
            );
          })}
        </div>

        {/* Start Game overlay */}
        {!isStarted && !gameOver && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', zIndex: 10, background: 'rgba(10,8,20,0.5)', pointerEvents: 'none' }}>
            <span style={{ fontSize: '3rem', marginBottom: '14px' }}>🐹</span>
            <button onClick={startGame} className="btn btn-primary" style={{ pointerEvents: 'auto', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Play size={16} fill="white" /> Bắt đầu đập chuột
            </button>
          </div>
        )}

        {/* Game Over Screen Overlay */}
        {gameOver && (
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(10,8,20,0.85)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', borderRadius: '12px', zIndex: 10 }}>
            <span style={{ fontSize: '3rem', marginBottom: '10px' }}>⚡</span>
            <h3 style={{ color: '#e74c3c', fontSize: '1.8rem', fontWeight: 800, marginBottom: '6px' }}>Hết Thời Gian!</h3>
            <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.9rem', marginBottom: '16px' }}>
              Tổng điểm của bạn: **{score}**
            </p>
            {earnedCoins !== null && (
              <span style={{ fontSize: '1.2rem', fontWeight: 800, color: '#f1c40f', marginBottom: '24px' }}>
                🪙 +{earnedCoins} xu thưởng!
              </span>
            )}
            
            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={initGame} className="btn btn-primary">
                Chơi Lại
              </button>
              <button onClick={onClose} className="btn btn-secondary">
                Thoát
              </button>
            </div>
          </div>
        )}

      </div>

      <div style={{ textAlign: 'center', fontSize: '0.75rem', color: 'var(--color-text-muted)', fontWeight: 500 }}>
        💡 Nhấp chuột đập vào các con chuột chũi chui lên khỏi hố. 🐹 Thường = +1đ | 🐹👑 Vàng = +3đ | 💣 Bom = -2đ!
      </div>
    </div>
  );
};
