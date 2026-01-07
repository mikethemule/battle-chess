import { describe, it, expect } from 'vitest';
import { ChessEngine } from '../ChessEngine';

describe('ChessEngine', () => {
  it('should initialize with standard starting position', () => {
    const engine = new ChessEngine();
    expect(engine.getCurrentPlayer()).toBe('w');
    expect(engine.isGameOver()).toBe(false);
  });

  it('should return valid moves for starting position', () => {
    const engine = new ChessEngine();
    const moves = engine.getValidMoves();
    expect(moves.length).toBe(20);
  });

  it('should make a valid move', () => {
    const engine = new ChessEngine();
    const result = engine.makeMove('e2', 'e4');
    expect(result).not.toBeNull();
    expect(result?.from).toEqual({ file: 4, rank: 1 });
    expect(result?.to).toEqual({ file: 4, rank: 3 });
    expect(engine.getCurrentPlayer()).toBe('b');
  });

  it('should reject invalid move', () => {
    const engine = new ChessEngine();
    const result = engine.makeMove('e2', 'e5');
    expect(result).toBeNull();
  });

  it('should detect check', () => {
    const engine = new ChessEngine();
    engine.loadFEN('rnb1kbnr/pppp1ppp/8/4p3/5PPq/8/PPPPP2P/RNBQKBNR w KQkq - 1 3');
    expect(engine.isInCheck()).toBe(true);
  });

  it('should detect checkmate', () => {
    const engine = new ChessEngine();
    engine.loadFEN('rnb1kbnr/pppp1ppp/8/4p3/5PPq/8/PPPPP2P/RNBQKBNR w KQkq - 1 3');
    expect(engine.isCheckmate()).toBe(true);
    expect(engine.isGameOver()).toBe(true);
  });

  it('should return board state as 2D array', () => {
    const engine = new ChessEngine();
    const board = engine.getBoardState();
    expect(board.length).toBe(8);
    expect(board[0].length).toBe(8);
    expect(board[0][0]).toEqual({ type: 'r', color: 'w' });
    expect(board[7][4]).toEqual({ type: 'k', color: 'b' });
  });

  it('should get valid moves for specific square', () => {
    const engine = new ChessEngine();
    const moves = engine.getMovesForSquare('e2');
    expect(moves).toContain('e3');
    expect(moves).toContain('e4');
    expect(moves.length).toBe(2);
  });
});
