import React, { useEffect, useState } from 'react';
import { Coins, Flame, Zap, LogOut, Gift, LogIn } from 'lucide-react';
import { AuthService, PlayerModel } from '../services/authService';
import { CoinService, CoinData } from '../services/coinService';

interface HeaderProps {
  onOpenDaily: () => void;
  onOpenWheel: () => void;
  onOpenGacha: () => void;
  onSwitchToLogin?: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onOpenDaily, onOpenWheel, onOpenGacha, onSwitchToLogin }) => {
  const [player, setPlayer] = useState<PlayerModel | null>(AuthService.getPlayer());
  const [coinData, setCoinData] = useState<CoinData>(CoinService.getData());
  const [boosterTimeStr, setBoosterTimeStr] = useState<string>('');

  useEffect(() => {
    const unsubAuth = AuthService.subscribe((p) => {
      setPlayer(p);
    });
    const unsubCoins = CoinService.subscribe((data) => {
      setCoinData(data);
    });

    return () => {
      unsubAuth();
      unsubCoins();
    };
  }, []);

  // Update booster timer
  useEffect(() => {
    const timer = setInterval(() => {
      if (coinData.boosterActive && coinData.boosterExpiry) {
        const diff = new Date(coinData.boosterExpiry).getTime() - Date.now();
        if (diff > 0) {
          const hours = Math.floor(diff / (1000 * 60 * 60));
          const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
          const secs = Math.floor((diff % (1000 * 60)) / 1000);
          setBoosterTimeStr(`${hours}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`);
        } else {
          setBoosterTimeStr('');
        }
      } else {
        setBoosterTimeStr('');
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [coinData]);

  // Frame colors/styles mapping
  const getFrameStyle = (frameId: string) => {
    switch (frameId) {
      case 'gold':
        return { border: '3px solid #f1c40f', boxShadow: '0 0 10px #f1c40f' };
      case 'neon_blue':
        return { border: '3px solid #00bcd4', boxShadow: '0 0 10px #00bcd4' };
      case 'fire_red':
        return { border: '3px solid #e53935', boxShadow: '0 0 10px #e53935' };
      case 'cosmic_purple':
        return { border: '3px solid #9c27b0', boxShadow: '0 0 10px #9c27b0' };
      default:
        return { border: '2px solid rgba(255, 255, 255, 0.2)' };
    }
  };

  const getFrameLabel = (frameId: string) => {
    switch (frameId) {
      case 'gold': return 'Khung Hoàng Kim';
      case 'neon_blue': return 'Khung Neon Xanh';
      case 'fire_red': return 'Khung Lửa Đỏ';
      case 'cosmic_purple': return 'Khung Vũ Trụ';
      default: return '';
    }
  };

  return (
    <header className="glass" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 24px', width: '100%', marginBottom: '24px' }}>
      {/* Brand */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'var(--grad-primary)', display: 'flex', alignItems: 'center', justifyItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '1.4rem' }}>Ω</div>
        <div>
          <h1 className="gradient-text" style={{ fontSize: '1.25rem', fontWeight: 800, letterSpacing: '0.5px' }}>SUPER GATE</h1>
          <span style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>Phiên Bản Web</span>
        </div>
      </div>

      {/* Metrics & Actions */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
        {player ? (
          <>
            {/* Coin Balance */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(255, 255, 255, 0.05)', padding: '6px 12px', borderRadius: '10px', border: 'var(--border-glass)' }}>
              <Coins color="#f1c40f" size={18} />
              <span style={{ fontWeight: 700, fontSize: '0.95rem', color: '#f1c40f' }}>{coinData.balance.toLocaleString()} xu</span>
            </div>

            {/* Streak Daily */}
            <div 
              onClick={onOpenDaily}
              style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(255, 255, 255, 0.05)', padding: '6px 12px', borderRadius: '10px', border: 'var(--border-glass)', cursor: 'pointer' }}
              className="glass-interactive"
              title="Nhấn để điểm danh hàng ngày"
            >
              <Flame color="#ff6b35" size={18} className={coinData.streakDay > 0 ? "pulse-primary" : ""} />
              <span style={{ fontWeight: 700, fontSize: '0.95rem', color: '#ff6b35' }}>
                {coinData.streakDay} ngày
              </span>
              {coinData.shieldCount > 0 && (
                <span style={{ fontSize: '0.75rem', background: '#00bcd4', color: 'white', padding: '1px 6px', borderRadius: '8px', fontWeight: 700 }}>
                  🛡️ {coinData.shieldCount}
                </span>
              )}
            </div>

            {/* Booster indicator */}
            {coinData.boosterActive && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(124, 111, 255, 0.1)', padding: '6px 12px', borderRadius: '10px', border: '1px solid rgba(124, 111, 255, 0.3)' }} title="Nhân đôi toàn bộ xu thưởng kiếm được!">
                <Zap color="#7c6fff" size={18} className="pulse-primary" />
                <span style={{ fontWeight: 700, fontSize: '0.85rem', color: '#a29bfe' }}>x2: {boosterTimeStr}</span>
              </div>
            )}

            {/* Daily Chest Gacha Shortcut */}
            <button 
              onClick={onOpenGacha}
              className="btn btn-secondary" 
              style={{ padding: '6px 12px', borderRadius: '10px', height: '36px', fontSize: '0.85rem' }}
            >
              <Gift size={16} color="#00bcd4" />
              <span>Rương {coinData.freeLuckyBoxes > 0 ? `(${coinData.freeLuckyBoxes})` : ''}</span>
            </button>

            {/* Daily Wheel Shortcut */}
            <button 
              onClick={onOpenWheel}
              className="btn btn-secondary" 
              style={{ padding: '6px 12px', borderRadius: '10px', height: '36px', fontSize: '0.85rem' }}
            >
              <span>🎡 Vòng Quay</span>
            </button>

            {/* User Profile Info with Frame */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div 
                style={{ 
                  width: '38px', 
                  height: '38px', 
                  borderRadius: '50%', 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center',
                  background: 'rgba(255, 255, 255, 0.1)',
                  position: 'relative',
                  ...getFrameStyle(coinData.activeFrame)
                }}
                title={getFrameLabel(coinData.activeFrame)}
              >
                <span style={{ fontSize: '0.9rem', fontWeight: 700 }}>{player.displayName.substring(0, 1).toUpperCase()}</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>{player.displayName}</span>
                <span style={{ fontSize: '0.65rem', color: 'var(--color-text-muted)' }}>Mã: {player.id.substring(0, 6)}</span>
              </div>
            </div>

            {/* Logout */}
            <button 
              onClick={() => AuthService.signOut()} 
              style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', color: 'var(--color-text-muted)' }} 
              title="Đăng xuất"
            >
              <LogOut size={18} className="glass-interactive" style={{ borderRadius: '4px' }} />
            </button>
          </>
        ) : (
          <>
            {/* Coin balance (guest vẫn có xu lưu local) */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(255, 255, 255, 0.05)', padding: '6px 12px', borderRadius: '10px', border: 'var(--border-glass)' }}>
              <Coins color="#f1c40f" size={18} />
              <span style={{ fontWeight: 700, fontSize: '0.95rem', color: '#f1c40f' }}>{coinData.balance.toLocaleString()} xu</span>
            </div>

            {/* Streak Daily */}
            <div
              onClick={onOpenDaily}
              style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(255, 255, 255, 0.05)', padding: '6px 12px', borderRadius: '10px', border: 'var(--border-glass)', cursor: 'pointer' }}
              className="glass-interactive"
              title="Nhấn để điểm danh hàng ngày"
            >
              <Flame color="#ff6b35" size={18} className={coinData.streakDay > 0 ? 'pulse-primary' : ''} />
              <span style={{ fontWeight: 700, fontSize: '0.95rem', color: '#ff6b35' }}>{coinData.streakDay} ngày</span>
            </div>

            {/* Daily Chest */}
            <button
              onClick={onOpenGacha}
              className="btn btn-secondary"
              style={{ padding: '6px 12px', borderRadius: '10px', height: '36px', fontSize: '0.85rem' }}
            >
              <Gift size={16} color="#00bcd4" />
              <span>Rương {coinData.freeLuckyBoxes > 0 ? `(${coinData.freeLuckyBoxes})` : ''}</span>
            </button>

            {/* Daily Wheel */}
            <button
              onClick={onOpenWheel}
              className="btn btn-secondary"
              style={{ padding: '6px 12px', borderRadius: '10px', height: '36px', fontSize: '0.85rem' }}
            >
              <span>🎡 Vòng Quay</span>
            </button>

            {/* Guest badge + Login button */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div
                title="Bạn đang chơi ở chế độ khách. Tiến trình lưu cục bộ trên trình duyệt."
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '5px 10px',
                  borderRadius: '10px',
                  background: 'rgba(255, 255, 255, 0.04)',
                  border: '1px dashed rgba(255,255,255,0.18)',
                  fontSize: '0.72rem',
                  color: 'rgba(255,255,255,0.65)',
                  fontWeight: 700,
                  letterSpacing: 0.5,
                }}
              >
                👤 KHÁCH
              </div>

              <button
                onClick={onSwitchToLogin}
                title="Đăng nhập để lưu tiến trình và chơi multiplayer"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '8px 14px',
                  borderRadius: '10px',
                  background: 'linear-gradient(135deg, #7c6fff 0%, #a29bfe 100%)',
                  color: 'white',
                  fontWeight: 800,
                  fontSize: '0.85rem',
                  border: 'none',
                  cursor: 'pointer',
                  boxShadow: '0 4px 14px rgba(124, 111, 255, 0.35)',
                  letterSpacing: 0.3,
                }}
                className="glass-interactive"
              >
                <LogIn size={15} />
                Đăng nhập
              </button>
            </div>
          </>
        )}
      </div>
    </header>
  );
};
