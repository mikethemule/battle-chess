import type { Difficulty } from '../core/types';

/**
 * Configuration for different difficulty levels
 */
interface DifficultyConfig {
  depth: number;
  skillLevel: number;
  elo: number | null;
}

/**
 * Difficulty settings map - controls AI strength
 * - depth: How many moves ahead the engine looks
 * - skillLevel: Stockfish's internal skill parameter (0-20)
 * - elo: Target ELO rating (null = maximum strength)
 */
const DIFFICULTY_SETTINGS: Record<Difficulty, DifficultyConfig> = {
  beginner: { depth: 1, skillLevel: 0, elo: 800 },
  easy: { depth: 3, skillLevel: 5, elo: 1200 },
  medium: { depth: 6, skillLevel: 10, elo: 1600 },
  hard: { depth: 10, skillLevel: 15, elo: 2000 },
  master: { depth: 15, skillLevel: 20, elo: null },
};

/**
 * Interface for the AI engine
 */
export interface ChessAI {
  initialize(): Promise<void>;
  setDifficulty(difficulty: Difficulty): void;
  getBestMove(fen: string): Promise<string>;
  stop(): void;
  dispose(): void;
  isInitialized(): boolean;
}

/**
 * StockfishAI - Wrapper for the Stockfish chess engine running in a Web Worker
 * Uses UCI (Universal Chess Interface) protocol to communicate with the engine
 */
export class StockfishAI implements ChessAI {
  private worker: Worker | null = null;
  private isReady = false;
  private difficulty: Difficulty = 'medium';
  private resolveMove: ((move: string) => void) | null = null;

  /**
   * Initialize the Stockfish engine
   * Loads the WASM-based engine in a Web Worker
   */
  async initialize(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        // Load the lite single-threaded version (works without CORS headers)
        // This file should be in public/stockfish/
        this.worker = new Worker('/stockfish/stockfish-17.1-lite-single-03e3232.js');

        this.worker.onmessage = (event) => {
          this.handleMessage(event.data, resolve);
        };

        this.worker.onerror = (error) => {
          console.error('Stockfish worker error:', error);
          reject(new Error('Failed to load Stockfish engine'));
        };

        // Start UCI protocol
        this.worker.postMessage('uci');
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Handle messages from the Stockfish engine
   */
  private handleMessage(message: string, resolveInit?: () => void): void {
    // Handle multi-line messages
    const lines = message.split('\n');

    for (const line of lines) {
      const trimmedLine = line.trim();
      if (!trimmedLine) continue;

      // Engine is ready for UCI commands
      if (trimmedLine === 'uciok') {
        this.setupEngine();
        // Send isready to confirm engine is ready
        this.worker?.postMessage('isready');
      }
      // Engine has finished initialization
      else if (trimmedLine === 'readyok') {
        this.isReady = true;
        if (resolveInit) {
          resolveInit();
        }
      }
      // Best move found
      else if (trimmedLine.startsWith('bestmove')) {
        const parts = trimmedLine.split(' ');
        const move = parts[1];
        if (move && this.resolveMove) {
          this.resolveMove(move);
          this.resolveMove = null;
        }
      }
      // Info lines (for debugging/analysis display)
      else if (trimmedLine.startsWith('info')) {
        // Could emit these for UI display of engine thinking
        // console.log('Stockfish info:', trimmedLine);
      }
    }
  }

  /**
   * Configure the engine based on current difficulty settings
   */
  private setupEngine(): void {
    if (!this.worker) return;

    const config = DIFFICULTY_SETTINGS[this.difficulty];

    // Set skill level (0-20, affects move quality)
    this.worker.postMessage(`setoption name Skill Level value ${config.skillLevel}`);

    // Limit engine strength if ELO is specified
    if (config.elo !== null) {
      this.worker.postMessage('setoption name UCI_LimitStrength value true');
      this.worker.postMessage(`setoption name UCI_Elo value ${config.elo}`);
    } else {
      this.worker.postMessage('setoption name UCI_LimitStrength value false');
    }

    // Set hash table size (small for browser)
    this.worker.postMessage('setoption name Hash value 16');
  }

  /**
   * Set the AI difficulty level
   */
  setDifficulty(difficulty: Difficulty): void {
    this.difficulty = difficulty;
    if (this.isReady && this.worker) {
      this.setupEngine();
      // Wait for engine to process options
      this.worker.postMessage('isready');
    }
  }

  /**
   * Get the best move for the current position
   * @param fen - FEN string representing the current board position
   * @returns UCI move string (e.g., "e2e4", "e7e8q" for promotion)
   */
  async getBestMove(fen: string): Promise<string> {
    if (!this.worker || !this.isReady) {
      throw new Error('Stockfish not initialized');
    }

    return new Promise((resolve) => {
      this.resolveMove = resolve;
      const config = DIFFICULTY_SETTINGS[this.difficulty];

      // Set position
      this.worker!.postMessage(`position fen ${fen}`);

      // Start search with depth limit
      this.worker!.postMessage(`go depth ${config.depth}`);
    });
  }

  /**
   * Stop the current search
   */
  stop(): void {
    if (this.worker) {
      this.worker.postMessage('stop');
    }
  }

  /**
   * Clean up resources
   */
  dispose(): void {
    if (this.worker) {
      this.worker.postMessage('quit');
      this.worker.terminate();
      this.worker = null;
    }
    this.isReady = false;
    this.resolveMove = null;
  }

  /**
   * Check if the engine is initialized and ready
   */
  isInitialized(): boolean {
    return this.isReady;
  }
}

/**
 * SimpleAI - A fallback AI that makes random legal moves
 * Used when Stockfish fails to load or initialize
 */
export class SimpleAI implements ChessAI {
  private difficulty: Difficulty = 'medium';
  private initialized = false;

