// Happy Hour Service
// Mỗi ngày có 1 khung giờ Happy Hour ngẫu nhiên (deterministic theo ngày),
// kéo dài 30 phút. Trong khung giờ này mọi game cờ bạc x2 thưởng.

const HAPPY_HOUR_DURATION_MIN = 30;

export class HappyHourService {
  // Tính day-of-year cho 1 Date (1..366)
  private static dayOfYear(d: Date): number {
    const start = new Date(d.getFullYear(), 0, 0);
    const diff = d.getTime() - start.getTime();
    return Math.floor(diff / (1000 * 60 * 60 * 24));
  }

  // Giờ bắt đầu Happy Hour cho 1 ngày (0..23) — deterministic
  static getHourForDay(d: Date): number {
    const doy = this.dayOfYear(d);
    return (doy * 7) % 24;
  }

  // Trả về thời điểm bắt đầu Happy Hour của hôm nay
  static getTodayStart(): Date {
    const now = new Date();
    const hour = this.getHourForDay(now);
    return new Date(now.getFullYear(), now.getMonth(), now.getDate(), hour, 0, 0, 0);
  }

  // Trả về thời điểm kết thúc Happy Hour của hôm nay
  static getTodayEnd(): Date {
    const start = this.getTodayStart();
    return new Date(start.getTime() + HAPPY_HOUR_DURATION_MIN * 60 * 1000);
  }

  static isActive(): boolean {
    const now = Date.now();
    return now >= this.getTodayStart().getTime() && now < this.getTodayEnd().getTime();
  }

  static getMultiplier(): number {
    return this.isActive() ? 2 : 1;
  }

  static getRemainingSec(): number | null {
    if (!this.isActive()) return null;
    return Math.max(0, Math.floor((this.getTodayEnd().getTime() - Date.now()) / 1000));
  }

  // Thời điểm bắt đầu kế tiếp (hôm nay nếu chưa qua, không thì ngày mai)
  static getNextStartTime(): Date {
    const start = this.getTodayStart();
    if (Date.now() < start.getTime()) return start;
    // Ngày mai
    const tomorrow = new Date(start);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const hour = this.getHourForDay(tomorrow);
    return new Date(tomorrow.getFullYear(), tomorrow.getMonth(), tomorrow.getDate(), hour, 0, 0, 0);
  }

  // Số phút tới khi bắt đầu kế tiếp (chỉ có nghĩa khi !isActive)
  static getMinutesUntilStart(): number {
    return Math.max(0, Math.floor((this.getNextStartTime().getTime() - Date.now()) / 60000));
  }

  // Cho UI biết để hiển thông tin liên quan
  static getStartLabel(): string {
    const t = this.getNextStartTime();
    const hh = String(t.getHours()).padStart(2, '0');
    const mm = String(t.getMinutes()).padStart(2, '0');
    return `${hh}:${mm}`;
  }
}
