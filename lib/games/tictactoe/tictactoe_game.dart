// tictactoe_game.dart — Tic-Tac-Toe (Enhanced) for Flutter Super Gate hub
//
// Kiến trúc:
//   ── MODEL ──────────────────────────────────────────────
//   • TicTacToeModel   — Trạng thái game (board N×N, sizes, scores)
//   ── CONTROLLER ─────────────────────────────────────────
//   • TicTacToeController — Logic N×N + Minimax (3×3) + Heuristic AI (4×4/5×5)
//   ── SCREEN ─────────────────────────────────────────────
//   • TicTacToeScreen  — StatefulWidget + board size selector

import 'dart:async';
import 'dart:math';
import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../../coin/coin_service.dart';

// =============================================================================
// MODEL
// =============================================================================

class TicTacToeModel {
  int boardSize = 3; // 3, 4, hoặc 5
  int get winCondition => boardSize; // cần N ô liên tiếp để thắng
  int get totalCells => boardSize * boardSize;

  List<String> board = List.filled(9, ''); // resize khi đổi boardSize
  String currentPlayer = 'X';
  String? winner; // null=ongoing, ''=draw, 'X'/'O'=winner
  List<int>? winLine; // indices của winning cells
  bool gameOver = false;
  bool aiThinking = false;
  bool playerIsX = true;

  // Stats riêng cho từng kích thước bàn cờ
  Map<int, int> playerWins = {3: 0, 4: 0, 5: 0};
  Map<int, int> aiWins = {3: 0, 4: 0, 5: 0};
  Map<int, int> draws = {3: 0, 4: 0, 5: 0};

  int get currentPlayerWins => playerWins[boardSize] ?? 0;
  int get currentAiWins => aiWins[boardSize] ?? 0;
  int get currentDraws => draws[boardSize] ?? 0;

  void resizeBoard() {
    board = List.filled(totalCells, '');
  }
}

// =============================================================================
// CONTROLLER
// =============================================================================

class TicTacToeController {
  final TicTacToeModel model = TicTacToeModel();
  VoidCallback? onStateChanged;

  String get playerSymbol => model.playerIsX ? 'X' : 'O';
  String get aiSymbol => model.playerIsX ? 'O' : 'X';

  // ---------------------------------------------------------------------------
  // Board size change
  // ---------------------------------------------------------------------------

  void changeBoardSize(int size) {
    model.boardSize = size;
    resetGame();
  }

  // ---------------------------------------------------------------------------
  // Player move
  // ---------------------------------------------------------------------------

  void makeMove(int index) {
    if (model.gameOver || model.aiThinking) return;
    if (model.board[index] != '') return;
    if (model.currentPlayer != playerSymbol) return;

    model.board[index] = playerSymbol;
    model.currentPlayer = aiSymbol;

    final w = checkWinner(model.board, model.boardSize);
    if (w != null) {
      _endGame(w);
      return;
    }
    if (_isBoardFull(model.board)) {
      _endGame('');
      return;
    }
    aiMove();
  }

  // ---------------------------------------------------------------------------
  // AI move
  // ---------------------------------------------------------------------------

  Future<void> aiMove() async {
    model.aiThinking = true;
    onStateChanged?.call();

    await Future.delayed(const Duration(milliseconds: 350));

    if (model.gameOver) {
      model.aiThinking = false;
      onStateChanged?.call();
      return;
    }

    final best = _bestMove(model.board, model.boardSize);
    if (best != -1) {
      model.board[best] = aiSymbol;
      model.currentPlayer = playerSymbol;
    }

    final w = checkWinner(model.board, model.boardSize);
    if (w != null) {
      model.aiThinking = false;
      _endGame(w);
      return;
    }
    if (_isBoardFull(model.board)) {
      model.aiThinking = false;
      _endGame('');
      return;
    }

    model.aiThinking = false;
    onStateChanged?.call();
  }

  int _bestMove(List<String> b, int size) {
    if (size == 3) {
      return _bestMoveMinimax(b);
    } else {
      return _bestMoveHeuristic(b, size);
    }
  }

