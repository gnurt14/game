// account_screen.dart — Trang tài khoản: xem thông tin, đổi tên, đăng xuất

import 'package:flutter/material.dart';
import '../auth/auth_service.dart';
import '../coin/coin_service.dart';

class AccountScreen extends StatefulWidget {
  const AccountScreen({super.key});
  @override
  State<AccountScreen> createState() => _AccountScreenState();
}

class _AccountScreenState extends State<AccountScreen> {
  bool _saving = false;

  String get _displayName => AuthService.instance.displayName;
  String get _email       => AuthService.instance.currentUser?.email ?? '';
  int    get _coins       => CoinService.instance.notifier.value.balance;

  void _onCoinUpdate() => setState(() {});

  @override
  void initState() {
    super.initState();
    CoinService.instance.notifier.addListener(_onCoinUpdate);
  }

  @override
  void dispose() {
    CoinService.instance.notifier.removeListener(_onCoinUpdate);
    super.dispose();
  }

  // ── Đổi tên hiển thị ─────────────────────────────────────────────────────

  Future<void> _editDisplayName() async {
    final ctrl = TextEditingController(text: _displayName);
    final result = await showDialog<String>(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: const Color(0xFF12122A),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        title: const Text('Đổi tên hiển thị',
            style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
        content: TextField(
          controller: ctrl,
          autofocus: true,
          maxLength: 20,
          style: const TextStyle(color: Colors.white),
          decoration: InputDecoration(
            hintText: 'Nhập tên mới...',
            hintStyle: const TextStyle(color: Colors.white38),
            counterStyle: const TextStyle(color: Colors.white38),
            filled: true,
            fillColor: const Color(0xFF1E1E3A),
            border: OutlineInputBorder(
              borderRadius: BorderRadius.circular(12),
              borderSide: BorderSide.none,
            ),
            focusedBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(12),
              borderSide: const BorderSide(color: Color(0xFF7C6FFF), width: 2),
            ),
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('Huỷ', style: TextStyle(color: Colors.white38)),
          ),
          TextButton(
            onPressed: () => Navigator.pop(ctx, ctrl.text.trim()),
            child: const Text('Lưu',
                style: TextStyle(color: Color(0xFF7C6FFF), fontWeight: FontWeight.bold)),
          ),
        ],
      ),
    );

