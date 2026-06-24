import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { CoinService, CoinData } from '../services/coinService';
import confetti from 'canvas-confetti';

interface LuckyWheelModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const WHEEL_ITEMS = [
  { label: '20 Xu', color: '#1b1635', text: '🪙 20 xu' },
  { label: '50 Xu', color: '#7c6fff', text: '🪙 50 xu' },
  { label: '1 Lá Chắn', color: '#00bcd4', text: '🛡️ Lá chắn' },
  { label: 'Booster x2 (2h)', color: '#ff6b35', text: '⚡ Booster x2' },
  { label: '120 Xu', color: '#9c27b0', text: '🪙 120 xu' },
  { label: 'Jackpot 500 Xu', color: '#f1c40f', text: '👑 Jackpot' },
];

const polarToCartesian = (centerX: number, centerY: number, radius: number, angleInDegrees: number) => {
  const angleInRadians = ((angleInDegrees - 90) * Math.PI) / 180;
  return {
    x: centerX + radius * Math.cos(angleInRadians),
    y: centerY + radius * Math.sin(angleInRadians),
  };
};

const describeArc = (x: number, y: number, radius: number, startAngle: number, endAngle: number) => {
  const start = polarToCartesian(x, y, radius, endAngle);
  const end = polarToCartesian(x, y, radius, startAngle);
  const largeArcFlag = endAngle - startAngle <= 180 ? '0' : '1';

  return [
    'M', x, y,
    'L', start.x, start.y,
    'A', radius, radius, 0, largeArcFlag, 0, end.x, end.y,
    'Z'
  ].join(' ');
};

