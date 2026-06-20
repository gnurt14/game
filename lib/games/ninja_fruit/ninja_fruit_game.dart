// ninja_fruit_game.dart — Flame-based Ninja Fruit
//
// Performance improvements vs original Flutter-Canvas approach:
//  • No TextPainter / emoji — fruits drawn with canvas primitives
//  • ui.Picture cache — each fruit pre-rendered once, blitted every frame
//  • Flame GameWidget — no setState / widget-tree rebuild in game loop
//  • ValueNotifier HUD — only score/lives widgets rebuild on change
//  • Line-circle hit test — no missed slices on fast swipes
//  • Gentler speed ramp — max 1.35× after 60 s (fruit speed fixed)

import 'dart:math';
import 'dart:ui' as ui;

import 'package:flame/components.dart';
import 'package:flame/events.dart';
import 'package:flame/game.dart';
import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../../coin/coin_service.dart';

// ─── Enums ───────────────────────────────────────────────────────────────────

enum FruitType { watermelon, apple, orange, mango, pineapple, coconut }

enum EventType { freeze, doubleScore, diamond, lightning }

enum GameMode { time, classic, event }

enum GameState { menu, playing, gameOver }

// ─── Fruit visual definitions ─────────────────────────────────────────────────

class _FruitDef {
  final Color base, highlight, juice;
  const _FruitDef(this.base, this.highlight, this.juice);
}

const _fruitDefs = <FruitType, _FruitDef>{
  FruitType.watermelon: _FruitDef(Color(0xFF43A047), Color(0xFF66BB6A), Color(0xFFFF5252)),
  FruitType.apple:      _FruitDef(Color(0xFFE53935), Color(0xFFEF5350), Color(0xFFD32F2F)),
  FruitType.orange:     _FruitDef(Color(0xFFFB8C00), Color(0xFFFFA726), Color(0xFFFF9800)),
  FruitType.mango:      _FruitDef(Color(0xFFFDD835), Color(0xFFFFEE58), Color(0xFFFFD600)),
  FruitType.pineapple:  _FruitDef(Color(0xFFC0CA33), Color(0xFFD4E157), Color(0xFFCDDC39)),
  FruitType.coconut:    _FruitDef(Color(0xFF6D4C41), Color(0xFF8D6E63), Color(0xFFBCAAA4)),
};

const _eventColors = <EventType, Color>{
  EventType.freeze:       Color(0xFF29B6F6),
  EventType.doubleScore:  Color(0xFFFFD700),
  EventType.diamond:      Color(0xFFAB47BC),
  EventType.lightning:    Color(0xFFFFEB3B),
};

// ─── Sprite cache (pre-rendered ui.Picture) ───────────────────────────────────

class _Sprites {
  static final Map<String, ui.Picture> _cache = {};
  static const double sz = 64.0;
  static const double r  = 24.0;

  static ui.Picture fruit(FruitType t) => _get('f${t.index}',   () => _drawFruit(t));
  static ui.Picture halfL(FruitType t) => _get('fL${t.index}',  () => _drawHalf(t, true));
  static ui.Picture halfR(FruitType t) => _get('fR${t.index}',  () => _drawHalf(t, false));
  static ui.Picture bomb()             => _get('bomb',           _drawBomb);
  static ui.Picture event(EventType e) => _get('e${e.index}',   () => _drawEvent(e));

  static ui.Picture _get(String k, ui.Picture Function() build) =>
      _cache.putIfAbsent(k, build);

  static ui.Picture _drawFruit(FruitType t) {
    final rec = ui.PictureRecorder();
    final c = Canvas(rec, const Rect.fromLTWH(0, 0, sz, sz));
    const cx = sz / 2, cy = sz / 2;
    final d = _fruitDefs[t]!;
    c.drawCircle(const Offset(cx + 2, cy + 3), r * 0.9,
        Paint()..color = const Color(0x30000000));
    c.drawCircle(const Offset(cx, cy), r,
        Paint()..shader = ui.Gradient.radial(
          const Offset(cx - r * 0.3, cy - r * 0.3), r,
          [d.highlight, d.base]));
    c.drawCircle(const Offset(cx - r * 0.2, cy - r * 0.3), r * 0.3,
        Paint()..color = const Color(0x40FFFFFF));
    c.drawLine(const Offset(cx, cy - r), const Offset(cx + 1, cy - r - 7),
        Paint()
          ..color = const Color(0xFF5D4037)
          ..strokeWidth = 2.5
          ..strokeCap = StrokeCap.round
          ..style = PaintingStyle.stroke);
    c.drawOval(
        Rect.fromCenter(center: const Offset(cx + 6, cy - r - 3), width: 10, height: 5),
        Paint()..color = const Color(0xFF66BB6A));
    return rec.endRecording();
  }

  static ui.Picture _drawHalf(FruitType t, bool left) {
    final rec = ui.PictureRecorder();
    final c = Canvas(rec, const Rect.fromLTWH(0, 0, sz, sz));
    const cx = sz / 2, cy = sz / 2;
    final d = _fruitDefs[t]!;
    c.save();
    c.clipRect(left
        ? const Rect.fromLTWH(0, 0, sz / 2, sz)
        : const Rect.fromLTWH(sz / 2, 0, sz / 2, sz));
    c.drawCircle(const Offset(cx, cy), r,
        Paint()..shader = ui.Gradient.radial(
          const Offset(cx, cy), r, [d.juice, d.base]));
    c.restore();
    c.drawLine(const Offset(cx, cy - r), const Offset(cx, cy + r),
        Paint()
          ..color = const Color(0x80FFFFFF)
          ..strokeWidth = 2
          ..style = PaintingStyle.stroke);
    return rec.endRecording();
  }

