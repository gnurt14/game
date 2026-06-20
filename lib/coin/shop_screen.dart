// shop_screen.dart — Màn hình cửa hàng để tiêu xu
//
// Các item:
//   • Coin Booster x2 (24h) — 300 xu
//   • Hộp may mắn           — 100 xu (random 50–600 xu)
//   • Lá chắn Streak        — 150 xu (bảo vệ streak 1 ngày)

import 'package:flutter/material.dart';
import 'coin_service.dart';
import 'gacha_dialog.dart';

class ShopScreen extends StatefulWidget {
  const ShopScreen({super.key});

  @override
  State<ShopScreen> createState() => _ShopScreenState();
}

class _ShopScreenState extends State<ShopScreen> {
  CoinData _data = CoinService.instance.notifier.value;

  @override
  void initState() {
    super.initState();
    CoinService.instance.notifier.addListener(_onUpdate);
  }

  @override
  void dispose() {
    CoinService.instance.notifier.removeListener(_onUpdate);
    super.dispose();
  }

  void _onUpdate() {
    if (mounted) setState(() => _data = CoinService.instance.notifier.value);
  }

  // ── Purchase handlers ──────────────────────────────────────────────────────

  Future<void> _buyBooster() async {
    final confirm = await _confirm(
      title: 'Mua Coin Booster x2?',
      body: 'Tất cả xu kiếm được sẽ được nhân đôi trong 24 giờ.\n'
          'Chi phí: 300 xu',
      icon: '⚡',
      color: const Color(0xFFFF6B00),
    );
    if (!confirm) return;

    final ok = await CoinService.instance.purchaseBooster();
    if (!ok) {
      _showSnack('Không đủ xu!', isError: true);
    } else {
      _showSnack('⚡ Coin Booster x2 đã được kích hoạt 24 giờ!');
    }
  }

  Future<void> _buyLuckyBox() async {
    if (_data.balance < 100) {
      _showSnack('Không đủ xu!', isError: true);
      return;
    }
    await GachaDialog.show(
      context,
      onPurchase: CoinService.instance.purchaseLuckyBox,
    );
  }

  Future<void> _openFreeLuckyBox() async {
    if (_data.freeLuckyBoxes <= 0) return;
    await GachaDialog.show(
      context,
      onPurchase: CoinService.instance.openFreeLuckyBox,
      isFree: true,
    );
  }

