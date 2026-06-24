import React, { useEffect, useState } from 'react';
import { ShoppingBag, Zap, Shield, Gift, Sparkles } from 'lucide-react';
import { CoinService, CoinData } from '../services/coinService';

interface ShopProps {
  onOpenGacha: () => void;
}

const FRAMES_CATALOG = [
  { id: 'neon_blue', name: 'Khung Neon Xanh', price: 150, color: '#00bcd4', desc: 'Viền xanh neon điện tử hiện đại' },
  { id: 'cosmic_purple', name: 'Khung Vũ Trụ', price: 250, color: '#9c27b0', desc: 'Viền tím tinh vân vũ trụ huyền bí' },
  { id: 'fire_red', name: 'Khung Lửa Đỏ', price: 350, color: '#e53935', desc: 'Viền lửa rực cháy nhiệt huyết' },
  { id: 'gold', name: 'Khung Hoàng Kim', price: 500, color: '#f1c40f', desc: 'Viền vàng hoàng gia sang trọng tối thượng' },
];

export const Shop: React.FC<ShopProps> = ({ onOpenGacha }) => {
  const [coinData, setCoinData] = useState<CoinData>(CoinService.getData());
  const [buying, setBuying] = useState<string | null>(null);

  useEffect(() => {
    const unsub = CoinService.subscribe((data) => {
      setCoinData(data);
    });
    return unsub;
  }, []);

  const handleBuyBooster = async () => {
    if (coinData.balance < 300) {
      alert('Không đủ xu!');
      return;
    }
    if (confirm('Mua Coin Booster x2?\nTất cả xu kiếm được sẽ nhân đôi trong 24 giờ.\nGiá: 300 xu.')) {
      setBuying('booster');
      const ok = await CoinService.purchaseBooster();
      setBuying(null);
      if (ok) alert('⚡ Coin Booster x2 đã kích hoạt 24h!');
    }
  };

  const handleBuyShield = async () => {
    if (coinData.balance < 150) {
      alert('Không đủ xu!');
      return;
    }
    if (confirm('Mua 1 Lá chắn Streak?\nBảo vệ chuỗi điểm danh của bạn nếu lỡ 1 ngày.\nGiá: 150 xu.')) {
      setBuying('shield');
      const ok = await CoinService.purchaseStreakShield();
      setBuying(null);
      if (ok) alert('🛡️ Đã cộng thêm 1 lá chắn streak!');
    }
  };

  const handleBuyFrame = async (frameId: string, price: number) => {
    if (coinData.ownedFrames.includes(frameId)) {
      // Equip it
      await CoinService.setActiveFrame(coinData.activeFrame === frameId ? 'none' : frameId);
      return;
    }

    if (coinData.balance < price) {
      alert('Không đủ xu!');
      return;
    }

    if (confirm(`Mua khung viền này với giá ${price} xu?`)) {
      setBuying(frameId);
      const ok = await CoinService.buyAvatarFrame(frameId, price);
      setBuying(null);
      if (ok) {
        alert('✨ Mua khung viền thành công! Bạn đã trang bị vật phẩm.');
        await CoinService.setActiveFrame(frameId);
      }
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      
      {/* Page Header */}
      <div style={{ borderBottom: 'var(--border-glass)', paddingBottom: '16px' }}>
        <h2 style={{ fontSize: '1.5rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '10px' }}>
          <ShoppingBag color="var(--primary-color)" /> Cửa Hàng Vật Phẩm
        </h2>
        <p style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)', marginTop: '4px' }}>
          Tiêu xu của bạn để sở hữu vật phẩm hỗ trợ cược hoặc các đồ trang trí Avatar phong cách.
        </p>
      </div>

      {/* Utilities / Consumables Sections */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px' }}>
        
        {/* Booster Card */}
        <div className="glass" style={{ padding: '24px', display: 'flex', flexDirection: 'column', justifyItems: 'space-between', justifyContent: 'space-between' }}>
          <div>
            <div style={{ display: 'inline-flex', width: '42px', height: '42px', borderRadius: '10px', background: 'rgba(124, 111, 255, 0.1)', alignItems: 'center', justifyContent: 'center', marginBottom: '16px' }}>
              <Zap color="#7c6fff" size={24} className={coinData.boosterActive ? "pulse-primary" : ""} />
            </div>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: 'white' }}>Coin Booster x2 (24h)</h3>
            <p style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)', marginTop: '8px', lineHeight: '1.4' }}>
              Nhân đôi tất cả số xu bạn kiếm được từ điểm danh, nhiệm vụ ngày, và kết quả chơi game đơn trong vòng 24 giờ.
            </p>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '20px' }}>
            <span style={{ fontWeight: 800, color: '#f1c40f' }}>🪙 300 xu</span>
            <button 
              onClick={handleBuyBooster}
              disabled={buying !== null}
              className="btn btn-primary"
              style={{ padding: '8px 16px', fontSize: '0.85rem' }}
            >
              {buying === 'booster' ? 'Đang mua...' : coinData.boosterActive ? 'Kích Hoạt Tiếp' : 'Mua Ngay'}
            </button>
          </div>
        </div>

        {/* Shield Card */}
        <div className="glass" style={{ padding: '24px', display: 'flex', flexDirection: 'column', justifyItems: 'space-between', justifyContent: 'space-between' }}>
          <div>
            <div style={{ display: 'inline-flex', width: '42px', height: '42px', borderRadius: '10px', background: 'rgba(0, 188, 212, 0.1)', alignItems: 'center', justifyContent: 'center', marginBottom: '16px' }}>
              <Shield color="#00bcd4" size={24} />
            </div>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: 'white' }}>Lá Chắn Streak Shield</h3>
            <p style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)', marginTop: '8px', lineHeight: '1.4' }}>
              Bảo vệ chuỗi ngày điểm danh (streak) của bạn không bị reset về Ngày 1 nếu bạn lỡ quên điểm danh 1 ngày.
            </p>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '20px' }}>
            <span style={{ fontWeight: 800, color: '#f1c40f' }}>🪙 150 xu</span>
            <button 
              onClick={handleBuyShield}
              disabled={buying !== null}
              className="btn btn-primary"
              style={{ padding: '8px 16px', fontSize: '0.85rem' }}
            >
              {buying === 'shield' ? 'Đang mua...' : `Mua Ngay (${coinData.shieldCount})`}
            </button>
          </div>
        </div>

        {/* Chest Gacha Card */}
        <div className="glass" style={{ padding: '24px', display: 'flex', flexDirection: 'column', justifyItems: 'space-between', justifyContent: 'space-between' }}>
          <div>
            <div style={{ display: 'inline-flex', width: '42px', height: '42px', borderRadius: '10px', background: 'rgba(46, 204, 113, 0.1)', alignItems: 'center', justifyContent: 'center', marginBottom: '16px' }}>
              <Gift color="#2ecc71" size={24} />
            </div>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: 'white' }}>Rương Quà May Mắn</h3>
            <p style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)', marginTop: '8px', lineHeight: '1.4' }}>
              Thử vận may của bạn! Mở rương tiêu tốn 100 xu để nhận lại ngẫu nhiên từ 25 xu đến 500 xu Jackpot.
            </p>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '20px' }}>
            <span style={{ fontWeight: 800, color: '#f1c40f' }}>🪙 100 xu</span>
            <button 
              onClick={onOpenGacha}
              className="btn btn-primary"
              style={{ padding: '8px 16px', fontSize: '0.85rem' }}
            >
              Mở Rương
            </button>
          </div>
        </div>

      </div>

      {/* Avatar Frames Catalog */}
      <div style={{ marginTop: '20px' }}>
        <h3 style={{ fontSize: '1.25rem', fontWeight: 800, marginBottom: '16px', color: 'white', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Sparkles color="#f1c40f" size={20} /> Khung Viền Ảnh Đại Diện (Cosmetics)
        </h3>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '20px' }}>
          {FRAMES_CATALOG.map((frame) => {
            const isOwned = coinData.ownedFrames.includes(frame.id);
            const isActive = coinData.activeFrame === frame.id;
            
            return (
              <div 
                key={frame.id} 
                className="glass" 
                style={{ 
                  padding: '20px', 
                  borderRadius: '16px', 
                  textAlign: 'center', 
                  border: isActive ? `2px solid ${frame.color}` : 'var(--border-glass)',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  height: '220px'
                }}
              >
                {/* Visual Representation */}
                <div style={{ display: 'flex', justifyItems: 'center', justifyContent: 'center', margin: '0 auto 12px auto' }}>
                  <div style={{
                    width: '60px',
                    height: '60px',
                    borderRadius: '50%',
                    border: `4px solid ${frame.color}`,
                    boxShadow: `0 0 12px ${frame.color}80`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: 'rgba(255,255,255,0.05)',
                    fontWeight: 800,
                    color: 'white',
                    fontSize: '1.2rem'
                  }}>
                    Ω
                  </div>
                </div>

                <div>
                  <h4 style={{ fontSize: '1rem', fontWeight: 700, color: 'white' }}>{frame.name}</h4>
                  <p style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', marginTop: '4px', height: '36px', overflow: 'hidden' }}>
                    {frame.desc}
                  </p>
                </div>

                <div style={{ marginTop: '12px' }}>
                  <button
                    onClick={() => handleBuyFrame(frame.id, frame.price)}
                    disabled={buying !== null}
                    className="btn"
                    style={{
                      width: '100%',
                      padding: '8px',
                      borderRadius: '10px',
                      fontSize: '0.8rem',
                      background: isActive 
                        ? 'var(--danger-color)' 
                        : isOwned 
                          ? 'rgba(46, 204, 113, 0.15)' 
                          : 'var(--grad-primary)',
                      color: isOwned && !isActive ? '#2ecc71' : 'white',
                      border: isOwned && !isActive ? '1px solid rgba(46,204,113,0.3)' : 'none',
                      fontWeight: 700
                    }}
                  >
                    {buying === frame.id 
                      ? 'Đang mua...' 
                      : isActive 
                        ? 'Tháo Khung' 
                        : isOwned 
                          ? 'Trang bị' 
                          : `Mua - ${frame.price} xu`
                    }
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

    </div>
  );
};
