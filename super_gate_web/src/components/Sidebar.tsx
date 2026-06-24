import React from 'react';
import { Home, Users, ShoppingBag, Award, User } from 'lucide-react';

export type SidebarTab = 'dashboard' | 'multiplayer' | 'shop' | 'achievements' | 'profile';

interface SidebarProps {
  activeTab: SidebarTab;
  onChangeTab: (tab: SidebarTab) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ activeTab, onChangeTab }) => {
  const menuItems = [
    { id: 'dashboard', name: 'Kho Game Đơn', icon: <Home size={18} /> },
    { id: 'multiplayer', name: 'Cược Trực Tuyến', icon: <Users size={18} /> },
    { id: 'shop', name: 'Cửa Hàng Vật Phẩm', icon: <ShoppingBag size={18} /> },
    { id: 'achievements', name: 'Thành Tích & Huy Hiệu', icon: <Award size={18} /> },
    { id: 'profile', name: 'Thông Tin Tài Khoản', icon: <User size={18} /> },
  ] as const;

  return (
    <aside className="sidebar">
      {/* Platform Logo Title */}
      <div style={{ marginBottom: '40px', paddingLeft: '10px' }}>
        <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: 'white', display: 'flex', alignItems: 'center', gap: '8px' }}>
          Super Gate
        </h2>
        <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', fontWeight: 500 }}>
          Cổng Game Trí Tuệ & Cược Xu
        </p>
      </div>

      {/* Navigation Items */}
      <nav style={{ display: 'flex', flexDirection: 'column', gap: '8px', flexGrow: 1 }}>
        {menuItems.map((item) => {
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onChangeTab(item.id)}
              className="btn"
              style={{
                justifyContent: 'flex-start',
                padding: '12px 16px',
                borderRadius: '12px',
                width: '100%',
                background: isActive ? 'var(--grad-primary)' : 'transparent',
                color: isActive ? 'white' : 'var(--color-text-secondary)',
                border: 'none',
                transition: 'all 0.2s ease',
                boxShadow: isActive ? '0 4px 15px rgba(124, 111, 255, 0.25)' : 'none',
              }}
            >
              <span style={{ color: isActive ? 'white' : 'var(--primary-color)' }}>
                {item.icon}
              </span>
              <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>{item.name}</span>
            </button>
          );
        })}
      </nav>

      {/* Version Tag */}
      <div style={{ borderTop: 'var(--border-glass)', paddingTop: '20px', paddingLeft: '10px' }}>
        <span style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', fontWeight: 500 }}>
          Phiên bản: Web 2.0 (React-TS)
        </span>
      </div>
    </aside>
  );
};
