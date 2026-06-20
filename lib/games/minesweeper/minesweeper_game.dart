// minesweeper_game.dart — Minesweeper game for Flutter Super Gate hub
//
// Kiến trúc:
//   ── MODEL ────────────────────────────────────────────────
//   • MineCell              — Dữ liệu 1 ô (mine, revealed, flagged, adjacent)
//   • MinesweeperDifficulty — easy / medium / hard
//   • MswState              — idle / playing / won / lost
//   • MinesweeperModel      — Toàn bộ trạng thái game
//   ── CONTROLLER ───────────────────────────────────────────
//   • MinesweeperController — Logic: tap, longPress, BFS reveal, timer
//   ── SCREEN ───────────────────────────────────────────────
//   • MinesweeperScreen     — StatefulWidget UI

import 'dart:async';
import 'dart:collection';
import 'dart:math';
import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../../coin/coin_service.dart';

// =============================================================================
// MODEL
// =============================================================================

class MineCell {
  bool isMine = false;
  bool isRevealed = false;
  bool isFlagged = false;
  int adjacentMines = 0;
}

enum MinesweeperDifficulty { easy, medium, hard }

enum MswState { idle, playing, won, lost }

class MinesweeperModel {
  List<List<MineCell>> grid = [];
  int rows = 9;
  int cols = 9;
  int totalMines = 10;
  MinesweeperDifficulty difficulty = MinesweeperDifficulty.easy;
  MswState state = MswState.idle;
  bool firstTap = true;
  int flagsUsed = 0;
  int elapsedSeconds = 0;
  int? bestTime;
  int? triggeredMineR;
  int? triggeredMineC;
}

// =============================================================================
// CONTROLLER
// =============================================================================

class MinesweeperController {
  final MinesweeperModel model = MinesweeperModel();
  Timer? _clockTimer;
  final Random _rng = Random();

  VoidCallback? onUpdate;

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  void newGame(MinesweeperDifficulty d) {
    _clockTimer?.cancel();

    model.difficulty = d;
    switch (d) {
      case MinesweeperDifficulty.easy:
        model.rows = 9;
        model.cols = 9;
        model.totalMines = 10;
      case MinesweeperDifficulty.medium:
        model.rows = 9;
        model.cols = 16;
        model.totalMines = 30;
      case MinesweeperDifficulty.hard:
        model.rows = 16;
        model.cols = 16;
        model.totalMines = 55;
    }

    model.grid = List.generate(
      model.rows,
      (_) => List.generate(model.rows > 0 ? model.cols : 0, (_) => MineCell()),
    );
    model.state = MswState.idle;
    model.firstTap = true;
    model.flagsUsed = 0;
    model.elapsedSeconds = 0;
    model.triggeredMineR = null;
    model.triggeredMineC = null;

    _loadBestTime();
  }

  void tap(int r, int c) {
    if (model.state == MswState.lost || model.state == MswState.won) return;
    final cell = model.grid[r][c];
    if (cell.isFlagged) return;

    if (model.firstTap) {
      _placeMines(r, c);
      _calcAdjacent();
      model.firstTap = false;
      model.state = MswState.playing;
      _startClock();
    }

    if (cell.isRevealed) return;

    _reveal(r, c);

    if (model.grid[r][c].isMine) {
      model.state = MswState.lost;
      CoinService.instance.reportGameScore('minesweeper', won: false);
      model.triggeredMineR = r;
      model.triggeredMineC = c;
      _revealAllMines();
      _clockTimer?.cancel();
    } else {
      _checkWin();
    }

    onUpdate?.call();
  }

  void longPress(int r, int c) {
    if (model.state == MswState.lost || model.state == MswState.won) return;
    final cell = model.grid[r][c];
    if (cell.isRevealed) return;

    cell.isFlagged = !cell.isFlagged;
    model.flagsUsed += cell.isFlagged ? 1 : -1;
    onUpdate?.call();
  }

