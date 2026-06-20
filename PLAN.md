# Super Gate — Master Development Plan v2.0

> **Cập nhật:** 2026-06-20 | **Framework:** Flutter (Dart ^3.4.0) | **Target:** Android / iOS

---

## Mục lục

1. [Danh sách game](#1-danh-sách-game)
2. [Kiến trúc dự án](#2-kiến-trúc-dự-án)
3. [Kế hoạch phát triển từng game](#3-kế-hoạch-phát-triển-từng-game)
4. [Lộ trình phát triển (Roadmap)](#4-lộ-trình-phát-triển-roadmap)
5. [Kỹ thuật dùng chung](#5-kỹ-thuật-dùng-chung)
6. [Tiêu chí hoàn thành (Definition of Done)](#6-tiêu-chí-hoàn-thành-definition-of-done)

---

## 1. Danh sách game

| # | Game | Thể loại | Cơ chế chính | Độ khó impl | ~Lines | Status |
|---|------|----------|-------------|------------|--------|--------|
| 01 | **2048** | Puzzle / Merge | Vuốt 4 hướng, hợp nhất ô số bằng nhau, mục tiêu đạt 2048 | — | 500 | ✅ Done |
| 02 | **Memory Match** | Memory | Lật 16/36 thẻ bài, ghép đôi emoji, đếm số lượt lật | Easy | ~270 | ✅ Done |
| 03 | **Snake** | Arcade | Rắn di chuyển timer-based, ăn mồi, tránh va chạm tường/thân | Easy-Med | ~280 | ✅ Done |
| 04 | **Flappy Bird** | Arcade | Tap để bay, vật lý gravity+jump, né ống dẫn qua màn | Medium | ~335 | ✅ Done |
| 05 | **Tetris** | Puzzle | Xếp 7 tetromino pieces, clear hàng, DAS, wall kick, ghost piece | Med-Hard | ~420 | ✅ Done |
| 06 | **Sudoku** | Logic | Điền số 1–9 vào lưới 9×9, generator isolate, 3 độ khó, notes mode | Hard | ~520 | ✅ Done |
| 07 | **Whack-a-Mole** | Reflex | Chuột chũi xuất hiện ngẫu nhiên 3×3, tap để ghi điểm, countdown 30s | Easy | ~170 | ✅ Done |
| 08 | **Simon Says** | Memory/Sequence | Nhớ & lặp lại chuỗi màu tăng dần, 4 nút màu, flash animation | Very Easy | ~160 | ✅ Done |
| 09 | **Tic-Tac-Toe** | Strategy | Đánh X-O 3×3/4×4/5×5, vs AI, chọn kích thước bàn cờ | Easy+ | ~250 | ✅ Done → 🔧 Enhance |
| 10 | **Minesweeper** | Logic | Dò mìn 9×9/16×9/16×16, tap reveal, long-press flag, first-tap safe | Easy | ~230 | ✅ Done |
| 11 | **Sliding Puzzle** | Spatial | Trượt ô số về đúng vị trí (8-puzzle/15-puzzle), đếm moves | Easy | ~200 | ✅ Done |
| 12 | **Mastermind** | Deduction | Đoán mã, chế độ khó, gợi ý thông minh, timer, multiplayer | Med | ~380 | ✅ Done → 🔧 Enhance |
| 13 | **Brick Breaker** | Arcade | Bóng + paddle + gạch, multi-level system, power-ups, save progress | Medium+ | ~520 | ✅ Done → 🔧 Enhance |
| 14 | **Wordle** | Word | Đoán từ, đa ngôn ngữ EN/VI, custom length 5–7, Daily Challenge | Med+ | ~450 | ✅ Done → 🔧 Enhance |
| 15 | **Ninja Fruit** | Arcade/Reflex | Chém trái cây bay lên, tránh bom, combo, hiệu ứng juice splash | Medium | ~400 | 🆕 Planned |

**Tổng:** 15 game | **14 Done + 1 Planned** | **4 games đang được enhance** 🔧

---

## 2. Kiến trúc dự án

### 2.1 Cấu trúc thư mục

```
lib/
├── main.dart                        # Entry point + Hub screen + 2048 (monolith)
│
├── core/                            # Shared utilities — không phụ thuộc vào game cụ thể
│   ├── theme/
│   │   ├── app_colors.dart          # Bảng màu toàn cục
│   │   └── app_theme.dart           # ThemeData factory
│   ├── widgets/
│   │   ├── score_box.dart           # Widget hiển thị điểm (label + value)
│   │   ├── game_over_dialog.dart    # Dialog game over tái sử dụng được
│   │   └── hub_back_button.dart     # Back button kiểm tra canPop
│   └── utils/
│       └── prefs.dart               # Wrapper SharedPreferences (get/set typed)
│
└── games/
    ├── memory/
    │   └── memory_game.dart         # Model + Controller + Screen trong 1 file
    ├── snake/
    │   └── snake_game.dart
    ├── flappy/
    │   └── flappy_game.dart
    ├── tetris/
    │   └── tetris_game.dart
    ├── sudoku/
    │   └── sudoku_game.dart
    ├── whack_mole/
    │   └── whack_mole_game.dart
    ├── simon/
    │   └── simon_game.dart
    ├── tictactoe/
    │   └── tictactoe_game.dart
    ├── minesweeper/
    │   └── minesweeper_game.dart
    ├── sliding_puzzle/
    │   └── sliding_puzzle_game.dart
    ├── mastermind/
    │   └── mastermind_game.dart
    ├── brick_breaker/
    │   ├── brick_breaker_game.dart  # Core game (refactored)
    │   ├── brick_levels.dart        # Level configs & power-up definitions
    │   └── level_select_screen.dart # Màn hình chọn level
    ├── wordle/
    │   ├── wordle_game.dart
    │   ├── words_en.dart            # ~500 từ tiếng Anh 5–7 ký tự
    │   └── words_vi.dart            # ~300 từ tiếng Việt 5–7 ký tự (không dấu)
    └── ninja_fruit/
        └── ninja_fruit_game.dart    # Model + Controller + Screen + Painter
```

### 2.2 Pattern mỗi game: Model → Controller → Screen

Mỗi game file tuân theo cấu trúc 3 lớp trong **1 file Dart duy nhất**:

```dart
// ════════════════════════════════════════════
// 1. MODEL — dữ liệu thuần túy, không có Flutter
// ════════════════════════════════════════════
class XxxModel {
  // State fields
}

// ════════════════════════════════════════════
// 2. CONTROLLER — business logic, không có Widget
// ════════════════════════════════════════════
class XxxController {
  XxxModel model = XxxModel();
  // Methods: game logic, timer, persistence
}

// ════════════════════════════════════════════
// 3. SCREEN — StatefulWidget, gọi controller
// ════════════════════════════════════════════
class XxxScreen extends StatefulWidget { ... }
class _XxxScreenState extends State<XxxScreen> {
  final _ctrl = XxxController();
  // setState() để rebuild, dispose() để cancel timers
}
```

**State management:** Controller Pattern + `setState()` thuần — không dùng Bloc/Provider.
Lý do: Game loop cần control timing chính xác; Bloc thêm overhead Stream không cần thiết cho single-screen games.

### 2.3 Quy tắc chung cho mọi game

| Quy tắc | Chi tiết |
|---------|---------|
| **Input mobile** | `GestureDetector.onPanStart/onPanEnd` — velocity ≥ 150 px/s HOẶC delta ≥ 30 px |
| **Input desktop** | `KeyboardListener + FocusNode(autofocus: true)` |
| **Back button** | Kiểm tra `Navigator.canPop(context)` → hiện `IconButton` |
| **Best score** | `SharedPreferences` — key convention: `best_{metric}_{gamename}` |
| **dispose()** | Luôn cancel `Timer`, dispose `AnimationController`, `FocusNode`, `Ticker` |
| **Analyze** | `flutter analyze lib/` sau mỗi game — zero issues trước khi tích hợp |
| **Game loop** | `Timer.periodic` cho timer-based; `Ticker` cho physics-based |

### 2.4 Tích hợp vào Hub (lib/main.dart)

Sau mỗi game hoàn thành, sửa `lib/main.dart` tại **2 chỗ**:

```dart
// 1. Thêm import đầu file
import 'games/whack_mole/whack_mole_game.dart';

// 2. Thêm GameEntry vào _games list
GameEntry(
  name: 'Whack-a-Mole',
  description: 'Đập chuột chũi\nnhanh tay nhanh mắt',
  icon: Icons.pest_control_rodent_rounded,
  gradient: const [Color(0xFFFF6B35), Color(0xFFFF8C00)],
  builder: (_) => const WhackMoleScreen(),
),
```

---

## 3. Kế hoạch phát triển từng game

---

### Game 01 — 2048 ✅ DONE

**File:** `lib/main.dart` (section 2048)
**Cơ chế:** Vuốt 4 hướng, merge ô bằng nhau, đạt ô 2048.
**SharedPreferences:** `best_score_2048`

---

### Game 02 — Memory Match

**File:** `lib/games/memory/memory_game.dart`

#### Model — `CardModel`
```dart
class CardModel {
  final int id;        // 0..7 hoặc 0..17 (index cặp)
  final String emoji;
  bool isFaceUp;
  bool isMatched;
}
// Pool 4×4: ['🐶','🐱','🦊','🐸','🦋','🌸','⭐','🍕']
// Pool 6×6: thêm ['🎸','🚀','🌈','🦄','🍦','🎯','🔥','💎','🌊']
```

#### Controller — `MemoryController`
```dart
class MemoryController {
  List<CardModel> cards;        // 16 hoặc 36 cards đã shuffle
  int? firstFlippedIndex;       // null = chưa lật lá nào
  int moves;                    // số lần lật cặp
  int matches;                  // số cặp đúng
  bool isChecking;              // đang delay 800ms → block tap
  int bestMoves;

  void flipCard(int index);
  Future<void> _checkMatch();   // delay 800ms → flip back nếu sai
  bool get isComplete;          // matches == totalPairs
  void newGame(int gridSize);   // 4 hoặc 6
}
```

#### Screen — `MemoryScreen`
- Header: tên game + back + New Game
- Selector: 2 nút 4×4 / 6×6
- Score: `MOVES: X` + `BEST: Y`
- Board: `GridView.builder` + `AspectRatio(1)` mỗi card

#### Animation flip 3D (bắt buộc)
```dart
// AnimationController riêng mỗi card
// Transform(alignment: Alignment.center,
//   transform: Matrix4.identity()
//     ..setEntry(3, 2, 0.001)
//     ..rotateY(angle))
// 0→π/2: ẩn mặt sau | π/2→π: hiện mặt trước
```

#### SharedPreferences
- `best_moves_memory_4x4`
- `best_moves_memory_6x6`

#### Acceptance Criteria
- [ ] Flip animation 3D mượt
- [ ] Block tap khi đang checking (800ms)
- [ ] 4×4 và 6×6 đều hoạt động
- [ ] Best moves lưu/đọc đúng

---

### Game 03 — Snake

**File:** `lib/games/snake/snake_game.dart`

#### Model — `SnakeModel`
```dart
class SnakeModel {
  static const int gridSize = 20;
  List<Point<int>> body;         // body[0] = head
  Point<int> food;
  SnakeDirection direction;
  SnakeDirection nextDirection;  // buffer 1 input, tránh skip
  bool gameOver;
  int score;
  int bestScore;
}
enum SnakeDirection { up, down, left, right }
```

#### Controller — `SnakeController`
```dart
class SnakeController {
  Timer? _timer;
  static const int _baseSpeed = 250; // ms/tick ban đầu

  void startGame();
  void changeDirection(SnakeDirection d); // chặn 180°
  void _tick();                           // move + check
  void _spawnFood();                      // random, tránh body
  int _currentSpeed();                    // baseSpeed - score*8, min 80ms
  void dispose();
}
```

#### Screen — `SnakeScreen`
- CustomPaint full board
- Swipe + Arrow/WASD keyboard
- Pause button, Game Over overlay (Stack + dim)

#### CustomPainter colors
```dart
// Background: Color(0xFF1A2F1A) | Grid lines: Color(0xFF1E3A1E)
// Head: Color(0xFF4CAF50) | Body gradient darker by index
// Food: Color(0xFFFF5722) circle
```

#### SharedPreferences: `best_score_snake`

#### Acceptance Criteria
- [ ] Timer-based movement + tốc độ tăng theo score
- [ ] Không cho đổi hướng 180°
- [ ] Food không spawn trên thân
- [ ] Swipe + keyboard hoạt động

---

### Game 04 — Flappy Bird

**File:** `lib/games/flappy/flappy_game.dart`

#### Model (tọa độ normalized 0.0→1.0)
```dart
class FlappyModel {
  double birdY = 0.5, birdVY = 0.0, birdX = 0.2;
  List<FlappyPipe> pipes = [];
  int score = 0, bestScore = 0;
  FlappyState state = FlappyState.idle;
}
class FlappyPipe {
  double x;          // di chuyển sang trái
  double gapCenter;  // 0.2..0.8 normalized
  static const double gapSize = 0.28;
  bool scored = false;
}
enum FlappyState { idle, playing, dead }
```

#### Controller — `FlappyController`
```dart
// Physics (đã tune cho mobile)
static const double gravity   = 0.0015; // per ms
static const double jumpVY    = -0.055;
static const double pipeSpeed = 0.0003; // per ms

void onTap();             // idle→playing, playing→jump, dead→reset
void update(double dtMs); // Ticker callback
bool _checkCollision();   // AABB bird vs pipes + floor/ceiling
void _spawnPipe();
```

#### Screen — `FlappyScreen`
- `TickerProviderStateMixin` + `createTicker(_onTick)`
- `CustomPaint` full screen, `GestureDetector.onTap`
- `KeyboardListener` — Spacebar

#### CustomPainter
- Sky gradient `Color(0xFF87CEEB)` → `Color(0xFF98D8EF)`
- Ground `Color(0xFF8BC34A)` — 8% bottom
- Pipes `Color(0xFF4CAF50)`, Bird emoji 🐤 bằng `TextPainter`

#### SharedPreferences: `best_score_flappy`

#### Acceptance Criteria
- [ ] Physics gravity + jump tự nhiên
- [ ] 3 states idle/playing/dead đúng
- [ ] Pipe random + đều đặn

---

### Game 05 — Tetris

**File:** `lib/games/tetris/tetris_game.dart`

#### Tetromino (7 pieces × 4 rotations — hardcode 4×4 matrix)
```dart
enum TetroType { I, O, T, S, Z, J, L }
// Màu: I=cyan, O=yellow, T=purple, S=green, Z=red, J=blue, L=orange
```

#### Model
```dart
class TetrisModel {
  static const int rows = 20, cols = 10;
  List<List<int>> board;       // 0=empty, 1-7=TetroType
  TetroType? currentType;
  int currentRot = 0, currentX = 3, currentY = 0;
  TetroType? nextType;
  int score = 0, level = 1, lines = 0, bestScore = 0;
  bool gameOver = false, isPaused = false;
}
```

#### Controller — `TetrisController`
```dart
bool canMove(int newX, int newY, int rot);
void moveLeft(); void moveRight();
void rotate();      // SRS wall kick: offsets [0,(-1,0),(1,0),(-2,0),(2,0)]
void softDrop();    // +1 điểm/row
void hardDrop();    // thả xuống + +2×rows điểm
void _lockPiece();
int _clearLines();
void _updateScore(int lines); // 1=100, 2=300, 3=500, 4=800 × level
List<int> _getGhostPosition();
void onKeyDown(LogicalKeyboardKey key); // DAS: delay 170ms, repeat 50ms
void onKeyUp(LogicalKeyboardKey key);
```

#### Screen — `TetrisScreen`
- Layout `Row`: Board (trái, `AspectRatio(0.5)`) + Side panel (phải: Next + Score/Level/Lines)
- `CustomPainter` cho board + ghost piece

#### Scoring
```
1 line: 100×L | 2 lines: 300×L | 3 lines: 500×L | 4 lines: 800×L
Soft drop: +1/row | Hard drop: +2/row
```

#### SharedPreferences: `best_score_tetris`, `best_lines_tetris`

#### Acceptance Criteria
- [ ] 7 pieces + 4 rotations đúng shape
- [ ] Wall kick + Ghost piece
- [ ] DAS giữ phím
- [ ] Pause/Resume

---

### Game 06 — Sudoku

**File:** `lib/games/sudoku/sudoku_game.dart`

#### Model
```dart
class SudokuModel {
  List<List<int>> solution;    // 9×9, 1-9
  List<List<int>> puzzle;      // 0=ô trống ban đầu
  List<List<int>> userGrid;    // user điền
  List<List<Set<int>>> notes;  // pencil marks
  List<SudokuAction> history;  // undo stack max 50
  int selectedRow = -1, selectedCol = -1;
  bool notesMode = false;
  SudokuDifficulty difficulty;
  int elapsedSeconds = 0, bestTime = 0;
}
enum SudokuDifficulty { easy, medium, hard }
// easy: 36-40 filled | medium: 28-35 | hard: 22-27
```

#### Generator (Isolate)
```dart
// Top-level function cho compute():
Map<String, dynamic> generatePuzzle(String difficulty) {
  // 1. Fill 3 diagonal 3×3 boxes với random permutation
  // 2. Solve phần còn lại bằng backtracking
  // 3. Remove cells, verify unique solution từng cell
}
bool _solve(List<List<int>> grid, {int maxSolutions = 1}); // abort sớm
```

#### Controller — `SudokuController`
```dart
Future<void> newGame(SudokuDifficulty d); // compute() + setState
void selectCell(int r, int c);
void inputNumber(int n);   // 0=xóa, push history
void toggleNote(int n);    // push history
void undo();
bool isConflict(int r, int c);       // row + col + box
bool isGiven(int r, int c);          // puzzle[r][c] != 0
bool isSolved();
```

#### Screen — `SudokuScreen`
- Loading state: `CircularProgressIndicator`
- Header: difficulty chips + timer
- 9×9 grid: box borders 3×3 đậm hơn, selected=xanh, conflict=đỏ, notes mini-grid
- Number pad: `[1..9]` + `[X]` + `[✏]` + `[↩]`

#### SharedPreferences
- `best_time_sudoku_easy/medium/hard`

#### Acceptance Criteria
- [ ] Generation không freeze UI (Isolate)
- [ ] Unique solution
- [ ] Notes mini-grid đúng
- [ ] Undo hoạt động cho cả số lẫn notes

---

### Game 07 — Whack-a-Mole

**File:** `lib/games/whack_mole/whack_mole_game.dart`

#### Model
```dart
class WhackMoleModel {
  static const int holes = 9;
  List<bool> moleVisible;      // true = chuột đang lộ
  int score = 0, bestScore = 0;
  int timeLeft = 30;           // giây đếm ngược
  bool isPlaying = false;
}
```

#### Controller — `WhackMoleController`
```dart
Timer? _gameTimer;    // 1s interval đếm ngược timeLeft
Timer? _moleTimer;    // spawn chuột
List<Timer?> _hideTimers; // ẩn từng con chuột sau duration

void startGame();
void stopGame();
void whack(int index);         // score++ nếu mole visible, ẩn mole
void _spawnMole();             // random hole chưa có chuột
int _spawnInterval();          // 1200 - score*20, min 400ms
int _moleDuration();           // 1000 - score*15, min 350ms
void dispose();
```

#### Screen — `WhackMoleScreen`
- Header: `SCORE` + `TIME: Xs` + `BEST`
- 3×3 `GridView` — mỗi ô là `AnimatedSwitcher` chuột lộ/ẩn
- Tap ô → hiệu ứng hit (scale bounce)
- "Bắt đầu" overlay khi chưa chơi
- Game over: khi `timeLeft == 0` → hiện score + restart

#### Widget Components
- `_HoleWidget(bool moleVisible, VoidCallback onTap)` — ô 1 trong 9
- Chuột: emoji 🐹 hoặc text "🐭" bằng `Text` widget lớn
- Hiệu ứng xuất hiện: `ScaleTransition` 0→1 (200ms, elasticOut)

#### SharedPreferences: `best_score_whack_mole`

#### Acceptance Criteria
- [ ] Timer countdown 30s chính xác
- [ ] Spawn/hide timer cancel đúng khi dispose
- [ ] Độ khó tăng dần (spawn nhanh hơn, hiện ngắn hơn)
- [ ] Game over overlay + restart

---

### Game 08 — Simon Says

**File:** `lib/games/simon/simon_game.dart`

#### Model
```dart
class SimonModel {
  List<int> sequence = [];    // 0=Red, 1=Blue, 2=Green, 3=Yellow
  int playerIndex = 0;        // vị trí input hiện tại
  SimonState state = SimonState.idle;
  int round = 0, bestRound = 0;
}

enum SimonState { idle, showing, playerInput, gameOver }

const simonColors = [
  Color(0xFFE53935), // Red
  Color(0xFF1E88E5), // Blue
  Color(0xFF43A047), // Green
  Color(0xFFFDD835), // Yellow
];
```

#### Controller — `SimonController`
```dart
Future<void> startRound();    // thêm 1 vào sequence, chạy showSequence
Future<void> showSequence();  // flash từng màu với delay
void handleTap(int colorIndex);
//   if colorIndex == sequence[playerIndex] → tiếp tục
//   else → gameOver, flash all red 3x
Duration _flashDuration();    // max(800ms - round*40ms, 300ms)
Duration _gapDuration();      // max(600ms - round*30ms, 200ms)
```

#### Screen — `SimonScreen`
- 4 nút màu lớn bố cục 2×2 (`Expanded` trong `Column`/`Row`)
- Mỗi nút: `AnimatedContainer` — sáng khi active, tối khi inactive
- Header: `ROUND: X` + `BEST: Y`
- Overlay "TAP TO START" khi `state == idle`
- Block tap khi `state == showing`

#### SharedPreferences: `best_round_simon`

#### Acceptance Criteria
- [ ] Sequence animation đúng thứ tự + tốc độ tăng
- [ ] Block input khi đang show sequence
- [ ] Game over flash all red
- [ ] Best round lưu đúng

---

### Game 09 — Tic-Tac-Toe

**File:** `lib/games/tictactoe/tictactoe_game.dart`

#### Model
```dart
class TicTacToeModel {
  List<String> board = List.filled(9, ''); // '', 'X', 'O'
  String currentPlayer = 'X';
  String? winner;        // null=ongoing, ''=draw, 'X'/'O'=winner
  List<int>? winLine;    // 3 indices của winning cells
  int playerWins = 0, aiWins = 0, draws = 0;
  bool playerIsX = true; // người chơi chọn X hay O
}
```

#### Controller — `TicTacToeController`
```dart
void makeMove(int index);         // player tap → AI move
void _aiMove();                   // gọi minimax, delay 400ms (UX)
int minimax(List<String> b, bool isMax, int depth, int alpha, int beta);
String? checkWinner(List<String> b); // check 8 winning lines
void resetGame();
void resetStats();
void chooseSymbol(bool isX);      // chọn X hoặc O
```

**Minimax với Alpha-Beta pruning** — lưới 3×3 không cần depth limit.

#### Screen — `TicTacToeScreen`
- Header: back + title + stats (W/D/L)
- 3×3 grid: `GridView` với `InkWell`, X/O marks to
- Winning line: `CustomPaint` gạch qua 3 ô thắng (slide animation)
- Status bar: "Lượt của bạn" / "AI đang suy nghĩ..." / "Bạn thắng!"
- Choose symbol screen (X/O) trước ván đầu
- Dialog sau mỗi ván + auto-restart 2s

#### SharedPreferences: `ttt_player_wins`, `ttt_ai_wins`, `ttt_draws`

#### Acceptance Criteria
- [ ] AI không thể thua (Minimax optimal)
- [ ] Draw detection đúng
- [ ] Winning line animation
- [ ] Stats tích lũy qua các ván

---

### Game 10 — Minesweeper

**File:** `lib/games/minesweeper/minesweeper_game.dart`

#### Model
```dart
class CellState {
  bool isMine = false;
  bool isRevealed = false;
  bool isFlagged = false;
  int adjacentMines = 0;
}

class MinesweeperModel {
  List<List<CellState>> grid = [];
  MinesweeperDifficulty difficulty = MinesweeperDifficulty.easy;
  MinesweeperGameState state = MinesweeperGameState.idle;
  bool firstTap = true; // first tap guaranteed safe
  int flagsUsed = 0, elapsedSeconds = 0;
  int? bestTime;
}

enum MinesweeperDifficulty { easy, medium, hard }
// easy:   9×9,   10 mines
// medium: 16×9,  30 mines
// hard:   16×16, 55 mines
```

#### Controller — `MinesweeperController`
```dart
void newGame(MinesweeperDifficulty d);
void tap(int r, int c);          // lần tap đầu → placeMines → reveal
void longPress(int r, int c);    // toggle flag
void _placeMines(int safeR, int safeC); // đảm bảo safeR,safeC không phải mine
void _floodFill(int r, int c);   // BFS reveal ô empty liền kề
void _calcAdjacent();
bool _checkWin();                // tất cả non-mine đã revealed
Timer? _clockTimer;
```

#### Screen — `MinesweeperScreen`
- Header: difficulty chips + 🚩 flag count + ⏱ timer
- Grid: `GestureDetector` + `LongPressFeedback` per cell
- Cell states: hidden (grey) / revealed (white+số) / flagged 🚩 / mine 💣
- Số adjacent có màu riêng: 1=xanh, 2=xanh lá, 3=đỏ, 4=tím, 5=nâu, 6=cyan, 7=đen, 8=xám
- Game over: reveal tất cả mine, mine triggered đỏ

#### SharedPreferences: `best_time_minesweeper_easy/medium/hard`

#### Acceptance Criteria
- [ ] First tap luôn an toàn
- [ ] Flood fill reveal ô trống đúng
- [ ] Flag count chính xác
- [ ] Timer dừng khi thắng/thua

---

### Game 11 — Sliding Puzzle

**File:** `lib/games/sliding_puzzle/sliding_puzzle_game.dart`

#### Model
```dart
class SlidingPuzzleModel {
  List<int> tiles = [];    // [1..n-1, 0], 0 = ô trống
  int gridSize = 4;        // 3 hoặc 4
  int blankIndex = 0;
  int moves = 0, bestMoves = 0;
  bool isSolved = false;
}
```

#### Controller — `SlidingPuzzleController`
```dart
void newGame(int size);              // shuffle + solvability check
bool canSlide(int index);            // adjacent to blank (up/down/left/right)
void slide(int index);               // swap tile[index] với blank
bool _isSolvable(List<int> tiles, int size); // inversion count + blank row
void _shuffle();                     // Fisher-Yates → check solvable → retry
bool _checkSolved();                 // tiles == [1,2,...,n-1,0]
```

**Solvability check:**
- Size lẻ (3): inversions chẵn → solvable
- Size chẵn (4): (inversions + blank row from bottom) chẵn → solvable

#### Screen — `SlidingPuzzleScreen`
- Header: size selector 3×3/4×4 + moves + best + shuffle button
- Grid: `GridView` với `AnimatedPositioned` hoặc `AnimatedSwitcher`
- Tiles: số + màu gradient theo giá trị
- Ô trống: transparent
- Win: confetti animation + dialog

#### SharedPreferences: `best_moves_sliding_3x3`, `best_moves_sliding_4x4`

#### Acceptance Criteria
- [ ] Solvability guarantee (không tạo puzzle không giải được)
- [ ] Tile slide animation mượt
- [ ] 3×3 và 4×4 đều hoạt động
- [ ] Best moves riêng cho mỗi size

---

### Game 12 — Mastermind

**File:** `lib/games/mastermind/mastermind_game.dart`

#### Model
```dart
class MastermindGuess {
  final List<int> code;       // 4 chữ số 1-6
  final int blacks;           // đúng vị trí
  final int whites;           // đúng số, sai vị trí
}

class MastermindModel {
  List<int> secret = [];      // 4 chữ số 1-6 (có thể trùng)
  List<MastermindGuess> history = [];
  List<int> currentInput = []; // max 4 digits
  MastermindState state = MastermindState.playing;
  int maxAttempts = 10;
  int wins = 0, streak = 0, bestStreak = 0;
}

enum MastermindState { playing, won, lost }
```

#### Controller — `MastermindController`
```dart
void newGame();
void addDigit(int d);       // nếu currentInput.length < 4
void removeDigit();         // backspace
void submit();              // evaluate + push to history
(int blacks, int whites) _evaluate(List<int> guess, List<int> secret);
// blacks: đếm vị trí khớp
// whites: đếm số khớp sau khi trừ blacks
```

#### Screen — `MastermindScreen`
- Header: attempts left + streak
- History list: mỗi row = 4 ô màu (1=đỏ,2=cam,3=vàng,4=xanh,5=xanh lục,6=tím) + ⚫ blacks + ⚪ whites
- Current row: 4 input slots (trống hoặc đã điền)
- Numpad: buttons `[1][2][3][4][5][6]` + `[⌫]` + `[✓]`
- Game over: reveal secret + kết quả win/lose

#### SharedPreferences: `mastermind_wins`, `mastermind_streak`, `mastermind_best_streak`

#### Acceptance Criteria
- [ ] Evaluate blacks/whites đúng (including duplicates)
- [ ] History hiển thị đủ thông tin
- [ ] Streak reset khi thua
- [ ] Secret reveal animation khi game over

---

### Game 13 — Brick Breaker

**File:** `lib/games/brick_breaker/brick_breaker_game.dart`

#### Model (tọa độ normalized 0.0→1.0)
```dart
class BrickModel {
  double x, y, w, h;      // normalized bounds
  int hitsLeft;            // 1=vàng, 2=cam, 3=đỏ
  bool destroyed = false;
}

class BrickBreakerModel {
  double paddleX = 0.5;   // center
  static const double paddleW = 0.22, paddleH = 0.025;
  double ballX = 0.5, ballY = 0.7;
  double ballVX = 0.0, ballVY = -0.0004; // per ms
  static const double ballR = 0.018;
  List<BrickModel> bricks = [];
  int score = 0, lives = 3, level = 1, bestScore = 0;
  BrickBreakerState state = BrickBreakerState.idle;
}

enum BrickBreakerState { idle, playing, dead, levelClear, gameOver }
```

#### Controller — `BrickBreakerController`
```dart
void onDrag(double globalDx, double screenW); // paddle follow finger
void onTap();             // idle→launch, dead→restart, levelClear→nextLevel
void update(double dtMs); // physics: move ball, check collision
void _checkWallCollision();
void _checkPaddleCollision(); // angle based on hit position offset from center
void _checkBrickCollision();  // AABB per brick, side detection
void _loadLevel(int level);   // generate brick grid (rows = min(level+2, 8))
void dispose();
```

#### Screen — `BrickBreakerScreen`
- `TickerProviderStateMixin` + `createTicker(_onTick)`
- `GestureDetector.onPanUpdate` → `_ctrl.onDrag(details.delta.dx, size.width)`
- `CustomPaint` fill màn hình

#### CustomPainter — `BrickBreakerPainter`
```dart
// Background: Color(0xFF0A0A1A)
// Paddle: RRect, gradient purple→blue
// Ball: white circle + glow
// Bricks: màu theo hits (1=gold, 2=orange, 3=red), inner border
// UI: lives (♥♥♥ top-left), score (top-center), level (top-right)
```

#### Level Design
```
Level  1: 3 rows × 8 cols, all 1-hit
Level  2: 4 rows × 8 cols, row 1 = 2-hit
Level  3: 5 rows × 8 cols, rows 1-2 = 2-hit
Level  4+: thêm 3-hit bricks, tốc độ ball tăng 5% mỗi level
Level 10: max speed, mixed brick types
```

#### SharedPreferences: `best_score_brick_breaker`, `best_level_brick_breaker`

#### Acceptance Criteria
- [ ] Ball reflection vật lý đúng (tường, paddle, brick)
- [ ] Paddle hit angle: đánh giữa → thẳng, đánh cạnh → xiên
- [ ] Level progression + speed increase
- [ ] Lives system (3 lives)
- [ ] Level clear → next level animation

---

### Game 14 — Wordle

**File:** `lib/games/wordle/wordle_game.dart` + `lib/games/wordle/words.dart`

#### Model
```dart
enum LetterState { empty, typed, correct, present, absent }

class WordleModel {
  String target = '';              // 5-letter word
  List<List<String>> grid;         // 6×5 letters
  List<List<LetterState>> states;  // 6×5 states
  int currentRow = 0;
  String currentInput = '';        // max 5 chars
  Map<String, LetterState> keyStates = {}; // 26 keys
  WordleGameState state = WordleGameState.playing;
  int streak = 0, bestStreak = 0;
  List<int> distribution = List.filled(6, 0); // win on row 1-6
}

enum WordleGameState { playing, won, lost }
```

#### Controller — `WordleController`
```dart
void newGame();                     // random từ words.dart
void addLetter(String c);           // nếu currentInput.length < 5
void deleteLetter();
void submitGuess();
//   1. Check in word list (isValidWord)
//   2. Evaluate: correct/present/absent
//   3. Update grid states + keyStates
//   4. Check win/lose
List<LetterState> _evaluate(String guess, String target);
bool _isValidWord(String w);        // check trong wordList
```

#### Screen — `WordleScreen`
- 6×5 grid: `AnimatedContainer` với flip animation khi submit (delay per column)
- On-screen keyboard: 3 hàng QWERTY, phím màu theo `keyStates`
- Toast messages: "Từ không hợp lệ", "Tuyệt vời!", "Không còn lượt nữa"
- Header: streak + nút mới
- Thống kê: distribution bar chart + streak info

#### Word List (words.dart)
```dart
// ~500 từ 5 chữ cái thông dụng tiếng Anh
// Chia 2 list: targetWords (dùng làm đáp án) + validWords (tất cả từ hợp lệ)
const List<String> targetWords = ['apple', 'brave', ...]; // ~300 từ
const List<String> validWords = [...targetWords, 'aahed', ...]; // ~500 từ
```

#### Flip Animation
```dart
// Khi submit row, mỗi ô flip với delay index * 150ms
// 0→π/2: show typed letter | π/2→π: show colored state
// Dùng AnimationController per row (5 controllers song song với delay)
```

#### SharedPreferences
- `wordle_streak`, `wordle_best_streak`
- `wordle_distribution` (JSON list)
- `wordle_last_word_index` (không lặp từ gần đây)

#### Acceptance Criteria
- [ ] Evaluate correct/present/absent đúng (kể cả chữ trùng)
- [ ] Flip animation đẹp, đúng màu
- [ ] Keyboard màu update sau mỗi guess
- [ ] Word validation trước khi submit
- [ ] Streak tích lũy

---

### Game 15 — Ninja Fruit 🆕

**File:** `lib/games/ninja_fruit/ninja_fruit_game.dart`

#### Cơ chế gameplay tổng quan
- Trái cây được ném lên từ cạnh dưới màn hình theo đường parabol
- Người chơi **vuốt ngón tay** để chém trái cây (slash path detection)
- **Bom** xuất hiện xen kẽ — chạm bom mất mạng ngay lập tức
- Mỗi trái cây bị bỏ qua (rơi ra ngoài màn hình) mất 1 trong 3 mạng
- **Combo**: chém nhiều trái liên tiếp trong 1 lần vuốt → nhân điểm

#### Model

```dart
enum FruitType { watermelon, apple, orange, mango, pineapple, coconut }
enum ObjectType { fruit, bomb }

class FlyingObject {
  final ObjectType type;
  final FruitType? fruitType;    // null nếu là bom
  double x, y;                   // vị trí hiện tại (normalized 0.0→1.0)
  double vx, vy;                 // vận tốc (normalized/ms)
  bool isSliced = false;
  bool isOffScreen = false;
  // Sau khi slice: tách thành 2 nửa
  double leftAngle = 0, rightAngle = 0;
  double leftVX = 0, rightVX = 0;
}

class NinjaFruitModel {
  List<FlyingObject> objects = [];
  List<SlashTrail> slashTrails = [];   // hiệu ứng vết chém
  List<JuiceSplash> splashes = [];     // hiệu ứng nước trái cây
  int score = 0;
  int bestScore = 0;
  int lives = 3;                       // 3 quả tim
  int combo = 0;                       // số trái chém liên tiếp 1 lần vuốt
  int maxCombo = 0;
  NinjaFruitState state = NinjaFruitState.idle;
  double gameSpeed = 1.0;              // tăng dần theo thời gian
  int elapsedSeconds = 0;
}

class SlashTrail {
  final List<Offset> points;           // các điểm vuốt gần nhất (max 15)
  double opacity = 1.0;                // fade out theo thời gian
}

class JuiceSplash {
  final Color color;
  final Offset position;
  double radius = 0;
  double opacity = 1.0;
  final List<Offset> droplets;         // 6–8 giọt bắn ra
}

enum NinjaFruitState { idle, playing, gameOver }
```

#### Controller — `NinjaFruitController`

```dart
class NinjaFruitController {
  // ─── Spawning ───────────────────────────────────────────
  Timer? _spawnTimer;
  double _spawnInterval = 1200;   // ms, giảm dần theo thời gian
  final Random _rng = Random();

  void _spawnObject() {
    // 85% trái cây, 15% bom (tăng lên 25% sau 30s)
    // Spawn từ cạnh trái / phải / dưới với góc ngẫu nhiên
    // vx: ±(0.0003..0.0008), vy: -(0.0015..0.0025) (bay lên)
  }

  // ─── Physics update (Ticker) ────────────────────────────
  static const double gravity = 0.000003;  // normalized/ms²

  void update(double dtMs) {
    _updateObjects(dtMs);
    _updateTrails(dtMs);
    _updateSplashes(dtMs);
    _checkOffScreen();
    _updateGameSpeed();
  }

  void _updateObjects(double dtMs) {
    for (final obj in objects) {
      obj.vy += gravity * dtMs;
      obj.x  += obj.vx * dtMs;
      obj.y  += obj.vy * dtMs;
    }
  }

  // ─── Slash detection ────────────────────────────────────
  List<Offset> _currentSlash = [];
  int _comboCount = 0;

  void onPanStart(Offset pos) {
    _currentSlash = [pos];
    _comboCount = 0;
  }

  void onPanUpdate(Offset pos, Size screenSize) {
    _currentSlash.add(pos);
    if (_currentSlash.length > 15) _currentSlash.removeAt(0);
    model.slashTrails.add(SlashTrail(points: List.from(_currentSlash)));
    _checkSlash(pos, screenSize);
  }

  void onPanEnd() {
    _currentSlash.clear();
    _comboCount = 0;
  }

  void _checkSlash(Offset pos, Size screenSize) {
    for (final obj in model.objects) {
      if (obj.isSliced) continue;
      final objScreen = Offset(obj.x * screenSize.width, obj.y * screenSize.height);
      final hitRadius = screenSize.width * 0.065;  // ~6.5% màn hình
      if ((pos - objScreen).distance < hitRadius) {
        if (obj.type == ObjectType.bomb) {
          _onBombHit();
        } else {
          _onFruitSliced(obj);
        }
      }
    }
  }

  void _onFruitSliced(FlyingObject fruit) {
    fruit.isSliced = true;
    _comboCount++;
    final comboMultiplier = _comboCount >= 3 ? _comboCount : 1;
    model.score += 10 * comboMultiplier;
    model.combo = _comboCount;
    if (_comboCount > model.maxCombo) model.maxCombo = _comboCount;
    _spawnJuiceSplash(fruit);
    // Tách fruit thành 2 nửa (physics riêng)
    fruit.leftVX  = -0.0004; fruit.rightVX = 0.0004;
    fruit.leftAngle  = -0.3; fruit.rightAngle = 0.3;
  }

  void _onBombHit() {
    model.lives--;
    // Flash đỏ toàn màn hình
    if (model.lives <= 0) _endGame();
  }

  void _onFruitMissed() {
    model.lives--;
    if (model.lives <= 0) _endGame();
  }

  // ─── Speed scaling ───────────────────────────────────────
  void _updateGameSpeed() {
    // Mỗi 10 giây tăng speed 8%, tối đa ×2.5 sau 80s
    model.gameSpeed = (1.0 + model.elapsedSeconds / 10 * 0.08).clamp(1.0, 2.5);
    _spawnInterval = (1200 / model.gameSpeed).clamp(400, 1200);
  }

  // ─── Scoring ─────────────────────────────────────────────
  // Trái đơn:    +10 điểm
  // Combo ×2:    +20 điểm
  // Combo ×3:    +30 điểm
  // Combo ×N:    +10×N điểm
  // Bỏ trái:     -1 mạng (không trừ điểm)

  void dispose() {
    _spawnTimer?.cancel();
  }
}
```

#### Screen — `NinjaFruitScreen`

```dart
class NinjaFruitScreen extends StatefulWidget { ... }
class _NinjaFruitScreenState extends State<NinjaFruitScreen>
    with TickerProviderStateMixin {

  late final NinjaFruitController _ctrl;
  late final Ticker _ticker;
  late final AnimationController _bombFlashCtrl;  // flash đỏ khi trúng bom

  // GestureDetector bọc toàn màn hình
  // onPanStart → _ctrl.onPanStart
  // onPanUpdate → _ctrl.onPanUpdate(pos, size)
  // onPanEnd → _ctrl.onPanEnd()

  // CustomPaint cho toàn bộ game
  // Stack: CustomPaint + HUD overlay (score, lives, combo)
}
```

#### CustomPainter — `NinjaFruitPainter`

```dart
// Background: gradient tối Color(0xFF0D0D1A) → Color(0xFF1A0D2E)
//
// Trái cây: vẽ bằng emoji TextPainter (kích thước ~60px)
//   🍉 Watermelon | 🍎 Apple | 🍊 Orange | 🥭 Mango | 🍍 Pineapple | 🥥 Coconut
//
// Bom: 💣 emoji + vòng tròn cảnh báo nhấp nháy (đỏ, opacity sin wave)
//
// Nửa trái (sau slice): vẽ emoji xoay theo leftAngle/rightAngle
//
// Slash trail: Path qua các points, stroke với gradient trắng → trong suốt
//   strokeWidth: 3px, opacity fade theo tuổi trail
//
// Juice splash: vòng tròn mở rộng + 6–8 chấm nhỏ bắn ra theo góc random
//   Màu juice: 🍉=đỏ, 🍎=đỏ nhạt, 🍊=cam, 🥭=vàng, 🍍=vàng xanh, 🥥=trắng
//
// HUD (vẽ bằng Canvas.drawParagraph):
//   Top-left:   ❤❤❤ (lives — đỏ/xám)
//   Top-center: Score + "COMBO ×N!" khi combo ≥ 3
//   Top-right:  Best score
```

#### Màn hình chọn chế độ (idle overlay)

```dart
// Overlay hiện khi state == idle / gameOver:
// - Tiêu đề "NINJA FRUIT"
// - "Best: X" / "Max Combo: X"
// - Nút "PLAY" lớn
// - Khi gameOver: hiện final score + max combo của ván
```

#### Cấu trúc file (1 file duy nhất)

```
lib/games/ninja_fruit/ninja_fruit_game.dart
  ├── enum FruitType, ObjectType, NinjaFruitState
  ├── class FlyingObject
  ├── class SlashTrail
  ├── class JuiceSplash
  ├── class NinjaFruitModel
  ├── class NinjaFruitController
  ├── class NinjaFruitPainter extends CustomPainter
  ├── class NinjaFruitScreen extends StatefulWidget
  └── class _NinjaFruitScreenState
```

#### SharedPreferences
- `best_score_ninja_fruit`
- `best_combo_ninja_fruit`

#### Hub Entry
```dart
GameEntry(
  name: 'Ninja Fruit',
  description: 'Chém trái cây\ntránh bom nổ',
  icon: Icons.sports_martial_arts_rounded,
  gradient: const [Color(0xFF43A047), Color(0xFFFF6F00)], // Green→Orange
  builder: (_) => const NinjaFruitScreen(),
),
```

#### Acceptance Criteria
- [ ] Slash detection chính xác — không miss trái cây khi vuốt qua
- [ ] Bom kết thúc game ngay lập tức, flash đỏ toàn màn hình
- [ ] Combo counter hiển thị "×N" khi N ≥ 3
- [ ] Juice splash animation mỗi loại trái đúng màu
- [ ] Slash trail fade out mượt mà
- [ ] Nửa trái bay ra 2 phía sau khi chém
- [ ] Tốc độ spawn tăng dần theo thời gian
- [ ] 60fps — không jank trong lúc nhiều objects cùng lúc

---

## 4. Lộ trình phát triển (Roadmap)

### Tổng quan phases

| Phase | Tên | Games | Mục tiêu |
|-------|-----|-------|----------|
| 0 | Foundation | 2048 + Hub | ✅ Done |
| 1 | Quick Wins | Simon, Tic-Tac-Toe, Whack-a-Mole | 3 game Very Easy |
| 2 | Pure Logic | Memory Match, Minesweeper, Sliding Puzzle, Mastermind | 4 game không game loop |
| 3 | Timer Loop | Snake | 1 game Timer-based |
| 4 | Physics | Flappy Bird, Brick Breaker | 2 game Ticker-based |
| 5 | Complex | Tetris, Wordle | 2 game Med-Hard |
| 6 | Expert | Sudoku | 1 game Hard + Isolate |
| 7 | Polish | Tất cả | UX, performance, release |

---

### Phase 1 — Quick Wins (Very Easy)

**Mục tiêu:** 3 game đơn giản nhất, build nhanh để tạo momentum.

| Task | Game | Output | Done |
|------|------|--------|------|
| 1.1 | Simon Says | `lib/games/simon/simon_game.dart` | [ ] |
| 1.2 | Tích hợp Simon vào Hub | `lib/main.dart` | [ ] |
| 1.3 | Tic-Tac-Toe | `lib/games/tictactoe/tictactoe_game.dart` | [ ] |
| 1.4 | Tích hợp Tic-Tac-Toe vào Hub | `lib/main.dart` | [ ] |
| 1.5 | Whack-a-Mole | `lib/games/whack_mole/whack_mole_game.dart` | [ ] |
| 1.6 | Tích hợp Whack-a-Mole vào Hub | `lib/main.dart` | [ ] |
| 1.7 | `flutter analyze lib/` — zero issues | — | [ ] |

**Deliverable:** Hub có 4 game playable (2048 + Simon + TicTacToe + Whack-a-Mole).

**Hub gradients cho Phase 1:**
```dart
Simon:       [Color(0xFFE91E63), Color(0xFF3F51B5)] // Red→Blue
TicTacToe:   [Color(0xFF607D8B), Color(0xFF455A64)] // BlueGrey
WhackMole:   [Color(0xFFFF6B35), Color(0xFFFF8C00)] // Orange
```

---

### Phase 2 — Pure Logic (No Game Loop)

**Mục tiêu:** 4 game logic, không cần Timer/Ticker, focus vào thuật toán.

| Task | Game | Output | Done |
|------|------|--------|------|
| 2.1 | Memory Match | `lib/games/memory/memory_game.dart` | [ ] |
| 2.2 | Tích hợp Memory vào Hub | `lib/main.dart` | [ ] |
| 2.3 | Minesweeper | `lib/games/minesweeper/minesweeper_game.dart` | [ ] |
| 2.4 | Tích hợp Minesweeper vào Hub | `lib/main.dart` | [ ] |
| 2.5 | Sliding Puzzle | `lib/games/sliding_puzzle/sliding_puzzle_game.dart` | [ ] |
| 2.6 | Tích hợp Sliding Puzzle vào Hub | `lib/main.dart` | [ ] |
| 2.7 | Mastermind | `lib/games/mastermind/mastermind_game.dart` | [ ] |
| 2.8 | Tích hợp Mastermind vào Hub | `lib/main.dart` | [ ] |
| 2.9 | `flutter analyze lib/` — zero issues | — | [ ] |

**Deliverable:** Hub có 8 game playable.

**Hub gradients cho Phase 2:**
```dart
Memory:        [Color(0xFFE91E63), Color(0xFF9C27B0)] // Pink→Purple
Minesweeper:   [Color(0xFF78909C), Color(0xFF37474F)] // Slate
SlidingPuzzle: [Color(0xFF26C6DA), Color(0xFF00838F)] // Cyan
Mastermind:    [Color(0xFF7E57C2), Color(0xFF4527A0)] // Deep Purple
```

---

### Phase 3 — Timer Loop

**Mục tiêu:** Snake — Timer.periodic, CustomPainter, tốc độ adaptive.

| Task | Game | Output | Done |
|------|------|--------|------|
| 3.1 | Snake | `lib/games/snake/snake_game.dart` | [ ] |
| 3.2 | Tích hợp Snake vào Hub | `lib/main.dart` | [ ] |
| 3.3 | `flutter analyze lib/` | — | [ ] |

**Deliverable:** Hub có 9 game playable.

---

### Phase 4 — Physics (Ticker-based)

**Mục tiêu:** 2 game vật lý cần Ticker, normalized coordinates.

| Task | Game | Output | Done |
|------|------|--------|------|
| 4.1 | Flappy Bird | `lib/games/flappy/flappy_game.dart` | [ ] |
| 4.2 | Tích hợp Flappy vào Hub | `lib/main.dart` | [ ] |
| 4.3 | Brick Breaker | `lib/games/brick_breaker/brick_breaker_game.dart` | [ ] |
| 4.4 | Tích hợp Brick Breaker vào Hub | `lib/main.dart` | [ ] |
| 4.5 | `flutter analyze lib/` | — | [ ] |

**Deliverable:** Hub có 11 game playable.

**Hub gradient Brick Breaker:** `[Color(0xFF6A1B9A), Color(0xFF1565C0)]` // Purple→Blue

---

### Phase 5 — Complex Games

**Mục tiêu:** Tetris (DAS + SRS) và Wordle (word list + flip animation).

| Task | Game | Output | Done |
|------|------|--------|------|
| 5.1 | Tetris | `lib/games/tetris/tetris_game.dart` | [ ] |
| 5.2 | Tích hợp Tetris vào Hub | `lib/main.dart` | [ ] |
| 5.3 | Word list | `lib/games/wordle/words.dart` (~500 từ) | [ ] |
| 5.4 | Wordle | `lib/games/wordle/wordle_game.dart` | [ ] |
| 5.5 | Tích hợp Wordle vào Hub | `lib/main.dart` | [ ] |
| 5.6 | `flutter analyze lib/` | — | [ ] |

**Deliverable:** Hub có 13 game playable.

**Hub gradient Wordle:** `[Color(0xFF558B2F), Color(0xFF33691E)]` // Green

---

### Phase 6 — Expert (Sudoku + Isolate)

**Mục tiêu:** Sudoku với puzzle generator trong Isolate, 3 độ khó.

| Task | Game | Output | Done |
|------|------|--------|------|
| 6.1 | Sudoku | `lib/games/sudoku/sudoku_game.dart` | [ ] |
| 6.2 | Tích hợp Sudoku vào Hub | `lib/main.dart` | [ ] |
| 6.3 | `flutter analyze lib/` | — | [ ] |

**Deliverable:** Hub có **14 game playable** — FULL LINEUP.

---

### Phase 7 — Polish & Release

| Task | Chi tiết | Done |
|------|---------|------|
| 7.1 | UX pass: back button, edge cases, empty states | [ ] |
| 7.2 | Performance: `flutter run --profile`, frame budget 16ms | [ ] |
| 7.3 | Hub sorting: sắp xếp game theo thứ tự hợp lý | [ ] |
| 7.4 | Splash screen + app icon | [ ] |
| 7.5 | `flutter build apk --release` — test trên thiết bị thật | [ ] |
| 7.6 | `flutter build ios --release` (nếu có Mac) | [ ] |
| 7.7 | README.md cập nhật | [ ] |

---

### Phase 8 — Ninja Fruit (Game Mới)

**Mục tiêu:** Triển khai game Ninja Fruit hoàn chỉnh — Ticker-based, slash gesture, juice splash FX.

| Task | Output | Ưu tiên | Done |
|------|--------|---------|------|
| 8.1 | Tạo `lib/games/ninja_fruit/ninja_fruit_game.dart` — Model + enums | P0 | [ ] |
| 8.2 | Implement NinjaFruitController: spawn, physics update, speed scaling | P0 | [ ] |
| 8.3 | Implement slash detection (onPanUpdate hitRadius check) | P0 | [ ] |
| 8.4 | NinjaFruitPainter: background, fruit emoji, bomb, slash trail | P0 | [ ] |
| 8.5 | Juice splash animation + half-fruit physics sau khi chém | P1 | [ ] |
| 8.6 | HUD: lives (❤❤❤), score, combo "×N" badge | P1 | [ ] |
| 8.7 | Bomb flash đỏ + game over overlay | P1 | [ ] |
| 8.8 | Tích hợp vào Hub (main.dart) | P0 | [ ] |
| 8.9 | SharedPreferences: best score + best combo | P1 | [ ] |
| 8.10 | `flutter analyze lib/games/ninja_fruit/` — zero issues | P0 | [ ] |

**Deliverable:** Hub có **15 game playable** — Ninja Fruit hoạt động.

---

### Phase 9 — Game Enhancements

**Mục tiêu:** Cải tiến 4 game hiện có theo thứ tự ưu tiên dựa trên độ phức tạp thấp → cao.

#### Phase 9A — Tic-Tac-Toe Board Size (dễ nhất, ít rủi ro)

| Task | Output | Done |
|------|--------|------|
| 9A.1 | Refactor Model: boardSize, winCondition, board resize | [ ] |
| 9A.2 | Cập nhật checkWinner → N×N generic | [ ] |
| 9A.3 | Board size selector UI (3×3 / 4×4 / 5×5) | [ ] |
| 9A.4 | Grid + X/O scaling tự động theo boardSize | [ ] |
| 9A.5 | Heuristic AI cho 5×5 | [ ] |
| 9A.6 | Stats riêng từng boardSize (SharedPreferences) | [ ] |
| 9A.7 | `flutter analyze` — zero issues | [ ] |

#### Phase 9B — Mastermind Advanced

| Task | Output | Done |
|------|--------|------|
| 9B.1 | Difficulty selector + mở rộng Model (positions, colorCount) | [ ] |
| 9B.2 | Expert mode: no-duplicate secret generation | [ ] |
| 9B.3 | Timer (MM:SS) + best time lưu theo difficulty | [ ] |
| 9B.4 | Stats modal: win rate, distribution bar chart | [ ] |
| 9B.5 | HintEngine: filter candidates + getHint() | [ ] |
| 9B.6 | Two Player mode (pass-and-play) | [ ] |
| 9B.7 | `flutter analyze` — zero issues | [ ] |

#### Phase 9C — Wordle Extended

| Task | Output | Done |
|------|--------|------|
| 9C.1 | Tách + mở rộng words_en.dart (thêm 6, 7 ký tự) | [ ] |
| 9C.2 | Mở rộng Model: wordLength + resize grid | [ ] |
| 9C.3 | Length selector UI (5 / 6 / 7) + grid scaling | [ ] |
| 9C.4 | Shake animation (invalid word) | [ ] |
| 9C.5 | Bounce animation (nhập ký tự) + Dance animation (thắng) | [ ] |
| 9C.6 | Daily Challenge: getDailyWord() + state lưu theo ngày | [ ] |
| 9C.7 | Countdown đến ngày mai khi Daily đã chơi | [ ] |
| 9C.8 | Tạo words_vi.dart + language selector | [ ] |
| 9C.9 | Stats modal mở rộng (distribution chart, win rate) | [ ] |
| 9C.10 | `flutter analyze` — zero issues | [ ] |

#### Phase 9D — Brick Breaker Multi-level (phức tạp nhất)

| Task | Output | Done |
|------|--------|------|
| 9D.1 | Tạo brick_levels.dart: LevelConfig + 20 level definitions | [ ] |
| 9D.2 | Refactor BrickBreakerModel: multi-ball, power-up slots | [ ] |
| 9D.3 | PowerUpDrop: rơi xuống, paddle collect, 6 effect types | [ ] |
| 9D.4 | Level Select Screen: grid 4 cột, lock/unlock, sao | [ ] |
| 9D.5 | Save/load tiến trình (level unlocked + best score per level) | [ ] |
| 9D.6 | Level 20 "Boss": hàng gạch di chuyển ngang | [ ] |
| 9D.7 | `flutter analyze` — zero issues | [ ] |

**Thứ tự triển khai gợi ý:** 9A → 9B → 9C → 9D (risk tăng dần)

---

---

## 4b. Kế hoạch cải tiến (Enhancement Plans)

---

### Enhancement E1 — Brick Breaker: Multi-level System 🔧

**Files sửa/tạo:**
- `lib/games/brick_breaker/brick_breaker_game.dart` — refactor Controller + Model
- `lib/games/brick_breaker/brick_levels.dart` — mới: level configs + power-up definitions
- `lib/games/brick_breaker/level_select_screen.dart` — mới: màn hình chọn level

#### E1.1 — Level Configuration System

```dart
// lib/games/brick_breaker/brick_levels.dart

enum PowerUpType {
  expandPaddle,    // Paddle rộng hơn 50% trong 10s
  multiBall,       // Thêm 2 quả bóng
  slowBall,        // Giảm tốc độ bóng 40% trong 8s
  laser,           // Paddle bắn laser phá gạch trực tiếp
  shield,          // Chắn dưới màn hình 5s (bóng không mất)
  fireBall,        // Bóng xuyên gạch liên tiếp trong 6s
}

class PowerUpDrop {
  final double x, y;           // vị trí xuất hiện (normalized)
  final PowerUpType type;
  double vy = 0.0002;          // rơi xuống
  bool collected = false;
}

class BrickConfig {
  final int row, col;          // vị trí trong lưới
  final int hits;              // 1, 2, hoặc 3
  final bool hasPowerUp;       // rơi power-up khi phá
  final PowerUpType? powerUpType;
}

class LevelConfig {
  final int levelNumber;
  final String name;           // "Level 1 — Warmup", "Level 5 — Chaos"
  final List<BrickConfig> bricks;
  final double ballSpeedMultiplier;   // tốc độ ball so với baseline
  final int rows, cols;               // kích thước lưới gạch
  final Color accentColor;            // màu sắc chủ đề level
}

// 20 level định nghĩa sẵn + generator cho level 21+
const List<LevelConfig> kLevels = [
  // Level  1: 3 rows × 8 cols, all 1-hit, speed ×1.0
  // Level  2: 4 rows × 8 cols, row 1 = 2-hit, speed ×1.05
  // Level  3: 5 rows × 8 cols, rows 1-2 = 2-hit, speed ×1.10
  // Level  5: hình chữ V (pattern đặc biệt)
  // Level  8: checkerboard 3-hit
  // Level 10: "Diamond" — bố cục kim cương, 3-hit ở giữa
  // Level 15: random gaps (ô trống xen kẽ)
  // Level 20: "Boss" — hàng gạch không phá được ở giữa di chuyển ngang
];
```

#### E1.2 — Model (mở rộng)

```dart
class BrickBreakerModel {
  // ... existing fields ...
  List<BallState> balls = [];         // hỗ trợ multi-ball
  List<PowerUpDrop> activePowerUps = [];
  List<ActiveEffect> effects = [];    // hiệu ứng đang kích hoạt
  int currentLevel = 1;
  int totalScore = 0;                 // tích lũy qua tất cả level
  Map<int, bool> levelUnlocked = {};  // level nào đã mở khoá
}

class BallState {
  double x, y, vx, vy;
  bool isFireBall = false;
}

class ActiveEffect {
  final PowerUpType type;
  double remainingMs;
}
```

#### E1.3 — Level Select Screen

```dart
// lib/games/brick_breaker/level_select_screen.dart
class LevelSelectScreen extends StatelessWidget {
  // GridView 4 cột
  // Mỗi ô: số level + tên ngắn + sao (0–3 dựa trên số mạng còn lại)
  // Lock icon cho level chưa mở khoá
  // Level unlock: hoàn thành level N → mở khoá N+1
  // Hiện "BEST" score mỗi level
}
```

#### E1.4 — Thứ tự triển khai

| Bước | Task | Ưu tiên |
|------|------|---------|
| 1 | Tạo `brick_levels.dart` + 20 LevelConfig | P0 |
| 2 | Refactor BrickBreakerModel hỗ trợ multi-ball | P0 |
| 3 | Implement PowerUpDrop rơi + collect logic | P1 |
| 4 | Implement 6 hiệu ứng power-up | P1 |
| 5 | Level Select Screen + lock/unlock logic | P1 |
| 6 | Save tiến trình (level đã hoàn thành, best score mỗi level) | P2 |
| 7 | "Boss level" gạch di chuyển ngang (level 20) | P3 |

#### E1.5 — SharedPreferences (mở rộng)

```
brick_level_unlocked_{n}   → bool
brick_best_score_{n}        → int
brick_best_stars_{n}        → int (0–3)
brick_last_level            → int (resume from)
```

#### E1.6 — Acceptance Criteria
- [ ] 20 level với bố cục khác nhau, độ khó tăng dần
- [ ] Level Select hiển thị lock/unlock + sao đúng
- [ ] Ít nhất 4 power-up hoạt động đúng (expand, multiBall, slow, shield)
- [ ] Multi-ball không crash khi 3 balls cùng lúc
- [ ] Tiến trình lưu và resume đúng khi thoát giữa chừng

---

### Enhancement E2 — Tic-Tac-Toe: Board Size Options 🔧

**File sửa:** `lib/games/tictactoe/tictactoe_game.dart`

#### E2.1 — Model (mở rộng)

```dart
class TicTacToeModel {
  int boardSize = 3;                        // 3, 4, 5, hoặc custom 6–8
  List<String> board = List.filled(9, ''); // resize khi đổi boardSize
  String currentPlayer = 'X';
  String? winner;
  List<int>? winLine;                       // indices của winning cells
  int winCondition = 3;                     // số ô liên tiếp để thắng
  // boardSize=3 → winCondition=3
  // boardSize=4 → winCondition=4
  // boardSize=5 → winCondition=5 (hoặc 4 — tuỳ chọn)
  int playerWins = 0, aiWins = 0, draws = 0;
  bool playerIsX = true;
  AIDifficulty difficulty = AIDifficulty.hard;
}

enum AIDifficulty { easy, medium, hard }
// easy:   AI random
// medium: AI chặn thắng + tấn công 1 nước
// hard:   Minimax (chỉ áp dụng ≤ 4×4 vì 5×5 quá chậm)
```

#### E2.2 — Win Condition Logic

```dart
// Thắng khi có `winCondition` ô liên tiếp theo:
// - Hàng ngang
// - Cột dọc
// - Đường chéo chính
// - Đường chéo phụ
//
// Với 5×5: winCondition = 5 → khó hơn nhiều; có thể cho winCondition = 4

String? checkWinner(List<String> board, int size, int winCond) {
  // Check rows
  for (int r = 0; r < size; r++) {
    for (int c = 0; c <= size - winCond; c++) {
      final symbol = board[r * size + c];
      if (symbol.isEmpty) continue;
      if (List.generate(winCond, (i) => board[r * size + c + i])
          .every((s) => s == symbol)) return symbol;
    }
  }
  // Check cols, diagonals tương tự...
}
```

#### E2.3 — AI cho board lớn (4×4, 5×5)

```dart
// 3×3: Minimax đầy đủ + alpha-beta (không giới hạn depth)
// 4×4: Minimax depth limit = 4, heuristic score cho vị thế
// 5×5: Heuristic AI (không Minimax — quá chậm):
//   - Ưu tiên nước tạo chuỗi dài nhất
//   - Chặn chuỗi dài của đối thủ
//   - Trung tâm > cạnh > góc

int _heuristicScore(List<String> board, int size, int winCond, String player) {
  // Đếm số chuỗi N-1 đang mở của player → cộng điểm
  // Đếm số chuỗi N-1 đang mở của đối thủ → trừ điểm nặng
}
```

#### E2.4 — UI scaling

```dart
// Board selector: Chip hoặc SegmentedButton
// [3×3] [4×4] [5×5] [Custom]
// Custom: Slider 6–8 hoặc TextField số

// Grid tự scale:
// Kích thước mỗi ô = availableWidth / boardSize
// X/O font size = ô × 0.55
// Winning line: vẽ Canvas line qua trung tâm 2 ô đầu-cuối của winLine

// Stats riêng theo từng boardSize:
// best_{size}x{size}_player_wins, _ai_wins, _draws
```

#### E2.5 — Thứ tự triển khai

| Bước | Task | Ưu tiên |
|------|------|---------|
| 1 | Refactor Model + boardSize field + resize board | P0 |
| 2 | Cập nhật checkWinner cho N×N + winCondition | P0 |
| 3 | Board size selector UI + grid scaling | P0 |
| 4 | AI heuristic cho 5×5 | P1 |
| 5 | Stats riêng theo từng boardSize | P2 |
| 6 | Custom size (6–8) | P3 |

#### E2.6 — SharedPreferences (mở rộng)

```
ttt_player_wins_3x3, ttt_ai_wins_3x3, ttt_draws_3x3
ttt_player_wins_4x4, ttt_ai_wins_4x4, ttt_draws_4x4
ttt_player_wins_5x5, ttt_ai_wins_5x5, ttt_draws_5x5
```

#### E2.7 — Acceptance Criteria
- [ ] 3×3 Minimax vẫn không thể thua
- [ ] 4×4 AI đủ mạnh, không quá chậm (< 500ms mỗi nước)
- [ ] 5×5 Heuristic AI không timeout
- [ ] Win line vẽ đúng ở cả 4×4 và 5×5
- [ ] Board scale đẹp trên màn hình 360dp → 430dp

---

### Enhancement E3 — Mastermind: Advanced Features 🔧

**File sửa:** `lib/games/mastermind/mastermind_game.dart`

#### E3.1 — Chế độ khó (Hard Mode)

```dart
enum MastermindDifficulty {
  classic,   // 4 vị trí, màu 1–6, 10 lượt
  hard,      // 5 vị trí, màu 1–8, 12 lượt
  expert,    // 6 vị trí, màu 1–8, 12 lượt, không được trùng màu
}

class MastermindModel {
  MastermindDifficulty difficulty = MastermindDifficulty.classic;
  int positions = 4;             // 4, 5, hoặc 6
  int colorCount = 6;            // 6 hoặc 8
  bool allowDuplicates = true;   // false ở expert
  int maxAttempts = 10;          // 10 hoặc 12
  // ... existing fields ...
  List<GuessStat> stats = [];    // số lần thắng theo số lượt
  int totalGames = 0;
  int totalWins = 0;
  double winRate = 0.0;
  int currentStreak = 0;
  int bestStreak = 0;
  int? timerSeconds;             // null = không dùng timer
  int elapsedSeconds = 0;
}

class GuessStat {
  final int guessCount;   // thắng sau bao nhiêu lượt
  int count = 0;
}
```

#### E3.2 — Gợi ý thông minh (Smart Hint)

```dart
// Dựa trên lịch sử guess + feedback, loại trừ các mã không hợp lệ
// Thuật toán Knuth's 5-guess algorithm (đơn giản hoá):

class HintEngine {
  List<List<int>> _remainingCandidates = [];

  void initCandidates(int positions, int colors, bool allowDup) {
    // Sinh tất cả mã hợp lệ (6^4 = 1296 với classic)
  }

  void filterCandidates(List<int> guess, int blacks, int whites) {
    // Loại các mã mà nếu là secret thì sẽ cho kết quả khác
    _remainingCandidates.removeWhere((candidate) {
      final (b, w) = _evaluate(guess, candidate);
      return b != blacks || w != whites;
    });
  }

  List<int> getHint() {
    // Trả về mã tốt nhất từ remaining candidates (minimax worst-case)
    // Giới hạn: chỉ tính trên max 200 candidates để không chậm
    return _remainingCandidates.first; // simplified
  }

  int get remainingCount => _remainingCandidates.length;
}
```

#### E3.3 — Thống kê chi tiết

```dart
// Màn hình Stats (modal):
// - Tổng số ván / số ván thắng / win rate (%)
// - Streak hiện tại / best streak
// - Distribution bar: số ván thắng ở lượt 1–10 (giống Wordle)
// - Thời gian trung bình mỗi ván thắng

Widget _buildStatsModal() {
  return Column(children: [
    _StatRow('Tổng ván', totalGames),
    _StatRow('Thắng', totalWins),
    _StatRow('Win Rate', '${winRate.toStringAsFixed(1)}%'),
    _StatRow('Streak', currentStreak),
    _StatRow('Best Streak', bestStreak),
    _DistributionChart(stats),  // bar chart ngang
  ]);
}
```

#### E3.4 — Bộ đếm thời gian

```dart
// Timer hiển thị ở header: MM:SS đếm lên
// Khi thắng: lưu thời gian, so sánh với best time theo difficulty
// Có thể bật/tắt trong Settings overlay

Timer? _clockTimer;
void _startClock() {
  _clockTimer = Timer.periodic(const Duration(seconds: 1), (_) {
    model.elapsedSeconds++;
    notifyUpdate();
  });
}
```

#### E3.5 — Chế độ 2 người (Pass & Play)

```dart
enum MastermindMode { vsAI, twoPlayer }

// Two Player:
// - Player 1 nhập mã bí mật (ẩn bằng ****), bấm "Xác nhận"
// - Player 2 đoán như bình thường
// - Kết thúc: đổi vai, so sánh số lượt đoán
// - Người thắng = người đoán ít lượt hơn

class TwoPlayerMastermind {
  List<int> p1Secret = [];
  List<int> p2Secret = [];
  int p1Guesses = 0;
  int p2Guesses = 0;
  int currentPlayer = 1;       // 1 hoặc 2
  bool p1SetSecret = false;
  bool p2SetSecret = false;
}
```

#### E3.6 — Thứ tự triển khai

| Bước | Task | Ưu tiên |
|------|------|---------|
| 1 | Thêm difficulty selector (Classic / Hard / Expert) | P0 |
| 2 | Mở rộng Model: positions, colorCount, allowDuplicates | P0 |
| 3 | Bộ đếm thời gian hiển thị + lưu best time | P1 |
| 4 | Màn hình thống kê (win rate, distribution) | P1 |
| 5 | HintEngine + nút "Gợi ý" (giới hạn 3 lần/ván) | P2 |
| 6 | Two Player mode | P3 |

#### E3.7 — SharedPreferences (mở rộng)

```
mastermind_wins_{classic/hard/expert}
mastermind_streak_{classic/hard/expert}
mastermind_best_streak_{classic/hard/expert}
mastermind_best_time_{classic/hard/expert}
mastermind_distribution_{classic/hard/expert}   (JSON)
mastermind_total_games_{classic/hard/expert}
```

#### E3.8 — Acceptance Criteria
- [ ] Hard/Expert mode đổi đúng số positions, colors, maxAttempts
- [ ] Expert mode không cho phép trùng màu trong mã bí mật
- [ ] HintEngine filterCandidates chính xác (test với đáp án đã biết)
- [ ] Stats distribution hiển thị đúng sau nhiều ván
- [ ] Timer dừng khi game over/win
- [ ] Two Player: ẩn mã khi nhập, đổi vai đúng

---

### Enhancement E4 — Wordle: Extended Features 🔧

**Files sửa/tạo:**
- `lib/games/wordle/wordle_game.dart` — refactor Controller + Model + Screen
- `lib/games/wordle/words_en.dart` — tách từ words.dart hiện tại, mở rộng 5–7 ký tự
- `lib/games/wordle/words_vi.dart` — mới: từ tiếng Việt không dấu 5–7 ký tự

#### E4.1 — Multi-language Support

```dart
enum WordleLanguage { english, vietnamese }

class WordleLanguageConfig {
  final WordleLanguage language;
  final String displayName;         // "English" / "Tiếng Việt"
  final List<String> targetWords;
  final List<String> validWords;
  final List<List<String>> keyboardRows;  // bố cục bàn phím
}

// Tiếng Anh: bàn phím QWERTY
const kKeyboardEn = [
  ['Q','W','E','R','T','Y','U','I','O','P'],
  ['A','S','D','F','G','H','J','K','L'],
  ['ENTER','Z','X','C','V','B','N','M','⌫'],
];

// Tiếng Việt (không dấu — 26 chữ cái Latin):
// Dùng bàn phím QWERTY giống tiếng Anh
// Từ ví dụ: "banan", "camxu", "dautay", "nhanla", "thoilai" (5 ký tự không dấu)
// Lưu ý: loại bỏ F, J, W, Z khỏi danh sách từ VI

const kWordsVietnamese = [
  // 5 chữ: 'banana' không dấu → bỏ qua từ có dấu
  // Chỉ dùng từ Việt phiên âm La-tinh không dấu có nghĩa rõ ràng
  'banh ', 'buoi ', 'camxu', ...
]; // ~200 từ 5 ký tự tiếng Việt cơ bản
```

#### E4.2 — Custom Word Length (5–7)

```dart
class WordleModel {
  int wordLength = 5;           // 5, 6, hoặc 7
  int maxGuesses = 6;           // giữ nguyên 6 lượt
  String target = '';
  List<List<String>> grid;      // maxGuesses × wordLength
  List<List<LetterState>> states;
  // ... remaining fields unchanged ...
}

// Grid tự scale:
// wordLength=5: fontSize 22, cellSize = width/5 - 4
// wordLength=6: fontSize 19, cellSize = width/6 - 3
// wordLength=7: fontSize 16, cellSize = width/7 - 2

// Words lists theo length:
// words_en.dart:
//   const kTargetWords5 = [...]; // ~300 từ
//   const kTargetWords6 = [...]; // ~200 từ
//   const kTargetWords7 = [...]; // ~150 từ
//   const kValidWords5  = [...]; // ~500 từ
//   const kValidWords6  = [...]; // ~350 từ
//   const kValidWords7  = [...]; // ~250 từ
```

#### E4.3 — Daily Challenge Mode

```dart
// Mỗi ngày 1 từ cố định cho cả EN và VI
// Dùng ngày hiện tại làm seed để chọn từ

class DailyChallenge {
  static String getDailyWord(WordleLanguage lang, int wordLength) {
    final today = DateTime.now();
    final dayIndex = today.difference(DateTime(2026, 1, 1)).inDays;
    final wordList = _getTargetList(lang, wordLength);
    return wordList[dayIndex % wordList.length];
  }

  // Lưu trạng thái daily: đã chơi hôm nay chưa, kết quả gì
  static String get todayKey =>
    'daily_${DateTime.now().toIso8601String().substring(0, 10)}';
}

// SharedPreferences:
// daily_{YYYY-MM-DD}_lang_length_state → JSON (grid, states, result)
// Nếu đã chơi hôm nay → hiện "Already played today" + kết quả
// Hiện countdown đến 00:00 ngày mai
```

#### E4.4 — Streak Statistics (mở rộng)

```dart
class WordleStats {
  int totalPlayed = 0;
  int totalWins = 0;
  int currentStreak = 0;
  int bestStreak = 0;
  List<int> distribution = List.filled(6, 0);  // thắng ở lượt 1–6
  DateTime? lastPlayedDate;

  // Streak logic:
  // Chỉ cộng streak nếu lastPlayedDate = hôm qua (Daily mode)
  // Free Play mode: streak tính liên tiếp không theo ngày

  double get winRate => totalPlayed == 0 ? 0 : totalWins / totalPlayed * 100;
}
```

#### E4.5 — Tile Animation cải tiến

```dart
// Hiện tại: flip animation khi submit (delay per column)
// Bổ sung:
// 1. Shake animation khi từ không hợp lệ (invalid word)
//    → Row rung ngang 3 lần trong 400ms
// 2. Bounce animation khi nhập ký tự
//    → Scale 1.0 → 1.12 → 1.0 trong 100ms
// 3. Dance animation khi thắng
//    → Từng ô trong winning row bounce lên với delay stagger 100ms × index
// 4. Flip speed tăng theo số lượt (round 1: slow, round 6: fast — tension)

class TileAnimationConfig {
  static const Duration flipDuration = Duration(milliseconds: 350);
  static const Duration flipDelay = Duration(milliseconds: 150);   // per tile
  static const Duration shakeDuration = Duration(milliseconds: 400);
  static const Duration bounceDuration = Duration(milliseconds: 100);
  static const Duration danceDuration = Duration(milliseconds: 150);
  static const Duration danceDelay = Duration(milliseconds: 100);  // per tile
}
```

#### E4.6 — Screen Layout cập nhật

```dart
// Header: [Lang EN|VI] [Length 5|6|7] [Daily|Free] [Stats icon]
// Sub-header: streak badge + best streak
// Grid: tự động điều chỉnh theo wordLength
// Keyboard: giống hiện tại nhưng key width thu hẹp nếu wordLength=7
// Toast: vị trí dưới grid thay vì top (tránh che grid)
```

#### E4.7 — Thứ tự triển khai

| Bước | Task | Ưu tiên |
|------|------|---------|
| 1 | Tách `words.dart` → `words_en.dart` (thêm 6, 7 ký tự) | P0 |
| 2 | Mở rộng Model: wordLength + language | P0 |
| 3 | UI: length selector + grid scaling | P0 |
| 4 | Tile animations: shake + bounce + dance | P1 |
| 5 | Daily Challenge mode + countdown | P1 |
| 6 | Tạo `words_vi.dart` (~200 từ 5 ký tự) | P2 |
| 7 | Language selector + switch logic | P2 |
| 8 | Extended stats modal với distribution chart | P2 |

#### E4.8 — SharedPreferences (mở rộng)

```
wordle_streak_{en/vi}_{5/6/7}
wordle_best_streak_{en/vi}_{5/6/7}
wordle_distribution_{en/vi}_{5/6/7}    (JSON)
wordle_total_played_{en/vi}_{5/6/7}
wordle_last_word_{en/vi}_{5/6/7}
daily_{YYYY-MM-DD}_{en/vi}_{5/6/7}     (JSON — state của ngày đó)
```

#### E4.9 — Acceptance Criteria
- [ ] Length selector thay đổi grid + word list đúng ngay lập tức
- [ ] Daily Challenge: cùng từ cho mọi người cùng ngày
- [ ] Đã chơi Daily hôm nay → hiện kết quả + countdown
- [ ] Shake animation khi gõ từ không hợp lệ
- [ ] Dance animation khi thắng
- [ ] Tiếng Việt: bàn phím + từ load đúng
- [ ] Streak chỉ tính trong cùng language + length

---

## 5. Kỹ thuật dùng chung

### 5.1 Navigation

Không dùng `go_router` (quá phức tạp cho single-level navigation).
Dùng `Navigator.push` / `Navigator.pop` thuần.

```dart
// Mở game
Navigator.push(context, MaterialPageRoute(builder: entry.builder!));

// Back button trong game screen
if (Navigator.canPop(context))
  IconButton(
    onPressed: () => Navigator.pop(context),
    icon: const Icon(Icons.arrow_back_ios_new_rounded),
  )
```

### 5.2 SharedPreferences Helper

```dart
// lib/core/utils/prefs.dart
class Prefs {
  static SharedPreferences? _instance;

  static Future<void> init() async {
    _instance = await SharedPreferences.getInstance();
  }

  static int getInt(String key, {int defaultValue = 0}) =>
      _instance?.getInt(key) ?? defaultValue;

  static Future<void> setInt(String key, int value) =>
      _instance!.setInt(key, value);

  static String getString(String key, {String defaultValue = ''}) =>
      _instance?.getString(key) ?? defaultValue;

  static Future<void> setString(String key, String value) =>
      _instance!.setString(key, value);
}
```

Khởi tạo trong `main()`:
```dart
void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await Prefs.init();
  runApp(const SuperGateApp());
}
```

### 5.3 Swipe Input Pattern (dùng ở 2048, Snake)

```dart
Offset _panStart = Offset.zero;

void _onPanStart(DragStartDetails d) => _panStart = d.localPosition;

void _onPanEnd(DragEndDetails d) {
  final delta = d.localPosition - _panStart;
  final vel = d.velocity.pixelsPerSecond;
  final useVel = vel.distance >= 150;
  final dx = useVel ? vel.dx : delta.dx;
  final dy = useVel ? vel.dy : delta.dy;
  final minMag = useVel ? 150.0 : 30.0;
  if (dx.abs() < minMag && dy.abs() < minMag) return;
  if (dx.abs() > dy.abs()) {
    dx > 0 ? _moveRight() : _moveLeft();
  } else {
    dy > 0 ? _moveDown() : _moveUp();
  }
}
```

### 5.4 Ticker Pattern (dùng ở Flappy, Brick Breaker)

```dart
class _XxxScreenState extends State<XxxScreen>
    with TickerProviderStateMixin {
  late final Ticker _ticker;
  Duration _lastElapsed = Duration.zero;

  @override
  void initState() {
    super.initState();
    _ticker = createTicker(_onTick);
  }

  void _onTick(Duration elapsed) {
    final dt = (elapsed - _lastElapsed).inMilliseconds.toDouble();
    _lastElapsed = elapsed;
    if (dt <= 0 || dt > 100) return; // skip bad frames
    _ctrl.update(dt);
    setState(() {});
  }

  void _startGame() {
    _lastElapsed = Duration.zero;
    _ticker.start();
  }

  @override
  void dispose() {
    _ticker.dispose();
    super.dispose();
  }
}
```

### 5.5 Design System

```dart
// Màu nền hub
static const Color bgDark = Color(0xFF0A0A1A);

// Màu text
static const Color textPrimary = Colors.white;
static const Color textSecondary = Color(0xFF7777AA);

// Score box pattern (Label + Value)
Container(
  padding: const EdgeInsets.symmetric(vertical: 8, horizontal: 16),
  decoration: BoxDecoration(
    color: Colors.white12,
    borderRadius: BorderRadius.circular(10),
  ),
  child: Column(children: [
    Text(label, style: TextStyle(color: Colors.white54, fontSize: 11,
        fontWeight: FontWeight.bold, letterSpacing: 1.5)),
    Text('$value', style: TextStyle(color: Colors.white, fontSize: 20,
        fontWeight: FontWeight.w900)),
  ]),
)
```

### 5.6 Dispose Checklist

Mỗi game screen `dispose()` phải cancel/dispose:

```dart
@override
void dispose() {
  _timer?.cancel();            // Timer.periodic
  _ticker.dispose();           // Ticker (physics games)
  _animCtrl.dispose();         // AnimationController
  _focusNode.dispose();        // KeyboardListener
  // List<Timer> → forEach cancel
  super.dispose();
}
```

### 5.7 Assets

Không dùng asset file nào — tất cả dùng:
- Material Icons (`Icons.*`)
- Emoji text (`TextPainter` hoặc `Text` widget)
- Canvas drawing (`CustomPainter`)

Nếu cần âm thanh trong tương lai: thêm package `just_audio` hoặc `audioplayers`.

---

## 6. Tiêu chí hoàn thành (Definition of Done)

### 6.1 Per-game Checklist

Mỗi game phải đạt **toàn bộ** tiêu chí sau trước khi tích hợp Hub:

**Code quality:**
- [ ] `flutter analyze lib/games/{game}/` — zero issues, zero warnings
- [ ] Không có `// ignore:` không cần thiết
- [ ] `dispose()` cancel tất cả Timer, Ticker, AnimationController, FocusNode

**Gameplay:**
- [ ] Gameplay đúng với spec (cơ chế, win condition, lose condition)
- [ ] Không có crash trong 5 phút chơi liên tục
- [ ] Input mobile hoạt động (swipe / tap / long-press)
- [ ] Input desktop hoạt động nếu applicable (keyboard)

**UX:**
- [ ] Back button hiển thị đúng (chỉ khi `Navigator.canPop(context) == true`)
- [ ] "New Game" / "Restart" hoạt động đúng (reset đầy đủ state)
- [ ] Best score / best time lưu đúng vào `SharedPreferences`
- [ ] Win dialog / Game over dialog hiển thị với thông tin đủ
- [ ] Không có UI overflow (test trên màn hình nhỏ 360px width)

**Performance:**
- [ ] Frame rate ≥ 60fps trong gameplay (không có jank)
- [ ] Timer/Ticker không chạy khi game paused hoặc screen không visible

### 6.2 Hub Integration Checklist

Sau khi thêm game vào Hub:
- [ ] `flutter analyze lib/main.dart` — zero issues
- [ ] GameCard hiển thị đúng tên, icon, gradient
- [ ] Tap vào card → mở game đúng
- [ ] Back từ game → về Hub đúng
- [ ] "Sắp ra mắt" badge ẩn (builder != null)

### 6.3 Project-level Definition of Done

Toàn bộ dự án được coi là hoàn chỉnh khi:

**Functionality:**
- [ ] Tất cả 14 game playable, zero crashes
- [ ] SharedPreferences persist qua app restart (test: force close → reopen → best score còn đó)
- [ ] Hub lưới hiển thị đẹp trên màn hình 360dp → 430dp width

**Performance:**
- [ ] `flutter run --profile` trên Android: không có frame > 16ms trong gameplay thông thường
- [ ] Memory: không có memory leak (Timer không bị cancel là nguồn phổ biến nhất)
- [ ] App size: `flutter build apk --split-per-abi` < 25MB per ABI

**Code:**
- [ ] `flutter analyze lib/` — zero issues toàn project
- [ ] Không có unused imports
- [ ] Không có dead code

**Build:**
- [ ] `flutter build apk --release` thành công
- [ ] App chạy được trên Android API 21+ (minSdk)

---

## Tiến độ tổng hợp

| Phase | Nội dung | Status |
|-------|----------|--------|
| 0 — Foundation | 2048 + Hub | ✅ Done |
| 1 — Quick Wins | Simon, Tic-Tac-Toe, Whack-a-Mole | ✅ Done |
| 2 — Pure Logic | Memory, Minesweeper, Sliding, Mastermind | ✅ Done |
| 3 — Timer Loop | Snake | ✅ Done |
| 4 — Physics | Flappy, Brick Breaker | ✅ Done |
| 5 — Complex | Tetris, Wordle | ✅ Done |
| 6 — Expert | Sudoku | ✅ Done |
| 7 — Polish | All (basic) | ⬜ Pending |
| **8 — Ninja Fruit** | **Game mới #15** | **⬜ Planned** |
| **9A — TTT Enhance** | **Board size 3×3/4×4/5×5** | **⬜ Planned** |
| **9B — Mastermind+** | **Hard mode, hints, stats, timer, 2P** | **⬜ Planned** |
| **9C — Wordle+** | **EN/VI, 5–7 ký tự, Daily, animations** | **⬜ Planned** |
| **9D — BrickBreaker+** | **20 levels, power-ups, level select** | **⬜ Planned** |

### Tóm tắt scope hiện tại

| Hạng mục | Files | Lines ước tính |
|----------|-------|----------------|
| Game 15 Ninja Fruit | 1 file mới | ~400 |
| Brick Breaker Enhanced | 3 files (sửa + 2 mới) | +350 |
| Tic-Tac-Toe Enhanced | 1 file sửa | +100 |
| Mastermind Enhanced | 1 file sửa | +180 |
| Wordle Enhanced | 3 files (sửa + 2 mới) | +250 |

**Tổng hiện tại:** 14 game Done ✅ | 1 game Planned 🆕 | 4 game đang Enhance 🔧
`flutter analyze lib/` — zero issues | Sẵn sàng `flutter run`
