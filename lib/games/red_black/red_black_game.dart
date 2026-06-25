// red_black_game.dart — Đỏ Đen: Casino Card Game
//
// Luật chơi:
//   • Chọn mức xu cược (chip)
//   • Đặt cược vào ĐỎ (♥♦) hoặc ĐEN (♠♣)
//   • Lật bài: đúng → nhận 2× tiền cược (net +1×)
//   • Thắng → có thể GẤP ĐÔI (50/50) hoặc rút lui an toàn
//   • Win streak × N hiển thị badge lửa

import 'dart:math';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../../coin/coin_service.dart';
import '../shared/custom_bet_sheet.dart';

// ═══════════════════════════════════════════════════════════════
// Models
// ═══════════════════════════════════════════════════════════════

enum _Phase { idle, dealing, flip, result }

class _Card {
  final String suit; // ♥ ♦ ♠ ♣
  final String rank; // A 2–10 J Q K
  final bool isRed;
  const _Card(this.suit, this.rank, this.isRed);
}

// ═══════════════════════════════════════════════════════════════
// Screen
// ═══════════════════════════════════════════════════════════════

class RedBlackScreen extends StatefulWidget {
  const RedBlackScreen({super.key});
  @override
  State<RedBlackScreen> createState() => _RedBlackScreenState();
}

