import 'dart:math';
import 'package:flutter/material.dart';
import '../coin/coin_service.dart';

class RandomGiftScreen extends StatefulWidget {
  const RandomGiftScreen({super.key});

  @override
  State<RandomGiftScreen> createState() => _RandomGiftScreenState();
}

enum _GiftPhase { idle, opening, revealed }

class _RandomGiftScreenState extends State<RandomGiftScreen>
    with TickerProviderStateMixin {
  _GiftPhase _phase = _GiftPhase.idle;
  late final AnimationController _shakeController;
  late final AnimationController _scaleController;
  late final AnimationController _beamController;

  final Random _random = Random();
  int _rewardCoins = 0;
  int _rewardBoosterHours = 0;
  bool _isBooster = false;

  @override
  void initState() {
    super.initState();
    _shakeController = AnimationController(
      duration: const Duration(milliseconds: 100),
      vsync: this,
    );

    _scaleController = AnimationController(
      duration: const Duration(milliseconds: 500),
      vsync: this,
    );

    _beamController = AnimationController(
      duration: const Duration(seconds: 4),
      vsync: this,
    )..repeat();
  }

  @override
  void dispose() {
    _shakeController.dispose();
    _scaleController.dispose();
    _beamController.dispose();
    super.dispose();
  }

  void _openGift() async {
    if (_phase != _GiftPhase.idle) return;

    setState(() {
      _phase = _GiftPhase.opening;
    });

    // Shaking loop
    for (int i = 0; i < 8; i++) {
      await _shakeController.forward();
      await _shakeController.reverse();
    }

    // Determine reward
    // 75% coins, 25% booster (đã giảm trị số thưởng để tránh lạm phát xu)
    final roll = _random.nextInt(100);
    if (roll < 75) {
      _isBooster = false;
      _rewardCoins = 50 + _random.nextInt(101); // 50 - 150 coins
      await CoinService.instance.earnCoins(_rewardCoins);
    } else {
      _isBooster = true;
      _rewardBoosterHours = 1 + _random.nextInt(3); // 1 - 3 hours
      await CoinService.instance.activateFreeBooster(_rewardBoosterHours);
    }

    setState(() {
      _phase = _GiftPhase.revealed;
    });

    _scaleController.forward();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF070714),
      body: Stack(
        children: [
          // Background star-field like dots (Custom design)
          Positioned.fill(
            child: CustomPaint(
              painter: _StarFieldPainter(),
            ),
          ),
          
          SafeArea(
            child: Center(
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 24),
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    if (_phase == _GiftPhase.idle) ...[
                      const Text(
                        'HỘP QUÀ BÍ ẨN 🎁',
                        style: TextStyle(
                          color: Colors.white,
                          fontSize: 26,
                          fontWeight: FontWeight.w900,
                          letterSpacing: 2,
                        ),
                      ),
                      const SizedBox(height: 8),
                      const Text(
                        'Nhấn vào hộp quà bên dưới để mở phần thưởng đặc biệt!',
                        textAlign: TextAlign.center,
                        style: TextStyle(
                          color: Color(0xFF8888AA),
                          fontSize: 14,
                        ),
                      ),
                    ] else if (_phase == _GiftPhase.opening) ...[
                      const Text(
                        'ĐANG MỞ HỘP...',
                        style: TextStyle(
                          color: Color(0xFF7C6FFF),
                          fontSize: 22,
                          fontWeight: FontWeight.w900,
                          letterSpacing: 3,
                        ),
                      ),
                      const SizedBox(height: 8),
                      const Text(
                        'Phần thưởng đang chuẩn bị xuất hiện...',
                        textAlign: TextAlign.center,
                        style: TextStyle(
                          color: Color(0xFF7777AA),
                          fontSize: 14,
                        ),
                      ),
                    ] else ...[
                      const Text(
                        'CHÚC MỪNG 🎉',
                        style: TextStyle(
                          color: Color(0xFFFFD700),
                          fontSize: 28,
                          fontWeight: FontWeight.w900,
                          letterSpacing: 2,
                        ),
                      ),
                      const SizedBox(height: 8),
                      const Text(
                        'Bạn đã mở thành công phần quà đặc biệt từ hệ thống!',
                        textAlign: TextAlign.center,
                        style: TextStyle(
                          color: Color(0xFFD0D0F0),
                          fontSize: 14,
                        ),
                      ),
                    ],
                    const SizedBox(height: 60),

                    // Gift box / Reward area
                    Expanded(
                      child: Center(
                        child: _buildMainStage(),
                      ),
                    ),

                    const SizedBox(height: 40),

                    if (_phase == _GiftPhase.revealed)
                      ScaleTransition(
                        scale: CurvedAnimation(
                          parent: _scaleController,
                          curve: Curves.elasticOut,
                        ),
                        child: Container(
                          width: double.infinity,
                          height: 52,
                          decoration: BoxDecoration(
                            gradient: const LinearGradient(
                              colors: [Color(0xFF7C6FFF), Color(0xFFB06FFF)],
                              begin: Alignment.topLeft,
                              end: Alignment.bottomRight,
                            ),
                            borderRadius: BorderRadius.circular(26),
                            boxShadow: [
                              BoxShadow(
                                color: const Color(0xFF7C6FFF).withOpacity(0.4),
                                blurRadius: 16,
                                offset: const Offset(0, 4),
                              ),
                            ],
                          ),
                          child: ElevatedButton(
                            onPressed: () {
                              Navigator.pop(context);
                            },
                            style: ElevatedButton.styleFrom(
                              backgroundColor: Colors.transparent,
                              shadowColor: Colors.transparent,
                              shape: RoundedRectangleBorder(
                                borderRadius: BorderRadius.circular(26),
                              ),
                            ),
                            child: const Text(
                              'Trở Về Trang Chủ',
                              style: TextStyle(
                                color: Colors.white,
                                fontSize: 16,
                                fontWeight: FontWeight.bold,
                              ),
                            ),
                          ),
                        ),
                      ),
                    const SizedBox(height: 24),
                  ],
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildMainStage() {
    switch (_phase) {
      case _GiftPhase.idle:
        return GestureDetector(
          onTap: _openGift,
          child: MouseRegion(
            cursor: SystemMouseCursors.click,
            child: AnimatedBuilder(
              animation: _beamController,
              builder: (context, child) {
                return Stack(
                  alignment: Alignment.center,
                  children: [
                    // Glow background
                    Container(
                      width: 180,
                      height: 180,
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        color: const Color(0xFF7C6FFF).withOpacity(0.08 + 0.04 * sin(_beamController.value * 2 * pi)),
                      ),
                    ),
                    // Gift box structure
                    Container(
                      width: 140,
                      height: 140,
                      decoration: BoxDecoration(
                        gradient: const LinearGradient(
                          colors: [Color(0xFFE53935), Color(0xFFB71C1C)],
                          begin: Alignment.topLeft,
                          end: Alignment.bottomRight,
                        ),
                        borderRadius: BorderRadius.circular(24),
                        border: Border.all(
                          color: const Color(0xFFFF8A80),
                          width: 2,
                        ),
                        boxShadow: [
                          BoxShadow(
                            color: Colors.redAccent.withOpacity(0.3),
                            blurRadius: 20,
                            offset: const Offset(0, 8),
                          ),
                        ],
                      ),
                      child: Stack(
                        alignment: Alignment.center,
                        children: [
                          // Gold ribbon vertical
                          Container(
                            width: 24,
                            height: double.infinity,
                            color: const Color(0xFFFFD700),
                          ),
                          // Gold ribbon horizontal
                          Container(
                            width: double.infinity,
                            height: 24,
                            color: const Color(0xFFFFD700),
                          ),
                          // Gift Icon
                          const Icon(
                            Icons.card_giftcard_rounded,
                            color: Colors.white,
                            size: 60,
                          ),
                        ],
                      ),
                    ),
                  ],
                );
              },
            ),
          ),
        );

      case _GiftPhase.opening:
        return AnimatedBuilder(
          animation: _shakeController,
          builder: (context, child) {
            double angle = sin(_shakeController.value * 2 * pi) * 0.15;
            return Transform.rotate(
              angle: angle,
              child: Container(
                width: 140,
                height: 140,
                decoration: BoxDecoration(
                  gradient: const LinearGradient(
                    colors: [Color(0xFFE53935), Color(0xFFB71C1C)],
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                  ),
                  borderRadius: BorderRadius.circular(24),
                  border: Border.all(
                    color: const Color(0xFFFF8A80),
                    width: 2,
                  ),
                ),
                child: Stack(
                  alignment: Alignment.center,
                  children: [
                    Container(width: 24, height: double.infinity, color: const Color(0xFFFFD700)),
                    Container(width: double.infinity, height: 24, color: const Color(0xFFFFD700)),
                    const Icon(Icons.card_giftcard_rounded, color: Colors.white, size: 60),
                  ],
                ),
              ),
            );
          },
        );

      case _GiftPhase.revealed:
        return ScaleTransition(
          scale: CurvedAnimation(
            parent: _scaleController,
            curve: Curves.elasticOut,
          ),
          child: AnimatedBuilder(
            animation: _beamController,
            builder: (context, child) {
              return Stack(
                alignment: Alignment.center,
                children: [
                  // Rotating ray beams
                  Transform.rotate(
                    angle: _beamController.value * 2 * pi,
                    child: SizedBox(
                      width: 300,
                      height: 300,
                      child: CustomPaint(
                        painter: _RayPainter(
                          color: _isBooster ? const Color(0xFFFF6B00) : const Color(0xFFFFD700),
                        ),
                      ),
                    ),
                  ),

                  // Reward Card
                  Container(
                    width: 220,
                    height: 220,
                    decoration: BoxDecoration(
                      color: const Color(0xFF14142F),
                      borderRadius: BorderRadius.circular(32),
                      border: Border.all(
                        color: _isBooster ? const Color(0xFFFF6B00) : const Color(0xFFFFD700),
                        width: 2.5,
                      ),
                      boxShadow: [
                        BoxShadow(
                          color: (_isBooster ? const Color(0xFFFF6B00) : const Color(0xFFFFD700)).withOpacity(0.35),
                          blurRadius: 30,
                        ),
                      ],
                    ),
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        if (!_isBooster) ...[
                          const Text(
                            '🪙',
                            style: TextStyle(fontSize: 64),
                          ),
                          const SizedBox(height: 12),
                          const Text(
                            'NHẬN XU',
                            style: TextStyle(
                              color: Color(0xFF8888AA),
                              fontSize: 12,
                              fontWeight: FontWeight.bold,
                              letterSpacing: 2,
                            ),
                          ),
                          const SizedBox(height: 4),
                          Text(
                            '+$_rewardCoins xu',
                            style: const TextStyle(
                              color: Color(0xFFFFD700),
                              fontSize: 28,
                              fontWeight: FontWeight.w900,
                            ),
                          ),
                        ] else ...[
                          const Text(
                            '⚡',
                            style: TextStyle(fontSize: 64),
                          ),
                          const SizedBox(height: 12),
                          const Text(
                            'BOOSTER X2 COIN',
                            style: TextStyle(
                              color: Color(0xFF8888AA),
                              fontSize: 12,
                              fontWeight: FontWeight.bold,
                              letterSpacing: 2,
                            ),
                          ),
                          const SizedBox(height: 4),
                          Text(
                            '+$_rewardBoosterHours Giờ',
                            style: const TextStyle(
                              color: Color(0xFFFF6B00),
                              fontSize: 28,
                              fontWeight: FontWeight.w900,
                            ),
                          ),
                        ],
                      ],
                    ),
                  ),
                ],
              );
            },
          ),
        );
    }
  }
}

