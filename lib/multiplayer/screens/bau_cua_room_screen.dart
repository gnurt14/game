// bau_cua_room_screen.dart — Multiplayer Bầu Cua Tôm Cá
//
// Luồng: waiting → host mở cược → mọi người đặt → host quay → kết quả

import 'dart:async';
import 'package:flutter/material.dart';
import '../../auth/auth_service.dart';
import '../../coin/coin_service.dart';
import '../room_model.dart';
import '../room_service.dart';

class BauCuaRoomScreen extends StatefulWidget {
  const BauCuaRoomScreen({super.key});

  @override
  State<BauCuaRoomScreen> createState() => _BauCuaRoomScreenState();
}

class _BauCuaRoomScreenState extends State<BauCuaRoomScreen> {
  final _rs = RoomService.instance;

  GameRoom?        _room;
  List<RoomPlayer> _players = [];

  int     _betAmount  = 50;
  int?    _betChoice;
  bool    _placing    = false;
  bool    _rolling    = false;

  // Animation
  List<int> _diceDisplay = [0, 0, 0];
  bool      _animating   = false;
  Timer?    _diceTimer;

  // ── Listener callbacks ────────────────────────────────────────────────────
  void _onRoomChanged() {
    if (!mounted) return;
    final r    = _rs.roomNotifier.value;
    final prev = _room?.status;
    setState(() => _room = r);
    if (r != null && prev != 'rolling' && r.status == 'rolling') {
      _showResult(r);
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
    _rs.roomNotifier.addListener(_onRoomChanged);
    _rs.playersNotifier.addListener(_onPlayersChanged);
  }

  @override
  void dispose() {
    _rs.roomNotifier.removeListener(_onRoomChanged);
    _rs.playersNotifier.removeListener(_onPlayersChanged);
    _diceTimer?.cancel();
    super.dispose();
  }

  String get _myId => AuthService.instance.currentUser?.id ?? '';
  bool   get _isHost => _rs.isHost;
  RoomPlayer? get _me => _players.where((p) => p.playerId == _myId).firstOrNull;

  Future<void> _placeBet() async {
    if (_betChoice == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Chọn con vật để đặt cược'),
            backgroundColor: Color(0xFFE53935)));
      return;
    }
    setState(() => _placing = true);
    try {
      await _rs.placeBet(amount: _betAmount, choice: _betChoice.toString());
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

  Future<void> _hostOpenBetting() async {
    await _rs.openBetting();
  }

  void _showResult(GameRoom room) {
    if (room.gameState == null) return;
    final state = BauCuaState.fromJson(room.gameState!);

    setState(() => _animating = true);
    int ticks = 0;
    _diceTimer = Timer.periodic(const Duration(milliseconds: 100), (t) {
      if (!mounted) { t.cancel(); return; }
      ticks++;
      setState(() {
        _diceDisplay = [
          ticks < 20 ? (ticks * 7) % 6 : state.dice[0],
          ticks < 20 ? (ticks * 3 + 2) % 6 : state.dice[1],
          ticks < 20 ? (ticks * 5 + 4) % 6 : state.dice[2],
        ];
      });
      if (ticks >= 20) {
        t.cancel();
        if (mounted) {
          setState(() => _animating = false);
          _rs.settleMyBet();
        }
      }
    });
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
          _buildDiceArea(room),
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
      'rolling': 'Đang quay',
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
        Text('Bầu Cua — ${room.roomCode}',
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

  Widget _buildDiceArea(GameRoom room) {
    final hasDice = room.status == 'rolling' || room.gameState != null;
    final dice    = hasDice
        ? (room.status == 'rolling' || _animating
            ? _diceDisplay
            : (room.gameState != null
                ? BauCuaState.fromJson(room.gameState!).dice
                : [0, 0, 0]))
        : null;

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(vertical: 28),
      decoration: const BoxDecoration(
        gradient: LinearGradient(
          colors: [Color(0xFF0F0F22), Color(0xFF1A1A35)],
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
        ),
      ),
      child: dice == null
          ? Column(children: [
              const Icon(Icons.casino_rounded, color: Color(0xFF444466), size: 52),
              const SizedBox(height: 8),
              Text('Vòng ${room.roundNumber}',
                  style: const TextStyle(color: Color(0xFF666688))),
            ])
          : Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: dice.map((d) {
                final sym = BauCuaSym.values[d];
                return Container(
                  margin: const EdgeInsets.symmetric(horizontal: 10),
                  width: 72,
                  height: 72,
                  decoration: BoxDecoration(
                    color: const Color(0xFF0A0A1A),
                    borderRadius: BorderRadius.circular(16),
                    border: Border.all(color: const Color(0xFF7C6FFF), width: 2),
                    boxShadow: [BoxShadow(
                      color: const Color(0xFF7C6FFF).withOpacity(0.3),
                      blurRadius: 12,
                    )],
                  ),
                  child: Center(
                    child: Text(sym.emoji, style: const TextStyle(fontSize: 34)),
                  ),
                );
              }).toList(),
            ),
    );
  }

  Widget _buildBetPanel(GameRoom room) {
    final me        = _me;
    final alreadyBet = me?.isReady ?? false;

    if (alreadyBet) {
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
          Text('Đã cược ${me!.betAmount} xu vào ${BauCuaSym.values[int.parse(me.betChoice!)].label}',
              style: const TextStyle(color: Color(0xFF4CAF50), fontWeight: FontWeight.bold)),
        ]),
      );
    }

    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      const Text('CHỌN CON VẬT',
          style: TextStyle(color: Color(0xFF7C6FFF), fontSize: 12,
              fontWeight: FontWeight.bold, letterSpacing: 1.5)),
      const SizedBox(height: 10),
      GridView.builder(
        shrinkWrap: true,
        physics: const NeverScrollableScrollPhysics(),
        gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
            crossAxisCount: 3, mainAxisSpacing: 8, crossAxisSpacing: 8,
            childAspectRatio: 1.2),
        itemCount: 6,
        itemBuilder: (_, i) {
          final sym = BauCuaSym.values[i];
          final sel = _betChoice == i;
          return GestureDetector(
            onTap: () => setState(() => _betChoice = i),
            child: AnimatedContainer(
              duration: const Duration(milliseconds: 150),
              decoration: BoxDecoration(
                color: sel ? const Color(0xFF7C6FFF).withOpacity(0.2) : const Color(0xFF0F0F22),
                borderRadius: BorderRadius.circular(12),
                border: Border.all(
                  color: sel ? const Color(0xFF7C6FFF) : const Color(0xFF2A2A44),
                  width: sel ? 2 : 1,
                ),
              ),
              child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
                Text(sym.emoji, style: const TextStyle(fontSize: 26)),
                const SizedBox(height: 4),
                Text(sym.label, style: TextStyle(
                    color: sel ? Colors.white : const Color(0xFF7777AA),
                    fontSize: 12)),
              ]),
            ),
          );
        },
      ),
      const SizedBox(height: 14),
      const Text('SỐ XU CƯỢC',
          style: TextStyle(color: Color(0xFF7C6FFF), fontSize: 12,
              fontWeight: FontWeight.bold, letterSpacing: 1.5)),
      const SizedBox(height: 8),
      _BetAmountSelector(
        value:  _betAmount,
        min:    room.minBet,
        max:    room.maxBet,
        onChange: (v) => setState(() => _betAmount = v),
      ),
      const SizedBox(height: 14),
      SizedBox(
        width: double.infinity,
        child: FilledButton(
          onPressed: _placing ? null : _placeBet,
          style: FilledButton.styleFrom(
            backgroundColor: const Color(0xFFE53935),
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
                  Text('Cược ${p.betAmount} xu — ${BauCuaSym.values[int.parse(p.betChoice!)].label}',
                      style: const TextStyle(color: Color(0xFF888888), fontSize: 11)),
              ])),
              Column(crossAxisAlignment: CrossAxisAlignment.end, children: [
                if (delta != 0) Text(
                  '${delta > 0 ? "+" : ""}$delta xu',
                  style: TextStyle(color: deltaColor, fontWeight: FontWeight.bold, fontSize: 13),
                ),
                Text('Tổng: ${p.totalDelta > 0 ? "+" : ""}${p.totalDelta}',
                    style: const TextStyle(color: Color(0xFF555577), fontSize: 11)),
              ]),
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
              onPressed: _hostOpenBetting,
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
          Text(
            '${_players.where((p) => p.isReady).length}/${_players.length} đã cược',
            style: const TextStyle(color: Color(0xFF888888), fontSize: 12),
          ),
          const SizedBox(height: 8),
          SizedBox(
            width: double.infinity,
            child: FilledButton.icon(
              onPressed: _rolling ? null : _hostRoll,
              icon: const Icon(Icons.casino_rounded),
              label: _rolling
                  ? const Text('Đang quay...')
                  : const Text('Quay Xúc Xắc'),
              style: FilledButton.styleFrom(
                backgroundColor: const Color(0xFFE53935),
                padding: const EdgeInsets.symmetric(vertical: 14),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
              ),
            ),
          ),
        ],
        if (room.status == 'rolling') ...[
          const Text('Đã xem kết quả',
              style: TextStyle(color: Color(0xFF888888), fontSize: 12)),
          const SizedBox(height: 8),
          SizedBox(
            width: double.infinity,
            child: FilledButton.icon(
              onPressed: _hostOpenBetting,
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

// ── Bet Amount Selector ────────────────────────────────────────────────────────

class _BetAmountSelector extends StatelessWidget {
  final int value;
  final int min;
  final int max;
  final void Function(int) onChange;

  const _BetAmountSelector({
    required this.value,
    required this.min,
    required this.max,
    required this.onChange,
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
                child: Text('$p',
                    style: TextStyle(
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
