// room_service.dart — Shared Gambling Table: room management + Realtime sync
//
// Luồng:
//   Host: createRoom → subscribe → openBetting → rollResult
//   Guest: joinByCode / browsePublic → subscribe → placeBet
//   Tất cả: settleMyBet (tự settle bet của mình), leaveRoom on dispose
//
// Coin logic:
//   • placeBet: deducts coins locally (optimistic)
//   • settleMyBet: mỗi client tự tính delta + update own row + xử lý coins
//     (tránh RLS issue — mỗi player chỉ update row của chính mình)
//
// Realtime + Polling:
//   • Realtime: primary (nếu bật trong Supabase Dashboard)
//   • Polling 3s: fallback (luôn chạy, đảm bảo sync ngay cả khi Realtime chưa bật)

import 'dart:async';
import 'dart:math';
import 'package:flutter/foundation.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import '../auth/auth_service.dart';
import '../coin/coin_service.dart';
import 'room_model.dart';

// ── Xi Jack helpers (top-level) ───────────────────────────────────────────────

List<String> buildXjDeck(int seed) {
  const suits = ['♥', '♦', '♠', '♣'];
  const ranks = ['A','2','3','4','5','6','7','8','9','10','J','Q','K'];
  final deck = [for (final s in suits) for (final r in ranks) '$r$s'];
  deck.shuffle(Random(seed));
  return deck;
}

int xjHandValue(List<String> cards) {
  int total = 0, aces = 0;
  for (final c in cards) {
    final rank = c.substring(0, c.length - 1); // trim suit char
    if (['J','Q','K'].contains(rank)) { total += 10; }
    else if (rank == 'A') { total += 11; aces++; }
    else { total += int.tryParse(rank) ?? 0; }
  }
  while (total > 21 && aces > 0) { total -= 10; aces--; }
  return total;
}

class RoomService {
  RoomService._();
  static final RoomService instance = RoomService._();

  static SupabaseClient get _db => Supabase.instance.client;

  // ── Local state ─────────────────────────────────────────────────────────────
  GameRoom?        _currentRoom;
  List<RoomPlayer> _players       = [];
  RealtimeChannel? _roomChannel;
  RealtimeChannel? _playersChannel;
  Timer?           _pollTimer;

  GameRoom?        get currentRoom    => _currentRoom;
  List<RoomPlayer> get players        => List.unmodifiable(_players);
  String?          get myId           => AuthService.instance.currentUser?.id;
  bool             get isHost         => _currentRoom?.hostId == myId;
  RoomPlayer?      get myPlayerRecord =>
      _players.where((p) => p.playerId == myId).firstOrNull;

  // ValueNotifiers cho UI
  final roomNotifier    = ValueNotifier<GameRoom?>(null);
  final playersNotifier = ValueNotifier<List<RoomPlayer>>([]);

  // ── Create room ─────────────────────────────────────────────────────────────

  Future<GameRoom> createRoom({
    required String gameType,
    required bool   isPublic,
    int minBet = 10,
    int maxBet = 500,
  }) async {
    final uid  = myId!;
    final code = await _generateCode();

    final row = await _db.from('game_rooms').insert({
      'room_code':   code,
      'game_type':   gameType,
      'host_id':     uid,
      'is_public':   isPublic,
      'min_bet':     minBet,
      'max_bet':     maxBet,
      'status':      'waiting',
    }).select().single();

    _currentRoom = GameRoom.fromJson(row);
    await _joinAsPlayer();
    await _subscribe();
    return _currentRoom!;
  }

  // ── Join by room code ────────────────────────────────────────────────────────

  Future<GameRoom> joinByCode(String code) async {
    final row = await _db
        .from('game_rooms')
        .select()
        .eq('room_code', code.toUpperCase())
        .neq('status', 'finished')
        .maybeSingle();

    if (row == null) throw Exception('Không tìm thấy phòng: $code');

    _currentRoom = GameRoom.fromJson(row);
    await _joinAsPlayer();
    await _subscribe();
    return _currentRoom!;
  }

  // ── Browse public rooms ──────────────────────────────────────────────────────

  Future<List<GameRoom>> getPublicRooms({String? gameType}) async {
    var query = _db
        .from('game_rooms')
        .select()
        .eq('is_public', true)
        .eq('status', 'waiting');

    if (gameType != null) {
      query = query.eq('game_type', gameType);
    }

    final rows = await query
        .order('created_at', ascending: false)
        .limit(30);
    return rows.map((r) => GameRoom.fromJson(r)).toList();
  }

