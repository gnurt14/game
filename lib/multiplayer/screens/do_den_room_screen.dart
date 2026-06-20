// do_den_room_screen.dart — Multiplayer Đỏ Đen
//
// Mỗi người chọn Đỏ hoặc Đen → host lật bài → chia thưởng

import 'package:flutter/material.dart';
import '../../auth/auth_service.dart';
import '../../coin/coin_service.dart';
import '../room_model.dart';
import '../room_service.dart';

class DoDenRoomScreen extends StatefulWidget {
  const DoDenRoomScreen({super.key});

  @override
  State<DoDenRoomScreen> createState() => _DoDenRoomScreenState();
}

class _DoDenRoomScreenState extends State<DoDenRoomScreen>
    with SingleTickerProviderStateMixin {
  final _rs = RoomService.instance;

  GameRoom?        _room;
  List<RoomPlayer> _players = [];

  int     _betAmount = 50;
  String? _betChoice;
  bool    _placing   = false;
  bool    _rolling   = false;

  // Flip animation
  late AnimationController _flipCtrl;
  late Animation<double>   _flipAnim;

  // ── Listener callbacks ────────────────────────────────────────────────────
  void _onRoomChanged() {
    if (!mounted) return;
    final r    = _rs.roomNotifier.value;
    final prev = _room?.status;
    setState(() => _room = r);
    if (r != null && prev != 'rolling' && r.status == 'rolling') {
      _revealCard();
    }
    if (r != null && r.status == 'waiting') {
      _flipCtrl.reset();
    }
  }

  void _onPlayersChanged() {
    if (!mounted) return;
    setState(() => _players = _rs.playersNotifier.value);
  }

  @override
  void initState() {
    super.initState();
    _room    = _rs.currentRoom;
    _players = _rs.players;

    _flipCtrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 600),
    );
    _flipAnim = CurvedAnimation(parent: _flipCtrl, curve: Curves.easeInOut);

    _rs.roomNotifier.addListener(_onRoomChanged);
    _rs.playersNotifier.addListener(_onPlayersChanged);
  }

  @override
  void dispose() {
    _rs.roomNotifier.removeListener(_onRoomChanged);
    _rs.playersNotifier.removeListener(_onPlayersChanged);
    _flipCtrl.dispose();
    super.dispose();
  }

  String get _myId   => AuthService.instance.currentUser?.id ?? '';
  bool   get _isHost => _rs.isHost;
  RoomPlayer? get _me => _players.where((p) => p.playerId == _myId).firstOrNull;

  void _revealCard() async {
    await Future.delayed(const Duration(milliseconds: 500));
    if (!mounted) return;
    await _flipCtrl.forward();
    if (!mounted) return;
    _rs.settleMyBet();
  }

  Future<void> _placeBet() async {
    if (_betChoice == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Chọn Đỏ hoặc Đen'),
            backgroundColor: Color(0xFFE53935)));
      return;
    }
    setState(() => _placing = true);
    try {
      await _rs.placeBet(amount: _betAmount, choice: _betChoice!);
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(e.toString()),
            backgroundColor: const Color(0xFFE53935)));
      }
    } finally {
      if (mounted) setState(() => _placing = false);
    }
  }

  Future<void> _hostRoll() async {
    setState(() => _rolling = true);
    await _rs.rollResult();
    if (mounted) setState(() => _rolling = false);
  }

  Future<void> _leaveRoom() async {
    await _rs.leaveRoom();
    if (mounted) Navigator.pop(context);
  }

  @override
  Widget build(BuildContext context) {
    final room = _room;
    if (room == null) return const Scaffold(backgroundColor: Color(0xFF0A0A1A));

    return PopScope(
      canPop: false,
      onPopInvokedWithResult: (_, __) => _leaveRoom(),
      child: Scaffold(
        backgroundColor: const Color(0xFF0A0A1A),
        appBar: _buildAppBar(room),
        body: Column(children: [
          _buildCardArea(room),
          Expanded(child: SingleChildScrollView(
            padding: const EdgeInsets.all(16),
            child: Column(children: [
              if (room.status == 'betting') _buildBetPanel(room),
              const SizedBox(height: 16),
              _buildPlayersList(),
              if (_isHost) ...[
                const SizedBox(height: 16),
                _buildHostControls(room),
              ],
            ]),
          )),
        ]),
      ),
    );
  }

  AppBar _buildAppBar(GameRoom room) {
    final statusLabel = {
      'waiting': 'Chờ chơi',
      'betting': 'Đang cược',
      'rolling': 'Lật bài',
      'finished': 'Kết thúc',
    }[room.status] ?? room.status;

    return AppBar(
      backgroundColor: const Color(0xFF0A0A1A),
      foregroundColor: Colors.white,
      leading: IconButton(
        icon: const Icon(Icons.exit_to_app_rounded),
        onPressed: _leaveRoom,
      ),
      title: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text('Đỏ Đen — ${room.roomCode}',
            style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
        Text(statusLabel,
            style: const TextStyle(fontSize: 11, color: Color(0xFF7777AA))),
      ]),
      actions: [
        ValueListenableBuilder<CoinData>(
          valueListenable: CoinService.instance.notifier,
          builder: (_, data, __) => Padding(
            padding: const EdgeInsets.only(right: 16),
            child: Row(children: [
              const Text('🪙', style: TextStyle(fontSize: 16)),
              const SizedBox(width: 4),
              Text('${data.balance}', style: const TextStyle(
                  fontWeight: FontWeight.bold, color: Color(0xFFFFD700))),
            ]),
          ),
        ),
      ],
    );
  }

  Widget _buildCardArea(GameRoom room) {
    final hasCard = room.gameState != null;
    DoDenState? state;
    if (hasCard) state = DoDenState.fromJson(room.gameState!);

    return Container(
      width: double.infinity,
      height: 180,
      decoration: const BoxDecoration(
        gradient: LinearGradient(
          colors: [Color(0xFF0F0F22), Color(0xFF1A1A35)],
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
        ),
      ),
      child: Center(
        child: state == null
            ? Column(mainAxisAlignment: MainAxisAlignment.center, children: [
                const Icon(Icons.style_rounded, color: Color(0xFF444466), size: 52),
                const SizedBox(height: 8),
                Text('Vòng ${room.roundNumber}',
                    style: const TextStyle(color: Color(0xFF666688))),
              ])
            : AnimatedBuilder(
                animation: _flipAnim,
                builder: (_, __) {
                  final angle = _flipAnim.value * 3.14159;
                  final showFront = angle < 1.5708;
                  return Transform(
                    alignment: Alignment.center,
                    transform: Matrix4.identity()
                      ..setEntry(3, 2, 0.001)
                      ..rotateY(angle),
                    child: showFront
                        ? _CardBack()
                        : Transform(
                            alignment: Alignment.center,
                            transform: Matrix4.identity()..rotateY(3.14159),
                            child: _CardFront(card: state!.card),
                          ),
                  );
                },
              ),
      ),
    );
  }

  Widget _buildBetPanel(GameRoom room) {
    final me         = _me;
    final alreadyBet = me?.isReady ?? false;

    if (alreadyBet) {
      final choiceLabel = me!.betChoice == 'red' ? 'Đỏ ♥' : 'Đen ♠';
      return Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: const Color(0xFF0D2A0D),
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: const Color(0xFF2E7D32).withOpacity(0.5)),
        ),
        child: Row(children: [
          const Icon(Icons.check_circle_rounded, color: Color(0xFF4CAF50)),
          const SizedBox(width: 10),
          Text('Đã cược ${me.betAmount} xu — $choiceLabel',
              style: const TextStyle(color: Color(0xFF4CAF50),
                  fontWeight: FontWeight.bold)),
        ]),
      );
    }

    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      const Text('CHỌN ĐỎ HOẶC ĐEN',
          style: TextStyle(color: Color(0xFF7C6FFF), fontSize: 12,
              fontWeight: FontWeight.bold, letterSpacing: 1.5)),
      const SizedBox(height: 10),
      Row(children: [
        Expanded(child: _ColorChoice(
          label: 'Đỏ ♥♦',
          color: const Color(0xFFE53935),
          selected: _betChoice == 'red',
          onTap: () => setState(() => _betChoice = 'red'),
        )),
        const SizedBox(width: 12),
        Expanded(child: _ColorChoice(
          label: 'Đen ♠♣',
          color: const Color(0xFF37474F),
          selected: _betChoice == 'black',
          onTap: () => setState(() => _betChoice = 'black'),
        )),
      ]),
      const SizedBox(height: 14),
      const Text('SỐ XU CƯỢC',
          style: TextStyle(color: Color(0xFF7C6FFF), fontSize: 12,
              fontWeight: FontWeight.bold, letterSpacing: 1.5)),
      const SizedBox(height: 8),
      _BetAmountSelector(
        value: _betAmount,
        min: room.minBet,
        max: room.maxBet,
        onChange: (v) => setState(() => _betAmount = v),
      ),
      const SizedBox(height: 14),
      SizedBox(
        width: double.infinity,
        child: FilledButton(
          onPressed: _placing ? null : _placeBet,
          style: FilledButton.styleFrom(
            backgroundColor: _betChoice == 'red'
                ? const Color(0xFFE53935) : const Color(0xFF37474F),
            padding: const EdgeInsets.symmetric(vertical: 14),
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
          ),
          child: _placing
              ? const SizedBox(width: 20, height: 20,
                  child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
              : Text('Cược $_betAmount xu',
                  style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
        ),
      ),
    ]);
  }

  Widget _buildPlayersList() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text('NGƯỜI CHƠI (${_players.length})',
            style: const TextStyle(color: Color(0xFF7777AA), fontSize: 12,
                fontWeight: FontWeight.bold, letterSpacing: 1.5)),
        const SizedBox(height: 8),
        ..._players.map((p) {
          final delta  = p.resultDelta;
          final isMe   = p.playerId == _myId;
          Color deltaColor = delta > 0
              ? const Color(0xFF4CAF50)
              : delta < 0 ? const Color(0xFFE57373) : const Color(0xFF666688);

          return Container(
            margin: const EdgeInsets.only(bottom: 8),
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
            decoration: BoxDecoration(
              color: isMe ? const Color(0xFF0D0D2A) : const Color(0xFF0F0F22),
              borderRadius: BorderRadius.circular(12),
              border: Border.all(
                color: isMe ? const Color(0xFF7C6FFF).withOpacity(0.4) : const Color(0xFF2A2A44),
              ),
            ),
            child: Row(children: [
              CircleAvatar(
                radius: 16,
                backgroundColor: const Color(0xFF1A1A35),
                child: Text(p.displayName[0].toUpperCase(),
                    style: const TextStyle(color: Colors.white, fontSize: 13)),
              ),
              const SizedBox(width: 10),
              Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text('${p.displayName}${isMe ? " (Bạn)" : ""}',
                    style: const TextStyle(color: Colors.white, fontSize: 13)),
                if (p.isReady && p.betChoice != null)
                  Row(children: [
                    Container(
                      width: 10, height: 10,
                      margin: const EdgeInsets.only(right: 4),
                      decoration: BoxDecoration(
                        color: p.betChoice == 'red'
                            ? const Color(0xFFE53935) : const Color(0xFF607D8B),
                        shape: BoxShape.circle,
                      ),
                    ),
                    Text('${p.betAmount} xu',
                        style: const TextStyle(color: Color(0xFF888888), fontSize: 11)),
                  ]),
              ])),
              if (delta != 0) Text(
                '${delta > 0 ? "+" : ""}$delta xu',
                style: TextStyle(color: deltaColor, fontWeight: FontWeight.bold),
              ),
            ]),
          );
        }),
      ],
    );
  }

  Widget _buildHostControls(GameRoom room) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text('ĐIỀU KHIỂN CHỦ PHÒNG',
            style: TextStyle(color: Color(0xFF7C6FFF), fontSize: 12,
                fontWeight: FontWeight.bold, letterSpacing: 1.5)),
        const SizedBox(height: 8),
        if (room.status == 'waiting')
          SizedBox(
            width: double.infinity,
            child: FilledButton.icon(
              onPressed: _rs.openBetting,
              icon: const Icon(Icons.play_arrow_rounded),
              label: const Text('Mở Cược Vòng Mới'),
              style: FilledButton.styleFrom(
                backgroundColor: const Color(0xFF7C6FFF),
                padding: const EdgeInsets.symmetric(vertical: 14),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
              ),
            ),
          ),
        if (room.status == 'betting') ...[
          Text('${_players.where((p) => p.isReady).length}/${_players.length} đã cược',
              style: const TextStyle(color: Color(0xFF888888), fontSize: 12)),
          const SizedBox(height: 8),
          SizedBox(
            width: double.infinity,
            child: FilledButton.icon(
              onPressed: _rolling ? null : _hostRoll,
              icon: const Icon(Icons.style_rounded),
              label: _rolling
                  ? const Text('Đang lật bài...')
                  : const Text('Lật Bài'),
              style: FilledButton.styleFrom(
                backgroundColor: const Color(0xFFE53935),
                padding: const EdgeInsets.symmetric(vertical: 14),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
              ),
            ),
          ),
        ],
        if (room.status == 'rolling') ...[
          const Text('Đã lật bài',
              style: TextStyle(color: Color(0xFF888888), fontSize: 12)),
          const SizedBox(height: 8),
          SizedBox(
            width: double.infinity,
            child: FilledButton.icon(
              onPressed: _rs.openBetting,
              icon: const Icon(Icons.refresh_rounded),
              label: const Text('Vòng Tiếp Theo'),
              style: FilledButton.styleFrom(
                backgroundColor: const Color(0xFF7C6FFF),
                padding: const EdgeInsets.symmetric(vertical: 14),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
              ),
            ),
          ),
        ],
      ],
    );
  }
}

