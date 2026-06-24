// coin_service.dart — Quản lý toàn bộ hệ thống xu của Super Gate
//
// Kiến trúc:
//   • CoinData          — Snapshot trạng thái hiện tại (immutable)
//   • DailyRewardInfo   — Thông tin cho dialog điểm danh hàng ngày
//   • MissionStatus     — Trạng thái nhiệm vụ ngày hôm nay
//   • CoinService       — Singleton: business logic + SharedPreferences + Supabase sync

import 'dart:async';
import 'dart:convert';
import 'dart:math';
import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../auth/auth_service.dart';
import '../auth/player_model.dart';

// =============================================================================
// DATA MODELS
// =============================================================================

class CoinData {
  final int balance;
  final int streakDay;           // 1–7 (ngày hiện tại trong chu kỳ), 0 = chưa bắt đầu
  final int shieldCount;         // Số lá chắn streak còn lại
  final bool boosterActive;      // Coin x2 có đang chạy không
  final DateTime? boosterExpiry;
  final Set<String> gamesPlayedToday;
  final bool mission3Collected;
  final bool mission5Collected;
  final bool dailyClaimedToday;
  final int freeLuckyBoxes;      // Hộp may mắn miễn phí còn lại (new player gift)
  final int totalGamesPlayed;    // Tổng số game đã chơi
  final List<String> ownedFrames; // Các khung viền đã mua
  final String activeFrame;      // Khung viền đang đeo
  final String lastWheelSpinDate;// Ngày quay vòng quay miễn phí gần nhất

  const CoinData({
    required this.balance,
    required this.streakDay,
    required this.shieldCount,
    required this.boosterActive,
    this.boosterExpiry,
    required this.gamesPlayedToday,
    required this.mission3Collected,
    required this.mission5Collected,
    required this.dailyClaimedToday,
    required this.freeLuckyBoxes,
    required this.totalGamesPlayed,
    required this.ownedFrames,
    required this.activeFrame,
    required this.lastWheelSpinDate,
  });

  int get gamesCount => gamesPlayedToday.length;
  int get multiplier => boosterActive ? 2 : 1;

  double get streakMultiplier {
    if (streakDay >= 7) return 2.0;
    if (streakDay >= 5) return 1.5;
    if (streakDay >= 3) return 1.2;
    return 1.0;
  }

  Duration get boosterRemaining =>
      boosterActive && boosterExpiry != null
          ? boosterExpiry!.difference(DateTime.now())
          : Duration.zero;
}

class DailyRewardInfo {
  final bool shouldShow;
  final int todayStreakDay;
  final bool streakWasReset;
  final bool shieldWillBeUsed;
  final int baseReward;
  final bool boosterActive;

  int get actualReward => baseReward * (boosterActive ? 2 : 1);

  static const List<int> rewardTable = [50, 75, 100, 125, 150, 200, 300];

  const DailyRewardInfo({
    required this.shouldShow,
    required this.todayStreakDay,
    required this.streakWasReset,
    required this.shieldWillBeUsed,
    required this.baseReward,
    required this.boosterActive,
  });
}

class MissionStatus {
  final int gamesPlayedCount;
  final bool mission3Collected;
  final bool mission5Collected;

  const MissionStatus({
    required this.gamesPlayedCount,
    required this.mission3Collected,
    required this.mission5Collected,
  });

  bool get mission3Eligible => gamesPlayedCount >= 3 && !mission3Collected;
  bool get mission5Eligible => gamesPlayedCount >= 5 && !mission5Collected;
  bool get allDone => mission3Collected && mission5Collected;
}

// =============================================================================
// COIN SERVICE
// =============================================================================

class CoinService {
  CoinService._();
  static final CoinService instance = CoinService._();

