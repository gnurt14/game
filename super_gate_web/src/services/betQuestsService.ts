// Bet Quests Service
// Random 3 quest mỗi ngày từ pool 8 quest. Track progress, claim reward qua CoinService.

import { CoinService } from './coinService';

const KEY = 'quests_v1';

export type QuestId =
  | 'bet_bau_cua_500'
  | 'win_do_den_3'
  | 'bet_total_1000'
  | 'play_5_lucky_games'
  | 'jackpot_slot'
  | 'crash_above_3x'
  | 'win_tai_xiu_5'
  | 'big_bet_500';

export interface Quest {
  id: QuestId;
  label: string;
  target: number;
  progress: number;
  reward: number;
  claimed: boolean;
}

interface QuestPoolItem {
  id: QuestId;
  label: string;
  target: number;
  reward: number;
}

const POOL: QuestPoolItem[] = [
  { id: 'bet_bau_cua_500', label: 'Cược tổng 500 xu ở Bầu Cua', target: 500, reward: 50 },
  { id: 'win_do_den_3', label: 'Thắng 3 ván Đỏ Đen liên tiếp', target: 3, reward: 200 },
  { id: 'bet_total_1000', label: 'Cược tổng 1.000 xu hôm nay', target: 1000, reward: 150 },
  { id: 'play_5_lucky_games', label: 'Chơi 5 game cờ bạc khác nhau', target: 5, reward: 100 },
  { id: 'jackpot_slot', label: 'Đạt jackpot Slot Machine', target: 1, reward: 500 },
  { id: 'crash_above_3x', label: 'Cash out Crash > x3.0', target: 1, reward: 300 },
  { id: 'win_tai_xiu_5', label: 'Trúng Tài/Xỉu 5 lần', target: 5, reward: 150 },
  { id: 'big_bet_500', label: 'Cược 1 lần > 500 xu', target: 1, reward: 80 },
];

interface QuestsData {
  date: string;
  quests: Quest[];
}

export class BetQuestsService {
  private static listeners: (() => void)[] = [];

  static subscribe(listener: () => void) {
    this.listeners.push(listener);
    listener();
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  private static notify() {
    this.listeners.forEach((l) => l());
  }

  private static todayStr(): string {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  private static dayOfYear(d: Date): number {
    const start = new Date(d.getFullYear(), 0, 0);
    const diff = d.getTime() - start.getTime();
    return Math.floor(diff / (1000 * 60 * 60 * 24));
  }

  // Deterministic shuffle theo seed
  private static pickDaily(): QuestPoolItem[] {
    const seed = this.dayOfYear(new Date());
    let h = (seed * 2654435761) >>> 0;
    const arr = [...POOL];
    // Fisher-Yates với PRNG đơn giản
    for (let i = arr.length - 1; i > 0; i--) {
      h = (h * 1103515245 + 12345) >>> 0;
      const j = h % (i + 1);
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr.slice(0, 3);
  }

  private static load(): QuestsData {
    const today = this.todayStr();
    const raw = localStorage.getItem(KEY);
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as QuestsData;
        if (parsed.date === today) return parsed;
      } catch (_) {
        // ignore
      }
    }
    // Tạo mới
    const picked = this.pickDaily();
    const data: QuestsData = {
      date: today,
      quests: picked.map((p) => ({
        id: p.id,
        label: p.label,
        target: p.target,
        progress: 0,
        reward: p.reward,
        claimed: false,
      })),
    };
    localStorage.setItem(KEY, JSON.stringify(data));
    return data;
  }

  private static save(data: QuestsData) {
    localStorage.setItem(KEY, JSON.stringify(data));
  }

  static getQuests(): Quest[] {
    return this.load().quests;
  }

  static incrementProgress(questId: QuestId, amount: number = 1) {
    const data = this.load();
    const q = data.quests.find((x) => x.id === questId);
    if (!q || q.claimed) return;
    q.progress = Math.min(q.target, q.progress + amount);
    this.save(data);
    this.notify();
  }

  static async claim(questId: QuestId): Promise<boolean> {
    const data = this.load();
    const q = data.quests.find((x) => x.id === questId);
    if (!q) return false;
    if (q.claimed) return false;
    if (q.progress < q.target) return false;

    q.claimed = true;
    this.save(data);
    await CoinService.earnCoins(q.reward);
    this.notify();
    return true;
  }
}
