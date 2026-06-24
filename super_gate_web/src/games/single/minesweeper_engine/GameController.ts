import { BoardGenerator } from './BoardGenerator';
import { MinePlacer } from './MinePlacer';
import { FloodFillService } from './FloodFillService';
import {
  Board,
  CellState,
  DifficultyConfig,
  GameSnapshot,
  GameStateId,
} from './types';

/**
 * GameController — the single source of truth for a Minesweeper game.
 *
 * State machine:
 *
 *     INIT ──(ctor)──▶ READY ──(first reveal)──▶ PLAYING ──┬──▶ WIN
 *       ▲                                                  └──▶ LOSE
 *       │                                                       │
 *       └────────────────── restart() ◀─────────────────────────┘
 *
 *  - INIT  : transient — only used during construction.
 *  - READY : board generated, no mines placed yet. First click decides safe area.
 *  - PLAYING: mines placed, timer running, accepting reveal/flag/chord.
 *  - WIN / LOSE: terminal until restart().
 *
 * Subscribe via {@link subscribe} to react to state changes; the controller
 * pushes a fresh `GameSnapshot` after every mutation that matters to the UI.
 */
export class GameController {
  private difficulty: DifficultyConfig;
  private board: Board;
  private state: GameStateId = 'INIT';
  private flagCount = 0;
  private revealedCount = 0;
  private startedAt: number | null = null;
  private finishedAt: number | null = null;
  private listeners: Array<(snap: GameSnapshot) => void> = [];

  constructor(difficulty: DifficultyConfig) {
    this.difficulty = difficulty;
    this.board = BoardGenerator.createEmpty(difficulty.rows, difficulty.cols);
    this.state = 'READY';
  }

  // ── Public read API ─────────────────────────────────────────────────────

  getSnapshot(): GameSnapshot {
    return {
      board: this.board,
      state: this.state,
      difficulty: this.difficulty,
      flagCount: this.flagCount,
      revealedCount: this.revealedCount,
      startedAt: this.startedAt,
      finishedAt: this.finishedAt,
    };
  }

  subscribe(fn: (snap: GameSnapshot) => void): () => void {
    this.listeners.push(fn);
    fn(this.getSnapshot()); // emit current state immediately
    return () => {
      this.listeners = this.listeners.filter((l) => l !== fn);
    };
  }

  // ── Public mutations ────────────────────────────────────────────────────

  /** Tear down and reinitialise with the same (or a new) difficulty. */
  restart(nextDifficulty?: DifficultyConfig): void {
    this.difficulty = nextDifficulty ?? this.difficulty;
    this.board = BoardGenerator.createEmpty(this.difficulty.rows, this.difficulty.cols);
    this.state = 'READY';
    this.flagCount = 0;
    this.revealedCount = 0;
    this.startedAt = null;
    this.finishedAt = null;
    this.notify();
  }

  /** Left-click. */
  revealCell(row: number, col: number): void {
    if (!this.isInteractive()) return;
    const cell = this.board[row]?.[col];
    if (!cell || cell.isFlagged) return;

    // If user left-clicks a *revealed* numbered cell, trigger chord.
    if (cell.isRevealed) {
      this.chordReveal(row, col);
      return;
    }

    // First-click: place mines while excluding the clicked cell + its 8 neighbours,
    // then start the timer.
    if (this.state === 'READY') {
      MinePlacer.placeMines(this.board, this.difficulty.mineCount, row, col);
      BoardGenerator.computeAdjacency(this.board);
      this.state = 'PLAYING';
      this.startedAt = Date.now();
    }

    if (cell.isMine) {
      this.endGame('LOSE', { explodedRow: row, explodedCol: col });
      return;
    }

    const revealed = FloodFillService.revealConnected(this.board, row, col);
    this.revealedCount += revealed.length;
    this.checkWin();
    this.notify();
  }

  /** Right-click. */
  toggleFlag(row: number, col: number): void {
    if (!this.isInteractive()) return;
    const cell = this.board[row]?.[col];
    if (!cell || cell.isRevealed) return;

    // Hard cap: cannot place more flags than total mines (matches MS convention).
    if (!cell.isFlagged && this.flagCount >= this.difficulty.mineCount) return;

    cell.isFlagged = !cell.isFlagged;
    this.flagCount += cell.isFlagged ? 1 : -1;
    this.notify();
  }

  /**
   * Chord-click. If `(row,col)` is a revealed numbered cell and the count of
   * flagged neighbours equals its `nearbyMineCount`, reveal every other neighbour.
   * If a flag is wrong → the mistakenly-unflagged neighbour explodes (classic MS).
   */
  chordReveal(row: number, col: number): void {
    if (this.state !== 'PLAYING') return;
    const cell = this.board[row]?.[col];
    if (!cell || !cell.isRevealed || cell.isMine || cell.nearbyMineCount === 0) return;

    const neighbors = BoardGenerator.getNeighbors(this.board, row, col);
    const flagged = neighbors.filter((n) => n.isFlagged).length;
    if (flagged !== cell.nearbyMineCount) return;

    for (const n of neighbors) {
      if (n.isFlagged || n.isRevealed) continue;
      if (n.isMine) {
        this.endGame('LOSE', { explodedRow: n.row, explodedCol: n.col });
        return;
      }
      const revealed = FloodFillService.revealConnected(this.board, n.row, n.col);
      this.revealedCount += revealed.length;
    }
    this.checkWin();
    this.notify();
  }

  /**
   * Externally reveal a known-safe cell (used by the in-game Hint feature).
   * Bypasses the mine check because the caller guarantees `(row,col)` isn't a mine.
   */
  forceReveal(row: number, col: number): void {
    if (!this.isInteractive()) return;
    const cell = this.board[row]?.[col];
    if (!cell || cell.isRevealed) return;
    if (cell.isMine) return; // safety net — refuse to detonate via hint
    if (cell.isFlagged) {
      cell.isFlagged = false;
      this.flagCount = Math.max(0, this.flagCount - 1);
    }
    const revealed = FloodFillService.revealConnected(this.board, row, col);
    this.revealedCount += revealed.length;
    this.checkWin();
    this.notify();
  }

  /** Return all unrevealed non-mine non-flagged cells — useful for "Hint". */
  getSafeUnrevealedCells(): CellState[] {
    const out: CellState[] = [];
    for (const row of this.board) {
      for (const cell of row) {
        if (!cell.isMine && !cell.isRevealed && !cell.isFlagged) out.push(cell);
      }
    }
    return out;
  }

  // ── Internals ───────────────────────────────────────────────────────────

  private isInteractive(): boolean {
    return this.state === 'READY' || this.state === 'PLAYING';
  }

  private endGame(result: 'WIN' | 'LOSE', _extra?: unknown): void {
    if (result === 'LOSE') {
      // Reveal all mines so the player sees the entire board.
      for (const row of this.board) {
        for (const cell of row) if (cell.isMine) cell.isRevealed = true;
      }
    } else {
      // On WIN, auto-flag any remaining mines (visual consistency).
      for (const row of this.board) {
        for (const cell of row) {
          if (cell.isMine && !cell.isFlagged) {
            cell.isFlagged = true;
            this.flagCount++;
          }
        }
      }
    }
    this.state = result;
    this.finishedAt = Date.now();
    this.notify();
  }

  private checkWin(): void {
    const total = this.difficulty.rows * this.difficulty.cols;
    const safeTotal = total - this.difficulty.mineCount;
    if (this.revealedCount >= safeTotal) this.endGame('WIN');
  }

  private notify(): void {
    const snap = this.getSnapshot();
    for (const fn of this.listeners) fn(snap);
  }
}
