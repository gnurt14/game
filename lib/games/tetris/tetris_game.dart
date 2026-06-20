import 'dart:async';
import 'dart:math';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../../coin/coin_service.dart';

// ─── ENUMS ───

enum TetroType { I, O, T, S, Z, J, L }

// ─── TETROMINO DATA (const Map) ───

const Map<TetroType, List<List<List<int>>>> kTetrominoes = {
  TetroType.I: [
    [
      [0, 0, 0, 0],
      [1, 1, 1, 1],
      [0, 0, 0, 0],
      [0, 0, 0, 0]
    ],
    [
      [0, 0, 1, 0],
      [0, 0, 1, 0],
      [0, 0, 1, 0],
      [0, 0, 1, 0]
    ],
    [
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [1, 1, 1, 1],
      [0, 0, 0, 0]
    ],
    [
      [0, 1, 0, 0],
      [0, 1, 0, 0],
      [0, 1, 0, 0],
      [0, 1, 0, 0]
    ],
  ],
  TetroType.O: [
    [
      [0, 1, 1, 0],
      [0, 1, 1, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0]
    ],
    [
      [0, 1, 1, 0],
      [0, 1, 1, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0]
    ],
    [
      [0, 1, 1, 0],
      [0, 1, 1, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0]
    ],
    [
      [0, 1, 1, 0],
      [0, 1, 1, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0]
    ],
  ],
  TetroType.T: [
    [
      [0, 1, 0, 0],
      [1, 1, 1, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0]
    ],
    [
      [0, 1, 0, 0],
      [0, 1, 1, 0],
      [0, 1, 0, 0],
      [0, 0, 0, 0]
    ],
    [
      [0, 0, 0, 0],
      [1, 1, 1, 0],
      [0, 1, 0, 0],
      [0, 0, 0, 0]
    ],
    [
      [0, 1, 0, 0],
      [1, 1, 0, 0],
      [0, 1, 0, 0],
      [0, 0, 0, 0]
    ],
  ],
  TetroType.S: [
    [
      [0, 1, 1, 0],
      [1, 1, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0]
    ],
    [
      [0, 1, 0, 0],
      [0, 1, 1, 0],
      [0, 0, 1, 0],
      [0, 0, 0, 0]
    ],
    [
      [0, 0, 0, 0],
      [0, 1, 1, 0],
      [1, 1, 0, 0],
      [0, 0, 0, 0]
    ],
    [
      [1, 0, 0, 0],
      [1, 1, 0, 0],
      [0, 1, 0, 0],
      [0, 0, 0, 0]
    ],
  ],
  TetroType.Z: [
    [
      [1, 1, 0, 0],
      [0, 1, 1, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0]
    ],
    [
      [0, 0, 1, 0],
      [0, 1, 1, 0],
      [0, 1, 0, 0],
      [0, 0, 0, 0]
    ],
    [
      [0, 0, 0, 0],
      [1, 1, 0, 0],
      [0, 1, 1, 0],
      [0, 0, 0, 0]
    ],
    [
      [0, 1, 0, 0],
      [1, 1, 0, 0],
      [1, 0, 0, 0],
      [0, 0, 0, 0]
    ],
  ],
  TetroType.J: [
    [
      [1, 0, 0, 0],
      [1, 1, 1, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0]
    ],
    [
      [0, 1, 1, 0],
      [0, 1, 0, 0],
      [0, 1, 0, 0],
      [0, 0, 0, 0]
    ],
    [
      [0, 0, 0, 0],
      [1, 1, 1, 0],
      [0, 0, 1, 0],
      [0, 0, 0, 0]
    ],
    [
      [0, 1, 0, 0],
      [0, 1, 0, 0],
      [1, 1, 0, 0],
      [0, 0, 0, 0]
    ],
  ],
  TetroType.L: [
    [
      [0, 0, 1, 0],
      [1, 1, 1, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0]
    ],
    [
      [0, 1, 0, 0],
      [0, 1, 0, 0],
      [0, 1, 1, 0],
      [0, 0, 0, 0]
    ],
    [
      [0, 0, 0, 0],
      [1, 1, 1, 0],
      [1, 0, 0, 0],
      [0, 0, 0, 0]
    ],
    [
      [1, 1, 0, 0],
      [0, 1, 0, 0],
      [0, 1, 0, 0],
      [0, 0, 0, 0]
    ],
  ],
};

