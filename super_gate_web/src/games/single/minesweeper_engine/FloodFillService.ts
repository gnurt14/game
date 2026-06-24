import { Board, CellState } from './types';

/**
 * Flood-fill reveal — BFS from a starting cell.
 *
 * Rules (classic Minesweeper):
 *  - Skip cells that are already revealed, flagged, or a mine.
 *  - Reveal the cell.
 *  - If the cell has `nearbyMineCount === 0` (a true "empty" cell), enqueue
 *    all 8 neighbours. Otherwise stop spreading from this cell — numbered
 *    cells are revealed as the *frontier* of the empty region.
 *
 * Returns the list of cells actually revealed by this call so the caller
 * can update counters without re-scanning the board.
 *
 * BFS (queue) is used instead of recursion to avoid stack overflows on the
 * Hard board (30×16 = 480 cells, worst case a single empty connected region).
 */
export class FloodFillService {
  static revealConnected(board: Board, startRow: number, startCol: number): CellState[] {
    const rows = board.length;
    if (rows === 0) return [];
    const cols = board[0].length;

    const start = board[startRow]?.[startCol];
    if (!start || start.isRevealed || start.isFlagged || start.isMine) return [];

    const revealed: CellState[] = [];
    const queue: [number, number][] = [[startRow, startCol]];
    const visited = new Set<string>();

    while (queue.length > 0) {
      const [r, c] = queue.shift()!;
      const key = `${r},${c}`;
      if (visited.has(key)) continue;
      visited.add(key);

      const cell = board[r][c];
      // Re-check inside the loop: a neighbour might have been flagged/revealed
      // by an earlier iteration (paranoid, but cheap).
      if (cell.isRevealed || cell.isFlagged || cell.isMine) continue;

      cell.isRevealed = true;
      revealed.push(cell);

      // Numbered cell → reveal but don't spread.
      if (cell.nearbyMineCount > 0) continue;

      // Empty cell → enqueue 8 neighbours.
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          if (dr === 0 && dc === 0) continue;
          const nr = r + dr;
          const nc = c + dc;
          if (nr >= 0 && nr < rows && nc >= 0 && nc < cols) {
            queue.push([nr, nc]);
          }
        }
      }
    }
    return revealed;
  }
}
