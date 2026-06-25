import React, { useEffect, useRef, useState } from 'react';
import { Sliders, X } from 'lucide-react';

interface CustomBetButtonProps {
  balance: number;
  value: number;
  onChange: (v: number) => void;
  disabled?: boolean;
  minBet?: number;
  presetValues?: number[]; // dùng để xác định có đang "đang ở giá trị custom" không
  size?: 'pill' | 'chip'; // 'chip' = tròn (TaiXiu), 'pill' = bo tròn (Plinko/CoinFlip/Slot)
}

/**
 * Nút "Tuỳ chỉnh" cho phép user nhập số xu cược tự do (không giới hạn preset).
 * Mở modal nhập số tiền, validate theo balance.
 */
export const CustomBetButton: React.FC<CustomBetButtonProps> = ({
  balance,
  value,
  onChange,
  disabled,
  minBet = 1,
  presetValues = [],
  size = 'pill',
}) => {
  const [open, setOpen] = useState(false);
  const isCustom = value > 0 && !presetValues.includes(value);

  const buttonStyle: React.CSSProperties =
    size === 'chip'
      ? {
          width: '40px',
          height: '40px',
          borderRadius: '50%',
          background:
            'linear-gradient(135deg, rgba(241,196,15,0.25), rgba(230,137,0,0.2))',
          color: '#f1c40f',
          fontWeight: 900,
          border: isCustom
            ? '3px solid #f1c40f'
            : '1px solid rgba(241,196,15,0.5)',
          cursor: disabled ? 'default' : 'pointer',
          transform: isCustom ? 'scale(1.1)' : 'none',
          transition: 'all 0.15s',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }
      : {
          padding: '6px 12px',
          fontSize: '0.8rem',
          fontWeight: 800,
          borderRadius: '20px',
          background: isCustom
            ? '#f1c40f'
            : 'rgba(241,196,15,0.15)',
          color: isCustom ? '#000' : '#f1c40f',
          border: '1px solid rgba(241,196,15,0.4)',
          cursor: disabled ? 'default' : 'pointer',
          display: 'inline-flex',
          alignItems: 'center',
          gap: '4px',
        };

  return (
    <>
      <button
        onClick={() => !disabled && setOpen(true)}
        disabled={disabled}
        style={buttonStyle}
        title="Cược tuỳ chỉnh"
      >
        {size === 'chip' ? (
          isCustom && value < 1000 ? (
            <span style={{ fontSize: '0.7rem' }}>{value}</span>
          ) : isCustom ? (
            <span style={{ fontSize: '0.65rem' }}>
              {value >= 1000 ? `${Math.round(value / 100) / 10}K` : value}
            </span>
          ) : (
            <Sliders size={16} />
          )
        ) : (
          <>
            <Sliders size={13} />
            {isCustom ? value : 'Tuỳ chỉnh'}
          </>
        )}
      </button>
      {open && (
        <CustomBetModal
          balance={balance}
          initial={value}
          minBet={minBet}
          onClose={() => setOpen(false)}
          onConfirm={(v) => {
            onChange(v);
            setOpen(false);
          }}
        />
      )}
    </>
  );
};

interface CustomBetModalProps {
  balance: number;
  initial: number;
  minBet: number;
  onClose: () => void;
  onConfirm: (v: number) => void;
}

