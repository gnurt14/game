// gacha_dialog.dart — Fullscreen gacha reveal cho Hộp may mắn

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
      transitionDuration: const Duration(milliseconds: 280),
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

  late final AnimationController _floatCtrl;
  late final AnimationController _pulseCtrl;
  late final AnimationController _shakeCtrl;
  late final AnimationController _flashCtrl;
  late final AnimationController _revealCtrl;
  late final AnimationController _particleCtrl;

  late final Animation<double> _floatAnim;
  late final Animation<double> _pulseAnim;
  late final Animation<double> _shakeAnim;
  late final Animation<double> _flashAnim;
  late final Animation<double> _revealScaleAnim;
  late final Animation<double> _revealFadeAnim;
  late final Animation<double> _btnFadeAnim;

  final List<_Particle> _particles = [];
  final Random _rng = Random();

  @override
  void initState() {
    super.initState();
    _initControllers();
    _initParticles();
  }

  void _initControllers() {
    _floatCtrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1600),
    )..repeat(reverse: true);

    _pulseCtrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1000),
    )..repeat(reverse: true);

    _shakeCtrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 650),
    );

    _flashCtrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 500),
    );

    _revealCtrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 700),
    );

    _particleCtrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 2200),
    );

    _floatAnim = Tween<double>(begin: -10.0, end: 10.0).animate(
      CurvedAnimation(parent: _floatCtrl, curve: Curves.easeInOut),
    );

    _pulseAnim = Tween<double>(begin: 0.35, end: 1.0).animate(
      CurvedAnimation(parent: _pulseCtrl, curve: Curves.easeInOut),
    );

    _shakeAnim = TweenSequence<double>([
      TweenSequenceItem(tween: Tween(begin: 0.0, end: 18.0), weight: 1),
      TweenSequenceItem(tween: Tween(begin: 18.0, end: -18.0), weight: 2),
      TweenSequenceItem(tween: Tween(begin: -18.0, end: 18.0), weight: 2),
      TweenSequenceItem(tween: Tween(begin: 18.0, end: -18.0), weight: 2),
      TweenSequenceItem(tween: Tween(begin: -18.0, end: 18.0), weight: 2),
      TweenSequenceItem(tween: Tween(begin: 18.0, end: 0.0), weight: 1),
    ]).animate(CurvedAnimation(parent: _shakeCtrl, curve: Curves.linear));

    _flashAnim = TweenSequence<double>([
      TweenSequenceItem(tween: Tween(begin: 0.0, end: 1.0), weight: 35),
      TweenSequenceItem(tween: Tween(begin: 1.0, end: 0.0), weight: 65),
    ]).animate(_flashCtrl);

    _revealScaleAnim = TweenSequence<double>([
      TweenSequenceItem(
        tween: Tween<double>(begin: 0.0, end: 1.12)
            .chain(CurveTween(curve: Curves.easeOut)),
        weight: 70,
      ),
      TweenSequenceItem(
        tween: Tween<double>(begin: 1.12, end: 1.0)
            .chain(CurveTween(curve: Curves.easeIn)),
        weight: 30,
      ),
    ]).animate(_revealCtrl);

    _revealFadeAnim = Tween<double>(begin: 0.0, end: 1.0).animate(
      CurvedAnimation(
        parent: _revealCtrl,
        curve: const Interval(0.0, 0.45, curve: Curves.easeIn),
      ),
    );

    _btnFadeAnim = Tween<double>(begin: 0.0, end: 1.0).animate(
      CurvedAnimation(
        parent: _revealCtrl,
        curve: const Interval(0.78, 1.0, curve: Curves.easeIn),
      ),
    );
  }

  void _initParticles() {
    for (int i = 0; i < 24; i++) {
      _particles.add(_Particle(
        x: _rng.nextDouble() * 2 - 1,
        startYFactor: 0.42 + _rng.nextDouble() * 0.18,
        speedFactor: 0.30 + _rng.nextDouble() * 0.50,
        size: 12.0 + _rng.nextDouble() * 12.0,
        delay: _rng.nextDouble() * 0.30,
        variant: _rng.nextInt(3),
      ));
    }
  }

  @override
  void dispose() {
    _floatCtrl.dispose();
    _pulseCtrl.dispose();
    _shakeCtrl.dispose();
    _flashCtrl.dispose();
    _revealCtrl.dispose();
    _particleCtrl.dispose();
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
    _floatCtrl.stop();
    _pulseCtrl.stop();

    await _shakeCtrl.forward();
    if (!mounted) return;

    _flashCtrl.forward();
    await Future.delayed(const Duration(milliseconds: 175));
    if (!mounted) return;

    setState(() => _phase = _Phase.reveal);
    _particleCtrl.forward();
    _revealCtrl.forward();
  }

  _TierTheme get _theme => _TierTheme.of(_tier);

  @override
  Widget build(BuildContext context) {
    return Material(
      color: const Color(0xF00A0A1A),
      child: Stack(
        children: [
          if (_phase == _Phase.reveal) _buildGlow(),
          _buildFlashOverlay(),
          if (_phase == _Phase.reveal) _buildParticles(),
          Center(
            child: _phase == _Phase.reveal ? _buildReveal() : _buildBox(),
          ),
          if (_phase == _Phase.reveal) _buildCloseBtn(),
        ],
      ),
    );
  }

  // ── Glow background ──────────────────────────────────────────────────────────

  Widget _buildGlow() {
    return AnimatedBuilder(
      animation: _revealCtrl,
      builder: (_, __) => Container(
        decoration: BoxDecoration(
          gradient: RadialGradient(
            colors: [
              _theme.accent.withOpacity(0.22 * _revealCtrl.value),
              Colors.transparent,
            ],
            radius: 1.2,
          ),
        ),
      ),
    );
  }

  // ── Flash overlay ─────────────────────────────────────────────────────────────

  Widget _buildFlashOverlay() {
    return AnimatedBuilder(
      animation: _flashAnim,
      builder: (_, __) => IgnorePointer(
        child: Opacity(
          opacity: _flashAnim.value,
          child: const ColoredBox(
            color: Colors.white,
            child: SizedBox.expand(),
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
          builder: (_, child) {
            final isOpening = _phase == _Phase.opening;
            return Transform.translate(
              offset: Offset(
                isOpening ? _shakeAnim.value : 0,
                isOpening ? 0 : _floatAnim.value,
              ),
              child: child,
            );
          },
          child: _buildBoxVisual(),
        ),
        const SizedBox(height: 44),
        if (_phase == _Phase.idle) _buildOpenButton(),
      ],
    );
  }

  Widget _buildBoxVisual() {
    return AnimatedBuilder(
      animation: _pulseAnim,
      builder: (_, child) => Container(
        width: 172,
        height: 172,
        decoration: BoxDecoration(
          gradient: const RadialGradient(
            colors: [Color(0xFF4A1880), Color(0xFF1A0840)],
            radius: 0.85,
          ),
          borderRadius: BorderRadius.circular(28),
          border: Border.all(color: const Color(0xFF9C27B0), width: 2.0),
          boxShadow: [
            BoxShadow(
              color: const Color(0xFF9C27B0)
                  .withOpacity(_pulseAnim.value * 0.75),
              blurRadius: 24 + 24 * _pulseAnim.value,
              spreadRadius: 2 + 6 * _pulseAnim.value,
            ),
          ],
        ),
        child: child,
      ),
      child: const Center(
        child: Text('🎁', style: TextStyle(fontSize: 84)),
      ),
    );
  }

  Widget _buildOpenButton() {
    if (_tapping) {
      return const SizedBox(
        width: 28,
        height: 28,
        child: CircularProgressIndicator(
          strokeWidth: 2.5,
          color: Color(0xFF9C27B0),
        ),
      );
    }
    return Column(
      children: [
        FilledButton(
          onPressed: _open,
          style: FilledButton.styleFrom(
            backgroundColor: const Color(0xFF9C27B0),
            padding:
                const EdgeInsets.symmetric(horizontal: 48, vertical: 15),
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(32),
            ),
            textStyle: const TextStyle(
              fontSize: 17,
              fontWeight: FontWeight.w900,
              letterSpacing: 1.5,
            ),
          ),
          child: Text(widget.isFree ? '🎁  MỞ HỘP MIỄN PHÍ' : '✨  MỞ HỘP'),
        ),
        const SizedBox(height: 12),
        Text(
          widget.isFree ? 'Quà tặng chào mừng — hoàn toàn miễn phí!' : 'Chi phí: 100 xu',
          style: const TextStyle(color: Color(0xFF666688), fontSize: 13),
        ),
      ],
    );
  }

  // ── Reveal ────────────────────────────────────────────────────────────────────

  Widget _buildReveal() {
    return AnimatedBuilder(
      animation: Listenable.merge([_revealScaleAnim, _revealFadeAnim]),
      builder: (_, __) => Opacity(
        opacity: _revealFadeAnim.value,
        child: Transform.scale(
          scale: _revealScaleAnim.value,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              // Tier badge
              Container(
                padding: const EdgeInsets.symmetric(
                  horizontal: 30,
                  vertical: 11,
                ),
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
                      color: _theme.accent.withOpacity(0.65),
                      blurRadius: 22,
                      spreadRadius: 4,
                    ),
                  ],
                ),
                child: Text(
                  '${_theme.emoji}   ${_theme.label}',
                  style: TextStyle(
                    color: _theme.accent,
                    fontSize: 21,
                    fontWeight: FontWeight.w900,
                    letterSpacing: 3,
                    shadows: [
                      Shadow(
                        color: _theme.accent.withOpacity(0.9),
                        blurRadius: 14,
                      ),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 38),
              // Amount with shimmer gradient
              ShaderMask(
                shaderCallback: (r) => LinearGradient(
                  colors: [_theme.accent, Colors.white, _theme.accent],
                  stops: const [0.0, 0.5, 1.0],
                ).createShader(r),
                child: Text(
                  '+$_reward',
                  style: const TextStyle(
                    color: Colors.white,
                    fontSize: 82,
                    fontWeight: FontWeight.w900,
                    height: 1.0,
                  ),
                ),
              ),
              const SizedBox(height: 6),
              Text(
                'XU',
                style: TextStyle(
                  color: _theme.accent,
                  fontSize: 24,
                  fontWeight: FontWeight.w900,
                  letterSpacing: 9,
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
      bottom: 56,
      left: 40,
      right: 40,
      child: AnimatedBuilder(
        animation: _btnFadeAnim,
        builder: (_, __) => Opacity(
          opacity: _btnFadeAnim.value,
          child: FilledButton(
            onPressed: _btnFadeAnim.value > 0.5
                ? () => Navigator.pop(context)
                : null,
            style: FilledButton.styleFrom(
              backgroundColor: _theme.accent,
              foregroundColor: Colors.black87,
              padding: const EdgeInsets.symmetric(vertical: 16),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(32),
              ),
              textStyle: const TextStyle(
                fontSize: 16,
                fontWeight: FontWeight.w900,
                letterSpacing: 0.5,
              ),
            ),
            child: const Text('Tuyệt vời! 🎉'),
          ),
        ),
      ),
    );
  }

  // ── Particles ─────────────────────────────────────────────────────────────────

  Widget _buildParticles() {
    return LayoutBuilder(
      builder: (_, constraints) {
        final w = constraints.maxWidth;
        final h = constraints.maxHeight;
        return AnimatedBuilder(
          animation: _particleCtrl,
          builder: (_, __) => Stack(
            children: _particles
                .map((p) => _buildParticleWidget(p, w, h))
                .toList(),
          ),
        );
      },
    );
  }

  Widget _buildParticleWidget(_Particle p, double w, double h) {
    final rawT = (_particleCtrl.value - p.delay) / p.speedFactor;
    if (rawT <= 0 || rawT > 1) return const SizedBox.shrink();

    final x = w / 2 + p.x * w * 0.44;
    final y = h * p.startYFactor - rawT * h * 0.42;
    final opacity = (1.0 - rawT * 0.85).clamp(0.0, 1.0);

    final String emoji;
    if (p.variant == 0) {
      emoji = '🪙';
    } else if (p.variant == 1) {
      emoji = _tier == 'jackpot' ? '⭐' : '✨';
    } else {
      emoji = '💫';
    }

    return Positioned(
      left: x - p.size / 2,
      top: y,
      child: Opacity(
        opacity: opacity,
        child: Text(emoji, style: TextStyle(fontSize: p.size)),
      ),
    );
  }
}

// ── Supporting types ───────────────────────────────────────────────────────────

class _Particle {
  final double x;
  final double startYFactor;
  final double speedFactor;
  final double size;
  final double delay;
  final int variant;

  const _Particle({
    required this.x,
    required this.startYFactor,
    required this.speedFactor,
    required this.size,
    required this.delay,
    required this.variant,
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
    if (tier == 'bronze') {
      return const _TierTheme(
        label: 'ĐỒNG',
        emoji: '🥉',
        accent: Color(0xFFCD7F32),
        gradientColors: [Color(0xFF5C2A00), Color(0xFF3D1C00)],
      );
    }
    if (tier == 'silver') {
      return const _TierTheme(
        label: 'BẠC',
        emoji: '🥈',
        accent: Color(0xFFB8C8D8),
        gradientColors: [Color(0xFF1A2A3A), Color(0xFF0F1820)],
      );
    }
    if (tier == 'gold') {
      return const _TierTheme(
        label: 'VÀNG',
        emoji: '🥇',
        accent: Color(0xFFFFD700),
        gradientColors: [Color(0xFF4A3200), Color(0xFF2A1A00)],
      );
    }
    if (tier == 'jackpot') {
      return const _TierTheme(
        label: 'JACKPOT',
        emoji: '💎',
        accent: Color(0xFFCC44FF),
        gradientColors: [Color(0xFF3D0070), Color(0xFF1E003A)],
      );
    }
    return const _TierTheme(
      label: '?',
      emoji: '🎁',
      accent: Color(0xFF9C27B0),
      gradientColors: [Color(0xFF1A0028), Color(0xFF0F0015)],
    );
  }
}
