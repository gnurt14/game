// xi_jack_room_screen.dart — Multiplayer Xì Jack v2
//
// Flow:
//   waiting  → đặt cược + bấm Sẵn Sàng
//   betting  → countdown 5s (tự động sau khi tất cả ready), host tự deal
//   rolling/playing  → hit/stand (15s/lượt)
//   rolling/revealing → dealer lật bài, tự tính kết quả
//   waiting  → vòng mới
//
// Card pool chia sẻ: 1 deck duy nhất, host quản lý deck_ptr.
// Bài của người khác bị ẩn trong UI.

import 'dart:async';
import 'package:flutter/material.dart';
import '../../auth/auth_service.dart';
import '../../coin/coin_service.dart';
import '../room_model.dart';
import '../room_service.dart';

// ── Card helpers ───────────────────────────────────────────────────────────────

class _Card {
  final String rank;
  final String suit;
  const _Card(this.rank, this.suit);

  factory _Card.fromStr(String s) =>
      _Card(s.substring(0, s.length - 1), s[s.length - 1]);

  bool   get isRed   => suit == '♥' || suit == '♦';
  String get display => '$rank$suit';

  int get value {
    if (['J','Q','K'].contains(rank)) return 10;
    if (rank == 'A') return 11;
    return int.tryParse(rank) ?? 0;
  }
}

int _handValue(List<_Card> hand) {
  int total = hand.fold(0, (s, c) => s + c.value);
  int aces  = hand.where((c) => c.rank == 'A').length;
  while (total > 21 && aces > 0) { total -= 10; aces--; }
  return total;
}

// ── Screen ─────────────────────────────────────────────────────────────────────

class XiJackRoomScreen extends StatefulWidget {
  const XiJackRoomScreen({super.key});

  @override
  State<XiJackRoomScreen> createState() => _XiJackRoomScreenState();
}

class _XiJackRoomScreenState extends State<XiJackRoomScreen> {
  final _rs = RoomService.instance;

  GameRoom?        _room;
  List<RoomPlayer> _players = [];

  // Lobby
  int  _betAmount  = 50;
  bool _betLoading = false;

  // Countdown display
  Timer? _countdownTimer;
  int    _countdownSeconds = 5;

  // Turn timer
  Timer? _turnTimer;
  int    _turnSeconds   = 15;
  bool   _waitingForHit = false;
  int    _prevHandSize  = 0;

  // Settlement
  bool _settled = false;

  // ── Listeners ──────────────────────────────────────────────────────────────

  void _onRoomChanged() {
    if (!mounted) return;
    final r    = _rs.roomNotifier.value;
    final prev = _room;
    setState(() => _room = r);
    if (r == null) return;

    // → countdown
    if (prev?.status != 'betting' && r.status == 'betting') {
      _startCountdown(r);
    }

    // → game started
    if (prev?.status != 'rolling' && r.status == 'rolling') {
      _countdownTimer?.cancel();
      setState(() { _settled = false; _prevHandSize = 0; _waitingForHit = false; });
      _maybeStartTurnTimer(r);
    }

    // game_state changes while rolling
    if (r.status == 'rolling') {
      final gs = _xjState;

      // Phase: revealing — auto settle
      if (gs?.phase == 'revealing' && !_settled) {
        _settled = true;
        _turnTimer?.cancel();
        _rs.settleXiJack();
      }

      // Hit được xử lý (hand lớn hơn)
      if (_waitingForHit && gs != null) {
        final myHand = gs.playerHands[_myId] ?? [];
        if (myHand.length > _prevHandSize) {
          _prevHandSize = myHand.length;
          _waitingForHit = false;
          _rs.xiJackClearAction();
          if (gs.playerActions[_myId] == null) _startTurnTimer();
        }
      }
    }

    // → back to waiting — reset own row
    if (prev?.status != null && prev!.status != 'waiting' && r.status == 'waiting') {
      _turnTimer?.cancel();
      _countdownTimer?.cancel();
      setState(() { _settled = false; _waitingForHit = false; _prevHandSize = 0; });
      _rs.resetMyPlayerRow();
    }

    // Host: ensure deal after countdown if missed the Future.delayed
    if (_rs.isHost && r.status == 'betting') {
      final gs = r.gameState;
      if (gs != null && gs['phase'] == 'countdown' && gs['countdown_at'] != null) {
        final at = DateTime.tryParse(gs['countdown_at'] as String)?.toLocal();
        if (at != null) {
          final elapsed = DateTime.now().difference(at).inMilliseconds;
          if (elapsed >= 5000) _rs.xiJackDeal();
        }
      }
    }
  }

