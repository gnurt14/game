import 'dart:async';
import 'dart:math';
import 'package:flutter/foundation.dart'; // compute()
import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../../coin/coin_service.dart';

// ─── TOP-LEVEL FUNCTIONS FOR compute() ISOLATE ───

Map<String, dynamic> _generatePuzzleIsolate(String diffStr) {
  final diff = SudokuDifficulty.values.firstWhere((d) => d.name == diffStr);
  final rng = Random();

  // Step 1: Create solved grid
  final grid = List.generate(9, (_) => List.filled(9, 0));
  // Fill 3 diagonal boxes (top-left, center, bottom-right) first
  for (final boxStart in [0, 3, 6]) {
    final nums = [1, 2, 3, 4, 5, 6, 7, 8, 9]..shuffle(rng);
    int i = 0;
    for (int r = boxStart; r < boxStart + 3; r++) {
      for (int c = boxStart; c < boxStart + 3; c++) {
        grid[r][c] = nums[i++];
      }
    }
  }
  // Solve remaining cells
  _solveGrid(grid);

  // Step 2: Copy solution, remove cells to create puzzle
  final puzzle = List.generate(9, (r) => List.of(grid[r]));
  final cellOrder = List.generate(81, (i) => i)..shuffle(rng);

  final targetRemove = switch (diff) {
    SudokuDifficulty.easy => 38,
    SudokuDifficulty.medium => 48,
    SudokuDifficulty.hard => 55,
  };

  int removed = 0;
  for (final idx in cellOrder) {
    if (removed >= targetRemove) break;
    final r = idx ~/ 9, c = idx % 9;
    if (puzzle[r][c] == 0) continue;
    final backup = puzzle[r][c];
    puzzle[r][c] = 0;
    // Verify unique solution
    final count =
        _countSolutions(List.generate(9, (row) => List.of(puzzle[row])), 0);
    if (count == 1) {
      removed++;
    } else {
      puzzle[r][c] = backup; // rollback
    }
  }

  return {
    'solution': grid.map((r) => List<int>.from(r)).toList(),
    'puzzle': puzzle.map((r) => List<int>.from(r)).toList(),
  };
}

// Backtracking solver — returns true if a solution is found
bool _solveGrid(List<List<int>> grid) {
  for (int r = 0; r < 9; r++) {
    for (int c = 0; c < 9; c++) {
      if (grid[r][c] != 0) continue;
      for (int n = 1; n <= 9; n++) {
        if (_isValidPlacement(grid, r, c, n)) {
          grid[r][c] = n;
          if (_solveGrid(grid)) return true;
          grid[r][c] = 0;
        }
      }
      return false;
    }
  }
  return true;
}

// Count solutions (stops early when > maxCount)
int _countSolutions(List<List<int>> grid, int count, {int maxCount = 2}) {
  if (count >= maxCount) return count;
  for (int r = 0; r < 9; r++) {
    for (int c = 0; c < 9; c++) {
      if (grid[r][c] != 0) continue;
      for (int n = 1; n <= 9; n++) {
        if (_isValidPlacement(grid, r, c, n)) {
          grid[r][c] = n;
          count = _countSolutions(grid, count, maxCount: maxCount);
          if (count >= maxCount) {
            grid[r][c] = 0;
            return count;
          }
          grid[r][c] = 0;
        }
      }
      return count;
    }
  }
  return count + 1; // found 1 complete solution
}

bool _isValidPlacement(List<List<int>> grid, int row, int col, int n) {
  // Check row
  if (grid[row].contains(n)) return false;
  // Check col
  for (int r = 0; r < 9; r++) {
    if (grid[r][col] == n) return false;
  }
  // Check 3×3 box
  final br = (row ~/ 3) * 3, bc = (col ~/ 3) * 3;
  for (int r = br; r < br + 3; r++) {
    for (int c = bc; c < bc + 3; c++) {
      if (grid[r][c] == n) return false;
    }
  }
  return true;
}

// ─── ENUMS ───

enum SudokuDifficulty { easy, medium, hard }

// ─── SUPPORT CLASSES ───

class SudokuAction {
  final int row, col;
  final int prevValue, nextValue;
  final Set<int> prevNotes;

