import React, { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { CoinService, CoinData } from '../services/coinService';
import confetti from 'canvas-confetti';

type TierId = 'bronze' | 'silver' | 'gold';

interface TierConfig {
  id: TierId;
  label: string;
  icon: string;
  color: string;
  gradient: [string, string];
  price: number;
  minReward: number;
  maxReward: number;
  jackpotChance: number;
  jackpotReward: number;
}

// Rates đã được điều chỉnh để có house edge hợp lý:
// Bronze EV ≈ 90 (cost 100, ~90% return)
// Silver EV ≈ 270 (cost 300, ~90% return)
// Gold EV ≈ 900 (cost 1000, ~90% return)
// Player vẫn có cảm giác "thắng" thường xuyên nhưng net negative ~10% cost
const TIERS: TierConfig[] = [
  {
    id: 'bronze',
    label: 'Rương Đồng',
    icon: '🥉',
    color: '#cd7f32',
    gradient: ['#a0522d', '#cd7f32'],
    price: 100,
    minReward: 20,
    maxReward: 140,
    jackpotChance: 0.03,
    jackpotReward: 500,
  },
  {
    id: 'silver',
    label: 'Rương Bạc',
    icon: '🥈',
    color: '#bdc3c7',
    gradient: ['#7f8c8d', '#bdc3c7'],
    price: 300,
    minReward: 80,
    maxReward: 400,
    jackpotChance: 0.02,
    jackpotReward: 2000,
  },
  {
    id: 'gold',
    label: 'Rương Vàng',
    icon: '🥇',
    color: '#f1c40f',
    gradient: ['#e67e22', '#f1c40f'],
    price: 1000,
    minReward: 300,
    maxReward: 1400,
    jackpotChance: 0.01,
    jackpotReward: 10000,
  },
];

interface MysteryCrateProps {
  isOpen: boolean;
  onClose: () => void;
}

type Phase = 'choose' | 'opening' | 'revealed';

function rollOutcome(tier: TierConfig): { coins: number; isJackpot: boolean; nearMiss: boolean } {
  const isJackpot = Math.random() < tier.jackpotChance;
  if (isJackpot) {
    return { coins: tier.jackpotReward, isJackpot: true, nearMiss: false };
  }
  const range = tier.maxReward - tier.minReward;
  const coins = tier.minReward + Math.floor(Math.random() * (range + 1));
  // 20% near-miss for non-jackpot outcomes (UI only — coins unchanged)
  const nearMiss = Math.random() < 0.2;
  return { coins, isJackpot: false, nearMiss };
}

/**
 * Tiered mystery crate: 3 levels with different price + reward bands.
 * Includes near-miss animation to add suspense on losing rolls.
 */
export const MysteryCrate: React.FC<MysteryCrateProps> = ({ isOpen, onClose }) => {
  const [coinData, setCoinData] = useState<CoinData>(CoinService.getData());
  const [selectedTier, setSelectedTier] = useState<TierConfig | null>(null);
  const [phase, setPhase] = useState<Phase>('choose');
  const [rollingDisplay, setRollingDisplay] = useState<number>(0);
  const [result, setResult] = useState<{ coins: number; isJackpot: boolean; nearMiss: boolean } | null>(null);
  const timersRef = useRef<number[]>([]);

  useEffect(() => {
    if (isOpen) {
      setCoinData(CoinService.getData());
      setPhase('choose');
      setSelectedTier(null);
      setResult(null);
      setRollingDisplay(0);
    }
    return () => {
      timersRef.current.forEach((id) => clearTimeout(id));
      timersRef.current = [];
    };
  }, [isOpen]);

  useEffect(() => {
    const unsub = CoinService.subscribe(setCoinData);
    return unsub;
  }, []);

  if (!isOpen) return null;

  const startOpen = async (tier: TierConfig) => {
    if (coinData.balance < tier.price) {
      alert(`❌ Bạn cần ${tier.price} xu để mở ${tier.label}!`);
      return;
    }
    const ok = await CoinService.spendCoins(tier.price);
    if (!ok) {
      alert('❌ Không thể trừ xu, vui lòng thử lại.');
      return;
    }
    setSelectedTier(tier);
    setPhase('opening');
    setResult(null);

    const outcome = rollOutcome(tier);

    // ── Slot-machine style ticker for 3.5 - 4.2s ──────────────────────────────
    const totalDuration = 3500 + Math.floor(Math.random() * 700);
    const startedAt = Date.now();

    const tick = () => {
      const elapsed = Date.now() - startedAt;
      const progress = Math.min(1, elapsed / totalDuration);
      // Faster early, slower at end (ease-out)
      const interval = 50 + Math.floor(progress * progress * 350);

      // Done — finalize first so we don't get stuck in the nearMiss branch.
      if (elapsed >= totalDuration) {
        setRollingDisplay(outcome.coins);
        finalize(outcome, tier);
        return;
      }
      // Final phase — show near-miss display if applicable
      if (elapsed >= totalDuration - 600 && outcome.nearMiss && !outcome.isJackpot) {
        setRollingDisplay(tier.jackpotReward - Math.floor(Math.random() * 50));
      } else {
        // Random spinning numbers
        const upper = outcome.isJackpot ? tier.jackpotReward : tier.maxReward * 1.4;
        setRollingDisplay(tier.minReward + Math.floor(Math.random() * (upper - tier.minReward)));
      }

      const id = window.setTimeout(tick, interval);
      timersRef.current.push(id);
    };

    tick();
  };

  const finalize = async (
    outcome: { coins: number; isJackpot: boolean; nearMiss: boolean },
    tier: TierConfig,
  ) => {
    await CoinService.earnCoins(outcome.coins);
    setResult(outcome);
    setPhase('revealed');

    if (outcome.isJackpot) {
      confetti({ particleCount: 180, spread: 100, origin: { x: 0.5, y: 0.5 } });
      setTimeout(() => confetti({ particleCount: 120, spread: 80, origin: { x: 0.25, y: 0.6 } }), 250);
      setTimeout(() => confetti({ particleCount: 120, spread: 80, origin: { x: 0.75, y: 0.6 } }), 450);
    } else if (outcome.coins >= tier.maxReward * 0.7) {
      confetti({ particleCount: 80, spread: 60, origin: { y: 0.6 } });
    } else {
      confetti({ particleCount: 30, spread: 40, origin: { y: 0.7 } });
    }
  };

  const playAgain = () => {
    if (!selectedTier) return;
    setResult(null);
    setPhase('choose');
    setSelectedTier(null);
    setRollingDisplay(0);
  };

  const reopenSame = () => {
    if (!selectedTier) return;
    const tier = selectedTier;
    setResult(null);
    startOpen(tier);
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9998,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(0,0,0,0.78)',
        backdropFilter: 'blur(8px)',
        padding: '20px',
      }}
    >
      <style>{`
        @keyframes mc-pulse-glow {
          0%, 100% { box-shadow: 0 0 28px rgba(241,196,15,0.45); }
          50%      { box-shadow: 0 0 55px rgba(241,196,15,0.95); }
        }
        @keyframes mc-blink {
          0%, 50%, 100% { opacity: 1; }
          25%, 75%      { opacity: 0.45; }
        }
        @keyframes mc-shake-suspense {
          0%, 100% { transform: translateX(0) rotate(0deg); }
          25%      { transform: translateX(-3px) rotate(-1deg); }
          75%      { transform: translateX(3px) rotate(1deg); }
        }
        @keyframes mc-near-miss-slide {
          0%   { transform: translateY(-12px); color: #f1c40f; }
          50%  { transform: translateY(0); color: #f1c40f; }
          100% { transform: translateY(12px); color: #e74c3c; opacity: 0.6; }
        }
      `}</style>

      <div
        className="glass"
        style={{
          width: '100%',
          maxWidth: '560px',
          padding: '28px',
          position: 'relative',
          textAlign: 'center',
          background: 'linear-gradient(135deg, #1a1138 0%, #07071a 100%)',
          border: '1.5px solid rgba(124, 111, 255, 0.25)',
          borderRadius: '20px',
        }}
      >
        <button
          onClick={onClose}
          disabled={phase === 'opening'}
          style={{
            position: 'absolute',
            top: '14px',
            right: '14px',
            background: 'none',
            border: 'none',
            color: 'rgba(255,255,255,0.6)',
            cursor: phase === 'opening' ? 'not-allowed' : 'pointer',
          }}
          aria-label="Đóng"
        >
          <X size={22} />
        </button>

        {/* ── PHASE: Choose tier ─────────────────────────────────────────── */}
        {phase === 'choose' && (
          <>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 900, color: 'white', margin: 0 }}>
              📦 Rương Bí Ẩn
            </h2>
            <p
              style={{
                fontSize: '0.85rem',
                color: 'rgba(255,255,255,0.65)',
                marginTop: '6px',
                marginBottom: '20px',
              }}
            >
              Chọn cấp rương — rương càng cao, phần thưởng càng lớn và jackpot càng khủng.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {TIERS.map((tier) => {
                const affordable = coinData.balance >= tier.price;
                return (
                  <button
                    key={tier.id}
                    onClick={() => affordable && startOpen(tier)}
                    disabled={!affordable}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '16px',
                      padding: '14px 18px',
                      background: affordable
                        ? `linear-gradient(135deg, ${tier.gradient[0]}28 0%, ${tier.gradient[1]}18 100%)`
                        : 'rgba(255,255,255,0.04)',
                      border: `1.5px solid ${affordable ? tier.color + '60' : 'rgba(255,255,255,0.08)'}`,
                      borderRadius: '14px',
                      cursor: affordable ? 'pointer' : 'not-allowed',
                      opacity: affordable ? 1 : 0.5,
                      transition: 'transform 0.15s ease',
                      textAlign: 'left',
                    }}
                    onMouseEnter={(e) => {
                      if (affordable) (e.currentTarget.style.transform = 'translateY(-2px)');
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = 'none';
                    }}
                  >
                    <div style={{ fontSize: '3rem', flexShrink: 0 }}>{tier.icon}</div>
                    <div style={{ flex: 1 }}>
                      <div
                        style={{
                          fontSize: '1.1rem',
                          fontWeight: 900,
                          color: tier.color,
                          letterSpacing: 0.5,
                        }}
                      >
                        {tier.label}
                      </div>
                      <div
                        style={{
                          fontSize: '0.78rem',
                          color: 'rgba(255,255,255,0.7)',
                          marginTop: '3px',
                        }}
                      >
                        Thưởng: 🪙 {tier.minReward.toLocaleString('vi-VN')} -{' '}
                        {tier.maxReward.toLocaleString('vi-VN')} xu
                      </div>
                      <div
                        style={{
                          fontSize: '0.72rem',
                          color: '#f1c40f',
                          marginTop: '2px',
                          fontWeight: 700,
                        }}
                      >
                        💎 Jackpot {Math.round(tier.jackpotChance * 100)}%:{' '}
                        {tier.jackpotReward.toLocaleString('vi-VN')} xu
                      </div>
                    </div>
                    <div
                      style={{
                        background: affordable ? tier.color : 'rgba(255,255,255,0.1)',
                        color: affordable ? '#1a1138' : 'rgba(255,255,255,0.5)',
                        fontWeight: 900,
                        fontSize: '0.85rem',
                        padding: '8px 14px',
                        borderRadius: '20px',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      🪙 {tier.price.toLocaleString('vi-VN')}
                    </div>
                  </button>
                );
              })}
            </div>

            <p
              style={{
                fontSize: '0.72rem',
                color: 'rgba(255,255,255,0.45)',
                marginTop: '18px',
              }}
            >
              💡 Số dư hiện tại: <strong style={{ color: '#f1c40f' }}>🪙 {coinData.balance.toLocaleString('vi-VN')} xu</strong>
            </p>
          </>
        )}

        {/* ── PHASE: Opening ────────────────────────────────────────────── */}
        {phase === 'opening' && selectedTier && (
          <>
            <h2 style={{ fontSize: '1.3rem', fontWeight: 900, color: 'white', margin: 0 }}>
              Đang mở {selectedTier.label}…
            </h2>
            <p
              style={{
                fontSize: '0.8rem',
                color: 'rgba(255,255,255,0.55)',
                marginTop: '6px',
                marginBottom: '18px',
              }}
            >
              Linh khí đang tụ — giữ chặt tay nhé!
            </p>

            <div
              style={{
                margin: '18px auto',
                width: '160px',
                height: '160px',
                borderRadius: '24px',
                background: `linear-gradient(135deg, ${selectedTier.gradient[0]} 0%, ${selectedTier.gradient[1]} 100%)`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '5rem',
                animation: 'mc-pulse-glow 0.8s ease-in-out infinite, mc-shake-suspense 0.25s linear infinite',
              }}
            >
              <span style={{ animation: 'mc-blink 0.4s ease-in-out infinite' }}>📦</span>
            </div>

            <div
              style={{
                fontSize: '2.6rem',
                fontWeight: 900,
                color: '#f1c40f',
                fontVariantNumeric: 'tabular-nums',
                letterSpacing: 1,
                textShadow: '0 0 18px rgba(241,196,15,0.6)',
                marginTop: '8px',
                minHeight: '60px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              🪙 {rollingDisplay.toLocaleString('vi-VN')}
            </div>
          </>
        )}

        {/* ── PHASE: Revealed ───────────────────────────────────────────── */}
        {phase === 'revealed' && result && selectedTier && (
          <>
            <div
              style={{
                fontSize: '4.5rem',
                marginBottom: '8px',
                filter: result.isJackpot ? 'drop-shadow(0 0 22px rgba(241,196,15,0.85))' : 'none',
                animation: result.isJackpot ? 'mc-pulse-glow 1.2s ease-in-out infinite' : 'none',
                display: 'inline-block',
              }}
            >
              {result.isJackpot ? '👑' : '🔓'}
            </div>
            <h2
              style={{
                fontSize: '1.4rem',
                fontWeight: 900,
                color: result.isJackpot ? '#f1c40f' : 'white',
                margin: 0,
                letterSpacing: result.isJackpot ? 2 : 0.5,
              }}
            >
              {result.isJackpot ? '🎉 JACKPOT! 🎉' : `${selectedTier.icon} ${selectedTier.label}`}
            </h2>

            <div
              style={{
                fontSize: '2.5rem',
                fontWeight: 900,
                color: result.isJackpot ? '#f1c40f' : '#2ecc71',
                marginTop: '14px',
                textShadow: result.isJackpot ? '0 0 26px rgba(241,196,15,0.75)' : 'none',
              }}
            >
              +🪙 {result.coins.toLocaleString('vi-VN')} xu
            </div>

            {result.nearMiss && !result.isJackpot && (
              <div
                style={{
                  marginTop: '14px',
                  padding: '8px 14px',
                  background: 'rgba(231, 76, 60, 0.12)',
                  border: '1px solid rgba(231, 76, 60, 0.3)',
                  borderRadius: '10px',
                  fontSize: '0.82rem',
                  color: '#e74c3c',
                  fontWeight: 700,
                }}
              >
                😱 SUÝT JACKPOT! Chỉ sai một chút thôi…
              </div>
            )}

            <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
              <button
                onClick={reopenSame}
                disabled={coinData.balance < selectedTier.price}
                className="btn btn-primary"
                style={{ flex: 1, padding: '12px', fontWeight: 800 }}
              >
                🔁 MỞ LẠI ({selectedTier.price} xu)
              </button>
              <button
                onClick={playAgain}
                className="btn btn-secondary"
                style={{ flex: 1, padding: '12px', fontWeight: 800 }}
              >
                Đổi rương
              </button>
            </div>

            <button
              onClick={onClose}
              style={{
                marginTop: '10px',
                background: 'none',
                border: 'none',
                color: 'rgba(255,255,255,0.5)',
                fontSize: '0.78rem',
                cursor: 'pointer',
                textDecoration: 'underline',
              }}
            >
              Đóng
            </button>
          </>
        )}
      </div>
    </div>
  );
};
