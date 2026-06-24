import React, { useEffect, useState } from 'react';
import { X, Check } from 'lucide-react';
import { VipService, VipTier } from '../services/vipService';

interface VipModalProps {
  onClose: () => void;
}

export const VipModal: React.FC<VipModalProps> = ({ onClose }) => {
  const [tier, setTier] = useState<VipTier>(VipService.getTier());
  const [progress, setProgress] = useState(VipService.getProgress());
  const [allTiers] = useState<VipTier[]>(VipService.getAllTiers());

  useEffect(() => {
    const unsub = VipService.subscribe(() => {
      setTier(VipService.getTier());
      setProgress(VipService.getProgress());
    });
    return unsub;
  }, []);

  return (
    <div style={overlayStyle} onClick={onClose}>
      <div style={modalStyle} onClick={(e) => e.stopPropagation()} className="glass">
        <button onClick={onClose} style={closeBtnStyle} title="Đóng">
          <X size={18} />
        </button>

        <h2 style={{ fontSize: '1.4rem', fontWeight: 800, textAlign: 'center', marginBottom: '4px' }}>
          💎 VIP Tier
        </h2>
        <p style={{ textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '0.8rem', marginBottom: '20px' }}>
          Cược càng nhiều (30 ngày gần nhất), tier càng cao, perks càng ngon.
        </p>

        {/* Current tier card */}
        <div
          style={{
            background: `linear-gradient(135deg, ${tier.color}33 0%, ${tier.color}11 100%)`,
            border: `2px solid ${tier.color}`,
            padding: '16px',
            borderRadius: '14px',
            marginBottom: '16px',
            textAlign: 'center',
          }}
        >
          <div style={{ fontSize: '2.5rem' }}>{tier.emoji}</div>
          <div style={{ fontSize: '1.3rem', fontWeight: 800, color: tier.color, letterSpacing: 2 }}>{tier.label}</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: '4px' }}>
            Tổng cược 30 ngày: <strong style={{ color: 'white' }}>{progress.current.toLocaleString()}</strong> xu
          </div>
        </div>

        {/* Progress bar to next tier */}
        {progress.nextTier ? (
          <div style={{ marginBottom: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', marginBottom: '4px' }}>
              <span style={{ color: 'var(--color-text-muted)' }}>
                Tiến độ lên <strong style={{ color: progress.nextTier.color }}>{progress.nextTier.label}</strong>
              </span>
              <span style={{ color: progress.nextTier.color, fontWeight: 800 }}>
                {progress.current.toLocaleString()} / {progress.nextThreshold.toLocaleString()}
              </span>
            </div>
            <div style={{ height: '8px', background: 'rgba(255,255,255,0.1)', borderRadius: '4px', overflow: 'hidden' }}>
              <div
                style={{
                  width: `${progress.percent}%`,
                  height: '100%',
                  background: `linear-gradient(90deg, ${tier.color}, ${progress.nextTier.color})`,
                  transition: 'width 0.3s',
                }}
              />
            </div>
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: '10px', color: '#f1c40f', fontWeight: 800, marginBottom: '12px' }}>
            🌟 Bạn đã đạt tier cao nhất!
          </div>
        )}

        {/* All tiers + perks */}
        <h3 style={{ fontSize: '0.95rem', fontWeight: 800, marginBottom: '8px' }}>📋 Danh sách Tier & Quyền lợi</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '280px', overflowY: 'auto' }}>
          {allTiers.map((t) => {
            const isCurrent = t.id === tier.id;
            return (
              <div
                key={t.id}
                style={{
                  padding: '10px 12px',
                  borderRadius: '10px',
                  border: isCurrent ? `2px solid ${t.color}` : '1px solid rgba(255,255,255,0.08)',
                  background: isCurrent ? `${t.color}11` : 'rgba(255,255,255,0.02)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                  <span style={{ fontSize: '0.9rem', fontWeight: 800, color: t.color }}>
                    {t.emoji} {t.label}
                  </span>
                  <span style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)' }}>
                    ≥ {t.minBet.toLocaleString()} xu
                  </span>
                </div>
                <ul style={{ listStyle: 'none', padding: 0, margin: 0, fontSize: '0.75rem' }}>
                  {t.perks.map((p, i) => (
                    <li key={i} style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--color-text-secondary)', padding: '2px 0' }}>
                      <Check size={12} color={t.color} />
                      {p}
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
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
  maxHeight: '90vh',
  overflowY: 'auto',
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
  zIndex: 1,
};
