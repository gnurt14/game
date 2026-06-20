// memory_game.dart — Memory Match Game for Super Gate Hub
//
// Kiến trúc:
//   ── MODEL ──────────────────────────────────────────────
//   • MemCardModel     — Dữ liệu 1 lá bài (pairId, emoji, trạng thái)
//   ── CONTROLLER ─────────────────────────────────────────
//   • MemoryController — Logic game (shuffle, flip, check match)
//   ── SCREEN ─────────────────────────────────────────────
//   • MemoryScreen     — StatefulWidget chính
//   • _MemoryScreenState — UI + AnimationController list (3D flip)

import 'dart:math';
import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../../coin/coin_service.dart';

// =============================================================================
// MODEL
// =============================================================================

class MemCardModel {
  final int pairId;
  final String emoji;
  bool isFaceUp;
  bool isMatched;

  MemCardModel({
    required this.pairId,
    required this.emoji,
    this.isFaceUp = false,
    this.isMatched = false,
  });
}

// =============================================================================
// CONTROLLER
// =============================================================================

class MemoryController {
  // Emoji pools
  static const List<String> _pool4x4 = [
    '🐶', '🐱', '🦊', '🐸', '🦋', '🌸', '⭐', '🍕',
  ];
  static const List<String> _pool6x6 = [
    '🐶', '🐱', '🦊', '🐸', '🦋', '🌸', '⭐', '🍕',
    '🎸', '🚀', '🌈', '🦄', '🍦', '🎯', '🔥', '💎', '🌊', '🎮',
  ];

  int gridSize = 4;
  List<MemCardModel> cards = [];
  int? firstIndex;
  int moves = 0;
  int matches = 0;
  bool isChecking = false;
  int bestMoves4 = 0;
  int bestMoves6 = 0;

  final Random _rng = Random();

  void newGame(int size) {
    gridSize = size;
    firstIndex = null;
    moves = 0;
    matches = 0;
    isChecking = false;

    final int pairs = (gridSize * gridSize) ~/ 2;
    final List<String> pool = gridSize == 4 ? _pool4x4 : _pool6x6;
    final List<String> selected = pool.sublist(0, pairs);

    // Tạo cặp rồi shuffle
    final List<MemCardModel> deck = [];
    for (int i = 0; i < pairs; i++) {
      deck.add(MemCardModel(pairId: i, emoji: selected[i]));
      deck.add(MemCardModel(pairId: i, emoji: selected[i]));
    }
    deck.shuffle(_rng);
    cards = deck;
  }

  /// Xử lý tap vào card tại [index].
  /// [refresh] được gọi để rebuild UI.
  /// [onWin] được gọi khi người chơi thắng.
  void flipCard(
    int index,
    void Function() refresh,
    void Function() onWin,
    void Function(int) animateForward,
    void Function(int) animateReverse,
  ) {
    if (isChecking) return;
    if (cards[index].isFaceUp) return;
    if (cards[index].isMatched) return;

    // Lật ngửa card vừa tap
    cards[index].isFaceUp = true;
    animateForward(index);

    if (firstIndex == null) {
      // Lá đầu tiên
      firstIndex = index;
      refresh();
    } else {
      // Lá thứ hai — kiểm tra cặp
      final int first = firstIndex!;
      firstIndex = null;
      moves++;
      isChecking = true;
      refresh();

      Future.delayed(const Duration(milliseconds: 800), () {
        if (cards[first].pairId == cards[index].pairId) {
          // Match!
          cards[first].isMatched = true;
          cards[index].isMatched = true;
          matches++;
          isChecking = false;
          refresh();
          if (isComplete) {
            onWin();
          }
        } else {
          // No match — lật úp lại
          cards[first].isFaceUp = false;
          cards[index].isFaceUp = false;
          animateReverse(first);
          animateReverse(index);
          isChecking = false;
          refresh();
        }
      });
    }
  }

  bool get isComplete => matches == (gridSize * gridSize) ~/ 2;
}

// =============================================================================
// SCREEN
// =============================================================================

class MemoryScreen extends StatefulWidget {
  const MemoryScreen({super.key});

  @override
  State<MemoryScreen> createState() => _MemoryScreenState();
}

