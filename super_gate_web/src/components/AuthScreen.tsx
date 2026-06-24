import React, { useState } from 'react';
import { Lock, Mail, User, ShieldAlert } from 'lucide-react';
import { AuthService } from '../services/authService';

interface AuthScreenProps {
  onLoginSuccess: () => void;
}

export const AuthScreen: React.FC<AuthScreenProps> = ({ onLoginSuccess }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [forgotPassword, setForgotPassword] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg(null);
    setMessage(null);

    try {
      if (forgotPassword) {
        await AuthService.resetPassword(email);
        setMessage('Đã gửi email khôi phục mật khẩu. Vui lòng kiểm tra hộp thư!');
      } else if (isLogin) {
        await AuthService.signIn(email, password);
        onLoginSuccess();
      } else {
        if (!displayName.trim()) {
          throw new Error('Vui lòng nhập tên hiển thị');
        }
        await AuthService.signUp(email, password, displayName);
        onLoginSuccess();
      }
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || 'Có lỗi xảy ra, vui lòng thử lại');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px', background: 'radial-gradient(circle at center, #1b1635 0%, #0a0814 100%)' }}>
      <div className="glass" style={{ width: '100%', maxWidth: '420px', padding: '40px 30px', border: '1px solid rgba(124, 111, 255, 0.15)' }}>
        
        {/* Title */}
        <div style={{ textAlign: 'center', marginBottom: '30px' }}>
          <div style={{ display: 'inline-flex', width: '50px', height: '50px', borderRadius: '12px', background: 'var(--grad-primary)', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '1.6rem', color: 'white', marginBottom: '12px' }}>Ω</div>
          <h2 style={{ fontSize: '1.6rem', fontWeight: 800 }} className="gradient-text">Super Gate</h2>
          <p style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)', marginTop: '4px' }}>
            {forgotPassword 
              ? 'Khôi phục mật khẩu tài khoản' 
              : isLogin 
                ? 'Đăng nhập để đồng bộ và cá cược trực tuyến' 
                : 'Đăng ký tài khoản cổng game mới'
            }
          </p>
        </div>

        {/* Error / Alert Message */}
        {errorMsg && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(229,57,53,0.1)', border: '1px solid rgba(229,57,53,0.3)', padding: '10px 14px', borderRadius: '8px', color: '#ef5350', fontSize: '0.85rem', marginBottom: '20px' }}>
            <ShieldAlert size={16} />
            <span>{errorMsg}</span>
          </div>
        )}

        {message && (
          <div style={{ background: 'rgba(46,204,113,0.1)', border: '1px solid rgba(46,204,113,0.3)', padding: '10px 14px', borderRadius: '8px', color: '#2ecc71', fontSize: '0.85rem', marginBottom: '20px' }}>
            {message}
          </div>
        )}

        {/* Auth Form */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Email Input */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--color-text-secondary)' }}>Email</label>
            <div style={{ position: 'relative' }}>
              <Mail size={16} style={{ position: 'absolute', left: '14px', top: '15px', color: 'var(--color-text-muted)' }} />
              <input 
                type="email" 
                placeholder="email@example.com" 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                style={{ paddingLeft: '40px' }}
              />
            </div>
          </div>

          {/* Display Name Input (Only on Sign Up) */}
          {!isLogin && !forgotPassword && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--color-text-secondary)' }}>Tên hiển thị</label>
              <div style={{ position: 'relative' }}>
                <User size={16} style={{ position: 'absolute', left: '14px', top: '15px', color: 'var(--color-text-muted)' }} />
                <input 
                  type="text" 
                  placeholder="Tên của bạn" 
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  required
                  style={{ paddingLeft: '40px' }}
                />
              </div>
            </div>
          )}

          {/* Password Input (Login/Signup) */}
          {!forgotPassword && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--color-text-secondary)' }}>Mật khẩu</label>
                {isLogin && (
                  <button 
                    type="button" 
                    onClick={() => setForgotPassword(true)}
                    style={{ background: 'none', border: 'none', color: 'var(--primary-color)', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer' }}
                  >
                    Quên mật khẩu?
                  </button>
                )}
              </div>
              <div style={{ position: 'relative' }}>
                <Lock size={16} style={{ position: 'absolute', left: '14px', top: '15px', color: 'var(--color-text-muted)' }} />
                <input 
                  type="password" 
                  placeholder="••••••••" 
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  style={{ paddingLeft: '40px' }}
                />
              </div>
            </div>
          )}

          {/* Submit Button */}
          <button 
            type="submit" 
            disabled={loading}
            className="btn btn-primary"
            style={{ width: '100%', padding: '14px', borderRadius: '10px', fontSize: '0.95rem', marginTop: '10px' }}
          >
            {loading ? 'Đang xử lý...' : forgotPassword ? 'Gửi yêu cầu khôi phục' : isLogin ? 'ĐĂNG NHẬP' : 'ĐĂNG KÝ'}
          </button>
        </form>

        {/* Auth toggle & Guest option */}
        <div style={{ borderTop: 'var(--border-glass)', marginTop: '24px', paddingTop: '20px', display: 'flex', flexDirection: 'column', gap: '14px', textAlign: 'center' }}>
          
          {forgotPassword ? (
            <button 
              onClick={() => { setForgotPassword(false); setErrorMsg(null); }}
              style={{ background: 'none', border: 'none', color: 'var(--color-text-secondary)', fontSize: '0.85rem', cursor: 'pointer', fontWeight: 600 }}
            >
              Quay lại đăng nhập
            </button>
          ) : (
            <p style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)' }}>
              {isLogin ? 'Chưa có tài khoản?' : 'Đã có tài khoản?'}{' '}
              <button 
                onClick={() => { setIsLogin(!isLogin); setErrorMsg(null); }}
                style={{ background: 'none', border: 'none', color: 'var(--primary-color)', fontWeight: 700, cursor: 'pointer' }}
              >
                {isLogin ? 'Đăng ký ngay' : 'Đăng nhập'}
              </button>
            </p>
          )}

          <div style={{
            marginTop: '8px',
            padding: '10px 12px',
            background: 'rgba(124, 111, 255, 0.06)',
            border: '1px dashed rgba(124, 111, 255, 0.25)',
            borderRadius: '10px',
            fontSize: '0.78rem',
            color: 'var(--color-text-secondary)',
            textAlign: 'center',
            lineHeight: 1.5,
          }}>
            🔒 Bắt buộc đăng nhập để chơi — tiến trình &amp; xu được lưu trên đám mây
            để không mất khi đổi thiết bị.
          </div>
        </div>
      </div>
    </div>
  );
};
