import * as THREE from 'three';
import { ChessEngine } from './ChessEngine';
import { PieceRenderer } from '../graphics/PieceRenderer';
import { InputController } from '../graphics/InputController';
import type { Position, GameConfig, PieceColor, MoveResult } from './types';

/**
 * Game event types emitted during gameplay
 */
export interface GameEvent {
  type: 'move' | 'capture' | 'check' | 'checkmate' | 'stalemate' | 'turn' | 'select' | 'deselect';
  data?: MoveResult;
  player?: PieceColor;
  position?: Position;
}

type GameEventCallback = (event: GameEvent) => void;

/**
 * GameState - Manages the game logic, piece selection, and move execution
 * Bridges between the chess engine, visual rendering, and user input
 */
export class GameState {
  private engine: ChessEngine;
  private pieceRenderer: PieceRenderer;
  private inputController: InputController;
  private boardGroup: THREE.Group;
  private config: GameConfig;

  // Selection state
  private selectedPosition: Position | null = null;
  private validMoves: string[] = [];

  // Event callbacks
  private eventCallbacks: GameEventCallback[] = [];

  constructor(
    engine: ChessEngine,
    pieceRenderer: PieceRenderer,
    inputController: InputController,
    boardGroup: THREE.Group,
    config: GameConfig
  ) {
    this.engine = engine;
    this.pieceRenderer = pieceRenderer;
    this.inputController = inputController;
    this.boardGroup = boardGroup;
    this.config = config;

    // Set up input handling
    this.inputController.setOnSquareClick(this.handleSquareClick.bind(this));

    // Emit initial turn event
    this.emit({
      type: 'turn',
      player: this.engine.getCurrentPlayer(),
    });
  }

  /**
   * Register an event callback
   */
  onEvent(callback: GameEventCallback): void {
    this.eventCallbacks.push(callback);
  }

  /**
   * Remove an event callback
   */
  offEvent(callback: GameEventCallback): void {
    const index = this.eventCallbacks.indexOf(callback);
    if (index > -1) {
      this.eventCallbacks.splice(index, 1);
    }
  }

  /**
   * Emit a game event to all registered callbacks
   */
  private emit(event: GameEvent): void {
    this.eventCallbacks.forEach((callback) => {
      try {
        callback(event);
      } catch (error) {
        console.error('Error in game event callback:', error);
      }
    });
  }

  /**
   * Handle a click on a square or piece
   */
  private handleSquareClick(position: Position): void {
    const clickedPiece = this.pieceRenderer.getPieceAt(position);
    const currentPlayer = this.engine.getCurrentPlayer();

    // If we have a selection and clicked on a valid move target
    if (this.selectedPosition) {
      const targetSquare = this.positionToSquare(position);

      // Check if this is a valid move
      if (this.validMoves.includes(targetSquare)) {
        this.executeMove(this.selectedPosition, position);
        return;
      }

      // If clicking on own piece, select it instead
      if (clickedPiece && clickedPiece.color === currentPlayer) {
        this.selectPiece(position);
        return;
      }

      // Otherwise, clear selection
      this.clearSelection();
      return;
    }

    // No selection yet - try to select a piece
    if (clickedPiece) {
      // Only allow selecting own pieces
      if (clickedPiece.color === currentPlayer) {
        this.selectPiece(position);
      }
    }
  }

  /**
   * Select a piece and show its valid moves
   */
  private selectPiece(position: Position): void {
    // Clear any existing selection
    this.clearSelection();

    const piece = this.pieceRenderer.getPieceAt(position);
    if (!piece) {
      return;
    }

    // Store selection
    this.selectedPosition = { ...position };

    // Get valid moves from engine
    const square = this.positionToSquare(position);
    const moves = this.engine.getMovesForSquare(square);
    this.validMoves = moves;

    // Convert move squares to positions and show indicators
    const validPositions = moves.map((move) => this.squareToPosition(move));
    this.inputController.showValidMoves(validPositions, this.boardGroup);
    this.inputController.showSelection(position, this.boardGroup);

    // Emit selection event
    this.emit({
      type: 'select',
      position: position,
      player: piece.color,
    });
  }

  /**
   * Clear the current selection
   */
  private clearSelection(): void {
    if (this.selectedPosition) {
      this.emit({
        type: 'deselect',
        position: this.selectedPosition,
      });
    }

    this.selectedPosition = null;
    this.validMoves = [];
    this.inputController.clearValidMoves();
    this.inputController.clearSelection();
  }