  static ui.Picture _drawBomb() {
    final rec = ui.PictureRecorder();
    final c = Canvas(rec, const Rect.fromLTWH(0, 0, sz, sz));
    const cx = sz / 2, cy = sz / 2 + 2, br = 20.0;
    c.drawCircle(const Offset(cx, cy), br,
        Paint()..shader = ui.Gradient.radial(
          const Offset(cx - 5, cy - 5), br,
          [const Color(0xFF555555), const Color(0xFF1A1A1A)]));
    c.drawCircle(const Offset(cx - br * 0.3, cy - br * 0.3), br * 0.3,
        Paint()..color = const Color(0x20FFFFFF));
    c.drawPath(
      Path()
        ..moveTo(cx + br * 0.5, cy - br * 0.7)
        ..quadraticBezierTo(cx + br, cy - br * 1.3, cx + br * 0.3, cy - br * 1.4),
      Paint()
        ..color = const Color(0xFF8D6E63)
        ..strokeWidth = 3
        ..strokeCap = StrokeCap.round
        ..style = PaintingStyle.stroke);
    c.drawCircle(const Offset(cx + br * 0.3, cy - br * 1.4), 5,
        Paint()..color = const Color(0xFFFF6D00));
    c.drawCircle(const Offset(cx + br * 0.3, cy - br * 1.4), 2.5,
        Paint()..color = const Color(0xFFFFFF00));
    return rec.endRecording();
  }

  static ui.Picture _drawEvent(EventType e) {
    final rec = ui.PictureRecorder();
    final c = Canvas(rec, const Rect.fromLTWH(0, 0, sz, sz));
    const cx = sz / 2, cy = sz / 2;
    final col = _eventColors[e]!;
    c.drawCircle(const Offset(cx, cy), r + 8,
        Paint()..shader = ui.Gradient.radial(
          const Offset(cx, cy), r + 8,
          [col.withAlpha(70), col.withAlpha(0)]));
    if (e == EventType.diamond) {
      c.drawPath(
        Path()
          ..moveTo(cx, cy - r)
          ..lineTo(cx + r, cy)
          ..lineTo(cx, cy + r)
          ..lineTo(cx - r, cy)
          ..close(),
        Paint()..shader = ui.Gradient.linear(
          const Offset(cx - r, cy - r), const Offset(cx + r, cy + r),
          [const Color(0xFFCE93D8), col, const Color(0xFFCE93D8)],
          [0, 0.5, 1]));
    } else {
      c.drawCircle(const Offset(cx, cy), r,
          Paint()..shader = ui.Gradient.radial(
            const Offset(cx - r * 0.3, cy - r * 0.3), r,
            [col.withAlpha(255), col.withAlpha(180)]));
    }
    c.drawCircle(const Offset(cx - r * 0.2, cy - r * 0.3), r * 0.3,
        Paint()..color = const Color(0x50FFFFFF));
    return rec.endRecording();
  }
}

// ─── Internal data holders ────────────────────────────────────────────────────

class _FlyObj {
  Vector2 pos, vel;
  bool dead = false;
  _FlyObj(this.pos, this.vel);
}

class _TrailPt {
  final Vector2 pos;
  final double t;
  _TrailPt(this.pos, this.t);
}

class _Effects {
  final double freeze, dbl;
  const _Effects({this.freeze = 0, this.dbl = 0});
}

// ─── Components (all private — internal to this library) ─────────────────────

class _FruitComp extends Component {
  final FruitType type;
  final _FlyObj obj;
  bool sliced = false;
  _FruitComp(this.type, this.obj);

  @override
  void render(Canvas canvas) {
    canvas.save();
    canvas.translate(obj.pos.x - _Sprites.sz / 2, obj.pos.y - _Sprites.sz / 2);
    canvas.drawPicture(_Sprites.fruit(type));
    canvas.restore();
  }
}

class _BombComp extends Component {
  final _FlyObj obj;
  double pulse = 0;
  _BombComp(this.obj);

  @override
  void render(Canvas canvas) {
    final p = sin(pulse) * 0.5 + 0.5;
    canvas.drawCircle(obj.pos.toOffset(), 28 + p * 6,
        Paint()
          ..color = Color.fromARGB((p * 50).toInt(), 255, 0, 0)
          ..style = PaintingStyle.stroke
          ..strokeWidth = 2);
    canvas.save();
    canvas.translate(obj.pos.x - _Sprites.sz / 2, obj.pos.y - _Sprites.sz / 2);
    canvas.drawPicture(_Sprites.bomb());
    canvas.restore();
  }
}

class _EventComp extends Component with HasGameReference<NinjaFruitFlameGame> {
  final EventType type;
  final _FlyObj obj;
  bool sliced = false;
  _EventComp(this.type, this.obj);

