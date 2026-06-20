import 'dart:math';
import 'package:flutter/material.dart';
import 'package:flutter/scheduler.dart';
import 'package:flutter/services.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../../coin/coin_service.dart';

// ─── ENUMS ───

enum FlappyState { idle, playing, dead }

// ─── MODELS ───

class FlappyPipe {
  double x;
  double gapCenter;
  bool scored;
  static const double gapHalf = 0.14;
  static const double width = 0.13;
  FlappyPipe({required this.x, required this.gapCenter, this.scored = false});
}

class FlappyParticle {
  double x, y, vx, vy, life, size;
  final double maxLife;
  final Color color;
  FlappyParticle({
    required this.x,
    required this.y,
    required this.vx,
    required this.vy,
    required this.life,
    required this.size,
    required this.color,
  }) : maxLife = life;
}

class FlappyPopup {
  double x, y, age;
  final int value;
  FlappyPopup({required this.x, required this.y, required this.value})
      : age = 0;
}

class FlappyCloud {
  double x, y, w;
  FlappyCloud({required this.x, required this.y, required this.w});
}

class FlappyModel {
  double birdY = 0.4;
  double birdVY = 0.0;
  static const double birdX = 0.22;
  static const double birdHalf = 0.032;
  List<FlappyPipe> pipes = [];
  int score = 0;
  int bestScore = 0;
  FlappyState state = FlappyState.idle;

  // Animation state
  double flapTime = 0;
  double groundScroll = 0;
  double idleBob = 0;
  double stateAge = 0;
  double deathTimer = 0;
  final List<FlappyParticle> particles = [];
  final List<FlappyPopup> popups = [];
  final List<FlappyCloud> clouds = [];
}

// ─── CONTROLLER ───

class FlappyController {
  final FlappyModel model = FlappyModel();
  final Random _rng = Random();

  // Physics tuned for dtMs in milliseconds (normalized 0→1 coordinates)
  //   gravity  ≈ 3.0 units/s²  → 0.000003 units/ms²
  //   jumpVY   ≈ −0.85 units/s → −0.00085 units/ms
  //   pipeSpd  ≈ 0.25 units/s  → 0.00025  units/ms
  // Jump height ~12% screen, peak at ~283ms, fall to ground ~600ms
  static const double _gravity = 0.0000030;
  static const double _jumpVY = -0.00085;
  static const double _pipeSpd = 0.00025;
  static const double _groundY = 0.85;
  static const double _pipeInterval = 0.50;

  FlappyController() {
    _initClouds();
  }

  void _initClouds() {
    for (int i = 0; i < 5; i++) {
      model.clouds.add(FlappyCloud(
        x: _rng.nextDouble() * 1.4,
        y: 0.05 + _rng.nextDouble() * 0.22,
        w: 0.12 + _rng.nextDouble() * 0.15,
      ));
    }
  }

  void onTap() {
    switch (model.state) {
      case FlappyState.idle:
        model.state = FlappyState.playing;
        model.stateAge = 0;
        model.birdVY = _jumpVY;
      case FlappyState.playing:
        model.birdVY = _jumpVY;
        model.flapTime = 0;
      case FlappyState.dead:
        if (model.deathTimer > 500) _resetGame();
    }
  }

  void _resetGame() {
    model
      ..birdY = 0.4
      ..birdVY = _jumpVY
      ..pipes.clear()
      ..particles.clear()
      ..popups.clear()
      ..score = 0
      ..state = FlappyState.playing
      ..stateAge = 0
      ..deathTimer = 0
      ..flapTime = 0;
  }

  void update(double dtMs) {
    model.stateAge += dtMs;
    _updateClouds(dtMs);
    _updateParticles(dtMs);
    _updatePopups(dtMs);

    switch (model.state) {
      case FlappyState.idle:
        model.idleBob += dtMs;
        model.birdY = 0.4 + sin(model.idleBob * 0.003) * 0.018;
      case FlappyState.playing:
        _updatePlaying(dtMs);
      case FlappyState.dead:
        model.deathTimer += dtMs;
        _updateDeadBird(dtMs);
    }
  }

