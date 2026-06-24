import React, { useState, useEffect, useRef } from 'react';
import { Play } from 'lucide-react';
import { CoinService } from '../../services/coinService';

interface SnakeProps {
  onClose: () => void;
}

type Point = { x: number; y: number };
type Direction = 'UP' | 'DOWN' | 'LEFT' | 'RIGHT';

const CELL_COUNT = 20;

export const Snake: React.FC<SnakeProps> = ({ onClose }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const [score, setScore] = useState<number>(0);
  const [isStarted, setIsStarted] = useState<boolean>(false);
  const [gameOver, setGameOver] = useState<boolean>(false);
  const [earnedCoins, setEarnedCoins] = useState<number | null>(null);

  // Use refs for game loop mutable state to avoid closure issues with React state
  const snakeRef = useRef<Point[]>([]);
  const directionRef = useRef<Direction>('RIGHT');
  const nextDirectionRef = useRef<Direction>('RIGHT');
  const foodRef = useRef<Point>({ x: 0, y: 0 });
  const gameIntervalRef = useRef<any>(null);
  const scoreRef = useRef<number>(0);

  const initGame = () => {
    // Start snake at row 10, cols 5, 4, 3
    snakeRef.current = [
      { x: 5, y: 10 },
      { x: 4, y: 10 },
      { x: 3, y: 10 }
    ];
    directionRef.current = 'RIGHT';
    nextDirectionRef.current = 'RIGHT';
    scoreRef.current = 0;
    setScore(0);
    setGameOver(false);
    setIsStarted(false);
    setEarnedCoins(null);
    spawnFood();
    draw();
  };

  const spawnFood = () => {
    let newFood: Point;
    let isOnSnake = true;

    while (isOnSnake) {
      newFood = {
        x: Math.floor(Math.random() * CELL_COUNT),
        y: Math.floor(Math.random() * CELL_COUNT)
      };
      // Check if food spawns on snake
      isOnSnake = snakeRef.current.some(part => part.x === newFood.x && part.y === newFood.y);
      if (!isOnSnake) {
        foodRef.current = newFood;
      }
    }
  };

  const startGame = () => {
    if (gameIntervalRef.current) clearInterval(gameIntervalRef.current);

    setIsStarted(true);
    // Game updates every 110ms (good classic snake speed)
    gameIntervalRef.current = setInterval(gameLoop, 110);
  };

  const gameLoop = () => {
    directionRef.current = nextDirectionRef.current;
    const head = { ...snakeRef.current[0] };

    // Move head
    switch (directionRef.current) {
      case 'UP': head.y -= 1; break;
      case 'DOWN': head.y += 1; break;
      case 'LEFT': head.x -= 1; break;
      case 'RIGHT': head.x += 1; break;
    }

    // Check collision with walls or body
    const hitWall = head.x < 0 || head.x >= CELL_COUNT || head.y < 0 || head.y >= CELL_COUNT;
    const hitSelf = snakeRef.current.some(part => part.x === head.x && part.y === head.y);

    if (hitWall || hitSelf) {
      handleGameOver();
      return;
    }

    // Add new head to start of snake array
    const newSnake = [head, ...snakeRef.current];

    // Check food eaten
    if (head.x === foodRef.current.x && head.y === foodRef.current.y) {
      scoreRef.current += 1;
      setScore(scoreRef.current);
      spawnFood();
    } else {
      // Remove tail if didn't eat food
      newSnake.pop();
    }

    snakeRef.current = newSnake;
    draw();
  };

  const handleGameOver = async () => {
    if (gameIntervalRef.current) clearInterval(gameIntervalRef.current);
    setGameOver(true);
    setIsStarted(false);

    // Award coins based on score
    const coins = await CoinService.reportGameScore('snake', { won: false, score: scoreRef.current });
    setEarnedCoins(coins);
    await CoinService.recordGamePlayed('Snake');
  };

  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const cellSize = width / CELL_COUNT;

    // Clear board
    ctx.fillStyle = '#0a0814';
    ctx.fillRect(0, 0, width, width);

    // Draw background grid lines (faint)
    ctx.strokeStyle = 'rgba(255,255,255,0.015)';
    ctx.lineWidth = 1;
    for (let i = 0; i <= CELL_COUNT; i++) {
      ctx.beginPath();
      ctx.moveTo(i * cellSize, 0);
      ctx.lineTo(i * cellSize, width);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(0, i * cellSize);
      ctx.lineTo(width, i * cellSize);
      ctx.stroke();
    }

    // Draw food (glowing red-orange circle)
    ctx.shadowBlur = 10;
    ctx.shadowColor = '#e74c3c';
    ctx.fillStyle = '#e74c3c';
    ctx.beginPath();
    const foodX = foodRef.current.x * cellSize + cellSize / 2;
    const foodY = foodRef.current.y * cellSize + cellSize / 2;
    ctx.arc(foodX, foodY, cellSize / 2 - 2, 0, Math.PI * 2);
    ctx.fill();

    // Reset shadow for snake drawing
    ctx.shadowBlur = 0;

    // Draw snake
    snakeRef.current.forEach((part, idx) => {
      const isHead = idx === 0;

      // Draw gradient color for body parts
      if (isHead) {
        ctx.fillStyle = '#2ecc71'; // Neon green
        ctx.shadowBlur = 8;
        ctx.shadowColor = '#2ecc71';
      } else {
        ctx.fillStyle = `rgba(46, 204, 113, ${1 - idx / (snakeRef.current.length * 1.2)})`; // fading green
        ctx.shadowBlur = 0;
      }

      ctx.beginPath();
      ctx.roundRect(
        part.x * cellSize + 1,
        part.y * cellSize + 1,
        cellSize - 2,
        cellSize - 2,
        isHead ? 6 : 4
      );
      ctx.fill();
    });

    ctx.shadowBlur = 0; // reset
  };

  // Keyboard controls
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const key = e.key;
      const currentDir = directionRef.current;

      if ((key === 'ArrowUp' || key === 'w') && currentDir !== 'DOWN') {
        nextDirectionRef.current = 'UP';
      } else if ((key === 'ArrowDown' || key === 's') && currentDir !== 'UP') {
        nextDirectionRef.current = 'DOWN';
      } else if ((key === 'ArrowLeft' || key === 'a') && currentDir !== 'RIGHT') {
        nextDirectionRef.current = 'LEFT';
      } else if ((key === 'ArrowRight' || key === 'd') && currentDir !== 'LEFT') {
        nextDirectionRef.current = 'RIGHT';
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Set up canvas on mount and draw background
  useEffect(() => {
    initGame();
    return () => {
      if (gameIntervalRef.current) clearInterval(gameIntervalRef.current);
    };
  }, []);

  return (
    <div className="glass fullscreen-game-container">

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: 'var(--border-glass)', paddingBottom: '14px', marginBottom: '20px' }}>
        <div>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 800 }}>Rắn Săn Mồi (Snake)</h2>
          <span style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)' }}>
            Điểm số: <strong style={{ color: 'var(--primary-color)', fontSize: '1rem' }}>{score}</strong>
          </span>
        </div>
        <button onClick={onClose} className="btn btn-danger" style={{ fontSize: '0.85rem' }}>
          Thoát
        </button>
      </div>

      {/* Canvas Area */}
      <div style={{ flexGrow: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>

        {/* The Game Canvas */}
        <canvas
          ref={canvasRef}
          width={440}
          height={440}
          style={{
            background: '#0a0814',
            borderRadius: '12px',
            border: '2px solid rgba(255, 255, 255, 0.1)',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
          }}
        />

        {/* Start Game Overlay */}
        {!isStarted && !gameOver && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', zIndex: 10, background: 'rgba(10,8,20,0.5)' }}>
            <span style={{ fontSize: '3rem', marginBottom: '14px' }}>🐍</span>
            <button onClick={startGame} className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Play size={16} fill="white" /> Bắt đầu chơi
            </button>
          </div>
        )}

        {/* Game Over Overlay */}
        {gameOver && (
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(10,8,20,0.85)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', borderRadius: '12px', zIndex: 10 }}>
            <span style={{ fontSize: '3rem', marginBottom: '10px' }}>💀</span>
            <h3 style={{ color: '#e74c3c', fontSize: '1.8rem', fontWeight: 800, marginBottom: '6px' }}>Kết Thúc Ván!</h3>
            <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.9rem', marginBottom: '16px' }}>
              Điểm số của bạn: **{score}**
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
        💡 Nhấn các phím mũi tên ⬅️ ⬆️ ➡️ ⬇️ hoặc phím WASD để điều khiển rắn đổi hướng. Ăn chấm đỏ để ghi điểm và phát triển độ dài.
      </div>
    </div>
  );
};
