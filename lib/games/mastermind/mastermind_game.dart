// mastermind_game.dart — Mastermind (Enhanced) for Flutter Super Gate hub
//
// Kiến trúc:
//   ── MODEL ────────────────────────────────────────────────
//   • MastermindDifficulty — Classic / Hard / Expert
//   • MastermindGuess      — 1 lần đoán (code + blacks + whites)
//   • MastermindModel      — Toàn bộ trạng thái
//   ── CONTROLLER ───────────────────────────────────────────
//   • MastermindController — Logic game + timer + stats + hints
//   ── SCREEN ───────────────────────────────────────────────
//   • MastermindScreen     — UI: difficulty selector, numpad, stats modal

import 'dart:async';
import 'dart:math';
import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../../coin/coin_service.dart';

// =============================================================================
// ENUMS & CONSTANTS
// =============================================================================

enum MastermindDifficulty { classic, hard, expert }

extension MastermindDifficultyExt on MastermindDifficulty {
  String get label {
    switch (this) {
      case MastermindDifficulty.classic:
        return 'Classic';
      case MastermindDifficulty.hard:
        return 'Hard';
      case MastermindDifficulty.expert:
        return 'Expert';
    }
  }

  int get positions {
    switch (this) {
      case MastermindDifficulty.classic:
        return 4;
      case MastermindDifficulty.hard:
        return 5;
      case MastermindDifficulty.expert:
        return 6;
    }
  }

  int get colorCount {
    switch (this) {
      case MastermindDifficulty.classic:
        return 6;
      case MastermindDifficulty.hard:
        return 8;
      case MastermindDifficulty.expert:
        return 8;
    }
  }

  bool get allowDuplicates {
    switch (this) {
      case MastermindDifficulty.classic:
        return true;
      case MastermindDifficulty.hard:
        return true;
      case MastermindDifficulty.expert:
        return false; // Expert: không trùng màu
    }
  }

  int get maxAttempts {
    switch (this) {
      case MastermindDifficulty.classic:
        return 10;
      case MastermindDifficulty.hard:
        return 12;
      case MastermindDifficulty.expert:
        return 12;
    }
  }
}

// =============================================================================
// MODEL
// =============================================================================

class MastermindGuess {
  final List<int> code;
  final int blacks;
  final int whites;

  MastermindGuess({
    required this.code,
    required this.blacks,
    required this.whites,
  });
}

enum MastermindState { playing, won, lost }

class MastermindStats {
  int totalGames = 0;
  int totalWins = 0;
  int currentStreak = 0;
  int bestStreak = 0;
  List<int> distribution = List.filled(12, 0); // wins per attempt count
  int bestTimeSecs = 0; // best time (lowest) — 0 means not set
}

class MastermindModel {
  MastermindDifficulty difficulty = MastermindDifficulty.classic;

  List<int> secret = [];
  List<MastermindGuess> history = [];
  List<int> currentInput = [];
  MastermindState state = MastermindState.playing;

  // Timer
  int elapsedSeconds = 0;

  // Stats per difficulty
  Map<MastermindDifficulty, MastermindStats> stats = {
    MastermindDifficulty.classic: MastermindStats(),
    MastermindDifficulty.hard: MastermindStats(),
    MastermindDifficulty.expert: MastermindStats(),
  };

  // Hint
  int hintsUsed = 0;
  static const int maxHints = 3;
  List<int>? lastHint;

  MastermindStats get currentStats => stats[difficulty]!;
  int get positions => difficulty.positions;
  int get colorCount => difficulty.colorCount;
  int get maxAttempts => difficulty.maxAttempts;
}

// =============================================================================
// CONTROLLER
// =============================================================================

class MastermindController {
  final MastermindModel model = MastermindModel();
  final Random _rng = Random();
  Timer? _clockTimer;
  VoidCallback? onUpdate;

  // ---------------------------------------------------------------------------
  // Game lifecycle
  // ---------------------------------------------------------------------------

  void newGame() {
    _clockTimer?.cancel();
    model.history = [];
    model.currentInput = [];
    model.state = MastermindState.playing;
    model.elapsedSeconds = 0;
    model.hintsUsed = 0;
    model.lastHint = null;
    _generateSecret();
    _startClock();
    onUpdate?.call();
  }

