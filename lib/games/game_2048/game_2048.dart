// game_2048.dart — 2048 game extracted from main.dart
// Giữ nguyên toàn bộ logic + UI gốc

import 'dart:math';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../../coin/coin_service.dart';

// =============================================================================
// DATA MODEL
// =============================================================================

class Tile {
  int value;
  bool isNew;
  Tile({this.value = 0, this.isNew = false});
}

enum Direction { left, right, up, down }

// =============================================================================
// GAME CONTROLLER
// =============================================================================

class GameController {
  static const int size = 4;

  late List<List<Tile>> grid;
  int score = 0;
  int bestScore = 0;
  bool gameOver = false;
  bool gameWon = false;

  final Random _rng = Random();

  void newGame() {
    grid = List.generate(size, (_) => List.generate(size, (_) => Tile()));
    score = 0;
    gameOver = false;
    gameWon = false;
    _spawnTile();
    _spawnTile();
  }

  bool move(Direction dir) {
    for (final row in grid) {
      for (final tile in row) {
        tile.isNew = false;
      }
    }

    bool moved = false;

    switch (dir) {
      case Direction.left:
        for (int r = 0; r < size; r++) {
          final orig = _rowValues(r);
          final next = _slideLine(orig);
          if (!_equal(orig, next)) moved = true;
          for (int c = 0; c < size; c++) { grid[r][c].value = next[c]; }
        }
      case Direction.right:
        for (int r = 0; r < size; r++) {
          final orig = _rowValues(r).reversed.toList();
          final next = _slideLine(orig);
          if (!_equal(orig, next)) moved = true;
          for (int c = 0; c < size; c++) { grid[r][size - 1 - c].value = next[c]; }
        }
      case Direction.up:
        for (int c = 0; c < size; c++) {
          final orig = _colValues(c);
          final next = _slideLine(orig);
          if (!_equal(orig, next)) moved = true;
          for (int r = 0; r < size; r++) { grid[r][c].value = next[r]; }
        }
      case Direction.down:
        for (int c = 0; c < size; c++) {
          final orig = _colValues(c).reversed.toList();
          final next = _slideLine(orig);
          if (!_equal(orig, next)) moved = true;
          for (int r = 0; r < size; r++) { grid[size - 1 - r][c].value = next[r]; }
        }
    }

    if (moved) {
      _spawnTile();
      _checkStatus();
      if (score > bestScore) bestScore = score;
    }

    return moved;
  }

  List<int> _rowValues(int r) =>
      [for (int c = 0; c < size; c++) grid[r][c].value];

  List<int> _colValues(int c) =>
      [for (int r = 0; r < size; r++) grid[r][c].value];

  List<int> _slideLine(List<int> line) {
    final nonZero = line.where((v) => v != 0).toList();
    final out = <int>[];
    var i = 0;
    while (i < nonZero.length) {
      if (i + 1 < nonZero.length && nonZero[i] == nonZero[i + 1]) {
        final merged = nonZero[i] * 2;
        out.add(merged);
        score += merged;
        i += 2;
      } else {
        out.add(nonZero[i]);
        i++;
      }
    }
    while (out.length < size) { out.add(0); }
    return out;
  }

  bool _equal(List<int> a, List<int> b) {
    for (var i = 0; i < a.length; i++) {
      if (a[i] != b[i]) return false;
    }
    return true;
  }

  void _spawnTile() {
    final empty = <(int, int)>[
      for (int r = 0; r < size; r++)
        for (int c = 0; c < size; c++)
          if (grid[r][c].value == 0) (r, c),
    ];
    if (empty.isEmpty) return;
    final (r, c) = empty[_rng.nextInt(empty.length)];
    grid[r][c] = Tile(
      value: _rng.nextDouble() < 0.9 ? 2 : 4,
      isNew: true,
    );
  }

  void _checkStatus() {
    if (!gameWon) {
      for (final row in grid) {
        for (final tile in row) {
          if (tile.value == 2048) {
            gameWon = true;
            return;
          }
        }
      }
    }

    for (final row in grid) {
      for (final tile in row) {
        if (tile.value == 0) return;
      }
    }
    for (int r = 0; r < size; r++) {
      for (int c = 0; c < size; c++) {
        final v = grid[r][c].value;
        if (c + 1 < size && grid[r][c + 1].value == v) return;
        if (r + 1 < size && grid[r + 1][c].value == v) return;
      }
    }
    gameOver = true;
  }
}

// =============================================================================
// GAME SCREEN
// =============================================================================

class GameScreen extends StatefulWidget {
  const GameScreen({super.key});

  @override
  State<GameScreen> createState() => _GameScreenState();
}

