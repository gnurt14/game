// sliding_puzzle_game.dart — Sliding Puzzle (15-puzzle) for Super Gate Hub
//
// Kiến trúc:
//   ── MODEL ──────────────────────────────────────────────
//   • SlidingPuzzleModel  — Dữ liệu trạng thái game
//   ── CONTROLLER ─────────────────────────────────────────
//   • SlidingPuzzleController — Logic (shuffle, slide, solvable check)
//   ── SCREEN ─────────────────────────────────────────────
//   • SlidingPuzzleScreen — StatefulWidget chính

import 'dart:math';
import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../../coin/coin_service.dart';

// =============================================================================
// MODEL
// =============================================================================

class SlidingPuzzleModel {
  int gridSize = 4; // 3 hoặc 4
  List<int> tiles = []; // [1,2,...,n²-1, 0] — 0 là ô trống
  int blankIndex = 0; // vị trí ô trống trong tiles
  int moves = 0;
  int bestMoves3 = 0; // best cho 3×3
  int bestMoves4 = 0; // best cho 4×4
  bool isSolved = false;
  bool isInitialized = false;
}

// =============================================================================
// CONTROLLER
// =============================================================================

class SlidingPuzzleController {
  final SlidingPuzzleModel model = SlidingPuzzleModel();
  final Random _rng = Random();

  // Khởi tạo và shuffle game mới với kích thước [size]
  void newGame(int size) {
    model.gridSize = size;
    model.moves = 0;
    model.isSolved = false;
    model.isInitialized = true;

    // Khởi tạo tiles [1, 2, ..., n²-1, 0]
    final n = size * size;
    model.tiles = List.generate(n, (i) => i < n - 1 ? i + 1 : 0);

    // Shuffle cho đến khi có thể giải được
    _shuffle(size);
    model.blankIndex = model.tiles.indexOf(0);
  }

  // Trả true nếu tile tại [index] kề ô trống và có thể trượt
  bool canSlide(int index) {
    final blank = model.blankIndex;
    final size = model.gridSize;

    if (index == blank) return false;

    final diff = (index - blank).abs();

    // Cùng cột: cách nhau đúng 1 hàng
    if (diff == size) return true;

    // Cùng hàng: cách nhau đúng 1 cột VÀ cùng row
    if (diff == 1 && index ~/ size == blank ~/ size) return true;

    return false;
  }

  // Hoán đổi tile tại [index] với ô trống, tăng moves, kiểm tra thắng
  void slide(int index) {
    if (!canSlide(index)) return;

    final tmp = model.tiles[index];
    model.tiles[index] = model.tiles[model.blankIndex];
    model.tiles[model.blankIndex] = tmp;
    model.blankIndex = index;
    model.moves++;
    model.isSolved = _checkSolved();
  }

  // Fisher-Yates shuffle rồi kiểm tra solvable
  void _shuffle(int size) {
    do {
      final n = model.tiles.length;
      for (int i = n - 1; i > 0; i--) {
        final j = _rng.nextInt(i + 1);
        final tmp = model.tiles[i];
        model.tiles[i] = model.tiles[j];
        model.tiles[j] = tmp;
      }
    } while (!_isSolvable(model.tiles, size) || _checkSolved());
  }

  // Kiểm tra trạng thái puzzle có thể giải được không
  bool _isSolvable(List<int> tiles, int size) {
    int inversions = 0;
    final n = tiles.length;

    for (int i = 0; i < n - 1; i++) {
      if (tiles[i] == 0) continue;
      for (int j = i + 1; j < n; j++) {
        if (tiles[j] == 0) continue;
        if (tiles[i] > tiles[j]) inversions++;
      }
    }

    if (size % 2 == 1) {
      // Grid lẻ (3×3): solvable nếu inversions chẵn
      return inversions % 2 == 0;
    } else {
      // Grid chẵn (4×4): tính hàng của ô trống tính từ dưới lên
      final blankIdx = tiles.indexOf(0);
      final blankRowFromBottom = size - (blankIdx ~/ size);
      return (inversions + blankRowFromBottom) % 2 == 0;
    }
  }

  // Kiểm tra puzzle đã được giải chưa: [1, 2, ..., n²-1, 0]
  bool _checkSolved() {
    final n = model.tiles.length;
    for (int i = 0; i < n - 1; i++) {
      if (model.tiles[i] != i + 1) return false;
    }
    return model.tiles[n - 1] == 0;
  }

  // Lấy best moves theo gridSize hiện tại
  int get bestMoves =>
      model.gridSize == 3 ? model.bestMoves3 : model.bestMoves4;