class _StarFieldPainter extends CustomPainter {
  final Random _random = Random(42); // Seed to keep stars consistent

  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()..color = const Color(0xFF7C6FFF).withOpacity(0.25);
    for (int i = 0; i < 40; i++) {
      final x = _random.nextDouble() * size.width;
      final y = _random.nextDouble() * size.height;
      final radius = 1.0 + _random.nextDouble() * 2.0;
      canvas.drawCircle(Offset(x, y), radius, paint);
    }
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}

class _RayPainter extends CustomPainter {
  final Color color;

  _RayPainter({required this.color});

  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = color.withOpacity(0.15)
      ..style = PaintingStyle.fill;

    final center = Offset(size.width / 2, size.height / 2);
    final radius = size.width / 2;

    const rayCount = 12;
    const rayWidthAngle = pi / 16; // Width of each beam

    for (int i = 0; i < rayCount; i++) {
      final baseAngle = i * (2 * pi / rayCount);
      final path = Path()
        ..moveTo(center.dx, center.dy)
        ..lineTo(
          center.dx + radius * cos(baseAngle - rayWidthAngle),
          center.dy + radius * sin(baseAngle - rayWidthAngle),
        )
        ..lineTo(
          center.dx + radius * cos(baseAngle + rayWidthAngle),
          center.dy + radius * sin(baseAngle + rayWidthAngle),
        )
        ..close();
      canvas.drawPath(path, paint);
    }
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}