class _MemoryScreenState extends State<MemoryScreen>
    with TickerProviderStateMixin {
  final MemoryController _ctrl = MemoryController();
  List<AnimationController> _controllers = [];

  @override
  void initState() {
    super.initState();
    _ctrl.newGame(4);
    _initControllers();
    _loadBest();
  }

  @override
  void dispose() {
    for (final c in _controllers) {
      c.dispose();
    }
    super.dispose();
  }

  // ---------------------------------------------------------------------------
  // Animation controllers
  // ---------------------------------------------------------------------------

  void _initControllers() {
    for (final c in _controllers) {
      c.dispose();
    }
    _controllers = List.generate(
      _ctrl.cards.length,
      (_) => AnimationController(
        vsync: this,
        duration: const Duration(milliseconds: 300),
      ),
    );
  }

  void _animateForward(int index) {
    if (index >= 0 && index < _controllers.length) {
      _controllers[index].forward();
    }
  }

  void _animateReverse(int index) {
    if (index >= 0 && index < _controllers.length) {
      _controllers[index].reverse();
    }
  }

  // ---------------------------------------------------------------------------
  // Persistence
  // ---------------------------------------------------------------------------

  Future<void> _loadBest() async {
    final prefs = await SharedPreferences.getInstance();
    setState(() {
      _ctrl.bestMoves4 = prefs.getInt('best_moves_memory_4x4') ?? 0;
      _ctrl.bestMoves6 = prefs.getInt('best_moves_memory_6x6') ?? 0;
    });
  }

  Future<void> _saveBest() async {
    final prefs = await SharedPreferences.getInstance();
    if (_ctrl.gridSize == 4) {
      final current = _ctrl.bestMoves4;
      if (current == 0 || _ctrl.moves < current) {
        _ctrl.bestMoves4 = _ctrl.moves;
        await prefs.setInt('best_moves_memory_4x4', _ctrl.moves);
      }
    } else {
      final current = _ctrl.bestMoves6;
      if (current == 0 || _ctrl.moves < current) {
        _ctrl.bestMoves6 = _ctrl.moves;
        await prefs.setInt('best_moves_memory_6x6', _ctrl.moves);
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Game actions
  // ---------------------------------------------------------------------------

  void _newGame() {
    setState(() {
      _ctrl.newGame(_ctrl.gridSize);
      _initControllers();
    });
  }

  void _setDifficulty(int size) {
    if (_ctrl.gridSize == size) return;
    setState(() {
      _ctrl.newGame(size);
      _initControllers();
    });
  }

  void _onCardTap(int index) {
    _ctrl.flipCard(
      index,
      () => setState(() {}),
      _onWin,
      _animateForward,
      _animateReverse,
    );
  }

  void _onWin() {
    _saveBest();
    CoinService.instance.reportGameScore('memory', won: true, moves: _ctrl.moves, level: _ctrl.gridSize);
    if (!mounted) return;
    final int bestNow =
        _ctrl.gridSize == 4 ? _ctrl.bestMoves4 : _ctrl.bestMoves6;
    final bool isNewRecord =
        bestNow == 0 || _ctrl.moves <= bestNow;

    showDialog<void>(
      context: context,
      barrierDismissible: false,
      builder: (_) => AlertDialog(
        backgroundColor: const Color(0xFF7B1FA2),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: const Text(
          'Bạn thắng! 🎉',
          textAlign: TextAlign.center,
          style: TextStyle(
            color: Colors.white,
            fontWeight: FontWeight.w900,
            fontSize: 22,
          ),
        ),
        content: Text(
          'Số lượt: ${_ctrl.moves}${isNewRecord ? '\n🏆 Kỷ lục mới!' : ''}',
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
              backgroundColor: Colors.white,
              foregroundColor: const Color(0xFF7B1FA2),
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
    final int best =
        _ctrl.gridSize == 4 ? _ctrl.bestMoves4 : _ctrl.bestMoves6;

    return Scaffold(
      backgroundColor: const Color(0xFF1A0A2E),
      body: SafeArea(
        child: Column(
          children: [
            _buildHeader(),
            const SizedBox(height: 8),
            _buildDifficultyRow(),
            const SizedBox(height: 8),
            _buildScoreRow(best),
            const SizedBox(height: 16),
            Expanded(
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 12),
                child: _buildBoard(),
              ),
            ),
            const SizedBox(height: 8),
          ],
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
              color: Colors.white,
              onPressed: () => Navigator.pop(context),
              tooltip: 'Về menu',
            ),
          const Text(
            'Memory',
            style: TextStyle(
              color: Colors.white,
              fontSize: 28,
              fontWeight: FontWeight.w900,
              letterSpacing: 0.5,
            ),
          ),
          const Spacer(),
          FilledButton.icon(
            onPressed: _newGame,
            icon: const Icon(Icons.refresh_rounded, size: 16),
            label: const Text('New'),
            style: FilledButton.styleFrom(
              backgroundColor: const Color(0xFF7B1FA2),
              foregroundColor: Colors.white,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildDifficultyRow() {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16),
      child: Row(
        children: [
          _diffBtn('4×4', 4),
          const SizedBox(width: 8),
          _diffBtn('6×6', 6),
        ],
      ),
    );
  }

  Widget _diffBtn(String label, int size) {
    final bool active = _ctrl.gridSize == size;
    return OutlinedButton(
      onPressed: () => _setDifficulty(size),
      style: OutlinedButton.styleFrom(
        backgroundColor: active ? const Color(0xFF7B1FA2) : Colors.transparent,
        foregroundColor: Colors.white,
        side: BorderSide(
          color: active ? const Color(0xFF7B1FA2) : Colors.white38,
        ),
        padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 10),
      ),
      child: Text(
        label,
        style: const TextStyle(fontWeight: FontWeight.bold),
      ),
    );
  }

  Widget _buildScoreRow(int best) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16),
      child: Row(
        children: [
          _scoreBox('MOVES', _ctrl.moves),
          const SizedBox(width: 12),
          _scoreBox('BEST', best),
        ],
      ),
    );
  }

  Widget _scoreBox(String label, int value) {
    return Container(
      constraints: const BoxConstraints(minWidth: 90),
      padding: const EdgeInsets.symmetric(vertical: 8, horizontal: 16),
      decoration: BoxDecoration(
        color: const Color(0xFF4A1C7C),
        borderRadius: BorderRadius.circular(8),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(
            label,
            style: const TextStyle(
              color: Colors.white60,
              fontSize: 11,
              fontWeight: FontWeight.bold,
              letterSpacing: 1.5,
            ),
          ),
          const SizedBox(height: 2),
          Text(
            '$value',
            style: const TextStyle(
              color: Colors.white,
              fontSize: 20,
              fontWeight: FontWeight.w900,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildBoard() {
    return GridView.builder(
      physics: const NeverScrollableScrollPhysics(),
      gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
        crossAxisCount: _ctrl.gridSize,
        crossAxisSpacing: 8,
        mainAxisSpacing: 8,
      ),
      itemCount: _ctrl.cards.length,
      itemBuilder: (_, i) => _buildCard(i),
    );
  }

  Widget _buildCard(int index) {
    if (index >= _controllers.length) return const SizedBox.shrink();
    final card = _ctrl.cards[index];

    return GestureDetector(
      onTap: () => _onCardTap(index),
      child: AnimatedBuilder(
        animation: _controllers[index],
        builder: (_, __) {
          final double angle = _controllers[index].value * pi;
          final bool showFront = angle >= pi / 2;

          return Transform(
            alignment: Alignment.center,
            transform: Matrix4.identity()
              ..setEntry(3, 2, 0.001)
              ..rotateY(showFront ? angle - pi : angle),
            child: showFront
                ? _buildFrontFace(card)
                : _buildBackFace(),
          );
        },
      ),
    );
  }

  Widget _buildFrontFace(MemCardModel card) {
    return Container(
      decoration: BoxDecoration(
        color: const Color(0xFFF3E5F5),
        borderRadius: BorderRadius.circular(12),
        border: card.isMatched
            ? Border.all(color: const Color(0xFF4CAF50), width: 3)
            : null,
      ),
      child: Center(
        child: Text(
          card.emoji,
          style: TextStyle(
            fontSize: _ctrl.gridSize == 4 ? 32 : 22,
          ),
        ),
      ),
    );
  }

  Widget _buildBackFace() {
    return Container(
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          colors: [Color(0xFF4A148C), Color(0xFF1A237E)],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(12),
      ),
      child: const Center(
        child: Text(
          '?',
          style: TextStyle(
            color: Colors.white,
            fontSize: 28,
            fontWeight: FontWeight.w900,
          ),
        ),
      ),
    );
  }
}