  void _updatePlaying(double dtMs) {
    model.flapTime += dtMs;

    // Bird physics (semi-implicit Euler)
    model.birdVY += _gravity * dtMs;
    model.birdY += model.birdVY * dtMs;

    // Ground parallax scroll
    model.groundScroll = (model.groundScroll + _pipeSpd * dtMs) % 1.0;

    // Spawn pipes
    if (model.pipes.isEmpty || model.pipes.last.x < 1.0 - _pipeInterval) {
      model.pipes.add(FlappyPipe(
        x: 1.15,
        gapCenter: 0.22 + _rng.nextDouble() * 0.42,
      ));
    }

    // Move pipes & scoring
    for (final pipe in model.pipes) {
      pipe.x -= _pipeSpd * dtMs;
      if (!pipe.scored && pipe.x + FlappyPipe.width < FlappyModel.birdX) {
        pipe.scored = true;
        model.score++;
        if (model.score > model.bestScore) model.bestScore = model.score;
        model.popups.add(FlappyPopup(
          x: FlappyModel.birdX,
          y: model.birdY - 0.06,
          value: 1,
        ));
      }
    }
    model.pipes.removeWhere((p) => p.x + FlappyPipe.width < -0.05);

    // Collision detection
    if (_checkCollision()) {
      model.state = FlappyState.dead;
      CoinService.instance.reportGameScore('flappy', score: model.score);
      model.stateAge = 0;
      model.deathTimer = 0;
      _spawnParticles();
    }
  }

  void _updateDeadBird(double dtMs) {
    // Bird continues falling after death until it hits ground
    if (model.birdY < _groundY - FlappyModel.birdHalf) {
      model.birdVY += _gravity * dtMs;
      model.birdY += model.birdVY * dtMs;
      if (model.birdY > _groundY - FlappyModel.birdHalf) {
        model.birdY = _groundY - FlappyModel.birdHalf;
        model.birdVY = 0;
      }
    }
  }

  void _updateClouds(double dtMs) {
    for (final c in model.clouds) {
      c.x -= 0.000035 * dtMs;
      if (c.x + c.w < -0.1) {
        c.x = 1.1 + _rng.nextDouble() * 0.3;
        c.y = 0.05 + _rng.nextDouble() * 0.22;
        c.w = 0.12 + _rng.nextDouble() * 0.15;
      }
    }
  }

  void _updateParticles(double dtMs) {
    for (final p in model.particles) {
      p.vy += 0.0000015 * dtMs;
      p.x += p.vx * dtMs;
      p.y += p.vy * dtMs;
      p.life -= dtMs;
    }
    model.particles.removeWhere((p) => p.life <= 0);
  }

  void _updatePopups(double dtMs) {
    for (final p in model.popups) {
      p.age += dtMs;
      p.y -= 0.00004 * dtMs;
    }
    model.popups.removeWhere((p) => p.age > 800);
  }

  void _spawnParticles() {
    const colors = [
      Color(0xFFFFD54F),
      Color(0xFFFF8A65),
      Color(0xFFFFAB40),
      Color(0xFFFFFFFF),
    ];
    for (int i = 0; i < 12; i++) {
      final a = _rng.nextDouble() * 2 * pi;
      final s = 0.0001 + _rng.nextDouble() * 0.0005;
      model.particles.add(FlappyParticle(
        x: FlappyModel.birdX,
        y: model.birdY,
        vx: cos(a) * s,
        vy: sin(a) * s - 0.0002,
        life: 400 + _rng.nextDouble() * 400,
        size: 2 + _rng.nextDouble() * 3,
        color: colors[_rng.nextInt(4)],
      ));
    }
  }

  bool _checkCollision() {
    const h = FlappyModel.birdHalf;

    // Ceiling & ground
    if (model.birdY - h < 0 || model.birdY + h > _groundY) return true;

    // Pipes — slightly forgiving hitbox (80% of visual size)
    for (final pipe in model.pipes) {
      const bL = FlappyModel.birdX - h * 0.8;
      const bR = FlappyModel.birdX + h * 0.8;
      final bT = model.birdY - h * 0.8;
      final bB = model.birdY + h * 0.8;
      final pL = pipe.x;
      final pR = pipe.x + FlappyPipe.width;
      final gT = pipe.gapCenter - FlappyPipe.gapHalf;
      final gB = pipe.gapCenter + FlappyPipe.gapHalf;

      if (bR > pL && bL < pR && (bT < gT || bB > gB)) return true;
    }
    return false;
  }
}

