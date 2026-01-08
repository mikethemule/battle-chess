import * as THREE from 'three';
import { ChessEngine } from './ChessEngine';
import { PieceRenderer } from '../graphics/PieceRenderer';
import { InputController } from '../graphics/InputController';
import { BattleManager } from '../battle/BattleManager';
import type { ChessAI } from '../ai/StockfishWorker';
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

  // Battle manager for capture animations
  private battleManager: BattleManager | null = null;
  private isProcessingMove = false;

  // AI opponent
  private ai: ChessAI | null = null;
  private aiThinking = false;

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
   * Set the battle manager for capture animations
   */
  setBattleManager(battleManager: BattleManager): void {
    this.battleManager = battleManager;
  }

  /**
   * Initialize the AI opponent (for AI mode)
   * Loads Stockfish or falls back to SimpleAI
   */
  async initializeAI(): Promise<void> {
    if (this.config.mode !== 'ai') return;

    try {
      // Dynamically import AI to avoid loading when not needed
      const { createChessAI } = await import('../ai/StockfishWorker');
      this.ai = await createChessAI();

      // Set difficulty if specified
      if (this.config.aiDifficulty) {
        this.ai.setDifficulty(this.config.aiDifficulty);
      }

      console.log('AI opponent initialized');

      // If AI plays first (player chose black), make AI move
      if (this.config.playerColor === 'b') {
        // Small delay so the board is rendered first
        setTimeout(() => this.makeAIMove(), 500);
      }
    } catch (error) {
      console.error('Failed to initialize AI:', error);
    }
  }

  /**
   * Make the AI opponent's move
   */
  private async makeAIMove(): Promise<void> {
    if (!this.ai || this.isProcessingMove || this.aiThinking) return;
    if (this.isGameOver()) return;

    // Check if it's the AI's turn
    const currentPlayer = this.engine.getCurrentPlayer();
    const isAITurn = this.config.playerColor
      ? currentPlayer !== this.config.playerColor
      : currentPlayer === 'b'; // Default: AI plays black

    if (!isAITurn) return;

    this.aiThinking = true;

    try {
      const fen = this.engine.getFEN();
      const bestMove = await this.ai.getBestMove(fen);

      // Parse UCI move format (e.g., "e2e4" or "e7e8q" for promotion)
      const from = bestMove.substring(0, 2);
      const to = bestMove.substring(2, 4);
      const promotion = bestMove.length > 4 ? bestMove[4] : undefined;

      const fromPos = this.squareToPosition(from);
      const toPos = this.squareToPosition(to);

      // Execute the move (this will update the board and emit events)
      await this.executeMove(fromPos, toPos, promotion as 'q' | 'r' | 'b' | 'n' | undefined);
    } catch (error) {
      console.error('AI move error:', error);
    } finally {
      this.aiThinking = false;
    }
  }

  /**
   * Check if the AI is currently thinking
   */
  isAIThinking(): boolean {
    return this.aiThinking;
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
    // Ignore clicks while processing a move (battle animation)
    if (this.isProcessingMove) return;

    // Ignore clicks while AI is thinking
    if (this.aiThinking) return;

    // In AI mode, only allow player to move their own pieces on their turn
    if (this.config.mode === 'ai') {
      const currentPlayer = this.engine.getCurrentPlayer();
      const playerColor = this.config.playerColor || 'w';
      if (currentPlayer !== playerColor) {
        return; // Not player's turn
      }
    }

    const clickedPiece = this.pieceRenderer.getPieceAt(position);
    const currentPlayer = this.engine.getCurrentPlayer();

    // If we have a selection and clicked on a valid move target
    if (this.selectedPosition) {
      const targetSquare = this.positionToSquare(position);

      // Check if this is a valid move
      if (this.validMoves.includes(targetSquare)) {
        // Execute move asynchronously (don't await, let it run)
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
   * Now async to support battle animations
   * @param from - Source position
   * @param to - Destination position
   * @param promotionOverride - Optional promotion piece (used by AI moves)
   */
  private async executeMove(
    from: Position,
    to: Position,
    promotionOverride?: 'q' | 'r' | 'b' | 'n'
  ): Promise<void> {
    if (this.isProcessingMove) return;
    this.isProcessingMove = true;

    try {
      const fromSquare = this.positionToSquare(from);
      const toSquare = this.positionToSquare(to);

      // Get piece data before move
      const attackerPiece = this.pieceRenderer.getPieceAt(from);
      const capturedPiece = this.pieceRenderer.getPieceAt(to);

      // Check for pawn promotion (reaching the opposite end)
      let promotion: 'q' | 'r' | 'b' | 'n' | undefined = promotionOverride;
      if (!promotion && attackerPiece && attackerPiece.type === 'p') {
        // White pawn reaching rank 8 (index 7) or black pawn reaching rank 1 (index 0)
        if ((attackerPiece.color === 'w' && to.rank === 7) || (attackerPiece.color === 'b' && to.rank === 0)) {
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

      // Clear selection immediately
      this.clearSelection();

      // If this is a capture, play battle animation FIRST
      if (capturedPiece && attackerPiece && this.battleManager) {
        // Play battle animation
        await this.battleManager.playBattle(
          from,
          to,
          attackerPiece.type,
          attackerPiece.color
        );

        // Remove the captured piece after animation
        this.pieceRenderer.removePiece(to);

        // Emit capture event
        this.emit({
          type: 'capture',
          data: result,
          player: attackerPiece.color,
        });
      } else if (result.captured && !capturedPiece) {
        // En passant - captured piece is not at destination
        // Battle animation for en passant handled separately
        this.emit({
          type: 'capture',
          data: result,
          player: attackerPiece?.color,
        });
      }

      // Handle castling - move the rook too (with animation)
      await this.handleCastling(from, to, attackerPiece?.color);

      // Handle en passant capture (with battle animation)
      await this.handleEnPassant(from, to, result, attackerPiece?.color);

      // Move the piece visually with walking animation
      await this.pieceRenderer.animateMovePiece(from, to);

      // Handle promotion visually
      if (result.promotion && attackerPiece) {
        // Remove the pawn and add the promoted piece
        this.pieceRenderer.removePiece(to);
        await this.pieceRenderer.addPiece(result.promotion, attackerPiece.color, to);
      }

      // Emit move event
      this.emit({
        type: 'move',
        data: result,
        player: attackerPiece?.color,
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
          player: attackerPiece?.color,
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

      // Trigger AI move if it's AI's turn (in AI mode)
      if (this.config.mode === 'ai' && this.ai) {
        const newCurrentPlayer = this.engine.getCurrentPlayer();
        const playerColor = this.config.playerColor || 'w';
        if (newCurrentPlayer !== playerColor) {
          // AI's turn - make move after a small delay for visual feedback
          setTimeout(() => this.makeAIMove(), 500);
        }
      }
    } finally {
      this.isProcessingMove = false;
    }
  }

  /**
   * Handle castling rook movement (with walking animation)
   */
  private async handleCastling(from: Position, to: Position, color?: PieceColor): Promise<void> {
    if (!color) return;

    // Check if it was castling (king moved 2 squares)
    const isKing = from.file === 4 && (from.rank === 0 || from.rank === 7);
    const kingMoveDistance = Math.abs(to.file - from.file);

    if (isKing && kingMoveDistance === 2) {
      // This was a castling move
      const rank = from.rank;

      if (to.file === 6) {
        // King-side castling: move rook from h to f with animation
        await this.pieceRenderer.animateMovePiece(
          { file: 7, rank },
          { file: 5, rank }
        );
      } else if (to.file === 2) {
        // Queen-side castling: move rook from a to d with animation
        await this.pieceRenderer.animateMovePiece(
          { file: 0, rank },
          { file: 3, rank }
        );
      }
    }
  }

  /**
   * Handle en passant capture (with battle animation)
   */
  private async handleEnPassant(
    from: Position,
    to: Position,
    result: MoveResult,
    color?: PieceColor
  ): Promise<void> {
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
          // Play battle animation for en passant
          if (this.battleManager) {
            await this.battleManager.playBattle(
              from,
              capturedPawnPosition,
              'p',
              color
            );
          }
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
    this.aiThinking = false;
    this.ai?.stop(); // Stop any ongoing AI calculation
    this.engine.reset();
    this.pieceRenderer.setupInitialPosition(this.engine.getBoardState());
    this.emit({
      type: 'turn',
      player: this.engine.getCurrentPlayer(),
    });

    // If AI plays first (player chose black), trigger AI move
    if (this.config.mode === 'ai' && this.ai && this.config.playerColor === 'b') {
      setTimeout(() => this.makeAIMove(), 500);
    }
  }

  /**
   * Undo the last move
   * In AI mode, undoes both the AI's move and the player's last move
   */
  undo(): boolean {
    // Don't allow undo while AI is thinking
    if (this.aiThinking) return false;

    this.clearSelection();

    // In AI mode, undo twice (AI move + player move) to get back to player's turn
    if (this.config.mode === 'ai' && this.ai) {
      const playerColor = this.config.playerColor || 'w';
      const currentPlayer = this.engine.getCurrentPlayer();

      // If it's currently player's turn, undo both moves
      if (currentPlayer === playerColor) {
        const success1 = this.engine.undo(); // Undo AI move
        if (success1) {
          this.engine.undo(); // Undo player move (ignore result, might be first move)
        }
      } else {
        // If it's AI's turn, just undo the last player move
        this.engine.undo();
      }
    } else {
      // Local mode: just undo one move
      const success = this.engine.undo();
      if (!success) return false;
    }

    // Refresh the visual board state
    this.pieceRenderer.setupInitialPosition(this.engine.getBoardState());
    this.emit({
      type: 'turn',
      player: this.engine.getCurrentPlayer(),
    });
    return true;
  }

  /**
   * Get the game configuration
   */
  getConfig(): GameConfig {
    return { ...this.config };
  }

  /**
   * Set the AI difficulty level
   * @param difficulty - The difficulty level to set
   */
  setAIDifficulty(difficulty: import('./types').Difficulty): void {
    this.config.aiDifficulty = difficulty;
    if (this.ai) {
      this.ai.setDifficulty(difficulty);
    }
  }

  /**
   * Dispose of resources (call when game is destroyed)
   */
  dispose(): void {
    this.clearSelection();
    this.ai?.dispose();
    this.ai = null;
    this.aiThinking = false;
  }
}