  @override
  void render(Canvas canvas) {
    final glow = _Sprites.r + 8 + sin(game.elapsedTime * 4) * 4;
    canvas.drawCircle(obj.pos.toOffset(), glow,
        Paint()..color = _eventColors[type]!.withAlpha(40));
    canvas.save();
    canvas.translate(obj.pos.x - _Sprites.sz / 2, obj.pos.y - _Sprites.sz / 2);
    canvas.drawPicture(_Sprites.event(type));
    canvas.restore();
  }
}

class _HalfComp extends Component {
  final FruitType type;
  final bool left;
  Vector2 pos, vel;
  double rot, rotSpeed;
  double opacity = 1;
  _HalfComp({required this.type, required this.left,
      required this.pos, required this.vel,
      required this.rot, required this.rotSpeed});

  @override
  void render(Canvas canvas) {
    if (opacity <= 0) return;
    final a = (opacity * 255).round().clamp(0, 255);
    final bounds = Rect.fromCenter(
        center: pos.toOffset(), width: _Sprites.sz + 8, height: _Sprites.sz + 8);
    canvas.saveLayer(bounds, Paint()..color = Color.fromARGB(a, 255, 255, 255));
    canvas.translate(pos.x, pos.y);
    canvas.rotate(rot);
    canvas.translate(-_Sprites.sz / 2, -_Sprites.sz / 2);
    canvas.drawPicture(left ? _Sprites.halfL(type) : _Sprites.halfR(type));
    canvas.restore();
  }
}

class _ParticleComp extends Component {
  Vector2 pos, vel;
  double life = 1;
  final Color color;
  final double size;
  _ParticleComp({required this.pos, required this.vel,
      required this.color, required this.size});

  @override
  void render(Canvas canvas) {
    canvas.drawCircle(pos.toOffset(), size * life,
        Paint()..color = color.withAlpha((life * 200).round().clamp(0, 255)));
  }
}

class _TrailComp extends Component {
  final List<_TrailPt> _pts = [];
  static const _life = 0.18;

  void addPoint(Vector2 pos, double t) => _pts.add(_TrailPt(pos.clone(), t));
  void clear() => _pts.clear();

  void prune(double now) {
    _pts.removeWhere((p) => now - p.t > _life);
  }

  @override
  void render(Canvas canvas) {
    if (_pts.length < 2) return;
    final last = _pts.last.t;
    for (int i = 1; i < _pts.length; i++) {
      final p0 = _pts[i - 1], p1 = _pts[i];
      final alpha = (1 - (last - p1.t) / _life).clamp(0.0, 1.0);
      canvas.drawLine(p0.pos.toOffset(), p1.pos.toOffset(),
          Paint()
            ..color = Color.fromARGB((alpha * 210).toInt(), 255, 255, 255)
            ..strokeWidth = 2 + alpha * 3.5
            ..strokeCap = StrokeCap.round
            ..style = PaintingStyle.stroke);
      canvas.drawLine(p0.pos.toOffset(), p1.pos.toOffset(),
          Paint()
            ..color = Color.fromARGB((alpha * 55).toInt(), 220, 230, 255)
            ..strokeWidth = 10 + alpha * 4
            ..strokeCap = StrokeCap.round
            ..style = PaintingStyle.stroke);
    }
  }
}

// ─── Main Flame game ──────────────────────────────────────────────────────────

class NinjaFruitFlameGame extends FlameGame with PanDetector {
  // Public state consumed by overlays
  GameState gameState = GameState.menu;
  GameMode  gameMode  = GameMode.classic;
  double    elapsedTime = 0;

  final scoreNotifier   = ValueNotifier<int>(0);
  final livesNotifier   = ValueNotifier<int>(3);
  final timeNotifier    = ValueNotifier<double>(30);
  final comboNotifier   = ValueNotifier<int>(0);
  final effectsNotifier = ValueNotifier<_Effects>(const _Effects());
  final bestNotifiers   = <GameMode, ValueNotifier<int>>{
    GameMode.time:    ValueNotifier(0),
    GameMode.classic: ValueNotifier(0),
    GameMode.event:   ValueNotifier(0),
  };

  // Internal
  int    _maxCombo   = 0;
  int    _activeCombo = 0;
  double _gameSpeed  = 1.0;
  double _nextSpawn  = 0.8;
  double _comboTimer = 0;
  double _bombFlash  = 0;
  double _freezeTimer = 0;
  double _doubleTimer = 0;
  final  _rng = Random();

  late _TrailComp _trail;
  final _fruits = <_FruitComp>[];
  final _bombs  = <_BombComp>[];
  final _events = <_EventComp>[];
  final _halves = <_HalfComp>[];
  final _parts  = <_ParticleComp>[];

  Vector2? _lastSlash;

  final Paint _bgPaint = Paint();

  static const double _gravity    = 1100; // px/s²
  static const double _hitFruit   = 44;
  static const double _hitBomb    = 34;
  static const int    _maxParticles = 250;

  @override
  Color backgroundColor() => const Color(0xFF0D0D1A);

  @override
  Future<void> onLoad() async {
    await super.onLoad();
    _trail = _TrailComp();
    add(_trail);
    final prefs = await SharedPreferences.getInstance();
    bestNotifiers[GameMode.time]!.value    = prefs.getInt('nf_best_time')    ?? 0;
    bestNotifiers[GameMode.classic]!.value = prefs.getInt('nf_best_classic') ?? 0;
    bestNotifiers[GameMode.event]!.value   = prefs.getInt('nf_best_event')   ?? 0;
    overlays.add('menu');
  }

