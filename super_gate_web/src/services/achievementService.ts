import { CoinService } from './coinService';

export interface Achievement {
  key: string;
  title: string;
  description: string;
  emoji: string;
  coinReward: number;
}

export const kAchievements: Achievement[] = [
  {
    key: 'first_game',
    title: 'Khởi đầu!',
    description: 'Chơi game đầu tiên',
    emoji: '🎮',
    coinReward: 50,
  },
  {
    key: 'first_gambling_win',
    title: 'Vận đỏ!',
    description: 'Thắng game may mắn đầu tiên',
    emoji: '🎰',
    coinReward: 100,
  },
  {
    key: 'play_all_lucky',
    title: 'Cờ bạc thủ',
    description: 'Chơi cả 3 game may mắn',
    emoji: '♠️',
    coinReward: 150,
  },
  {
    key: 'streak_7',
    title: 'Thánh Chuỗi',
    description: 'Điểm danh 7 ngày liên tiếp',
    emoji: '🔥',
    coinReward: 200,
  },
  {
    key: 'play_10_games',
    title: 'Đa Tài',
    description: 'Chơi 10 game khác nhau',
    emoji: '🌟',
    coinReward: 200,
  },
  {
    key: 'play_all_games',
    title: 'Bộ Sưu Tập Đầy Đủ',
    description: 'Chơi tất cả game',
    emoji: '🏆',
    coinReward: 500,
  },
  {
    key: 'balance_1000',
    title: 'Phú Gia',
    description: 'Tích lũy 1.000 xu',
    emoji: '💰',
    coinReward: 100,
  },
  {
    key: 'balance_10000',
    title: 'Triệu Phú',
    description: 'Tích lũy 10.000 xu',
    emoji: '💎',
    coinReward: 500,
  },
  {
    key: 'open_lucky_box',
    title: 'Thử Vận May',
    description: 'Mở hộp may mắn đầu tiên',
    emoji: '🎁',
    coinReward: 50,
  },
  {
    key: 'jackpot',
    title: 'JACKPOT!',
    description: 'Trúng jackpot từ hộp may mắn',
    emoji: '🌈',
    coinReward: 300,
  },
];

export class AchievementService {
  private static readonly KEY = 'achievements_earned';
  private static earned: Set<String> = new Set();
  private static listeners: ((earned: Set<String>) => void)[] = [];

  static subscribe(listener: (earned: Set<String>) => void) {
    this.listeners.push(listener);
    listener(new Set(this.earned));
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  private static notify() {
    this.listeners.forEach((listener) => listener(new Set(this.earned)));
  }

  static init() {
    try {
      const json = localStorage.getItem(this.KEY) || '[]';
      const arr = JSON.parse(json) as string[];
      this.earned = new Set(arr);
    } catch (_) {
      this.earned = new Set();
    }
    this.notify();
  }

  static isEarned(key: string): boolean {
    return this.earned.has(key);
  }

  static async unlock(key: string): Promise<Achievement | null> {
    if (this.earned.has(key)) return null;

    const ach = kAchievements.find((a) => a.key === key);
    if (!ach) return null;

    this.earned.add(key);
    localStorage.setItem(this.KEY, JSON.stringify(Array.from(this.earned)));

    if (ach.coinReward > 0) {
      await CoinService.earnCoins(ach.coinReward);
    }

    this.notify();
    return ach;
  }

  static async checkAfterGamePlayed(
    totalGamesPlayed: number,
    uniqueGamesPlayedCount: number,
    balance: number
  ): Promise<Achievement[]> {
    const unlocked: Achievement[] = [];

    if (totalGamesPlayed >= 1) {
      const a = await this.unlock('first_game');
      if (a) unlocked.push(a);
    }
    if (uniqueGamesPlayedCount >= 10) {
      const a = await this.unlock('play_10_games');
      if (a) unlocked.push(a);
    }
    if (uniqueGamesPlayedCount >= 16) {
      const a = await this.unlock('play_all_games');
      if (a) unlocked.push(a);
    }
    if (balance >= 1000) {
      const a = await this.unlock('balance_1000');
      if (a) unlocked.push(a);
    }
    if (balance >= 10000) {
      const a = await this.unlock('balance_10000');
      if (a) unlocked.push(a);
    }

    return unlocked;
  }

  static async checkAfterGamblingWin(luckyGamesPlayed: Set<string>): Promise<Achievement[]> {
    const unlocked: Achievement[] = [];

    const a1 = await this.unlock('first_gambling_win');
    if (a1) unlocked.push(a1);

    const luckyNames = new Set(['Bầu Cua', 'Đỏ Đen', 'Xì Jack']);
    const intersection = new Set([...luckyGamesPlayed].filter((x) => luckyNames.has(x)));
    
    if (intersection.size === luckyNames.size) {
      const a2 = await this.unlock('play_all_lucky');
      if (a2) unlocked.push(a2);
    }

    return unlocked;
  }

  static async checkStreak7(): Promise<Achievement | null> {
    return await this.unlock('streak_7');
  }

  static async checkLuckyBoxOpened(): Promise<Achievement | null> {
    return await this.unlock('open_lucky_box');
  }

  static async checkJackpot(): Promise<Achievement | null> {
    return await this.unlock('jackpot');
  }
}

// Khởi chạy ngay khi load module
AchievementService.init();