  // ── Place bet ───────────────────────────────────────────────────────────────

  Future<void> placeBet({required int amount, required String choice}) async {
    if (_currentRoom == null || myId == null) return;
    if (_currentRoom!.status != 'betting') return;

    final ok = await CoinService.instance.spendCoins(amount);
    if (!ok) throw Exception('Không đủ xu');

    await _db.from('room_players').update({
      'bet_amount': amount,
      'bet_choice': choice,
      'is_ready':   true,
    }).eq('room_id', _currentRoom!.id).eq('player_id', myId!);

    // Refresh ngay để UI cập nhật
    await _refreshPlayers();
  }

  // ── Host: open betting phase ─────────────────────────────────────────────────

  Future<void> openBetting() async {
    if (!isHost || _currentRoom == null) return;
    await _db.from('game_rooms').update({
      'status':       'betting',
      'round_number': (_currentRoom!.roundNumber + 1),
    }).eq('id', _currentRoom!.id);

    // Reset bets cho tất cả players (chỉ reset row của mình — RLS)
    await _db.from('room_players').update({
      'bet_amount':   0,
      'bet_choice':   null,
      'result_delta': 0,
      'is_ready':     false,
    }).eq('room_id', _currentRoom!.id).eq('player_id', myId!);

    // Refresh ngay — không chờ Realtime
    await _refreshRoom();
    await _refreshPlayers();
  }

  // ── Host: roll / reveal result ───────────────────────────────────────────────

  Future<void> rollResult() async {
    if (!isHost || _currentRoom == null) return;

    final Map<String, dynamic> gameState;
    final rng = Random();

    switch (_currentRoom!.gameType) {
      case 'bau_cua':
        gameState = BauCuaState([
          rng.nextInt(6),
          rng.nextInt(6),
          rng.nextInt(6),
        ]).toJson();

      case 'do_den':
        const suits = ['hearts', 'diamonds', 'clubs', 'spades'];
        const ranks = ['A','2','3','4','5','6','7','8','9','10','J','Q','K'];
        final suit  = suits[rng.nextInt(4)];
        final rank  = ranks[rng.nextInt(13)];
        final isRed = suit == 'hearts' || suit == 'diamonds';
        gameState   = DoDenState(CardState(suit: suit, rank: rank, isRed: isRed)).toJson();

      default:
        gameState = {};
    }

    await _db.from('game_rooms').update({
      'status':     'rolling',
      'game_state': gameState,
    }).eq('id', _currentRoom!.id);

    // Refresh ngay — không chờ Realtime
    await _refreshRoom();
  }

  // ── Client-side settlement: mỗi player tự settle bet ────────────────────────
  // Gọi bởi room screen SAU animation xong. Tránh RLS issue vì mỗi người
  // chỉ update row của chính mình.

  Future<void> settleMyBet() async {
    if (_currentRoom == null || myId == null) return;

    // Lấy game_state mới nhất
    if (_currentRoom!.gameState == null) {
      await _refreshRoom();
    }
    if (_currentRoom == null || _currentRoom!.gameState == null) return;

    // Lấy row mới nhất của mình từ DB (tránh stale local cache)
    final myRow = await _db
        .from('room_players')
        .select()
        .eq('room_id', _currentRoom!.id)
        .eq('player_id', myId!)
        .maybeSingle();
    if (myRow == null) return;

    final me = RoomPlayer.fromJson(myRow);
    if (me.betAmount == 0 || me.betChoice == null) return; // đã settle hoặc không bet

    int delta = 0;

    switch (_currentRoom!.gameType) {
      case 'bau_cua':
        final state   = BauCuaState.fromJson(_currentRoom!.gameState!);
        final matches = state.matchCount(int.parse(me.betChoice!));
        delta = matches > 0 ? me.betAmount * matches : -me.betAmount;

      case 'do_den':
        final state  = DoDenState.fromJson(_currentRoom!.gameState!);
        final betRed = me.betChoice == 'red';
        delta = (betRed == state.card.isRed) ? me.betAmount : -me.betAmount;

      case 'xi_jack':
        return; // Xi Jack handled by submitXiJackResult
    }

    // Update own row (RLS: auth.uid() = player_id ✓)
    await _db.from('room_players').update({
      'result_delta': delta,
      'total_delta':  me.totalDelta + delta,
      'bet_amount':   0,
      'bet_choice':   null,
      'is_ready':     true,
    }).eq('room_id', _currentRoom!.id).eq('player_id', myId!);

    // Xử lý coins locally
    if (delta > 0) {
      await CoinService.instance.earnCoins(me.betAmount + delta);
    }
    // Thua: đã trừ trong placeBet

    await _refreshPlayers();
  }

