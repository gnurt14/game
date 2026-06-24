import React, { useEffect, useState } from 'react';
import { RefreshCw, AlertTriangle } from 'lucide-react';
import { VersionService } from '../services/versionService';

/**
 * ForceUpdateModal — modal không-đóng-được, chỉ có nút "Cập nhật ngay".
 *
 * Mount 1 lần ở App root. Tự subscribe VersionService.onUpdateAvailable.
 * Khi version server khác client → hiện overlay full-screen, block toàn bộ
 * UI cho đến khi user nhấn nút → reload (kèm clear cache).
 *
 * Không cung cấp nút Đóng / X / Esc — user BẮT BUỘC update để tiếp tục.
 * Để chống user dismiss bằng DevTools, mount này được render sau cùng
 * (zIndex 99999) và phủ overlay tuyệt đối.
 */
export const ForceUpdateModal: React.FC = () => {
  const [show, setShow] = useState(false);
  const [serverVersion, setServerVersion] = useState<string>('');
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    VersionService.start();
    const unsub = VersionService.onUpdateAvailable((v) => {
      setServerVersion(v);
      setShow(true);
    });
    return unsub;
  }, []);

  // Khi đã hiển → chặn scroll body.
  useEffect(() => {
    if (!show) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [show]);

  // Chặn phím tắt Esc / F5 thông thường — user chỉ có thể nhấn nút.
  useEffect(() => {
    if (!show) return;
    const handler = (e: KeyboardEvent) => {
      // Chặn Esc đóng modal.
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    window.addEventListener('keydown', handler, true);
    return () => window.removeEventListener('keydown', handler, true);
  }, [show]);

  if (!show) return null;

  const handleUpdate = () => {
    setUpdating(true);
    // Một chút delay cho animation thấy được
    setTimeout(() => VersionService.forceReload(), 300);
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 99999,
        background: 'rgba(5, 3, 10, 0.95)',
        backdropFilter: 'blur(12px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
      }}
      // Không phản hồi click ra ngoài
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
    >
      <style>{`
        @keyframes fu-pulse-ring {
          0%, 100% { box-shadow: 0 0 0 0 rgba(241, 196, 15, 0.6); }
          50%      { box-shadow: 0 0 0 18px rgba(241, 196, 15, 0); }
        }
        @keyframes fu-fade-in {
          from { opacity: 0; transform: scale(0.94); }
          to   { opacity: 1; transform: scale(1); }
        }
      `}</style>

      <div
        style={{
          width: '100%',
          maxWidth: '440px',
          background: 'linear-gradient(135deg, #1a1138 0%, #07071a 100%)',
          border: '2px solid rgba(241, 196, 15, 0.45)',
          borderRadius: '20px',
          padding: '32px 28px',
          textAlign: 'center',
          boxShadow: '0 25px 80px rgba(0,0,0,0.7), 0 0 50px rgba(241, 196, 15, 0.25)',
          animation: 'fu-fade-in 0.3s ease-out',
        }}
      >
        <div
          style={{
            width: '78px',
            height: '78px',
            margin: '0 auto 16px auto',
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #f1c40f 0%, #e67e22 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            animation: 'fu-pulse-ring 1.6s ease-in-out infinite',
          }}
        >
          <AlertTriangle size={42} color="#1a1138" strokeWidth={2.5} />
        </div>

        <h2
          style={{
            fontSize: '1.55rem',
            fontWeight: 900,
            color: '#f1c40f',
            margin: 0,
            letterSpacing: 1,
          }}
        >
          PHIÊN BẢN MỚI ĐÃ SẴN SÀNG
        </h2>

        <p
          style={{
            fontSize: '0.9rem',
            color: 'rgba(255, 255, 255, 0.78)',
            marginTop: '14px',
            marginBottom: '8px',
            lineHeight: 1.55,
          }}
        >
          Super Gate vừa được cập nhật. Bạn cần tải lại trang để nhận
          các tính năng mới và sửa lỗi.
        </p>

        <div
          style={{
            fontSize: '0.7rem',
            color: 'rgba(255, 255, 255, 0.4)',
            marginBottom: '24px',
            fontFamily: 'monospace',
          }}
        >
          Bản hiện tại: {VersionService.getClientVersion().slice(-8)} →{' '}
          Bản mới: {serverVersion.slice(-8)}
        </div>

        <button
          onClick={handleUpdate}
          disabled={updating}
          style={{
            width: '100%',
            padding: '16px',
            fontSize: '1.05rem',
            fontWeight: 900,
            letterSpacing: 1,
            background: 'linear-gradient(135deg, #f1c40f 0%, #e67e22 100%)',
            color: '#1a1138',
            border: 'none',
            borderRadius: '12px',
            cursor: updating ? 'wait' : 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '10px',
            boxShadow: '0 8px 22px rgba(241, 196, 15, 0.4)',
            textTransform: 'uppercase',
            transition: 'transform 0.15s',
          }}
          onMouseEnter={(e) => {
            if (!updating) e.currentTarget.style.transform = 'scale(1.02)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'scale(1)';
          }}
        >
          {updating ? (
            <>
              <RefreshCw size={18} className="spin-slow" /> ĐANG TẢI LẠI...
            </>
          ) : (
            <>
              <RefreshCw size={18} /> CẬP NHẬT NGAY
            </>
          )}
        </button>

        <p
          style={{
            fontSize: '0.7rem',
            color: 'rgba(255, 255, 255, 0.4)',
            marginTop: '14px',
            marginBottom: 0,
          }}
        >
          Bạn không thể tiếp tục sử dụng phiên bản cũ. Hãy bấm nút trên.
        </p>
      </div>
    </div>
  );
};
