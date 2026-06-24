import React, { useEffect, useState } from 'react';
import { Coins, Flame, Zap, LogOut, LogIn } from 'lucide-react';
import { AuthService, PlayerModel } from '../services/authService';
import { CoinService, CoinData } from '../services/coinService';
import { HappyHourService } from '../services/happyHourService';
import { JackpotService } from '../services/jackpotService';
import { VipService, VipTier } from '../services/vipService';
import { JackpotModal } from './JackpotModal';
import { VipModal } from './VipModal';

interface HeaderProps {
  onOpenDaily: () => void;
  onOpenWheel: () => void;
  onSwitchToLogin?: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onOpenDaily, onOpenWheel, onSwitchToLogin }) => {
  const [player, setPlayer] = useState<PlayerModel | null>(AuthService.getPlayer());
  const [coinData, setCoinData] = useState<CoinData>(CoinService.getData());
  const [boosterTimeStr, setBoosterTimeStr] = useState<string>('');

  // Meta state (Happy Hour / Jackpot / VIP)
  const [hhActive, setHhActive] = useState<boolean>(HappyHourService.isActive());
  const [hhRemaining, setHhRemaining] = useState<number | null>(HappyHourService.getRemainingSec());
  const [hhMinsUntil, setHhMinsUntil] = useState<number>(HappyHourService.getMinutesUntilStart());
  const [jackpotPool, setJackpotPool] = useState<number>(JackpotService.getPool());
  const [myTickets, setMyTickets] = useState<number>(JackpotService.getMyTickets());
  const [vipTier, setVipTier] = useState<VipTier>(VipService.getTier());
  const [showJackpotModal, setShowJackpotModal] = useState<boolean>(false);
  const [showVipModal, setShowVipModal] = useState<boolean>(false);

  useEffect(() => {
    const unsubAuth = AuthService.subscribe((p) => {
      setPlayer(p);
    });
    const unsubCoins = CoinService.subscribe((data) => {
      setCoinData(data);
    });
    const unsubJackpot = JackpotService.subscribe(() => {
      setJackpotPool(JackpotService.getPool());
      setMyTickets(JackpotService.getMyTickets());
    });
    const unsubVip = VipService.subscribe(() => {
      setVipTier(VipService.getTier());
    });

    return () => {
      unsubAuth();
      unsubCoins();
      unsubJackpot();
      unsubVip();
    };
  }, []);

  // Happy Hour tick — refresh trạng thái mỗi giây
  useEffect(() => {
    const timer = setInterval(() => {
      setHhActive(HappyHourService.isActive());
      setHhRemaining(HappyHourService.getRemainingSec());
      setHhMinsUntil(HappyHourService.getMinutesUntilStart());
    }, 1000);
    return () => clearInterval(timer);
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

  const formatHhRemaining = (sec: number | null): string => {
    if (sec === null) return '';
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  // Widget Happy Hour — banner đỏ-cam nhấp nháy khi active, hoặc nhắc khi < 1h
  const renderHappyHour = () => {
    if (hhActive) {
      return (
        <div
          title="Happy Hour: x2 thưởng cho mọi game cờ bạc!"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '6px 12px',
            borderRadius: '10px',
            background: 'linear-gradient(135deg, #ff3d00 0%, #ff9800 100%)',
            color: 'white',
            fontWeight: 800,
            fontSize: '0.85rem',
            boxShadow: '0 0 12px rgba(255, 87, 34, 0.6)',
            animation: 'pulse-primary 1.2s ease-in-out infinite',
          }}
        >
          🔥 HAPPY HOUR x2 — còn {formatHhRemaining(hhRemaining)}
        </div>
      );
    }
    if (hhMinsUntil > 0 && hhMinsUntil < 60) {
      return (
        <div
          title={`Happy Hour sắp bắt đầu lúc ${HappyHourService.getStartLabel()}`}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '6px 12px',
            borderRadius: '10px',
            background: 'rgba(255, 87, 34, 0.12)',
            border: '1px solid rgba(255, 87, 34, 0.35)',
            color: '#ff8a65',
            fontWeight: 700,
            fontSize: '0.8rem',
          }}
        >
          🔥 Happy Hour: {hhMinsUntil} phút nữa
        </div>
      );
    }
    return null;
  };

  // Widget Jackpot
  const renderJackpot = () => (
    <div
      onClick={() => setShowJackpotModal(true)}
      className="glass-interactive"
      title="Daily Jackpot — click để xem chi tiết"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        padding: '6px 12px',
        borderRadius: '10px',
        background: 'linear-gradient(135deg, rgba(255, 215, 0, 0.15) 0%, rgba(255, 165, 0, 0.15) 100%)',
        border: '1px solid rgba(241, 196, 15, 0.35)',
        cursor: 'pointer',
        fontWeight: 700,
        fontSize: '0.85rem',
        color: '#f1c40f',
      }}
    >
      🎰 {jackpotPool.toLocaleString()} ({myTickets} vé)
    </div>
  );

  // Widget VIP
  const renderVipBadge = () => (
    <div
      onClick={() => setShowVipModal(true)}
      className="glass-interactive"
      title={`VIP ${vipTier.label} — click để xem chi tiết`}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        padding: '6px 12px',
        borderRadius: '10px',
        background: `linear-gradient(135deg, ${vipTier.color}33 0%, ${vipTier.color}11 100%)`,
        border: `1px solid ${vipTier.color}`,
        cursor: 'pointer',
        fontWeight: 800,
        fontSize: '0.8rem',
        color: vipTier.color,
        letterSpacing: 1,
      }}
    >
      {vipTier.emoji} {vipTier.label}
    </div>
  );

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

            {/* Meta widgets: Happy Hour / Jackpot / VIP */}
            {renderHappyHour()}
            {renderJackpot()}
            {renderVipBadge()}

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

            {/* Meta widgets cho khách */}
            {renderHappyHour()}
            {renderJackpot()}
            {renderVipBadge()}

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

            {/* Daily Wheel */}
            <button
              onClick={onOpenWheel}
              className="btn btn-secondary"
              style={{ padding: '6px 12px', borderRadius: '10px', height: '36px', fontSize: '0.85rem' }}
            >
              <span>🎡 Vòng Quay</span>
            </button>

            {/* Guest badge + Login button — Login luôn nổi bật */}
            <style>{`
              @keyframes guest-login-pulse {
                0%, 100% { box-shadow: 0 0 0 0 rgba(241, 196, 15, 0.6), 0 4px 14px rgba(241, 196, 15, 0.4); }
                50%      { box-shadow: 0 0 0 8px rgba(241, 196, 15, 0), 0 4px 20px rgba(241, 196, 15, 0.7); }
              }
            `}</style>
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
                  gap: '8px',
                  padding: '10px 18px',
                  borderRadius: '12px',
                  background: 'linear-gradient(135deg, #f1c40f 0%, #e67e22 100%)',
                  color: '#1a1138',
                  fontWeight: 900,
                  fontSize: '0.95rem',
                  border: '2px solid rgba(255, 255, 255, 0.4)',
                  cursor: 'pointer',
                  letterSpacing: 0.6,
                  animation: 'guest-login-pulse 1.8s ease-in-out infinite',
                  textTransform: 'uppercase',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.transform = 'scale(1.04)')}
                onMouseLeave={(e) => (e.currentTarget.style.transform = 'scale(1)')}
              >
                <LogIn size={17} strokeWidth={3} />
                Đăng nhập
              </button>
            </div>
          </>
        )}
      </div>

      {/* Modals */}
      {showJackpotModal && <JackpotModal onClose={() => setShowJackpotModal(false)} />}
      {showVipModal && <VipModal onClose={() => setShowVipModal(false)} />}
    </header>
  );
};
