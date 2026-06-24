import React, { useEffect, useState } from 'react';

interface DoubleUpUniversalModalProps {
  isOpen: boolean;
  /** Số xu gốc (đã treo) khi mở modal. */
  baseAmount: number;
  /**
   * Gọi khi user kết thúc — claim hoặc lose all.
   * finalAmount = số xu thực tế cần cộng vào ví (0 nếu thua sạch).
   */
  onClaim: (finalAmount: number) => void;
  /** (optional) cho phép caller cleanup state ngoài. */
  onContinue?: () => void;
  /** Số lần gấp đôi tối đa (default 5 → max x32). */
  maxSteps?: number;
}

type Phase = 'offer' | 'choosing' | 'revealing' | 'lost';
type CardColor = 'red' | 'black';

export const DoubleUpUniversalModal: React.FC<DoubleUpUniversalModalProps> = ({
  isOpen,
  baseAmount,
  onClaim,
  onContinue,
  maxSteps = 5,
}) => {
  const [phase, setPhase] = useState<Phase>('offer');
  const [currentAmount, setCurrentAmount] = useState<number>(baseAmount);
  const [step, setStep] = useState<number>(0);
  const [revealedColor, setRevealedColor] = useState<CardColor | null>(null);
  const [pickedColor, setPickedColor] = useState<CardColor | null>(null);

  // Reset internal state khi modal mở/đóng hoặc baseAmount đổi.
  useEffect(() => {
    if (isOpen) {
      setPhase('offer');
      setCurrentAmount(baseAmount);
      setStep(0);
      setRevealedColor(null);
      setPickedColor(null);
    }
  }, [isOpen, baseAmount]);

  if (!isOpen) return null;

  const nextAmount = currentAmount * 2;
  const atMax = step >= maxSteps;

  const handleClaim = () => {
    onClaim(currentAmount);
    onContinue?.();
  };

  const handleEnterDouble = () => {
    setPhase('choosing');
    setRevealedColor(null);
    setPickedColor(null);
  };

  const handlePickColor = (pick: CardColor) => {
    if (phase !== 'choosing') return;
    setPickedColor(pick);
    setPhase('revealing');

    // Random reveal có suspense 900ms.
    setTimeout(() => {
      const reveal: CardColor = Math.random() < 0.5 ? 'red' : 'black';
      setRevealedColor(reveal);

      const isWin = reveal === pick;
      setTimeout(() => {
        if (isWin) {
          const newAmount = currentAmount * 2;
          const newStep = step + 1;
          setCurrentAmount(newAmount);
          setStep(newStep);

          if (newStep >= maxSteps) {
            // Auto-claim khi chạm trần.
            setTimeout(() => {
              onClaim(newAmount);
              onContinue?.();
            }, 1100);
          } else {
            // Quay lại offer phase với mức mới.
            setTimeout(() => {
              setPhase('offer');
              setRevealedColor(null);
              setPickedColor(null);
            }, 1100);
          }
        } else {
          setPhase('lost');
        }
      }, 600);
    }, 900);
  };

  const handleDismissLost = () => {
    onClaim(0);
    onContinue?.();
  };

  // Progress display: x2 → x4 → x8 → x16 → x32 ...
  const progressLabels: string[] = [];
  for (let i = 1; i <= maxSteps; i++) {
    progressLabels.push(`x${2 ** i}`);
  }

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
          background: 'linear-gradient(135deg, #1a1138 0%, #0d0820 100%)',
          border: '1.5px solid rgba(241, 196, 15, 0.35)',
          borderRadius: '18px',
          padding: '26px 28px',
          maxWidth: '420px',
          width: '100%',
          textAlign: 'center',
          boxShadow:
            '0 20px 60px rgba(0,0,0,0.5), 0 0 30px rgba(241,196,15,0.18)',
        }}
      >
        {phase === 'offer' && (
          <>
            <div style={{ fontSize: '3rem', marginBottom: '4px' }}>🎰</div>
            <h2
              style={{
                fontSize: '1.4rem',
                fontWeight: 900,
                color: 'white',
                margin: 0,
                letterSpacing: 1,
              }}
            >
              GẤP ĐÔI?
            </h2>
            <p
              style={{
                fontSize: '0.82rem',
                color: 'rgba(255,255,255,0.65)',
                marginTop: '6px',
                marginBottom: '14px',
              }}
            >
              Đoán đúng màu lá bài tiếp theo → gấp đôi. Sai → mất hết.
            </p>

            {/* Progress bar */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'center',
                gap: '6px',
                marginBottom: '14px',
                flexWrap: 'wrap',
              }}
            >
              {progressLabels.map((label, i) => (
                <span
                  key={i}
                  style={{
                    fontSize: '0.7rem',
                    fontWeight: 800,
                    padding: '3px 8px',
                    borderRadius: '8px',
                    background:
                      i < step
                        ? 'linear-gradient(135deg, #2ecc71 0%, #16a085 100%)'
                        : i === step
                          ? 'linear-gradient(135deg, #f1c40f 0%, #e67e22 100%)'
                          : 'rgba(255,255,255,0.06)',
                    color:
                      i < step
                        ? 'white'
                        : i === step
                          ? '#1a1138'
                          : 'rgba(255,255,255,0.4)',
                    border:
                      i === step ? '1px solid white' : '1px solid transparent',
                  }}
                >
                  {label}
                </span>
              ))}
            </div>

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
                ĐANG TREO
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
                🪙 {currentAmount} xu
              </div>
              <div
                style={{
                  fontSize: '0.75rem',
                  color: 'rgba(255,255,255,0.7)',
                  marginTop: '6px',
                  fontWeight: 600,
                }}
              >
                Nếu gấp đôi:{' '}
                <strong style={{ color: '#2ecc71' }}>
                  🪙 {nextAmount} xu
                </strong>
                {step > 0 && (
                  <span
                    style={{
                      display: 'block',
                      fontSize: '0.68rem',
                      color: 'rgba(255,255,255,0.4)',
                      marginTop: '4px',
                    }}
                  >
                    (đã gấp đôi {step}/{maxSteps} lần)
                  </span>
                )}
              </div>
            </div>

            <div
              style={{ display: 'flex', gap: '10px', flexDirection: 'column' }}
            >
              <button
                onClick={handleClaim}
                style={{
                  padding: '12px',
                  fontSize: '0.95rem',
                  fontWeight: 900,
                  background:
                    'linear-gradient(135deg, #f1c40f 0%, #e67e22 100%)',
                  color: '#1a1138',
                  border: 'none',
                  borderRadius: '10px',
                  cursor: 'pointer',
                  boxShadow: '0 6px 18px rgba(241, 196, 15, 0.35)',
                }}
              >
                💰 NHẬN THƯỞNG ({currentAmount} xu)
              </button>

              {!atMax && (
                <button
                  onClick={handleEnterDouble}
                  style={{
                    padding: '12px',
                    fontSize: '0.95rem',
                    fontWeight: 900,
                    background:
                      'linear-gradient(135deg, #e74c3c 0%, #c0392b 100%)',
                    color: 'white',
                    border: 'none',
                    borderRadius: '10px',
                    cursor: 'pointer',
                    boxShadow: '0 6px 18px rgba(231, 76, 60, 0.4)',
                  }}
                >
                  🎲 GẤP ĐÔI (50/50)
                </button>
              )}
            </div>
          </>
        )}

        {(phase === 'choosing' || phase === 'revealing') && (
          <>
            <div style={{ fontSize: '2.5rem', marginBottom: '4px' }}>🎲</div>
            <h2
              style={{
                fontSize: '1.3rem',
                fontWeight: 900,
                color: 'white',
                margin: 0,
              }}
            >
              Chọn màu lá bài
            </h2>
            <p
              style={{
                fontSize: '0.78rem',
                color: 'rgba(255,255,255,0.6)',
                marginTop: '6px',
                marginBottom: '18px',
              }}
            >
              Treo:{' '}
              <strong style={{ color: '#f1c40f' }}>🪙 {currentAmount}</strong>{' '}
              → đúng gấp đôi, sai mất hết.
            </p>

            <div
              style={{
                height: '120px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'rgba(0,0,0,0.3)',
                borderRadius: '12px',
                marginBottom: '16px',
                border: '1px solid rgba(255,255,255,0.08)',
              }}
            >
              {phase === 'revealing' && revealedColor === null ? (
                <div
                  style={{
                    fontSize: '3rem',
                    animation: 'duum-spin 0.18s linear infinite',
                  }}
                >
                  🃏
                </div>
              ) : revealedColor ? (
                <div
                  style={{
                    width: '70px',
                    height: '100px',
                    background: 'white',
                    borderRadius: '8px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: revealedColor === 'red' ? '#e74c3c' : '#2d3436',
                    fontWeight: 800,
                    fontSize: '2.5rem',
                    border: `3px solid ${revealedColor === 'red' ? '#e74c3c' : '#2d3436'}`,
                    boxShadow: '0 8px 20px rgba(0,0,0,0.5)',
                  }}
                >
                  {revealedColor === 'red' ? '♥' : '♠'}
                </div>
              ) : (
                <span
                  style={{
                    fontSize: '0.85rem',
                    color: 'rgba(255,255,255,0.5)',
                  }}
                >
                  Chọn 🔴 Đỏ hoặc ⚫ Đen
                </span>
              )}
            </div>

            <style>{`
              @keyframes duum-spin { 0%{transform:rotateY(0deg)} 100%{transform:rotateY(360deg)} }
            `}</style>

            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                onClick={() => handlePickColor('red')}
                disabled={phase !== 'choosing'}
                style={{
                  flex: 1,
                  padding: '14px',
                  fontSize: '1rem',
                  fontWeight: 900,
                  background:
                    'linear-gradient(135deg, #e74c3c 0%, #c0392b 100%)',
                  color: 'white',
                  border:
                    pickedColor === 'red'
                      ? '2px solid white'
                      : '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '10px',
                  cursor: phase !== 'choosing' ? 'not-allowed' : 'pointer',
                  opacity: phase !== 'choosing' && pickedColor !== 'red' ? 0.4 : 1,
                  boxShadow: '0 6px 18px rgba(231, 76, 60, 0.4)',
                }}
              >
                🔴 Đỏ
              </button>
              <button
                onClick={() => handlePickColor('black')}
                disabled={phase !== 'choosing'}
                style={{
                  flex: 1,
                  padding: '14px',
                  fontSize: '1rem',
                  fontWeight: 900,
                  background:
                    'linear-gradient(135deg, #34495e 0%, #2d3436 100%)',
                  color: 'white',
                  border:
                    pickedColor === 'black'
                      ? '2px solid white'
                      : '1px solid rgba(255,255,255,0.15)',
                  borderRadius: '10px',
                  cursor: phase !== 'choosing' ? 'not-allowed' : 'pointer',
                  opacity:
                    phase !== 'choosing' && pickedColor !== 'black' ? 0.4 : 1,
                  boxShadow: '0 6px 18px rgba(0,0,0,0.4)',
                }}
              >
                ⚫ Đen
              </button>
            </div>
          </>
        )}

        {phase === 'lost' && (
          <>
            <div style={{ fontSize: '3rem', marginBottom: '4px' }}>💔</div>
            <h2
              style={{
                fontSize: '1.5rem',
                fontWeight: 900,
                color: '#e74c3c',
                margin: 0,
                letterSpacing: 1,
              }}
            >
              ĐÃ MẤT TẤT CẢ
            </h2>
            <p
              style={{
                fontSize: '0.85rem',
                color: 'rgba(255,255,255,0.7)',
                marginTop: '8px',
                marginBottom: '20px',
              }}
            >
              Bạn đã chọn sai màu. Tiền thưởng đã bốc hơi 💨
            </p>

            <button
              onClick={handleDismissLost}
              style={{
                width: '100%',
                padding: '12px',
                fontSize: '0.95rem',
                fontWeight: 900,
                background:
                  'linear-gradient(135deg, #7c6fff 0%, #a29bfe 100%)',
                color: 'white',
                border: 'none',
                borderRadius: '10px',
                cursor: 'pointer',
                boxShadow: '0 6px 18px rgba(124, 111, 255, 0.35)',
              }}
            >
              🔄 Tiếp tục
            </button>
          </>
        )}
      </div>
    </div>
  );
};