  void _onPlayersChanged() {
    if (!mounted) return;
    setState(() => _players = _rs.playersNotifier.value);
  }

  // ── Lifecycle ──────────────────────────────────────────────────────────────

  @override
  void initState() {
    super.initState();
    _room    = _rs.currentRoom;
    _players = _rs.players;
    _rs.roomNotifier.addListener(_onRoomChanged);
    _rs.playersNotifier.addListener(_onPlayersChanged);

    final r = _room;
    if (r?.status == 'betting') _startCountdown(r!);
    if (r?.status == 'rolling') _maybeStartTurnTimer(r!);
  }

  @override
  void dispose() {
    _countdownTimer?.cancel();
    _turnTimer?.cancel();
    _rs.roomNotifier.removeListener(_onRoomChanged);
    _rs.playersNotifier.removeListener(_onPlayersChanged);
    super.dispose();
  }

  // ── Derived state ──────────────────────────────────────────────────────────

  String get _myId   => AuthService.instance.currentUser?.id ?? '';
  bool   get _isHost => _rs.isHost;

  XiJackGameState? get _xjState {
    final gs = _room?.gameState;
    if (gs == null) return null;
    try { return XiJackGameState.fromJson(gs); } catch (_) { return null; }
  }

  List<_Card> get _myHand =>
      (_xjState?.playerHands[_myId] ?? []).map(_Card.fromStr).toList();

  List<_Card> get _dealerCards {
    final gs = _xjState;
    if (gs == null) return [];
    if (gs.dealerFinal != null) return gs.dealerFinal!.map(_Card.fromStr).toList();
    if (gs.dealerVisible != null) return [_Card.fromStr(gs.dealerVisible!)];
    return [];
  }

  String? get _myAction   => _xjState?.playerActions[_myId];
  bool    get _myTurnDone => _myAction != null;

  // ── Countdown ──────────────────────────────────────────────────────────────

  void _startCountdown(GameRoom r) {
    final gs = r.gameState;
    if (gs == null || gs['phase'] != 'countdown') return;
    final at = DateTime.tryParse(gs['countdown_at'] as String? ?? '')?.toLocal();
    if (at == null) return;
    _countdownTimer?.cancel();
    _countdownTimer = Timer.periodic(const Duration(seconds: 1), (_) {
      if (!mounted) return;
      final rem = (5 - DateTime.now().difference(at).inSeconds).clamp(0, 5);
      setState(() => _countdownSeconds = rem);
      if (rem <= 0) _countdownTimer?.cancel();
    });
  }

  // ── Turn timer ─────────────────────────────────────────────────────────────

  void _maybeStartTurnTimer(GameRoom r) {
    final gs = _xjState ??
        (r.gameState != null ? XiJackGameState.fromJson(r.gameState!) : null);
    if (gs?.phase != 'playing') return;
    if (gs?.playerActions[_myId] != null) return;
    _prevHandSize = (gs?.playerHands[_myId] ?? []).length;
    _startTurnTimer();
  }