// ─── PAINTER ───

class FlappyPainter extends CustomPainter {
  final FlappyModel m;
  FlappyPainter(this.m);

  @override
  void paint(Canvas canvas, Size size) {
    final W = size.width, H = size.height;
    _drawSky(canvas, W, H);
    _drawClouds(canvas, W, H);
    _drawPipes(canvas, W, H);
    _drawGround(canvas, W, H);
    _drawParticles(canvas, W, H);
    _drawBird(canvas, W, H);
    _drawScore(canvas, W, H);
    _drawPopups(canvas, W, H);
    _drawOverlays(canvas, W, H);
  }

  // ── Sky gradient ──

  void _drawSky(Canvas canvas, double W, double H) {
    canvas.drawRect(
      Rect.fromLTWH(0, 0, W, H),
      Paint()
        ..shader = const LinearGradient(
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
          colors: [Color(0xFF4FC3F7), Color(0xFF81D4FA), Color(0xFFB3E5FC)],
        ).createShader(Rect.fromLTWH(0, 0, W, H)),
    );
  }

  // ── Parallax clouds ──

  void _drawClouds(Canvas canvas, double W, double H) {
    final paint = Paint()..color = const Color(0x99FFFFFF);
    for (final c in m.clouds) {
      final cx = c.x * W, cy = c.y * H, cw = c.w * W;
      canvas.drawOval(
        Rect.fromCenter(
            center: Offset(cx, cy), width: cw, height: cw * 0.4),
        paint,
      );
      canvas.drawOval(
        Rect.fromCenter(
            center: Offset(cx - cw * 0.25, cy + cw * 0.06),
            width: cw * 0.6,
            height: cw * 0.3),
        paint,
      );
      canvas.drawOval(
        Rect.fromCenter(
            center: Offset(cx + cw * 0.3, cy + cw * 0.04),
            width: cw * 0.55,
            height: cw * 0.28),
        paint,
      );
    }
  }

  // ── Pipes with gradient + 3D caps ──

  void _drawPipes(Canvas canvas, double W, double H) {
    final groundY = FlappyController._groundY * H;
    for (final pipe in m.pipes) {
      final px = pipe.x * W;
      final pw = FlappyPipe.width * W;
      final gapTop = (pipe.gapCenter - FlappyPipe.gapHalf) * H;
      final gapBot = (pipe.gapCenter + FlappyPipe.gapHalf) * H;

      final pipeShader = const LinearGradient(
        begin: Alignment.centerLeft,
        end: Alignment.centerRight,
        colors: [Color(0xFF66BB6A), Color(0xFF43A047), Color(0xFF2E7D32)],
      ).createShader(Rect.fromLTWH(px, 0, pw, H));
      final pipePaint = Paint()..shader = pipeShader;
      final capPaint = Paint()..color = const Color(0xFF2E7D32);
      final hlPaint = Paint()..color = const Color(0x6681C784);
      final capW = pw * 1.18, capH = H * 0.025;

      // Top pipe body + cap + highlight
      canvas.drawRect(Rect.fromLTWH(px, 0, pw, gapTop), pipePaint);
      canvas.drawRRect(
        RRect.fromRectAndRadius(
          Rect.fromLTWH(px - (capW - pw) / 2, gapTop - capH, capW, capH),
          const Radius.circular(3),
        ),
        capPaint,
      );
      canvas.drawRect(
          Rect.fromLTWH(px + pw * 0.15, 0, pw * 0.12, gapTop), hlPaint);

      // Bottom pipe body + cap + highlight
      canvas.drawRect(
          Rect.fromLTWH(px, gapBot, pw, groundY - gapBot), pipePaint);
      canvas.drawRRect(
        RRect.fromRectAndRadius(
          Rect.fromLTWH(px - (capW - pw) / 2, gapBot, capW, capH),
          const Radius.circular(3),
        ),
        capPaint,
      );
      canvas.drawRect(
          Rect.fromLTWH(
              px + pw * 0.15, gapBot, pw * 0.12, groundY - gapBot),
          hlPaint);
    }
  }

