import { BUILD_VERSION } from '../build-version';

/**
 * Update Reward — sau mỗi lần app nâng cấp lên version mới, user nhận
 * 1 phần quà ngẫu nhiên (50–5000 xu, EV ~1200).
 *
 * Cách hoạt động:
 *  1. localStorage lưu `update_reward_seen_version` = BUILD_VERSION mà user
 *     đã nhận thưởng cho.
 *  2. Khi app khởi động + đã login:
 *     - Nếu chưa có key → user lần đầu chơi → KHÔNG thưởng, chỉ mark
 *       BUILD_VERSION hiện tại (welcome bonus đã có riêng).
 *     - Nếu có key và != BUILD_VERSION → user đã từng dùng version cũ →
 *       eligible → bật modal Quà Update.
 *  3. Sau khi claim, ghi lại BUILD_VERSION → ngăn double-claim.
 */

export interface UpdateRewardTier {
  prob: number; // %
  coins: number;
  label: string;
  emoji: string;
  color: string;
}

// EV = 1202.5 xu (kiểm tra: 0.05×50 + 0.15×100 + 0.20×500 + 0.25×1000 + 0.15×1500
//                  + 0.12×2500 + 0.06×3500 + 0.02×5000)
export const UPDATE_REWARD_TIERS: UpdateRewardTier[] = [
  { prob: 5,  coins: 50,   label: 'Quà Nhỏ',     emoji: '🎀', color: '#95a5a6' },
  { prob: 15, coins: 100,  label: 'Quà Đồng',    emoji: '🥉', color: '#cd7f32' },
  { prob: 20, coins: 500,  label: 'Quà Bạc',     emoji: '🥈', color: '#bdc3c7' },
  { prob: 25, coins: 1000, label: 'Quà Vàng',    emoji: '🥇', color: '#f1c40f' },
  { prob: 15, coins: 1500, label: 'Bạch Kim',    emoji: '💎', color: '#3498db' },
  { prob: 12, coins: 2500, label: 'Siêu Phẩm',   emoji: '🌟', color: '#9b59b6' },
  { prob: 6,  coins: 3500, label: 'Báu Vật',     emoji: '👑', color: '#e67e22' },
  { prob: 2,  coins: 5000, label: 'JACKPOT',     emoji: '💰', color: '#e74c3c' },
];

export interface RolledReward {
  tier: UpdateRewardTier;
}

export class UpdateRewardService {
  private static readonly KEY = 'update_reward_seen_version';

  /** Có quà chưa nhận không? */
  static isEligible(): boolean {
    if (typeof window === 'undefined') return false;
    const last = localStorage.getItem(this.KEY);
    if (!last) {
      // Lần đầu vào app → mark version hiện tại, không thưởng (welcome bonus riêng).
      localStorage.setItem(this.KEY, BUILD_VERSION);
      return false;
    }
    return last !== BUILD_VERSION;
  }

  /** Pre-roll quà — gọi 1 lần khi mở modal. */
  static roll(): RolledReward {
    const r = Math.random() * 100;
    let cumul = 0;
    for (const tier of UPDATE_REWARD_TIERS) {
      cumul += tier.prob;
      if (r < cumul) return { tier };
    }
    return { tier: UPDATE_REWARD_TIERS[0] };
  }

  /** Đánh dấu đã nhận quà cho BUILD_VERSION hiện tại. */
  static markClaimed(): void {
    if (typeof window === 'undefined') return;
    localStorage.setItem(this.KEY, BUILD_VERSION);
  }

  /** Dùng cho debug: reset để claim lại. */
  static reset(): void {
    if (typeof window === 'undefined') return;
    localStorage.removeItem(this.KEY);
  }
}