  // ══════════════════════════════════════════════════════════════════════════════
  // XI JACK V2 — Shared Deck, System Dealer
  // ══════════════════════════════════════════════════════════════════════════════

  // ── Player: set bet + mark ready in lobby ────────────────────────────────────
  Future<void> xiJackReady({required int betAmount}) async {
    if (_currentRoom == null || myId == null) return;
    final ok = await CoinService.instance.spendCoins(betAmount);
    if (!ok) throw Exception('Không đủ xu');

    await _db.from('room_players').update({
      'bet_amount':     betAmount,
      'bet_choice':     null,
      'xi_jack_result': null,
      'result_delta':   0,
      'is_ready':       true,
    }).eq('room_id', _currentRoom!.id).eq('player_id', myId!);

    await _refreshPlayers();
  }

  // ── Player: cancel ready (return coins) ──────────────────────────────────────
  Future<void> xiJackUnready() async {
    if (_currentRoom == null || myId == null) return;
    final me = myPlayerRecord;
    if (me != null && me.betAmount > 0) {
      await CoinService.instance.earnCoins(me.betAmount); // return coins
    }
    await _db.from('room_players').update({
      'bet_amount': 0,
      'is_ready':   false,
    }).eq('room_id', _currentRoom!.id).eq('player_id', myId!);

    await _refreshPlayers();
  }

  // ── Host: start 5s countdown (auto-called when all players ready) ─────────────
  Future<void> startXiJackCountdown() async {
    if (!isHost || _currentRoom?.status != 'waiting') return;

    final gs = {
      'phase':        'countdown',
      'deck':         <String>[],
      'deck_ptr':     0,
      'player_hands': <String, dynamic>{},
      'player_actions': <String, dynamic>{},
      'countdown_at': DateTime.now().toUtc().toIso8601String(),
    };

    await _db.from('game_rooms').update({
      'status':       'betting',
      'game_state':   gs,
      'round_number': _currentRoom!.roundNumber + 1,
    }).eq('id', _currentRoom!.id);

    await _refreshRoom();

    // Auto-deal sau 5 giây
    Future.delayed(const Duration(seconds: 5), () {
      if (isHost && _currentRoom?.status == 'betting') xiJackDeal();
    });
  }

  // ── Host: deal initial cards (called automatically after countdown) ───────────
  Future<void> xiJackDeal() async {
    if (!isHost || _currentRoom == null) return;
    if (_currentRoom!.status != 'betting') return;

    final playerIds = _players.map((p) => p.playerId).toList();
    final N = playerIds.length;
    final seed = Random.secure().nextInt(1 << 30);
    final deck = buildXjDeck(seed);

    final playerHands = <String, List<String>>{};
    for (int i = 0; i < N; i++) {
      playerHands[playerIds[i]] = [deck[2 + i * 2], deck[3 + i * 2]];
    }

    final playerActions = <String, String?>{for (final uid in playerIds) uid: null};

    // Auto-detect blackjack
    for (final uid in playerIds) {
      if (xjHandValue(playerHands[uid]!) == 21) {
        playerActions[uid] = 'blackjack';
      }
    }

    final gs = XiJackGameState(
      phase:         'playing',
      deck:          deck,
      deckPtr:       2 + N * 2,
      dealerVisible: deck[0],
      dealerHole:    deck[1],
      playerHands:   playerHands,
      playerActions: playerActions,
    ).toJson();

    await _db.from('game_rooms').update({
      'status':     'rolling',
      'game_state': gs,
    }).eq('id', _currentRoom!.id);

    await _refreshRoom();
  }

  // ── Player: request hit card ──────────────────────────────────────────────────
  // expectedHandSize = current hand size + 1 (dùng để tránh xử lý 2 lần)
  Future<void> xiJackRequestHit(int expectedHandSize) async {
    if (_currentRoom == null || myId == null) return;
    await _db.from('room_players').update({
      'bet_choice': 'hit:$expectedHandSize',
    }).eq('room_id', _currentRoom!.id).eq('player_id', myId!);
    await _refreshPlayers();
  }

