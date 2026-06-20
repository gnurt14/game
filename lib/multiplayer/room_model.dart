// room_model.dart — Data models cho Shared Gambling Table

class GameRoom {
  final String   id;
  final String   roomCode;
  final String   gameType;    // 'bau_cua' | 'do_den' | 'xi_jack'
  final String   hostId;
  final String   status;      // 'waiting' | 'betting' | 'rolling' | 'finished'
  final bool     isPublic;
  final int      maxPlayers;
  final int      minBet;
  final int      maxBet;
  final int      roundNumber;
  final Map<String, dynamic>? gameState;
  final DateTime expiresAt;
  final DateTime updatedAt;

  const GameRoom({
    required this.id,
    required this.roomCode,
    required this.gameType,
    required this.hostId,
    required this.status,
    required this.isPublic,
    required this.maxPlayers,
    required this.minBet,
    required this.maxBet,
    required this.roundNumber,
    this.gameState,
    required this.expiresAt,
    required this.updatedAt,
  });

  factory GameRoom.fromJson(Map<String, dynamic> j) => GameRoom(
    id:          j['id'] as String,
    roomCode:    j['room_code'] as String,
    gameType:    j['game_type'] as String,
    hostId:      j['host_id'] as String,
    status:      j['status'] as String,
    isPublic:    j['is_public'] as bool,
    maxPlayers:  j['max_players'] as int,
    minBet:      j['min_bet'] as int,
    maxBet:      j['max_bet'] as int,
    roundNumber: j['round_number'] as int,
    gameState:   j['game_state'] as Map<String, dynamic>?,
    expiresAt:   DateTime.parse(j['expires_at'] as String),
    updatedAt:   DateTime.parse(j['updated_at'] as String),
  );

  bool get isHost => false; // caller checks against AuthService.instance.currentUser?.id
}

// ── BẦU CUA game state ────────────────────────────────────────────────────────

enum BauCuaSym { bau, cua, tom, ca, nai, ga }

const _bauCuaLabels = ['Bầu', 'Cua', 'Tôm', 'Cá', 'Nai', 'Gà'];
const _bauCuaEmojis = ['🎃', '🦀', '🦐', '🐟', '🦌', '🐓'];

extension BauCuaSymExt on BauCuaSym {
  String get label => _bauCuaLabels[index];
  String get emoji => _bauCuaEmojis[index];
}

class BauCuaState {
  final List<int> dice; // 3 values, each 0-5 (index into BauCuaSym)
  const BauCuaState(this.dice);

  factory BauCuaState.fromJson(Map<String, dynamic> j) =>
      BauCuaState(List<int>.from(j['dice'] as List));

  Map<String, dynamic> toJson() => {'dice': dice};

  /// Số xúc xắc khớp với lựa chọn cược
  int matchCount(int choiceIndex) =>
      dice.where((d) => d == choiceIndex).length;
}

// ── ĐỎ ĐEN game state ─────────────────────────────────────────────────────────

class CardState {
  final String suit;
  final String rank;
  final bool   isRed;

  const CardState({required this.suit, required this.rank, required this.isRed});

  factory CardState.fromJson(Map<String, dynamic> j) => CardState(
    suit:  j['suit']  as String,
    rank:  j['rank']  as String,
    isRed: j['isRed'] as bool,
  );

  Map<String, dynamic> toJson() => {'suit': suit, 'rank': rank, 'isRed': isRed};

  String get display => rank;
  String get suitEmoji {
    switch (suit) {
      case 'hearts':   return '♥';
      case 'diamonds': return '♦';
      case 'clubs':    return '♣';
      case 'spades':   return '♠';
      default:         return '';
    }
  }
}

class DoDenState {
  final CardState card;
  const DoDenState(this.card);

  factory DoDenState.fromJson(Map<String, dynamic> j) =>
      DoDenState(CardState.fromJson(j['card'] as Map<String, dynamic>));

  Map<String, dynamic> toJson() => {'card': card.toJson()};
}

// ── XÌ JACK game state (v2 — Shared Deck, System Dealer) ─────────────────────
//
// Cấu trúc deck layout:
//   deck[0]          = dealer visible card
//   deck[1]          = dealer hole card (ẩn đến lúc reveal)
//   deck[2 + i*2]    = initial card 1 của player i
//   deck[3 + i*2]    = initial card 2 của player i
//   deck[deck_ptr..] = hit pool (dùng chung, cấp phát tuần tự)
//
// phase: 'countdown' | 'playing' | 'revealing'
//   - countdown: đang đếm ngược trước khi deal (game_state chỉ có countdown_at)
//   - playing:   tất cả player đang hit/stand
//   - revealing: dealer lật bài, tính kết quả

