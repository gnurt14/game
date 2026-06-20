// xi_jack_game.dart — Xì Jack (Blackjack)
//
// Luật chơi:
//   • Người chơi vs Nhà cái — mục tiêu đạt 21 hoặc gần nhất không vượt quá
//   • A = 1 hoặc 11 (tự động tối ưu), J/Q/K = 10
//   • Nhà cái rút bài đến khi đạt ≥ 17
//   • Rút bài (Hit) | Dừng (Stand) | Gấp đôi (Double Down 2 lá đầu)
//   • Blackjack tự nhiên = A + 10-value → thắng 2.5x cược

import 'dart:math';
import 'package:flutter/material.dart';
import '../../coin/coin_service.dart';

// =============================================================================
// DATA MODEL
// =============================================================================

enum Suit { spades, hearts, diamonds, clubs }

enum CardFace {
  two, three, four, five, six, seven, eight, nine, ten,
  jack, queen, king, ace
}

class PlayingCard {
  final Suit suit;
  final CardFace face;
  bool faceDown;

  PlayingCard({required this.suit, required this.face, this.faceDown = false});

  int get baseValue {
    switch (face) {
      case CardFace.ace:   return 11;
      case CardFace.jack:
      case CardFace.queen:
      case CardFace.king:  return 10;
      case CardFace.two:   return 2;
      case CardFace.three: return 3;
      case CardFace.four:  return 4;
      case CardFace.five:  return 5;
      case CardFace.six:   return 6;
      case CardFace.seven: return 7;
      case CardFace.eight: return 8;
      case CardFace.nine:  return 9;
      case CardFace.ten:   return 10;
    }
  }

  String get label {
    return switch (face) {
      CardFace.ace   => 'A',
      CardFace.jack  => 'J',
      CardFace.queen => 'Q',
      CardFace.king  => 'K',
      CardFace.two   => '2',
      CardFace.three => '3',
      CardFace.four  => '4',
      CardFace.five  => '5',
      CardFace.six   => '6',
      CardFace.seven => '7',
      CardFace.eight => '8',
      CardFace.nine  => '9',
      CardFace.ten   => '10',
    };
  }

  String get suitSymbol => switch (suit) {
    Suit.spades   => '♠',
    Suit.hearts   => '♥',
    Suit.diamonds => '♦',
    Suit.clubs    => '♣',
  };

  bool get isRed => suit == Suit.hearts || suit == Suit.diamonds;
}

// Tính tổng điểm bài — A tự động chọn 1 hoặc 11 để tránh bust
int handValue(List<PlayingCard> hand) {
  int total = 0;
  int aces = 0;
  for (final card in hand) {
    if (card.faceDown) continue;
    if (card.face == CardFace.ace) {
      aces++;
      total += 11;
    } else {
      total += card.baseValue;
    }
  }
  while (total > 21 && aces > 0) {
    total -= 10;
    aces--;
  }
  return total;
}

enum GamePhase { betting, playerTurn, dealerTurn, result }

enum GameResult { none, win, lose, push, blackjack }

// =============================================================================
// GAME CONTROLLER (logic thuần túy)
// =============================================================================

class _XiJackController {
  final Random _rng = Random();
  List<PlayingCard> _deck = [];

  List<PlayingCard> playerHand = [];
  List<PlayingCard> dealerHand = [];

  GamePhase phase = GamePhase.betting;
  GameResult result = GameResult.none;
  int currentBet = 0;

  void _buildDeck() {
    _deck = [
      for (final suit in Suit.values)
        for (final face in CardFace.values) PlayingCard(suit: suit, face: face),
    ];
    // Fisher-Yates shuffle
    for (int i = _deck.length - 1; i > 0; i--) {
      final j = _rng.nextInt(i + 1);
      final tmp = _deck[i];
      _deck[i] = _deck[j];
      _deck[j] = tmp;
    }
  }

  PlayingCard _draw({bool faceDown = false}) {
    if (_deck.isEmpty) _buildDeck();
    return _deck.removeLast()..faceDown = faceDown;
  }

