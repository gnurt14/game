// multiplayer_hub_screen.dart — Entry point for Shared Gambling Table
//
// Chọn game → Create Room / Enter Code / Browse Public

import 'package:flutter/material.dart';
import '../room_service.dart';
import '../room_model.dart';
import 'bau_cua_room_screen.dart';
import 'do_den_room_screen.dart';
import 'xi_jack_room_screen.dart';

class MultiplayerHubScreen extends StatefulWidget {
  const MultiplayerHubScreen({super.key});

  @override
  State<MultiplayerHubScreen> createState() => _MultiplayerHubScreenState();
}

class _MultiplayerHubScreenState extends State<MultiplayerHubScreen> {
  String _selectedGame = 'bau_cua';
  bool   _loading      = false;
  String? _error;

  final _codeCtrl = TextEditingController();

  static const _games = [
    {'key': 'bau_cua', 'label': 'Bầu Cua',  'emoji': '🎰'},
    {'key': 'do_den',  'label': 'Đỏ Đen',   'emoji': '♠️'},
    {'key': 'xi_jack', 'label': 'Xì Jack',  'emoji': '🃏'},
  ];

  @override
  void dispose() {
    _codeCtrl.dispose();
    super.dispose();
  }

  Future<void> _createRoom({required bool isPublic}) async {
    setState(() { _loading = true; _error = null; });
    try {
      final room = await RoomService.instance.createRoom(
        gameType: _selectedGame,
        isPublic: isPublic,
      );
      if (!mounted) return;
      _enterRoom(room);
    } catch (e) {
      setState(() => _error = e.toString());
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _joinByCode() async {
    final code = _codeCtrl.text.trim();
    if (code.length != 6) {
      setState(() => _error = 'Nhập đúng 6 ký tự mã phòng');
      return;
    }
    setState(() { _loading = true; _error = null; });
    try {
      final room = await RoomService.instance.joinByCode(code);
      if (!mounted) return;
      _enterRoom(room);
    } catch (e) {
      setState(() => _error = e.toString());
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  void _enterRoom(GameRoom room) {
    Widget screen;
    switch (room.gameType) {
      case 'bau_cua': screen = const BauCuaRoomScreen(); break;
      case 'do_den':  screen = const DoDenRoomScreen();  break;
      default:        screen = const XiJackRoomScreen();
    }
    Navigator.push(context, MaterialPageRoute(builder: (_) => screen));
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF0A0A1A),
      appBar: AppBar(
        backgroundColor: const Color(0xFF0A0A1A),
        foregroundColor: Colors.white,
        title: const Text('Chơi Cùng Bạn',
            style: TextStyle(fontWeight: FontWeight.bold)),
        elevation: 0,
      ),
      body: GestureDetector(
        onTap: () => FocusScope.of(context).unfocus(),
        behavior: HitTestBehavior.translucent,
        child: SingleChildScrollView(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            _buildGameSelector(),
            const SizedBox(height: 24),
            _buildCreateSection(),
            const SizedBox(height: 24),
            _buildJoinSection(),
            const SizedBox(height: 20),
            _buildBrowseButton(),
            if (_error != null) ...[
              const SizedBox(height: 16),
              _buildError(),
            ],
          ],
        ),
        ),
      ),
    );
  }

