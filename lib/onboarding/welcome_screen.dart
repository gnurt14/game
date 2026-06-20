// welcome_screen.dart — Màn hình chào mừng người chơi mới
//
// Luồng 3 bước:
//   Trang 1: Chào mừng + tặng 500 xu
//   Trang 2: Giới thiệu 3 game may mắn (Bầu Cua, Đỏ Đen, Xì Jack)
//   Trang 3: Tặng 3 hộp may mắn miễn phí + vào game

import 'package:flutter/material.dart';
import '../coin/coin_service.dart';
import '../coin/gacha_dialog.dart';
import 'onboarding_service.dart';

class WelcomeScreen extends StatefulWidget {
  final VoidCallback onComplete;
  const WelcomeScreen({super.key, required this.onComplete});

  @override
  State<WelcomeScreen> createState() => _WelcomeScreenState();
}

class _WelcomeScreenState extends State<WelcomeScreen>
    with TickerProviderStateMixin {
  final PageController _pageCtrl = PageController();
  int _currentPage = 0;

  late final AnimationController _coinAnim;
  late final Animation<double> _coinScale;

  late final AnimationController _floatAnim;
  late final Animation<double> _floatY;

  @override
  void initState() {
    super.initState();

    _coinAnim = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 800),
    )..forward();

    _coinScale = CurvedAnimation(parent: _coinAnim, curve: Curves.elasticOut);

    _floatAnim = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1800),
    )..repeat(reverse: true);

    _floatY = Tween<double>(begin: -6, end: 6).animate(
      CurvedAnimation(parent: _floatAnim, curve: Curves.easeInOut),
    );
  }

  @override
  void dispose() {
    _pageCtrl.dispose();
    _coinAnim.dispose();
    _floatAnim.dispose();
    super.dispose();
  }

  void _nextPage() {
    if (_currentPage < 2) {
      _pageCtrl.nextPage(
        duration: const Duration(milliseconds: 350),
        curve: Curves.easeInOut,
      );
    }
  }

  Future<void> _openFreeLuckyBox() async {
    final data = CoinService.instance.notifier.value;
    if (data.freeLuckyBoxes <= 0) {
      _finishOnboarding();
      return;
    }

    await GachaDialog.show(
      context,
      onPurchase: CoinService.instance.openFreeLuckyBox,
      isFree: true,
    );

    // Tự động finish sau khi mở hết hộp
    if (!mounted) return;
    final remaining = CoinService.instance.notifier.value.freeLuckyBoxes;
    if (remaining <= 0) _finishOnboarding();
  }

  Future<void> _finishOnboarding() async {
    await OnboardingService.instance.completeOnboarding();
    await CoinService.instance.markOnboardingComplete();
    widget.onComplete();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF0A0A1A),
      body: SafeArea(
        child: Column(
          children: [
            // Page indicator
            Padding(
              padding: const EdgeInsets.fromLTRB(24, 16, 24, 0),
              child: Row(
                children: List.generate(3, (i) => _buildDot(i)),
              ),
            ),
            Expanded(
              child: PageView(
                controller: _pageCtrl,
                physics: const NeverScrollableScrollPhysics(),
                onPageChanged: (p) => setState(() => _currentPage = p),
                children: [
                  _buildPage1(),
                  _buildPage2(),
                  _buildPage3(),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildDot(int index) {
    final active = index == _currentPage;
    return AnimatedContainer(
      duration: const Duration(milliseconds: 300),
      margin: const EdgeInsets.only(right: 6),
      width: active ? 24 : 8,
      height: 8,
      decoration: BoxDecoration(
        color: active ? const Color(0xFF7C6FFF) : const Color(0xFF2A2A44),
        borderRadius: BorderRadius.circular(4),
      ),
    );
  }

  // ── Trang 1: Chào mừng + 500 xu ──────────────────────────────────────────

  Widget _buildPage1() {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 28),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          // Logo floating
          AnimatedBuilder(
            animation: _floatY,
            builder: (_, __) => Transform.translate(
              offset: Offset(0, _floatY.value),
              child: Container(
                width: 110,
                height: 110,
                decoration: BoxDecoration(
                  gradient: const LinearGradient(
                    colors: [Color(0xFF7C6FFF), Color(0xFFB06FFF)],
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                  ),
                  borderRadius: BorderRadius.circular(28),
                  boxShadow: [
                    BoxShadow(
                      color: const Color(0xFF7C6FFF).withOpacity(0.4),
                      blurRadius: 30,
                      spreadRadius: 4,
                    ),
                  ],
                ),
                child: const Icon(Icons.sports_esports_rounded,
                    color: Colors.white, size: 56),
              ),
            ),
          ),
          const SizedBox(height: 36),
          const Text(
            'Chào mừng đến\nSUPER GATE!',
            textAlign: TextAlign.center,
            style: TextStyle(
              color: Colors.white,
              fontSize: 28,
              fontWeight: FontWeight.w900,
              letterSpacing: 1,
              height: 1.3,
            ),
          ),
          const SizedBox(height: 16),
          const Text(
            '18 mini-game hấp dẫn\nchờ bạn khám phá',
            textAlign: TextAlign.center,
            style: TextStyle(color: Color(0xFF8888AA), fontSize: 15, height: 1.6),
          ),
          const SizedBox(height: 40),
          // Coin gift
          ScaleTransition(
            scale: _coinScale,
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 28, vertical: 20),
              decoration: BoxDecoration(
                gradient: const LinearGradient(
                  colors: [Color(0xFF2A1F00), Color(0xFF1A1300)],
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                ),
                borderRadius: BorderRadius.circular(20),
                border: Border.all(
                  color: const Color(0xFFFFD700).withOpacity(0.5),
                  width: 1.5,
                ),
                boxShadow: [
                  BoxShadow(
                    color: const Color(0xFFFFD700).withOpacity(0.15),
                    blurRadius: 20,
                  ),
                ],
              ),
              child: const Column(
                children: [
                  Text('🎁', style: TextStyle(fontSize: 40)),
                  SizedBox(height: 8),
                  Text(
                    'QUÀ TẶNG KHỞI ĐẦU',
                    style: TextStyle(
                      color: Color(0xFFFFD700),
                      fontSize: 12,
                      fontWeight: FontWeight.bold,
                      letterSpacing: 2,
                    ),
                  ),
                  SizedBox(height: 8),
                  Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text('🪙', style: TextStyle(fontSize: 28)),
                      SizedBox(width: 8),
                      Text(
                        '500 Xu',
                        style: TextStyle(
                          color: Colors.white,
                          fontSize: 32,
                          fontWeight: FontWeight.w900,
                        ),
                      ),
                    ],
                  ),
                  SizedBox(height: 4),
                  Text(
                    '+ 3 Hộp May Mắn Miễn Phí',
                    style: TextStyle(color: Color(0xFF9C27B0), fontSize: 13, fontWeight: FontWeight.bold),
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 48),
          _buildButton('Bắt đầu khám phá  →', _nextPage),
        ],
      ),
    );
  }

  // ── Trang 2: Gợi ý game may mắn ──────────────────────────────────────────

  Widget _buildPage2() {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 24),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          const Text(
            '🎯 Được Đề Xuất\ncho Bạn',
            textAlign: TextAlign.center,
            style: TextStyle(
              color: Colors.white,
              fontSize: 26,
              fontWeight: FontWeight.w900,
              height: 1.3,
            ),
          ),
          const SizedBox(height: 8),
          const Text(
            'Những game này dễ chơi, cơ hội\nnhân coin rất cao — lý tưởng để bắt đầu!',
            textAlign: TextAlign.center,
            style: TextStyle(color: Color(0xFF8888AA), fontSize: 14, height: 1.5),
          ),
          const SizedBox(height: 32),
          _buildFeaturedGameCard(
            emoji: '🎲',
            name: 'Bầu Cua Tôm Cá',
            desc: 'Lắc 3 xúc xắc — trúng 3 mặt nhân 3x tiền cược!',
            gradient: [const Color(0xFFE53935), const Color(0xFFFF6F00)],
            badge: 'Nhân đến ×3',
          ),
          const SizedBox(height: 12),
          _buildFeaturedGameCard(
            emoji: '🃏',
            name: 'Đỏ Đen',
            desc: 'Đoán màu bài — xác suất 50/50, thắng nhân đôi.',
            gradient: [const Color(0xFF7B0000), const Color(0xFF1A237E)],
            badge: 'Nhân ×2',
          ),
          const SizedBox(height: 12),
          _buildFeaturedGameCard(
            emoji: '♠️',
            name: 'Xì Jack',
            desc: 'Đánh blackjack với nhà cái — chạm 21 để thắng!',
            gradient: [const Color(0xFF1B5E20), const Color(0xFF004D40)],
            badge: 'Blackjack ×2.5',
          ),
          const SizedBox(height: 40),
          _buildButton('Tiếp theo  →', _nextPage),
        ],
      ),
    );
  }

  Widget _buildFeaturedGameCard({
    required String emoji,
    required String name,
    required String desc,
    required List<Color> gradient,
    required String badge,
  }) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: gradient.map((c) => Color.lerp(c, const Color(0xFF0A0A1A), 0.35)!).toList(),
        ),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: gradient.first.withOpacity(0.4)),
      ),
      child: Row(
        children: [
          Text(emoji, style: const TextStyle(fontSize: 36)),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Text(name,
                        style: const TextStyle(
                            color: Colors.white, fontSize: 14, fontWeight: FontWeight.bold)),
                    const SizedBox(width: 8),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                      decoration: BoxDecoration(
                        color: gradient.first.withOpacity(0.25),
                        borderRadius: BorderRadius.circular(6),
                        border: Border.all(color: gradient.first.withOpacity(0.5)),
                      ),
                      child: Text(badge,
                          style: TextStyle(
                              color: gradient.first, fontSize: 10, fontWeight: FontWeight.bold)),
                    ),
                  ],
                ),
                const SizedBox(height: 4),
                Text(desc,
                    style: const TextStyle(
                        color: Color(0xFF8888AA), fontSize: 12, height: 1.4)),
              ],
            ),
          ),
        ],
      ),
    );
  }

  // ── Trang 3: 3 hộp may mắn ───────────────────────────────────────────────

  Widget _buildPage3() {
    return ValueListenableBuilder<CoinData>(
      valueListenable: CoinService.instance.notifier,
      builder: (_, coinData, __) {
        final remaining = coinData.freeLuckyBoxes;
        return Padding(
          padding: const EdgeInsets.symmetric(horizontal: 28),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              const Text(
                '🎁 Quà Tặng Đặc Biệt!',
                textAlign: TextAlign.center,
                style: TextStyle(
                  color: Colors.white,
                  fontSize: 26,
                  fontWeight: FontWeight.w900,
                ),
              ),
              const SizedBox(height: 12),
              Text(
                remaining > 0
                    ? 'Bạn còn $remaining hộp may mắn miễn phí.\nMở ngay để nhận xu!'
                    : 'Bạn đã mở hết hộp may mắn!\nChúc bạn may mắn trong game!',
                textAlign: TextAlign.center,
                style: const TextStyle(
                    color: Color(0xFF8888AA), fontSize: 14, height: 1.6),
              ),
              const SizedBox(height: 36),
              // 3 hộp
              Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: List.generate(3, (i) {
                  final opened = i >= remaining;
                  return Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 8),
                    child: _buildBoxIcon(opened: opened),
                  );
                }),
              ),
              const SizedBox(height: 40),
              if (remaining > 0) ...[
                _buildButton(
                  '🎁 Mở Hộp May Mắn ($remaining còn lại)',
                  _openFreeLuckyBox,
                  color: const Color(0xFF9C27B0),
                ),
                const SizedBox(height: 14),
                TextButton(
                  onPressed: _finishOnboarding,
                  child: const Text(
                    'Bỏ qua, vào game ngay',
                    style: TextStyle(color: Color(0xFF666688), fontSize: 13),
                  ),
                ),
              ] else ...[
                _buildButton('🚀 Vào game nào!', _finishOnboarding),
              ],
            ],
          ),
        );
      },
    );
  }

  Widget _buildBoxIcon({required bool opened}) {
    return Container(
      width: 70,
      height: 70,
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: opened
              ? [const Color(0xFF1A1A2A), const Color(0xFF101020)]
              : [const Color(0xFF3A1A5A), const Color(0xFF1A0A2A)],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
          color: opened
              ? const Color(0xFF2A2A3A)
              : const Color(0xFF9C27B0).withOpacity(0.6),
          width: 1.5,
        ),
        boxShadow: opened
            ? null
            : [
                BoxShadow(
                  color: const Color(0xFF9C27B0).withOpacity(0.2),
                  blurRadius: 12,
                ),
              ],
      ),
      child: Center(
        child: Text(
          opened ? '✅' : '🎁',
          style: const TextStyle(fontSize: 30),
        ),
      ),
    );
  }

  // ── Shared button ─────────────────────────────────────────────────────────

  Widget _buildButton(String label, VoidCallback onTap,
      {Color color = const Color(0xFF7C6FFF)}) {
    return SizedBox(
      width: double.infinity,
      child: FilledButton(
        onPressed: onTap,
        style: FilledButton.styleFrom(
          backgroundColor: color,
          padding: const EdgeInsets.symmetric(vertical: 16),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
          textStyle: const TextStyle(fontSize: 15, fontWeight: FontWeight.bold),
        ),
        child: Text(label),
      ),
    );
  }
}
