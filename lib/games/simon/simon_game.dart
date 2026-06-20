// simon_game.dart — Simon Says game for Flutter Super Gate hub
//
// Kiến trúc:
//   ── ENUMS & MODEL ────────────────────────────────────
//   • SimonState   — Trạng thái game (idle, showing, playerInput, gameOver)
//   • SimonModel   — Dữ liệu game (sequence, playerIndex, round, bestRound)
//   ── CONTROLLER ───────────────────────────────────────
//   • SimonController — Logic game + async flash sequence
//   ── SCREEN ───────────────────────────────────────────
//   • SimonScreen  — StatefulWidget UI + tap input

import 'dart:async';
import 'dart:math';
import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../../coin/coin_service.dart';

// =============================================================================
// ENUMS & MODEL
// =============================================================================

enum SimonState { idle, showing, playerInput, gameOver }

class SimonModel {
  List<int> sequence = []; // 0=Red, 1=Blue, 2=Green, 3=Yellow
  int playerIndex = 0;
  SimonState state = SimonState.idle;
  int round = 0;
  int bestRound = 0;
}

// =============================================================================
// CONTROLLER
// =============================================================================

class SimonController {
  final SimonModel model = SimonModel();
  int activeColor = -1; // index đang flash (-1 = tắt)

  final Random _rng = Random();

  // Callback để trigger setState từ screen
  VoidCallback? onUpdate;

  static const String _prefKey = 'best_round_simon';

  int _flashMs() => (800 - model.round * 40).clamp(300, 800);
  int _gapMs() => (600 - model.round * 30).clamp(200, 600);

  Future<void> startGame() async {
    model.sequence = [];
    model.playerIndex = 0;
    model.round = 0;
    model.state = SimonState.idle;
    activeColor = -1;
    onUpdate?.call();
    await _addAndShow();
  }

  Future<void> _addAndShow() async {
    model.state = SimonState.showing;
    model.playerIndex = 0;
    model.sequence.add(_rng.nextInt(4));
    model.round = model.sequence.length;
    onUpdate?.call();

    await _showSequence();

    model.state = SimonState.playerInput;
    onUpdate?.call();
  }

  Future<void> _showSequence() async {
    // Pause ngắn trước khi bắt đầu
    await Future<void>.delayed(const Duration(milliseconds: 400));

    for (final colorIdx in model.sequence) {
      activeColor = colorIdx;
      onUpdate?.call();
      await Future<void>.delayed(Duration(milliseconds: _flashMs()));

      activeColor = -1;
      onUpdate?.call();
      await Future<void>.delayed(Duration(milliseconds: _gapMs()));
    }
  }

  /// Xử lý tap vào màu [colorIdx].
  /// Trả về true nếu đúng, false nếu sai.
  Future<bool> handleTap(int colorIdx) async {
    if (model.state != SimonState.playerInput) return false;

    final expected = model.sequence[model.playerIndex];

    if (colorIdx == expected) {
      // Flash đúng 200ms
      activeColor = colorIdx;
      onUpdate?.call();
      await Future<void>.delayed(const Duration(milliseconds: 200));
      activeColor = -1;
      onUpdate?.call();

      model.playerIndex++;

      // Hoàn thành chuỗi — lên round kế
      if (model.playerIndex >= model.sequence.length) {
        model.state = SimonState.showing;
        onUpdate?.call();
        await Future<void>.delayed(const Duration(milliseconds: 600));
        await _addAndShow();
      }

      return true;
    } else {
      // Sai — game over, flash sai 3 lần
      model.state = SimonState.gameOver;
      CoinService.instance.reportGameScore('simon', score: model.round);
      if (model.round > model.bestRound) {
        model.bestRound = model.round;
        await _saveBest();
      }

      for (int i = 0; i < 3; i++) {
        activeColor = colorIdx;
        onUpdate?.call();
        await Future<void>.delayed(const Duration(milliseconds: 200));
        activeColor = -1;
        onUpdate?.call();
        await Future<void>.delayed(const Duration(milliseconds: 150));
      }

      onUpdate?.call();
      return false;
    }
  }

  Future<void> loadBest() async {
    final prefs = await SharedPreferences.getInstance();
    model.bestRound = prefs.getInt(_prefKey) ?? 0;
    onUpdate?.call();
  }

  Future<void> _saveBest() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setInt(_prefKey, model.bestRound);
  }
}

// =============================================================================
// SCREEN
// =============================================================================

class SimonScreen extends StatefulWidget {
  const SimonScreen({super.key});

  @override
  State<SimonScreen> createState() => _SimonScreenState();
}

class _SimonScreenState extends State<SimonScreen> {
  final _ctrl = SimonController();

  // Block concurrent async actions (taps / start)
  bool _busy = false;

  // Màu sắc 4 nút: 0=Red, 1=Blue, 2=Green, 3=Yellow
  static const List<Color> _colors = [
    Color(0xFFE53935), // Red
    Color(0xFF1E88E5), // Blue
    Color(0xFF43A047), // Green
    Color(0xFFFDD835), // Yellow
  ];

  static const List<String> _labels = ['RED', 'BLUE', 'GREEN', 'YELLOW'];

  @override
  void initState() {
    super.initState();
    _ctrl.onUpdate = () {
      if (mounted) setState(() {});
    };
    _ctrl.loadBest();
  }

  @override
  void dispose() {
    // Không có Timer cố định — controller dùng Future.delayed
    // Đặt onUpdate = null để tránh gọi setState sau dispose
    _ctrl.onUpdate = null;
    super.dispose();
  }