const Map<TetroType, Color> kTetroColors = {
  TetroType.I: Color(0xFF00BCD4), // cyan
  TetroType.O: Color(0xFFFFEB3B), // yellow
  TetroType.T: Color(0xFF9C27B0), // purple
  TetroType.S: Color(0xFF4CAF50), // green
  TetroType.Z: Color(0xFFF44336), // red
  TetroType.J: Color(0xFF2196F3), // blue
  TetroType.L: Color(0xFFFF9800), // orange
};

// ─── MODEL ───

class TetrisModel {
  static const int rows = 20, cols = 10;
  // board: 0=empty, 1-7 = TetroType.index+1
  List<List<int>> board =
      List.generate(rows, (_) => List.filled(cols, 0));
  TetroType? currentType;
  int currentRot = 0;
  int currentX = 3, currentY = 0;
  TetroType? nextType;
  int score = 0, level = 1, lines = 0;
  int bestScore = 0;
  bool gameOver = false;
  bool isPaused = false;
}

// ─── CONTROLLER ───

class TetrisController {
  final TetrisModel model = TetrisModel();
  Timer? _dropTimer;
  Timer? _dasTimer;
  final Set<LogicalKeyboardKey> _heldKeys = {};
  VoidCallback? onUpdate;
  final Random _rng = Random();

  void startGame() {
    model.board =
        List.generate(TetrisModel.rows, (_) => List.filled(TetrisModel.cols, 0));
    model.score = 0;
    model.level = 1;
    model.lines = 0;
    model.gameOver = false;
    model.isPaused = false;
    model.nextType = TetroType.values[_rng.nextInt(7)];
    _spawnPiece();
    _startDropTimer();
  }

  void _startDropTimer() {
    _dropTimer?.cancel();
    final ms = (1000 - (model.level - 1) * 80).clamp(100, 1000);
    _dropTimer =
        Timer.periodic(Duration(milliseconds: ms), (_) => _tick());
  }

  void _tick() {
    if (model.gameOver || model.isPaused) return;
    if (!_canMove(model.currentX, model.currentY + 1, model.currentRot)) {
      _lockPiece();
    } else {
      model.currentY++;
    }
    onUpdate?.call();
  }

  bool _canMove(int nx, int ny, int rot) {
    if (model.currentType == null) return false;
    final shape = kTetrominoes[model.currentType!]![rot];
    for (int r = 0; r < 4; r++) {
      for (int c = 0; c < 4; c++) {
        if (shape[r][c] == 0) continue;
        final br = ny + r, bc = nx + c;
        if (br < 0 || br >= TetrisModel.rows) return false;
        if (bc < 0 || bc >= TetrisModel.cols) return false;
        if (model.board[br][bc] != 0) return false;
      }
    }
    return true;
  }

  void _lockPiece() {
    if (model.currentType == null) return;
    final shape = kTetrominoes[model.currentType!]![model.currentRot];
    final colorIdx = model.currentType!.index + 1;
    for (int r = 0; r < 4; r++) {
      for (int c = 0; c < 4; c++) {
        if (shape[r][c] != 0) {
          model.board[model.currentY + r][model.currentX + c] = colorIdx;
        }
      }
    }
    final cleared = _clearLines();
    _updateScore(cleared);
    _spawnPiece();
  }

  int _clearLines() {
    int cleared = 0;
    for (int r = TetrisModel.rows - 1; r >= 0; r--) {
      if (model.board[r].every((c) => c != 0)) {
        model.board.removeAt(r);
        model.board.insert(0, List.filled(TetrisModel.cols, 0));
        cleared++;
        r++; // re-check same row
      }
    }
    model.lines += cleared;
    model.level = (model.lines ~/ 10) + 1;
    return cleared;
  }

