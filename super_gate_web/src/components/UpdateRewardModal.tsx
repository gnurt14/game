import React, { useEffect, useRef, useState } from 'react';
import { Gift } from 'lucide-react';
import confetti from 'canvas-confetti';
import { CoinService } from '../services/coinService';
import {
  UpdateRewardService,
  UPDATE_REWARD_TIERS,
  UpdateRewardTier,
} from '../services/updateRewardService';

interface UpdateRewardModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type Phase = 'pending' | 'rolling' | 'revealed';

/**
 * UpdateRewardModal — sau khi app cập nhật version mới, hiển thị 1 phần quà
 * ngẫu nhiên 50-5000 xu (EV ~1200) như lời cảm ơn user đã update.
 *
 * Flow:
 *   pending  → user thấy modal đóng kín "Mở quà bí ẩn"
 *   rolling  → 2.5s slot-ticker (xáo trộn nhanh giữa các tier)
 *   revealed → hiển tier trúng + nút "NHẬN" (cộng xu + đánh dấu claimed)
 */
export const UpdateRewardModal: React.FC<UpdateRewardModalProps> = ({ isOpen, onClose }) => {
  const [phase, setPhase] = useState<Phase>('pending');
  const [tickerTier, setTickerTier] = useState<UpdateRewardTier>(UPDATE_REWARD_TIERS[3]);
  const [reward, setReward] = useState<UpdateRewardTier | null>(null);
  const [claimed, setClaimed] = useState(false);
  const tickerHandlesRef = useRef<number[]>([]);

  useEffect(() => {
    if (!isOpen) {
      setPhase('pending');
      setReward(null);
      setClaimed(false);
      // clear timers
      tickerHandlesRef.current.forEach((id) => clearTimeout(id));
      tickerHandlesRef.current = [];
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const startRoll = () => {
    if (phase !== 'pending') return;
    const rolled = UpdateRewardService.roll();
    setPhase('rolling');

    // Slot-style ticker: random tier mỗi 80-160ms trong ~2.5s, slow xuống cuối.
    const totalMs = 2500;
    const startedAt = Date.now();

    const tick = () => {
      const elapsed = Date.now() - startedAt;
      const progress = Math.min(1, elapsed / totalMs);
      const interval = 80 + Math.floor(progress * progress * 320);

      if (elapsed >= totalMs) {
        setTickerTier(rolled.tier);
        // Reveal phase
        setReward(rolled.tier);
        setPhase('revealed');
        triggerConfetti(rolled.tier);
        return;
      }
      const random = UPDATE_REWARD_TIERS[Math.floor(Math.random() * UPDATE_REWARD_TIERS.length)];
      setTickerTier(random);
      const id = window.setTimeout(tick, interval);
      tickerHandlesRef.current.push(id);
    };

    tick();
  };

  const handleClaim = async () => {
    if (!reward || claimed) return;
    setClaimed(true);
    await CoinService.earnCoins(reward.coins);
    UpdateRewardService.markClaimed();
    // Để user kịp nhìn animation + xu cộng → đóng sau delay nhẹ.
    setTimeout(() => onClose(), 700);
  };

  const triggerConfetti = (tier: UpdateRewardTier) => {
    if (tier.coins >= 5000) {
      confetti({ particleCount: 220, spread: 110, origin: { y: 0.5 } });
      setTimeout(() => confetti({ particleCount: 140, spread: 80, origin: { x: 0.25, y: 0.6 } }), 250);
      setTimeout(() => confetti({ particleCount: 140, spread: 80, origin: { x: 0.75, y: 0.6 } }), 450);
    } else if (tier.coins >= 2500) {
      confetti({ particleCount: 120, spread: 80, origin: { y: 0.6 } });
    } else {
      confetti({ particleCount: 60, spread: 60, origin: { y: 0.65 } });
    }
  };

  const displayTier = reward ?? tickerTier;
  const showCoins = phase === 'revealed' && reward;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9998,
        background: 'rgba(5, 3, 10, 0.88)',
        backdropFilter: 'blur(10px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
      }}
    >
      <style>{`
        @keyframes ur-glow {
          0%, 100% { box-shadow: 0 0 26px rgba(241, 196, 15, 0.4); }
          50%      { box-shadow: 0 0 52px rgba(241, 196, 15, 0.85); }
        }
        @keyframes ur-shake {
          0%, 100% { transform: translateX(0) rotate(0); }
          25%      { transform: translateX(-3px) rotate(-1deg); }
          75%      { transform: translateX(3px) rotate(1deg); }
        }
        @keyframes ur-pop {
          0%   { transform: scale(0.3); opacity: 0; }
          70%  { transform: scale(1.15); opacity: 1; }
          100% { transform: scale(1); }
        }
        @keyframes ur-fade-in {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      <div
        style={{
          width: '100%',
          maxWidth: '430px',
          background: 'linear-gradient(135deg, #1a1138 0%, #07071a 100%)',
          border: `2px solid ${displayTier.color}`,
          borderRadius: '20px',
          padding: '30px 26px',
          textAlign: 'center',
          boxShadow: `0 25px 70px rgba(0,0,0,0.6), 0 0 40px ${displayTier.color}33`,
          animation: 'ur-fade-in 0.3s ease-out',
        }}
      >
        <p style={{ fontSize: '0.7rem', letterSpacing: 2, color: 'rgba(255,255,255,0.5)', fontWeight: 800, margin: 0 }}>
          🎁 PHẦN QUÀ CẬP NHẬT
        </p>
        <h2 style={{ fontSize: '1.4rem', fontWeight: 900, color: 'white', marginTop: '6px', marginBottom: '4px' }}>
          Cảm ơn bạn đã cập nhật!
        </h2>
        <p style={{ fontSize: '0.82rem', color: 'rgba(255,255,255,0.62)', marginBottom: '18px' }}>
          {phase === 'pending'
            ? 'Mở hộp để nhận quà bí mật — từ 50 đến 5.000 xu!'
            : phase === 'rolling'
              ? 'Đang xáo trộn…'
              : '🎉 Bạn đã trúng!'}
        </p>

        {/* Tier display box */}
        <div
          key={phase}
          style={{
            width: '180px',
            height: '180px',
            margin: '0 auto 18px auto',
            borderRadius: '20px',
            background: `linear-gradient(135deg, ${displayTier.color}33 0%, ${displayTier.color}10 100%)`,
            border: `2.5px solid ${displayTier.color}`,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px',
            animation:
              phase === 'rolling'
                ? 'ur-shake 0.18s linear infinite'
                : phase === 'revealed'
                  ? 'ur-glow 1.4s ease-in-out infinite, ur-pop 0.45s ease-out'
                  : 'ur-glow 1.8s ease-in-out infinite',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          <div style={{ fontSize: '4.2rem', lineHeight: 1, filter: phase === 'rolling' ? 'blur(1px)' : 'none' }}>
            {phase === 'pending' ? '📦' : displayTier.emoji}
          </div>
          {phase !== 'pending' && (
            <div
              style={{
                fontSize: '0.75rem',
                fontWeight: 900,
                letterSpacing: 1.2,
                color: displayTier.color,
                marginTop: '4px',
              }}
            >
              {displayTier.label}
            </div>
          )}
        </div>

        {/* Coins amount */}
        {showCoins && reward && (
          <div
            style={{
              fontSize: '2.4rem',
              fontWeight: 900,
              color: reward.color,
              textShadow: `0 0 20px ${reward.color}88`,
              marginBottom: '6px',
              animation: 'ur-pop 0.4s ease-out 0.2s both',
            }}
          >
            +🪙 {reward.coins.toLocaleString('vi-VN')} xu
          </div>
        )}

        {phase === 'pending' && (
          <button
            onClick={startRoll}
            style={{
              width: '100%',
              padding: '14px',
              fontSize: '1rem',
              fontWeight: 900,
              letterSpacing: 1,
              background: 'linear-gradient(135deg, #f1c40f 0%, #e67e22 100%)',
              color: '#1a1138',
              border: 'none',
              borderRadius: '12px',
              cursor: 'pointer',
              boxShadow: '0 8px 20px rgba(241, 196, 15, 0.4)',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '10px',
              textTransform: 'uppercase',
              marginTop: '10px',
            }}
          >
            <Gift size={18} /> Mở Quà
          </button>
        )}

        {phase === 'rolling' && (
          <div style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.55)', fontWeight: 700, marginTop: '8px' }}>
            ⏳ Đang chọn quà…
          </div>
        )}

        {phase === 'revealed' && reward && (
          <button
            onClick={handleClaim}
            disabled={claimed}
            style={{
              width: '100%',
              padding: '14px',
              fontSize: '1rem',
              fontWeight: 900,
              letterSpacing: 1,
              background: claimed
                ? 'rgba(46, 204, 113, 0.25)'
                : `linear-gradient(135deg, ${reward.color} 0%, ${reward.color}cc 100%)`,
              color: claimed ? '#2ecc71' : '#1a1138',
              border: 'none',
              borderRadius: '12px',
              cursor: claimed ? 'default' : 'pointer',
              boxShadow: claimed ? 'none' : `0 8px 20px ${reward.color}55`,
              marginTop: '10px',
              textTransform: 'uppercase',
            }}
          >
            {claimed ? '✓ ĐÃ NHẬN' : `✨ NHẬN ${reward.coins.toLocaleString('vi-VN')} XU`}
          </button>
        )}
      </div>
    </div>
  );
};
