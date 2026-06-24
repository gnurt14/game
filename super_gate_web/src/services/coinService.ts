import { AuthService, PlayerModel } from './authService';

export interface CoinData {
  balance: number;
  streakDay: number;
  shieldCount: number;
  boosterActive: boolean;
  boosterExpiry: string | null;
  gamesPlayedToday: string[];
  mission3Collected: boolean;
  mission5Collected: boolean;
  dailyClaimedToday: boolean;
  freeLuckyBoxes: number;
  totalGamesPlayed: number;
  ownedFrames: string[];
  activeFrame: string;
  lastWheelSpinDate: string;
}

export interface DailyRewardInfo {
  shouldShow: boolean;
  todayStreakDay: number;
  streakWasReset: boolean;
  shieldWillBeUsed: boolean;
  baseReward: number;
  boosterActive: boolean;
  actualReward: number;
}

export interface MissionStatus {
  gamesPlayedCount: number;
  mission3Collected: boolean;
  mission5Collected: boolean;
  mission3Eligible: boolean;
  mission5Eligible: boolean;
  allDone: boolean;
}

export class CoinService {
  private static listeners: ((data: CoinData) => void)[] = [];
  private static syncTimeout: any = null;
  private static crossTabBound = false;

  // Local storage keys
  private static readonly KEYS = {
    balance: 'coin_balance',
    streakDay: 'coin_streak_day',
    lastClaimDate: 'coin_streak_last_claim_date',
    shieldCount: 'coin_shield_count',
    boosterExpiry: 'coin_booster_expiry_ms',
    gamesPlayed: 'coin_games_played_today',
    gamesDate: 'coin_games_played_date',
    mission3Date: 'coin_mission3_collected_date',
    mission5Date: 'coin_mission5_collected_date',
    freeLuckyBoxes: 'coin_free_lucky_boxes',
    totalGamesPlayed: 'coin_total_games_played',
    ownedFrames: 'coin_owned_avatar_frames',
    activeFrame: 'coin_active_avatar_frame',
    lastWheelSpinDate: 'coin_last_wheel_spin_date',
  };

  static async init(options?: { isNewPlayer?: boolean }): Promise<void> {
    const today = this.getTodayStr();
    
    if (options?.isNewPlayer) {
      localStorage.setItem(this.KEYS.balance, '500');
      localStorage.setItem(this.KEYS.freeLuckyBoxes, '3');
      localStorage.setItem(this.KEYS.streakDay, '0');
      localStorage.setItem(this.KEYS.shieldCount, '0');
      localStorage.setItem(this.KEYS.totalGamesPlayed, '0');
      localStorage.setItem(this.KEYS.gamesDate, today);
      localStorage.setItem(this.KEYS.gamesPlayed, JSON.stringify([]));
      localStorage.setItem(this.KEYS.ownedFrames, JSON.stringify(['none']));
      localStorage.setItem(this.KEYS.activeFrame, 'none');
      localStorage.setItem(this.KEYS.lastWheelSpinDate, '');
    }

    const savedDate = localStorage.getItem(this.KEYS.gamesDate) || '';
    if (savedDate !== today) {
      localStorage.setItem(this.KEYS.gamesDate, today);
      localStorage.setItem(this.KEYS.gamesPlayed, JSON.stringify([]));
    }

    this.bindCrossTabSync();
    this.notify();
  }

  /**
   * Đồng bộ realtime giữa các tab: lắng nghe StorageEvent —
   * khi tab khác update bất kỳ key nào của CoinService thì notify subscribers
   * để UI re-render với dữ liệu mới. Chỉ bind 1 lần / lifetime.
   */
  private static bindCrossTabSync(): void {
    if (this.crossTabBound) return;
    if (typeof window === 'undefined') return;

    const watchedKeys = new Set(Object.values(this.KEYS));
    window.addEventListener('storage', (e) => {
      // e.key === null khi localStorage.clear() được gọi
      if (e.key === null || watchedKeys.has(e.key)) {
        this.notify();
      }
    });
    this.crossTabBound = true;
  }