  void _updateScore(int n) {
    const points = [0, 100, 300, 500, 800];
    model.score += points[n.clamp(0, 4)] * model.level;
    if (model.score > model.bestScore) model.bestScore = model.score;
  }

  void _spawnPiece() {
    model.currentType = model.nextType;
    model.nextType = TetroType.values[_rng.nextInt(7)];
    model.currentRot = 0;
    model.currentX = 3;
    model.currentY = 0;
    if (!_canMove(model.currentX, model.currentY, model.currentRot)) {
      model.gameOver = true;
      _dropTimer?.cancel();
      CoinService.instance.reportGameScore('tetris', level: model.level);
    }
  }

  void moveLeft() {
    if (_canMove(model.currentX - 1, model.currentY, model.currentRot)) {
      model.currentX--;
      onUpdate?.call();
    }
  }

  void moveRight() {
    if (_canMove(model.currentX + 1, model.currentY, model.currentRot)) {
      model.currentX++;
      onUpdate?.call();
    }
  }

  void rotate() {
    if (model.currentType == null) return;
    final newRot = (model.currentRot + 1) % 4;
    // Wall kick offsets: try 0, -1, +1, -2, +2
    for (final dx in [0, -1, 1, -2, 2]) {
      if (_canMove(model.currentX + dx, model.currentY, newRot)) {
        model.currentX += dx;
        model.currentRot = newRot;
        onUpdate?.call();
        return;
      }
    }
  }

  void softDrop() {
    if (_canMove(model.currentX, model.currentY + 1, model.currentRot)) {
      model.currentY++;
      model.score++;
      onUpdate?.call();
    }
  }

  void hardDrop() {
    int dropped = 0;
    while (_canMove(model.currentX, model.currentY + 1, model.currentRot)) {
      model.currentY++;
      dropped++;
    }
    model.score += dropped * 2;
    _lockPiece();
    onUpdate?.call();
  }

  void togglePause() {
    model.isPaused = !model.isPaused;
    onUpdate?.call();
  }

  int getGhostY() {
    int gy = model.currentY;
    while (_canMove(model.currentX, gy + 1, model.currentRot)) {
      gy++;
    }
    return gy;
  }

  void onKeyDown(LogicalKeyboardKey key) {
    if (_heldKeys.contains(key)) return;
    _heldKeys.add(key);
    _handleKey(key);
    if (key == LogicalKeyboardKey.arrowLeft ||
        key == LogicalKeyboardKey.arrowRight) {
      _dasTimer?.cancel();
      _dasTimer = Timer(const Duration(milliseconds: 170), () {
        _dasTimer =
            Timer.periodic(const Duration(milliseconds: 50), (_) {
          if (_heldKeys.contains(key)) _handleKey(key);
        });
      });
    }
  }

  void onKeyUp(LogicalKeyboardKey key) {
    _heldKeys.remove(key);
    if (key == LogicalKeyboardKey.arrowLeft ||
        key == LogicalKeyboardKey.arrowRight) {
      _dasTimer?.cancel();
    }
  }

  void _handleKey(LogicalKeyboardKey key) {
    if (model.gameOver || model.isPaused) return;
    if (key == LogicalKeyboardKey.arrowLeft) {
      moveLeft();
    } else if (key == LogicalKeyboardKey.arrowRight) {
      moveRight();
    } else if (key == LogicalKeyboardKey.arrowDown) {
      softDrop();
    } else if (key == LogicalKeyboardKey.arrowUp ||
        key == LogicalKeyboardKey.keyX) {
      rotate();
    } else if (key == LogicalKeyboardKey.keyZ) {
      // Rotate CCW (rotate 3 times CW)
      rotate();
      rotate();
      rotate();
    } else if (key == LogicalKeyboardKey.space) {
      hardDrop();
    } else if (key == LogicalKeyboardKey.keyP ||
        key == LogicalKeyboardKey.escape) {
      togglePause();
    }
  }

  void dispose() {
    _dropTimer?.cancel();
    _dasTimer?.cancel();
  }
}

// ─── PAINTERS ───

