// bau_cua_game.dart — Bầu Cua Tôm Cá (Vietnamese Dice Game)
//
// Luật chơi:
//   • 3 xúc xắc, mỗi mặt là 1 trong 6 con: Bầu/Cua/Tôm/Cá/Nai/Gà
//   • Chọn 1 con + số xu cược (lấy từ CoinService)
//   • Kết quả: mỗi xúc xắc khớp con cược → thắng 1× tiền cược
//     – 0 khớp → mất toàn bộ tiền cược
//     – 1 khớp → +1× (nhận lại tiền cược + lãi 1×)
//     – 2 khớp → +2× (nhận lại tiền cược + lãi 2×)
//     – 3 khớp → +3× (nhận lại tiền cược + lãi 3×)

import 'dart:async';
import 'dart:math';
import 'package:flutter/material.dart';
import '../../coin/coin_service.dart';

// =============================================================================
// CONSTANTS
// =============================================================================

enum _Sym { bau, cua, tom, ca, nai, ga }

const _emoji = {
  _Sym.bau: '🍐',
  _Sym.cua: '🦀',
  _Sym.tom: '🦐',
  _Sym.ca:  '🐠',
  _Sym.nai: '🦌',
  _Sym.ga:  '🐓',
};

const _label = {
  _Sym.bau: 'Bầu',
  _Sym.cua: 'Cua',
  _Sym.tom: 'Tôm',
  _Sym.ca:  'Cá',
  _Sym.nai: 'Nai',
  _Sym.ga:  'Gà',
};

const _chips = [10, 25, 50, 100, 200, 500];

enum _Phase { idle, rolling, result }

// =============================================================================
// SCREEN
// =============================================================================

class BauCuaScreen extends StatefulWidget {
  const BauCuaScreen({super.key});
  @override
  State<BauCuaScreen> createState() => _BauCuaScreenState();
}