class XiJackGameState {
  final String phase;
  final List<String> deck;   // 52 cards dạng "A♥", "10♣", ...
  final int deckPtr;          // index của lá bài kế tiếp chưa deal
  final String? dealerVisible;
  final String? dealerHole;
  final List<String>? dealerFinal; // null cho đến phase 'revealing'
  // uid → danh sách lá bài (chỉ host viết, client chỉ hiện bài của mình)
  final Map<String, List<String>> playerHands;
  // uid → null (đang chơi) | 'stand' | 'bust' | 'blackjack'
  final Map<String, String?> playerActions;
  // ISO-8601 UTC — chỉ có khi phase == 'countdown'
  final String? countdownAt;

  const XiJackGameState({
    required this.phase,
    required this.deck,
    required this.deckPtr,
    this.dealerVisible,
    this.dealerHole,
    this.dealerFinal,
    required this.playerHands,
    required this.playerActions,
    this.countdownAt,
  });

  factory XiJackGameState.fromJson(Map<String, dynamic> j) => XiJackGameState(
    phase:         j['phase'] as String? ?? 'playing',
    deck:          List<String>.from(j['deck'] as List? ?? []),
    deckPtr:       j['deck_ptr'] as int? ?? 0,
    dealerVisible: j['dealer_visible'] as String?,
    dealerHole:    j['dealer_hole'] as String?,
    dealerFinal:   j['dealer_final'] != null
        ? List<String>.from(j['dealer_final'] as List)
        : null,
    playerHands: (j['player_hands'] as Map<String, dynamic>? ?? {}).map(
        (k, v) => MapEntry(k, List<String>.from(v as List))),
    playerActions: (j['player_actions'] as Map<String, dynamic>? ?? {}).map(
        (k, v) => MapEntry(k, v as String?)),
    countdownAt: j['countdown_at'] as String?,
  );

  Map<String, dynamic> toJson() => {
    'phase':          phase,
    'deck':           deck,
    'deck_ptr':       deckPtr,
    if (dealerVisible != null) 'dealer_visible': dealerVisible,
    if (dealerHole != null)    'dealer_hole':    dealerHole,
    if (dealerFinal != null)   'dealer_final':   dealerFinal,
    'player_hands':   playerHands,
    'player_actions': playerActions,
    if (countdownAt != null) 'countdown_at': countdownAt,
  };

  bool get allActed =>
      playerActions.isNotEmpty &&
      playerActions.values.every((a) => a != null);

  XiJackGameState copyWith({
    String? phase,
    List<String>? deck,
    int? deckPtr,
    String? dealerVisible,
    String? dealerHole,
    List<String>? dealerFinal,
    Map<String, List<String>>? playerHands,
    Map<String, String?>? playerActions,
    String? countdownAt,
  }) => XiJackGameState(
    phase:         phase         ?? this.phase,
    deck:          deck          ?? this.deck,
    deckPtr:       deckPtr       ?? this.deckPtr,
    dealerVisible: dealerVisible ?? this.dealerVisible,
    dealerHole:    dealerHole    ?? this.dealerHole,
    dealerFinal:   dealerFinal   ?? this.dealerFinal,
    playerHands:   playerHands   ?? this.playerHands,
    playerActions: playerActions ?? this.playerActions,
    countdownAt:   countdownAt   ?? this.countdownAt,
  );
}

// ── ROOM PLAYER ───────────────────────────────────────────────────────────────

class RoomPlayer {
  final String  roomId;
  final String  playerId;
  final String  displayName;
  final int     betAmount;
  final String? betChoice;
  final int     resultDelta;
  final int     totalDelta;
  final String? xiJackResult; // 'win'|'lose'|'push'|'blackjack'
  final bool    isReady;
  final DateTime joinedAt;

  const RoomPlayer({
    required this.roomId,
    required this.playerId,
    required this.displayName,
    required this.betAmount,
    this.betChoice,
    required this.resultDelta,
    required this.totalDelta,
    this.xiJackResult,
    required this.isReady,
    required this.joinedAt,
  });

  factory RoomPlayer.fromJson(Map<String, dynamic> j) => RoomPlayer(
    roomId:       j['room_id']       as String,
    playerId:     j['player_id']     as String,
    displayName:  j['display_name']  as String,
    betAmount:    j['bet_amount']    as int,
    betChoice:    j['bet_choice']    as String?,
    resultDelta:  j['result_delta']  as int,
    totalDelta:   j['total_delta']   as int,
    xiJackResult: j['xi_jack_result'] as String?,
    isReady:      j['is_ready']      as bool,
    joinedAt:     DateTime.parse(j['joined_at'] as String),
  );

  RoomPlayer copyWith({
    int?    betAmount,
    String? betChoice,
    int?    resultDelta,
    int?    totalDelta,
    String? xiJackResult,
    bool?   isReady,
  }) => RoomPlayer(
    roomId:       roomId,
    playerId:     playerId,
    displayName:  displayName,
    betAmount:    betAmount    ?? this.betAmount,
    betChoice:    betChoice    ?? this.betChoice,
    resultDelta:  resultDelta  ?? this.resultDelta,
    totalDelta:   totalDelta   ?? this.totalDelta,
    xiJackResult: xiJackResult ?? this.xiJackResult,
    isReady:      isReady      ?? this.isReady,
    joinedAt:     joinedAt,
  );
}
