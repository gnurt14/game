import React, { useState, useEffect } from 'react';
import { RefreshCw } from 'lucide-react';
import { CoinService } from '../../services/coinService';
import confetti from 'canvas-confetti';

interface TicTacToeProps {
  onClose: () => void;
}

type Cell = 'X' | 'O' | null;
type BoardState = Cell[];
type Difficulty = 'easy' | 'hard';

interface SizeConfig {
  size: number;     // grid dimension
  winLine: number;  // consecutive cells needed to win
  reward: number;
}

const SIZE_CONFIGS: SizeConfig[] = [
  { size: 3, winLine: 3, reward: 5 },
  { size: 5, winLine: 4, reward: 15 },
  { size: 7, winLine: 5, reward: 30 },
  { size: 9, winLine: 5, reward: 50 },
];

// Directions: right, down, down-right, down-left
const DIRECTIONS: [number, number][] = [
  [0, 1],   // →
  [1, 0],   // ↓
  [1, 1],   // ↘
  [1, -1],  // ↙
];

const checkWinner = (
  board: (string | null)[],
  size: number,
  winLine: number,
): { winner: string; line: number[] } | null => {
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      const idx = r * size + c;
      const v = board[idx];
      if (!v) continue;
      for (const [dr, dc] of DIRECTIONS) {
        const cells: number[] = [idx];
        let nr = r + dr;
        let nc = c + dc;
        while (
          nr >= 0 && nr < size && nc >= 0 && nc < size &&
          board[nr * size + nc] === v &&
          cells.length < winLine
        ) {
          cells.push(nr * size + nc);
          nr += dr;
          nc += dc;
        }
        if (cells.length === winLine) {
          return { winner: v, line: cells };
        }
      }
    }
  }
  return null;
};

const isBoardFull = (board: BoardState): boolean => board.every((c) => c !== null);

// ── AI Heuristic (for larger boards) ──────────────────────────────────────────
// Try to: 1) win now, 2) block opponent's win, 3) extend our longest chain,
// 4) play center on empty board.
const getHeuristicMove = (board: BoardState, size: number, winLine: number): number => {
  const total = size * size;

  // Empty board → pick center
  const filledCount = board.filter((c) => c !== null).length;
  if (filledCount === 0) {
    const mid = Math.floor(size / 2);
    return mid * size + mid;
  }

  // 1) Win now: any move that completes winLine
  for (let i = 0; i < total; i++) {
    if (board[i] !== null) continue;
    const test = [...board];
    test[i] = 'O';
    if (checkWinner(test, size, winLine)) return i;
  }

  // 2) Block opponent's immediate win
  for (let i = 0; i < total; i++) {
    if (board[i] !== null) continue;
    const test = [...board];
    test[i] = 'X';
    if (checkWinner(test, size, winLine)) return i;
  }

  // 3) Block opponent's open (winLine-1) chain — two threats
  const blockMove = findOpenChainBlock(board, size, winLine, 'X');
  if (blockMove !== -1) return blockMove;

  // 4) Extend our longest chain
  const extendMove = findBestExtension(board, size, winLine, 'O');
  if (extendMove !== -1) return extendMove;

  // 5) Fallback: random empty cell near center
  const emptyCells: number[] = [];
  for (let i = 0; i < total; i++) {
    if (board[i] === null) emptyCells.push(i);
  }
  if (emptyCells.length === 0) return -1;

  // Bias toward center
  const mid = (size - 1) / 2;
  emptyCells.sort((a, b) => {
    const ar = Math.floor(a / size), ac = a % size;
    const br = Math.floor(b / size), bc = b % size;
    const da = Math.abs(ar - mid) + Math.abs(ac - mid);
    const db = Math.abs(br - mid) + Math.abs(bc - mid);
    return da - db;
  });
  return emptyCells[0];
};

