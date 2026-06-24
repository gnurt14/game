import React, { useState, useEffect } from 'react';
import { Search, Play, CheckCircle, Circle } from 'lucide-react';
import { CoinService, MissionStatus, CoinData } from '../services/coinService';
import { GameCategory } from '../services/weeklyMissionService';

export interface GameMetadata {
  id: string;
  name: string;
  description: string;
  emoji: string;
  category: GameCategory;
  gradient: [string, string];
}

export const GAMES_LIST: GameMetadata[] = [
  // 🎰 May Mắn
  { id: 'bau_cua', name: 'Bầu Cua', description: 'Cược xu lắc xúc xắc may mắn', emoji: '🎲', category: 'lucky', gradient: ['#e53935', '#ff6f00'] },
  { id: 'do_den', name: 'Đỏ Đen', description: 'Đặt cược màu lá bài đỏ đen', emoji: '🃏', category: 'lucky', gradient: ['#7b0000', '#1a237e'] },
  { id: 'xi_jack', name: 'Xì Jack', description: 'Đấu trí với bài blackjack nhà cái', emoji: '💳', category: 'lucky', gradient: ['#1b5e20', '#004d40'] },
  { id: 'slot_machine', name: 'Slot Machine', description: 'Quay 3 cuộn săn jackpot khổng lồ', emoji: '🎰', category: 'lucky', gradient: ['#c0392b', '#f1c40f'] },
  { id: 'crash_game', name: 'Crash Game', description: 'Rút lời trước khi đồ thị nổ tung', emoji: '💥', category: 'lucky', gradient: ['#16a085', '#e74c3c'] },
  { id: 'tai_xiu', name: 'Tài Xỉu', description: 'Cược tổng 3 xúc xắc Tài-Xỉu', emoji: '🎲', category: 'lucky', gradient: ['#8B4513', '#d4a574'] },
  { id: 'plinko', name: 'Plinko', description: 'Thả bóng rơi qua peg ăn multiplier', emoji: '🎯', category: 'lucky', gradient: ['#8e44ad', '#3498db'] },
  { id: 'coin_flip', name: 'Coin Flip', description: 'Lật đồng xu Mặt-Sấp x2 ăn liền', emoji: '🪙', category: 'lucky', gradient: ['#f39c12', '#d4a017'] },
  // 🎮 Phản Xạ
  { id: 'snake', name: 'Snake', description: 'Rắn ăn mồi truyền thống tốc độ', emoji: '🐍', category: 'action', gradient: ['#2ecc71', '#27ae60'] },
  { id: 'flappy', name: 'Flappy Bird', description: 'Bay qua chướng ngại vật liên tục', emoji: '🐦', category: 'action', gradient: ['#03a9f4', '#4fc3f7'] },
  { id: 'whack_mole', name: 'Whack-a-Mole', description: 'Đập chuột chũi nhanh tay ghi điểm', emoji: '🐹', category: 'action', gradient: ['#ff6b35', '#ff8c00'] },
  { id: 'ninja_fruit', name: 'Ninja Fruit', description: 'Chém hoa quả bay tránh chém bom', emoji: '🍓', category: 'action', gradient: ['#43a047', '#ff6f00'] },
  { id: 'brick_breaker', name: 'Brick Breaker', description: 'Bắn bóng đập gạch qua nhiều màn', emoji: '⚾', category: 'action', gradient: ['#6a1b9a', '#1565c0'] },
  // 🧩 Trí Tuệ
  { id: 'game_2048', name: '2048', description: 'Hợp nhất số đạt mục tiêu ô 2048', emoji: '🧩', category: 'puzzle', gradient: ['#edc22e', '#f2b179'] },
  { id: 'minesweeper', name: 'Minesweeper', description: 'Dò mìn logic an toàn nhanh nhất', emoji: '💣', category: 'puzzle', gradient: ['#78909c', '#37474f'] },
  { id: 'sliding_puzzle', name: 'Sliding Puzzle', description: 'Trượt các ô số về đúng vị trí', emoji: '🔢', category: 'puzzle', gradient: ['#26c6da', '#00838f'] },
  { id: 'sudoku', name: 'Sudoku', description: 'Điền số 1-9 theo lưới logic 9x9', emoji: '🔢', category: 'puzzle', gradient: ['#00bcd4', '#009688'] },
  { id: 'memory', name: 'Memory Match', description: 'Lật bài ghép cặp tìm emoji', emoji: '🧠', category: 'puzzle', gradient: ['#e91e63', '#9c27b0'] },
  // 🔤 Chiến Lược
  { id: 'tetris', name: 'Tetris', description: 'Xếp hình khối tetromino cổ điển', emoji: '🧱', category: 'strategy', gradient: ['#3498db', '#8e44ad'] },
  { id: 'mastermind', name: 'Mastermind', description: 'Giải mã bí mật từ pegs gợi ý', emoji: '🔒', category: 'strategy', gradient: ['#7e57c2', '#4527a0'] },
  { id: 'tictactoe', name: 'Tic-Tac-Toe', description: 'Đánh X-O bàn cờ 3x3 vs AI máy', emoji: '❌', category: 'strategy', gradient: ['#607d8b', '#455a64'] },
];