  // ── SharedPreferences Keys ──────────────────────────────────────────────
  static const _kBalance          = 'coin_balance';
  static const _kStreakDay        = 'coin_streak_day';
  static const _kLastClaimDate    = 'coin_streak_last_claim_date';
  static const _kShieldCount      = 'coin_shield_count';
  static const _kBoosterExpiry    = 'coin_booster_expiry_ms';
  static const _kGamesPlayed      = 'coin_games_played_today';
  static const _kGamesDate        = 'coin_games_played_date';
  static const _kMission3Date     = 'coin_mission3_collected_date';
  static const _kMission5Date     = 'coin_mission5_collected_date';
  static const _kFreeLuckyBoxes   = 'coin_free_lucky_boxes';
  static const _kTotalGamesPlayed = 'coin_total_games_played';
  static const _kIsNewPlayer      = 'player_is_new';   // bool: false sau onboarding
  static const _kOwnedFrames       = 'coin_owned_avatar_frames';
  static const _kActiveFrame       = 'coin_active_avatar_frame';
  static const _kLastWheelSpinDate = 'coin_last_wheel_spin_date';

  // ── In-memory cache ─────────────────────────────────────────────────────
  int _balance = 0;
  int _streakDay = 0;
  String _lastClaimDate = '';
  int _shieldCount = 0;
  DateTime? _boosterExpiry;
  Set<String> _gamesPlayedToday = {};
  String _gamesDate = '';
  String _mission3Date = '';
  String _mission5Date = '';
  int _freeLuckyBoxes = 0;
  int _totalGamesPlayed = 0;
  List<String> _ownedFrames = ['none'];
  String _activeFrame = 'none';
  String _lastWheelSpinDate = '';

  // ── Sync debounce ────────────────────────────────────────────────────────
  Timer? _syncTimer;

  // ── Notifier cho UI rebuild ──────────────────────────────────────────────
  final ValueNotifier<CoinData> notifier = ValueNotifier<CoinData>(
    const CoinData(
      balance: 0,
      streakDay: 0,
      shieldCount: 0,
      boosterActive: false,
      gamesPlayedToday: {},
      mission3Collected: false,
      mission5Collected: false,
      dailyClaimedToday: false,
      freeLuckyBoxes: 0,
      totalGamesPlayed: 0,
      ownedFrames: ['none'],
      activeFrame: 'none',
      lastWheelSpinDate: '',
    ),
  );

  // ── Helpers ──────────────────────────────────────────────────────────────

  String _todayStr() {
    final now = DateTime.now().toLocal();
    return '${now.year}-${now.month.toString().padLeft(2, '0')}-${now.day.toString().padLeft(2, '0')}';
  }

  bool get _boosterActive =>
      _boosterExpiry != null && _boosterExpiry!.isAfter(DateTime.now());

  double get streakMultiplier {
    if (_streakDay >= 7) return 2.0;
    if (_streakDay >= 5) return 1.5;
    if (_streakDay >= 3) return 1.2;
    return 1.0;
  }

  bool _missionCollected(String missionDate) => missionDate == _todayStr();

  CoinData _buildData() => CoinData(
        balance: _balance,
        streakDay: _streakDay,
        shieldCount: _shieldCount,
        boosterActive: _boosterActive,
        boosterExpiry: _boosterExpiry,
        gamesPlayedToday: Set.unmodifiable(_gamesPlayedToday),
        mission3Collected: _missionCollected(_mission3Date),
        mission5Collected: _missionCollected(_mission5Date),
        dailyClaimedToday: _lastClaimDate == _todayStr(),
        freeLuckyBoxes: _freeLuckyBoxes,
        totalGamesPlayed: _totalGamesPlayed,
        ownedFrames: List.unmodifiable(_ownedFrames),
        activeFrame: _activeFrame,
        lastWheelSpinDate: _lastWheelSpinDate,
      );

  void _notify() => notifier.value = _buildData();

  // ── Supabase sync (debounced 3s) ─────────────────────────────────────────

  void _scheduleSync() {
    _syncTimer?.cancel();
    _syncTimer = Timer(const Duration(seconds: 3), _syncToSupabase);
  }

  Future<void> _syncToSupabase() async {
    await AuthService.instance.syncCoinData(
      balance: _balance,
      freeLuckyBoxes: _freeLuckyBoxes,
      streakDay: _streakDay,
      streakLastClaimDate: _lastClaimDate.isEmpty ? null : _lastClaimDate,
      shieldCount: _shieldCount,
      boosterExpiry: _boosterExpiry,
      gamesPlayedToday: _gamesPlayedToday.toList(),
      gamesPlayedDate: _gamesDate.isEmpty ? null : _gamesDate,
      mission3Date: _mission3Date.isEmpty ? null : _mission3Date,
      mission5Date: _mission5Date.isEmpty ? null : _mission5Date,
      totalGamesPlayed: _totalGamesPlayed,
    );
  }

