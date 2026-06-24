import { BUILD_VERSION } from '../build-version';

/**
 * VersionService — phát hiện deploy mới và bắt buộc reload.
 *
 * Cách hoạt động:
 *  1. Build process (scripts/gen-version.js) sinh `public/version.json` và
 *     `src/build-version.ts` với cùng 1 BUILD_VERSION (ms epoch).
 *  2. Client bundle hiện tại có hằng BUILD_VERSION baked vào JS.
 *  3. Sau khi mount, poll `/version.json` mỗi POLL_INTERVAL_MS giây.
 *     Khi server.version !== BUILD_VERSION → có deploy mới → fire listener.
 *  4. UI hiện modal không-đóng-được → user nhấn "Cập nhật ngay" → reload.
 */
export type UpdateAvailableListener = (serverVersion: string) => void;

export class VersionService {
  private static readonly POLL_INTERVAL_MS = 60_000; // 60s

  private static currentVersion: string = BUILD_VERSION;
  private static serverVersion: string | null = null;
  private static listeners: UpdateAvailableListener[] = [];
  private static pollTimer: number | null = null;
  private static started = false;

  /** Build version đang chạy ở client (lúc bundle). */
  static getClientVersion(): string {
    return this.currentVersion;
  }

  /** Bắt đầu polling. Idempotent — gọi nhiều lần OK. */
  static start(): void {
    if (this.started) return;
    this.started = true;
    // Check ngay lập tức, sau đó poll mỗi 60s.
    void this.poll();
    this.pollTimer = window.setInterval(() => {
      void this.poll();
    }, this.POLL_INTERVAL_MS);

    // Khi tab visible lại → check ngay (user quay lại sau khi để mở lâu)
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') void this.poll();
    });
  }

  static stop(): void {
    if (this.pollTimer !== null) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
    this.started = false;
  }

  /** Listener nhận callback khi phát hiện server có version mới. */
  static onUpdateAvailable(fn: UpdateAvailableListener): () => void {
    this.listeners.push(fn);
    // Nếu đã phát hiện trước đó → emit ngay cho subscriber mới
    if (this.serverVersion && this.serverVersion !== this.currentVersion) {
      fn(this.serverVersion);
    }
    return () => {
      this.listeners = this.listeners.filter((l) => l !== fn);
    };
  }

  /** Buộc reload — clear cache nếu trình duyệt hỗ trợ. */
  static forceReload(): void {
    const reload = () => window.location.reload();
    // Nếu service worker đang cache → đăng ký xoá cache trước khi reload.
    const hasCaches = typeof window !== 'undefined' && 'caches' in window;
    if (hasCaches) {
      caches.keys()
        .then((keys) => Promise.all(keys.map((k) => caches.delete(k))))
        .finally(reload);
      return;
    }
    reload();
  }

  private static async poll(): Promise<void> {
    try {
      // Cache-bust query string đảm bảo lấy file mới nhất từ CDN.
      const res = await fetch(`/version.json?t=${Date.now()}`, { cache: 'no-store' });
      if (!res.ok) return;
      const data = await res.json();
      const v = String(data.version);
      this.serverVersion = v;
      if (v !== this.currentVersion) {
        for (const fn of this.listeners) fn(v);
      }
    } catch {
      // Network errors → silently skip; sẽ poll lại sau.
    }
  }
}
