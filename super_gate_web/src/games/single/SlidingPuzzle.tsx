import React, { useState, useEffect } from 'react';
import { RefreshCw } from 'lucide-react';
import { CoinService } from '../../services/coinService';
import confetti from 'canvas-confetti';

interface SlidingPuzzleProps {
  onClose: () => void;
}

type Theme = 'number' | 'emoji' | 'color';

const EMOJI_SET = [
  '🍎', '🍊', '🍋', '🍇', '🍓', '🍑', '🥝', '🍌', '🍍', '🍒',
  '🍉', '🥥', '🥭', '🫐', '🥑', '🌽', '🥕', '🌶', '🍆', '🫛',
  '🍔', '🍟', '🍕', '🌭', '🌮', '🍣', '🍙', '🍡', '🍩', '🍪',
  '🍫', '🍬', '🍭', '🎂', '🍰',
];

const SIZE_REWARDS: Record<number, number> = {
  3: 5,
  4: 15,
  5: 35,
  6: 75,
};

const HINT_COST = 10;

export const SlidingPuzzle: React.FC<SlidingPuzzleProps> = ({ onClose }) => {
  const [phase, setPhase] = useState<'select' | 'play'>('select');
  const [selectedSize, setSelectedSize] = useState<number>(3);
  const [selectedTheme, setSelectedTheme] = useState<Theme>('number');

  const [gridSize, setGridSize] = useState<number>(3);
  const [theme, setTheme] = useState<Theme>('number');
  const [tiles, setTiles] = useState<number[]>([]);
  const [moves, setMoves] = useState<number>(0);
  const [won, setWon] = useState<boolean>(false);
  const [earnedCoins, setEarnedCoins] = useState<number | null>(null);
  const [hintTile, setHintTile] = useState<number | null>(null);

  // Initialize game
  const initGame = (size: number, themeChoice: Theme) => {
    let newTiles: number[] = [];
    do {
      newTiles = shuffleTiles(size);
    } while (!isSolvable(newTiles, size) || isSolved(newTiles));

    setTiles(newTiles);
    setGridSize(size);
    setTheme(themeChoice);
    setMoves(0);
    setWon(false);
    setEarnedCoins(null);
    setHintTile(null);
  };

  const startGame = () => {
    initGame(selectedSize, selectedTheme);
    setPhase('play');
  };

  const goBackToSelect = () => {
    setPhase('select');
    setWon(false);
    setHintTile(null);
  };

  // Listen to keyboard arrow keys
  useEffect(() => {
    if (phase !== 'play') return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (won) return;
      const blankIndex = tiles.indexOf(0);
      const row = Math.floor(blankIndex / gridSize);
      const col = blankIndex % gridSize;

      let targetIndex = -1;
      if (e.key === 'ArrowUp' && row < gridSize - 1) {
        targetIndex = blankIndex + gridSize;
      } else if (e.key === 'ArrowDown' && row > 0) {
        targetIndex = blankIndex - gridSize;
      } else if (e.key === 'ArrowLeft' && col < gridSize - 1) {
        targetIndex = blankIndex + 1;
      } else if (e.key === 'ArrowRight' && col > 0) {
        targetIndex = blankIndex - 1;
      }

      if (targetIndex !== -1) {
        slideTile(targetIndex);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [tiles, won, gridSize, phase]);

  // Shuffle tiles
  const shuffleTiles = (size: number): number[] => {
    const count = size * size;
    const arr = Array.from({ length: count - 1 }, (_, i) => i + 1);
    arr.push(0);

    for (let i = arr.length - 2; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const temp = arr[i];
      arr[i] = arr[j];
      arr[j] = temp;
    }
    return arr;
  };

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

    const isAdjacent = Math.abs(row - blankRow) + Math.abs(col - blankCol) === 1;
    if (!isAdjacent) return;

    const nextTiles = [...tiles];
    nextTiles[blankIndex] = tiles[index];
    nextTiles[index] = 0;

    setTiles(nextTiles);
    setMoves((prev) => prev + 1);

    // Clear hint if user moved the highlighted tile
    if (hintTile !== null && tiles[index] === hintTile) {
      setHintTile(null);
    }

    if (isSolved(nextTiles)) {
      setWon(true);
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 },
      });
      const reward = SIZE_REWARDS[gridSize] ?? 5;
      await CoinService.earnCoins(reward);
      setEarnedCoins(reward);
      await CoinService.recordGamePlayed('Sliding Puzzle');
    }
  };

  const handleHint = async () => {
    if (won || hintTile !== null) return;
    const ok = await CoinService.spendCoins(HINT_COST);
    if (!ok) return;

    // Find a tile that is misplaced (value at idx should equal idx+1, 0 last)
    const wrongIndices: number[] = [];
    for (let i = 0; i < tiles.length; i++) {
      const expected = i === tiles.length - 1 ? 0 : i + 1;
      if (tiles[i] !== expected && tiles[i] !== 0) {
        wrongIndices.push(tiles[i]);
      }
    }
    if (wrongIndices.length === 0) return;
    const pick = wrongIndices[Math.floor(Math.random() * wrongIndices.length)];
    setHintTile(pick);
    setTimeout(() => {
      setHintTile((cur) => (cur === pick ? null : cur));
    }, 2000);
  };

  const renderTileContent = (tile: number) => {
    if (tile === 0) return null;
    if (theme === 'number') return tile;
    if (theme === 'emoji') {
      return EMOJI_SET[tile - 1] ?? tile;
    }
    // color theme — gradient + small number
    return (
      <span style={{ position: 'absolute', right: '6px', bottom: '4px', fontSize: '0.7rem', opacity: 0.8, fontWeight: 700 }}>
        {tile}
      </span>
    );
  };

  const getTileBackground = (tile: number) => {
    if (tile === 0) return 'transparent';
    if (theme === 'color') {
      const total = gridSize * gridSize - 1;
      const hue = Math.round(((tile - 1) / total) * 360);
      return `linear-gradient(135deg, hsl(${hue}, 70%, 55%) 0%, hsl(${(hue + 40) % 360}, 70%, 45%) 100%)`;
    }
    return 'linear-gradient(135deg, var(--primary-color) 0%, #a29bfe 100%)';
  };

  // ── Render: Select phase ─────────────────────────────────────────────────────
  if (phase === 'select') {
    return (
      <div className="glass fullscreen-game-container">
        <style>{`
          @keyframes hint-glow {
            0%, 100% { box-shadow: 0 0 4px 2px rgba(241, 196, 15, 0.3); border-color: rgba(241, 196, 15, 0.4); }
            50% { box-shadow: 0 0 18px 6px rgba(241, 196, 15, 0.9); border-color: rgba(241, 196, 15, 1); }
          }
          .hint-tile { animation: hint-glow 0.6s ease-in-out infinite; border: 2px solid rgba(241, 196, 15, 0.8) !important; }
        `}</style>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: 'var(--border-glass)', paddingBottom: '14px', marginBottom: '20px' }}>
          <div>
            <h2 style={{ fontSize: '1.4rem', fontWeight: 800 }}>Sliding Puzzle</h2>
            <span style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)' }}>
              Chọn kích thước và chủ đề để bắt đầu
            </span>
          </div>
          <button onClick={onClose} className="btn btn-danger" style={{ fontSize: '0.85rem' }}>
            Thoát
          </button>
        </div>

        <div style={{ flexGrow: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '24px' }}>
          {/* Size selection */}
          <div style={{ width: '100%', maxWidth: '460px' }}>
            <div style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)', marginBottom: '10px', fontWeight: 700 }}>
              KÍCH THƯỚC
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px' }}>
              {[3, 4, 5, 6].map((s) => {
                const active = selectedSize === s;
                return (
                  <button
                    key={s}
                    onClick={() => setSelectedSize(s)}
                    className={active ? 'btn btn-primary' : 'btn btn-secondary'}
                    style={{ padding: '14px 0', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '2px' }}
                  >
                    <span style={{ fontSize: '1.1rem', fontWeight: 800 }}>{s}x{s}</span>
                    <span style={{ fontSize: '0.7rem', opacity: 0.85 }}>🪙 {SIZE_REWARDS[s]} xu</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Theme selection */}
          <div style={{ width: '100%', maxWidth: '460px' }}>
            <div style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)', marginBottom: '10px', fontWeight: 700 }}>
              CHỦ ĐỀ
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
              {([
                { key: 'number', label: 'Số', preview: '1 2 3' },
                { key: 'emoji', label: 'Emoji', preview: '🍎 🍊 🍋' },
                { key: 'color', label: 'Màu', preview: '🎨' },
              ] as { key: Theme; label: string; preview: string }[]).map((t) => {
                const active = selectedTheme === t.key;
                return (
                  <button
                    key={t.key}
                    onClick={() => setSelectedTheme(t.key)}
                    className={active ? 'btn btn-primary' : 'btn btn-secondary'}
                    style={{ padding: '14px 0', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '2px' }}
                  >
                    <span style={{ fontSize: '1rem', fontWeight: 800 }}>{t.label}</span>
                    <span style={{ fontSize: '0.8rem', opacity: 0.85 }}>{t.preview}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Start button */}
          <button onClick={startGame} className="btn btn-primary" style={{ fontSize: '1rem', padding: '12px 36px', marginTop: '8px' }}>
            ▶ Bắt đầu
          </button>
        </div>

        <div style={{ textAlign: 'center', fontSize: '0.75rem', color: 'var(--color-text-muted)', fontWeight: 500 }}>
          💡 Phần thưởng tăng theo độ khó. Mỗi gợi ý tốn 10 xu trong khi chơi.
        </div>
      </div>
    );
  }

  // ── Render: Play phase ───────────────────────────────────────────────────────
  return (
    <div className="glass fullscreen-game-container">
      <style>{`
        @keyframes hint-glow {
          0%, 100% { box-shadow: 0 0 4px 2px rgba(241, 196, 15, 0.3); border-color: rgba(241, 196, 15, 0.4); }
          50% { box-shadow: 0 0 18px 6px rgba(241, 196, 15, 0.9); border-color: rgba(241, 196, 15, 1); }
        }
        .hint-tile { animation: hint-glow 0.6s ease-in-out infinite; border: 2px solid rgba(241, 196, 15, 0.8) !important; }
      `}</style>

      {/* Title Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: 'var(--border-glass)', paddingBottom: '14px', marginBottom: '20px', flexWrap: 'wrap', gap: '8px' }}>
        <div>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 800 }}>Sliding Puzzle</h2>
          <span style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)' }}>
            Lượt đi: <strong>{moves}</strong> | {gridSize}x{gridSize} • {theme === 'number' ? 'Số' : theme === 'emoji' ? 'Emoji' : 'Màu'} • Thưởng: 🪙 {SIZE_REWARDS[gridSize]}
          </span>
        </div>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button
            onClick={handleHint}
            disabled={won || hintTile !== null}
            className="btn btn-secondary"
            style={{ fontSize: '0.85rem', opacity: (won || hintTile !== null) ? 0.5 : 1 }}
          >
            💡 Gợi ý ({HINT_COST} xu)
          </button>
          <button onClick={goBackToSelect} className="btn btn-secondary" style={{ fontSize: '0.85rem' }}>
            Đổi chế độ
          </button>
          <button onClick={() => initGame(gridSize, theme)} className="btn btn-secondary" style={{ padding: '8px 12px' }}>
            <RefreshCw size={16} />
          </button>
          <button onClick={onClose} className="btn btn-danger" style={{ fontSize: '0.85rem' }}>
            Thoát
          </button>
        </div>
      </div>

      {/* Main Game Board */}
      <div style={{ flexGrow: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: `repeat(${gridSize}, 1fr)`,
            gap: '6px',
            width: '100%',
            maxWidth: 'min(480px, 80vh - 180px, 90vw)',
            aspectRatio: '1',
            background: 'rgba(0,0,0,0.2)',
            padding: '10px',
            borderRadius: '16px',
            border: 'var(--border-glass)',
          }}
        >
          {tiles.map((tile, idx) => {
            const isBlank = tile === 0;
            const isHinted = !isBlank && hintTile === tile;
            const fontSize = gridSize <= 3 ? '1.8rem' : gridSize === 4 ? '1.4rem' : gridSize === 5 ? '1.15rem' : '1rem';
            return (
              <div
                key={idx}
                onClick={() => slideTile(idx)}
                className={`${isBlank ? '' : 'glass-interactive'} ${isHinted ? 'hint-tile' : ''}`}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  position: 'relative',
                  borderRadius: '8px',
                  background: getTileBackground(tile),
                  boxShadow: isBlank ? 'none' : '0 4px 10px rgba(124, 111, 255, 0.2)',
                  color: 'white',
                  fontWeight: 800,
                  fontSize,
                  cursor: isBlank ? 'default' : 'pointer',
                  transition: 'all 0.15s ease-in-out',
                  userSelect: 'none',
                  border: isBlank ? 'none' : '1px solid rgba(255, 255, 255, 0.15)',
                }}
              >
                {renderTileContent(tile)}
              </div>
            );
          })}
        </div>

        {won && (
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(10,8,20,0.85)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', borderRadius: '12px', zIndex: 10 }}>
            <span style={{ fontSize: '3rem', marginBottom: '10px' }}>🏆</span>
            <h3 style={{ color: '#2ecc71', fontSize: '1.8rem', fontWeight: 800, marginBottom: '6px' }}>Chiến Thắng!</h3>
            <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.9rem', marginBottom: '16px' }}>
              Bạn giải được lưới {gridSize}x{gridSize} trong <strong>{moves}</strong> lượt đi.
            </p>
            {earnedCoins !== null && (
              <span style={{ fontSize: '1.2rem', fontWeight: 800, color: '#f1c40f', marginBottom: '24px' }}>
                🪙 +{earnedCoins} xu thưởng!
              </span>
            )}

            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={() => initGame(gridSize, theme)} className="btn btn-primary">
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
        💡 Nhấp chuột vào ô cạnh ô trống để trượt, hoặc sử dụng các phím mũi tên ⬅️ ⬆️ ➡️ ⬇️ trên bàn phím.
      </div>
    </div>
  );
};