class _RedBlackScreenState extends State<RedBlackScreen>
    with TickerProviderStateMixin {

  // ── Constants ─────────────────────────────────────────────────
  static const _chips = [10, 25, 50, 100, 250, 500];
  static const _chipColors = [
    Color(0xFF9E9E9E), // 10  — xám
    Color(0xFF43A047), // 25  — xanh lá
    Color(0xFF1565C0), // 50  — xanh dương
    Color(0xFFE53935), // 100 — đỏ
    Color(0xFF8E24AA), // 250 — tím
    Color(0xFF37474F), // 500 — đen
  ];
  static const _suits = ['♥', '♦', '♠', '♣'];
  static const _ranks = ['A','2','3','4','5','6','7','8','9','10','J','Q','K'];

  // ── State ────────────────────────────────────────────────────
  _Phase _phase         = _Phase.idle;
  _Card? _card;
  bool?  _betOnRed;
  int    _betAmount     = 0;
  bool   _isWin           = false;
  bool   _choosingDouble  = false; // đang chờ user chọn đỏ/đen để gấp đôi
  int    _pendingDouble   = 0;   // xu đang giữ, có thể double
  int    _winStreak     = 0;
  int    _sessionProfit = 0;
  String _resultMsg     = '';
  List<bool> _history   = []; // true = lá đỏ

  final _rng = Random();

  // ── Animations ────────────────────────────────────────────────
  late final AnimationController _flipCtrl;
  late final AnimationController _glowCtrl;
  late final AnimationController _winCtrl;
  late final AnimationController _shakeCtrl;

  late final Animation<double> _flipAnim;
  late final Animation<double> _glowAnim;
  late final Animation<double> _winAnim;
  late final Animation<Offset>  _shakeAnim;

  // ── Lifecycle ─────────────────────────────────────────────────
  @override
  void initState() {
    super.initState();

    _flipCtrl  = AnimationController(vsync: this, duration: const Duration(milliseconds: 700));
    _glowCtrl  = AnimationController(vsync: this, duration: const Duration(milliseconds: 1300))
                   ..repeat(reverse: true);
    _winCtrl   = AnimationController(vsync: this, duration: const Duration(milliseconds: 650));
    _shakeCtrl = AnimationController(vsync: this, duration: const Duration(milliseconds: 480));

    _flipAnim  = CurvedAnimation(parent: _flipCtrl,  curve: Curves.easeInOut);
    _glowAnim  = CurvedAnimation(parent: _glowCtrl,  curve: Curves.easeInOut);
    _winAnim   = CurvedAnimation(parent: _winCtrl,   curve: Curves.elasticOut);
    _shakeAnim = TweenSequence<Offset>([
      TweenSequenceItem(tween: Tween(begin: Offset.zero,          end: const Offset(-15, 0)), weight: 1),
      TweenSequenceItem(tween: Tween(begin: const Offset(-15, 0), end: const Offset(15, 0)),  weight: 2),
      TweenSequenceItem(tween: Tween(begin: const Offset(15, 0),  end: const Offset(-9, 0)),  weight: 2),
      TweenSequenceItem(tween: Tween(begin: const Offset(-9, 0),  end: const Offset(9, 0)),   weight: 2),
      TweenSequenceItem(tween: Tween(begin: const Offset(9, 0),   end: Offset.zero),          weight: 1),
    ]).animate(CurvedAnimation(parent: _shakeCtrl, curve: Curves.easeInOut));

    CoinService.instance.notifier.addListener(_refresh);
  }

  @override
  void dispose() {
    CoinService.instance.notifier.removeListener(_refresh);
    _flipCtrl.dispose();
    _glowCtrl.dispose();
    _winCtrl.dispose();
    _shakeCtrl.dispose();
    super.dispose();
  }

  void _refresh() => setState(() {});

  // ── Helpers ──────────────────────────────────────────────────
  int get _coins => CoinService.instance.notifier.value.balance;

  Future<void> _openCustomBet() async {
    if (_phase != _Phase.idle) return;
    if (_coins <= 0) return;
    final picked = await showCustomBetSheet(
      context,
      balance: _coins,
      initial: _betAmount,
    );
    if (!mounted || picked == null) return;
    setState(() => _betAmount = picked);
  }

  _Card _draw() {
    final suit = _suits[_rng.nextInt(4)];
    final rank = _ranks[_rng.nextInt(13)];
    return _Card(suit, rank, suit == '♥' || suit == '♦');
  }

  List<bool> _pushHistory(bool isRed) {
    final h = [..._history, isRed];
    return h.length > 10 ? h.sublist(h.length - 10) : h;
  }

  // ── Game Flow ─────────────────────────────────────────────────
  Future<void> _placeBet(bool betOnRed) async {
    if (_betAmount <= 0) return;
    if (!await CoinService.instance.spendCoins(_betAmount)) return;

    setState(() {
      _betOnRed = betOnRed;
      _card     = null;
      _phase    = _Phase.dealing;
    });

    await Future.delayed(const Duration(milliseconds: 380));

    final card = _draw();
    setState(() { _card = card; _phase = _Phase.flip; });
    _flipCtrl.forward(from: 0);
    await Future.delayed(const Duration(milliseconds: 760));

    final won = (betOnRed == card.isRed);
    if (won) {
      final payout = _betAmount * 2;
      await CoinService.instance.earnCoins(payout);
      setState(() {
        _isWin         = true;
        _winStreak++;
        _pendingDouble  = payout;
        _sessionProfit += _betAmount;
        _resultMsg     = '✨  THẮNG  +$_betAmount xu!';
        _history       = _pushHistory(card.isRed);
        _phase         = _Phase.result;
      });
      _winCtrl.forward(from: 0);
      HapticFeedback.mediumImpact();
    } else {
      setState(() {
        _isWin          = false;
        _winStreak      = 0;
        _pendingDouble  = 0;
        _sessionProfit -= _betAmount;
        _resultMsg      = 'THUA  -$_betAmount xu';
        _history        = _pushHistory(card.isRed);
        _phase          = _Phase.result;
      });
      _shakeCtrl.forward(from: 0);
      HapticFeedback.heavyImpact();
    }
  }

  void _startDouble() => setState(() => _choosingDouble = true);

  Future<void> _doubleOrNothing(bool betOnRed) async {
    setState(() => _choosingDouble = false);
    final stake = _pendingDouble;
    if (!await CoinService.instance.spendCoins(stake)) return;

    setState(() {
      _betOnRed      = betOnRed;
      _card          = null;
      _pendingDouble = 0;
      _phase         = _Phase.dealing;
    });

    await Future.delayed(const Duration(milliseconds: 380));

    final card = _draw();
    setState(() { _card = card; _phase = _Phase.flip; });
    _flipCtrl.forward(from: 0);
    await Future.delayed(const Duration(milliseconds: 760));

    final won = (betOnRed == card.isRed);
    if (won) {
      await CoinService.instance.earnCoins(stake * 2);
      setState(() {
        _isWin         = true;
        _winStreak++;
        _pendingDouble  = stake * 2;
        _sessionProfit += stake;
        _resultMsg     = '🔥  GẤP ĐÔI!  +$stake xu';
        _history       = _pushHistory(card.isRed);
        _phase         = _Phase.result;
      });
      _winCtrl.forward(from: 0);
      HapticFeedback.mediumImpact();
    } else {
      setState(() {
        _isWin          = false;
        _winStreak      = 0;
        _pendingDouble  = 0;
        _sessionProfit -= stake;
        _resultMsg      = '💸  MẤT TRẮNG  -$stake xu';
        _history        = _pushHistory(card.isRed);
        _phase          = _Phase.result;
      });
      _shakeCtrl.forward(from: 0);
      HapticFeedback.heavyImpact();
    }
  }

  void _reset() => setState(() {
    _phase          = _Phase.idle;
    _card           = null;
    _betOnRed       = null;
    _betAmount      = 0;
    _pendingDouble  = 0;
    _choosingDouble = false;
    _resultMsg      = '';
  });

  // ═══════════════════════════════════════════════════════════════
  // Build
  // ═══════════════════════════════════════════════════════════════

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF06060F),
      body: SafeArea(
        child: Column(
          children: [
            _buildHeader(),
            Expanded(
              child: SingleChildScrollView(
                padding: const EdgeInsets.symmetric(horizontal: 16),
                child: Column(
                  children: [
                    const SizedBox(height: 14),
                    _buildHistory(),
                    const SizedBox(height: 22),
                    if (_winStreak >= 2) ...[_buildStreakBadge(), const SizedBox(height: 16)],
                    _buildCardZone(),
                    const SizedBox(height: 22),
                    if (_phase == _Phase.result) _buildResultPanel(),
                    const SizedBox(height: 20),
                  ],
                ),
              ),
            ),
            if (_phase == _Phase.idle) _buildBettingPanel(),
          ],
        ),
      ),
    );
  }

  // ── Header ────────────────────────────────────────────────────
  Widget _buildHeader() {
    return Container(
      padding: const EdgeInsets.fromLTRB(4, 8, 16, 8),
      decoration: const BoxDecoration(
        border: Border(bottom: BorderSide(color: Color(0x33EF5350))),
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
              '♦  ĐỎ ĐEN  ♠',
              textAlign: TextAlign.center,
              style: TextStyle(
                fontSize: 20, fontWeight: FontWeight.w900,
                color: Colors.white, letterSpacing: 6,
              ),
            ),
          ),
          // Coin badge
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
            decoration: BoxDecoration(
              color: const Color(0x22F9A825),
              borderRadius: BorderRadius.circular(20),
              border: Border.all(color: const Color(0x66F9A825)),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                const Text('🪙', style: TextStyle(fontSize: 14)),
                const SizedBox(width: 4),
                Text('$_coins',
                  style: const TextStyle(color: Color(0xFFF9A825),
                      fontWeight: FontWeight.bold, fontSize: 15)),
              ],
            ),
          ),
        ],
      ),
    );
  }

  // ── History row ───────────────────────────────────────────────
  Widget _buildHistory() {
    return Row(
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        const Text('Lịch sử:',
            style: TextStyle(color: Colors.white30, fontSize: 12)),
        const SizedBox(width: 8),
        for (int i = 0; i < 10; i++)
          Container(
            width: 18, height: 18,
            margin: const EdgeInsets.symmetric(horizontal: 2),
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              color: i < _history.length
                ? (_history[i] ? const Color(0xCCE53935) : const Color(0xCC455A64))
                : Colors.white.withOpacity(0.06),
              border: Border.all(
                color: i < _history.length
                  ? (_history[i] ? const Color(0xFFE53935) : const Color(0xFF546E7A))
                  : Colors.white12,
                width: 1.5,
              ),
            ),
          ),
      ],
    );
  }

  // ── Streak badge ─────────────────────────────────────────────
  Widget _buildStreakBadge() {
    return AnimatedBuilder(
      animation: _glowAnim,
      builder: (_, __) => Container(
        padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 10),
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(30),
          gradient: LinearGradient(colors: [
            Color.lerp(const Color(0xFFBF360C), const Color(0xFFFF6D00), _glowAnim.value)!,
            Color.lerp(const Color(0xFF880000), const Color(0xFFB71C1C), _glowAnim.value)!,
          ]),
          boxShadow: [BoxShadow(
            color: Colors.deepOrange.withOpacity(0.3 + 0.2 * _glowAnim.value),
            blurRadius: 18 + 10 * _glowAnim.value,
          )],
        ),
        child: Text(
          '🔥  STREAK × $_winStreak  🔥',
          style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold,
              fontSize: 16, letterSpacing: 2),
        ),
      ),
    );
  }

  // ── Card zone ────────────────────────────────────────────────
  Widget _buildCardZone() {
    return Column(
      children: [
        SizedBox(height: 225, child: Center(child: _buildCardWidget())),
        if (_phase != _Phase.idle && _betOnRed != null) ...[
          const SizedBox(height: 12),
          Text(
            'Cược: ${_betOnRed! ? "ĐỎ ♥♦" : "ĐEN ♠♣"}  •  $_betAmount xu',
            style: const TextStyle(color: Colors.white38, fontSize: 13),
          ),
        ],
      ],
    );
  }

  Widget _buildCardWidget() {
    switch (_phase) {
      case _Phase.idle:
        return _cardBack(pulse: false);

      case _Phase.dealing:
        return AnimatedBuilder(
          animation: _glowCtrl,
          builder: (_, __) => _cardBack(pulse: true),
        );

      case _Phase.flip:
      case _Phase.result:
        if (_card == null) return _cardBack(pulse: false);
        return AnimatedBuilder(
          animation: _flipAnim,
          builder: (_, __) {
            final angle = _flipAnim.value * pi;
            if (angle <= pi / 2) {
              return Transform(
                transform: Matrix4.identity()
                  ..setEntry(3, 2, 0.001)
                  ..rotateY(angle),
                alignment: Alignment.center,
                child: _cardBack(pulse: false),
              );
            } else {
              return Transform(
                transform: Matrix4.identity()
                  ..setEntry(3, 2, 0.001)
                  ..rotateY(pi - angle),
                alignment: Alignment.center,
                child: _cardFront(_card!),
              );
            }
          },
        );
    }
  }

  Widget _cardBack({required bool pulse}) {
    final t = pulse ? _glowAnim.value : 0.5;
    return Container(
      width: 158, height: 220,
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(18),
        gradient: LinearGradient(
          begin: Alignment.topLeft, end: Alignment.bottomRight,
          colors: [
            Color.lerp(const Color(0xFF1A0035), const Color(0xFF2E0055), t)!,
            const Color(0xFF0D0020),
          ],
        ),
        border: Border.all(
          color: const Color(0xFF7C6FFF).withOpacity(0.38 + 0.28 * t),
          width: 2,
        ),
        boxShadow: [BoxShadow(
          color: const Color(0xFF7C6FFF).withOpacity(0.1 + 0.14 * t),
          blurRadius: 18 + 12 * t,
        )],
      ),
      child: Center(
        child: CustomPaint(
          size: const Size(104, 148),
          painter: _CardBackPainter(t),
        ),
      ),
    );
  }

  Widget _cardFront(_Card card) {
    final fg   = card.isRed ? const Color(0xFFD50000) : const Color(0xFF212121);
    final glow = card.isRed ? const Color(0xFFE53935) : const Color(0xFF1565C0);

    return AnimatedBuilder(
      animation: _glowAnim,
      builder: (_, __) => Container(
        width: 158, height: 220,
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(18),
          color: Colors.white,
          boxShadow: [BoxShadow(
            color: glow.withOpacity(0.55 + 0.22 * _glowAnim.value),
            blurRadius: 30 + 16 * _glowAnim.value,
            spreadRadius: 3,
          )],
        ),
        child: Stack(children: [
          // Top-left corner
          Positioned(
            top: 10, left: 11,
            child: Column(crossAxisAlignment: CrossAxisAlignment.center, children: [
              Text(card.rank,
                style: TextStyle(color: fg, fontSize: 21,
                    fontWeight: FontWeight.bold, height: 1.1)),
              Text(card.suit,
                style: TextStyle(color: fg, fontSize: 17, height: 1.0)),
            ]),
          ),
          // Centre suit
          Center(child: Text(card.suit, style: TextStyle(
            color: fg, fontSize: 88,
            shadows: [Shadow(color: glow.withOpacity(0.22), blurRadius: 8)],
          ))),
          // Bottom-right (rotated 180°)
          Positioned(
            bottom: 10, right: 11,
            child: Transform.rotate(
              angle: pi,
              child: Column(crossAxisAlignment: CrossAxisAlignment.center, children: [
                Text(card.rank,
                  style: TextStyle(color: fg, fontSize: 21,
                      fontWeight: FontWeight.bold, height: 1.1)),
                Text(card.suit,
                  style: TextStyle(color: fg, fontSize: 17, height: 1.0)),
              ]),
            ),
          ),
        ]),
      ),
    );
  }

  // ── Result panel ─────────────────────────────────────────────
  Widget _buildResultPanel() {
    return Column(
      children: [
        // Win / Lose message
        AnimatedBuilder(
          animation: Listenable.merge([_winCtrl, _shakeCtrl]),
          builder: (_, __) {
            final offset = _isWin ? Offset.zero : _shakeAnim.value;
            final scale  = _isWin ? (0.5 + 0.5 * _winAnim.value) : 1.0;
            return Transform.translate(
              offset: offset,
              child: Transform.scale(
                scale: scale,
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 28, vertical: 14),
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(30),
                    gradient: _isWin ? const LinearGradient(colors: [
                      Color(0xFF1B5E20), Color(0xFF2E7D32),
                    ]) : null,
                    color: _isWin ? null : const Color(0xFF1A0A0A),
                    border: Border.all(
                      color: _isWin ? const Color(0xFF4CAF50) : const Color(0xFFEF5350),
                      width: 2,
                    ),
                    boxShadow: [BoxShadow(
                      color: (_isWin ? Colors.green : Colors.red).withOpacity(0.4),
                      blurRadius: 18,
                    )],
                  ),
                  child: Text(
                    _resultMsg,
                    textAlign: TextAlign.center,
                    style: TextStyle(
                      color: _isWin ? const Color(0xFF69F0AE) : const Color(0xFFEF9A9A),
                      fontSize: 20, fontWeight: FontWeight.bold,
                    ),
                  ),
                ),
              ),
            );
          },
        ),

        const SizedBox(height: 10),

        // Session profit
        Text(
          'Phiên: ${_sessionProfit >= 0 ? "+$_sessionProfit" : "$_sessionProfit"} xu',
          style: TextStyle(
            color: _sessionProfit >= 0 ? const Color(0xFF4CAF50) : const Color(0xFFEF5350),
            fontSize: 13,
          ),
        ),

        const SizedBox(height: 22),

        if (_isWin && _pendingDouble > 0) ...[
          if (_choosingDouble) ...[
            // Chọn ĐỎ hoặc ĐEN để gấp đôi
            const Text(
              'CHỌN ĐỎ HOẶC ĐEN',
              style: TextStyle(color: Colors.white54, fontSize: 11, letterSpacing: 2),
            ),
            const SizedBox(height: 12),
            Row(children: [
              Expanded(child: _buildDoubleChoiceButton(true)),
              const SizedBox(width: 10),
              Expanded(child: _buildDoubleChoiceButton(false)),
            ]),
            const SizedBox(height: 10),
            TextButton(
              onPressed: () => setState(() => _choosingDouble = false),
              child: const Text('Huỷ',
                  style: TextStyle(color: Colors.white38, fontSize: 13)),
            ),
          ] else ...[
            // Nút GẤP ĐÔI
            AnimatedBuilder(
              animation: _glowAnim,
              builder: (_, __) => GestureDetector(
                onTap: _startDouble,
                child: Container(
                  width: double.infinity,
                  padding: const EdgeInsets.symmetric(vertical: 20),
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(20),
                    gradient: LinearGradient(colors: [
                      Color.lerp(const Color(0xFFBF360C), const Color(0xFFE64A19), _glowAnim.value)!,
                      Color.lerp(const Color(0xFF880000), const Color(0xFFB71C1C), _glowAnim.value)!,
                    ]),
                    boxShadow: [BoxShadow(
                      color: Colors.red.withOpacity(0.3 + 0.18 * _glowAnim.value),
                      blurRadius: 18 + 10 * _glowAnim.value,
                    )],
                  ),
                  child: Column(children: [
                    const Text(
                      '🎲  GẤP ĐÔI HOẶC MẤT TRẮNG',
                      style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold,
                          fontSize: 16, letterSpacing: 1),
                    ),
                    const SizedBox(height: 5),
                    Text(
                      '$_pendingDouble xu  →  ${_pendingDouble * 2} xu  (50/50)',
                      style: const TextStyle(color: Colors.white60, fontSize: 12),
                    ),
                  ]),
                ),
              ),
            ),
            const SizedBox(height: 10),
            TextButton(
              onPressed: _reset,
              child: Text(
                '✓  Giữ $_pendingDouble xu và rút lui',
                style: const TextStyle(color: Colors.white54, fontSize: 14),
              ),
            ),
          ],
        ] else ...[
          SizedBox(
            width: double.infinity,
            child: ElevatedButton(
              onPressed: _reset,
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFF7C6FFF),
                padding: const EdgeInsets.symmetric(vertical: 16),
                shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(20)),
              ),
              child: const Text('Chơi lại',
                style: TextStyle(color: Colors.white, fontSize: 16,
                    fontWeight: FontWeight.bold)),
            ),
          ),
        ],
      ],
    );
  }

  // ── Betting panel ─────────────────────────────────────────────
  Widget _buildBettingPanel() {
    return Container(
      padding: const EdgeInsets.fromLTRB(16, 14, 16, 24),
      decoration: const BoxDecoration(
        color: Color(0xFF09090F),
        border: Border(top: BorderSide(color: Color(0x22FFFFFF))),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          const Text('CHỌN MỨC CƯỢC',
              style: TextStyle(color: Color(0x44FFFFFF), fontSize: 11, letterSpacing: 2)),
          const SizedBox(height: 10),
          _buildChipRow(),
          const SizedBox(height: 16),
          Row(children: [
            Expanded(child: _buildBetButton(true)),
            const SizedBox(width: 10),
            Expanded(child: _buildBetButton(false)),
          ]),
        ],
      ),
    );
  }

  Widget _buildChipRow() {
    final isCustom = _betAmount > 0 &&
        !_chips.contains(_betAmount) &&
        _betAmount != _coins;
    return Wrap(
      spacing: 8, runSpacing: 8,
      alignment: WrapAlignment.center,
      children: [
        for (int i = 0; i < _chips.length; i++)
          _buildChip(_chips[i], _chipColors[i]),
        // Custom bet pill
        GestureDetector(
          onTap: _coins > 0 ? _openCustomBet : null,
          child: AnimatedContainer(
            duration: const Duration(milliseconds: 150),
            width: 44, height: 44,
            alignment: Alignment.center,
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(10),
              color: isCustom
                  ? const Color(0xFFFFD700).withOpacity(0.22)
                  : Colors.white.withOpacity(0.05),
              border: Border.all(
                color: const Color(0xFFFFD700).withOpacity(isCustom ? 1 : 0.5),
                width: isCustom ? 2 : 1.5,
              ),
            ),
            child: Icon(
              Icons.tune_rounded,
              size: 18,
              color: isCustom ? const Color(0xFFFFD700) : Colors.amber,
            ),
          ),
        ),
        // All-in pill
        GestureDetector(
          onTap: _coins > 0 ? () => setState(() => _betAmount = _coins) : null,
          child: AnimatedContainer(
            duration: const Duration(milliseconds: 150),
            width: 44, height: 44,
            alignment: Alignment.center,
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(10),
              color: (_betAmount == _coins && _coins > 0)
                ? const Color(0xFFB71C1C)
                : Colors.white.withOpacity(0.05),
              border: Border.all(color: Colors.red.withOpacity(0.5), width: 1.5),
            ),
            child: const Text('ALL\nIN', textAlign: TextAlign.center,
              style: TextStyle(color: Colors.redAccent,
                  fontWeight: FontWeight.bold, fontSize: 10)),
          ),
        ),
      ],
    );
  }

  Widget _buildChip(int amount, Color color) {
    final sel = _betAmount == amount;
    final ok  = amount <= _coins;
    return GestureDetector(
      onTap: ok ? () => setState(() => _betAmount = amount) : null,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 150),
        width: 44, height: 44,
        decoration: BoxDecoration(
          shape: BoxShape.circle,
          color: sel ? color : color.withOpacity(ok ? 0.22 : 0.06),
          border: Border.all(
            color: color.withOpacity(ok ? (sel ? 1.0 : 0.48) : 0.12),
            width: sel ? 3 : 1.5,
          ),
          boxShadow: sel
            ? [BoxShadow(color: color.withOpacity(0.55), blurRadius: 12)]
            : null,
        ),
        child: Center(child: Text(
          amount >= 1000 ? '${amount ~/ 1000}K' : '$amount',
          style: TextStyle(
            color: sel ? Colors.white : (ok ? Colors.white70 : Colors.white24),
            fontSize: 11, fontWeight: FontWeight.bold,
          ),
        )),
      ),
    );
  }

  Widget _buildDoubleChoiceButton(bool isRed) {
    final mainColor = isRed ? const Color(0xFFE53935) : const Color(0xFF546E7A);
    final glowColor = isRed ? const Color(0xFFE53935) : const Color(0xFF1565C0);
    return GestureDetector(
      onTap: () => _doubleOrNothing(isRed),
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 20),
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(18),
          gradient: LinearGradient(
            begin: Alignment.topLeft, end: Alignment.bottomRight,
            colors: isRed
              ? [const Color(0xFFB71C1C), const Color(0xFF7B0000)]
              : [const Color(0xFF263238), const Color(0xFF102027)],
          ),
          border: Border.all(color: mainColor.withOpacity(0.8), width: 2),
          boxShadow: [BoxShadow(color: glowColor.withOpacity(0.35), blurRadius: 14)],
        ),
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          Text(isRed ? 'ĐỎ' : 'ĐEN', style: const TextStyle(
            color: Colors.white, fontSize: 22,
            fontWeight: FontWeight.w900, letterSpacing: 4,
          )),
          Text(isRed ? '♥  ♦' : '♠  ♣', style: TextStyle(
            color: isRed ? const Color(0xFFEF9A9A) : const Color(0xFF90A4AE),
            fontSize: 20,
          )),
        ]),
      ),
    );
  }

  Widget _buildBetButton(bool isRed) {
    final enabled   = _betAmount > 0 && _betAmount <= _coins;
    final mainColor = isRed ? const Color(0xFFE53935) : const Color(0xFF546E7A);
    final glowColor = isRed ? const Color(0xFFE53935) : const Color(0xFF1565C0);

    return GestureDetector(
      onTap: enabled ? () => _placeBet(isRed) : null,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 150),
        padding: const EdgeInsets.symmetric(vertical: 20),
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(18),
          gradient: enabled ? LinearGradient(
            begin: Alignment.topLeft, end: Alignment.bottomRight,
            colors: isRed
              ? [const Color(0xFFB71C1C), const Color(0xFF7B0000)]
              : [const Color(0xFF263238), const Color(0xFF102027)],
          ) : null,
          color: enabled ? null : Colors.white.withOpacity(0.04),
          border: Border.all(
            color: mainColor.withOpacity(enabled ? 0.8 : 0.2), width: 2),
          boxShadow: enabled ? [BoxShadow(
            color: glowColor.withOpacity(0.35), blurRadius: 14)] : null,
        ),
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          Text(isRed ? 'ĐỎ' : 'ĐEN', style: TextStyle(
            color: enabled ? Colors.white : Colors.white24,
            fontSize: 22, fontWeight: FontWeight.w900, letterSpacing: 4,
          )),
          Text(isRed ? '♥  ♦' : '♠  ♣', style: TextStyle(
            color: enabled
              ? (isRed ? const Color(0xFFEF9A9A) : const Color(0xFF90A4AE))
              : Colors.white12,
            fontSize: 20,
          )),
        ]),
      ),
    );
  }
}

