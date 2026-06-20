// weekly_mission_service.dart — Nhiệm vụ tuần: chơi ít nhất 1 game/nhóm
//
// Reward: +500 xu khi hoàn thành cả 4 nhóm trong 1 tuần

import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../home/game_entry.dart';
import 'coin_service.dart';

// =============================================================================
// DATA MODEL
// =============================================================================

class WeeklyMissionData {
  final Set<GameCategory> categoriesDone;
  final bool categoryRewardClaimed;
  final int gamblingWinsThisWeek;
  final bool gamblingRewardClaimed;
  final String weekStartDate;

  const WeeklyMissionData({
    required this.categoriesDone,
    required this.categoryRewardClaimed,
    required this.gamblingWinsThisWeek,
    required this.gamblingRewardClaimed,
    required this.weekStartDate,
  });

  bool get allCategoriesDone => categoriesDone.length >= 4;
  int get categoriesCompleted => categoriesDone.length;
}

// =============================================================================
// WEEKLY MISSION SERVICE
// =============================================================================

class WeeklyMissionService {
  WeeklyMissionService._();
  static final WeeklyMissionService instance = WeeklyMissionService._();

  static const _kWeekStart        = 'weekly_week_start';
  static const _kCatsDone         = 'weekly_categories_done';
  static const _kCatRewardClaimed = 'weekly_cat_reward_claimed';
  static const _kGamblingWins     = 'weekly_gambling_wins';
  static const _kGamRewardClaimed = 'weekly_gam_reward_claimed';

  // ── In-memory ─────────────────────────────────────────────────────────────
  Set<GameCategory> _categoriesDone = {};
  bool _categoryRewardClaimed = false;
  int _gamblingWins = 0;
  bool _gamblingRewardClaimed = false;
  String _weekStart = '';

  final ValueNotifier<WeeklyMissionData> notifier = ValueNotifier(
    const WeeklyMissionData(
      categoriesDone: {},
      categoryRewardClaimed: false,
      gamblingWinsThisWeek: 0,
      gamblingRewardClaimed: false,
      weekStartDate: '',
    ),
  );

  // ── Helpers ───────────────────────────────────────────────────────────────

  /// Monday của tuần hiện tại (ISO 8601)
  String _currentWeekStart() {
    final now = DateTime.now().toLocal();
    final monday = now.subtract(Duration(days: now.weekday - 1));
    return '${monday.year}-${monday.month.toString().padLeft(2, '0')}-${monday.day.toString().padLeft(2, '0')}';
  }

  WeeklyMissionData _buildData() => WeeklyMissionData(
        categoriesDone: Set.unmodifiable(_categoriesDone),
        categoryRewardClaimed: _categoryRewardClaimed,
        gamblingWinsThisWeek: _gamblingWins,
        gamblingRewardClaimed: _gamblingRewardClaimed,
        weekStartDate: _weekStart,
      );

  void _notify() => notifier.value = _buildData();

  // ── Init ──────────────────────────────────────────────────────────────────

  Future<void> init() async {
    final prefs = await SharedPreferences.getInstance();
    final currentWeek = _currentWeekStart();
    final savedWeek = prefs.getString(_kWeekStart) ?? '';

    if (savedWeek != currentWeek) {
      // Tuần mới → reset
      _categoriesDone = {};
      _categoryRewardClaimed = false;
      _gamblingWins = 0;
      _gamblingRewardClaimed = false;
      _weekStart = currentWeek;

      await prefs.setString(_kWeekStart, currentWeek);
      await prefs.remove(_kCatsDone);
      await prefs.setBool(_kCatRewardClaimed, false);
      await prefs.setInt(_kGamblingWins, 0);
      await prefs.setBool(_kGamRewardClaimed, false);
    } else {
      _weekStart = savedWeek;
      _categoryRewardClaimed = prefs.getBool(_kCatRewardClaimed) ?? false;
      _gamblingRewardClaimed = prefs.getBool(_kGamRewardClaimed) ?? false;
      _gamblingWins = prefs.getInt(_kGamblingWins) ?? 0;

      try {
        final json = prefs.getString(_kCatsDone) ?? '[]';
        final list = (jsonDecode(json) as List).cast<String>();
        _categoriesDone = list
            .map((s) => GameCategory.values.firstWhere(
                  (c) => c.name == s,
                  orElse: () => GameCategory.puzzle,
                ))
            .toSet();
      } catch (_) {
        _categoriesDone = {};
      }
    }

    _notify();
  }

  // ── Record ────────────────────────────────────────────────────────────────

  /// Gọi sau mỗi lần user quay về home từ 1 game
  Future<void> recordGamePlayed(GameCategory category) async {
    if (_categoriesDone.contains(category)) return;

    final prefs = await SharedPreferences.getInstance();
    _categoriesDone.add(category);
    await prefs.setString(
        _kCatsDone, jsonEncode(_categoriesDone.map((c) => c.name).toList()));

    // Check category reward
    if (_categoriesDone.length >= 4 && !_categoryRewardClaimed) {
      _categoryRewardClaimed = true;
      await prefs.setBool(_kCatRewardClaimed, true);
      await CoinService.instance.earnCoins(500);
    }

    _notify();
  }

  /// Gọi khi thắng gambling game (Bầu Cua, Đỏ Đen, Xì Jack)
  Future<void> recordGamblingWin() async {
    final prefs = await SharedPreferences.getInstance();
    _gamblingWins++;
    await prefs.setInt(_kGamblingWins, _gamblingWins);

    // 3 lần thắng gambling trong tuần → +300 xu
    if (_gamblingWins >= 3 && !_gamblingRewardClaimed) {
      _gamblingRewardClaimed = true;
      await prefs.setBool(_kGamRewardClaimed, true);
      await CoinService.instance.earnCoins(300);
    }

    _notify();
  }
}
