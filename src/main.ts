import './style.css';
import { GameScene } from './graphics/Scene';
import { ChessBoard } from './graphics/Board';
import { PieceRenderer } from './graphics/PieceRenderer';
import { ChessEngine } from './core/ChessEngine';

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

// Start the animation loop
gameScene.start();

// Log success message
console.log('Battle Chess: Fantasy Edition - Scene initialized successfully');
console.log('Chess pieces placed in starting position');