interface DashboardProps {
  onPlayGame: (gameId: string) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ onPlayGame }) => {
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [missionStatus, setMissionStatus] = useState<MissionStatus>(CoinService.getMissionStatus());
  const [coinData, setCoinData] = useState<CoinData>(CoinService.getData());

  useEffect(() => {
    const unsub = CoinService.subscribe((data) => {
      setMissionStatus(CoinService.getMissionStatus());
      setCoinData(data);
    });
    return unsub;
  }, []);

  const categories = [
    { id: 'all', name: 'Tất Cả' },
    { id: 'lucky', name: '🎰 May Mắn' },
    { id: 'action', name: '🎮 Phản Xạ' },
    { id: 'puzzle', name: '🧩 Trí Tuệ' },
    { id: 'strategy', name: '🔤 Chiến Lược' },
  ];

  // Filter games based on search and category
  const filteredGames = GAMES_LIST.filter((game) => {
    const matchesSearch = game.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          game.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = activeCategory === 'all' || game.category === activeCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      
      {/* Daily Missions Progress Panel */}
      <div className="glass" style={{ padding: '20px 24px', border: '1px solid rgba(124, 111, 255, 0.15)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '8px' }}>
            🔥 Nhiệm Vụ Hàng Ngày
          </h3>
          <p style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)', marginTop: '2px' }}>
            Hôm nay bạn đã chơi **{missionStatus.gamesPlayedCount}** game khác nhau.
          </p>
        </div>

        {/* Progress tracks */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '24px', flexGrow: 1, justifyItems: 'flex-end', justifyContent: 'flex-end' }}>
          
          {/* Mission 3 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(255, 255, 255, 0.03)', padding: '8px 12px', borderRadius: '10px', border: 'var(--border-glass)' }}>
            {missionStatus.mission3Collected ? (
              <CheckCircle size={18} color="#2ecc71" />
            ) : (
              <Circle size={18} color="var(--color-text-muted)" />
            )}
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: '0.8rem', fontWeight: 700 }}>Chơi 3 game</span>
              <span style={{ fontSize: '0.65rem', color: '#f1c40f', fontWeight: 600 }}>+100 xu</span>
            </div>
            <span style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--color-text-muted)', marginLeft: '10px' }}>
              {Math.min(3, missionStatus.gamesPlayedCount)}/3
            </span>
          </div>

          {/* Mission 5 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(255, 255, 255, 0.03)', padding: '8px 12px', borderRadius: '10px', border: 'var(--border-glass)' }}>
            {missionStatus.mission5Collected ? (
              <CheckCircle size={18} color="#2ecc71" />
            ) : (
              <Circle size={18} color="var(--color-text-muted)" />
            )}
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: '0.8rem', fontWeight: 700 }}>Chơi 5 game</span>
              <span style={{ fontSize: '0.65rem', color: '#f1c40f', fontWeight: 600 }}>+150 xu</span>
            </div>
            <span style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--color-text-muted)', marginLeft: '10px' }}>
              {Math.min(5, missionStatus.gamesPlayedCount)}/5
            </span>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        {/* Category Tabs */}
        <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '4px' }}>
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              className="btn"
              style={{
                padding: '8px 14px',
                fontSize: '0.85rem',
                borderRadius: '20px',
                background: activeCategory === cat.id ? 'var(--primary-color)' : 'rgba(255, 255, 255, 0.05)',
                color: activeCategory === cat.id ? 'white' : 'var(--color-text-secondary)',
                border: 'none',
                fontWeight: 600
              }}
            >
              {cat.name}
            </button>
          ))}
        </div>

        {/* Search */}
        <div style={{ position: 'relative', width: '100%', maxWidth: '300px' }}>
          <Search size={16} style={{ position: 'absolute', left: '14px', top: '13px', color: 'var(--color-text-muted)' }} />
          <input
            type="text"
            placeholder="Tìm kiếm game..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ paddingLeft: '38px', borderRadius: '24px', height: '40px', fontSize: '0.85rem' }}
          />
        </div>
      </div>

      {/* Games Grid Layout */}
      {filteredGames.length > 0 ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '20px' }}>
          {filteredGames.map((game) => {
            const hasBooster = coinData.boosterActive;
            
            return (
              <div 
                key={game.id} 
                className="glass glass-interactive" 
                style={{ 
                  padding: '24px', 
                  display: 'flex', 
                  flexDirection: 'column', 
                  justifyContent: 'space-between', 
                  height: '200px',
                  position: 'relative'
                }}
              >
                <div>
                  {/* Category Indicator */}
                  <span className={`category-badge badge-${game.category}`} style={{ display: 'inline-block', marginBottom: '12px' }}>
                    {game.category}
                  </span>

                  <h4 style={{ fontSize: '1.2rem', fontWeight: 800, color: 'white', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ 
                      width: '32px', 
                      height: '32px', 
                      borderRadius: '8px', 
                      background: `linear-gradient(135deg, ${game.gradient[0]}, ${game.gradient[1]})`,
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '1.1rem'
                    }}>{game.emoji}</span>
                    {game.name}
                  </h4>
                  
                  <p style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)', marginTop: '8px', lineHeight: '1.4' }}>
                    {game.description}
                  </p>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '16px' }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', fontWeight: 500 }}>
                    Thưởng: {game.category === 'lucky' ? 'Cược xu' : hasBooster ? '🪙 x2 xu' : '🪙 Xu thưởng'}
                  </span>
                  
                  <button 
                    onClick={() => onPlayGame(game.id)}
                    className="btn btn-primary"
                    style={{ 
                      width: '32px', 
                      height: '32px', 
                      borderRadius: '50%', 
                      padding: 0,
                      background: `linear-gradient(135deg, ${game.gradient[0]}, ${game.gradient[1]})`,
                      boxShadow: 'none'
                    }}
                  >
                    <Play size={14} fill="white" color="white" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div style={{ textAlign: 'center', padding: '60px', color: 'var(--color-text-muted)', fontSize: '0.95rem' }}>
          🔍 Không tìm thấy trò chơi nào khớp với yêu cầu của bạn.
        </div>
      )}
    </div>
  );
};
