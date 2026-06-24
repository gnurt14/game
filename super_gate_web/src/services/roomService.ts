import { supabase } from './supabaseClient';
import { AuthService } from './authService';
import { CoinService } from './coinService';

export interface GameRoom {
  id: string;
  roomCode: string;
  gameType: 'bau_cua' | 'do_den' | 'xi_jack';
  hostId: string;
  status: 'waiting' | 'betting' | 'rolling' | 'finished';
  isPublic: boolean;
  maxPlayers: number;
  minBet: number;
  maxBet: number;
  roundNumber: number;
  gameState: any | null;
  expiresAt: string;
  updatedAt: string;
}

export interface RoomPlayer {
  roomId: string;
  playerId: string;
  displayName: string;
  betAmount: number;
  betChoice: string | null;
  resultDelta: number;
  totalDelta: number;
  xiJackResult: 'win' | 'lose' | 'push' | 'blackjack' | null;
  isReady: boolean;
  joinedAt: string;
}

// ── Xi Jack helpers ──────────────────────────────────────────────────────────

export function buildXjDeck(seed: number): string[] {
  const suits = ['♥', '♦', '♠', '♣'];
  const ranks = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
  const deck: string[] = [];
  for (const s of suits) {
    for (const r of ranks) {
      deck.push(`${r}${s}`);
    }
  }
  // Simple LCG pseudo-random shuffle
  let currentSeed = seed;
  const nextRandom = () => {
    currentSeed = (currentSeed * 9301 + 49297) % 233280;
    return currentSeed / 233280;
  };
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(nextRandom() * (i + 1));
    const temp = deck[i];
    deck[i] = deck[j];
    deck[j] = temp;
  }
  return deck;
}

export function xjHandValue(cards: string[]): number {
  let total = 0;
  let aces = 0;
  for (const c of cards) {
    const rank = c.substring(0, c.length - 1);
    if (['J', 'Q', 'K'].includes(rank)) {
      total += 10;
    } else if (rank === 'A') {
      total += 11;
      aces++;
    } else {
      total += parseInt(rank) || 0;
    }
  }
  while (total > 21 && aces > 0) {
    total -= 10;
    aces--;
  }
  return total;
}

export class RoomService {
  private static currentRoom: GameRoom | null = null;
  private static players: RoomPlayer[] = [];

  private static roomChannel: any = null;
  private static playersChannel: any = null;
  private static pollInterval: any = null;

  private static roomListeners: ((room: GameRoom | null) => void)[] = [];
  private static playersListeners: ((players: RoomPlayer[]) => void)[] = [];

  // Subscriptions

  static subscribeRoom(listener: (room: GameRoom | null) => void) {
    this.roomListeners.push(listener);
    listener(this.currentRoom);
    return () => {
      this.roomListeners = this.roomListeners.filter((l) => l !== listener);
    };
  }

  static subscribePlayers(listener: (players: RoomPlayer[]) => void) {
    this.playersListeners.push(listener);
    listener([...this.players]);
    return () => {
      this.playersListeners = this.playersListeners.filter((l) => l !== listener);
    };
  }

  private static notifyRoom() {
    this.roomListeners.forEach((l) => l(this.currentRoom));
  }

  private static notifyPlayers() {
    this.playersListeners.forEach((l) => l([...this.players]));
  }

  static getCurrentRoom() {
    return this.currentRoom;
  }

  static getPlayers() {
    return this.players;
  }

  static getMyId() {
    return AuthService.getPlayer()?.id || null;
  }

  static isHost() {
    return this.currentRoom?.hostId === this.getMyId();
  }

  static getMyPlayerRecord() {
    const myId = this.getMyId();
    return this.players.find((p) => p.playerId === myId) || null;
  }

  // ── Create Room ────────────────────────────────────────────────────────────

