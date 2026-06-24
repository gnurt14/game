import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { JackpotService } from '../services/jackpotService';
import { AuthService } from '../services/authService';

interface JackpotModalProps {
  onClose: () => void;
}

export const JackpotModal: React.FC<JackpotModalProps> = ({ onClose }) => {
  const [pool, setPool] = useState<number>(JackpotService.getPool());
  const [myTickets, setMyTickets] = useState<number>(JackpotService.getMyTickets());
  const [totalTickets, setTotalTickets] = useState<number>(JackpotService.getTotalTickets());
  const [leaderboard, setLeaderboard] = useState(JackpotService.getLeaderboard(10));

  useEffect(() => {
    const unsub = JackpotService.subscribe(() => {
      setPool(JackpotService.getPool());
      setMyTickets(JackpotService.getMyTickets());
      setTotalTickets(JackpotService.getTotalTickets());
      setLeaderboard(JackpotService.getLeaderboard(10));
    });
    return unsub;
  }, []);

  const me = AuthService.getPlayer()?.id || 'guest';
  const winChance = totalTickets > 0 ? (myTickets / totalTickets) * 100 : 0;

  return (
    <div style={overlayStyle} onClick={onClose}>
      <div style={modalStyle} onClick={(e) => e.stopPropagation()} className="glass">
        <button onClick={onClose} style={closeBtnStyle} title="Đóng">
          <X size={18} />
        </button>

        <h2 style={{ fontSize: '1.4rem', fontWeight: 800, textAlign: 'center', marginBottom: '4px' }}>
          🎰 Daily Jackpot
        </h2>
        <p style={{ textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '0.8rem', marginBottom: '16px' }}>
          Càng cược nhiều, càng có nhiều vé. Cuối ngày bốc thăm trúng pool.
        </p>

        {/* Pool */}
        <div
          style={{
            background: 'linear-gradient(135deg, #ffd700 0%, #ffa500 100%)',
            padding: '20px',
            borderRadius: '14px',
            textAlign: 'center',
            color: '#1a1a1a',
            fontWeight: 800,
            marginBottom: '16px',
          }}
        >
          <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: 1 }}>POOL HÔM NAY</div>
          <div style={{ fontSize: '2rem', marginTop: '4px' }}>{pool.toLocaleString()} xu</div>
        </div>

        {/* My stats */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
          <div style={statBoxStyle}>
            <div style={statLabel}>Vé của tôi</div>
            <div style={statValue}>{myTickets}</div>
          </div>
          <div style={statBoxStyle}>
            <div style={statLabel}>Tỉ lệ trúng</div>
            <div style={statValue}>{winChance.toFixed(1)}%</div>
          </div>
        </div>

        {/* Leaderboard */}
        <h3 style={{ fontSize: '0.95rem', fontWeight: 800, marginBottom: '8px' }}>🏆 Top vé hôm nay</h3>
        <div style={{ maxHeight: '240px', overflowY: 'auto', borderRadius: '10px', border: 'var(--border-glass)' }}>
          {leaderboard.length === 0 ? (
            <div style={{ padding: '20px', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>
              Chưa có ai có vé hôm nay
            </div>
          ) : (
            leaderboard.map((row, idx) => (
              <div
                key={row.playerId}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '8px 12px',
                  background: row.isMe ? 'rgba(241, 196, 15, 0.15)' : idx % 2 === 0 ? 'rgba(255,255,255,0.02)' : 'transparent',
                  borderBottom: '1px solid rgba(255,255,255,0.05)',
                }}
              >
                <span style={{ fontSize: '0.85rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ width: '24px', textAlign: 'center' }}>{idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `#${idx + 1}`}</span>
                  <span>{row.isMe ? `Bạn (${row.playerId.substring(0, 6)})` : (row.playerId === me ? 'Bạn' : (row.playerId.startsWith('Bot_') ? row.playerId : row.playerId.substring(0, 8)))}</span>
                </span>
                <span style={{ fontSize: '0.85rem', fontWeight: 800, color: '#f1c40f' }}>{row.tickets} vé</span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

const overlayStyle: React.CSSProperties = {
  position: 'fixed',
  top: 0, left: 0, right: 0, bottom: 0,
  background: 'rgba(0, 0, 0, 0.7)',
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
  zIndex: 1000,
  padding: '20px',
};

const modalStyle: React.CSSProperties = {
  width: '100%',
  maxWidth: '460px',
  padding: '24px',
  borderRadius: '16px',
  position: 'relative',
};

const closeBtnStyle: React.CSSProperties = {
  position: 'absolute',
  top: '12px',
  right: '12px',
  background: 'rgba(255,255,255,0.1)',
  border: 'none',
  borderRadius: '50%',
  width: '32px',
  height: '32px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  cursor: 'pointer',
  color: 'white',
};

const statBoxStyle: React.CSSProperties = {
  background: 'rgba(255,255,255,0.04)',
  padding: '12px',
  borderRadius: '10px',
  border: 'var(--border-glass)',
  textAlign: 'center',
};

const statLabel: React.CSSProperties = {
  fontSize: '0.7rem',
  color: 'var(--color-text-muted)',
  textTransform: 'uppercase',
  letterSpacing: 0.5,
};

const statValue: React.CSSProperties = {
  fontSize: '1.4rem',
  fontWeight: 800,
  marginTop: '4px',
  color: '#f1c40f',
};