export const LuckyWheelModal: React.FC<LuckyWheelModalProps> = ({ isOpen, onClose }) => {
  const [coinData, setCoinData] = useState<CoinData>(CoinService.getData());
  const [spinning, setSpinning] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [rewardLabel, setRewardLabel] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setCoinData(CoinService.getData());
      setRewardLabel(null);
      setRotation(0);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const todayStr = () => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  };

  const isFree = coinData.lastWheelSpinDate !== todayStr();

  const handleSpin = async () => {
    if (spinning) return;
    if (!isFree && coinData.balance < 30) {
      alert('Không đủ xu! Phí quay là 30 xu.');
      return;
    }

    setSpinning(true);
    setRewardLabel(null);

    try {
      const [_, label] = await CoinService.spinLuckyWheel(isFree);

      // Find index of won item
      const itemIndex = WHEEL_ITEMS.findIndex((item) => item.label === label);
      if (itemIndex === -1) throw new Error('Không xác định được phần thưởng');

      // Calculate degrees
      // 6 segments, each segment is 60 degrees.
      // We align the MIDPOINT of the target segment with the top needle (which is at 0 deg).
      // Midpoint of segment i is at (i * 60 + 30) degrees.
      // To bring it to the top (0 deg), we rotate the wheel clockwise by 360 - midAngle.
      const extraSpins = 5; // Spin 5 times
      const midAngle = itemIndex * 60 + 30;
      const targetDeg = extraSpins * 360 + (360 - midAngle);

      setRotation(targetDeg);

      // Wait for spin animation (3 seconds)
      setTimeout(() => {
        setSpinning(false);
        setRewardLabel(label);
        
        // Trigger confetti
        confetti({
          particleCount: 80,
          spread: 60,
          origin: { y: 0.6 }
        });
        
        // Update local coin state
        setCoinData(CoinService.getData());
      }, 3000);

    } catch (e: any) {
      alert(e.message || 'Có lỗi xảy ra');
      setSpinning(false);
    }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}>
      <div className="glass" style={{ width: '90%', maxWidth: '500px', padding: '30px', position: 'relative', border: '1px solid rgba(124, 111, 255, 0.2)', textAlign: 'center' }}>
        {/* Close Button */}
        <button 
          onClick={onClose} 
          disabled={spinning}
          style={{ position: 'absolute', top: '16px', right: '16px', background: 'none', border: 'none', color: 'var(--color-text-muted)', cursor: 'pointer' }}
          className="glass-interactive"
        >
          <X size={20} />
        </button>

        {/* Title */}
        <div style={{ marginBottom: '20px' }}>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 800 }}>Vòng Quay May Mắn</h2>
          <p style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)', marginTop: '4px' }}>
            {isFree ? '🎉 Bạn có 1 lượt quay MIỄN PHÍ hôm nay!' : '🪙 Phí quay: 30 xu / lượt'}
          </p>
        </div>

        {/* Wheel container */}
        <div style={{ position: 'relative', width: '280px', height: '280px', margin: '0 auto 24px auto' }}>
          {/* Top Pointer Indicator */}
          <div style={{
            position: 'absolute',
            top: '-14px',
            left: 'calc(50% - 15px)',
            width: 0,
            height: 0,
            borderLeft: '15px solid transparent',
            borderRight: '15px solid transparent',
            borderTop: '25px solid #e53935',
            zIndex: 10,
            filter: 'drop-shadow(0 2px 5px rgba(0,0,0,0.5))'
          }}></div>

          {/* Wheel Board */}
          <div 
            style={{
              width: '100%',
              height: '100%',
              borderRadius: '50%',
              border: '6px solid var(--bg-tertiary)',
              boxShadow: '0 8px 30px rgba(0,0,0,0.5), var(--shadow-glow)',
              position: 'relative',
              overflow: 'hidden',
              transform: `rotate(${rotation}deg)`,
              transition: spinning ? 'transform 3s cubic-bezier(0.15, 0.85, 0.35, 1)' : 'none',
              background: '#120e25'
            }}
          >
            <svg viewBox="0 0 200 200" style={{ width: '100%', height: '100%', display: 'block' }}>
              <g>
                {WHEEL_ITEMS.map((item, idx) => {
                  const startAngle = idx * 60;
                  const endAngle = (idx + 1) * 60;
                  const midAngle = startAngle + 30;
                  const textPos = polarToCartesian(100, 100, 62, midAngle);
                  const pathD = describeArc(100, 100, 100, startAngle, endAngle);
                  
                  return (
                    <g key={idx}>
                      <path d={pathD} fill={item.color} stroke="rgba(255, 255, 255, 0.15)" strokeWidth="1" />
                      <text
                        x={textPos.x}
                        y={textPos.y}
                        fill="white"
                        fontWeight="800"
                        fontSize="9.5px"
                        textAnchor="middle"
                        dominantBaseline="middle"
                        transform={`rotate(${midAngle}, ${textPos.x}, ${textPos.y})`}
                      >
                        {item.text}
                      </text>
                    </g>
                  );
                })}
              </g>
            </svg>
          </div>

          {/* Central Pin */}
          <div style={{
            position: 'absolute',
            top: 'calc(50% - 25px)',
            left: 'calc(50% - 25px)',
            width: '50px',
            height: '50px',
            borderRadius: '50%',
            background: 'var(--grad-primary)',
            border: '3px solid white',
            boxShadow: '0 4px 10px rgba(0,0,0,0.5)',
            zIndex: 15,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: 800,
            fontSize: '0.9rem',
            color: 'white',
            cursor: spinning ? 'default' : 'pointer'
          }} onClick={handleSpin}>
            SPIN
          </div>
        </div>

        {/* Action Button & Result */}
        {rewardLabel === null ? (
          <button
            onClick={handleSpin}
            disabled={spinning}
            className="btn btn-primary"
            style={{ width: '100%', padding: '14px', borderRadius: '12px', fontSize: '1rem' }}
          >
            {spinning ? 'Đang quay...' : isFree ? 'QUAY MIỄN PHÍ' : 'QUAY (30 xu)'}
          </button>
        ) : (
          <div style={{ animation: 'pulse 1s ease' }}>
            <h3 style={{ color: '#f1c40f', fontSize: '1.3rem', fontWeight: 800, marginBottom: '6px' }}>
              🎁 Bạn nhận được: {rewardLabel}!
            </h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)', marginBottom: '16px' }}>
              Phần thưởng đã được cộng trực tiếp vào túi đồ của bạn.
            </p>
            <button
              onClick={onClose}
              className="btn btn-secondary"
              style={{ width: '100%', padding: '10px', borderRadius: '12px' }}
            >
              Đóng
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
