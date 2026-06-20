// brick_breaker_game.dart — Brick Breaker (Enhanced) for Flutter Super Gate hub
//
// Tính năng mới:
//   • 20 level từ brick_levels.dart, bố cục đa dạng
//   • Power-ups: expandPaddle, slowBall, shield, multiBall
//   • Multi-ball (tối đa 3 bóng)
//   • Level select screen với lock/unlock + sao (0–3)
//   • Save tiến trình per level (SharedPreferences)

import 'dart:math';
import 'package:flutter/material.dart';
import 'package:flutter/scheduler.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'brick_levels.dart';
import '../../coin/coin_service.dart';

// =============================================================================
// MODEL
// =============================================================================

class BrickModel {
  double x, y, w, h;
  int hitsLeft;
  bool destroyed = false;
  PowerUpType? powerUp;

  BrickModel({
    required this.x,
    required this.y,
    required this.w,
    required this.h,
    required this.hitsLeft,
    this.powerUp,
  });
}

class BallState {
  double x, y, vx, vy;
  BallState({
    required this.x,
    required this.y,
    required this.vx,
    required this.vy,
  });
}

class PowerUpDrop {
  double x, y;
  final PowerUpType type;
  bool collected = false;
  static const double vy = 0.00025; // rơi xuống

  PowerUpDrop({required this.x, required this.y, required this.type});
}

class ActiveEffect {
  final PowerUpType type;
  double remainingMs;
  ActiveEffect({required this.type, required this.remainingMs});
}

class ShieldState {
  double x = 0, y = 0.98, w = 1.0, h = 0.015;
  bool active = false;
}

enum BBState { levelSelect, idle, playing, dead, levelClear, gameOver }

class BrickBreakerModel {
  // Paddle
  double paddleX = 0.5;
  double get effectivePaddleW =>
      hasEffect(PowerUpType.expandPaddle) ? paddleW * 1.5 : paddleW;
  static const double paddleW = 0.22;
  static const double paddleH = 0.022;
  static const double paddleY = 0.88;

  // Balls
  List<BallState> balls = [];
  static const double ballR = 0.018;
  bool ballLaunched = false;

  // Active bricks
  List<BrickModel> bricks = [];

  // Power-up drops falling
  List<PowerUpDrop> drops = [];

  // Active effects
  List<ActiveEffect> effects = [];

  // Shield
  ShieldState shield = ShieldState();

  // Scores & lives
  int score = 0, totalScore = 0, lives = 3;
  int level = 1;

  // Per-level progress
  Map<int, int> bestScorePerLevel = {};
  Map<int, int> bestStarsPerLevel = {};

  int get starsForLives => lives >= 3 ? 3 : (lives >= 2 ? 2 : 1);

  BBState state = BBState.levelSelect;

  bool hasEffect(PowerUpType type) =>
      effects.any((e) => e.type == type && e.remainingMs > 0);

  double get ballSpeedFactor =>
      hasEffect(PowerUpType.slowBall) ? 0.60 : 1.0;
}

// =============================================================================
// CONTROLLER
// =============================================================================

class BrickBreakerController {
  final BrickBreakerModel model = BrickBreakerModel();
  final Random _rng = Random();

  static const String _prefBestScore = 'best_score_brick_breaker';
  static const double _baseBallSpeed = 0.00045;

  // ---------------------------------------------------------------------------
  // Level loading
  // ---------------------------------------------------------------------------

  void loadLevel(int levelNum) {
    final lvl = levelNum <= kLevels.length
        ? kLevels[levelNum - 1]
        : kLevels.last;

    model.level = levelNum;
    model.bricks.clear();
    model.drops.clear();
    model.effects.clear();
    model.shield.active = false;

    final int cols = lvl.cols;
    final int rows = lvl.rows;
    const double gap = 0.012;
    final double bw = (1.0 - (cols + 1) * gap) / cols;
    const double bh = 0.042;
    const double startY = 0.05;

    for (int r = 0; r < rows; r++) {
      for (int c = 0; c < cols; c++) {
        final cell = lvl.layout[r][c];
        if (cell == null) continue;
        model.bricks.add(BrickModel(
          x: gap + c * (bw + gap),
          y: startY + r * (bh + gap),
          w: bw,
          h: bh,
          hitsLeft: cell.hits,
          powerUp: cell.powerUp,
        ));
      }
    }

    _resetBall();
    model.state = BBState.idle;
  }