  void changeDifficulty(MastermindDifficulty d) {
    model.difficulty = d;
    newGame();
  }

  void _startClock() {
    _clockTimer?.cancel();
    _clockTimer = Timer.periodic(const Duration(seconds: 1), (_) {
      if (model.state == MastermindState.playing) {
        model.elapsedSeconds++;
        onUpdate?.call();
      }
    });
  }

  void dispose() {
    _clockTimer?.cancel();
  }

  // ---------------------------------------------------------------------------
  // Input
  // ---------------------------------------------------------------------------

  void addDigit(int d) {
    if (model.currentInput.length < model.positions) {
      model.currentInput.add(d);
      onUpdate?.call();
    }
  }

  void removeDigit() {
    if (model.currentInput.isNotEmpty) {
      model.currentInput.removeLast();
      onUpdate?.call();
    }
  }

  void submit() {
    if (model.currentInput.length < model.positions) return;
    if (model.state != MastermindState.playing) return;

    final guess = List<int>.from(model.currentInput);
    final result = evaluate(guess, model.secret);

    model.history.add(MastermindGuess(
      code: guess,
      blacks: result.blacks,
      whites: result.whites,
    ));

    if (result.blacks == model.positions) {
      _endGame(true);
    } else if (model.history.length >= model.maxAttempts) {
      _endGame(false);
    }

    model.currentInput = [];
    onUpdate?.call();
  }

  void _endGame(bool won) {
    _clockTimer?.cancel();
    model.state = won ? MastermindState.won : MastermindState.lost;

    final stats = model.currentStats;
    stats.totalGames++;

    if (won) {
      stats.totalWins++;
      stats.currentStreak++;
      if (stats.currentStreak > stats.bestStreak) {
        stats.bestStreak = stats.currentStreak;
      }
      final attempts = model.history.length;
      if (attempts <= stats.distribution.length) {
        stats.distribution[attempts - 1]++;
      }
      // Best time
      if (stats.bestTimeSecs == 0 ||
          model.elapsedSeconds < stats.bestTimeSecs) {
        stats.bestTimeSecs = model.elapsedSeconds;
      }
    } else {
      stats.currentStreak = 0;
    }

    CoinService.instance.reportGameScore('mastermind', won: won, moves: model.history.length, level: model.difficulty.index);
    _saveStats();
  }

  // ---------------------------------------------------------------------------
  // Hint
  // ---------------------------------------------------------------------------

  /// Gợi ý 1 vị trí đúng trong secret (chỉ tiết lộ chỉ số, không tiết lộ giá trị)
  List<int>? getHint() {
    if (model.hintsUsed >= MastermindModel.maxHints) return null;
    if (model.state != MastermindState.playing) return null;

    // Tìm các vị trí chưa có trong currentInput (hoặc sai)
    final hint = List<int>.from(model.secret);
    model.lastHint = hint;
    model.hintsUsed++;
    onUpdate?.call();
    return hint;
  }

  // ---------------------------------------------------------------------------
  // Evaluation
  // ---------------------------------------------------------------------------

  ({int blacks, int whites}) evaluate(List<int> guess, List<int> secret) {
    int blacks = 0;
    final gLeft = <int>[];
    final sLeft = <int>[];

    for (int i = 0; i < secret.length; i++) {
      if (i < guess.length && guess[i] == secret[i]) {
        blacks++;
      } else {
        if (i < guess.length) gLeft.add(guess[i]);
        sLeft.add(secret[i]);
      }
    }

    int whites = 0;
    final freq = <int, int>{};
    for (final d in sLeft) {
      freq[d] = (freq[d] ?? 0) + 1;
    }
    for (final d in gLeft) {
      if ((freq[d] ?? 0) > 0) {
        whites++;
        freq[d] = freq[d]! - 1;
      }
    }

    return (blacks: blacks, whites: whites);
  }

  // ---------------------------------------------------------------------------
  // Secret generation
  // ---------------------------------------------------------------------------