  static async createRoom(
    gameType: 'bau_cua' | 'do_den' | 'xi_jack',
    isPublic: boolean,
    minBet = 10,
    maxBet = 500
  ): Promise<GameRoom> {
    const uid = this.getMyId();
    if (!uid) throw new Error('Yêu cầu đăng nhập');

    const code = await this.generateCode();

    const { data: row, error } = await supabase
      .from('game_rooms')
      .insert({
        room_code: code,
        game_type: gameType,
        host_id: uid,
        is_public: isPublic,
        min_bet: minBet,
        max_bet: maxBet,
        status: 'waiting',
      })
      .select()
      .single();

    if (error || !row) throw error || new Error('Tạo phòng thất bại');

    this.currentRoom = this.mapRoomFromDb(row);
    await this.joinAsPlayer();
    await this.subscribe();
    return this.currentRoom;
  }

  // ── Join Room ──────────────────────────────────────────────────────────────

  static async joinByCode(code: string): Promise<GameRoom> {
    const { data: row, error } = await supabase
      .from('game_rooms')
      .select('*')
      .eq('room_code', code.toUpperCase())
      .neq('status', 'finished')
      .maybeSingle();

    if (error || !row) throw error || new Error(`Không tìm thấy phòng: ${code}`);

    this.currentRoom = this.mapRoomFromDb(row);
    await this.joinAsPlayer();
    await this.subscribe();
    return this.currentRoom;
  }

  // ── Browse public rooms ────────────────────────────────────────────────────

  static async getPublicRooms(gameType?: string): Promise<GameRoom[]> {
    let query = supabase
      .from('game_rooms')
      .select('*')
      .eq('is_public', true)
      .eq('status', 'waiting');

    if (gameType) {
      query = query.eq('game_type', gameType);
    }

    const { data, error } = await query.order('created_at', { ascending: false }).limit(30);
    if (error) throw error;

    return data.map((r: any) => this.mapRoomFromDb(r));
  }

  // ── Place Bet ──────────────────────────────────────────────────────────────

  static async placeBet(amount: number, choice: string): Promise<void> {
    const myId = this.getMyId();
    if (!this.currentRoom || !myId) return;
    if (this.currentRoom.status !== 'betting') return;

    const ok = await CoinService.spendCoins(amount);
    if (!ok) throw new Error('Không đủ xu');

    const { error } = await supabase
      .from('room_players')
      .update({
        bet_amount: amount,
        bet_choice: choice,
        is_ready: true,
      })
      .eq('room_id', this.currentRoom.id)
      .eq('player_id', myId);

    if (error) throw error;
    await this.refreshPlayers();
  }

  // ── Host: open betting ─────────────────────────────────────────────────────

  static async openBetting(): Promise<void> {
    if (!this.isHost() || !this.currentRoom) return;

    const myId = this.getMyId();
    if (!myId) return;

    const nextRound = this.currentRoom.roundNumber + 1;

    // Reset status phòng
    await supabase
      .from('game_rooms')
      .update({
        status: 'betting',
        round_number: nextRound,
      })
      .eq('id', this.currentRoom.id);

    // Reset cược của tất cả (client tự reset row của mình thông qua RLS)
    await supabase
      .from('room_players')
      .update({
        bet_amount: 0,
        bet_choice: null,
        result_delta: 0,
        is_ready: false,
      })
      .eq('room_id', this.currentRoom.id)
      .eq('player_id', myId);

    await this.refreshRoom();
    await this.refreshPlayers();
  }

  // ── Host: reveal result ────────────────────────────────────────────────────

  static async rollResult(): Promise<void> {
    if (!this.isHost() || !this.currentRoom) return;

    let gameState: any = {};
    if (this.currentRoom.gameType === 'bau_cua') {
      gameState = {
        dice: [
          Math.floor(Math.random() * 6),
          Math.floor(Math.random() * 6),
          Math.floor(Math.random() * 6),
        ],
      };
    } else if (this.currentRoom.gameType === 'do_den') {
      const suits = ['hearts', 'diamonds', 'clubs', 'spades'];
      const ranks = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
      const suit = suits[Math.floor(Math.random() * suits.length)];
      const rank = ranks[Math.floor(Math.random() * ranks.length)];
      const isRed = suit === 'hearts' || suit === 'diamonds';
      gameState = {
        card: { suit, rank, isRed },
      };
    }

    await supabase
      .from('game_rooms')
      .update({
        status: 'rolling',
        game_state: gameState,
      })
      .eq('id', this.currentRoom.id);

    await this.refreshRoom();
  }

