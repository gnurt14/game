import React, { useEffect, useState } from 'react';
import { X, Flame, Shield, AlertCircle } from 'lucide-react';
import { CoinService, DailyRewardInfo } from '../services/coinService';
import confetti from 'canvas-confetti';

interface DailyRewardModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const DailyRewardModal: React.FC<DailyRewardModalProps> = ({ isOpen, onClose }) => {
  const [info, setInfo] = useState<DailyRewardInfo | null>(null);
  const [claiming, setClaiming] = useState(false);
  const [claimedReward, setClaimedReward] = useState<number | null>(null);

  useEffect(() => {
    if (isOpen) {
      setInfo(CoinService.getDailyRewardInfo());
      setClaimedReward(null);
    }
  }, [isOpen]);

  if (!isOpen || !info) return null;

  const rewardTable = [50, 75, 100, 125, 150, 200, 300];

  const handleClaim = async () => {
    setClaiming(true);
    try {
      const earned = await CoinService.claimDailyReward();
      setClaimedReward(earned);
      
      // Trigger confetti
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 }
      });
    } catch (e) {
      console.error(e);
    } finally {
      setClaiming(false);
    }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}>
      <div className="glass" style={{ width: '90%', maxWidth: '600px', padding: '30px', position: 'relative', border: '1px solid rgba(124, 111, 255, 0.2)' }}>
        {/* Close Button */}
        <button 
          onClick={onClose} 
          style={{ position: 'absolute', top: '16px', right: '16px', background: 'none', border: 'none', color: 'var(--color-text-muted)', cursor: 'pointer' }}
          className="glass-interactive"
        >
          <X size={20} />
        </button>

        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '60px', height: '60px', borderRadius: '50%', background: 'rgba(255, 107, 53, 0.1)', marginBottom: '12px' }}>
            <Flame color="#ff6b35" size={32} className="pulse-primary" />
          </div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 800 }}>Điểm Danh Hàng Ngày</h2>
          <p style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)', marginTop: '4px' }}>
            Đăng nhập mỗi ngày để nhận quà lớn dần. Ngày thứ 7 nhận gấp đôi!
          </p>
        </div>

        {/* 7 Day Track Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '8px', marginBottom: '24px' }}>
          {rewardTable.map((reward, i) => {
            const dayNum = i + 1;
            const isChecked = dayNum < info.todayStreakDay;
            const isToday = dayNum === info.todayStreakDay && info.shouldShow;
            const isTodayClaimed = dayNum === info.todayStreakDay && !info.shouldShow;


            let cardBg = 'rgba(255,255,255,0.03)';
            let borderColor = 'rgba(255,255,255,0.05)';
            let textColor = 'var(--color-text-muted)';
            let multiplier = 1.0;

            if (dayNum >= 7) multiplier = 2.0;
            else if (dayNum >= 5) multiplier = 1.5;
            else if (dayNum >= 3) multiplier = 1.2;

            if (isChecked || isTodayClaimed) {
              cardBg = 'rgba(46, 204, 113, 0.1)';
              borderColor = 'rgba(46, 204, 113, 0.3)';
              textColor = '#2ecc71';
            } else if (isToday) {
              cardBg = 'rgba(124, 111, 255, 0.15)';
              borderColor = 'var(--primary-color)';
              textColor = 'white';
            }

            return (
              <div 
                key={dayNum} 
                className={isToday ? "pulse-primary" : ""}
                style={{ 
                  display: 'flex', 
                  flexDirection: 'column', 
                  alignItems: 'center', 
                  padding: '12px 4px', 
                  borderRadius: '12px', 
                  background: cardBg, 
                  border: `1px solid ${borderColor}`,
                  textAlign: 'center'
                }}
              >
                <span style={{ fontSize: '0.7rem', fontWeight: 700, color: textColor, marginBottom: '6px' }}>
                  Ngày {dayNum}
                </span>
                <span style={{ fontSize: '1.2rem', marginBottom: '6px' }}>
                  {isChecked || isTodayClaimed ? '✅' : dayNum === 7 ? '👑' : '🪙'}
                </span>
                <span style={{ fontSize: '0.8rem', fontWeight: 800, color: isToday ? '#f1c40f' : textColor }}>
                  +{reward * (info.boosterActive ? 2 : 1)}
                </span>
                {multiplier > 1.0 && (
                  <span style={{ fontSize: '0.6rem', color: '#ff6b35', fontWeight: 700, marginTop: '2px' }}>
                    x{multiplier}
                  </span>
                )}
              </div>
            );
          })}
        </div>

        {/* Alerts / Claim State */}
        {claimedReward === null ? (
          info.shouldShow ? (
            <div style={{ textAlign: 'center' }}>
              {info.shieldWillBeUsed && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(0, 188, 212, 0.1)', border: '1px solid rgba(0, 188, 212, 0.3)', padding: '10px 16px', borderRadius: '10px', color: '#00bcd4', fontSize: '0.85rem', marginBottom: '16px', textAlign: 'left' }}>
                  <Shield size={18} />
                  <span>
                    <strong>Bảo vệ chuỗi!</strong> Bạn đã bỏ lỡ 1 ngày. Lá chắn chuỗi sẽ tự động được sử dụng để giữ nguyên chuỗi ngày {info.todayStreakDay}.
                  </span>
                </div>
              )}
              {info.streakWasReset && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(229, 57, 53, 0.1)', border: '1px solid rgba(229, 57, 53, 0.3)', padding: '10px 16px', borderRadius: '10px', color: '#ef5350', fontSize: '0.85rem', marginBottom: '16px', textAlign: 'left' }}>
                  <AlertCircle size={18} />
                  <span>
                    <strong>Chuỗi đã bị đứt!</strong> Do bỏ lỡ điểm danh quá 2 ngày và không có Lá chắn bảo vệ, chuỗi điểm danh của bạn đã quay lại Ngày 1.
                  </span>
                </div>
              )}

              <button 
                onClick={handleClaim} 
                disabled={claiming}
                className="btn btn-primary"
                style={{ width: '100%', padding: '14px', borderRadius: '12px', fontSize: '1rem' }}
              >
                {claiming ? 'Đang nhận...' : `Nhận ${info.actualReward} xu`}
              </button>
            </div>
          ) : (
            <div style={{ textAlign: 'center', background: 'rgba(255,255,255,0.02)', padding: '16px', borderRadius: '12px', border: 'var(--border-glass)', color: 'var(--color-text-secondary)', fontSize: '0.9rem' }}>
              🎉 Bạn đã điểm danh hôm nay rồi! Hãy quay lại vào ngày mai để tiếp tục nhận xu.
            </div>
          )
        ) : (
          <div style={{ textAlign: 'center' }}>
            <h3 style={{ color: '#2ecc71', fontSize: '1.4rem', fontWeight: 800, marginBottom: '8px' }}>
              Điểm Danh Thành Công!
            </h3>
            <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.9rem', marginBottom: '16px' }}>
              Bạn đã nhận thành công **+{claimedReward} xu** thưởng vào tài khoản.
            </p>
            <button 
              onClick={onClose} 
              className="btn btn-secondary"
              style={{ width: '100%', padding: '12px', borderRadius: '12px' }}
            >
              Đóng
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