  async initialize(): Promise<void> {
    // Simple AI doesn't need initialization
    this.initialized = true;
    console.log('SimpleAI initialized (fallback mode)');
  }

  setDifficulty(difficulty: Difficulty): void {
    this.difficulty = difficulty;
  }

  /**
   * Get a random legal move
   * For simplicity, this uses chess.js to get legal moves
   */
  async getBestMove(fen: string): Promise<string> {
    // Dynamically import chess.js to get legal moves
    const { Chess } = await import('chess.js');
    const chess = new Chess(fen);
    const moves = chess.moves({ verbose: true });

    if (moves.length === 0) {
      throw new Error('No legal moves available');
    }

    // Add some basic intelligence based on difficulty
    let selectedMove;

    switch (this.difficulty) {
      case 'beginner':
        // Pure random
        selectedMove = moves[Math.floor(Math.random() * moves.length)];
        break;

      case 'easy':
        // Prefer captures 30% more often
        selectedMove = this.selectWithBias(moves, 0.3);
        break;

      case 'medium':
        // Prefer captures 50% more often
        selectedMove = this.selectWithBias(moves, 0.5);
        break;

      case 'hard':
      case 'master':
        // Prefer captures and checks 70% more often
        selectedMove = this.selectWithBias(moves, 0.7, true);
        break;

      default:
        selectedMove = moves[Math.floor(Math.random() * moves.length)];
    }

    // Return in UCI format: from + to + promotion
    return selectedMove.from + selectedMove.to + (selectedMove.promotion || '');
  }

  /**
   * Select a move with bias towards captures and optionally checks
   */
  private selectWithBias(
    moves: Array<{ from: string; to: string; captured?: string; promotion?: string; san: string }>,
    captureBias: number,
    preferChecks = false
  ): { from: string; to: string; captured?: string; promotion?: string; san: string } {
    // Separate moves into categories
    const captures = moves.filter(m => m.captured);
    const checks = preferChecks ? moves.filter(m => m.san.includes('+')) : [];
    const others = moves.filter(m => !m.captured && (!preferChecks || !m.san.includes('+')));

    // Apply bias
    const random = Math.random();

    if (preferChecks && checks.length > 0 && random < captureBias * 0.5) {
      return checks[Math.floor(Math.random() * checks.length)];
    }

    if (captures.length > 0 && random < captureBias) {
      return captures[Math.floor(Math.random() * captures.length)];
    }

    if (others.length > 0) {
      return others[Math.floor(Math.random() * others.length)];
    }

    // Fallback to any move
    return moves[Math.floor(Math.random() * moves.length)];
  }

  stop(): void {
    // Nothing to stop for simple AI
  }

  dispose(): void {
    this.initialized = false;
  }

  isInitialized(): boolean {
    return this.initialized;
  }
}

/**
 * Create the appropriate AI engine
 * Tries Stockfish first, falls back to SimpleAI if it fails
 */
export async function createChessAI(): Promise<ChessAI> {
  try {
    const stockfish = new StockfishAI();
    await stockfish.initialize();
    console.log('Stockfish AI initialized successfully');
    return stockfish;
  } catch (error) {
    console.warn('Failed to initialize Stockfish, falling back to SimpleAI:', error);
    const simpleAI = new SimpleAI();
    await simpleAI.initialize();
    return simpleAI;
  }
}