  // ── Init ─────────────────────────────────────────────────────────────────

  String _dateStr(DateTime? dt) {
    if (dt == null) return '';
    final d = dt.toLocal();
    return '${d.year}-${d.month.toString().padLeft(2, '0')}-${d.day.toString().padLeft(2, '0')}';
  }

  /// Load toàn bộ coin data từ PlayerModel (Supabase source of truth) và cache vào prefs
  Future<void> _loadFromPlayer(PlayerModel player, SharedPreferences prefs) async {
    final today = _todayStr();

    _balance          = player.coinBalance;
    _streakDay        = player.streakDay;
    _lastClaimDate    = _dateStr(player.streakLastClaimDate);
    _shieldCount      = player.shieldCount;
    _boosterExpiry    = player.boosterExpiryAt;
    _freeLuckyBoxes   = player.freeLuckyBoxes;
    _totalGamesPlayed = player.totalGamesPlayed;

    _activeFrame       = prefs.getString(_kActiveFrame) ?? 'none';
    _lastWheelSpinDate = prefs.getString(_kLastWheelSpinDate) ?? '';
    try {
      final json = prefs.getString(_kOwnedFrames) ?? '["none"]';
      _ownedFrames = List<String>.from(jsonDecode(json) as List);
    } catch (_) {
      _ownedFrames = ['none'];
    }

    // Ghi vào prefs để cache local
    await prefs.setInt(_kBalance, _balance);
    await prefs.setInt(_kFreeLuckyBoxes, _freeLuckyBoxes);
    await prefs.setInt(_kStreakDay, _streakDay);
    await prefs.setString(_kLastClaimDate, _lastClaimDate);
    await prefs.setInt(_kShieldCount, _shieldCount);
    if (_boosterExpiry != null) {
      await prefs.setInt(_kBoosterExpiry, _boosterExpiry!.millisecondsSinceEpoch);
    } else {
      await prefs.remove(_kBoosterExpiry);
    }
    await prefs.setString(_kGamesDate, _gamesDate);
    await prefs.setString(_kGamesPlayed, jsonEncode(_gamesPlayedToday.toList()));
    await prefs.setString(_kMission3Date, _mission3Date);
    await prefs.setString(_kMission5Date, _mission5Date);
    await prefs.setInt(_kTotalGamesPlayed, _totalGamesPlayed);
    await prefs.setString(_kActiveFrame, _activeFrame);
    await prefs.setString(_kLastWheelSpinDate, _lastWheelSpinDate);
    await prefs.setString(_kOwnedFrames, jsonEncode(_ownedFrames));
    await prefs.setBool(_kIsNewPlayer, false);
  }

