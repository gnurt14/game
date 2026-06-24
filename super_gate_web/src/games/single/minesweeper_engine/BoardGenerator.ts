import { Board, CellState } from './types';

/**
 * BoardGenerator is responsible for:
 *  - Constructing an empty `Board` (no mines, no reveals).
 *  - Computing `nearbyMineCount` for every cell after mines have been placed.
 *
 * Pure utility — no game state, no side effects beyond the board it receives.
 */
export class BoardGenerator {
  /** Create a fresh `rows × cols` board with all cells in default state. */
  static createEmpty(rows: number, cols: number): Board {
    const board: Board = [];
    for (let r = 0; r < rows; r++) {
      const row: CellState[] = [];
      for (let c = 0; c < cols; c++) {
        row.push({
          row: r,
          col: c,
          isMine: false,
          isRevealed: false,
          isFlagged: false,
          nearbyMineCount: 0,
        });
      }
      board.push(row);
    }
    return board;
  }

  /**
   * For every non-mine cell, count adjacent mines (8-directional) and store
   * in `nearbyMineCount`. Mine cells keep nearbyMineCount=0 (irrelevant).
   * Must be called after mines have been placed.
   */
  static computeAdjacency(board: Board): void {
    const rows = board.length;
    if (rows === 0) return;
    const cols = board[0].length;

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (board[r][c].isMine) continue;
        let count = 0;
        for (let dr = -1; dr <= 1; dr++) {
          for (let dc = -1; dc <= 1; dc++) {
            if (dr === 0 && dc === 0) continue;
            const nr = r + dr;
            const nc = c + dc;
            if (nr >= 0 && nr < rows && nc >= 0 && nc < cols && board[nr][nc].isMine) {
              count++;
            }
          }
        }
        board[r][c].nearbyMineCount = count;
      }
    }
  }

  /** Return the 8 in-bounds neighbours of a cell. */
  static getNeighbors(board: Board, row: number, col: number): CellState[] {
    const rows = board.length;
    if (rows === 0) return [];
    const cols = board[0].length;
    const out: CellState[] = [];
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        if (dr === 0 && dc === 0) continue;
        const nr = row + dr;
        const nc = col + dc;
        if (nr >= 0 && nr < rows && nc >= 0 && nc < cols) out.push(board[nr][nc]);
      }
    }
    return out;
  }
}