  @override
  void onGameResize(Vector2 size) {
    super.onGameResize(size);
    _bgPaint.shader = ui.Gradient.linear(
      Offset.zero, Offset(0, size.y),
      [const Color(0xFF0D0D1A), const Color(0xFF1A0D2E)]);
  }

  // ── Lifecycle ──────────────────────────────────────────────────────────────

  void startGame(GameMode mode) {
    gameMode  = mode;
    gameState = GameState.playing;
    scoreNotifier.value   = 0;
    livesNotifier.value   = 3;
    timeNotifier.value    = 30;
    comboNotifier.value   = 0;
    effectsNotifier.value = const _Effects();
    _activeCombo = 0;
    _maxCombo    = 0;
    elapsedTime  = 0;
    _nextSpawn   = 0.8;
    _gameSpeed   = 1.0;
    _comboTimer  = 0;
    _bombFlash   = 0;
    _freezeTimer = 0;
    _doubleTimer = 0;
    _clearObjects();
    overlays.remove('menu');
    overlays.remove('gameOver');
    overlays.add('hud');
  }

  void _clearObjects() {
    for (final c in [..._fruits, ..._bombs, ..._events, ..._halves, ..._parts]) {
      remove(c);
    }
    _fruits.clear(); _bombs.clear(); _events.clear();
    _halves.clear(); _parts.clear();
    _trail.clear();
    _lastSlash = null;
  }

  void _endGame() {
    gameState = GameState.gameOver;
    final score = scoreNotifier.value;
    CoinService.instance.reportGameScore('ninja_fruit', score: score);
    SharedPreferences.getInstance().then((p) {
      final key = _prefKey(gameMode);
      final old = p.getInt(key) ?? 0;
      if (score > old) {
        p.setInt(key, score);
        bestNotifiers[gameMode]!.value = score;
      }
    });
    overlays.remove('hud');
    overlays.add('gameOver');
  }

  String _prefKey(GameMode m) {
    if (m == GameMode.time) return 'nf_best_time';
    if (m == GameMode.classic) return 'nf_best_classic';
    return 'nf_best_event';
  }

  // ── Update ─────────────────────────────────────────────────────────────────

  @override
  void update(double dt) {
    super.update(dt);
    if (gameState != GameState.playing) return;

    elapsedTime += dt;
    _gameSpeed = (1.0 + elapsedTime / 15 * 0.05).clamp(1.0, 1.35);

    if (_bombFlash  > 0) _bombFlash  = max(0, _bombFlash  - dt * 3.5);
    if (_comboTimer > 0) {
      _comboTimer = max(0, _comboTimer - dt);
      if (_comboTimer == 0) comboNotifier.value = 0;
    }
    if (_freezeTimer > 0) {
      _freezeTimer = max(0, _freezeTimer - dt);
      effectsNotifier.value = _Effects(freeze: _freezeTimer, dbl: _doubleTimer);
    }
    if (_doubleTimer > 0) {
      _doubleTimer = max(0, _doubleTimer - dt);
      effectsNotifier.value = _Effects(freeze: _freezeTimer, dbl: _doubleTimer);
    }

    if (gameMode == GameMode.time) {
      timeNotifier.value = max(0, timeNotifier.value - dt);
      if (timeNotifier.value <= 0) { _endGame(); return; }
    }

    _nextSpawn -= dt;
    if (_nextSpawn <= 0) {
      final n = (elapsedTime > 20 && _rng.nextDouble() < 0.28) ? 2 : 1;
      for (int i = 0; i < n; i++) {
        _spawn();
      }
      final base = gameMode == GameMode.time ? 0.62 : 0.82;
      _nextSpawn = max(0.30, base / _gameSpeed) + _rng.nextDouble() * 0.22;
    }

    final spd = _freezeTimer > 0 ? 0.5 : 1.0;
    _updateFruits(dt, spd);
    _updateBombs(dt, spd);
    _updateEvents(dt, spd);
    _updateHalves(dt);
    _updateParticles(dt);
    _trail.prune(elapsedTime);
    for (final b in _bombs) {
      b.pulse += dt * 5;
    }
  }

  void _updateFruits(double dt, double spd) {
    for (int i = _fruits.length - 1; i >= 0; i--) {
      final f = _fruits[i];
      if (f.obj.dead || f.sliced) { remove(f); _fruits.removeAt(i); continue; }
      f.obj.vel.y += _gravity * dt;
      f.obj.pos.x += f.obj.vel.x * dt * spd;
      f.obj.pos.y += f.obj.vel.y * dt * spd;
      if (f.obj.pos.y > size.y + 80) {
        f.obj.dead = true;
        if (gameMode != GameMode.time) {
          livesNotifier.value--;
          if (livesNotifier.value <= 0) { _endGame(); return; }
        }
      }
    }
  }

  void _updateBombs(double dt, double spd) {
    for (int i = _bombs.length - 1; i >= 0; i--) {
      final b = _bombs[i];
      if (b.obj.dead) { remove(b); _bombs.removeAt(i); continue; }
      b.obj.vel.y += _gravity * dt;
      b.obj.pos.x += b.obj.vel.x * dt * spd;
      b.obj.pos.y += b.obj.vel.y * dt * spd;
      if (b.obj.pos.y > size.y + 80) b.obj.dead = true;
    }
  }