  /// Gọi sau AuthService.init() trong main()
  Future<void> init({bool isNewPlayer = false}) async {
    final prefs = await SharedPreferences.getInstance();

    // Người chơi mới: cấp 500 xu + 3 hộp miễn phí
    final wasNew = prefs.getBool(_kIsNewPlayer) ?? true;
    if (wasNew && isNewPlayer) {
      await _initNewPlayer(prefs);
      return;
    }

    // Ưu tiên load từ Supabase (source of truth) nếu đã đăng nhập
    final player = AuthService.instance.player;
    if (player != null) {
      await _loadFromPlayer(player, prefs);
      _notify();
      return;
    }

    // Fallback: load từ local prefs (offline / chưa có player)
    _balance          = prefs.getInt(_kBalance) ?? 0;
    _streakDay        = prefs.getInt(_kStreakDay) ?? 0;
    _lastClaimDate    = prefs.getString(_kLastClaimDate) ?? '';
    _shieldCount      = prefs.getInt(_kShieldCount) ?? 0;
    _mission3Date     = prefs.getString(_kMission3Date) ?? '';
    _mission5Date     = prefs.getString(_kMission5Date) ?? '';
    _freeLuckyBoxes   = prefs.getInt(_kFreeLuckyBoxes) ?? 0;
    _totalGamesPlayed = prefs.getInt(_kTotalGamesPlayed) ?? 0;
    _activeFrame      = prefs.getString(_kActiveFrame) ?? 'none';
    _lastWheelSpinDate = prefs.getString(_kLastWheelSpinDate) ?? '';
    try {
      final json = prefs.getString(_kOwnedFrames) ?? '["none"]';
      _ownedFrames = List<String>.from(jsonDecode(json) as List);
    } catch (_) {
      _ownedFrames = ['none'];
    }

    // Booster
    final boosterMs = prefs.getInt(_kBoosterExpiry) ?? 0;
    if (boosterMs > 0) {
      _boosterExpiry = DateTime.fromMillisecondsSinceEpoch(boosterMs);
      if (!_boosterActive) {
        _boosterExpiry = null;
        await prefs.remove(_kBoosterExpiry);
      }
    }

    // Reset daily game data nếu ngày mới
    final today = _todayStr();
    _gamesDate = prefs.getString(_kGamesDate) ?? '';
    if (_gamesDate != today) {
      _gamesPlayedToday = {};
      _gamesDate = today;
      await prefs.setString(_kGamesDate, today);
      await prefs.remove(_kGamesPlayed);
    } else {
      try {
        final json = prefs.getString(_kGamesPlayed) ?? '[]';
        _gamesPlayedToday = Set<String>.from(jsonDecode(json) as List);
      } catch (_) {
        _gamesPlayedToday = {};
      }
    }

    _notify();
  }

  /// Refresh data từ Supabase (dùng cho pull-to-refresh)
  Future<void> refreshFromSupabase() async {
    final player = await AuthService.instance.loadPlayerFromSupabase();
    if (player == null) return;
    final prefs = await SharedPreferences.getInstance();
    await _loadFromPlayer(player, prefs);
    _notify();
  }

  /// Xóa toàn bộ local data khi đăng xuất
  Future<void> clearLocalData() async {
    _syncTimer?.cancel();
    final prefs = await SharedPreferences.getInstance();
    for (final key in [
      _kBalance, _kStreakDay, _kLastClaimDate, _kShieldCount, _kBoosterExpiry,
      _kGamesPlayed, _kGamesDate, _kMission3Date, _kMission5Date,
      _kFreeLuckyBoxes, _kTotalGamesPlayed, _kIsNewPlayer,
      _kOwnedFrames, _kActiveFrame, _kLastWheelSpinDate,
    ]) {
      await prefs.remove(key);
    }
    _balance = 0; _streakDay = 0; _lastClaimDate = ''; _shieldCount = 0;
    _boosterExpiry = null; _gamesPlayedToday = {}; _gamesDate = '';
    _mission3Date = ''; _mission5Date = ''; _freeLuckyBoxes = 0;
    _totalGamesPlayed = 0; _ownedFrames = ['none']; _activeFrame = 'none';
    _lastWheelSpinDate = '';
    _notify();
  }

  Future<void> _initNewPlayer(SharedPreferences prefs) async {
    _balance        = 500;
    _freeLuckyBoxes = 3;
    _streakDay      = 0;
    _shieldCount    = 0;
    _gamesPlayedToday = {};
    _gamesDate      = _todayStr();
    _totalGamesPlayed = 0;
    _activeFrame    = 'none';
    _ownedFrames    = ['none'];
    _lastWheelSpinDate = '';

    await prefs.setInt(_kBalance, _balance);
    await prefs.setInt(_kFreeLuckyBoxes, _freeLuckyBoxes);
    await prefs.setInt(_kStreakDay, _streakDay);
    await prefs.setInt(_kShieldCount, _shieldCount);
    await prefs.setString(_kGamesDate, _gamesDate);
    await prefs.setInt(_kTotalGamesPlayed, _totalGamesPlayed);
    await prefs.setString(_kActiveFrame, 'none');
    await prefs.setString(_kOwnedFrames, jsonEncode(['none']));
    await prefs.setString(_kLastWheelSpinDate, '');
    await prefs.setBool(_kIsNewPlayer, false);   // Đánh dấu đã khởi tạo

    _notify();
    _scheduleSync();
  }

