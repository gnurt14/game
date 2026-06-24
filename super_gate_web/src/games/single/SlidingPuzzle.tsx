import React, { useState, useEffect } from 'react';
import { RefreshCw } from 'lucide-react';
import { CoinService } from '../../services/coinService';
import confetti from 'canvas-confetti';

interface SlidingPuzzleProps {
  onClose: () => void;
}

export const SlidingPuzzle: React.FC<SlidingPuzzleProps> = ({ onClose }) => {
  const [gridSize, setGridSize] = useState<number>(3); // 3x3 or 4x4
  const [tiles, setTiles] = useState<number[]>([]);
  const [moves, setMoves] = useState<number>(0);
  const [won, setWon] = useState<boolean>(false);
  const [earnedCoins, setEarnedCoins] = useState<number | null>(null);

  // Initialize game
  const initGame = (size: number) => {
    let newTiles: number[] = [];
    do {
      newTiles = shuffleTiles(size);
    } while (!isSolvable(newTiles, size) || isSolved(newTiles));
    
    setTiles(newTiles);
    setGridSize(size);
    setMoves(0);
    setWon(false);
    setEarnedCoins(null);
  };

  useEffect(() => {
    initGame(3);
  }, []);

  // Listen to keyboard arrow keys
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (won) return;
      const blankIndex = tiles.indexOf(0);
      const row = Math.floor(blankIndex / gridSize);
      const col = blankIndex % gridSize;

      let targetIndex = -1;
      if (e.key === 'ArrowUp' && row < gridSize - 1) {
        targetIndex = blankIndex + gridSize; // Slide up -> tile below moves into blank space
      } else if (e.key === 'ArrowDown' && row > 0) {
        targetIndex = blankIndex - gridSize; // Slide down -> tile above moves into blank space
      } else if (e.key === 'ArrowLeft' && col < gridSize - 1) {
        targetIndex = blankIndex + 1; // Slide left -> tile to the right moves into blank space
      } else if (e.key === 'ArrowRight' && col > 0) {
        targetIndex = blankIndex - 1; // Slide right -> tile to the left moves into blank space
      }

      if (targetIndex !== -1) {
        slideTile(targetIndex);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [tiles, won, gridSize]);

  // Shuffle tiles
  const shuffleTiles = (size: number): number[] => {
    const count = size * size;
    const arr = Array.from({ length: count - 1 }, (_, i) => i + 1);
    arr.push(0); // 0 representing blank space
    
    // Fisher-Yates shuffle
    for (let i = arr.length - 2; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const temp = arr[i];
      arr[i] = arr[j];
      arr[j] = temp;
    }
    return arr;
  };

  // Check solvability of the board
  const isSolvable = (arr: number[], size: number): boolean => {
    let inversions = 0;
    const count = size * size;
    for (let i = 0; i < count; i++) {
      for (let j = i + 1; j < count; j++) {
        if (arr[i] !== 0 && arr[j] !== 0 && arr[i] > arr[j]) {
          inversions++;
        }
      }
    }
    if (size % 2 !== 0) {
      return inversions % 2 === 0;
    } else {
      const blankIndex = arr.indexOf(0);
      const blankRowFromBottom = size - Math.floor(blankIndex / size);
      if (blankRowFromBottom % 2 === 0) {
        return inversions % 2 !== 0;
      } else {
        return inversions % 2 === 0;
      }
    }
  };

  // Check if solved
  const isSolved = (arr: number[]): boolean => {
    if (arr.length === 0) return false;
    for (let i = 0; i < arr.length - 1; i++) {
      if (arr[i] !== i + 1) return false;
    }
    return arr[arr.length - 1] === 0;
  };

  const slideTile = async (index: number) => {
    if (won) return;
    
    const blankIndex = tiles.indexOf(0);
    const row = Math.floor(index / gridSize);
    const col = index % gridSize;
    const blankRow = Math.floor(blankIndex / gridSize);
    const blankCol = blankIndex % gridSize;

    // Check if clicked tile is adjacent to blank tile
    const isAdjacent = Math.abs(row - blankRow) + Math.abs(col - blankCol) === 1;
    if (!isAdjacent) return;

    const nextTiles = [...tiles];
    nextTiles[blankIndex] = tiles[index];
    nextTiles[index] = 0;
    
    setTiles(nextTiles);
    setMoves((prev) => prev + 1);

    if (isSolved(nextTiles)) {
      setWon(true);
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 }
      });
      // Award coins
      const coins = await CoinService.reportGameScore('sliding_puzzle', { won: true, level: gridSize, moves: moves + 1 });
      setEarnedCoins(coins);
      await CoinService.recordGamePlayed('Sliding Puzzle');
    }
  };

  return (
    <div className="glass fullscreen-game-container">
      
      {/* Title Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: 'var(--border-glass)', paddingBottom: '14px', marginBottom: '20px' }}>
        <div>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 800 }}>Sliding Puzzle</h2>
          <span style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)' }}>
            Lượt đi: **{moves}** | Kích thước: {gridSize}x{gridSize}
          </span>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button onClick={() => initGame(gridSize === 3 ? 4 : 3)} className="btn btn-secondary" style={{ fontSize: '0.85rem' }}>
            Đổi sang {gridSize === 3 ? '4x4' : '3x3'}
          </button>
          <button onClick={() => initGame(gridSize)} className="btn btn-secondary" style={{ padding: '8px 12px' }}>
            <RefreshCw size={16} />
          </button>
          <button onClick={onClose} className="btn btn-danger" style={{ fontSize: '0.85rem' }}>
            Thoát
          </button>
        </div>
      </div>

      {/* Main Game Board */}
      <div style={{ flexGrow: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
        
        {/* Game Grid Box */}
        <div 
          style={{
            display: 'grid',
            gridTemplateColumns: `repeat(${gridSize}, 1fr)`,
            gap: '8px',
            width: '100%',
            maxWidth: 'min(440px, 80vh - 180px, 90vw)',
            aspectRatio: '1',
            background: 'rgba(0,0,0,0.2)',
            padding: '12px',
            borderRadius: '16px',
            border: 'var(--border-glass)'
          }}
        >
          {tiles.map((tile, idx) => {
            const isBlank = tile === 0;
            return (
              <div
                key={idx}
                onClick={() => slideTile(idx)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: '8px',
                  background: isBlank 
                    ? 'transparent' 
                    : 'linear-gradient(135deg, var(--primary-color) 0%, #a29bfe 100%)',
                  boxShadow: isBlank ? 'none' : '0 4px 10px rgba(124, 111, 255, 0.2)',
                  color: 'white',
                  fontWeight: 800,
                  fontSize: gridSize === 3 ? '1.8rem' : '1.4rem',
                  cursor: isBlank ? 'default' : 'pointer',
                  transition: 'all 0.15s ease-in-out',
                  userSelect: 'none',
                  border: isBlank ? 'none' : '1px solid rgba(255, 255, 255, 0.15)'
                }}
                className={isBlank ? '' : 'glass-interactive'}
              >
                {!isBlank && tile}
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
              Bạn giải được lưới {gridSize}x{gridSize} trong **{moves}** lượt đi.
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
      
      {/* Keyboard guide tip */}
      <div style={{ textAlign: 'center', fontSize: '0.75rem', color: 'var(--color-text-muted)', fontWeight: 500 }}>
        💡 Nhấp chuột vào ô cạnh ô trống để trượt, hoặc sử dụng các phím mũi tên ⬅️ ⬆️ ➡️ ⬇️ trên bàn phím.
      </div>
    </div>
  );
};
