import React, { useState, useEffect, useRef } from 'react';
import { RefreshCw } from 'lucide-react';
import { CoinService } from '../../services/coinService';
import confetti from 'canvas-confetti';

interface Game2048Props {
  onClose: () => void;
}

type Tile = {
  id: number;
  value: number;
  row: number;
  col: number;
  merged?: boolean;
};

export const Game2048: React.FC<Game2048Props> = ({ onClose }) => {
  const [board, setBoard] = useState<Tile[]>([]);
  const [score, setScore] = useState<number>(0);
  const [gameOver, setGameOver] = useState<boolean>(false);
  const [gameWon, setGameWon] = useState<boolean>(false);
  const [hasWonBefore, setHasWonBefore] = useState<boolean>(false);
  const [earnedCoins, setEarnedCoins] = useState<number | null>(null);
  
  const tileIdCounter = useRef<number>(0);

  const initGame = () => {
    tileIdCounter.current = 0;
    setScore(0);
    setGameOver(false);
    setGameWon(false);
    setHasWonBefore(false);
    setEarnedCoins(null);

    // Start with 2 random tiles
    let newBoard: Tile[] = [];
    newBoard = addRandomTile(newBoard);
    newBoard = addRandomTile(newBoard);
    setBoard(newBoard);
  };

  useEffect(() => {
    initGame();
  }, []);

  const addRandomTile = (currentBoard: Tile[]): Tile[] => {
    const occupied = new Set(currentBoard.map(t => `${t.row},${t.col}`));
    const emptyCells: { r: number; c: number }[] = [];

    for (let r = 0; r < 4; r++) {
      for (let c = 0; c < 4; c++) {
        if (!occupied.has(`${r},${c}`)) {
          emptyCells.push({ r, c });
        }
      }
    }

    if (emptyCells.length === 0) return currentBoard;

    const randomCell = emptyCells[Math.floor(Math.random() * emptyCells.length)];
    const value = Math.random() < 0.9 ? 2 : 4;
    const newTile: Tile = {
      id: tileIdCounter.current++,
      value,
      row: randomCell.r,
      col: randomCell.c
    };

    return [...currentBoard, newTile];
  };

  const getTileAt = (boardState: Tile[], r: number, c: number) => {
    return boardState.find(t => t.row === r && t.col === c);
  };

  const move = (direction: 'up' | 'down' | 'left' | 'right') => {
    if (gameOver) return;

    let hasMoved = false;
    let nextBoard: Tile[] = board.map(t => ({ ...t, merged: false }));
    let nextScore = score;

    const isVertical = direction === 'up' || direction === 'down';
    const isForward = direction === 'down' || direction === 'right';

    // Loop lines (rows or cols)
    for (let i = 0; i < 4; i++) {
      // Collect tiles along the line
      const lineTiles: Tile[] = [];
      for (let j = 0; j < 4; j++) {
        const r = isVertical ? j : i;
        const c = isVertical ? i : j;
        const t = getTileAt(nextBoard, r, c);
        if (t) lineTiles.push(t);
      }

      // Sort lineTiles based on move direction
      if (isForward) {
        lineTiles.reverse();
      }

      // Perform sliding and merging
      const mergedLine: Tile[] = [];
      for (let j = 0; j < lineTiles.length; j++) {
        const current = lineTiles[j];
        if (j + 1 < lineTiles.length && lineTiles[j + 1].value === current.value) {
          // Merge
          const newValue = current.value * 2;
          nextScore += newValue;
          
          mergedLine.push({
            id: current.id,
            value: newValue,
            row: current.row, // Temporary, will re-assign index
            col: current.col,
            merged: true
          });
          
          // Remove the merged companion tile from board completely
          nextBoard = nextBoard.filter(t => t.id !== lineTiles[j + 1].id);
          hasMoved = true;
          j++; // Skip next tile
        } else {
          mergedLine.push(current);
        }
      }

      // Re-assign grid positions based on merge result
      mergedLine.forEach((tile, index) => {
        const finalJ = isForward ? 3 - index : index;
        const targetRow = isVertical ? finalJ : i;
        const targetCol = isVertical ? i : finalJ;

        const originalTile = nextBoard.find(t => t.id === tile.id);
        if (originalTile) {
          if (originalTile.row !== targetRow || originalTile.col !== targetCol || tile.value !== originalTile.value) {
            originalTile.row = targetRow;
            originalTile.col = targetCol;
            originalTile.value = tile.value;
            hasMoved = true;
          }
        }
      });
    }

    if (hasMoved) {
      const updatedBoard = addRandomTile(nextBoard);
      setBoard(updatedBoard);
      setScore(nextScore);
      checkGameStatus(updatedBoard, nextScore);
    }
  };

  const checkGameStatus = (currentBoard: Tile[], currentScore: number) => {
    // Check for 2048 win
    const reach2048 = currentBoard.some(t => t.value === 2048);
    if (reach2048 && !hasWonBefore) {
      setGameWon(true);
      setHasWonBefore(true);
      confetti({
        particleCount: 120,
        spread: 80,
        origin: { y: 0.5 }
      });
      // Reward coins
      CoinService.reportGameScore('2048', { won: true, score: currentScore })
        .then(coins => setEarnedCoins(coins));
      CoinService.recordGamePlayed('2048');
    }

    // Check game over (no empty cells and no matches)
    if (currentBoard.length === 16) {
      let movesPossible = false;
      for (let r = 0; r < 4; r++) {
        for (let c = 0; c < 4; c++) {
          const t = getTileAt(currentBoard, r, c);
          if (!t) continue;
          
          // Check right
          if (c < 3) {
            const right = getTileAt(currentBoard, r, c + 1);
            if (right && right.value === t.value) movesPossible = true;
          }
          // Check down
          if (r < 3) {
            const down = getTileAt(currentBoard, r + 1, c);
            if (down && down.value === t.value) movesPossible = true;
          }
        }
      }

      if (!movesPossible) {
        setGameOver(true);
        if (!gameWon) {
          CoinService.reportGameScore('2048', { won: false, score: currentScore })
            .then(coins => setEarnedCoins(coins));
          CoinService.recordGamePlayed('2048');
        }
      }
    }
  };

  // Keyboard controls
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (gameOver) return;
      if (e.key === 'ArrowUp' || e.key === 'w') {
        e.preventDefault();
        move('up');
      } else if (e.key === 'ArrowDown' || e.key === 's') {
        e.preventDefault();
        move('down');
      } else if (e.key === 'ArrowLeft' || e.key === 'a') {
        e.preventDefault();
        move('left');
      } else if (e.key === 'ArrowRight' || e.key === 'd') {
        e.preventDefault();
        move('right');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [board, gameOver, score, gameWon]);

  // Touch Swipe controls
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  
  const handleTouchStart = (e: React.TouchEvent) => {
    const t = e.touches[0];
    touchStart.current = { x: t.clientX, y: t.clientY };
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!touchStart.current) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - touchStart.current.x;
    const dy = t.clientY - touchStart.current.y;
    
    const absX = Math.abs(dx);
    const absY = Math.abs(dy);
    
    if (Math.max(absX, absY) > 30) { // Threshold
      if (absX > absY) {
        move(dx > 0 ? 'right' : 'left');
      } else {
        move(dy > 0 ? 'down' : 'up');
      }
    }
    touchStart.current = null;
  };

  // UI styling helper
  const getTileStyle = (val: number) => {
    const styles: Record<number, { bg: string; color: string; size?: string }> = {
      2: { bg: '#eee4da', color: '#776e65' },
      4: { bg: '#ede0c8', color: '#776e65' },
      8: { bg: '#f2b179', color: '#f9f6f2' },
      16: { bg: '#f59563', color: '#f9f6f2' },
      32: { bg: '#f67c5f', color: '#f9f6f2' },
      64: { bg: '#f65e3b', color: '#f9f6f2' },
      128: { bg: '#edcf72', color: '#f9f6f2', size: '1.4rem' },
      256: { bg: '#edcc61', color: '#f9f6f2', size: '1.4rem' },
      512: { bg: '#edc850', color: '#f9f6f2', size: '1.4rem' },
      1024: { bg: '#edc53f', color: '#f9f6f2', size: '1.25rem' },
      2048: { bg: '#edc22e', color: '#f9f6f2', size: '1.25rem' },
    };
    
    const base = styles[val] || { bg: '#3c3a32', color: '#f9f6f2', size: '1.1rem' };
    return {
      background: base.bg,
      color: base.color,
      fontSize: base.size || '1.8rem'
    };
  };

  return (
    <div className="glass fullscreen-game-container">
      
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: 'var(--border-glass)', paddingBottom: '14px', marginBottom: '20px' }}>
        <div>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 800 }}>Game 2048</h2>
          <span style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)' }}>
            Điểm số: <strong style={{ color: 'var(--primary-color)', fontSize: '1rem' }}>{score}</strong>
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
      <div 
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        style={{ flexGrow: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}
      >
        
        {/* The 2048 Board Grid */}
        <div 
          style={{
            position: 'relative',
            width: '100%',
            maxWidth: 'min(440px, 80vh - 180px, 90vw)',
            aspectRatio: '1',
            background: 'rgba(0,0,0,0.3)',
            padding: '12px',
            borderRadius: '16px',
            border: 'var(--border-glass)',
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gridTemplateRows: 'repeat(4, 1fr)',
            gap: '8px',
          }}
        >
          {/* Background grid cells */}
          {Array.from({ length: 16 }).map((_, idx) => (
            <div 
              key={idx} 
              style={{ 
                background: 'rgba(255, 255, 255, 0.05)', 
                borderRadius: '8px', 
                border: '1px solid rgba(255, 255, 255, 0.02)' 
              }} 
            />
          ))}

          {/* Active tiles absolute layer */}
          {board.map((tile) => {
            const tileStyle = getTileStyle(tile.value);
            return (
              <div
                key={tile.id}
                style={{
                  position: 'absolute',
                  width: 'calc(25% - 12px)',
                  height: 'calc(25% - 12px)',
                  left: `calc(${tile.col * 25}% + 12px + ${tile.col * 2}px)`,
                  top: `calc(${tile.row * 25}% + 12px + ${tile.row * 2}px)`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: '8px',
                  fontWeight: 800,
                  transition: 'all 0.1s ease-in-out',
                  boxShadow: '0 4px 8px rgba(0,0,0,0.2)',
                  userSelect: 'none',
                  ...tileStyle
                }}
              >
                {tile.value}
              </div>
            );
          })}
        </div>

        {/* Win Modal Overlay */}
        {gameWon && (
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(10,8,20,0.85)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', borderRadius: '12px', zIndex: 10 }}>
            <span style={{ fontSize: '3rem', marginBottom: '10px' }}>👑</span>
            <h3 style={{ color: '#2ecc71', fontSize: '1.8rem', fontWeight: 800, marginBottom: '6px' }}>Đạt mốc 2048!</h3>
            <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.9rem', marginBottom: '16px' }}>
              Chúc mừng bạn đã ghép được khối **2048**! Điểm số: **{score}**
            </p>
            {earnedCoins !== null && (
              <span style={{ fontSize: '1.2rem', fontWeight: 800, color: '#f1c40f', marginBottom: '24px' }}>
                🪙 +{earnedCoins} xu thưởng!
              </span>
            )}
            
            <div style={{ display: 'flex', gap: '10px' }}>
              <button 
                onClick={() => {
                  setGameWon(false);
                  // Keep playing
                }} 
                className="btn btn-primary"
              >
                Chơi tiếp
              </button>
              <button onClick={initGame} className="btn btn-secondary">
                Chơi lại
              </button>
            </div>
          </div>
        )}

        {/* Game Over Modal Overlay */}
        {gameOver && (
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(10,8,20,0.85)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', borderRadius: '12px', zIndex: 10 }}>
            <span style={{ fontSize: '3rem', marginBottom: '10px' }}>💀</span>
            <h3 style={{ color: '#e74c3c', fontSize: '1.8rem', fontWeight: 800, marginBottom: '6px' }}>Game Over!</h3>
            <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.9rem', marginBottom: '16px' }}>
              Không còn nước đi khả dụng. Điểm số của bạn: **{score}**
            </p>
            {earnedCoins !== null && (
              <span style={{ fontSize: '1.2rem', fontWeight: 800, color: '#f1c40f', marginBottom: '24px' }}>
                🪙 +{earnedCoins} xu thưởng!
              </span>
            )}
            
            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={initGame} className="btn btn-primary">
                Chơi lại
              </button>
              <button onClick={onClose} className="btn btn-secondary">
                Thoát
              </button>
            </div>
          </div>
        )}

      </div>

      {/* Control Tips */}
      <div style={{ textAlign: 'center', fontSize: '0.75rem', color: 'var(--color-text-muted)', fontWeight: 500 }}>
        💡 Nhấn các phím mũi tên ⬅️ ⬆️ ➡️ ⬇️ hoặc phím WASD để trượt các ô số. Vuốt trên màn hình cảm ứng để chơi.
      </div>
    </div>
  );
};
