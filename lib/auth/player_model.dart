// player_model.dart — Model dữ liệu người chơi (ánh xạ từ Supabase)

class PlayerModel {
  final String id;           // uuid = auth.users.id
  final String displayName;
  final int coinBalance;
  final bool isNewPlayer;
  final int freeLuckyBoxes;
  final int streakDay;
  final DateTime? streakLastClaimDate;
  final int shieldCount;
  final DateTime? boosterExpiryAt;
  final List<String> gamesPlayedToday;
  final DateTime? gamesPlayedDate;
  final DateTime? mission3CollectedDate;
  final DateTime? mission5CollectedDate;
  final int totalGamesPlayed;
  final DateTime createdAt;

  const PlayerModel({
    required this.id,
    required this.displayName,
    required this.coinBalance,
    required this.isNewPlayer,
    required this.freeLuckyBoxes,
    required this.streakDay,
    this.streakLastClaimDate,
    required this.shieldCount,
    this.boosterExpiryAt,
    required this.gamesPlayedToday,
    this.gamesPlayedDate,
    this.mission3CollectedDate,
    this.mission5CollectedDate,
    required this.totalGamesPlayed,
    required this.createdAt,
  });

  factory PlayerModel.fromJson(Map<String, dynamic> json) {
    return PlayerModel(
      id: json['id'] as String,
      displayName: json['display_name'] as String? ?? 'Khách',
      coinBalance: json['coin_balance'] as int? ?? 500,
      isNewPlayer: json['is_new_player'] as bool? ?? true,
      freeLuckyBoxes: json['free_lucky_boxes'] as int? ?? 3,
      streakDay: json['streak_day'] as int? ?? 0,
      streakLastClaimDate: json['streak_last_claim_date'] != null
          ? DateTime.tryParse(json['streak_last_claim_date'] as String)
          : null,
      shieldCount: json['shield_count'] as int? ?? 0,
      boosterExpiryAt: json['booster_expiry_at'] != null
          ? DateTime.tryParse(json['booster_expiry_at'] as String)
          : null,
      gamesPlayedToday: json['games_played_today'] != null
          ? List<String>.from(json['games_played_today'] as List)
          : [],
      gamesPlayedDate: json['games_played_date'] != null
          ? DateTime.tryParse(json['games_played_date'] as String)
          : null,
      mission3CollectedDate: json['mission3_collected_date'] != null
          ? DateTime.tryParse(json['mission3_collected_date'] as String)
          : null,
      mission5CollectedDate: json['mission5_collected_date'] != null
          ? DateTime.tryParse(json['mission5_collected_date'] as String)
          : null,
      totalGamesPlayed: json['total_games_played'] as int? ?? 0,
      createdAt: json['created_at'] != null
          ? DateTime.parse(json['created_at'] as String)
          : DateTime.now(),
    );
  }

  Map<String, dynamic> toJson() => {
        'id': id,
        'display_name': displayName,
        'coin_balance': coinBalance,
        'is_new_player': isNewPlayer,
        'free_lucky_boxes': freeLuckyBoxes,
        'streak_day': streakDay,
        'streak_last_claim_date': streakLastClaimDate?.toIso8601String().split('T').first,
        'shield_count': shieldCount,
        'booster_expiry_at': boosterExpiryAt?.toIso8601String(),
        'games_played_today': gamesPlayedToday,
        'games_played_date': gamesPlayedDate?.toIso8601String().split('T').first,
        'mission3_collected_date': mission3CollectedDate?.toIso8601String().split('T').first,
        'mission5_collected_date': mission5CollectedDate?.toIso8601String().split('T').first,
        'total_games_played': totalGamesPlayed,
      };

  /// Player mới mặc định
  static PlayerModel newPlayer(String userId) => PlayerModel(
        id: userId,
        displayName: 'Khách',
        coinBalance: 500,
        isNewPlayer: true,
        freeLuckyBoxes: 3,
        streakDay: 0,
        shieldCount: 0,
        gamesPlayedToday: [],
        totalGamesPlayed: 0,
        createdAt: DateTime.now(),
      );
}
