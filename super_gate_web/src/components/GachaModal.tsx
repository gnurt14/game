import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { CoinService, CoinData } from '../services/coinService';
import confetti from 'canvas-confetti';

interface GachaModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const GachaModal: React.FC<GachaModalProps> = ({ isOpen, onClose }) => {
  const [coinData, setCoinData] = useState<CoinData>(CoinService.getData());
  const [opening, setOpening] = useState(false);
  const [shake, setShake] = useState(false);
  const [result, setResult] = useState<{ coins: number; tier: string } | null>(null);

  useEffect(() => {
    if (isOpen) {
      setCoinData(CoinService.getData());
      setResult(null);
      setOpening(false);
      setShake(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const hasFreeBox = coinData.freeLuckyBoxes > 0;

  const handleOpenChest = async () => {
    if (opening) return;
    if (!hasFreeBox && coinData.balance < 100) {
      alert('Không đủ xu! Phí mở rương là 100 xu.');
      return;
    }

    setOpening(true);
    setShake(true);

    // Shake animation for 1.2s, then show results
    setTimeout(async () => {
      setShake(false);
      try {
        let coins = 0;
        let tier = '';
        
        if (hasFreeBox) {
          [coins, tier] = await CoinService.openFreeLuckyBox();
        } else {
          [coins, tier] = await CoinService.purchaseLuckyBox();
        }

        setResult({ coins, tier });
        
        // Confetti!
        if (tier === 'jackpot' || tier === 'gold') {
          confetti({
            particleCount: 150,
            spread: 90,
            origin: { y: 0.6 }
          });
        } else {
          confetti({
            particleCount: 50,
            spread: 40,
            origin: { y: 0.6 }
          });
        }

        setCoinData(CoinService.getData());
      } catch (e: any) {
        alert(e.message || 'Có lỗi xảy ra');
        setResult(null);
      } finally {
        setOpening(false);
      }
    }, 1500);
  };

  const getTierDetails = (tier: string) => {
    switch (tier) {
      case 'bronze':
        return { label: 'HẠNG ĐỒNG', color: '#cd7f32', desc: 'Rương đồng bình thường, chúc may mắn lần sau!' };
      case 'silver':
        return { label: 'HẠNG BẠC', color: '#bdc3c7', desc: 'Khá may mắn! Nhận về rương bạc chất lượng!' };
      case 'gold':
        return { label: 'HẠNG VÀNG', color: '#f1c40f', desc: 'Cực kỳ may mắn! Rương vàng lấp lánh!' };
      case 'jackpot':
        return { label: '👑 JACKPOT 👑', color: '#e53935', desc: 'SIÊU NHÂN PHẨM! Trúng giải độc đắc rương may mắn!' };
      default:
        return { label: '', color: 'white', desc: '' };
    }
  };

  const tierInfo = result ? getTierDetails(result.tier) : null;

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}>
      {/* Shake Keyframe definition injection */}
      <style>{`
        @keyframes shake-chest {
          0% { transform: rotate(0deg); }
          10% { transform: rotate(-6deg) scale(1.05); }
          20% { transform: rotate(6deg) scale(1.05); }
          30% { transform: rotate(-5deg) scale(1.05); }
          40% { transform: rotate(5deg) scale(1.05); }
          50% { transform: rotate(-4deg) scale(1.05); }
          60% { transform: rotate(4deg) scale(1.05); }
          70% { transform: rotate(-3deg) scale(1.05); }
          80% { transform: rotate(3deg) scale(1.05); }
          90% { transform: rotate(-1deg) scale(1.05); }
          100% { transform: rotate(0deg) scale(1); }
        }
        .chest-shake {
          animation: shake-chest 1.2s ease-in-out infinite;
        }
      `}</style>

      <div className="glass" style={{ width: '90%', maxWidth: '450px', padding: '30px', position: 'relative', border: '1px solid rgba(124, 111, 255, 0.2)', textAlign: 'center' }}>
        {/* Close Button */}
        <button 
          onClick={onClose} 
          disabled={opening}
          style={{ position: 'absolute', top: '16px', right: '16px', background: 'none', border: 'none', color: 'var(--color-text-muted)', cursor: 'pointer' }}
          className="glass-interactive"
        >
          <X size={20} />
        </button>

        {/* Title */}
        <div style={{ marginBottom: '24px' }}>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 800 }}>Rương Quà May Mắn</h2>
          <p style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)', marginTop: '4px' }}>
            {hasFreeBox ? `🎁 Bạn đang có ${coinData.freeLuckyBoxes} rương miễn phí!` : '🪙 Phí mở: 100 xu / rương (Nhận ngẫu nhiên 25 - 500 xu)'}
          </p>
        </div>

        {/* Chest Illustration Animation */}
        <div style={{ height: '180px', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '24px' }}>
          {result === null ? (
            <div 
              className={shake ? 'chest-shake' : ''}
              style={{ fontSize: '6rem', cursor: opening ? 'default' : 'pointer', filter: 'drop-shadow(0 10px 15px rgba(0,0,0,0.5))', transition: 'all 0.2s' }}
              onClick={handleOpenChest}
            >
              {opening ? '🎁' : '📦'}
            </div>
          ) : (
            <div style={{ fontSize: '7rem', filter: 'drop-shadow(0 10px 20px rgba(0,0,0,0.6))', animation: 'pulse 1.5s ease-out infinite' }}>
              🔓
            </div>
          )}
        </div>

        {/* Results / Action Button */}
        {result === null ? (
          <button
            onClick={handleOpenChest}
            disabled={opening}
            className="btn btn-primary"
            style={{ width: '100%', padding: '14px', borderRadius: '12px', fontSize: '1rem' }}
          >
            {opening ? 'Đang mở rương...' : hasFreeBox ? 'MỞ MIỄN PHÍ' : 'MỞ RƯƠNG (100 xu)'}
          </button>
        ) : (
          <div style={{ animation: 'pulse 1s ease' }}>
            <span style={{ 
              display: 'inline-block',
              fontSize: '0.75rem', 
              fontWeight: 800, 
              color: tierInfo?.color, 
              border: `1px solid ${tierInfo?.color}`, 
              padding: '2px 10px', 
              borderRadius: '20px', 
              background: `${tierInfo?.color}15`,
              marginBottom: '10px'
            }}>
              {tierInfo?.label}
            </span>
            
            <h3 style={{ color: '#f1c40f', fontSize: '1.8rem', fontWeight: 800, marginBottom: '6px' }}>
              +{result.coins} xu
            </h3>
            
            <p style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)', marginBottom: '20px' }}>
              {tierInfo?.desc}
            </p>

            <div style={{ display: 'flex', gap: '10px' }}>
              {(hasFreeBox || coinData.balance >= 100) && (
                <button
                  onClick={() => {
                    setResult(null);
                    setTimeout(() => handleOpenChest(), 100);
                  }}
                  className="btn btn-primary"
                  style={{ flex: 1, padding: '10px' }}
                >
                  Mở tiếp
                </button>
              )}
              <button
                onClick={onClose}
                className="btn btn-secondary"
                style={{ flex: 1, padding: '10px' }}
              >
                Đóng
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
