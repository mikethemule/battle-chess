import './style.css';
import { GameScene } from './graphics/Scene';
import { ChessBoard } from './graphics/Board';
import { PieceRenderer } from './graphics/PieceRenderer';
import { InputController } from './graphics/InputController';
import { CameraController } from './graphics/CameraController';
import { TextureManager } from './graphics/TextureManager';
import { ChessEngine } from './core/ChessEngine';
import { GameState } from './core/GameState';
import { BattleManager } from './battle/BattleManager';
import { MainMenu } from './ui/Menu';
import { GameHUD } from './ui/HUD';
import type { GameConfig, PieceColor, PieceType } from './core/types';

// Get the canvas and UI overlay elements
const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
const uiOverlay = document.getElementById('ui-overlay') as HTMLElement;

if (!canvas) {
  throw new Error('Canvas element #game-canvas not found');
}

if (!uiOverlay) {
  throw new Error('UI overlay element #ui-overlay not found');
}

// Create the game scene (always running for background)
const gameScene = new GameScene(canvas);

// Create and add the chess board
const chessBoard = new ChessBoard();
gameScene.add(chessBoard.group);

// Create the chess engine
const chessEngine = new ChessEngine();

// Create piece renderer
const pieceRenderer = new PieceRenderer(chessBoard);
gameScene.add(pieceRenderer.group);

// Create input controller
const inputController = new InputController(
  gameScene.camera,
  chessBoard.group,
  pieceRenderer.group,
  canvas
);

// Create camera controller for battle sequences
const cameraController = new CameraController(
  gameScene.camera,
  gameScene.controls,
  chessBoard
);

// Create battle manager for capture animations
const battleManager = new BattleManager(
  gameScene.scene,
  cameraController,
  pieceRenderer
);

// Create UI components
const mainMenu = new MainMenu(uiOverlay);
const gameHUD = new GameHUD(uiOverlay);

// Game state will be created when the game starts
let gameState: GameState | null = null;

/**
 * Load all game assets (textures, models, etc.)
 * Assets that fail to load will use fallback defaults
 */
async function loadAssets(
  board: ChessBoard,
  pieceRenderer: PieceRenderer,
  scene: GameScene,
  battleManager: BattleManager
): Promise<void> {
  const textureManager = new TextureManager();

  // Load board textures (will fail gracefully if files don't exist)
  try {
    await board.loadTextures(textureManager);
  } catch (e) {
    console.warn('Board textures not loaded, using default materials');
  }

  // Load piece models (will use procedural fallback if files don't exist)
  const animationController = scene.getAnimationController();
  await pieceRenderer.loadModels(animationController);

  // Load particle texture (optional)
  try {
    const particleTexture = await textureManager.loadParticleTexture();
    battleManager.setParticleTexture(particleTexture);
  } catch (e) {
    console.warn('Particle texture not loaded, using default particles');
  }
}

/**
 * Start a new game with the given configuration
 */
async function startGame(config: GameConfig): Promise<void> {
  // Hide menu
  mainMenu.hide();

  // Dispose previous game state if exists
  if (gameState) {
    gameState.dispose();
  }

  // Reset the chess engine
  chessEngine.reset();

  // Set up pieces
  pieceRenderer.setupInitialPosition(chessEngine.getBoardState());

  // Create new game state
  gameState = new GameState(
    chessEngine,
    pieceRenderer,
    inputController,
    chessBoard.group,
    config
  );

  // Connect battle manager
  gameState.setBattleManager(battleManager);

  // Reset and show HUD
  gameHUD.reset();
  gameHUD.show();

  // Set up new game callback
  gameHUD.setOnNewGame(() => {
    gameHUD.hide();
    if (gameState) {
      gameState.dispose();
      gameState = null;
    }
    mainMenu.show();
  });

  // Listen to game events
  gameState.onEvent((event) => {
    console.log('Game event:', event.type, event);

    switch (event.type) {
      case 'turn':
        if (event.player) {
          gameHUD.updateTurn(event.player);
          console.log(`${event.player === 'w' ? 'White' : 'Black'}'s turn`);
        }
        break;
      case 'check':
        gameHUD.updateStatus('Check!');
        console.log(`${event.player === 'w' ? 'White' : 'Black'} is in check!`);
        break;
      case 'checkmate':
        console.log(`Checkmate! ${event.player === 'w' ? 'White' : 'Black'} wins!`);
        gameHUD.showGameOver(
          event.player as PieceColor,
          'Checkmate!'
        );
        break;
      case 'stalemate':
        console.log('Stalemate! The game is a draw.');
        gameHUD.showGameOver('draw', 'Stalemate - No legal moves available');
        break;
      case 'capture':
        if (event.data?.captured && event.player) {
          gameHUD.addCapturedPiece(event.data.captured as PieceType, event.player);
          console.log(`Captured: ${event.data.captured}`);
        }
        // Clear check status after a capture (unless still in check)
        if (gameState && !gameState.isInCheck()) {
          gameHUD.updateStatus('');
        }
        break;
      case 'move':
        // Clear check status after a move (unless still in check)
        if (gameState && !gameState.isInCheck()) {
          gameHUD.updateStatus('');
        }
        break;
    }
  });

  // Initialize AI if in AI mode
  if (config.mode === 'ai') {
    gameHUD.updateStatus('Loading AI...');
    await gameState.initializeAI();
    gameHUD.updateStatus('');
  }

  // Expose game state to window for debugging
  window.gameState = gameState;

  console.log(`Game started: ${config.mode} mode`);
  if (config.mode === 'ai') {
    console.log(`Playing as: ${config.playerColor === 'w' ? 'White' : 'Black'}`);
    console.log(`Difficulty: ${config.aiDifficulty}`);
  }
}

// Set up menu callback
mainMenu.setOnStartGame(startGame);

/**
 * Initialize the game by loading assets and starting the scene
 */
async function initialize(): Promise<void> {
  // Show loading state
  const loadingDiv = document.getElementById('loading');
  if (loadingDiv) {
    loadingDiv.style.display = 'block';
  }

  // Load all game assets
  await loadAssets(chessBoard, pieceRenderer, gameScene, battleManager);

  // Hide loading state
  if (loadingDiv) {
    loadingDiv.style.display = 'none';
  }

  // Show the main menu
  mainMenu.show();

  // Start the animation loop
  gameScene.start();

  // Log success message
  console.log('Battle Chess: Fantasy Edition - Initialized');
}

// Start initialization
initialize().catch((error) => {
  console.error('Failed to initialize game:', error);
});

// Expose to window for debugging
declare global {
  interface Window {
    gameState: GameState | null;
    chessEngine: ChessEngine;
  }
}
window.chessEngine = chessEngine;
