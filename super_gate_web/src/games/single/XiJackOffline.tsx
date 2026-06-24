import React, { useState, useEffect } from 'react';
import { Play, Plus, Square } from 'lucide-react';
import { CoinService } from '../../services/coinService';
import { buildXjDeck, xjHandValue } from '../../services/roomService';
import { InsuranceModal } from '../../components/InsuranceModal';
import { BigWinFeed } from '../../components/BigWinFeed';
import { AuthService } from '../../services/authService';
import confetti from 'canvas-confetti';

interface XiJackOfflineProps {
  onClose: () => void;
}

export const XiJackOffline: React.FC<XiJackOfflineProps> = ({ onClose }) => {
  const [balance, setBalance] = useState<number>(0);
  const [betAmount, setBetAmount] = useState<number>(0);
  const [deck, setDeck] = useState<string[]>([]);
  const [playerHand, setPlayerHand] = useState<string[]>([]);
  const [dealerHand, setDealerHand] = useState<string[]>([]);

  const [phase, setPhase] = useState<'betting' | 'player_turn' | 'dealer_turn' | 'resolved'>('betting');
  const [message, setMessage] = useState<string>('🪙 Đặt cược để bắt đầu chia bài!');
  const [winDelta, setWinDelta] = useState<number | null>(null);
  const [bustShake, setBustShake] = useState<boolean>(false);
  const [thinkingText, setThinkingText] = useState<string>('.');

  // Insurance state — captured at Deal time
  const [insuranceOpen, setInsuranceOpen] = useState<boolean>(false);
  const [insurance, setInsurance] = useState<{ premium: number; refundPct: number } | null>(null);

  useEffect(() => {
    setBalance(CoinService.getData().balance);
    const unsub = CoinService.subscribe((data) => {
      setBalance(data.balance);
    });
    return unsub;
  }, []);

  // Animated "thinking" dots during dealer turn
  useEffect(() => {
    if (phase !== 'dealer_turn') {
      setThinkingText('.');
      return;
    }
    const texts = ['.', '..', '...'];
    let i = 0;
    const id = setInterval(() => {
      i = (i + 1) % texts.length;
      setThinkingText(texts[i]);
    }, 380);
    return () => clearInterval(id);
  }, [phase]);

  const handlePlaceBet = async (amount: number) => {
    if (phase !== 'betting') return;
    if (balance < amount) {
      alert('❌ Bạn không đủ xu cược!');
      return;
    }
    const success = await CoinService.spendCoins(amount);
    if (success) {
      setBetAmount(prev => prev + amount);
      setMessage(`Đã cược tổng cộng: 🪙 ${betAmount + amount} xu`);
    }
  };

  const handleClearBets = async () => {
    if (phase !== 'betting' || betAmount === 0) return;
    await CoinService.earnCoins(betAmount);
    setBetAmount(0);
    setMessage('Đã hủy cược và hoàn trả xu.');
  };

  const handleDeal = () => {
    if (phase !== 'betting') return;
    if (betAmount === 0) {
      alert('⚠️ Bạn phải đặt cược trước khi chia bài!');
      return;
    }

    // Pre-reveal insurance gate
    if (betAmount >= 100 && insurance === null) {
      setInsuranceOpen(true);
      return;
    }

    proceedDeal();
  };

  const proceedDeal = () => {
    const seed = Math.floor(Math.random() * 100000);
    const newDeck = buildXjDeck(seed);

    const pHand = [newDeck.pop()!, newDeck.pop()!];
    const dHand = [newDeck.pop()!, newDeck.pop()!];

    setDeck(newDeck);
    setPlayerHand(pHand);
    setDealerHand(dHand);
    setPhase('player_turn');
    setWinDelta(null);

    const pValue = xjHandValue(pHand);
    const dValue = xjHandValue(dHand);

    const isPlayerBJ = pValue === 21 && pHand.length === 2;
    const isDealerBJ = dValue === 21 && dHand.length === 2;

    if (isPlayerBJ || isDealerBJ) {
      resolveNaturalBJs(isPlayerBJ, isDealerBJ, betAmount);
    } else {
      setMessage(`Lượt của bạn: Hand đạt ${pValue} điểm. Rút (Hit) hoặc Dừng (Stand)?`);
    }
  };

  const resolveNaturalBJs = async (isPlayerBJ: boolean, isDealerBJ: boolean, capturedBet: number) => {
    setPhase('resolved');

    if (isPlayerBJ && isDealerBJ) {
      await CoinService.earnCoins(capturedBet);
      setWinDelta(0);
      setMessage('🤝 Hòa! Cả bạn và nhà cái đều đạt Blackjack (Xì Jack).');
    } else if (isPlayerBJ) {
      const winPayout = Math.round(capturedBet * 2.5);
      await CoinService.earnCoins(winPayout);
      const profit = winPayout - capturedBet;
      setWinDelta(profit);
      setMessage(`🏆 Blackjack! Bạn thắng +${profit} xu thưởng!`);
      confetti({ particleCount: 100, spread: 90, origin: { x: 0.3, y: 0.6 } });
      setTimeout(() => confetti({ particleCount: 80, spread: 70, origin: { x: 0.7, y: 0.6 } }), 200);
      setTimeout(() => confetti({ particleCount: 60, spread: 110, origin: { x: 0.5, y: 0.3 } }), 400);
      reportBigWin(profit);
    } else {
      const refund = await applyInsuranceOnLoss(capturedBet);
      setWinDelta(-capturedBet + refund);
      setMessage(refund > 0
        ? `🛡️ Nhà cái đạt Blackjack. Bảo hiểm hoàn ${refund} xu.`
        : '💸 Nhà cái đạt Blackjack (Xì Jack). Bạn thua ván này.');
    }
    setInsurance(null);
    await CoinService.recordGamePlayed('Xì Jack Offline');
  };

  const handleHit = () => {
    if (phase !== 'player_turn') return;
    // Đã đạt 5 lá → ép stand (Ngũ Linh hoặc đã bust trước đó)
    if (playerHand.length >= 5) return;

    const newDeck = [...deck];
    const drawn = newDeck.pop()!;
    const nextHand = [...playerHand, drawn];

    setDeck(newDeck);
    setPlayerHand(nextHand);

    const nextVal = xjHandValue(nextHand);
    if (nextVal > 21) {
      setPhase('resolved');
      setBustShake(true);
      setTimeout(() => setBustShake(false), 600);
      (async () => {
        const refund = await applyInsuranceOnLoss(betAmount);
        setWinDelta(-betAmount + refund);
        setMessage(refund > 0
          ? `💥 BUST ${nextVal}đ! Bảo hiểm hoàn ${refund} xu.`
          : `💥 Quá 21 điểm (${nextVal}đ)! Bạn bị BUST và thua cược.`);
        setInsurance(null);
        await CoinService.recordGamePlayed('Xì Jack Offline');
      })();
    } else if (nextHand.length === 5) {
      // 5 lá ≤21 = Ngũ Linh → ép stand, qua dealer turn để hoàn tất ván.
      setMessage(`🌟 Bạn đã đạt Ngũ Linh (${nextVal}đ với 5 lá)! Đang xử lý...`);
      setPhase('dealer_turn');
      setTimeout(() => {
        playDealerTurn(true);
      }, 800);
    } else {
      setMessage(`Hand của bạn: ${nextVal} điểm. Rút thêm hay Dừng?`);
    }
  };

  const handleStand = () => {
    if (phase !== 'player_turn') return;
    setPhase('dealer_turn');
    setMessage('Nhà cái đang rút bài...');

    setTimeout(() => {
      playDealerTurn();
    }, 800);
  };

  const playDealerTurn = async (forceNguLinh: boolean = false) => {
    const currentDeck = [...deck];
    const currentDHand = [...dealerHand];
    let dVal = xjHandValue(currentDHand);

    while (dVal < 17 && currentDeck.length > 0) {
      const drawn = currentDeck.pop()!;
      currentDHand.push(drawn);
      dVal = xjHandValue(currentDHand);
    }

    setDeck(currentDeck);
    setDealerHand(currentDHand);
    setPhase('resolved');

    const pVal = xjHandValue(playerHand);
    const capturedBet = betAmount;

    // Ưu tiên Ngũ Linh: thắng tuyệt đối x2 cược (lời = 2x bet)
    if (forceNguLinh) {
      const profit = capturedBet * 2;
      const winPayout = capturedBet + profit; // gốc + lời 2x
      await CoinService.earnCoins(winPayout);
      setWinDelta(profit);
      setMessage(`🌟 NGŨ LINH! 5 lá đạt ${pVal}đ — bạn thắng tuyệt đối +${profit} xu!`);
      confetti({ particleCount: 120, spread: 100, origin: { x: 0.3, y: 0.6 } });
      setTimeout(() => confetti({ particleCount: 100, spread: 80, origin: { x: 0.7, y: 0.6 } }), 200);
      setTimeout(() => confetti({ particleCount: 80, spread: 120, origin: { x: 0.5, y: 0.3 } }), 400);
      reportBigWin(profit);
      setInsurance(null);
      await CoinService.recordGamePlayed('Xì Jack Offline');
      return;
    }

    if (dVal > 21) {
      const winPayout = capturedBet * 2;
      await CoinService.earnCoins(winPayout);
      setWinDelta(capturedBet);
      setMessage(`🎉 Nhà cái BUST (${dVal}đ)! Bạn thắng +${capturedBet} xu!`);
      confetti({ particleCount: 70, spread: 70, origin: { x: 0.3, y: 0.6 } });
      setTimeout(() => confetti({ particleCount: 50, spread: 60, origin: { x: 0.7, y: 0.6 } }), 250);
      reportBigWin(capturedBet);
    } else if (pVal > dVal) {
      const winPayout = capturedBet * 2;
      await CoinService.earnCoins(winPayout);
      setWinDelta(capturedBet);
      setMessage(`🏆 Bạn thắng! Hand đạt ${pVal}đ so với Nhà cái ${dVal}đ (+${capturedBet} xu).`);
      confetti({ particleCount: 70, spread: 70, origin: { x: 0.3, y: 0.6 } });
      setTimeout(() => confetti({ particleCount: 50, spread: 60, origin: { x: 0.7, y: 0.6 } }), 250);
      reportBigWin(capturedBet);
    } else if (pVal < dVal) {
      const refund = await applyInsuranceOnLoss(capturedBet);
      setWinDelta(-capturedBet + refund);
      setMessage(refund > 0
        ? `🛡️ Thua (${pVal} vs ${dVal}). Bảo hiểm hoàn ${refund} xu.`
        : `💸 Bạn thua. Nhà cái đạt ${dVal}đ so với Hand ${pVal}đ.`);
    } else {
      await CoinService.earnCoins(capturedBet);
      setWinDelta(0);
      setMessage(`🤝 Hòa (Push)! Cả hai cùng đạt ${pVal} điểm.`);
    }

    setInsurance(null);
    await CoinService.recordGamePlayed('Xì Jack Offline');
  };

  const handleReset = () => {
    setBetAmount(0);
    setPlayerHand([]);
    setDealerHand([]);
    setPhase('betting');
    setWinDelta(null);
    setBustShake(false);
    setInsurance(null);
    setMessage('🪙 Đặt cược để bắt đầu chia bài!');
  };

  const handleInsurancePurchase = async (premium: number, refundPct: number) => {
    const balance = CoinService.getData().balance;
    if (balance < premium) {
      alert('❌ Không đủ xu mua bảo hiểm!');
      setInsuranceOpen(false);
      return;
    }
    const ok = await CoinService.spendCoins(premium);
    if (!ok) {
      alert('❌ Không thể trừ phí bảo hiểm.');
      setInsuranceOpen(false);
      return;
    }
    setInsurance({ premium, refundPct });
    setInsuranceOpen(false);
    proceedDeal();
  };

  const handleInsuranceSkip = () => {
    setInsurance(null);
    setInsuranceOpen(false);
    proceedDeal();
  };

  /** Apply insurance refund if active; idempotent across resolution paths. */
  const applyInsuranceOnLoss = async (lostBet: number): Promise<number> => {
    if (!insurance) return 0;
    const refund = Math.round(lostBet * insurance.refundPct);
    if (refund > 0) {
      await CoinService.earnCoins(refund);
    }
    return refund;
  };

  const reportBigWin = (profit: number) => {
    if (profit > 500) {
      const name = AuthService.getPlayer()?.displayName || 'Khách';
      BigWinFeed.report(name, profit, 'Xì Jack');
    }
  };

  const drawCard = (card: string, isHidden: boolean = false) => {
    if (isHidden) {
      return (
        <div style={{
          width: '56px',
          height: '84px',
          background: 'linear-gradient(135deg, #7c6fff 0%, #a29bfe 100%)',
          borderRadius: '6px',
          border: '2px solid white',
          boxShadow: '0 4px 8px rgba(0,0,0,0.3)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '1.4rem',
        }}>
          🛡️
        </div>
      );
    }

    const rank = card.substring(0, card.length - 1);
    const suit = card.substring(card.length - 1);
    const isRed = suit === '♥' || suit === '♦';

    return (
      <div style={{
        width: '56px',
        height: '84px',
        background: 'white',
        borderRadius: '6px',
        color: isRed ? '#e74c3c' : '#2d3436',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: '6px 8px',
        fontWeight: 'bold',
        fontSize: '0.95rem',
        border: '1px solid rgba(0,0,0,0.15)',
        boxShadow: '0 4px 8px rgba(0,0,0,0.3)',
        animation: 'xj-card-in 0.3s ease-out',
      }}>
        <div style={{ alignSelf: 'flex-start', lineHeight: 1 }}>{rank}</div>
        <div style={{ alignSelf: 'center', fontSize: '1.6rem', lineHeight: 1 }}>{suit}</div>
        <div style={{ alignSelf: 'flex-end', lineHeight: 1 }}>{rank}</div>
      </div>
    );
  };

  const isWinState = winDelta !== null && winDelta > 0;

  return (
    <div className="glass fullscreen-game-container">
      <InsuranceModal
        isOpen={insuranceOpen}
        betAmount={betAmount}
        onPurchase={handleInsurancePurchase}
        onSkip={handleInsuranceSkip}
      />
      <style>{`
        @keyframes xj-card-in { 0%{transform:translateX(28px) rotate(4deg);opacity:0} 100%{transform:translateX(0) rotate(0deg);opacity:1} }
        @keyframes xj-bust-shake { 0%,100%{transform:translateX(0)} 15%{transform:translateX(-7px)} 30%{transform:translateX(7px)} 45%{transform:translateX(-6px)} 60%{transform:translateX(6px)} 75%{transform:translateX(-3px)} 90%{transform:translateX(3px)} }
        @keyframes xj-win-pulse { 0%,100%{box-shadow:inset 0 4px 30px rgba(0,0,0,0.8), 0 8px 32px rgba(0,0,0,0.4), 0 0 20px rgba(46,204,113,0.3)} 50%{box-shadow:inset 0 4px 30px rgba(0,0,0,0.8), 0 8px 32px rgba(0,0,0,0.4), 0 0 50px rgba(46,204,113,0.6)} }
      `}</style>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: 'var(--border-glass)', paddingBottom: '14px', marginBottom: '20px' }}>
        <div>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 800 }}>Xì Jack / Blackjack (Offline vs Máy)</h2>
          <span style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)' }}>
            Số dư của bạn: <strong style={{ color: '#f1c40f', fontSize: '1rem' }}>🪙 {balance} xu</strong>
          </span>
        </div>
        <button onClick={onClose} className="btn btn-danger" style={{ fontSize: '0.85rem' }}>
          Thoát
        </button>
      </div>

      {/* Main Table area */}
      <div style={{ flexGrow: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '30px', position: 'relative' }}>

        {/* Table Board Layout */}
        <div style={{
          width: '100%',
          maxWidth: '460px',
          background: 'rgba(27, 94, 32, 0.4)',
          borderRadius: '20px',
          border: '3px solid #1b5e20',
          padding: '24px',
          display: 'flex',
          flexDirection: 'column',
          gap: '24px',
          animation: isWinState ? 'xj-win-pulse 1.6s infinite' : 'none',
          boxShadow: 'inset 0 4px 30px rgba(0,0,0,0.8), 0 8px 32px rgba(0,0,0,0.4)',
          position: 'relative',
        }}>
          {/* Dealer Hand Area */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#2ecc71', textTransform: 'uppercase', letterSpacing: '1px' }}>
              Bài Nhà Cái {phase === 'resolved' ? `(${xjHandValue(dealerHand)}đ)` : ''}
              {phase === 'dealer_turn' && (
                <span style={{ color: 'rgba(255,255,255,0.6)', fontWeight: 400, marginLeft: '6px', letterSpacing: '0px' }}>
                  đang rút{thinkingText}
                </span>
              )}
            </span>
            <div style={{ display: 'flex', gap: '8px', minHeight: '84px', alignItems: 'center' }}>
              {dealerHand.map((card, idx) => (
                <div key={idx}>
                  {idx === 1 && phase !== 'dealer_turn' && phase !== 'resolved'
                    ? drawCard(card, true)
                    : drawCard(card, false)}
                </div>
              ))}
              {dealerHand.length === 0 && (
                <span style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.3)' }}>Đang đợi cược...</span>
              )}
            </div>
          </div>

          {/* Divider */}
          <div style={{ borderBottom: '1px dashed rgba(255,255,255,0.1)' }} />

          {/* Player Hand Area */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#3498db', textTransform: 'uppercase', letterSpacing: '1px' }}>
              Bài của bạn {playerHand.length > 0 ? `(${xjHandValue(playerHand)}đ)` : ''}
            </span>
            {/* Ngũ Linh / Blackjack badge */}
            {(() => {
              const pv = xjHandValue(playerHand);
              const isNL = playerHand.length === 5 && pv <= 21;
              const isBJ = !isNL && playerHand.length === 2 && pv === 21;
              if (!isNL && !isBJ) return null;
              return (
                <div style={{
                  background: isNL
                    ? 'linear-gradient(135deg, #f1c40f 0%, #e67e22 100%)'
                    : 'linear-gradient(135deg, #7c6fff 0%, #a29bfe 100%)',
                  color: isNL ? '#1a1138' : 'white',
                  padding: '4px 14px',
                  borderRadius: '14px',
                  fontWeight: 900,
                  fontSize: '0.85rem',
                  letterSpacing: '1.5px',
                  boxShadow: isNL
                    ? '0 0 20px rgba(241,196,15,0.6), 0 4px 10px rgba(0,0,0,0.3)'
                    : '0 4px 10px rgba(0,0,0,0.3)',
                  border: '2px solid white',
                  animation: isNL ? 'xj-win-pulse 1.4s infinite' : 'none',
                }}>
                  {isNL ? '🌟 NGŨ LINH' : '✨ BLACKJACK'}
                </div>
              );
            })()}
            <div style={{
              display: 'flex',
              gap: '8px',
              minHeight: '84px',
              alignItems: 'center',
              animation: bustShake ? 'xj-bust-shake 0.5s ease-out' : 'none',
            }}>
              {playerHand.map((card, idx) => (
                <div key={idx}>{drawCard(card)}</div>
              ))}
              {playerHand.length === 0 && (
                <span style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.3)' }}>Chưa được chia bài</span>
              )}
            </div>
          </div>

          {/* Bet indicator on table */}
          {betAmount > 0 && (
            <div style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              background: '#f1c40f',
              color: '#000',
              fontWeight: 900,
              fontSize: '0.75rem',
              padding: '4px 10px',
              borderRadius: '16px',
              boxShadow: '0 4px 10px rgba(0,0,0,0.4)',
              border: '2px solid white',
              zIndex: 5,
            }}>
              🪙 {betAmount}
            </div>
          )}
        </div>

        {/* Console message display */}
        <div style={{
          fontSize: '1rem',
          fontWeight: 800,
          textAlign: 'center',
          color: winDelta !== null && winDelta > 0 ? '#2ecc71' : winDelta !== null && winDelta < 0 ? '#e74c3c' : 'white',
          maxWidth: '440px',
        }}>
          {message}
        </div>
      </div>

      {/* Controller Area */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', borderTop: 'var(--border-glass)', paddingTop: '20px', alignItems: 'center' }}>

        {phase === 'betting' ? (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)', fontWeight: 600 }}>Tăng cược chip:</span>
              <div style={{ display: 'flex', gap: '8px' }}>
                {[10, 50, 100, 500].map(val => (
                  <button
                    key={val}
                    onClick={() => handlePlaceBet(val)}
                    style={{
                      width: '46px',
                      height: '46px',
                      borderRadius: '50%',
                      border: '1px solid rgba(255,255,255,0.25)',
                      background: val === 10 ? '#3498db' : val === 50 ? '#2ecc71' : val === 100 ? '#e67e22' : '#e74c3c',
                      color: 'white',
                      fontWeight: 900,
                      fontSize: '0.75rem',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    {val}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ display: 'flex', gap: '12px', width: '100%', maxWidth: '440px' }}>
              <button
                onClick={handleClearBets}
                disabled={betAmount === 0}
                className="btn btn-secondary"
                style={{ flex: 1 }}
              >
                Hủy cược
              </button>
              <button
                onClick={handleDeal}
                disabled={betAmount === 0}
                className="btn btn-primary"
                style={{ flex: 2, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
              >
                <Play size={16} fill="white" /> Chia Bài (Deal)
              </button>
            </div>
          </>
        ) : phase === 'player_turn' ? (
          <div style={{ display: 'flex', gap: '12px', width: '100%', maxWidth: '440px' }}>
            <button
              onClick={handleHit}
              disabled={playerHand.length >= 5}
              className="btn btn-primary"
              style={{ flex: 1, height: '46px', fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
            >
              <Plus size={16} /> Rút Bài (Hit)
            </button>
            <button
              onClick={handleStand}
              className="btn btn-secondary"
              style={{ flex: 1, height: '46px', fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
            >
              <Square size={16} /> Dừng Bài (Stand)
            </button>
          </div>
        ) : phase === 'dealer_turn' ? (
          <div style={{
            height: '46px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--color-text-secondary)',
            fontSize: '0.9rem',
          }}>
            Nhà cái đang rút bài{thinkingText}
          </div>
        ) : (
          <button
            onClick={handleReset}
            className="btn btn-primary"
            style={{ width: '100%', maxWidth: '440px', height: '46px', fontWeight: 800 }}
          >
            Chơi Ván Mới
          </button>
        )}

        <div style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', textAlign: 'center' }}>
          💡 Luật chơi: Rút bài đạt điểm gần 21 nhất nhưng không vượt quá 21. Nhà cái bắt buộc rút nếu dưới 17 điểm. Xì Jack (Blackjack) ăn 1.5x cược gốc. 🌟 Ngũ Linh (5 lá ≤21) thắng tuyệt đối, ăn x2 cược.
        </div>
      </div>
    </div>
  );
};