  // Bắt đầu ván — trả về true nếu thành công (đủ xu đã được trừ ngoài)
  void deal(int bet) {
    currentBet = bet;
    result = GameResult.none;
    _buildDeck();

    playerHand = [_draw(), _draw()];
    dealerHand = [_draw(), _draw(faceDown: true)];

    phase = GamePhase.playerTurn;

    // Blackjack tự nhiên
    if (handValue(playerHand) == 21) {
      _revealDealer();
      result = handValue(dealerHand) == 21
          ? GameResult.push
          : GameResult.blackjack;
      phase = GamePhase.result;
    }
  }

  void hit() {
    if (phase != GamePhase.playerTurn) return;
    playerHand.add(_draw());
    final v = handValue(playerHand);
    if (v > 21) {
      _revealDealer();
      result = GameResult.lose;
      phase = GamePhase.result;
    } else if (v == 21) {
      _stand();
    }
  }

  void stand() {
    if (phase != GamePhase.playerTurn) return;
    _stand();
  }

  void _stand() {
    _revealDealer();
    // Dealer hits until ≥ 17
    while (handValue(dealerHand) < 17) {
      dealerHand.add(_draw());
    }
    _resolveResult();
  }

  void doubleDown() {
    if (phase != GamePhase.playerTurn || playerHand.length != 2) return;
    currentBet *= 2;
    playerHand.add(_draw());
    _revealDealer();
    if (handValue(playerHand) > 21) {
      result = GameResult.lose;
      phase = GamePhase.result;
    } else {
      while (handValue(dealerHand) < 17) {
        dealerHand.add(_draw());
      }
      _resolveResult();
    }
  }

  void _revealDealer() {
    for (final c in dealerHand) {
      c.faceDown = false;
    }
  }

  void _resolveResult() {
    final pv = handValue(playerHand);
    final dv = handValue(dealerHand);

    if (pv > 21) {
      result = GameResult.lose;
    } else if (dv > 21 || pv > dv) {
      result = GameResult.win;
    } else if (pv == dv) {
      result = GameResult.push;
    } else {
      result = GameResult.lose;
    }
    phase = GamePhase.result;
  }

  // Xu nhận về khi kết thúc ván (trừ tiền cược đã trừ trước)
  int get payout {
    return switch (result) {
      GameResult.win       => currentBet * 2,       // hoàn cược + thắng
      GameResult.blackjack => (currentBet * 2.5).toInt(), // 1.5x win
      GameResult.push      => currentBet,            // hoàn cược
      _                    => 0,                     // thua, mất cược
    };
  }
}

// =============================================================================
// SCREEN
// =============================================================================

class XiJackScreen extends StatefulWidget {
  const XiJackScreen({super.key});

  @override
  State<XiJackScreen> createState() => _XiJackScreenState();
}