  void dispose() {
    _clockTimer?.cancel();
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  void _placeMines(int safeR, int safeC) {
    // Build safe zone: (safeR, safeC) + 8 neighbours
    final safeZone = <String>{};
    for (int dr = -1; dr <= 1; dr++) {
      for (int dc = -1; dc <= 1; dc++) {
        final nr = safeR + dr;
        final nc = safeC + dc;
        if (nr >= 0 && nr < model.rows && nc >= 0 && nc < model.cols) {
          safeZone.add('$nr,$nc');
        }
      }
    }

    int placed = 0;
    while (placed < model.totalMines) {
      final r = _rng.nextInt(model.rows);
      final c = _rng.nextInt(model.cols);
      if (safeZone.contains('$r,$c')) continue;
      if (model.grid[r][c].isMine) continue;
      model.grid[r][c].isMine = true;
      placed++;
    }
  }

  void _calcAdjacent() {
    for (int r = 0; r < model.rows; r++) {
      for (int c = 0; c < model.cols; c++) {
        if (model.grid[r][c].isMine) continue;
        int count = 0;
        for (int dr = -1; dr <= 1; dr++) {
          for (int dc = -1; dc <= 1; dc++) {
            if (dr == 0 && dc == 0) continue;
            final nr = r + dr;
            final nc = c + dc;
            if (nr >= 0 &&
                nr < model.rows &&
                nc >= 0 &&
                nc < model.cols &&
                model.grid[nr][nc].isMine) {
              count++;
            }
          }
        }
        model.grid[r][c].adjacentMines = count;
      }
    }
  }

  void _reveal(int r, int c) {
    final queue = Queue<(int, int)>();
    queue.add((r, c));

    while (queue.isNotEmpty) {
      final (cr, cc) = queue.removeFirst();
      if (cr < 0 || cr >= model.rows || cc < 0 || cc >= model.cols) continue;
      final cell = model.grid[cr][cc];
      if (cell.isRevealed || cell.isFlagged) continue;

      cell.isRevealed = true;

      if (!cell.isMine && cell.adjacentMines == 0) {
        for (int dr = -1; dr <= 1; dr++) {
          for (int dc = -1; dc <= 1; dc++) {
            if (dr == 0 && dc == 0) continue;
            queue.add((cr + dr, cc + dc));
          }
        }
      }
    }
  }

  void _revealAllMines() {
    for (int r = 0; r < model.rows; r++) {
      for (int c = 0; c < model.cols; c++) {
        if (model.grid[r][c].isMine) {
          model.grid[r][c].isRevealed = true;
        }
      }
    }
  }

  void _checkWin() {
    for (int r = 0; r < model.rows; r++) {
      for (int c = 0; c < model.cols; c++) {
        final cell = model.grid[r][c];
        if (!cell.isMine && !cell.isRevealed) return;
      }
    }
    // All non-mine cells revealed → won
    model.state = MswState.won;
    CoinService.instance.reportGameScore('minesweeper', won: true, level: model.difficulty.index, seconds: model.elapsedSeconds);
    _clockTimer?.cancel();
    _saveBestTime();
  }

  void _startClock() {
    _clockTimer?.cancel();
    _clockTimer = Timer.periodic(const Duration(seconds: 1), (_) {
      model.elapsedSeconds++;
      onUpdate?.call();
    });
  }

  // ---------------------------------------------------------------------------
  // Persistence
  // ---------------------------------------------------------------------------

  String get _prefKey {
    final suffix = switch (model.difficulty) {
      MinesweeperDifficulty.easy => 'easy',
      MinesweeperDifficulty.medium => 'medium',
      MinesweeperDifficulty.hard => 'hard',
    };
    return 'best_time_minesweeper_$suffix';
  }

  Future<void> _loadBestTime() async {
    final prefs = await SharedPreferences.getInstance();
    model.bestTime = prefs.getInt(_prefKey);
    onUpdate?.call();
  }

  Future<void> _saveBestTime() async {
    final current = model.elapsedSeconds;
    final best = model.bestTime;
    if (best == null || current < best) {
      model.bestTime = current;
      final prefs = await SharedPreferences.getInstance();
      await prefs.setInt(_prefKey, current);
    }
  }
}

// =============================================================================
// SCREEN
// =============================================================================

class MinesweeperScreen extends StatefulWidget {
  const MinesweeperScreen({super.key});

  @override
  State<MinesweeperScreen> createState() => _MinesweeperScreenState();
}

class _MinesweeperScreenState extends State<MinesweeperScreen> {
  final _ctrl = MinesweeperController();

  static const _bg = Color(0xFF1A1A2E);
  static const _cellHidden = Color(0xFF16213E);
  static const _cellBorder = Color(0xFF0F3460);
  static const _cellRevealed = Color(0xFF0A0A1A);

  static const List<Color> _numberColors = [
    Colors.transparent,       // 0 — not shown
    Color(0xFF1E88E5),        // 1 blue
    Color(0xFF43A047),        // 2 green
    Color(0xFFE53935),        // 3 red
    Color(0xFF1565C0),        // 4 dark blue
    Color(0xFFB71C1C),        // 5 dark red
    Color(0xFF00BCD4),        // 6 cyan
    Colors.black,             // 7 black
    Color(0xFF757575),        // 8 grey
  ];

