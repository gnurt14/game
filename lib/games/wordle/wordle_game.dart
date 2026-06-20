// wordle_game.dart — Wordle (Enhanced) for Flutter Super Gate hub
//
// Tính năng mới:
//   • Word length 5 / 6 / 7 chữ cái (selector ở header)
//   • Daily Challenge: cùng 1 từ cho tất cả mọi người trong ngày
//   • Shake animation khi từ không hợp lệ
//   • Bounce animation khi gõ phím
//   • Dance animation khi thắng
//   • Stats: win rate, distribution bar chart, streak

import 'dart:async';
import 'dart:math';
import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'words.dart';
import '../../coin/coin_service.dart';

// =============================================================================
// ENUMS & MODEL
// =============================================================================

enum LetterState { empty, typed, correct, present, absent }

enum WordleGameState { playing, won, lost }

class WordleStats {
  int totalPlayed = 0;
  int totalWins = 0;
  int currentStreak = 0;
  int bestStreak = 0;
  List<int> distribution = List.filled(6, 0);

  double get winRate =>
      totalPlayed == 0 ? 0 : totalWins / totalPlayed * 100;
}

class WordleModel {
  int wordLength = 5; // 5, 6, hoặc 7
  bool isDailyMode = false;

  String target = '';
  List<List<String>> grid = [];
  List<List<LetterState>> states = [];
  int currentRow = 0;
  String currentInput = '';
  Map<String, LetterState> keyStates = {};
  WordleGameState gameState = WordleGameState.playing;
  String message = '';

  // Daily challenge
  bool dailyPlayed = false; // đã chơi Daily hôm nay chưa
  String dailyResult = ''; // 'won' / 'lost'
  int dailyGuesses = 0;

  // Stats per (wordLength, mode)
  Map<String, WordleStats> statsMap = {};

  WordleStats get currentStats {
    final key = '${wordLength}_${isDailyMode ? 'd' : 'f'}';
    return statsMap.putIfAbsent(key, WordleStats.new);
  }

  void resetGrid() {
    grid = List.generate(6, (_) => List.filled(wordLength, ''));
    states = List.generate(
        6, (_) => List.filled(wordLength, LetterState.empty));
  }
}

// =============================================================================
// CONTROLLER
// =============================================================================

class WordleController {
  final WordleModel model = WordleModel();
  final Random _rng = Random();
  VoidCallback? onUpdate;

  // ---------------------------------------------------------------------------
  // Game lifecycle
  // ---------------------------------------------------------------------------

  void newGame() {
    final wordList = getTargetWordsByLength(model.wordLength);
    if (wordList.isEmpty) return;

    if (model.isDailyMode) {
      model.target = _getDailyWord(wordList);
    } else {
      model.target = wordList[_rng.nextInt(wordList.length)];
    }

    model.resetGrid();
    model.currentRow = 0;
    model.currentInput = '';
    model.keyStates = {};
    model.gameState = WordleGameState.playing;
    model.message = '';
    onUpdate?.call();
  }

  void changeLength(int len) {
    model.wordLength = len;
    model.dailyPlayed = false;
    newGame();
    _checkDailyPlayed();
  }

  void toggleDailyMode() {
    model.isDailyMode = !model.isDailyMode;
    model.dailyPlayed = false;
    newGame();
    _checkDailyPlayed();
  }

  String _getDailyWord(List<String> wordList) {
    final epoch = DateTime(2026, 1, 1);
    final today = DateTime.now();
    final dayIndex = today.difference(epoch).inDays;
    return wordList[dayIndex % wordList.length];
  }

  String get todayKey {
    final now = DateTime.now();
    return '${now.year}-${now.month.toString().padLeft(2, '0')}-${now.day.toString().padLeft(2, '0')}';
  }

  void _checkDailyPlayed() {
    if (!model.isDailyMode) return;
    // Check SharedPreferences async
    SharedPreferences.getInstance().then((prefs) {
      final key = 'daily_${model.wordLength}_$todayKey';
      final saved = prefs.getString(key);
      if (saved != null) {
        model.dailyPlayed = true;
        model.dailyResult = saved;
        onUpdate?.call();
      }
    });
  }

  // ---------------------------------------------------------------------------
  // Input
  // ---------------------------------------------------------------------------