  const SudokuAction({
    required this.row,
    required this.col,
    required this.prevValue,
    required this.nextValue,
    required this.prevNotes,
  });
}

// ─── MODEL ───

class SudokuModel {
  List<List<int>> solution = List.generate(9, (_) => List.filled(9, 0));
  List<List<int>> puzzle = List.generate(9, (_) => List.filled(9, 0));
  List<List<int>> userGrid = List.generate(9, (_) => List.filled(9, 0));
  List<List<Set<int>>> notes =
      List.generate(9, (_) => List.generate(9, (_) => <int>{}));
  List<SudokuAction> history = [];
  int selectedRow = -1, selectedCol = -1;
  bool notesMode = false;
  SudokuDifficulty difficulty = SudokuDifficulty.easy;
  int elapsedSeconds = 0;
  bool isSolved = false;
  int bestEasy = 0,
      bestMedium = 0,
      bestHard = 0; // best time in seconds (0=no record)
}

// ─── CONTROLLER ───

class SudokuController {
  final SudokuModel model = SudokuModel();
  Timer? _clockTimer;
  bool isGenerating = false;
  VoidCallback? onUpdate;

  Future<void> newGame(SudokuDifficulty diff) async {
    isGenerating = true;
    onUpdate?.call();
    _clockTimer?.cancel();
    model.difficulty = diff;
    model.elapsedSeconds = 0;
    model.isSolved = false;
    model.selectedRow = -1;
    model.selectedCol = -1;
    model.notesMode = false;
    model.history.clear();

    // Run in Isolate to avoid freezing UI
    final result = await compute(_generatePuzzleIsolate, diff.name);

    // Parse result (dynamic → List<List<int>>)
    model.solution = (result['solution'] as List)
        .map((r) => List<int>.from(r as List))
        .toList();
    model.puzzle = (result['puzzle'] as List)
        .map((r) => List<int>.from(r as List))
        .toList();
    model.userGrid = List.generate(9, (r) => List.of(model.puzzle[r]));
    model.notes = List.generate(9, (_) => List.generate(9, (_) => <int>{}));

    isGenerating = false;
    _startClock();
    onUpdate?.call();
  }

  void _startClock() {
    _clockTimer?.cancel();
    _clockTimer = Timer.periodic(const Duration(seconds: 1), (_) {
      if (!model.isSolved) {
        model.elapsedSeconds++;
        onUpdate?.call();
      }
    });
  }

  void selectCell(int r, int c) {
    model.selectedRow = r;
    model.selectedCol = c;
    onUpdate?.call();
  }

  void inputNumber(int n) {
    final r = model.selectedRow, c = model.selectedCol;
    if (r < 0 || c < 0) return;
    if (model.puzzle[r][c] != 0) return; // given cell
    if (model.isSolved) return;

    if (model.notesMode && n != 0) {
      final prevNotes = Set<int>.from(model.notes[r][c]);
      if (model.notes[r][c].contains(n)) {
        model.notes[r][c].remove(n);
      } else {
        model.notes[r][c].add(n);
      }
      model.history.add(SudokuAction(
        row: r,
        col: c,
        prevValue: model.userGrid[r][c],
        nextValue: model.userGrid[r][c],
        prevNotes: prevNotes,
      ));
    } else {
      final prevNotes = Set<int>.from(model.notes[r][c]);
      model.history.add(SudokuAction(
        row: r,
        col: c,
        prevValue: model.userGrid[r][c],
        nextValue: n,
        prevNotes: prevNotes,
      ));
      model.userGrid[r][c] = n;
      model.notes[r][c].clear();
    }

    if (model.history.length > 50) model.history.removeAt(0);
    _checkSolved();
    onUpdate?.call();
  }

  void undo() {
    if (model.history.isEmpty) return;
    final action = model.history.removeLast();
    model.userGrid[action.row][action.col] = action.prevValue;
    model.notes[action.row][action.col] = Set<int>.from(action.prevNotes);
    onUpdate?.call();
  }

  void toggleNotes() {
    model.notesMode = !model.notesMode;
    onUpdate?.call();
  }

  bool isGiven(int r, int c) => model.puzzle[r][c] != 0;