  static const double _cellSize = 36.0;

  @override
  void initState() {
    super.initState();
    _ctrl.onUpdate = () {
      if (mounted) setState(() {});
    };
    _ctrl.newGame(MinesweeperDifficulty.easy);
  }

  @override
  void dispose() {
    _ctrl.dispose();
    super.dispose();
  }

  // ---------------------------------------------------------------------------
  // Build
  // ---------------------------------------------------------------------------

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: _bg,
      body: SafeArea(
        child: Column(
          children: [
            _buildHeader(context),
            _buildDifficultyRow(),
            _buildInfoRow(),
            Expanded(child: _buildGridArea()),
          ],
        ),
      ),
    );
  }

  // ---------------------------------------------------------------------------
  // Header
  // ---------------------------------------------------------------------------

  Widget _buildHeader(BuildContext context) {
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
            'MINESWEEPER',
            style: TextStyle(
              color: Color(0xFF00BCD4),
              fontSize: 22,
              fontWeight: FontWeight.w900,
              letterSpacing: 2,
            ),
          ),
        ],
      ),
    );
  }

  // ---------------------------------------------------------------------------
  // Difficulty row
  // ---------------------------------------------------------------------------

  Widget _buildDifficultyRow() {
    final m = _ctrl.model;
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          _diffChip('Easy', MinesweeperDifficulty.easy, m.difficulty),
          const SizedBox(width: 8),
          _diffChip('Medium', MinesweeperDifficulty.medium, m.difficulty),
          const SizedBox(width: 8),
          _diffChip('Hard', MinesweeperDifficulty.hard, m.difficulty),
        ],
      ),
    );
  }

  Widget _diffChip(
    String label,
    MinesweeperDifficulty value,
    MinesweeperDifficulty current,
  ) {
    final selected = value == current;
    return ChoiceChip(
      label: Text(label),
      selected: selected,
      onSelected: (_) {
        setState(() {
          _ctrl.newGame(value);
        });
      },
      selectedColor: const Color(0xFF0F3460),
      backgroundColor: const Color(0xFF16213E),
      labelStyle: TextStyle(
        color: selected ? const Color(0xFF00BCD4) : Colors.white54,
        fontWeight: selected ? FontWeight.bold : FontWeight.normal,
      ),
      side: BorderSide(
        color: selected ? const Color(0xFF00BCD4) : Colors.transparent,
      ),
    );
  }

  // ---------------------------------------------------------------------------
  // Info row
  // ---------------------------------------------------------------------------

  Widget _buildInfoRow() {
    final m = _ctrl.model;

    final stateIcon = switch (m.state) {
      MswState.idle => '😴',
      MswState.playing => '😊',
      MswState.won => '🎉',
      MswState.lost => '💥',
    };

    final bestStr = m.bestTime != null ? '${m.bestTime}s' : '--';

    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceEvenly,
        children: [
          _infoBox('🚩', '${m.flagsUsed}/${m.totalMines}'),
          _infoBox('⏱', '${m.elapsedSeconds}s'),
          _infoBox('🏆', bestStr),
          Text(stateIcon, style: const TextStyle(fontSize: 28)),
        ],
      ),
    );
  }

  Widget _infoBox(String icon, String value) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
      decoration: BoxDecoration(
        color: const Color(0xFF16213E),
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: _cellBorder),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(icon, style: const TextStyle(fontSize: 16)),
          const SizedBox(width: 6),
          Text(
            value,
            style: const TextStyle(
              color: Colors.white,
              fontSize: 14,
              fontWeight: FontWeight.bold,
            ),
          ),
        ],
      ),
    );
  }

  // ---------------------------------------------------------------------------
  // Grid
  // ---------------------------------------------------------------------------

  Widget _buildGridArea() {
    final m = _ctrl.model;
    final isWon = m.state == MswState.won;
    final isLost = m.state == MswState.lost;

    return Stack(
      children: [
        InteractiveViewer(
          constrained: false,
          minScale: 0.5,
          maxScale: 3.0,
          child: Padding(
            padding: const EdgeInsets.all(8),
            child: SizedBox(
              width: m.cols * _cellSize + (m.cols - 1) * 2,
              height: m.rows * _cellSize + (m.rows - 1) * 2,
              child: GridView.builder(
                shrinkWrap: true,
                physics: const NeverScrollableScrollPhysics(),
                gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
                  crossAxisCount: m.cols,
                  mainAxisSpacing: 2,
                  crossAxisSpacing: 2,
                  childAspectRatio: 1,
                  mainAxisExtent: _cellSize,
                ),
                itemCount: m.rows * m.cols,
                itemBuilder: (context, index) {
                  final r = index ~/ m.cols;
                  final c = index % m.cols;
                  return _buildCell(r, c);
                },
              ),
            ),
          ),
        ),
        if (isWon) _buildWonOverlay(),
        if (isLost) _buildLostOverlay(),
      ],
    );
  }

  Widget _buildCell(int r, int c) {
    final m = _ctrl.model;
    if (m.grid.isEmpty ||
        r >= m.grid.length ||
        c >= m.grid[r].length) {
      return const SizedBox.shrink();
    }
    final cell = m.grid[r][c];
    final isWon = m.state == MswState.won;
    final isLost = m.state == MswState.lost;
    final isTriggered =
        isLost && r == m.triggeredMineR && c == m.triggeredMineC;

    // Determine cell state for display
    final showFlagWon = isWon && cell.isMine && !cell.isRevealed;
    final showFlag = cell.isFlagged && !cell.isRevealed;
    final showMine = cell.isRevealed && cell.isMine;

    Color bgColor;
    Widget child;

    if (showMine) {
      bgColor = isTriggered ? const Color(0xFFB71C1C) : _cellRevealed;
      child = const Center(
        child: Text('💣', style: TextStyle(fontSize: 18)),
      );
    } else if (showFlagWon) {
      bgColor = _cellHidden;
      child = const Center(
        child: Text('🚩', style: TextStyle(fontSize: 18)),
      );
    } else if (showFlag) {
      bgColor = _cellHidden;
      child = const Center(
        child: Text('🚩', style: TextStyle(fontSize: 18)),
      );
    } else if (cell.isRevealed) {
      bgColor = _cellRevealed;
      if (cell.adjacentMines > 0) {
        child = Center(
          child: Text(
            '${cell.adjacentMines}',
            style: TextStyle(
              color: _numberColors[cell.adjacentMines],
              fontSize: 16,
              fontWeight: FontWeight.bold,
            ),
          ),
        );
      } else {
        child = const SizedBox.shrink();
      }
    } else {
      bgColor = _cellHidden;
      child = const SizedBox.shrink();
    }

    return GestureDetector(
      onTap: () => _ctrl.tap(r, c),
      onLongPress: () => _ctrl.longPress(r, c),
      child: Container(
        width: _cellSize,
        height: _cellSize,
        decoration: BoxDecoration(
          color: bgColor,
          borderRadius: BorderRadius.circular(3),
          border: Border.all(color: _cellBorder, width: 1),
        ),
        child: child,
      ),
    );
  }

  // ---------------------------------------------------------------------------
  // Overlays
  // ---------------------------------------------------------------------------

  Widget _buildWonOverlay() {
    final secs = _ctrl.model.elapsedSeconds;
    return Container(
      color: Colors.black54,
      child: Center(
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 32, vertical: 24),
          decoration: BoxDecoration(
            color: const Color(0xFF1B5E20),
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: const Color(0xFF43A047), width: 2),
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Text(
                '🎉 Thắng!',
                style: TextStyle(
                  color: Colors.white,
                  fontSize: 30,
                  fontWeight: FontWeight.w900,
                ),
              ),
              const SizedBox(height: 8),
              Text(
                '$secs giây',
                style: const TextStyle(
                  color: Color(0xFFA5D6A7),
                  fontSize: 18,
                ),
              ),
              const SizedBox(height: 16),
              FilledButton.icon(
                onPressed: () => setState(() {
                  _ctrl.newGame(_ctrl.model.difficulty);
                }),
                icon: const Icon(Icons.refresh_rounded),
                label: const Text('Chơi lại'),
                style: FilledButton.styleFrom(
                  backgroundColor: const Color(0xFF43A047),
                  foregroundColor: Colors.white,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildLostOverlay() {
    return Container(
      color: Colors.black54,
      child: Center(
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 32, vertical: 24),
          decoration: BoxDecoration(
            color: const Color(0xFF7F0000),
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: const Color(0xFFE53935), width: 2),
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Text(
                '💥 Thua!',
                style: TextStyle(
                  color: Colors.white,
                  fontSize: 30,
                  fontWeight: FontWeight.w900,
                ),
              ),
              const SizedBox(height: 16),
              FilledButton.icon(
                onPressed: () => setState(() {
                  _ctrl.newGame(_ctrl.model.difficulty);
                }),
                icon: const Icon(Icons.refresh_rounded),
                label: const Text('Chơi lại'),
                style: FilledButton.styleFrom(
                  backgroundColor: const Color(0xFFE53935),
                  foregroundColor: Colors.white,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