  /**
   * Execute a move from one position to another
   */
  private executeMove(from: Position, to: Position): void {
    const fromSquare = this.positionToSquare(from);
    const toSquare = this.positionToSquare(to);

    // Check for pawn promotion (reaching the opposite end)
    const piece = this.pieceRenderer.getPieceAt(from);
    let promotion: 'q' | undefined;
    if (piece && piece.type === 'p') {
      // White pawn reaching rank 8 (index 7) or black pawn reaching rank 1 (index 0)
      if ((piece.color === 'w' && to.rank === 7) || (piece.color === 'b' && to.rank === 0)) {
        // Default to queen promotion for now
        promotion = 'q';
      }
    }

    // Make the move on the engine
    const result = this.engine.makeMove(fromSquare, toSquare, promotion);

    if (!result) {
      console.error('Invalid move:', fromSquare, '->', toSquare);
      this.clearSelection();
      return;
    }

    // Handle capture visually (remove the captured piece)
    if (result.captured) {
      // The piece at destination will be removed by movePiece
      this.emit({
        type: 'capture',
        data: result,
        player: piece?.color,
      });
    }

    // Handle castling - move the rook too
    this.handleCastling(from, to, piece?.color);

    // Handle en passant capture
    this.handleEnPassant(from, to, result, piece?.color);

    // Move the piece visually
    this.pieceRenderer.movePiece(from, to);

    // Handle promotion visually
    if (result.promotion && piece) {
      // Remove the pawn and add the promoted piece
      this.pieceRenderer.removePiece(to);
      this.pieceRenderer.addPiece(result.promotion, piece.color, to);
    }

    // Clear selection
    this.clearSelection();

    // Emit move event
    this.emit({
      type: 'move',
      data: result,
      player: piece?.color,
    });

    // Check for check
    if (result.isCheck && !result.isCheckmate) {
      this.emit({
        type: 'check',
        data: result,
        player: this.engine.getCurrentPlayer(),
      });
    }

    // Check for checkmate
    if (result.isCheckmate) {
      this.emit({
        type: 'checkmate',
        data: result,
        player: piece?.color,
      });
      return;
    }

    // Check for stalemate
    if (result.isStalemate) {
      this.emit({
        type: 'stalemate',
        data: result,
      });
      return;
    }

    // Emit turn change
    this.emit({
      type: 'turn',
      player: this.engine.getCurrentPlayer(),
    });
  }

  /**
   * Handle castling rook movement
   */
  private handleCastling(from: Position, to: Position, color?: PieceColor): void {
    if (!color) return;

    // Check if it was castling (king moved 2 squares)
    const isKing = from.file === 4 && (from.rank === 0 || from.rank === 7);
    const kingMoveDistance = Math.abs(to.file - from.file);

    if (isKing && kingMoveDistance === 2) {
      // This was a castling move
      const rank = from.rank;

      if (to.file === 6) {
        // King-side castling: move rook from h to f
        this.pieceRenderer.movePiece(
          { file: 7, rank },
          { file: 5, rank }
        );
      } else if (to.file === 2) {
        // Queen-side castling: move rook from a to d
        this.pieceRenderer.movePiece(
          { file: 0, rank },
          { file: 3, rank }
        );
      }
    }
  }

  /**
   * Handle en passant capture
   */
  private handleEnPassant(
    from: Position,
    to: Position,
    result: MoveResult,
    color?: PieceColor
  ): void {
    if (!color) return;

    // En passant: pawn captures diagonally but destination was empty
    // This means the captured pawn is on a different square
    if (result.piece === 'p' && result.captured === 'p') {
      const fileDiff = Math.abs(to.file - from.file);
      const rankDiff = Math.abs(to.rank - from.rank);

      // Diagonal pawn move (capture)
      if (fileDiff === 1 && rankDiff === 1) {
        // Check if there's still a piece at the captured position
        // (en passant captures the pawn on the adjacent file, same rank as the moving pawn started)
        const capturedPawnPosition: Position = {
          file: to.file,
          rank: from.rank,
        };

        const capturedPiece = this.pieceRenderer.getPieceAt(capturedPawnPosition);
        if (capturedPiece && capturedPiece.type === 'p') {
          this.pieceRenderer.removePiece(capturedPawnPosition);
        }
      }
    }
  }

  /**
   * Convert a Position to algebraic notation square
   */
  private positionToSquare(pos: Position): string {
    const file = String.fromCharCode('a'.charCodeAt(0) + pos.file);
    const rank = (pos.rank + 1).toString();
    return file + rank;
  }

  /**
   * Convert algebraic notation square to Position
   */
  private squareToPosition(square: string): Position {
    const file = square.charCodeAt(0) - 'a'.charCodeAt(0);
    const rank = parseInt(square[1], 10) - 1;
    return { file, rank };
  }

  /**
   * Get the current player's color
   */
  getCurrentPlayer(): PieceColor {
    return this.engine.getCurrentPlayer();
  }

  /**
   * Check if the game is over
   */
  isGameOver(): boolean {
    return this.engine.isGameOver();
  }

  /**
   * Check if the current player is in check
   */
  isInCheck(): boolean {
    return this.engine.isInCheck();
  }

  /**
   * Get the current FEN string
   */
  getFEN(): string {
    return this.engine.getFEN();
  }

  /**
   * Reset the game to the starting position
   */
  reset(): void {
    this.clearSelection();
    this.engine.reset();
    this.pieceRenderer.setupInitialPosition(this.engine.getBoardState());
    this.emit({
      type: 'turn',
      player: this.engine.getCurrentPlayer(),
    });
  }

  /**
   * Undo the last move
   */
  undo(): boolean {
    this.clearSelection();
    const success = this.engine.undo();
    if (success) {
      // Refresh the visual board state
      this.pieceRenderer.setupInitialPosition(this.engine.getBoardState());
      this.emit({
        type: 'turn',
        player: this.engine.getCurrentPlayer(),
      });
    }
    return success;
  }

  /**
   * Get the game configuration
   */
  getConfig(): GameConfig {
    return { ...this.config };
  }
}