  void _startTurnTimer() {
    _turnTimer?.cancel();
    setState(() => _turnSeconds = 15);
    _turnTimer = Timer.periodic(const Duration(seconds: 1), (_) {
      if (!mounted) return;
      setState(() => _turnSeconds--);
      if (_turnSeconds <= 0) { _turnTimer?.cancel(); _autoStand(); }
    });
  }

  void _autoStand() {
    if (_myTurnDone || _waitingForHit) return;
    _rs.xiJackRequestStand();
  }

  // ── Actions ────────────────────────────────────────────────────────────────

  Future<void> _ready() async {
    setState(() => _betLoading = true);
    try {
      await _rs.xiJackReady(betAmount: _betAmount);
    } catch (e) {
      if (mounted) _showSnack(e.toString(), error: true);
    } finally {
      if (mounted) setState(() => _betLoading = false);
    }
  }

  Future<void> _unready() async {
    try { await _rs.xiJackUnready(); }
    catch (e) { if (mounted) _showSnack(e.toString(), error: true); }
  }

  void _hit() {
    if (_myTurnDone || _waitingForHit) return;
    _turnTimer?.cancel();
    setState(() => _waitingForHit = true);
    _rs.xiJackRequestHit(_myHand.length + 1);
  }

  void _stand() {
    if (_myTurnDone || _waitingForHit) return;
    _turnTimer?.cancel();
    _rs.xiJackRequestStand();
  }

  Future<void> _leaveRoom() async {
    _turnTimer?.cancel();
    _countdownTimer?.cancel();
    await _rs.leaveRoom();
    if (mounted) Navigator.pop(context);
  }

