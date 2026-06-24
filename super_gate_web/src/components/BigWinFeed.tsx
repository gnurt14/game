import React, { useEffect, useState } from 'react';
import { Trophy } from 'lucide-react';

export interface BigWinEntry {
  playerName: string;
  amount: number;
  game: string;
  time: number; // epoch ms
}

const STORAGE_KEY = 'big_win_feed_v1';
const MAX_ENTRIES = 20;
const ROTATE_MS = 3000;

function loadEntries(): BigWinEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return seedMockEntries();
    const arr = JSON.parse(raw) as BigWinEntry[];
    if (!Array.isArray(arr) || arr.length === 0) return seedMockEntries();
    return arr;
  } catch (_) {
    return seedMockEntries();
  }
}

function saveEntries(entries: BigWinEntry[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries.slice(0, MAX_ENTRIES)));
  } catch (_) {
    // ignore quota errors
  }
}

function seedMockEntries(): BigWinEntry[] {
  const now = Date.now();
  return [
    { playerName: 'anhtrung', amount: 1500, game: 'Bầu Cua', time: now - 60_000 },
    { playerName: 'Player_x42', amount: 880, game: 'Đỏ Đen', time: now - 180_000 },
    { playerName: 'lucky_minh', amount: 2400, game: 'Xì Jack', time: now - 320_000 },
    { playerName: 'casino_king', amount: 5000, game: 'Slot Machine', time: now - 540_000 },
    { playerName: 'casual_player', amount: 720, game: 'Bầu Cua', time: now - 740_000 },
  ];
}

/** Subscribers notified whenever the feed list changes. */
type Listener = (entries: BigWinEntry[]) => void;
const listeners: Listener[] = [];

function emit(entries: BigWinEntry[]) {
  listeners.forEach((l) => l(entries));
}

interface BigWinFeedComponent extends React.FC {
  /**
   * Push a new big-win entry into the feed (call only when delta > 500).
   * Persists to localStorage and notifies all mounted feeds.
   */
  report: (playerName: string, amount: number, game: string) => void;
}

function formatNumber(n: number): string {
  return n.toLocaleString('vi-VN');
}

const BigWinFeedImpl: React.FC = () => {
  const [entries, setEntries] = useState<BigWinEntry[]>(() => loadEntries());
  const [cursor, setCursor] = useState<number>(0);
  const [animKey, setAnimKey] = useState<number>(0);

  useEffect(() => {
    const listener: Listener = (next) => {
      setEntries(next);
      setCursor(0);
      setAnimKey((k) => k + 1);
    };
    listeners.push(listener);
    return () => {
      const idx = listeners.indexOf(listener);
      if (idx >= 0) listeners.splice(idx, 1);
    };
  }, []);

  useEffect(() => {
    if (entries.length === 0) return;
    const id = setInterval(() => {
      setCursor((c) => (c + 1) % entries.length);
      setAnimKey((k) => k + 1);
    }, ROTATE_MS);
    return () => clearInterval(id);
  }, [entries]);

  if (entries.length === 0) return null;

  const current = entries[cursor];

  return (
    <div
      style={{
        position: 'fixed',
        right: '20px',
        bottom: '20px',
        zIndex: 200,
        width: '300px',
        maxWidth: 'calc(100vw - 40px)',
        pointerEvents: 'none',
      }}
    >
      <style>{`
        @keyframes bigwin-slide-in {
          0%   { transform: translateX(110%); opacity: 0; }
          18%  { transform: translateX(-6px); opacity: 1; }
          24%  { transform: translateX(0); }
          85%  { transform: translateX(0); opacity: 1; }
          100% { transform: translateX(0); opacity: 1; }
        }
        @keyframes bigwin-coin-spin {
          0%   { transform: rotate(0deg) scale(1); }
          50%  { transform: rotate(180deg) scale(1.15); }
          100% { transform: rotate(360deg) scale(1); }
        }
      `}</style>

      <div
        key={animKey}
        style={{
          background: 'linear-gradient(135deg, rgba(241, 196, 15, 0.18) 0%, rgba(231, 76, 60, 0.12) 100%)',
          border: '1.5px solid rgba(241, 196, 15, 0.45)',
          borderRadius: '14px',
          padding: '12px 14px',
          backdropFilter: 'blur(12px)',
          boxShadow: '0 8px 24px rgba(0,0,0,0.5), 0 0 20px rgba(241,196,15,0.2)',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          animation: 'bigwin-slide-in 2.8s ease-out',
          pointerEvents: 'auto',
        }}
      >
        <div
          style={{
            width: '34px',
            height: '34px',
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #f1c40f 0%, #e67e22 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            animation: 'bigwin-coin-spin 1.6s ease-in-out',
            boxShadow: '0 0 12px rgba(241,196,15,0.5)',
          }}
        >
          <Trophy size={18} color="white" />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: '0.72rem',
              color: 'rgba(255,255,255,0.65)',
              fontWeight: 700,
              letterSpacing: 0.5,
              textTransform: 'uppercase',
            }}
          >
            🎰 BIG WIN
          </div>
          <div
            style={{
              fontSize: '0.85rem',
              color: 'white',
              fontWeight: 700,
              marginTop: '2px',
              lineHeight: 1.3,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            <span style={{ color: '#f1c40f' }}>{current.playerName}</span> vừa trúng{' '}
            <strong style={{ color: '#f1c40f' }}>{formatNumber(current.amount)}</strong> xu ở{' '}
            <span style={{ color: '#3498db' }}>{current.game}</span>!
          </div>
        </div>
      </div>
    </div>
  );
};

export const BigWinFeed = BigWinFeedImpl as BigWinFeedComponent;

BigWinFeed.report = (playerName: string, amount: number, game: string) => {
  if (amount <= 500) return; // gate at 500
  const entries = loadEntries();
  const next: BigWinEntry[] = [
    { playerName: playerName || 'Người chơi', amount, game, time: Date.now() },
    ...entries,
  ].slice(0, MAX_ENTRIES);
  saveEntries(next);
  emit(next);
};