  // ---------------------------------------------------------------------------
  // Actions
  // ---------------------------------------------------------------------------

  Future<void> _startGame() async {
    if (_busy) return;
    _busy = true;
    try {
      await _ctrl.startGame();
    } finally {
      _busy = false;
      if (mounted) setState(() {});
    }
  }

  Future<void> _handleTap(int colorIdx) async {
    if (_busy) return;
    if (_ctrl.model.state != SimonState.playerInput) return;
    _busy = true;
    try {
      await _ctrl.handleTap(colorIdx);
    } finally {
      _busy = false;
      if (mounted) setState(() {});
    }
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
            const SizedBox(height: 12),
            _buildScoreRow(),
            const SizedBox(height: 12),
            _buildStatusText(),
            const SizedBox(height: 20),
            Expanded(child: _buildColorGrid()),
            _buildBottomButton(),
            const SizedBox(height: 24),
          ],
        ),
      ),
    );
  }

  Widget _buildHeader() {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 8),
      child: Stack(
        alignment: Alignment.center,
        children: [
          if (Navigator.canPop(context))
            Align(
              alignment: Alignment.centerLeft,
              child: IconButton(
                icon: const Icon(Icons.arrow_back_ios_new_rounded),
                color: Colors.white70,
                onPressed: () => Navigator.pop(context),
              ),
            ),
          const Text(
            'SIMON SAYS',
            style: TextStyle(
              color: Colors.white,
              fontSize: 26,
              fontWeight: FontWeight.w900,
              letterSpacing: 3,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildScoreRow() {
    return Row(
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        _scoreBox('ROUND', _ctrl.model.round),
        const SizedBox(width: 16),
        _scoreBox('BEST', _ctrl.model.bestRound),
      ],
    );
  }

  Widget _scoreBox(String label, int value) {
    return Container(
      constraints: const BoxConstraints(minWidth: 90),
      padding: const EdgeInsets.symmetric(vertical: 8, horizontal: 20),
      decoration: BoxDecoration(
        color: const Color(0xFF12122A),
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: const Color(0xFF2A2A4A)),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(
            label,
            style: const TextStyle(
              color: Color(0xFF7777AA),
              fontSize: 11,
              fontWeight: FontWeight.bold,
              letterSpacing: 1.5,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            '$value',
            style: const TextStyle(
              color: Colors.white,
              fontSize: 28,
              fontWeight: FontWeight.w900,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildStatusText() {
    final state = _ctrl.model.state;
    final String text = switch (state) {
      SimonState.idle      => 'Nhấn BẮT ĐẦU để chơi',
      SimonState.showing   => 'Quan sát...',
      SimonState.playerInput => 'Lặp lại chuỗi!',
      SimonState.gameOver  => 'Sai rồi! Round ${_ctrl.model.round}',
    };
    final Color color = switch (state) {
      SimonState.idle        => const Color(0xFF7777AA),
      SimonState.showing     => const Color(0xFFFDD835),
      SimonState.playerInput => const Color(0xFF43A047),
      SimonState.gameOver    => const Color(0xFFE53935),
    };

    return Text(
      text,
      style: TextStyle(
        color: color,
        fontSize: 16,
        fontWeight: FontWeight.w600,
        letterSpacing: 0.5,
      ),
    );
  }

  Widget _buildColorGrid() {
    final canTap = _ctrl.model.state == SimonState.playerInput && !_busy;

    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 24),
      child: AspectRatio(
        aspectRatio: 1,
        child: GridView.count(
          crossAxisCount: 2,
          crossAxisSpacing: 12,
          mainAxisSpacing: 12,
          physics: const NeverScrollableScrollPhysics(),
          children: List.generate(4, (i) => _buildColorButton(i, canTap)),
        ),
      ),
    );
  }

  Widget _buildColorButton(int i, bool canTap) {
    final isActive = _ctrl.activeColor == i;
    final baseColor = _colors[i];
    final dimColor = Color.lerp(baseColor, Colors.black, 0.5)!;
    final displayColor = isActive ? baseColor : dimColor;

    return GestureDetector(
      onTap: canTap ? () => _handleTap(i) : null,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 80),
        decoration: BoxDecoration(
          color: displayColor,
          borderRadius: BorderRadius.circular(16),
          boxShadow: isActive
              ? [
                  BoxShadow(
                    color: baseColor.withAlpha(178),
                    blurRadius: 24,
                    spreadRadius: 4,
                  ),
                ]
              : const [],
        ),
        child: Center(
          child: Text(
            _labels[i],
            style: TextStyle(
              color: isActive ? Colors.white : Colors.white38,
              fontSize: 14,
              fontWeight: FontWeight.w900,
              letterSpacing: 1.5,
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildBottomButton() {
    final state = _ctrl.model.state;
    if (state != SimonState.idle && state != SimonState.gameOver) {
      return const SizedBox(height: 52);
    }

    final isGameOver = state == SimonState.gameOver;
    final label = isGameOver ? 'CHƠI LẠI' : 'BẮT ĐẦU';

    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 48),
      child: SizedBox(
        width: double.infinity,
        height: 52,
        child: FilledButton(
          onPressed: _busy ? null : _startGame,
          style: FilledButton.styleFrom(
            backgroundColor: isGameOver
                ? const Color(0xFFE53935)
                : const Color(0xFF1E88E5),
            foregroundColor: Colors.white,
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(12),
            ),
            textStyle: const TextStyle(
              fontSize: 16,
              fontWeight: FontWeight.w900,
              letterSpacing: 2,
            ),
          ),
          child: Text(label),
        ),
      ),
    );
  }
}
