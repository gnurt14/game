import React, { useEffect, useState } from 'react';
import { CoinService } from '../services/coinService';
import { StreakService } from '../services/streakService';

interface WelcomeBackModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Số xu tặng (default 50). */
  giftAmount?: number;
}

/**
 * WelcomeBackModal — chào mừng player trở lại sau >24h offline, tặng xu free.
 * Trigger từ App.tsx khi StreakService.shouldShowWelcomeBack() = true.
 */
export const WelcomeBackModal: React.FC<WelcomeBackModalProps> = ({
  isOpen,
  onClose,
  giftAmount = 50,
}) => {
  const [busy, setBusy] = useState(false);
  const [claimed, setClaimed] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setBusy(false);
      setClaimed(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleClaim = async () => {
    if (busy || claimed) return;
    setBusy(true);
    try {
      await CoinService.earnCoins(giftAmount);
      StreakService.markWelcomeBackShown();
      setClaimed(true);
      // Đóng sau short delay để player thấy state confirm.
      setTimeout(() => {
        onClose();
      }, 800);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(7, 7, 26, 0.88)',
        backdropFilter: 'blur(8px)',
        zIndex: 10001,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
      }}
    >
      <div
        style={{
          background:
            'linear-gradient(135deg, #1e3a5f 0%, #1a1138 50%, #0d0820 100%)',
          border: '1.5px solid rgba(124, 111, 255, 0.5)',
          borderRadius: '20px',
          padding: '32px 28px',
          maxWidth: '380px',
          width: '100%',
          textAlign: 'center',
          boxShadow:
            '0 20px 60px rgba(0,0,0,0.6), 0 0 50px rgba(124, 111, 255, 0.25)',
        }}
      >
        <div style={{ fontSize: '4rem', marginBottom: '6px' }}>🎁</div>
        <h2
          style={{
            fontSize: '1.6rem',
            fontWeight: 900,
            color: 'white',
            margin: 0,
            letterSpacing: 1.5,
            background: 'linear-gradient(135deg, #f1c40f 0%, #e67e22 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
          }}
        >
          CHÀO MỪNG TRỞ LẠI!
        </h2>
        <p
          style={{
            fontSize: '0.88rem',
            color: 'rgba(255,255,255,0.75)',
            marginTop: '10px',
            marginBottom: '20px',
            lineHeight: 1.5,
          }}
        >
          Đã lâu không gặp — nhận quà xu free để chơi tiếp nhé!
        </p>

        <div
          style={{
            background: 'rgba(241,196,15,0.1)',
            border: '1.5px solid rgba(241,196,15,0.4)',
            borderRadius: '14px',
            padding: '18px',
            marginBottom: '20px',
          }}
        >
          <div
            style={{
              fontSize: '0.72rem',
              color: 'rgba(255,255,255,0.6)',
              letterSpacing: 1.5,
              fontWeight: 800,
            }}
          >
            QUÀ TẶNG
          </div>
          <div
            style={{
              fontSize: '2.2rem',
              fontWeight: 900,
              color: '#f1c40f',
              marginTop: '4px',
              lineHeight: 1.1,
              textShadow: '0 0 18px rgba(241,196,15,0.5)',
            }}
          >
            🪙 {giftAmount} XU
          </div>
        </div>

        <button
          onClick={handleClaim}
          disabled={busy || claimed}
          style={{
            width: '100%',
            padding: '14px',
            fontSize: '1rem',
            fontWeight: 900,
            background: claimed
              ? 'linear-gradient(135deg, #2ecc71 0%, #16a085 100%)'
              : 'linear-gradient(135deg, #f1c40f 0%, #e67e22 100%)',
            color: claimed ? 'white' : '#1a1138',
            border: 'none',
            borderRadius: '12px',
            cursor: busy || claimed ? 'default' : 'pointer',
            boxShadow: '0 6px 20px rgba(241, 196, 15, 0.45)',
            letterSpacing: 1,
          }}
        >
          {claimed
            ? `✅ ĐÃ NHẬN ${giftAmount} XU`
            : busy
              ? '⏳ Đang nhận...'
              : `✨ NHẬN ${giftAmount} XU`}
        </button>
      </div>
    </div>
  );
};