  // ── Client: settle bet ─────────────────────────────────────────────────────

  static async settleMyBet(): Promise<void> {
    const myId = this.getMyId();
    if (!this.currentRoom || !myId) return;

    if (!this.currentRoom.gameState) {
      await this.refreshRoom();
    }
    if (!this.currentRoom || !this.currentRoom.gameState) return;

    const { data: myRow } = await supabase
      .from('room_players')
      .select('*')
      .eq('room_id', this.currentRoom.id)
      .eq('player_id', myId)
      .maybeSingle();

    if (!myRow) return;

    const me = this.mapPlayerFromDb(myRow);
    if (me.betAmount === 0 || me.betChoice === null) return; // Đã cược hoặc không tham gia

    let delta = 0;
    if (this.currentRoom.gameType === 'bau_cua') {
      const dice = this.currentRoom.gameState.dice as number[];
      const choice = parseInt(me.betChoice);
      const matches = dice.filter((d) => d === choice).length;
      delta = matches > 0 ? me.betAmount * matches : -me.betAmount;
    } else if (this.currentRoom.gameType === 'do_den') {
      const isRed = this.currentRoom.gameState.card.isRed as boolean;
      const betRed = me.betChoice === 'red';
      delta = betRed === isRed ? me.betAmount : -me.betAmount;
    } else {
      return; // Xì Jack được settle riêng
    }

    await supabase
      .from('room_players')
      .update({
        result_delta: delta,
        total_delta: me.totalDelta + delta,
        bet_amount: 0,
        bet_choice: null,
        is_ready: true,
      })
      .eq('room_id', this.currentRoom.id)
      .eq('player_id', myId);

    if (delta > 0) {
      await CoinService.earnCoins(me.betAmount + delta);
    }

    await this.refreshPlayers();
  }

  // ── Xì Jack Multiplayer ────────────────────────────────────────────────────

  static async xiJackReady(betAmount: number): Promise<void> {
    const myId = this.getMyId();
    if (!this.currentRoom || !myId) return;

    const ok = await CoinService.spendCoins(betAmount);
    if (!ok) throw new Error('Không đủ xu');

    await supabase
      .from('room_players')
      .update({
        bet_amount: betAmount,
        bet_choice: null,
        xi_jack_result: null,
        result_delta: 0,
        is_ready: true,
      })
      .eq('room_id', this.currentRoom.id)
      .eq('player_id', myId);

    await this.refreshPlayers();
  }

  static async xiJackUnready(): Promise<void> {
    const myId = this.getMyId();
    const me = this.getMyPlayerRecord();
    if (!this.currentRoom || !myId || !me) return;

    if (me.betAmount > 0) {
      await CoinService.earnCoins(me.betAmount); // Hoàn cược
    }

    await supabase
      .from('room_players')
      .update({
        bet_amount: 0,
        is_ready: false,
      })
      .eq('room_id', this.currentRoom.id)
      .eq('player_id', myId);

    await this.refreshPlayers();
  }

  static async startXiJackCountdown(): Promise<void> {
    if (!this.isHost() || !this.currentRoom || this.currentRoom.status !== 'waiting') return;

    const gs = {
      phase: 'countdown',
      deck: [],
      deck_ptr: 0,
      player_hands: {},
      player_actions: {},
      countdown_at: new Date().toISOString(),
    };

    await supabase
      .from('game_rooms')
      .update({
        status: 'betting',
        game_state: gs,
        round_number: this.currentRoom.roundNumber + 1,
      })
      .eq('id', this.currentRoom.id);

    await this.refreshRoom();

    setTimeout(() => {
      if (this.currentRoom?.status === 'betting') {
        this.xiJackDeal();
      }
    }, 5000);
  }