  void _showSnack(String msg, {bool error = false}) =>
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(
        content: Text(msg),
        backgroundColor: error ? const Color(0xFFE53935) : null,
      ));

  // ── Build ──────────────────────────────────────────────────────────────────

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
          _buildTableArea(room),
          Expanded(child: SingleChildScrollView(
            padding: const EdgeInsets.all(16),
            child: _buildBody(room),
          )),
        ]),
      ),
    );
  }

  // ── AppBar ─────────────────────────────────────────────────────────────────

  AppBar _buildAppBar(GameRoom room) {
    final label = {
      'waiting': 'Sảnh chờ',
      'betting': 'Chuẩn bị...',
      'rolling': 'Đang chơi',
    }[room.status] ?? room.status;

    return AppBar(
      backgroundColor: const Color(0xFF0A0A1A),
      foregroundColor: Colors.white,
      leading: IconButton(
        icon: const Icon(Icons.exit_to_app_rounded),
        onPressed: _leaveRoom,
      ),
      title: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text('Xì Jack — ${room.roomCode}',
            style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
        Text(label, style: const TextStyle(fontSize: 11, color: Color(0xFF7777AA))),
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

  // ── Table area ─────────────────────────────────────────────────────────────

  Widget _buildTableArea(GameRoom room) {
    return Container(
      width: double.infinity,
      constraints: const BoxConstraints(minHeight: 160),
      padding: const EdgeInsets.symmetric(vertical: 20, horizontal: 16),
      decoration: const BoxDecoration(
        gradient: LinearGradient(
          colors: [Color(0xFF0D2818), Color(0xFF1A1A35)],
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
        ),
      ),
      child: _buildTable(room),
    );
  }

  Widget _buildTable(GameRoom room) {
    final gs = _xjState;

    // Countdown
    if (room.status == 'betting' && gs?.phase == 'countdown') {
      return _CountdownWidget(seconds: _countdownSeconds);
    }

    // Lobby/Waiting
    if (gs == null) {
      return Column(mainAxisSize: MainAxisSize.min, children: [
        const Icon(Icons.casino_rounded, color: Color(0xFF444466), size: 48),
        const SizedBox(height: 8),
        Text('Vòng ${room.roundNumber}',
            style: const TextStyle(color: Color(0xFF666688))),
        const SizedBox(height: 4),
        const Text('Đặt cược và bấm Sẵn Sàng',
            style: TextStyle(color: Color(0xFF444466), fontSize: 12)),
      ]);
    }

    // Game table
    final myHand    = _myHand;
    final myVal     = _handValue(myHand);
    final myAction  = _myAction;
    final dCards    = _dealerCards;
    final dVal      = gs.dealerFinal != null ? _handValue(dCards) : null;
    final isReveal  = gs.phase == 'revealing';

    return Column(mainAxisSize: MainAxisSize.min, children: [
      // Dealer row
      _HandRow(
        label: isReveal && dVal != null ? 'Dealer ($dVal)' : 'Dealer',
        cards: dCards,
        showHidden: gs.phase == 'playing', // lá úp
        labelColor: const Color(0xFF888888),
      ),
      const SizedBox(height: 14),
      // My hand row
      Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Expanded(child: _HandRow(
          label: 'Bạn ($myVal)',
          cards: myHand,
          labelColor: Colors.white,
          suffix: myAction != null ? _ActionBadge(action: myAction) : null,
        )),
      ]),
      // Result banner
      if (isReveal && _settled && myHand.isNotEmpty) ...[
        const SizedBox(height: 10),
        _ResultBadge(
          myValue:     myVal,
          dealerValue: dVal ?? 0,
          myAction:    myAction,
        ),
      ],
    ]);
  }

  // ── Body ───────────────────────────────────────────────────────────────────

  Widget _buildBody(GameRoom room) {
    final gs = _xjState;

    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      // Lobby
      if (room.status == 'waiting') ...[
        _buildLobbyPanel(room),
        const SizedBox(height: 16),
      ],

      // Turn controls (chỉ hiện nếu player có trong ván này)
      if (room.status == 'rolling' && gs?.phase == 'playing'
          && !_myTurnDone && gs?.playerHands.containsKey(_myId) == true) ...[
        _buildTurnPanel(),
        const SizedBox(height: 16),
      ],

      // Waiting for others (stood/busted, not yet revealing)
      if (room.status == 'rolling' && gs?.phase == 'playing'
          && (_myTurnDone || gs?.playerHands.containsKey(_myId) != true)) ...[
        _WaitingOthers(players: _players, actions: gs?.playerActions ?? {}, myId: _myId),
        const SizedBox(height: 16),
      ],

      // Host: next round button
      if (room.status == 'rolling' && gs?.phase == 'revealing' && _isHost) ...[
        SizedBox(width: double.infinity, child: FilledButton.icon(
          onPressed: _rs.resetXiJackRound,
          icon: const Icon(Icons.refresh_rounded),
          label: const Text('Vòng Tiếp Theo',
              style: TextStyle(fontSize: 15, fontWeight: FontWeight.bold)),
          style: FilledButton.styleFrom(
            backgroundColor: const Color(0xFF2E7D32),
            padding: const EdgeInsets.symmetric(vertical: 14),
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
          ),
        )),
        const SizedBox(height: 16),
      ],

      // Players list
      _buildPlayersList(room),
    ]);
  }

  // ── Lobby panel ────────────────────────────────────────────────────────────

  Widget _buildLobbyPanel(GameRoom room) {
    final me      = _players.where((p) => p.playerId == _myId).firstOrNull;
    final isReady = me?.isReady ?? false;
    final readyCount = _players.where((p) => p.isReady).length;

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: const Color(0xFF0F0F22),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFF2A2A44)),
      ),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        const Text('ĐẶT CƯỢC & SẴN SÀNG',
            style: TextStyle(color: Color(0xFF7C6FFF), fontSize: 12,
                fontWeight: FontWeight.bold, letterSpacing: 1.5)),
        const SizedBox(height: 14),

        if (!isReady) ...[
          _BetSelector(
            value: _betAmount,
            min:   room.minBet,
            max:   room.maxBet,
            onChange: (v) => setState(() => _betAmount = v),
          ),
          const SizedBox(height: 14),
          SizedBox(width: double.infinity, child: FilledButton(
            onPressed: _betLoading ? null : _ready,
            style: FilledButton.styleFrom(
              backgroundColor: const Color(0xFF7C6FFF),
              padding: const EdgeInsets.symmetric(vertical: 14),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
            ),
            child: _betLoading
                ? const SizedBox(width: 20, height: 20,
                    child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                : Text('Sẵn Sàng — Cược $_betAmount xu',
                    style: const TextStyle(fontSize: 15, fontWeight: FontWeight.bold)),
          )),
        ] else ...[
          Row(children: [
            const Icon(Icons.check_circle_rounded, color: Color(0xFF4CAF50), size: 22),
            const SizedBox(width: 8),
            Text('Sẵn sàng — Cược ${me!.betAmount} xu',
                style: const TextStyle(color: Color(0xFF4CAF50),
                    fontWeight: FontWeight.bold, fontSize: 14)),
            const Spacer(),
            TextButton(
              onPressed: _unready,
              child: const Text('Hủy', style: TextStyle(color: Color(0xFF666688))),
            ),
          ]),
        ],

        const SizedBox(height: 8),
        Row(children: [
          ...List.generate(_players.length, (i) {
            final p    = _players[i];
            final rdy  = p.isReady;
            return Padding(
              padding: const EdgeInsets.only(right: 6),
              child: Column(mainAxisSize: MainAxisSize.min, children: [
                CircleAvatar(
                  radius: 14,
                  backgroundColor: rdy
                      ? const Color(0xFF4CAF50).withOpacity(0.2)
                      : const Color(0xFF1A1A35),
                  child: Text(p.displayName[0].toUpperCase(),
                      style: TextStyle(
                          color: rdy ? const Color(0xFF4CAF50) : const Color(0xFF555577),
                          fontSize: 12, fontWeight: FontWeight.bold)),
                ),
                const SizedBox(height: 2),
                Icon(rdy ? Icons.check : Icons.schedule,
                    size: 12,
                    color: rdy ? const Color(0xFF4CAF50) : const Color(0xFF444466)),
              ]),
            );
          }),
          const SizedBox(width: 4),
          Text('$readyCount/${_players.length}',
              style: const TextStyle(color: Color(0xFF555577), fontSize: 12)),
        ]),
      ]),
    );
  }

  // ── Turn panel ─────────────────────────────────────────────────────────────

  Widget _buildTurnPanel() {
    final danger = _turnSeconds <= 5;
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: const Color(0xFF0F0F22),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
          color: _waitingForHit
              ? const Color(0xFF2A2A44)
              : danger
                  ? const Color(0xFFE53935).withOpacity(0.5)
                  : const Color(0xFF7C6FFF).withOpacity(0.4),
        ),
      ),
      child: Column(children: [
        Row(children: [
          Text(
            _waitingForHit ? 'Đang rút bài...' : 'Lượt của bạn',
            style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 15),
          ),
          const Spacer(),
          if (!_waitingForHit) ...[
            Icon(Icons.timer_rounded, size: 16,
                color: danger ? const Color(0xFFE53935) : const Color(0xFF7C6FFF)),
            const SizedBox(width: 4),
            Text('$_turnSeconds', style: TextStyle(
                fontWeight: FontWeight.bold, fontSize: 18,
                color: danger ? const Color(0xFFE53935) : const Color(0xFF7C6FFF))),
          ],
        ]),
        if (!_waitingForHit) ...[
          const SizedBox(height: 6),
          ClipRRect(
            borderRadius: BorderRadius.circular(4),
            child: LinearProgressIndicator(
              value: _turnSeconds / 15,
              minHeight: 4,
              backgroundColor: const Color(0xFF1A1A35),
              color: danger ? const Color(0xFFE53935) : const Color(0xFF7C6FFF),
            ),
          ),
        ],
        const SizedBox(height: 14),
        if (_waitingForHit)
          const Center(child: SizedBox(width: 24, height: 24,
              child: CircularProgressIndicator(strokeWidth: 2, color: Color(0xFF7777AA))))
        else
          Row(children: [
            Expanded(child: FilledButton.icon(
              onPressed: _hit,
              icon: const Icon(Icons.add_rounded),
              label: const Text('Rút', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 15)),
              style: FilledButton.styleFrom(
                backgroundColor: const Color(0xFF7C6FFF),
                padding: const EdgeInsets.symmetric(vertical: 14),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
              ),
            )),
            const SizedBox(width: 12),
            Expanded(child: OutlinedButton.icon(
              onPressed: _stand,
              icon: const Icon(Icons.pan_tool_rounded),
              label: const Text('Dừng', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 15)),
              style: OutlinedButton.styleFrom(
                foregroundColor: Colors.white,
                side: const BorderSide(color: Color(0xFF3A3A55)),
                padding: const EdgeInsets.symmetric(vertical: 14),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
              ),
            )),
          ]),
      ]),
    );
  }

  // ── Players list ───────────────────────────────────────────────────────────

  Widget _buildPlayersList(GameRoom room) {
    final gs = _xjState;
    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      Text('NGƯỜI CHƠI (${_players.length})',
          style: const TextStyle(color: Color(0xFF7777AA), fontSize: 12,
              fontWeight: FontWeight.bold, letterSpacing: 1.5)),
      const SizedBox(height: 8),
      ..._players.map((p) {
        final isMe  = p.playerId == _myId;
        final delta = p.resultDelta;

        String status;
        Color  statusColor = const Color(0xFF555577);

        if (room.status == 'waiting') {
          if (p.isReady) { status = '✓ Sẵn sàng  ${p.betAmount} xu'; statusColor = const Color(0xFF4CAF50); }
          else           { status = 'Chưa sẵn sàng'; }
        } else if (room.status == 'betting') {
          status = '⏳ Đang chuẩn bị...';
        } else {
          final action = gs?.playerActions[p.playerId];
          if (action == 'stand')      { status = '🤚 Dừng';       statusColor = const Color(0xFFFFD700); }
          else if (action == 'bust')  { status = '💥 Quá 21';     statusColor = const Color(0xFFE57373); }
          else if (action == 'blackjack') { status = '🎰 Blackjack!'; statusColor = const Color(0xFFFFD700); }
          else                        { status = '🤔 Đang nghĩ...'; statusColor = const Color(0xFF7C6FFF); }

          if (gs?.phase == 'revealing' && p.xiJackResult != null) {
            status = {
              'win': '🏆 Thắng', 'lose': '😢 Thua',
              'push': '🤝 Hòa', 'blackjack': '🎰 Blackjack',
            }[p.xiJackResult] ?? p.xiJackResult!;
          }
        }

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
                  style: const TextStyle(color: Colors.white, fontSize: 13,
                      fontWeight: FontWeight.w500)),
              Text(status, style: TextStyle(color: statusColor, fontSize: 11)),
            ])),
            if (delta != 0)
              Text('${delta > 0 ? "+" : ""}$delta xu',
                  style: TextStyle(
                    color: delta > 0 ? const Color(0xFF4CAF50) : const Color(0xFFE57373),
                    fontWeight: FontWeight.bold, fontSize: 13,
                  )),
          ]),
        );
      }),
    ]);
  }
}

