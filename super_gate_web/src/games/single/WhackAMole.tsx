import React, { useState, useEffect, useRef } from 'react';
import { Play, Clock } from 'lucide-react';
import { CoinService } from '../../services/coinService';
import { ContinueModal } from '../../components/ContinueModal';
import confetti from 'canvas-confetti';

interface WhackAMoleProps {
  onClose: () => void;
}

type Hole = {
  id: number;
  active: boolean;
  type: 'normal' | 'golden' | 'bomb'; // normal mole, golden mole (x2 score), bomb (minus score)
  hit?: boolean; // squish animation flag
};

type Particle = {
  id: number;
  x: number; // px relative to grid container
  y: number;
  emoji: string;
  angle: number;
  distance: number;
};

type MissMark = {
  id: number;
  holeIndex: number;
};

type ComboFlash = {
  id: number;
  combo: number;
};

const PARTICLE_EMOJIS = ['✨', '💥', '⭐'];

export const WhackAMole: React.FC<WhackAMoleProps> = ({ onClose }) => {
  const [holes, setHoles] = useState<Hole[]>(
    Array.from({ length: 9 }, (_, idx) => ({ id: idx, active: false, type: 'normal' }))
  );
  const [score, setScore] = useState<number>(0);
  const [timeLeft, setTimeLeft] = useState<number>(30);
  const [isStarted, setIsStarted] = useState<boolean>(false);
  const [gameOver, setGameOver] = useState<boolean>(false);
  const [earnedCoins, setEarnedCoins] = useState<number | null>(null);

  // New effect states
  const [particles, setParticles] = useState<Particle[]>([]);
  const [missMarks, setMissMarks] = useState<MissMark[]>([]);
  const [comboFlash, setComboFlash] = useState<ComboFlash | null>(null);
  const [shaking, setShaking] = useState<boolean>(false);
  const [combo, setCombo] = useState<number>(0);
  const [showContinue, setShowContinue] = useState<boolean>(false);
  const [continueUsed, setContinueUsed] = useState<boolean>(false);

  const scoreRef = useRef<number>(0);
  const comboRef = useRef<number>(0);
  const timerIntervalRef = useRef<any>(null);
  const moleIntervalRef = useRef<any>(null);
  const particleIdRef = useRef<number>(0);
  const missIdRef = useRef<number>(0);
  const comboFlashIdRef = useRef<number>(0);
  const lastComboFlashRef = useRef<number>(0);
  const gridContainerRef = useRef<HTMLDivElement | null>(null);
  const holeRefs = useRef<Array<HTMLDivElement | null>>([]);

  const initGame = () => {
    scoreRef.current = 0;
    comboRef.current = 0;
    lastComboFlashRef.current = 0;
    setScore(0);
    setCombo(0);
    setTimeLeft(30);
    setGameOver(false);
    setIsStarted(false);
    setEarnedCoins(null);
    setHoles(Array.from({ length: 9 }, (_, idx) => ({ id: idx, active: false, type: 'normal' })));
    setParticles([]);
    setMissMarks([]);
    setComboFlash(null);
    setShaking(false);
    setShowContinue(false);
    setContinueUsed(false);

    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    if (moleIntervalRef.current) clearTimeout(moleIntervalRef.current);
  };

  const startGame = () => {
    setIsStarted(true);

    timerIntervalRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          handleGameOver();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    spawnMolesLoop();
  };

  const spawnMolesLoop = () => {
    const currentSpeed = Math.max(450, 900 - scoreRef.current * 8);

    moleIntervalRef.current = setTimeout(() => {
      popRandomMole();
      spawnMolesLoop();
    }, currentSpeed);
  };

  const popRandomMole = () => {
    setHoles((prevHoles) => {
      const inactiveIndices = prevHoles
        .map((h, idx) => (!h.active ? idx : null))
        .filter((idx): idx is number => idx !== null);

      if (inactiveIndices.length === 0) return prevHoles;

      const randomIndex = inactiveIndices[Math.floor(Math.random() * inactiveIndices.length)];

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
        type,
        hit: false,
      };

      const hideDuration = type === 'golden' ? 700 : type === 'bomb' ? 1200 : 1000;
      setTimeout(() => {
        hideMoleAuto(randomIndex);
      }, hideDuration);

      return nextHoles;
    });
  };

  // Mole hidden automatically (expired without hit) -> spawn miss mark + reset combo
  const hideMoleAuto = (idx: number) => {
    setHoles((prevHoles) => {
      const nextHoles = [...prevHoles];
      const target = nextHoles[idx];
      if (target && target.active && !target.hit) {
        // Only show miss for normal/golden (bombs disappearing is good)
        if (target.type !== 'bomb') {
          spawnMissMark(idx);
          // Reset combo on miss
          comboRef.current = 0;
          setCombo(0);
        }
        nextHoles[idx] = { id: idx, active: false, type: 'normal' };
      }
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

  const spawnParticlesAt = (holeIndex: number) => {
    const grid = gridContainerRef.current;
    const cell = holeRefs.current[holeIndex];
    if (!grid || !cell) return;

    const gridRect = grid.getBoundingClientRect();
    const cellRect = cell.getBoundingClientRect();
    const cx = cellRect.left - gridRect.left + cellRect.width / 2;
    const cy = cellRect.top - gridRect.top + cellRect.height / 2;

    const count = 6 + Math.floor(Math.random() * 5); // 6-10
    const newParticles: Particle[] = [];
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.4;
      const distance = 40 + Math.random() * 30;
      const id = particleIdRef.current++;
      newParticles.push({
        id,
        x: cx,
        y: cy,
        emoji: PARTICLE_EMOJIS[Math.floor(Math.random() * PARTICLE_EMOJIS.length)],
        angle,
        distance,
      });
    }
    setParticles((prev) => [...prev, ...newParticles]);

    const idsToRemove = newParticles.map((p) => p.id);
    setTimeout(() => {
      setParticles((prev) => prev.filter((p) => !idsToRemove.includes(p.id)));
    }, 650);
  };

  const spawnMissMark = (holeIndex: number) => {
    const id = missIdRef.current++;
    setMissMarks((prev) => [...prev, { id, holeIndex }]);
    setTimeout(() => {
      setMissMarks((prev) => prev.filter((m) => m.id !== id));
    }, 450);
  };

  const triggerScreenShake = () => {
    setShaking(true);
    setTimeout(() => setShaking(false), 400);
  };

  const triggerComboFlash = (comboValue: number) => {
    const id = comboFlashIdRef.current++;
    setComboFlash({ id, combo: comboValue });
    setTimeout(() => {
      setComboFlash((prev) => (prev && prev.id === id ? null : prev));
    }, 550);
  };

  const handleWhack = (idx: number, e: React.MouseEvent) => {
    e.stopPropagation();
    const targetHole = holes[idx];
    if (!targetHole || !targetHole.active) return;

    // Flag as hit for squish animation
    setHoles((prev) => {
      const next = [...prev];
      if (next[idx]) {
        next[idx] = { ...next[idx], hit: true };
      }
      return next;
    });

    let scoreDelta = 0;
    if (targetHole.type === 'normal') {
      scoreDelta = 1;
    } else if (targetHole.type === 'golden') {
      scoreDelta = 3;
    } else if (targetHole.type === 'bomb') {
      scoreDelta = -2;
    }

    scoreRef.current = Math.max(0, scoreRef.current + scoreDelta);
    setScore(scoreRef.current);

    if (targetHole.type === 'bomb') {
      // Bomb: shake screen + reset combo, no particles
      triggerScreenShake();
      comboRef.current = 0;
      setCombo(0);
    } else {
      // Mole or golden: particles + combo
      spawnParticlesAt(idx);
      comboRef.current += 1;
      setCombo(comboRef.current);

      // Trigger combo flash at thresholds 3, 5, 10 (and re-trigger as combo grows past)
      const c = comboRef.current;
      if ((c === 3 || c === 5 || c === 10) && c !== lastComboFlashRef.current) {
        lastComboFlashRef.current = c;
        triggerComboFlash(c);
      }
    }

    // Squish: hide after a short delay so the animation can play
    setTimeout(() => {
      hideMole(idx);
    }, 100);
  };

  const handleGameOver = async () => {
    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    if (moleIntervalRef.current) clearTimeout(moleIntervalRef.current);

    setIsStarted(false);

    // Offer continue first (only once per run)
    if (!continueUsed) {
      setShowContinue(true);
      return;
    }

    finalizeGameOver();
  };

  const finalizeGameOver = async () => {
    setGameOver(true);

    if (scoreRef.current >= 20) {
      confetti({
        particleCount: 80,
        spread: 60,
        origin: { y: 0.6 },
      });
    }

    const coins = await CoinService.reportGameScore('whack_mole', { won: false, score: scoreRef.current });
    setEarnedCoins(coins);
    await CoinService.recordGamePlayed('Whack-a-Mole');
  };

  const handleContinueAccept = () => {
    // Coin already spent by ContinueModal
    setShowContinue(false);
    setContinueUsed(true);
    // Add 15s and restart loops
    setTimeLeft((t) => t + 15);
    setGameOver(false);
    setIsStarted(true);

    // Restart timer
    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    timerIntervalRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          handleGameOver();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    // Restart mole loop
    if (moleIntervalRef.current) clearTimeout(moleIntervalRef.current);
    spawnMolesLoop();
  };

  const handleContinueSkip = () => {
    setShowContinue(false);
    setContinueUsed(true);
    finalizeGameOver();
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
      {/* Inline keyframes for effects */}
      <style>{`
        @keyframes wam-screen-shake {
          0% { transform: translate(0, 0); }
          15% { transform: translate(-4px, 3px); }
          30% { transform: translate(4px, -3px); }
          45% { transform: translate(-3px, -4px); }
          60% { transform: translate(3px, 4px); }
          75% { transform: translate(-4px, 2px); }
          90% { transform: translate(2px, -2px); }
          100% { transform: translate(0, 0); }
        }
        .wam-screen-shake { animation: wam-screen-shake 0.4s linear; }

        @keyframes wam-particle-fly {
          0% { transform: translate(-50%, -50%) rotate(0deg) scale(1); opacity: 1; }
          100% { transform: translate(var(--tx), var(--ty)) rotate(var(--rot)) scale(0.3); opacity: 0; }
        }

        @keyframes wam-miss-mark {
          0% { transform: scale(0.4) rotate(-30deg); opacity: 0; }
          30% { transform: scale(1.2) rotate(10deg); opacity: 1; }
          70% { transform: scale(1) rotate(-5deg); opacity: 0.9; }
          100% { transform: scale(0.8) rotate(0deg); opacity: 0; }
        }

        @keyframes wam-combo-flash {
          0% { transform: translate(-50%, -50%) scale(0); opacity: 0; }
          30% { transform: translate(-50%, -50%) scale(1.3); opacity: 1; }
          60% { transform: translate(-50%, -50%) scale(1); opacity: 1; }
          100% { transform: translate(-50%, -50%) scale(1.1); opacity: 0; }
        }

        @keyframes wam-squish {
          0% { transform: scaleY(1); }
          40% { transform: scaleY(0.3); }
          100% { transform: scaleY(1); }
        }
      `}</style>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: 'var(--border-glass)', paddingBottom: '14px', marginBottom: '20px' }}>
        <div>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 800 }}>Đập Chuột Chũi (Whack-a-Mole)</h2>
          <span style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
            Điểm số: <strong style={{ color: 'var(--primary-color)', fontSize: '1rem' }}>{score}</strong>
            | <Clock size={14} /> Thời gian: <strong style={{ color: timeLeft < 10 ? '#e74c3c' : 'white' }}>{timeLeft}s</strong>
            {combo >= 2 && (
              <span style={{ color: '#f1c40f', fontWeight: 800 }}>
                | 🔥 Combo x{combo}
              </span>
            )}
          </span>
        </div>
        <button onClick={onClose} className="btn btn-danger" style={{ fontSize: '0.85rem' }}>
          Thoát
        </button>
      </div>

      {/* Play Area */}
      <div
        className={shaking ? 'wam-screen-shake' : ''}
        style={{ flexGrow: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', position: 'relative' }}
      >
        {/* 3x3 Mole Holes Board */}
        <div
          ref={gridContainerRef}
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
            position: 'relative',
          }}
        >
          {holes.map((hole) => {
            const hasMole = hole.active;
            const isGolden = hole.type === 'golden';
            const isBomb = hole.type === 'bomb';
            const isHit = hole.hit === true;

            return (
              <div
                key={hole.id}
                ref={(el) => { holeRefs.current[hole.id] = el; }}
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
                  animation: isHit ? 'wam-squish 0.1s ease-out' : 'none',
                  transformOrigin: 'bottom center',
                }}>
                  {isBomb ? '💣' : isGolden ? '🐹👑' : '🐹'}
                </div>

                {/* Miss mark overlay */}
                {missMarks.filter((m) => m.holeIndex === hole.id).map((m) => (
                  <div
                    key={m.id}
                    style={{
                      position: 'absolute',
                      inset: 0,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '2.5rem',
                      color: '#e74c3c',
                      zIndex: 4,
                      pointerEvents: 'none',
                      animation: 'wam-miss-mark 0.4s ease-out forwards',
                      textShadow: '0 0 8px rgba(231,76,60,0.7)',
                    }}
                  >
                    ❌
                  </div>
                ))}
              </div>
            );
          })}

          {/* Particles overlay (absolute over grid) */}
          {particles.map((p) => {
            const tx = Math.cos(p.angle) * p.distance;
            const ty = Math.sin(p.angle) * p.distance;
            const rot = (Math.random() - 0.5) * 360;
            return (
              <div
                key={p.id}
                style={{
                  position: 'absolute',
                  left: p.x,
                  top: p.y,
                  pointerEvents: 'none',
                  zIndex: 20,
                  fontSize: '1.4rem',
                  // CSS vars for keyframes
                  ['--tx' as any]: `calc(-50% + ${tx}px)`,
                  ['--ty' as any]: `calc(-50% + ${ty}px)`,
                  ['--rot' as any]: `${rot}deg`,
                  animation: 'wam-particle-fly 0.6s ease-out forwards',
                  transform: 'translate(-50%, -50%)',
                }}
              >
                {p.emoji}
              </div>
            );
          })}

          {/* Combo flash overlay */}
          {comboFlash && (
            <div
              key={comboFlash.id}
              style={{
                position: 'absolute',
                left: '50%',
                top: '50%',
                pointerEvents: 'none',
                zIndex: 25,
                fontSize: '3rem',
                fontWeight: 900,
                letterSpacing: 2,
                background: 'linear-gradient(135deg, #f1c40f 0%, #e74c3c 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
                textShadow: '0 0 24px rgba(241,196,15,0.6)',
                animation: 'wam-combo-flash 0.55s ease-out forwards',
                whiteSpace: 'nowrap',
              }}
            >
              x{comboFlash.combo} COMBO!
            </div>
          )}
        </div>

        {/* Start Game overlay */}
        {!isStarted && !gameOver && !showContinue && (
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

      {/* Continue Modal */}
      <ContinueModal
        isOpen={showContinue}
        cost={50}
        title="HẾT THỜI GIAN!"
        subtitle="Tiếp tục thêm 15 giây để gỡ điểm?"
        onContinue={handleContinueAccept}
        onSkip={handleContinueSkip}
      />
    </div>
  );
};
