import React from 'react';
import { Shield, X } from 'lucide-react';

interface InsuranceModalProps {
  isOpen: boolean;
  betAmount: number;
  insurancePct?: number; // default 0.3 (30% of bet = premium fee)
  refundPct?: number;    // default 0.5 (50% of bet refunded on loss)
  onPurchase: (premiumFee: number, refundPct: number) => void;
  onSkip: () => void;
}

/**
 * Pre-reveal insurance modal: offers the player a chance to buy insurance
 * before the game resolves. On loss, a fraction of the original bet is refunded.
 *
 * Math (defaults 30% premium, 50% refund):
 *   bet = 200
 *   premium = 60
 *   refund on loss = 100
 *   net loss with insurance = -200 + 100 - 60 = -160 (vs -200 without)
 *   net win with insurance = bet*payoutMultiplier - 60 (premium reduces profit)
 */
export const InsuranceModal: React.FC<InsuranceModalProps> = ({
  isOpen,
  betAmount,
  insurancePct = 0.3,
  refundPct = 0.5,
  onPurchase,
  onSkip,
}) => {
  if (!isOpen) return null;

  const premiumFee = Math.round(betAmount * insurancePct);
  const refundOnLoss = Math.round(betAmount * refundPct);
  const netLossWithIns = -betAmount + refundOnLoss - premiumFee;
  const savings = betAmount + netLossWithIns; // = refund - premium

  return (
    <div
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
        style={{
          width: '100%',
          maxWidth: '440px',
          background: 'linear-gradient(135deg, #0d2855 0%, #061635 100%)',
          border: '1.5px solid rgba(52, 152, 219, 0.45)',
          borderRadius: '20px',
          padding: '28px',
          position: 'relative',
          boxShadow: '0 24px 60px rgba(0,0,0,0.6), 0 0 40px rgba(52,152,219,0.25)',
          textAlign: 'center',
        }}
      >
        {/* Close */}
        <button
          onClick={onSkip}
          style={{
            position: 'absolute',
            top: '14px',
            right: '14px',
            background: 'none',
            border: 'none',
            color: 'rgba(255,255,255,0.55)',
            cursor: 'pointer',
          }}
          aria-label="Bỏ qua"
        >
          <X size={20} />
        </button>

        {/* Shield icon header */}
        <div
          style={{
            width: '72px',
            height: '72px',
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #3498db 0%, #2980b9 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 12px auto',
            boxShadow: '0 0 30px rgba(52, 152, 219, 0.5)',
          }}
        >
          <Shield size={36} color="white" fill="rgba(255,255,255,0.18)" />
        </div>

        <h2
          style={{
            fontSize: '1.4rem',
            fontWeight: 900,
            color: 'white',
            margin: 0,
            letterSpacing: 0.5,
          }}
        >
          🛡️ Mua Bảo Hiểm Cược?
        </h2>
        <p
          style={{
            fontSize: '0.82rem',
            color: 'rgba(255,255,255,0.6)',
            marginTop: '6px',
            marginBottom: '18px',
          }}
        >
          Thanh toán phí bảo hiểm trước khi mở kết quả — nếu THUA, được hoàn một phần cược gốc.
        </p>

        {/* Math summary box */}
        <div
          style={{
            background: 'rgba(52, 152, 219, 0.08)',
            border: '1px solid rgba(52, 152, 219, 0.3)',
            borderRadius: '14px',
            padding: '16px 18px',
            marginBottom: '18px',
            textAlign: 'left',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
          }}
        >
          <Row label="Cược hiện tại" value={`🪙 ${betAmount} xu`} />
          <Row
            label={`Phí bảo hiểm (${Math.round(insurancePct * 100)}%)`}
            value={`🪙 ${premiumFee} xu`}
            valueColor="#e67e22"
          />
          <div style={{ height: '1px', background: 'rgba(255,255,255,0.08)', margin: '4px 0' }} />
          <Row
            label={`Nếu THUA: hoàn ${Math.round(refundPct * 100)}%`}
            value={`+🪙 ${refundOnLoss} xu`}
            valueColor="#2ecc71"
          />
          <Row
            label="→ Net thua nếu mua BH"
            value={`${netLossWithIns} xu`}
            valueColor="#e74c3c"
            bold
          />
          <Row
            label="→ So với KHÔNG mua BH"
            value={`-${betAmount} xu`}
            valueColor="rgba(255,255,255,0.45)"
            strike
          />
          <div
            style={{
              marginTop: '4px',
              padding: '6px 10px',
              borderRadius: '8px',
              background: 'rgba(46, 204, 113, 0.15)',
              border: '1px solid rgba(46, 204, 113, 0.3)',
              fontSize: '0.78rem',
              fontWeight: 700,
              color: '#2ecc71',
              textAlign: 'center',
            }}
          >
            💡 Tiết kiệm {savings} xu khi thua
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <button
            onClick={() => onPurchase(premiumFee, refundPct)}
            style={{
              padding: '13px',
              fontSize: '0.95rem',
              fontWeight: 900,
              background: 'linear-gradient(135deg, #3498db 0%, #2980b9 100%)',
              color: 'white',
              border: 'none',
              borderRadius: '10px',
              cursor: 'pointer',
              boxShadow: '0 6px 18px rgba(52, 152, 219, 0.45)',
              letterSpacing: 0.4,
            }}
          >
            🛡️ MUA BẢO HIỂM {premiumFee} XU
          </button>
          <button
            onClick={onSkip}
            style={{
              padding: '11px',
              fontSize: '0.88rem',
              fontWeight: 700,
              background: 'rgba(255,255,255,0.06)',
              color: 'rgba(255,255,255,0.75)',
              border: '1px solid rgba(255,255,255,0.12)',
              borderRadius: '10px',
              cursor: 'pointer',
            }}
          >
            Bỏ qua, chơi như thường
          </button>
        </div>

        <p
          style={{
            fontSize: '0.68rem',
            color: 'rgba(255,255,255,0.4)',
            marginTop: '14px',
            textAlign: 'center',
          }}
        >
          Phí bảo hiểm bị trừ ngay khi mua. Nếu thắng, lợi nhuận của bạn vẫn bị trừ phí này.
        </p>
      </div>
    </div>
  );
};

interface RowProps {
  label: string;
  value: string;
  valueColor?: string;
  bold?: boolean;
  strike?: boolean;
}

const Row: React.FC<RowProps> = ({ label, value, valueColor, bold, strike }) => (
  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
    <span style={{ fontSize: '0.82rem', color: 'rgba(255,255,255,0.7)' }}>{label}</span>
    <span
      style={{
        fontSize: bold ? '0.95rem' : '0.85rem',
        fontWeight: bold ? 900 : 700,
        color: valueColor || 'white',
        textDecoration: strike ? 'line-through' : 'none',
      }}
    >
      {value}
    </span>
  </div>
);
