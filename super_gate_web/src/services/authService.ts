import { supabase } from './supabaseClient';

export interface PlayerModel {
  id: string;
  displayName: string;
  coinBalance: number;
  isNewPlayer: boolean;
  freeLuckyBoxes: number;
  streakDay: number;
  streakLastClaimDate: string | null;
  shieldCount: number;
  boosterExpiryAt: string | null;
  gamesPlayedToday: string[];
  gamesPlayedDate: string | null;
  mission3CollectedDate: string | null;
  mission5CollectedDate: string | null;
  totalGamesPlayed: number;
  createdAt: string;
}

export class AuthService {
  private static player: PlayerModel | null = null;
  private static listeners: ((player: PlayerModel | null) => void)[] = [];

  static subscribe(listener: (player: PlayerModel | null) => void) {
    this.listeners.push(listener);
    listener(this.player);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  private static notify() {
    this.listeners.forEach((listener) => listener(this.player));
  }

  static getPlayer() {
    return this.player;
  }

  static setPlayer(updated: PlayerModel | null) {
    this.player = updated;
    this.notify();
  }

  static async tryRestoreSession(): Promise<PlayerModel | null> {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return null;

      const player = await this.loadOrCreatePlayer(session.user.id);
      this.setPlayer(player);
      return player;
    } catch (e) {
      console.error('[AuthService] tryRestoreSession error:', e);
      return null;
    }
  }

  static async signUp(email: string, password: string, displayName: string): Promise<PlayerModel> {
    const { data: res, error } = await supabase.auth.signUp({ email, password });
    if (error || !res.user) throw error || new Error('Đăng ký thất bại');

    const player = await this.createPlayer(res.user.id, displayName);
    this.setPlayer(player);
    return player;
  }

  static async signIn(email: string, password: string): Promise<PlayerModel> {
    const { data: res, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error || !res.user) throw error || new Error('Đăng nhập thất bại');

    const player = await this.loadOrCreatePlayer(res.user.id);
    this.setPlayer(player);
    return player;
  }

  static async signOut(): Promise<void> {
    await supabase.auth.signOut();
    this.setPlayer(null);
  }

  static async resetPassword(email: string): Promise<void> {
    const { error } = await supabase.auth.resetPasswordForEmail(email);
    if (error) throw error;
  }

  private static async loadOrCreatePlayer(userId: string): Promise<PlayerModel> {
    const { data } = await supabase
      .from('players')
      .select('*')
      .eq('id', userId)
      .maybeSingle();

    if (data) {
      return this.mapFromDb(data);
    }
    return await this.createPlayer(userId, 'Khách');
  }

  private static async createPlayer(userId: string, displayName: string): Promise<PlayerModel> {
    const newPlayer = {
      id: userId,
      display_name: displayName,
      coin_balance: 500,
      is_new_player: true,
      free_lucky_boxes: 3,
      streak_day: 0,
      streak_last_claim_date: null,
      shield_count: 0,
      booster_expiry_at: null,
      games_played_today: [],
      games_played_date: null,
      mission3_collected_date: null,
      mission5_collected_date: null,
      total_games_played: 0,
    };

    const { error } = await supabase.from('players').upsert(newPlayer);
    if (error) console.error('[AuthService] createPlayer error:', error);

    return {
      id: userId,
      displayName,
      coinBalance: 500,
      isNewPlayer: true,
      freeLuckyBoxes: 3,
      streakDay: 0,
      streakLastClaimDate: null,
      shieldCount: 0,
      boosterExpiryAt: null,
      gamesPlayedToday: [],
      gamesPlayedDate: null,
      mission3CollectedDate: null,
      mission5CollectedDate: null,
      totalGamesPlayed: 0,
      createdAt: new Date().toISOString(),
    };
  }

  static async updateDisplayName(name: string): Promise<void> {
    if (!this.player) return;
    const { error } = await supabase
      .from('players')
      .update({ display_name: name })
      .eq('id', this.player.id);

    if (error) throw error;

    this.setPlayer({
      ...this.player,
      displayName: name,
    });
  }

  static async completeOnboarding(): Promise<void> {
    if (!this.player) return;
    const { error } = await supabase
      .from('players')
      .update({ is_new_player: false })
      .eq('id', this.player.id);

    if (error) console.error('[AuthService] completeOnboarding error:', error);

    this.setPlayer({
      ...this.player,
      isNewPlayer: false,
    });
  }

  static async syncCoinData(syncData: Partial<PlayerModel>): Promise<void> {
    if (!this.player) return;
    const dbData: Record<string, any> = {};
    if (syncData.coinBalance !== undefined) dbData.coin_balance = syncData.coinBalance;
    if (syncData.freeLuckyBoxes !== undefined) dbData.free_lucky_boxes = syncData.freeLuckyBoxes;
    if (syncData.streakDay !== undefined) dbData.streak_day = syncData.streakDay;
    if (syncData.streakLastClaimDate !== undefined) dbData.streak_last_claim_date = syncData.streakLastClaimDate;
    if (syncData.shieldCount !== undefined) dbData.shield_count = syncData.shieldCount;
    if (syncData.boosterExpiryAt !== undefined) dbData.booster_expiry_at = syncData.boosterExpiryAt;
    if (syncData.gamesPlayedToday !== undefined) dbData.games_played_today = syncData.gamesPlayedToday;
    if (syncData.gamesPlayedDate !== undefined) dbData.games_played_date = syncData.gamesPlayedDate;
    if (syncData.mission3CollectedDate !== undefined) dbData.mission3_collected_date = syncData.mission3CollectedDate;
    if (syncData.mission5CollectedDate !== undefined) dbData.mission5_collected_date = syncData.mission5CollectedDate;
    if (syncData.totalGamesPlayed !== undefined) dbData.total_games_played = syncData.totalGamesPlayed;

    const { error } = await supabase
      .from('players')
      .update(dbData)
      .eq('id', this.player.id);

    if (error) console.error('[AuthService] syncCoinData error:', error);
  }

  private static mapFromDb(row: any): PlayerModel {
    return {
      id: row.id,
      displayName: row.display_name ?? 'Khách',
      coinBalance: row.coin_balance ?? 500,
      isNewPlayer: row.is_new_player ?? true,
      freeLuckyBoxes: row.free_lucky_boxes ?? 3,
      streakDay: row.streak_day ?? 0,
      streakLastClaimDate: row.streak_last_claim_date,
      shieldCount: row.shield_count ?? 0,
      boosterExpiryAt: row.booster_expiry_at,
      gamesPlayedToday: row.games_played_today ?? [],
      gamesPlayedDate: row.games_played_date,
      mission3CollectedDate: row.mission3_collected_date,
      mission5CollectedDate: row.mission5_collected_date,
      totalGamesPlayed: row.total_games_played ?? 0,
      createdAt: row.created_at ?? new Date().toISOString(),
    };
  }
}
