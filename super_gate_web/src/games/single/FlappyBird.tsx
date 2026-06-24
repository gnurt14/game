import React, { useState, useEffect, useRef } from 'react';
import { Play } from 'lucide-react';
import { CoinService } from '../../services/coinService';
import { ContinueModal } from '../../components/ContinueModal';

interface FlappyBirdProps {
  onClose: () => void;
}

type Pipe = {
  x: number;
  topHeight: number;
  bottomHeight: number;
  passed: boolean;
};

export const FlappyBird: React.FC<FlappyBirdProps> = ({ onClose }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const [score, setScore] = useState<number>(0);
  const [isStarted, setIsStarted] = useState<boolean>(false);
  const [gameOver, setGameOver] = useState<boolean>(false);
  const [earnedCoins, setEarnedCoins] = useState<number | null>(null);

  // Countdown overlay state
  const [countdown, setCountdown] = useState<3 | 2 | 1 | 0 | null>(null);
  const countdownRef = useRef<3 | 2 | 1 | 0 | null>(null);
  const countdownTimerRef = useRef<any>(null);

  // Continue
  const [showContinue, setShowContinue] = useState<boolean>(false);
  const [continueUsed, setContinueUsed] = useState<boolean>(false);

  // Slow-mo
  const [slowMo, setSlowMo] = useState<boolean>(false);
  const slowMoTimerRef = useRef<number>(0);
  const [balance, setBalance] = useState<number>(CoinService.getData().balance);

  // Use refs for animation loop
  const birdYRef = useRef<number>(150);
  const birdVelocityRef = useRef<number>(0);
  const pipesRef = useRef<Pipe[]>([]);
  const frameIdRef = useRef<number | null>(null);
  const scoreRef = useRef<number>(0);
  const isStartedRef = useRef<boolean>(false);
  const gameOverRef = useRef<boolean>(false);
  const frameCountRef = useRef<number>(0);

  // Constants
  const GRAVITY = 0.45;
  const JUMP_STRENGTH = -7.5;
  const PIPE_SPEED = 2.0;
  const PIPE_SPAWN_INTERVAL = 110;
  const PIPE_GAP = 120;
  const BIRD_X = 60;
  const BIRD_RADIUS = 12;
  const SLOW_MO_FACTOR = 0.4;
  const SLOW_MO_DURATION = 180; // frames @60fps ~= 3s
  const SLOW_MO_COST = 30;

  const initGame = () => {
    birdYRef.current = 150;
    birdVelocityRef.current = 0;
    pipesRef.current = [];
    scoreRef.current = 0;
    frameCountRef.current = 0;
    slowMoTimerRef.current = 0;
    setSlowMo(false);
    setScore(0);
    setGameOver(false);
    setIsStarted(false);
    setEarnedCoins(null);
    setCountdown(null);
    countdownRef.current = null;
    setShowContinue(false);
    setContinueUsed(false);
    isStartedRef.current = false;
    gameOverRef.current = false;
    if (countdownTimerRef.current) clearTimeout(countdownTimerRef.current);

    setTimeout(draw, 50);
  };

  const beginCountdownThenStart = () => {
    // Initialize game state to start
    isStartedRef.current = true;
    setIsStarted(true);
    // Spawn first pipe
    spawnPipe(380);

    // Setup countdown 3 -> 2 -> 1 -> GO! (0)
    countdownRef.current = 3;
    setCountdown(3);

    const step = (next: 3 | 2 | 1 | 0 | null) => {
      countdownRef.current = next;
      setCountdown(next);
      if (next === null) return;
      if (next === 0) {
        // Show "GO!" briefly, then unfreeze
        countdownTimerRef.current = setTimeout(() => {
          step(null);
        }, 500);
        return;
      }
      countdownTimerRef.current = setTimeout(() => {
        const prev = countdownRef.current;
        if (prev === 3) step(2);
        else if (prev === 2) step(1);
        else if (prev === 1) step(0);
      }, 700);
    };
    step(3);

    // Start game loop (it will skip physics while countdown !== null)
    if (frameIdRef.current) cancelAnimationFrame(frameIdRef.current);
    frameIdRef.current = requestAnimationFrame(gameLoop);
  };

  const startGame = () => {
    beginCountdownThenStart();
  };

  const jump = () => {
    if (gameOverRef.current) return;
    if (!isStartedRef.current) {
      startGame();
      return;
    }
    // Don't allow jump while frozen on countdown
    if (countdownRef.current !== null) return;
    birdVelocityRef.current = JUMP_STRENGTH;
  };

  const spawnPipe = (startX: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const minHeight = 40;
    const maxHeight = canvas.height - PIPE_GAP - minHeight;
    const topHeight = minHeight + Math.floor(Math.random() * (maxHeight - minHeight));

    pipesRef.current.push({
      x: startX,
      topHeight,
      bottomHeight: canvas.height - topHeight - PIPE_GAP,
      passed: false,
    });
  };

  const gameLoop = () => {
    if (!isStartedRef.current || gameOverRef.current) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    // If countdown is active, just repaint without physics or pipe motion
    if (countdownRef.current !== null) {
      draw();
      frameIdRef.current = requestAnimationFrame(gameLoop);
      return;
    }

    frameCountRef.current++;

    // Effective speed factors when in slow-mo
    const factor = slowMoTimerRef.current > 0 ? SLOW_MO_FACTOR : 1;

    // 1. Update Bird physics
    birdVelocityRef.current += GRAVITY * factor;
    birdYRef.current += birdVelocityRef.current * factor;

    // Ceiling / Ground collision
    if (birdYRef.current + BIRD_RADIUS >= canvas.height) {
      birdYRef.current = canvas.height - BIRD_RADIUS;
      handleGameOver();
      return;
    }
    if (birdYRef.current - BIRD_RADIUS <= 0) {
      birdYRef.current = BIRD_RADIUS;
      birdVelocityRef.current = 0;
    }

    // 2. Update Pipes
    if (frameCountRef.current % PIPE_SPAWN_INTERVAL === 0) {
      spawnPipe(canvas.width);
    }

    const nextPipes: Pipe[] = [];
    for (let i = 0; i < pipesRef.current.length; i++) {
      const p = pipesRef.current[i];
      p.x -= PIPE_SPEED * factor;

      // Check collision
      const hitTopPipe = BIRD_X + BIRD_RADIUS > p.x && BIRD_X - BIRD_RADIUS < p.x + 50 && birdYRef.current - BIRD_RADIUS < p.topHeight;
      const hitBottomPipe = BIRD_X + BIRD_RADIUS > p.x && BIRD_X - BIRD_RADIUS < p.x + 50 && birdYRef.current + BIRD_RADIUS > canvas.height - p.bottomHeight;

      if (hitTopPipe || hitBottomPipe) {
        handleGameOver();
        return;
      }

      if (!p.passed && p.x + 25 < BIRD_X) {
        p.passed = true;
        scoreRef.current += 1;
        setScore(scoreRef.current);
      }

      if (p.x + 50 > 0) {
        nextPipes.push(p);
      }
    }
    pipesRef.current = nextPipes;

    // Tick slow-mo timer
    if (slowMoTimerRef.current > 0) {
      slowMoTimerRef.current -= 1;
      if (slowMoTimerRef.current <= 0) {
        slowMoTimerRef.current = 0;
        setSlowMo(false);
      }
    }

    draw();

    frameIdRef.current = requestAnimationFrame(gameLoop);
  };

  const handleGameOver = async () => {
    if (frameIdRef.current) cancelAnimationFrame(frameIdRef.current);

    if (!continueUsed) {
      // Pause loop, offer continue
      isStartedRef.current = false;
      setIsStarted(false);
      setShowContinue(true);
      return;
    }

    finalizeGameOver();
  };

  const finalizeGameOver = async () => {
    gameOverRef.current = true;
    setGameOver(true);
    isStartedRef.current = false;
    setIsStarted(false);

    const coins = await CoinService.reportGameScore('flappy', { won: false, score: scoreRef.current });
    setEarnedCoins(coins);
    await CoinService.recordGamePlayed('Flappy Bird');
  };

  const handleContinueAccept = () => {
    // Coin already spent by ContinueModal
    setShowContinue(false);
    setContinueUsed(true);

    // Reset bird position to middle, velocity=0, KEEP pipes as-is
    const canvas = canvasRef.current;
    birdYRef.current = canvas ? canvas.height / 2 : 150;
    birdVelocityRef.current = 0;
    gameOverRef.current = false;

    // Resume with countdown 3-2-1
    isStartedRef.current = true;
    setIsStarted(true);
    countdownRef.current = 3;
    setCountdown(3);

    const step = (next: 3 | 2 | 1 | 0 | null) => {
      countdownRef.current = next;
      setCountdown(next);
      if (next === null) return;
      if (next === 0) {
        countdownTimerRef.current = setTimeout(() => step(null), 500);
        return;
      }
      countdownTimerRef.current = setTimeout(() => {
        const prev = countdownRef.current;
        if (prev === 3) step(2);
        else if (prev === 2) step(1);
        else if (prev === 1) step(0);
      }, 700);
    };
    step(3);

    if (frameIdRef.current) cancelAnimationFrame(frameIdRef.current);
    frameIdRef.current = requestAnimationFrame(gameLoop);
  };

  const handleContinueSkip = () => {
    setShowContinue(false);
    setContinueUsed(true);
    finalizeGameOver();
  };

  const handleSlowMoClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (slowMoTimerRef.current > 0) return;
    if (!isStartedRef.current || gameOverRef.current) return;
    if (countdownRef.current !== null) return;
    if (balance < SLOW_MO_COST) return;

    const ok = await CoinService.spendCoins(SLOW_MO_COST);
    if (!ok) return;

    slowMoTimerRef.current = SLOW_MO_DURATION;
    setSlowMo(true);
  };

  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;

    // 1. Sky background
    const skyGrad = ctx.createLinearGradient(0, 0, 0, height);
    skyGrad.addColorStop(0, '#100c25');
    skyGrad.addColorStop(1, '#1b143c');
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, width, height);

    ctx.fillStyle = 'rgba(255,255,255,0.05)';
    ctx.fillRect(50, 40, 2, 2);
    ctx.fillRect(150, 120, 2, 2);
    ctx.fillRect(280, 80, 2, 2);
    ctx.fillRect(90, 220, 2, 2);

    // Slow-mo blue tint
    if (slowMoTimerRef.current > 0) {
      ctx.fillStyle = 'rgba(60, 140, 255, 0.12)';
      ctx.fillRect(0, 0, width, height);
    }

    // 2. Pipes
    pipesRef.current.forEach((p) => {
      ctx.fillStyle = 'rgba(124, 111, 255, 0.25)';
      ctx.strokeStyle = '#7c6fff';
      ctx.lineWidth = 2;

      ctx.shadowBlur = 8;
      ctx.shadowColor = '#7c6fff';

      ctx.beginPath();
      ctx.roundRect(p.x, 0, 48, p.topHeight, [0, 0, 6, 6]);
      ctx.fill();
      ctx.stroke();

      ctx.beginPath();
      ctx.roundRect(p.x, height - p.bottomHeight, 48, p.bottomHeight, [6, 6, 0, 0]);
      ctx.fill();
      ctx.stroke();
    });

    ctx.shadowBlur = 0;

    // 3. Bird
    const birdY = birdYRef.current;
    const velocity = birdVelocityRef.current;
    let angle = Math.min(Math.PI / 4, Math.max(-Math.PI / 6, velocity * 0.08));

    ctx.save();
    ctx.translate(BIRD_X, birdY);
    ctx.rotate(angle);

    ctx.shadowBlur = 10;
    ctx.shadowColor = '#f1c40f';
    ctx.fillStyle = '#f1c40f';
    ctx.beginPath();
    ctx.arc(0, 0, BIRD_RADIUS, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#e67e22';
    ctx.beginPath();
    ctx.moveTo(BIRD_RADIUS - 2, -4);
    ctx.lineTo(BIRD_RADIUS + 6, 0);
    ctx.lineTo(BIRD_RADIUS - 2, 4);
    ctx.fill();

    ctx.fillStyle = 'white';
    ctx.beginPath();
    ctx.arc(3, -3, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'black';
    ctx.beginPath();
    ctx.arc(4, -3, 1.2, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
    ctx.shadowBlur = 0;
  };

  // Click & space key listeners
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' || e.key === ' ') {
        e.preventDefault();
        jump();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      if (frameIdRef.current) cancelAnimationFrame(frameIdRef.current);
      if (countdownTimerRef.current) clearTimeout(countdownTimerRef.current);
    };
  }, []);

  useEffect(() => {
    initGame();
  }, []);

  // Subscribe to balance updates
  useEffect(() => {
    const unsub = CoinService.subscribe((d) => setBalance(d.balance));
    return () => unsub();
  }, []);

  const slowMoActive = slowMo;
  const canBuySlowMo = isStarted && !gameOver && !showContinue && countdown === null && !slowMoActive && balance >= SLOW_MO_COST;

  return (
    <div className="glass fullscreen-game-container">
      <style>{`
        @keyframes fb-countdown-pop {
          0% { transform: translate(-50%, -50%) scale(0.4); opacity: 0; }
          30% { transform: translate(-50%, -50%) scale(1.3); opacity: 1; }
          70% { transform: translate(-50%, -50%) scale(1); opacity: 1; }
          100% { transform: translate(-50%, -50%) scale(1.4); opacity: 0; }
        }
      `}</style>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: 'var(--border-glass)', paddingBottom: '14px', marginBottom: '20px' }}>
        <div>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 800 }}>Chú Chim Flappy (Flappy Bird)</h2>
          <span style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)' }}>
            Điểm số: <strong style={{ color: 'var(--primary-color)', fontSize: '1rem' }}>{score}</strong>
            {slowMoActive && (
              <span style={{ color: '#3da9fc', fontWeight: 800, marginLeft: 8 }}>
                🐌 SLOW-MO
              </span>
            )}
          </span>
        </div>
        <button onClick={onClose} className="btn btn-danger" style={{ fontSize: '0.85rem' }}>
          Thoát
        </button>
      </div>

      {/* Canvas Board Area */}
      <div
        onClick={jump}
        style={{
          flexGrow: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
          cursor: 'pointer',
        }}
      >
        <canvas
          ref={canvasRef}
          width={360}
          height={380}
          style={{
            background: '#100c25',
            borderRadius: '12px',
            border: '2px solid rgba(255, 255, 255, 0.1)',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
          }}
        />

        {/* Slow-mo powerup button (top-right corner over canvas) */}
        {isStarted && !gameOver && (
          <button
            onClick={handleSlowMoClick}
            disabled={!canBuySlowMo}
            style={{
              position: 'absolute',
              top: 8,
              right: 8,
              padding: '8px 12px',
              fontSize: '0.78rem',
              fontWeight: 800,
              borderRadius: 8,
              border: '1px solid rgba(61, 169, 252, 0.5)',
              background: canBuySlowMo
                ? 'linear-gradient(135deg, rgba(61,169,252,0.85) 0%, rgba(124,111,255,0.85) 100%)'
                : 'rgba(255,255,255,0.06)',
              color: canBuySlowMo ? 'white' : 'rgba(255,255,255,0.4)',
              cursor: canBuySlowMo ? 'pointer' : 'not-allowed',
              zIndex: 15,
              boxShadow: canBuySlowMo ? '0 4px 12px rgba(61,169,252,0.3)' : 'none',
            }}
          >
            🐌 Slow-mo ({SLOW_MO_COST} xu)
          </button>
        )}

        {/* Countdown overlay */}
        {countdown !== null && (
          <div
            key={countdown}
            style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              fontSize: '4rem',
              fontWeight: 900,
              color: '#f1c40f',
              textShadow: '0 0 24px rgba(241,196,15,0.8), 0 4px 12px rgba(0,0,0,0.6)',
              zIndex: 12,
              pointerEvents: 'none',
              animation: 'fb-countdown-pop 0.7s ease-out forwards',
            }}
          >
            {countdown === 0 ? 'GO!' : countdown}
          </div>
        )}

        {/* Tap/Click to Start Overlay */}
        {!isStarted && !gameOver && !showContinue && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', zIndex: 10, background: 'rgba(10,8,20,0.55)', pointerEvents: 'none' }}>
            <span style={{ fontSize: '3rem', marginBottom: '14px', animation: 'bounce 1s infinite' }}>🐦</span>
            <button className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Play size={16} fill="white" /> Click để Bay Lên
            </button>
          </div>
        )}

        {/* Game Over Screen Overlay */}
        {gameOver && (
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(10,8,20,0.85)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', borderRadius: '12px', zIndex: 10 }}>
            <span style={{ fontSize: '3rem', marginBottom: '10px' }}>💀</span>
            <h3 style={{ color: '#e74c3c', fontSize: '1.8rem', fontWeight: 800, marginBottom: '6px' }}>Va Chạm Game Over!</h3>
            <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.9rem', marginBottom: '16px' }}>
              Điểm số của bạn: **{score}**
            </p>
            {earnedCoins !== null && (
              <span style={{ fontSize: '1.2rem', fontWeight: 800, color: '#f1c40f', marginBottom: '24px' }}>
                🪙 +{earnedCoins} xu thưởng!
              </span>
            )}

            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  initGame();
                }}
                className="btn btn-primary"
              >
                Chơi Lại
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onClose();
                }}
                className="btn btn-secondary"
              >
                Thoát
              </button>
            </div>
          </div>
        )}
      </div>

      <div style={{ textAlign: 'center', fontSize: '0.75rem', color: 'var(--color-text-muted)', fontWeight: 500 }}>
        💡 Nhấn phím SPACE hoặc nhấp chuột vào vùng Canvas để vỗ cánh bay lên tránh các cột chướng ngại vật màu tím.
      </div>

      {/* Continue Modal */}
      <ContinueModal
        isOpen={showContinue}
        cost={50}
        title="VA CHẠM!"
        subtitle="Tiếp tục từ vị trí giữa màn?"
        onContinue={handleContinueAccept}
        onSkip={handleContinueSkip}
      />
    </div>
  );
};