  void _resetBall() {
    model.balls = [
      BallState(
        x: model.paddleX,
        y: BrickBreakerModel.paddleY - BrickBreakerModel.ballR - 0.001,
        vx: 0,
        vy: 0,
      ),
    ];
    model.ballLaunched = false;
  }

  // ---------------------------------------------------------------------------
  // Paddle
  // ---------------------------------------------------------------------------

  void movePaddle(double normalizedDx) {
    final hw = model.effectivePaddleW / 2;
    model.paddleX =
        (model.paddleX + normalizedDx).clamp(hw, 1.0 - hw);
    if (!model.ballLaunched && model.balls.isNotEmpty) {
      model.balls[0].x = model.paddleX;
      model.balls[0].y =
          BrickBreakerModel.paddleY - BrickBreakerModel.ballR - 0.001;
    }
  }

  // ---------------------------------------------------------------------------
  // Tap handler
  // ---------------------------------------------------------------------------

  void onTap() {
    switch (model.state) {
      case BBState.idle:
        _launchBall();
      case BBState.dead:
        _resetBall();
        model.state = BBState.idle;
      case BBState.gameOver:
        model.score = 0;
        model.lives = 3;
        model.paddleX = 0.5;
        model.effects.clear();
        model.state = BBState.levelSelect;
      case BBState.levelClear:
        model.paddleX = 0.5;
        model.effects.clear();
        if (model.level < 20) {
          loadLevel(model.level + 1);
        } else {
          model.state = BBState.gameOver; // Hoàn thành tất cả level!
        }
      case BBState.playing:
      case BBState.levelSelect:
        break;
    }
  }

  void startLevel(int levelNum) {
    model.lives = 3;
    model.score = 0;
    model.paddleX = 0.5;
    model.effects.clear();
    loadLevel(levelNum);
  }

  void _launchBall() {
    final lvl = model.level <= kLevels.length
        ? kLevels[model.level - 1]
        : kLevels.last;
    final speed = (_baseBallSpeed + model.level * 0.000025) *
        lvl.speedMultiplier;

    final double angleDeg = 40.0 + _rng.nextDouble() * 100.0;
    final double angleRad = angleDeg * pi / 180.0;

    model.balls[0].vx = cos(angleRad) * speed;
    model.balls[0].vy = -sin(angleRad).abs() * speed;
    model.ballLaunched = true;
    model.state = BBState.playing;
  }

  // ---------------------------------------------------------------------------
  // Physics update
  // ---------------------------------------------------------------------------

  void update(double dtMs) {
    if (model.state != BBState.playing || !model.ballLaunched) return;

    final dt = dtMs.clamp(0.0, 50.0);

    // Update active effects
    _updateEffects(dt);

    // Update all balls
    final ballsToRemove = <BallState>[];
    for (final ball in model.balls) {
      _updateBall(ball, dt);
      if (ball.y - BrickBreakerModel.ballR > 1.0) {
        // Check shield
        if (model.shield.active) {
          ball.vy = -ball.vy.abs();
          ball.y = 1.0 - BrickBreakerModel.ballR;
        } else {
          ballsToRemove.add(ball);
        }
      }
    }

    for (final b in ballsToRemove) {
      model.balls.remove(b);
    }

    if (model.balls.isEmpty) {
      model.lives--;
      model.drops.clear();
      if (model.lives <= 0) {
        model.lives = 0;
        _saveProgress();
        model.state = BBState.gameOver;
      } else {
        model.state = BBState.dead;
        _resetBall();
      }
      return;
    }

    // Update power-up drops
    _updateDrops(dt);

    // Level clear check
    if (model.bricks.every((b) => b.destroyed)) {
      _saveProgress();
      model.state = BBState.levelClear;
    }
  }

