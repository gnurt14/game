import { CoinService } from './coinService';

export type GameCategory = 'lucky' | 'action' | 'puzzle' | 'strategy';

export interface WeeklyMissionData {
  categoriesDone: GameCategory[];
  categoryRewardClaimed: boolean;
  gamblingWinsThisWeek: number;
  gamblingRewardClaimed: boolean;
  weekStartDate: string;
  allCategoriesDone: boolean;
  categoriesCompleted: number;
}

export class WeeklyMissionService {
  private static readonly KEYS = {
    weekStart: 'weekly_week_start',
    catsDone: 'weekly_categories_done',
    catRewardClaimed: 'weekly_cat_reward_claimed',
    gamblingWins: 'weekly_gambling_wins',
    gamRewardClaimed: 'weekly_gam_reward_claimed',
  };

  private static categoriesDone: Set<GameCategory> = new Set();
  private static categoryRewardClaimed = false;
  private static gamblingWins = 0;
  private static gamblingRewardClaimed = false;
  private static weekStart = '';

  private static listeners: ((data: WeeklyMissionData) => void)[] = [];

  static subscribe(listener: (data: WeeklyMissionData) => void) {
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

  private static getMondayStr(): string {
    const now = new Date();
    const day = now.getDay();
    const diff = now.getDate() - day + (day === 0 ? -6 : 1); // Adjust when Sunday
    const monday = new Date(now.setDate(diff));
    
    const year = monday.getFullYear();
    const month = String(monday.getMonth() + 1).padStart(2, '0');
    const dStr = String(monday.getDate()).padStart(2, '0');
    return `${year}-${month}-${dStr}`;
  }

  static init() {
    const currentWeek = this.getMondayStr();
    const savedWeek = localStorage.getItem(this.KEYS.weekStart) || '';

    if (savedWeek !== currentWeek) {
      // Tuần mới -> Reset toàn bộ
      this.categoriesDone = new Set();
      this.categoryRewardClaimed = false;
      this.gamblingWins = 0;
      this.gamblingRewardClaimed = false;
      this.weekStart = currentWeek;

      localStorage.setItem(this.KEYS.weekStart, currentWeek);
      localStorage.setItem(this.KEYS.catsDone, JSON.stringify([]));
      localStorage.setItem(this.KEYS.catRewardClaimed, 'false');
      localStorage.setItem(this.KEYS.gamblingWins, '0');
      localStorage.setItem(this.KEYS.gamRewardClaimed, 'false');
    } else {
      this.weekStart = savedWeek;
      this.categoryRewardClaimed = localStorage.getItem(this.KEYS.catRewardClaimed) === 'true';
      this.gamblingRewardClaimed = localStorage.getItem(this.KEYS.gamRewardClaimed) === 'true';
      this.gamblingWins = parseInt(localStorage.getItem(this.KEYS.gamblingWins) || '0');

      try {
        const arr = JSON.parse(localStorage.getItem(this.KEYS.catsDone) || '[]');
        this.categoriesDone = new Set(arr);
      } catch (_) {
        this.categoriesDone = new Set();
      }
    }
    this.notify();
  }

  static getData(): WeeklyMissionData {
    const categoriesDone = Array.from(this.categoriesDone);
    return {
      categoriesDone,
      categoryRewardClaimed: this.categoryRewardClaimed,
      gamblingWinsThisWeek: this.gamblingWins,
      gamblingRewardClaimed: this.gamblingRewardClaimed,
      weekStartDate: this.weekStart,
      allCategoriesDone: this.categoriesDone.size >= 4,
      categoriesCompleted: this.categoriesDone.size,
    };
  }

  static async recordGamePlayed(category: GameCategory): Promise<void> {
    this.init(); // Đảm bảo đúng tuần trước
    if (this.categoriesDone.has(category)) return;

    this.categoriesDone.add(category);
    localStorage.setItem(this.KEYS.catsDone, JSON.stringify(Array.from(this.categoriesDone)));

    // Chơi đủ 4 loại game -> thưởng 500 xu
    if (this.categoriesDone.size >= 4 && !this.categoryRewardClaimed) {
      this.categoryRewardClaimed = true;
      localStorage.setItem(this.KEYS.catRewardClaimed, 'true');
      await CoinService.earnCoins(500);
    }

    this.notify();
  }

  static async recordGamblingWin(): Promise<void> {
    this.init(); // Đảm bảo đúng tuần trước
    this.gamblingWins++;
    localStorage.setItem(this.KEYS.gamblingWins, String(this.gamblingWins));

    // Thắng 3 ván cược -> thưởng 300 xu
    if (this.gamblingWins >= 3 && !this.gamblingRewardClaimed) {
      this.gamblingRewardClaimed = true;
      localStorage.setItem(this.KEYS.gamRewardClaimed, 'true');
      await CoinService.earnCoins(300);
    }

    this.notify();
  }
}

// Khởi chạy ngay khi load module
WeeklyMissionService.init();