// ── Waiting for others ─────────────────────────────────────────────────────────

class _WaitingOthers extends StatelessWidget {
  final List<RoomPlayer>         players;
  final Map<String, String?>     actions;
  final String                   myId;
  const _WaitingOthers({required this.players, required this.actions, required this.myId});

  @override
  Widget build(BuildContext context) {
    final others  = players.where((p) => p.playerId != myId).toList();
    final pending = others.where((p) => actions[p.playerId] == null).length;

    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: const Color(0xFF0F0F22),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: const Color(0xFF2A2A44)),
      ),
      child: Row(children: [
        const SizedBox(width: 24, height: 24,
            child: CircularProgressIndicator(strokeWidth: 2, color: Color(0xFF7777AA))),
        const SizedBox(width: 12),
        Text(
          pending > 0
              ? 'Chờ $pending người khác...'
              : 'Chờ dealer lật bài...',
          style: const TextStyle(color: Color(0xFF888888)),
        ),
      ]),
    );
  }
}

// ── Hand row ───────────────────────────────────────────────────────────────────

class _HandRow extends StatelessWidget {
  final String      label;
  final List<_Card> cards;
  final Color       labelColor;
  final bool        showHidden; // lá úp của dealer
  final Widget?     suffix;
  const _HandRow({
    required this.label,
    required this.cards,
    required this.labelColor,
    this.showHidden = false,
    this.suffix,
  });

