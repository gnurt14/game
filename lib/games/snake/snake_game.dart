// snake_game.dart — Snake game for Flutter Super Gate hub
//
// Kiến trúc:
//   ── ENUMS & MODEL ────────────────────────────────────
//   • SnakeDir     — Hướng di chuyển
//   • SnakeModel   — Trạng thái game (body, food, dir, score…)
//   ── CONTROLLER ───────────────────────────────────────
//   • SnakeController — Logic game + timer
//   ── PAINTER ──────────────────────────────────────────
//   • SnakePainter — CustomPainter vẽ lưới + rắn + food
//   ── SCREEN ───────────────────────────────────────────
//   • SnakeScreen  — StatefulWidget UI + input

import 'dart:async';
import 'dart:math';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../../coin/coin_service.dart';

// =============================================================================
// ENUMS & MODEL
// =============================================================================

enum SnakeDir { up, down, left, right }

class SnakeModel {
  static const int gridSize = 20;

  List<({int r, int c})> body;
  ({int r, int c}) food;
  SnakeDir dir;
  SnakeDir nextDir;
  bool gameOver;
  bool isPaused;
  int score;
  int bestScore;

  SnakeModel({
    required this.body,
    required this.food,
    required this.dir,
    required this.nextDir,
    required this.gameOver,
    required this.isPaused,
    required this.score,
    required this.bestScore,
  });

  factory SnakeModel.initial() {
    return SnakeModel(
      body: [
        (r: 10, c: 10),
        (r: 10, c: 9),
        (r: 10, c: 8),
      ],
      food: (r: 5, c: 5),
      dir: SnakeDir.right,
      nextDir: SnakeDir.right,
      gameOver: false,
      isPaused: false,
      score: 0,
      bestScore: 0,
    );
  }
}

// =============================================================================
// CONTROLLER
// =============================================================================

class SnakeController {
  final SnakeModel model = SnakeModel.initial();
  Timer? _timer;
  final Random _rng = Random();

  // Callback để trigger setState từ screen
  VoidCallback? onTick;

  static const int _baseMs = 250;

  void startGame() {
    _timer?.cancel();
    // Reset model state
    model.body = [
      (r: 10, c: 10),
      (r: 10, c: 9),
      (r: 10, c: 8),
    ];
    model.dir = SnakeDir.right;
    model.nextDir = SnakeDir.right;
    model.score = 0;
    model.gameOver = false;
    model.isPaused = false;
    _spawnFood();
    _startTimer();
  }

  void changeDir(SnakeDir d) {
    // Chặn 180°: không cho đổi sang hướng ngược lại
    final cur = model.nextDir;
    if (d == SnakeDir.up && cur == SnakeDir.down) return;
    if (d == SnakeDir.down && cur == SnakeDir.up) return;
    if (d == SnakeDir.left && cur == SnakeDir.right) return;
    if (d == SnakeDir.right && cur == SnakeDir.left) return;
    model.nextDir = d;
  }

  void togglePause() {
    model.isPaused = !model.isPaused;
    onTick?.call();
  }

  void _startTimer() {
    _timer?.cancel();
    final ms = (_baseMs - model.score * 5).clamp(80, _baseMs);
    _timer = Timer.periodic(Duration(milliseconds: ms), (_) => _tick());
  }

  void _tick() {
    if (model.gameOver || model.isPaused) return;

    model.dir = model.nextDir;

    // Tính head mới
    final head = model.body.first;
    final ({int r, int c}) newHead = switch (model.dir) {
      SnakeDir.up    => (r: head.r - 1, c: head.c),
      SnakeDir.down  => (r: head.r + 1, c: head.c),
      SnakeDir.left  => (r: head.r, c: head.c - 1),
      SnakeDir.right => (r: head.r, c: head.c + 1),
    };

    // Check collision tường
    if (newHead.r < 0 ||
        newHead.r >= SnakeModel.gridSize ||
        newHead.c < 0 ||
        newHead.c >= SnakeModel.gridSize) {
      model.gameOver = true;
      _checkBestScore();
      CoinService.instance.reportGameScore('snake', score: model.score);
      onTick?.call();
      return;
    }

    // Check collision thân (không tính đuôi vì đuôi sẽ bị xóa)
    final bodyWithoutTail = model.body.sublist(0, model.body.length - 1);
    for (final seg in bodyWithoutTail) {
      if (seg.r == newHead.r && seg.c == newHead.c) {
        model.gameOver = true;
        _checkBestScore();
        CoinService.instance.reportGameScore('snake', score: model.score);
        onTick?.call();
        return;
      }
    }

    // Di chuyển: thêm head mới
    model.body.insert(0, newHead);

    // Ăn food?
    if (newHead.r == model.food.r && newHead.c == model.food.c) {
      // Không xóa đuôi → rắn dài thêm
      model.score++;
      _spawnFood();
      _startTimer(); // Tốc độ mới
    } else {
      // Xóa đuôi
      model.body.removeLast();
    }

    onTick?.call();
  }

