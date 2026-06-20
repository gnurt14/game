// home_screen.dart — Màn hình Hub chính với 4 nhóm game + featured banner
//
// Layout:
//   ── Header (logo + tên + coin display)
//   ── Featured Banner (chỉ cho người chơi mới ≤ 7 ngày)
//   ── Mission Row (nhiệm vụ ngày)
//   ── Weekly Mission Row
//   ── Game Sections (4 nhóm dạng ListView)
//     🎰 May Mắn | 🎮 Hành Động | 🧩 Trí Tuệ | 🔤 Chiến Lược

import 'package:flutter/material.dart';
import '../auth/account_screen.dart';
import '../auth/auth_service.dart';
import '../coin/coin_service.dart';
import '../coin/daily_reward_dialog.dart';
import '../coin/shop_screen.dart';
import '../coin/weekly_mission_service.dart';
import '../multiplayer/screens/multiplayer_hub_screen.dart';
import 'game_entry.dart';

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  CoinData _coinData = CoinService.instance.notifier.value;
  WeeklyMissionData _weeklyData = WeeklyMissionService.instance.notifier.value;

  @override
  void initState() {
    super.initState();
    CoinService.instance.notifier.addListener(_onCoinUpdate);
    WeeklyMissionService.instance.notifier.addListener(_onWeeklyUpdate);
    WidgetsBinding.instance.addPostFrameCallback((_) => _checkDailyReward());
  }

  @override
  void dispose() {
    CoinService.instance.notifier.removeListener(_onCoinUpdate);
    WeeklyMissionService.instance.notifier.removeListener(_onWeeklyUpdate);
    super.dispose();
  }

  void _onCoinUpdate() {
    if (mounted) setState(() => _coinData = CoinService.instance.notifier.value);
  }

  void _onWeeklyUpdate() {
    if (mounted) setState(() => _weeklyData = WeeklyMissionService.instance.notifier.value);
  }

  String _formatBalance(int n) {
    if (n < 10000) return '$n';
    if (n < 1000000) return '${(n / 1000).truncate()}K';
    return '${(n / 1000000).toStringAsFixed(1)}M';
  }

  Future<void> _refreshData() async {
    await CoinService.instance.refreshFromSupabase();
  }

  Future<void> _checkDailyReward() async {
    final info = CoinService.instance.getDailyRewardInfo();
    if (info.shouldShow && mounted) {
      await DailyRewardDialog.show(context, info);
    }
  }

  Future<void> _launchGame(GameEntry entry) async {
    if (entry.builder == null) return;
    await Navigator.push(context, MaterialPageRoute(builder: entry.builder!));
    if (!mounted) return;

    final earned = await CoinService.instance.recordGamePlayed(entry.name);
    await WeeklyMissionService.instance.recordGamePlayed(entry.category);

    if (earned > 0 && mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Row(children: [
            const Text('🪙', style: TextStyle(fontSize: 16)),
            const SizedBox(width: 8),
            Text('+$earned xu từ ${entry.name}',
                style: const TextStyle(
                    fontWeight: FontWeight.bold, color: Color(0xFF2E7D32))),
          ]),
          backgroundColor: Colors.white,
          behavior: SnackBarBehavior.floating,
          shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(10),
              side: const BorderSide(color: Color(0xFF2E7D32), width: 2)),
          duration: const Duration(seconds: 2),
          margin: const EdgeInsets.fromLTRB(16, 0, 16, 20),
        ),
      );
    }
  }

  // ── Build ─────────────────────────────────────────────────────────────────

  @override
  Widget build(BuildContext context) {
    final isNewPlayer = AuthService.instance.isNewPlayer;
    final byCategory = kGamesByCategory;

    return Scaffold(
      backgroundColor: const Color(0xFF0A0A1A),
      body: SafeArea(
        child: RefreshIndicator(
          onRefresh: _refreshData,
          color: const Color(0xFF7C6FFF),
          backgroundColor: const Color(0xFF12122A),
          child: CustomScrollView(
          slivers: [
            // ── Sticky Header ─────────────────────────────────────────────
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(20, 24, 20, 0),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    _buildHeader(),
                    const SizedBox(height: 14),
                    if (isNewPlayer) ...[
                      _buildFeaturedBanner(),
                      const SizedBox(height: 14),
                    ],
                    _buildMissionBar(),
                    const SizedBox(height: 10),
                    _buildWeeklyMissionBar(),
                    const SizedBox(height: 18),
                  ],
                ),
              ),
            ),

            // ── Game Sections ─────────────────────────────────────────────
            for (final cat in GameCategory.values) ...[
              _buildSectionHeader(cat),
              _buildGameGrid(byCategory[cat] ?? []),
              const SliverToBoxAdapter(child: SizedBox(height: 24)),
            ],

            const SliverToBoxAdapter(child: SizedBox(height: 16)),
          ],
        ),
        ),
      ),
    );
  }

  // ── Header ────────────────────────────────────────────────────────────────

  Widget _buildHeader() {
    return Row(
      children: [
        Container(
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(
            gradient: const LinearGradient(
              colors: [Color(0xFF7C6FFF), Color(0xFFB06FFF)],
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
            ),
            borderRadius: BorderRadius.circular(14),
            boxShadow: [
              BoxShadow(
                color: const Color(0xFF7C6FFF).withOpacity(0.4),
                blurRadius: 16,
                offset: const Offset(0, 4),
              ),
            ],
          ),
          child: const Icon(Icons.sports_esports_rounded, color: Colors.white, size: 30),
        ),
        const SizedBox(width: 16),
        const Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'SUPER GATE',
              style: TextStyle(
                  color: Colors.white,
                  fontSize: 22,
                  fontWeight: FontWeight.w900,
                  letterSpacing: 2.5),
            ),
            Text(
              'Chọn game để bắt đầu',
              style: TextStyle(color: Color(0xFF7777AA), fontSize: 12),
            ),
          ],
        ),
        const Spacer(),
        // Nút tài khoản
        GestureDetector(
          onTap: () => Navigator.push(
              context, MaterialPageRoute(builder: (_) => const AccountScreen())),
          child: Container(
            width: 34,
            height: 34,
            margin: const EdgeInsets.only(right: 6),
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              gradient: const LinearGradient(
                colors: [Color(0xFF7C6FFF), Color(0xFFB06FFF)],
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
              ),
              boxShadow: [BoxShadow(
                color: const Color(0xFF7C6FFF).withOpacity(0.35),
                blurRadius: 10,
              )],
            ),
            child: Center(
              child: Text(
                AuthService.instance.displayName.isNotEmpty
                    ? AuthService.instance.displayName[0].toUpperCase()
                    : '?',
                style: const TextStyle(
                    color: Colors.white,
                    fontSize: 16,
                    fontWeight: FontWeight.w900),
              ),
            ),
          ),
        ),
        GestureDetector(
          onTap: () => Navigator.push(
              context, MaterialPageRoute(builder: (_) => const ShopScreen())),
          child: AnimatedContainer(
            duration: const Duration(milliseconds: 300),
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 9),
            decoration: BoxDecoration(
              color: const Color(0xFF1E1A00),
              borderRadius: BorderRadius.circular(20),
              border: Border.all(
                color: _coinData.boosterActive
                    ? const Color(0xFFFF6B00)
                    : const Color(0xFFFFD700).withOpacity(0.5),
                width: _coinData.boosterActive ? 2 : 1.5,
              ),
              boxShadow: _coinData.boosterActive
                  ? [BoxShadow(color: const Color(0xFFFF6B00).withOpacity(0.3), blurRadius: 8)]
                  : null,
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(_coinData.boosterActive ? '⚡' : '🪙',
                    style: const TextStyle(fontSize: 16)),
                const SizedBox(width: 6),
                Text(
                  _formatBalance(_coinData.balance),
                  style: const TextStyle(
                      color: Color(0xFFFFD700),
                      fontWeight: FontWeight.w900,
                      fontSize: 16),
                ),
                const SizedBox(width: 4),
                const Icon(Icons.storefront_rounded, color: Color(0xFF888866), size: 14),
              ],
            ),
          ),
        ),
      ],
    );
  }

  // ── Featured Banner (new player) ──────────────────────────────────────────

  Widget _buildFeaturedBanner() {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          colors: [Color(0xFF1A0A00), Color(0xFF0D0800)],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFFFF6B00).withOpacity(0.4)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Row(
            children: [
              Text('🔥', style: TextStyle(fontSize: 16)),
              SizedBox(width: 6),
              Text(
                'GỢI Ý CHO NGƯỜI MỚI',
                style: TextStyle(
                  color: Color(0xFFFF6B00),
                  fontSize: 11,
                  fontWeight: FontWeight.bold,
                  letterSpacing: 1.5,
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),
          SizedBox(
            height: 90,
            child: ListView(
              scrollDirection: Axis.horizontal,
              children: [
                _buildFeaturedMini('Bầu Cua', '🎲', const Color(0xFFE53935), 'Nhân ×3'),
                const SizedBox(width: 10),
                _buildFeaturedMini('Đỏ Đen', '🃏', const Color(0xFF7B0000), 'Nhân ×2'),
                const SizedBox(width: 10),
                _buildFeaturedMini('Xì Jack', '♠️', const Color(0xFF1B5E20), 'BJ ×2.5'),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildFeaturedMini(String name, String emoji, Color color, String badge) {
    final entry = kAllGames.firstWhere((g) => g.name == name);
    return GestureDetector(
      onTap: () => _launchGame(entry),
      child: Container(
        width: 120,
        padding: const EdgeInsets.all(10),
        decoration: BoxDecoration(
          gradient: LinearGradient(
            colors: [color.withOpacity(0.25), color.withOpacity(0.1)],
          ),
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: color.withOpacity(0.4)),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Text(emoji, style: const TextStyle(fontSize: 20)),
                const Spacer(),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 2),
                  decoration: BoxDecoration(
                    color: color.withOpacity(0.2),
                    borderRadius: BorderRadius.circular(5),
                    border: Border.all(color: color.withOpacity(0.4)),
                  ),
                  child: Text(badge,
                      style: TextStyle(
                          color: color, fontSize: 8, fontWeight: FontWeight.bold)),
                ),
              ],
            ),
            const Spacer(),
            Text(name,
                style: const TextStyle(
                    color: Colors.white, fontSize: 12, fontWeight: FontWeight.bold)),
            const SizedBox(height: 2),
            Text('CHƠI NGAY ▶',
                style: TextStyle(color: color, fontSize: 8, fontWeight: FontWeight.bold)),
          ],
        ),
      ),
    );
  }

  // ── Daily Mission Bar ─────────────────────────────────────────────────────

  Widget _buildMissionBar() {
    final m = CoinService.instance.getMissionStatus();

    if (m.allDone) {
      return Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
        decoration: BoxDecoration(
          color: const Color(0xFF0A1A0A),
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: const Color(0xFF2A5A2A)),
        ),
        child: const Row(
          children: [
            Icon(Icons.check_circle_rounded, color: Color(0xFF4CAF50), size: 18),
            SizedBox(width: 8),
            Text(
              'Nhiệm vụ hàng ngày hoàn thành! +300 xu',
              style: TextStyle(
                  color: Color(0xFF4CAF50), fontSize: 12, fontWeight: FontWeight.bold),
            ),
          ],
        ),
      );
    }

    return Column(
      children: [
        if (!m.mission3Collected)
          _MissionRow(
            label: 'Chơi 3 game khác nhau',
            reward: 100,
            progress: m.gamesPlayedCount,
            target: 3,
          ),
        if (!m.mission3Collected && !m.mission5Collected)
          const SizedBox(height: 6),
        if (!m.mission5Collected)
          _MissionRow(
            label: 'Chơi 5 game khác nhau',
            reward: 200,
            progress: m.gamesPlayedCount,
            target: 5,
          ),
      ],
    );
  }

  // ── Weekly Mission Bar ────────────────────────────────────────────────────

  Widget _buildWeeklyMissionBar() {
    if (_weeklyData.allCategoriesDone && _weeklyData.categoryRewardClaimed) {
      return Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
        decoration: BoxDecoration(
          color: const Color(0xFF001A1E),
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: const Color(0xFF00BCD4).withOpacity(0.4)),
        ),
        child: const Row(
          children: [
            Text('🏆', style: TextStyle(fontSize: 16)),
            SizedBox(width: 8),
            Text(
              'Nhiệm vụ tuần hoàn thành! +500 xu',
              style: TextStyle(
                  color: Color(0xFF00BCD4), fontSize: 12, fontWeight: FontWeight.bold),
            ),
          ],
        ),
      );
    }

    final done = _weeklyData.categoriesDone.length;
    const total = 4;
    final pct = (done / total).clamp(0.0, 1.0);

    return Container(
      padding: const EdgeInsets.fromLTRB(12, 9, 12, 9),
      decoration: BoxDecoration(
        color: const Color(0xFF0A0A1E),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: const Color(0xFF2A2A44)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Text('🗓️', style: TextStyle(fontSize: 13)),
              const SizedBox(width: 6),
              const Text(
                'NHIỆM VỤ TUẦN',
                style: TextStyle(
                    color: Color(0xFF00BCD4),
                    fontSize: 10,
                    fontWeight: FontWeight.bold,
                    letterSpacing: 1),
              ),
              const Spacer(),
              Text(
                '$done/$total nhóm game',
                style: const TextStyle(color: Color(0xFF7777AA), fontSize: 11),
              ),
            ],
          ),
          const SizedBox(height: 6),
          const Text(
            'Chơi ít nhất 1 game mỗi nhóm trong tuần',
            style: TextStyle(color: Color(0xFF8888AA), fontSize: 11),
          ),
          const SizedBox(height: 8),
          Row(
            children: [
              Expanded(
                child: ClipRRect(
                  borderRadius: BorderRadius.circular(4),
                  child: LinearProgressIndicator(
                    value: pct,
                    minHeight: 5,
                    backgroundColor: const Color(0xFF1E1E35),
                    valueColor: AlwaysStoppedAnimation<Color>(
                      pct >= 1.0 ? const Color(0xFF00BCD4) : const Color(0xFF7C6FFF),
                    ),
                  ),
                ),
              ),
              const SizedBox(width: 10),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                decoration: BoxDecoration(
                  color: const Color(0xFF001A1E),
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(color: const Color(0xFF00BCD4).withOpacity(0.4)),
                ),
                child: const Text(
                  '+500🪙',
                  style: TextStyle(
                      color: Color(0xFF00BCD4), fontSize: 11, fontWeight: FontWeight.bold),
                ),
              ),
            ],
          ),
          // Category badges
          const SizedBox(height: 8),
          Row(
            children: GameCategory.values.map((cat) {
              final done = _weeklyData.categoriesDone.contains(cat);
              return Expanded(
                child: Container(
                  margin: const EdgeInsets.only(right: 4),
                  padding: const EdgeInsets.symmetric(vertical: 4),
                  decoration: BoxDecoration(
                    color: done
                        ? cat.color.withOpacity(0.2)
                        : const Color(0xFF1A1A2A),
                    borderRadius: BorderRadius.circular(6),
                    border: Border.all(
                        color: done ? cat.color.withOpacity(0.5) : const Color(0xFF2A2A3A)),
                  ),
                  child: Text(
                    done ? '✓' : _catShortName(cat),
                    textAlign: TextAlign.center,
                    style: TextStyle(
                        color: done ? cat.color : const Color(0xFF555566),
                        fontSize: 9,
                        fontWeight: FontWeight.bold),
                  ),
                ),
              );
            }).toList(),
          ),
        ],
      ),
    );
  }

  String _catShortName(GameCategory cat) {
    switch (cat) {
      case GameCategory.lucky:    return '🎰';
      case GameCategory.action:   return '🎮';
      case GameCategory.puzzle:   return '🧩';
      case GameCategory.strategy: return '🔤';
    }
  }

  // ── Section Header ────────────────────────────────────────────────────────

  SliverToBoxAdapter _buildSectionHeader(GameCategory cat) {
    return SliverToBoxAdapter(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(20, 0, 20, 10),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Container(
                  width: 3,
                  height: 20,
                  decoration: BoxDecoration(
                    color: cat.color,
                    borderRadius: BorderRadius.circular(2),
                  ),
                ),
                const SizedBox(width: 10),
                Text(
                  cat.label,
                  style: TextStyle(
                    color: cat.color,
                    fontSize: 15,
                    fontWeight: FontWeight.w900,
                    letterSpacing: 0.5,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 4),
            Padding(
              padding: const EdgeInsets.only(left: 13),
              child: Text(
                cat.description,
                style: const TextStyle(color: Color(0xFF666688), fontSize: 11),
              ),
            ),
          ],
        ),
      ),
    );
  }

  // ── Game Grid ────────────────────────────────────────────────────────────

  SliverPadding _buildGameGrid(List<GameEntry> games) {
    return SliverPadding(
      padding: const EdgeInsets.symmetric(horizontal: 20),
      sliver: SliverGrid(
        gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
          crossAxisCount: 2,
          crossAxisSpacing: 14,
          mainAxisSpacing: 14,
          childAspectRatio: 0.78,
        ),
        delegate: SliverChildBuilderDelegate(
          (ctx, i) {
            final entry = games[i];
            final isGambling = entry.category == GameCategory.lucky;
            return _GameCard(
              entry: entry,
              onTap: entry.builder != null ? () => _launchGame(entry) : null,
              onMultiplayer: isGambling
                  ? () => Navigator.push(
                        context,
                        MaterialPageRoute(
                          builder: (_) => const MultiplayerHubScreen(),
                        ),
                      )
                  : null,
            );
          },
          childCount: games.length,
        ),
      ),
    );
  }
}