  static subscribe(listener: (data: CoinData) => void) {
    this.listeners.push(listener);
    listener(this.getData());
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  private static notify() {
    const data = this.getData();
    this.listeners.forEach((listener) => listener(data));
  }

  private static getTodayStr(): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  static isBoosterActive(): boolean {
    const expiry = this.getBoosterExpiry();
    if (!expiry) return false;
    return new Date(expiry).getTime() > Date.now();
  }

  private static getBoosterExpiry(): string | null {
    const player = AuthService.getPlayer();
    if (player) return player.boosterExpiryAt;
    const ms = localStorage.getItem(this.KEYS.boosterExpiry);
    return ms ? new Date(parseInt(ms)).toISOString() : null;
  }

  static getStreakMultiplier(streak: number): number {
    if (streak >= 7) return 2.0;
    if (streak >= 5) return 1.5;
    if (streak >= 3) return 1.2;
    return 1.0;
  }

  static getData(): CoinData {
    const player = AuthService.getPlayer();
    const today = this.getTodayStr();

    if (player) {
      // Dữ liệu từ supabase
      const boosterActive = player.boosterExpiryAt ? new Date(player.boosterExpiryAt).getTime() > Date.now() : false;
      
      let owned: string[] = ['none'];
      try {
        owned = JSON.parse(localStorage.getItem(this.KEYS.ownedFrames) || '["none"]');
      } catch (_) {}

      return {
        balance: player.coinBalance,
        streakDay: player.streakDay,
        shieldCount: player.shieldCount,
        boosterActive,
        boosterExpiry: player.boosterExpiryAt,
        gamesPlayedToday: player.gamesPlayedToday,
        mission3Collected: player.mission3CollectedDate === today,
        mission5Collected: player.mission5CollectedDate === today,
        dailyClaimedToday: player.streakLastClaimDate === today,
        freeLuckyBoxes: player.freeLuckyBoxes,
        totalGamesPlayed: player.totalGamesPlayed,
        ownedFrames: owned,
        activeFrame: localStorage.getItem(this.KEYS.activeFrame) || 'none',
        lastWheelSpinDate: localStorage.getItem(this.KEYS.lastWheelSpinDate) || '',
      };
    }

    // Dữ liệu từ local storage fallback
    const balance = parseInt(localStorage.getItem(this.KEYS.balance) || '0');
    const streakDay = parseInt(localStorage.getItem(this.KEYS.streakDay) || '0');
    const shieldCount = parseInt(localStorage.getItem(this.KEYS.shieldCount) || '0');
    const boosterMs = parseInt(localStorage.getItem(this.KEYS.boosterExpiry) || '0');
    const boosterActive = boosterMs > Date.now();
    const boosterExpiry = boosterMs > 0 ? new Date(boosterMs).toISOString() : null;
    
    let gamesPlayedToday: string[] = [];
    const gamesPlayedDate = localStorage.getItem(this.KEYS.gamesDate) || '';
    if (gamesPlayedDate === today) {
      try {
        gamesPlayedToday = JSON.parse(localStorage.getItem(this.KEYS.gamesPlayed) || '[]');
      } catch (_) {}
    }

    const mission3Date = localStorage.getItem(this.KEYS.mission3Date) || '';
    const mission5Date = localStorage.getItem(this.KEYS.mission5Date) || '';
    const lastClaimDate = localStorage.getItem(this.KEYS.lastClaimDate) || '';
    const freeLuckyBoxes = parseInt(localStorage.getItem(this.KEYS.freeLuckyBoxes) || '0');
    const totalGamesPlayed = parseInt(localStorage.getItem(this.KEYS.totalGamesPlayed) || '0');
    
    let ownedFrames: string[] = ['none'];
    try {
      ownedFrames = JSON.parse(localStorage.getItem(this.KEYS.ownedFrames) || '["none"]');
    } catch (_) {}
    const activeFrame = localStorage.getItem(this.KEYS.activeFrame) || 'none';
    const lastWheelSpinDate = localStorage.getItem(this.KEYS.lastWheelSpinDate) || '';

    return {
      balance,
      streakDay,
      shieldCount,
      boosterActive,
      boosterExpiry,
      gamesPlayedToday,
      mission3Collected: mission3Date === today,
      mission5Collected: mission5Date === today,
      dailyClaimedToday: lastClaimDate === today,
      freeLuckyBoxes,
      totalGamesPlayed,
      ownedFrames,
      activeFrame,
      lastWheelSpinDate,
    };
  }

  static async spendCoins(amount: number): Promise<boolean> {
    const data = this.getData();
    if (data.balance < amount) return false;
    await this.addCoins(-amount);
    return true;
  }

  static async earnCoins(amount: number): Promise<void> {
    await this.addCoins(amount);
  }

  private static async addCoins(amount: number): Promise<void> {
    const player = AuthService.getPlayer();

    if (player) {
      const updatedBalance = Math.max(0, player.coinBalance + amount);
      const updated: PlayerModel = {
        ...player,
        coinBalance: updatedBalance,
      };
      AuthService.setPlayer(updated);
      this.notify();
      this.scheduleSync({ coinBalance: updatedBalance });
      return;
    }

    // Local state fallback
    const balance = parseInt(localStorage.getItem(this.KEYS.balance) || '0');
    const newBalance = Math.max(0, balance + amount);
    localStorage.setItem(this.KEYS.balance, String(newBalance));
    this.notify();
  }

  private static scheduleSync(syncData: Partial<PlayerModel>) {
    if (this.syncTimeout) clearTimeout(this.syncTimeout);
    this.syncTimeout = setTimeout(() => {
      AuthService.syncCoinData(syncData);
    }, 2000);
  }

  // ── Daily check-in ─────────────────────────────────────────────────────────

  static getDailyRewardInfo(): DailyRewardInfo {
    const data = this.getData();
    const today = this.getTodayStr();

    if (data.dailyClaimedToday) {
      return {
        shouldShow: false,
        todayStreakDay: data.streakDay,
        streakWasReset: false,
        shieldWillBeUsed: false,
        baseReward: 0,
        boosterActive: data.boosterActive,
        actualReward: 0,
      };
    }

    let gapDays = 99;
    const lastClaimDateStr = data.dailyClaimedToday ? today : (AuthService.getPlayer()?.streakLastClaimDate || localStorage.getItem(this.KEYS.lastClaimDate) || '');
    
    if (lastClaimDateStr) {
      const last = new Date(lastClaimDateStr);
      const now = new Date();
      // Reset hours to calculate pure day differences
      const todayDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const lastDate = new Date(last.getFullYear(), last.getMonth(), last.getDate());
      gapDays = Math.round((todayDate.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24));
    } else {
      gapDays = 0; // First check-in
    }

    let streakWasReset = false;
    let shieldWillBeUsed = false;
    let todayStreakDay = 1;

    if (gapDays === 0 || !lastClaimDateStr) {
      todayStreakDay = 1;
    } else if (gapDays === 1) {
      todayStreakDay = (data.streakDay % 7) + 1;
    } else if (gapDays === 2 && data.shieldCount > 0) {
      todayStreakDay = (data.streakDay % 7) + 1;
      shieldWillBeUsed = true;
    } else {
      todayStreakDay = 1;
      streakWasReset = data.streakDay > 0;
    }

    const rewardTable = [50, 75, 100, 125, 150, 200, 300];
    const baseReward = rewardTable[todayStreakDay - 1];
    const actualReward = baseReward * (data.boosterActive ? 2 : 1);

    return {
      shouldShow: true,
      todayStreakDay,
      streakWasReset,
      shieldWillBeUsed,
      baseReward,
      boosterActive: data.boosterActive,
      actualReward,
    };
  }

  static async claimDailyReward(): Promise<number> {
    const info = this.getDailyRewardInfo();
    if (!info.shouldShow) return 0;

    const today = this.getTodayStr();
    const player = AuthService.getPlayer();

    let newShieldCount = this.getData().shieldCount;
    if (info.shieldWillBeUsed) {
      newShieldCount = Math.max(0, newShieldCount - 1);
    }

    if (player) {
      const updated: PlayerModel = {
        ...player,
        streakDay: info.todayStreakDay,
        streakLastClaimDate: today,
        shieldCount: newShieldCount,
        coinBalance: player.coinBalance + info.actualReward,
      };
      AuthService.setPlayer(updated);
      this.notify();
      this.scheduleSync({
        streakDay: info.todayStreakDay,
        streakLastClaimDate: today,
        shieldCount: newShieldCount,
        coinBalance: player.coinBalance + info.actualReward,
      });
    } else {
      localStorage.setItem(this.KEYS.streakDay, String(info.todayStreakDay));
      localStorage.setItem(this.KEYS.lastClaimDate, today);
      localStorage.setItem(this.KEYS.shieldCount, String(newShieldCount));
      await this.addCoins(info.actualReward);
    }

    return info.actualReward;
  }

  // ── Game rewards ───────────────────────────────────────────────────────────

  static async recordGamePlayed(gameName: string): Promise<number> {
    const data = this.getData();
    const today = this.getTodayStr();
    const player = AuthService.getPlayer();

    const isFirst = !data.gamesPlayedToday.includes(gameName);
    const baseEarn = isFirst ? 15 : 5;

    const mult = (data.boosterActive ? 2.0 : 1.0) * this.getStreakMultiplier(data.streakDay);
    const earned = Math.round(baseEarn * mult);

    const updatedGames = [...data.gamesPlayedToday];
    if (!updatedGames.includes(gameName)) {
      updatedGames.push(gameName);
    }
    const newTotal = data.totalGamesPlayed + 1;

    // Check daily missions
    let mission3Date = player?.mission3CollectedDate || localStorage.getItem(this.KEYS.mission3Date) || '';
    let mission5Date = player?.mission5CollectedDate || localStorage.getItem(this.KEYS.mission5Date) || '';
    let extraEarn = 0;

    if (updatedGames.length >= 3 && mission3Date !== today) {
      mission3Date = today;
      extraEarn += 100;
    }
    if (updatedGames.length >= 5 && mission5Date !== today) {
      mission5Date = today;
      extraEarn += 150;
    }

    const finalEarn = earned + extraEarn;

    if (player) {
      const updated: PlayerModel = {
        ...player,
        coinBalance: player.coinBalance + finalEarn,
        gamesPlayedToday: updatedGames,
        gamesPlayedDate: today,
        totalGamesPlayed: newTotal,
        mission3CollectedDate: mission3Date || null,
        mission5CollectedDate: mission5Date || null,
      };
      AuthService.setPlayer(updated);
      this.notify();
      this.scheduleSync({
        coinBalance: player.coinBalance + finalEarn,
        gamesPlayedToday: updatedGames,
        gamesPlayedDate: today,
        totalGamesPlayed: newTotal,
        mission3CollectedDate: mission3Date || null,
        mission5CollectedDate: mission5Date || null,
      });
    } else {
      localStorage.setItem(this.KEYS.gamesPlayed, JSON.stringify(updatedGames));
      localStorage.setItem(this.KEYS.gamesDate, today);
      localStorage.setItem(this.KEYS.totalGamesPlayed, String(newTotal));
      if (mission3Date === today) localStorage.setItem(this.KEYS.mission3Date, today);
      if (mission5Date === today) localStorage.setItem(this.KEYS.mission5Date, today);
      await this.addCoins(finalEarn);
    }

    return finalEarn;
  }

  static getMissionStatus(): MissionStatus {
    const data = this.getData();
    const count = data.gamesPlayedToday.length;

    return {
      gamesPlayedCount: count,
      mission3Collected: data.mission3Collected,
      mission5Collected: data.mission5Collected,
      mission3Eligible: count >= 3 && !data.mission3Collected,
      mission5Eligible: count >= 5 && !data.mission5Collected,
      allDone: data.mission3Collected && data.mission5Collected,
    };
  }

  static async reportGameScore(
    gameName: string,
    scoreParams: {
      score?: number;
      won?: boolean;
      level?: number;
      moves?: number;
      seconds?: number;
      lives?: number;
      mode?: string;
    }
  ): Promise<number> {
    const base = this._calcCoinsForGame(gameName, scoreParams);
    if (base <= 0) return 0;

    const data = this.getData();
    const mult = (data.boosterActive ? 2.0 : 1.0) * this.getStreakMultiplier(data.streakDay);
    const earned = Math.round(base * mult);

    await this.addCoins(earned);
    
    // Sync if online
    const player = AuthService.getPlayer();
    if (player) {
      this.scheduleSync({ coinBalance: player.coinBalance + earned });
    }

    return earned;
  }

  private static _calcCoinsForGame(
    gameName: string,
    {
      score = 0,
      won = false,
      level = 0,
      moves = 0,
      seconds = 0,
      lives = 0,
      mode = '',
    }: {
      score?: number;
      won?: boolean;
      level?: number;
      moves?: number;
      seconds?: number;
      lives?: number;
      mode?: string;
    }
  ): number {
    switch (gameName) {
      case 'snake':
        if (score >= 20) return 35;
        if (score >= 10) return 20;
        if (score >= 5) return 12;
        if (score >= 1) return 5;
        return 0;
      case 'tetris':
        if (level >= 7) return 35;
        if (level >= 4) return 20;
        if (level >= 2) return 12;
        if (level >= 1) return 5;
        return 0;
      case 'flappy':
        if (score >= 20) return 40;
        if (score >= 10) return 25;
        if (score >= 5) return 15;
        if (score >= 1) return 5;
        return 0;
      case 'memory':
        if (!won) return 0;
        const pairs = Math.floor((level * level) / 2);
        const extra = moves - pairs;
        if (extra <= 0) return 30;
        if (extra <= pairs) return 20;
        return 10;
      case 'whack_mole':
        if (score >= 35) return 30;
        if (score >= 20) return 20;
        if (score >= 10) return 12;
        if (score >= 1) return 5;
        return 0;
      case 'sliding_puzzle':
        if (!won) return 0;
        const baseVal = level >= 4 ? 25 : 15;
        const optimal = level >= 4 ? 50 : 20;
        if (moves <= optimal) return baseVal + 10;
        if (moves <= optimal * 2) return baseVal;
        return Math.max(5, baseVal - 5);
      case 'mastermind':
        if (!won) return 0;
        const attempts = [10, 20, 35];
        const baseMM = attempts[Math.min(level, 2)] || 10;
        return moves <= 3 ? baseMM + 10 : baseMM;
      case 'minesweeper':
        if (!won) return 0;
        const mBase = [15, 25, 40][Math.min(level, 2)] || 15;
        const thresholds = [30, 60, 120];
        const targetSec = thresholds[Math.min(level, 2)] || 30;
        return seconds < targetSec ? mBase + 10 : mBase;
      case 'brick_breaker':
        if (score >= 500) return 35 + lives * 2;
        if (score >= 200) return 25 + lives;
        if (score >= 50) return 15;
        if (score >= 1) return 8;
        return 0;
      case 'tictactoe':
        if (!won) return 0;
        return level >= 5 ? 20 : 10;
      case 'ninja_fruit':
        if (mode === 'zen') {
          if (score >= 20) return 25;
          if (score >= 12) return 15;
          if (score >= 5) return 8;
          if (score >= 1) return 3;
          return 0;
        }
        if (score >= 100) return 35;
        if (score >= 50) return 20;
        if (score >= 20) return 12;
        if (score >= 5) return 5;
        return 0;
      case 'sudoku':
        if (!won) return 0;
        return [15, 25, 40][Math.min(level, 2)] || 15;
      case '2048':
        if (won) return 50;
        if (score >= 1024) return 25;
        if (score >= 512) return 15;
        if (score >= 256) return 8;
        return 0;
      default:
        return 0;
    }
  }

  // ── Shop purchases ─────────────────────────────────────────────────────────

  static async purchaseBooster(): Promise<boolean> {
    const data = this.getData();
    if (data.balance < 300) return false;
    
    const expiry = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    await this.addCoins(-300);

    const player = AuthService.getPlayer();
    if (player) {
      const updated: PlayerModel = {
        ...player,
        boosterExpiryAt: expiry,
      };
      AuthService.setPlayer(updated);
      this.notify();
      this.scheduleSync({ boosterExpiryAt: expiry });
    } else {
      localStorage.setItem(this.KEYS.boosterExpiry, String(Date.now() + 24 * 60 * 60 * 1000));
      this.notify();
    }
    return true;
  }

  static async purchaseStreakShield(): Promise<boolean> {
    const data = this.getData();
    if (data.balance < 150) return false;

    const newShieldCount = data.shieldCount + 1;
    await this.addCoins(-150);

    const player = AuthService.getPlayer();
    if (player) {
      const updated: PlayerModel = {
        ...player,
        shieldCount: newShieldCount,
      };
      AuthService.setPlayer(updated);
      this.notify();
      this.scheduleSync({ shieldCount: newShieldCount });
    } else {
      localStorage.setItem(this.KEYS.shieldCount, String(newShieldCount));
      this.notify();
    }
    return true;
  }

  static async purchaseLuckyBox(): Promise<[number, string]> {
    const data = this.getData();
    if (data.balance < 100) throw new Error('Không đủ xu');
    
    await this.addCoins(-100);
    const [reward, tier] = this._rollLuckyBox();
    await this.addCoins(reward);

    const player = AuthService.getPlayer();
    if (player) {
      this.scheduleSync({ coinBalance: player.coinBalance + reward - 100 });
    }
    return [reward, tier];
  }

  static async openFreeLuckyBox(): Promise<[number, string]> {
    const data = this.getData();
    if (data.freeLuckyBoxes <= 0) throw new Error('Hết hộp miễn phí');

    const newFreeBoxes = data.freeLuckyBoxes - 1;
    const [reward, tier] = this._rollLuckyBox();
    await this.addCoins(reward);

    const player = AuthService.getPlayer();
    if (player) {
      const updated: PlayerModel = {
        ...player,
        freeLuckyBoxes: newFreeBoxes,
      };
      AuthService.setPlayer(updated);
      this.notify();
      this.scheduleSync({
        freeLuckyBoxes: newFreeBoxes,
        coinBalance: player.coinBalance + reward,
      });
    } else {
      localStorage.setItem(this.KEYS.freeLuckyBoxes, String(newFreeBoxes));
      this.notify();
    }
    return [reward, tier];
  }

  private static _rollLuckyBox(): [number, string] {
    const roll = Math.random();
    if (roll < 0.55) return [25 + Math.floor(Math.random() * 36), 'bronze'];
    if (roll < 0.83) return [60 + Math.floor(Math.random() * 61), 'silver'];
    if (roll < 0.96) return [120 + Math.floor(Math.random() * 131), 'gold'];
    return [300 + Math.floor(Math.random() * 201), 'jackpot'];
  }

  static async buyAvatarFrame(frameId: string, price: number): Promise<boolean> {
    const data = this.getData();
    if (data.balance < price) return false;
    if (data.ownedFrames.includes(frameId)) return true;

    await this.addCoins(-price);
    const updatedFrames = [...data.ownedFrames, frameId];
    localStorage.setItem(this.KEYS.ownedFrames, JSON.stringify(updatedFrames));

    const player = AuthService.getPlayer();
    if (player) {
      this.scheduleSync({ coinBalance: player.coinBalance - price });
    }
    this.notify();
    return true;
  }

  static async setActiveFrame(frameId: string): Promise<void> {
    const data = this.getData();
    if (!data.ownedFrames.includes(frameId) && frameId !== 'none') return;
    localStorage.setItem(this.KEYS.activeFrame, frameId);
    this.notify();
  }

  static async spinLuckyWheel(isFree: boolean): Promise<[number, string]> {
    const data = this.getData();
    if (!isFree) {
      if (data.balance < 30) throw new Error('Không đủ xu');
      await this.addCoins(-30);
    } else {
      localStorage.setItem(this.KEYS.lastWheelSpinDate, this.getTodayStr());
    }

    // Tỷ lệ vòng quay (8 ô, EV ~29 xu, house edge ~3% paid spin):
    //  38% - Hụt (0 xu)        — cảm giác mất nhẹ
    //  25% - 10 xu              — an ủi
    //  15% - 25 xu              — gần break-even paid spin
    //   8% - 50 xu              — lời nhẹ
    //   6% - 1 Lá chắn          — tiện ích
    //   4% - Booster 1h         — tiện ích nhỏ
    //   3% - 150 xu             — phần thưởng to
    //   1% - 1000 xu Jackpot    — phần thưởng đỉnh
    const roll = Math.floor(Math.random() * 100);
    let rewardCoins = 0;
    let rewardLabel = '';

    const player = AuthService.getPlayer();

    if (roll < 38) {
      rewardCoins = 0;
      rewardLabel = 'Hụt';
    } else if (roll < 63) {
      rewardCoins = 10;
      rewardLabel = '10 Xu';
      await this.addCoins(rewardCoins);
    } else if (roll < 78) {
      rewardCoins = 25;
      rewardLabel = '25 Xu';
      await this.addCoins(rewardCoins);
    } else if (roll < 86) {
      rewardCoins = 50;
      rewardLabel = '50 Xu';
      await this.addCoins(rewardCoins);
    } else if (roll < 92) {
      const newShields = data.shieldCount + 1;
      rewardLabel = '1 Lá Chắn';
      if (player) {
        const updated: PlayerModel = { ...player, shieldCount: newShields };
        AuthService.setPlayer(updated);
        this.scheduleSync({ shieldCount: newShields });
      } else {
        localStorage.setItem(this.KEYS.shieldCount, String(newShields));
      }
    } else if (roll < 96) {
      const expiry = new Date(Date.now() + 60 * 60 * 1000).toISOString();
      rewardLabel = 'Booster x2 (1h)';
      if (player) {
        const updated: PlayerModel = { ...player, boosterExpiryAt: expiry };
        AuthService.setPlayer(updated);
        this.scheduleSync({ boosterExpiryAt: expiry });
      } else {
        localStorage.setItem(this.KEYS.boosterExpiry, String(Date.now() + 60 * 60 * 1000));
      }
    } else if (roll < 99) {
      rewardCoins = 150;
      rewardLabel = '150 Xu';
      await this.addCoins(rewardCoins);
    } else {
      rewardCoins = 1000;
      rewardLabel = 'Jackpot 1000 Xu';
      await this.addCoins(rewardCoins);
    }

    if (player && rewardCoins > 0) {
      const baseCost = isFree ? 0 : -30;
      this.scheduleSync({ coinBalance: player.coinBalance + rewardCoins + baseCost });
    }

    this.notify();
    return [rewardCoins, rewardLabel];
  }

  static async clearLocalData() {
    Object.values(this.KEYS).forEach((k) => localStorage.removeItem(k));
    this.notify();
  }

  static async loadFromPlayer(player: PlayerModel) {
    localStorage.setItem(this.KEYS.balance, String(player.coinBalance));
    localStorage.setItem(this.KEYS.streakDay, String(player.streakDay));
    localStorage.setItem(this.KEYS.freeLuckyBoxes, String(player.freeLuckyBoxes));
    localStorage.setItem(this.KEYS.shieldCount, String(player.shieldCount));
    localStorage.setItem(this.KEYS.totalGamesPlayed, String(player.totalGamesPlayed));
    if (player.streakLastClaimDate) localStorage.setItem(this.KEYS.lastClaimDate, player.streakLastClaimDate);
    if (player.boosterExpiryAt) {
      localStorage.setItem(this.KEYS.boosterExpiry, String(new Date(player.boosterExpiryAt).getTime()));
    } else {
      localStorage.removeItem(this.KEYS.boosterExpiry);
    }
    this.notify();
  }
}