  Widget _buildGameSelector() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text('Chọn trò chơi',
            style: TextStyle(color: Colors.white70, fontSize: 13, letterSpacing: 0.5)),
        const SizedBox(height: 10),
        Row(
          children: _games.map((g) {
            final sel = _selectedGame == g['key'];
            return Expanded(
              child: GestureDetector(
                onTap: () => setState(() => _selectedGame = g['key']!),
                child: AnimatedContainer(
                  duration: const Duration(milliseconds: 200),
                  margin: const EdgeInsets.only(right: 8),
                  padding: const EdgeInsets.symmetric(vertical: 14),
                  decoration: BoxDecoration(
                    color: sel ? const Color(0xFF7C6FFF) : const Color(0xFF0F0F22),
                    borderRadius: BorderRadius.circular(14),
                    border: Border.all(
                      color: sel ? const Color(0xFF7C6FFF) : const Color(0xFF2A2A44),
                    ),
                  ),
                  child: Column(
                    children: [
                      Text(g['emoji']!, style: const TextStyle(fontSize: 22)),
                      const SizedBox(height: 4),
                      Text(g['label']!,
                          style: TextStyle(
                            color: sel ? Colors.white : const Color(0xFF7777AA),
                            fontSize: 12,
                            fontWeight: sel ? FontWeight.bold : FontWeight.normal,
                          )),
                    ],
                  ),
                ),
              ),
            );
          }).toList(),
        ),
      ],
    );
  }

  Widget _buildCreateSection() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text('TẠO PHÒNG',
            style: TextStyle(color: Color(0xFF7C6FFF), fontSize: 12,
                fontWeight: FontWeight.bold, letterSpacing: 1.5)),
        const SizedBox(height: 10),
        Row(
          children: [
            Expanded(
              child: _ActionButton(
                label: 'Phòng Riêng',
                subtitle: 'Chia mã cho bạn',
                icon: Icons.lock_rounded,
                color: const Color(0xFF7C6FFF),
                loading: _loading,
                onTap: () => _createRoom(isPublic: false),
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: _ActionButton(
                label: 'Phòng Công Khai',
                subtitle: 'Ai cũng vào được',
                icon: Icons.public_rounded,
                color: const Color(0xFF2E7D32),
                loading: _loading,
                onTap: () => _createRoom(isPublic: true),
              ),
            ),
          ],
        ),
      ],
    );
  }

  Widget _buildJoinSection() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text('NHẬP MÃ PHÒNG',
            style: TextStyle(color: Color(0xFF7C6FFF), fontSize: 12,
                fontWeight: FontWeight.bold, letterSpacing: 1.5)),
        const SizedBox(height: 10),
        Row(
          children: [
            Expanded(
              child: TextField(
                controller: _codeCtrl,
                maxLength: 6,
                textCapitalization: TextCapitalization.characters,
                style: const TextStyle(
                    color: Colors.white, fontSize: 20,
                    fontWeight: FontWeight.bold, letterSpacing: 6),
                textAlign: TextAlign.center,
                decoration: InputDecoration(
                  hintText: 'ABC123',
                  hintStyle: const TextStyle(
                      color: Color(0xFF444466), letterSpacing: 4),
                  filled: true,
                  fillColor: const Color(0xFF0F0F22),
                  counterText: '',
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(14),
                    borderSide: const BorderSide(color: Color(0xFF2A2A44)),
                  ),
                  enabledBorder: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(14),
                    borderSide: const BorderSide(color: Color(0xFF2A2A44)),
                  ),
                  focusedBorder: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(14),
                    borderSide: const BorderSide(
                        color: Color(0xFF7C6FFF), width: 1.5),
                  ),
                ),
              ),
            ),
            const SizedBox(width: 12),
            SizedBox(
              height: 56,
              child: FilledButton(
                onPressed: _loading ? null : _joinByCode,
                style: FilledButton.styleFrom(
                  backgroundColor: const Color(0xFFE53935),
                  shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(14)),
                ),
                child: _loading
                    ? const SizedBox(
                        width: 20, height: 20,
                        child: CircularProgressIndicator(
                            strokeWidth: 2, color: Colors.white))
                    : const Text('Vào', style: TextStyle(fontSize: 16,
                        fontWeight: FontWeight.bold)),
              ),
            ),
          ],
        ),
      ],
    );
  }

  Widget _buildBrowseButton() {
    return SizedBox(
      width: double.infinity,
      child: OutlinedButton.icon(
        onPressed: _loading
            ? null
            : () => Navigator.push(
                context,
                MaterialPageRoute(
                  builder: (_) => PublicRoomBrowserScreen(
                    gameType: _selectedGame,
                    onJoined: (room) {
                      Navigator.pop(context);
                      _enterRoom(room);
                    },
                  ),
                ),
              ),
        icon: const Icon(Icons.search_rounded),
        label: const Text('Tìm Phòng Công Khai'),
        style: OutlinedButton.styleFrom(
          foregroundColor: const Color(0xFF7C6FFF),
          side: const BorderSide(color: Color(0xFF2A2A44)),
          padding: const EdgeInsets.symmetric(vertical: 14),
          shape:
              RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
        ),
      ),
    );
  }

  Widget _buildError() {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
      decoration: BoxDecoration(
        color: const Color(0xFF1A0505),
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: const Color(0xFFE53935).withOpacity(0.4)),
      ),
      child: Row(children: [
        const Icon(Icons.error_outline_rounded, color: Color(0xFFE57373), size: 16),
        const SizedBox(width: 8),
        Expanded(child: Text(_error!,
            style: const TextStyle(color: Color(0xFFE57373), fontSize: 12))),
      ]),
    );
  }
}