  void _generateSecret() {
    final n = model.positions;
    final c = model.colorCount;

    if (model.difficulty.allowDuplicates) {
      model.secret = List.generate(n, (_) => _rng.nextInt(c) + 1);
    } else {
      // Expert: không trùng
      final pool = List.generate(c, (i) => i + 1)..shuffle(_rng);
      model.secret = pool.take(n).toList();
    }
  }

  // ---------------------------------------------------------------------------
  // Persistence
  // ---------------------------------------------------------------------------

  Future<void> loadStats() async {
    final prefs = await SharedPreferences.getInstance();
    for (final d in MastermindDifficulty.values) {
      final key = d.name;
      final stats = model.stats[d]!;
      stats.totalGames = prefs.getInt('mm_total_$key') ?? 0;
      stats.totalWins = prefs.getInt('mm_wins_$key') ?? 0;
      stats.currentStreak = prefs.getInt('mm_streak_$key') ?? 0;
      stats.bestStreak = prefs.getInt('mm_best_streak_$key') ?? 0;
      stats.bestTimeSecs = prefs.getInt('mm_best_time_$key') ?? 0;
      final distStr = prefs.getString('mm_dist_$key') ?? '';
      if (distStr.isNotEmpty) {
        final parts = distStr.split(',');
        for (int i = 0; i < parts.length && i < stats.distribution.length; i++) {
          stats.distribution[i] = int.tryParse(parts[i]) ?? 0;
        }
      }
    }
  }

  Future<void> _saveStats() async {
    final prefs = await SharedPreferences.getInstance();
    for (final d in MastermindDifficulty.values) {
      final key = d.name;
      final stats = model.stats[d]!;
      await prefs.setInt('mm_total_$key', stats.totalGames);
      await prefs.setInt('mm_wins_$key', stats.totalWins);
      await prefs.setInt('mm_streak_$key', stats.currentStreak);
      await prefs.setInt('mm_best_streak_$key', stats.bestStreak);
      await prefs.setInt('mm_best_time_$key', stats.bestTimeSecs);
      await prefs.setString(
          'mm_dist_$key', stats.distribution.join(','));
    }
  }
}

// =============================================================================
// COLORS (8 màu cho hard/expert)
// =============================================================================

const List<Color> kDigitColors = [
  Color(0xFFE53935), // 1 — đỏ
  Color(0xFFFF9800), // 2 — cam
  Color(0xFFFDD835), // 3 — vàng
  Color(0xFF43A047), // 4 — xanh lá
  Color(0xFF1E88E5), // 5 — xanh dương
  Color(0xFF7E57C2), // 6 — tím
  Color(0xFFEC407A), // 7 — hồng (hard/expert)
  Color(0xFF26C6DA), // 8 — cyan (hard/expert)
];

// =============================================================================
// SCREEN
// =============================================================================

class MastermindScreen extends StatefulWidget {
  const MastermindScreen({super.key});

  @override
  State<MastermindScreen> createState() => _MastermindScreenState();
}

class _MastermindScreenState extends State<MastermindScreen> {
  final _ctrl = MastermindController();
  bool _resultShown = false;
  bool _showStats = false;

  @override
  void initState() {
    super.initState();
    _ctrl.onUpdate = () {
      if (mounted) setState(() {});
    };
    _loadAndStart();
  }

  Future<void> _loadAndStart() async {
    await _ctrl.loadStats();
    _ctrl.newGame();
    if (mounted) setState(() {});
  }

  @override
  void dispose() {
    _ctrl.dispose();
    super.dispose();
  }

  // ---------------------------------------------------------------------------
  // Actions
  // ---------------------------------------------------------------------------

  void _onDigit(int d) {
    if (_ctrl.model.state != MastermindState.playing) return;
    _ctrl.addDigit(d);
  }

  void _onBackspace() {
    if (_ctrl.model.state != MastermindState.playing) return;
    _ctrl.removeDigit();
  }

  void _onSubmit() {
    if (_ctrl.model.state != MastermindState.playing) return;
    if (_ctrl.model.currentInput.length < _ctrl.model.positions) return;
    _ctrl.submit();
    final state = _ctrl.model.state;
    if (state != MastermindState.playing && !_resultShown) {
      _resultShown = true;
      _showResult(state);
    }
  }