  static async xiJackDeal(): Promise<void> {
    if (!this.isHost() || !this.currentRoom || this.currentRoom.status !== 'betting') return;

    const playerIds = this.players.map((p) => p.playerId);
    const N = playerIds.length;
    const seed = Math.floor(Math.random() * 1000000);
    const deck = buildXjDeck(seed);

    const playerHands: Record<string, string[]> = {};
    const playerActions: Record<string, string | null> = {};

    for (let i = 0; i < N; i++) {
      const uid = playerIds[i];
      playerHands[uid] = [deck[2 + i * 2], deck[3 + i * 2]];
      playerActions[uid] = xjHandValue(playerHands[uid]) === 21 ? 'blackjack' : null;
    }

    const gs = {
      phase: 'playing',
      deck,
      deck_ptr: 2 + N * 2,
      dealer_visible: deck[0],
      dealer_hole: deck[1],
      player_hands: playerHands,
      player_actions: playerActions,
    };

    await supabase
      .from('game_rooms')
      .update({
        status: 'rolling',
        game_state: gs,
      })
      .eq('id', this.currentRoom.id);

    await this.refreshRoom();
  }

  static async xiJackRequestHit(expectedHandSize: number): Promise<void> {
    const myId = this.getMyId();
    if (!this.currentRoom || !myId) return;

    await supabase
      .from('room_players')
      .update({
        bet_choice: `hit:${expectedHandSize}`,
      })
      .eq('room_id', this.currentRoom.id)
      .eq('player_id', myId);

    await this.refreshPlayers();
  }

  static async xiJackRequestStand(): Promise<void> {
    const myId = this.getMyId();
    if (!this.currentRoom || !myId) return;

    await supabase
      .from('room_players')
      .update({
        bet_choice: 'stand',
      })
      .eq('room_id', this.currentRoom.id)
      .eq('player_id', myId);

    await this.refreshPlayers();
  }

  static async xiJackClearAction(): Promise<void> {
    const myId = this.getMyId();
    if (!this.currentRoom || !myId) return;

    await supabase
      .from('room_players')
      .update({
        bet_choice: null,
      })
      .eq('room_id', this.currentRoom.id)
      .eq('player_id', myId);
  }

  static async processXiJackActions(): Promise<void> {
    if (!this.isHost() || !this.currentRoom || this.currentRoom.status !== 'rolling') return;
    const gsJson = this.currentRoom.gameState;
    if (!gsJson || gsJson.phase !== 'playing') return;

    const deck = gsJson.deck as string[];
    let deckPtr = gsJson.deck_ptr as number;
    const playerHands = { ...gsJson.player_hands };
    const playerActions = { ...gsJson.player_actions };
    let changed = false;

    for (const p of this.players) {
      const uid = p.playerId;
      if (playerActions[uid] === undefined || playerActions[uid] !== null) continue;

      const choice = p.betChoice || '';
      if (choice.startsWith('hit:')) {
        const expected = parseInt(choice.split(':')[1]) || 0;
        const hand = playerHands[uid] || [];
        if (hand.length === expected - 1 && deckPtr < deck.length) {
          const newCard = deck[deckPtr++];
          playerHands[uid] = [...hand, newCard];
          if (xjHandValue(playerHands[uid]) > 21) {
            playerActions[uid] = 'bust';
          }
          changed = true;
        }
      } else if (choice === 'stand') {
        playerActions[uid] = 'stand';
        changed = true;
      }
    }

    const allActed = Object.values(playerActions).every((a) => a !== null);

    let nextGs = {
      ...gsJson,
      deck_ptr: deckPtr,
      player_hands: playerHands,
      player_actions: playerActions,
    };

    if (allActed) {
      const dVisible = gsJson.dealer_visible;
      const dHole = gsJson.dealer_hole;
      const dealerHand = [dVisible, dHole];
      while (xjHandValue(dealerHand) < 17 && deckPtr < deck.length) {
        dealerHand.push(deck[deckPtr++]);
      }
      nextGs = {
        ...nextGs,
        phase: 'revealing',
        deck_ptr: deckPtr,
        dealer_final: dealerHand,
      };
      changed = true;
    }

    if (changed) {
      await supabase
        .from('game_rooms')
        .update({
          game_state: nextGs,
        })
        .eq('id', this.currentRoom.id);
      await this.refreshRoom();
    }
  }