  // Lưu best moves vào SharedPreferences
  Future<void> _saveBest() async {
    final prefs = await SharedPreferences.getInstance();
    if (model.gridSize == 3) {
      final current = model.bestMoves3;
      if (current == 0 || model.moves < current) {
        model.bestMoves3 = model.moves;
        await prefs.setInt('best_moves_sliding_3x3', model.moves);
      }
    } else {
      final current = model.bestMoves4;
      if (current == 0 || model.moves < current) {
        model.bestMoves4 = model.moves;
        await prefs.setInt('best_moves_sliding_4x4', model.moves);
      }
    }
  }

  // Gọi sau khi isSolved == true để lưu kỷ lục
  Future<void> saveBestIfNeeded() => _saveBest();

  // Tải best moves từ SharedPreferences
  Future<void> loadBest() async {
    final prefs = await SharedPreferences.getInstance();
    model.bestMoves3 = prefs.getInt('best_moves_sliding_3x3') ?? 0;
    model.bestMoves4 = prefs.getInt('best_moves_sliding_4x4') ?? 0;
  }
}

// =============================================================================
// SCREEN
// =============================================================================

class SlidingPuzzleScreen extends StatefulWidget {
  const SlidingPuzzleScreen({super.key});

  @override
  State<SlidingPuzzleScreen> createState() => _SlidingPuzzleScreenState();
}

class _SlidingPuzzleScreenState extends State<SlidingPuzzleScreen> {
  final SlidingPuzzleController _ctrl = SlidingPuzzleController();
  bool _winDialogShown = false;

  @override
  void initState() {
    super.initState();
    _ctrl.loadBest().then((_) {
      if (mounted) {
        setState(() => _ctrl.newGame(4));
      }
    });
  }

  // ---------------------------------------------------------------------------
  // Game actions
  // ---------------------------------------------------------------------------

  void _slide(int index) {
    if (_ctrl.model.isSolved) return;
    if (!_ctrl.canSlide(index)) return;

    setState(() => _ctrl.slide(index));

    if (_ctrl.model.isSolved && !_winDialogShown) {
      _winDialogShown = true;
      _ctrl.saveBestIfNeeded().then((_) {
        CoinService.instance.reportGameScore('sliding_puzzle', won: true, moves: _ctrl.model.moves, level: _ctrl.model.gridSize);
        if (mounted) {
          setState(() {}); // refresh best score display
        }
      });
      Future.delayed(const Duration(milliseconds: 300), _showWinDialog);
    }
  }

  void _newGame([int? size]) {
    _winDialogShown = false;
    setState(() => _ctrl.newGame(size ?? _ctrl.model.gridSize));
  }

  void _setGridSize(int size) {
    if (_ctrl.model.gridSize == size) return;
    _winDialogShown = false;
    setState(() => _ctrl.newGame(size));
  }

  // ---------------------------------------------------------------------------
  // Win dialog
  // ---------------------------------------------------------------------------

  void _showWinDialog() {
    if (!mounted) return;

    final int current = _ctrl.model.moves;
    final int best = _ctrl.bestMoves;
    final bool isNewRecord = best == current;

    showDialog<void>(
      context: context,
      barrierDismissible: false,
      builder: (_) => AlertDialog(
        backgroundColor: const Color(0xFF1A1A2E),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: const Text(
          '🎉 Giải xong!',
          textAlign: TextAlign.center,
          style: TextStyle(
            color: Colors.white,
            fontWeight: FontWeight.w900,
            fontSize: 22,
          ),
        ),
        content: Text(
          'Số bước: $current'
          '${isNewRecord ? '\n🏆 Kỷ lục mới!' : ''}',
          textAlign: TextAlign.center,
          style: const TextStyle(color: Colors.white70, fontSize: 15),
        ),
        actionsAlignment: MainAxisAlignment.center,
        actions: [
          FilledButton(
            onPressed: () {
              Navigator.pop(context);
              _newGame();
            },
            style: FilledButton.styleFrom(
              backgroundColor: const Color(0xFF26C6DA),
              foregroundColor: Colors.white,
            ),
            child: const Text(
              'Chơi lại',
              style: TextStyle(fontWeight: FontWeight.bold),
            ),
          ),
        ],
      ),
    );
  }

  // ---------------------------------------------------------------------------
  // Build
  // ---------------------------------------------------------------------------