// ── Public Room Browser ────────────────────────────────────────────────────────

class PublicRoomBrowserScreen extends StatefulWidget {
  final String gameType;
  final void Function(GameRoom room) onJoined;

  const PublicRoomBrowserScreen({
    super.key,
    required this.gameType,
    required this.onJoined,
  });

  @override
  State<PublicRoomBrowserScreen> createState() =>
      _PublicRoomBrowserScreenState();
}

class _PublicRoomBrowserScreenState extends State<PublicRoomBrowserScreen> {
  List<GameRoom> _rooms   = [];
  bool           _loading = true;
  String?        _joining;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      _rooms = await RoomService.instance.getPublicRooms(gameType: widget.gameType);
    } catch (_) {}
    if (mounted) setState(() => _loading = false);
  }

  Future<void> _join(GameRoom room) async {
    setState(() => _joining = room.id);
    try {
      final joined = await RoomService.instance.joinByCode(room.roomCode);
      if (!mounted) return;
      widget.onJoined(joined);
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(e.toString()),
              backgroundColor: const Color(0xFFE53935)));
      }
    } finally {
      if (mounted) setState(() => _joining = null);
    }
  }

  @override
  Widget build(BuildContext context) {
    const labels = {'bau_cua': 'Bầu Cua', 'do_den': 'Đỏ Đen', 'xi_jack': 'Xì Jack'};

    return Scaffold(
      backgroundColor: const Color(0xFF0A0A1A),
      appBar: AppBar(
        backgroundColor: const Color(0xFF0A0A1A),
        foregroundColor: Colors.white,
        title: Text('Phòng ${labels[widget.gameType] ?? ""} Công Khai'),
        actions: [
          IconButton(icon: const Icon(Icons.refresh_rounded), onPressed: _load),
        ],
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator(color: Color(0xFF7C6FFF)))
          : _rooms.isEmpty
              ? const Center(
                  child: Text('Không có phòng nào đang chờ',
                      style: TextStyle(color: Color(0xFF555577))))
              : ListView.builder(
                  padding: const EdgeInsets.all(16),
                  itemCount: _rooms.length,
                  itemBuilder: (_, i) => _RoomTile(
                    room:    _rooms[i],
                    joining: _joining == _rooms[i].id,
                    onJoin:  () => _join(_rooms[i]),
                  ),
                ),
    );
  }
}

class _RoomTile extends StatelessWidget {
  final GameRoom room;
  final bool     joining;
  final VoidCallback onJoin;

  const _RoomTile({required this.room, required this.joining, required this.onJoin});

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      decoration: BoxDecoration(
        color: const Color(0xFF0F0F22),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: const Color(0xFF2A2A44)),
      ),
      child: Row(children: [
        Expanded(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text('Phòng ${room.roomCode}',
                style: const TextStyle(color: Colors.white,
                    fontWeight: FontWeight.bold, fontSize: 15)),
            const SizedBox(height: 2),
            Text('Cược: ${room.minBet}–${room.maxBet} xu  •  Vòng ${room.roundNumber}',
                style: const TextStyle(color: Color(0xFF666688), fontSize: 12)),
          ]),
        ),
        joining
            ? const SizedBox(width: 20, height: 20,
                child: CircularProgressIndicator(strokeWidth: 2,
                    color: Color(0xFF7C6FFF)))
            : TextButton(
                onPressed: onJoin,
                child: const Text('Vào', style: TextStyle(color: Color(0xFF7C6FFF))),
              ),
      ]),
    );
  }
}

// ── Reusable action button ────────────────────────────────────────────────────

class _ActionButton extends StatelessWidget {
  final String     label;
  final String     subtitle;
  final IconData   icon;
  final Color      color;
  final bool       loading;
  final VoidCallback onTap;

  const _ActionButton({
    required this.label,
    required this.subtitle,
    required this.icon,
    required this.color,
    required this.loading,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: loading ? null : onTap,
      child: Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: color.withOpacity(0.12),
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: color.withOpacity(0.4)),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Icon(icon, color: color, size: 24),
            const SizedBox(height: 8),
            Text(label, style: TextStyle(color: color,
                fontWeight: FontWeight.bold, fontSize: 14)),
            Text(subtitle,
                style: const TextStyle(color: Color(0xFF666688), fontSize: 11)),
          ],
        ),
      ),
    );
  }
}