  // ── Scrolling ground with grass detail ──

  void _drawGround(Canvas canvas, double W, double H) {
    final gy = FlappyController._groundY * H;

    // Green grass layer
    canvas.drawRect(
      Rect.fromLTWH(0, gy, W, H - gy),
      Paint()..color = const Color(0xFF8BC34A),
    );
    // Dirt layer
    canvas.drawRect(
      Rect.fromLTWH(0, gy + (H - gy) * 0.35, W, (H - gy) * 0.65),
      Paint()..color = const Color(0xFF795548),
    );
    // Top grass border
    canvas.drawLine(
      Offset(0, gy),
      Offset(W, gy),
      Paint()
        ..color = const Color(0xFF558B2F)
        ..strokeWidth = 3,
    );
    // Scrolling grass tufts
    final grassPaint = Paint()
      ..color = const Color(0xFF689F38)
      ..strokeWidth = 2
      ..strokeCap = StrokeCap.round;
    const patW = 18.0;
    final off = m.groundScroll * W;
    for (double gx = -(off % patW) - patW; gx < W + patW; gx += patW) {
      canvas.drawLine(
          Offset(gx, gy + 1), Offset(gx + 5, gy + 7), grassPaint);
      canvas.drawLine(
          Offset(gx + 9, gy + 1), Offset(gx + 12, gy + 5), grassPaint);
    }
  }

  // ── Bird: canvas-drawn with rotation, wing flap, squash & stretch ──

  void _drawBird(Canvas canvas, double W, double H) {
    final bx = FlappyModel.birdX * W;
    final by = m.birdY * H;
    final r = FlappyModel.birdHalf * H;

    canvas.save();
    canvas.translate(bx, by);

    // Squash & stretch based on vertical speed
    final speed = m.birdVY.abs();
    final sf = 1.0 + (speed / 0.0012).clamp(0.0, 1.0) * 0.1;
    canvas.scale(1.0 / sf, sf);

    // Tilt: nose up when rising, nose down when falling
    double tilt = 0;
    if (m.state != FlappyState.idle) {
      if (m.birdVY < 0) {
        tilt = (m.birdVY / 0.001).clamp(-1.0, 0.0) * (pi / 7);
      } else {
        tilt = (m.birdVY / 0.0012).clamp(0.0, 1.0) * (pi / 2.8);
      }
    }
    canvas.rotate(tilt);

    // Shadow
    canvas.drawCircle(
      const Offset(1.5, 2),
      r * 0.88,
      Paint()..color = const Color(0x26000000),
    );

    // Body (yellow)
    canvas.drawOval(
      Rect.fromCenter(center: Offset.zero, width: r * 2, height: r * 1.6),
      Paint()..color = const Color(0xFFFFD54F),
    );
    canvas.drawOval(
      Rect.fromCenter(center: Offset.zero, width: r * 2, height: r * 1.6),
      Paint()
        ..color = const Color(0xFFF9A825)
        ..style = PaintingStyle.stroke
        ..strokeWidth = 1.5,
    );

    // Wing (animated flap)
    final wingY = sin(m.flapTime * 0.018) * r * 0.55;
    final wing = Path()
      ..moveTo(-r * 0.15, r * 0.1)
      ..quadraticBezierTo(-r * 0.85, wingY, -r * 0.05, -r * 0.2)
      ..close();
    canvas.drawPath(wing, Paint()..color = const Color(0xFFFFA726));
    canvas.drawPath(
      wing,
      Paint()
        ..color = const Color(0x4DE65100)
        ..style = PaintingStyle.stroke
        ..strokeWidth = 1,
    );

    // Eye (white + pupil + highlight)
    canvas.drawCircle(
        Offset(r * 0.3, -r * 0.22), r * 0.22, Paint()..color = Colors.white);
    canvas.drawCircle(Offset(r * 0.38, -r * 0.22), r * 0.12,
        Paint()..color = Colors.black);
    canvas.drawCircle(Offset(r * 0.34, -r * 0.28), r * 0.05,
        Paint()..color = Colors.white);

    // Beak (orange)
    final beak = Path()
      ..moveTo(r * 0.65, -r * 0.05)
      ..lineTo(r * 1.15, r * 0.12)
      ..lineTo(r * 0.65, r * 0.28)
      ..close();
    canvas.drawPath(beak, Paint()..color = const Color(0xFFFF6D00));

    canvas.restore();
  }

