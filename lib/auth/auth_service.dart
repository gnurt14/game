// auth_service.dart — Supabase Email/Password Authentication
//
// Luồng:
//   Chưa login  → AuthScreen (login/register)
//   Login xong  → tạo/load player record → vào game
//   Session tự persist qua SharedPreferences (Supabase tự xử lý)

import 'package:flutter/foundation.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import '../supabase_config.dart';
import 'player_model.dart';

class AuthService {
  AuthService._();
  static final AuthService instance = AuthService._();

  static SupabaseClient get _db => Supabase.instance.client;

  // ── State ──────────────────────────────────────────────────────────────────
  User?        _currentUser;
  PlayerModel? _player;

  User?        get currentUser  => _currentUser;
  PlayerModel? get player       => _player;
  bool         get isAuthenticated => _currentUser != null;
  bool         get isNewPlayer     => _player?.isNewPlayer ?? true;
  String       get displayName     => _player?.displayName ?? 'Khách';

  final ValueNotifier<bool> authNotifier = ValueNotifier(false);

  // ── Init Supabase (gọi 1 lần trong main) ───────────────────────────────────
  static Future<void> initSupabase() async {
    await Supabase.initialize(
      url:     SupabaseConfig.url,
      anonKey: SupabaseConfig.anonKey,
    );
  }

  /// Kiểm tra session hiện có (gọi khi app start, không bắt sign-in)
  Future<PlayerModel?> tryRestoreSession() async {
    try {
      final session = _db.auth.currentSession;
      if (session == null) return null;

      _currentUser = session.user;
      _player = await _loadOrCreatePlayer(_currentUser!.id);
      authNotifier.value = true;
      return _player;
    } catch (e) {
      debugPrint('[AuthService] tryRestoreSession error: $e');
      return null;
    }
  }

  // ── Email / Password ────────────────────────────────────────────────────────

  /// Đăng ký tài khoản mới
  Future<PlayerModel> signUp({
    required String email,
    required String password,
    required String displayName,
  }) async {
    final res = await _db.auth.signUp(
      email:    email,
      password: password,
    );
    if (res.user == null) throw Exception('Đăng ký thất bại');

    _currentUser = res.user;
    // Tạo player record với display_name được chọn
    _player = await _createPlayer(_currentUser!.id, displayName);
    authNotifier.value = true;
    return _player!;
  }

  /// Đăng nhập
  Future<PlayerModel> signIn({
    required String email,
    required String password,
  }) async {
    final res = await _db.auth.signInWithPassword(
      email:    email,
      password: password,
    );
    if (res.user == null) throw Exception('Đăng nhập thất bại');

    _currentUser = res.user;
    _player = await _loadOrCreatePlayer(_currentUser!.id);
    authNotifier.value = true;
    return _player!;
  }

  /// Đăng xuất
  Future<void> signOut() async {
    await _db.auth.signOut();
    _currentUser = null;
    _player      = null;
    authNotifier.value = false;
  }

  /// Gửi email reset mật khẩu
  Future<void> resetPassword(String email) async {
    await _db.auth.resetPasswordForEmail(email);
  }

  // ── Player Record ───────────────────────────────────────────────────────────

  Future<PlayerModel> _loadOrCreatePlayer(String userId) async {
    try {
      final row = await _db
          .from('players')
          .select()
          .eq('id', userId)
          .maybeSingle();

      if (row != null) return PlayerModel.fromJson(row);
      return await _createPlayer(userId, 'Khách');
    } catch (e) {
      debugPrint('[AuthService] _loadOrCreatePlayer: $e');
      return PlayerModel.newPlayer(userId);
    }
  }

