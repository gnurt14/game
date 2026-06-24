import React, { useEffect, useState } from 'react';
import { CoinService } from '../services/coinService';

interface ContinueModalProps {
  isOpen: boolean;
  cost: number;
  title?: string;
  subtitle?: string;
  /** Gọi sau khi đã trừ xu thành công, game tự reset state để chơi tiếp */
  onContinue: () => void;
  /** Người chơi từ chối — kết thúc game */
  onSkip: () => void;
  /** Số giây đếm ngược trước khi tự đóng (default 10) */
  countdownSec?: number;
}

export const ContinueModal: React.FC<ContinueModalProps> = ({
  isOpen,
  cost,
  title = 'GAME OVER',
  subtitle = 'Bỏ ra một ít xu để tiếp tục?',
  onContinue,
  onSkip,
  countdownSec = 10,
}) => {
  const [secLeft, setSecLeft] = useState(countdownSec);
  const [busy, setBusy] = useState(false);
  const [balance, setBalance] = useState(CoinService.getData().balance);

  useEffect(() => {
    if (!isOpen) return;
    setSecLeft(countdownSec);
    setBalance(CoinService.getData().balance);

    const tick = setInterval(() => {
      setSecLeft((s) => {
        if (s <= 1) {
          clearInterval(tick);
          onSkip();
          return 0;
        }
        return s - 1;
      });
    }, 1000);

    const unsub = CoinService.subscribe((d) => setBalance(d.balance));

    return () => {
      clearInterval(tick);
      unsub();
    };
  }, [isOpen, countdownSec, onSkip]);

  if (!isOpen) return null;

  const canAfford = balance >= cost;

  const handleContinue = async () => {
    if (!canAfford || busy) return;
    setBusy(true);
    try {
      const ok = await CoinService.spendCoins(cost);
      if (ok) {
        onContinue();
      } else {
        onSkip();
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(7, 7, 26, 0.85)',
        backdropFilter: 'blur(6px)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
      }}
    >
      <div
        style={{
          background: 'linear-gradient(135deg, #1a1138 0%, #0d0820 100%)',
          border: '1.5px solid rgba(241, 196, 15, 0.35)',
          borderRadius: '18px',
          padding: '26px 28px',
          maxWidth: '360px',
          width: '100%',
          textAlign: 'center',
          boxShadow: '0 20px 60px rgba(0,0,0,0.5), 0 0 30px rgba(241,196,15,0.15)',
        }}
      >
        <div style={{ fontSize: '3rem', marginBottom: '4px' }}>💔</div>
        <h2
          style={{
            fontSize: '1.5rem',
            fontWeight: 900,
            color: 'white',
            margin: 0,
            letterSpacing: 2,
          }}
        >
          {title}
        </h2>
        <p
          style={{
            fontSize: '0.85rem',
            color: 'rgba(255,255,255,0.65)',
            marginTop: '6px',
            marginBottom: '20px',
          }}
        >
          {subtitle}
        </p>

        <div
          style={{
            background: 'rgba(241,196,15,0.08)',
            border: '1px solid rgba(241,196,15,0.25)',
            borderRadius: '12px',
            padding: '14px',
            marginBottom: '16px',
          }}
        >
          <div
            style={{
              fontSize: '0.7rem',
              color: 'rgba(255,255,255,0.55)',
              letterSpacing: 1,
              fontWeight: 700,
            }}
          >
            CHI PHÍ TIẾP TỤC
          </div>
          <div
            style={{
              fontSize: '1.8rem',
              fontWeight: 900,
              color: '#f1c40f',
              marginTop: '2px',
              lineHeight: 1.1,
            }}
          >
            🪙 {cost} xu
          </div>
          <div
            style={{
              fontSize: '0.72rem',
              color: canAfford ? 'rgba(255,255,255,0.6)' : '#e74c3c',
              marginTop: '6px',
              fontWeight: 600,
            }}
          >
            Số dư hiện tại: 🪙 {balance}
            {!canAfford && ' (không đủ)'}
          </div>
        </div>

        <div style={{ display: 'flex', gap: '10px', flexDirection: 'column' }}>
          <button
            onClick={handleContinue}
            disabled={!canAfford || busy}
            style={{
              padding: '12px',
              fontSize: '0.95rem',
              fontWeight: 900,
              background: canAfford
                ? 'linear-gradient(135deg, #f1c40f 0%, #e67e22 100%)'
                : 'rgba(255,255,255,0.05)',
              color: canAfford ? '#1a1138' : 'rgba(255,255,255,0.3)',
              border: 'none',
              borderRadius: '10px',
              cursor: canAfford && !busy ? 'pointer' : 'not-allowed',
              boxShadow: canAfford ? '0 6px 18px rgba(241,196,15,0.35)' : 'none',
              transition: 'transform 0.15s',
            }}
            onMouseOver={(e) => {
              if (canAfford && !busy) e.currentTarget.style.transform = 'scale(1.02)';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.transform = 'scale(1)';
            }}
          >
            {busy ? '⏳ Đang xử lý...' : `✨ TIẾP TỤC (${cost} xu)`}
          </button>

          <button
            onClick={onSkip}
            disabled={busy}
            style={{
              padding: '10px',
              fontSize: '0.82rem',
              fontWeight: 700,
              background: 'transparent',
              color: 'rgba(255,255,255,0.55)',
              border: '1px solid rgba(255,255,255,0.12)',
              borderRadius: '10px',
              cursor: busy ? 'not-allowed' : 'pointer',
            }}
          >
            Bỏ cuộc ({secLeft}s)
          </button>
        </div>
      </div>
    </div>
  );
};
