import React, { useState, useEffect, useRef } from 'react';
import { Play } from 'lucide-react';
import { CoinService } from '../../services/coinService';

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

  // Use refs for animation loop
  const birdYRef = useRef<number>(150);
  const birdVelocityRef = useRef<number>(0);
  const pipesRef = useRef<Pipe[]>([]);
  const frameIdRef = useRef<number | null>(null);
  const scoreRef = useRef<number>(0);
  const isStartedRef = useRef<boolean>(false);
  const gameOverRef = useRef<boolean>(false);

  // Constants
  const GRAVITY = 0.45;
  const JUMP_STRENGTH = -7.5;
  const PIPE_SPEED = 2.0;
  const PIPE_SPAWN_INTERVAL = 110; // frames
  const PIPE_GAP = 120;
  const BIRD_X = 60;
  const BIRD_RADIUS = 12;

  const initGame = () => {
    birdYRef.current = 150;
    birdVelocityRef.current = 0;
    pipesRef.current = [];
    scoreRef.current = 0;
    setScore(0);
    setGameOver(false);
    setIsStarted(false);
    setEarnedCoins(null);
    isStartedRef.current = false;
    gameOverRef.current = false;

    // Draw initial state
    setTimeout(draw, 50);
  };

  const startGame = () => {
    isStartedRef.current = true;
    setIsStarted(true);
    // Spawn first pipe
    spawnPipe(380);
    
    // Start game loop
    if (frameIdRef.current) cancelAnimationFrame(frameIdRef.current);
    frameIdRef.current = requestAnimationFrame(gameLoop);
  };

  const jump = () => {
    if (gameOverRef.current) return;
    if (!isStartedRef.current) {
      startGame();
      return;
    }
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
      passed: false
    });
  };

  let frameCount = 0;

  const gameLoop = () => {
    if (!isStartedRef.current || gameOverRef.current) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    frameCount++;

    // 1. Update Bird physics
    birdVelocityRef.current += GRAVITY;
    birdYRef.current += birdVelocityRef.current;

    // Ceiling / Ground collision
    if (birdYRef.current + BIRD_RADIUS >= canvas.height) {
      birdYRef.current = canvas.height - BIRD_RADIUS;
      handleGameOver();
      return;
    }
    if (birdYRef.current - BIRD_RADIUS <= 0) {
      birdYRef.current = BIRD_RADIUS;
      birdVelocityRef.current = 0; // stop going up
    }

    // 2. Update Pipes
    if (frameCount % PIPE_SPAWN_INTERVAL === 0) {
      spawnPipe(canvas.width);
    }

    const nextPipes: Pipe[] = [];
    for (let i = 0; i < pipesRef.current.length; i++) {
      const p = pipesRef.current[i];
      p.x -= PIPE_SPEED;

      // Check collision
      const hitTopPipe = BIRD_X + BIRD_RADIUS > p.x && BIRD_X - BIRD_RADIUS < p.x + 50 && birdYRef.current - BIRD_RADIUS < p.topHeight;
      const hitBottomPipe = BIRD_X + BIRD_RADIUS > p.x && BIRD_X - BIRD_RADIUS < p.x + 50 && birdYRef.current + BIRD_RADIUS > canvas.height - p.bottomHeight;

      if (hitTopPipe || hitBottomPipe) {
        handleGameOver();
        return;
      }

      // Check score
      if (!p.passed && p.x + 25 < BIRD_X) {
        p.passed = true;
        scoreRef.current += 1;
        setScore(scoreRef.current);
      }

      // Filter off-screen pipes
      if (p.x + 50 > 0) {
        nextPipes.push(p);
      }
    }
    pipesRef.current = nextPipes;

    // 3. Draw scene
    draw();

    // 4. Request next frame
    frameIdRef.current = requestAnimationFrame(gameLoop);
  };

  const handleGameOver = async () => {
    gameOverRef.current = true;
    setGameOver(true);
    setIsStarted(false);
    if (frameIdRef.current) cancelAnimationFrame(frameIdRef.current);

    // Award coins based on score
    const coins = await CoinService.reportGameScore('flappy', { won: false, score: scoreRef.current });
    setEarnedCoins(coins);
    await CoinService.recordGamePlayed('Flappy Bird');
  };

  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;

    // 1. Draw sky background (deep purple gradient)
    const skyGrad = ctx.createLinearGradient(0, 0, 0, height);
    skyGrad.addColorStop(0, '#100c25');
    skyGrad.addColorStop(1, '#1b143c');
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, width, height);

    // Draw background grid or stars
    ctx.fillStyle = 'rgba(255,255,255,0.05)';
    ctx.fillRect(50, 40, 2, 2);
    ctx.fillRect(150, 120, 2, 2);
    ctx.fillRect(280, 80, 2, 2);
    ctx.fillRect(90, 220, 2, 2);

    // 2. Draw Pipes (Glowing neon violet/blue blocks)
    pipesRef.current.forEach(p => {
      // Top Pipe
      ctx.fillStyle = 'rgba(124, 111, 255, 0.25)';
      ctx.strokeStyle = '#7c6fff';
      ctx.lineWidth = 2;
      
      // Shadow for pipes glow
      ctx.shadowBlur = 8;
      ctx.shadowColor = '#7c6fff';
      
      ctx.beginPath();
      ctx.roundRect(p.x, 0, 48, p.topHeight, [0, 0, 6, 6]);
      ctx.fill();
      ctx.stroke();

      // Bottom Pipe
      ctx.beginPath();
      ctx.roundRect(p.x, height - p.bottomHeight, 48, p.bottomHeight, [6, 6, 0, 0]);
      ctx.fill();
      ctx.stroke();
    });

    // Reset shadow
    ctx.shadowBlur = 0;

    // 3. Draw Bird (tilt based on velocity)
    const birdY = birdYRef.current;
    const velocity = birdVelocityRef.current;
    let angle = Math.min(Math.PI / 4, Math.max(-Math.PI / 6, velocity * 0.08));

    ctx.save();
    ctx.translate(BIRD_X, birdY);
    ctx.rotate(angle);

    // Draw body (Gold glowing sphere)
    ctx.shadowBlur = 10;
    ctx.shadowColor = '#f1c40f';
    ctx.fillStyle = '#f1c40f';
    ctx.beginPath();
    ctx.arc(0, 0, BIRD_RADIUS, 0, Math.PI * 2);
    ctx.fill();

    // Draw beak
    ctx.fillStyle = '#e67e22';
    ctx.beginPath();
    ctx.moveTo(BIRD_RADIUS - 2, -4);
    ctx.lineTo(BIRD_RADIUS + 6, 0);
    ctx.lineTo(BIRD_RADIUS - 2, 4);
    ctx.fill();

    // Draw eye
    ctx.fillStyle = 'white';
    ctx.beginPath();
    ctx.arc(3, -3, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'black';
    ctx.beginPath();
    ctx.arc(4, -3, 1.2, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
    ctx.shadowBlur = 0; // reset
  };

  // Click & space key listeners for jump
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
    };
  }, []);

  useEffect(() => {
    initGame();
  }, []);

  return (
    <div className="glass fullscreen-game-container">
      
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: 'var(--border-glass)', paddingBottom: '14px', marginBottom: '20px' }}>
        <div>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 800 }}>Chú Chim Flappy (Flappy Bird)</h2>
          <span style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)' }}>
            Điểm số: <strong style={{ color: 'var(--primary-color)', fontSize: '1rem' }}>{score}</strong>
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
          cursor: 'pointer' 
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

        {/* Tap/Click to Start Overlay */}
        {!isStarted && !gameOver && (
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
                  e.stopPropagation(); // Avoid triggering jump on canvas click
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
    </div>
  );
};