class _BauCuaScreenState extends State<BauCuaScreen>
    with TickerProviderStateMixin {
  // ── Coin ─────────────────────────────────────────────────────────────────
  CoinData _coinData = CoinService.instance.notifier.value;

  // ── Game state ────────────────────────────────────────────────────────────
  _Phase _phase = _Phase.idle;
  _Sym? _selected;   // con người chơi đặt cược
  int _betAmount = 0;

  // ── Dice ──────────────────────────────────────────────────────────────────
  final _dice = List<_Sym>.filled(3, _Sym.bau, growable: false);
  final _locked = [false, false, false]; // đã dừng lắc

  // ── Result ────────────────────────────────────────────────────────────────
  int _lastDelta = 0;  // lãi (dương) hoặc thua (âm)
  int _matchCount = 0;

  // ── Rolling animation ─────────────────────────────────────────────────────
  Timer? _timer;
  int _elapsed = 0;
  final _rng = Random();

  late final List<AnimationController> _shakeCtrl;
  late final List<Animation<double>> _shakeAnim;

  // ── Init / dispose ────────────────────────────────────────────────────────

  @override
  void initState() {
    super.initState();
    CoinService.instance.notifier.addListener(_onCoin);

    // Xúc xắc ban đầu ngẫu nhiên
    for (int i = 0; i < 3; i++) {
      _dice[i] = _Sym.values[_rng.nextInt(6)];
    }

    _shakeCtrl = List.generate(
      3,
      (_) => AnimationController(
        vsync: this,
        duration: const Duration(milliseconds: 55),
      ),
    );
    _shakeAnim = _shakeCtrl
        .map((c) => Tween<double>(begin: -5, end: 5).animate(c))
        .toList();
  }

  @override
  void dispose() {
    CoinService.instance.notifier.removeListener(_onCoin);
    _timer?.cancel();
    for (final c in _shakeCtrl) {
      c.dispose();
    }
    super.dispose();
  }

  void _onCoin() {
    if (mounted) setState(() => _coinData = CoinService.instance.notifier.value);
  }

  // ── Actions ───────────────────────────────────────────────────────────────

  void _pickSym(_Sym s) {
    if (_phase != _Phase.idle) return;
    setState(() => _selected = s);
  }

  void _pickChip(int amount) {
    if (_phase != _Phase.idle) return;
    if (amount > _coinData.balance) return;
    setState(() => _betAmount = amount);
  }

  Future<void> _roll() async {
    if (_phase != _Phase.idle) return;
    if (_selected == null || _betAmount == 0) return;

    final ok = await CoinService.instance.spendCoins(_betAmount);
    if (!ok) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Không đủ xu để cược!'),
            behavior: SnackBarBehavior.floating,
            duration: Duration(seconds: 2),
          ),
        );
      }
      return;
    }

    // Tính kết quả xúc xắc trước, hiện animation sau
    final finalDice = List.generate(3, (_) => _Sym.values[_rng.nextInt(6)]);

    setState(() {
      _phase = _Phase.rolling;
      _locked[0] = _locked[1] = _locked[2] = false;
    });

    for (final c in _shakeCtrl) {
      c.repeat(reverse: true);
    }

    _elapsed = 0;
    _timer = Timer.periodic(const Duration(milliseconds: 70), (t) {
      if (!mounted) {
        t.cancel();
        return;
      }
      _elapsed += 70;

      // Xáo xúc xắc đang quay
      for (int i = 0; i < 3; i++) {
        if (!_locked[i]) _dice[i] = _Sym.values[_rng.nextInt(6)];
      }

      // Dừng từng xúc xắc lần lượt
      if (_elapsed >= 1100 && !_locked[0]) {
        _locked[0] = true;
        _dice[0] = finalDice[0];
        _shakeCtrl[0].stop();
        _shakeCtrl[0].reset();
      }
      if (_elapsed >= 1400 && !_locked[1]) {
        _locked[1] = true;
        _dice[1] = finalDice[1];
        _shakeCtrl[1].stop();
        _shakeCtrl[1].reset();
      }
      if (_elapsed >= 1700 && !_locked[2]) {
        _locked[2] = true;
        _dice[2] = finalDice[2];
        _shakeCtrl[2].stop();
        _shakeCtrl[2].reset();
        t.cancel();
        setState(() {});
        _settle(finalDice);
        return;
      }

      setState(() {});
    });
  }

  Future<void> _settle(List<_Sym> finalDice) async {
    final matches = finalDice.where((d) => d == _selected).length;
    int delta;
    if (matches > 0) {
      delta = _betAmount * matches;
      await CoinService.instance.earnCoins(_betAmount + delta);
    } else {
      delta = -_betAmount;
    }
    if (mounted) {
      setState(() {
        _matchCount = matches;
        _lastDelta = delta;
        _phase = _Phase.result;
      });
    }
  }

  void _continueGame() {
    setState(() {
      _phase = _Phase.idle;
      _lastDelta = 0;
      _matchCount = 0;
    });
  }

  // ── Build ─────────────────────────────────────────────────────────────────

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF0A0A1A),
      body: SafeArea(
        child: Column(
          children: [
            _buildHeader(),
            Expanded(
              child: SingleChildScrollView(
                padding: const EdgeInsets.fromLTRB(20, 16, 20, 24),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    _buildDiceArea(),
                    const SizedBox(height: 20),
                    _buildSymbolGrid(),
                    const SizedBox(height: 16),
                    _buildChips(),
                    const SizedBox(height: 12),
                    _buildBetSummary(),
                    const SizedBox(height: 12),
                    if (_phase == _Phase.result) ...[
                      _buildResultBanner(),
                      const SizedBox(height: 12),
                    ],
                    _buildButton(),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  // Header
  Widget _buildHeader() {
    return Container(
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 12),
      color: const Color(0xFF0F0F22),
      child: Row(
        children: [
          IconButton(
            onPressed: () => Navigator.pop(context),
            icon: const Icon(
              Icons.arrow_back_ios_new_rounded,
              color: Colors.white70,
              size: 20,
            ),
            padding: EdgeInsets.zero,
            constraints: const BoxConstraints(),
          ),
          const SizedBox(width: 12),
          const Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Bầu Cua Tôm Cá',
                  style: TextStyle(
                    color: Colors.white,
                    fontSize: 17,
                    fontWeight: FontWeight.w900,
                  ),
                ),
                Text(
                  'Cược xu · lắc xúc xắc · trúng thưởng',
                  style: TextStyle(color: Color(0xFF7777AA), fontSize: 11),
                ),
              ],
            ),
          ),
          _buildCoinBadge(),
        ],
      ),
    );
  }

  Widget _buildCoinBadge() {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 7),
      decoration: BoxDecoration(
        color: const Color(0xFF1E1A00),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
          color: const Color(0xFFFFD700).withOpacity(0.5),
          width: 1.5,
        ),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          const Text('🪙', style: TextStyle(fontSize: 14)),
          const SizedBox(width: 5),
          Text(
            '${_coinData.balance}',
            style: const TextStyle(
              color: Color(0xFFFFD700),
              fontWeight: FontWeight.w900,
              fontSize: 14,
            ),
          ),
        ],
      ),
    );
  }

  // Dice area
  Widget _buildDiceArea() {
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 20, horizontal: 12),
      decoration: BoxDecoration(
        color: const Color(0xFF110818),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: const Color(0xFF2A1A3A), width: 1.5),
      ),
      child: Column(
        children: [
          const Text(
            '🎲  KẾT QUẢ LẮC',
            style: TextStyle(
              color: Color(0xFF666688),
              fontSize: 10,
              letterSpacing: 2.5,
              fontWeight: FontWeight.w700,
            ),
          ),
          const SizedBox(height: 16),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceEvenly,
            children: List.generate(3, _buildDie),
          ),
          const SizedBox(height: 12),
          const Text(
            '1 khớp: +1×  ·  2 khớp: +2×  ·  3 khớp: +3×',
            style: TextStyle(
              color: Color(0xFF555577),
              fontSize: 10,
              letterSpacing: 0.5,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildDie(int i) {
    final isSpinning = _phase == _Phase.rolling && !_locked[i];
    final isMatch = _phase == _Phase.result && _dice[i] == _selected;

    Widget face = AnimatedContainer(
      duration: const Duration(milliseconds: 180),
      width: 80,
      height: 80,
      decoration: BoxDecoration(
        color: isMatch ? const Color(0xFF0D200D) : const Color(0xFF18102A),
        borderRadius: BorderRadius.circular(18),
        border: Border.all(
          color: isMatch
              ? const Color(0xFF66BB6A)
              : (isSpinning
                  ? const Color(0xFFE53935)
                  : const Color(0xFF3A2050)),
          width: isMatch ? 2.5 : (isSpinning ? 2 : 1.5),
        ),
        boxShadow: isMatch
            ? [
                BoxShadow(
                  color: const Color(0xFF4CAF50).withOpacity(0.4),
                  blurRadius: 14,
                )
              ]
            : null,
      ),
      child: Center(
        child: Text(
          _emoji[_dice[i]]!,
          style: const TextStyle(fontSize: 40),
        ),
      ),
    );

    if (isSpinning) {
      face = AnimatedBuilder(
        animation: _shakeAnim[i],
        builder: (_, child) => Transform.translate(
          offset: Offset(_shakeAnim[i].value, 0),
          child: child,
        ),
        child: face,
      );
    }

    return face;
  }

  // Symbol grid 3×2
  Widget _buildSymbolGrid() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text(
          'CHỌN CON CƯỢC',
          style: TextStyle(
            color: Color(0xFF7777AA),
            fontSize: 10,
            letterSpacing: 2,
            fontWeight: FontWeight.w700,
          ),
        ),
        const SizedBox(height: 8),
        GridView.builder(
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
            crossAxisCount: 3,
            crossAxisSpacing: 10,
            mainAxisSpacing: 10,
            childAspectRatio: 1.2,
          ),
          itemCount: 6,
          itemBuilder: (_, i) {
            final sym = _Sym.values[i];
            final isSel = _selected == sym;
            final canTap = _phase == _Phase.idle;
            final isWin =
                _phase == _Phase.result && sym == _selected && _lastDelta > 0;
            final isLose =
                _phase == _Phase.result && sym == _selected && _lastDelta <= 0;

            return GestureDetector(
              onTap: canTap ? () => _pickSym(sym) : null,
              child: AnimatedContainer(
                duration: const Duration(milliseconds: 200),
                decoration: BoxDecoration(
                  color: isWin
                      ? const Color(0xFF0A1A0A)
                      : isLose
                          ? const Color(0xFF1A0A0A)
                          : isSel
                              ? const Color(0xFF16103A)
                              : const Color(0xFF10101E),
                  borderRadius: BorderRadius.circular(14),
                  border: Border.all(
                    color: isWin
                        ? const Color(0xFF4CAF50)
                        : isLose
                            ? const Color(0xFFE53935)
                            : isSel
                                ? const Color(0xFF7C6FFF)
                                : const Color(0xFF222235),
                    width: isSel || isWin || isLose ? 2 : 1.5,
                  ),
                  boxShadow: isWin
                      ? [
                          BoxShadow(
                            color: const Color(0xFF4CAF50).withOpacity(0.3),
                            blurRadius: 10,
                          )
                        ]
                      : isSel && !isLose
                          ? [
                              BoxShadow(
                                color: const Color(0xFF7C6FFF).withOpacity(0.25),
                                blurRadius: 8,
                              )
                            ]
                          : null,
                ),
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Text(
                      _emoji[sym]!,
                      style: const TextStyle(fontSize: 30),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      _label[sym]!,
                      style: TextStyle(
                        color: isWin
                            ? const Color(0xFF66BB6A)
                            : isLose
                                ? const Color(0xFFEF5350)
                                : isSel
                                    ? const Color(0xFF9E8FFF)
                                    : Colors.white54,
                        fontSize: 12,
                        fontWeight:
                            isSel ? FontWeight.bold : FontWeight.normal,
                      ),
                    ),
                  ],
                ),
              ),
            );
          },
        ),
      ],
    );
  }

  // Chip selector
  Widget _buildChips() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text(
          'SỐ TIỀN CƯỢC',
          style: TextStyle(
            color: Color(0xFF7777AA),
            fontSize: 10,
            letterSpacing: 2,
            fontWeight: FontWeight.w700,
          ),
        ),
        const SizedBox(height: 8),
        Wrap(
          spacing: 8,
          runSpacing: 8,
          children: _chips.map((amt) {
            final isSel = _betAmount == amt;
            final canAfford = amt <= _coinData.balance;
            final canTap = _phase == _Phase.idle && canAfford;

            return GestureDetector(
              onTap: canTap ? () => _pickChip(amt) : null,
              child: AnimatedContainer(
                duration: const Duration(milliseconds: 200),
                padding:
                    const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                decoration: BoxDecoration(
                  color: isSel
                      ? const Color(0xFF1E1A00)
                      : const Color(0xFF10101E),
                  borderRadius: BorderRadius.circular(20),
                  border: Border.all(
                    color: isSel
                        ? const Color(0xFFFFD700)
                        : (canAfford
                            ? const Color(0xFF2A2A40)
                            : const Color(0xFF18182A)),
                    width: isSel ? 2 : 1.5,
                  ),
                ),
                child: Text(
                  '$amt🪙',
                  style: TextStyle(
                    color: isSel
                        ? const Color(0xFFFFD700)
                        : (canAfford ? Colors.white60 : Colors.white24),
                    fontWeight:
                        isSel ? FontWeight.bold : FontWeight.normal,
                    fontSize: 13,
                  ),
                ),
              ),
            );
          }).toList(),
        ),
      ],
    );
  }

  // Bet summary
  Widget _buildBetSummary() {
    if (_selected == null && _betAmount == 0) return const SizedBox.shrink();

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
      decoration: BoxDecoration(
        color: const Color(0xFF0F0F22),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: const Color(0xFF252540)),
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          if (_selected != null) ...[
            Text(_emoji[_selected]!, style: const TextStyle(fontSize: 18)),
            const SizedBox(width: 6),
            Text(
              _label[_selected]!,
              style: const TextStyle(
                color: Colors.white70,
                fontSize: 14,
                fontWeight: FontWeight.bold,
              ),
            ),
          ],
          if (_selected != null && _betAmount > 0) ...[
            const SizedBox(width: 10),
            Container(width: 1, height: 16, color: Colors.white24),
            const SizedBox(width: 10),
          ],
          if (_betAmount > 0) ...[
            const Text('🪙', style: TextStyle(fontSize: 14)),
            const SizedBox(width: 4),
            Text(
              '$_betAmount xu',
              style: const TextStyle(
                color: Color(0xFFFFD700),
                fontWeight: FontWeight.bold,
                fontSize: 14,
              ),
            ),
          ],
        ],
      ),
    );
  }

  // Result banner
  Widget _buildResultBanner() {
    final isWin = _lastDelta > 0;
    final matchText = switch (_matchCount) {
      0 => 'Không khớp con nào',
      1 => '1 xúc xắc khớp',
      2 => '2 xúc xắc khớp!',
      _ => '3 xúc xắc khớp! 🔥',
    };

    return Container(
      padding: const EdgeInsets.symmetric(vertical: 14, horizontal: 20),
      decoration: BoxDecoration(
        color: isWin ? const Color(0xFF0A1A0A) : const Color(0xFF1A0A0A),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
          color:
              isWin ? const Color(0xFF4CAF50) : const Color(0xFFE53935),
          width: 2,
        ),
        boxShadow: [
          BoxShadow(
            color: (isWin
                    ? const Color(0xFF4CAF50)
                    : const Color(0xFFE53935))
                .withOpacity(0.18),
            blurRadius: 16,
          ),
        ],
      ),
      child: Row(
        children: [
          Text(
            isWin ? '🎉' : '😢',
            style: const TextStyle(fontSize: 28),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  isWin ? 'THẮNG!' : 'THUA!',
                  style: TextStyle(
                    color: isWin
                        ? const Color(0xFF4CAF50)
                        : const Color(0xFFE53935),
                    fontSize: 16,
                    fontWeight: FontWeight.w900,
                    letterSpacing: 1.5,
                  ),
                ),
                Text(
                  matchText,
                  style: TextStyle(
                    color: isWin
                        ? const Color(0xFF81C784)
                        : const Color(0xFFEF9A9A),
                    fontSize: 11,
                  ),
                ),
              ],
            ),
          ),
          Text(
            isWin ? '+$_lastDelta 🪙' : '$_lastDelta 🪙',
            style: TextStyle(
              color: isWin
                  ? const Color(0xFF66BB6A)
                  : const Color(0xFFEF5350),
              fontSize: 22,
              fontWeight: FontWeight.w900,
            ),
          ),
        ],
      ),
    );
  }

  // Action button
  Widget _buildButton() {
    if (_phase == _Phase.result) {
      return FilledButton.icon(
        onPressed: _continueGame,
        icon: const Icon(Icons.replay_rounded, size: 20),
        label: const Text('CHƠI TIẾP'),
        style: FilledButton.styleFrom(
          backgroundColor: const Color(0xFF7C6FFF),
          foregroundColor: Colors.white,
          minimumSize: const Size.fromHeight(54),
          textStyle: const TextStyle(
            fontSize: 15,
            fontWeight: FontWeight.w900,
            letterSpacing: 1.5,
          ),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(14),
          ),
        ),
      );
    }

    if (_phase == _Phase.rolling) {
      return FilledButton.icon(
        onPressed: null,
        icon: const SizedBox(
          width: 18,
          height: 18,
          child: CircularProgressIndicator(
            color: Colors.white54,
            strokeWidth: 2,
          ),
        ),
        label: const Text('ĐANG LẮC...'),
        style: FilledButton.styleFrom(
          backgroundColor: const Color(0xFF2A1A2A),
          foregroundColor: Colors.white38,
          minimumSize: const Size.fromHeight(54),
          textStyle: const TextStyle(
            fontSize: 15,
            fontWeight: FontWeight.w900,
          ),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(14),
          ),
        ),
      );
    }

    final canRoll = _selected != null &&
        _betAmount > 0 &&
        _betAmount <= _coinData.balance;

    return FilledButton(
      onPressed: canRoll ? _roll : null,
      style: FilledButton.styleFrom(
        backgroundColor:
            canRoll ? const Color(0xFFE53935) : const Color(0xFF1E1010),
        foregroundColor: canRoll ? Colors.white : Colors.white24,
        minimumSize: const Size.fromHeight(54),
        textStyle: const TextStyle(
          fontSize: 15,
          fontWeight: FontWeight.w900,
          letterSpacing: 1.5,
        ),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(14),
        ),
        elevation: canRoll ? 4 : 0,
        shadowColor: const Color(0xFFE53935),
      ),
      child: const Row(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Text('🎲', style: TextStyle(fontSize: 20)),
          SizedBox(width: 8),
          Text('LẮC NGAY!'),
        ],
      ),
    );
  }
}