    if (result == null || result.isEmpty || result == _displayName) return;
    setState(() => _saving = true);
    await AuthService.instance.updateDisplayName(result);
    if (mounted) setState(() => _saving = false);
  }

  // ── Đăng xuất ────────────────────────────────────────────────────────────

  Future<void> _signOut() async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: const Color(0xFF12122A),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        title: const Text('Đăng xuất?',
            style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
        content: const Text('Bạn có chắc muốn đăng xuất không?',
            style: TextStyle(color: Colors.white60)),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('Huỷ', style: TextStyle(color: Colors.white38)),
          ),
          TextButton(
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('Đăng xuất',
                style: TextStyle(color: Color(0xFFEF5350), fontWeight: FontWeight.bold)),
          ),
        ],
      ),
    );

    if (ok != true) return;
    await CoinService.instance.clearLocalData();
    await AuthService.instance.signOut();
    // Pop về root để _AppGate tự rebuild sang AuthScreen
    if (mounted) Navigator.of(context).pop();
  }

  // ── Build ─────────────────────────────────────────────────────────────────

  @override
  Widget build(BuildContext context) {
    final player   = AuthService.instance.player;
    final initials = _displayName.isNotEmpty ? _displayName[0].toUpperCase() : '?';

    return Scaffold(
      backgroundColor: const Color(0xFF0A0A1A),
      body: SafeArea(
        child: Column(
          children: [
            _buildHeader(),
            Expanded(
              child: SingleChildScrollView(
                padding: const EdgeInsets.fromLTRB(20, 0, 20, 32),
                child: Column(
                  children: [
                    const SizedBox(height: 32),

                    // ── Avatar ────────────────────────────────────────────
                    Container(
                      width: 90,
                      height: 90,
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        gradient: const LinearGradient(
                          colors: [Color(0xFF7C6FFF), Color(0xFFB06FFF)],
                          begin: Alignment.topLeft,
                          end: Alignment.bottomRight,
                        ),
                        boxShadow: [BoxShadow(
                          color: const Color(0xFF7C6FFF).withOpacity(0.45),
                          blurRadius: 24, spreadRadius: 2,
                        )],
                      ),
                      child: Center(
                        child: Text(
                          initials,
                          style: const TextStyle(
                            color: Colors.white,
                            fontSize: 40,
                            fontWeight: FontWeight.w900,
                          ),
                        ),
                      ),
                    ),

                    const SizedBox(height: 16),

                    // ── Tên hiển thị ──────────────────────────────────────
                    Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        if (_saving)
                          const SizedBox(
                            width: 16, height: 16,
                            child: CircularProgressIndicator(
                                strokeWidth: 2, color: Color(0xFF7C6FFF)),
                          )
                        else
                          Text(
                            _displayName,
                            style: const TextStyle(
                              color: Colors.white,
                              fontSize: 22,
                              fontWeight: FontWeight.w900,
                            ),
                          ),
                        const SizedBox(width: 8),
                        GestureDetector(
                          onTap: _editDisplayName,
                          child: const Icon(Icons.edit_rounded,
                              color: Color(0xFF7C6FFF), size: 18),
                        ),
                      ],
                    ),

                    const SizedBox(height: 6),

                    // ── Email ─────────────────────────────────────────────
                    Text(
                      _email,
                      style: const TextStyle(color: Color(0xFF6666AA), fontSize: 13),
                    ),

                    const SizedBox(height: 32),

                    // ── Stat cards ────────────────────────────────────────
                    _buildStatGrid(player),

                    const SizedBox(height: 28),

                    // ── Thông tin tài khoản ───────────────────────────────
                    _buildInfoSection(player),

                    const SizedBox(height: 32),

                    // ── Đăng xuất ─────────────────────────────────────────
                    SizedBox(
                      width: double.infinity,
                      child: OutlinedButton.icon(
                        onPressed: _signOut,
                        icon: const Icon(Icons.logout_rounded,
                            color: Color(0xFFEF5350), size: 20),
                        label: const Text(
                          'Đăng xuất',
                          style: TextStyle(
                            color: Color(0xFFEF5350),
                            fontSize: 15,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                        style: OutlinedButton.styleFrom(
                          padding: const EdgeInsets.symmetric(vertical: 16),
                          side: const BorderSide(color: Color(0x66EF5350), width: 1.5),
                          shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(16)),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  // ── Header ────────────────────────────────────────────────────────────────

  Widget _buildHeader() {
    return Container(
      padding: const EdgeInsets.fromLTRB(4, 8, 16, 8),
      decoration: const BoxDecoration(
        border: Border(bottom: BorderSide(color: Color(0x22FFFFFF))),
      ),
      child: Row(
        children: [
          IconButton(
            onPressed: () => Navigator.pop(context),
            icon: const Icon(Icons.arrow_back_ios_new_rounded,
                color: Colors.white60, size: 20),
          ),
          const Expanded(
            child: Text(
              'Tài khoản',
              textAlign: TextAlign.center,
              style: TextStyle(
                color: Colors.white,
                fontSize: 18,
                fontWeight: FontWeight.w800,
                letterSpacing: 1,
              ),
            ),
          ),
          const SizedBox(width: 48), // cân bằng với nút back
        ],
      ),
    );
  }

  // ── Stat grid ─────────────────────────────────────────────────────────────

  Widget _buildStatGrid(player) {
    final stats = [
      _StatItem(icon: '🪙', label: 'Xu hiện tại',      value: '$_coins'),
      _StatItem(icon: '🔥', label: 'Streak',            value: '${player?.streakDay ?? 0} ngày'),
      _StatItem(icon: '🎮', label: 'Đã chơi',          value: '${player?.totalGamesPlayed ?? 0} game'),
      _StatItem(icon: '🎁', label: 'Hộp may mắn',      value: '${player?.freeLuckyBoxes ?? 0}'),
    ];

    return GridView.count(
      crossAxisCount: 2,
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      crossAxisSpacing: 12,
      mainAxisSpacing: 12,
      childAspectRatio: 2.0,
      children: stats.map(_buildStatCard).toList(),
    );
  }

  Widget _buildStatCard(_StatItem s) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      decoration: BoxDecoration(
        color: const Color(0xFF0F0F22),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: const Color(0xFF2A2A44)),
      ),
      child: Row(
        children: [
          Text(s.icon, style: const TextStyle(fontSize: 22)),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Text(s.value,
                    style: const TextStyle(
                        color: Colors.white,
                        fontSize: 15,
                        fontWeight: FontWeight.w900)),
                Text(s.label,
                    style: const TextStyle(
                        color: Color(0xFF6666AA), fontSize: 11)),
              ],
            ),
          ),
        ],
      ),
    );
  }

  // ── Info section ──────────────────────────────────────────────────────────

  Widget _buildInfoSection(player) {
    final createdAt = player?.createdAt;
    final memberSince = createdAt != null
        ? '${createdAt.day}/${createdAt.month}/${createdAt.year}'
        : '—';

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: const Color(0xFF0F0F22),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFF2A2A44)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'THÔNG TIN TÀI KHOẢN',
            style: TextStyle(
                color: Color(0xFF6666AA),
                fontSize: 11,
                fontWeight: FontWeight.bold,
                letterSpacing: 1.5),
          ),
          const SizedBox(height: 14),
          _infoRow('Email', _email),
          const _Divider(),
          _infoRow('Tên hiển thị', _displayName),
          const _Divider(),
          _infoRow('Thành viên từ', memberSince),
          const _Divider(),
          _infoRow('ID', AuthService.instance.currentUser?.id.substring(0, 8) ?? '—',
              mono: true),
        ],
      ),
    );
  }

  Widget _infoRow(String label, String value, {bool mono = false}) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 10),
      child: Row(
        children: [
          Text(label,
              style: const TextStyle(color: Color(0xFF8888AA), fontSize: 13)),
          const Spacer(),
          Text(
            value,
            style: TextStyle(
              color: Colors.white70,
              fontSize: 13,
              fontFamily: mono ? 'monospace' : null,
            ),
          ),
        ],
      ),
    );
  }
}

// ── Helpers ──────────────────────────────────────────────────────────────────

class _StatItem {
  final String icon, label, value;
  const _StatItem({required this.icon, required this.label, required this.value});
}

class _Divider extends StatelessWidget {
  const _Divider();
  @override
  Widget build(BuildContext context) =>
      const Divider(color: Color(0xFF1E1E35), height: 1);
}
