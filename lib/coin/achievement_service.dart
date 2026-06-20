// achievement_service.dart — Hệ thống huy hiệu thành tích
//
// Achievements được unlock 1 lần và lưu local + sync Supabase
// Badge hiển thị trong Shop hoặc Profile sau này

import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'coin_service.dart';

// =============================================================================
// ACHIEVEMENT DEFINITIONS
// =============================================================================

class Achievement {
  final String key;
  final String title;
  final String description;
  final String emoji;
  final int coinReward;

  const Achievement({
    required this.key,
    required this.title,
    required this.description,
    required this.emoji,
    required this.coinReward,
  });
}

const kAchievements = <Achievement>[
  Achievement(
    key: 'first_game',
    title: 'Khởi đầu!',
    description: 'Chơi game đầu tiên',
    emoji: '🎮',
    coinReward: 50,
  ),
  Achievement(
    key: 'first_gambling_win',
    title: 'Vận đỏ!',
    description: 'Thắng game may mắn đầu tiên',
    emoji: '🎰',
    coinReward: 100,
  ),
  Achievement(
    key: 'play_all_lucky',
    title: 'Cờ bạc thủ',
    description: 'Chơi cả 3 game may mắn',
    emoji: '♠️',
    coinReward: 150,
  ),
  Achievement(
    key: 'streak_7',
    title: 'Thánh Chuỗi',
    description: 'Điểm danh 7 ngày liên tiếp',
    emoji: '🔥',
    coinReward: 200,
  ),
  Achievement(
    key: 'play_10_games',
    title: 'Đa Tài',
    description: 'Chơi 10 game khác nhau',
    emoji: '🌟',
    coinReward: 200,
  ),
  Achievement(
    key: 'play_all_games',
    title: 'Bộ Sưu Tập Đầy Đủ',
    description: 'Chơi tất cả 18 game',
    emoji: '🏆',
    coinReward: 500,
  ),
  Achievement(
    key: 'balance_1000',
    title: 'Phú Gia',
    description: 'Tích lũy 1.000 xu',
    emoji: '💰',
    coinReward: 100,
  ),
  Achievement(
    key: 'balance_10000',
    title: 'Triệu Phú',
    description: 'Tích lũy 10.000 xu',
    emoji: '💎',
    coinReward: 500,
  ),
  Achievement(
    key: 'open_lucky_box',
    title: 'Thử Vận May',
    description: 'Mở hộp may mắn đầu tiên',
    emoji: '🎁',
    coinReward: 50,
  ),
  Achievement(
    key: 'jackpot',
    title: 'JACKPOT!',
    description: 'Trúng jackpot từ hộp may mắn',
    emoji: '🌈',
    coinReward: 300,
  ),
];

// =============================================================================
// ACHIEVEMENT SERVICE
// =============================================================================

class AchievementService {
  AchievementService._();
  static final AchievementService instance = AchievementService._();

  static const _kEarned = 'achievements_earned';

  Set<String> _earned = {};

  final ValueNotifier<Set<String>> notifier = ValueNotifier({});

  // ── Init ──────────────────────────────────────────────────────────────────

  Future<void> init() async {
    final prefs = await SharedPreferences.getInstance();
    try {
      final json = prefs.getString(_kEarned) ?? '[]';
      _earned = Set<String>.from(jsonDecode(json) as List);
    } catch (_) {
      _earned = {};
    }
    _notify();
  }

  // ── Check & Unlock ────────────────────────────────────────────────────────

  bool isEarned(String key) => _earned.contains(key);

  /// Unlock achievement (nếu chưa có). Trả về achievement nếu mới unlock, null nếu đã có.
  Future<Achievement?> unlock(String key) async {
    if (_earned.contains(key)) return null;

    final achievement = kAchievements.firstWhere(
      (a) => a.key == key,
      orElse: () => const Achievement(
          key: '', title: '', description: '', emoji: '', coinReward: 0),
    );
    if (achievement.key.isEmpty) return null;

    _earned.add(key);
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_kEarned, jsonEncode(_earned.toList()));

    // Cộng xu thưởng
    if (achievement.coinReward > 0) {
      await CoinService.instance.earnCoins(achievement.coinReward);
    }

    _notify();
    return achievement;
  }

  void _notify() => notifier.value = Set.unmodifiable(_earned);

  // ── Auto-Check helpers ────────────────────────────────────────────────────

  Future<List<Achievement>> checkAfterGamePlayed({
    required int totalGamesPlayed,
    required Set<String> uniqueGamesPlayed,
    required int balance,
  }) async {
    final unlocked = <Achievement>[];

    if (totalGamesPlayed >= 1) {
      final a = await unlock('first_game');
      if (a != null) unlocked.add(a);
    }
    if (uniqueGamesPlayed.length >= 10) {
      final a = await unlock('play_10_games');
      if (a != null) unlocked.add(a);
    }
    if (uniqueGamesPlayed.length >= 18) {
      final a = await unlock('play_all_games');
      if (a != null) unlocked.add(a);
    }
    if (balance >= 1000) {
      final a = await unlock('balance_1000');
      if (a != null) unlocked.add(a);
    }
    if (balance >= 10000) {
      final a = await unlock('balance_10000');
      if (a != null) unlocked.add(a);
    }

    return unlocked;
  }

  Future<List<Achievement>> checkAfterGamblingWin({
    required Set<String> luckyGamesPlayed,
  }) async {
    final unlocked = <Achievement>[];

    final a1 = await unlock('first_gambling_win');
    if (a1 != null) unlocked.add(a1);

    final luckyNames = {'Bầu Cua', 'Đỏ Đen', 'Xì Jack'};
    if (luckyGamesPlayed.containsAll(luckyNames)) {
      final a2 = await unlock('play_all_lucky');
      if (a2 != null) unlocked.add(a2);
    }

    return unlocked;
  }

  Future<Achievement?> checkStreak7() => unlock('streak_7');

  Future<Achievement?> checkLuckyBoxOpened() => unlock('open_lucky_box');

  Future<Achievement?> checkJackpot() => unlock('jackpot');
}