  // ── Player: stand ─────────────────────────────────────────────────────────────
  Future<void> xiJackRequestStand() async {
    if (_currentRoom == null || myId == null) return;
    await _db.from('room_players').update({
      'bet_choice': 'stand',
    }).eq('room_id', _currentRoom!.id).eq('player_id', myId!);
    await _refreshPlayers();
  }

  // ── Player: clear pending action (sau khi hit được xử lý) ────────────────────
  Future<void> xiJackClearAction() async {
    if (_currentRoom == null || myId == null) return;
    await _db.from('room_players').update({
      'bet_choice': null,
    }).eq('room_id', _currentRoom!.id).eq('player_id', myId!);
  }

  // ── Host: process pending hit/stand actions ────────────────────────────────────
  // Gọi mỗi khi players thay đổi hoặc polling. Idempotent.
  Future<void> processXiJackActions() async {
    if (!isHost || _currentRoom?.status != 'rolling') return;
    final gsJson = _currentRoom?.gameState;
    if (gsJson == null || gsJson['phase'] != 'playing') return;

    var gs = XiJackGameState.fromJson(gsJson);
    final deck = gs.deck;
    var deckPtr = gs.deckPtr;
    final playerHands = Map<String, List<String>>.from(
        gs.playerHands.map((k, v) => MapEntry(k, List<String>.from(v))));
    final playerActions = Map<String, String?>.from(gs.playerActions);
    bool changed = false;

    for (final p in _players) {
      final uid = p.playerId;
      if (!playerActions.containsKey(uid)) continue; // không tham gia ván này
      if (playerActions[uid] != null) continue; // đã xong

      final choice = p.betChoice ?? '';

      if (choice.startsWith('hit:')) {
        final expected = int.tryParse(choice.split(':').last) ?? 0;
        final hand = playerHands[uid] ?? [];
        // Chỉ deal nếu đây là request mới (hand chưa được cập nhật)
        if (hand.length == expected - 1 && deckPtr < deck.length) {
          final newCard = deck[deckPtr++];
          final newHand = [...hand, newCard];
          playerHands[uid] = newHand;
          if (xjHandValue(newHand) > 21) playerActions[uid] = 'bust';
          changed = true;
        }
      } else if (choice == 'stand') {
        playerActions[uid] = 'stand';
        changed = true;
      }
    }

    // Tất cả xong → dealer lật bài
    final allActed = playerActions.isNotEmpty &&
        playerActions.values.every((a) => a != null);

    Map<String, dynamic> newGsJson = {
      ...gsJson,
      'deck_ptr':       deckPtr,
      'player_hands':   playerHands,
      'player_actions': playerActions,
    };

    if (allActed) {
      final dVisible = gsJson['dealer_visible'] as String;
      final dHole    = gsJson['dealer_hole'] as String;
      List<String> dealerHand = [dVisible, dHole];
      while (xjHandValue(dealerHand) < 17 && deckPtr < deck.length) {
        dealerHand.add(deck[deckPtr++]);
      }
      newGsJson = {
        ...newGsJson,
        'phase':       'revealing',
        'deck_ptr':    deckPtr,
        'dealer_final': dealerHand,
      };
      changed = true;
    }

    if (changed) {
      await _db.from('game_rooms').update({
        'game_state': newGsJson,
      }).eq('id', _currentRoom!.id);
      await _refreshRoom();
    }
  }

  // ── Player: tự settle kết quả khi phase = 'revealing' ───────────────────────
  Future<void> settleXiJack() async {
    if (_currentRoom == null || myId == null) return;
    final gs = _currentRoom?.gameState;
    if (gs == null || gs['phase'] != 'revealing') return;
    final me = myPlayerRecord;
    if (me == null || me.betAmount == 0) return;

    final myHand = List<String>.from(
        (gs['player_hands'] as Map<String, dynamic>? ?? {})[myId!] as List? ?? []);
    final myAction = (gs['player_actions'] as Map<String, dynamic>? ?? {})[myId!] as String?;
    final dealerFinal = List<String>.from(gs['dealer_final'] as List? ?? []);

    final myVal = xjHandValue(myHand);
    final dVal  = xjHandValue(dealerFinal);

    final String result;
    if (myAction == 'bust') {
      result = 'lose';
    } else if (myAction == 'blackjack') {
      result = 'blackjack';
    } else if (dVal > 21 || myVal > dVal) {
      result = 'win';
    } else if (myVal == dVal) {
      result = 'push';
    } else {
      result = 'lose';
    }

    await submitXiJackResult(result: result, betAmount: me.betAmount);
  }

