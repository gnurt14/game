import React, { useState, useEffect, useRef } from 'react';
import { Play, Shield as ShieldIcon, Zap } from 'lucide-react';
import { CoinService } from '../../services/coinService';
import confetti from 'canvas-confetti';

interface BrickBreakerProps {
  onClose: () => void;
}

type Ball = {
  x: number;
  y: number;
  dx: number;
  dy: number;
  radius: number;
};

type Brick = {
  id: number;
  x: number;
  y: number;
  width: number;
  height: number;
  hitsNeeded: number; // 0 means broken
  color: string;
};

type PowerUp = {
  id: number;
  x: number;
  y: number;
  type: 'expand' | 'multiball' | 'laser' | 'shield';
  radius: number;
};

type Bullet = {
  id: number;
  x: number;
  y: number;
  dy: number;
  radius: number;
};

export const BrickBreaker: React.FC<BrickBreakerProps> = ({ onClose }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  
  const [score, setScore] = useState<number>(0);
  const [lives, setLives] = useState<number>(3);
  const [level, setLevel] = useState<number>(1);
  const [laserCount, setLaserCount] = useState<number>(0);
  const [hasShield, setHasShield] = useState<boolean>(false);

  const [isStarted, setIsStarted] = useState<boolean>(false);
  const [gameOver, setGameOver] = useState<boolean>(false);
  const [won, setWon] = useState<boolean>(false);
  const [levelBanner, setLevelBanner] = useState<string | null>(null);
  const [levelClearMsg, setLevelClearMsg] = useState<string | null>(null);
  const [showLaserHint, setShowLaserHint] = useState<boolean>(false);
  const [earnedCoins, setEarnedCoins] = useState<number | null>(null);

  // Mutable loop states
  const scoreRef = useRef<number>(0);
  const livesRef = useRef<number>(3);
  const levelRef = useRef<number>(1);
  
  const paddleWidthRef = useRef<number>(80);
  const paddleXRef = useRef<number>(140);
  
  const ballsRef = useRef<Ball[]>([]);
  const bricksRef = useRef<Brick[]>([]);
  const powerupsRef = useRef<PowerUp[]>([]);
  const bulletsRef = useRef<Bullet[]>([]);

  // Lasers & Shield refs
  const laserCountRef = useRef<number>(0);
  const hasShieldRef = useRef<boolean>(false);

  // Bumper refs (Level 3 obstacle)
  const bumperXRef = useRef<number>(130);
  const bumperYRef = useRef<number>(200);
  const bumperWidth = 100;
  const bumperHeight = 12;
  const bumperDxRef = useRef<number>(1.8);

  const frameIdRef = useRef<number | null>(null);
  const isStartedRef = useRef<boolean>(false);
  const gameOverRef = useRef<boolean>(false);
  const wonRef = useRef<boolean>(false);

  // Sizes
  const canvasWidth = 360;
  const canvasHeight = 380;
  const paddleHeight = 10;

  const initGame = () => {
    scoreRef.current = 0;
    livesRef.current = 3;
    levelRef.current = 1;
    laserCountRef.current = 0;
    hasShieldRef.current = false;
    
    setScore(0);
    setLives(3);
    setLevel(1);
    setLaserCount(0);
    setHasShield(false);
    
    setGameOver(false);
    setWon(false);
    setIsStarted(false);
    setEarnedCoins(null);
    setLevelBanner(null);

    isStartedRef.current = false;
    gameOverRef.current = false;
    wonRef.current = false;

    loadLevel(1);
  };

  const loadLevel = (lvlNum: number) => {
    paddleWidthRef.current = 80;
    paddleXRef.current = (canvasWidth - paddleWidthRef.current) / 2;

    // Reset ball
    ballsRef.current = [{
      x: canvasWidth / 2,
      y: canvasHeight - 30,
      dx: 2.2 * (Math.random() > 0.5 ? 1 : -1),
      dy: -3.5,
      radius: 6
    }];

    powerupsRef.current = [];
    bulletsRef.current = [];

    // Bricks layout: 5 rows, 6 columns
    const brickRows = lvlNum === 3 ? 4 : 5;
    const brickCols = 6;
    const bWidth = 50;
    const bHeight = 16;
    const bPadding = 6;
    const bOffsetTop = 40;
    const bOffsetLeft = 16;
    
    const rowColors = ['#e74c3c', '#e67e22', '#f1c40f', '#2ecc71', '#3498db'];

    const newBricks: Brick[] = [];
    let idCounter = 0;

    for (let r = 0; r < brickRows; r++) {
      for (let c = 0; c < brickCols; c++) {
        // In Level 2, row 2 is steel bricks (require 2 hits)
        const isSteel = lvlNum === 2 && r === 2;
        newBricks.push({
          id: idCounter++,
          x: c * (bWidth + bPadding) + bOffsetLeft,
          y: r * (bHeight + bPadding) + bOffsetTop,
          width: bWidth,
          height: bHeight,
          hitsNeeded: isSteel ? 2 : 1,
          color: isSteel ? '#7f8c8d' : rowColors[r]
        });
      }
    }
    bricksRef.current = newBricks;

    // Trigger visual banner
    setLevelBanner(`CẤP ĐỘ ${lvlNum}`);
    setTimeout(() => {
      setLevelBanner(null);
    }, 1800);

    setTimeout(draw, 50);
  };

  const startGame = () => {
    isStartedRef.current = true;
    setIsStarted(true);
    if (frameIdRef.current) cancelAnimationFrame(frameIdRef.current);
    frameIdRef.current = requestAnimationFrame(gameLoop);
  };

  const gameLoop = () => {
    if (!isStartedRef.current || gameOverRef.current || wonRef.current) return;

    updatePhysics();
    draw();

    frameIdRef.current = requestAnimationFrame(gameLoop);
  };

  const updatePhysics = () => {
    // 1. Move Bumper (Level 3)
    if (levelRef.current === 3) {
      let bX = bumperXRef.current + bumperDxRef.current;
      if (bX <= 10 || bX + bumperWidth >= canvasWidth - 10) {
        bumperDxRef.current = -bumperDxRef.current;
        bX = bumperXRef.current + bumperDxRef.current;
      }
      bumperXRef.current = bX;
    }

    // 2. Move Laser Bullets
    const activeBullets: Bullet[] = [];
    bulletsRef.current.forEach((b) => {
      b.y += b.dy;
      let hit = false;
      
      // Check hit bricks
      bricksRef.current.forEach((brick) => {
        if (brick.hitsNeeded > 0 && !hit) {
          const inX = b.x + b.radius > brick.x && b.x - b.radius < brick.x + brick.width;
          const inY = b.y - b.radius < brick.y + brick.height && b.y + b.radius > brick.y;
          
          if (inX && inY) {
            hit = true;
            damageBrick(brick);
          }
        }
      });

      if (!hit && b.y + b.radius > 0) {
        activeBullets.push(b);
      }
    });
    bulletsRef.current = activeBullets;

    // 3. Move balls
    const activeBalls: Ball[] = [];

    ballsRef.current.forEach((ball) => {
      let nextX = ball.x + ball.dx;
      let nextY = ball.y + ball.dy;

      // Side wall bounce
      if (nextX - ball.radius <= 0 || nextX + ball.radius >= canvasWidth) {
        ball.dx = -ball.dx;
      }
      
      // Top ceiling bounce
      if (nextY - ball.radius <= 0) {
        ball.dy = -ball.dy;
      }

      // Level 3 Moving Bumper Bounce check
      if (levelRef.current === 3) {
        const hitBumperX = nextX + ball.radius > bumperXRef.current && nextX - ball.radius < bumperXRef.current + bumperWidth;
        const hitBumperY = nextY + ball.radius > bumperYRef.current && nextY - ball.radius < bumperYRef.current + bumperHeight;
        if (hitBumperX && hitBumperY) {
          ball.dy = -ball.dy;
          // Offset slightly to push out
          nextY = ball.dy < 0 ? bumperYRef.current - ball.radius - 1 : bumperYRef.current + bumperHeight + ball.radius + 1;
        }
      }

      // Bottom Shield Protection
      if (hasShieldRef.current && nextY + ball.radius >= canvasHeight - 4) {
        ball.dy = -Math.abs(ball.dy); // Bounce back up
        hasShieldRef.current = false;
        setHasShield(false);
      }

      // Paddle bounce check
      const hitPaddleX = nextX > paddleXRef.current && nextX < paddleXRef.current + paddleWidthRef.current;
      const hitPaddleY = nextY + ball.radius >= canvasHeight - paddleHeight && nextY - ball.radius <= canvasHeight;
      
      if (hitPaddleX && hitPaddleY) {
        const relativeHit = (nextX - (paddleXRef.current + paddleWidthRef.current / 2)) / (paddleWidthRef.current / 2);
        ball.dx = relativeHit * 3.5;
        ball.dy = -Math.abs(ball.dy); // always goes up
      }

      // Check Brick collision
      bricksRef.current.forEach((brick) => {
        if (brick.hitsNeeded > 0) {
          const inX = nextX + ball.radius > brick.x && nextX - ball.radius < brick.x + brick.width;
          const inY = nextY + ball.radius > brick.y && nextY - ball.radius < brick.y + brick.height;
          
          if (inX && inY) {
            damageBrick(brick);
            ball.dy = -ball.dy;
          }
        }
      });

      // Is it dropped out?
      if (nextY - ball.radius < canvasHeight) {
        ball.x = nextX;
        ball.y = nextY;
        activeBalls.push(ball);
      }
    });

    ballsRef.current = activeBalls;

    // Check if we lost all balls in play
    if (ballsRef.current.length === 0) {
      livesRef.current -= 1;
      setLives(livesRef.current);

      if (livesRef.current <= 0) {
        handleGameOver();
        return;
      } else {
        // Respawn standard ball
        ballsRef.current = [{
          x: canvasWidth / 2,
          y: canvasHeight - 30,
          dx: 2.5 * (Math.random() > 0.5 ? 1 : -1),
          dy: -3.5,
          radius: 6
        }];
        paddleWidthRef.current = 80; // Reset paddle size
        laserCountRef.current = 0; // Reset laser
        setLaserCount(0);
      }
    }

    // 4. Move Powerups
    const activePowerups: PowerUp[] = [];
    powerupsRef.current.forEach((p) => {
      p.y += 2; // slow fall
      
      const hitPaddleX = p.x > paddleXRef.current && p.x < paddleXRef.current + paddleWidthRef.current;
      const hitPaddleY = p.y + p.radius >= canvasHeight - paddleHeight && p.y - p.radius <= canvasHeight;

      if (hitPaddleX && hitPaddleY) {
        applyPowerUp(p.type);
      } else if (p.y - p.radius < canvasHeight) {
        activePowerups.push(p);
      }
    });
    powerupsRef.current = activePowerups;

    // Check level clear
    const activeBricks = bricksRef.current.filter(b => b.hitsNeeded > 0);
    if (activeBricks.length === 0) {
      handleLevelClear();
    }
  };

  const damageBrick = (brick: Brick) => {
    brick.hitsNeeded -= 1;
    if (brick.hitsNeeded === 1) {
      brick.color = '#e67e22'; // Turn orange to signal 1 hit remaining
    }
    
    scoreRef.current += 10;
    setScore(scoreRef.current);

    // Drop power-up on break
    if (brick.hitsNeeded === 0 && Math.random() < 0.28) {
      const rolls = Math.random();
      let type: 'expand' | 'multiball' | 'laser' | 'shield' = 'expand';
      if (rolls < 0.25) {
        type = 'multiball';
      } else if (rolls < 0.5) {
        type = 'laser';
      } else if (rolls < 0.75) {
        type = 'shield';
      }
      
      powerupsRef.current.push({
        id: Date.now() + Math.random(),
        x: brick.x + brick.width / 2,
        y: brick.y + brick.height,
        type,
        radius: 8
      });
    }
  };

  const applyPowerUp = (type: 'expand' | 'multiball' | 'laser' | 'shield') => {
    if (type === 'expand') {
      paddleWidthRef.current = 120;
    } else if (type === 'multiball') {
      const b1 = ballsRef.current[0] || { x: canvasWidth / 2, y: canvasHeight - 50, dx: 2, dy: -3 };
      ballsRef.current.push(
        { x: b1.x, y: b1.y, dx: b1.dx + 0.8, dy: -b1.dy, radius: 6 },
        { x: b1.x, y: b1.y, dx: -b1.dx - 0.8, dy: b1.dy, radius: 6 }
      );
    } else if (type === 'laser') {
      const wasEmpty = laserCountRef.current === 0;
      laserCountRef.current += 5;
      setLaserCount(laserCountRef.current);
      if (wasEmpty) setShowLaserHint(true);
    } else if (type === 'shield') {
      hasShieldRef.current = true;
      setHasShield(true);
    }
  };

  const shootLaser = () => {
    if (laserCountRef.current <= 0 || !isStartedRef.current || gameOverRef.current || wonRef.current) return;
    
    laserCountRef.current -= 1;
    setLaserCount(laserCountRef.current);

    // Spawn 2 bullets at the ends of paddle
    bulletsRef.current.push(
      {
        id: Date.now() + Math.random(),
        x: paddleXRef.current + 5,
        y: canvasHeight - paddleHeight - 4,
        dy: -4.5,
        radius: 3
      },
      {
        id: Date.now() + Math.random() + 0.1,
        x: paddleXRef.current + paddleWidthRef.current - 5,
        y: canvasHeight - paddleHeight - 4,
        dy: -4.5,
        radius: 3
      }
    );
  };

  const handleLevelClear = () => {
    if (frameIdRef.current) cancelAnimationFrame(frameIdRef.current);

    if (levelRef.current < 3) {
      const clearedLvl = levelRef.current;
      const nextLvl = clearedLvl + 1;
      setLevelClearMsg(`⭐ Màn ${clearedLvl} hoàn thành!`);

      setTimeout(() => {
        setLevelClearMsg(null);
        levelRef.current = nextLvl;
        setLevel(nextLvl);
        loadLevel(nextLvl);
        setTimeout(() => {
          frameIdRef.current = requestAnimationFrame(gameLoop);
        }, 1800);
      }, 2000);
    } else {
      handleWin();
    }
  };

  const handleWin = async () => {
    wonRef.current = true;
    setWon(true);
    setIsStarted(false);
    if (frameIdRef.current) cancelAnimationFrame(frameIdRef.current);

    confetti({ particleCount: 120, spread: 80, origin: { y: 0.6 } });

    const coins = await CoinService.reportGameScore('brick_breaker', { won: true, score: scoreRef.current, lives: livesRef.current });
    setEarnedCoins(coins);
    await CoinService.recordGamePlayed('Brick Breaker');
  };

  const handleGameOver = async () => {
    gameOverRef.current = true;
    setGameOver(true);
    setIsStarted(false);
    if (frameIdRef.current) cancelAnimationFrame(frameIdRef.current);

    const coins = await CoinService.reportGameScore('brick_breaker', { won: false, score: scoreRef.current, lives: 0 });
    setEarnedCoins(coins);
    await CoinService.recordGamePlayed('Brick Breaker');
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isStarted) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const x = (e.clientX - rect.left) * scaleX;
    paddleXRef.current = Math.max(0, Math.min(canvasWidth - paddleWidthRef.current, x - paddleWidthRef.current / 2));
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLCanvasElement>) => {
    if (!isStarted) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const touch = e.touches[0];
    const x = (touch.clientX - rect.left) * scaleX;
    paddleXRef.current = Math.max(0, Math.min(canvasWidth - paddleWidthRef.current, x - paddleWidthRef.current / 2));
  };

  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear board
    ctx.fillStyle = '#0a0814';
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);

    // 1. Draw Bricks
    bricksRef.current.forEach((brick) => {
      if (brick.hitsNeeded > 0) {
        ctx.fillStyle = brick.color;
        ctx.beginPath();
        ctx.roundRect(brick.x, brick.y, brick.width, brick.height, 3);
        ctx.fill();

        // If steel brick, draw small inner shield indicator
        if (brick.hitsNeeded === 2) {
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 1;
          ctx.strokeRect(brick.x + 3, brick.y + 3, brick.width - 6, brick.height - 6);
        }
      }
    });

    // 2. Draw Moving Bumper (Level 3 obstacle)
    if (levelRef.current === 3) {
      ctx.fillStyle = '#9b59b6';
      ctx.shadowBlur = 8;
      ctx.shadowColor = '#9b59b6';
      ctx.beginPath();
      ctx.roundRect(bumperXRef.current, bumperYRef.current, bumperWidth, bumperHeight, 4);
      ctx.fill();
      ctx.shadowBlur = 0; // reset
      
      // Draw Bumper label text
      ctx.fillStyle = '#ffffff';
      ctx.font = '9px Arial';
      ctx.textAlign = 'center';
      ctx.fillText('VẬT CẢN', bumperXRef.current + bumperWidth / 2, bumperYRef.current + 9);
    }

    // 3. Draw Paddle
    ctx.fillStyle = laserCountRef.current > 0 ? '#ff3f34' : 'var(--primary-color)';
    ctx.beginPath();
    ctx.roundRect(paddleXRef.current, canvasHeight - paddleHeight, paddleWidthRef.current, paddleHeight, 5);
    ctx.fill();

    // Draw little laser cannons if laser is loaded
    if (laserCountRef.current > 0) {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(paddleXRef.current + 2, canvasHeight - paddleHeight - 4, 4, 4);
      ctx.fillRect(paddleXRef.current + paddleWidthRef.current - 6, canvasHeight - paddleHeight - 4, 4, 4);
    }

    // 4. Draw Balls (glowing blue-white circles)
    ballsRef.current.forEach((ball) => {
      ctx.shadowBlur = 8;
      ctx.shadowColor = '#00bcd4';
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0; // reset
    });

    // 5. Draw Powerups
    powerupsRef.current.forEach((p) => {
      ctx.fillStyle = p.type === 'expand' 
        ? '#2ecc71' 
        : p.type === 'multiball' 
          ? '#00bcd4' 
          : p.type === 'laser' 
            ? '#ff3f34' 
            : '#f1c40f'; // shield
      
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      ctx.fill();
      
      // Letter symbol
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 9px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(
        p.type === 'expand' ? '↔️' : p.type === 'multiball' ? '✖' : p.type === 'laser' ? '⚡' : '🛡️',
        p.x,
        p.y
      );
    });

    // 6. Draw Laser Bullets
    bulletsRef.current.forEach((b) => {
      ctx.fillStyle = '#ff3f34';
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2);
      ctx.fill();
    });

    // 7. Draw Bottom Shield protector
    if (hasShieldRef.current) {
      ctx.strokeStyle = '#f1c40f';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(0, canvasHeight - 2);
      ctx.lineTo(canvasWidth, canvasHeight - 2);
      ctx.stroke();
    }

    // 8. Level transition Banner
    if (levelBanner) {
      ctx.fillStyle = 'rgba(10, 8, 20, 0.85)';
      ctx.fillRect(0, 0, canvasWidth, canvasHeight);

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 22px Arial';
      ctx.textAlign = 'center';
      ctx.fillText(levelBanner, canvasWidth / 2, canvasHeight / 2 - 10);
      
      ctx.fillStyle = 'var(--primary-color)';
      ctx.font = '12px Arial';
      ctx.fillText(
        levelRef.current === 2 ? '⚠️ CHÚ Ý: GẠCH SẮT CẦN 2 ĐÒN ĐẬP' : '⚠️ CHÚ Ý: KHỐI CHẮN DI ĐỘNG',
        canvasWidth / 2,
        canvasHeight / 2 + 20
      );
    }
  };

  useEffect(() => {
    if (!showLaserHint) return;
    const t = setTimeout(() => setShowLaserHint(false), 3000);
    return () => clearTimeout(t);
  }, [showLaserHint]);

  useEffect(() => {
    initGame();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === ' ' || e.code === 'Space') {
        e.preventDefault();
        shootLaser();
      }
    };
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      if (frameIdRef.current) cancelAnimationFrame(frameIdRef.current);
    };
  }, []);

  return (
    <div className="glass fullscreen-game-container">
      
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: 'var(--border-glass)', paddingBottom: '14px', marginBottom: '20px' }}>
        <div>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 800 }}>Phá Gạch (Brick Breaker)</h2>
          <span style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)' }}>
            Điểm số: <strong style={{ color: 'var(--primary-color)' }}>{score}</strong> | 
            Mạng: <strong style={{ color: '#e74c3c' }}>{lives}</strong> | 
            Cấp độ: <strong style={{ color: '#f1c40f' }}>{level}/3</strong>
            {laserCount > 0 && (
              <span style={{ marginLeft: '12px', background: '#ff3f34', color: 'white', padding: '2px 6px', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                <Zap size={10} fill="white" /> Laser: {laserCount} đạn (SPACE)
              </span>
            )}
            {hasShield && (
              <span style={{ marginLeft: '12px', background: '#f1c40f', color: 'black', padding: '2px 6px', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                <ShieldIcon size={10} fill="black" /> Đáy đã bảo vệ
              </span>
            )}
          </span>
        </div>
        <button onClick={onClose} className="btn btn-danger" style={{ fontSize: '0.85rem' }}>
          Thoát
        </button>
      </div>

      {/* Play Area */}
      <div style={{ flexGrow: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
        
        {/* Board Canvas */}
        <canvas
          ref={canvasRef}
          width={canvasWidth}
          height={canvasHeight}
          onMouseMove={handleMouseMove}
          onTouchMove={handleTouchMove}
          onClick={shootLaser} // Allow shooting by clicking canvas as well
          style={{
            background: '#0a0814',
            borderRadius: '12px',
            border: '2px solid rgba(255, 255, 255, 0.1)',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
            cursor: 'none'
          }}
        />

        {/* Start Game overlay */}
        {!isStarted && !gameOver && !won && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', zIndex: 10, background: 'rgba(10,8,20,0.5)', pointerEvents: 'none' }}>
            <span style={{ fontSize: '3rem', marginBottom: '14px' }}>⚾</span>
            <button onClick={startGame} className="btn btn-primary" style={{ pointerEvents: 'auto', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Play size={16} fill="white" /> Bắt đầu bắn bóng
            </button>
          </div>
        )}

        {/* Game Over Screen Overlay */}
        {gameOver && (
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(10,8,20,0.85)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', borderRadius: '12px', zIndex: 10 }}>
            <span style={{ fontSize: '3rem', marginBottom: '10px' }}>💀</span>
            <h3 style={{ color: '#e74c3c', fontSize: '1.8rem', fontWeight: 800, marginBottom: '6px' }}>Thất Bại!</h3>
            <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.9rem', marginBottom: '16px' }}>
              Bạn hết mạng ở Cấp độ {level}. Điểm số: **{score}**
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

        {/* Won Overlay */}
        {won && (
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(10,8,20,0.85)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', borderRadius: '12px', zIndex: 10 }}>
            <span style={{ fontSize: '3rem', marginBottom: '10px' }}>🏆</span>
            <h3 style={{ color: '#2ecc71', fontSize: '1.8rem', fontWeight: 800, marginBottom: '6px' }}>Chiến Thắng!</h3>
            <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.9rem', marginBottom: '16px' }}>
              Chúc mừng vượt qua toàn bộ 3 cấp độ! Điểm số: **{score}**
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

        {/* Level Clear Overlay */}
        {levelClearMsg && (
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(10,8,20,0.88)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', borderRadius: '12px', zIndex: 20 }}>
            <span style={{ fontSize: '3rem', marginBottom: '10px' }}>⭐</span>
            <h3 style={{ color: '#f1c40f', fontSize: '1.8rem', fontWeight: 800, marginBottom: '8px' }}>{levelClearMsg}</h3>
            <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.9rem' }}>
              Chuẩn bị Cấp độ {level + 1}...
            </p>
          </div>
        )}

        {/* Laser Hint Toast */}
        {showLaserHint && (
          <div style={{ position: 'absolute', bottom: '56px', left: '50%', transform: 'translateX(-50%)', background: 'rgba(255, 63, 52, 0.92)', color: 'white', padding: '7px 18px', borderRadius: '20px', fontSize: '0.82rem', fontWeight: 700, zIndex: 15, whiteSpace: 'nowrap', pointerEvents: 'none' }}>
            ⚡ Nhấn SPACE để bắn laser!
          </div>
        )}

      </div>

      <div style={{ textAlign: 'center', fontSize: '0.75rem', color: 'var(--color-text-muted)', fontWeight: 500 }}>
        💡 Di chuyển chuột để hứng bóng. Nhặt vật phẩm: (↔️) to bệ đỡ, (✖) nhân 3 bóng, (⚡) Súng Laser (SPACE để bắn), (🛡️) Lá chắn cứu bóng ở đáy. Vượt qua 3 Cấp độ để thắng cuộc!
      </div>
    </div>
  );
};
