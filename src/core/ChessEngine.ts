import { Chess, Move } from 'chess.js';
import { PieceColor, PieceType, Position, BoardSquare, MoveResult } from './types';

/**
 * ChessEngine - A wrapper around chess.js providing a clean API for the Battle Chess game.
 * Handles all chess logic including move validation, game state, and board representation.
 */
export class ChessEngine {
  private chess: Chess;

  constructor(fen?: string) {
    this.chess = fen ? new Chess(fen) : new Chess();
  }

  /**
   * Get the current player's color
   */
  getCurrentPlayer(): PieceColor {
    return this.chess.turn();
  }

  /**
   * Check if the game is over (checkmate, stalemate, draw)
   */
  isGameOver(): boolean {
    return this.chess.isGameOver();
  }

  /**
   * Check if the current player is in check
   */
  isInCheck(): boolean {
    return this.chess.inCheck();
  }

  /**
   * Check if the current player is in checkmate
   */
  isCheckmate(): boolean {
    return this.chess.isCheckmate();
  }

  /**
   * Check if the game is in stalemate
   */
  isStalemate(): boolean {
    return this.chess.isStalemate();
  }

  /**
   * Check if the game is a draw
   */
  isDraw(): boolean {
    return this.chess.isDraw();
  }

  /**
   * Get all valid moves from the current position
   * Returns moves in SAN notation (e.g., 'e4', 'Nf3')
   */
  getValidMoves(): string[] {
    return this.chess.moves();
  }

  /**
   * Get valid moves for a specific square
   * Returns destination squares in algebraic notation
   */
  getMovesForSquare(square: string): string[] {
    const moves = this.chess.moves({ square: square as any, verbose: true });
    return moves.map((move: Move) => move.to);
  }

  /**
   * Make a move from one square to another
   * @param from - Source square (e.g., 'e2')
   * @param to - Destination square (e.g., 'e4')
   * @param promotion - Promotion piece type (for pawn promotion)
   * @returns MoveResult if valid, null if invalid
   */
  makeMove(from: string, to: string, promotion?: PieceType): MoveResult | null {
    try {
      const moveOptions: { from: string; to: string; promotion?: string } = { from, to };
      if (promotion) {
        moveOptions.promotion = promotion;
      }

      const result = this.chess.move(moveOptions);
      if (!result) {
        return null;
      }

      return {
        from: this.squareToPosition(result.from),
        to: this.squareToPosition(result.to),
        piece: result.piece as PieceType,
        captured: result.captured as PieceType | undefined,
        promotion: result.promotion as PieceType | undefined,
        isCheck: this.isInCheck(),
        isCheckmate: this.isCheckmate(),
        isStalemate: this.isStalemate(),
      };
    } catch {
      return null;
    }
  }

  /**
   * Get the current board state as a 2D array
   * Index [0][0] is a1 (white's queen-side rook)
   * Index [7][7] is h8 (black's king-side rook)
   */
  getBoardState(): (BoardSquare | null)[][] {
    const board = this.chess.board();
    const result: (BoardSquare | null)[][] = [];

    // chess.js board() returns [a8...h8] to [a1...h1] (rank 8 to rank 1)
    // We want [a1...h1] to [a8...h8] (rank 1 to rank 8)
    for (let rank = 7; rank >= 0; rank--) {
      const row: (BoardSquare | null)[] = [];
      for (let file = 0; file < 8; file++) {
        const piece = board[rank][file];
        if (piece) {
          row.push({
            type: piece.type as PieceType,
            color: piece.color as PieceColor,
          });
        } else {
          row.push(null);
        }
      }
      result.push(row);
    }

    return result;
  }

  /**
   * Load a position from FEN notation
   * @returns true if successful, false if invalid FEN
   */
  loadFEN(fen: string): boolean {
    try {
      this.chess.load(fen);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get the current position as FEN notation
   */
  getFEN(): string {
    return this.chess.fen();
  }

  /**
   * Reset the board to the starting position
   */
  reset(): void {
    this.chess.reset();
  }

  /**
   * Undo the last move
   * @returns true if a move was undone, false if no moves to undo
   */
  undo(): boolean {
    const result = this.chess.undo();
    return result !== null;
  }

  /**
   * Convert algebraic notation square to Position
   * @param square - Square in algebraic notation (e.g., 'e4')
   */
  squareToPosition(square: string): Position {
    const file = square.charCodeAt(0) - 'a'.charCodeAt(0);
    const rank = parseInt(square[1], 10) - 1;
    return { file, rank };
  }

  /**
   * Convert Position to algebraic notation square
   */
  positionToSquare(pos: Position): string {
    const file = String.fromCharCode('a'.charCodeAt(0) + pos.file);
    const rank = (pos.rank + 1).toString();
    return file + rank;
  }
}