  bool isConflict(int r, int c) {
    final v = model.userGrid[r][c];
    if (v == 0) return false;
    // Check row
    for (int cc = 0; cc < 9; cc++) {
      if (cc != c && model.userGrid[r][cc] == v) return true;
    }
    // Check col
    for (int rr = 0; rr < 9; rr++) {
      if (rr != r && model.userGrid[rr][c] == v) return true;
    }
    // Check box
    final br = (r ~/ 3) * 3, bc = (c ~/ 3) * 3;
    for (int rr = br; rr < br + 3; rr++) {
      for (int cc = bc; cc < bc + 3; cc++) {
        if ((rr != r || cc != c) && model.userGrid[rr][cc] == v) return true;
      }
    }
    return false;
  }

  void _checkSolved() {
    for (int r = 0; r < 9; r++) {
      for (int c = 0; c < 9; c++) {
        if (model.userGrid[r][c] != model.solution[r][c]) return;
      }
    }
    model.isSolved = true;
    _clockTimer?.cancel();
  }

  String get timerText {
    final m = model.elapsedSeconds ~/ 60;
    final s = model.elapsedSeconds % 60;
    return '${m.toString().padLeft(2, '0')}:${s.toString().padLeft(2, '0')}';
  }

  void dispose() => _clockTimer?.cancel();
}

// ─── SCREEN ───

class SudokuScreen extends StatefulWidget {
  const SudokuScreen({super.key});

  @override
  State<SudokuScreen> createState() => _SudokuScreenState();
}

class _SudokuScreenState extends State<SudokuScreen> {
  final _ctrl = SudokuController();
  bool _winShown = false;

  @override
  void initState() {
    super.initState();
    _ctrl.onUpdate = () {
      if (mounted) setState(() {});
    };
    _loadBest().then((_) => _ctrl.newGame(SudokuDifficulty.easy));
  }

  @override
  void dispose() {
    _ctrl.dispose();
    super.dispose();
  }

  Future<void> _loadBest() async {
    final prefs = await SharedPreferences.getInstance();
    if (mounted) {
      setState(() {
        _ctrl.model.bestEasy = prefs.getInt('best_time_sudoku_easy') ?? 0;
        _ctrl.model.bestMedium = prefs.getInt('best_time_sudoku_medium') ?? 0;
        _ctrl.model.bestHard = prefs.getInt('best_time_sudoku_hard') ?? 0;
      });
    }
  }