class TetrisPainter extends CustomPainter {
  final TetrisModel model;
  final int ghostY;

  TetrisPainter(this.model, this.ghostY);

  @override
  void paint(Canvas canvas, Size size) {
    final cw = size.width / TetrisModel.cols;
    final ch = size.height / TetrisModel.rows;

    // Background
    canvas.drawRect(
      Offset.zero & size,
      Paint()..color = const Color(0xFF0D0D1A),
    );

    // Grid lines (very faint)
    final gridPaint = Paint()
      ..color = const Color(0xFF1A1A2E)
      ..strokeWidth = 0.5;
    for (int r = 0; r <= TetrisModel.rows; r++) {
      canvas.drawLine(
          Offset(0, r * ch), Offset(size.width, r * ch), gridPaint);
    }
    for (int c = 0; c <= TetrisModel.cols; c++) {
      canvas.drawLine(
          Offset(c * cw, 0), Offset(c * cw, size.height), gridPaint);
    }

    // Board cells
    for (int r = 0; r < TetrisModel.rows; r++) {
      for (int c = 0; c < TetrisModel.cols; c++) {
        final v = model.board[r][c];
        if (v == 0) continue;
        final type = TetroType.values[v - 1];
        _drawCell(canvas, c, r, cw, ch, kTetroColors[type]!, 1.0);
      }
    }

    // Ghost piece
    if (model.currentType != null && !model.gameOver) {
      final shape = kTetrominoes[model.currentType!]![model.currentRot];
      final ghostColor = kTetroColors[model.currentType!]!;
      for (int r = 0; r < 4; r++) {
        for (int c = 0; c < 4; c++) {
          if (shape[r][c] == 0) continue;
          final br = ghostY + r, bc = model.currentX + c;
          if (br >= 0 &&
              br < TetrisModel.rows &&
              bc >= 0 &&
              bc < TetrisModel.cols) {
            _drawCell(canvas, bc, br, cw, ch, ghostColor, 0.22);
          }
        }
      }
    }

    // Current piece
    if (model.currentType != null && !model.gameOver) {
      final shape = kTetrominoes[model.currentType!]![model.currentRot];
      for (int r = 0; r < 4; r++) {
        for (int c = 0; c < 4; c++) {
          if (shape[r][c] == 0) continue;
          final br = model.currentY + r, bc = model.currentX + c;
          if (br >= 0 &&
              br < TetrisModel.rows &&
              bc >= 0 &&
              bc < TetrisModel.cols) {
            _drawCell(
                canvas, bc, br, cw, ch, kTetroColors[model.currentType!]!, 1.0);
          }
        }
      }
    }

    // Game Over overlay
    if (model.gameOver) {
      canvas.drawRect(
        Offset.zero & size,
        Paint()..color = Colors.black54,
      );
    }
  }

  void _drawCell(Canvas canvas, int c, int r, double cw, double ch,
      Color color, double opacity) {
    final rect = Rect.fromLTWH(c * cw + 1, r * ch + 1, cw - 2, ch - 2);
    final rrect = RRect.fromRectAndRadius(rect, const Radius.circular(2));
    canvas.drawRRect(
        rrect, Paint()..color = color.withAlpha((opacity * 255).round()));
    // Inner highlight
    if (opacity > 0.5) {
      canvas.drawRRect(
        RRect.fromRectAndRadius(
          Rect.fromLTWH(c * cw + 1, r * ch + 1, cw - 2, 3),
          const Radius.circular(2),
        ),
        Paint()..color = Colors.white24,
      );
    }
  }

  @override
  bool shouldRepaint(TetrisPainter old) => true;
}

class NextPiecePainter extends CustomPainter {
  final TetroType? type;

  const NextPiecePainter(this.type);