// =============================================================================
// GAME CARD
// =============================================================================

class _GameCard extends StatelessWidget {
  const _GameCard({required this.entry, this.onTap, this.onMultiplayer});
  final GameEntry entry;
  final VoidCallback? onTap;
  final VoidCallback? onMultiplayer;

  @override
  Widget build(BuildContext context) {
    final available = entry.builder != null;
    final cardGradient = available
        ? entry.gradient
        : entry.gradient
            .map((c) => Color.lerp(c, const Color(0xFF12121F), 0.62)!)
            .toList();

    return GestureDetector(
      onTap: onMultiplayer != null ? null : onTap, // gambling cards: tap buttons directly
      child: Container(
        decoration: BoxDecoration(
          gradient: LinearGradient(
              colors: cardGradient,
              begin: Alignment.topLeft,
              end: Alignment.bottomRight),
          borderRadius: BorderRadius.circular(20),
          boxShadow: available
              ? [
                  BoxShadow(
                    color: Color.lerp(entry.gradient.first, Colors.transparent, 0.6)!,
                    blurRadius: 14,
                    offset: const Offset(0, 5),
                  ),
                ]
              : null,
        ),
        child: Stack(
          children: [
            Positioned(
              right: -18,
              top: -18,
              child: Container(
                width: 80,
                height: 80,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: available ? Colors.white10 : const Color(0x0DFFFFFF),
                ),
              ),
            ),
            Padding(
              padding: const EdgeInsets.all(18),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Icon(entry.icon,
                      size: 38, color: available ? Colors.white : Colors.white30),
                  const Spacer(),
                  Text(
                    entry.name,
                    style: TextStyle(
                      color: available ? Colors.white : Colors.white30,
                      fontSize: 22,
                      fontWeight: FontWeight.w900,
                      letterSpacing: 0.5,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    entry.description,
                    style: TextStyle(
                      color: available ? Colors.white70 : const Color(0x33FFFFFF),
                      fontSize: 11,
                      height: 1.45,
                    ),
                  ),
                  if (available) ...[
                    const SizedBox(height: 10),
                    GestureDetector(
                      onTap: onTap,
                      child: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 7),
                        decoration: BoxDecoration(
                          color: Colors.white24,
                          borderRadius: BorderRadius.circular(24),
                          border: Border.all(color: Colors.white30),
                        ),
                        child: const Text(
                          'CHƠI NGAY  ▶',
                          style: TextStyle(
                            color: Colors.white,
                            fontSize: 10,
                            fontWeight: FontWeight.bold,
                            letterSpacing: 1.2,
                          ),
                        ),
                      ),
                    ),
                    if (onMultiplayer != null) ...[
                      const SizedBox(height: 6),
                      GestureDetector(
                        onTap: onMultiplayer,
                        child: Container(
                          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 7),
                          decoration: BoxDecoration(
                            color: const Color(0xFF7C6FFF).withOpacity(0.2),
                            borderRadius: BorderRadius.circular(24),
                            border: Border.all(color: const Color(0xFF7C6FFF).withOpacity(0.5)),
                          ),
                          child: const Text(
                            '👥 CÙNG BẠN',
                            style: TextStyle(
                              color: Color(0xFFB0A8FF),
                              fontSize: 10,
                              fontWeight: FontWeight.bold,
                              letterSpacing: 1.2,
                            ),
                          ),
                        ),
                      ),
                    ],
                  ],
                ],
              ),
            ),
            if (!available)
              Positioned(
                top: 12,
                right: 12,
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                  decoration: BoxDecoration(
                    color: Colors.white10,
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(color: const Color(0x33FFFFFF)),
                  ),
                  child: const Text(
                    'SẮP RA',
                    style: TextStyle(
                        color: Colors.white30,
                        fontSize: 9,
                        fontWeight: FontWeight.bold,
                        letterSpacing: 1),
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }
}

// =============================================================================
// MISSION ROW WIDGET
// =============================================================================

class _MissionRow extends StatelessWidget {
  const _MissionRow({
    required this.label,
    required this.reward,
    required this.progress,
    required this.target,
  });