  /// Gọi sau onboarding hoàn thành
  Future<void> markOnboardingComplete() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool(_kIsNewPlayer, false);
    await AuthService.instance.completeOnboarding();
  }

  // ── Daily Reward ─────────────────────────────────────────────────────────

  DailyRewardInfo getDailyRewardInfo() {
    final today = _todayStr();

    if (_lastClaimDate == today) {
      return DailyRewardInfo(
        shouldShow: false,
        todayStreakDay: _streakDay,
        streakWasReset: false,
        shieldWillBeUsed: false,
        baseReward: 0,
        boosterActive: _boosterActive,
      );
    }

    int gapDays = 0;
    if (_lastClaimDate.isNotEmpty) {
      try {
        final last = DateTime.parse(_lastClaimDate);
        final now = DateTime.now().toLocal();
        final todayDate = DateTime(now.year, now.month, now.day);
        final lastDate = DateTime(last.year, last.month, last.day);
        gapDays = todayDate.difference(lastDate).inDays;
      } catch (_) {
        gapDays = 99;
      }
    } else {
      gapDays = 0;
    }

    bool streakWasReset = false;
    bool shieldWillBeUsed = false;
    int todayStreakDay;

    if (gapDays == 0 || _lastClaimDate.isEmpty) {
      todayStreakDay = 1;
    } else if (gapDays == 1) {
      todayStreakDay = (_streakDay % 7) + 1;
    } else if (gapDays == 2 && _shieldCount > 0) {
      todayStreakDay = (_streakDay % 7) + 1;
      shieldWillBeUsed = true;
    } else {
      todayStreakDay = 1;
      streakWasReset = (_streakDay > 0);
    }

    return DailyRewardInfo(
      shouldShow: true,
      todayStreakDay: todayStreakDay,
      streakWasReset: streakWasReset,
      shieldWillBeUsed: shieldWillBeUsed,
      baseReward: DailyRewardInfo.rewardTable[todayStreakDay - 1],
      boosterActive: _boosterActive,
    );
  }

  Future<int> claimDailyReward() async {
    final info = getDailyRewardInfo();
    if (!info.shouldShow) return 0;

    final prefs = await SharedPreferences.getInstance();
    final today = _todayStr();

    if (info.shieldWillBeUsed) {
      _shieldCount = (_shieldCount - 1).clamp(0, 99);
      await prefs.setInt(_kShieldCount, _shieldCount);
    }

    _streakDay = info.todayStreakDay;
    _lastClaimDate = today;
    await prefs.setInt(_kStreakDay, _streakDay);
    await prefs.setString(_kLastClaimDate, today);

    final earned = info.actualReward;
    await _addCoins(earned, prefs);

    _notify();
    _scheduleSync();
    return earned;
  }

  // ── Game Play Reward ─────────────────────────────────────────────────────

  Future<int> recordGamePlayed(String gameName) async {
    final prefs = await SharedPreferences.getInstance();

    final isFirst = !_gamesPlayedToday.contains(gameName);
    final baseEarn = isFirst ? 15 : 5;
    
    // Nhân thêm hệ số chuỗi ngày (Streak Multiplier)
    final double mult = (_boosterActive ? 2.0 : 1.0) * streakMultiplier;
    final earned = (baseEarn * mult).round();

    await _addCoins(earned, prefs);
    _gamesPlayedToday.add(gameName);
    _totalGamesPlayed++;

    await prefs.setString(_kGamesPlayed, jsonEncode(_gamesPlayedToday.toList()));
    await prefs.setInt(_kTotalGamesPlayed, _totalGamesPlayed);

    await _checkMissions(prefs);

    _notify();
    _scheduleSync();
    return earned;
  }

  Future<void> _checkMissions(SharedPreferences prefs) async {
    final today = _todayStr();

    if (_gamesPlayedToday.length >= 3 && _mission3Date != today) {
      _mission3Date = today;
      await prefs.setString(_kMission3Date, today);
      await _addCoins(100, prefs);
    }

    if (_gamesPlayedToday.length >= 5 && _mission5Date != today) {
      _mission5Date = today;
      await prefs.setString(_kMission5Date, today);
      await _addCoins(150, prefs);
    }
  }

  MissionStatus getMissionStatus() {
    final today = _todayStr();
    return MissionStatus(
      gamesPlayedCount: _gamesPlayedToday.length,
      mission3Collected: _mission3Date == today,
      mission5Collected: _mission5Date == today,
    );
  }

  // ── Shop / Spin & Cosmetics ──────────────────────────────────────────────

  /// Quay vòng quay may mắn. Trả về (xu nhận được, index segment thắng).
  /// Phí lượt quay là 30 xu nếu không miễn phí.
  ///
  /// 8 phần thưởng (khớp với LuckyWheelDialog._kSegments):
  ///   0: 20 xu    — 30%
  ///   1: 40 xu    — 20%
  ///   2: 80 xu    — 15%
  ///   3: Lá chắn  — 12%
  ///   4: Hộp MM   — 10%
  ///   5: Booster  —  7%
  ///   6: 150 xu   —  4%
  ///   7: Jackpot  —  2%
  Future<(int, int)> spinLuckyWheel({required bool isFree}) async {
    final prefs = await SharedPreferences.getInstance();
    if (!isFree) {
      if (_balance < 30) throw Exception('Không đủ xu');
      await _addCoins(-30, prefs);
    } else {
      _lastWheelSpinDate = _todayStr();
      await prefs.setString(_kLastWheelSpinDate, _lastWheelSpinDate);
    }

    final rng = Random();
    final roll = rng.nextInt(100);
    int rewardCoins = 0;
    int segmentIndex;

    if (roll < 30) {
      // 0: 20 xu
      segmentIndex = 0;
      rewardCoins = 20;
      await _addCoins(20, prefs);
    } else if (roll < 50) {
      // 1: 40 xu
      segmentIndex = 1;
      rewardCoins = 40;
      await _addCoins(40, prefs);
    } else if (roll < 65) {
      // 2: 80 xu
      segmentIndex = 2;
      rewardCoins = 80;
      await _addCoins(80, prefs);
    } else if (roll < 77) {
      // 3: Lá chắn streak
      segmentIndex = 3;
      _shieldCount++;
      await prefs.setInt(_kShieldCount, _shieldCount);
    } else if (roll < 87) {
      // 4: Hộp may mắn miễn phí
      segmentIndex = 4;
      _freeLuckyBoxes++;
      await prefs.setInt(_kFreeLuckyBoxes, _freeLuckyBoxes);
    } else if (roll < 94) {
      // 5: Booster x2 (2h)
      segmentIndex = 5;
      _boosterExpiry = DateTime.now().add(const Duration(hours: 2));
      await prefs.setInt(_kBoosterExpiry, _boosterExpiry!.millisecondsSinceEpoch);
    } else if (roll < 98) {
      // 6: 150 xu
      segmentIndex = 6;
      rewardCoins = 150;
      await _addCoins(150, prefs);
    } else {
      // 7: Jackpot 300 xu
      segmentIndex = 7;
      rewardCoins = 300;
      await _addCoins(300, prefs);
    }

    _notify();
    _scheduleSync();
    return (rewardCoins, segmentIndex);
  }

  /// Mua khung viền ảnh đại diện. Trả về true nếu thành công.
  Future<bool> buyAvatarFrame(String frameId, int price) async {
    if (_balance < price) return false;
    if (_ownedFrames.contains(frameId)) return true;

    final prefs = await SharedPreferences.getInstance();
    await _addCoins(-price, prefs);

    _ownedFrames.add(frameId);
    await prefs.setString(_kOwnedFrames, jsonEncode(_ownedFrames));

    _notify();
    _scheduleSync();
    return true;
  }

  /// Thiết lập khung viền ảnh đại diện đang kích hoạt sử dụng
  Future<void> setActiveFrame(String frameId) async {
    if (!_ownedFrames.contains(frameId) && frameId != 'none') return;
    final prefs = await SharedPreferences.getInstance();
    _activeFrame = frameId;
    await prefs.setString(_kActiveFrame, _activeFrame);
    _notify();
  }

  Future<bool> purchaseBooster() async {
    if (_balance < 300) return false;
    final prefs = await SharedPreferences.getInstance();
    await _addCoins(-300, prefs);
    _boosterExpiry = DateTime.now().add(const Duration(hours: 24));
    await prefs.setInt(_kBoosterExpiry, _boosterExpiry!.millisecondsSinceEpoch);
    _notify();
    _scheduleSync();
    return true;
  }

  /// Trả về (xu nhận được, tier). Tier: 'bronze' | 'silver' | 'gold' | 'jackpot'
  Future<(int, String)> purchaseLuckyBox() async {
    if (_balance < 100) throw Exception('Không đủ xu');
    final prefs = await SharedPreferences.getInstance();
    await _addCoins(-100, prefs);

    final result = _rollLuckyBox();
    await _addCoins(result.$1, prefs);
    _notify();
    _scheduleSync();
    return result;
  }

  /// Mở hộp may mắn miễn phí (dành cho người chơi mới)
  Future<(int, String)> openFreeLuckyBox() async {
    if (_freeLuckyBoxes <= 0) throw Exception('Hết hộp miễn phí');
    final prefs = await SharedPreferences.getInstance();

    _freeLuckyBoxes--;
    await prefs.setInt(_kFreeLuckyBoxes, _freeLuckyBoxes);

    final result = _rollLuckyBox();
    await _addCoins(result.$1, prefs);
    _notify();
    _scheduleSync();
    return result;
  }

  /// Tung xúc xắc lucky box. Tỉ lệ:
  ///   Bronze  55% → 25–60  xu  (avg 42)
  ///   Silver  28% → 60–120 xu  (avg 90)
  ///   Gold    13% → 120–250 xu (avg 185)
  ///   Jackpot  4% → 300–500 xu (avg 400)
  ///   EV ≈ 88 xu / 100 xu — house edge ~12%
  (int, String) _rollLuckyBox() {
    final rng = Random();
    final roll = rng.nextDouble();
    if (roll < 0.55) return (25 + rng.nextInt(36), 'bronze');
    if (roll < 0.83) return (60 + rng.nextInt(61), 'silver');
    if (roll < 0.96) return (120 + rng.nextInt(131), 'gold');
    return (300 + rng.nextInt(201), 'jackpot');
  }

  Future<bool> purchaseStreakShield() async {
    if (_balance < 150) return false;
    final prefs = await SharedPreferences.getInstance();
    await _addCoins(-150, prefs);
    _shieldCount++;
    await prefs.setInt(_kShieldCount, _shieldCount);
    _notify();
    _scheduleSync();
    return true;
  }

  // ── Betting (gambling games) ──────────────────────────────────────────────

  /// Trừ xu để cược. Trả về false nếu số dư không đủ.
  Future<bool> spendCoins(int amount) async {
    if (_balance < amount) return false;
    final prefs = await SharedPreferences.getInstance();
    await _addCoins(-amount, prefs);
    _notify();
    _scheduleSync();
    return true;
  }

  /// Thêm xu (thắng cược / phần thưởng).
  Future<void> earnCoins(int amount) async {
    final prefs = await SharedPreferences.getInstance();
    await _addCoins(amount, prefs);
    _notify();
    _scheduleSync();
  }

  /// Kích hoạt Booster miễn phí (không tốn xu) trong số giờ chỉ định.
  Future<void> activateFreeBooster(int hours) async {
    final prefs = await SharedPreferences.getInstance();
    _boosterExpiry = DateTime.now().add(Duration(hours: hours));
    await prefs.setInt(_kBoosterExpiry, _boosterExpiry!.millisecondsSinceEpoch);
    _notify();
    _scheduleSync();
  }

  // ── Score-Based Game Reward ──────────────────────────────────────────────

  Future<int> reportGameScore(
    String gameName, {
    int score = 0,
    bool won = false,
    int level = 0,
    int moves = 0,
    int seconds = 0,
    int lives = 0,
  }) async {
    final base = _calcCoinsForGame(
      gameName,
      score: score,
      won: won,
      level: level,
      moves: moves,
      seconds: seconds,
      lives: lives,
    );
    if (base <= 0) return 0;
    final prefs = await SharedPreferences.getInstance();
    
    // Nhân thêm hệ số chuỗi ngày (Streak Multiplier)
    final double mult = (_boosterActive ? 2.0 : 1.0) * streakMultiplier;
    final earned = (base * mult).round();

    await _addCoins(earned, prefs);
    _notify();
    _scheduleSync();
    return earned;
  }

  int _calcCoinsForGame(
    String gameName, {
    int score = 0,
    bool won = false,
    int level = 0,
    int moves = 0,
    int seconds = 0,
    int lives = 0,
  }) {
    if (gameName == 'snake') {
      if (score >= 20) return 35;
      if (score >= 10) return 20;
      if (score >= 5)  return 12;
      if (score >= 1)  return 5;
      return 0;
    }
    if (gameName == 'tetris') {
      if (level >= 7) return 35;
      if (level >= 4) return 20;
      if (level >= 2) return 12;
      if (level >= 1) return 5;
      return 0;
    }
    if (gameName == 'flappy') {
      if (score >= 20) return 40;
      if (score >= 10) return 25;
      if (score >= 5)  return 15;
      if (score >= 1)  return 5;
      return 0;
    }
    if (gameName == 'memory') {
      if (!won) return 0;
      final pairs = (level * level) ~/ 2;
      final extra = moves - pairs;
      if (extra <= 0) return 30;
      if (extra <= pairs) return 20;
      return 10;
    }
    if (gameName == 'wordle') {
      if (!won) return 0;
      if (level <= 1) return 50;
      if (level <= 2) return 40;
      if (level <= 3) return 30;
      if (level <= 4) return 20;
      if (level <= 5) return 15;
      return 10;
    }
    if (gameName == 'whack_mole') {
      if (score >= 35) return 30;
      if (score >= 20) return 20;
      if (score >= 10) return 12;
      if (score >= 1)  return 5;
      return 0;
    }
    if (gameName == 'simon') {
      if (score >= 15) return 35;
      if (score >= 10) return 20;
      if (score >= 5)  return 12;
      if (score >= 1)  return 5;
      return 0;
    }
    if (gameName == 'sliding_puzzle') {
      if (!won) return 0;
      final base = level >= 4 ? 25 : 15;
      final optimal = level >= 4 ? 50 : 20;
      if (moves <= optimal) return base + 10;
      if (moves <= optimal * 2) return base;
      return (base - 5).clamp(5, 99);
    }
    if (gameName == 'mastermind') {
      if (!won) return 0;
      final base = [10, 20, 35][level.clamp(0, 2)];
      return moves <= 3 ? base + 10 : base;
    }
    if (gameName == 'minesweeper') {
      if (!won) return 0;
      final base = [15, 25, 40][level.clamp(0, 2)];
      final thresholds = [30, 60, 120];
      return seconds < thresholds[level.clamp(0, 2)] ? base + 10 : base;
    }
    if (gameName == 'brick_breaker') {
      if (score >= 500) return 30 + lives * 3;
      if (score >= 200) return 20 + lives * 2;
      if (score >= 50)  return 10 + lives;
      if (score >= 1)   return 5;
      return 0;
    }
    if (gameName == 'tictactoe') {
      if (!won) return 0;
      return level >= 5 ? 20 : 10;
    }
    if (gameName == 'ninja_fruit') {
      if (score >= 100) return 35;
      if (score >= 50)  return 20;
      if (score >= 20)  return 12;
      if (score >= 5)   return 5;
      return 0;
    }
    if (gameName == 'sudoku') {
      if (!won) return 0;
      return [15, 25, 40][level.clamp(0, 2)];
    }
    if (gameName == '2048') {
      if (won) return 50;
      if (score >= 1024) return 25;
      if (score >= 512)  return 15;
      if (score >= 256)  return 8;
      return 0;
    }
    return 0;
  }

  // ── Internal ─────────────────────────────────────────────────────────────

  Future<void> _addCoins(int amount, SharedPreferences prefs) async {
    _balance = (_balance + amount).clamp(0, 9999999);
    await prefs.setInt(_kBalance, _balance);
  }

  Future<void> debugAddCoins(int amount) async {
    final prefs = await SharedPreferences.getInstance();
    await _addCoins(amount, prefs);
    _notify();
  }
}