  void _updateBall(BallState ball, double dt) {
    final speedFactor = model.ballSpeedFactor;
    ball.x += ball.vx * dt * speedFactor;
    ball.y += ball.vy * dt * speedFactor;

    const r = BrickBreakerModel.ballR;

    // Left/right walls
    if (ball.x - r < 0) {
      ball.x = r;
      ball.vx = ball.vx.abs();
    } else if (ball.x + r > 1.0) {
      ball.x = 1.0 - r;
      ball.vx = -ball.vx.abs();
    }

    // Top wall
    if (ball.y - r < 0) {
      ball.y = r;
      ball.vy = ball.vy.abs();
    }

    // Paddle collision
    _checkPaddleCollision(ball);

    // Brick collisions
    _checkBrickCollisions(ball);
  }

  void _checkPaddleCollision(BallState ball) {
    const r = BrickBreakerModel.ballR;
    final hw = model.effectivePaddleW / 2;
    final ballBottom = ball.y + r;
    final paddleLeft = model.paddleX - hw;
    final paddleRight = model.paddleX + hw;
    const paddleY = BrickBreakerModel.paddleY;
    const paddleH = BrickBreakerModel.paddleH;

    if (ballBottom >= paddleY &&
        ballBottom <= paddleY + paddleH &&
        ball.x >= paddleLeft &&
        ball.x <= paddleRight &&
        ball.vy > 0) {
      final offset = (ball.x - model.paddleX) / hw;
      final angleDeg = 90.0 - offset * 60.0;
      final angleRad = angleDeg * pi / 180.0;
      final speed = sqrt(ball.vx * ball.vx + ball.vy * ball.vy);
      ball.vx = cos(angleRad) * speed;
      ball.vy = -sin(angleRad).abs() * speed;
      ball.y = paddleY - r - 0.001;
    }
  }

  void _checkBrickCollisions(BallState ball) {
    const r = BrickBreakerModel.ballR;
    for (final brick in model.bricks) {
      if (brick.destroyed) continue;

      final ballLeft = ball.x - r;
      final ballRight = ball.x + r;
      final ballTop = ball.y - r;
      final ballBottom = ball.y + r;

      final bRight = brick.x + brick.w;
      final bBottom = brick.y + brick.h;

      if (ballRight <= brick.x ||
          ballLeft >= bRight ||
          ballBottom <= brick.y ||
          ballTop >= bBottom) {
        continue;
      }

      final overlapLeft = ballRight - brick.x;
      final overlapRight = bRight - ballLeft;
      final overlapTop = ballBottom - brick.y;
      final overlapBottom = bBottom - ballTop;

      final minX = min(overlapLeft, overlapRight);
      final minY = min(overlapTop, overlapBottom);

      if (minX < minY) {
        ball.vx = -ball.vx;
        ball.x = overlapLeft < overlapRight
            ? brick.x - r
            : bRight + r;
      } else {
        ball.vy = -ball.vy;
        ball.y = overlapTop < overlapBottom
            ? brick.y - r
            : bBottom + r;
      }

      final oldHits = brick.hitsLeft;
      brick.hitsLeft--;
      model.score += 10 * oldHits;

      if (brick.hitsLeft <= 0) {
        brick.destroyed = true;
        // Spawn power-up drop
        if (brick.powerUp != null) {
          model.drops.add(PowerUpDrop(
            x: brick.x + brick.w / 2,
            y: brick.y + brick.h,
            type: brick.powerUp!,
          ));
        }
      }

      break; // one brick per frame per ball
    }
  }

  // ---------------------------------------------------------------------------
  // Power-up drops
  // ---------------------------------------------------------------------------