  @override
  void paint(Canvas canvas, Size size) {
    canvas.drawRect(
      Offset.zero & size,
      Paint()..color = const Color(0xFF0D0D1A),
    );
    if (type == null) return;
    final shape = kTetrominoes[type!]![0]; // rotation 0
    final color = kTetroColors[type!]!;
    final cw = size.width / 4, ch = size.height / 4;
    for (int r = 0; r < 4; r++) {
      for (int c = 0; c < 4; c++) {
        if (shape[r][c] == 0) continue;
        final rect = RRect.fromRectAndRadius(
          Rect.fromLTWH(c * cw + 1, r * ch + 1, cw - 2, ch - 2),
          const Radius.circular(2),
        );
        canvas.drawRRect(rect, Paint()..color = color);
      }
    }
  }

  @override
  bool shouldRepaint(NextPiecePainter old) => old.type != type;
}

// ─── SCREEN ───

class TetrisScreen extends StatefulWidget {
  const TetrisScreen({super.key});

  @override
  State<TetrisScreen> createState() => _TetrisScreenState();
}

class _TetrisScreenState extends State<TetrisScreen> {
  final _ctrl = TetrisController();
  final _focusNode = FocusNode();

  @override
  void initState() {
    super.initState();
    _ctrl.onUpdate = () {
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

  Future<void> _loadBest() async {
    final prefs = await SharedPreferences.getInstance();
    if (mounted) {
      setState(() {
        _ctrl.model.bestScore = prefs.getInt('best_score_tetris') ?? 0;
      });
    }
  }

  Future<void> _saveBest() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setInt('best_score_tetris', _ctrl.model.bestScore);
  }

  void _onKey(KeyEvent e) {
    if (e is KeyDownEvent) {
      _ctrl.onKeyDown(e.logicalKey);
    } else if (e is KeyUpEvent) {
      _ctrl.onKeyUp(e.logicalKey);
    }
    // After game over: Enter or Space to restart
    if (e is KeyDownEvent &&
        _ctrl.model.gameOver &&
        (e.logicalKey == LogicalKeyboardKey.enter ||
            e.logicalKey == LogicalKeyboardKey.space)) {
      _ctrl.startGame();
    }
  }

  @override
  Widget build(BuildContext context) {
    final m = _ctrl.model;
    if (m.score > 0) _saveBest(); // fire-and-forget

    return KeyboardListener(
      focusNode: _focusNode,
      autofocus: true,
      onKeyEvent: _onKey,
      child: Scaffold(
        backgroundColor: const Color(0xFF05050F),
        body: SafeArea(
          child: Padding(
            padding: const EdgeInsets.all(12),
            child: Column(children: [
              _buildHeader(context),
              const SizedBox(height: 8),
              Expanded(child: _buildGameArea()),
            ]),
          ),
        ),
      ),
    );
  }

  Widget _buildHeader(BuildContext ctx) {
    return Row(children: [
      if (Navigator.canPop(ctx))
        IconButton(
          icon: const Icon(Icons.arrow_back_ios_new_rounded, size: 20),
          color: Colors.white70,
          onPressed: () => Navigator.pop(ctx),
          padding: EdgeInsets.zero,
          constraints: const BoxConstraints(),
        ),
      if (Navigator.canPop(ctx)) const SizedBox(width: 8),
      const Text(
        'TETRIS',
        style: TextStyle(
          color: Colors.white,
          fontSize: 26,
          fontWeight: FontWeight.w900,
          letterSpacing: 3,
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
        onPressed: _ctrl.togglePause,
      ),
    ]);
  }

  Widget _buildGameArea() {
    final ghostY = _ctrl.getGhostY();
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // Board
        Expanded(
          flex: 10,
          child: Stack(children: [
            AspectRatio(
              aspectRatio: TetrisModel.cols / TetrisModel.rows,
              child: CustomPaint(
                painter: TetrisPainter(_ctrl.model, ghostY),
                child: const SizedBox.expand(),
              ),
            ),
            if (_ctrl.model.gameOver) _buildGameOverOverlay(),
            if (_ctrl.model.isPaused) _buildPauseOverlay(),
          ]),
        ),
        const SizedBox(width: 12),
        // Side panel
        SizedBox(
          width: 90,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              _sideLabel('NEXT'),
              AspectRatio(
                aspectRatio: 1,
                child: CustomPaint(
                  painter: NextPiecePainter(_ctrl.model.nextType),
                  child: const SizedBox.expand(),
                ),
              ),
              const SizedBox(height: 16),
              _sideBox('SCORE', '${_ctrl.model.score}'),
              const SizedBox(height: 8),
              _sideBox('BEST', '${_ctrl.model.bestScore}'),
              const SizedBox(height: 8),
              _sideBox('LEVEL', '${_ctrl.model.level}'),
              const SizedBox(height: 8),
              _sideBox('LINES', '${_ctrl.model.lines}'),
              const SizedBox(height: 16),
              _mobileControls(),
            ],
          ),
        ),
      ],
    );
  }

  Widget _mobileControls() {
    return Column(children: [
      // Row: rotate + hard drop
      Row(
        mainAxisAlignment: MainAxisAlignment.spaceEvenly,
        children: [
          _ctrlBtn(Icons.rotate_right_rounded, _ctrl.rotate),
          _ctrlBtn(Icons.vertical_align_bottom_rounded, _ctrl.hardDrop),
        ],
      ),
      const SizedBox(height: 4),
      // Row: left + down + right
      Row(
        mainAxisAlignment: MainAxisAlignment.spaceEvenly,
        children: [
          _ctrlBtn(Icons.arrow_back_ios_rounded, _ctrl.moveLeft),
          _ctrlBtn(Icons.keyboard_arrow_down_rounded, _ctrl.softDrop),
          _ctrlBtn(Icons.arrow_forward_ios_rounded, _ctrl.moveRight),
        ],
      ),
    ]);
  }

  Widget _ctrlBtn(IconData icon, VoidCallback onTap) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.all(8),
        decoration: BoxDecoration(
          color: const Color(0xFF1A1A2E),
          borderRadius: BorderRadius.circular(8),
        ),
        child: Icon(icon, color: Colors.white70, size: 22),
      ),
    );
  }

  Widget _sideLabel(String text) => Padding(
        padding: const EdgeInsets.only(bottom: 4),
        child: Text(
          text,
          style: const TextStyle(
            color: Color(0xFF8888AA),
            fontSize: 11,
            fontWeight: FontWeight.bold,
            letterSpacing: 1.5,
          ),
        ),
      );

  Widget _sideBox(String label, String value) => Container(
        padding: const EdgeInsets.symmetric(vertical: 8, horizontal: 8),
        decoration: BoxDecoration(
          color: const Color(0xFF0D0D1A),
          borderRadius: BorderRadius.circular(6),
        ),
        child: Column(children: [
          Text(
            label,
            style: const TextStyle(
              color: Color(0xFF8888AA),
              fontSize: 10,
              fontWeight: FontWeight.bold,
              letterSpacing: 1,
            ),
          ),
          const SizedBox(height: 2),
          Text(
            value,
            style: const TextStyle(
              color: Colors.white,
              fontSize: 18,
              fontWeight: FontWeight.w900,
            ),
          ),
        ]),
      );

  Widget _buildGameOverOverlay() => Container(
        color: Colors.black54,
        child: Center(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Text(
                'GAME OVER',
                style: TextStyle(
                  color: Colors.white,
                  fontSize: 22,
                  fontWeight: FontWeight.w900,
                ),
              ),
              const SizedBox(height: 8),
              Text(
                'Điểm: ${_ctrl.model.score}',
                style: const TextStyle(color: Colors.white70),
              ),
              const SizedBox(height: 12),
              FilledButton(
                onPressed: () {
                  _ctrl.startGame();
                  setState(() {});
                },
                style: FilledButton.styleFrom(
                  backgroundColor: const Color(0xFF4CAF50),
                ),
                child: const Text('Chơi lại'),
              ),
            ],
          ),
        ),
      );

  Widget _buildPauseOverlay() => Container(
        color: Colors.black45,
        child: const Center(
          child: Text(
            'TẠM DỪNG',
            style: TextStyle(
              color: Colors.white,
              fontSize: 28,
              fontWeight: FontWeight.w900,
            ),
          ),
        ),
      );
}
