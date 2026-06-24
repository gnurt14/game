import React, { useEffect, useState } from 'react';
import { Sidebar, SidebarTab } from './components/Sidebar';
import { Header } from './components/Header';
import { AuthScreen } from './components/AuthScreen';
import { Dashboard } from './components/Dashboard';
import { Shop } from './components/Shop';
import { Achievements } from './components/Achievements';
import { Profile } from './components/Profile';
import { MultiplayerLobby } from './components/MultiplayerLobby';

// Modals
import { DailyRewardModal } from './components/DailyRewardModal';
import { LuckyWheelModal } from './components/LuckyWheelModal';
import { WelcomeBackModal } from './components/WelcomeBackModal';

// Services
import { AuthService, PlayerModel } from './services/authService';
import { CoinService } from './services/coinService';
import { StreakService } from './services/streakService';
import { RoomService, GameRoom } from './services/roomService';

// Single Player Games
import { SlidingPuzzle } from './games/single/SlidingPuzzle';
import { Minesweeper } from './games/single/Minesweeper';
import { Game2048 } from './games/single/Game2048';
import { Sudoku } from './games/single/Sudoku';
import { MemoryMatch } from './games/single/MemoryMatch';
import { Tetris } from './games/single/Tetris';
import { Mastermind } from './games/single/Mastermind';
import { TicTacToe } from './games/single/TicTacToe';
import { Snake } from './games/single/Snake';
import { FlappyBird } from './games/single/FlappyBird';
import { WhackAMole } from './games/single/WhackAMole';
import { NinjaFruit } from './games/single/NinjaFruit';
import { BrickBreaker } from './games/single/BrickBreaker';
import { BauCuaOffline } from './games/single/BauCuaOffline';
import { DoDenOffline } from './games/single/DoDenOffline';
import { XiJackOffline } from './games/single/XiJackOffline';
import { SlotMachine } from './games/single/SlotMachine';
import { CrashGame } from './games/single/CrashGame';
import { TaiXiu } from './games/single/TaiXiu';
import { Plinko } from './games/single/Plinko';
import { CoinFlip } from './games/single/CoinFlip';

// Multiplayer Game Room View
import { GameRoomView } from './components/GameRoomView';

