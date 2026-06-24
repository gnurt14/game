import React, { useEffect, useState } from 'react';
import { Bell, X } from 'lucide-react';

export type NotificationType = 'info' | 'success' | 'warning' | 'jackpot' | 'promo';

export interface NotificationPayload {
  id: number;
  title: string;
  body: string;
  type: NotificationType;
  action?: { label: string; onClick: () => void };
  createdAt: number;
}

type Listener = (notifications: NotificationPayload[]) => void;

const TOAST_DURATION_MS = 8000;
const MAX_VISIBLE = 4;

let nextId = 1;
const queue: NotificationPayload[] = [];
const listeners: Listener[] = [];

function emit() {
  listeners.forEach((l) => l([...queue]));
}

/**
 * Singleton-like notification service. Components call notify() to push,
 * the toast stack subscribes and auto-removes after TOAST_DURATION_MS.
 */
export const NotificationService = {
  notify(payload: Omit<NotificationPayload, 'id' | 'createdAt'>): number {
    const item: NotificationPayload = {
      id: nextId++,
      createdAt: Date.now(),
      ...payload,
    };
    queue.push(item);
    if (queue.length > MAX_VISIBLE) queue.shift();
    emit();
    return item.id;
  },
  dismiss(id: number) {
    const idx = queue.findIndex((n) => n.id === id);
    if (idx >= 0) {
      queue.splice(idx, 1);
      emit();
    }
  },
  clear() {
    queue.splice(0, queue.length);
    emit();
  },
};

const TYPE_STYLES: Record<
  NotificationType,
  { accent: string; bg: string; icon: string }
> = {
  info: { accent: '#3498db', bg: 'rgba(52, 152, 219, 0.12)', icon: 'ℹ️' },
  success: { accent: '#2ecc71', bg: 'rgba(46, 204, 113, 0.12)', icon: '✅' },
  warning: { accent: '#f39c12', bg: 'rgba(243, 156, 18, 0.12)', icon: '⚠️' },
  jackpot: { accent: '#f1c40f', bg: 'rgba(241, 196, 15, 0.14)', icon: '🎰' },
  promo: { accent: '#a29bfe', bg: 'rgba(162, 155, 254, 0.14)', icon: '🎁' },
};

/**
 * Floating toast stack — mount once near the app root (e.g. in Dashboard).
 * Positioned bottom-left to avoid colliding with the BigWinFeed (bottom-right).
 */
export const NotificationToastStack: React.FC = () => {
  const [items, setItems] = useState<NotificationPayload[]>([]);

  useEffect(() => {
    const listener: Listener = (next) => setItems(next);
    listeners.push(listener);
    listener([...queue]);
    return () => {
      const idx = listeners.indexOf(listener);
      if (idx >= 0) listeners.splice(idx, 1);
    };
  }, []);

  useEffect(() => {
    if (items.length === 0) return;
    const timers: number[] = [];
    items.forEach((n) => {
      const elapsed = Date.now() - n.createdAt;
      const remain = TOAST_DURATION_MS - elapsed;
      if (remain <= 0) {
        NotificationService.dismiss(n.id);
      } else {
        const id = window.setTimeout(() => NotificationService.dismiss(n.id), remain);
        timers.push(id);
      }
    });
    return () => timers.forEach((t) => clearTimeout(t));
  }, [items]);

  if (items.length === 0) return null;

  return (
    <div
      style={{
        position: 'fixed',
        left: '20px',
        bottom: '20px',
        zIndex: 199,
        display: 'flex',
        flexDirection: 'column-reverse',
        gap: '10px',
        width: '320px',
        maxWidth: 'calc(100vw - 40px)',
        pointerEvents: 'none',
      }}
    >
      <style>{`
        @keyframes notif-slide-up {
          0%   { transform: translateY(120%); opacity: 0; }
          80%  { transform: translateY(-4px); opacity: 1; }
          100% { transform: translateY(0); }
        }
        @keyframes notif-fade-bar {
          0%   { width: 100%; }
          100% { width: 0; }
        }
      `}</style>

      {items.map((n) => {
        const style = TYPE_STYLES[n.type];
        return (
          <div
            key={n.id}
            style={{
              pointerEvents: 'auto',
              background: `linear-gradient(135deg, ${style.bg}, rgba(0,0,0,0.55))`,
              border: `1px solid ${style.accent}55`,
              borderLeft: `4px solid ${style.accent}`,
              borderRadius: '12px',
              padding: '12px 14px',
              backdropFilter: 'blur(14px)',
              boxShadow: '0 8px 24px rgba(0,0,0,0.45)',
              animation: 'notif-slide-up 0.45s ease-out',
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            {/* Progress bar */}
            <div
              style={{
                position: 'absolute',
                bottom: 0,
                left: 0,
                height: '2px',
                background: style.accent,
                animation: `notif-fade-bar ${TOAST_DURATION_MS}ms linear forwards`,
              }}
            />

            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
              <div style={{ fontSize: '1.4rem', flexShrink: 0 }}>{style.icon}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontSize: '0.85rem',
                    fontWeight: 800,
                    color: 'white',
                    marginBottom: '2px',
                  }}
                >
                  {n.title}
                </div>
                <div
                  style={{
                    fontSize: '0.78rem',
                    color: 'rgba(255,255,255,0.78)',
                    lineHeight: 1.4,
                  }}
                >
                  {n.body}
                </div>
                {n.action && (
                  <button
                    onClick={() => {
                      n.action!.onClick();
                      NotificationService.dismiss(n.id);
                    }}
                    style={{
                      marginTop: '8px',
                      background: style.accent,
                      color: '#0d0820',
                      border: 'none',
                      padding: '5px 12px',
                      borderRadius: '8px',
                      fontSize: '0.75rem',
                      fontWeight: 800,
                      cursor: 'pointer',
                    }}
                  >
                    {n.action.label}
                  </button>
                )}
              </div>
              <button
                onClick={() => NotificationService.dismiss(n.id)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'rgba(255,255,255,0.55)',
                  cursor: 'pointer',
                  padding: 0,
                  flexShrink: 0,
                }}
                aria-label="Đóng thông báo"
              >
                <X size={16} />
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
};

// Expose a bell icon helper component, in case other features want to indicate
// pending notifications visually (not mounted by default).
export const NotificationBell: React.FC<{ count: number; onClick?: () => void }> = ({ count, onClick }) => (
  <button
    onClick={onClick}
    style={{
      position: 'relative',
      background: 'rgba(255,255,255,0.05)',
      border: '1px solid rgba(255,255,255,0.1)',
      borderRadius: '50%',
      width: '36px',
      height: '36px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      cursor: 'pointer',
      color: 'white',
    }}
    aria-label="Thông báo"
  >
    <Bell size={16} />
    {count > 0 && (
      <span
        style={{
          position: 'absolute',
          top: '-2px',
          right: '-2px',
          background: '#e74c3c',
          color: 'white',
          borderRadius: '10px',
          padding: '0 5px',
          fontSize: '0.65rem',
          fontWeight: 800,
          minWidth: '16px',
          textAlign: 'center',
        }}
      >
        {count > 9 ? '9+' : count}
      </span>
    )}
  </button>
);