  @override
  Widget build(BuildContext context) {
    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      Row(children: [
        Text(label, style: TextStyle(color: labelColor, fontSize: 12,
            fontWeight: FontWeight.bold)),
        if (suffix != null) ...[const SizedBox(width: 8), suffix!],
      ]),
      const SizedBox(height: 6),
      SingleChildScrollView(
        scrollDirection: Axis.horizontal,
        child: Row(children: [
          ...cards.map((c) => _CardWidget(card: c)),
          if (showHidden) const _CardWidget(hidden: true),
        ]),
      ),
    ]);
  }
}

// ── Card widget ────────────────────────────────────────────────────────────────

class _CardWidget extends StatelessWidget {
  final _Card? card;
  final bool   hidden;
  const _CardWidget({this.card, this.hidden = false});

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(right: 6),
      width: 44, height: 64,
      decoration: BoxDecoration(
        color: hidden ? const Color(0xFF1A1A35) : Colors.white,
        borderRadius: BorderRadius.circular(8),
        border: Border.all(
            color: hidden ? const Color(0xFF3A3A55) : Colors.transparent),
        boxShadow: [BoxShadow(color: Colors.black.withOpacity(0.3), blurRadius: 4)],
      ),
      child: Center(
        child: hidden
            ? const Text('?', style: TextStyle(color: Color(0xFF555577),
                fontSize: 20, fontWeight: FontWeight.bold))
            : Text(card?.display ?? '',
                style: TextStyle(
                  color: (card?.isRed ?? false) ? const Color(0xFFE53935) : Colors.black,
                  fontSize: (card?.display.length ?? 0) > 2 ? 11 : 14,
                  fontWeight: FontWeight.bold,
                )),
      ),
    );
  }
}

