import { Board } from './types';

/**
 * MinePlacer is responsible for choosing which cells become mines.
 *
 * Contract:
 *  - Never place a mine on the first-clicked cell, nor on any of its 8
 *    neighbours. This is the classic "first click safe area" rule that
 *    guarantees the initial reveal opens a non-trivial chunk and prevents
 *    the worst-case "click → boom" frustration.
 *  - Mines are placed uniformly at random across the remaining cells.
 *  - Falls back gracefully when the board is too small to honour the safe
 *    area (rare; only happens on degenerate configs).
 */
export class MinePlacer {
  static placeMines(
    board: Board,
    mineCount: number,
    safeRow: number,
    safeCol: number,
  ): void {
    const rows = board.length;
    if (rows === 0) return;
    const cols = board[0].length;

    // 1) Build the "safe zone" = clicked cell + its 8 neighbours.
    const safeZone = new Set<string>();
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        const r = safeRow + dr;
        const c = safeCol + dc;
        if (r >= 0 && r < rows && c >= 0 && c < cols) safeZone.add(`${r},${c}`);
      }
    }

    // 2) Build the candidate pool — all cells outside the safe zone.
    let candidates: [number, number][] = [];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (!safeZone.has(`${r},${c}`)) candidates.push([r, c]);
      }
    }

    // 3) Degenerate fallback: if not enough candidates outside the safe zone,
    // allow the 8 neighbours of the click as well (but never the click itself).
    if (candidates.length < mineCount) {
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          if (dr === 0 && dc === 0) continue; // protect click cell itself
          const r = safeRow + dr;
          const c = safeCol + dc;
          if (r >= 0 && r < rows && c >= 0 && c < cols) candidates.push([r, c]);
        }
      }
    }

    // 4) Fisher-Yates shuffle, then take the first `mineCount` entries.
    for (let i = candidates.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
    }

    const placeN = Math.min(mineCount, candidates.length);
    for (let k = 0; k < placeN; k++) {
      const [r, c] = candidates[k];
      board[r][c].isMine = true;
    }
  }
}