// ── Card Widgets ───────────────────────────────────────────────────────────────

class _CardBack extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return Container(
      width: 90, height: 130,
      decoration: BoxDecoration(
        color: const Color(0xFF1A1A35),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: const Color(0xFF7C6FFF), width: 2),
        boxShadow: [BoxShadow(
          color: const Color(0xFF7C6FFF).withOpacity(0.3),
          blurRadius: 16,
        )],
      ),
      child: const Center(
        child: Icon(Icons.question_mark_rounded, color: Color(0xFF7C6FFF), size: 36),
      ),
    );
  }
}

class _CardFront extends StatelessWidget {
  final CardState card;
  const _CardFront({required this.card});

  @override
  Widget build(BuildContext context) {
    final color = card.isRed ? const Color(0xFFE53935) : Colors.white;
    return Container(
      width: 90, height: 130,
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        boxShadow: [BoxShadow(
          color: (card.isRed ? const Color(0xFFE53935) : Colors.black).withOpacity(0.4),
          blurRadius: 20,
          spreadRadius: 2,
        )],
      ),
      child: Padding(
        padding: const EdgeInsets.all(6),
        child: Column(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
          Row(children: [
            Text(card.rank, style: TextStyle(color: color,
                fontWeight: FontWeight.bold, fontSize: 18)),
          ]),
          Text(card.suitEmoji, style: TextStyle(color: color, fontSize: 32)),
          Row(mainAxisAlignment: MainAxisAlignment.end, children: [
            RotatedBox(quarterTurns: 2,
              child: Text(card.rank, style: TextStyle(color: color,
                  fontWeight: FontWeight.bold, fontSize: 18))),
          ]),
        ]),
      ),
    );
  }
}