  void addLetter(String c) {
    if (model.gameState != WordleGameState.playing) return;
    if (model.isDailyMode && model.dailyPlayed) return;
    if (model.currentInput.length >= model.wordLength) return;
    model.currentInput += c.toLowerCase();
    _syncInputToGrid();
    onUpdate?.call();
  }

  void deleteLetter() {
    if (model.currentInput.isEmpty) return;
    if (model.isDailyMode && model.dailyPlayed) return;
    model.currentInput =
        model.currentInput.substring(0, model.currentInput.length - 1);
    _syncInputToGrid();
    onUpdate?.call();
  }

  // Returns true if submission was valid (no shake needed)
  bool submitGuess() {
    if (model.gameState != WordleGameState.playing) return true;
    if (model.isDailyMode && model.dailyPlayed) return true;

    final len = model.wordLength;
    if (model.currentInput.length < len) {
      model.message = 'Cần $len chữ cái';
      onUpdate?.call();
      return false;
    }

    final validList = getValidWordsByLength(len);
    if (!validList.contains(model.currentInput)) {
      model.message = 'Từ không hợp lệ';
      onUpdate?.call();
      return false;
    }

    final guess = model.currentInput;
    final result = _evaluate(guess, model.target);

    final row = List<String>.from(model.grid[model.currentRow]);
    final rowStates = List<LetterState>.from(model.states[model.currentRow]);
    for (int i = 0; i < len; i++) {
      row[i] = guess[i];
      rowStates[i] = result[i];
    }
    model.grid[model.currentRow] = row;
    model.states[model.currentRow] = rowStates;

    _updateKeyStates(guess, result);

    final allCorrect = result.every((s) => s == LetterState.correct);
    if (allCorrect) {
      model.gameState = WordleGameState.won;
      final stats = model.currentStats;
      stats.totalPlayed++;
      stats.totalWins++;
      stats.currentStreak++;
      if (stats.currentStreak > stats.bestStreak) {
        stats.bestStreak = stats.currentStreak;
      }
      final guessNum = model.currentRow + 1;
      if (guessNum <= 6) stats.distribution[guessNum - 1]++;
      model.message = ['🎉 Xuất sắc!', '🔥 Tuyệt vời!', '👍 Tốt lắm!', '😊 Làm được!'][
          model.currentRow.clamp(0, 3)];
      _saveDailyResult('won', model.currentRow + 1);
      CoinService.instance.reportGameScore('wordle', won: true, level: model.currentRow + 1);
      _saveStats();
    } else {
      model.currentRow++;
      if (model.currentRow >= 6) {
        model.gameState = WordleGameState.lost;
        final stats = model.currentStats;
        stats.totalPlayed++;
        stats.currentStreak = 0;
        model.message = '💀 Đáp án: ${model.target.toUpperCase()}';
        _saveDailyResult('lost', 6);
        CoinService.instance.reportGameScore('wordle', won: false);
        _saveStats();
      }
    }

    model.currentInput = '';
    if (model.gameState == WordleGameState.playing) _syncInputToGrid();
    onUpdate?.call();
    return true;
  }

  // ---------------------------------------------------------------------------
  // Daily result save
  // ---------------------------------------------------------------------------

  Future<void> _saveDailyResult(String result, int guesses) async {
    if (!model.isDailyMode) return;
    model.dailyPlayed = true;
    model.dailyResult = result;
    model.dailyGuesses = guesses;
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString('daily_${model.wordLength}_$todayKey', result);
    await prefs.setInt('daily_guesses_${model.wordLength}_$todayKey', guesses);
  }

  // ---------------------------------------------------------------------------
  // Evaluation
  // ---------------------------------------------------------------------------

  List<LetterState> _evaluate(String guess, String target) {
    final len = target.length;
    final result = List.filled(len, LetterState.absent);
    final targetChars = target.split('');

    // Pass 1: correct (green)
    for (int i = 0; i < len; i++) {
      if (i < guess.length && guess[i] == target[i]) {
        result[i] = LetterState.correct;
        targetChars[i] = '';
      }
    }

    // Pass 2: present (yellow)
    for (int i = 0; i < len; i++) {
      if (result[i] == LetterState.correct) continue;
      if (i >= guess.length) continue;
      final idx = targetChars.indexOf(guess[i]);
      if (idx != -1) {
        result[i] = LetterState.present;
        targetChars[idx] = '';
      }
    }

    return result;
  }