  void _updateEvents(double dt, double spd) {
    for (int i = _events.length - 1; i >= 0; i--) {
      final e = _events[i];
      if (e.obj.dead || e.sliced) { remove(e); _events.removeAt(i); continue; }
      e.obj.vel.y += _gravity * dt;
      e.obj.pos.x += e.obj.vel.x * dt * spd;
      e.obj.pos.y += e.obj.vel.y * dt * spd;
      if (e.obj.pos.y > size.y + 80) e.obj.dead = true;
    }
  }

  void _updateHalves(double dt) {
    for (int i = _halves.length - 1; i >= 0; i--) {
      final h = _halves[i];
      h.vel.y   += _gravity * 0.8 * dt;
      h.pos     += h.vel * dt;
      h.rot     += h.rotSpeed * dt;
      h.opacity -= dt * 1.6;
      if (h.opacity <= 0 || h.pos.y > size.y + 80) { remove(h); _halves.removeAt(i); }
    }
  }

  void _updateParticles(double dt) {
    for (int i = _parts.length - 1; i >= 0; i--) {
      final p = _parts[i];
      p.vel.y += _gravity * 0.35 * dt;
      p.pos   += p.vel * dt;
      p.life  -= dt * 2.2;
      if (p.life <= 0) { remove(p); _parts.removeAt(i); }
    }
  }

  // ── Spawn ──────────────────────────────────────────────────────────────────

  void _spawn() {
    final side = _rng.nextInt(3);
    double sx, svx;
    if (side == 0) {
      sx  = size.x * _rng.nextDouble() * 0.22;
      svx = 70 + _rng.nextDouble() * 90;
    } else if (side == 1) {
      sx  = size.x * (0.28 + _rng.nextDouble() * 0.44);
      svx = (_rng.nextDouble() - 0.5) * 140;
    } else {
      sx  = size.x * (0.78 + _rng.nextDouble() * 0.22);
      svx = -(70 + _rng.nextDouble() * 90);
    }
    final vy = -(size.y * (0.95 + _rng.nextDouble() * 0.35)) * _gameSpeed;
    final spd = _freezeTimer > 0 ? 0.5 : 1.0;

    if (gameMode == GameMode.event && _rng.nextDouble() < 0.15) {
      final et = EventType.values[_rng.nextInt(EventType.values.length)];
      final c = _EventComp(et, _FlyObj(
          Vector2(sx, size.y + 30), Vector2(svx * _gameSpeed * spd, vy)));
      _events.add(c); add(c); return;
    }

    final bombP = gameMode == GameMode.time ? 0.08
        : elapsedTime > 30 ? 0.24 : 0.16;
    if (_rng.nextDouble() < bombP) {
      final c = _BombComp(_FlyObj(
          Vector2(sx, size.y + 30), Vector2(svx * _gameSpeed * spd, vy)));
      _bombs.add(c); add(c); return;
    }

    final ft = FruitType.values[_rng.nextInt(FruitType.values.length)];
    final c = _FruitComp(ft, _FlyObj(
        Vector2(sx, size.y + 30), Vector2(svx * _gameSpeed * spd, vy)));
    _fruits.add(c); add(c);
  }

  // ── Slice / hit detection ──────────────────────────────────────────────────

  @override
  void onPanStart(DragStartInfo info) {
    _lastSlash = info.eventPosition.global.clone();
    _trail.clear();
    _activeCombo = 0;
  }

  @override
  void onPanUpdate(DragUpdateInfo info) {
    if (gameState != GameState.playing) return;
    final cur = info.eventPosition.global;
    _trail.addPoint(cur, elapsedTime);
    if (_lastSlash != null) _checkSlice(_lastSlash!, cur);
    _lastSlash = cur.clone();
  }

  @override
  void onPanEnd(DragEndInfo info) {
    _lastSlash = null;
    _activeCombo = 0;
  }

  double _seg2pt(Vector2 a, Vector2 b, Vector2 c) {
    final ab = b - a;
    final len2 = ab.length2;
    if (len2 == 0) return c.distanceTo(a);
    final t = ((c - a).dot(ab) / len2).clamp(0.0, 1.0);
    return c.distanceTo(a + ab * t);
  }

  void _checkSlice(Vector2 a, Vector2 b) {
    for (final f in _fruits) {
      if (f.sliced || f.obj.dead) continue;
      if (_seg2pt(a, b, f.obj.pos) < _hitFruit) _sliceFruit(f);
    }
    for (final bm in _bombs) {
      if (bm.obj.dead) continue;
      if (_seg2pt(a, b, bm.obj.pos) < _hitBomb) { _onBombHit(bm); return; }
    }
    for (final ev in _events) {
      if (ev.sliced || ev.obj.dead) continue;
      if (_seg2pt(a, b, ev.obj.pos) < _hitFruit) _sliceEvent(ev);
    }
  }

  void _sliceFruit(_FruitComp f) {
    f.sliced = true;
    _activeCombo++;
    if (_activeCombo > _maxCombo) _maxCombo = _activeCombo;
    comboNotifier.value = _activeCombo;
    if (_activeCombo >= 3) _comboTimer = 1.4;

    final mul = (_activeCombo >= 3 ? _activeCombo : 1) * (_doubleTimer > 0 ? 2 : 1);
    scoreNotifier.value += 10 * mul;
    _spawnHalves(f.type, f.obj.pos, f.obj.vel);
    _spawnParticles(f.obj.pos, _fruitDefs[f.type]!.juice, 10);
  }

