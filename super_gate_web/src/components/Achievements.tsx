import React, { useEffect, useState } from 'react';
import { CheckCircle, Lock, Trophy } from 'lucide-react';
import { AchievementService, kAchievements } from '../services/achievementService';

export const Achievements: React.FC = () => {
  const [earnedKeys, setEarnedKeys] = useState<Set<String>>(new Set());

  useEffect(() => {
    const unsub = AchievementService.subscribe((earned) => {
      setEarnedKeys(earned);
    });
    return unsub;
  }, []);

  const totalCount = kAchievements.length;
  const earnedCount = earnedKeys.size;
  const percent = totalCount > 0 ? Math.round((earnedCount / totalCount) * 100) : 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      
      {/* Header with progress */}
      <div className="glass" style={{ padding: '24px 30px', border: '1px solid rgba(124, 111, 255, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '20px' }}>
        <div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Trophy color="#f1c40f" size={24} /> Thành Tích & Huy Hiệu
          </h2>
          <p style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)', marginTop: '4px' }}>
            Mở khóa huy hiệu thành tựu suốt đời để nhận xu thưởng miễn phí.
          </p>
        </div>

        {/* Progress bar */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', width: '200px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', fontWeight: 700 }}>
            <span>Đã mở khóa</span>
            <span style={{ color: 'var(--primary-color)' }}>{earnedCount} / {totalCount} ({percent}%)</span>
          </div>
          <div style={{ width: '100%', height: '8px', background: 'rgba(255,255,255,0.05)', borderRadius: '4px', overflow: 'hidden' }}>
            <div style={{ width: `${percent}%`, height: '100%', background: 'var(--grad-primary)', transition: 'width 0.3s ease' }}></div>
          </div>
        </div>
      </div>

      {/* Grid of Badges */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '20px' }}>
        {kAchievements.map((ach) => {
          const isUnlocked = earnedKeys.has(ach.key);

          return (
            <div
              key={ach.key}
              className="glass"
              style={{
                padding: '24px',
                borderRadius: '16px',
                border: isUnlocked ? '1px solid rgba(46, 204, 113, 0.25)' : 'var(--border-glass)',
                opacity: isUnlocked ? 1 : 0.6,
                transition: 'all 0.2s ease',
                display: 'flex',
                gap: '16px',
                position: 'relative'
              }}
            >
              {/* Badge Icon */}
              <div
                style={{
                  width: '56px',
                  height: '56px',
                  borderRadius: '14px',
                  background: isUnlocked ? 'var(--grad-primary)' : 'rgba(255, 255, 255, 0.03)',
                  border: isUnlocked ? 'none' : '1px dashed rgba(255, 255, 255, 0.1)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '2rem',
                  flexShrink: 0,
                  filter: isUnlocked ? 'none' : 'grayscale(100%)',
                }}
              >
                {ach.emoji}
              </div>

              {/* Text info */}
              <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                <h4 style={{ fontSize: '1rem', fontWeight: 800, color: 'white', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  {ach.title}
                  {isUnlocked && <CheckCircle size={14} color="#2ecc71" />}
                </h4>
                <p style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', marginTop: '4px', lineHeight: '1.3' }}>
                  {ach.description}
                </p>
                <span style={{ fontSize: '0.7rem', color: '#f1c40f', fontWeight: 700, marginTop: '6px' }}>
                  Thưởng: 🪙 +{ach.coinReward} xu
                </span>
              </div>

              {/* Lock overlay icon */}
              {!isUnlocked && (
                <div style={{ position: 'absolute', top: '12px', right: '12px', color: 'var(--color-text-muted)' }}>
                  <Lock size={14} />
                </div>
              )}
            </div>
          );
        })}
      </div>

    </div>
  );
};