// ═══════════════════════════════════════════════════════════════
// Card Back Painter — lưới kim cương + logo SG
// ═══════════════════════════════════════════════════════════════

class _CardBackPainter extends CustomPainter {
  final double t; // 0.0–1.0 cho hiệu ứng pulse
  const _CardBackPainter(this.t);

  @override
  void paint(Canvas canvas, Size size) {
    // Lưới kim cương nền
    final grid = Paint()
      ..color = const Color(0xFF7C6FFF).withOpacity(0.10 + 0.06 * t)
      ..strokeWidth = 0.8
      ..style = PaintingStyle.stroke;

    const step = 13.0;
    for (double x = -step; x < size.width + step; x += step) {
      for (double y = -step; y < size.height + step; y += step) {
        canvas.drawPath(
          Path()
            ..moveTo(x + step / 2, y)
            ..lineTo(x + step, y + step / 2)
            ..lineTo(x + step / 2, y + step)
            ..lineTo(x, y + step / 2)
            ..close(),
          grid,
        );
      }
    }

    final cx = size.width / 2;
    final cy = size.height / 2;

    // Vòng tròn trang trí
    canvas.drawCircle(
      Offset(cx, cy), 28,
      Paint()
        ..color = const Color(0xFF7C6FFF).withOpacity(0.18 + 0.10 * t)
        ..strokeWidth = 1.2
        ..style = PaintingStyle.stroke,
    );

    // Kim cương trung tâm
    canvas.drawPath(
      Path()
        ..moveTo(cx, cy - 18)
        ..lineTo(cx + 13, cy)
        ..lineTo(cx, cy + 18)
        ..lineTo(cx - 13, cy)
        ..close(),
      Paint()
        ..color = const Color(0xFF7C6FFF).withOpacity(0.32 + 0.18 * t)
        ..strokeWidth = 1.5
        ..style = PaintingStyle.stroke,
    );

    // Text "SG"
    final tp = TextPainter(
      text: TextSpan(
        text: 'SG',
        style: TextStyle(
          color: const Color(0xFF7C6FFF).withOpacity(0.45 + 0.15 * t),
          fontSize: 12, fontWeight: FontWeight.bold,
        ),
      ),
      textDirection: TextDirection.ltr,
    )..layout();
    tp.paint(canvas, Offset(cx - tp.width / 2, cy - tp.height / 2));
  }

  @override
  bool shouldRepaint(_CardBackPainter old) => old.t != t;
}
