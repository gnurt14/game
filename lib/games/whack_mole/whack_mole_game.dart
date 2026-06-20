// whack_mole_game.dart — Whack-a-Mole game for Flutter Super Gate hub
//
// Kiến trúc:
//   ── MODEL ──────────────────────────────────────────────
//   • WhackMoleModel   — Trạng thái game (holes, score, time…)
//   ── CONTROLLER ─────────────────────────────────────────
//   • WhackMoleController — Logic game + timers
//   ── SCREEN ─────────────────────────────────────────────
//   • WhackMoleScreen  — StatefulWidget UI

import 'dart:async';
import 'dart:math';
import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../../coin/coin_service.dart';

// =============================================================================
// MODEL
// =============================================================================

class WhackMoleModel {
  static const int holes = 9;

  List<bool> moleVisible = List.filled(9, false); // true = chuột lộ
  int score = 0;
  int bestScore = 0;
  int timeLeft = 30; // giây
  bool isPlaying = false;
  bool isGameOver = false;
}

// =============================================================================
// CONTROLLER
// =============================================================================

class WhackMoleController {
  final WhackMoleModel model = WhackMoleModel();

  Timer? _gameTimer;
  Timer? _spawnTimer;
  final List<Timer?> _hideTimers = List.filled(9, null);
  final Random _rng = Random();

  /// Callback để trigger setState từ screen
  VoidCallback? onUpdate;

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  void startGame() {
    // 1. Cancel tất cả timers
    stopGame();

    // 2. Reset model
    model.score = 0;
    model.timeLeft = 30;
    model.moleVisible = List.filled(9, false);
    model.isPlaying = true;
    model.isGameOver = false;

    // 3. Start game timer (đếm ngược mỗi giây)
    _gameTimer = Timer.periodic(const Duration(seconds: 1), (_) => _tick());

    // 4. Spawn chuột đầu tiên ngay
    _scheduleSpawn();

    onUpdate?.call();
  }

  void stopGame() {
    _gameTimer?.cancel();
    _gameTimer = null;
    _spawnTimer?.cancel();
    _spawnTimer = null;
    for (int i = 0; i < WhackMoleModel.holes; i++) {
      _hideTimers[i]?.cancel();
      _hideTimers[i] = null;
    }
  }

  void whack(int idx) {
    if (!model.moleVisible[idx]) return; // miss

    model.moleVisible[idx] = false;
    _hideTimers[idx]?.cancel();
    _hideTimers[idx] = null;
    model.score++;

    // Spawn nhanh hơn sau khi đánh trúng
    _scheduleSpawn();

    onUpdate?.call();
  }

  void dispose() {
    stopGame();
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  void _tick() {
    model.timeLeft--;
    if (model.timeLeft <= 0) {
      model.isPlaying = false;
      model.isGameOver = true;

      // Cancel tất cả timers
      stopGame();

      // Update best score
      if (model.score > model.bestScore) {
        model.bestScore = model.score;
      }
      _saveBest();
      CoinService.instance.reportGameScore('whack_mole', score: model.score);
    }
    onUpdate?.call();
  }

  void _scheduleSpawn() {
    _spawnTimer?.cancel();
    _spawnTimer = Timer(
      Duration(milliseconds: _spawnIntervalMs()),
      _spawnMole,
    );
  }

  void _spawnMole() {
    if (!model.isPlaying) return;

    // Tìm danh sách holes chưa có chuột
    final empty = <int>[
      for (int i = 0; i < WhackMoleModel.holes; i++)
        if (!model.moleVisible[i]) i,
    ];

    if (empty.isNotEmpty) {
      final idx = empty[_rng.nextInt(empty.length)];
      model.moleVisible[idx] = true;

      // Tự ẩn sau _moleDurationMs
      _hideTimers[idx]?.cancel();
      _hideTimers[idx] = Timer(
        Duration(milliseconds: _moleDurationMs()),
        () => _hideMole(idx),
      );

      onUpdate?.call();
    }

    // Lên lịch spawn tiếp (interval thay đổi theo score)
    _scheduleSpawn();
  }

  void _hideMole(int idx) {
    if (!model.moleVisible[idx]) return;
    model.moleVisible[idx] = false;
    _hideTimers[idx] = null;
    onUpdate?.call();
  }

  int _spawnIntervalMs() => (1200 - model.score * 20).clamp(400, 1200);

  int _moleDurationMs() => (1000 - model.score * 15).clamp(350, 1000);

  Future<void> _saveBest() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setInt('best_score_whack_mole', model.bestScore);
  }
}

