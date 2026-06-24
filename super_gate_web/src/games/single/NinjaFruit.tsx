import React, { useState, useEffect, useRef } from 'react';
import { CoinService } from '../../services/coinService';
import confetti from 'canvas-confetti';

interface NinjaFruitProps {
  onClose: () => void;
}

type Fruit = {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  color: string;
  emoji: string;
  isSliced: boolean;
  sliceAngle: number;
  sliceOffset: number;
  type: 'fruit' | 'bomb';
  special?: 'frenzy' | 'freeze';
};

type SlicePoint = {
  x: number;
  y: number;
  age: number;
};

type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  radius: number;
  alpha: number;
};

export const NinjaFruit: React.FC<NinjaFruitProps> = ({ onClose }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const [score, setScore] = useState<number>(0);
  const [lives, setLives] = useState<number>(3);
  const [gameMode, setGameMode] = useState<'classic' | 'zen' | null>(null);
  const [timeLeft, setTimeLeft] = useState<number>(30);
  const [isStarted, setIsStarted] = useState<boolean>(false);
  const [gameOver, setGameOver] = useState<boolean>(false);
  const [earnedCoins, setEarnedCoins] = useState<number | null>(null);

  // Refs for loop
  const scoreRef = useRef<number>(0);
  const livesRef = useRef<number>(3);
  const timeLeftRef = useRef<number>(30);
  
  const fruitsRef = useRef<Fruit[]>([]);
  const particlesRef = useRef<Particle[]>([]);
  const swipePointsRef = useRef<SlicePoint[]>([]);
  
  const isMouseDownRef = useRef<boolean>(false);
  const frameIdRef = useRef<number | null>(null);
  const isStartedRef = useRef<boolean>(false);
  const gameOverRef = useRef<boolean>(false);
  const timerIntervalRef = useRef<any>(null);

  // Special powerup timers in frames (60fps)
  const frenzyTimerRef = useRef<number>(0);
  const freezeTimerRef = useRef<number>(0);

  const canvasWidth = 440;
  const canvasHeight = 360;
  const gravity = 0.12;

  const standardEmojis = ['🍉', '🍎', '🍍', '🥝'];
  const standardColors = ['#e74c3c', '#ff7675', '#f39c12', '#2ecc71'];

  const initGame = () => {
    scoreRef.current = 0;
    livesRef.current = 3;
    timeLeftRef.current = 30;
    fruitsRef.current = [];
    particlesRef.current = [];
    swipePointsRef.current = [];
    frenzyTimerRef.current = 0;
    freezeTimerRef.current = 0;

    setScore(0);
    setLives(3);
    setTimeLeft(30);
    setGameMode(null);
    setGameOver(false);
    setIsStarted(false);
    setEarnedCoins(null);

    isStartedRef.current = false;
    gameOverRef.current = false;

    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }

    setTimeout(draw, 50);
  };

  const chooseModeAndStart = (mode: 'classic' | 'zen') => {
    setGameMode(mode);
    isStartedRef.current = true;
    setIsStarted(true);

    if (mode === 'zen') {
      timeLeftRef.current = 30;
      setTimeLeft(30);
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = setInterval(() => {
        timeLeftRef.current -= 1;
        setTimeLeft(timeLeftRef.current);
        if (timeLeftRef.current <= 0) {
          handleGameOver();
        }
      }, 1000);
    }

    if (frameIdRef.current) cancelAnimationFrame(frameIdRef.current);
    frameIdRef.current = requestAnimationFrame(gameLoop);
  };

  let frameCount = 0;

  const gameLoop = () => {
    if (!isStartedRef.current || gameOverRef.current) return;

    frameCount++;
    updatePhysics();
    draw();

    frameIdRef.current = requestAnimationFrame(gameLoop);
  };

  const updatePhysics = () => {
    // Decrement powerup timers
    if (frenzyTimerRef.current > 0) frenzyTimerRef.current--;
    if (freezeTimerRef.current > 0) freezeTimerRef.current--;

    // 1. Spawn fruits/bombs at random interval
    const isFrenzy = frenzyTimerRef.current > 0;
    const isFrozen = freezeTimerRef.current > 0;
    
    const spawnRate = isFrenzy ? 8 : 60;
    const currentGravity = isFrozen ? gravity * 0.3 : gravity;

    if (frameCount % spawnRate === 0) {
      const spawnCount = isFrenzy 
        ? 2 
        : gameMode === 'zen' 
          ? Math.floor(Math.random() * 3) + 1 
          : Math.floor(Math.random() * 2) + 1;

      for (let i = 0; i < spawnCount; i++) {
        spawnFruit();
      }
    }

    // 2. Move Fruits
    const activeFruits: Fruit[] = [];
    fruitsRef.current.forEach((f) => {
      const speedMult = isFrozen ? 0.35 : 1.0;
      
      f.vy += currentGravity; // Gravity pull down
      f.x += f.vx * speedMult;
      f.y += f.vy * speedMult;

      if (f.isSliced) {
        f.sliceOffset += 3.5 * speedMult; // Separate sliced halves
      }

      // Check if dropped uncut below screen
      const offScreenBottom = f.y - f.radius > canvasHeight;
      if (offScreenBottom) {
        // Drop penalty ONLY in classic mode, and NOT for bombs
        if (gameMode === 'classic' && !f.isSliced && f.type === 'fruit') {
          livesRef.current -= 1;
          setLives(livesRef.current);
          if (livesRef.current <= 0) {
            handleGameOver();
            return;
          }
        }
      } else {
        activeFruits.push(f);
      }
    });
    fruitsRef.current = activeFruits;

    // 3. Move Particles
    const activeParticles: Particle[] = [];
    particlesRef.current.forEach((p) => {
      const speedMult = isFrozen ? 0.35 : 1.0;
      p.x += p.vx * speedMult;
      p.y += p.vy * speedMult;
      p.alpha -= 0.02; // Fade out
      if (p.alpha > 0) {
        activeParticles.push(p);
      }
    });
    particlesRef.current = activeParticles;

    // 4. Age swipe line
    swipePointsRef.current = swipePointsRef.current
      .map(pt => ({ ...pt, age: pt.age + 1 }))
      .filter(pt => pt.age < 12);
  };

  const spawnFruit = () => {
    const isFrenzy = frenzyTimerRef.current > 0;
    // Bombs spawn only in Classic Mode and when Frenzy is not active
    const isBomb = gameMode === 'classic' && !isFrenzy && Math.random() < 0.16;
    
    let x = 0;
    let y = 0;
    let vx = 0;
    let vy = 0;

    // Frenzy fruits spawn from left and right margins
    if (isFrenzy) {
      const fromLeft = Math.random() > 0.5;
      x = fromLeft ? -15 : canvasWidth + 15;
      y = 120 + Math.random() * (canvasHeight - 200);
      vx = fromLeft ? (3.5 + Math.random() * 3.5) : -(3.5 + Math.random() * 3.5);
      vy = -2.5 - Math.random() * 3.0;
    } else {
      // Classic spawn from bottom arch
      x = 80 + Math.random() * (canvasWidth - 160);
      y = canvasHeight + 10;
      vx = (canvasWidth / 2 - x) * 0.015 + (Math.random() - 0.5) * 1.5;
      vy = -7.5 - Math.random() * 2.8;
    }

    let emoji = '';
    let color = '';
    let special: 'frenzy' | 'freeze' | undefined = undefined;

    if (isBomb) {
      emoji = '💣';
      color = '#e74c3c';
    } else {
      const roll = Math.random();
      if (roll < 0.08) {
        emoji = '🍌⭐';
        color = '#ffea00'; // Frenzy Banana
        special = 'frenzy';
      } else if (roll < 0.16) {
        emoji = '🥥❄️';
        color = '#00d2ff'; // Freeze Coconut
        special = 'freeze';
      } else {
        const randIdx = Math.floor(Math.random() * standardEmojis.length);
        emoji = standardEmojis[randIdx];
        color = standardColors[randIdx];
      }
    }

    fruitsRef.current.push({
      id: Date.now() + Math.random(),
      x,
      y,
      vx,
      vy,
      radius: 20,
      color,
      emoji,
      isSliced: false,
      sliceAngle: 0,
      sliceOffset: 0,
      type: isBomb ? 'bomb' : 'fruit',
      special,
    });
  };

  const checkSwipeIntersection = (p1: SlicePoint, p2: SlicePoint) => {
    if (gameOverRef.current) return;
    
    fruitsRef.current.forEach((f) => {
      if (f.isSliced) return;

      const dist = distanceToSegment(f, p1, p2);
      if (dist < f.radius + 3) {
        sliceFruit(f, p1, p2);
      }
    });
  };

  const sliceFruit = (f: Fruit, p1: SlicePoint, p2: SlicePoint) => {
    f.isSliced = true;
    f.sliceAngle = Math.atan2(p2.y - p1.y, p2.x - p1.x);

    if (f.type === 'bomb') {
      triggerBombExplosion(f);
      handleGameOver();
    } else {
      scoreRef.current += 1;
      setScore(scoreRef.current);
      
      // Handle special fruit effects
      if (f.special === 'frenzy') {
        frenzyTimerRef.current = 180; // 3 seconds frenzy
        confetti({ particleCount: 30, spread: 40, colors: ['#ffea00'] });
      } else if (f.special === 'freeze') {
        freezeTimerRef.current = 180; // 3 seconds freeze
      }

      // Splatter particles
      for (let i = 0; i < 15; i++) {
        particlesRef.current.push({
          x: f.x,
          y: f.y,
          vx: (Math.random() - 0.5) * 6,
          vy: (Math.random() - 0.5) * 6 - 1,
          color: f.color,
          radius: 3 + Math.random() * 3,
          alpha: 1
        });
      }
    }
  };

  const triggerBombExplosion = (f: Fruit) => {
    for (let i = 0; i < 40; i++) {
      particlesRef.current.push({
        x: f.x,
        y: f.y,
        vx: (Math.random() - 0.5) * 12,
        vy: (Math.random() - 0.5) * 12,
        color: Math.random() > 0.5 ? '#f1c40f' : '#e67e22',
        radius: 4 + Math.random() * 6,
        alpha: 1
      });
    }
  };

  const distanceToSegment = (p: { x: number; y: number }, a: SlicePoint, b: SlicePoint): number => {
    const l2 = (b.x - a.x) ** 2 + (b.y - a.y) ** 2;
    if (l2 === 0) return Math.hypot(p.x - a.x, p.y - a.y);
    
    let t = ((p.x - a.x) * (b.x - a.x) + (p.y - a.y) * (b.y - a.y)) / l2;
    t = Math.max(0, Math.min(1, t));
    
    return Math.hypot(p.x - (a.x + t * (b.x - a.x)), p.y - (a.y + t * (b.y - a.y)));
  };

  const handleGameOver = async () => {
    gameOverRef.current = true;
    setGameOver(true);
    setIsStarted(false);
    
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
    if (frameIdRef.current) cancelAnimationFrame(frameIdRef.current);

    const coins = await CoinService.reportGameScore('ninja_fruit', { won: false, score: scoreRef.current, mode: gameMode ?? 'classic' });
    setEarnedCoins(coins);
    await CoinService.recordGamePlayed('Ninja Fruit');
  };

  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Wood cutting board background
    ctx.fillStyle = '#1e140d';
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);

    // Wood rings lines
    ctx.strokeStyle = 'rgba(0,0,0,0.15)';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(canvasWidth / 2, canvasHeight / 2, 80, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(canvasWidth / 2, canvasHeight / 2, 160, 0, Math.PI * 2);
    ctx.stroke();

    // 1. Draw Juice Splatter Particles
    particlesRef.current.forEach((p) => {
      ctx.fillStyle = p.color;
      ctx.globalAlpha = p.alpha;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.globalAlpha = 1.0; // reset

    // 2. Draw Fruits
    fruitsRef.current.forEach((f) => {
      ctx.font = '32px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      if (!f.isSliced) {
        ctx.save();
        ctx.translate(f.x, f.y);
        ctx.fillText(f.emoji, 0, 0);
        ctx.restore();
      } else {
        // Draw two halves separated by slice angle
        const dx = Math.cos(f.sliceAngle + Math.PI / 2) * f.sliceOffset;
        const dy = Math.sin(f.sliceAngle + Math.PI / 2) * f.sliceOffset;

        // Left half
        ctx.save();
        ctx.translate(f.x - dx, f.y - dy);
        ctx.rotate(f.sliceAngle);
        ctx.beginPath();
        ctx.rect(-40, -40, 40, 80);
        ctx.clip();
        ctx.fillText(f.emoji, 0, 0);
        ctx.restore();

        // Right half
        ctx.save();
        ctx.translate(f.x + dx, f.y + dy);
        ctx.rotate(f.sliceAngle);
        ctx.beginPath();
        ctx.rect(0, -40, 40, 80);
        ctx.clip();
        ctx.fillText(f.emoji, 0, 0);
        ctx.restore();
      }
    });

    // 3. Freeze Blue Overlay effect
    if (freezeTimerRef.current > 0) {
      ctx.fillStyle = 'rgba(0, 210, 255, 0.15)';
      ctx.fillRect(0, 0, canvasWidth, canvasHeight);
      
      // Draw snowflake indicator
      ctx.fillStyle = '#00d2ff';
      ctx.font = '16px sans-serif';
      ctx.fillText('❄️ Băng giá', canvasWidth - 100, 24);
    }

    // 4. Frenzy yellow border effect
    if (frenzyTimerRef.current > 0) {
      ctx.strokeStyle = 'rgba(255, 234, 0, 0.4)';
      ctx.lineWidth = 10;
      ctx.strokeRect(0, 0, canvasWidth, canvasHeight);

      ctx.fillStyle = '#ffea00';
      ctx.font = 'bold 16px sans-serif';
      ctx.fillText('🍌 FRENZY MODE! 🍌', 120, 24);
    }

    // 5. Draw Swipe line
    const pts = swipePointsRef.current;
    if (pts.length > 1) {
      ctx.strokeStyle = '#ffffff';
      ctx.shadowBlur = 12;
      ctx.shadowColor = '#00ecff';
      ctx.lineWidth = 5;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < pts.length; i++) {
        ctx.lineTo(pts[i].x, pts[i].y);
      }
      ctx.stroke();
      
      ctx.strokeStyle = '#00ecff';
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.shadowBlur = 0; // reset
    }
  };

  const handlePointerDown = (clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = (clientX - rect.left) * scaleX;
    const y = (clientY - rect.top) * scaleY;

    isMouseDownRef.current = true;
    swipePointsRef.current = [{ x, y, age: 0 }];
  };

  const handlePointerMove = (clientX: number, clientY: number) => {
    if (!isMouseDownRef.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = (clientX - rect.left) * scaleX;
    const y = (clientY - rect.top) * scaleY;

    const newPt = { x, y, age: 0 };
    const pts = swipePointsRef.current;
    const prevPt = pts[pts.length - 1];

    if (prevPt) {
      checkSwipeIntersection(prevPt, newPt);
    }

    swipePointsRef.current = [...pts, newPt];
  };

  const handlePointerUp = () => {
    isMouseDownRef.current = false;
  };

  useEffect(() => {
    initGame();
    return () => {
      if (frameIdRef.current) cancelAnimationFrame(frameIdRef.current);
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    };
  }, []);

  return (
    <div className="glass fullscreen-game-container">
      
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: 'var(--border-glass)', paddingBottom: '14px', marginBottom: '20px' }}>
        <div>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 800 }}>Chém Hoa Quả (Ninja Fruit)</h2>
          <span style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)' }}>
            Chế độ: <strong style={{ color: 'var(--primary-color)' }}>{gameMode === 'classic' ? 'Classic (3 Mạng)' : gameMode === 'zen' ? 'Zen (Tính giờ)' : 'Chưa chọn'}</strong> | 
            Điểm số: <strong style={{ color: '#2ecc71', fontSize: '1rem', marginLeft: '6px' }}>{score}</strong>
            {gameMode === 'classic' && (
              <> | Mạng còn lại: <strong style={{ color: '#e74c3c' }}>{lives}</strong></>
            )}
            {gameMode === 'zen' && (
              <> | Thời gian: <strong style={{ color: timeLeft < 8 ? '#e74c3c' : 'white' }}>{timeLeft}s</strong></>
            )}
          </span>
        </div>
        <button onClick={onClose} className="btn btn-danger" style={{ fontSize: '0.85rem' }}>
          Thoát
        </button>
      </div>

      {/* Play Area */}
      <div style={{ flexGrow: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
        
        {/* Canvas */}
        <canvas
          ref={canvasRef}
          width={canvasWidth}
          height={canvasHeight}
          onMouseDown={(e) => handlePointerDown(e.clientX, e.clientY)}
          onMouseMove={(e) => handlePointerMove(e.clientX, e.clientY)}
          onMouseUp={handlePointerUp}
          onMouseLeave={handlePointerUp}
          onTouchStart={(e) => {
            const touch = e.touches[0];
            handlePointerDown(touch.clientX, touch.clientY);
          }}
          onTouchMove={(e) => {
            const touch = e.touches[0];
            handlePointerMove(touch.clientX, touch.clientY);
          }}
          onTouchEnd={handlePointerUp}
          style={{
            background: '#1e140d',
            borderRadius: '12px',
            border: '2px solid rgba(255, 255, 255, 0.1)',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5)',
          }}
        />

        {/* Start Game Mode Selection Overlay */}
        {!isStarted && !gameOver && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', zIndex: 10, background: 'rgba(10,8,20,0.85)', borderRadius: '12px' }}>
            <span style={{ fontSize: '3.5rem', marginBottom: '14px' }}>🍓🍉⚔️</span>
            <h3 style={{ color: 'white', fontSize: '1.4rem', fontWeight: 800, marginBottom: '16px' }}>Chọn chế độ chém quả:</h3>
            
            <div style={{ display: 'flex', gap: '14px' }}>
              <button onClick={() => chooseModeAndStart('classic')} className="btn btn-primary" style={{ display: 'flex', flexDirection: 'column', padding: '12px 20px', height: 'auto', gap: '4px' }}>
                <span style={{ fontWeight: 800 }}>⚔️ Classic Mode</span>
                <span style={{ fontSize: '0.65rem', opacity: 0.85 }}>Có bom - Mất 3 mạng là chết</span>
              </button>
              
              <button onClick={() => chooseModeAndStart('zen')} className="btn btn-secondary" style={{ display: 'flex', flexDirection: 'column', padding: '12px 20px', height: 'auto', gap: '4px', background: 'rgba(124, 111, 255, 0.25)', borderColor: 'var(--primary-color)' }}>
                <span style={{ fontWeight: 800, color: 'white' }}>⏳ Zen Mode</span>
                <span style={{ fontSize: '0.65rem', opacity: 0.85 }}>30s Đếm ngược - Không có bom</span>
              </button>
            </div>
          </div>
        )}

        {/* Game Over Screen Overlay */}
        {gameOver && (
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(10,8,20,0.85)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', borderRadius: '12px', zIndex: 10 }}>
            <span style={{ fontSize: '3.5rem', marginBottom: '10px' }}>💥</span>
            <h3 style={{ color: '#e74c3c', fontSize: '1.8rem', fontWeight: 800, marginBottom: '6px' }}>
              {gameMode === 'zen' ? 'Hết Thời Gian!' : 'Kết Thúc Ván!'}
            </h3>
            <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.9rem', marginBottom: '16px' }}>
              Chế độ: {gameMode === 'classic' ? 'Classic' : 'Zen'} | Tổng số quả chém: **{score}**
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
        💡 Nhấp giữ và kéo chuột (hoặc vuốt màn hình) để chém trái cây. Chém trúng 🍌⭐ (Chuối cuồng nhiệt) để mưa chuối rơi, chém trúng 🥥❄️ (Dừa băng) để đóng băng làm chậm thời gian!
      </div>
    </div>
  );
};