export const App: React.FC = () => {
  const [player, setPlayer] = useState<PlayerModel | null>(null);
  const [isGuest, setIsGuest] = useState(false);
  const [initializing, setInitializing] = useState(true);

  // Layout routing state
  const [activeTab, setActiveTab] = useState<SidebarTab>('dashboard');
  const [activeGameId, setActiveGameId] = useState<string | null>(null);
  const [activeRoom, setActiveRoom] = useState<GameRoom | null>(null);
  const [lobbyGameType, setLobbyGameType] = useState<'bau_cua' | 'do_den' | 'xi_jack' | null>(null);
  const [luckyGameModeSelect, setLuckyGameModeSelect] = useState<'bau_cua' | 'do_den' | 'xi_jack' | null>(null);

  // Modals state
  const [isDailyOpen, setIsDailyOpen] = useState(false);
  const [isWheelOpen, setIsWheelOpen] = useState(false);
  const [isWelcomeBackOpen, setIsWelcomeBackOpen] = useState(false);

  // Check auth session on startup
  useEffect(() => {
    const checkSession = async () => {
      const p = await AuthService.tryRestoreSession();
      if (p) {
        setPlayer(p);
        await CoinService.loadFromPlayer(p);
      } else {
        const guestBalance = localStorage.getItem('coin_balance');
        if (guestBalance !== null) {
          setIsGuest(true);
        }
      }
      // Initialize coin system cache
      await CoinService.init();
      setInitializing(false);
    };

    checkSession();

    // Subscribe to auth changes
    const unsub = AuthService.subscribe((p) => {
      setPlayer(p);
      if (p) {
        setIsGuest(false);
        CoinService.loadFromPlayer(p);
      }
    });

    return unsub;
  }, []);

  const handleLoginSuccess = () => {
    setIsGuest(false);
  };

  const handlePlayAsGuest = async () => {
    localStorage.setItem('coin_balance', '500');
    localStorage.setItem('coin_free_lucky_boxes', '3');
    setIsGuest(true);
    await CoinService.init({ isNewPlayer: true });
  };

  // Trigger daily checkin modal automatically on startup if not claimed today
  useEffect(() => {
    if ((player || isGuest) && !initializing) {
      const info = CoinService.getDailyRewardInfo();
      if (info.shouldShow) {
        setTimeout(() => setIsDailyOpen(true), 1500);
      }
    }
  }, [player, isGuest, initializing]);

  // Trigger Welcome Back modal nếu player offline >24h (hoặc lần đầu).
  useEffect(() => {
    if ((player || isGuest) && !initializing) {
      if (StreakService.shouldShowWelcomeBack()) {
        // Delay nhẹ để không xung đột với DailyReward modal.
        setTimeout(() => setIsWelcomeBackOpen(true), 2800);
      }
    }
  }, [player, isGuest, initializing]);

  if (initializing) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-primary)', color: 'white' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ width: '40px', height: '40px', border: '3px solid rgba(255,255,255,0.1)', borderTopColor: 'var(--primary-color)', borderRadius: '50%', animation: 'spin-slow 1s linear infinite', margin: '0 auto 16px auto' }}></div>
          <p style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--color-text-secondary)' }}>Đang tải tài khoản...</p>
        </div>
      </div>
    );
  }

  // If not logged in and not guest, show Auth screen
  if (!player && !isGuest) {
    return <AuthScreen onLoginSuccess={handleLoginSuccess} onPlayAsGuest={handlePlayAsGuest} />;
  }

  const renderActiveGame = () => {
    if (!activeGameId) return null;

    const handleClose = () => {
      setActiveGameId(null);
    };

    switch (activeGameId) {
      case 'sliding_puzzle':
        return <SlidingPuzzle onClose={handleClose} />;
      case 'minesweeper':
        return <Minesweeper onClose={handleClose} />;
      case 'game_2048':
        return <Game2048 onClose={handleClose} />;
      case 'sudoku':
        return <Sudoku onClose={handleClose} />;
      case 'memory':
        return <MemoryMatch onClose={handleClose} />;
      case 'tetris':
        return <Tetris onClose={handleClose} />;
      case 'mastermind':
        return <Mastermind onClose={handleClose} />;
      case 'tictactoe':
        return <TicTacToe onClose={handleClose} />;
      case 'snake':
        return <Snake onClose={handleClose} />;
      case 'flappy':
        return <FlappyBird onClose={handleClose} />;
      case 'whack_mole':
        return <WhackAMole onClose={handleClose} />;
      case 'ninja_fruit':
        return <NinjaFruit onClose={handleClose} />;
      case 'brick_breaker':
        return <BrickBreaker onClose={handleClose} />;
      case 'bau_cua_offline':
        return <BauCuaOffline onClose={handleClose} />;
      case 'do_den_offline':
        return <DoDenOffline onClose={handleClose} />;
      case 'xi_jack_offline':
        return <XiJackOffline onClose={handleClose} />;
      case 'slot_machine':
        return <SlotMachine onClose={handleClose} />;
      case 'crash_game':
        return <CrashGame onClose={handleClose} />;
      case 'tai_xiu':
        return <TaiXiu onClose={handleClose} />;
      case 'plinko':
        return <Plinko onClose={handleClose} />;
      case 'coin_flip':
        return <CoinFlip onClose={handleClose} />;
      default:
        return (
          <div className="glass" style={{ width: '100%', height: 'calc(100vh - 120px)', display: 'flex', flexDirection: 'column', padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: 'var(--border-glass)', paddingBottom: '14px', marginBottom: '20px' }}>
              <div>
                <h2 style={{ fontSize: '1.4rem', fontWeight: 800 }}>Chưa Hỗ Trợ: {activeGameId}</h2>
              </div>
              <button onClick={handleClose} className="btn btn-secondary">Quay lại</button>
            </div>
          </div>
        );
    }
  };

  const renderActiveRoom = () => {
    if (!activeRoom) return null;

    const handleLeaveRoom = async () => {
      await RoomService.leaveRoom();
      setActiveRoom(null);
    };

    return <GameRoomView room={activeRoom} onLeave={handleLeaveRoom} />;
  };

  const handlePlayGame = (gameId: string) => {
    if (gameId === 'bau_cua' || gameId === 'do_den' || gameId === 'xi_jack') {
      setLuckyGameModeSelect(gameId);
    } else {
      setActiveGameId(gameId);
    }
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return <Dashboard onPlayGame={handlePlayGame} />;
      case 'multiplayer':
        return (
          <MultiplayerLobby 
            onJoinRoomSuccess={(room) => setActiveRoom(room)} 
            initialCreateGameType={lobbyGameType}
            onClearInitialGameType={() => setLobbyGameType(null)}
          />
        );
      case 'shop':
        return <Shop />;
      case 'achievements':
        return <Achievements />;
      case 'profile':
        return <Profile />;
      default:
        return <Dashboard onPlayGame={handlePlayGame} />;
    }
  };

  return (
    <div className="app-container">
      {/* Sidebar Navigation */}
      {!activeGameId && !activeRoom && (
        <Sidebar activeTab={activeTab} onChangeTab={setActiveTab} />
      )}

      {/* Main Panel Wrapper */}
      <main className="main-content" style={{ width: (!activeGameId && !activeRoom) ? 'calc(100% - 260px)' : '100%' }}>
        {/* Top Header */}
        {!activeGameId && !activeRoom && (
          <Header
            onOpenDaily={() => setIsDailyOpen(true)}
            onOpenWheel={() => setIsWheelOpen(true)}
            onSwitchToLogin={() => setIsGuest(false)}
          />
        )}

        {/* Dynamic Display content */}
        {activeGameId ? (
          renderActiveGame()
        ) : activeRoom ? (
          renderActiveRoom()
        ) : (
          renderTabContent()
        )}
      </main>

      {/* Pop-up Modals */}
      <DailyRewardModal isOpen={isDailyOpen} onClose={() => setIsDailyOpen(false)} />
      <LuckyWheelModal isOpen={isWheelOpen} onClose={() => setIsWheelOpen(false)} />
      <WelcomeBackModal
        isOpen={isWelcomeBackOpen}
        onClose={() => setIsWelcomeBackOpen(false)}
      />

      {/* Choice Modal for Lucky Games (Offline vs Multiplayer) */}
      {luckyGameModeSelect && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 10000, background: 'rgba(5, 3, 10, 0.85)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="glass" style={{ width: '400px', padding: '32px', display: 'flex', flexDirection: 'column', gap: '20px', textAlign: 'center' }}>
            <h3 style={{ fontSize: '1.4rem', fontWeight: 800, color: 'white' }}>
              Chọn chế độ chơi: {luckyGameModeSelect === 'bau_cua' ? '🎰 Bầu Cua' : luckyGameModeSelect === 'do_den' ? '🃏 Đỏ Đen' : '💳 Xì Jack'}
            </h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)' }}>
              Bạn muốn chơi đơn tự động đấu với Máy hay tạo phòng chơi trực tuyến cùng người khác?
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <button
                onClick={() => {
                  setActiveGameId(`${luckyGameModeSelect}_offline`);
                  setLuckyGameModeSelect(null);
                }}
                className="btn btn-primary"
                style={{ height: '46px', fontWeight: 800 }}
              >
                🎮 Chơi với Máy (Offline)
              </button>
              <button
                onClick={() => {
                  if (!AuthService.getPlayer()) {
                    alert('🔒 Chế độ trực tuyến cần tài khoản. Bạn vui lòng đăng nhập để tham gia nhé!');
                  } else {
                    setLobbyGameType(luckyGameModeSelect);
                    setActiveTab('multiplayer');
                    setLuckyGameModeSelect(null);
                  }
                }}
                className="btn btn-secondary"
                style={{ height: '46px', fontWeight: 800 }}
              >
                🌐 Chơi Trực Tuyến (Multiplayer)
              </button>
            </div>
            <button
              onClick={() => setLuckyGameModeSelect(null)}
              className="btn btn-secondary"
              style={{ fontSize: '0.85rem', marginTop: '8px' }}
            >
              Hủy bỏ
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
export default App;
