import React, { useState, useEffect } from 'react';
import { RefreshCw } from 'lucide-react';
import { CoinService } from '../../services/coinService';
import confetti from 'canvas-confetti';

interface SudokuProps {
  onClose: () => void;
}

type Difficulty = 'easy' | 'medium' | 'hard';

export const Sudoku: React.FC<SudokuProps> = ({ onClose }) => {
  const [difficulty, setDifficulty] = useState<Difficulty>('easy');
  
  // 9x9 grid: initial (0 for empty), current board, and solution board
  const [initialBoard, setInitialBoard] = useState<number[][]>([]);
  const [board, setBoard] = useState<number[][]>([]);
  const [solution, setSolution] = useState<number[][]>([]);
  
  // Pencil notes: 9x9 grid, each cell contains a set of numbers 1-9
  const [notes, setNotes] = useState<Record<string, number[]>>({});
  const [isNotesMode, setIsNotesMode] = useState<boolean>(false);

  const [selectedCell, setSelectedCell] = useState<{ r: number; c: number } | null>(null);
  const [seconds, setSeconds] = useState<number>(0);
  const [timerActive, setTimerActive] = useState<boolean>(false);
  const [won, setWon] = useState<boolean>(false);
  const [errorsCount, setErrorsCount] = useState<number>(0);
  const [earnedCoins, setEarnedCoins] = useState<number | null>(null);

  // Generate sudoku board
  const generatePuzzle = (diff: Difficulty) => {
    // Standard completed board template
    const base = [
      [1, 2, 3, 4, 5, 6, 7, 8, 9],
      [4, 5, 6, 7, 8, 9, 1, 2, 3],
      [7, 8, 9, 1, 2, 3, 4, 5, 6],
      [2, 3, 1, 5, 6, 4, 8, 9, 7],
      [5, 6, 4, 8, 9, 7, 2, 3, 1],
      [8, 9, 7, 2, 3, 1, 5, 6, 4],
      [3, 1, 2, 6, 4, 5, 9, 7, 8],
      [6, 4, 5, 9, 7, 8, 3, 1, 2],
      [9, 7, 8, 3, 1, 2, 6, 4, 5],
    ];

    // Shuffle operations to randomize the board while maintaining validity
    const sol = shuffleSudoku(base);

    // Remove cells based on difficulty
    const cellsToRemove = diff === 'easy' ? 32 : diff === 'medium' ? 45 : 55;
    const newBoard = sol.map(row => [...row]);
    
    let removed = 0;
    while (removed < cellsToRemove) {
      const r = Math.floor(Math.random() * 9);
      const c = Math.floor(Math.random() * 9);
      if (newBoard[r][c] !== 0) {
        newBoard[r][c] = 0;
        removed++;
      }
    }

    setInitialBoard(newBoard.map(row => [...row]));
    setBoard(newBoard);
    setSolution(sol);
    setNotes({});
    setSelectedCell(null);
    setSeconds(0);
    setTimerActive(true);
    setWon(false);
    setErrorsCount(0);
    setEarnedCoins(null);
  };

  const shuffleSudoku = (grid: number[][]): number[][] => {
    let result = grid.map(row => [...row]);

    // 1. Swap number mappings (e.g. swap all 1s with 5s)
    const numbers = [1, 2, 3, 4, 5, 6, 7, 8, 9];
    // Shuffle mapping
    for (let i = numbers.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const temp = numbers[i];
      numbers[i] = numbers[j];
      numbers[j] = temp;
    }
    result = result.map(row => row.map(val => numbers[val - 1]));

    // Helper to swap rows
    const swapRows = (r1: number, r2: number) => {
      const temp = result[r1];
      result[r1] = result[r2];
      result[r2] = temp;
    };

    // Helper to swap columns
    const swapCols = (c1: number, c2: number) => {
      for (let r = 0; r < 9; r++) {
        const temp = result[r][c1];
        result[r][c1] = result[r][c2];
        result[r][c2] = temp;
      }
    };

    // 2. Swap rows within blocks of 3
    for (let block = 0; block < 3; block++) {
      const r1 = block * 3 + Math.floor(Math.random() * 3);
      const r2 = block * 3 + Math.floor(Math.random() * 3);
      if (r1 !== r2) swapRows(r1, r2);
    }

    // 3. Swap cols within blocks of 3
    for (let block = 0; block < 3; block++) {
      const c1 = block * 3 + Math.floor(Math.random() * 3);
      const c2 = block * 3 + Math.floor(Math.random() * 3);
      if (c1 !== c2) swapCols(c1, c2);
    }

    return result;
  };

  useEffect(() => {
    generatePuzzle(difficulty);
  }, [difficulty]);

  // Timer effect
  useEffect(() => {
    let interval: any = null;
    if (timerActive && !won) {
      interval = setInterval(() => {
        setSeconds((prev) => prev + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [timerActive, won]);

  const formatTime = (sec: number): string => {
    const mins = Math.floor(sec / 60);
    const secs = sec % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  // Check if cell has conflicts with others on the board
  const hasConflict = (r: number, c: number, val: number): boolean => {
    if (val === 0) return false;

    // Row conflict
    for (let col = 0; col < 9; col++) {
      if (col !== c && board[r][col] === val) return true;
    }

    // Column conflict
    for (let row = 0; row < 9; row++) {
      if (row !== r && board[row][c] === val) return true;
    }

    // 3x3 block conflict
    const startRow = Math.floor(r / 3) * 3;
    const startCol = Math.floor(c / 3) * 3;
    for (let row = startRow; row < startRow + 3; row++) {
      for (let col = startCol; col < startCol + 3; col++) {
        if ((row !== r || col !== c) && board[row][col] === val) return true;
      }
    }

    return false;
  };

  const handleCellClick = (r: number, c: number) => {
    if (initialBoard[r][c] !== 0 || won) return;
    setSelectedCell({ r, c });
  };

  const handleNumberInput = async (num: number) => {
    if (!selectedCell || won) return;
    const { r, c } = selectedCell;

    if (isNotesMode) {
      // Toggle note
      const key = `${r},${c}`;
      const cellNotes = notes[key] || [];
      const updatedNotes = cellNotes.includes(num)
        ? cellNotes.filter(n => n !== num)
        : [...cellNotes, num].sort();

      setNotes({ ...notes, [key]: updatedNotes });
      
      // Clear main value if any
      const nextBoard = board.map(row => [...row]);
      nextBoard[r][c] = 0;
      setBoard(nextBoard);
    } else {
      // Clear notes for this cell
      const key = `${r},${c}`;
      const nextNotes = { ...notes };
      delete nextNotes[key];
      setNotes(nextNotes);

      // Set value
      const nextBoard = board.map(row => [...row]);
      nextBoard[r][c] = num;
      setBoard(nextBoard);

      // Check if it's incorrect (solution mismatch)
      if (num !== 0 && solution[r][c] !== num) {
        setErrorsCount(prev => prev + 1);
      }

      // Check win condition
      checkWinCondition(nextBoard);
    }
  };

  const handleClearCell = () => {
    if (!selectedCell || won) return;
    const { r, c } = selectedCell;
    
    // Clear board cell
    const nextBoard = board.map(row => [...row]);
    nextBoard[r][c] = 0;
    setBoard(nextBoard);

    // Clear notes cell
    const key = `${r},${c}`;
    const nextNotes = { ...notes };
    delete nextNotes[key];
    setNotes(nextNotes);
  };

  const checkWinCondition = async (currentBoard: number[][]) => {
    // Verify board matches solution
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        if (currentBoard[r][c] !== solution[r][c]) {
          return; // Not solved yet
        }
      }
    }

    setWon(true);
    setTimerActive(false);
    confetti({
      particleCount: 100,
      spread: 70,
      origin: { y: 0.6 }
    });

    const diffLevel = difficulty === 'easy' ? 0 : difficulty === 'medium' ? 1 : 2;
    const coins = await CoinService.reportGameScore('sudoku', { won: true, level: diffLevel, seconds });
    setEarnedCoins(coins);
    await CoinService.recordGamePlayed('Sudoku');
  };

  // Keyboard support for digit inputs
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (won || !selectedCell) return;
      if (e.key >= '1' && e.key <= '9') {
        handleNumberInput(parseInt(e.key));
      } else if (e.key === 'Backspace' || e.key === 'Delete' || e.key === '0') {
        handleClearCell();
      } else if (e.key === 'ArrowUp' && selectedCell.r > 0) {
        setSelectedCell({ r: selectedCell.r - 1, c: selectedCell.c });
      } else if (e.key === 'ArrowDown' && selectedCell.r < 8) {
        setSelectedCell({ r: selectedCell.r + 1, c: selectedCell.c });
      } else if (e.key === 'ArrowLeft' && selectedCell.c > 0) {
        setSelectedCell({ r: selectedCell.r, c: selectedCell.c - 1 });
      } else if (e.key === 'ArrowRight' && selectedCell.c < 8) {
        setSelectedCell({ r: selectedCell.r, c: selectedCell.c + 1 });
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedCell, won, isNotesMode, notes, board]);

  return (
    <div className="glass fullscreen-game-container">
      
      {/* Title Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: 'var(--border-glass)', paddingBottom: '14px', marginBottom: '16px' }}>
        <div>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 800 }}>Sudoku</h2>
          <span style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)' }}>
            Độ khó: <strong>{difficulty.toUpperCase()}</strong> | Thời gian: <strong style={{ color: 'var(--primary-color)' }}>{formatTime(seconds)}</strong> | Lỗi: <strong style={{ color: errorsCount > 3 ? '#e74c3c' : 'white' }}>{errorsCount}</strong>
          </span>
        </div>
        
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <select 
            value={difficulty} 
            onChange={(e) => setDifficulty(e.target.value as Difficulty)}
            className="btn btn-secondary"
            style={{ fontSize: '0.85rem', padding: '6px 12px', background: 'rgba(0,0,0,0.3)', border: 'var(--border-glass)', color: 'white', borderRadius: '8px' }}
          >
            <option value="easy" style={{ background: '#110d21' }}>Dễ (Easy)</option>
            <option value="medium" style={{ background: '#110d21' }}>Vừa (Medium)</option>
            <option value="hard" style={{ background: '#110d21' }}>Khó (Hard)</option>
          </select>
          <button onClick={() => generatePuzzle(difficulty)} className="btn btn-secondary" style={{ padding: '8px 12px' }}>
            <RefreshCw size={16} />
          </button>
          <button onClick={onClose} className="btn btn-danger" style={{ fontSize: '0.85rem' }}>
            Thoát
          </button>
        </div>
      </div>

      {/* Main Area */}
      <div style={{ flexGrow: 1, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '30px', flexWrap: 'wrap' }}>
        
        {/* Sudoku Board Grid */}
        <div 
          style={{
            position: 'relative',
            display: 'grid',
            gridTemplateColumns: 'repeat(9, 1fr)',
            gridTemplateRows: 'repeat(9, 1fr)',
            width: '100%',
            maxWidth: 'min(460px, 80vh - 180px, 90vw)',
            aspectRatio: '1',
            background: 'rgba(0,0,0,0.4)',
            padding: '4px',
            borderRadius: '12px',
            border: '2px solid rgba(255,255,255,0.15)',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
          }}
        >
          {board.map((rowArr, rIdx) => 
            rowArr.map((cellVal, cIdx) => {
              const isInitial = initialBoard[rIdx]?.[cIdx] !== 0;
              const isSelected = selectedCell?.r === rIdx && selectedCell?.c === cIdx;
              
              // Determine background color
              let cellBg = 'transparent';
              if (isSelected) {
                cellBg = 'rgba(124, 111, 255, 0.4)';
              } else if (selectedCell && (selectedCell.r === rIdx || selectedCell.c === cIdx || (Math.floor(selectedCell.r / 3) === Math.floor(rIdx / 3) && Math.floor(selectedCell.c / 3) === Math.floor(cIdx / 3)))) {
                cellBg = 'rgba(255, 255, 255, 0.03)';
              }

              const hasErr = cellVal !== 0 && solution[rIdx]?.[cIdx] !== cellVal;
              const conflict = hasConflict(rIdx, cIdx, cellVal);
              const cellNotes = notes[`${rIdx},${cIdx}`] || [];

              // Borders for 3x3 blocks
              const borderRight = (cIdx === 2 || cIdx === 5) ? '2px solid rgba(255, 255, 255, 0.3)' : '1px solid rgba(255, 255, 255, 0.08)';
              const borderBottom = (rIdx === 2 || rIdx === 5) ? '2px solid rgba(255, 255, 255, 0.3)' : '1px solid rgba(255, 255, 255, 0.08)';

              return (
                <div
                  key={`${rIdx}-${cIdx}`}
                  onClick={() => handleCellClick(rIdx, cIdx)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: isInitial ? 'default' : 'pointer',
                    background: cellBg,
                    borderRight,
                    borderBottom,
                    fontWeight: isInitial ? 800 : 500,
                    color: isInitial 
                      ? '#ffffff' 
                      : hasErr || conflict
                        ? '#e74c3c' 
                        : '#7c6fff',
                    fontSize: '1.25rem',
                    position: 'relative',
                    userSelect: 'none',
                    transition: 'background 0.1s ease',
                  }}
                >
                  {cellVal !== 0 ? (
                    cellVal
                  ) : (
                    // Display pencil notes inside empty cell
                    <div style={{
                      position: 'absolute',
                      inset: '2px',
                      display: 'grid',
                      gridTemplateColumns: 'repeat(3, 1fr)',
                      gridTemplateRows: 'repeat(3, 1fr)',
                      fontSize: '0.55rem',
                      lineHeight: 1,
                      color: 'var(--color-text-muted)',
                      textAlign: 'center',
                      pointerEvents: 'none',
                    }}>
                      {Array.from({ length: 9 }).map((_, n) => {
                        const noteNum = n + 1;
                        return (
                          <div key={n} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            {cellNotes.includes(noteNum) ? noteNum : ''}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Sudoku Controls Pad */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', width: '100%', maxWidth: '200px' }}>
          
          {/* Notes Toggle Button */}
          <button 
            onClick={() => setIsNotesMode(!isNotesMode)}
            className="btn"
            style={{
              padding: '10px 16px',
              fontWeight: 700,
              fontSize: '0.85rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              border: isNotesMode ? '1px solid var(--primary-color)' : 'var(--border-glass)',
              background: isNotesMode ? 'rgba(124, 111, 255, 0.15)' : 'rgba(255, 255, 255, 0.05)',
              color: isNotesMode ? 'var(--primary-color)' : 'white'
            }}
          >
            ✏️ Notes: {isNotesMode ? 'Bật (ON)' : 'Tắt (OFF)'}
          </button>

          {/* 1-9 Numpad Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
              <button
                key={num}
                onClick={() => handleNumberInput(num)}
                className="btn btn-secondary glass-interactive"
                disabled={!selectedCell}
                style={{
                  height: '46px',
                  fontSize: '1.2rem',
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: 'rgba(255, 255, 255, 0.04)',
                  border: 'var(--border-glass)',
                  padding: 0,
                }}
              >
                {num}
              </button>
            ))}
          </div>

          {/* Delete Button */}
          <button 
            onClick={handleClearCell}
            className="btn btn-danger"
            disabled={!selectedCell}
            style={{ padding: '10px', fontSize: '0.85rem', fontWeight: 600 }}
          >
            Xóa số
          </button>
        </div>

        {/* Win Modal Overlay */}
        {won && (
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(10,8,20,0.85)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', borderRadius: '12px', zIndex: 10 }}>
            <span style={{ fontSize: '3rem', marginBottom: '10px' }}>🏆</span>
            <h3 style={{ color: '#2ecc71', fontSize: '1.8rem', fontWeight: 800, marginBottom: '6px' }}>Giải Sudoku Thành Công!</h3>
            <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.9rem', marginBottom: '16px' }}>
              Thời gian hoàn thành: **{formatTime(seconds)}** | Mắc lỗi: **{errorsCount}** lần.
            </p>
            {earnedCoins !== null && (
              <span style={{ fontSize: '1.2rem', fontWeight: 800, color: '#f1c40f', marginBottom: '24px' }}>
                🪙 +{earnedCoins} xu thưởng!
              </span>
            )}
            
            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={() => generatePuzzle(difficulty)} className="btn btn-primary">
                Lưới Mới
              </button>
              <button onClick={onClose} className="btn btn-secondary">
                Về Sảnh
              </button>
            </div>
          </div>
        )}

      </div>

      <div style={{ textAlign: 'center', fontSize: '0.75rem', color: 'var(--color-text-muted)', fontWeight: 500 }}>
        💡 Chọn ô trống và ấn các số 1-9 trên bàn phím hoặc bảng điều khiển bên cạnh. Phím Backspace để xóa. Bật Notes để nháp số.
      </div>
    </div>
  );
};