// ── Action badge ──────────────────────────────────────────────────────────────

class _ActionBadge extends StatelessWidget {
  final String action;
  const _ActionBadge({required this.action});

  @override
  Widget build(BuildContext context) {
    final (label, color) = switch (action) {
      'stand'     => ('DỪNG',   const Color(0xFFFFD700)),
      'bust'      => ('QUÁ 21', const Color(0xFFE57373)),
      'blackjack' => ('BJ!',    const Color(0xFF4CAF50)),
      _           => (action.toUpperCase(), const Color(0xFF7777AA)),
    };
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
      decoration: BoxDecoration(
        color: color.withOpacity(0.15),
        borderRadius: BorderRadius.circular(6),
        border: Border.all(color: color.withOpacity(0.5)),
      ),
      child: Text(label, style: TextStyle(color: color, fontSize: 10,
          fontWeight: FontWeight.bold)),
    );
  }
}

// ── Result badge ──────────────────────────────────────────────────────────────

class _ResultBadge extends StatelessWidget {
  final int     myValue;
  final int     dealerValue;
  final String? myAction;
  const _ResultBadge({required this.myValue, required this.dealerValue, this.myAction});

  @override
  Widget build(BuildContext context) {
    final String label;
    final Color  color;

    if (myAction == 'bust') {
      label = '💥 THUA — Quá 21';                      color = const Color(0xFFE57373);
    } else if (myAction == 'blackjack') {
      label = '🎰 BLACKJACK! +1.5x';                   color = const Color(0xFF4CAF50);
    } else if (dealerValue > 21) {
      label = '🏆 THẮNG — Dealer quá 21!';             color = const Color(0xFF4CAF50);
    } else if (myValue > dealerValue) {
      label = '🏆 THẮNG — $myValue vs $dealerValue';   color = const Color(0xFF4CAF50);
    } else if (myValue == dealerValue) {
      label = '🤝 HÒA — $myValue vs $dealerValue';     color = const Color(0xFF7777AA);
    } else {
      label = '😢 THUA — $myValue vs $dealerValue';    color = const Color(0xFFE57373);
    }

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 8),
      decoration: BoxDecoration(
        color: color.withOpacity(0.15),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: color.withOpacity(0.5)),
      ),
      child: Text(label, style: TextStyle(color: color,
          fontWeight: FontWeight.bold, fontSize: 14)),
    );
  }
}

