import React, { useEffect, useState } from 'react';
import { User, Calendar } from 'lucide-react';
import { AuthService, PlayerModel } from '../services/authService';
import { CoinService, CoinData } from '../services/coinService';
import { WeeklyMissionService, WeeklyMissionData } from '../services/weeklyMissionService';

export const Profile: React.FC = () => {
  const [player, setPlayer] = useState<PlayerModel | null>(AuthService.getPlayer());
  const [coinData, setCoinData] = useState<CoinData>(CoinService.getData());
  const [weeklyData, setWeeklyData] = useState<WeeklyMissionData>(WeeklyMissionService.getData());
  const [newName, setNewName] = useState('');
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    const unsubAuth = AuthService.subscribe((p) => {
      setPlayer(p);
      if (p) setNewName(p.displayName);
    });
    const unsubCoins = CoinService.subscribe((data) => {
      setCoinData(data);
    });
    const unsubWeekly = WeeklyMissionService.subscribe((data) => {
      setWeeklyData(data);
    });

    return () => {
      unsubAuth();
      unsubCoins();
      unsubWeekly();
    };
  }, []);

  const handleUpdateName = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!player || !newName.trim()) return;
    setUpdating(true);
    try {
      await AuthService.updateDisplayName(newName.trim());
      alert('Đã cập nhật tên hiển thị thành công!');
    } catch (err: any) {
      alert(err.message || 'Cập nhật tên thất bại');
    } finally {
      setUpdating(false);
    }
  };

  const getFrameStyle = (frameId: string) => {
    switch (frameId) {
      case 'gold': return { border: '4px solid #f1c40f', boxShadow: '0 0 10px #f1c40f' };
      case 'neon_blue': return { border: '4px solid #00bcd4', boxShadow: '0 0 10px #00bcd4' };
      case 'fire_red': return { border: '4px solid #e53935', boxShadow: '0 0 10px #e53935' };
      case 'cosmic_purple': return { border: '4px solid #9c27b0', boxShadow: '0 0 10px #9c27b0' };
      default: return { border: '2px solid rgba(255, 255, 255, 0.2)' };
    }
  };

  const getCategoryLabel = (cat: string) => {
    switch (cat) {
      case 'lucky': return '🎰 May Mắn';
      case 'action': return '🎮 Phản Xạ';
      case 'puzzle': return '🧩 Trí Tuệ';
      case 'strategy': return '🔤 Chiến Lược';
      default: return '';
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      
      {/* Profile Header */}
      <div style={{ borderBottom: 'var(--border-glass)', paddingBottom: '16px' }}>
        <h2 style={{ fontSize: '1.5rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '10px' }}>
          <User color="var(--primary-color)" /> Thông Tin Tài Khoản
        </h2>
        <p style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)', marginTop: '4px' }}>
          Quản lý thông tin hồ sơ cá nhân và theo dõi nhiệm vụ tuần của bạn.
        </p>
      </div>

      {/* Main Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '24px' }}>
        
        {/* Left Side: Avatar & Name update */}
        <div className="glass" style={{ padding: '30px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '24px' }}>
            <div style={{
              width: '90px',
              height: '90px',
              borderRadius: '50%',
              background: 'rgba(255,255,255,0.05)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '2.5rem',
              fontWeight: 800,
              position: 'relative',
              marginBottom: '16px',
              ...getFrameStyle(coinData.activeFrame)
            }}>
              {player ? player.displayName.substring(0, 1).toUpperCase() : 'G'}
            </div>
            
            <h3 style={{ color: 'white', fontWeight: 800, fontSize: '1.25rem' }}>
              {player ? player.displayName : 'Chế độ khách (Guest)'}
            </h3>
            <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: '4px' }}>
              ID: {player ? player.id : 'Offline Local Storage'}
            </span>
          </div>

          {player ? (
            <form onSubmit={handleUpdateName} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--color-text-secondary)' }}>
                  Thay đổi tên hiển thị
                </label>
                <input 
                  type="text" 
                  value={newName} 
                  onChange={(e) => setNewName(e.target.value)} 
                  required
                />
              </div>
              <button 
                type="submit" 
                disabled={updating || newName.trim() === player.displayName}
                className="btn btn-primary"
                style={{ width: '100%', padding: '10px' }}
              >
                {updating ? 'Đang cập nhật...' : 'Lưu Thay Đổi'}
              </button>
            </form>
          ) : (
            <div style={{ textAlign: 'center', fontSize: '0.85rem', color: 'var(--color-text-secondary)', background: 'rgba(255,255,255,0.02)', padding: '12px', borderRadius: '10px', border: 'var(--border-glass)' }}>
              🔒 Đăng nhập để thay đổi tên hiển thị của bạn trên bảng xếp hạng và phòng chơi Multiplayer.
            </div>
          )}
        </div>

        {/* Right Side: Weekly Missions */}
        <div className="glass" style={{ padding: '30px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: 'white', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Calendar color="#7c6fff" size={20} /> Thử Thách Nhiệm Vụ Tuần
          </h3>
          <p style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', marginTop: '-8px' }}>
            Bắt đầu từ thứ Hai. Tự động reset và tính toán lại khi sang tuần mới.
          </p>

          {/* Category Challenge */}
          <div style={{ padding: '16px', background: 'rgba(255,255,255,0.02)', borderRadius: '12px', border: 'var(--border-glass)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
              <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'white' }}>1. Thử thách 4 Danh mục</span>
              <span style={{ fontSize: '0.8rem', color: weeklyData.categoryRewardClaimed ? '#2ecc71' : '#f1c40f', fontWeight: 700 }}>
                {weeklyData.categoryRewardClaimed ? 'Đã Nhận (+500)' : '+500 xu'}
              </span>
            </div>
            <p style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', marginBottom: '12px' }}>
              Chơi ít nhất 1 trò chơi thuộc mỗi danh mục dưới đây:
            </p>

            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              {['lucky', 'action', 'puzzle', 'strategy'].map((cat) => {
                const done = weeklyData.categoriesDone.includes(cat as any);
                return (
                  <span 
                    key={cat}
                    style={{
                      fontSize: '0.7rem',
                      fontWeight: 700,
                      padding: '4px 10px',
                      borderRadius: '20px',
                      background: done ? 'rgba(46, 204, 113, 0.15)' : 'rgba(255, 255, 255, 0.03)',
                      color: done ? '#2ecc71' : 'var(--color-text-muted)',
                      border: done ? '1px solid rgba(46, 204, 113, 0.3)' : '1px dashed rgba(255, 255, 255, 0.08)',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}
                  >
                    {done ? '✓' : '•'} {getCategoryLabel(cat)}
                  </span>
                );
              })}
            </div>
          </div>

          {/* Gambling Win Challenge */}
          <div style={{ padding: '16px', background: 'rgba(255,255,255,0.02)', borderRadius: '12px', border: 'var(--border-glass)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
              <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'white' }}>2. Cờ Bạc Thắng Lớn</span>
              <span style={{ fontSize: '0.8rem', color: weeklyData.gamblingRewardClaimed ? '#2ecc71' : '#f1c40f', fontWeight: 700 }}>
                {weeklyData.gamblingRewardClaimed ? 'Đã Nhận (+300)' : '+300 xu'}
              </span>
            </div>
            <p style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', marginBottom: '8px' }}>
              Đạt tối thiểu 3 ván thắng cược ở các trò Bầu Cua, Đỏ Đen hoặc Xì Jack.
            </p>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ flexGrow: 1, height: '6px', background: 'rgba(255,255,255,0.05)', borderRadius: '3px', overflow: 'hidden' }}>
                <div style={{ 
                  width: `${Math.min(100, (weeklyData.gamblingWinsThisWeek / 3) * 100)}%`, 
                  height: '100%', 
                  background: weeklyData.gamblingWinsThisWeek >= 3 ? 'var(--grad-primary)' : '#ff6b35',
                  transition: 'width 0.3s'
                }}></div>
              </div>
              <span style={{ fontSize: '0.75rem', fontWeight: 800, color: 'white' }}>
                {weeklyData.gamblingWinsThisWeek}/3 ván
              </span>
            </div>
          </div>

        </div>

      </div>

    </div>
  );
};
