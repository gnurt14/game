// brick_levels.dart — Level configurations & power-up definitions for Brick Breaker

import 'package:flutter/material.dart';

// =============================================================================
// POWER-UP TYPES
// =============================================================================

enum PowerUpType {
  expandPaddle, // Paddle rộng hơn 50% trong 8s
  slowBall, // Giảm tốc độ bóng 40% trong 8s
  shield, // Chắn dưới màn hình 5s
  multiBall, // Thêm 1 quả bóng (max 3)
}

extension PowerUpTypeExt on PowerUpType {
  String get emoji {
    switch (this) {
      case PowerUpType.expandPaddle:
        return '↔';
      case PowerUpType.slowBall:
        return '🐢';
      case PowerUpType.shield:
        return '🛡';
      case PowerUpType.multiBall:
        return '●';
    }
  }

  Color get color {
    switch (this) {
      case PowerUpType.expandPaddle:
        return const Color(0xFF26C6DA);
      case PowerUpType.slowBall:
        return const Color(0xFF66BB6A);
      case PowerUpType.shield:
        return const Color(0xFFFFD54F);
      case PowerUpType.multiBall:
        return const Color(0xFFEF5350);
    }
  }
}

// =============================================================================
// LEVEL CONFIG
// =============================================================================

class BrickCellConfig {
  final int hits; // 1=gold, 2=orange, 3=red
  final PowerUpType? powerUp; // null = không có power-up

  const BrickCellConfig(this.hits, [this.powerUp]);
}

// Viết tắt cho ngắn gọn
const BrickCellConfig b1 = BrickCellConfig(1);
const BrickCellConfig b2 = BrickCellConfig(2);
const BrickCellConfig b3 = BrickCellConfig(3);
const BrickCellConfig b1e = BrickCellConfig(1, PowerUpType.expandPaddle);
const BrickCellConfig b1s = BrickCellConfig(1, PowerUpType.slowBall);
const BrickCellConfig b1h = BrickCellConfig(1, PowerUpType.shield);
const BrickCellConfig b1m = BrickCellConfig(1, PowerUpType.multiBall);
const BrickCellConfig b2e = BrickCellConfig(2, PowerUpType.expandPaddle);
const BrickCellConfig b2s = BrickCellConfig(2, PowerUpType.slowBall);
const BrickCellConfig b2m = BrickCellConfig(2, PowerUpType.multiBall);
const BrickCellConfig b3e = BrickCellConfig(3, PowerUpType.expandPaddle);
const BrickCellConfig b3m = BrickCellConfig(3, PowerUpType.multiBall);

// null = ô trống (không có gạch)
// Mỗi level: List<List<BrickCellConfig?>> — hàng × cột

class LevelConfig {
  final int number;
  final String name;
  final List<List<BrickCellConfig?>> layout; // [row][col]
  final double speedMultiplier;
  final Color accentColor;

  const LevelConfig({
    required this.number,
    required this.name,
    required this.layout,
    required this.speedMultiplier,
    required this.accentColor,
  });

  int get cols => layout.isEmpty ? 0 : layout[0].length;
  int get rows => layout.length;
}

// =============================================================================
// 20 LEVELS
// =============================================================================

