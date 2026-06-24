// Core types for Minesweeper engine. UI-agnostic.

export interface CellState {
  readonly row: number;
  readonly col: number;
  isMine: boolean;
  isRevealed: boolean;
  isFlagged: boolean;
  nearbyMineCount: number;
}

export type Board = CellState[][];

export type GameStateId = 'INIT' | 'READY' | 'PLAYING' | 'WIN' | 'LOSE';

export type DifficultyId = 'easy' | 'medium' | 'hard';

export interface DifficultyConfig {
  id: DifficultyId;
  rows: number;
  cols: number;
  mineCount: number;
}

export const DIFFICULTIES: Record<DifficultyId, DifficultyConfig> = {
  easy:   { id: 'easy',   rows: 9,  cols: 9,  mineCount: 10 },
  medium: { id: 'medium', rows: 16, cols: 16, mineCount: 40 },
  hard:   { id: 'hard',   rows: 16, cols: 30, mineCount: 99 },
};

export interface GameSnapshot {
  board: Board;
  state: GameStateId;
  difficulty: DifficultyConfig;
  flagCount: number;
  revealedCount: number;
  /** ms epoch — null until first reveal */
  startedAt: number | null;
  /** ms epoch — null until WIN/LOSE */
  finishedAt: number | null;
}
