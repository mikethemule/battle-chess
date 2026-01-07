import './style.css';
import { GameScene } from './graphics/Scene';
import { ChessBoard } from './graphics/Board';
import { PieceRenderer } from './graphics/PieceRenderer';
import { InputController } from './graphics/InputController';
import { ChessEngine } from './core/ChessEngine';
import { GameState } from './core/GameState';

// Get the canvas element
const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;

if (!canvas) {
  throw new Error('Canvas element #game-canvas not found');
}

// Create the game scene
const gameScene = new GameScene(canvas);

// Create and add the chess board
const chessBoard = new ChessBoard();
gameScene.add(chessBoard.group);

// Create the chess engine
const chessEngine = new ChessEngine();

// Create piece renderer and set up initial position
const pieceRenderer = new PieceRenderer(chessBoard);
pieceRenderer.setupInitialPosition(chessEngine.getBoardState());
gameScene.add(pieceRenderer.group);

// Create input controller
const inputController = new InputController(
  gameScene.camera,
  chessBoard.group,
  pieceRenderer.group,
  canvas
);

// Create game state
const gameState = new GameState(
  chessEngine,
  pieceRenderer,
  inputController,
  chessBoard.group,
  { mode: 'local' }
);

// Listen to game events
gameState.onEvent((event) => {
  console.log('Game event:', event.type, event);

  switch (event.type) {
    case 'turn':
      console.log(`${event.player === 'w' ? 'White' : 'Black'}'s turn`);
      break;
    case 'check':
      console.log(`${event.player === 'w' ? 'White' : 'Black'} is in check!`);
      break;
    case 'checkmate':
      console.log(`Checkmate! ${event.player === 'w' ? 'White' : 'Black'} wins!`);
      setTimeout(() => alert(`Checkmate! ${event.player === 'w' ? 'White' : 'Black'} wins!`), 100);
      break;
    case 'stalemate':
      console.log('Stalemate! The game is a draw.');
      setTimeout(() => alert('Stalemate! The game is a draw.'), 100);
      break;
    case 'capture':
      console.log(`Captured: ${event.data?.captured}`);
      break;
  }
});

// Start the animation loop
gameScene.start();

// Log success message
console.log('Battle Chess: Fantasy Edition - Scene initialized successfully');
console.log('Chess pieces placed in starting position');
console.log('Click on a white piece to see valid moves, then click a valid move to move the piece');

// Expose game state to window for debugging
declare global {
  interface Window {
    gameState: GameState;
    chessEngine: ChessEngine;
  }
}
window.gameState = gameState;
window.chessEngine = chessEngine;
