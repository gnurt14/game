import React, { useEffect, useState } from 'react';
import { RoomService, GameRoom, RoomPlayer, xjHandValue, parseBauCuaBets } from '../services/roomService';
import { User, Play, RotateCcw, AlertTriangle, X, Trash2 } from 'lucide-react';
import confetti from 'canvas-confetti';

interface GameRoomViewProps {
  room: GameRoom;
  onLeave: () => void;
}

const BC_ICONS = ['🦌', '🦀', '🦐', '🐟', '🐓', '🐗'];
const BC_LABELS = ['Bầu', 'Cua', 'Tôm', 'Cá', 'Gà', 'Nai'];

export const GameRoomView: React.FC<GameRoomViewProps> = ({ room, onLeave }) => {
  const [currentRoom, setCurrentRoom] = useState<GameRoom | null>(room);
  const [players, setPlayers] = useState<RoomPlayer[]>([]);
  const [myBetAmount, setMyBetAmount] = useState<number>(room.minBet);

  // Local status
  const [isSetted, setIsSetted] = useState<boolean>(false);
  const [shakeCup, setShakeCup] = useState<boolean>(false);
  const [revealCard, setRevealCard] = useState<boolean>(false);

  const myId = RoomService.getMyId();
  const isHost = RoomService.isHost();
  const me = players.find(p => p.playerId === myId);

  useEffect(() => {
    // Subscribe to Supabase real-time updates
    const unsubRoom = RoomService.subscribeRoom((r) => {
      setCurrentRoom(r);
      if (r?.status === 'betting') {
        setIsSetted(false);
      }
    });

    const unsubPlayers = RoomService.subscribePlayers((p) => {
      setPlayers(p);
    });

    return () => {
      unsubRoom();
      unsubPlayers();
    };
  }, []);

  // Monitor room status transitions for client-side auto-settlement
  useEffect(() => {
    if (!currentRoom) return;

    if (currentRoom.status === 'rolling') {
      if (currentRoom.gameType === 'bau_cua') {
        setShakeCup(true);
        setTimeout(() => {
          setShakeCup(false);
          settleClientBet();
        }, 1500);
      } else if (currentRoom.gameType === 'do_den') {
        setRevealCard(true);
        setTimeout(() => {
          setRevealCard(false);
          settleClientBet();
        }, 1500);
      } else if (currentRoom.gameType === 'xi_jack') {
        if (currentRoom.gameState?.phase === 'revealing') {
          settleClientBet();
        }
      }
    } else if (currentRoom.status === 'finished') {
      // In blackjack, finished status handles settlement
      settleClientBet();
    }
  }, [currentRoom?.status, currentRoom?.gameState?.phase]);

  const settleClientBet = async () => {
    if (isSetted) return;
    setIsSetted(true);
    try {
      if (currentRoom?.gameType === 'xi_jack') {
        await RoomService.settleXiJack();
      } else {
        await RoomService.settleMyBet();
      }
      // Check delta
      const updatedMe = RoomService.getMyPlayerRecord();
      if (updatedMe && updatedMe.resultDelta > 0) {
        confetti({
          particleCount: 50,
          spread: 40,
          origin: { y: 0.8 }
        });
      }
    } catch (e) {
      console.error('Error settling client bet:', e);
    }
  };

  const handlePlaceBet = async (choice: string) => {
    if (!currentRoom || currentRoom.status !== 'betting') return;
    if (myBetAmount < currentRoom.minBet) {
      alert(`Mức cược tối thiểu là ${currentRoom.minBet} xu.`);
      return;
    }

    try {
      await RoomService.placeBet(myBetAmount, choice);
    } catch (e: any) {
      alert(e.message || 'Cược thất bại');
    }
  };

  const handlePlaceBauCuaBet = async (slotId: string) => {
    if (!currentRoom || currentRoom.status !== 'betting') return;
    if (myBetAmount < currentRoom.minBet) {
      alert(`Mức cược tối thiểu là ${currentRoom.minBet} xu.`);
      return;
    }
    try {
      await RoomService.placeBauCuaBet(slotId, myBetAmount);
    } catch (e: any) {
      alert(e.message || 'Cược thất bại');
    }
  };

  const handleUndoBauCuaSlot = async (slotId: string) => {
    try {
      await RoomService.undoBauCuaSlot(slotId);
    } catch (e: any) {
      alert(e.message || 'Huỷ cược thất bại');
    }
  };

  const handleClearMyBets = async () => {
    try {
      await RoomService.clearMyBets();
    } catch (e: any) {
      alert(e.message || 'Xoá cược thất bại');
    }
  };

  const handleReadyXiJack = async () => {
    if (me?.isReady) {
      await RoomService.xiJackUnready();
    } else {
      try {
        await RoomService.xiJackReady(myBetAmount);
      } catch (e: any) {
        alert(e.message || 'Đặt cược thất bại');
      }
    }
  };

  // --- Host Triggers ---
  const handleHostStartBetting = async () => {
    try {
      await RoomService.openBetting();
    } catch (e) {
      console.error(e);
    }
  };

  const handleHostRoll = async () => {
    try {
      await RoomService.rollResult();
    } catch (e) {
      console.error(e);
    }
  };

  const handleHostStartXiJack = async () => {
    try {
      await RoomService.startXiJackCountdown();
    } catch (e) {
      console.error(e);
    }
  };

  const handleXiJackHit = async () => {
    try {
      const gs = currentRoom?.gameState;
      const hand = gs?.player_hands?.[myId || ''] || [];
      await RoomService.xiJackRequestHit(hand.length + 1);
    } catch (e) {
      console.error(e);
    }
  };

  const handleXiJackStand = async () => {
    try {
      await RoomService.xiJackRequestStand();
    } catch (e) {
      console.error(e);
    }
  };

  const handleHostPlayDealer = async () => {
    try {
      await RoomService.processXiJackActions();
    } catch (e) {
      console.error(e);
    }
  };

  const handleHostResetXiJackRound = async () => {
    try {
      await RoomService.resetXiJackRound();
    } catch (e) {
      console.error(e);
    }
  };

  if (!currentRoom) return null;

  const renderBauCuaBoard = () => {
    const isBetting = currentRoom.status === 'betting';
    const gameState = currentRoom.gameState;

    // Cược của tôi (multi-slot)
    const myBets = parseBauCuaBets(me?.betChoice ?? null);
    const myTotalBet = Object.values(myBets).reduce((s, v) => s + v, 0);

    // Tổng mọi player cho từng slot
    const roomTotals: Record<number, number> = {};
    for (const p of players) {
      const pBets = parseBauCuaBets(p.betChoice);
      for (const k of Object.keys(pBets)) {
        const id = parseInt(k);
        roomTotals[id] = (roomTotals[id] || 0) + pBets[k];
      }
    }

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', width: '100%' }}>

        {/* Shaking Cup Animation or Revealed Dice */}
        <div style={{
          height: '100px',
          background: 'rgba(0,0,0,0.25)',
          borderRadius: '12px',
          border: 'var(--border-glass)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
          overflow: 'hidden'
        }}>
          {shakeCup ? (
            <div style={{ fontSize: '3.5rem', animation: 'bounce 0.15s infinite' }}>🫨🥤</div>
          ) : currentRoom.status === 'rolling' || currentRoom.status === 'finished' ? (
            <div style={{ display: 'flex', gap: '24px', alignItems: 'center' }}>
              {gameState?.dice?.map((dIdx: number, idx: number) => (
                <div key={idx} style={{
                  fontSize: '2.5rem',
                  background: 'rgba(255, 255, 255, 0.08)',
                  width: '60px',
                  height: '60px',
                  borderRadius: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  border: '1px solid rgba(255,255,255,0.15)',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
                  animation: 'spin-slow 0.4s ease-out'
                }}>
                  {BC_ICONS[dIdx]}
                </div>
              ))}
            </div>
          ) : (
            <span style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)', fontWeight: 600, textAlign: 'center', padding: '0 16px' }}>
              {isBetting
                ? `🔔 Click vào linh vật để đặt ${myBetAmount} xu. Có thể cược NHIỀU ô cùng lúc!`
                : 'Chờ bắt đầu cược...'}
            </span>
          )}
        </div>

        {/* 6 Icons Betting Board */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: '10px',
        }}>
          {BC_ICONS.map((icon, idx) => {
            const myBetOnThis = myBets[String(idx)] || 0;
            const roomTotal = roomTotals[idx] || 0;
            const hasMyBet = myBetOnThis > 0;

            return (
              <div
                key={idx}
                onClick={() => isBetting && handlePlaceBauCuaBet(String(idx))}
                style={{
                  background: hasMyBet
                    ? 'linear-gradient(135deg, rgba(241, 196, 15, 0.18) 0%, rgba(241, 196, 15, 0.06) 100%)'
                    : 'rgba(255, 255, 255, 0.03)',
                  border: hasMyBet ? '2px solid #f1c40f' : '1px solid rgba(255, 255, 255, 0.08)',
                  borderRadius: '12px',
                  padding: '14px 8px 10px 8px',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: isBetting ? 'pointer' : 'default',
                  transition: 'all 0.15s ease',
                  position: 'relative',
                  boxShadow: hasMyBet ? '0 0 14px rgba(241, 196, 15, 0.25)' : 'none',
                }}
                className={isBetting ? 'glass-interactive' : ''}
              >
                <span style={{ fontSize: '2.2rem' }}>{icon}</span>
                <span style={{ fontSize: '0.8rem', fontWeight: 700, marginTop: '4px', color: 'white' }}>
                  {BC_LABELS[idx]}
                </span>

                {/* Tổng phòng (góc trên phải, nhỏ + xám) */}
                {roomTotal > 0 && (
                  <span style={{
                    position: 'absolute',
                    top: '6px',
                    right: '6px',
                    fontSize: '0.6rem',
                    fontWeight: 700,
                    background: 'rgba(255,255,255,0.08)',
                    color: 'rgba(255,255,255,0.6)',
                    padding: '2px 5px',
                    borderRadius: '4px',
                  }}>
                    Σ {roomTotal}
                  </span>
                )}

                {/* CƯỢC CỦA BẠN trên ô này (chip vàng nổi bật + nút huỷ) */}
                {myBetOnThis > 0 && (
                  <div style={{
                    marginTop: '6px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    background: '#f1c40f',
                    color: '#1a1530',
                    padding: '2px 4px 2px 8px',
                    borderRadius: '12px',
                    fontWeight: 900,
                    fontSize: '0.75rem',
                  }}>
                    🪙 {myBetOnThis}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (isBetting) handleUndoBauCuaSlot(String(idx));
                      }}
                      title="Huỷ cược ô này (hoàn xu)"
                      style={{
                        background: 'rgba(0,0,0,0.25)',
                        border: 'none',
                        color: '#1a1530',
                        borderRadius: '50%',
                        width: '16px',
                        height: '16px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: 0,
                      }}
                    >
                      <X size={10} strokeWidth={3} />
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* CƯỢC CỦA BẠN — bảng tổng kết */}
        {isBetting && (
          <div style={{
            background: myTotalBet > 0
              ? 'linear-gradient(135deg, rgba(241, 196, 15, 0.12) 0%, rgba(241, 196, 15, 0.02) 100%)'
              : 'rgba(0,0,0,0.2)',
            border: myTotalBet > 0 ? '1.5px solid rgba(241, 196, 15, 0.35)' : '1px dashed rgba(255,255,255,0.1)',
            borderRadius: '10px',
            padding: '10px 14px',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            flexWrap: 'wrap',
            minHeight: '44px',
          }}>
            <span style={{ fontSize: '0.7rem', fontWeight: 800, color: '#f1c40f', letterSpacing: 1, whiteSpace: 'nowrap' }}>
              CƯỢC CỦA BẠN:
            </span>

            {myTotalBet === 0 ? (
              <span style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)' }}>
                Chưa cược — click vào ô linh vật để đặt
              </span>
            ) : (
              <>
                {Object.keys(myBets).map((k) => {
                  const idx = parseInt(k);
                  return (
                    <span key={k} style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '5px',
                      background: 'rgba(255,255,255,0.08)',
                      padding: '4px 8px',
                      borderRadius: '14px',
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      color: 'white',
                    }}>
                      <span style={{ fontSize: '0.9rem' }}>{BC_ICONS[idx]}</span>
                      <span style={{ color: '#f1c40f' }}>{myBets[k]} xu</span>
                    </span>
                  );
                })}
                <span style={{
                  marginLeft: 'auto',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                }}>
                  <span style={{ fontSize: '0.75rem', color: 'white', fontWeight: 800 }}>
                    Tổng: <span style={{ color: '#f1c40f' }}>{myTotalBet} xu</span>
                  </span>
                  <button
                    onClick={handleClearMyBets}
                    title="Xoá toàn bộ cược (hoàn xu)"
                    className="btn btn-secondary"
                    style={{ padding: '4px 8px', fontSize: '0.7rem', display: 'flex', alignItems: 'center', gap: '4px' }}
                  >
                    <Trash2 size={11} /> Xoá hết
                  </button>
                </span>
              </>
            )}
          </div>
        )}
      </div>
    );
  };

  const renderDoDenBoard = () => {
    const isBetting = currentRoom.status === 'betting';
    const gameState = currentRoom.gameState;

    const totalRed = players.filter(p => p.betChoice === 'red').reduce((sum, p) => sum + p.betAmount, 0);
    const totalBlack = players.filter(p => p.betChoice === 'black').reduce((sum, p) => sum + p.betAmount, 0);

    const myColor = me?.betChoice ?? null;
    const myAmount = me?.betAmount ?? 0;

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', width: '100%', alignItems: 'center' }}>

        {/* Revealed Card display */}
        <div style={{
          width: '100%',
          height: '120px',
          background: 'rgba(0,0,0,0.25)',
          borderRadius: '12px',
          border: 'var(--border-glass)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative'
        }}>
          {revealCard ? (
            <div style={{ fontSize: '3rem', animation: 'spin-slow 0.4s infinite' }}>🃏</div>
          ) : currentRoom.status === 'rolling' || currentRoom.status === 'finished' ? (
            gameState?.card ? (
              <div style={{
                width: '70px',
                height: '100px',
                background: 'white',
                borderRadius: '8px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                padding: '10px',
                color: gameState.card.isRed ? '#e74c3c' : '#2d3436',
                fontWeight: 800,
                fontSize: '1.25rem',
                border: '2px solid rgba(255,255,255,0.2)',
                boxShadow: '0 8px 16px rgba(0,0,0,0.4)',
                animation: 'scale-up 0.3s ease-out'
              }}>
                <div style={{ alignSelf: 'flex-start' }}>{gameState.card.rank}</div>
                <div style={{ fontSize: '2rem', alignSelf: 'center' }}>
                  {gameState.card.suit === 'hearts' ? '♥' : gameState.card.suit === 'diamonds' ? '♦' : gameState.card.suit === 'clubs' ? '♣' : '♠'}
                </div>
                <div style={{ alignSelf: 'flex-end' }}>{gameState.card.rank}</div>
              </div>
            ) : null
          ) : (
            <span style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)', fontWeight: 600, textAlign: 'center', padding: '0 16px' }}>
              {isBetting
                ? `🔔 Click vào ĐỎ hoặc ĐEN để đặt ${myBetAmount} xu. Có thể bấm nhiều lần để tăng cược.`
                : 'Chờ bắt đầu cược...'}
            </span>
          )}
        </div>

        {/* Red & Black betting options */}
        <div style={{ display: 'flex', gap: '14px', width: '100%', maxWidth: '380px' }}>
          {/* RED Option */}
          <div
            onClick={() => isBetting && handlePlaceBet('red')}
            style={{
              flex: 1,
              height: '120px',
              borderRadius: '12px',
              background: myColor === 'red' ? 'rgba(231, 76, 60, 0.28)' : 'rgba(231, 76, 60, 0.05)',
              border: myColor === 'red' ? '2.5px solid #e74c3c' : '1px solid rgba(231, 76, 60, 0.2)',
              cursor: isBetting ? 'pointer' : 'default',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.15s ease',
              position: 'relative',
              boxShadow: myColor === 'red' ? '0 0 18px rgba(231,76,60,0.4)' : 'none',
            }}
            className={isBetting ? 'glass-interactive' : ''}
          >
            <span style={{ fontSize: '2.4rem' }}>🔴</span>
            <span style={{ fontWeight: 800, fontSize: '0.95rem', marginTop: '4px', color: '#e74c3c' }}>ĐỎ (RED)</span>

            {/* Cược của bạn vào ô này */}
            {myColor === 'red' && (
              <div style={{
                marginTop: '6px',
                background: '#f1c40f',
                color: '#1a1530',
                padding: '2px 10px',
                borderRadius: '12px',
                fontWeight: 900,
                fontSize: '0.78rem',
              }}>
                🪙 BẠN: {myAmount}
              </div>
            )}

            {/* Tổng phòng */}
            {totalRed > 0 && (
              <span style={{
                position: 'absolute', top: '6px', right: '6px',
                fontSize: '0.6rem', fontWeight: 700,
                background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.65)',
                padding: '2px 5px', borderRadius: '4px'
              }}>
                Σ {totalRed}
              </span>
            )}
          </div>

          {/* BLACK Option */}
          <div
            onClick={() => isBetting && handlePlaceBet('black')}
            style={{
              flex: 1,
              height: '120px',
              borderRadius: '12px',
              background: myColor === 'black' ? 'rgba(255, 255, 255, 0.18)' : 'rgba(255, 255, 255, 0.02)',
              border: myColor === 'black' ? '2.5px solid white' : '1px solid rgba(255, 255, 255, 0.1)',
              cursor: isBetting ? 'pointer' : 'default',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.15s ease',
              position: 'relative',
              boxShadow: myColor === 'black' ? '0 0 18px rgba(255,255,255,0.25)' : 'none',
            }}
            className={isBetting ? 'glass-interactive' : ''}
          >
            <span style={{ fontSize: '2.4rem' }}>⚫</span>
            <span style={{ fontWeight: 800, fontSize: '0.95rem', marginTop: '4px', color: 'white' }}>ĐEN (BLACK)</span>

            {myColor === 'black' && (
              <div style={{
                marginTop: '6px',
                background: '#f1c40f',
                color: '#1a1530',
                padding: '2px 10px',
                borderRadius: '12px',
                fontWeight: 900,
                fontSize: '0.78rem',
              }}>
                🪙 BẠN: {myAmount}
              </div>
            )}

            {totalBlack > 0 && (
              <span style={{
                position: 'absolute', top: '6px', right: '6px',
                fontSize: '0.6rem', fontWeight: 700,
                background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.65)',
                padding: '2px 5px', borderRadius: '4px'
              }}>
                Σ {totalBlack}
              </span>
            )}
          </div>
        </div>

        {/* CƯỢC CỦA BẠN — banner */}
        {isBetting && (
          <div style={{
            width: '100%',
            maxWidth: '380px',
            background: myAmount > 0
              ? 'linear-gradient(135deg, rgba(241, 196, 15, 0.12) 0%, rgba(241, 196, 15, 0.02) 100%)'
              : 'rgba(0,0,0,0.2)',
            border: myAmount > 0 ? '1.5px solid rgba(241, 196, 15, 0.35)' : '1px dashed rgba(255,255,255,0.1)',
            borderRadius: '10px',
            padding: '10px 14px',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            minHeight: '44px',
            justifyContent: 'space-between',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '0.7rem', fontWeight: 800, color: '#f1c40f', letterSpacing: 1 }}>
                CƯỢC CỦA BẠN:
              </span>
              {myAmount === 0 ? (
                <span style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)' }}>
                  Chưa cược
                </span>
              ) : (
                <span style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  background: myColor === 'red' ? 'rgba(231,76,60,0.25)' : 'rgba(255,255,255,0.12)',
                  border: myColor === 'red' ? '1px solid #e74c3c' : '1px solid rgba(255,255,255,0.25)',
                  padding: '4px 10px',
                  borderRadius: '14px',
                  fontSize: '0.78rem',
                  fontWeight: 800,
                  color: 'white',
                }}>
                  <span style={{ fontSize: '0.9rem' }}>{myColor === 'red' ? '🔴' : '⚫'}</span>
                  <span style={{ color: '#f1c40f' }}>{myAmount} xu</span>
                  <span style={{ color: 'rgba(255,255,255,0.6)', fontWeight: 600 }}>
                    vào {myColor === 'red' ? 'ĐỎ' : 'ĐEN'}
                  </span>
                </span>
              )}
            </div>

            {myAmount > 0 && (
              <button
                onClick={handleClearMyBets}
                title="Xoá cược (hoàn xu)"
                className="btn btn-secondary"
                style={{ padding: '4px 8px', fontSize: '0.7rem', display: 'flex', alignItems: 'center', gap: '4px' }}
              >
                <Trash2 size={11} /> Xoá
              </button>
            )}
          </div>
        )}
      </div>
    );
  };

  const renderXiJackBoard = () => {
    const gs = currentRoom.gameState;
    if (!gs) return <div>Đang khởi tạo bàn cược...</div>;

    const phase = gs.phase || 'lobby';

    // Cards rendering helper
    const drawCard = (card: string, hidden = false) => {
      if (hidden) {
        return (
          <div key={card} style={{
            width: '44px',
            height: '64px',
            background: 'linear-gradient(135deg, #1c1533 0%, #0d091a 100%)',
            border: '1px solid rgba(255,255,255,0.15)',
            borderRadius: '6px',
            boxShadow: '0 2px 6px rgba(0,0,0,0.3)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '1rem',
          }}>
            🌀
          </div>
        );
      }

      const suit = card.charAt(card.length - 1);
      const rank = card.substring(0, card.length - 1);
      const isRed = suit === '♥' || suit === '♦';

      return (
        <div key={card} style={{
          width: '44px',
          height: '64px',
          background: 'white',
          border: '1px solid rgba(0,0,0,0.1)',
          borderRadius: '6px',
          color: isRed ? '#e74c3c' : '#2d3436',
          fontWeight: 800,
          fontSize: '0.85rem',
          padding: '4px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          boxShadow: '0 3px 6px rgba(0,0,0,0.2)',
          userSelect: 'none'
        }}>
          <div>{rank}</div>
          <div style={{ fontSize: '1.2rem', alignSelf: 'center' }}>{suit}</div>
          <div style={{ alignSelf: 'flex-end' }}>{rank}</div>
        </div>
      );
    };

    const dealerHand = gs.dealer_hand || [];
    const isDealerPlaying = gs.active_player_id === 'dealer';

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', width: '100%' }}>

        {/* Dealer Zone */}
        <div style={{
          background: 'rgba(0,0,0,0.25)',
          borderRadius: '12px',
          padding: '16px',
          border: 'var(--border-glass)',
          textAlign: 'center'
        }}>
          <h4 style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)', marginBottom: '10px', fontWeight: 700 }}>
            🎴 Nhà Cái (Dealer) Hand {dealerHand.length > 0 && `(${xjHandValue(dealerHand)})`}
          </h4>

          <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', minHeight: '64px' }}>
            {dealerHand.map((c: string, idx: number) => {
              // Hide dealer's second card if players are still playing
              const isHidden = idx === 1 && phase === 'player_turns' && !isDealerPlaying;
              return drawCard(c, isHidden);
            })}
          </div>
        </div>

        {/* Players Area */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {players.map((p) => {
            const hand = gs.player_hands?.[p.playerId] || [];
            const action = gs.player_actions?.[p.playerId];
            const isCurrentTurn = gs.active_player_id === p.playerId;
            const handVal = xjHandValue(hand);
            const isBusted = handVal > 21;

            return (
              <div
                key={p.playerId}
                style={{
                  background: isCurrentTurn ? 'rgba(124, 111, 255, 0.1)' : 'rgba(255, 255, 255, 0.02)',
                  border: isCurrentTurn ? '2px solid var(--primary-color)' : '1px solid rgba(255, 255, 255, 0.05)',
                  borderRadius: '10px',
                  padding: '12px 16px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '0.85rem', fontWeight: 800, color: 'white' }}>{p.displayName}</span>
                    {p.betAmount > 0 && (
                      <span style={{ fontSize: '0.7rem', color: '#f1c40f', fontWeight: 700 }}>🪙 {p.betAmount}</span>
                    )}
                  </div>
                  <span style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', marginTop: '2px', display: 'block' }}>
                    {action === 'stand' ? '⏹ Stand' : isBusted ? '💥 Bust!' : isCurrentTurn ? '⚡ Đang suy nghĩ...' : 'Đợi...'}
                  </span>
                </div>

                {/* Hand cards display */}
                <div style={{ display: 'flex', gap: '6px' }}>
                  {hand.map((c: string) => drawCard(c))}
                </div>
              </div>
            );
          })}
        </div>

        {/* Actions panel */}
        {phase === 'player_turns' && gs.active_player_id === myId && (
          <div style={{ display: 'flex', gap: '10px', width: '100%', marginTop: '10px' }}>
            <button
              onClick={handleXiJackHit}
              disabled={xjHandValue(gs.player_hands?.[myId || ''] || []) >= 21}
              className="btn btn-primary"
              style={{ flex: 1, height: '44px', fontWeight: 800 }}
            >
              HIT (Rút Thêm)
            </button>

            <button
              onClick={handleXiJackStand}
              className="btn btn-secondary"
              style={{ flex: 1, height: '44px', fontWeight: 800 }}
            >
              STAND (Dừng bài)
            </button>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="glass fullscreen-game-container">
      <div style={{ display: 'flex', flexDirection: 'row', gap: '24px', flexGrow: 1, width: '100%', height: '100%', overflow: 'hidden' }}>

      {/* LEFT: Game Main Board */}
      <div style={{ flexGrow: 1, display: 'flex', flexDirection: 'column' }}>

        {/* Top Control Bar */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: 'var(--border-glass)', paddingBottom: '14px', marginBottom: '20px' }}>
          <div>
            <h2 style={{ fontSize: '1.4rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '8px' }}>
              🎲 Phòng: {currentRoom.roomCode}
            </h2>
            <span style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)' }}>
              Trò chơi: <strong>{currentRoom.gameType.toUpperCase()}</strong> | Round: #{currentRoom.roundNumber} | Min: {currentRoom.minBet} - Max: {currentRoom.maxBet}
            </span>
          </div>

          <button onClick={onLeave} className="btn btn-danger" style={{ fontSize: '0.85rem' }}>
            Rời Phòng
          </button>
        </div>

        {/* Dynamic game boards */}
        <div style={{ flexGrow: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.15)', borderRadius: '12px', border: 'var(--border-glass)', padding: '20px', minHeight: '320px' }}>
          {currentRoom.gameType === 'bau_cua' && renderBauCuaBoard()}
          {currentRoom.gameType === 'do_den' && renderDoDenBoard()}
          {currentRoom.gameType === 'xi_jack' && renderXiJackBoard()}
        </div>

        {/* Cược controller panel (Only for betting status & non Blackjack games) */}
        {currentRoom.status === 'betting' && currentRoom.gameType !== 'xi_jack' && (
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            background: 'rgba(255,255,255,0.02)',
            padding: '12px 18px',
            borderRadius: '12px',
            border: 'var(--border-glass)',
            marginTop: '16px',
            gap: '16px',
            flexWrap: 'wrap',
          }}>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: '0.7rem', color: 'var(--color-text-secondary)', fontWeight: 700, letterSpacing: 1 }}>
                XU MỖI LẦN CLICK
              </span>
              <span style={{ fontSize: '1.25rem', fontWeight: 900, color: '#f1c40f', marginTop: '2px' }}>
                🪙 {myBetAmount} xu
              </span>
              <span style={{ fontSize: '0.65rem', color: 'var(--color-text-muted)', marginTop: '2px' }}>
                Click ô để cộng {myBetAmount} xu vào ô đó
              </span>
            </div>

            <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
              {[10, 50, 100, 500].map(val => (
                <button
                  key={val}
                  onClick={() => setMyBetAmount(val)}
                  className="btn btn-secondary"
                  style={{
                    padding: '6px 12px',
                    fontSize: '0.75rem',
                    background: myBetAmount === val ? 'rgba(241, 196, 15, 0.18)' : undefined,
                    border: myBetAmount === val ? '1px solid #f1c40f' : undefined,
                    color: myBetAmount === val ? '#f1c40f' : undefined,
                    fontWeight: myBetAmount === val ? 800 : 600,
                  }}
                >
                  {val}
                </button>
              ))}
              <button
                onClick={() => setMyBetAmount(prev => Math.min(currentRoom.maxBet, prev + 10))}
                className="btn btn-secondary"
                style={{ padding: '6px 10px', fontSize: '0.7rem' }}
              >
                +10
              </button>
              <button
                onClick={() => setMyBetAmount(prev => Math.min(currentRoom.maxBet, prev + 100))}
                className="btn btn-secondary"
                style={{ padding: '6px 10px', fontSize: '0.7rem' }}
              >
                +100
              </button>
            </div>
          </div>
        )}

        {/* Ready/Unready controller (Only for Blackjack games waiting) */}
        {currentRoom.gameType === 'xi_jack' && currentRoom.status === 'waiting' && (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            background: me?.isReady
              ? 'linear-gradient(135deg, rgba(46, 204, 113, 0.10) 0%, rgba(46, 204, 113, 0.02) 100%)'
              : 'rgba(255,255,255,0.02)',
            padding: '14px 18px',
            borderRadius: '12px',
            border: me?.isReady ? '1.5px solid rgba(46, 204, 113, 0.45)' : 'var(--border-glass)',
            marginTop: '20px',
            gap: '12px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontSize: '0.7rem', color: 'var(--color-text-secondary)', fontWeight: 700, letterSpacing: 1 }}>
                    {me?.isReady ? 'BẠN ĐÃ CƯỢC' : 'CHỌN MỨC CƯỢC'}
                  </span>
                  <span style={{ fontSize: '1.4rem', fontWeight: 900, color: '#f1c40f', marginTop: '2px' }}>
                    🪙 {me?.isReady ? me.betAmount : myBetAmount} xu
                  </span>
                </div>

                {/* Chip tăng cược — disable khi đã ready */}
                <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                  {[10, 50, 100].map(val => (
                    <button
                      key={val}
                      disabled={me?.isReady}
                      onClick={() => setMyBetAmount(prev => Math.min(currentRoom.maxBet, prev + val))}
                      className="btn btn-secondary"
                      style={{ padding: '5px 10px', fontSize: '0.72rem', opacity: me?.isReady ? 0.4 : 1 }}
                    >
                      +{val}
                    </button>
                  ))}
                  <button
                    disabled={me?.isReady}
                    onClick={() => setMyBetAmount(currentRoom.minBet)}
                    className="btn btn-secondary"
                    style={{ padding: '5px 10px', fontSize: '0.72rem', opacity: me?.isReady ? 0.4 : 1 }}
                  >
                    Reset
                  </button>
                </div>
              </div>

              <button
                onClick={handleReadyXiJack}
                className={me?.isReady ? 'btn btn-secondary' : 'btn btn-primary'}
                style={{
                  padding: '12px 22px',
                  fontWeight: 900,
                  fontSize: '0.88rem',
                  minWidth: '200px',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '2px',
                  lineHeight: 1.15,
                }}
              >
                {me?.isReady ? (
                  <>
                    <span>✖ HỦY SẴN SÀNG</span>
                    <span style={{ fontSize: '0.65rem', fontWeight: 600, opacity: 0.8 }}>
                      (hoàn {me.betAmount} xu)
                    </span>
                  </>
                ) : (
                  <>
                    <span>✓ XÁC NHẬN CƯỢC {myBetAmount}</span>
                    <span style={{ fontSize: '0.65rem', fontWeight: 600, opacity: 0.85 }}>
                      Sẵn sàng vào ván
                    </span>
                  </>
                )}
              </button>
            </div>

            {/* Hint khi chưa ready */}
            {!me?.isReady && (
              <div style={{
                fontSize: '0.7rem',
                color: 'var(--color-text-muted)',
                paddingTop: '4px',
                borderTop: '1px dashed rgba(255,255,255,0.06)',
              }}>
                💡 Xác định mức cược rồi nhấn xác nhận. Sau khi xác nhận, không thể thay đổi cho đến khi ván kết thúc.
              </div>
            )}
          </div>
        )}

        {/* Host action panel */}
        {isHost && (
          <div style={{ display: 'flex', gap: '10px', marginTop: '20px', width: '100%' }}>
            {currentRoom.gameType !== 'xi_jack' ? (
              // Bầu cua & Đỏ đen host controls
              <>
                <button
                  disabled={currentRoom.status === 'betting'}
                  onClick={handleHostStartBetting}
                  className="btn btn-secondary"
                  style={{ flex: 1, height: '42px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', fontSize: '0.85rem', fontWeight: 700 }}
                >
                  <RotateCcw size={15} /> Mở cược ván mới
                </button>

                <button
                  disabled={currentRoom.status !== 'betting'}
                  onClick={handleHostRoll}
                  className="btn btn-primary"
                  style={{ flex: 1, height: '42px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', fontSize: '0.85rem', fontWeight: 800 }}
                >
                  <Play size={15} fill="white" /> {currentRoom.gameType === 'bau_cua' ? 'Lắc Xúc Xắc (Roll)' : 'Mở Bài (Flip Card)'}
                </button>
              </>
            ) : (
              // Xì jack host controls
              <>
                {currentRoom.status === 'waiting' && (
                  <button
                    onClick={handleHostStartXiJack}
                    className="btn btn-primary"
                    style={{ flex: 1, height: '42px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', fontSize: '0.85rem', fontWeight: 800 }}
                  >
                    <Play size={15} fill="white" /> Chia Bài (Start Round)
                  </button>
                )}

                {currentRoom.status === 'betting' && currentRoom.gameState?.phase === 'player_turns' && currentRoom.gameState?.active_player_id === 'dealer' && (
                  <button
                    onClick={handleHostPlayDealer}
                    className="btn btn-primary"
                    style={{ flex: 1, height: '42px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', fontSize: '0.85rem', fontWeight: 800 }}
                  >
                    <Play size={15} fill="white" /> Nhà Cái Rút Bài (Dealer Play)
                  </button>
                )}

                {currentRoom.status === 'finished' && (
                  <button
                    onClick={handleHostStartBetting}
                    className="btn btn-secondary"
                    style={{ flex: 1, height: '42px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', fontSize: '0.85rem', fontWeight: 700 }}
                  >
                    <RotateCcw size={15} /> Mở cược ván mới
                  </button>
                )}

                {currentRoom.gameState?.phase === 'revealing' && (
                  <button
                    onClick={handleHostResetXiJackRound}
                    className="btn btn-secondary"
                    style={{ flex: 1, height: '42px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', fontSize: '0.85rem', fontWeight: 700 }}
                  >
                    <RotateCcw size={15} /> Bắt đầu ván mới
                  </button>
                )}
              </>
            )}
          </div>
        )}

      </div>

      {/* RIGHT SIDEBAR: Players & Status */}
      <div className="glass" style={{ width: '220px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '16px', background: 'rgba(0,0,0,0.15)' }}>
        <h3 style={{ fontSize: '0.9rem', fontWeight: 800, color: 'white', borderBottom: 'var(--border-glass)', paddingBottom: '8px' }}>
          Người chơi ({players.length})
        </h3>

        {/* Players list */}
        <div style={{ flexGrow: 1, display: 'flex', flexDirection: 'column', gap: '10px', overflowY: 'auto' }}>
          {players.map((p) => {
            const isPlayerHost = p.playerId === currentRoom.hostId;
            return (
              <div
                key={p.playerId}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  background: 'rgba(255, 255, 255, 0.02)',
                  padding: '8px 10px',
                  borderRadius: '8px',
                  border: '1px solid rgba(255,255,255,0.01)'
                }}
              >
                <div style={{
                  width: '28px',
                  height: '28px',
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg, var(--primary-color) 0%, #a29bfe 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '0.75rem',
                  fontWeight: 800,
                  position: 'relative'
                }}>
                  <User size={14} color="white" />
                  {isPlayerHost && (
                    <span style={{ position: 'absolute', bottom: '-4px', right: '-4px', background: '#f1c40f', borderRadius: '50%', padding: '2px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      👑
                    </span>
                  )}
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', flexGrow: 1, overflow: 'hidden' }}>
                  <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'white', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                    {p.displayName}
                  </span>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '2px' }}>
                    <span style={{ fontSize: '0.65rem', color: p.isReady ? '#2ecc71' : 'var(--color-text-muted)' }}>
                      {p.isReady ? 'Sẵn sàng' : 'Chưa cược'}
                    </span>

                    {/* Result notification delta */}
                    {p.resultDelta !== 0 && (
                      <span style={{ fontSize: '0.7rem', fontWeight: 800, color: p.resultDelta > 0 ? '#2ecc71' : '#e74c3c' }}>
                        {p.resultDelta > 0 ? `+${p.resultDelta}` : p.resultDelta}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Bottom Rules tip */}
        <div style={{ fontSize: '0.65rem', color: 'var(--color-text-muted)', display: 'flex', gap: '6px', alignItems: 'flex-start' }}>
          <AlertTriangle size={14} style={{ flexShrink: 0, color: 'var(--color-text-muted)' }} />
          <span>
            {currentRoom.gameType === 'bau_cua'
              ? 'Tỷ lệ: Cược 1 trúng linh vật x1 cược, trúng 2 x2, trúng 3 x3 cược.'
              : currentRoom.gameType === 'do_den'
                ? 'Tỷ lệ: Đoán đúng màu lá bài thưởng x1 cược.'
                : 'Luật: Dưới 15 điểm bắt buộc rút (Hit). Đạt Xì Jack (Blackjack) hoặc lớn hơn cái để nhận x2.'}
          </span>
        </div>

      </div>
      </div>

    </div>
  );
};