  static async settleXiJack(): Promise<void> {
    const myId = this.getMyId();
    if (!this.currentRoom || !myId) return;
    const gs = this.currentRoom.gameState;
    if (!gs || gs.phase !== 'revealing') return;
    const me = this.getMyPlayerRecord();
    if (!me || me.betAmount === 0) return;

    const myHand = gs.player_hands[myId] || [];
    const myAction = gs.player_actions[myId];
    const dealerFinal = gs.dealer_final || [];

    const myVal = xjHandValue(myHand);
    const dVal = xjHandValue(dealerFinal);

    let result: 'win' | 'lose' | 'push' | 'blackjack' = 'lose';
    if (myAction === 'bust') {
      result = 'lose';
    } else if (myAction === 'blackjack') {
      result = 'blackjack';
    } else if (dVal > 21 || myVal > dVal) {
      result = 'win';
    } else if (myVal === dVal) {
      result = 'push';
    } else {
      result = 'lose';
    }

    let delta = 0;
    if (result === 'blackjack') delta = Math.round(me.betAmount * 1.5);
    else if (result === 'win') delta = me.betAmount;
    else if (result === 'push') delta = 0;
    else delta = -me.betAmount;

    await supabase
      .from('room_players')
      .update({
        xi_jack_result: result,
        result_delta: delta,
        total_delta: me.totalDelta + delta,
        bet_amount: 0,
        bet_choice: null,
        is_ready: true,
      })
      .eq('room_id', this.currentRoom.id)
      .eq('player_id', myId);

    if (delta >= 0) {
      await CoinService.earnCoins(me.betAmount + delta);
    }
    await this.refreshPlayers();
  }

  static async resetMyPlayerRow(): Promise<void> {
    const myId = this.getMyId();
    if (!this.currentRoom || !myId) return;

    await supabase
      .from('room_players')
      .update({
        bet_amount: 0,
        bet_choice: null,
        xi_jack_result: null,
        result_delta: 0,
        is_ready: false,
      })
      .eq('room_id', this.currentRoom.id)
      .eq('player_id', myId);

    await this.refreshPlayers();
  }

  static async resetXiJackRound(): Promise<void> {
    if (!this.isHost() || !this.currentRoom) return;

    const myId = this.getMyId();
    if (!myId) return;

    await supabase
      .from('room_players')
      .update({
        bet_amount: 0,
        bet_choice: null,
        xi_jack_result: null,
        result_delta: 0,
        is_ready: false,
      })
      .eq('room_id', this.currentRoom.id)
      .eq('player_id', myId);

    await supabase
      .from('game_rooms')
      .update({
        status: 'waiting',
        game_state: null,
      })
      .eq('id', this.currentRoom.id);

    await this.refreshRoom();
    await this.refreshPlayers();
  }

  // ── Leave Room ─────────────────────────────────────────────────────────────

  static async leaveRoom(): Promise<void> {
    const myId = this.getMyId();
    if (!this.currentRoom || !myId) return;

    this.unsubscribe();

    await supabase
      .from('room_players')
      .delete()
      .eq('room_id', this.currentRoom.id)
      .eq('player_id', myId);

    if (this.isHost()) {
      await supabase
        .from('game_rooms')
        .update({ status: 'finished' })
        .eq('id', this.currentRoom.id);
    }

    this.currentRoom = null;
    this.players = [];
    this.notifyRoom();
    this.notifyPlayers();
  }

  // ── Private Subscription Helpers ───────────────────────────────────────────

  private static async joinAsPlayer(): Promise<void> {
    const uid = this.getMyId();
    if (!this.currentRoom || !uid) return;

    const displayName = AuthService.getPlayer()?.displayName || 'Khách';

    await supabase.from('room_players').upsert({
      room_id: this.currentRoom.id,
      player_id: uid,
      display_name: displayName,
    });
  }