  // ---------------------------------------------------------------------------
  // Minimax + Alpha-Beta (chỉ dùng cho 3×3)
  // ---------------------------------------------------------------------------

  int _bestMoveMinimax(List<String> b) {
    int bestScore = -1000;
    int bestIndex = -1;
    for (int i = 0; i < b.length; i++) {
      if (b[i] != '') continue;
      b[i] = aiSymbol;
      final score = minimax(b, 3, false, 0, -1000, 1000);
      b[i] = '';
      if (score > bestScore) {
        bestScore = score;
        bestIndex = i;
      }
    }
    return bestIndex;
  }

  int minimax(
    List<String> b,
    int size,
    bool isMaximizing,
    int depth, [
    int alpha = -1000,
    int beta = 1000,
  ]) {
    final w = checkWinner(b, size);
    if (w == aiSymbol) return 10 - depth;
    if (w == playerSymbol) return depth - 10;
    if (_isBoardFull(b)) return 0;

    if (isMaximizing) {
      int best = -1000;
      for (int i = 0; i < b.length; i++) {
        if (b[i] != '') continue;
        b[i] = aiSymbol;
        final score = minimax(b, size, false, depth + 1, alpha, beta);
        b[i] = '';
        if (score > best) best = score;
        if (best > alpha) alpha = best;
        if (beta <= alpha) break;
      }
      return best;
    } else {
      int best = 1000;
      for (int i = 0; i < b.length; i++) {
        if (b[i] != '') continue;
        b[i] = playerSymbol;
        final score = minimax(b, size, true, depth + 1, alpha, beta);
        b[i] = '';
        if (score < best) best = score;
        if (best < beta) beta = best;
        if (beta <= alpha) break;
      }
      return best;
    }
  }

  // ---------------------------------------------------------------------------
  // Heuristic AI (dùng cho 4×4 và 5×5)
  // Ưu tiên:
  //   1. Thắng ngay nếu có thể
  //   2. Chặn player thắng ngay
  //   3. Tạo chuỗi dài nhất
  //   4. Chặn chuỗi dài của player
  //   5. Ưu tiên trung tâm, sau đó góc, sau đó cạnh
  // ---------------------------------------------------------------------------

  int _bestMoveHeuristic(List<String> b, int size) {
    final winCond = size; // cần N ô liên tiếp

    // 1. Tìm nước thắng ngay của AI
    for (int i = 0; i < b.length; i++) {
      if (b[i] != '') continue;
      b[i] = aiSymbol;
      if (checkWinner(b, size) == aiSymbol) {
        b[i] = '';
        return i;
      }
      b[i] = '';
    }

    // 2. Chặn player thắng ngay
    for (int i = 0; i < b.length; i++) {
      if (b[i] != '') continue;
      b[i] = playerSymbol;
      if (checkWinner(b, size) == playerSymbol) {
        b[i] = '';
        return i;
      }
      b[i] = '';
    }

    // 3. Chọn theo heuristic score
    int bestScore = -1;
    int bestIndex = -1;

    for (int i = 0; i < b.length; i++) {
      if (b[i] != '') continue;
      b[i] = aiSymbol;
      final score = _heuristicScore(b, size, i, winCond);
      b[i] = '';
      if (score > bestScore) {
        bestScore = score;
        bestIndex = i;
      }
    }

    return bestIndex;
  }

  int _heuristicScore(List<String> b, int size, int idx, int winCond) {
    final row = idx ~/ size;
    final col = idx % size;
    int score = 0;

    // Trung tâm được ưu tiên
    final center = size ~/ 2;
    final distFromCenter = (row - center).abs() + (col - center).abs();
    score += max(0, (size - distFromCenter) * 2);

    // Đếm số chuỗi AI có thể tạo qua ô này
    score += _countOpenLines(b, size, row, col, aiSymbol, winCond) * 5;

    // Trừ điểm nếu có chuỗi player đang mạnh
    score -= _countOpenLines(b, size, row, col, playerSymbol, winCond) * 3;

    return score;
  }

