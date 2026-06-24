import React from 'react';

interface ComebackModalProps {
  isOpen: boolean;
  /** Số ván thua liên tiếp (hiển thị cho player). */
  lossStreak: number;
  onContinue: () => void;
}

/**
 * ComebackModal — hiển sau khi player thua 3 ván liên tiếp ở 1 game cờ bạc.
 * Thông báo ván tiếp theo sẽ có x2 bonus reward nếu thắng.
 */
export const ComebackModal: React.FC<ComebackModalProps> = ({
  isOpen,
  lossStreak,
  onContinue,
}) => {
  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(7, 7, 26, 0.85)',
        backdropFilter: 'blur(6px)',
        zIndex: 10000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
      }}
    >
      <div
        style={{
          background:
            'linear-gradient(135deg, #4a1c14 0%, #2a0d08 50%, #1a0606 100%)',
          border: '1.5px solid rgba(231, 126, 34, 0.6)',
          borderRadius: '18px',
          padding: '28px',
          maxWidth: '380px',
          width: '100%',
          textAlign: 'center',
          boxShadow:
            '0 20px 60px rgba(0,0,0,0.6), 0 0 40px rgba(231, 76, 60, 0.25)',
        }}
      >
        <div style={{ fontSize: '3.5rem', marginBottom: '4px' }}>🔥</div>
        <h2
          style={{
            fontSize: '1.5rem',
            fontWeight: 900,
            color: 'white',
            margin: 0,
            letterSpacing: 1.5,
            textShadow: '0 2px 8px rgba(231, 76, 60, 0.5)',
          }}
        >
          COMEBACK TIME!
        </h2>
        <p
          style={{
            fontSize: '0.85rem',
            color: 'rgba(255,255,255,0.75)',
            marginTop: '10px',
            marginBottom: '18px',
            lineHeight: 1.5,
          }}
        >
          Bạn vừa thua <strong style={{ color: '#e67e22' }}>{lossStreak}</strong>{' '}
          ván liên tiếp. Đừng nản!
        </p>

        <div
          style={{
            background: 'rgba(231, 126, 34, 0.15)',
            border: '1.5px solid rgba(231, 126, 34, 0.5)',
            borderRadius: '12px',
            padding: '16px',
            marginBottom: '18px',
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
            BÙ XU COMEBACK
          </div>
          <div
            style={{
              fontSize: '1.6rem',
              fontWeight: 900,
              color: '#f39c12',
              marginTop: '4px',
              lineHeight: 1.1,
              textShadow: '0 0 12px rgba(243, 156, 18, 0.5)',
            }}
          >
            x2 THƯỞNG
          </div>
          <div
            style={{
              fontSize: '0.78rem',
              color: 'rgba(255,255,255,0.7)',
              marginTop: '6px',
              fontWeight: 600,
            }}
          >
            Cược ván tiếp: thưởng x2 nếu thắng 🎯
          </div>
        </div>

        <button
          onClick={onContinue}
          style={{
            width: '100%',
            padding: '14px',
            fontSize: '1rem',
            fontWeight: 900,
            background: 'linear-gradient(135deg, #e67e22 0%, #d35400 100%)',
            color: 'white',
            border: 'none',
            borderRadius: '10px',
            cursor: 'pointer',
            boxShadow: '0 6px 18px rgba(230, 126, 34, 0.5)',
            letterSpacing: 1,
          }}
        >
          💪 TIẾP TỤC
        </button>
      </div>
    </div>
  );
};