  Future<void> _buyShield() async {
    final confirm = await _confirm(
      title: 'Mua Lá chắn Streak?',
      body: 'Bảo vệ streak của bạn nếu bạn bỏ lỡ 1 ngày.\n'
          'Chi phí: 150 xu',
      icon: '🛡️',
      color: const Color(0xFF00BCD4),
    );
    if (!confirm) return;

    final ok = await CoinService.instance.purchaseStreakShield();
    if (!ok) {
      _showSnack('Không đủ xu!', isError: true);
    } else {
      _showSnack('🛡️ Đã thêm 1 lá chắn streak!');
    }
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  Future<bool> _confirm({
    required String title,
    required String body,
    required String icon,
    required Color color,
  }) async {
    return await showDialog<bool>(
          context: context,
          builder: (ctx) => AlertDialog(
            backgroundColor: const Color(0xFF1A1A2E),
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(20),
              side: BorderSide(color: color.withOpacity(0.4)),
            ),
            title: Row(
              children: [
                Text(icon, style: const TextStyle(fontSize: 22)),
                const SizedBox(width: 10),
                Expanded(
                  child: Text(
                    title,
                    style: const TextStyle(
                      color: Colors.white,
                      fontSize: 16,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                ),
              ],
            ),
            content: Text(
              body,
              style: const TextStyle(color: Color(0xFFAAAACC), fontSize: 14, height: 1.5),
            ),
            actions: [
              TextButton(
                onPressed: () => Navigator.pop(ctx, false),
                child: const Text('Hủy', style: TextStyle(color: Color(0xFF777799))),
              ),
              FilledButton(
                onPressed: () => Navigator.pop(ctx, true),
                style: FilledButton.styleFrom(backgroundColor: color),
                child: const Text('Xác nhận'),
              ),
            ],
          ),
        ) ??
        false;
  }

  void _showSnack(String msg, {bool isError = false}) {
    if (!mounted) return;
    final borderColor =
        isError ? const Color(0xFFC62828) : const Color(0xFF2E7D32);
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(
          msg,
          style: TextStyle(color: borderColor, fontWeight: FontWeight.bold),
        ),
        backgroundColor: Colors.white,
        behavior: SnackBarBehavior.floating,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(10),
          side: BorderSide(color: borderColor, width: 2),
        ),
        duration: const Duration(seconds: 2),
      ),
    );
  }

  // ── Build ──────────────────────────────────────────────────────────────────

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF0A0A1A),
      body: SafeArea(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            _buildHeader(),
            Expanded(
              child: ListView(
                padding: const EdgeInsets.fromLTRB(20, 8, 20, 24),
                children: [
                  // ── Free Lucky Boxes (new player gift) ─────────────────
                  if (_data.freeLuckyBoxes > 0) ...[
                    _buildFreeLuckyBoxBanner(),
                    const SizedBox(height: 16),
                  ],
                  _buildSectionLabel('⚡ Bộ tăng cường'),
                  const SizedBox(height: 10),
                  _buildBoosterCard(),
                  const SizedBox(height: 12),
                  _buildSectionLabel('🎲 Vận may'),
                  const SizedBox(height: 10),
                  _buildLuckyBoxCard(),
                  const SizedBox(height: 12),
                  _buildSectionLabel('🛡️ Bảo vệ'),
                  const SizedBox(height: 10),
                  _buildShieldCard(),
                  const SizedBox(height: 24),
                  _buildEarnTip(),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildHeader() {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 8),
      child: Row(
        children: [
          IconButton(
            onPressed: () => Navigator.pop(context),
            icon: const Icon(Icons.arrow_back_ios_new_rounded, size: 20),
            color: Colors.white70,
            padding: EdgeInsets.zero,
            constraints: const BoxConstraints(),
          ),
          const SizedBox(width: 12),
          const Text(
            'CỬA HÀNG',
            style: TextStyle(
              color: Colors.white,
              fontSize: 20,
              fontWeight: FontWeight.w900,
              letterSpacing: 2,
            ),
          ),
          const Spacer(),
          // Coin balance
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
            decoration: BoxDecoration(
              color: const Color(0xFF1E1A00),
              borderRadius: BorderRadius.circular(20),
              border: Border.all(color: const Color(0xFFFFD700).withOpacity(0.5)),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                const Text('🪙', style: TextStyle(fontSize: 16)),
                const SizedBox(width: 6),
                Text(
                  '${_data.balance}',
                  style: const TextStyle(
                    color: Color(0xFFFFD700),
                    fontWeight: FontWeight.w900,
                    fontSize: 16,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildSectionLabel(String label) {
    return Text(
      label,
      style: const TextStyle(
        color: Color(0xFF7777AA),
        fontSize: 13,
        fontWeight: FontWeight.bold,
        letterSpacing: 1,
      ),
    );
  }

  Widget _buildFreeLuckyBoxBanner() {
    final count = _data.freeLuckyBoxes;
    return GestureDetector(
      onTap: _openFreeLuckyBox,
      child: Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          gradient: const LinearGradient(
            colors: [Color(0xFF2A0040), Color(0xFF150020)],
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
          ),
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: const Color(0xFF9C27B0).withOpacity(0.6), width: 1.5),
          boxShadow: [
            BoxShadow(
              color: const Color(0xFF9C27B0).withOpacity(0.2),
              blurRadius: 16,
            ),
          ],
        ),
        child: Row(
          children: [
            Container(
              width: 54,
              height: 54,
              decoration: BoxDecoration(
                color: const Color(0xFF9C27B0).withOpacity(0.2),
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: const Color(0xFF9C27B0).withOpacity(0.4)),
              ),
              child: const Center(
                child: Text('🎁', style: TextStyle(fontSize: 26)),
              ),
            ),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Row(
                    children: [
                      Flexible(
                        child: Text(
                          'Hộp May Mắn Miễn Phí',
                          style: TextStyle(
                              color: Colors.white,
                              fontWeight: FontWeight.bold,
                              fontSize: 15),
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 4),
                  Container(
                    padding:
                    const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                    decoration: BoxDecoration(
                      color: const Color(0xFF9C27B0).withOpacity(0.3),
                      borderRadius: BorderRadius.circular(6),
                      border:
                      Border.all(color: const Color(0xFF9C27B0).withOpacity(0.6)),
                    ),
                    child: Text(
                      'x$count',
                      style: const TextStyle(
                          color: Color(0xFFCE93D8),
                          fontSize: 11,
                          fontWeight: FontWeight.bold),
                    ),
                  ),
                  const Text(
                    'Quà tặng chào mừng — mở ngay!\nKhông tốn xu, nhận được 25–500 xu',
                    style: TextStyle(
                        color: Color(0xFFAA88BB), fontSize: 11, height: 1.4),
                  ),
                ],
              ),
            ),
            const SizedBox(width: 10),
            FilledButton(
              onPressed: _openFreeLuckyBox,
              style: FilledButton.styleFrom(
                backgroundColor: const Color(0xFF9C27B0),
                foregroundColor: Colors.white,
                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                minimumSize: Size.zero,
                tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(10)),
                textStyle:
                    const TextStyle(fontWeight: FontWeight.bold, fontSize: 12),
              ),
              child: const Text('Mở\nMiễn Phí', textAlign: TextAlign.center),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildBoosterCard() {
    final active = _data.boosterActive;
    final remaining = _data.boosterRemaining;
    final hours = remaining.inHours;
    final mins = remaining.inMinutes % 60;

    return _ShopCard(
      icon: '⚡',
      iconColor: const Color(0xFFFF6B00),
      gradientColors: const [Color(0xFF2D1500), Color(0xFF1A0D00)],
      borderColor: const Color(0xFFFF6B00),
      title: 'Coin Booster x2',
      subtitle: 'Nhân đôi xu kiếm được trong 24 giờ',
      priceLabel: active
          ? 'Còn ${hours}g ${mins}p — Gia hạn: 300 xu'
          : '300 xu',
      badge: active ? 'ĐANG HOẠT ĐỘNG' : null,
      badgeColor: const Color(0xFFFF6B00),
      canAfford: _data.balance >= 300,
      buttonLabel: active ? 'Gia hạn' : 'Mua ngay',
      onBuy: _buyBooster,
    );
  }

  Widget _buildLuckyBoxCard() {
    return _ShopCard(
      icon: '🎁',
      iconColor: const Color(0xFF9C27B0),
      gradientColors: const [Color(0xFF1A0028), Color(0xFF0F0015)],
      borderColor: const Color(0xFF9C27B0),
      title: 'Hộp may mắn',
      subtitle: 'Mở hộp nhận 25–500 xu\nJackpot (300–500): 4% • Vàng: 13% • Bạc: 28%',
      priceLabel: '100 xu',
      badge: null,
      badgeColor: Colors.transparent,
      canAfford: _data.balance >= 100,
      buttonLabel: 'Mở hộp',
      onBuy: _buyLuckyBox,
    );
  }

  Widget _buildShieldCard() {
    final shields = _data.shieldCount;

    return _ShopCard(
      icon: '🛡️',
      iconColor: const Color(0xFF00BCD4),
      gradientColors: const [Color(0xFF001A1E), Color(0xFF000F12)],
      borderColor: const Color(0xFF00BCD4),
      title: 'Lá chắn Streak',
      subtitle: 'Bảo vệ streak nếu bỏ lỡ 1 ngày\nHiệu lực: 1 lá chắn = 1 lần bỏ',
      priceLabel: '150 xu',
      badge: shields > 0 ? 'Đang có: $shields' : null,
      badgeColor: const Color(0xFF00BCD4),
      canAfford: _data.balance >= 150,
      buttonLabel: 'Mua lá chắn',
      onBuy: _buyShield,
    );
  }

  Widget _buildEarnTip() {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: const Color(0xFF0F0F1E),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: const Color(0xFF333355)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            '💡 Cách kiếm xu',
            style: TextStyle(
              color: Colors.white70,
              fontWeight: FontWeight.bold,
              fontSize: 13,
            ),
          ),
          const SizedBox(height: 10),
          ...[
            ('🪙 Điểm danh hàng ngày', 'Lên đến 300 xu/ngày (chuỗi 7 ngày)'),
            ('🎮 Chơi game', '+15 xu lần đầu, +5 xu lần tiếp theo mỗi ngày'),
            ('🎯 Chơi 3 game khác nhau', '+100 xu thưởng nhiệm vụ'),
            ('🏆 Chơi 5 game khác nhau', '+200 xu thưởng nhiệm vụ'),
          ].map(
            (e) => Padding(
              padding: const EdgeInsets.only(bottom: 6),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Expanded(
                    flex: 5,
                    child: Text(
                      e.$1,
                      style: const TextStyle(color: Color(0xFF9999BB), fontSize: 12),
                    ),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    flex: 5,
                    child: Text(
                      e.$2,
                      style: const TextStyle(color: Color(0xFF666688), fontSize: 12),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

// ── Shop Card Widget ───────────────────────────────────────────────────────────

class _ShopCard extends StatelessWidget {
  final String icon;
  final Color iconColor;
  final List<Color> gradientColors;
  final Color borderColor;
  final String title;
  final String subtitle;
  final String priceLabel;
  final String? badge;
  final Color badgeColor;
  final bool canAfford;
  final String buttonLabel;
  final VoidCallback onBuy;

  const _ShopCard({
    required this.icon,
    required this.iconColor,
    required this.gradientColors,
    required this.borderColor,
    required this.title,
    required this.subtitle,
    required this.priceLabel,
    this.badge,
    required this.badgeColor,
    required this.canAfford,
    required this.buttonLabel,
    required this.onBuy,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: gradientColors,
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: borderColor.withOpacity(0.35), width: 1.5),
      ),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Row(
          children: [
            // Icon
            Container(
              width: 52,
              height: 52,
              decoration: BoxDecoration(
                color: iconColor.withOpacity(0.15),
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: iconColor.withOpacity(0.3)),
              ),
              child: Center(
                child: Text(icon, style: const TextStyle(fontSize: 24)),
              ),
            ),
            const SizedBox(width: 14),

            // Info
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Text(
                        title,
                        style: const TextStyle(
                          color: Colors.white,
                          fontWeight: FontWeight.bold,
                          fontSize: 15,
                        ),
                      ),
                      if (badge != null) ...[
                        const SizedBox(width: 8),
                        Container(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 6, vertical: 2),
                          decoration: BoxDecoration(
                            color: badgeColor.withOpacity(0.2),
                            borderRadius: BorderRadius.circular(6),
                            border: Border.all(color: badgeColor.withOpacity(0.5)),
                          ),
                          child: Text(
                            badge!,
                            style: TextStyle(
                              color: badgeColor,
                              fontSize: 9,
                              fontWeight: FontWeight.bold,
                              letterSpacing: 0.5,
                            ),
                          ),
                        ),
                      ],
                    ],
                  ),
                  const SizedBox(height: 4),
                  Text(
                    subtitle,
                    style: const TextStyle(
                      color: Color(0xFF888899),
                      fontSize: 11,
                      height: 1.4,
                    ),
                  ),
                  const SizedBox(height: 8),
                  Row(
                    children: [
                      const Text('🪙', style: TextStyle(fontSize: 14)),
                      const SizedBox(width: 4),
                      Text(
                        priceLabel,
                        style: TextStyle(
                          color: canAfford
                              ? const Color(0xFFFFD700)
                              : const Color(0xFF666655),
                          fontWeight: FontWeight.bold,
                          fontSize: 13,
                        ),
                      ),
                      const Spacer(),
                      FilledButton(
                        onPressed: canAfford ? onBuy : null,
                        style: FilledButton.styleFrom(
                          backgroundColor: iconColor,
                          disabledBackgroundColor: const Color(0xFF333333),
                          foregroundColor: Colors.white,
                          padding: const EdgeInsets.symmetric(
                            horizontal: 14, vertical: 8),
                          minimumSize: Size.zero,
                          tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(10),
                          ),
                          textStyle: const TextStyle(
                            fontWeight: FontWeight.bold,
                            fontSize: 12,
                          ),
                        ),
                        child: Text(buttonLabel),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