  int _countOpenLines(
      List<String> b, int size, int r, int c, String sym, int winCond) {
    int count = 0;
    // Kiểm tra 4 hướng (ngang, dọc, 2 chéo)
    final dirs = [
      [0, 1],
      [1, 0],
      [1, 1],
      [1, -1],
    ];
    for (final d in dirs) {
      int streak = 1;
      // Tiến theo hướng
      int nr = r + d[0], nc = c + d[1];
      while (nr >= 0 && nr < size && nc >= 0 && nc < size) {
        if (b[nr * size + nc] == sym) {
          streak++;
          nr += d[0];
          nc += d[1];
        } else {
          break;
        }
      }
      // Lùi ngược hướng
      nr = r - d[0];
      nc = c - d[1];
      while (nr >= 0 && nr < size && nc >= 0 && nc < size) {
        if (b[nr * size + nc] == sym) {
          streak++;
          nr -= d[0];
          nc -= d[1];
        } else {
          break;
        }
      }
      if (streak >= winCond - 1) count++;
    }
    return count;
  }

  // ---------------------------------------------------------------------------
  // Win / draw detection (generic N×N)
  // ---------------------------------------------------------------------------

  /// Returns 'X', 'O', or null (no winner yet).
  String? checkWinner(List<String> b, int size) {
    final winCond = size;

    // Check rows
    for (int r = 0; r < size; r++) {
      for (int c = 0; c <= size - winCond; c++) {
        final sym = b[r * size + c];
        if (sym == '') continue;
        bool win = true;
        for (int k = 1; k < winCond; k++) {
          if (b[r * size + c + k] != sym) {
            win = false;
            break;
          }
        }
        if (win) return sym;
      }
    }

    // Check cols
    for (int c = 0; c < size; c++) {
      for (int r = 0; r <= size - winCond; r++) {
        final sym = b[r * size + c];
        if (sym == '') continue;
        bool win = true;
        for (int k = 1; k < winCond; k++) {
          if (b[(r + k) * size + c] != sym) {
            win = false;
            break;
          }
        }
        if (win) return sym;
      }
    }

    // Check diagonal ↘
    for (int r = 0; r <= size - winCond; r++) {
      for (int c = 0; c <= size - winCond; c++) {
        final sym = b[r * size + c];
        if (sym == '') continue;
        bool win = true;
        for (int k = 1; k < winCond; k++) {
          if (b[(r + k) * size + c + k] != sym) {
            win = false;
            break;
          }
        }
        if (win) return sym;
      }
    }

    // Check diagonal ↙
    for (int r = 0; r <= size - winCond; r++) {
      for (int c = winCond - 1; c < size; c++) {
        final sym = b[r * size + c];
        if (sym == '') continue;
        bool win = true;
        for (int k = 1; k < winCond; k++) {
          if (b[(r + k) * size + c - k] != sym) {
            win = false;
            break;
          }
        }
        if (win) return sym;
      }
    }

    return null;
  }

  /// Returns the winning line indices, or null.
  List<int>? getWinLine(List<String> b, int size) {
    final winCond = size;

    // Check rows
    for (int r = 0; r < size; r++) {
      for (int c = 0; c <= size - winCond; c++) {
        final sym = b[r * size + c];
        if (sym == '') continue;
        bool win = true;
        for (int k = 1; k < winCond; k++) {
          if (b[r * size + c + k] != sym) {
            win = false;
            break;
          }
        }
        if (win) {
          return List.generate(winCond, (k) => r * size + c + k);
        }
      }
    }

    // Check cols
    for (int c = 0; c < size; c++) {
      for (int r = 0; r <= size - winCond; r++) {
        final sym = b[r * size + c];
        if (sym == '') continue;
        bool win = true;
        for (int k = 1; k < winCond; k++) {
          if (b[(r + k) * size + c] != sym) {
            win = false;
            break;
          }
        }
        if (win) {
          return List.generate(winCond, (k) => (r + k) * size + c);
        }
      }
    }

    // Check diagonal ↘
    for (int r = 0; r <= size - winCond; r++) {
      for (int c = 0; c <= size - winCond; c++) {
        final sym = b[r * size + c];
        if (sym == '') continue;
        bool win = true;
        for (int k = 1; k < winCond; k++) {
          if (b[(r + k) * size + c + k] != sym) {
            win = false;
            break;
          }
        }
        if (win) {
          return List.generate(winCond, (k) => (r + k) * size + c + k);
        }
      }
    }

    // Check diagonal ↙
    for (int r = 0; r <= size - winCond; r++) {
      for (int c = winCond - 1; c < size; c++) {
        final sym = b[r * size + c];
        if (sym == '') continue;
        bool win = true;
        for (int k = 1; k < winCond; k++) {
          if (b[(r + k) * size + c - k] != sym) {
            win = false;
            break;
          }
        }
        if (win) {
          return List.generate(winCond, (k) => (r + k) * size + c - k);
        }
      }
    }

    return null;
  }