  // ── Each player resets own row when round resets ──────────────────────────────
  Future<void> resetMyPlayerRow() async {
    if (_currentRoom == null || myId == null) return;
    await _db.from('room_players').update({
      'bet_amount':     0,
      'bet_choice':     null,
      'xi_jack_result': null,
      'result_delta':   0,
      'is_ready':       false,
    }).eq('room_id', _currentRoom!.id).eq('player_id', myId!);
    await _refreshPlayers();
  }

  // ── Host: close round, go back to lobby ──────────────────────────────────────
  Future<void> resetXiJackRound() async {
    if (!isHost || _currentRoom == null) return;
    // Reset chỉ row của mình (RLS); players khác tự reset qua _onRoomChanged
    await _db.from('room_players').update({
      'bet_amount':     0,
      'bet_choice':     null,
      'xi_jack_result': null,
      'result_delta':   0,
      'is_ready':       false,
    }).eq('room_id', _currentRoom!.id).eq('player_id', myId!);

    await _db.from('game_rooms').update({
      'status':     'waiting',
      'game_state': null,
    }).eq('id', _currentRoom!.id);

    await _refreshRoom();
    await _refreshPlayers();
  }

  // ── Auto-check: khi tất cả ready ở lobby, host tự start countdown ────────────
  void _checkXiJackAutoStart() {
    if (!isHost || _currentRoom?.status != 'waiting') return;
    if (_players.isEmpty) return;
    if (_players.every((p) => p.isReady)) startXiJackCountdown();
  }

  // ══════════════════════════════════════════════════════════════════════════════
  // END XI JACK V2
  // ══════════════════════════════════════════════════════════════════════════════

  // ── Submit Xì Jack result (mỗi player tự submit tay bài) ────────────────────

  Future<void> submitXiJackResult({
    required String result,
    required int    betAmount,
  }) async {
    if (_currentRoom == null || myId == null) return;
    final me = myPlayerRecord;
    if (me == null) return;

    int delta = 0;
    switch (result) {
      case 'blackjack': delta = (betAmount * 1.5).round();
      case 'win':       delta = betAmount;
      case 'push':      delta = 0;
      case 'lose':      delta = -betAmount;
    }

    await _db.from('room_players').update({
      'xi_jack_result': result,
      'result_delta':   delta,
      'total_delta':    me.totalDelta + delta,
      'bet_amount':     0,
      'bet_choice':     null,
      'is_ready':       true,
    }).eq('room_id', _currentRoom!.id).eq('player_id', myId!);

    // Coins: thắng → nhận lại cược + tiền thắng; hòa → nhận lại cược
    if (delta >= 0) {
      await CoinService.instance.earnCoins(betAmount + delta);
    }
    // Thua: đã trừ trong xiJackReady / placeBet

    await _refreshPlayers();
  }

  // ── Leave / close room ───────────────────────────────────────────────────────

  Future<void> leaveRoom() async {
    if (_currentRoom == null || myId == null) return;

    _unsubscribe();

    await _db.from('room_players')
        .delete()
        .eq('room_id', _currentRoom!.id)
        .eq('player_id', myId!);

    if (isHost) {
      await _db.from('game_rooms')
          .update({'status': 'finished'})
          .eq('id', _currentRoom!.id);
    }

    _currentRoom = null;
    _players     = [];
    roomNotifier.value    = null;
    playersNotifier.value = [];
  }

  // ── Private helpers ──────────────────────────────────────────────────────────

  Future<void> _joinAsPlayer() async {
    await _db.from('room_players').upsert({
      'room_id':      _currentRoom!.id,
      'player_id':    myId!,
      'display_name': AuthService.instance.displayName,
    });
  }