  void _showResult(MastermindState state) {
    final isWon = state == MastermindState.won;
    final attempts = _ctrl.model.history.length;
    final secretStr = _ctrl.model.secret.join(' ');
    final elapsed = _ctrl.model.elapsedSeconds;
    final mm = elapsed ~/ 60;
    final ss = elapsed % 60;
    final timeStr = '${mm.toString().padLeft(2, '0')}:${ss.toString().padLeft(2, '0')}';

    final message = isWon
        ? '🎉 Đúng rồi! $attempts lần · $timeStr'
        : '💥 Hết lượt! Mã: $secretStr';
    final borderColor = isWon ? const Color(0xFF2E7D32) : const Color(0xFFC62828);

    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(
          message,
          style: TextStyle(
              color: borderColor, fontWeight: FontWeight.bold, fontSize: 15),
        ),
        backgroundColor: Colors.white,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(10),
          side: BorderSide(color: borderColor, width: 2),
        ),
        duration: const Duration(milliseconds: 2200),
        behavior: SnackBarBehavior.floating,
      ),
    );

    Future.delayed(const Duration(milliseconds: 2600), () {
      if (mounted) {
        setState(() {
          _ctrl.newGame();
          _resultShown = false;
        });
      }
    });
  }

  // ---------------------------------------------------------------------------
  // Build
  // ---------------------------------------------------------------------------

  @override
  Widget build(BuildContext context) {
    if (_showStats) return _buildStatsScreen();
    return Scaffold(
      backgroundColor: const Color(0xFF0A0A1A),
      body: SafeArea(
        child: Column(
          children: [
            _buildHeader(),
            _buildDifficultySelector(),
            const SizedBox(height: 4),
            Expanded(child: _buildHistoryList()),
            _buildCurrentInputRow(),
            const SizedBox(height: 8),
            _buildNumpad(),
            const SizedBox(height: 12),
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
    final elapsed = m.elapsedSeconds;
    final mm = elapsed ~/ 60;
    final ss = elapsed % 60;
    final timeStr =
        '${mm.toString().padLeft(2, '0')}:${ss.toString().padLeft(2, '0')}';

    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 6),
      child: Row(
        children: [
          if (Navigator.canPop(context))
            IconButton(
              icon: const Icon(Icons.arrow_back_ios_new_rounded),
              color: Colors.white70,
              onPressed: () => Navigator.pop(context),
            ),
          const Text(
            'MASTERMIND',
            style: TextStyle(
              color: Colors.white,
              fontSize: 20,
              fontWeight: FontWeight.w900,
              letterSpacing: 2,
            ),
          ),
          const Spacer(),
          // Timer
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
            decoration: BoxDecoration(
              color: const Color(0xFF1A1A2E),
              borderRadius: BorderRadius.circular(8),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                const Icon(Icons.timer_outlined,
                    color: Colors.white54, size: 14),
                const SizedBox(width: 4),
                Text(
                  timeStr,
                  style: const TextStyle(
                    color: Colors.white70,
                    fontSize: 13,
                    fontWeight: FontWeight.bold,
                    letterSpacing: 1,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(width: 8),
          // Stats button
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

  // ---------------------------------------------------------------------------
  // Difficulty selector
  // ---------------------------------------------------------------------------

  Widget _buildDifficultySelector() {
    final current = _ctrl.model.difficulty;
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
      child: Row(
        children: MastermindDifficulty.values.map((d) {
          final selected = d == current;
          final Color accent;
          switch (d) {
            case MastermindDifficulty.classic:
              accent = const Color(0xFF43A047);
            case MastermindDifficulty.hard:
              accent = const Color(0xFFFF9800);
            case MastermindDifficulty.expert:
              accent = const Color(0xFFE53935);
          }
          return Expanded(
            child: GestureDetector(
              onTap: selected
                  ? null
                  : () => setState(() => _ctrl.changeDifficulty(d)),
              child: AnimatedContainer(
                duration: const Duration(milliseconds: 200),
                margin: const EdgeInsets.symmetric(horizontal: 4),
                padding: const EdgeInsets.symmetric(vertical: 7),
                decoration: BoxDecoration(
                  color: selected
                      ? accent.withAlpha(40)
                      : const Color(0xFF12122A),
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(
                    color: selected ? accent : Colors.white12,
                    width: 1.5,
                  ),
                ),
                child: Column(
                  children: [
                    Text(
                      d.label,
                      style: TextStyle(
                        color: selected ? accent : Colors.white54,
                        fontSize: 11,
                        fontWeight: FontWeight.bold,
                        letterSpacing: 0.5,
                      ),
                    ),
                    Text(
                      '${d.positions} vị · ${d.colorCount} màu',
                      style: TextStyle(
                        color: selected
                            ? accent.withAlpha(200)
                            : Colors.white30,
                        fontSize: 9,
                      ),
                    ),
                  ],
                ),
              ),
            ),
          );
        }).toList(),
      ),
    );
  }

  // ---------------------------------------------------------------------------
  // History list
  // ---------------------------------------------------------------------------

  Widget _buildHistoryList() {
    final m = _ctrl.model;
    final history = m.history;
    final attemptsLeft = m.maxAttempts - history.length;

    return Column(
      children: [
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
          child: Row(
            children: [
              Text(
                'Lần ${history.length}/${m.maxAttempts}',
                style:
                    const TextStyle(color: Color(0xFF888888), fontSize: 12),
              ),
              const Spacer(),
              if (m.state == MastermindState.playing)
                Text(
                  'Còn lại: $attemptsLeft  |  Gợi ý: ${MastermindModel.maxHints - m.hintsUsed}',
                  style:
                      const TextStyle(color: Color(0xFF888888), fontSize: 12),
                ),
            ],
          ),
        ),
        Expanded(
          child: history.isEmpty
              ? Center(
                  child: Text(
                    'Đoán mã ${m.positions} màu!',
                    style: const TextStyle(
                        color: Color(0xFF555577), fontSize: 14),
                  ),
                )
              : ListView.builder(
                  padding: const EdgeInsets.symmetric(horizontal: 12),
                  itemCount: history.length,
                  itemBuilder: (context, index) =>
                      _buildGuessRow(index + 1, history[index]),
                ),
        ),
      ],
    );
  }

  Widget _buildGuessRow(int num, MastermindGuess guess) {
    return Container(
      margin: const EdgeInsets.symmetric(vertical: 3),
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 7),
      decoration: BoxDecoration(
        color: const Color(0xFF12122A),
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: const Color(0xFF2A2A4A)),
      ),
      child: Row(
        children: [
          SizedBox(
            width: 22,
            child: Text(
              '$num',
              style: const TextStyle(
                  color: Color(0xFF666688),
                  fontSize: 11,
                  fontWeight: FontWeight.bold),
            ),
          ),
          const SizedBox(width: 4),
          ...List.generate(guess.code.length, (i) => _colorPeg(guess.code[i], size: 28)),
          const Spacer(),
          _feedbackBadge(icon: '⬛', count: guess.blacks),
          const SizedBox(width: 8),
          _feedbackBadge(icon: '⬜', count: guess.whites),
        ],
      ),
    );
  }

  Widget _feedbackBadge({required String icon, required int count}) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Text(icon, style: const TextStyle(fontSize: 13)),
        const SizedBox(width: 2),
        SizedBox(
          width: 18,
          child: Text(
            '$count',
            style: const TextStyle(
                color: Colors.white70, fontSize: 13, fontWeight: FontWeight.bold),
          ),
        ),
      ],
    );
  }

  // ---------------------------------------------------------------------------
  // Current input row
  // ---------------------------------------------------------------------------

  Widget _buildCurrentInputRow() {
    final m = _ctrl.model;
    final isFinished = m.state != MastermindState.playing;

    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
      decoration: BoxDecoration(
        color: const Color(0xFF12122A),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(
          color: isFinished
              ? const Color(0xFF3A3A5C)
              : const Color(0xFF5555AA),
          width: isFinished ? 1 : 1.5,
        ),
      ),
      child: isFinished ? _buildSecretReveal() : _buildActiveInput(),
    );
  }

  Widget _buildActiveInput() {
    final input = _ctrl.model.currentInput;
    final positions = _ctrl.model.positions;
    return Row(
      mainAxisAlignment: MainAxisAlignment.center,
      children: List.generate(positions, (i) {
        final filled = i < input.length;
        return Padding(
          padding: const EdgeInsets.symmetric(horizontal: 6),
          child: filled ? _colorPeg(input[i], size: 36) : _emptySlot(size: 36),
        );
      }),
    );
  }

  Widget _buildSecretReveal() {
    final secret = _ctrl.model.secret;
    return Row(
      children: [
        const Text(
          'MÃ BÍ MẬT:',
          style: TextStyle(
              color: Color(0xFFAAAACC),
              fontSize: 10,
              fontWeight: FontWeight.bold,
              letterSpacing: 1),
        ),
        const SizedBox(width: 12),
        ...List.generate(
          secret.length,
          (i) => Padding(
            padding: const EdgeInsets.only(right: 6),
            child: _colorPeg(secret[i], size: 32),
          ),
        ),
      ],
    );
  }

  // ---------------------------------------------------------------------------
  // Numpad
  // ---------------------------------------------------------------------------

  Widget _buildNumpad() {
    final m = _ctrl.model;
    final canSubmit = m.currentInput.length == m.positions &&
        m.state == MastermindState.playing;
    final colorCount = m.colorCount;

    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 14),
      child: Column(
        children: [
          // Color buttons (split into 2 rows if colorCount > 6)
          if (colorCount <= 6)
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceEvenly,
              children: List.generate(colorCount, (i) => _digitButton(i + 1)),
            )
          else ...[
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceEvenly,
              children: List.generate(6, (i) => _digitButton(i + 1)),
            ),
            const SizedBox(height: 8),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceEvenly,
              children: [
                ...List.generate(colorCount - 6, (i) => _digitButton(i + 7)),
                // Hint button
                GestureDetector(
                  onTap: () {
                    if (m.hintsUsed < MastermindModel.maxHints) {
                      _ctrl.getHint();
                      _showHintSnackbar();
                    }
                  },
                  child: Opacity(
                    opacity: m.hintsUsed < MastermindModel.maxHints ? 1.0 : 0.3,
                    child: Container(
                      width: 44,
                      height: 44,
                      decoration: BoxDecoration(
                        color: const Color(0xFF1A2F3A),
                        shape: BoxShape.circle,
                        border: Border.all(
                            color: const Color(0xFF26C6DA), width: 2),
                      ),
                      child: const Icon(Icons.lightbulb_outline_rounded,
                          color: Color(0xFF26C6DA), size: 20),
                    ),
                  ),
                ),
              ],
            ),
          ],
          const SizedBox(height: 10),
          Row(
            children: [
              Expanded(
                child: _actionButton(
                  label: '⌫  Xóa',
                  onTap: _onBackspace,
                  color: const Color(0xFF2A2A3E),
                  textColor: Colors.white70,
                ),
              ),
              const SizedBox(width: 10),
              if (colorCount <= 6) ...[
                // Hint in same row
                GestureDetector(
                  onTap: () {
                    if (m.hintsUsed < MastermindModel.maxHints) {
                      _ctrl.getHint();
                      _showHintSnackbar();
                    }
                  },
                  child: Opacity(
                    opacity: m.hintsUsed < MastermindModel.maxHints ? 1.0 : 0.3,
                    child: Container(
                      width: 48,
                      height: 48,
                      decoration: BoxDecoration(
                        color: const Color(0xFF1A2F3A),
                        borderRadius: BorderRadius.circular(10),
                        border: Border.all(
                            color: const Color(0xFF26C6DA), width: 1.5),
                      ),
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          const Icon(Icons.lightbulb_outline_rounded,
                              color: Color(0xFF26C6DA), size: 16),
                          Text(
                            '${MastermindModel.maxHints - m.hintsUsed}',
                            style: const TextStyle(
                                color: Color(0xFF26C6DA), fontSize: 10),
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
                const SizedBox(width: 10),
              ],
              Expanded(
                flex: 2,
                child: _actionButton(
                  label: '✓  Gửi',
                  onTap: canSubmit ? _onSubmit : null,
                  color: canSubmit
                      ? const Color(0xFF1565C0)
                      : const Color(0xFF1A1A2E),
                  textColor: canSubmit ? Colors.white : const Color(0xFF444466),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  void _showHintSnackbar() {
    final hint = _ctrl.model.lastHint;
    if (hint == null) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Row(
          children: [
            const Text('💡 Mã bí mật: ',
                style: TextStyle(color: Color(0xFF0D47A1), fontSize: 13, fontWeight: FontWeight.bold)),
            ...List.generate(
              hint.length,
              (i) => Container(
                margin: const EdgeInsets.only(right: 4),
                width: 18,
                height: 18,
                decoration: BoxDecoration(
                  color: kDigitColors[hint[i] - 1],
                  shape: BoxShape.circle,
                ),
              ),
            ),
          ],
        ),
        backgroundColor: Colors.white,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(10),
          side: const BorderSide(color: Color(0xFF0D47A1), width: 2),
        ),
        duration: const Duration(seconds: 3),
        behavior: SnackBarBehavior.floating,
      ),
    );
  }

  Widget _digitButton(int digit) {
    final color = kDigitColors[digit - 1];
    return GestureDetector(
      onTap: () => _onDigit(digit),
      child: Container(
        width: 44,
        height: 44,
        decoration: BoxDecoration(
          color: color.withAlpha(40),
          shape: BoxShape.circle,
          border: Border.all(color: color, width: 2),
        ),
        child: Center(
          child: Container(
            width: 26,
            height: 26,
            decoration: BoxDecoration(color: color, shape: BoxShape.circle),
          ),
        ),
      ),
    );
  }

  Widget _actionButton({
    required String label,
    required VoidCallback? onTap,
    required Color color,
    required Color textColor,
  }) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        height: 48,
        decoration: BoxDecoration(
          color: color,
          borderRadius: BorderRadius.circular(10),
        ),
        alignment: Alignment.center,
        child: Text(
          label,
          style: TextStyle(
              color: textColor, fontSize: 14, fontWeight: FontWeight.bold),
        ),
      ),
    );
  }

  // ---------------------------------------------------------------------------
  // Stats screen
  // ---------------------------------------------------------------------------

  Widget _buildStatsScreen() {
    final d = _ctrl.model.difficulty;
    final stats = _ctrl.model.currentStats;
    final winRate = stats.totalGames == 0
        ? 0.0
        : stats.totalWins / stats.totalGames * 100;
    final maxDist =
        stats.distribution.reduce((a, b) => a > b ? a : b);
    final bestTimeStr = stats.bestTimeSecs > 0
        ? '${stats.bestTimeSecs ~/ 60}:${(stats.bestTimeSecs % 60).toString().padLeft(2, '0')}'
        : '--:--';

    return Scaffold(
      backgroundColor: const Color(0xFF0A0A1A),
      body: SafeArea(
        child: Column(
          children: [
            // Header
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
            // Difficulty tabs
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
              child: Row(
                children:
                    MastermindDifficulty.values.map((dd) {
                  final sel = dd == d;
                  return Expanded(
                    child: GestureDetector(
                      onTap: () => setState(() => _ctrl.model.difficulty = dd),
                      child: Container(
                        margin: const EdgeInsets.symmetric(horizontal: 3),
                        padding: const EdgeInsets.symmetric(vertical: 8),
                        decoration: BoxDecoration(
                          color: sel
                              ? const Color(0xFF3949AB)
                              : const Color(0xFF12122A),
                          borderRadius: BorderRadius.circular(8),
                          border: Border.all(
                              color: sel
                                  ? const Color(0xFF7986CB)
                                  : Colors.white12),
                        ),
                        child: Text(
                          dd.label,
                          textAlign: TextAlign.center,
                          style: TextStyle(
                            color: sel ? Colors.white : Colors.white54,
                            fontSize: 12,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                      ),
                    ),
                  );
                }).toList(),
              ),
            ),
            // Summary numbers
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: Row(
                children: [
                  _statTile('Ván', '${stats.totalGames}', Colors.white),
                  _statTile(
                      'Thắng', '${stats.totalWins}', const Color(0xFF4CAF50)),
                  _statTile('Win %', '${winRate.toStringAsFixed(0)}%',
                      const Color(0xFF64B5F6)),
                  _statTile('Best\nStreak', '${stats.bestStreak}',
                      const Color(0xFFFFD700)),
                  _statTile('Best\nTime', bestTimeStr, const Color(0xFF26C6DA)),
                ],
              ),
            ),
            const SizedBox(height: 20),
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
            const SizedBox(height: 8),
            // Distribution chart
            Expanded(
              child: ListView.builder(
                padding: const EdgeInsets.symmetric(horizontal: 16),
                itemCount: d.maxAttempts,
                itemBuilder: (context, i) {
                  final count = i < stats.distribution.length
                      ? stats.distribution[i]
                      : 0;
                  final frac = maxDist == 0 ? 0.0 : count / maxDist;
                  return Padding(
                    padding: const EdgeInsets.symmetric(vertical: 3),
                    child: Row(
                      children: [
                        SizedBox(
                          width: 22,
                          child: Text(
                            '${i + 1}',
                            style: const TextStyle(
                                color: Colors.white54,
                                fontSize: 12,
                                fontWeight: FontWeight.bold),
                          ),
                        ),
                        Expanded(
                          child: LayoutBuilder(
                            builder: (context, constraints) {
                              final barW = constraints.maxWidth * frac;
                              return Stack(
                                children: [
                                  Container(
                                    height: 24,
                                    decoration: BoxDecoration(
                                      color: Colors.white.withAlpha(15),
                                      borderRadius: BorderRadius.circular(4),
                                    ),
                                  ),
                                  if (barW > 0)
                                    Container(
                                      height: 24,
                                      width: barW.clamp(24.0,
                                          constraints.maxWidth.toDouble()),
                                      decoration: BoxDecoration(
                                        color: const Color(0xFF3949AB),
                                        borderRadius: BorderRadius.circular(4),
                                      ),
                                    ),
                                  Positioned(
                                    left: 8,
                                    top: 4,
                                    child: Text(
                                      '$count',
                                      style: const TextStyle(
                                          color: Colors.white70,
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

  Widget _statTile(String label, String value, Color valueColor) {
    return Expanded(
      child: Container(
        margin: const EdgeInsets.symmetric(horizontal: 4),
        padding: const EdgeInsets.symmetric(vertical: 12),
        decoration: BoxDecoration(
          color: const Color(0xFF12122A),
          borderRadius: BorderRadius.circular(10),
          border: Border.all(color: Colors.white12),
        ),
        child: Column(
          children: [
            Text(
              value,
              style: TextStyle(
                  color: valueColor,
                  fontSize: 18,
                  fontWeight: FontWeight.w900),
            ),
            const SizedBox(height: 2),
            Text(
              label,
              textAlign: TextAlign.center,
              style: const TextStyle(
                  color: Colors.white54, fontSize: 9, letterSpacing: 0.5),
            ),
          ],
        ),
      ),
    );
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  Widget _colorPeg(int digit, {required double size}) {
    final color = digit >= 1 && digit <= kDigitColors.length
        ? kDigitColors[digit - 1]
        : Colors.grey;
    return Container(
      width: size,
      height: size,
      margin: const EdgeInsets.symmetric(horizontal: 3),
      decoration: BoxDecoration(
        color: color,
        shape: BoxShape.circle,
        boxShadow: [
          BoxShadow(
              color: color.withAlpha(100), blurRadius: 5, spreadRadius: 1),
        ],
      ),
    );
  }

  Widget _emptySlot({required double size}) {
    return Container(
      width: size,
      height: size,
      margin: const EdgeInsets.symmetric(horizontal: 3),
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        border: Border.all(color: const Color(0xFF3A3A6A), width: 2),
        color: const Color(0xFF0E0E22),
      ),
    );
  }
}