  void _onBombHit(_BombComp bm) {
    bm.obj.dead = true;
    _bombFlash = 1.0;
    _spawnParticles(bm.obj.pos, const Color(0xFF888888), 8);
    if (gameMode == GameMode.time) {
      timeNotifier.value = max(0, timeNotifier.value - 3);
    } else {
      for (final f  in _fruits) { f.sliced = true; f.obj.dead = true; }
      for (final e  in _events) { e.obj.dead = true; }
      for (final b  in _bombs)  { b.obj.dead = true; }
      livesNotifier.value--;
      if (livesNotifier.value <= 0) _endGame();
    }
  }

  void _sliceEvent(_EventComp ev) {
    ev.sliced = true;
    scoreNotifier.value += 20;
    _spawnParticles(ev.obj.pos, _eventColors[ev.type]!, 12);
    switch (ev.type) {
      case EventType.freeze:
        _freezeTimer = 5;
      case EventType.doubleScore:
        _doubleTimer = 5;
      case EventType.diamond:
        scoreNotifier.value += 50;
      case EventType.lightning:
        for (final b in _bombs) {
          _spawnParticles(b.obj.pos, const Color(0xFFFF6D00), 6);
          b.obj.dead = true;
        }
    }
    effectsNotifier.value = _Effects(freeze: _freezeTimer, dbl: _doubleTimer);
  }

  void _spawnHalves(FruitType t, Vector2 pos, Vector2 vel) {
    final left = _HalfComp(type: t, left: true,
        pos: Vector2(pos.x - 8, pos.y), vel: Vector2(vel.x - 90, vel.y - 60),
        rot: 0, rotSpeed: -3);
    final right = _HalfComp(type: t, left: false,
        pos: Vector2(pos.x + 8, pos.y), vel: Vector2(vel.x + 90, vel.y - 60),
        rot: 0, rotSpeed: 3);
    _halves.addAll([left, right]);
    addAll([left, right]);
  }

  void _spawnParticles(Vector2 pos, Color col, int n) {
    if (_parts.length >= _maxParticles) return;
    for (int i = 0; i < n; i++) {
      final angle = (i / n) * pi * 2 + _rng.nextDouble() * 0.5;
      final speed = 100 + _rng.nextDouble() * 180;
      final p = _ParticleComp(
        pos:   pos.clone(),
        vel:   Vector2(cos(angle) * speed, sin(angle) * speed - 90),
        color: col,
        size:  2 + _rng.nextDouble() * 3.5,
      );
      _parts.add(p);
      add(p);
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  @override
  void render(Canvas canvas) {
    canvas.drawRect(Rect.fromLTWH(0, 0, size.x, size.y), _bgPaint);
    if (_freezeTimer > 0) {
      canvas.drawRect(Rect.fromLTWH(0, 0, size.x, size.y),
          Paint()..color = const Color(0x1229B6F6));
    }
    if (_doubleTimer > 0) {
      canvas.drawRect(Rect.fromLTWH(0, 0, size.x, size.y),
          Paint()..color = const Color(0x0AFFD700));
    }
    if (_bombFlash > 0) {
      canvas.drawRect(Rect.fromLTWH(0, 0, size.x, size.y),
          Paint()..color = Color.fromARGB((_bombFlash * 80).toInt(), 255, 0, 0));
    }
    super.render(canvas); // renders all components
  }
}

// ─── Screen entry point ───────────────────────────────────────────────────────

class NinjaFruitScreen extends StatefulWidget {
  const NinjaFruitScreen({super.key});
  @override
  State<NinjaFruitScreen> createState() => _NinjaFruitScreenState();
}

class _NinjaFruitScreenState extends State<NinjaFruitScreen> {
  late final NinjaFruitFlameGame _game;

  @override
  void initState() {
    super.initState();
    _game = NinjaFruitFlameGame();
  }

  @override
  Widget build(BuildContext context) {
    return GameWidget<NinjaFruitFlameGame>(
      game: _game,
      overlayBuilderMap: {
        'menu':     (ctx, g) => _MenuOverlay(game: g),
        'hud':      (ctx, g) => _HudOverlay(game: g),
        'gameOver': (ctx, g) => _GameOverOverlay(game: g),
      },
    );
  }
}

// ─── Menu overlay ─────────────────────────────────────────────────────────────

class _MenuOverlay extends StatelessWidget {
  final NinjaFruitFlameGame game;
  const _MenuOverlay({required this.game});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xCC0D0D1A),
      body: SafeArea(
        child: Column(children: [
          Align(
            alignment: Alignment.topLeft,
            child: Padding(
              padding: const EdgeInsets.all(12),
              child: _BackBtn(onTap: () => Navigator.maybePop(context)),
            ),
          ),
          const Spacer(),
          const Text('NINJA FRUIT',
              style: TextStyle(color: Colors.white, fontSize: 38,
                  fontWeight: FontWeight.w900, letterSpacing: 4)),
          const SizedBox(height: 8),
          const Text('Chọn chế độ chơi',
              style: TextStyle(color: Colors.white38, fontSize: 13)),
          const SizedBox(height: 36),
          _ModeBtn(icon: '⏱', label: 'THỜI GIAN', desc: '30 giây — ghi điểm tối đa',
              grad: const [Color(0xFF1565C0), Color(0xFF42A5F5)],
              bestNotifier: game.bestNotifiers[GameMode.time]!,
              onTap: () => game.startGame(GameMode.time)),
          const SizedBox(height: 12),
          _ModeBtn(icon: '❤', label: 'CỔ ĐIỂN', desc: '3 mạng — chém hết quả',
              grad: const [Color(0xFFB71C1C), Color(0xFFEF5350)],
              bestNotifier: game.bestNotifiers[GameMode.classic]!,
              onTap: () => game.startGame(GameMode.classic)),
          const SizedBox(height: 12),
          _ModeBtn(icon: '✨', label: 'SỰ KIỆN', desc: 'Quả đặc biệt — hiệu ứng',
              grad: const [Color(0xFF4A148C), Color(0xFFAB47BC)],
              bestNotifier: game.bestNotifiers[GameMode.event]!,
              onTap: () => game.startGame(GameMode.event)),
          const Spacer(),
          const Text('🍉  🍎  🍊  🥭  🍍  🥥',
              style: TextStyle(fontSize: 26, letterSpacing: 4)),
          const SizedBox(height: 20),
        ]),
      ),
    );
  }
}