  Future<void> _subscribe() async {
    _unsubscribe();

    // Realtime (primary — chỉ hoạt động nếu bật trong Supabase Dashboard)
    try {
      _roomChannel = _db
          .channel('room:${_currentRoom!.id}')
          .onPostgresChanges(
            event:  PostgresChangeEvent.update,
            schema: 'public',
            table:  'game_rooms',
            filter: PostgresChangeFilter(
              type:   PostgresChangeFilterType.eq,
              column: 'id',
              value:  _currentRoom!.id,
            ),
            callback: (payload) {
              _currentRoom = GameRoom.fromJson(payload.newRecord);
              roomNotifier.value = _currentRoom;
            },
          )
          .subscribe();

      _playersChannel = _db
          .channel('players:${_currentRoom!.id}')
          .onPostgresChanges(
            event:  PostgresChangeEvent.all,
            schema: 'public',
            table:  'room_players',
            filter: PostgresChangeFilter(
              type:   PostgresChangeFilterType.eq,
              column: 'room_id',
              value:  _currentRoom!.id,
            ),
            callback: (_) async => _refreshPlayers(),
          )
          .subscribe();
    } catch (e) {
      debugPrint('[RoomService] Realtime subscribe error: $e');
    }

    // Polling fallback (3s) — đảm bảo sync ngay cả khi Realtime chưa bật
    _pollTimer?.cancel();
    _pollTimer = Timer.periodic(const Duration(seconds: 3), (_) async {
      await _refreshRoom();
      await _refreshPlayers();
    });

    // Initial load
    await _refreshRoom();
    await _refreshPlayers();
  }

  Future<void> _refreshRoom() async {
    if (_currentRoom == null) return;
    try {
      final row = await _db
          .from('game_rooms')
          .select()
          .eq('id', _currentRoom!.id)
          .maybeSingle();
      if (row != null) {
        final updated = GameRoom.fromJson(row);
        // Chỉ notify nếu có thay đổi thực sự
        if (_currentRoom!.status != updated.status ||
            _currentRoom!.roundNumber != updated.roundNumber ||
            _currentRoom!.gameState?.toString() != updated.gameState?.toString()) {
          _currentRoom = updated;
          roomNotifier.value = _currentRoom;
        }
      }
    } catch (e) {
      debugPrint('[RoomService] _refreshRoom error: $e');
    }
  }

  Future<void> _refreshPlayers() async {
    if (_currentRoom == null) return;
    try {
      final rows = await _db
          .from('room_players')
          .select()
          .eq('room_id', _currentRoom!.id)
          .order('joined_at');

      final newPlayers = rows.map((r) => RoomPlayer.fromJson(r)).toList();

      // Chỉ notify nếu số lượng hoặc trạng thái thay đổi
      if (_playersChanged(newPlayers)) {
        _players = newPlayers;
        playersNotifier.value = List.unmodifiable(_players);
      }
    } catch (e) {
      debugPrint('[RoomService] _refreshPlayers error: $e');
    }

    // Xi Jack v2: host tự động xử lý trạng thái
    if (_currentRoom?.gameType == 'xi_jack' && isHost) {
      _checkXiJackAutoStart();
      if (_currentRoom?.status == 'rolling') {
        await processXiJackActions();
      }
    }
  }

  /// So sánh nhanh xem players có thay đổi không
  bool _playersChanged(List<RoomPlayer> newPlayers) {
    if (_players.length != newPlayers.length) return true;
    for (int i = 0; i < _players.length; i++) {
      final o = _players[i];
      final n = newPlayers[i];
      if (o.playerId    != n.playerId    ||
          o.betAmount   != n.betAmount   ||
          o.betChoice   != n.betChoice   ||
          o.isReady     != n.isReady     ||
          o.resultDelta != n.resultDelta ||
          o.totalDelta  != n.totalDelta) {
        return true;
      }
    }
    return false;
  }

  void _unsubscribe() {
    _pollTimer?.cancel();
    _pollTimer = null;
    _roomChannel?.unsubscribe();
    _playersChannel?.unsubscribe();
    _roomChannel    = null;
    _playersChannel = null;
  }

  Future<String> _generateCode() async {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    final rng   = Random.secure();
    while (true) {
      final code = String.fromCharCodes(
        List.generate(6, (_) => chars.codeUnitAt(rng.nextInt(chars.length))),
      );
      final exists = await _db
          .from('game_rooms')
          .select('id')
          .eq('room_code', code)
          .maybeSingle();
      if (exists == null) return code;
    }
  }
}
