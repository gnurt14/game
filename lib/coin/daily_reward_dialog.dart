// daily_reward_dialog.dart — Dialog điểm danh hàng ngày (7-ngày streak)
//
// Hiển thị:
//   • 7 ô ngày với gradient highlight cho hôm nay
//   • Số xu nhận được với animation bounce
//   • Badge lá chắn / streak reset warning
//   • Nút "Nhận thưởng!" gọi claimDailyReward()

import 'package:flutter/material.dart';
import 'coin_service.dart';

class DailyRewardDialog extends StatefulWidget {
  final DailyRewardInfo info;

  const DailyRewardDialog({super.key, required this.info});

  static Future<void> show(BuildContext context, DailyRewardInfo info) {
    return showDialog(
      context: context,
      barrierDismissible: false,
      barrierColor: Colors.black87,
      builder: (_) => DailyRewardDialog(info: info),
    );
  }

  @override
  State<DailyRewardDialog> createState() => _DailyRewardDialogState();
}

class _DailyRewardDialogState extends State<DailyRewardDialog>
    with TickerProviderStateMixin {
  late final AnimationController _entryCtrl;
  late final AnimationController _glowCtrl;
  late final Animation<double> _scaleAnim;
  late final Animation<double> _fadeAnim;

  bool _claimed = false;

  @override
  void initState() {
    super.initState();

    _entryCtrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 500),
    );
    _glowCtrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1800),
    )..repeat(reverse: true);

    _scaleAnim = CurvedAnimation(parent: _entryCtrl, curve: Curves.elasticOut);
    _fadeAnim  = CurvedAnimation(parent: _entryCtrl, curve: Curves.easeOut);

    _entryCtrl.forward();
  }

  @override
  void dispose() {
    _entryCtrl.dispose();
    _glowCtrl.dispose();
    super.dispose();
  }

  Future<void> _claim() async {
    if (_claimed) return;
    setState(() => _claimed = true);
    await CoinService.instance.claimDailyReward();
    if (mounted) Navigator.of(context).pop();
  }

  @override
  Widget build(BuildContext context) {
    return FadeTransition(
      opacity: _fadeAnim,
      child: Dialog(
        backgroundColor: Colors.transparent,
        insetPadding: const EdgeInsets.symmetric(horizontal: 24),
        child: ScaleTransition(
          scale: _scaleAnim,
          child: _buildCard(),
        ),
      ),
    );
  }

  Widget _buildCard() {
    return Container(
      padding: const EdgeInsets.fromLTRB(20, 24, 20, 20),
      decoration: BoxDecoration(
        color: const Color(0xFF12122A),
        borderRadius: BorderRadius.circular(24),
        border: Border.all(color: const Color(0xFFFFD700).withOpacity(0.6), width: 1.5),
        boxShadow: [
          BoxShadow(
            color: const Color(0xFFFFD700).withOpacity(0.15),
            blurRadius: 32,
            spreadRadius: 4,
          ),
        ],
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          _buildTitle(),
          const SizedBox(height: 20),
          _buildStreakRow(),
          const SizedBox(height: 20),
          _buildRewardBox(),
          if (widget.info.shieldWillBeUsed) ...[
            const SizedBox(height: 12),
            _buildShieldBadge(),
          ],
          if (widget.info.streakWasReset) ...[
            const SizedBox(height: 12),
            _buildResetWarning(),
          ],
          const SizedBox(height: 20),
          _buildClaimButton(),
        ],
      ),
    );
  }

  Widget _buildTitle() {
    return Column(
      children: [
        const Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(Icons.calendar_today_rounded, color: Color(0xFFFFD700), size: 18),
            SizedBox(width: 8),
            Text(
              'ĐIỂM DANH HÀNG NGÀY',
              style: TextStyle(
                color: Color(0xFFFFD700),
                fontSize: 15,
                fontWeight: FontWeight.w900,
                letterSpacing: 1.8,
              ),
            ),
          ],
        ),
        const SizedBox(height: 6),
        Text(
          widget.info.streakWasReset
              ? 'Streak bị phá — bắt đầu lại nào!'
              : 'Ngày ${widget.info.todayStreakDay} liên tiếp!',
          style: TextStyle(
            color: widget.info.streakWasReset
                ? const Color(0xFFFF6B6B)
                : const Color(0xFF9999CC),
            fontSize: 13,
          ),
        ),
      ],
    );
  }

  Widget _buildStreakRow() {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceEvenly,
      children: List.generate(7, (i) {
        final dayNum = i + 1;
        final isPast = dayNum < widget.info.todayStreakDay;
        final isCurrent = dayNum == widget.info.todayStreakDay;
        final reward = DailyRewardInfo.rewardTable[i];

        return _DayCell(
          dayNum: dayNum,
          reward: reward,
          isPast: isPast,
          isCurrent: isCurrent,
          glowAnim: isCurrent ? _glowCtrl : null,
        );
      }),
    );
  }

  Widget _buildRewardBox() {
    return AnimatedBuilder(
      animation: _glowCtrl,
      builder: (context, child) {
        final glow = 0.3 + 0.2 * _glowCtrl.value;
        return Container(
          width: double.infinity,
          padding: const EdgeInsets.symmetric(vertical: 16),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(16),
            gradient: const LinearGradient(
              colors: [
                Color(0xFF1E1A00),
                Color(0xFF2A2200),
              ],
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
            ),
            border: Border.all(
              color: const Color(0xFFFFD700).withOpacity(glow),
              width: 1.5,
            ),
          ),
          child: child,
        );
      },
      child: Column(
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              const Text('🪙', style: TextStyle(fontSize: 32)),
              const SizedBox(width: 10),
              Text(
                '+${widget.info.actualReward}',
                style: const TextStyle(
                  color: Color(0xFFFFD700),
                  fontSize: 44,
                  fontWeight: FontWeight.w900,
                  height: 1,
                ),
              ),
              const SizedBox(width: 6),
              const Padding(
                padding: EdgeInsets.only(top: 18),
                child: Text(
                  'xu',
                  style: TextStyle(
                    color: Color(0xFFFFD700),
                    fontSize: 20,
                    fontWeight: FontWeight.bold,
                  ),
                ),
              ),
            ],
          ),
          if (widget.info.boosterActive) ...[
            const SizedBox(height: 4),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 3),
              decoration: BoxDecoration(
                color: const Color(0xFFFF6B00).withOpacity(0.25),
                borderRadius: BorderRadius.circular(20),
                border: Border.all(color: const Color(0xFFFF6B00).withOpacity(0.5)),
              ),
              child: const Text(
                '⚡ Booster x2 đang hoạt động!',
                style: TextStyle(
                  color: Color(0xFFFF9D45),
                  fontSize: 11,
                  fontWeight: FontWeight.bold,
                ),
              ),
            ),
          ],
        ],
      ),
    );
  }

  Widget _buildShieldBadge() {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
      decoration: BoxDecoration(
        color: const Color(0xFF004D2E),
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: const Color(0xFF00C976).withOpacity(0.5)),
      ),
      child: const Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Text('🛡️', style: TextStyle(fontSize: 16)),
          SizedBox(width: 8),
          Text(
            'Lá chắn streak đã bảo vệ bạn!',
            style: TextStyle(
              color: Color(0xFF00C976),
              fontSize: 12,
              fontWeight: FontWeight.bold,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildResetWarning() {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
      decoration: BoxDecoration(
        color: const Color(0xFF4D0000),
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: const Color(0xFFFF4444).withOpacity(0.5)),
      ),
      child: const Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Text('💔', style: TextStyle(fontSize: 16)),
          SizedBox(width: 8),
          Text(
            'Streak bị phá! Bắt đầu lại từ ngày 1',
            style: TextStyle(
              color: Color(0xFFFF6B6B),
              fontSize: 12,
              fontWeight: FontWeight.bold,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildClaimButton() {
    return SizedBox(
      width: double.infinity,
      child: FilledButton(
        onPressed: _claimed ? null : _claim,
        style: FilledButton.styleFrom(
          backgroundColor: const Color(0xFFFFD700),
          disabledBackgroundColor: const Color(0xFF555544),
          foregroundColor: const Color(0xFF12122A),
          padding: const EdgeInsets.symmetric(vertical: 15),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(14),
          ),
          textStyle: const TextStyle(
            fontWeight: FontWeight.w900,
            fontSize: 15,
            letterSpacing: 1.5,
          ),
        ),
        child: Text(_claimed ? 'Đã nhận...' : '🎁  NHẬN THƯỞNG!'),
      ),
    );
  }
}

// ── Day Cell ─────────────────────────────────────────────────────────────────

class _DayCell extends StatelessWidget {
  final int dayNum;
  final int reward;
  final bool isPast;
  final bool isCurrent;
  final AnimationController? glowAnim;

  const _DayCell({
    required this.dayNum,
    required this.reward,
    required this.isPast,
    required this.isCurrent,
    this.glowAnim,
  });

  @override
  Widget build(BuildContext context) {
    if (isCurrent && glowAnim != null) {
      return AnimatedBuilder(
        animation: glowAnim!,
        builder: (_, __) => _buildCell(),
      );
    }
    return _buildCell();
  }

  Widget _buildCell() {
    Color bgColor;
    Color borderColor;
    Color textColor;
    Color iconColor;

    if (isPast) {
      bgColor = const Color(0xFF0D2D0D);
      borderColor = const Color(0xFF4CAF50).withOpacity(0.7);
      textColor = const Color(0xFF4CAF50);
      iconColor = const Color(0xFF4CAF50);
    } else if (isCurrent) {
      final glow = glowAnim?.value ?? 1.0;
      bgColor = Color.lerp(const Color(0xFF2A2000), const Color(0xFF3A2D00), glow)!;
      borderColor = const Color(0xFFFFD700);
      textColor = const Color(0xFFFFD700);
      iconColor = const Color(0xFFFFD700);
    } else {
      bgColor = const Color(0xFF1A1A2E);
      borderColor = const Color(0xFF333355);
      textColor = const Color(0xFF555577);
      iconColor = const Color(0xFF444466);
    }

    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
          width: isCurrent ? 40 : 34,
          height: isCurrent ? 52 : 46,
          decoration: BoxDecoration(
            color: bgColor,
            borderRadius: BorderRadius.circular(10),
            border: Border.all(color: borderColor, width: isCurrent ? 2 : 1),
            boxShadow: isCurrent
                ? [
                    BoxShadow(
                      color: const Color(0xFFFFD700).withOpacity(0.3),
                      blurRadius: 10,
                      spreadRadius: 1,
                    )
                  ]
                : null,
          ),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(
                isPast ? Icons.check_rounded : Icons.monetization_on_rounded,
                size: isCurrent ? 18 : 14,
                color: iconColor,
              ),
              const SizedBox(height: 2),
              Text(
                '$reward',
                style: TextStyle(
                  color: textColor,
                  fontSize: isCurrent ? 9 : 8,
                  fontWeight: FontWeight.bold,
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 4),
        Text(
          'N$dayNum',
          style: TextStyle(
            color: isCurrent ? const Color(0xFFFFD700) : const Color(0xFF444466),
            fontSize: 8,
            fontWeight: isCurrent ? FontWeight.bold : FontWeight.normal,
          ),
        ),
      ],
    );
  }
}