  bool _isBoardFull(List<String> b) => b.every((cell) => cell != '');

  // ---------------------------------------------------------------------------
  // End game
  // ---------------------------------------------------------------------------

  void _endGame(String result) {
    model.winner = result;
    model.gameOver = true;
    model.winLine =
        result != '' ? getWinLine(model.board, model.boardSize) : null;

    final size = model.boardSize;
    if (result == playerSymbol) {
      model.playerWins[size] = (model.playerWins[size] ?? 0) + 1;
    } else if (result == aiSymbol) {
      model.aiWins[size] = (model.aiWins[size] ?? 0) + 1;
    } else {
      model.draws[size] = (model.draws[size] ?? 0) + 1;
    }
    CoinService.instance.reportGameScore('tictactoe', won: result == playerSymbol, level: model.boardSize);
    _saveStats();
    onStateChanged?.call();
  }

  // ---------------------------------------------------------------------------
  // Reset
  // ---------------------------------------------------------------------------

  void resetGame() {
    model.resizeBoard();
    model.currentPlayer = 'X';
    model.winner = null;
    model.winLine = null;
    model.gameOver = false;
    model.aiThinking = false;
    onStateChanged?.call();
  }

  void resetStats() {
    final size = model.boardSize;
    model.playerWins[size] = 0;
    model.aiWins[size] = 0;
    model.draws[size] = 0;
    _saveStats();
    onStateChanged?.call();
  }

  // ---------------------------------------------------------------------------
  // Persistence
  // ---------------------------------------------------------------------------

  Future<void> loadStats() async {
    final prefs = await SharedPreferences.getInstance();
    for (final size in [3, 4, 5]) {
      model.playerWins[size] = prefs.getInt('ttt_player_wins_${size}x$size') ?? 0;
      model.aiWins[size] = prefs.getInt('ttt_ai_wins_${size}x$size') ?? 0;
      model.draws[size] = prefs.getInt('ttt_draws_${size}x$size') ?? 0;
    }
    onStateChanged?.call();
  }

  Future<void> _saveStats() async {
    final prefs = await SharedPreferences.getInstance();
    for (final size in [3, 4, 5]) {
      await prefs.setInt(
          'ttt_player_wins_${size}x$size', model.playerWins[size] ?? 0);
      await prefs.setInt(
          'ttt_ai_wins_${size}x$size', model.aiWins[size] ?? 0);
      await prefs.setInt(
          'ttt_draws_${size}x$size', model.draws[size] ?? 0);
    }
  }
}

// =============================================================================
// SCREEN
// =============================================================================

class TicTacToeScreen extends StatefulWidget {
  const TicTacToeScreen({super.key});

  @override
  State<TicTacToeScreen> createState() => _TicTacToeScreenState();
}

class _TicTacToeScreenState extends State<TicTacToeScreen> {
  final TicTacToeController _ctrl = TicTacToeController();
  Timer? _restartTimer;

  @override
  void initState() {
    super.initState();
    _ctrl.onStateChanged = () {
      if (mounted) setState(() {});
    };
    _ctrl.loadStats();
  }

  @override
  void dispose() {
    _restartTimer?.cancel();
    _ctrl.onStateChanged = null;
    super.dispose();
  }

  // ---------------------------------------------------------------------------
  // Actions
  // ---------------------------------------------------------------------------