  void _spawnFood() {
    final bodySet = <String>{
      for (final seg in model.body) '${seg.r},${seg.c}',
    };

    ({int r, int c}) candidate;
    do {
      candidate = (
        r: _rng.nextInt(SnakeModel.gridSize),
        c: _rng.nextInt(SnakeModel.gridSize),
      );
    } while (bodySet.contains('${candidate.r},${candidate.c}'));

    model.food = candidate;
  }

  void _checkBestScore() {
    if (model.score > model.bestScore) {
      model.bestScore = model.score;
    }
  }

  void dispose() {
    _timer?.cancel();
  }
}

// =============================================================================
// PAINTER
// =============================================================================

class SnakePainter extends CustomPainter {
  final SnakeModel model;

  const SnakePainter(this.model);

  @override
  void paint(Canvas canvas, Size size) {
    final cellW = size.width / SnakeModel.gridSize;
    final cellH = size.height / SnakeModel.gridSize;

    // 1. Vẽ background
    canvas.drawRect(
      Offset.zero & size,
      Paint()..color = const Color(0xFF0D1F0D),
    );

    // 2. Grid lines mờ
    final gridPaint = Paint()
      ..color = const Color(0xFF1A3A1A)
      ..strokeWidth = 0.5;
    for (int i = 1; i < SnakeModel.gridSize; i++) {
      canvas.drawLine(
        Offset(i * cellW, 0),
        Offset(i * cellW, size.height),
        gridPaint,
      );
      canvas.drawLine(
        Offset(0, i * cellH),
        Offset(size.width, i * cellH),
        gridPaint,
      );
    }

    // 3. Vẽ food
    final f = model.food;
    canvas.drawCircle(
      Offset((f.c + 0.5) * cellW, (f.r + 0.5) * cellH),
      cellW * 0.4,
      Paint()..color = const Color(0xFFFF5722),
    );

    // 4. Vẽ thân rắn (từ đuôi đến đầu để đầu ở trên)
    for (int i = model.body.length - 1; i >= 0; i--) {
      final seg = model.body[i];
      final isHead = i == 0;
      final ratio = i / model.body.length;
      final color = Color.lerp(
        const Color(0xFF4CAF50),
        const Color(0xFF1B5E20),
        ratio,
      )!;
      final paint = Paint()..color = isHead ? const Color(0xFF76FF03) : color;
      final rect = RRect.fromRectAndRadius(
        Rect.fromLTWH(
          seg.c * cellW + 1,
          seg.r * cellH + 1,
          cellW - 2,
          cellH - 2,
        ),
        const Radius.circular(3),
      );
      canvas.drawRRect(rect, paint);
    }
  }

  @override
  bool shouldRepaint(SnakePainter old) => true;
}

// =============================================================================
// SCREEN
// =============================================================================

class SnakeScreen extends StatefulWidget {
  const SnakeScreen({super.key});

  @override
  State<SnakeScreen> createState() => _SnakeScreenState();
}