class _GameScreenState extends State<GameScreen>
    with SingleTickerProviderStateMixin {
  final _game = GameController();

  late final AnimationController _spawnCtrl;
  late final Animation<double> _spawnAnim;

  final _focusNode = FocusNode();
  bool _winDialogShown = false;
  Offset _panStart = Offset.zero;

  @override
  void initState() {
    super.initState();
    _game.newGame();
    _loadBestScore();

    _spawnCtrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 220),
    );
    _spawnAnim = CurvedAnimation(parent: _spawnCtrl, curve: Curves.elasticOut);
  }

  @override
  void dispose() {
    _spawnCtrl.dispose();
    _focusNode.dispose();
    super.dispose();
  }

  Future<void> _loadBestScore() async {
    final prefs = await SharedPreferences.getInstance();
    setState(() => _game.bestScore = prefs.getInt('best_score_2048') ?? 0);
  }

  Future<void> _saveBestScore() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setInt('best_score_2048', _game.bestScore);
  }

  void _move(Direction dir) {
    if (_game.gameOver) return;

    final changed = _game.move(dir);
    if (!changed) return;

    _spawnCtrl.forward(from: 0.0);
    setState(() {});
    _saveBestScore();

    if (_game.gameWon && !_winDialogShown) {
      _winDialogShown = true;
      CoinService.instance.reportGameScore('2048', won: true);
      Future.delayed(const Duration(milliseconds: 250), _showWinDialog);
    } else if (_game.gameOver) {
      final maxTile = _game.grid.expand((r) => r).map((t) => t.value).reduce(max);
      CoinService.instance.reportGameScore('2048', score: maxTile);
      Future.delayed(const Duration(milliseconds: 250), _showGameOverDialog);
    }
  }

  void _startNewGame() {
    _game.newGame();
    _winDialogShown = false;
    _spawnCtrl.forward(from: 0.0);
    setState(() {});
  }

  void _showWinDialog() {
    if (!mounted) return;
    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
        backgroundColor: const Color(0xFFEDCF72),
        title: const Text(
          'Bạn đã thắng! 🎉',
          textAlign: TextAlign.center,
          style: TextStyle(fontSize: 24, fontWeight: FontWeight.w900, color: Color(0xFF776E65)),
        ),
        content: Text(
          'Chúc mừng! Bạn đã đạt ô 2048!\nĐiểm: ${_game.score}',
          textAlign: TextAlign.center,
          style: const TextStyle(fontSize: 15, color: Color(0xFF776E65)),
        ),
        actionsAlignment: MainAxisAlignment.spaceEvenly,
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('Tiếp tục', style: TextStyle(color: Color(0xFF776E65), fontWeight: FontWeight.bold)),
          ),
          FilledButton(
            onPressed: () { Navigator.pop(ctx); _startNewGame(); },
            style: FilledButton.styleFrom(backgroundColor: const Color(0xFF8F7A66)),
            child: const Text('Ván mới'),
          ),
        ],
      ),
    );
  }

  void _showGameOverDialog() {
    if (!mounted) return;
    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
        backgroundColor: const Color(0xFF776E65),
        title: const Text(
          'Game Over!',
          textAlign: TextAlign.center,
          style: TextStyle(fontSize: 24, fontWeight: FontWeight.w900, color: Colors.white),
        ),
        content: Text(
          'Không còn nước đi nào!\nĐiểm: ${_game.score}',
          textAlign: TextAlign.center,
          style: const TextStyle(fontSize: 15, color: Color(0xFFEEE4DA)),
        ),
        actionsAlignment: MainAxisAlignment.center,
        actions: [
          FilledButton(
            onPressed: () { Navigator.pop(ctx); _startNewGame(); },
            style: FilledButton.styleFrom(
              backgroundColor: const Color(0xFFEDCF72),
              foregroundColor: const Color(0xFF776E65),
            ),
            child: const Text('Chơi lại', style: TextStyle(fontWeight: FontWeight.bold)),
          ),
        ],
      ),
    );
  }

  void _onKeyEvent(KeyEvent event) {
    if (event is! KeyDownEvent) return;
    switch (event.logicalKey) {
      case LogicalKeyboardKey.arrowLeft:  _move(Direction.left);
      case LogicalKeyboardKey.arrowRight: _move(Direction.right);
      case LogicalKeyboardKey.arrowUp:    _move(Direction.up);
      case LogicalKeyboardKey.arrowDown:  _move(Direction.down);
    }
  }

  void _onPanStart(DragStartDetails details) => _panStart = details.localPosition;

  void _onPanEnd(DragEndDetails details) {
    final delta = details.localPosition - _panStart;
    final vel = details.velocity.pixelsPerSecond;

    final useVel = vel.distance >= 150;
    final dx = useVel ? vel.dx : delta.dx;
    final dy = useVel ? vel.dy : delta.dy;
    final minMag = useVel ? 150.0 : 30.0;

    if (dx.abs() < minMag && dy.abs() < minMag) return;

    if (dx.abs() > dy.abs()) {
      if (dx > 0) { _move(Direction.right); } else { _move(Direction.left); }
    } else {
      if (dy > 0) { _move(Direction.down); } else { _move(Direction.up); }
    }
  }

  @override
  Widget build(BuildContext context) {
    final canPop = Navigator.canPop(context);

    return KeyboardListener(
      focusNode: _focusNode,
      autofocus: true,
      onKeyEvent: _onKeyEvent,
      child: Scaffold(
        backgroundColor: const Color(0xFFFAF8EF),
        body: SafeArea(
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 20),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                _buildHeader(canPop),
                const SizedBox(height: 12),
                _buildScores(),
                const SizedBox(height: 24),
                _buildBoard(),
                const SizedBox(height: 16),
                _buildHint(),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildHeader(bool canPop) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.center,
      children: [
        if (canPop) ...[
          IconButton(
            onPressed: () => Navigator.pop(context),
            icon: const Icon(Icons.arrow_back_ios_new_rounded, size: 20),
            color: const Color(0xFF776E65),
            padding: EdgeInsets.zero,
            constraints: const BoxConstraints(),
            tooltip: 'Về menu',
          ),
          const SizedBox(width: 6),
        ],
        const Text(
          '2048',
          style: TextStyle(fontSize: 52, fontWeight: FontWeight.w900, color: Color(0xFF776E65)),
        ),
        const Spacer(),
        FilledButton.icon(
          onPressed: _startNewGame,
          icon: const Icon(Icons.refresh_rounded, size: 18),
          label: const Text('New Game'),
          style: FilledButton.styleFrom(
            backgroundColor: const Color(0xFF8F7A66),
            foregroundColor: Colors.white,
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
            textStyle: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14),
          ),
        ),
      ],
    );
  }

  Widget _buildScores() {
    return Row(
      mainAxisAlignment: MainAxisAlignment.end,
      children: [
        _scoreBox('SCORE', _game.score),
        const SizedBox(width: 8),
        _scoreBox('BEST', _game.bestScore),
      ],
    );
  }

  Widget _scoreBox(String label, int value) {
    return Container(
      constraints: const BoxConstraints(minWidth: 90),
      padding: const EdgeInsets.symmetric(vertical: 8, horizontal: 16),
      decoration: BoxDecoration(color: const Color(0xFFBBADA0), borderRadius: BorderRadius.circular(8)),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(label, style: const TextStyle(color: Color(0xFFEEE4DA), fontSize: 11, fontWeight: FontWeight.bold, letterSpacing: 1.5)),
          const SizedBox(height: 2),
          Text('$value', style: const TextStyle(color: Colors.white, fontSize: 20, fontWeight: FontWeight.w900)),
        ],
      ),
    );
  }

  Widget _buildBoard() {
    const gap = 8.0;
    const boardPadding = 8.0;

    return GestureDetector(
      behavior: HitTestBehavior.opaque,
      onPanStart: _onPanStart,
      onPanEnd: _onPanEnd,
      child: AspectRatio(
        aspectRatio: 1,
        child: Container(
          padding: const EdgeInsets.all(boardPadding),
          decoration: BoxDecoration(color: const Color(0xFFBBADA0), borderRadius: BorderRadius.circular(8)),
          child: Column(
            children: List.generate(GameController.size, (r) {
              return Expanded(
                child: Row(
                  children: List.generate(GameController.size, (c) {
                    return Expanded(
                      child: Padding(
                        padding: EdgeInsets.only(left: c > 0 ? gap : 0, top: r > 0 ? gap : 0),
                        child: _buildTile(_game.grid[r][c]),
                      ),
                    );
                  }),
                ),
              );
            }),
          ),
        ),
      ),
    );
  }

  Widget _buildTile(Tile tile) {
    final cell = Container(
      decoration: BoxDecoration(color: _tileColor(tile.value), borderRadius: BorderRadius.circular(6)),
      child: Center(
        child: tile.value == 0
            ? const SizedBox.shrink()
            : FittedBox(
                fit: BoxFit.scaleDown,
                child: Padding(
                  padding: const EdgeInsets.all(6),
                  child: Text(
                    '${tile.value}',
                    style: TextStyle(
                      color: _tileTextColor(tile.value),
                      fontSize: _tileFontSize(tile.value),
                      fontWeight: FontWeight.w900,
                    ),
                  ),
                ),
              ),
      ),
    );

    if (tile.isNew) return ScaleTransition(scale: _spawnAnim, child: cell);
    return cell;
  }

  Widget _buildHint() {
    return const Text(
      'Vuốt để di chuyển • Mục tiêu: đạt ô 2048!',
      textAlign: TextAlign.center,
      style: TextStyle(color: Color(0xFFA09080), fontSize: 13),
    );
  }

  static const Map<int, Color> _bgColors = {
    0: Color(0xFFCDC1B4), 2: Color(0xFFEEE4DA), 4: Color(0xFFEDE0C8),
    8: Color(0xFFF2B179), 16: Color(0xFFF59563), 32: Color(0xFFF67C5F),
    64: Color(0xFFF65E3B), 128: Color(0xFFEDCF72), 256: Color(0xFFEDCC61),
    512: Color(0xFFEDC850), 1024: Color(0xFFEDC53F), 2048: Color(0xFFEDC22E),
  };

  Color _tileColor(int v) => _bgColors[v] ?? const Color(0xFF3C3A32);
  Color _tileTextColor(int v) => v <= 4 ? const Color(0xFF776E65) : const Color(0xFFF9F6F2);
  double _tileFontSize(int v) {
    if (v < 100) return 38;
    if (v < 1000) return 30;
    if (v < 10000) return 22;
    return 18;
  }
}
