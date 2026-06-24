// VIP Tier Service
// Track tổng xu đã cược 30 ngày gần nhất (rolling window).
// Tiers theo total bet 30d: Bronze / Silver / Gold / Diamond / Sapphire.

const KEY = 'vip_v1';

export interface VipBetEntry {
  date: string; // YYYY-MM-DD
  total: number;
}

export interface VipData {
  betHistory: VipBetEntry[];
  currentTier: string;
}

export interface VipTier {
  id: 'bronze' | 'silver' | 'gold' | 'diamond' | 'sapphire';
  label: string;
  emoji: string;
  color: string;
  minBet: number;
  perks: string[];
}

const TIERS: VipTier[] = [
  {
    id: 'bronze',
    label: 'BRONZE',
    emoji: '🥉',
    color: '#cd7f32',
    minBet: 0,
    perks: ['Quyền lợi cơ bản', 'Truy cập đầy đủ 18 game'],
  },
  {
    id: 'silver',
    label: 'SILVER',
    emoji: '🥈',
    color: '#c0c0c0',
    minBet: 5000,
    perks: ['+5% xu daily reward', 'Ưu tiên hỗ trợ'],
  },
  {
    id: 'gold',
    label: 'GOLD',
    emoji: '🥇',
    color: '#f1c40f',
    minBet: 20000,
    perks: ['+10% xu daily reward', 'Giảm 20% phí gacha', 'Badge Gold'],
  },
  {
    id: 'diamond',
    label: 'DIAMOND',
    emoji: '💎',
    color: '#00bcd4',
    minBet: 50000,
    perks: ['+20% xu daily reward', 'Vào VIP Room', 'Quà sinh nhật riêng'],
  },
  {
    id: 'sapphire',
    label: 'SAPPHIRE',
    emoji: '🔵',
    color: '#3f51b5',
    minBet: 150000,
    perks: ['+30% xu daily reward', 'Khung avatar exclusive', 'Tướng riêng', 'Hỗ trợ 24/7'],
  },
];

export class VipService {
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

  static load(): VipData {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as VipData;
        return parsed;
      } catch (_) {
        // ignore
      }
    }
    return { betHistory: [], currentTier: 'bronze' };
  }

  private static save(data: VipData) {
    localStorage.setItem(KEY, JSON.stringify(data));
  }

  private static pruneOld(history: VipBetEntry[]): VipBetEntry[] {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 30);
    const cutoffStr = `${cutoff.getFullYear()}-${String(cutoff.getMonth() + 1).padStart(2, '0')}-${String(cutoff.getDate()).padStart(2, '0')}`;
    return history.filter((e) => e.date >= cutoffStr);
  }

  static getTotalBet30d(): number {
    const data = this.load();
    const pruned = this.pruneOld(data.betHistory);
    return pruned.reduce((s, e) => s + e.total, 0);
  }

  static recordBet(amount: number) {
    if (amount <= 0) return;
    const data = this.load();
    const today = this.todayStr();
    let entry = data.betHistory.find((e) => e.date === today);
    if (entry) {
      entry.total += amount;
    } else {
      data.betHistory.push({ date: today, total: amount });
    }
    data.betHistory = this.pruneOld(data.betHistory);
    data.currentTier = this.computeTier(this.getTotalBet30dFrom(data.betHistory)).id;
    this.save(data);
    this.notify();
  }

  private static getTotalBet30dFrom(history: VipBetEntry[]): number {
    return history.reduce((s, e) => s + e.total, 0);
  }

  private static computeTier(totalBet: number): VipTier {
    let current = TIERS[0];
    for (const t of TIERS) {
      if (totalBet >= t.minBet) current = t;
    }
    return current;
  }

  static getTier(): VipTier {
    return this.computeTier(this.getTotalBet30d());
  }

  static getAllTiers(): VipTier[] {
    return TIERS;
  }

  static getProgress(): { current: number; nextThreshold: number; percent: number; nextTier: VipTier | null } {
    const total = this.getTotalBet30d();
    const tier = this.getTier();
    const idx = TIERS.findIndex((t) => t.id === tier.id);
    const next = idx >= 0 && idx < TIERS.length - 1 ? TIERS[idx + 1] : null;
    if (!next) {
      return { current: total, nextThreshold: tier.minBet, percent: 100, nextTier: null };
    }
    const span = next.minBet - tier.minBet;
    const progressed = total - tier.minBet;
    const percent = span <= 0 ? 100 : Math.max(0, Math.min(100, (progressed / span) * 100));
    return { current: total, nextThreshold: next.minBet, percent, nextTier: next };
  }
}
