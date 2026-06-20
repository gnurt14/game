// game_entry.dart — Metadata game + danh sách tất cả game với 4 category

import 'package:flutter/material.dart';
import '../games/memory/memory_game.dart';
import '../games/snake/snake_game.dart';
import '../games/flappy/flappy_game.dart';
import '../games/tetris/tetris_game.dart';
import '../games/sudoku/sudoku_game.dart';
import '../games/simon/simon_game.dart';
import '../games/tictactoe/tictactoe_game.dart';
import '../games/whack_mole/whack_mole_game.dart';
import '../games/minesweeper/minesweeper_game.dart';
import '../games/sliding_puzzle/sliding_puzzle_game.dart';
import '../games/mastermind/mastermind_game.dart';
import '../games/brick_breaker/brick_breaker_game.dart';
import '../games/wordle/wordle_game.dart';
import '../games/ninja_fruit/ninja_fruit_game.dart';
import '../games/bau_cua/bau_cua_game.dart';
import '../games/red_black/red_black_game.dart';
import '../games/xi_jack/xi_jack_game.dart';
import '../games/game_2048/game_2048.dart';

// =============================================================================
// GAME CATEGORY
// =============================================================================

enum GameCategory {
  lucky,    // 🎰 Trò Chơi May Mắn
  action,   // 🎮 Hành Động & Phản Xạ
  puzzle,   // 🧩 Trí Tuệ & Logic
  strategy, // 🔤 Chiến Lược & Kỹ Năng
}

extension GameCategoryExt on GameCategory {
  String get label {
    switch (this) {
      case GameCategory.lucky:    return '🎰 Trò Chơi May Mắn';
      case GameCategory.action:   return '🎮 Hành Động & Phản Xạ';
      case GameCategory.puzzle:   return '🧩 Trí Tuệ & Logic';
      case GameCategory.strategy: return '🔤 Chiến Lược & Kỹ Năng';
    }
  }

  String get description {
    switch (this) {
      case GameCategory.lucky:    return 'Cơ hội nhân coin cao nhất — dành cho người mới bắt đầu!';
      case GameCategory.action:   return 'Nhanh tay, nhanh mắt — thử thách phản xạ của bạn';
      case GameCategory.puzzle:   return 'Động não, tư duy logic — kiếm xu qua kỹ năng';
      case GameCategory.strategy: return 'Lập kế hoạch, ra quyết định — game chiến thuật';
    }
  }

  Color get color {
    switch (this) {
      case GameCategory.lucky:    return const Color(0xFFE53935);
      case GameCategory.action:   return const Color(0xFFFF6B35);
      case GameCategory.puzzle:   return const Color(0xFF7C6FFF);
      case GameCategory.strategy: return const Color(0xFF00BCD4);
    }
  }
}

// =============================================================================
// GAME ENTRY
// =============================================================================

class GameEntry {
  final String name;
  final String description;
  final IconData icon;
  final List<Color> gradient;
  final WidgetBuilder? builder;
  final GameCategory category;

  const GameEntry({
    required this.name,
    required this.description,
    required this.icon,
    required this.gradient,
    required this.category,
    this.builder,
  });
}

// =============================================================================
// GAME LIST — nhóm theo 4 category
// =============================================================================