  void _updateDrops(double dt) {
    final hw = model.effectivePaddleW / 2;
    for (final drop in model.drops) {
      if (drop.collected) continue;
      drop.y += PowerUpDrop.vy * dt;

      // Check paddle collection
      if (drop.y + 0.02 >= BrickBreakerModel.paddleY &&
          drop.x >= model.paddleX - hw &&
          drop.x <= model.paddleX + hw) {
        drop.collected = true;
        _activateEffect(drop.type);
      }

      // Off screen
      if (drop.y > 1.05) drop.collected = true;
    }
    model.drops.removeWhere((d) => d.collected);
  }

  void _activateEffect(PowerUpType type) {
    // Remove existing effect of same type
    model.effects.removeWhere((e) => e.type == type);

    switch (type) {
      case PowerUpType.expandPaddle:
        model.effects.add(ActiveEffect(
            type: PowerUpType.expandPaddle, remainingMs: 8000));
      case PowerUpType.slowBall:
        model.effects.add(ActiveEffect(
            type: PowerUpType.slowBall, remainingMs: 8000));
      case PowerUpType.shield:
        model.shield.active = true;
        model.effects.add(ActiveEffect(
            type: PowerUpType.shield, remainingMs: 5000));
      case PowerUpType.multiBall:
        if (model.balls.length < 3 && model.balls.isNotEmpty) {
          final existing = model.balls[0];
          final speed = sqrt(
              existing.vx * existing.vx + existing.vy * existing.vy);
          // Thêm 1 bóng với góc lệch 30°
          model.balls.add(BallState(
            x: existing.x,
            y: existing.y,
            vx: -existing.vy.sign * speed * 0.5,
            vy: -speed * 0.87,
          ));
        }
    }
  }

  void _updateEffects(double dt) {
    for (final effect in model.effects) {
      effect.remainingMs -= dt;
    }
    // Deactivate shield if expired
    if (!model.hasEffect(PowerUpType.shield)) {
      model.shield.active = false;
    }
    model.effects.removeWhere((e) => e.remainingMs <= 0);
  }

  // ---------------------------------------------------------------------------
  // Persistence
  // ---------------------------------------------------------------------------

  Future<void> loadProgress() async {
    final prefs = await SharedPreferences.getInstance();
    for (int i = 1; i <= 20; i++) {
      model.bestScorePerLevel[i] = prefs.getInt('bb_score_$i') ?? 0;
      model.bestStarsPerLevel[i] = prefs.getInt('bb_stars_$i') ?? 0;
    }
  }

  void _saveProgress() async {
    final prefs = await SharedPreferences.getInstance();
    final lvl = model.level;
    final existing = model.bestScorePerLevel[lvl] ?? 0;
    final existingStars = model.bestStarsPerLevel[lvl] ?? 0;
    if (model.score > existing) {
      model.bestScorePerLevel[lvl] = model.score;
      await prefs.setInt('bb_score_$lvl', model.score);
    }
    final stars = model.starsForLives;
    if (stars > existingStars) {
      model.bestStarsPerLevel[lvl] = stars;
      await prefs.setInt('bb_stars_$lvl', stars);
    }
    // Unlock next level
    if (lvl < 20) {
      final nextUnlocked = prefs.getBool('bb_unlocked_${lvl + 1}') ?? false;
      if (!nextUnlocked) {
        await prefs.setBool('bb_unlocked_${lvl + 1}', true);
      }
    }
    // Global best score
    final globalBest = prefs.getInt(_prefBestScore) ?? 0;
    if (model.score > globalBest) {
      await prefs.setInt(_prefBestScore, model.score);
    }
    CoinService.instance.reportGameScore('brick_breaker', score: model.score, lives: model.lives, level: model.level);
  }

  Future<bool> isLevelUnlocked(int level) async {
    if (level == 1) return true;
    final prefs = await SharedPreferences.getInstance();
    return prefs.getBool('bb_unlocked_$level') ?? false;
  }
}

// =============================================================================
// PAINTER
// =============================================================================

class BrickBreakerPainter extends CustomPainter {
  final BrickBreakerModel model;

  const BrickBreakerPainter(this.model);