  // ── Death particles ──

  void _drawParticles(Canvas canvas, double W, double H) {
    for (final p in m.particles) {
      final t = (p.life / p.maxLife).clamp(0.0, 1.0);
      canvas.drawCircle(
        Offset(p.x * W, p.y * H),
        p.size * t,
        Paint()..color = p.color.withValues(alpha: t),
      );
    }
  }

  // ── Score (outlined for visibility) ──

  void _drawScore(Canvas canvas, double W, double H) {
    if (m.state == FlappyState.idle) return;
    final text = '${m.score}';
    final center = Offset(W / 2, H * 0.08);

    // Outline (4 offset copies)
    for (final d in const [
      Offset(-2, -2), Offset(2, -2),
      Offset(-2, 2), Offset(2, 2),
    ]) {
      _paintText(canvas, text, 52, const Color(0x88000000), center + d);
    }
    _paintText(canvas, text, 52, Colors.white, center);
  }

  // ── Score popups (+1 floating up) ──

  void _drawPopups(Canvas canvas, double W, double H) {
    for (final p in m.popups) {
      final t = (1.0 - p.age / 800).clamp(0.0, 1.0);
      final scale = 1.0 + (p.age / 800) * 0.4;
      _paintText(
        canvas,
        '+${p.value}',
        18 * scale,
        Colors.white.withValues(alpha: t),
        Offset(p.x * W + 20, p.y * H),
      );
    }
  }

  // ── Overlays: idle + death with transitions ──

  void _drawOverlays(Canvas canvas, double W, double H) {
    if (m.state == FlappyState.idle) {
      _paintText(
          canvas, 'FLAPPY BIRD', 34, Colors.white, Offset(W / 2, H * 0.18));

      // Pulsing instruction
      final pulse = 0.6 + sin(m.stateAge * 0.004) * 0.4;
      _paintText(canvas, 'CHẠM ĐỂ BẮT ĐẦU', 18,
          Colors.white.withValues(alpha: pulse), Offset(W / 2, H * 0.65));
    }

    if (m.state == FlappyState.dead) {
      final fadeIn = (m.deathTimer / 400).clamp(0.0, 1.0);

      // Screen flash (first 100ms)
      if (m.deathTimer < 100) {
        final flash = 1.0 - m.deathTimer / 100;
        canvas.drawRect(
          Rect.fromLTWH(0, 0, W, H),
          Paint()..color = Colors.white.withValues(alpha: 0.55 * flash),
        );
      }

      // Dim overlay
      canvas.drawRect(
        Rect.fromLTWH(0, 0, W, H),
        Paint()..color = Colors.black.withValues(alpha: 0.4 * fadeIn),
      );

      if (fadeIn > 0.15) {
        // Panel slides down with easeOutBack
        final slideT = Curves.easeOutBack.transform(fadeIn);
        final panelCY = H * 0.42 * slideT;

        // Shadow
        canvas.drawRRect(
          RRect.fromRectAndRadius(
            Rect.fromCenter(
              center: Offset(W / 2 + 3, panelCY + 3),
              width: W * 0.75,
              height: H * 0.30,
            ),
            const Radius.circular(16),
          ),
          Paint()..color = const Color(0x40000000),
        );
        // Panel bg
        canvas.drawRRect(
          RRect.fromRectAndRadius(
            Rect.fromCenter(
              center: Offset(W / 2, panelCY),
              width: W * 0.75,
              height: H * 0.30,
            ),
            const Radius.circular(16),
          ),
          Paint()..color = const Color(0xEE1A237E),
        );

        _paintText(canvas, 'GAME OVER', 30, Colors.white,
            Offset(W / 2, panelCY - H * 0.08));
        _paintText(canvas, 'Điểm: ${m.score}', 20, Colors.white70,
            Offset(W / 2, panelCY));
        _paintText(canvas, 'Tốt nhất: ${m.bestScore}', 16,
            const Color(0xFFFFD54F), Offset(W / 2, panelCY + H * 0.055));

        // Pulsing restart hint (after 500ms delay)
        if (m.deathTimer > 500) {
          final rPulse = 0.5 + sin(m.deathTimer * 0.005) * 0.5;
          _paintText(
            canvas,
            'Chạm để chơi lại',
            14,
            Colors.white.withValues(alpha: 0.4 + rPulse * 0.4),
            Offset(W / 2, panelCY + H * 0.115),
          );
        }
      }
    }
  }