class _ColorChoice extends StatelessWidget {
  final String label;
  final Color  color;
  final bool   selected;
  final VoidCallback onTap;

  const _ColorChoice({
    required this.label,
    required this.color,
    required this.selected,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 150),
        padding: const EdgeInsets.symmetric(vertical: 20),
        decoration: BoxDecoration(
          color: selected ? color.withOpacity(0.2) : const Color(0xFF0F0F22),
          borderRadius: BorderRadius.circular(14),
          border: Border.all(
            color: selected ? color : const Color(0xFF2A2A44),
            width: selected ? 2 : 1,
          ),
        ),
        child: Center(
          child: Text(label, style: TextStyle(
            color: selected ? color : const Color(0xFF7777AA),
            fontSize: 18, fontWeight: FontWeight.bold,
          )),
        ),
      ),
    );
  }
}

class _BetAmountSelector extends StatelessWidget {
  final int value;
  final int min;
  final int max;
  final void Function(int) onChange;

  const _BetAmountSelector({
    required this.value, required this.min,
    required this.max, required this.onChange,
  });

  @override
  Widget build(BuildContext context) {
    final presets = [min, (min * 2).clamp(min, max), (max ~/ 2).clamp(min, max), max];

    return Row(children: [
      IconButton(
        onPressed: value > min ? () => onChange((value - min).clamp(min, max)) : null,
        icon: const Icon(Icons.remove_circle_outline_rounded, color: Color(0xFF7777AA)),
      ),
      Expanded(
        child: Wrap(
          spacing: 6,
          children: presets.toSet().map((p) {
            final sel = value == p;
            return GestureDetector(
              onTap: () => onChange(p),
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                decoration: BoxDecoration(
                  color: sel ? const Color(0xFF7C6FFF) : const Color(0xFF1A1A35),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Text('$p', style: TextStyle(
                    color: sel ? Colors.white : const Color(0xFF7777AA),
                    fontSize: 13, fontWeight: FontWeight.bold)),
              ),
            );
          }).toList(),
        ),
      ),
      IconButton(
        onPressed: value < max ? () => onChange((value + min).clamp(min, max)) : null,
        icon: const Icon(Icons.add_circle_outline_rounded, color: Color(0xFF7777AA)),
      ),
    ]);
  }
}
