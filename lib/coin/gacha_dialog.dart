// gacha_dialog.dart — Lucky Box với thiết kế nhất quán từ đầu đến cuối

import 'dart:math';
import 'package:flutter/material.dart';

class GachaDialog extends StatefulWidget {
  final Future<(int, String)> Function() onPurchase;
  final bool isFree;

  const GachaDialog({super.key, required this.onPurchase, this.isFree = false});

  static Future<void> show(
    BuildContext context, {
    required Future<(int, String)> Function() onPurchase,
    bool isFree = false,
  }) {
    return showGeneralDialog<void>(
      context: context,
      barrierDismissible: false,
      barrierLabel: '',
      barrierColor: Colors.black.withOpacity(0.92),
      pageBuilder: (_, __, ___) =>
          GachaDialog(onPurchase: onPurchase, isFree: isFree),
      transitionDuration: const Duration(milliseconds: 300),
      transitionBuilder: (_, anim, __, child) => FadeTransition(
        opacity: CurvedAnimation(parent: anim, curve: Curves.easeOut),
        child: child,
      ),
    );
  }

  @override
  State<GachaDialog> createState() => _GachaDialogState();
}

enum _Phase { idle, opening, reveal }

class _GachaDialogState extends State<GachaDialog>
    with TickerProviderStateMixin {
  _Phase _phase = _Phase.idle;
  bool _tapping = false;

  int _reward = 0;
  String _tier = 'bronze';

  // ── Controllers ──────────────────────────────────────────────────────────────
  late final AnimationController _floatCtrl;
  late final AnimationController _pulseCtrl;
  late final AnimationController _orbitCtrl;
  late final AnimationController _shakeCtrl;
  late final AnimationController _flashCtrl;
  late final AnimationController _revealCtrl;
  late final AnimationController _particleCtrl;
  late final AnimationController _glowPulseCtrl;

  // ── Animations ───────────────────────────────────────────────────────────────
  late final Animation<double> _floatAnim;
  late final Animation<double> _pulseAnim;
  late final Animation<double> _shakeAnim;
  late final Animation<double> _flashAnim;
  late final Animation<double> _revealScaleAnim;
  late final Animation<double> _revealFadeAnim;
  late final Animation<double> _btnFadeAnim;
  late final Animation<double> _glowPulseAnim;

  final List<_Particle> _particles = [];
  final Random _rng = Random();

  @override
  void initState() {
    super.initState();
    _setupControllers();
    _setupParticles();
  }

  void _setupControllers() {
    _floatCtrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 2000),
    )..repeat(reverse: true);

    _pulseCtrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1200),
    )..repeat(reverse: true);

    _orbitCtrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 4000),
    )..repeat();

    _shakeCtrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 950),
    );

    _flashCtrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 650),
    );

    _revealCtrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 900),
    );

    _particleCtrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 2800),
    );

    _glowPulseCtrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1000),
    )..repeat(reverse: true);

    // Float gently up and down
    _floatAnim = Tween<double>(begin: -12.0, end: 12.0).animate(
      CurvedAnimation(parent: _floatCtrl, curve: Curves.easeInOut),
    );

    // Box glow breathes
    _pulseAnim = Tween<double>(begin: 0.25, end: 1.0).animate(
      CurvedAnimation(parent: _pulseCtrl, curve: Curves.easeInOut),
    );

    // Shake: slow start → intense → dampens
    _shakeAnim = TweenSequence<double>([
      TweenSequenceItem(tween: Tween(begin: 0.0, end: -6.0),   weight: 1),
      TweenSequenceItem(tween: Tween(begin: -6.0, end: 14.0),  weight: 2),
      TweenSequenceItem(tween: Tween(begin: 14.0, end: -22.0), weight: 2),
      TweenSequenceItem(tween: Tween(begin: -22.0, end: 24.0), weight: 2),
      TweenSequenceItem(tween: Tween(begin: 24.0, end: -22.0), weight: 2),
      TweenSequenceItem(tween: Tween(begin: -22.0, end: 18.0), weight: 2),
      TweenSequenceItem(tween: Tween(begin: 18.0, end: -10.0), weight: 2),
      TweenSequenceItem(tween: Tween(begin: -10.0, end: 0.0),  weight: 1),
    ]).animate(CurvedAnimation(parent: _shakeCtrl, curve: Curves.linear));

    // Flash: fast in, slow out
    _flashAnim = TweenSequence<double>([
      TweenSequenceItem(tween: Tween(begin: 0.0, end: 1.0), weight: 22),
      TweenSequenceItem(tween: Tween(begin: 1.0, end: 0.0), weight: 78),
    ]).animate(_flashCtrl);

    // Reveal: pop + settle
    _revealScaleAnim = TweenSequence<double>([
      TweenSequenceItem(
        tween: Tween<double>(begin: 0.0, end: 1.12)
            .chain(CurveTween(curve: Curves.easeOut)),
        weight: 60,
      ),
      TweenSequenceItem(
        tween: Tween<double>(begin: 1.12, end: 0.96)
            .chain(CurveTween(curve: Curves.easeIn)),
        weight: 20,
      ),
      TweenSequenceItem(
        tween: Tween<double>(begin: 0.96, end: 1.0)
            .chain(CurveTween(curve: Curves.easeOut)),
        weight: 20,
      ),
    ]).animate(_revealCtrl);

    _revealFadeAnim = Tween<double>(begin: 0.0, end: 1.0).animate(
      CurvedAnimation(
        parent: _revealCtrl,
        curve: const Interval(0.0, 0.4, curve: Curves.easeIn),
      ),
    );

    _btnFadeAnim = Tween<double>(begin: 0.0, end: 1.0).animate(
      CurvedAnimation(
        parent: _revealCtrl,
        curve: const Interval(0.75, 1.0, curve: Curves.easeIn),
      ),
    );

    _glowPulseAnim = Tween<double>(begin: 0.5, end: 1.0).animate(
      CurvedAnimation(parent: _glowPulseCtrl, curve: Curves.easeInOut),
    );
  }

  void _setupParticles() {
    for (int i = 0; i < 44; i++) {
      final base = (i / 44.0) * 2 * pi;
      _particles.add(_Particle(
        angle: base + (_rng.nextDouble() - 0.5) * 0.3,
        speed: 0.26 + _rng.nextDouble() * 0.52,
        size: 10.0 + _rng.nextDouble() * 15.0,
        delay: _rng.nextDouble() * 0.18,
        variant: _rng.nextInt(4),
        drift: (_rng.nextDouble() - 0.5) * 0.9,
      ));
    }
  }

  @override
  void dispose() {
    _floatCtrl.dispose();
    _pulseCtrl.dispose();
    _orbitCtrl.dispose();
    _shakeCtrl.dispose();
    _flashCtrl.dispose();
    _revealCtrl.dispose();
    _particleCtrl.dispose();
    _glowPulseCtrl.dispose();
    super.dispose();
  }

  Future<void> _open() async {
    if (_tapping || _phase != _Phase.idle) return;
    setState(() => _tapping = true);

    try {
      final result = await widget.onPurchase();
      _reward = result.$1;
      _tier = result.$2;
    } catch (_) {
      if (mounted) Navigator.pop(context);
      return;
    }
    if (!mounted) return;

    setState(() {
      _phase = _Phase.opening;
      _tapping = false;
    });

    // Stop all idle loops
    _floatCtrl.stop();
    _pulseCtrl.stop();
    _orbitCtrl.stop();

    // 1. Dramatic shake
    await _shakeCtrl.forward();
    if (!mounted) return;

    // 2. White flash (bridge to reveal)
    _flashCtrl.forward();
    await Future.delayed(const Duration(milliseconds: 190));
    if (!mounted) return;

    // 3. Reveal
    setState(() => _phase = _Phase.reveal);
    _particleCtrl.forward();
    _revealCtrl.forward();
  }

  _TierTheme get _theme => _TierTheme.of(_tier);

  // ── Build ─────────────────────────────────────────────────────────────────────

  @override
  Widget build(BuildContext context) {
    return Material(
      color: const Color(0xFF07071A),
      child: Stack(
        children: [
          if (_phase == _Phase.reveal) _buildRevealGlow(),
          SafeArea(
            child: Center(
              child: _phase == _Phase.reveal ? _buildReveal() : _buildBox(),
            ),
          ),
          if (_phase == _Phase.reveal) _buildParticles(),
          _buildFlash(),
          if (_phase == _Phase.reveal) _buildCloseBtn(),
        ],
      ),
    );
  }

  // ── Reveal background glow ───────────────────────────────────────────────────

  Widget _buildRevealGlow() {
    return AnimatedBuilder(
      animation: Listenable.merge([_revealCtrl, _glowPulseAnim]),
      builder: (_, __) {
        final v = _revealCtrl.value * _glowPulseAnim.value;
        return SizedBox.expand(
          child: DecoratedBox(
            decoration: BoxDecoration(
              gradient: RadialGradient(
                colors: [
                  _theme.accent.withOpacity(0.20 * v),
                  _theme.accent.withOpacity(0.06 * v),
                  Colors.transparent,
                ],
                stops: const [0.0, 0.4, 1.0],
                radius: 1.1,
              ),
            ),
          ),
        );
      },
    );
  }

  // ── Flash ────────────────────────────────────────────────────────────────────

  Widget _buildFlash() {
    return AnimatedBuilder(
      animation: _flashAnim,
      builder: (_, __) => IgnorePointer(
        child: Opacity(
          opacity: _flashAnim.value,
          child: Container(
            color: Colors.white,
            width: double.infinity,
            height: double.infinity,
          ),
        ),
      ),
    );
  }

  // ── Box (idle + opening) ──────────────────────────────────────────────────────

  Widget _buildBox() {
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        AnimatedBuilder(
          animation: Listenable.merge([_floatAnim, _shakeAnim]),
          builder: (_, __) {
            final isOpening = _phase == _Phase.opening;
            return Transform.translate(
              offset: Offset(
                isOpening ? _shakeAnim.value : 0,
                isOpening ? 0 : _floatAnim.value,
              ),
              child: _buildLuckyBox(),
            );
          },
        ),
        const SizedBox(height: 54),
        if (_phase == _Phase.idle) _buildOpenBtn(),
      ],
    );
  }

  /// The consistent visual throughout idle + opening phases.
  /// One design: dark box with gold border and gold "?" — no mixed icons.
  Widget _buildLuckyBox() {
    return AnimatedBuilder(
      animation: Listenable.merge([_pulseAnim, _orbitCtrl]),
      builder: (_, __) {
        final p = _phase == _Phase.idle ? _pulseAnim.value : 1.0;

        return Stack(
          alignment: Alignment.center,
          children: [
            // ── Outer aura (circular glow, not a box) ──────────────────────
            Container(
              width: 224,
              height: 224,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                gradient: RadialGradient(
                  colors: [
                    const Color(0xFFFFD700).withOpacity(0.10 * p),
                    const Color(0xFF9C27B0).withOpacity(0.08 * p),
                    Colors.transparent,
                  ],
                  stops: const [0.0, 0.5, 1.0],
                ),
              ),
            ),

            // ── Lucky box ──────────────────────────────────────────────────
            Container(
              width: 178,
              height: 178,
              decoration: BoxDecoration(
                // Dark inner background — same navy as screen
                gradient: LinearGradient(
                  colors: const [Color(0xFF16103A), Color(0xFF08061E)],
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                ),
                borderRadius: BorderRadius.circular(22),
                border: Border.all(
                  color: Color.lerp(
                    const Color(0xFF9B6B00),
                    const Color(0xFFFFD700),
                    p,
                  )!,
                  width: 2.5,
                ),
                boxShadow: [
                  // Gold outer glow
                  BoxShadow(
                    color: const Color(0xFFFFD700).withOpacity(0.30 * p),
                    blurRadius: 14 + 22 * p,
                    spreadRadius: 1 + 4 * p,
                  ),
                  // Purple ambient
                  BoxShadow(
                    color: const Color(0xFF9C27B0).withOpacity(0.20 * p),
                    blurRadius: 36,
                    spreadRadius: 6,
                  ),
                ],
              ),
              child: Stack(
                alignment: Alignment.center,
                children: [
                  // Top gold stripe
                  Positioned(
                    top: 0, left: 0, right: 0,
                    child: Container(
                      height: 6,
                      decoration: BoxDecoration(
                        gradient: LinearGradient(
                          colors: [
                            Colors.transparent,
                            const Color(0xFFFFD700).withOpacity(0.25 * p),
                            Colors.transparent,
                          ],
                        ),
                        borderRadius: const BorderRadius.only(
                          topLeft: Radius.circular(20),
                          topRight: Radius.circular(20),
                        ),
                      ),
                    ),
                  ),
                  // Bottom gold stripe
                  Positioned(
                    bottom: 0, left: 0, right: 0,
                    child: Container(
                      height: 6,
                      decoration: BoxDecoration(
                        gradient: LinearGradient(
                          colors: [
                            Colors.transparent,
                            const Color(0xFFFFD700).withOpacity(0.18 * p),
                            Colors.transparent,
                          ],
                        ),
                        borderRadius: const BorderRadius.only(
                          bottomLeft: Radius.circular(20),
                          bottomRight: Radius.circular(20),
                        ),
                      ),
                    ),
                  ),
                  // Corner diamond marks
                  ..._cornerDiamonds(),
                  // Gold "?" — the one and only symbol
                  ShaderMask(
                    shaderCallback: (r) => LinearGradient(
                      colors: [
                        Color.lerp(const Color(0xFFCC9900), const Color(0xFFFFEE66), p)!,
                        Color.lerp(const Color(0xFF996600), const Color(0xFFFF9900), p)!,
                      ],
                      begin: Alignment.topCenter,
                      end: Alignment.bottomCenter,
                    ).createShader(r),
                    child: Text(
                      '?',
                      style: TextStyle(
                        color: Colors.white,
                        fontSize: 98,
                        fontWeight: FontWeight.w900,
                        height: 1.0,
                        shadows: [
                          Shadow(
                            color: const Color(0xFFFFD700).withOpacity(0.7 * p),
                            blurRadius: 18,
                          ),
                        ],
                      ),
                    ),
                  ),
                ],
              ),
            ),

            // ── Orbiting sparkles (idle only) ──────────────────────────────
            if (_phase == _Phase.idle)
              AnimatedBuilder(
                animation: _orbitCtrl,
                builder: (_, __) => _orbitSparkles(),
              ),
          ],
        );
      },
    );
  }

  List<Widget> _cornerDiamonds() {
    const s = 7.0;
    const positions = [
      Offset(12, 12),
      Offset(159, 12),
      Offset(12, 159),
      Offset(159, 159),
    ];
    return positions
        .map((pos) => Positioned(
              left: pos.dx,
              top: pos.dy,
              child: const Text(
                '◆',
                style: TextStyle(
                  color: Color(0xFFCC9900),
                  fontSize: s,
                  height: 1,
                ),
              ),
            ))
        .toList();
  }

  Widget _orbitSparkles() {
    const r = 110.0;
    const cx = 112.0;
    const cy = 112.0;
    final angle = _orbitCtrl.value * 2 * pi;
    const items = ['✨', '⭐', '✦', '✨', '💫', '⭐'];
    const sizes = [15.0, 12.0, 10.0, 14.0, 13.0, 11.0];
    final n = items.length;

    return SizedBox(
      width: cx * 2,
      height: cy * 2,
      child: Stack(
        children: List.generate(n, (i) {
          final a = angle + i * (2 * pi / n);
          final x = cx + r * cos(a) - sizes[i] / 2;
          final y = cy + r * sin(a) - sizes[i] / 2;
          final fade = 0.45 + 0.45 * ((sin(a + angle * 0.7) + 1) / 2);
          return Positioned(
            left: x,
            top: y,
            child: Opacity(
              opacity: fade,
              child: Text(items[i], style: TextStyle(fontSize: sizes[i])),
            ),
          );
        }),
      ),
    );
  }

  Widget _buildOpenBtn() {
    if (_tapping) {
      return const SizedBox(
        width: 28,
        height: 28,
        child: CircularProgressIndicator(
          strokeWidth: 2.5,
          color: Color(0xFFFFD700),
        ),
      );
    }
    return AnimatedBuilder(
      animation: _pulseAnim,
      builder: (_, child) => Container(
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(32),
          boxShadow: [
            BoxShadow(
              color: const Color(0xFFFFD700)
                  .withOpacity(0.18 + 0.20 * _pulseAnim.value),
              blurRadius: 10 + 18 * _pulseAnim.value,
            ),
          ],
        ),
        child: child,
      ),
      child: Column(
        children: [
          FilledButton(
            onPressed: _open,
            style: FilledButton.styleFrom(
              backgroundColor: const Color(0xFFB8860B),
              padding:
                  const EdgeInsets.symmetric(horizontal: 44, vertical: 15),
              shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(32)),
              textStyle: const TextStyle(
                  fontSize: 16,
                  fontWeight: FontWeight.w900,
                  letterSpacing: 1.2),
            ),
            child: Text(
                widget.isFree ? '✨  MỞ RƯƠNG MIỄN PHÍ' : '✨  MỞ RƯƠNG'),
          ),
          const SizedBox(height: 10),
          Text(
            widget.isFree
                ? 'Quà tặng chào mừng — miễn phí!'
                : 'Chi phí: 100 xu',
            style: const TextStyle(
                color: Color(0xFF7777AA), fontSize: 13),
          ),
        ],
      ),
    );
  }

  // ── Reveal ────────────────────────────────────────────────────────────────────

  Widget _buildReveal() {
    return AnimatedBuilder(
      animation: Listenable.merge(
          [_revealScaleAnim, _revealFadeAnim, _glowPulseAnim]),
      builder: (_, __) => Opacity(
        opacity: _revealFadeAnim.value,
        child: Transform.scale(
          scale: _revealScaleAnim.value,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              // ── Large tier emoji ──────────────────────────────────────────
              Text(
                _theme.emoji,
                style: TextStyle(
                  fontSize: 76,
                  shadows: [
                    Shadow(
                      color: _theme.accent.withOpacity(0.8),
                      blurRadius: 24,
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 20),

              // ── Tier name badge ───────────────────────────────────────────
              Container(
                padding: const EdgeInsets.symmetric(
                    horizontal: 32, vertical: 11),
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    colors: _theme.gradientColors,
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                  ),
                  borderRadius: BorderRadius.circular(40),
                  border: Border.all(color: _theme.accent, width: 2),
                  boxShadow: [
                    BoxShadow(
                      color: _theme.accent.withOpacity(
                          0.45 + 0.28 * _glowPulseAnim.value),
                      blurRadius: 20 + 14 * _glowPulseAnim.value,
                      spreadRadius: 2 + 3 * _glowPulseAnim.value,
                    ),
                  ],
                ),
                child: Text(
                  _theme.label,
                  style: TextStyle(
                    color: _theme.accent,
                    fontSize: 20,
                    fontWeight: FontWeight.w900,
                    letterSpacing: 4,
                    shadows: [
                      Shadow(
                          color: _theme.accent.withOpacity(0.9),
                          blurRadius: 12),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 40),

              // ── Reward amount ─────────────────────────────────────────────
              ShaderMask(
                shaderCallback: (r) => LinearGradient(
                  colors: [_theme.accent, Colors.white, _theme.accent],
                  stops: const [0.0, 0.5, 1.0],
                ).createShader(r),
                child: Text(
                  '+$_reward',
                  style: const TextStyle(
                    color: Colors.white,
                    fontSize: 92,
                    fontWeight: FontWeight.w900,
                    height: 1.0,
                  ),
                ),
              ),
              const SizedBox(height: 4),
              Text(
                'XU',
                style: TextStyle(
                  color: _theme.accent,
                  fontSize: 22,
                  fontWeight: FontWeight.w900,
                  letterSpacing: 10,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildCloseBtn() {
    return Positioned(
      bottom: 52,
      left: 36,
      right: 36,
      child: AnimatedBuilder(
        animation: _btnFadeAnim,
        builder: (_, __) => Opacity(
          opacity: _btnFadeAnim.value,
          child: FilledButton(
            onPressed:
                _btnFadeAnim.value > 0.5 ? () => Navigator.pop(context) : null,
            style: FilledButton.styleFrom(
              backgroundColor: _theme.accent,
              foregroundColor: Colors.black87,
              padding: const EdgeInsets.symmetric(vertical: 16),
              shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(32)),
              textStyle: const TextStyle(
                  fontSize: 16,
                  fontWeight: FontWeight.w900,
                  letterSpacing: 0.5),
            ),
            child: const Text('Tuyệt vời! 🎉'),
          ),
        ),
      ),
    );
  }

  // ── Particles ─────────────────────────────────────────────────────────────────

  Widget _buildParticles() {
    return LayoutBuilder(builder: (_, c) {
      final w = c.maxWidth;
      final h = c.maxHeight;
      return AnimatedBuilder(
        animation: _particleCtrl,
        builder: (_, __) => Stack(
          children: _particles
              .map((p) => _buildParticle(p, w, h))
              .toList(),
        ),
      );
    });
  }

  Widget _buildParticle(_Particle p, double w, double h) {
    final rawT = (_particleCtrl.value - p.delay) / p.speed;
    if (rawT <= 0 || rawT > 1) return const SizedBox.shrink();

    final t = Curves.decelerate.transform(rawT.clamp(0.0, 1.0));
    final cx = w / 2;
    final cy = h * 0.44;

    final x = cx + cos(p.angle) * t * w * 0.50 + p.drift * t * 40;
    final y = cy + sin(p.angle) * t * h * 0.30 + t * t * h * 0.14;
    final opacity = (1.0 - t * 0.88).clamp(0.0, 1.0);

    final emoji = switch (p.variant) {
      0 => '🪙',
      1 => _tier == 'jackpot' ? '⭐' : '✨',
      2 => '💫',
      _ => _tier == 'gold' || _tier == 'jackpot' ? '🌟' : '🎊',
    };

    return Positioned(
      left: x - p.size / 2,
      top: y,
      child: Opacity(
        opacity: opacity,
        child: Transform.rotate(
          angle: t * 2.6 * (p.angle > pi ? 1.0 : -1.0),
          child: Text(emoji, style: TextStyle(fontSize: p.size)),
        ),
      ),
    );
  }
}

// ── Supporting types ───────────────────────────────────────────────────────────

class _Particle {
  final double angle;
  final double speed;
  final double size;
  final double delay;
  final int variant;
  final double drift;

  const _Particle({
    required this.angle,
    required this.speed,
    required this.size,
    required this.delay,
    required this.variant,
    required this.drift,
  });
}

class _TierTheme {
  final String label;
  final String emoji;
  final Color accent;
  final List<Color> gradientColors;

  const _TierTheme({
    required this.label,
    required this.emoji,
    required this.accent,
    required this.gradientColors,
  });

  static _TierTheme of(String tier) {
    switch (tier) {
      case 'bronze':
        return const _TierTheme(
          label: 'ĐỒNG',
          emoji: '🥉',
          accent: Color(0xFFCD7F32),
          gradientColors: [Color(0xFF5C2A00), Color(0xFF3D1C00)],
        );
      case 'silver':
        return const _TierTheme(
          label: 'BẠC',
          emoji: '🥈',
          accent: Color(0xFFB8C8D8),
          gradientColors: [Color(0xFF1A2A3A), Color(0xFF0F1820)],
        );
      case 'gold':
        return const _TierTheme(
          label: 'VÀNG',
          emoji: '🥇',
          accent: Color(0xFFFFD700),
          gradientColors: [Color(0xFF4A3200), Color(0xFF2A1A00)],
        );
      case 'jackpot':
        return const _TierTheme(
          label: 'JACKPOT',
          emoji: '💎',
          accent: Color(0xFFCC44FF),
          gradientColors: [Color(0xFF3D0070), Color(0xFF1E003A)],
        );
      default:
        return const _TierTheme(
          label: '?',
          emoji: '🎁',
          accent: Color(0xFF9C27B0),
          gradientColors: [Color(0xFF1A0028), Color(0xFF0F0015)],
        );
    }
  }
}