// ── Countdown widget ──────────────────────────────────────────────────────────

class _CountdownWidget extends StatelessWidget {
  final int seconds;
  const _CountdownWidget({required this.seconds});

  @override
  Widget build(BuildContext context) {
    return Column(mainAxisSize: MainAxisSize.min, children: [
      Text(
        seconds > 0 ? '$seconds' : 'BẮT ĐẦU!',
        style: TextStyle(
          fontSize: 72, fontWeight: FontWeight.bold,
          color: seconds <= 2 ? const Color(0xFFE53935) : const Color(0xFF7C6FFF),
        ),
      ),
      const SizedBox(height: 4),
      const Text('Tất cả đã sẵn sàng, chuẩn bị rút bài!',
          style: TextStyle(color: Color(0xFF7777AA), fontSize: 12)),
    ]);
  }
}

// ── Bet selector ──────────────────────────────────────────────────────────────

class _BetSelector extends StatelessWidget {
  final int value;
  final int min;
  final int max;
  final void Function(int) onChange;
  const _BetSelector({required this.value, required this.min,
      required this.max, required this.onChange});

  @override
  Widget build(BuildContext context) {
    final presets = <int>{min, (min * 2).clamp(min, max),
        (max ~/ 2).clamp(min, max), max}.toList()..sort();

    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      Wrap(spacing: 8, runSpacing: 6, children: presets.map((p) {
        final sel = value == p;
        return GestureDetector(
          onTap: () => onChange(p),
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
            decoration: BoxDecoration(
              color: sel ? const Color(0xFF7C6FFF) : const Color(0xFF1A1A35),
              borderRadius: BorderRadius.circular(10),
              border: Border.all(
                  color: sel ? const Color(0xFF7C6FFF) : const Color(0xFF2A2A44)),
            ),
            child: Text('$p xu', style: TextStyle(
              color: sel ? Colors.white : const Color(0xFF8888AA),
              fontWeight: FontWeight.bold, fontSize: 13,
            )),
          ),
        );
      }).toList()),
      const SizedBox(height: 8),
      Row(children: [
        IconButton(
          onPressed: value > min ? () => onChange((value - min).clamp(min, max)) : null,
          icon: const Icon(Icons.remove_circle_outline_rounded, color: Color(0xFF7777AA)),
        ),
        Expanded(child: Center(
          child: Text('$value xu', style: const TextStyle(
              color: Colors.white, fontSize: 16, fontWeight: FontWeight.bold)),
        )),
        IconButton(
          onPressed: value < max ? () => onChange((value + min).clamp(min, max)) : null,
          icon: const Icon(Icons.add_circle_outline_rounded, color: Color(0xFF7777AA)),
        ),
      ]),
    ]);
  }
}