  void _updateKeyStates(String guess, List<LetterState> result) {
    for (int i = 0; i < result.length && i < guess.length; i++) {
      final key = guess[i].toUpperCase();
      final newState = result[i];
      final existing = model.keyStates[key];
      if (existing == null) {
        model.keyStates[key] = newState;
      } else if (existing != LetterState.correct) {
        if (newState == LetterState.correct) {
          model.keyStates[key] = LetterState.correct;
        } else if (existing != LetterState.present &&
            newState == LetterState.present) {
          model.keyStates[key] = LetterState.present;
        } else if (existing == LetterState.empty) {
          model.keyStates[key] = newState;
        }
      }
    }
  }

  void _syncInputToGrid() {
    if (model.currentRow >= 6) return;
    final len = model.wordLength;
    final row = List<String>.filled(len, '');
    final rowStates = List<LetterState>.filled(len, LetterState.empty);
    for (int i = 0; i < model.currentInput.length && i < len; i++) {
      row[i] = model.currentInput[i];
      rowStates[i] = LetterState.typed;
    }
    model.grid[model.currentRow] = row;
    model.states[model.currentRow] = rowStates;
  }

  // ---------------------------------------------------------------------------
  // Persistence
  // ---------------------------------------------------------------------------

  Future<void> loadAll() async {
    final prefs = await SharedPreferences.getInstance();
    for (final len in [5, 6, 7]) {
      for (final mode in ['f', 'd']) {
        final key = '${len}_$mode';
        final stats = model.statsMap.putIfAbsent(key, WordleStats.new);
        stats.totalPlayed = prefs.getInt('w_played_$key') ?? 0;
        stats.totalWins = prefs.getInt('w_wins_$key') ?? 0;
        stats.currentStreak = prefs.getInt('w_streak_$key') ?? 0;
        stats.bestStreak = prefs.getInt('w_best_$key') ?? 0;
        final distStr = prefs.getString('w_dist_$key') ?? '';
        if (distStr.isNotEmpty) {
          final parts = distStr.split(',');
          for (int i = 0; i < parts.length && i < 6; i++) {
            stats.distribution[i] = int.tryParse(parts[i]) ?? 0;
          }
        }
      }
    }
    // Check daily
    _checkDailyPlayed();
  }

  Future<void> _saveStats() async {
    final prefs = await SharedPreferences.getInstance();
    for (final entry in model.statsMap.entries) {
      final key = entry.key;
      final stats = entry.value;
      await prefs.setInt('w_played_$key', stats.totalPlayed);
      await prefs.setInt('w_wins_$key', stats.totalWins);
      await prefs.setInt('w_streak_$key', stats.currentStreak);
      await prefs.setInt('w_best_$key', stats.bestStreak);
      await prefs.setString('w_dist_$key', stats.distribution.join(','));
    }
  }
}

// =============================================================================
// SCREEN
// =============================================================================

const List<List<String>> _kKeyboardRows = [
  ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
  ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L'],
  ['ENTER', 'Z', 'X', 'C', 'V', 'B', 'N', 'M', '⌫'],
];

class WordleScreen extends StatefulWidget {
  const WordleScreen({super.key});

  @override
  State<WordleScreen> createState() => _WordleScreenState();
}