  Future<void> _saveBest() async {
    final prefs = await SharedPreferences.getInstance();
    final t = _ctrl.model.elapsedSeconds;
    switch (_ctrl.model.difficulty) {
      case SudokuDifficulty.easy:
        if (_ctrl.model.bestEasy == 0 || t < _ctrl.model.bestEasy) {
          _ctrl.model.bestEasy = t;
          await prefs.setInt('best_time_sudoku_easy', t);
        }
      case SudokuDifficulty.medium:
        if (_ctrl.model.bestMedium == 0 || t < _ctrl.model.bestMedium) {
          _ctrl.model.bestMedium = t;
          await prefs.setInt('best_time_sudoku_medium', t);
        }
      case SudokuDifficulty.hard:
        if (_ctrl.model.bestHard == 0 || t < _ctrl.model.bestHard) {
          _ctrl.model.bestHard = t;
          await prefs.setInt('best_time_sudoku_hard', t);
        }
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_ctrl.isGenerating) {
      return const Scaffold(
        backgroundColor: Color(0xFF0D1B2A),
        body: Center(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              CircularProgressIndicator(color: Color(0xFF00BCD4)),
              SizedBox(height: 16),
              Text(
                'Đang tạo puzzle...',
                style: TextStyle(color: Colors.white70),
              ),
            ],
          ),
        ),
      );
    }

    // Show win dialog after build (only once)
    if (_ctrl.model.isSolved && !_winShown) {
      _winShown = true;
      WidgetsBinding.instance.addPostFrameCallback((_) => _showWinDialog());
      _saveBest();
      CoinService.instance.reportGameScore('sudoku', won: true, level: _ctrl.model.difficulty.index, seconds: _ctrl.model.elapsedSeconds);
    }

    return Scaffold(
      backgroundColor: const Color(0xFF0D1B2A),
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
          child: Column(
            children: [
              _buildHeader(context),
              const SizedBox(height: 8),
              _buildDifficultyRow(),
              const SizedBox(height: 12),
              _buildGrid(),
              const SizedBox(height: 12),
              _buildNumberPad(),
              const SizedBox(height: 8),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildHeader(BuildContext ctx) {
    return Row(
      children: [
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
          'SUDOKU',
          style: TextStyle(
            color: Colors.white,
            fontSize: 24,
            fontWeight: FontWeight.w900,
            letterSpacing: 2,
          ),
        ),
        const Spacer(),
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
          decoration: BoxDecoration(
            color: const Color(0xFF0D2A3A),
            borderRadius: BorderRadius.circular(8),
          ),
          child: Text(
            _ctrl.timerText,
            style: const TextStyle(
              color: Color(0xFF00BCD4),
              fontSize: 18,
              fontWeight: FontWeight.bold,
              fontFamily: 'monospace',
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildDifficultyRow() {
    return Row(
      children: SudokuDifficulty.values.map((d) {
        final active = _ctrl.model.difficulty == d;
        final label = switch (d) {
          SudokuDifficulty.easy => 'Dễ',
          SudokuDifficulty.medium => 'Vừa',
          SudokuDifficulty.hard => 'Khó',
        };
        return Expanded(
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 4),
            child: GestureDetector(
              onTap: () {
                _winShown = false;
                _ctrl.newGame(d);
              },
              child: Container(
                padding: const EdgeInsets.symmetric(vertical: 8),
                decoration: BoxDecoration(
                  color:
                      active ? const Color(0xFF00BCD4) : const Color(0xFF0D2A3A),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Text(
                  label,
                  textAlign: TextAlign.center,
                  style: TextStyle(
                    color: active ? Colors.black : Colors.white54,
                    fontWeight: FontWeight.bold,
                  ),
                ),
              ),
            ),
          ),
        );
      }).toList(),
    );
  }

  Widget _buildGrid() {
    return AspectRatio(
      aspectRatio: 1,
      child: Container(
        decoration: BoxDecoration(
          border: Border.all(color: const Color(0xFF00BCD4), width: 2),
          borderRadius: BorderRadius.circular(4),
        ),
        child: GridView.builder(
          physics: const NeverScrollableScrollPhysics(),
          gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
            crossAxisCount: 9,
          ),
          itemCount: 81,
          itemBuilder: (_, idx) {
            final r = idx ~/ 9, c = idx % 9;
            return _buildCell(r, c);
          },
        ),
      ),
    );
  }

  Widget _buildCell(int r, int c) {
    final m = _ctrl.model;
    final value = m.userGrid[r][c];
    final isSelected = m.selectedRow == r && m.selectedCol == c;
    final isGiven = _ctrl.isGiven(r, c);
    final isConflict = !isGiven && _ctrl.isConflict(r, c);
    final selectedVal =
        (m.selectedRow >= 0 && m.selectedCol >= 0)
            ? m.userGrid[m.selectedRow][m.selectedCol]
            : 0;
    final isSameNum = value != 0 && value == selectedVal && !isSelected;

    // Background color
    Color bg = const Color(0xFF0D1B2A);
    if (isSelected) {
      bg = const Color(0xFF1565C0);
    } else if (isConflict) {
      bg = const Color(0xFF7B1C1C);
    } else if (isSameNum) {
      bg = const Color(0xFF1A3A5C);
    } else if (m.selectedRow == r || m.selectedCol == c) {
      bg = const Color(0xFF0D2A3A);
    }

    // Box borders (3×3)
    final borderRight = (c + 1) % 3 == 0 && c < 8 ? 1.5 : 0.3;
    final borderBottom = (r + 1) % 3 == 0 && r < 8 ? 1.5 : 0.3;

    return GestureDetector(
      onTap: () => _ctrl.selectCell(r, c),
      child: Container(
        decoration: BoxDecoration(
          color: bg,
          border: Border(
            right: BorderSide(
              color: const Color(0xFF00BCD4),
              width: borderRight,
            ),
            bottom: BorderSide(
              color: const Color(0xFF00BCD4),
              width: borderBottom,
            ),
          ),
        ),
        child: value != 0
            ? Center(
                child: Text(
                  '$value',
                  style: TextStyle(
                    color: isGiven
                        ? Colors.white
                        : (isConflict
                            ? Colors.red[300]
                            : const Color(0xFF80DEEA)),
                    fontWeight:
                        isGiven ? FontWeight.bold : FontWeight.normal,
                    fontSize: 16,
                  ),
                ),
              )
            : _buildNotes(r, c),
      ),
    );
  }

  Widget _buildNotes(int r, int c) {
    final notes = _ctrl.model.notes[r][c];
    if (notes.isEmpty) return const SizedBox.shrink();
    return GridView.count(
      crossAxisCount: 3,
      physics: const NeverScrollableScrollPhysics(),
      children: List.generate(9, (i) {
        final n = i + 1;
        return Center(
          child: Text(
            notes.contains(n) ? '$n' : '',
            style: const TextStyle(color: Color(0xFF80DEEA), fontSize: 8),
          ),
        );
      }),
    );
  }

  Widget _buildNumberPad() {
    return Column(
      children: [
        // Numbers 1-9
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceEvenly,
          children: List.generate(9, (i) => _numButton(i + 1)),
        ),
        const SizedBox(height: 8),
        // Actions: delete + notes + undo
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceEvenly,
          children: [
            _actionButton(
              Icons.backspace_rounded,
              'Xóa',
              () => _ctrl.inputNumber(0),
            ),
            _actionButton(
              _ctrl.model.notesMode
                  ? Icons.edit_rounded
                  : Icons.edit_off_rounded,
              'Ghi chú',
              _ctrl.toggleNotes,
              active: _ctrl.model.notesMode,
            ),
            _actionButton(Icons.undo_rounded, 'Hoàn tác', _ctrl.undo),
          ],
        ),
      ],
    );
  }

  Widget _numButton(int n) {
    return GestureDetector(
      onTap: () => _ctrl.inputNumber(n),
      child: Container(
        width: 34,
        height: 44,
        decoration: BoxDecoration(
          color: const Color(0xFF0D2A3A),
          borderRadius: BorderRadius.circular(8),
        ),
        child: Center(
          child: Text(
            '$n',
            style: const TextStyle(
              color: Colors.white,
              fontSize: 20,
              fontWeight: FontWeight.bold,
            ),
          ),
        ),
      ),
    );
  }

  Widget _actionButton(
    IconData icon,
    String label,
    VoidCallback onTap, {
    bool active = false,
  }) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
        decoration: BoxDecoration(
          color: active ? const Color(0xFF00BCD4) : const Color(0xFF0D2A3A),
          borderRadius: BorderRadius.circular(8),
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, color: active ? Colors.black : Colors.white70, size: 20),
            const SizedBox(height: 2),
            Text(
              label,
              style: TextStyle(
                color: active ? Colors.black : Colors.white54,
                fontSize: 10,
              ),
            ),
          ],
        ),
      ),
    );
  }

  void _showWinDialog() {
    if (!mounted) return;
    final t = _ctrl.model.elapsedSeconds;
    final m = t ~/ 60, s = t % 60;
    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (ctx) => AlertDialog(
        backgroundColor: const Color(0xFF0D2A3A),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
        title: const Text(
          'Hoàn thành! 🎉',
          textAlign: TextAlign.center,
          style: TextStyle(
            color: Color(0xFF00BCD4),
            fontWeight: FontWeight.w900,
            fontSize: 22,
          ),
        ),
        content: Text(
          'Thời gian: ${m.toString().padLeft(2, "0")}:${s.toString().padLeft(2, "0")}',
          textAlign: TextAlign.center,
          style: const TextStyle(color: Colors.white70, fontSize: 16),
        ),
        actionsAlignment: MainAxisAlignment.spaceEvenly,
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text(
              'Đóng',
              style: TextStyle(color: Colors.white54),
            ),
          ),
          FilledButton(
            onPressed: () {
              Navigator.pop(ctx);
              _winShown = false;
              _ctrl.newGame(_ctrl.model.difficulty);
            },
            style: FilledButton.styleFrom(
              backgroundColor: const Color(0xFF00BCD4),
              foregroundColor: Colors.black,
            ),
            child: const Text('Ván mới'),
          ),
        ],
      ),
    );
  }
}