  void _onCellTap(int index) {
    final m = _ctrl.model;
    if (m.gameOver || m.aiThinking || m.board[index] != '') return;
    _ctrl.makeMove(index);
  }

  void _scheduleAutoRestart() {
    _restartTimer?.cancel();
    _restartTimer = Timer(const Duration(milliseconds: 1800), () {
      if (mounted) {
        _ctrl.resetGame();
        if (_ctrl.model.currentPlayer == _ctrl.aiSymbol) {
          _ctrl.aiMove();
        }
      }
    });
  }

  void _onRestartNow() {
    _restartTimer?.cancel();
    _ctrl.resetGame();
    if (_ctrl.model.currentPlayer == _ctrl.aiSymbol) {
      _ctrl.aiMove();
    }
  }

  void _onChangeBoardSize(int size) {
    _restartTimer?.cancel();
    setState(() => _ctrl.changeBoardSize(size));
  }

  // ---------------------------------------------------------------------------
  // Build
  // ---------------------------------------------------------------------------

  @override
  Widget build(BuildContext context) {
    final m = _ctrl.model;
    if (m.gameOver) _scheduleAutoRestart();

    return Scaffold(
      backgroundColor: const Color(0xFF0A0A1A),
      body: SafeArea(
        child: Column(
          children: [
            _buildHeader(),
            const SizedBox(height: 10),
            _buildSizeSelector(),
            const SizedBox(height: 10),
            _buildStatsRow(),
            const SizedBox(height: 12),
            _buildStatusText(),
            const SizedBox(height: 16),
            Expanded(
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 20),
                child: _buildBoard(),
              ),
            ),
            const SizedBox(height: 12),
            _buildRestartButton(),
            const SizedBox(height: 16),
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
              color: Colors.white,
              onPressed: () => Navigator.pop(context),
            ),
          const Text(
            'TIC-TAC-TOE',
            style: TextStyle(
              color: Colors.white,
              fontSize: 22,
              fontWeight: FontWeight.w900,
              letterSpacing: 2,
            ),
          ),
          const Spacer(),
          IconButton(
            icon: const Icon(Icons.restart_alt_rounded),
            color: Colors.white54,
            tooltip: 'Reset thống kê',
            onPressed: () => setState(() => _ctrl.resetStats()),
          ),
        ],
      ),
    );
  }

  // ---------------------------------------------------------------------------
  // Board size selector
  // ---------------------------------------------------------------------------

  Widget _buildSizeSelector() {
    final sizes = [3, 4, 5];
    final current = _ctrl.model.boardSize;
    return Row(
      mainAxisAlignment: MainAxisAlignment.center,
      children: sizes.map((size) {
        final selected = size == current;
        return GestureDetector(
          onTap: selected ? null : () => _onChangeBoardSize(size),
          child: AnimatedContainer(
            duration: const Duration(milliseconds: 200),
            margin: const EdgeInsets.symmetric(horizontal: 6),
            padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 8),
            decoration: BoxDecoration(
              color: selected
                  ? const Color(0xFF3949AB)
                  : const Color(0xFF12122A),
              borderRadius: BorderRadius.circular(20),
              border: Border.all(
                color: selected
                    ? const Color(0xFF7986CB)
                    : const Color(0xFF2A2A4A),
                width: 1.5,
              ),
            ),
            child: Text(
              '$size×$size',
              style: TextStyle(
                color: selected ? Colors.white : Colors.white54,
                fontSize: 14,
                fontWeight: FontWeight.bold,
                letterSpacing: 0.5,
              ),
            ),
          ),
        );
      }).toList(),
    );
  }

  // ---------------------------------------------------------------------------
  // Stats row
  // ---------------------------------------------------------------------------

  Widget _buildStatsRow() {
    final m = _ctrl.model;
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 24),
      child: Row(
        children: [
          Expanded(
            child: _statBox('BẠN', '${m.currentPlayerWins}',
                const Color(0xFF64B5F6)),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: _statBox('HOÀ', '${m.currentDraws}', Colors.white60),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: _statBox('AI', '${m.currentAiWins}',
                const Color(0xFFEF9A9A)),
          ),
        ],
      ),
    );
  }

  Widget _statBox(String label, String value, Color color) {
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 9),
      decoration: BoxDecoration(
        color: const Color(0xFF12122A),
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: Colors.white12),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(
            label,
            style: TextStyle(
              color: color,
              fontSize: 10,
              fontWeight: FontWeight.bold,
              letterSpacing: 1.4,
            ),
          ),
          const SizedBox(height: 3),
          Text(
            value,
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

  // ---------------------------------------------------------------------------
  // Status text
  // ---------------------------------------------------------------------------

  Widget _buildStatusText() {
    final m = _ctrl.model;
    final String text;
    final Color color;

    if (m.gameOver) {
      if (m.winner == _ctrl.playerSymbol) {
        text = 'Bạn thắng! 🎉';
        color = const Color(0xFF64B5F6);
      } else if (m.winner == _ctrl.aiSymbol) {
        text = 'AI thắng!';
        color = const Color(0xFFEF9A9A);
      } else {
        text = 'Hoà!';
        color = Colors.white60;
      }
    } else if (m.aiThinking) {
      text = 'AI đang suy nghĩ...';
      color = const Color(0xFFEF9A9A);
    } else {
      text = 'Lượt của bạn (${_ctrl.playerSymbol})';
      color = const Color(0xFF64B5F6);
    }

    return AnimatedSwitcher(
      duration: const Duration(milliseconds: 200),
      child: Text(
        text,
        key: ValueKey(text),
        style: TextStyle(
          color: color,
          fontSize: 16,
          fontWeight: FontWeight.w700,
          letterSpacing: 0.5,
        ),
      ),
    );
  }

  // ---------------------------------------------------------------------------
  // Board
  // ---------------------------------------------------------------------------

  Widget _buildBoard() {
    final size = _ctrl.model.boardSize;
    return AspectRatio(
      aspectRatio: 1,
      child: GridView.count(
        crossAxisCount: size,
        childAspectRatio: 1,
        physics: const NeverScrollableScrollPhysics(),
        children: List.generate(size * size, (i) => _buildCell(i, size)),
      ),
    );
  }

  Widget _buildCell(int index, int size) {
    final m = _ctrl.model;
    final cellValue = m.board[index];
    final isWinCell = m.winLine?.contains(index) ?? false;
    final canTap = !m.gameOver && !m.aiThinking && cellValue == '';

    // Font tự động nhỏ lại theo kích thước bàn cờ
    final fontSize = size == 3 ? 46.0 : (size == 4 ? 34.0 : 26.0);
    final margin = size == 3 ? 4.0 : 3.0;

    return InkWell(
      onTap: canTap ? () => _onCellTap(index) : null,
      borderRadius: BorderRadius.circular(6),
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 180),
        margin: EdgeInsets.all(margin),
        decoration: BoxDecoration(
          color: isWinCell
              ? Colors.white.withAlpha(20)
              : Colors.transparent,
          borderRadius: BorderRadius.circular(6),
          border: Border.all(color: Colors.white12, width: 1.2),
        ),
        child: Center(
          child: AnimatedSwitcher(
            duration: const Duration(milliseconds: 150),
            transitionBuilder: (child, anim) =>
                ScaleTransition(scale: anim, child: child),
            child: cellValue == ''
                ? const SizedBox.shrink()
                : Text(
                    cellValue,
                    key: ValueKey('$index-$cellValue'),
                    style: TextStyle(
                      color: cellValue == 'X'
                          ? const Color(0xFF64B5F6)
                          : const Color(0xFFEF9A9A),
                      fontSize: fontSize,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
          ),
        ),
      ),
    );
  }

  // ---------------------------------------------------------------------------
  // Restart button
  // ---------------------------------------------------------------------------

  Widget _buildRestartButton() {
    return TextButton.icon(
      onPressed: _onRestartNow,
      icon: const Icon(Icons.refresh_rounded, size: 18),
      label: const Text('Chơi lại'),
      style: TextButton.styleFrom(
        foregroundColor: Colors.white54,
        textStyle: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600),
      ),
    );
  }
}