class _XiJackScreenState extends State<XiJackScreen>
    with SingleTickerProviderStateMixin {
  final _ctrl = _XiJackController();

  int _balance = 0;
  int _betAmount = 50;
  bool _pendingPayout = false; // tránh double-apply khi rebuild

  late final AnimationController _cardAnim;
  late final Animation<double> _cardFade;

  @override
  void initState() {
    super.initState();
    _balance = CoinService.instance.notifier.value.balance;
    CoinService.instance.notifier.addListener(_onCoinUpdate);

    _cardAnim = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 350),
    );
    _cardFade = CurvedAnimation(parent: _cardAnim, curve: Curves.easeOut);
  }

  @override
  void dispose() {
    CoinService.instance.notifier.removeListener(_onCoinUpdate);
    _cardAnim.dispose();
    super.dispose();
  }

  void _onCoinUpdate() {
    if (mounted) setState(() => _balance = CoinService.instance.notifier.value.balance);
  }

  // ── Actions ────────────────────────────────────────────────────────────────

  Future<void> _deal() async {
    if (_betAmount > _balance) return;

    // Trừ cược trước khi chia bài
    final ok = await CoinService.instance.spendCoins(_betAmount);
    if (!ok) return;

    // Double Down có thể tốn thêm tiền — check balance còn lại
    setState(() {
      _ctrl.deal(_betAmount);
      _pendingPayout = false;
      _cardAnim.forward(from: 0);
    });

    if (_ctrl.phase == GamePhase.result) {
      await _applyPayout();
    }
  }

  void _hit() {
    setState(() => _ctrl.hit());
    if (_ctrl.phase == GamePhase.result) _applyPayout();
  }

  void _stand() {
    setState(() => _ctrl.stand());
    _applyPayout();
  }

  Future<void> _doubleDown() async {
    // Double Down cần thêm currentBet xu nữa
    final extraBet = _ctrl.currentBet; // trước khi *2
    final ok = await CoinService.instance.spendCoins(extraBet);
    if (!ok) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Không đủ xu để double down!')),
      );
      return;
    }
    setState(() => _ctrl.doubleDown());
    _applyPayout();
  }

  Future<void> _applyPayout() async {
    if (_pendingPayout) return;
    _pendingPayout = true;
    final p = _ctrl.payout;
    if (p > 0) {
      await CoinService.instance.earnCoins(p);
    }
  }

  void _newRound() {
    setState(() {
      _ctrl.phase = GamePhase.betting;
      _ctrl.result = GameResult.none;
      _pendingPayout = false;
      // Clamp bet nếu balance giảm
      if (_betAmount > _balance) {
        _betAmount = _betOptions.lastWhere(
          (b) => b <= _balance,
          orElse: () => _betOptions.first,
        );
      }
    });
  }

  static const List<int> _betOptions = [25, 50, 100, 200, 500];

  // ── Build ──────────────────────────────────────────────────────────────────

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF0D2818),
      body: SafeArea(
        child: Column(
          children: [
            _buildTopBar(),
            Expanded(child: _buildBody()),
            _buildBottomBar(),
          ],
        ),
      ),
    );
  }

  // ── Top Bar ────────────────────────────────────────────────────────────────

  Widget _buildTopBar() {
    return Padding(
      padding: const EdgeInsets.fromLTRB(8, 10, 16, 0),
      child: Row(
        children: [
          IconButton(
            onPressed: () => Navigator.pop(context),
            icon: const Icon(Icons.arrow_back_ios_new_rounded,
                color: Colors.white70),
          ),
          const Text(
            'XÌ JACK',
            style: TextStyle(
              color: Colors.white,
              fontSize: 22,
              fontWeight: FontWeight.w900,
              letterSpacing: 3,
            ),
          ),
          const Spacer(),
          _coinBadge(_balance),
        ],
      ),
    );
  }

  Widget _coinBadge(int amount) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
      decoration: BoxDecoration(
        color: const Color(0xFF1E1A00),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
          color: const Color(0xFFFFD700).withOpacity(0.5),
        ),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          const Text('🪙', style: TextStyle(fontSize: 15)),
          const SizedBox(width: 6),
          Text(
            '$amount',
            style: const TextStyle(
              color: Color(0xFFFFD700),
              fontWeight: FontWeight.w900,
              fontSize: 16,
            ),
          ),
        ],
      ),
    );
  }

  // ── Body ───────────────────────────────────────────────────────────────────

  Widget _buildBody() {
    if (_ctrl.phase == GamePhase.betting) return _buildBettingUI();

    return Column(
      children: [
        const SizedBox(height: 12),
        _buildHandArea(
          label: 'Nhà cái',
          hand: _ctrl.dealerHand,
        ),
        const Spacer(),
        if (_ctrl.phase == GamePhase.result) _buildResultBanner(),
        const Spacer(),
        _buildHandArea(
          label: 'Bạn',
          hand: _ctrl.playerHand,
        ),
        const SizedBox(height: 12),
      ],
    );
  }

  // ── Betting UI ─────────────────────────────────────────────────────────────

  Widget _buildBettingUI() {
    final canDeal = _betAmount <= _balance && _balance > 0;

    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 24),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          // Kết quả ván trước
          if (_ctrl.result != GameResult.none) ...[
            _buildResultBanner(),
            const SizedBox(height: 28),
          ],
          const Text(
            'ĐẶT CƯỢC',
            style: TextStyle(
              color: Color(0xFFFFD700),
              fontSize: 16,
              fontWeight: FontWeight.w900,
              letterSpacing: 2.5,
            ),
          ),
          const SizedBox(height: 14),
          Text(
            '🪙 $_betAmount xu',
            style: const TextStyle(
              color: Colors.white,
              fontSize: 38,
              fontWeight: FontWeight.w900,
            ),
          ),
          const SizedBox(height: 22),
          // Chip selector
          Wrap(
            spacing: 12,
            runSpacing: 12,
            alignment: WrapAlignment.center,
            children: _betOptions.map((b) {
              final selected = _betAmount == b;
              final canAfford = b <= _balance;
              return _buildChip(b, selected: selected, enabled: canAfford);
            }).toList(),
          ),
          const SizedBox(height: 36),
          // Deal button
          GestureDetector(
            onTap: canDeal ? _deal : null,
            child: AnimatedContainer(
              duration: const Duration(milliseconds: 180),
              padding:
                  const EdgeInsets.symmetric(horizontal: 52, vertical: 17),
              decoration: BoxDecoration(
                gradient: canDeal
                    ? const LinearGradient(
                        colors: [Color(0xFFFFD700), Color(0xFFE68900)],
                      )
                    : null,
                color: canDeal ? null : const Color(0xFF1A1A1A),
                borderRadius: BorderRadius.circular(34),
                boxShadow: canDeal
                    ? [
                        BoxShadow(
                          color: const Color(0xFFFFD700).withOpacity(0.35),
                          blurRadius: 18,
                          offset: const Offset(0, 4),
                        )
                      ]
                    : null,
              ),
              child: Text(
                _balance <= 0 ? 'HẾT XU' : 'CHIA BÀI',
                style: TextStyle(
                  color: canDeal ? Colors.black : Colors.white24,
                  fontWeight: FontWeight.w900,
                  fontSize: 18,
                  letterSpacing: 2,
                ),
              ),
            ),
          ),
          if (_balance <= 0) ...[
            const SizedBox(height: 14),
            const Text(
              'Về cửa hàng để nạp thêm xu!',
              style: TextStyle(color: Colors.white38, fontSize: 13),
            ),
          ],
        ],
      ),
    );
  }

  Widget _buildChip(int amount, {required bool selected, required bool enabled}) {
    return GestureDetector(
      onTap: enabled ? () => setState(() => _betAmount = amount) : null,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 180),
        width: 68,
        height: 68,
        decoration: BoxDecoration(
          shape: BoxShape.circle,
          gradient: selected
              ? const LinearGradient(
                  colors: [Color(0xFFFFD700), Color(0xFFE68900)],
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                )
              : null,
          color: selected
              ? null
              : enabled
                  ? const Color(0xFF1A4A2A)
                  : const Color(0xFF0F0F0F),
          border: Border.all(
            color: selected
                ? const Color(0xFFFFD700)
                : enabled
                    ? const Color(0xFF2E6A3E)
                    : const Color(0xFF1A1A1A),
            width: 2.5,
          ),
          boxShadow: selected
              ? [
                  BoxShadow(
                    color: const Color(0xFFFFD700).withOpacity(0.5),
                    blurRadius: 14,
                  )
                ]
              : null,
        ),
        child: Center(
          child: Text(
            amount >= 1000 ? '${amount ~/ 1000}K' : '$amount',
            style: TextStyle(
              color: selected
                  ? Colors.black
                  : enabled
                      ? Colors.white
                      : Colors.white24,
              fontWeight: FontWeight.w900,
              fontSize: amount >= 100 ? 14 : 17,
            ),
          ),
        ),
      ),
    );
  }

  // ── Hand Area ──────────────────────────────────────────────────────────────

  Widget _buildHandArea({required String label, required List<PlayingCard> hand}) {
    final hasHidden = hand.any((c) => c.faceDown);
    final value = handValue(hand);
    final bust = !hasHidden && value > 21;

    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        // Label + score badge
        Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Text(
              label,
              style: const TextStyle(
                color: Colors.white60,
                fontSize: 13,
                letterSpacing: 1,
              ),
            ),
            if (!hasHidden) ...[
              const SizedBox(width: 10),
              Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 10, vertical: 3),
                decoration: BoxDecoration(
                  color: bust
                      ? const Color(0xFFAA1111)
                      : value == 21
                          ? const Color(0xFFB8860B)
                          : const Color(0xFF1A4A2A),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Text(
                  bust ? 'BÙNG $value' : '$value',
                  style: TextStyle(
                    color: value == 21 && !bust
                        ? const Color(0xFFFFD700)
                        : Colors.white,
                    fontWeight: FontWeight.bold,
                    fontSize: 12,
                  ),
                ),
              ),
            ],
          ],
        ),
        const SizedBox(height: 10),
        // Cards row
        SizedBox(
          height: 108,
          child: hand.isEmpty
              ? const SizedBox.shrink()
              : ListView.builder(
                  scrollDirection: Axis.horizontal,
                  shrinkWrap: true,
                  padding: const EdgeInsets.symmetric(horizontal: 20),
                  itemCount: hand.length,
                  itemBuilder: (_, i) => Padding(
                    padding: const EdgeInsets.only(right: 10),
                    child: FadeTransition(
                      opacity: _cardFade,
                      child: _buildCard(hand[i]),
                    ),
                  ),
                ),
        ),
      ],
    );
  }

  Widget _buildCard(PlayingCard card) {
    if (card.faceDown) {
      return Container(
        width: 68,
        height: 100,
        decoration: BoxDecoration(
          color: const Color(0xFF1B2C3E),
          borderRadius: BorderRadius.circular(10),
          border: Border.all(color: const Color(0xFF2A4A6A), width: 2),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withOpacity(0.45),
              blurRadius: 6,
              offset: const Offset(2, 3),
            ),
          ],
        ),
        child: Center(
          child: Text(
            '?',
            style: TextStyle(
              fontSize: 34,
              fontWeight: FontWeight.w900,
              color: Colors.white.withOpacity(0.15),
            ),
          ),
        ),
      );
    }

    final textColor =
        card.isRed ? const Color(0xFFCC1111) : const Color(0xFF1A1A2E);

    return Container(
      width: 68,
      height: 100,
      decoration: BoxDecoration(
        color: const Color(0xFFF5F0E6),
        borderRadius: BorderRadius.circular(10),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.45),
            blurRadius: 6,
            offset: const Offset(2, 3),
          ),
        ],
      ),
      child: Stack(
        children: [
          // Top-left corner
          Positioned(
            top: 5,
            left: 7,
            child: _cornerLabel(card, textColor),
          ),
          // Center suit
          Center(
            child: Text(
              card.suitSymbol,
              style: TextStyle(
                color: textColor,
                fontSize: 26,
              ),
            ),
          ),
          // Bottom-right corner (rotated)
          Positioned(
            bottom: 5,
            right: 7,
            child: Transform.rotate(
              angle: pi,
              child: _cornerLabel(card, textColor),
            ),
          ),
        ],
      ),
    );
  }

  Widget _cornerLabel(PlayingCard card, Color color) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: [
        Text(
          card.label,
          style: TextStyle(
            color: color,
            fontWeight: FontWeight.w900,
            fontSize: 15,
            height: 1.1,
          ),
        ),
        Text(
          card.suitSymbol,
          style: TextStyle(color: color, fontSize: 11, height: 1.1),
        ),
      ],
    );
  }

  // ── Result Banner ──────────────────────────────────────────────────────────

  Widget _buildResultBanner() {
    final (text, color, emoji) = switch (_ctrl.result) {
      GameResult.win       => ('THẮNG!', const Color(0xFF4CAF50), '🎉'),
      GameResult.lose      => ('THUA!', const Color(0xFFCC2222), '😢'),
      GameResult.push      => ('HÒA', const Color(0xFFFFB300), '🤝'),
      GameResult.blackjack => ('BLACKJACK!', const Color(0xFFFFD700), '🃏'),
      GameResult.none      => ('', Colors.transparent, ''),
    };

    if (_ctrl.result == GameResult.none) return const SizedBox.shrink();

    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 32),
      padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 24),
      decoration: BoxDecoration(
        color: color.withOpacity(0.12),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: color, width: 2),
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Text(emoji, style: const TextStyle(fontSize: 22)),
          const SizedBox(width: 10),
          Text(
            text,
            style: TextStyle(
              color: color,
              fontSize: 24,
              fontWeight: FontWeight.w900,
              letterSpacing: 2,
            ),
          ),
          if (_ctrl.payout > 0) ...[
            const SizedBox(width: 12),
            Text(
              '+${_ctrl.payout}🪙',
              style: const TextStyle(
                color: Color(0xFFFFD700),
                fontSize: 16,
                fontWeight: FontWeight.bold,
              ),
            ),
          ],
        ],
      ),
    );
  }

  // ── Bottom Action Bar ──────────────────────────────────────────────────────

  Widget _buildBottomBar() {
    if (_ctrl.phase == GamePhase.betting ||
        _ctrl.phase == GamePhase.dealerTurn) {
      return const SizedBox(height: 20);
    }

    if (_ctrl.phase == GamePhase.result) {
      return Padding(
        padding: const EdgeInsets.fromLTRB(24, 0, 24, 24),
        child: SizedBox(
          width: double.infinity,
          child: FilledButton(
            onPressed: _newRound,
            style: FilledButton.styleFrom(
              backgroundColor: const Color(0xFF1A4A2A),
              padding: const EdgeInsets.symmetric(vertical: 16),
              shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(16)),
            ),
            child: const Text(
              'VÁN MỚI',
              style: TextStyle(
                color: Colors.white,
                fontWeight: FontWeight.w900,
                fontSize: 17,
                letterSpacing: 1.5,
              ),
            ),
          ),
        ),
      );
    }

    // playerTurn
    final canDouble =
        _ctrl.playerHand.length == 2 && _balance >= _ctrl.currentBet;

    return Padding(
      padding: const EdgeInsets.fromLTRB(24, 0, 24, 20),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Row(
            children: [
              Expanded(
                child: FilledButton(
                  onPressed: _hit,
                  style: FilledButton.styleFrom(
                    backgroundColor: const Color(0xFF2E7D32),
                    padding: const EdgeInsets.symmetric(vertical: 16),
                    shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(16)),
                  ),
                  child: const Text(
                    'RÚT BÀI',
                    style: TextStyle(
                      fontWeight: FontWeight.w900,
                      fontSize: 16,
                      letterSpacing: 1.5,
                      color: Colors.white,
                    ),
                  ),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: FilledButton(
                  onPressed: _stand,
                  style: FilledButton.styleFrom(
                    backgroundColor: const Color(0xFFB71C1C),
                    padding: const EdgeInsets.symmetric(vertical: 16),
                    shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(16)),
                  ),
                  child: const Text(
                    'DỪNG',
                    style: TextStyle(
                      fontWeight: FontWeight.w900,
                      fontSize: 16,
                      letterSpacing: 1.5,
                      color: Colors.white,
                    ),
                  ),
                ),
              ),
            ],
          ),
          if (canDouble) ...[
            const SizedBox(height: 10),
            SizedBox(
              width: double.infinity,
              child: FilledButton(
                onPressed: _doubleDown,
                style: FilledButton.styleFrom(
                  backgroundColor: const Color(0xFFB8860B),
                  padding: const EdgeInsets.symmetric(vertical: 13),
                  shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(16)),
                ),
                child: Text(
                  'GẤPĐÔI  ×2  (thêm ${_ctrl.currentBet}🪙)',
                  style: const TextStyle(
                    color: Colors.white,
                    fontWeight: FontWeight.w900,
                    fontSize: 14,
                    letterSpacing: 0.5,
                  ),
                ),
              ),
            ),
          ],
          const SizedBox(height: 6),
          Text(
            'Cược: ${_ctrl.currentBet} xu',
            style: const TextStyle(color: Colors.white38, fontSize: 12),
          ),
        ],
      ),
    );
  }
}