class _SnakeScreenState extends State<SnakeScreen>
    with SingleTickerProviderStateMixin {
  final _ctrl = SnakeController();
  final _focusNode = FocusNode();
  Offset _panStart = Offset.zero;

  @override
  void initState() {
    super.initState();
    _ctrl.onTick = () {
      if (mounted) setState(() {});
    };
    _ctrl.startGame();
    _loadBest();
  }

  @override
  void dispose() {
    _ctrl.dispose();
    _focusNode.dispose();
    super.dispose();
  }

  // ---------------------------------------------------------------------------
  // Persistence
  // ---------------------------------------------------------------------------

  Future<void> _loadBest() async {
    final prefs = await SharedPreferences.getInstance();
    if (mounted) {
      setState(() {
        _ctrl.model.bestScore = prefs.getInt('best_score_snake') ?? 0;
      });
    }
  }

  Future<void> _saveBest() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setInt('best_score_snake', _ctrl.model.bestScore);
  }

  // ---------------------------------------------------------------------------
  // Input: bàn phím
  // ---------------------------------------------------------------------------

  void _onKey(KeyEvent e) {
    if (e is! KeyDownEvent) return;
    switch (e.logicalKey) {
      case LogicalKeyboardKey.arrowUp:
      case LogicalKeyboardKey.keyW:
        _ctrl.changeDir(SnakeDir.up);
      case LogicalKeyboardKey.arrowDown:
      case LogicalKeyboardKey.keyS:
        _ctrl.changeDir(SnakeDir.down);
      case LogicalKeyboardKey.arrowLeft:
      case LogicalKeyboardKey.keyA:
        _ctrl.changeDir(SnakeDir.left);
      case LogicalKeyboardKey.arrowRight:
      case LogicalKeyboardKey.keyD:
        _ctrl.changeDir(SnakeDir.right);
      case LogicalKeyboardKey.keyP:
      case LogicalKeyboardKey.escape:
        _togglePause();
    }
  }

  // ---------------------------------------------------------------------------
  // Input: vuốt
  // ---------------------------------------------------------------------------

  void _onPanStart(DragStartDetails d) => _panStart = d.localPosition;

  void _onPanEnd(DragEndDetails d) {
    final delta = d.localPosition - _panStart;
    final vel = d.velocity.pixelsPerSecond;
    final useVel = vel.distance >= 150;
    final dx = useVel ? vel.dx : delta.dx;
    final dy = useVel ? vel.dy : delta.dy;
    final minMag = useVel ? 150.0 : 30.0;
    if (dx.abs() < minMag && dy.abs() < minMag) return;
    if (dx.abs() > dy.abs()) {
      _ctrl.changeDir(dx > 0 ? SnakeDir.right : SnakeDir.left);
    } else {
      _ctrl.changeDir(dy > 0 ? SnakeDir.down : SnakeDir.up);
    }
  }

  // ---------------------------------------------------------------------------
  // Actions
  // ---------------------------------------------------------------------------

  void _togglePause() {
    _ctrl.togglePause();
  }

  void _restartGame() {
    _ctrl.startGame();
    setState(() {});
  }

  // ---------------------------------------------------------------------------
  // Build
  // ---------------------------------------------------------------------------

  @override
  Widget build(BuildContext context) {
    // Lưu best score mỗi khi game over
    if (_ctrl.model.gameOver) {
      _saveBest();
    }

    return KeyboardListener(
      focusNode: _focusNode,
      autofocus: true,
      onKeyEvent: _onKey,
      child: Scaffold(
        backgroundColor: const Color(0xFF0D1F0D),
        body: SafeArea(
          child: GestureDetector(
            behavior: HitTestBehavior.opaque,
            onPanStart: _onPanStart,
            onPanEnd: _onPanEnd,
            child: Column(
              children: [
                _buildHeader(),
                Expanded(child: _buildBoard()),
                _buildHint(),
              ],
            ),
          ),
        ),
      ),
    );
  }

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
            'Snake',
            style: TextStyle(
              color: Color(0xFF4CAF50),
              fontSize: 28,
              fontWeight: FontWeight.w900,
            ),
          ),
          const Spacer(),
          IconButton(
            icon: Icon(
              _ctrl.model.isPaused
                  ? Icons.play_arrow_rounded
                  : Icons.pause_rounded,
            ),
            color: Colors.white70,
            onPressed: _togglePause,
          ),
          _scoreBox('SCORE', _ctrl.model.score),
          const SizedBox(width: 4),
          _scoreBox('BEST', _ctrl.model.bestScore),
        ],
      ),
    );
  }

  Widget _scoreBox(String label, int value) {
    return Container(
      constraints: const BoxConstraints(minWidth: 64),
      padding: const EdgeInsets.symmetric(vertical: 6, horizontal: 10),
      margin: const EdgeInsets.symmetric(horizontal: 2),
      decoration: BoxDecoration(
        color: const Color(0xFF1A3A1A),
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: const Color(0xFF2E6B2E)),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(
            label,
            style: const TextStyle(
              color: Color(0xFF81C784),
              fontSize: 10,
              fontWeight: FontWeight.bold,
              letterSpacing: 1.2,
            ),
          ),
          const SizedBox(height: 2),
          Text(
            '$value',
            style: const TextStyle(
              color: Colors.white,
              fontSize: 18,
              fontWeight: FontWeight.w900,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildBoard() {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      child: AspectRatio(
        aspectRatio: 1,
        child: Stack(
          children: [
            CustomPaint(
              painter: SnakePainter(_ctrl.model),
              child: const SizedBox.expand(),
            ),
            if (_ctrl.model.gameOver) _buildGameOverOverlay(),
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
                fontSize: 32,
                fontWeight: FontWeight.w900,
              ),
            ),
            const SizedBox(height: 8),
            Text(
              'Điểm: ${_ctrl.model.score}',
              style: const TextStyle(color: Colors.white70, fontSize: 18),
            ),
            const SizedBox(height: 16),
            FilledButton.icon(
              onPressed: _restartGame,
              icon: const Icon(Icons.refresh_rounded),
              label: const Text('Chơi lại'),
              style: FilledButton.styleFrom(
                backgroundColor: const Color(0xFF4CAF50),
                foregroundColor: Colors.black,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildHint() {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 8),
      child: Text(
        _ctrl.model.isPaused
            ? 'Đã tạm dừng — Nhấn P hoặc nút pause để tiếp tục'
            : 'Vuốt hoặc dùng phím mũi tên  •  P = tạm dừng',
        textAlign: TextAlign.center,
        style: const TextStyle(
          color: Color(0xFF4A7A4A),
          fontSize: 12,
        ),
      ),
    );
  }
}