  Future<PlayerModel> _createPlayer(String userId, String displayName) async {
    final newPlayer = PlayerModel.newPlayer(userId);
    try {
      await _db.from('players').upsert({
        'id':           userId,
        'display_name': displayName,
        'coin_balance': newPlayer.coinBalance,
        'is_new_player': newPlayer.isNewPlayer,
        'free_lucky_boxes': newPlayer.freeLuckyBoxes,
      });
    } catch (e) {
      debugPrint('[AuthService] _createPlayer: $e');
    }
    return PlayerModel(
      id: userId,
      displayName: displayName,
      coinBalance: newPlayer.coinBalance,
      isNewPlayer: newPlayer.isNewPlayer,
      freeLuckyBoxes: newPlayer.freeLuckyBoxes,
      streakDay: 0,
      shieldCount: 0,
      gamesPlayedToday: [],
      totalGamesPlayed: 0,
      createdAt: DateTime.now(),
    );
  }

  // ── Sync helpers (gọi bởi CoinService) ────────────────────────────────────

  Future<void> syncCoinData({
    required int balance,
    required int freeLuckyBoxes,
    required int streakDay,
    required String? streakLastClaimDate,
    required int shieldCount,
    required DateTime? boosterExpiry,
    required List<String> gamesPlayedToday,
    required String? gamesPlayedDate,
    required String? mission3Date,
    required String? mission5Date,
    required int totalGamesPlayed,
  }) async {
    if (_currentUser == null) return;
    try {
      await _db.from('players').update({
        'coin_balance':             balance,
        'free_lucky_boxes':         freeLuckyBoxes,
        'streak_day':               streakDay,
        'streak_last_claim_date':   streakLastClaimDate,
        'shield_count':             shieldCount,
        'booster_expiry_at':        boosterExpiry?.toIso8601String(),
        'games_played_today':       gamesPlayedToday,
        'games_played_date':        gamesPlayedDate,
        'mission3_collected_date':  mission3Date,
        'mission5_collected_date':  mission5Date,
        'total_games_played':       totalGamesPlayed,
      }).eq('id', _currentUser!.id);
    } catch (e) {
      debugPrint('[AuthService] syncCoinData: $e');
    }
  }

  Future<void> completeOnboarding() async {
    if (_currentUser == null) return;
    try {
      await _db.from('players')
          .update({'is_new_player': false})
          .eq('id', _currentUser!.id);
      if (_player != null) {
        _player = PlayerModel(
          id: _player!.id,
          displayName: _player!.displayName,
          coinBalance: _player!.coinBalance,
          isNewPlayer: false,
          freeLuckyBoxes: _player!.freeLuckyBoxes,
          streakDay: _player!.streakDay,
          shieldCount: _player!.shieldCount,
          gamesPlayedToday: _player!.gamesPlayedToday,
          totalGamesPlayed: _player!.totalGamesPlayed,
          createdAt: _player!.createdAt,
        );
      }
    } catch (e) {
      debugPrint('[AuthService] completeOnboarding: $e');
    }
  }

  /// Load lại player từ Supabase (dùng cho refresh)
  Future<PlayerModel?> loadPlayerFromSupabase() async {
    if (_currentUser == null) return null;
    try {
      final row = await _db
          .from('players')
          .select()
          .eq('id', _currentUser!.id)
          .maybeSingle();
      if (row != null) {
        _player = PlayerModel.fromJson(row);
        return _player;
      }
    } catch (e) {
      debugPrint('[AuthService] loadPlayerFromSupabase: $e');
    }
    return null;
  }

  Future<void> updateDisplayName(String name) async {
    if (_currentUser == null) return;
    try {
      await _db.from('players')
          .update({'display_name': name})
          .eq('id', _currentUser!.id);
      if (_player != null) {
        _player = PlayerModel(
          id: _player!.id,
          displayName: name,
          coinBalance: _player!.coinBalance,
          isNewPlayer: _player!.isNewPlayer,
          freeLuckyBoxes: _player!.freeLuckyBoxes,
          streakDay: _player!.streakDay,
          shieldCount: _player!.shieldCount,
          gamesPlayedToday: _player!.gamesPlayedToday,
          totalGamesPlayed: _player!.totalGamesPlayed,
          createdAt: _player!.createdAt,
        );
      }
    } catch (e) {
      debugPrint('[AuthService] updateDisplayName: $e');
    }
  }
}