// Find a move that blocks an open chain of (winLine - 1) ours pieces with an empty cell at one end
const findOpenChainBlock = (
  board: BoardState,
  size: number,
  winLine: number,
  player: 'X' | 'O',
): number => {
  const need = winLine - 1;
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      const idx = r * size + c;
      if (board[idx] !== player) continue;
      for (const [dr, dc] of DIRECTIONS) {
        // Count consecutive 'player' starting at (r,c)
        const cells: number[] = [idx];
        let nr = r + dr, nc = c + dc;
        while (
          nr >= 0 && nr < size && nc >= 0 && nc < size &&
          board[nr * size + nc] === player
        ) {
          cells.push(nr * size + nc);
          nr += dr;
          nc += dc;
        }
        if (cells.length !== need) continue;

        // Check cell before start
        const br = r - dr;
        const bc = c - dc;
        const beforeIdx = (br >= 0 && br < size && bc >= 0 && bc < size) ? br * size + bc : -1;
        const afterIdx = (nr >= 0 && nr < size && nc >= 0 && nc < size) ? nr * size + nc : -1;

        const beforeEmpty = beforeIdx !== -1 && board[beforeIdx] === null;
        const afterEmpty = afterIdx !== -1 && board[afterIdx] === null;

        // Block any open end
        if (beforeEmpty) return beforeIdx;
        if (afterEmpty) return afterIdx;
      }
    }
  }
  return -1;
};

// Find best move to extend our chain (longest chain with at least one open end)
const findBestExtension = (
  board: BoardState,
  size: number,
  _winLine: number,
  player: 'X' | 'O',
): number => {
  let bestLen = 0;
  let bestMove = -1;

  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      const idx = r * size + c;
      if (board[idx] !== player) continue;
      for (const [dr, dc] of DIRECTIONS) {
        const cells: number[] = [idx];
        let nr = r + dr, nc = c + dc;
        while (
          nr >= 0 && nr < size && nc >= 0 && nc < size &&
          board[nr * size + nc] === player
        ) {
          cells.push(nr * size + nc);
          nr += dr;
          nc += dc;
        }

        const len = cells.length;
        const br = r - dr, bc = c - dc;
        const beforeIdx = (br >= 0 && br < size && bc >= 0 && bc < size) ? br * size + bc : -1;
        const afterIdx = (nr >= 0 && nr < size && nc >= 0 && nc < size) ? nr * size + nc : -1;

        const beforeEmpty = beforeIdx !== -1 && board[beforeIdx] === null;
        const afterEmpty = afterIdx !== -1 && board[afterIdx] === null;

        if (len > bestLen) {
          if (beforeEmpty) { bestLen = len; bestMove = beforeIdx; }
          else if (afterEmpty) { bestLen = len; bestMove = afterIdx; }
        }
      }
    }
  }
  return bestMove;
};

// ── Minimax for 3x3 only ──────────────────────────────────────────────────────
const minimax3x3 = (squares: BoardState, depth: number, isMaximizing: boolean): number => {
  const result = checkWinner(squares, 3, 3);
  if (result?.winner === 'O') return 10 - depth;
  if (result?.winner === 'X') return depth - 10;
  if (isBoardFull(squares)) return 0;

  if (isMaximizing) {
    let bestScore = -Infinity;
    for (let i = 0; i < squares.length; i++) {
      if (squares[i] === null) {
        squares[i] = 'O';
        const score = minimax3x3(squares, depth + 1, false);
        squares[i] = null;
        bestScore = Math.max(bestScore, score);
      }
    }
    return bestScore;
  } else {
    let bestScore = Infinity;
    for (let i = 0; i < squares.length; i++) {
      if (squares[i] === null) {
        squares[i] = 'X';
        const score = minimax3x3(squares, depth + 1, true);
        squares[i] = null;
        bestScore = Math.min(bestScore, score);
      }
    }
    return bestScore;
  }
};

const getAiMove3x3Hard = (board: BoardState): number => {
  let bestScore = -Infinity;
  let bestMove = -1;
  const copy = [...board];
  for (let i = 0; i < copy.length; i++) {
    if (copy[i] === null) {
      copy[i] = 'O';
      const score = minimax3x3(copy, 0, false);
      copy[i] = null;
      if (score > bestScore) {
        bestScore = score;
        bestMove = i;
      }
    }
  }
  return bestMove;
};

