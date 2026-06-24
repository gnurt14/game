import 'dart:math';
import 'package:flutter/material.dart';
import '../coin/coin_service.dart';

// ── Segment data ───────────────────────────────────────────────────────────────

class _Segment {
  final String label;       // Two-line display label
  final String icon;        // Emoji icon
  final Color color;        // Sector fill color
  final String rewardType;  // 'coin' | 'shield' | 'box' | 'booster' | 'jackpot'
  final int coinValue;      // Xu shown in reward dialog (0 for non-coin)

  const _Segment({
    required this.label,
    required this.icon,
    required this.color,
    required this.rewardType,
    required this.coinValue,
  });
}

// Must match CoinService.spinLuckyWheel() segment indices 0-7
const List<_Segment> _kSegments = [
  _Segment(label: '20 Xu',      icon: '🪙', color: Color(0xFF3949AB), rewardType: 'coin',    coinValue: 20),
  _Segment(label: '40 Xu',      icon: '🪙', color: Color(0xFF00838F), rewardType: 'coin',    coinValue: 40),
  _Segment(label: '80 Xu',      icon: '🪙', color: Color(0xFF2E7D32), rewardType: 'coin',    coinValue: 80),
  _Segment(label: '1 Lá\nChắn', icon: '🛡️', color: Color(0xFF00695C), rewardType: 'shield',  coinValue: 0),
  _Segment(label: 'Hộp\nMay Mắn',icon:'🎁', color: Color(0xFF6A1B9A), rewardType: 'box',     coinValue: 0),
  _Segment(label: 'Boost\n2h',  icon: '⚡', color: Color(0xFFE65100), rewardType: 'booster', coinValue: 0),
  _Segment(label: '150 Xu',     icon: '🪙', color: Color(0xFFC62828), rewardType: 'coin',    coinValue: 150),
  _Segment(label: 'Jackpot\n300',icon:'🌟', color: Color(0xFFF9A825), rewardType: 'jackpot', coinValue: 300),
];

// ── Dialog ─────────────────────────────────────────────────────────────────────

class LuckyWheelDialog extends StatefulWidget {
  const LuckyWheelDialog({super.key});

  static Future<void> show(BuildContext context) {
    return showGeneralDialog<void>(
      context: context,
      barrierDismissible: true,
      barrierLabel: '',
      barrierColor: Colors.black.withOpacity(0.85),
      pageBuilder: (_, __, ___) => const LuckyWheelDialog(),
      transitionDuration: const Duration(milliseconds: 300),
      transitionBuilder: (_, anim, __, child) => FadeTransition(
        opacity: CurvedAnimation(parent: anim, curve: Curves.easeOut),
        child: ScaleTransition(
          scale: CurvedAnimation(parent: anim, curve: Curves.easeOutBack),
          child: child,
        ),
      ),
    );
  }

  @override
  State<LuckyWheelDialog> createState() => _LuckyWheelDialogState();
}