class _ModeBtn extends StatelessWidget {
  final String icon, label, desc;
  final List<Color> grad;
  final ValueNotifier<int> bestNotifier;
  final VoidCallback onTap;
  const _ModeBtn({required this.icon, required this.label, required this.desc,
      required this.grad, required this.bestNotifier, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 24),
      child: GestureDetector(
        onTap: onTap,
        child: Container(
          height: 72,
          decoration: BoxDecoration(
              gradient: LinearGradient(colors: grad),
              borderRadius: BorderRadius.circular(14),
              border: Border.all(color: Colors.white12)),
          padding: const EdgeInsets.symmetric(horizontal: 16),
          child: Row(children: [
            Text(icon, style: const TextStyle(fontSize: 26)),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(label, style: const TextStyle(color: Colors.white,
                      fontSize: 17, fontWeight: FontWeight.w900)),
                  Text(desc, style: const TextStyle(color: Colors.white60,
                      fontSize: 12)),
                ],
              ),
            ),
            ValueListenableBuilder<int>(
              valueListenable: bestNotifier,
              builder: (_, v, __) => v > 0
                  ? Text('BEST $v', style: const TextStyle(
                      color: Color(0xFFFFD700), fontSize: 11,
                      fontWeight: FontWeight.bold))
                  : const SizedBox.shrink(),
            ),
          ]),
        ),
      ),
    );
  }
}

// ─── HUD overlay ─────────────────────────────────────────────────────────────