  private static async subscribe(): Promise<void> {
    this.unsubscribe();

    const roomId = this.currentRoom!.id;

    // Realtime channel room
    this.roomChannel = supabase
      .channel(`room:${roomId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'game_rooms',
          filter: `id=eq.${roomId}`,
        },
        (payload: any) => {
          this.currentRoom = this.mapRoomFromDb(payload.new);
          this.notifyRoom();
        }
      )
      .subscribe();

    // Realtime channel players
    this.playersChannel = supabase
      .channel(`players:${roomId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'room_players',
          filter: `room_id=eq.${roomId}`,
        },
        () => {
          this.refreshPlayers();
        }
      )
      .subscribe();

    // Polling fallback (3s)
    this.pollInterval = setInterval(async () => {
      await this.refreshRoom();
      await this.refreshPlayers();
    }, 3000);

    // Initial load
    await this.refreshRoom();
    await this.refreshPlayers();
  }

  private static async refreshRoom(): Promise<void> {
    if (!this.currentRoom) return;
    try {
      const { data } = await supabase
        .from('game_rooms')
        .select('*')
        .eq('id', this.currentRoom.id)
        .maybeSingle();

      if (data) {
        this.currentRoom = this.mapRoomFromDb(data);
        this.notifyRoom();
      }
    } catch (e) {
      console.error('[RoomService] refreshRoom error:', e);
    }
  }

  private static async refreshPlayers(): Promise<void> {
    if (!this.currentRoom) return;
    try {
      const { data } = await supabase
        .from('room_players')
        .select('*')
        .eq('room_id', this.currentRoom.id)
        .order('joined_at');

      if (data) {
        this.players = data.map((p: any) => this.mapPlayerFromDb(p));
        this.notifyPlayers();
        
        // Auto check host features for Xì Jack
        if (this.currentRoom.gameType === 'xi_jack' && this.isHost()) {
          this.checkXiJackAutoStart();
          if (this.currentRoom.status === 'rolling') {
            await this.processXiJackActions();
          }
        }
      }
    } catch (e) {
      console.error('[RoomService] refreshPlayers error:', e);
    }
  }

  private static checkXiJackAutoStart() {
    if (!this.isHost() || !this.currentRoom || this.currentRoom.status !== 'waiting') return;
    if (this.players.length === 0) return;
    const allReady = this.players.every((p) => p.isReady);
    if (allReady) {
      this.startXiJackCountdown();
    }
  }

  private static unsubscribe() {
    if (this.pollInterval) clearInterval(this.pollInterval);
    if (this.roomChannel) supabase.removeChannel(this.roomChannel);
    if (this.playersChannel) supabase.removeChannel(this.playersChannel);

    this.pollInterval = null;
    this.roomChannel = null;
    this.playersChannel = null;
  }

  private static async generateCode(): Promise<string> {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    while (true) {
      let code = '';
      for (let i = 0; i < 6; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      const { data } = await supabase
        .from('game_rooms')
        .select('id')
        .eq('room_code', code)
        .maybeSingle();

      if (!data) return code;
    }
  }

  // ── Database mappers ───────────────────────────────────────────────────────

  private static mapRoomFromDb(row: any): GameRoom {
    return {
      id: row.id,
      roomCode: row.room_code,
      gameType: row.game_type,
      hostId: row.host_id,
      status: row.status,
      isPublic: row.is_public ?? true,
      maxPlayers: row.max_players ?? 8,
      minBet: row.min_bet ?? 10,
      maxBet: row.max_bet ?? 500,
      roundNumber: row.round_number ?? 0,
      gameState: row.game_state,
      expiresAt: row.expires_at,
      updatedAt: row.updated_at,
    };
  }

  private static mapPlayerFromDb(row: any): RoomPlayer {
    return {
      roomId: row.room_id,
      playerId: row.player_id,
      displayName: row.display_name,
      betAmount: row.bet_amount ?? 0,
      betChoice: row.bet_choice,
      resultDelta: row.result_delta ?? 0,
      totalDelta: row.total_delta ?? 0,
      xiJackResult: row.xi_jack_result,
      isReady: row.is_ready ?? false,
      joinedAt: row.joined_at,
    };
  }
}
