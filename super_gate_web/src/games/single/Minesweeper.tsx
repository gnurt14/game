import React, { useState, useEffect, useMemo } from 'react';
import { RefreshCw, Flag, Eye, Lightbulb } from 'lucide-react';
import { CoinService } from '../../services/coinService';
import confetti from 'canvas-confetti';

const HINT_COST = 10;

interface MinesweeperProps {
  onClose: () => void;
}

interface Cell {
  r: number;
  c: number;
  isMine: boolean;
  isRevealed: boolean;
  isFlagged: boolean;
  adjacentMines: number;
}

type Difficulty = 'easy' | 'medium' | 'hard';

export const Minesweeper: React.FC<MinesweeperProps> = ({ onClose }) => {
  const [difficulty, setDifficulty] = useState<Difficulty>('easy');
  const [rows, setRows] = useState(9);
  const [cols, setCols] = useState(9);
  const [mineCount, setMineCount] = useState(10);

  const [grid, setGrid] = useState<Cell[][]>([]);
  const [firstTap, setFirstTap] = useState(true);
  const [gameOver, setGameOver] = useState(false);
  const [won, setWon] = useState(false);
  const [flagMode, setFlagMode] = useState(false); // Mode for mobile tapping: reveal or flag
  const [seconds, setSeconds] = useState(0);

  // ⚠️ flagsCount derive từ grid (single source of truth, tránh drift)
  const flagsCount = useMemo(() => {
    let n = 0;
    for (const row of grid) for (const cell of row) if (cell.isFlagged) n++;
    return n;
  }, [grid]);
  const [earnedCoins, setEarnedCoins] = useState<number | null>(null);
  const [coinBalance, setCoinBalance] = useState<number>(CoinService.getData().balance);

  useEffect(() => {
    const unsub = CoinService.subscribe((d) => setCoinBalance(d.balance));
    return () => { unsub(); };
  }, []);

  // Difficulty configs
  const configs = {
    easy: { r: 9, c: 9, mines: 10 },
    medium: { r: 16, c: 9, mines: 30 },
    hard: { r: 16, c: 16, mines: 55 }
  };

  const initGame = (diff: Difficulty) => {
    const config = configs[diff];
    setDifficulty(diff);
    setRows(config.r);
    setCols(config.c);
    setMineCount(config.mines);

    // Build empty grid
    const initialGrid: Cell[][] = [];
    for (let r = 0; r < config.r; r++) {
      const rowCells: Cell[] = [];
      for (let c = 0; c < config.c; c++) {
        rowCells.push({
          r,
          c,
          isMine: false,
          isRevealed: false,
          isFlagged: false,
          adjacentMines: 0
        });
      }
      initialGrid.push(rowCells);
    }

    setGrid(initialGrid);
    setFirstTap(true);
    setGameOver(false);
    setWon(false);
    setSeconds(0);
    setEarnedCoins(null);
  };

  // Timer effect
  useEffect(() => {
    initGame('easy');
  }, []);

  useEffect(() => {
    if (gameOver || won || firstTap) return;
    const interval = setInterval(() => {
      setSeconds((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [firstTap, gameOver, won]);

  const generateMines = (gridState: Cell[][], safeR: number, safeC: number) => {
    let minesPlaced = 0;
    while (minesPlaced < mineCount) {
      const r = Math.floor(Math.random() * rows);
      const c = Math.floor(Math.random() * cols);

      // Avoid placing mine on safe cell or adjacent to it for easy first-move
      const isSafeZone = Math.abs(r - safeR) <= 1 && Math.abs(c - safeC) <= 1;

      if (!gridState[r][c].isMine && !isSafeZone) {
        gridState[r][c].isMine = true;
        minesPlaced++;
      }
    }

    // Calculate adjacent numbers
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (gridState[r][c].isMine) continue;
        let count = 0;
        for (let dr = -1; dr <= 1; dr++) {
          for (let dc = -1; dc <= 1; dc++) {
            const nr = r + dr;
            const nc = c + dc;
            if (nr >= 0 && nr < rows && nc >= 0 && nc < cols) {
              if (gridState[nr][nc].isMine) count++;
            }
          }
        }
        gridState[r][c].adjacentMines = count;
      }
    }
  };

  const handleCellClick = (r: number, c: number) => {
    if (gameOver || won) return;

    if (flagMode) {
      toggleFlag(r, c);
      return;
    }

    // Dùng functional setGrid để luôn lấy state mới nhất (tránh stale closure)
    setGrid((prev) => {
      if (!prev[r] || !prev[r][c]) return prev;
      if (prev[r][c].isRevealed || prev[r][c].isFlagged) return prev;

      const next = prev.map((row) => row.map((cell) => ({ ...cell })));

      if (firstTap) {
        setFirstTap(false);
        generateMines(next, r, c);
      }

      if (next[r][c].isMine) {
        // reveal all mines
        for (let rr = 0; rr < rows; rr++) {
          for (let cc = 0; cc < cols; cc++) {
            if (next[rr][cc].isMine) next[rr][cc].isRevealed = true;
          }
        }
        setGameOver(true);
        return next;
      }

      revealCell(next, r, c);
      // schedule win check after this batch
      queueMicrotask(() => checkWinCondition(next));
      return next;
    });
  };

  const toggleFlag = (r: number, c: number, e?: React.MouseEvent) => {
    if (e) e.preventDefault(); // Prevent right click menu
    if (gameOver || won) return;

    setGrid((prev) => {
      if (!prev[r] || !prev[r][c]) return prev;
      const cell = prev[r][c];
      if (cell.isRevealed) return prev;

      // Đếm cờ thật từ grid (single source of truth)
      let currentFlags = 0;
      for (const row of prev) for (const cl of row) if (cl.isFlagged) currentFlags++;

      // Block nếu chưa cắm cờ + đã đủ flag = mineCount
      if (!cell.isFlagged && currentFlags >= mineCount) {
        return prev;
      }

      const next = prev.map((row) => row.map((cl) => ({ ...cl })));
      next[r][c].isFlagged = !cell.isFlagged;
      return next;
    });
  };

  const revealCell = (gridState: Cell[][], r: number, c: number) => {
    const cell = gridState[r][c];
    if (cell.isRevealed || cell.isFlagged) return;

    cell.isRevealed = true;

    // Recursive reveal for 0 mines adjacent
    if (cell.adjacentMines === 0 && !cell.isMine) {
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          const nr = r + dr;
          const nc = c + dc;
          if (nr >= 0 && nr < rows && nc >= 0 && nc < cols) {
            revealCell(gridState, nr, nc);
          }
        }
      }
    }
  };

  const useHint = async () => {
    if (gameOver || won) return;
    if (firstTap) return; // need to tap a first cell to generate mines
    if (coinBalance < HINT_COST) return;

    // Collect all safe (not mine), not revealed cells
    const safeCells: { r: number; c: number }[] = [];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const cell = grid[r][c];
        if (!cell.isMine && !cell.isRevealed) {
          safeCells.push({ r, c });
        }
      }
    }
    if (safeCells.length === 0) return;

    const ok = await CoinService.spendCoins(HINT_COST);
    if (!ok) return;

    const pick = safeCells[Math.floor(Math.random() * safeCells.length)];
    setGrid((prev) => {
      const next = prev.map((row) => row.map((cell) => ({ ...cell })));
      // Clear flag if any (cờ tự derive từ grid mới → không cần update count riêng)
      next[pick.r][pick.c].isFlagged = false;
      revealCell(next, pick.r, pick.c);
      queueMicrotask(() => checkWinCondition(next));
      return next;
    });
  };

  const checkWinCondition = async (gridState: Cell[][]) => {
    let unrevealedSafeCells = 0;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (!gridState[r][c].isMine && !gridState[r][c].isRevealed) {
          unrevealedSafeCells++;
        }
      }
    }

    if (unrevealedSafeCells === 0) {
      setWon(true);
      confetti({
        particleCount: 120,
        spread: 80,
        origin: { y: 0.6 }
      });
      // Settle score
      const diffIndex = difficulty === 'easy' ? 0 : difficulty === 'medium' ? 1 : 2;
      const coins = await CoinService.reportGameScore('minesweeper', { won: true, level: diffIndex, seconds });
      setEarnedCoins(coins);
      await CoinService.recordGamePlayed('Minesweeper');
    }
  };

  const getNumberColor = (num: number) => {
    const colors = [
      'transparent',
      '#3498db', // 1: Blue
      '#2ecc71', // 2: Green
      '#e74c3c', // 3: Red
      '#9b59b6', // 4: Purple
      '#e67e22', // 5: Orange
      '#1abc9c', // 6: Cyan
      '#f1c40f', // 7: Yellow
      '#34495e', // 8: Gray
    ];
    return colors[num] || 'white';
  };

  return (
    <div className="glass fullscreen-game-container">
      
      {/* Title Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: 'var(--border-glass)', paddingBottom: '14px', marginBottom: '20px' }}>
        <div>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 800 }}>Minesweeper</h2>
          <span style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)', display: 'flex', gap: '14px' }}>
            <span>🚩 {flagsCount} / {mineCount}</span>
            <span>⏱️ {seconds}s</span>
          </span>
        </div>
        
        {/* Actions */}
        <div style={{ display: 'flex', gap: '8px' }}>
          {/* Difficulty Chips */}
          {(['easy', 'medium', 'hard'] as const).map((diff) => (
            <button
              key={diff}
              onClick={() => initGame(diff)}
              className="btn btn-secondary"
              style={{
                fontSize: '0.75rem',
                padding: '6px 12px',
                background: difficulty === diff ? 'var(--primary-color)' : 'rgba(255,255,255,0.03)',
                color: 'white',
                border: 'none',
              }}
            >
              {diff.toUpperCase()}
            </button>
          ))}

          {/* Mode Switch for Mobile */}
          <button
            onClick={() => setFlagMode(!flagMode)}
            className="btn btn-secondary"
            style={{ padding: '8px', background: flagMode ? 'rgba(241, 196, 15, 0.15)' : 'rgba(255,255,255,0.03)', border: flagMode ? '1px solid #f1c40f' : 'var(--border-glass)' }}
            title={flagMode ? "Bấm vào ô để cắm cờ" : "Bấm vào ô để mở"}
          >
            {flagMode ? <Flag size={16} color="#f1c40f" /> : <Eye size={16} />}
          </button>

          {/* Hint Button — 10 xu */}
          {(() => {
            const hintDisabled = gameOver || won || firstTap || coinBalance < HINT_COST;
            return (
              <button
                onClick={useHint}
                disabled={hintDisabled}
                className="btn btn-secondary"
                title={firstTap ? 'Hãy mở 1 ô trước khi dùng gợi ý' : coinBalance < HINT_COST ? 'Không đủ xu' : 'Gợi ý 1 ô an toàn'}
                style={{
                  padding: '6px 10px',
                  fontSize: '0.75rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  background: hintDisabled ? 'rgba(255,255,255,0.03)' : 'rgba(241, 196, 15, 0.15)',
                  border: hintDisabled ? 'var(--border-glass)' : '1px solid #f1c40f',
                  color: hintDisabled ? 'rgba(255,255,255,0.4)' : '#f1c40f',
                  cursor: hintDisabled ? 'not-allowed' : 'pointer',
                  opacity: hintDisabled ? 0.6 : 1,
                  fontWeight: 700,
                }}
              >
                <Lightbulb size={14} />
                Gợi ý ({HINT_COST} xu)
              </button>
            );
          })()}
          
          <button onClick={() => initGame(difficulty)} className="btn btn-secondary" style={{ padding: '8px' }}>
            <RefreshCw size={16} />
          </button>
          
          <button onClick={onClose} className="btn btn-danger" style={{ fontSize: '0.85rem' }}>
            Thoát
          </button>
        </div>
      </div>

      {/* Main Board Container */}
      <div style={{ flexGrow: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'auto', position: 'relative' }}>
        
        {/* Visual Matrix grid */}
        <div
          onContextMenu={(e) => e.preventDefault()}
          style={{
            display: 'grid',
            gridTemplateRows: `repeat(${rows}, 1fr)`,
            gridTemplateColumns: `repeat(${cols}, 1fr)`,
            gap: '3px',
            width: '100%',
            maxWidth: difficulty === 'hard' ? 'min(560px, 80vh - 180px, 90vw)' : 'min(440px, 80vh - 180px, 90vw)',
            aspectRatio: `${cols}/${rows}`,
            background: 'rgba(0,0,0,0.3)',
            padding: '8px',
            borderRadius: '16px',
            border: 'var(--border-glass)'
          }}
        >
          {grid.map((row) =>
            row.map((cell) => {
              const isRev = cell.isRevealed;
              const hasNum = isRev && !cell.isMine && cell.adjacentMines > 0;
              const isM = isRev && cell.isMine;

              return (
                <div
                  key={`${cell.r}-${cell.c}`}
                  onClick={() => handleCellClick(cell.r, cell.c)}
                  onContextMenu={(e) => toggleFlag(cell.r, cell.c, e)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: difficulty === 'hard' ? '0.75rem' : '0.95rem',
                    fontWeight: 900,
                    borderRadius: '4px',
                    cursor: (gameOver || won) ? 'default' : 'pointer',
                    background: isRev 
                      ? cell.isMine 
                        ? 'var(--danger-color)' 
                        : 'rgba(255,255,255,0.06)' 
                      : 'linear-gradient(135deg, var(--bg-tertiary) 0%, rgba(124, 111, 255, 0.1) 100%)',
                    border: '1px solid rgba(255,255,255,0.05)',
                    color: getNumberColor(cell.adjacentMines),
                    userSelect: 'none',
                  }}
                >
                  {cell.isFlagged && !isRev && '🚩'}
                  {isM && '💣'}
                  {hasNum && cell.adjacentMines}
                </div>
              );
            })
          )}
        </div>

        {/* Win/Loss Modal */}
        {(gameOver || won) && (
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(10,8,20,0.85)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', borderRadius: '12px', zIndex: 10 }}>
            <span style={{ fontSize: '3rem', marginBottom: '10px' }}>{won ? '🏆' : '💥'}</span>
            <h3 style={{ color: won ? '#2ecc71' : '#e53935', fontSize: '1.8rem', fontWeight: 800, marginBottom: '6px' }}>
              {won ? 'Chiến Thắng!' : 'Bị Nổ Tung!'}
            </h3>
            <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.9rem', marginBottom: '16px' }}>
              Thời gian: **{seconds}** giây ở cấp độ **{difficulty.toUpperCase()}**.
            </p>
            {won && earnedCoins !== null && (
              <span style={{ fontSize: '1.2rem', fontWeight: 800, color: '#f1c40f', marginBottom: '24px' }}>
                🪙 +{earnedCoins} xu thưởng!
              </span>
            )}
            
            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={() => initGame(difficulty)} className="btn btn-primary">
                Chơi Lại
              </button>
              <button onClick={onClose} className="btn btn-secondary">
                Về Sảnh
              </button>
            </div>
          </div>
        )}

      </div>

      {/* Guide tip */}
      <div style={{ textAlign: 'center', fontSize: '0.75rem', color: 'var(--color-text-muted)', fontWeight: 500 }}>
        💡 Nhấp chuột trái để mở, nhấp chuột phải để cắm cờ. Trên di động: bật nút cắm cờ 🚩 rồi nhấp ô để cắm cờ.
      </div>
    </div>
  );
};
