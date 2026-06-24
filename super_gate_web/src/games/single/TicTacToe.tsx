import React, { useState, useEffect } from 'react';
import { RefreshCw } from 'lucide-react';
import { CoinService } from '../../services/coinService';
import confetti from 'canvas-confetti';

interface TicTacToeProps {
  onClose: () => void;
}

type BoardState = ('X' | 'O' | null)[];
type Difficulty = 'easy' | 'hard';

export const TicTacToe: React.FC<TicTacToeProps> = ({ onClose }) => {
  const [board, setBoard] = useState<BoardState>(Array(9).fill(null));
  const [isXNext, setIsXNext] = useState<boolean>(true); // Player is X, AI is O
  const [difficulty, setDifficulty] = useState<Difficulty>('hard');
  
  // Game state
  const [winner, setWinner] = useState<'X' | 'O' | 'Draw' | null>(null);
  const [isAiThinking, setIsAiThinking] = useState<boolean>(false);
  const [earnedCoins, setEarnedCoins] = useState<number | null>(null);

  const initGame = () => {
    setBoard(Array(9).fill(null));
    setIsXNext(true);
    setWinner(null);
    setIsAiThinking(false);
    setEarnedCoins(null);
  };

  // Check winner function
  const checkWinner = (squares: BoardState): 'X' | 'O' | 'Draw' | null => {
    const lines = [
      [0, 1, 2], [3, 4, 5], [6, 7, 8], // Rows
      [0, 3, 6], [1, 4, 7], [2, 5, 8], // Columns
      [0, 4, 8], [2, 4, 6]             // Diagonals
    ];

    for (let i = 0; i < lines.length; i++) {
      const [a, b, c] = lines[i];
      if (squares[a] && squares[a] === squares[b] && squares[a] === squares[c]) {
        return squares[a] as 'X' | 'O';
      }
    }

    if (squares.every(cell => cell !== null)) {
      return 'Draw';
    }

    return null;
  };

  // AI Move triggers when O is next
  useEffect(() => {
    if (!isXNext && !winner && !isAiThinking) {
      setIsAiThinking(true);
      
      const timer = setTimeout(() => {
        const aiMove = getAiMove(board, difficulty);
        if (aiMove !== -1) {
          const nextBoard = [...board];
          nextBoard[aiMove] = 'O';
          setBoard(nextBoard);
          
          const gameWinner = checkWinner(nextBoard);
          if (gameWinner) {
            handleGameEnd(gameWinner);
          } else {
            setIsXNext(true);
          }
        }
        setIsAiThinking(false);
      }, 500); // Simulate artificial thinking delay

      return () => clearTimeout(timer);
    }
  }, [isXNext, board, winner, difficulty]);

  const handleCellClick = (idx: number) => {
    if (board[idx] || winner || !isXNext || isAiThinking) return;

    const nextBoard = [...board];
    nextBoard[idx] = 'X';
    setBoard(nextBoard);

    const gameWinner = checkWinner(nextBoard);
    if (gameWinner) {
      handleGameEnd(gameWinner);
    } else {
      setIsXNext(false);
    }
  };

  const handleGameEnd = async (gameWinner: 'X' | 'O' | 'Draw') => {
    setWinner(gameWinner);
    
    if (gameWinner === 'X') {
      confetti({
        particleCount: 80,
        spread: 60,
        origin: { y: 0.6 }
      });
      // Award coins
      const diffVal = difficulty === 'hard' ? 5 : 2; // Level index maps to payouts in coinService
      const coins = await CoinService.reportGameScore('tictactoe', { won: true, level: diffVal });
      setEarnedCoins(coins);
    } else {
      // Lose or draw gives 0 score coins
      const coins = await CoinService.reportGameScore('tictactoe', { won: false });
      setEarnedCoins(coins);
    }
    
    await CoinService.recordGamePlayed('Tic-Tac-Toe');
  };

  // --- AI Logic (Minimax) ---
  const getAiMove = (currentBoard: BoardState, diff: Difficulty): number => {
    const emptyIndices = currentBoard
      .map((val, idx) => (val === null ? idx : null))
      .filter((val): val is number => val !== null);

    if (emptyIndices.length === 0) return -1;

    // Easy AI: random moves
    if (diff === 'easy') {
      return emptyIndices[Math.floor(Math.random() * emptyIndices.length)];
    }

    // Hard AI: Minimax logic
    let bestScore = -Infinity;
    let bestMove = -1;

    for (let i = 0; i < currentBoard.length; i++) {
      if (currentBoard[i] === null) {
        currentBoard[i] = 'O'; // AI move
        const score = minimax(currentBoard, 0, false);
        currentBoard[i] = null; // Backtrack

        if (score > bestScore) {
          bestScore = score;
          bestMove = i;
        }
      }
    }

    return bestMove;
  };

  // Minimax scoring: AI (O) wants to maximize, Player (X) wants to minimize
  const minimax = (squares: BoardState, depth: number, isMaximizing: boolean): number => {
    const gameWinner = checkWinner(squares);
    
    if (gameWinner === 'O') return 10 - depth;
    if (gameWinner === 'X') return depth - 10;
    if (gameWinner === 'Draw') return 0;

    if (isMaximizing) {
      let bestScore = -Infinity;
      for (let i = 0; i < squares.length; i++) {
        if (squares[i] === null) {
          squares[i] = 'O';
          const score = minimax(squares, depth + 1, false);
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
          const score = minimax(squares, depth + 1, true);
          squares[i] = null;
          bestScore = Math.min(bestScore, score);
        }
      }
      return bestScore;
    }
  };

  return (
    <div className="glass fullscreen-game-container">
      
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: 'var(--border-glass)', paddingBottom: '14px', marginBottom: '20px' }}>
        <div>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 800 }}>Tic-Tac-Toe</h2>
          <span style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)' }}>
            Chế độ: <strong>Đấu với AI máy</strong>
          </span>
        </div>
        
        <div style={{ display: 'flex', gap: '10px' }}>
          <select 
            value={difficulty} 
            onChange={(e) => setDifficulty(e.target.value as Difficulty)}
            className="btn btn-secondary"
            style={{ fontSize: '0.85rem', padding: '6px 12px', background: 'rgba(0,0,0,0.3)', border: 'var(--border-glass)', color: 'white', borderRadius: '8px' }}
          >
            <option value="easy" style={{ background: '#110d21' }}>Dễ (Easy AI)</option>
            <option value="hard" style={{ background: '#110d21' }}>Khó (Unbeatable AI)</option>
          </select>
          <button onClick={initGame} className="btn btn-secondary" style={{ padding: '8px 12px' }}>
            <RefreshCw size={16} />
          </button>
          <button onClick={onClose} className="btn btn-danger" style={{ fontSize: '0.85rem' }}>
            Thoát
          </button>
        </div>
      </div>

      {/* Main Play Area */}
      <div style={{ flexGrow: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
        
        {/* Status Text Indicator */}
        <div style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '20px', color: isXNext ? 'var(--primary-color)' : '#e74c3c' }}>
          {winner 
            ? winner === 'Draw' 
              ? '🤝 Trận đấu hòa!' 
              : winner === 'X' 
                ? '🏆 Bạn đã thắng!' 
                : '💀 AI máy đã thắng!'
            : isAiThinking 
              ? '🤖 AI máy đang tính toán...' 
              : '⚡ Lượt chơi của bạn (Ký hiệu X)'
          }
        </div>

        {/* 3x3 Tic Tac Toe Grid */}
        <div 
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: '8px',
            width: '100%',
            maxWidth: 'min(400px, 80vh - 180px, 90vw)',
            aspectRatio: '1',
            background: 'rgba(0,0,0,0.2)',
            padding: '10px',
            borderRadius: '16px',
            border: 'var(--border-glass)',
          }}
        >
          {board.map((cell, idx) => {
            const isClickable = cell === null && isXNext && !winner && !isAiThinking;
            
            return (
              <div
                key={idx}
                onClick={() => handleCellClick(idx)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: '8px',
                  background: cell 
                    ? cell === 'X' 
                      ? 'linear-gradient(135deg, var(--primary-color) 0%, #a29bfe 100%)'
                      : 'linear-gradient(135deg, #e74c3c 0%, #ff7675 100%)'
                    : 'rgba(255, 255, 255, 0.03)',
                  boxShadow: cell ? '0 4px 10px rgba(0,0,0,0.2)' : 'none',
                  color: 'white',
                  fontWeight: 800,
                  fontSize: '2.5rem',
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

        {/* Victory/Game Over Overlay Modal */}
        {winner && (
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(10,8,20,0.85)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', borderRadius: '12px', zIndex: 10 }}>
            <span style={{ fontSize: '3.5rem', marginBottom: '10px' }}>
              {winner === 'X' ? '🏆' : winner === 'O' ? '💀' : '🤝'}
            </span>
            <h3 style={{ 
              color: winner === 'X' ? '#2ecc71' : winner === 'O' ? '#e74c3c' : 'white', 
              fontSize: '1.8rem', 
              fontWeight: 800, 
              marginBottom: '6px' 
            }}>
              {winner === 'X' ? 'Chiến Thắng!' : winner === 'O' ? 'Thất Bại!' : 'Hòa Cờ!'}
            </h3>
            <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.9rem', marginBottom: '16px' }}>
              {winner === 'X' 
                ? `Bạn đã thắng AI máy ở độ khó ${difficulty.toUpperCase()}!` 
                : winner === 'O' 
                  ? `AI máy đã đánh bại bạn ở độ khó ${difficulty.toUpperCase()}!` 
                  : `Bạn và AI máy đã cống hiến một trận hòa kịch tính.`
              }
            </p>
            {earnedCoins !== null && earnedCoins > 0 && (
              <span style={{ fontSize: '1.2rem', fontWeight: 800, color: '#f1c40f', marginBottom: '24px' }}>
                🪙 +{earnedCoins} xu thưởng!
              </span>
            )}
            
            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={initGame} className="btn btn-primary">
                Chơi Ván Mới
              </button>
              <button onClick={onClose} className="btn btn-secondary">
                Về Sảnh
              </button>
            </div>
          </div>
        )}

      </div>

      <div style={{ textAlign: 'center', fontSize: '0.75rem', color: 'var(--color-text-muted)', fontWeight: 500 }}>
        💡 Nhấp chuột vào một ô vuông bất kỳ để đi ký hiệu X của bạn. AI máy sẽ tự động phản hồi ngay sau đó.
      </div>
    </div>
  );
};