  static const List<Color> _hitColors = [
    Color(0xFFFFD54F), // 1 hit — gold
    Color(0xFFFF8A65), // 2 hits — orange
    Color(0xFFEF5350), // 3 hits — red
  ];
  static const List<Color> _hitInnerColors = [
    Color(0xFFFFF176),
    Color(0xFFFFCCBC),
    Color(0xFFFFCDD2),
  ];

  @override
  void paint(Canvas canvas, Size size) {
    final W = size.width;
    final H = size.height;

    // Background
    canvas.drawRect(
      Offset.zero & size,
      Paint()..color = const Color(0xFF0A0A1A),
    );

    // Bricks
    for (final brick in model.bricks) {
      if (brick.destroyed) continue;
      final idx = (brick.hitsLeft - 1).clamp(0, 2);
      final bRect = Rect.fromLTWH(
          brick.x * W, brick.y * H, brick.w * W, brick.h * H);
      final bRRect = RRect.fromRectAndRadius(bRect, const Radius.circular(4));

      canvas.drawRRect(bRRect, Paint()..color = _hitColors[idx]);

      // Inner border
      const inset = 3.0;
      final innerRect = bRect.deflate(inset);
      if (innerRect.width > 2 && innerRect.height > 2) {
        canvas.drawRRect(
          RRect.fromRectAndRadius(innerRect, const Radius.circular(2)),
          Paint()
            ..color = _hitInnerColors[idx]
            ..style = PaintingStyle.stroke
            ..strokeWidth = 1.5,
        );
      }

      // Power-up indicator dot
      if (brick.powerUp != null) {
        canvas.drawCircle(
          Offset(bRect.center.dx, bRect.center.dy),
          4,
          Paint()..color = brick.powerUp!.color,
        );
      }
    }

    // Shield
    if (model.shield.active) {
      canvas.drawRect(
        Rect.fromLTWH(0, model.shield.y * H, W, model.shield.h * H),
        Paint()
          ..color = const Color(0xFFFFD54F).withAlpha(180)
          ..maskFilter = const MaskFilter.blur(BlurStyle.normal, 3),
      );
    }

    // Power-up drops
    for (final drop in model.drops) {
      final dropRect = Rect.fromCenter(
        center: Offset(drop.x * W, drop.y * H),
        width: 20,
        height: 20,
      );
      canvas.drawRRect(
        RRect.fromRectAndRadius(dropRect, const Radius.circular(4)),
        Paint()..color = drop.type.color,
      );
      // Icon text
      final tp = TextPainter(
        text: TextSpan(
          text: drop.type.emoji,
          style: const TextStyle(fontSize: 11, color: Colors.white),
        ),
        textDirection: TextDirection.ltr,
      )..layout();
      tp.paint(canvas,
          Offset(drop.x * W - tp.width / 2, drop.y * H - tp.height / 2));
    }

    // Paddle
    final hw = model.effectivePaddleW / 2;
    final px = (model.paddleX - hw) * W;
    final py = BrickBreakerModel.paddleY * H;
    final pw = model.effectivePaddleW * W;
    final ph = BrickBreakerModel.paddleH * H;
    final paddleRect = Rect.fromLTWH(px, py, pw, ph);

    canvas.drawRRect(
      RRect.fromRectAndRadius(paddleRect, const Radius.circular(8)),
      Paint()
        ..shader = const LinearGradient(
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
          colors: [Color(0xFF7C6FFF), Color(0xFF3F51B5)],
        ).createShader(paddleRect),
    );

    // Balls
    for (final ball in model.balls) {
      final bx = ball.x * W;
      final by = ball.y * H;
      final br = BrickBreakerModel.ballR * W;

      // Glow
      canvas.drawCircle(
        Offset(bx, by),
        br * 1.8,
        Paint()
          ..color = Colors.white.withAlpha(40)
          ..maskFilter = const MaskFilter.blur(BlurStyle.normal, 5),
      );
      canvas.drawCircle(Offset(bx, by), br, Paint()..color = Colors.white);
    }
  }

  @override
  bool shouldRepaint(BrickBreakerPainter old) => true;
}

