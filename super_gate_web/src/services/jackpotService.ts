// Daily Jackpot Service
// Mỗi cược trích 1% vào pool, cấp vé cho người chơi. Hết ngày draw 1 lần
// theo xác suất tickets/totalTickets. Persist trong localStorage.

import { AuthService } from './authService';

const KEY = 'jackpot_v1';
const CLAIMED_KEY = 'jackpot_claimed_date_v1';

export interface JackpotData {
  date: string;            // YYYY-MM-DD
  pool: number;            // tổng xu trong pool
  tickets: { [playerId: string]: number };
}

export class JackpotService {
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

  private static currentPlayerId(): string {
    return AuthService.getPlayer()?.id || 'guest';
  }

  static load(): JackpotData {
    const today = this.todayStr();
    const raw = localStorage.getItem(KEY);
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as JackpotData;
        if (parsed.date === today) return parsed;
      } catch (_) {
        // ignore
      }
    }
    // Reset cho ngày mới — seed pool 1000 cho hấp dẫn
    const fresh: JackpotData = { date: today, pool: 1000, tickets: {} };
    localStorage.setItem(KEY, JSON.stringify(fresh));
    return fresh;
  }

  private static save(data: JackpotData) {
    localStorage.setItem(KEY, JSON.stringify(data));
  }

  static addBet(amount: number) {
    if (amount <= 0) return;
    const data = this.load();
    const contribution = Math.floor(amount * 0.01);
    const ticketsEarned = Math.floor(amount / 100);
    data.pool += contribution;
    if (ticketsEarned > 0) {
      const pid = this.currentPlayerId();
      data.tickets[pid] = (data.tickets[pid] || 0) + ticketsEarned;
    }
    this.save(data);
    this.notify();
  }

  static getPool(): number {
    return this.load().pool;
  }

  static getMyTickets(): number {
    const data = this.load();
    return data.tickets[this.currentPlayerId()] || 0;
  }

  static getTotalTickets(): number {
    const data = this.load();
    return Object.values(data.tickets).reduce((s, n) => s + n, 0);
  }

  // Top N người có nhiều vé nhất (giả lập leaderboard local). Trả về playerId + tickets.
  static getLeaderboard(limit: number = 10): { playerId: string; tickets: number; isMe: boolean }[] {
    const data = this.load();
    const me = this.currentPlayerId();
    const list = Object.entries(data.tickets)
      .map(([pid, t]) => ({ playerId: pid, tickets: t, isMe: pid === me }))
      .sort((a, b) => b.tickets - a.tickets);

    // Nếu ít quá, thêm vài bot giả để minh hoạ — chỉ thêm 1 lần / ngày, deterministic
    const fakes = this.generateFakeLeaders(data.date);
    const merged = [...list];
    fakes.forEach((f) => {
      if (!merged.find((m) => m.playerId === f.playerId)) {
        merged.push({ playerId: f.playerId, tickets: f.tickets, isMe: false });
      }
    });
    merged.sort((a, b) => b.tickets - a.tickets);
    return merged.slice(0, limit);
  }

  private static generateFakeLeaders(seed: string): { playerId: string; tickets: number }[] {
    // Deterministic theo ngày
    let h = 0;
    for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
    const names = ['Bot_TrieuPhu', 'Bot_DaiGia', 'Bot_LuckyMan', 'Bot_TamThe', 'Bot_VuaCo', 'Bot_Hoanggia'];
    const out: { playerId: string; tickets: number }[] = [];
    for (let i = 0; i < names.length; i++) {
      h = (h * 1103515245 + 12345) >>> 0;
      const tickets = 3 + (h % 18);
      out.push({ playerId: names[i], tickets });
    }
    return out;
  }

  // Thử claim 1 lần / ngày. Nếu chưa có vé → không trúng.
  static tryClaim(): { won: boolean; amount: number; alreadyClaimed: boolean } {
    const today = this.todayStr();
    const lastClaim = localStorage.getItem(CLAIMED_KEY) || '';
    if (lastClaim === today) {
      return { won: false, amount: 0, alreadyClaimed: true };
    }

    const data = this.load();
    const myTickets = data.tickets[this.currentPlayerId()] || 0;
    const totalTickets = Object.values(data.tickets).reduce((s, n) => s + n, 0);

    localStorage.setItem(CLAIMED_KEY, today);

    if (myTickets === 0 || totalTickets === 0) {
      return { won: false, amount: 0, alreadyClaimed: false };
    }

    const winChance = myTickets / totalTickets;
    const won = Math.random() < winChance;
    if (!won) return { won: false, amount: 0, alreadyClaimed: false };

    const amount = data.pool;
    // Reset pool về 0, giữ tickets cho leaderboard hiển ngay sau khi trúng
    data.pool = 0;
    this.save(data);
    this.notify();
    return { won: true, amount, alreadyClaimed: false };
  }

  static hasClaimedToday(): boolean {
    return (localStorage.getItem(CLAIMED_KEY) || '') === this.todayStr();
  }
}