export const TicTacToe: React.FC<TicTacToeProps> = ({ onClose }) => {
  const [phase, setPhase] = useState<'select' | 'play'>('select');
  const [selectedConfig, setSelectedConfig] = useState<SizeConfig>(SIZE_CONFIGS[0]);
  const [config, setConfig] = useState<SizeConfig>(SIZE_CONFIGS[0]);

  const [board, setBoard] = useState<BoardState>(Array(9).fill(null));
  const [isXNext, setIsXNext] = useState<boolean>(true);
  const [difficulty, setDifficulty] = useState<Difficulty>('hard');
  const [winner, setWinner] = useState<'X' | 'O' | 'Draw' | null>(null);
  const [winLineCells, setWinLineCells] = useState<number[]>([]);
  const [isAiThinking, setIsAiThinking] = useState<boolean>(false);
  const [earnedCoins, setEarnedCoins] = useState<number | null>(null);

  const initGame = (cfg: SizeConfig) => {
    setConfig(cfg);
    setBoard(Array(cfg.size * cfg.size).fill(null));
    setIsXNext(true);
    setWinner(null);
    setWinLineCells([]);
    setIsAiThinking(false);
    setEarnedCoins(null);
  };

  const startGame = () => {
    initGame(selectedConfig);
    setPhase('play');
  };

  const goBackToSelect = () => {
    setPhase('select');
    setWinner(null);
  };

  // AI turn
  useEffect(() => {
    if (phase !== 'play') return;
    if (!isXNext && !winner && !isAiThinking) {
      setIsAiThinking(true);

      const timer = setTimeout(() => {
        let aiMove = -1;
        if (config.size === 3 && difficulty === 'hard') {
          aiMove = getAiMove3x3Hard(board);
        } else if (config.size === 3 && difficulty === 'easy') {
          const empty: number[] = [];
          for (let i = 0; i < board.length; i++) if (board[i] === null) empty.push(i);
          aiMove = empty.length > 0 ? empty[Math.floor(Math.random() * empty.length)] : -1;
        } else {
          // Larger boards always use heuristic
          aiMove = getHeuristicMove(board, config.size, config.winLine);
        }

        if (aiMove !== -1) {
          const nextBoard = [...board];
          nextBoard[aiMove] = 'O';
          setBoard(nextBoard);

          const result = checkWinner(nextBoard, config.size, config.winLine);
          if (result) {
            handleGameEnd(result.winner as 'X' | 'O', result.line);
          } else if (isBoardFull(nextBoard)) {
            handleGameEnd('Draw', []);
          } else {
            setIsXNext(true);
          }
        }
        setIsAiThinking(false);
      }, 400);

      return () => clearTimeout(timer);
    }
  }, [isXNext, board, winner, difficulty, config, phase]);

  const handleCellClick = (idx: number) => {
    if (board[idx] || winner || !isXNext || isAiThinking) return;

    const nextBoard = [...board];
    nextBoard[idx] = 'X';
    setBoard(nextBoard);

    const result = checkWinner(nextBoard, config.size, config.winLine);
    if (result) {
      handleGameEnd(result.winner as 'X' | 'O', result.line);
    } else if (isBoardFull(nextBoard)) {
      handleGameEnd('Draw', []);
    } else {
      setIsXNext(false);
    }
  };

  const handleGameEnd = async (gameWinner: 'X' | 'O' | 'Draw', line: number[]) => {
    setWinner(gameWinner);
    setWinLineCells(line);

    if (gameWinner === 'X') {
      confetti({ particleCount: 80, spread: 60, origin: { y: 0.6 } });
      await CoinService.earnCoins(config.reward);
      setEarnedCoins(config.reward);
    } else {
      setEarnedCoins(0);
    }

    await CoinService.recordGamePlayed('Tic-Tac-Toe');
  };

  // ── Render: Select phase ─────────────────────────────────────────────────────
  if (phase === 'select') {
    return (
      <div className="glass fullscreen-game-container">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: 'var(--border-glass)', paddingBottom: '14px', marginBottom: '20px' }}>
          <div>
            <h2 style={{ fontSize: '1.4rem', fontWeight: 800 }}>Tic-Tac-Toe</h2>
            <span style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)' }}>
              Chọn kích thước bàn cờ và độ khó AI
            </span>
          </div>
          <button onClick={onClose} className="btn btn-danger" style={{ fontSize: '0.85rem' }}>
            Thoát
          </button>
        </div>

        <div style={{ flexGrow: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '24px' }}>
          <div style={{ width: '100%', maxWidth: '460px' }}>
            <div style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)', marginBottom: '10px', fontWeight: 700 }}>
              KÍCH THƯỚC BÀN CỜ
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px' }}>
              {SIZE_CONFIGS.map((cfg) => {
                const active = selectedConfig.size === cfg.size;
                return (
                  <button
                    key={cfg.size}
                    onClick={() => setSelectedConfig(cfg)}
                    className={active ? 'btn btn-primary' : 'btn btn-secondary'}
                    style={{ padding: '14px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}
                  >
                    <span style={{ fontSize: '1.1rem', fontWeight: 800 }}>{cfg.size}x{cfg.size}</span>
                    <span style={{ fontSize: '0.75rem', opacity: 0.85 }}>Thắng {cfg.winLine} ô liên tiếp</span>
                    <span style={{ fontSize: '0.75rem', opacity: 0.85 }}>🪙 {cfg.reward} xu</span>
                  </button>
                );
              })}
            </div>
          </div>

          {selectedConfig.size === 3 && (
            <div style={{ width: '100%', maxWidth: '460px' }}>
              <div style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)', marginBottom: '10px', fontWeight: 700 }}>
                ĐỘ KHÓ AI
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px' }}>
                {(['easy', 'hard'] as Difficulty[]).map((d) => {
                  const active = difficulty === d;
                  return (
                    <button
                      key={d}
                      onClick={() => setDifficulty(d)}
                      className={active ? 'btn btn-primary' : 'btn btn-secondary'}
                      style={{ padding: '12px' }}
                    >
                      {d === 'easy' ? 'Dễ (Random)' : 'Khó (Minimax)'}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {selectedConfig.size > 3 && (
            <div style={{ width: '100%', maxWidth: '460px', textAlign: 'center', fontSize: '0.8rem', color: 'var(--color-text-secondary)' }}>
              🤖 AI Heuristic: chặn nước đe doạ, mở rộng chuỗi dài nhất
            </div>
          )}

          <button onClick={startGame} className="btn btn-primary" style={{ fontSize: '1rem', padding: '12px 36px' }}>
            ▶ Bắt đầu
          </button>
        </div>

        <div style={{ textAlign: 'center', fontSize: '0.75rem', color: 'var(--color-text-muted)', fontWeight: 500 }}>
          💡 Bàn 9x9 là Gomoku/Caro — thắng 5 ô liên tiếp.
        </div>
      </div>
    );
  }

  // ── Render: Play phase ───────────────────────────────────────────────────────
  const totalGap = 4;
  const containerMax = 440;
  const tileSize = Math.floor((containerMax - totalGap * (config.size + 1)) / config.size);
  const fontSize = config.size <= 3 ? '2.5rem' : config.size === 5 ? '1.6rem' : config.size === 7 ? '1.1rem' : '0.95rem';

  return (
    <div className="glass fullscreen-game-container">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: 'var(--border-glass)', paddingBottom: '14px', marginBottom: '20px', flexWrap: 'wrap', gap: '8px' }}>
        <div>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 800 }}>Tic-Tac-Toe</h2>
          <span style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)' }}>
            {config.size}x{config.size} • thắng {config.winLine} ô • 🪙 {config.reward} xu
          </span>
        </div>

        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button onClick={goBackToSelect} className="btn btn-secondary" style={{ fontSize: '0.85rem' }}>
            Đổi chế độ
          </button>
          <button onClick={() => initGame(config)} className="btn btn-secondary" style={{ padding: '8px 12px' }}>
            <RefreshCw size={16} />
          </button>
          <button onClick={onClose} className="btn btn-danger" style={{ fontSize: '0.85rem' }}>
            Thoát
          </button>
        </div>
      </div>

      <div style={{ flexGrow: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
        <div style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '14px', color: isXNext ? 'var(--primary-color)' : '#e74c3c' }}>
          {winner
            ? winner === 'Draw'
              ? '🤝 Trận đấu hòa!'
              : winner === 'X'
                ? '🏆 Bạn đã thắng!'
                : '💀 AI máy đã thắng!'
            : isAiThinking
              ? '🤖 AI máy đang tính toán...'
              : '⚡ Lượt chơi của bạn (Ký hiệu X)'}
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: `repeat(${config.size}, ${tileSize}px)`,
            gap: `${totalGap}px`,
            background: 'rgba(0,0,0,0.2)',
            padding: `${totalGap}px`,
            borderRadius: '12px',
            border: 'var(--border-glass)',
          }}
        >
          {board.map((cell, idx) => {
            const isClickable = cell === null && isXNext && !winner && !isAiThinking;
            const isWinning = winLineCells.includes(idx);
            return (
              <div
                key={idx}
                onClick={() => handleCellClick(idx)}
                style={{
                  width: `${tileSize}px`,
                  height: `${tileSize}px`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: '6px',
                  background: cell
                    ? cell === 'X'
                      ? 'linear-gradient(135deg, var(--primary-color) 0%, #a29bfe 100%)'
                      : 'linear-gradient(135deg, #e74c3c 0%, #ff7675 100%)'
                    : 'rgba(255, 255, 255, 0.03)',
                  boxShadow: cell ? '0 4px 10px rgba(0,0,0,0.2)' : 'none',
                  outline: isWinning ? '2px solid #f1c40f' : 'none',
                  outlineOffset: isWinning ? '-2px' : '0',
                  color: 'white',
                  fontWeight: 800,
                  fontSize,
                  cursor: isClickable ? 'pointer' : 'default',
                  userSelect: 'none',
                  transition: 'all 0.15s ease',
                  border: '1px solid rgba(255, 255, 255, 0.05)',
                }}
                className={isClickable ? 'glass-interactive' : ''}
              >
                {cell}
              </div>
            );
          })}
        </div>

        {winner && (
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(10,8,20,0.85)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', borderRadius: '12px', zIndex: 10 }}>
            <span style={{ fontSize: '3.5rem', marginBottom: '10px' }}>
              {winner === 'X' ? '🏆' : winner === 'O' ? '💀' : '🤝'}
            </span>
            <h3 style={{
              color: winner === 'X' ? '#2ecc71' : winner === 'O' ? '#e74c3c' : 'white',
              fontSize: '1.8rem',
              fontWeight: 800,
              marginBottom: '6px',
            }}>
              {winner === 'X' ? 'Chiến Thắng!' : winner === 'O' ? 'Thất Bại!' : 'Hòa Cờ!'}
            </h3>
            <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.9rem', marginBottom: '16px' }}>
              {winner === 'X'
                ? `Bạn đã thắng AI trên bàn ${config.size}x${config.size}!`
                : winner === 'O'
                  ? `AI máy đã đánh bại bạn trên bàn ${config.size}x${config.size}!`
                  : `Trận hoà trên bàn ${config.size}x${config.size}.`}
            </p>
            {earnedCoins !== null && earnedCoins > 0 && (
              <span style={{ fontSize: '1.2rem', fontWeight: 800, color: '#f1c40f', marginBottom: '24px' }}>
                🪙 +{earnedCoins} xu thưởng!
              </span>
            )}

            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={() => initGame(config)} className="btn btn-primary">
                Chơi Ván Mới
              </button>
              <button onClick={goBackToSelect} className="btn btn-secondary">
                Đổi chế độ
              </button>
              <button onClick={onClose} className="btn btn-secondary">
                Về Sảnh
              </button>
            </div>
          </div>
        )}
      </div>

      <div style={{ textAlign: 'center', fontSize: '0.75rem', color: 'var(--color-text-muted)', fontWeight: 500 }}>
        💡 Nhấp chuột vào một ô vuông bất kỳ để đi ký hiệu X của bạn.
      </div>
    </div>
  );
};
