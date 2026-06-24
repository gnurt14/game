import React, { useEffect, useMemo, useRef, useState } from 'react';
import { RefreshCw, Flag, Eye, Lightbulb } from 'lucide-react';
import { CoinService } from '../../services/coinService';
import confetti from 'canvas-confetti';
import {
  DIFFICULTIES,
  DifficultyConfig,
  DifficultyId,
  GameController,
  GameSnapshot,
} from './minesweeper_engine';

interface MinesweeperProps {
  onClose: () => void;
}

const HINT_COST = 10;

const NUMBER_COLORS = [
  'transparent',
  '#3498db', // 1
  '#2ecc71', // 2
  '#e74c3c', // 3
  '#9b59b6', // 4
  '#e67e22', // 5
  '#1abc9c', // 6
  '#f1c40f', // 7
  '#34495e', // 8
];

/**
 * Minesweeper UI — pure presentation layer.
 *
 * All game logic lives in {@link GameController}. This component:
 *  1. Owns one controller instance (re-created on difficulty change).
 *  2. Subscribes to controller snapshots and re-renders on every update.
 *  3. Translates user input (click / right-click / buttons) into controller calls.
 *  4. Side effects (coin reward on win, confetti, timer tick) are React-local.
 */
export const Minesweeper: React.FC<MinesweeperProps> = ({ onClose }) => {
  const [difficulty, setDifficulty] = useState<DifficultyConfig>(DIFFICULTIES.easy);

  // Controller instance — recreated whenever difficulty changes.
  const controllerRef = useRef<GameController>(new GameController(difficulty));

  // Snapshot is the only piece of "game state" the UI reads.
  const [snap, setSnap] = useState<GameSnapshot>(() => controllerRef.current.getSnapshot());

  // Display-only state.
  const [flagMode, setFlagMode] = useState(false); // mobile flag toggle
  const [seconds, setSeconds] = useState(0);
  const [earnedCoins, setEarnedCoins] = useState<number | null>(null);
  const [coinBalance, setCoinBalance] = useState(CoinService.getData().balance);

  // Recreate controller on difficulty change.
  useEffect(() => {
    controllerRef.current = new GameController(difficulty);
    const unsub = controllerRef.current.subscribe(setSnap);
    setSeconds(0);
    setEarnedCoins(null);
    return unsub;
  }, [difficulty]);

  // Coin balance live subscription (for Hint affordability).
  useEffect(() => {
    const unsub = CoinService.subscribe((d) => setCoinBalance(d.balance));
    return () => {
      unsub();
    };
  }, []);

  // Timer — ticks while PLAYING.
  useEffect(() => {
    if (snap.state !== 'PLAYING' || snap.startedAt === null) return;
    const interval = setInterval(() => {
      setSeconds(Math.floor((Date.now() - (snap.startedAt ?? Date.now())) / 1000));
    }, 250);
    return () => clearInterval(interval);
  }, [snap.state, snap.startedAt]);

  // Settle coins + confetti on WIN.
  useEffect(() => {
    if (snap.state !== 'WIN' || earnedCoins !== null) return;
    confetti({ particleCount: 140, spread: 80, origin: { y: 0.6 } });
    const diffIndex =
      difficulty.id === 'easy' ? 0 : difficulty.id === 'medium' ? 1 : 2;
    const finishedAt = snap.finishedAt ?? Date.now();
    const elapsed = Math.floor((finishedAt - (snap.startedAt ?? finishedAt)) / 1000);
    void CoinService.reportGameScore('minesweeper', {
      won: true,
      level: diffIndex,
      seconds: elapsed,
    }).then((coins) => {
      setEarnedCoins(coins);
      void CoinService.recordGamePlayed('Minesweeper');
    });
  }, [snap.state, snap.startedAt, snap.finishedAt, difficulty.id, earnedCoins]);

  // ── User intent → controller ────────────────────────────────────────────

  const handleCellClick = (row: number, col: number) => {
    if (flagMode) {
      controllerRef.current.toggleFlag(row, col);
    } else {
      controllerRef.current.revealCell(row, col);
    }
  };

  const handleCellRightClick = (row: number, col: number, e: React.MouseEvent) => {
    e.preventDefault();
    controllerRef.current.toggleFlag(row, col);
  };

  const handleRestart = () => {
    controllerRef.current.restart();
    setSeconds(0);
    setEarnedCoins(null);
  };

  const handleSetDifficulty = (id: DifficultyId) => {
    setDifficulty(DIFFICULTIES[id]);
  };

  const handleHint = async () => {
    if (snap.state !== 'PLAYING' && snap.state !== 'READY') return;
    if (coinBalance < HINT_COST) return;
    // Need mines placed before suggesting (after first tap).
    if (snap.state === 'READY') return;
    const safe = controllerRef.current.getSafeUnrevealedCells();
    if (safe.length === 0) return;
    const ok = await CoinService.spendCoins(HINT_COST);
    if (!ok) return;
    const pick = safe[Math.floor(Math.random() * safe.length)];
    controllerRef.current.forceReveal(pick.row, pick.col);
  };

  // ── Derived UI values ───────────────────────────────────────────────────

  const isOver = snap.state === 'WIN' || snap.state === 'LOSE';
  const isWon = snap.state === 'WIN';
  const cellSize = useMemo(() => {
    // Hard board is 30 cols wide → use a wider max-width.
    if (difficulty.id === 'hard') return 'min(720px, 95vw, calc(80vh - 180px) * 30/16)';
    if (difficulty.id === 'medium') return 'min(520px, 92vw, calc(80vh - 180px))';
    return 'min(440px, 90vw, calc(80vh - 180px))';
  }, [difficulty.id]);

  const fontSize = difficulty.id === 'hard' ? '0.65rem' : difficulty.id === 'medium' ? '0.78rem' : '0.95rem';

  // ── Render ──────────────────────────────────────────────────────────────

  return (
    <div className="glass fullscreen-game-container" style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Title bar */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          borderBottom: 'var(--border-glass)',
          paddingBottom: '14px',
          marginBottom: '14px',
          flexShrink: 0,
        }}
      >
        <div>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 800 }}>Minesweeper</h2>
          <span style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)', display: 'flex', gap: '14px' }}>
            <span>🚩 {snap.flagCount} / {snap.difficulty.mineCount}</span>
            <span>⏱️ {seconds}s</span>
            <span style={{ opacity: 0.7 }}>📐 {snap.difficulty.rows}×{snap.difficulty.cols}</span>
          </span>
        </div>

        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {(['easy', 'medium', 'hard'] as const).map((id) => (
            <button
              key={id}
              onClick={() => handleSetDifficulty(id)}
              className="btn btn-secondary"
              style={{
                fontSize: '0.75rem',
                padding: '6px 12px',
                background: difficulty.id === id ? 'var(--primary-color)' : 'rgba(255,255,255,0.03)',
                color: 'white',
                border: 'none',
              }}
            >
              {id.toUpperCase()}
            </button>
          ))}

          <button
            onClick={() => setFlagMode((m) => !m)}
            className="btn btn-secondary"
            style={{
              padding: '8px',
              background: flagMode ? 'rgba(241, 196, 15, 0.15)' : 'rgba(255,255,255,0.03)',
              border: flagMode ? '1px solid #f1c40f' : 'var(--border-glass)',
            }}
            title={flagMode ? 'Đang ở chế độ cắm cờ' : 'Đang ở chế độ mở ô'}
          >
            {flagMode ? <Flag size={16} color="#f1c40f" /> : <Eye size={16} />}
          </button>

          {(() => {
            const hintDisabled =
              isOver ||
              snap.state === 'READY' ||
              coinBalance < HINT_COST ||
              controllerRef.current.getSafeUnrevealedCells().length === 0;
            return (
              <button
                onClick={handleHint}
                disabled={hintDisabled}
                className="btn btn-secondary"
                title={
                  snap.state === 'READY'
                    ? 'Mở 1 ô trước khi dùng gợi ý'
                    : coinBalance < HINT_COST
                      ? 'Không đủ xu'
                      : 'Gợi ý 1 ô an toàn'
                }
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

          <button onClick={handleRestart} className="btn btn-secondary" style={{ padding: '8px' }}>
            <RefreshCw size={16} />
          </button>

          <button onClick={onClose} className="btn btn-danger" style={{ fontSize: '0.85rem' }}>
            Thoát
          </button>
        </div>
      </div>

      {/* Board */}
      <div
        style={{
          flexGrow: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'auto',
          position: 'relative',
          padding: '10px',
        }}
      >
        <div
          onContextMenu={(e) => e.preventDefault()}
          style={{
            display: 'grid',
            gridTemplateRows: `repeat(${snap.difficulty.rows}, 1fr)`,
            gridTemplateColumns: `repeat(${snap.difficulty.cols}, 1fr)`,
            gap: '2px',
            width: '100%',
            maxWidth: cellSize,
            aspectRatio: `${snap.difficulty.cols}/${snap.difficulty.rows}`,
            background: 'rgba(0,0,0,0.3)',
            padding: '6px',
            borderRadius: '12px',
            border: 'var(--border-glass)',
          }}
        >
          {snap.board.map((row) =>
            row.map((cell) => {
              const showNumber =
                cell.isRevealed && !cell.isMine && cell.nearbyMineCount > 0;
              const showMine = cell.isRevealed && cell.isMine;
              const showFlag = cell.isFlagged && !cell.isRevealed;
              return (
                <div
                  key={`${cell.row}-${cell.col}`}
                  onClick={() => handleCellClick(cell.row, cell.col)}
                  onContextMenu={(e) => handleCellRightClick(cell.row, cell.col, e)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize,
                    fontWeight: 900,
                    borderRadius: '3px',
                    cursor: isOver ? 'default' : 'pointer',
                    background: cell.isRevealed
                      ? cell.isMine
                        ? 'var(--danger-color)'
                        : 'rgba(255,255,255,0.06)'
                      : 'linear-gradient(135deg, var(--bg-tertiary) 0%, rgba(124, 111, 255, 0.1) 100%)',
                    border: '1px solid rgba(255,255,255,0.05)',
                    color: NUMBER_COLORS[cell.nearbyMineCount] || 'white',
                    userSelect: 'none',
                    transition: 'background 0.1s',
                  }}
                >
                  {showFlag && '🚩'}
                  {showMine && '💣'}
                  {showNumber && cell.nearbyMineCount}
                </div>
              );
            })
          )}
        </div>

        {/* Result overlay */}
        {isOver && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background: 'rgba(10,8,20,0.85)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: '12px',
              zIndex: 10,
            }}
          >
            <span style={{ fontSize: '3rem', marginBottom: '10px' }}>{isWon ? '🏆' : '💥'}</span>
            <h3 style={{ color: isWon ? '#2ecc71' : '#e53935', fontSize: '1.8rem', fontWeight: 800, marginBottom: '6px' }}>
              {isWon ? 'Chiến Thắng!' : 'Bị Nổ Tung!'}
            </h3>
            <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.9rem', marginBottom: '16px' }}>
              Thời gian: <strong>{seconds}</strong> giây — cấp <strong>{difficulty.id.toUpperCase()}</strong>
            </p>
            {isWon && earnedCoins !== null && (
              <span style={{ fontSize: '1.2rem', fontWeight: 800, color: '#f1c40f', marginBottom: '24px' }}>
                🪙 +{earnedCoins} xu thưởng!
              </span>
            )}

            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={handleRestart} className="btn btn-primary">Chơi Lại</button>
              <button onClick={onClose} className="btn btn-secondary">Về Sảnh</button>
            </div>
          </div>
        )}
      </div>

      <div
        style={{
          textAlign: 'center',
          fontSize: '0.72rem',
          color: 'var(--color-text-muted)',
          fontWeight: 500,
          paddingTop: '8px',
          flexShrink: 0,
        }}
      >
        💡 Trái: mở · Phải: cắm cờ · Click vào số đã mở để mở nhanh các ô xung quanh (chord). Mobile: bật 🚩 rồi tap.
      </div>
    </div>
  );
};