  // ── Text utility ──

  void _paintText(
      Canvas canvas, String text, double size, Color color, Offset center) {
    final tp = TextPainter(
      text: TextSpan(
        text: text,
        style: TextStyle(
          fontSize: size,
          color: color,
          fontWeight: FontWeight.w900,
        ),
      ),
      textDirection: TextDirection.ltr,
    )..layout();
    tp.paint(
        canvas, Offset(center.dx - tp.width / 2, center.dy - tp.height / 2));
  }

  @override
  bool shouldRepaint(FlappyPainter old) => true;
}

// ─── SCREEN ───

class FlappyScreen extends StatefulWidget {
  const FlappyScreen({super.key});

  @override
  State<FlappyScreen> createState() => _FlappyScreenState();
}

class _FlappyScreenState extends State<FlappyScreen>
    with SingleTickerProviderStateMixin {
  final _ctrl = FlappyController();
  final _focusNode = FocusNode();
  late Ticker _ticker;
  Duration _lastElapsed = Duration.zero;

  @override
  void initState() {
    super.initState();
    _loadBest();
    _ticker = createTicker(_onTick);
    _ticker.start();
  }

  void _onTick(Duration elapsed) {
    if (!mounted) return;
    final dtMs = (elapsed - _lastElapsed).inMicroseconds / 1000.0;
    _lastElapsed = elapsed;
    if (dtMs <= 0 || dtMs > 100) return; // skip bad frames
    _ctrl.update(dtMs.clamp(0, 50));
    setState(() {});
  }

  @override
  void dispose() {
    _ticker.dispose();
    _focusNode.dispose();
    super.dispose();
  }

  Future<void> _loadBest() async {
    final prefs = await SharedPreferences.getInstance();
    if (mounted) {
      setState(
          () => _ctrl.model.bestScore = prefs.getInt('best_score_flappy') ?? 0);
    }
  }

  Future<void> _saveBest() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setInt('best_score_flappy', _ctrl.model.bestScore);
  }

  void _onTap() {
    if (_ctrl.model.state == FlappyState.dead) _saveBest();
    _ctrl.onTap();
  }

  void _onKey(KeyEvent e) {
    if (e is! KeyDownEvent) return;
    if (e.logicalKey == LogicalKeyboardKey.space) _onTap();
    if (e.logicalKey == LogicalKeyboardKey.escape &&
        Navigator.canPop(context)) {
      Navigator.pop(context);
    }
  }

  @override
  Widget build(BuildContext context) {
    return KeyboardListener(
      focusNode: _focusNode,
      autofocus: true,
      onKeyEvent: _onKey,
      child: Scaffold(
        backgroundColor: const Color(0xFF4FC3F7),
        body: SafeArea(
          child: Stack(
            children: [
              GestureDetector(
                behavior: HitTestBehavior.opaque,
                onTap: _onTap,
                child: CustomPaint(
                  painter: FlappyPainter(_ctrl.model),
                  child: const SizedBox.expand(),
                ),
              ),
              if (Navigator.canPop(context))
                Positioned(
                  top: 8,
                  left: 8,
                  child: IconButton(
                    icon: const Icon(Icons.arrow_back_ios_new_rounded),
                    color: Colors.white,
                    onPressed: () => Navigator.pop(context),
                    style: IconButton.styleFrom(
                      backgroundColor: Colors.black26,
                    ),
                  ),
                ),
              Positioned(
                top: 12,
                right: 12,
                child: Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                  decoration: BoxDecoration(
                    color: Colors.black26,
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Text(
                    'BEST: ${_ctrl.model.bestScore}',
                    style: const TextStyle(
                      color: Colors.white,
                      fontWeight: FontWeight.bold,
                      fontSize: 13,
                    ),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