class _WordleScreenState extends State<WordleScreen>
    with TickerProviderStateMixin {
  final _ctrl = WordleController();
  Timer? _messageTimer;
  bool _showNewGame = false;
  Timer? _newGameTimer;
  bool _showStats = false;

  // Animations
  late AnimationController _shakeCtrl;
  late Animation<double> _shakeAnim;
  late AnimationController _danceCtrl;
  final List<AnimationController> _bounceControllers = [];

  @override
  void initState() {
    super.initState();

    // Shake (invalid word)
    _shakeCtrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 400),
    );
    _shakeAnim = TweenSequence([
      TweenSequenceItem(tween: Tween(begin: 0.0, end: -8.0), weight: 1),
      TweenSequenceItem(tween: Tween(begin: -8.0, end: 8.0), weight: 2),
      TweenSequenceItem(tween: Tween(begin: 8.0, end: -6.0), weight: 2),
      TweenSequenceItem(tween: Tween(begin: -6.0, end: 6.0), weight: 2),
      TweenSequenceItem(tween: Tween(begin: 6.0, end: 0.0), weight: 1),
    ]).animate(CurvedAnimation(parent: _shakeCtrl, curve: Curves.linear));

    // Dance (win)
    _danceCtrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 600),
    );

    _ctrl.onUpdate = _handleUpdate;
    _ctrl.loadAll().then((_) {
      _ctrl.newGame();
      if (mounted) setState(() {});
    });
  }

  @override
  void dispose() {
    _messageTimer?.cancel();
    _newGameTimer?.cancel();
    _shakeCtrl.dispose();
    _danceCtrl.dispose();
    for (final c in _bounceControllers) {
      c.dispose();
    }
    super.dispose();
  }

  // ---------------------------------------------------------------------------
  // Bounce controllers (per grid column)
  // ---------------------------------------------------------------------------

  void _ensureBounceControllers(int count) {
    while (_bounceControllers.length < count) {
      _bounceControllers.add(
        AnimationController(
          vsync: this,
          duration: const Duration(milliseconds: 100),
        ),
      );
    }
  }

  void _triggerBounce(int col) {
    _ensureBounceControllers(col + 1);
    _bounceControllers[col].forward(from: 0).then((_) {
      _bounceControllers[col].reverse();
    });
  }

  // ---------------------------------------------------------------------------
  // Update handler
  // ---------------------------------------------------------------------------

  void _handleUpdate() {
    if (!mounted) return;
    setState(() {});

    final msg = _ctrl.model.message;
    if (msg.isNotEmpty) {
      _messageTimer?.cancel();
      _messageTimer = Timer(const Duration(milliseconds: 1800), () {
        if (mounted) setState(() => _ctrl.model.message = '');
      });

      if (_ctrl.model.gameState == WordleGameState.won) {
        // Dance animation
        Future.delayed(const Duration(milliseconds: 300), () {
          if (mounted) _danceCtrl.forward(from: 0);
        });
        _newGameTimer?.cancel();
        _showNewGame = false;
        _newGameTimer = Timer(const Duration(seconds: 2), () {
          if (mounted) setState(() => _showNewGame = true);
        });
      } else if (_ctrl.model.gameState == WordleGameState.lost) {
        _newGameTimer?.cancel();
        _showNewGame = false;
        _newGameTimer = Timer(const Duration(seconds: 2), () {
          if (mounted) setState(() => _showNewGame = true);
        });
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Key actions
  // ---------------------------------------------------------------------------

  void _onKey(String key) {
    if (key == 'ENTER') {
      final valid = _ctrl.submitGuess();
      if (!valid) {
        // Shake animation
        _shakeCtrl.forward(from: 0);
      }
    } else if (key == '⌫') {
      _ctrl.deleteLetter();
    } else {
      final prevLen = _ctrl.model.currentInput.length;
      _ctrl.addLetter(key);
      final newLen = _ctrl.model.currentInput.length;
      if (newLen > prevLen) {
        _triggerBounce(prevLen);
      }
    }
  }

  void _startNewGame() {
    _showNewGame = false;
    _danceCtrl.reset();
    _ctrl.newGame();
  }

  // ---------------------------------------------------------------------------
  // Build
  // ---------------------------------------------------------------------------

  @override
  Widget build(BuildContext context) {
    if (_showStats) return _buildStatsScreen();
    return Scaffold(
      backgroundColor: const Color(0xFF121213),
      body: SafeArea(
        child: Column(
          children: [
            _buildHeader(),
            const SizedBox(height: 4),
            _buildLengthSelector(),
            const SizedBox(height: 6),
            _buildToast(),
            const SizedBox(height: 6),
            Expanded(child: Center(child: _buildGrid())),
            if (_showNewGame && !_ctrl.model.isDailyMode)
              _buildNewGameButton()
            else if (_ctrl.model.isDailyMode && _ctrl.model.dailyPlayed)
              _buildDailyDoneBar(),
            const SizedBox(height: 4),
            _buildKeyboard(),
            const SizedBox(height: 8),
          ],
        ),
      ),
    );
  }

  // ---------------------------------------------------------------------------
  // Header
  // ---------------------------------------------------------------------------

  Widget _buildHeader() {
    final m = _ctrl.model;
    final stats = m.currentStats;
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
          Expanded(
            child: GestureDetector(
              onTap: () => setState(() {
                _ctrl.toggleDailyMode();
                _showNewGame = false;
              }),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Text(
                    m.isDailyMode ? 'DAILY' : 'WORDLE',
                    style: TextStyle(
                      color: m.isDailyMode
                          ? const Color(0xFFFFD700)
                          : Colors.white,
                      fontSize: 22,
                      fontWeight: FontWeight.w900,
                      letterSpacing: 3,
                    ),
                  ),
                  if (m.isDailyMode)
                    const Padding(
                      padding: EdgeInsets.only(left: 6),
                      child: Icon(Icons.calendar_today_rounded,
                          color: Color(0xFFFFD700), size: 16),
                    ),
                ],
              ),
            ),
          ),
          _miniStatBox('🔥', '${stats.currentStreak}'),
          const SizedBox(width: 4),
          _miniStatBox('🏆', '${stats.bestStreak}'),
          IconButton(
            icon: const Icon(Icons.bar_chart_rounded),
            color: Colors.white54,
            onPressed: () => setState(() => _showStats = true),
            tooltip: 'Thống kê',
          ),
        ],
      ),
    );
  }

  Widget _miniStatBox(String icon, String value) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: const Color(0xFF1A1A1B),
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: const Color(0xFF3A3A3C)),
      ),
      child: Row(
        children: [
          Text(icon, style: const TextStyle(fontSize: 14)),
          const SizedBox(width: 4),
          Text(
            value,
            style: const TextStyle(
              color: Colors.white,
              fontSize: 14,
              fontWeight: FontWeight.w900,
            ),
          ),
        ],
      ),
    );
  }

  // ---------------------------------------------------------------------------
  // Length selector
  // ---------------------------------------------------------------------------

  Widget _buildLengthSelector() {
    final current = _ctrl.model.wordLength;
    return Row(
      mainAxisAlignment: MainAxisAlignment.center,
      children: [5, 6, 7].map((len) {
        final selected = len == current;
        return GestureDetector(
          onTap: selected
              ? null
              : () => setState(() {
                    _ctrl.changeLength(len);
                    _showNewGame = false;
                    _danceCtrl.reset();
                  }),
          child: AnimatedContainer(
            duration: const Duration(milliseconds: 180),
            margin: const EdgeInsets.symmetric(horizontal: 5),
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
            decoration: BoxDecoration(
              color: selected
                  ? const Color(0xFF538D4E)
                  : const Color(0xFF1A1A1B),
              borderRadius: BorderRadius.circular(16),
              border: Border.all(
                color: selected
                    ? const Color(0xFF538D4E)
                    : const Color(0xFF3A3A3C),
              ),
            ),
            child: Text(
              '$len chữ',
              style: TextStyle(
                color: selected ? Colors.white : Colors.white54,
                fontSize: 12,
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
  // Toast
  // ---------------------------------------------------------------------------

  Widget _buildToast() {
    final msg = _ctrl.model.message;
    if (msg.isEmpty) return const SizedBox(height: 28);
    return Container(
      height: 28,
      alignment: Alignment.center,
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
      margin: const EdgeInsets.symmetric(horizontal: 16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(6),
      ),
      child: Text(
        msg,
        style: const TextStyle(
          color: Color(0xFF121213),
          fontWeight: FontWeight.bold,
          fontSize: 13,
        ),
      ),
    );
  }

  // ---------------------------------------------------------------------------
  // Grid
  // ---------------------------------------------------------------------------

  Widget _buildGrid() {
    final m = _ctrl.model;
    _ensureBounceControllers(m.wordLength);

    // Tính cell size tự động
    final screenW = MediaQuery.of(context).size.width;
    final cellSize = ((screenW - 40) / m.wordLength - 6).clamp(30.0, 58.0);

    return AnimatedBuilder(
      animation: _shakeAnim,
      builder: (context, child) {
        return Transform.translate(
          offset: Offset(_shakeAnim.value, 0),
          child: child,
        );
      },
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: List.generate(6, (row) {
          final isWinRow = m.gameState == WordleGameState.won &&
              row == m.currentRow;
          return Padding(
            padding: const EdgeInsets.symmetric(vertical: 3),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: List.generate(m.wordLength, (col) {
                return _buildCell(row, col, cellSize, isWinRow);
              }),
            ),
          );
        }),
      ),
    );
  }

  Widget _buildCell(int row, int col, double size, bool isDanceRow) {
    final m = _ctrl.model;
    if (row >= m.grid.length || col >= m.grid[row].length) {
      return _emptyCell(size);
    }
    final letter = m.grid[row][col].toUpperCase();
    final state = m.states[row][col];

    final Color bg;
    final Color borderColor;
    switch (state) {
      case LetterState.correct:
        bg = const Color(0xFF538D4E);
        borderColor = const Color(0xFF538D4E);
      case LetterState.present:
        bg = const Color(0xFFB59F3B);
        borderColor = const Color(0xFFB59F3B);
      case LetterState.absent:
        bg = const Color(0xFF3A3A3C);
        borderColor = const Color(0xFF3A3A3C);
      case LetterState.typed:
        bg = Colors.transparent;
        borderColor = Colors.white54;
      case LetterState.empty:
        bg = Colors.transparent;
        borderColor = Colors.white24;
    }

    // Bounce animation trên ô hiện tại đang gõ
    final isCurrentTyping = row == m.currentRow &&
        state == LetterState.typed &&
        col < _bounceControllers.length;

    Widget cell = AnimatedContainer(
      duration: const Duration(milliseconds: 80),
      width: size,
      height: size,
      margin: const EdgeInsets.all(2.5),
      decoration: BoxDecoration(
        color: bg,
        border: Border.all(color: borderColor, width: 2),
      ),
      alignment: Alignment.center,
      child: Text(
        letter,
        style: TextStyle(
          color: Colors.white,
          fontSize: size * 0.44,
          fontWeight: FontWeight.bold,
        ),
      ),
    );

    if (isCurrentTyping) {
      cell = AnimatedBuilder(
        animation: _bounceControllers[col],
        builder: (context, child) {
          final scale = 1.0 + _bounceControllers[col].value * 0.12;
          return Transform.scale(scale: scale, child: child);
        },
        child: cell,
      );
    }

    // Dance animation trên winning row
    if (isDanceRow) {
      cell = AnimatedBuilder(
        animation: _danceCtrl,
        builder: (context, child) {
          final delay = col / m.wordLength;
          final t = (_danceCtrl.value - delay).clamp(0.0, 1.0 / m.wordLength);
          final bounce = sin(t * pi * m.wordLength) * 10;
          return Transform.translate(
            offset: Offset(0, -bounce),
            child: child,
          );
        },
        child: cell,
      );
    }

    return cell;
  }

  Widget _emptyCell(double size) {
    return Container(
      width: size,
      height: size,
      margin: const EdgeInsets.all(2.5),
      decoration: BoxDecoration(
        border: Border.all(color: Colors.white24, width: 2),
      ),
    );
  }

  // ---------------------------------------------------------------------------
  // Daily done bar
  // ---------------------------------------------------------------------------

  Widget _buildDailyDoneBar() {
    final m = _ctrl.model;
    final isWon = m.dailyResult == 'won';
    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
      decoration: BoxDecoration(
        color: isWon
            ? const Color(0xFF1B3A1B)
            : const Color(0xFF3A1B1B),
        borderRadius: BorderRadius.circular(10),
        border: Border.all(
          color: isWon
              ? const Color(0xFF538D4E)
              : const Color(0xFF8D4E4E),
        ),
      ),
      child: Row(
        children: [
          Text(
            isWon ? '🎉 Đã hoàn thành Daily!' : '💀 Daily thất bại',
            style: TextStyle(
              color: isWon
                  ? const Color(0xFF4CAF50)
                  : const Color(0xFFEF5350),
              fontWeight: FontWeight.bold,
            ),
          ),
          const Spacer(),
          const Text(
            'Quay lại ngày mai',
            style: TextStyle(color: Colors.white54, fontSize: 12),
          ),
        ],
      ),
    );
  }

  // ---------------------------------------------------------------------------
  // New game button
  // ---------------------------------------------------------------------------

  Widget _buildNewGameButton() {
    return Padding(
      padding: const EdgeInsets.only(bottom: 4),
      child: FilledButton.icon(
        onPressed: _startNewGame,
        icon: const Icon(Icons.refresh_rounded),
        label: const Text(
          'VÁN MỚI',
          style: TextStyle(fontWeight: FontWeight.bold, letterSpacing: 1.5),
        ),
        style: FilledButton.styleFrom(
          backgroundColor: const Color(0xFF538D4E),
          foregroundColor: Colors.white,
          padding: const EdgeInsets.symmetric(horizontal: 28, vertical: 10),
        ),
      ),
    );
  }

  // ---------------------------------------------------------------------------
  // Keyboard
  // ---------------------------------------------------------------------------

  Widget _buildKeyboard() {
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: _kKeyboardRows.map((row) {
        return Padding(
          padding: const EdgeInsets.symmetric(vertical: 3),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: row.map((key) => _buildKey(key)).toList(),
          ),
        );
      }).toList(),
    );
  }

  Widget _buildKey(String key) {
    final isWide = key == 'ENTER' || key == '⌫';
    final LetterState? state =
        key.length == 1 ? _ctrl.model.keyStates[key] : null;

    final Color bg;
    switch (state) {
      case LetterState.correct:
        bg = const Color(0xFF538D4E);
      case LetterState.present:
        bg = const Color(0xFFB59F3B);
      case LetterState.absent:
        bg = const Color(0xFF3A3A3C);
      default:
        bg = const Color(0xFF818384);
    }

    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 2.5),
      child: InkWell(
        onTap: () => _onKey(key),
        borderRadius: BorderRadius.circular(4),
        child: Container(
          height: 46,
          constraints: BoxConstraints(minWidth: isWide ? 50 : 30),
          padding: const EdgeInsets.symmetric(horizontal: 4),
          decoration: BoxDecoration(
            color: bg,
            borderRadius: BorderRadius.circular(4),
          ),
          alignment: Alignment.center,
          child: Text(
            key,
            style: const TextStyle(
              color: Colors.white,
              fontWeight: FontWeight.bold,
              fontSize: 12,
            ),
          ),
        ),
      ),
    );
  }

  // ---------------------------------------------------------------------------
  // Stats screen
  // ---------------------------------------------------------------------------

  Widget _buildStatsScreen() {
    final m = _ctrl.model;
    final stats = m.currentStats;
    final winRate = stats.winRate;
    final maxDist = stats.distribution.reduce((a, b) => a > b ? a : b);

    return Scaffold(
      backgroundColor: const Color(0xFF121213),
      body: SafeArea(
        child: Column(
          children: [
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 6),
              child: Row(
                children: [
                  IconButton(
                    icon: const Icon(Icons.close_rounded),
                    color: Colors.white70,
                    onPressed: () => setState(() => _showStats = false),
                  ),
                  const Text(
                    'THỐNG KÊ',
                    style: TextStyle(
                      color: Colors.white,
                      fontSize: 20,
                      fontWeight: FontWeight.w900,
                      letterSpacing: 2,
                    ),
                  ),
                ],
              ),
            ),
            // Mode tabs
            Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                _modeTab('Free Play', !m.isDailyMode, () {
                  if (m.isDailyMode) setState(() => _ctrl.toggleDailyMode());
                }),
                const SizedBox(width: 8),
                _modeTab('Daily 📅', m.isDailyMode, () {
                  if (!m.isDailyMode) setState(() => _ctrl.toggleDailyMode());
                }),
              ],
            ),
            const SizedBox(height: 8),
            // Length tabs
            Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [5, 6, 7].map((len) {
                final sel = len == m.wordLength;
                return GestureDetector(
                  onTap: () => setState(() => _ctrl.model.wordLength = len),
                  child: Container(
                    margin: const EdgeInsets.symmetric(horizontal: 4),
                    padding: const EdgeInsets.symmetric(
                        horizontal: 14, vertical: 6),
                    decoration: BoxDecoration(
                      color: sel
                          ? const Color(0xFF538D4E)
                          : const Color(0xFF1A1A1B),
                      borderRadius: BorderRadius.circular(14),
                      border: Border.all(
                        color: sel
                            ? const Color(0xFF538D4E)
                            : const Color(0xFF3A3A3C),
                      ),
                    ),
                    child: Text(
                      '$len chữ',
                      style: TextStyle(
                        color: sel ? Colors.white : Colors.white54,
                        fontSize: 12,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                  ),
                );
              }).toList(),
            ),
            const SizedBox(height: 16),
            // Summary
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: Row(
                children: [
                  _statTile('Ván', '${stats.totalPlayed}', Colors.white),
                  _statTile(
                      'Thắng', '${stats.totalWins}', const Color(0xFF4CAF50)),
                  _statTile('Win %',
                      '${winRate.toStringAsFixed(0)}%', const Color(0xFF64B5F6)),
                  _statTile('Streak',
                      '${stats.currentStreak}', const Color(0xFFFFD700)),
                  _statTile('Best',
                      '${stats.bestStreak}', const Color(0xFFFF9800)),
                ],
              ),
            ),
            const SizedBox(height: 16),
            const Padding(
              padding: EdgeInsets.symmetric(horizontal: 16),
              child: Align(
                alignment: Alignment.centerLeft,
                child: Text(
                  'PHÂN BỐ SỐ LẦN ĐOÁN',
                  style: TextStyle(
                    color: Colors.white54,
                    fontSize: 11,
                    fontWeight: FontWeight.bold,
                    letterSpacing: 1,
                  ),
                ),
              ),
            ),
            const SizedBox(height: 6),
            Expanded(
              child: ListView.builder(
                padding: const EdgeInsets.symmetric(horizontal: 16),
                itemCount: 6,
                itemBuilder: (context, i) {
                  final count = stats.distribution[i];
                  final frac = maxDist == 0 ? 0.0 : count / maxDist;
                  return Padding(
                    padding: const EdgeInsets.symmetric(vertical: 3),
                    child: Row(
                      children: [
                        SizedBox(
                          width: 20,
                          child: Text(
                            '${i + 1}',
                            style: const TextStyle(
                                color: Colors.white54,
                                fontSize: 13,
                                fontWeight: FontWeight.bold),
                          ),
                        ),
                        Expanded(
                          child: LayoutBuilder(
                            builder: (ctx, constraints) {
                              final barW = constraints.maxWidth * frac;
                              return Stack(
                                children: [
                                  Container(
                                    height: 26,
                                    decoration: BoxDecoration(
                                      color: Colors.white.withAlpha(20),
                                      borderRadius: BorderRadius.circular(4),
                                    ),
                                  ),
                                  if (barW > 0)
                                    Container(
                                      height: 26,
                                      width: barW.clamp(
                                          26.0, constraints.maxWidth),
                                      decoration: BoxDecoration(
                                        color: const Color(0xFF538D4E),
                                        borderRadius:
                                            BorderRadius.circular(4),
                                      ),
                                    ),
                                  Positioned(
                                    left: 8,
                                    top: 5,
                                    child: Text(
                                      '$count',
                                      style: const TextStyle(
                                          color: Colors.white,
                                          fontSize: 12,
                                          fontWeight: FontWeight.bold),
                                    ),
                                  ),
                                ],
                              );
                            },
                          ),
                        ),
                      ],
                    ),
                  );
                },
              ),
            ),
            const SizedBox(height: 16),
          ],
        ),
      ),
    );
  }

  Widget _modeTab(String label, bool selected, VoidCallback onTap) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding:
            const EdgeInsets.symmetric(horizontal: 16, vertical: 7),
        decoration: BoxDecoration(
          color: selected ? const Color(0xFF538D4E) : const Color(0xFF1A1A1B),
          borderRadius: BorderRadius.circular(16),
          border: Border.all(
              color: selected
                  ? const Color(0xFF538D4E)
                  : const Color(0xFF3A3A3C)),
        ),
        child: Text(
          label,
          style: TextStyle(
            color: selected ? Colors.white : Colors.white54,
            fontWeight: FontWeight.bold,
            fontSize: 13,
          ),
        ),
      ),
    );
  }

  Widget _statTile(String label, String value, Color color) {
    return Expanded(
      child: Container(
        margin: const EdgeInsets.symmetric(horizontal: 3),
        padding: const EdgeInsets.symmetric(vertical: 10),
        decoration: BoxDecoration(
          color: const Color(0xFF1A1A1B),
          borderRadius: BorderRadius.circular(8),
          border: Border.all(color: const Color(0xFF3A3A3C)),
        ),
        child: Column(
          children: [
            Text(
              value,
              style: TextStyle(
                  color: color, fontSize: 18, fontWeight: FontWeight.w900),
            ),
            const SizedBox(height: 2),
            Text(
              label,
              style: const TextStyle(
                  color: Colors.white54, fontSize: 9, letterSpacing: 0.5),
            ),
          ],
        ),
      ),
    );
  }
}