// =============================================================================
// SCREEN
// =============================================================================

class WhackMoleScreen extends StatefulWidget {
  const WhackMoleScreen({super.key});

  @override
  State<WhackMoleScreen> createState() => _WhackMoleScreenState();
}

class _WhackMoleScreenState extends State<WhackMoleScreen> {
  final _ctrl = WhackMoleController();

  @override
  void initState() {
    super.initState();
    _ctrl.onUpdate = () {
      if (mounted) setState(() {});
    };
    _loadBest();
  }

  @override
  void dispose() {
    _ctrl.dispose();
    super.dispose();
  }

  // ---------------------------------------------------------------------------
  // Persistence
  // ---------------------------------------------------------------------------

  Future<void> _loadBest() async {
    final prefs = await SharedPreferences.getInstance();
    if (mounted) {
      setState(() {
        _ctrl.model.bestScore =
            prefs.getInt('best_score_whack_mole') ?? 0;
      });
    }
  }

  // ---------------------------------------------------------------------------
  // Actions
  // ---------------------------------------------------------------------------

  void _whack(int idx) {
    if (!_ctrl.model.isPlaying) return;
    _ctrl.whack(idx);
  }

  void _startGame() {
    _ctrl.startGame();
  }

  // ---------------------------------------------------------------------------
  // Build
  // ---------------------------------------------------------------------------

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF0A0A1A),
      body: SafeArea(
        child: Column(
          children: [
            _buildHeader(),
            _buildScoreRow(),
            Expanded(child: _buildGrid()),
          ],
        ),
      ),
    );
  }

  // ---------------------------------------------------------------------------
  // Header
  // ---------------------------------------------------------------------------

  Widget _buildHeader() {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      child: Row(
        children: [
          if (Navigator.canPop(context))
            IconButton(
              icon: const Icon(Icons.arrow_back_ios_new_rounded),
              color: Colors.white70,
              onPressed: () => Navigator.pop(context),
            ),
          const Text(
            'WHACK-A-MOLE',
            style: TextStyle(
              color: Color(0xFFFFC107),
              fontSize: 24,
              fontWeight: FontWeight.w900,
              letterSpacing: 1.5,
            ),
          ),
        ],
      ),
    );
  }

  // ---------------------------------------------------------------------------
  // Score row
  // ---------------------------------------------------------------------------

  Widget _buildScoreRow() {
    final timeColor = _ctrl.model.timeLeft <= 5
        ? const Color(0xFFFF1744)
        : Colors.white;

    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          _statBox('SCORE', '${_ctrl.model.score}'),
          const SizedBox(width: 12),
          _statBox(
            'TIME',
            '${_ctrl.model.timeLeft}',
            valueColor: timeColor,
          ),
          const SizedBox(width: 12),
          _statBox('BEST', '${_ctrl.model.bestScore}'),
        ],
      ),
    );
  }

  Widget _statBox(String label, String value, {Color? valueColor}) {
    return Container(
      constraints: const BoxConstraints(minWidth: 80),
      padding: const EdgeInsets.symmetric(vertical: 8, horizontal: 16),
      decoration: BoxDecoration(
        color: const Color(0xFF1A1A2E),
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: const Color(0xFF3A3A5E)),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(
            label,
            style: const TextStyle(
              color: Color(0xFF9E9EBF),
              fontSize: 11,
              fontWeight: FontWeight.bold,
              letterSpacing: 1.2,
            ),
          ),
          const SizedBox(height: 2),
          Text(
            value,
            style: TextStyle(
              color: valueColor ?? Colors.white,
              fontSize: 22,
              fontWeight: FontWeight.w900,
            ),
          ),
        ],
      ),
    );
  }

  // ---------------------------------------------------------------------------
  // Grid
  // ---------------------------------------------------------------------------

  Widget _buildGrid() {
    return Stack(
      children: [
        Padding(
          padding: const EdgeInsets.all(16),
          child: GridView.count(
            crossAxisCount: 3,
            crossAxisSpacing: 12,
            mainAxisSpacing: 12,
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            children: List.generate(
              WhackMoleModel.holes,
              (i) => _buildHole(i),
            ),
          ),
        ),
        if (!_ctrl.model.isPlaying && !_ctrl.model.isGameOver)
          _buildStartOverlay(),
        if (_ctrl.model.isGameOver) _buildGameOverOverlay(),
      ],
    );
  }

  Widget _buildHole(int idx) {
    final visible = _ctrl.model.moleVisible[idx];

    return GestureDetector(
      onTap: () => _whack(idx),
      child: Container(
        decoration: BoxDecoration(
          color: const Color(0xFF2A1F0A),
          shape: BoxShape.circle,
          boxShadow: [
            BoxShadow(
              color: Colors.black.withValues(alpha: 0.5),
              blurRadius: 6,
              offset: const Offset(0, 3),
            ),
          ],
          border: Border.all(
            color: visible
                ? const Color(0xFFFFC107)
                : const Color(0xFF4A3A1A),
            width: visible ? 2.5 : 1.5,
          ),
        ),
        child: Center(
          child: AnimatedScale(
            scale: visible ? 1.0 : 0.0,
            duration: const Duration(milliseconds: 150),
            child: const Text(
              '🐹',
              style: TextStyle(fontSize: 40),
            ),
          ),
        ),
      ),
    );
  }

  // ---------------------------------------------------------------------------
  // Overlays
  // ---------------------------------------------------------------------------

  Widget _buildStartOverlay() {
    return Container(
      color: Colors.black54,
      child: Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Text(
              '🐹',
              style: TextStyle(fontSize: 64),
            ),
            const SizedBox(height: 16),
            const Text(
              'WHACK-A-MOLE',
              style: TextStyle(
                color: Color(0xFFFFC107),
                fontSize: 28,
                fontWeight: FontWeight.w900,
                letterSpacing: 2,
              ),
            ),
            const SizedBox(height: 8),
            const Text(
              'Đập chuột trước khi hết giờ!',
              style: TextStyle(color: Colors.white70, fontSize: 15),
            ),
            const SizedBox(height: 28),
            FilledButton(
              onPressed: _startGame,
              style: FilledButton.styleFrom(
                backgroundColor: const Color(0xFFFFC107),
                foregroundColor: Colors.black,
                padding: const EdgeInsets.symmetric(
                  horizontal: 48,
                  vertical: 16,
                ),
                textStyle: const TextStyle(
                  fontSize: 18,
                  fontWeight: FontWeight.w900,
                ),
              ),
              child: const Text('BẮT ĐẦU'),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildGameOverOverlay() {
    return Container(
      color: Colors.black54,
      child: Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Text(
              'GAME OVER',
              style: TextStyle(
                color: Colors.white,
                fontSize: 36,
                fontWeight: FontWeight.w900,
                letterSpacing: 2,
              ),
            ),
            const SizedBox(height: 12),
            Text(
              'Điểm: ${_ctrl.model.score}',
              style: const TextStyle(
                color: Color(0xFFFFC107),
                fontSize: 24,
                fontWeight: FontWeight.bold,
              ),
            ),
            const SizedBox(height: 4),
            Text(
              'BEST: ${_ctrl.model.bestScore}',
              style: const TextStyle(
                color: Colors.white70,
                fontSize: 16,
              ),
            ),
            const SizedBox(height: 28),
            FilledButton.icon(
              onPressed: _startGame,
              icon: const Icon(Icons.refresh_rounded),
              label: const Text('CHƠI LẠI'),
              style: FilledButton.styleFrom(
                backgroundColor: const Color(0xFFFFC107),
                foregroundColor: Colors.black,
                padding: const EdgeInsets.symmetric(
                  horizontal: 40,
                  vertical: 14,
                ),
                textStyle: const TextStyle(
                  fontSize: 16,
                  fontWeight: FontWeight.w900,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
