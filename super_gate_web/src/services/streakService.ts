// StreakService — track win/loss streaks for casino games, lucky multipliers,
// comeback bonuses, and welcome-back grants. All state persisted in localStorage
// under a single key (`streak_v1`).

export type CasinoGame = 'bau_cua' | 'do_den' | 'xi_jack';

interface StreakState {
  bauCuaWinStreak: number;
  bauCuaLossStreak: number;
  doDenWinStreak: number;
  doDenLossStreak: number;
  xiJackWinStreak: number;
  xiJackLossStreak: number;
  // Pending comeback bonus per game — set after lossStreak crosses 3, consumed
  // on the next win calculation so the x2 multiplier only applies once.
  bauCuaComebackPending: boolean;
  doDenComebackPending: boolean;
  xiJackComebackPending: boolean;
  lastWelcomeBackTs: number | null;
}

const STORAGE_KEY = 'streak_v1';
const WELCOME_BACK_THRESHOLD_MS = 24 * 60 * 60 * 1000; // 24h

const DEFAULT_STATE: StreakState = {
  bauCuaWinStreak: 0,
  bauCuaLossStreak: 0,
  doDenWinStreak: 0,
  doDenLossStreak: 0,
  xiJackWinStreak: 0,
  xiJackLossStreak: 0,
  bauCuaComebackPending: false,
  doDenComebackPending: false,
  xiJackComebackPending: false,
  lastWelcomeBackTs: null,
};

export class StreakService {
  private static listeners: ((state: StreakState) => void)[] = [];

  private static load(): StreakState {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return { ...DEFAULT_STATE };
      const parsed = JSON.parse(raw) as Partial<StreakState>;
      return { ...DEFAULT_STATE, ...parsed };
    } catch (_) {
      return { ...DEFAULT_STATE };
    }
  }

  private static save(state: StreakState): void {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    this.notify(state);
  }

  static subscribe(listener: (state: StreakState) => void): () => void {
    this.listeners.push(listener);
    listener(this.load());
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  private static notify(state: StreakState): void {
    this.listeners.forEach((l) => l(state));
  }

  private static keysForGame(game: CasinoGame): {
    win: keyof StreakState;
    loss: keyof StreakState;
    comeback: keyof StreakState;
  } {
    switch (game) {
      case 'bau_cua':
        return {
          win: 'bauCuaWinStreak',
          loss: 'bauCuaLossStreak',
          comeback: 'bauCuaComebackPending',
        };
      case 'do_den':
        return {
          win: 'doDenWinStreak',
          loss: 'doDenLossStreak',
          comeback: 'doDenComebackPending',
        };
      case 'xi_jack':
        return {
          win: 'xiJackWinStreak',
          loss: 'xiJackLossStreak',
          comeback: 'xiJackComebackPending',
        };
    }
  }

  static recordWin(game: CasinoGame): void {
    const state = this.load();
    const keys = this.keysForGame(game);
    const nextWin = (state[keys.win] as number) + 1;
    const next: StreakState = {
      ...state,
      [keys.win]: nextWin,
      [keys.loss]: 0,
    };
    this.save(next);
  }

  static recordLoss(game: CasinoGame): void {
    const state = this.load();
    const keys = this.keysForGame(game);
    const nextLoss = (state[keys.loss] as number) + 1;
    const next: StreakState = {
      ...state,
      [keys.win]: 0,
      [keys.loss]: nextLoss,
    };

    // Khi vừa cán mốc 3 lần thua → set comeback pending (chỉ set lần đầu).
    if (nextLoss >= 3 && !(state[keys.comeback] as boolean)) {
      next[keys.comeback] = true as never;
    }

    this.save(next);
  }

  static getWinStreak(game: CasinoGame): number {
    const state = this.load();
    return state[this.keysForGame(game).win] as number;
  }

  static getLossStreak(game: CasinoGame): number {
    const state = this.load();
    return state[this.keysForGame(game).loss] as number;
  }

  /**
   * Lucky Streak multiplier dựa trên winStreak hiện tại:
   *   3 wins → 1.5x, 5 wins → 2x, 7+ wins → 3x, ngược lại 1x.
   */
  static getMultiplier(game: CasinoGame): number {
    const w = this.getWinStreak(game);
    if (w >= 7) return 3;
    if (w >= 5) return 2;
    if (w >= 3) return 1.5;
    return 1;
  }

  /** True nếu player vừa thua >=3 ván và chưa được hiện popup comeback. */
  static shouldShowComeback(game: CasinoGame): boolean {
    const state = this.load();
    const keys = this.keysForGame(game);
    return (
      (state[keys.loss] as number) >= 3 && (state[keys.comeback] as boolean)
    );
  }

  /**
   * Consume comeback bonus: nếu đang pending → reset flag & return true (caller
   * sẽ áp x2 multiplier vào reward ván tiếp). Chỉ trigger 1 lần mỗi 3 thua liên tiếp.
   */
  static consumeComebackBonus(game: CasinoGame): boolean {
    const state = this.load();
    const keys = this.keysForGame(game);
    if (!(state[keys.comeback] as boolean)) return false;
    const next: StreakState = { ...state, [keys.comeback]: false as never };
    this.save(next);
    return true;
  }

  /** Đóng popup comeback (player đã xem) — clear flag pending nếu muốn (tùy thiết kế).
   * Ở đây ta KHÔNG clear: flag chỉ clear khi consume thực (win ván sau hoặc khi recordLoss
   * mới crossing 3 lần nữa). UI gọi markComebackSeen để tránh re-popup ngay.
   */
  static markComebackSeen(_game: CasinoGame): void {
    // No-op: comeback flag chỉ clear khi consume hoặc bị set lại bởi recordLoss.
    // UI sẽ tự quản local "đã hiện ván này" bằng useState.
  }

  static shouldShowWelcomeBack(): boolean {
    const state = this.load();
    if (state.lastWelcomeBackTs === null) return true;
    return Date.now() - state.lastWelcomeBackTs > WELCOME_BACK_THRESHOLD_MS;
  }

  static markWelcomeBackShown(): void {
    const state = this.load();
    this.save({ ...state, lastWelcomeBackTs: Date.now() });
  }
}