final List<GameEntry> kAllGames = [
  // ── 🎰 May Mắn ─────────────────────────────────────────────────────────
  GameEntry(
    name: 'Bầu Cua',
    description: 'Lắc xúc xắc\ncược xu thắng thưởng',
    icon: Icons.casino_rounded,
    gradient: const [Color(0xFFE53935), Color(0xFFFF6F00)],
    category: GameCategory.lucky,
    builder: (_) => const BauCuaScreen(),
  ),
  GameEntry(
    name: 'Đỏ Đen',
    description: 'Lật bài đặt cược\ngấp đôi hoặc mất trắng',
    icon: Icons.style_rounded,
    gradient: const [Color(0xFF7B0000), Color(0xFF1A237E)],
    category: GameCategory.lucky,
    builder: (_) => const RedBlackScreen(),
  ),
  GameEntry(
    name: 'Xì Jack',
    description: 'Đấu với nhà cái\nchạm 21 không vượt quá',
    icon: Icons.credit_card_rounded,
    gradient: const [Color(0xFF1B5E20), Color(0xFF004D40)],
    category: GameCategory.lucky,
    builder: (_) => const XiJackScreen(),
  ),

  // ── 🎮 Hành Động ───────────────────────────────────────────────────────
  GameEntry(
    name: 'Snake',
    description: 'Điều khiển con rắn\năn mồi, đừng cắn đuôi!',
    icon: Icons.linear_scale_rounded,
    gradient: const [Color(0xFF2ECC71), Color(0xFF27AE60)],
    category: GameCategory.action,
    builder: (_) => const SnakeScreen(),
  ),
  GameEntry(
    name: 'Flappy',
    description: 'Bay qua chướng\nngại vật liên tục',
    icon: Icons.air_rounded,
    gradient: const [Color(0xFF03A9F4), Color(0xFF4FC3F7)],
    category: GameCategory.action,
    builder: (_) => const FlappyScreen(),
  ),
  GameEntry(
    name: 'Whack-a-Mole',
    description: 'Đập chuột chũi\nnhanh tay nhanh mắt',
    icon: Icons.pest_control_rodent_rounded,
    gradient: const [Color(0xFFFF6B35), Color(0xFFFF8C00)],
    category: GameCategory.action,
    builder: (_) => const WhackMoleScreen(),
  ),
  GameEntry(
    name: 'Ninja Fruit',
    description: 'Chém trái cây\ntránh bom nổ',
    icon: Icons.sports_martial_arts_rounded,
    gradient: const [Color(0xFF43A047), Color(0xFFFF6F00)],
    category: GameCategory.action,
    builder: (_) => const NinjaFruitScreen(),
  ),
  GameEntry(
    name: 'Brick Breaker',
    description: 'Phá gạch bằng\nbóng & mái chèo',
    icon: Icons.sports_baseball_rounded,
    gradient: const [Color(0xFF6A1B9A), Color(0xFF1565C0)],
    category: GameCategory.action,
    builder: (_) => const BrickBreakerScreen(),
  ),

  // ── 🧩 Trí Tuệ ─────────────────────────────────────────────────────────
  GameEntry(
    name: '2048',
    description: 'Hợp nhất các ô số\nđể đạt mục tiêu 2048!',
    icon: Icons.grid_on_rounded,
    gradient: const [Color(0xFFEDC22E), Color(0xFFF2B179)],
    category: GameCategory.puzzle,
    builder: (_) => const GameScreen(),
  ),
  GameEntry(
    name: 'Minesweeper',
    description: 'Dò mìn thông minh\ntránh nổ tung',
    icon: Icons.dangerous_rounded,
    gradient: const [Color(0xFF78909C), Color(0xFF37474F)],
    category: GameCategory.puzzle,
    builder: (_) => const MinesweeperScreen(),
  ),
  GameEntry(
    name: 'Sliding Puzzle',
    description: 'Trượt ô số về\nđúng vị trí',
    icon: Icons.view_module_rounded,
    gradient: const [Color(0xFF26C6DA), Color(0xFF00838F)],
    category: GameCategory.puzzle,
    builder: (_) => const SlidingPuzzleScreen(),
  ),
  GameEntry(
    name: 'Sudoku',
    description: 'Điền số vào ô\ntheo quy tắc logic',
    icon: Icons.tag_rounded,
    gradient: const [Color(0xFF00BCD4), Color(0xFF009688)],
    category: GameCategory.puzzle,
    builder: (_) => const SudokuScreen(),
  ),
  GameEntry(
    name: 'Memory',
    description: 'Lật bài ghép đôi\nthử thách trí nhớ',
    icon: Icons.auto_awesome_mosaic_rounded,
    gradient: const [Color(0xFFE91E63), Color(0xFF9C27B0)],
    category: GameCategory.puzzle,
    builder: (_) => const MemoryScreen(),
  ),
  GameEntry(
    name: 'Simon Says',
    description: 'Nhớ & lặp lại\nchuỗi màu tăng dần',
    icon: Icons.radio_button_checked_rounded,
    gradient: const [Color(0xFFE91E63), Color(0xFF3F51B5)],
    category: GameCategory.puzzle,
    builder: (_) => const SimonScreen(),
  ),

  // ── 🔤 Chiến Lược ──────────────────────────────────────────────────────
  GameEntry(
    name: 'Tetris',
    description: 'Xếp hình khối\nthật khéo léo',
    icon: Icons.view_quilt_rounded,
    gradient: const [Color(0xFF3498DB), Color(0xFF8E44AD)],
    category: GameCategory.strategy,
    builder: (_) => const TetrisScreen(),
  ),
  GameEntry(
    name: 'Wordle',
    description: 'Đoán từ 5 chữ\ntrong 6 lần thử',
    icon: Icons.abc_rounded,
    gradient: const [Color(0xFF558B2F), Color(0xFF33691E)],
    category: GameCategory.strategy,
    builder: (_) => const WordleScreen(),
  ),
  GameEntry(
    name: 'Mastermind',
    description: 'Đoán mã bí mật\nqua gợi ý pegs',
    icon: Icons.lock_rounded,
    gradient: const [Color(0xFF7E57C2), Color(0xFF4527A0)],
    category: GameCategory.strategy,
    builder: (_) => const MastermindScreen(),
  ),
  GameEntry(
    name: 'Tic-Tac-Toe',
    description: 'Đánh X-O 3×3\nvs AI thông minh',
    icon: Icons.close_rounded,
    gradient: const [Color(0xFF607D8B), Color(0xFF455A64)],
    category: GameCategory.strategy,
    builder: (_) => const TicTacToeScreen(),
  ),
];

/// Games nhóm theo category (thứ tự: lucky → action → puzzle → strategy)
Map<GameCategory, List<GameEntry>> get kGamesByCategory {
  final map = <GameCategory, List<GameEntry>>{};
  for (final cat in GameCategory.values) {
    map[cat] = kAllGames.where((g) => g.category == cat).toList();
  }
  return map;
}
