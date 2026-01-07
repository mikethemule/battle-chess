import './style.css';
import { GameScene } from './graphics/Scene';
import { ChessBoard } from './graphics/Board';

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

// Start the animation loop
gameScene.start();

// Log success message
console.log('Battle Chess: Fantasy Edition - Scene initialized successfully');