  final String label;
  final int reward;
  final int progress;
  final int target;

  @override
  Widget build(BuildContext context) {
    final pct = (progress / target).clamp(0.0, 1.0);

    return Container(
      padding: const EdgeInsets.fromLTRB(12, 9, 12, 9),
      decoration: BoxDecoration(
        color: const Color(0xFF0F0F22),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: const Color(0xFF2A2A44)),
      ),
      child: Row(
        children: [
          const Text('🎮', style: TextStyle(fontSize: 14)),
          const SizedBox(width: 8),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Text(label,
                        style: const TextStyle(
                            color: Color(0xFFCCCCEE),
                            fontSize: 11,
                            fontWeight: FontWeight.w600)),
                    const Spacer(),
                    Text('${progress.clamp(0, target)}/$target',
                        style: const TextStyle(color: Color(0xFF7777AA), fontSize: 11)),
                  ],
                ),
                const SizedBox(height: 5),
                ClipRRect(
                  borderRadius: BorderRadius.circular(4),
                  child: LinearProgressIndicator(
                    value: pct,
                    minHeight: 5,
                    backgroundColor: const Color(0xFF1E1E35),
                    valueColor: AlwaysStoppedAnimation<Color>(
                      pct >= 1.0 ? const Color(0xFF4CAF50) : const Color(0xFF7C6FFF),
                    ),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(width: 10),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
            decoration: BoxDecoration(
              color: const Color(0xFF1E1A00),
              borderRadius: BorderRadius.circular(8),
              border: Border.all(color: const Color(0xFFFFD700).withOpacity(0.4)),
            ),
            child: Text(
              '+$reward🪙',
              style: const TextStyle(
                  color: Color(0xFFFFD700), fontSize: 11, fontWeight: FontWeight.bold),
            ),
          ),
        ],
      ),
    );
  }
}