// =============================================================================
// SCREEN
// =============================================================================

class BrickBreakerScreen extends StatefulWidget {
  const BrickBreakerScreen({super.key});

  @override
  State<BrickBreakerScreen> createState() => _BrickBreakerScreenState();
}

class _BrickBreakerScreenState extends State<BrickBreakerScreen>
    with TickerProviderStateMixin {
  late final Ticker _ticker;
  Duration _last = Duration.zero;
  final _ctrl = BrickBreakerController();
  bool _progressLoaded = false;

  @override
  void initState() {
    super.initState();
    _ctrl.loadProgress().then((_) {
      if (mounted) setState(() => _progressLoaded = true);
    });
    _ticker = createTicker(_onTick)..start();
  }

  void _onTick(Duration elapsed) {
    final dt = (elapsed - _last).inMilliseconds.toDouble();
    _last = elapsed;
    if (dt > 0 && dt < 100) _ctrl.update(dt);
    if (mounted) setState(() {});
  }

  @override
  void dispose() {
    _ticker.dispose();
    super.dispose();
  }

  // ---------------------------------------------------------------------------
  // Build
  // ---------------------------------------------------------------------------

  @override
  Widget build(BuildContext context) {
    final m = _ctrl.model;
    if (m.state == BBState.levelSelect) {
      return _buildLevelSelect();
    }
    return _buildGame();
  }

  // ---------------------------------------------------------------------------
  // Level Select Screen
  // ---------------------------------------------------------------------------

  Widget _buildLevelSelect() {
    return Scaffold(
      backgroundColor: const Color(0xFF0A0A1A),
      body: SafeArea(
        child: Column(
          children: [
            // Header
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 8),
              child: Row(
                children: [
                  if (Navigator.canPop(context))
                    IconButton(
                      icon: const Icon(Icons.arrow_back_ios_new_rounded),
                      color: Colors.white70,
                      onPressed: () => Navigator.pop(context),
                    ),
                  const Text(
                    'BRICK BREAKER',
                    style: TextStyle(
                      color: Colors.white,
                      fontSize: 20,
                      fontWeight: FontWeight.w900,
                      letterSpacing: 2,
                    ),
                  ),
                  const Spacer(),
                  const Text(
                    'Chọn Level',
                    style: TextStyle(
                      color: Colors.white54,
                      fontSize: 13,
                    ),
                  ),
                ],
              ),
            ),
            Expanded(
              child: GridView.builder(
                padding: const EdgeInsets.all(12),
                gridDelegate:
                    const SliverGridDelegateWithFixedCrossAxisCount(
                  crossAxisCount: 4,
                  crossAxisSpacing: 10,
                  mainAxisSpacing: 10,
                  childAspectRatio: 0.85,
                ),
                itemCount: kLevels.length,
                itemBuilder: (context, i) {
                  final lvl = kLevels[i];
                  final levelNum = lvl.number;
                  final isUnlocked = _progressLoaded
                      ? (levelNum == 1 ||
                          (_ctrl.model.bestStarsPerLevel[levelNum - 1] ?? 0) > 0)
                      : levelNum == 1;
                  final stars =
                      _ctrl.model.bestStarsPerLevel[levelNum] ?? 0;
                  final bestScore =
                      _ctrl.model.bestScorePerLevel[levelNum] ?? 0;

                  return GestureDetector(
                    onTap: isUnlocked
                        ? () {
                            setState(() => _ctrl.startLevel(levelNum));
                          }
                        : null,
                    child: Container(
                      decoration: BoxDecoration(
                        color: isUnlocked
                            ? const Color(0xFF12122A)
                            : const Color(0xFF0D0D18),
                        borderRadius: BorderRadius.circular(10),
                        border: Border.all(
                          color: isUnlocked
                              ? lvl.accentColor.withAlpha(120)
                              : Colors.white12,
                          width: 1.5,
                        ),
                      ),
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          // Level number
                          Text(
                            '$levelNum',
                            style: TextStyle(
                              color: isUnlocked
                                  ? lvl.accentColor
                                  : Colors.white24,
                              fontSize: 22,
                              fontWeight: FontWeight.w900,
                            ),
                          ),
                          // Level name (very small)
                          if (isUnlocked)
                            Padding(
                              padding:
                                  const EdgeInsets.symmetric(horizontal: 4),
                              child: Text(
                                lvl.name,
                                textAlign: TextAlign.center,
                                style: const TextStyle(
                                  color: Colors.white54,
                                  fontSize: 8,
                                ),
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                              ),
                            ),
                          const SizedBox(height: 4),
                          // Stars
                          if (isUnlocked) ...[
                            Row(
                              mainAxisAlignment: MainAxisAlignment.center,
                              children: List.generate(3, (s) {
                                return Text(
                                  '★',
                                  style: TextStyle(
                                    color: s < stars
                                        ? const Color(0xFFFFD700)
                                        : Colors.white24,
                                    fontSize: 10,
                                  ),
                                );
                              }),
                            ),
                            if (bestScore > 0)
                              Text(
                                '$bestScore',
                                style: const TextStyle(
                                  color: Colors.white38,
                                  fontSize: 9,
                                ),
                              ),
                          ] else
                            const Icon(Icons.lock_outline_rounded,
                                color: Colors.white24, size: 16),
                        ],
                      ),
                    ),
                  );
                },
              ),
            ),
          ],
        ),
      ),
    );
  }

  // ---------------------------------------------------------------------------
  // Game Screen
  // ---------------------------------------------------------------------------

  Widget _buildGame() {
    final m = _ctrl.model;
    return Scaffold(
      backgroundColor: const Color(0xFF0A0A1A),
      body: SafeArea(
        child: GestureDetector(
          onTap: _ctrl.onTap,
          onPanUpdate: (d) {
            final sw = context.size?.width ?? 1.0;
            _ctrl.movePaddle(d.delta.dx / sw);
          },
          child: Stack(
            children: [
              // Game canvas
              Positioned.fill(
                child: CustomPaint(
                  painter: BrickBreakerPainter(m),
                ),
              ),

              // HUD
              _buildHUD(),

              // Overlays
              if (m.state == BBState.idle) _buildTapToStart('TAP ĐỂ PHÓNG'),
              if (m.state == BBState.dead) _buildTapToStart('TAP ĐỂ TIẾP TỤC'),
              if (m.state == BBState.levelClear) _buildLevelClearOverlay(),
              if (m.state == BBState.gameOver) _buildGameOverOverlay(),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildHUD() {
    final m = _ctrl.model;
    final lvlConfig = m.level <= kLevels.length
        ? kLevels[m.level - 1]
        : kLevels.last;

    return Positioned(
      top: 0,
      left: 0,
      right: 0,
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
        child: Row(
          children: [
            // Back to level select
            GestureDetector(
              onTap: () => setState(() => _ctrl.model.state = BBState.levelSelect),
              child: Container(
                padding: const EdgeInsets.all(6),
                decoration: BoxDecoration(
                  color: Colors.black45,
                  borderRadius: BorderRadius.circular(6),
                ),
                child: const Icon(
                  Icons.grid_view_rounded,
                  color: Colors.white54,
                  size: 16,
                ),
              ),
            ),
            const SizedBox(width: 8),
            // Level + name
            Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'LV ${m.level}',
                  style: TextStyle(
                    color: lvlConfig.accentColor,
                    fontSize: 13,
                    fontWeight: FontWeight.w900,
                    letterSpacing: 1,
                  ),
                ),
                Text(
                  lvlConfig.name,
                  style: const TextStyle(
                    color: Colors.white38,
                    fontSize: 9,
                  ),
                ),
              ],
            ),
            const Spacer(),
            // Score
            Text(
              '${m.score}',
              style: const TextStyle(
                color: Colors.white,
                fontSize: 18,
                fontWeight: FontWeight.w900,
              ),
            ),
            const Spacer(),
            // Lives
            Row(
              children: List.generate(3, (i) {
                return Text(
                  '♥',
                  style: TextStyle(
                    color: i < m.lives
                        ? const Color(0xFFEF5350)
                        : Colors.white24,
                    fontSize: 16,
                  ),
                );
              }),
            ),
          ],
        ),
      ),
    );
  }

  // ---------------------------------------------------------------------------
  // Overlays
  // ---------------------------------------------------------------------------

  Widget _buildTapToStart(String text) {
    return Positioned(
      bottom: 150,
      left: 0,
      right: 0,
      child: Text(
        text,
        textAlign: TextAlign.center,
        style: const TextStyle(
          color: Colors.white54,
          fontSize: 14,
          fontWeight: FontWeight.w600,
          letterSpacing: 1.5,
        ),
      ),
    );
  }

  Widget _buildLevelClearOverlay() {
    final m = _ctrl.model;
    final stars = m.starsForLives;
    return Positioned.fill(
      child: Container(
        color: Colors.black.withAlpha(160),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Text(
              'LEVEL CLEAR!',
              style: TextStyle(
                color: Color(0xFFFFD700),
                fontSize: 34,
                fontWeight: FontWeight.w900,
                letterSpacing: 3,
              ),
            ),
            const SizedBox(height: 12),
            Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: List.generate(3, (i) {
                return Text(
                  '★',
                  style: TextStyle(
                    color: i < stars
                        ? const Color(0xFFFFD700)
                        : Colors.white24,
                    fontSize: 36,
                  ),
                );
              }),
            ),
            const SizedBox(height: 8),
            Text(
              'Score: ${m.score}',
              style: const TextStyle(
                color: Colors.white70,
                fontSize: 18,
                fontWeight: FontWeight.bold,
              ),
            ),
            const SizedBox(height: 20),
            if (m.level < 20)
              GestureDetector(
                onTap: _ctrl.onTap,
                child: Container(
                  padding: const EdgeInsets.symmetric(
                      horizontal: 32, vertical: 12),
                  decoration: BoxDecoration(
                    gradient: const LinearGradient(
                      colors: [Color(0xFF7C6FFF), Color(0xFF3F51B5)],
                    ),
                    borderRadius: BorderRadius.circular(30),
                  ),
                  child: const Text(
                    'LEVEL TIẾP THEO',
                    style: TextStyle(
                      color: Colors.white,
                      fontWeight: FontWeight.w900,
                      letterSpacing: 1.5,
                    ),
                  ),
                ),
              ),
            const SizedBox(height: 10),
            GestureDetector(
              onTap: () =>
                  setState(() => _ctrl.model.state = BBState.levelSelect),
              child: const Text(
                'Chọn level khác',
                style: TextStyle(
                  color: Colors.white54,
                  fontSize: 13,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildGameOverOverlay() {
    final m = _ctrl.model;
    return Positioned.fill(
      child: Container(
        color: Colors.black.withAlpha(180),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Text(
              'GAME OVER',
              style: TextStyle(
                color: Color(0xFFEF5350),
                fontSize: 36,
                fontWeight: FontWeight.w900,
                letterSpacing: 3,
              ),
            ),
            const SizedBox(height: 12),
            Text(
              'Score: ${m.score}',
              style: const TextStyle(
                color: Colors.white70,
                fontSize: 18,
              ),
            ),
            const SizedBox(height: 24),
            GestureDetector(
              onTap: () =>
                  setState(() => _ctrl.model.state = BBState.levelSelect),
              child: Container(
                padding: const EdgeInsets.symmetric(
                    horizontal: 32, vertical: 12),
                decoration: BoxDecoration(
                  color: const Color(0xFF1A1A2E),
                  borderRadius: BorderRadius.circular(30),
                  border: Border.all(color: const Color(0xFF7C6FFF)),
                ),
                child: const Text(
                  'CHỌN LEVEL',
                  style: TextStyle(
                    color: Colors.white,
                    fontWeight: FontWeight.w900,
                    letterSpacing: 1.5,
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