class _LuckyWheelDialogState extends State<LuckyWheelDialog>
    with TickerProviderStateMixin {
  late final AnimationController _spinController;
  late final AnimationController _rimGlowCtrl;
  late Animation<double> _spinAnim;
  late final Animation<double> _rimGlowAnim;

  CoinData _coinData = CoinService.instance.notifier.value;
  bool _isSpinning = false;
  double _currentRotation = 0.0;

  @override
  void initState() {
    super.initState();
    _spinController = AnimationController(
      duration: const Duration(seconds: 5),
      vsync: this,
    );
    _rimGlowCtrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1000),
    )..repeat(reverse: true);

    _spinAnim =
        CurvedAnimation(parent: _spinController, curve: Curves.easeOutCubic);
    _rimGlowAnim = Tween<double>(begin: 0.3, end: 0.8).animate(
      CurvedAnimation(parent: _rimGlowCtrl, curve: Curves.easeInOut),
    );

    CoinService.instance.notifier.addListener(_onCoinUpdate);
  }

  @override
  void dispose() {
    CoinService.instance.notifier.removeListener(_onCoinUpdate);
    _spinController.dispose();
    _rimGlowCtrl.dispose();
    super.dispose();
  }

  void _onCoinUpdate() {
    if (mounted) {
      setState(() => _coinData = CoinService.instance.notifier.value);
    }
  }

  String _todayStr() {
    final now = DateTime.now().toLocal();
    return '${now.year}-${now.month.toString().padLeft(2, '0')}-${now.day.toString().padLeft(2, '0')}';
  }

  void _spin() async {
    if (_isSpinning) return;

    final isFree = _coinData.lastWheelSpinDate != _todayStr();
    if (!isFree && _coinData.balance < 30) {
      _showSnack('Không đủ xu để quay!', isError: true);
      return;
    }

    setState(() => _isSpinning = true);

    try {
      final result = await CoinService.instance.spinLuckyWheel(isFree: isFree);
      final int coins = result.$1;
      final int targetIndex = result.$2;

      // Calculate final wheel angle so targetIndex lands under the pointer.
      // Segment i is centred at i * segAngle in local wheel coords.
      // Pointer is at -π/2. We need: wheelAngle + i * segAngle = -π/2 + 2πK
      // ⟹ wheelAngle = -π/2 - i * segAngle
      final double segAngle = 2 * pi / _kSegments.length;
      final double rawTarget = -pi / 2 - targetIndex * segAngle;
      // Normalise to [0, 2π)
      final double targetNorm = ((rawTarget % (2 * pi)) + 2 * pi) % (2 * pi);
      final double startNorm =
          ((_currentRotation % (2 * pi)) + 2 * pi) % (2 * pi);
      // How much to turn clockwise to reach target (always ≥ 0)
      double delta = (targetNorm - startNorm + 2 * pi) % (2 * pi);
      // Ensure at least a tiny spin even if already aligned
      if (delta < 0.05) delta += 2 * pi;
      final double finalAngle = _currentRotation + 5 * 2 * pi + delta;

      _spinAnim = Tween<double>(
        begin: _currentRotation,
        end: finalAngle,
      ).animate(
          CurvedAnimation(parent: _spinController, curve: Curves.easeOutCubic));

      _spinController.reset();
      await _spinController.forward();

      if (!mounted) return;
      setState(() {
        _currentRotation = finalAngle;
        _isSpinning = false;
      });

      _showRewardDialog(_kSegments[targetIndex], coins);
    } catch (e) {
      if (!mounted) return;
      setState(() => _isSpinning = false);
      _showSnack('Đã xảy ra lỗi khi quay!', isError: true);
    }
  }

  void _showRewardDialog(_Segment seg, int coins) {
    final bool isJackpot = seg.rewardType == 'jackpot';
    final Color accentColor = isJackpot
        ? const Color(0xFFFFD700)
        : seg.rewardType == 'booster'
            ? const Color(0xFFFF9800)
            : const Color(0xFF7C6FFF);

    showGeneralDialog<void>(
      context: context,
      barrierDismissible: false,
      barrierLabel: '',
      barrierColor: Colors.black.withOpacity(0.7),
      transitionDuration: const Duration(milliseconds: 280),
      transitionBuilder: (_, anim, __, child) => FadeTransition(
        opacity: CurvedAnimation(parent: anim, curve: Curves.easeOut),
        child: ScaleTransition(
          scale: CurvedAnimation(parent: anim, curve: Curves.easeOutBack),
          child: child,
        ),
      ),
      pageBuilder: (_, __, ___) => Center(
        child: Material(
          color: Colors.transparent,
          child: Container(
            width: 280,
            padding: const EdgeInsets.all(28),
            decoration: BoxDecoration(
              color: const Color(0xFF14142F),
              borderRadius: BorderRadius.circular(28),
              border: Border.all(color: accentColor, width: 2),
              boxShadow: [
                BoxShadow(
                  color: accentColor.withOpacity(0.35),
                  blurRadius: 30,
                ),
              ],
            ),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  isJackpot ? '🎉 JACKPOT 🎉' : 'PHẦN THƯỞNG',
                  style: TextStyle(
                    color: isJackpot ? const Color(0xFFFFD700) : Colors.white,
                    fontSize: 20,
                    fontWeight: FontWeight.w900,
                    letterSpacing: 1.5,
                  ),
                ),
                const SizedBox(height: 22),
                Container(
                  width: 88,
                  height: 88,
                  decoration: BoxDecoration(
                    color: accentColor.withOpacity(0.1),
                    shape: BoxShape.circle,
                    border: Border.all(color: accentColor.withOpacity(0.4)),
                    boxShadow: [
                      BoxShadow(
                        color: accentColor.withOpacity(0.2),
                        blurRadius: 16,
                      ),
                    ],
                  ),
                  child: Center(
                    child: Text(seg.icon, style: const TextStyle(fontSize: 46)),
                  ),
                ),
                const SizedBox(height: 18),
                Text(
                  _rewardTitle(seg, coins),
                  textAlign: TextAlign.center,
                  style: TextStyle(
                    color: accentColor,
                    fontSize: 22,
                    fontWeight: FontWeight.w900,
                    height: 1.3,
                  ),
                ),
                const SizedBox(height: 8),
                Text(
                  _rewardSubtitle(seg),
                  textAlign: TextAlign.center,
                  style: const TextStyle(
                      color: Color(0xFF8888AA), fontSize: 12, height: 1.4),
                ),
                const SizedBox(height: 26),
                SizedBox(
                  width: double.infinity,
                  height: 46,
                  child: FilledButton(
                    onPressed: () => Navigator.pop(context),
                    style: FilledButton.styleFrom(
                      backgroundColor: accentColor,
                      foregroundColor: isJackpot ? Colors.black87 : Colors.white,
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(23),
                      ),
                      textStyle: const TextStyle(
                        fontWeight: FontWeight.w900,
                        fontSize: 15,
                      ),
                    ),
                    child: const Text('Tuyệt Vời! 🎉'),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  String _rewardTitle(_Segment seg, int coins) {
    switch (seg.rewardType) {
      case 'shield':
        return '1 Lá Chắn Streak';
      case 'box':
        return 'Hộp May Mắn';
      case 'booster':
        return 'Booster x2 (2h)';
      default:
        return '+$coins Xu';
    }
  }

  String _rewardSubtitle(_Segment seg) {
    switch (seg.rewardType) {
      case 'shield':
        return 'Bảo vệ streak nếu bỏ lỡ 1 ngày.\nĐã cộng vào tài khoản của bạn.';
      case 'box':
        return 'Hộp may mắn đã được thêm vào.\nVào Cửa Hàng để mở hộp nhận xu!';
      case 'booster':
        return 'Xu kiếm được x2 trong 2 giờ tới.\nKích hoạt ngay lập tức!';
      default:
        return 'Xu đã được cộng vào số dư của bạn.';
    }
  }

  void _showSnack(String msg, {bool isError = false}) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(
          msg,
          style: TextStyle(
            color: isError ? Colors.redAccent : Colors.greenAccent,
            fontWeight: FontWeight.bold,
          ),
        ),
        backgroundColor: const Color(0xFF14142F),
        behavior: SnackBarBehavior.floating,
        duration: const Duration(seconds: 2),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final isFree = _coinData.lastWheelSpinDate != _todayStr();

    return Center(
      child: Material(
        color: Colors.transparent,
        child: Container(
          width: 340,
          padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 24),
          decoration: BoxDecoration(
            color: const Color(0xFF0F0F25),
            borderRadius: BorderRadius.circular(28),
            border: Border.all(
              color: const Color(0xFF7C6FFF).withOpacity(0.35),
              width: 1.5,
            ),
            boxShadow: [
              BoxShadow(
                color: const Color(0xFF7C6FFF).withOpacity(0.15),
                blurRadius: 30,
              ),
            ],
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              _buildHeader(),
              const Divider(color: Color(0xFF2E2E5D), height: 24),
              _buildBalanceRow(),
              const SizedBox(height: 20),
              _buildWheel(),
              const SizedBox(height: 12),
              _buildRewardLegend(),
              const SizedBox(height: 24),
              _buildSpinButton(isFree),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildHeader() {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        const Text(
          'VÒNG QUAY MAY MẮN 🎡',
          style: TextStyle(
            color: Colors.white,
            fontSize: 16,
            fontWeight: FontWeight.w900,
          ),
        ),
        IconButton(
          onPressed: _isSpinning ? null : () => Navigator.pop(context),
          icon: const Icon(Icons.close_rounded, color: Colors.white70),
          padding: EdgeInsets.zero,
          constraints: const BoxConstraints(),
        ),
      ],
    );
  }

  Widget _buildBalanceRow() {
    return Row(
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        const Text(
          '🪙 Số dư: ',
          style: TextStyle(color: Color(0xFF8888AA), fontSize: 13),
        ),
        Text(
          '${_coinData.balance} xu',
          style: const TextStyle(
            color: Color(0xFFFFD700),
            fontWeight: FontWeight.w900,
            fontSize: 14,
          ),
        ),
      ],
    );
  }

  Widget _buildWheel() {
    return Stack(
      alignment: Alignment.center,
      children: [
        // Outer glow rim
        AnimatedBuilder(
          animation: _rimGlowAnim,
          builder: (_, __) => Container(
            width: 262,
            height: 262,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              border: Border.all(
                color: const Color(0xFF7C6FFF)
                    .withOpacity(0.25 + 0.15 * _rimGlowAnim.value),
                width: 5,
              ),
              boxShadow: [
                BoxShadow(
                  color: const Color(0xFF7C6FFF)
                      .withOpacity(0.15 + 0.12 * _rimGlowAnim.value),
                  blurRadius: 18,
                ),
              ],
            ),
          ),
        ),

        // Spinning wheel
        AnimatedBuilder(
          animation: _spinAnim,
          builder: (_, __) => Transform.rotate(
            angle: _spinAnim.value,
            child: SizedBox(
              width: 246,
              height: 246,
              child: CustomPaint(
                painter: _WheelPainter(segments: _kSegments),
              ),
            ),
          ),
        ),

        // Pointer (▼ pointing down into wheel from top)
        Positioned(
          top: 0,
          child: Transform.rotate(
            angle: pi,
            child: const Icon(
              Icons.navigation_rounded,
              color: Colors.redAccent,
              size: 30,
            ),
          ),
        ),

        // Center spin button
        GestureDetector(
          onTap: _isSpinning ? null : _spin,
          child: AnimatedBuilder(
            animation: _rimGlowAnim,
            builder: (_, child) => Container(
              width: 62,
              height: 62,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: const Color(0xFF14142F),
                border: Border.all(color: const Color(0xFFFFD700), width: 2.5),
                boxShadow: [
                  BoxShadow(
                    color: const Color(0xFFFFD700)
                        .withOpacity(0.2 + 0.15 * _rimGlowAnim.value),
                    blurRadius: 12 + 6 * _rimGlowAnim.value,
                  ),
                ],
              ),
              child: child,
            ),
            child: Center(
              child: _isSpinning
                  ? const SizedBox(
                      width: 22,
                      height: 22,
                      child: CircularProgressIndicator(
                        strokeWidth: 2.5,
                        color: Color(0xFFFFD700),
                      ),
                    )
                  : const Text(
                      'SPIN',
                      style: TextStyle(
                        color: Color(0xFFFFD700),
                        fontSize: 13,
                        fontWeight: FontWeight.w900,
                      ),
                    ),
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildRewardLegend() {
    return Wrap(
      spacing: 8,
      runSpacing: 6,
      alignment: WrapAlignment.center,
      children: _kSegments.map((seg) {
        return Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 10,
              height: 10,
              decoration: BoxDecoration(
                color: seg.color,
                shape: BoxShape.circle,
              ),
            ),
            const SizedBox(width: 4),
            Text(
              '${seg.icon} ${seg.label.replaceAll('\n', ' ')}',
              style: const TextStyle(
                color: Color(0xFF8888AA),
                fontSize: 10,
              ),
            ),
          ],
        );
      }).toList(),
    );
  }

  Widget _buildSpinButton(bool isFree) {
    return SizedBox(
      width: double.infinity,
      height: 50,
      child: ElevatedButton(
        onPressed: _isSpinning ? null : _spin,
        style: ElevatedButton.styleFrom(
          backgroundColor: isFree
              ? const Color(0xFF2E7D32)
              : const Color(0xFF7C6FFF),
          disabledBackgroundColor: const Color(0xFF2E2E3A),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(25),
          ),
          elevation: 0,
        ),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(
              isFree ? Icons.card_giftcard_rounded : Icons.casino_rounded,
              color: Colors.white,
              size: 20,
            ),
            const SizedBox(width: 10),
            Text(
              isFree ? 'LƯỢT QUAY MIỄN PHÍ' : 'QUAY BẰNG 30 XU',
              style: const TextStyle(
                color: Colors.white,
                fontSize: 15,
                fontWeight: FontWeight.w900,
                letterSpacing: 0.5,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ── Wheel painter ──────────────────────────────────────────────────────────────

class _WheelPainter extends CustomPainter {
  final List<_Segment> segments;

  _WheelPainter({required this.segments});

  @override
  void paint(Canvas canvas, Size size) {
    final double radius = size.width / 2;
    final center = Offset(radius, radius);
    final int n = segments.length;
    final double segAngle = 2 * pi / n;
    final paint = Paint()..style = PaintingStyle.fill;

    for (int i = 0; i < n; i++) {
      // Sector
      paint.color = segments[i].color;
      final double startAngle = i * segAngle - segAngle / 2;
      canvas.drawArc(
        Rect.fromCircle(center: center, radius: radius),
        startAngle,
        segAngle,
        true,
        paint,
      );

      // Lighter inner arc for depth
      final innerPaint = Paint()
        ..style = PaintingStyle.fill
        ..color = Colors.white.withOpacity(0.06);
      canvas.drawArc(
        Rect.fromCircle(center: center, radius: radius * 0.6),
        startAngle,
        segAngle,
        true,
        innerPaint,
      );

      // Divider lines
      final linePaint = Paint()
        ..color = const Color(0xFF0F0F25)
        ..strokeWidth = 2.0
        ..style = PaintingStyle.stroke;
      canvas.drawLine(
        center,
        Offset(
          center.dx + radius * cos(startAngle),
          center.dy + radius * sin(startAngle),
        ),
        linePaint,
      );

      // Icon + label
      final double textAngle = i * segAngle;
      final textOffset = Offset(
        center.dx + (radius * 0.67) * cos(textAngle),
        center.dy + (radius * 0.67) * sin(textAngle),
      );

      canvas.save();
      canvas.translate(textOffset.dx, textOffset.dy);
      canvas.rotate(textAngle + pi / 2);

      // Icon
      final iconSpan = TextSpan(
        text: segments[i].icon,
        style: const TextStyle(fontSize: 11, height: 1.2),
      );
      final iconPainter = TextPainter(
        text: iconSpan,
        textAlign: TextAlign.center,
        textDirection: TextDirection.ltr,
      )..layout(minWidth: 0, maxWidth: 50);
      iconPainter.paint(
        canvas,
        Offset(-iconPainter.width / 2, -iconPainter.height / 2 - 9),
      );

      // Label (may span 2 lines)
      final labelSpan = TextSpan(
        text: segments[i].label,
        style: const TextStyle(
          color: Colors.white,
          fontSize: 7.5,
          fontWeight: FontWeight.bold,
          height: 1.3,
          shadows: [Shadow(color: Colors.black54, blurRadius: 3)],
        ),
      );
      final labelPainter = TextPainter(
        text: labelSpan,
        textAlign: TextAlign.center,
        textDirection: TextDirection.ltr,
      )..layout(minWidth: 0, maxWidth: 52);
      labelPainter.paint(
        canvas,
        Offset(-labelPainter.width / 2, 2),
      );

      canvas.restore();
    }

    // Gold centre cap
    final capPaint = Paint()
      ..style = PaintingStyle.fill
      ..shader = RadialGradient(
        colors: [Colors.white24, Colors.transparent],
        radius: 0.8,
      ).createShader(Rect.fromCircle(center: center, radius: radius * 0.22));
    canvas.drawCircle(center, radius * 0.22, capPaint);
  }

  @override
  bool shouldRepaint(covariant _WheelPainter old) =>
      old.segments != segments;
}