const CustomBetModal: React.FC<CustomBetModalProps> = ({
  balance,
  initial,
  minBet,
  onClose,
  onConfirm,
}) => {
  const [raw, setRaw] = useState<string>(initial > 0 ? String(initial) : '');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  const parsed = raw.trim() === '' ? NaN : parseInt(raw, 10);
  const isValid =
    Number.isFinite(parsed) && parsed >= minBet && parsed <= balance;
  let error: string | null = null;
  if (Number.isFinite(parsed)) {
    if (parsed < minBet) error = `Tối thiểu ${minBet} xu`;
    else if (parsed > balance) error = 'Vượt quá số xu hiện có';
  }

  const setPct = (pct: number) => {
    const v = Math.max(minBet, Math.floor(balance * pct));
    setRaw(String(v));
  };

  const confirm = () => {
    if (!isValid) return;
    onConfirm(parsed);
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 10001,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(0, 8, 30, 0.85)',
        backdropFilter: 'blur(8px)',
        padding: '20px',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: '380px',
          background:
            'linear-gradient(135deg, #1a1a2e 0%, #0d0d1c 100%)',
          border: '1.5px solid rgba(241,196,15,0.45)',
          borderRadius: '20px',
          padding: '24px',
          position: 'relative',
          boxShadow:
            '0 24px 60px rgba(0,0,0,0.6), 0 0 40px rgba(241,196,15,0.15)',
        }}
      >
        <button
          onClick={onClose}
          style={{
            position: 'absolute',
            top: '12px',
            right: '12px',
            background: 'none',
            border: 'none',
            color: 'rgba(255,255,255,0.55)',
            cursor: 'pointer',
          }}
          aria-label="Đóng"
        >
          <X size={20} />
        </button>

        <div
          style={{
            textAlign: 'center',
            color: '#f1c40f',
            fontWeight: 900,
            fontSize: '1.1rem',
            letterSpacing: '2px',
            marginBottom: '4px',
          }}
        >
          CƯỢC TUỲ CHỈNH
        </div>
        <div
          style={{
            textAlign: 'center',
            color: 'rgba(255,255,255,0.6)',
            fontSize: '0.85rem',
            marginBottom: '18px',
          }}
        >
          Số dư: 🪙 {balance.toLocaleString('vi-VN')}
        </div>

        <input
          ref={inputRef}
          type="number"
          inputMode="numeric"
          value={raw}
          onChange={(e) => setRaw(e.target.value.replace(/[^0-9]/g, ''))}
          onKeyDown={(e) => {
            if (e.key === 'Enter') confirm();
          }}
          placeholder="0"
          style={{
            width: '100%',
            background: '#0b0b14',
            border: error
              ? '2px solid #e74c3c'
              : '2px solid rgba(241,196,15,0.4)',
            borderRadius: '12px',
            color: 'white',
            fontSize: '1.8rem',
            fontWeight: 900,
            textAlign: 'center',
            padding: '14px',
            outline: 'none',
          }}
        />
        <div
          style={{
            minHeight: '20px',
            color: '#e74c3c',
            fontSize: '0.8rem',
            textAlign: 'center',
            marginTop: '6px',
          }}
        >
          {error}
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: '6px',
            marginTop: '8px',
          }}
        >
          {[
            { label: '25%', v: 0.25 },
            { label: '50%', v: 0.5 },
            { label: '75%', v: 0.75 },
          ].map(({ label, v }) => (
            <button
              key={label}
              onClick={() => setPct(v)}
              disabled={balance <= 0}
              style={{
                padding: '8px 0',
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: '8px',
                color: 'rgba(255,255,255,0.8)',
                fontWeight: 700,
                fontSize: '0.8rem',
                cursor: balance > 0 ? 'pointer' : 'default',
              }}
            >
              {label}
            </button>
          ))}
          <button
            onClick={() => setRaw(String(balance))}
            disabled={balance <= 0}
            style={{
              padding: '8px 0',
              background: 'rgba(231,76,60,0.2)',
              border: '1px solid rgba(231,76,60,0.5)',
              borderRadius: '8px',
              color: '#e74c3c',
              fontWeight: 800,
              fontSize: '0.8rem',
              cursor: balance > 0 ? 'pointer' : 'default',
            }}
          >
            ALL-IN
          </button>
        </div>

        <div style={{ display: 'flex', gap: '8px', marginTop: '18px' }}>
          <button
            onClick={onClose}
            style={{
              flex: 1,
              padding: '12px',
              background: 'rgba(255,255,255,0.08)',
              border: 'none',
              borderRadius: '12px',
              color: 'rgba(255,255,255,0.7)',
              fontWeight: 700,
              letterSpacing: '1.5px',
              cursor: 'pointer',
            }}
          >
            HUỶ
          </button>
          <button
            onClick={confirm}
            disabled={!isValid}
            style={{
              flex: 2,
              padding: '12px',
              background: isValid
                ? 'linear-gradient(135deg, #f1c40f, #e68900)'
                : 'rgba(255,255,255,0.05)',
              border: 'none',
              borderRadius: '12px',
              color: isValid ? '#000' : 'rgba(255,255,255,0.3)',
              fontWeight: 900,
              letterSpacing: '2px',
              cursor: isValid ? 'pointer' : 'default',
            }}
          >
            ĐẶT CƯỢC
          </button>
        </div>
      </div>
    </div>
  );
};