final List<LevelConfig> kLevels = [
  // ─── Level 1: Warmup ─────────────────────────────────────────────────────
  const LevelConfig(
    number: 1,
    name: 'Khởi Đầu',
    accentColor: Color(0xFF66BB6A),
    speedMultiplier: 1.0,
    layout: [
      [b1, b1, b1, b1, b1, b1, b1, b1],
      [b1, b1, b1, b1, b1, b1, b1, b1],
      [b1, b1, b1, b1, b1, b1, b1, b1],
    ],
  ),

  // ─── Level 2: Doubles ────────────────────────────────────────────────────
  const LevelConfig(
    number: 2,
    name: 'Gạch Đôi',
    accentColor: Color(0xFF42A5F5),
    speedMultiplier: 1.05,
    layout: [
      [b2, b2, b2, b2, b2, b2, b2, b2],
      [b1, b1, b1, b1, b1, b1, b1, b1],
      [b1, b1, b1, b1, b1, b1, b1, b1],
      [b1, b1, b1, b1e, b1e, b1, b1, b1],
    ],
  ),

  // ─── Level 3: Shield ─────────────────────────────────────────────────────
  const LevelConfig(
    number: 3,
    name: 'Lá Chắn',
    accentColor: Color(0xFFFFD54F),
    speedMultiplier: 1.10,
    layout: [
      [b2, b2, b2, b2, b2, b2, b2, b2],
      [b2, b1, b1, b1, b1, b1, b1, b2],
      [b1, b1, b1h, b1, b1, b1h, b1, b1],
      [b1, b1, b1, b1, b1, b1, b1, b1],
    ],
  ),

  // ─── Level 4: Triple ─────────────────────────────────────────────────────
  const LevelConfig(
    number: 4,
    name: 'Gạch Ba',
    accentColor: Color(0xFFEF5350),
    speedMultiplier: 1.15,
    layout: [
      [b3, b3, b3, b3, b3, b3, b3, b3],
      [b2, b2, b2, b2, b2, b2, b2, b2],
      [b1, b1, b1, b1, b1, b1, b1, b1],
      [b1, b1, b1, b1, b1, b1, b1, b1],
      [b1, b1, b1, b1s, b1s, b1, b1, b1],
    ],
  ),

  // ─── Level 5: V Shape ────────────────────────────────────────────────────
  const LevelConfig(
    number: 5,
    name: 'Hình V',
    accentColor: Color(0xFFAB47BC),
    speedMultiplier: 1.20,
    layout: [
      [b2, b1, null, null, null, null, b1, b2],
      [b2, b2, b1, null, null, b1, b2, b2],
      [b1, b2, b2, b1, b1, b2, b2, b1],
      [null, b1, b2, b2, b2, b2, b1, null],
      [null, null, b1m, b2, b2, b1m, null, null],
    ],
  ),

  // ─── Level 6: Checkerboard ───────────────────────────────────────────────
  const LevelConfig(
    number: 6,
    name: 'Ô Vuông',
    accentColor: Color(0xFF26A69A),
    speedMultiplier: 1.25,
    layout: [
      [b2, null, b2, null, b2, null, b2, null],
      [null, b2, null, b2, null, b2, null, b2],
      [b2, null, b2, null, b2, null, b2, null],
      [null, b2, null, b2e, null, b2e, null, b2],
      [b1, null, b1, null, b1, null, b1, null],
      [null, b1, null, b1, null, b1, null, b1],
    ],
  ),

  // ─── Level 7: Pyramid ────────────────────────────────────────────────────
  const LevelConfig(
    number: 7,
    name: 'Kim Tự Tháp',
    accentColor: Color(0xFFFF7043),
    speedMultiplier: 1.28,
    layout: [
      [null, null, null, b3, b3, null, null, null],
      [null, null, b2, b3, b3, b2, null, null],
      [null, b2, b2, b2, b2, b2, b2, null],
      [b1, b1, b1, b2m, b2m, b1, b1, b1],
      [b1, b1, b1, b1, b1, b1, b1, b1],
    ],
  ),

  // ─── Level 8: Cross ──────────────────────────────────────────────────────
  const LevelConfig(
    number: 8,
    name: 'Hình Thập',
    accentColor: Color(0xFF8D6E63),
    speedMultiplier: 1.32,
    layout: [
      [null, null, null, b2, b2, null, null, null],
      [null, null, null, b2, b2, null, null, null],
      [b2, b2, b2, b3, b3, b2, b2, b2],
      [b2, b2, b2, b3, b3, b2, b2, b2],
      [null, null, null, b2s, b2s, null, null, null],
      [null, null, null, b1, b1, null, null, null],
    ],
  ),

  // ─── Level 9: Wave ───────────────────────────────────────────────────────
  const LevelConfig(
    number: 9,
    name: 'Sóng Biển',
    accentColor: Color(0xFF29B6F6),
    speedMultiplier: 1.36,
    layout: [
      [b2, b1, null, b1, b2, b1, null, b1],
      [b1, b2, b1, b2, b1, b2, b1, b2],
      [null, b1, b2, b1, null, b1, b2, b1],
      [b1, null, b1, b2, b1, null, b1, b2],
      [b2, b1m, null, b1, b2, b1m, null, b1],
      [b1, b1, b1, b1, b1, b1, b1, b1],
    ],
  ),

  // ─── Level 10: Diamond ───────────────────────────────────────────────────
  const LevelConfig(
    number: 10,
    name: 'Kim Cương',
    accentColor: Color(0xFF80DEEA),
    speedMultiplier: 1.40,
    layout: [
      [null, null, null, b3, b3, null, null, null],
      [null, null, b3, b2, b2, b3, null, null],
      [null, b3, b2, b1, b1, b2, b3, null],
      [b3, b2, b1, b3, b3, b1, b2, b3],
      [null, b3, b2, b1e, b1e, b2, b3, null],
      [null, null, b3, b2, b2, b3, null, null],
      [null, null, null, b3, b3, null, null, null],
    ],
  ),

  // ─── Level 11: Fortress ──────────────────────────────────────────────────
  const LevelConfig(
    number: 11,
    name: 'Pháo Đài',
    accentColor: Color(0xFF78909C),
    speedMultiplier: 1.44,
    layout: [
      [b3, null, b3, null, null, b3, null, b3],
      [b3, b3, b3, b3, b3, b3, b3, b3],
      [b3, b2, b2, b2, b2, b2, b2, b3],
      [b3, b2, null, null, null, null, b2, b3],
      [b3, b2, null, b3m, b3m, null, b2, b3],
      [b3, b3, b2, b2, b2, b2, b3, b3],
    ],
  ),

  // ─── Level 12: Zigzag ────────────────────────────────────────────────────
  const LevelConfig(
    number: 12,
    name: 'Zíc Zắc',
    accentColor: Color(0xFFFFB300),
    speedMultiplier: 1.48,
    layout: [
      [b2, b2, null, null, b2, b2, null, null],
      [null, b2, b2, null, null, b2, b2, null],
      [null, null, b2, b2, null, null, b2, b2],
      [b3, null, null, b3, b3, null, null, b3],
      [b3, b3, null, null, b3, b3, b2s, null],
      [null, b3, b3, null, null, b3, b3, null],
    ],
  ),

  // ─── Level 13: Rainbow ───────────────────────────────────────────────────
  const LevelConfig(
    number: 13,
    name: 'Cầu Vồng',
    accentColor: Color(0xFFEC407A),
    speedMultiplier: 1.52,
    layout: [
      [b3, b3, b3, b3, b3, b3, b3, b3],
      [b2, b2, b2, b2, b2, b2, b2, b2],
      [b1, b1, b1, b1, b1, b1, b1, b1],
      [b2, b2, b2, b2, b2, b2, b2, b2],
      [b3, b3, b3, b3e, b3e, b3, b3, b3],
    ],
  ),

  // ─── Level 14: Spiral ────────────────────────────────────────────────────
  const LevelConfig(
    number: 14,
    name: 'Xoắn Ốc',
    accentColor: Color(0xFF7E57C2),
    speedMultiplier: 1.56,
    layout: [
      [b3, b3, b3, b3, b3, b3, b3, b3],
      [b3, null, null, null, null, null, null, b3],
      [b3, null, b2, b2, b2, b2, null, b3],
      [b3, null, b2, b3m, null, b2, null, b3],
      [b3, null, b2, null, b3m, b2, null, b3],
      [b3, null, b2, b2, b2, b2, null, b3],
      [b3, null, null, null, null, null, null, b3],
      [b3, b3, b3, b3, b3, b3, b3, b3],
    ],
  ),

  // ─── Level 15: Random Gaps ───────────────────────────────────────────────
  const LevelConfig(
    number: 15,
    name: 'Mê Cung',
    accentColor: Color(0xFF9CCC65),
    speedMultiplier: 1.60,
    layout: [
      [b3, null, b3, b2, null, b3, null, b3],
      [null, b3, b2, null, b3, b2, b3, null],
      [b2, b3, null, b3, b2, null, b3, b2],
      [b3, null, b2, b3, null, b3, null, b3],
      [null, b3, b3, null, b3, null, b2, null],
      [b3, b2, null, b2, b3, b2, b3, b3],
      [b2, b3, b2e, b3, null, b2s, b3, b2],
    ],
  ),

  // ─── Level 16: Arrow ─────────────────────────────────────────────────────
  const LevelConfig(
    number: 16,
    name: 'Mũi Tên',
    accentColor: Color(0xFFFF8A65),
    speedMultiplier: 1.64,
    layout: [
      [null, null, null, null, b3, null, null, null],
      [null, null, null, b3, b3, b3, null, null],
      [null, null, b3, b3, b3, b3, b3, null],
      [b3, b3, b3, b3m, b3m, b3, b3, b3],
      [null, null, b3, b3, b3, b3, b3, null],
      [null, null, null, b2, b2, b2, null, null],
      [null, null, null, b2, b2, b2, null, null],
    ],
  ),

  // ─── Level 17: Domino ────────────────────────────────────────────────────
  const LevelConfig(
    number: 17,
    name: 'Domino',
    accentColor: Color(0xFF26C6DA),
    speedMultiplier: 1.68,
    layout: [
      [b3, b3, null, b3, b3, null, b3, b3],
      [b3, b3, null, b3, b3, null, b3, b3],
      [b3, b3, null, b3, b3, null, b3, b3],
      [b2, b2, null, b2, b2s, null, b2, b2],
      [b2, b2, null, b2, b2, null, b2, b2],
      [b1, b1, null, b1e, b1, null, b1, b1],
      [b1, b1, null, b1, b1, null, b1, b1],
    ],
  ),

  // ─── Level 18: Chaos ─────────────────────────────────────────────────────
  const LevelConfig(
    number: 18,
    name: 'Hỗn Loạn',
    accentColor: Color(0xFFF44336),
    speedMultiplier: 1.75,
    layout: [
      [b3, b2, b3, null, b3, b2, b3, b2],
      [b2, b3, null, b3, b2, b3, b2, b3],
      [b3, null, b3, b2, b3, null, b3, b2],
      [null, b3, b2, b3, null, b3, b2, b3],
      [b3, b2, b3, null, b3, b2m, b3, null],
      [b2, b3, null, b3, b2, b3, null, b3],
      [b3, b2, b3e, b2, b3, b2, b3, b2],
      [b2, b3, b2, b3, b2, b3, b2, b3],
    ],
  ),

  // ─── Level 19: Dragon ────────────────────────────────────────────────────
  const LevelConfig(
    number: 19,
    name: 'Rồng Lửa',
    accentColor: Color(0xFFFF6F00),
    speedMultiplier: 1.85,
    layout: [
      [b3, b3, null, null, null, null, b3, b3],
      [b3, b3, b3, null, null, b3, b3, b3],
      [null, b3, b3, b3, b3, b3, b3, null],
      [null, null, b3, b3, b3, b3, null, null],
      [null, b3, b3, b3, b3, b3, b3, null],
      [b3, b3, b3, b3m, b3m, b3, b3, b3],
      [b3, b3, b2e, b3, b3, b2s, b3, b3],
      [b2, b2, b2, b2, b2, b2, b2, b2],
    ],
  ),

  // ─── Level 20: Boss ──────────────────────────────────────────────────────
  const LevelConfig(
    number: 20,
    name: 'BOSS FINAL',
    accentColor: Color(0xFFE040FB),
    speedMultiplier: 2.0,
    layout: [
      [b3, b3, b3, b3, b3, b3, b3, b3],
      [b3, b2, b2, b2, b2, b2, b2, b3],
      [b3, b2, b3, b3, b3, b3, b2, b3],
      [b3, b2, b3, b2m, b2m, b3, b2, b3],
      [b3, b2, b3, b3, b3, b3, b2, b3],
      [b3, b2, b2, b2e, b2s, b2, b2, b3],
      [b3, b3, b3, b3, b3, b3, b3, b3],
      [b3, b3, b3, b3, b3, b3, b3, b3],
    ],
  ),
];