class _HudOverlay extends StatelessWidget {
  final NinjaFruitFlameGame game;
  const _HudOverlay({required this.game});

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            _BackBtn(onTap: () {
              game.gameState = GameState.menu;
              game._clearObjects();
              game.overlays.remove('hud');
              game.overlays.add('menu');
            }),
            const SizedBox(width: 10),
            game.gameMode == GameMode.time
                ? ValueListenableBuilder<double>(
                    valueListenable: game.timeNotifier,
                    builder: (_, t, __) => _Pill(child: Text('⏱ ${t.ceil()}s',
                        style: TextStyle(
                            color: t <= 5 ? Colors.red : Colors.white,
                            fontSize: 18, fontWeight: FontWeight.bold))))
                : ValueListenableBuilder<int>(
                    valueListenable: game.livesNotifier,
                    builder: (_, lives, __) => Row(
                      children: List.generate(3, (i) => Padding(
                        padding: const EdgeInsets.only(right: 4),
                        child: Text('❤',
                            style: TextStyle(fontSize: 22,
                                color: i < lives ? Colors.red : Colors.white24)),
                      )),
                    )),
            const Spacer(),
            Column(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                _Pill(child: Column(children: [
                  ValueListenableBuilder<int>(
                    valueListenable: game.scoreNotifier,
                    builder: (_, s, __) => Text('$s',
                        style: const TextStyle(color: Colors.white, fontSize: 24,
                            fontWeight: FontWeight.w900)),
                  ),
                  ValueListenableBuilder<int>(
                    valueListenable: game.bestNotifiers[game.gameMode]!,
                    builder: (_, b, __) => Text('BEST $b',
                        style: const TextStyle(color: Colors.white38, fontSize: 9,
                            fontWeight: FontWeight.bold, letterSpacing: 1)),
                  ),
                ])),
                ValueListenableBuilder<int>(
                  valueListenable: game.comboNotifier,
                  builder: (_, c, __) => c >= 3
                      ? Padding(
                          padding: const EdgeInsets.only(top: 6),
                          child: Container(
                            padding: const EdgeInsets.symmetric(
                                horizontal: 10, vertical: 4),
                            decoration: BoxDecoration(
                                gradient: const LinearGradient(
                                    colors: [Color(0xFFFF6B35), Color(0xFFFFB300)]),
                                borderRadius: BorderRadius.circular(20)),
                            child: Text('COMBO ×$c!',
                                style: const TextStyle(color: Colors.white,
                                    fontSize: 12, fontWeight: FontWeight.w900,
                                    letterSpacing: 1)),
                          ))
                      : const SizedBox.shrink(),
                ),
                if (game.gameMode == GameMode.event)
                  ValueListenableBuilder<_Effects>(
                    valueListenable: game.effectsNotifier,
                    builder: (_, e, __) => Column(
                      crossAxisAlignment: CrossAxisAlignment.end,
                      children: [
                        if (e.freeze > 0)
                          _EffTag('❄ FREEZE ${e.freeze.ceil()}s',
                              const Color(0xFF29B6F6)),
                        if (e.dbl > 0)
                          _EffTag('×2 DOUBLE ${e.dbl.ceil()}s',
                              const Color(0xFFFFD700)),
                      ],
                    ),
                  ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

class _Pill extends StatelessWidget {
  final Widget child;
  const _Pill({required this.child});
  @override
  Widget build(BuildContext context) => Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
      decoration: BoxDecoration(
          color: Colors.black45, borderRadius: BorderRadius.circular(10)),
      child: child);
}

class _EffTag extends StatelessWidget {
  final String text; final Color color;
  const _EffTag(this.text, this.color);
  @override
  Widget build(BuildContext context) => Padding(
      padding: const EdgeInsets.only(top: 4),
      child: Text(text, style: TextStyle(
          color: color, fontSize: 11, fontWeight: FontWeight.bold)));
}

// ─── Game-over overlay ────────────────────────────────────────────────────────

class _GameOverOverlay extends StatelessWidget {
  final NinjaFruitFlameGame game;
  const _GameOverOverlay({required this.game});

  @override
  Widget build(BuildContext context) {
    final score = game.scoreNotifier.value;
    final best  = game.bestNotifiers[game.gameMode]!.value;
    return Scaffold(
      backgroundColor: const Color(0xCC000000),
      body: SafeArea(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Text(game.gameMode == GameMode.time ? 'HẾT GIỜ!' : 'GAME OVER',
                style: const TextStyle(color: Color(0xFFFF5252), fontSize: 36,
                    fontWeight: FontWeight.w900, letterSpacing: 4)),
            const SizedBox(height: 20),
            Container(
              margin: const EdgeInsets.symmetric(horizontal: 40),
              padding: const EdgeInsets.symmetric(vertical: 20, horizontal: 24),
              decoration: BoxDecoration(
                  color: Colors.white.withAlpha(15),
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(color: Colors.white24)),
              child: Column(children: [
                Text('$score',
                    style: const TextStyle(color: Colors.white, fontSize: 52,
                        fontWeight: FontWeight.w900)),
                const Text('ĐIỂM SỐ',
                    style: TextStyle(color: Colors.white38, fontSize: 11,
                        letterSpacing: 2)),
                const SizedBox(height: 16),
                Row(mainAxisAlignment: MainAxisAlignment.center, children: [
                  _StatBox('BEST', '$best', const Color(0xFFFFD700)),
                  const SizedBox(width: 20),
                  _StatBox('MAX COMBO', '×${game._maxCombo}',
                      const Color(0xFFFF6B35)),
                ]),
              ]),
            ),
            const SizedBox(height: 32),
            _BigBtn(label: 'CHƠI LẠI',
                grad: const [Color(0xFF43A047), Color(0xFFFF6F00)],
                onTap: () => game.startGame(game.gameMode)),
            const SizedBox(height: 12),
            _BigBtn(label: 'QUAY LẠI',
                grad: const [Color(0xFF37474F), Color(0xFF546E7A)],
                onTap: () {
                  game.gameState = GameState.menu;
                  game._clearObjects();
                  game.overlays.remove('gameOver');
                  game.overlays.add('menu');
                }),
          ],
        ),
      ),
    );
  }
}

class _StatBox extends StatelessWidget {
  final String label, value; final Color color;
  const _StatBox(this.label, this.value, this.color);
  @override
  Widget build(BuildContext context) => Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      decoration: BoxDecoration(color: Colors.white.withAlpha(12),
          borderRadius: BorderRadius.circular(10)),
      child: Column(children: [
        Text(value, style: TextStyle(color: color, fontSize: 22,
            fontWeight: FontWeight.w900)),
        Text(label, style: const TextStyle(color: Colors.white38,
            fontSize: 9, letterSpacing: 1.5)),
      ]));
}

class _BigBtn extends StatelessWidget {
  final String label; final List<Color> grad; final VoidCallback onTap;
  const _BigBtn({required this.label, required this.grad, required this.onTap});
  @override
  Widget build(BuildContext context) => Padding(
      padding: const EdgeInsets.symmetric(horizontal: 40),
      child: GestureDetector(
        onTap: onTap,
        child: Container(
          height: 50,
          decoration: BoxDecoration(
              gradient: LinearGradient(colors: grad),
              borderRadius: BorderRadius.circular(25)),
          alignment: Alignment.center,
          child: Text(label, style: const TextStyle(color: Colors.white,
              fontSize: 18, fontWeight: FontWeight.w900, letterSpacing: 2)),
        ),
      ));
}

class _BackBtn extends StatelessWidget {
  final VoidCallback onTap;
  const _BackBtn({required this.onTap});
  @override
  Widget build(BuildContext context) => GestureDetector(
      onTap: onTap,
      child: Container(
        width: 38, height: 38,
        decoration: BoxDecoration(color: Colors.black45,
            borderRadius: BorderRadius.circular(8)),
        child: const Icon(Icons.arrow_back_ios_new_rounded,
            color: Colors.white70, size: 18),
      ));
}