  @override
  Widget build(BuildContext context) {
    final model = _ctrl.model;
    final canPop = Navigator.canPop(context);

    return Scaffold(
      backgroundColor: const Color(0xFF0A0A1A),
      body: SafeArea(
        child: Column(
          children: [
            _buildHeader(canPop),
            const SizedBox(height: 8),
            _buildControlsRow(model),
            const SizedBox(height: 12),
            _buildShuffleButton(),
            const SizedBox(height: 16),
            Expanded(
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 16),
                child: model.isInitialized
                    ? _buildBoard(model)
                    : const Center(
                        child: CircularProgressIndicator(
                          color: Color(0xFF26C6DA),
                        ),
                      ),
              ),
            ),
            const SizedBox(height: 16),
          ],
        ),
      ),
    );
  }

  // Header: back (nếu có) + tiêu đề
  Widget _buildHeader(bool canPop) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      child: Row(
        children: [
          if (canPop)
            IconButton(
              icon: const Icon(Icons.arrow_back_ios_new_rounded),
              color: Colors.white,
              onPressed: () => Navigator.pop(context),
              tooltip: 'Về menu',
            ),
          const Text(
            'SLIDING PUZZLE',
            style: TextStyle(
              color: Colors.white,
              fontSize: 22,
              fontWeight: FontWeight.w900,
              letterSpacing: 1.5,
            ),
          ),
        ],
      ),
    );
  }

  // Controls row: size chips + BEST + MOVES
  Widget _buildControlsRow(SlidingPuzzleModel model) {
    final best = _ctrl.bestMoves;

    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16),
      child: Row(
        children: [
          _sizeChip('3×3', 3, model.gridSize),
          const SizedBox(width: 8),
          _sizeChip('4×4', 4, model.gridSize),
          const Spacer(),
          _statBox('BEST', best == 0 ? '-' : '$best'),
          const SizedBox(width: 8),
          _statBox('MOVES', '${model.moves}'),
        ],
      ),
    );
  }

  Widget _sizeChip(String label, int size, int currentSize) {
    final bool active = currentSize == size;
    return GestureDetector(
      onTap: () => _setGridSize(size),
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 200),
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
        decoration: BoxDecoration(
          color: active ? const Color(0xFF26C6DA) : Colors.transparent,
          borderRadius: BorderRadius.circular(20),
          border: Border.all(
            color: active ? const Color(0xFF26C6DA) : Colors.white30,
          ),
        ),
        child: Text(
          label,
          style: TextStyle(
            color: active ? Colors.white : Colors.white54,
            fontWeight: FontWeight.bold,
            fontSize: 14,
          ),
        ),
      ),
    );
  }

  Widget _statBox(String label, String value) {
    return Container(
      constraints: const BoxConstraints(minWidth: 72),
      padding: const EdgeInsets.symmetric(vertical: 6, horizontal: 12),
      decoration: BoxDecoration(
        color: const Color(0xFF12122A),
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: Colors.white12),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(
            label,
            style: const TextStyle(
              color: Colors.white54,
              fontSize: 10,
              fontWeight: FontWeight.bold,
              letterSpacing: 1.2,
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
        ],
      ),
    );
  }

  Widget _buildShuffleButton() {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16),
      child: Align(
        alignment: Alignment.centerLeft,
        child: OutlinedButton.icon(
          onPressed: () => _newGame(),
          icon: const Icon(Icons.shuffle_rounded, size: 18),
          label: const Text('Shuffle'),
          style: OutlinedButton.styleFrom(
            foregroundColor: const Color(0xFF26C6DA),
            side: const BorderSide(color: Color(0xFF26C6DA)),
            padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 10),
          ),
        ),
      ),
    );
  }

  // Board: AspectRatio 1:1 với GridView.count
  Widget _buildBoard(SlidingPuzzleModel model) {
    return AspectRatio(
      aspectRatio: 1,
      child: Container(
        padding: const EdgeInsets.all(6),
        decoration: BoxDecoration(
          color: const Color(0xFF12122A),
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: Colors.white10),
        ),
        child: GridView.count(
          physics: const NeverScrollableScrollPhysics(),
          crossAxisCount: model.gridSize,
          mainAxisSpacing: 4,
          crossAxisSpacing: 4,
          children: List.generate(model.tiles.length, (i) {
            return _buildTile(i, model);
          }),
        ),
      ),
    );
  }

  Widget _buildTile(int index, SlidingPuzzleModel model) {
    final tile = model.tiles[index];
    final isBlank = tile == 0;
    final canMove = !isBlank && _ctrl.canSlide(index);

    if (isBlank) {
      return const SizedBox.shrink();
    }

    final int total = model.gridSize * model.gridSize;
    final double ratio = (tile - 1) / (total - 2).clamp(1, total - 2);
    final Color tileColor =
        Color.lerp(const Color(0xFF26C6DA), const Color(0xFF7E57C2), ratio)!;

    return GestureDetector(
      onTap: () => _slide(index),
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 80),
        margin: const EdgeInsets.all(2),
        decoration: BoxDecoration(
          color: tileColor,
          borderRadius: BorderRadius.circular(8),
          boxShadow: canMove
              ? [
                  BoxShadow(
                    color: Colors.white.withAlpha(51), // white20 = 0.2 * 255 ≈ 51
                    blurRadius: 6,
                    spreadRadius: 1,
                  ),
                ]
              : null,
        ),
        child: Center(
          child: Text(
            '$tile',
            style: TextStyle(
              color: Colors.white,
              fontWeight: FontWeight.bold,
              fontSize: model.gridSize == 3 ? 28 : 22,
            ),
          ),
        ),
      ),
    );
  }
}
