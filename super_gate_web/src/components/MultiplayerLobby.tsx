import React, { useEffect, useState } from 'react';
import { Users, Plus, Key, ArrowRight, RefreshCw } from 'lucide-react';
import { RoomService, GameRoom } from '../services/roomService';
import { AuthService } from '../services/authService';

interface MultiplayerLobbyProps {
  onJoinRoomSuccess: (room: GameRoom) => void;
  initialCreateGameType?: 'bau_cua' | 'do_den' | 'xi_jack' | null;
  onClearInitialGameType?: () => void;
}

export const MultiplayerLobby: React.FC<MultiplayerLobbyProps> = ({ 
  onJoinRoomSuccess,
  initialCreateGameType,
  onClearInitialGameType
}) => {
  const [publicRooms, setPublicRooms] = useState<GameRoom[]>([]);
  const [roomCode, setRoomCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Room Creation state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [gameType, setGameType] = useState<'bau_cua' | 'do_den' | 'xi_jack'>('bau_cua');
  const [isPublic, setIsPublic] = useState(true);
  const [minBet, setMinBet] = useState(10);
  const [maxBet, setMaxBet] = useState(500);

  const loadRooms = async () => {
    setRefreshing(true);
    try {
      const rooms = await RoomService.getPublicRooms();
      setPublicRooms(rooms);
    } catch (e) {
      console.error('[MultiplayerLobby] Load rooms error:', e);
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadRooms();
  }, []);

  useEffect(() => {
    if (initialCreateGameType) {
      setGameType(initialCreateGameType);
      setShowCreateModal(true);
      if (onClearInitialGameType) {
        onClearInitialGameType();
      }
    }
  }, [initialCreateGameType, onClearInitialGameType]);

  const handleJoinByCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!roomCode.trim()) return;

    if (!AuthService.getPlayer()) {
      alert('🔒 Bạn phải đăng nhập để chơi chế độ Multiplayer!');
      return;
    }

    setLoading(true);
    try {
      const room = await RoomService.joinByCode(roomCode.trim());
      onJoinRoomSuccess(room);
    } catch (e: any) {
      alert(e.message || 'Không thể tham gia phòng');
    } finally {
      setLoading(false);
    }
  };

  const handleJoinDirect = async (code: string) => {
    if (!AuthService.getPlayer()) {
      alert('🔒 Bạn phải đăng nhập để chơi chế độ Multiplayer!');
      return;
    }

    setLoading(true);
    try {
      const room = await RoomService.joinByCode(code);
      onJoinRoomSuccess(room);
    } catch (e: any) {
      alert(e.message || 'Không thể tham gia phòng');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!AuthService.getPlayer()) {
      alert('🔒 Bạn phải đăng nhập để chơi chế độ Multiplayer!');
      return;
    }

    setLoading(true);
    try {
      const room = await RoomService.createRoom(gameType, isPublic, minBet, maxBet);
      setShowCreateModal(false);
      onJoinRoomSuccess(room);
    } catch (e: any) {
      alert(e.message || 'Tạo phòng thất bại');
    } finally {
      setLoading(false);
    }
  };

  const getGameLabel = (type: string) => {
    switch (type) {
      case 'bau_cua': return '🎰 Bầu Cua';
      case 'do_den': return '🃏 Đỏ Đen';
      case 'xi_jack': return '💳 Xì Jack';
      default: return '';
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      
      {/* Lobby Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: 'var(--border-glass)', paddingBottom: '16px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Users color="var(--primary-color)" /> Sảnh Chờ Multiplayer (Trực Tuyến)
          </h2>
          <p style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)', marginTop: '4px' }}>
            Tham gia cược xu trực tuyến thời gian thực với những người chơi khác.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <button onClick={loadRooms} disabled={refreshing} className="btn btn-secondary">
            <RefreshCw size={16} className={refreshing ? 'spin-slow' : ''} />
            <span>Làm Mới</span>
          </button>
          
          <button onClick={() => setShowCreateModal(true)} className="btn btn-primary">
            <Plus size={16} />
            <span>Tạo Phòng Mới</span>
          </button>
        </div>
      </div>

      {/* Code Join Form & Quick Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px' }}>
        
        {/* Join Room Code Box */}
        <div className="glass" style={{ padding: '24px' }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: 'white', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Key size={18} color="var(--primary-color)" /> Vào phòng bằng Mã
          </h3>
          <form onSubmit={handleJoinByCode} style={{ display: 'flex', gap: '10px' }}>
            <input
              type="text"
              placeholder="Nhập 6 ký tự mã phòng..."
              maxLength={6}
              value={roomCode}
              onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
              disabled={loading}
              style={{ flexGrow: 1, textTransform: 'uppercase', letterSpacing: '2px', fontWeight: 700, textAlign: 'center' }}
            />
            <button type="submit" disabled={loading || roomCode.length < 6} className="btn btn-primary" style={{ padding: '12px 16px' }}>
              <ArrowRight size={18} />
            </button>
          </form>
        </div>

        {/* Info Card */}
        <div className="glass" style={{ padding: '24px', color: 'var(--color-text-secondary)', fontSize: '0.85rem', lineHeight: '1.5' }}>
          💡 **Lưu ý chơi cược:** Bạn cần đăng nhập tài khoản trực tuyến để đồng bộ xu. Nếu chơi ở chế độ Guest, bạn sẽ không thể tham gia Sảnh Multiplayer. Hãy đảm bảo đường truyền ổn định để theo dõi Realtime.
        </div>

      </div>

      {/* Public Rooms List */}
      <div>
        <h3 style={{ fontSize: '1.2rem', fontWeight: 800, marginBottom: '16px', color: 'white' }}>
          Phòng Đang Chờ ({publicRooms.length})
        </h3>

        {publicRooms.length > 0 ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '20px' }}>
            {publicRooms.map((room) => (
              <div 
                key={room.id} 
                className="glass glass-interactive" 
                style={{ padding: '20px', display: 'flex', flexDirection: 'column', justifyItems: 'space-between', justifyContent: 'space-between', height: '170px' }}
              >
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                    <span style={{ fontSize: '1rem', fontWeight: 800, color: 'white' }}>
                      {getGameLabel(room.gameType)}
                    </span>
                    <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', fontWeight: 700, background: 'rgba(255,255,255,0.05)', padding: '2px 8px', borderRadius: '4px' }}>
                      {room.roomCode}
                    </span>
                  </div>

                  <p style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)' }}>
                    Mức cược: 🪙 **{room.minBet} - {room.maxBet} xu**
                  </p>
                  <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: '4px' }}>
                    Chủ phòng: {room.hostId.substring(0, 6)}
                  </p>
                </div>

                <button 
                  onClick={() => handleJoinDirect(room.roomCode)}
                  disabled={loading}
                  className="btn btn-primary"
                  style={{ width: '100%', padding: '8px', borderRadius: '10px', fontSize: '0.8rem', marginTop: '16px' }}
                >
                  Vào Phòng
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className="glass" style={{ textAlign: 'center', padding: '50px', color: 'var(--color-text-muted)', borderStyle: 'dashed' }}>
            📭 Hiện không có phòng công khai nào đang chờ. Hãy tự tạo một phòng mới!
          </div>
        )}
      </div>

      {/* Creation Modal dialog */}
      {showCreateModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}>
          <div className="glass" style={{ width: '90%', maxWidth: '420px', padding: '30px', border: '1px solid rgba(124, 111, 255, 0.2)' }}>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 800, marginBottom: '20px', textAlign: 'center' }}>Tạo Phòng Chơi Mới</h3>
            
            <form onSubmit={handleCreateRoom} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* Game Type Selection */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--color-text-secondary)' }}>Loại trò chơi</label>
                <select 
                  value={gameType}
                  onChange={(e) => setGameType(e.target.value as any)}
                  style={{ width: '100%', padding: '10px', background: 'var(--bg-tertiary)', border: 'var(--border-glass)', borderRadius: '8px', color: 'white', fontSize: '0.9rem' }}
                >
                  <option value="bau_cua">🎰 Bầu Cua</option>
                  <option value="do_den">🃏 Đỏ Đen</option>
                  <option value="xi_jack">💳 Xì Jack</option>
                </select>
              </div>

              {/* Min Bet */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--color-text-secondary)' }}>Cược tối thiểu (Min Bet)</label>
                <input 
                  type="number" 
                  min={10} 
                  max={1000} 
                  value={minBet}
                  onChange={(e) => setMinBet(parseInt(e.target.value) || 10)}
                  required
                />
              </div>

              {/* Max Bet */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--color-text-secondary)' }}>Cược tối đa (Max Bet)</label>
                <input 
                  type="number" 
                  min={minBet} 
                  max={10000} 
                  value={maxBet}
                  onChange={(e) => setMaxBet(parseInt(e.target.value) || 500)}
                  required
                />
              </div>

              {/* Visibility Switch */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.02)', padding: '10px 14px', borderRadius: '10px', border: 'var(--border-glass)' }}>
                <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>Hiển thị công khai</span>
                <input 
                  type="checkbox" 
                  checked={isPublic}
                  onChange={(e) => setIsPublic(e.target.checked)}
                  style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                />
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                <button type="button" onClick={() => setShowCreateModal(false)} className="btn btn-secondary" style={{ flex: 1 }}>
                  Hủy
                </button>
                <button type="submit" disabled={loading} className="btn btn-primary" style={{ flex: 1 }}>
                  {loading ? 'Đang tạo...' : 'Tạo phòng'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
