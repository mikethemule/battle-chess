# Battle Chess: Fantasy Edition - Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a browser-based 3D chess game with animated fantasy battle sequences when pieces capture.

**Architecture:** TypeScript + Vite frontend with Three.js for 3D rendering. Chess logic via chess.js library, AI via Stockfish.js WASM worker. Game state separated from visual representation. Battle animations triggered on captures with camera transitions.

**Tech Stack:** TypeScript, Vite, Three.js, chess.js, Stockfish.js (WASM)

---

## Phase 1: Project Foundation

### Task 1.1: Initialize Vite TypeScript Project

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `vite.config.ts`
- Create: `index.html`
- Create: `src/main.ts`
- Create: `src/style.css`

**Step 1: Create project with Vite**

```bash
npm create vite@latest . -- --template vanilla-ts
```

Select "y" to proceed in current directory.

**Step 2: Install dependencies**

```bash
npm install three chess.js
npm install -D @types/three
```

**Step 3: Verify installation**

```bash
npm run dev
```

Expected: Dev server starts at localhost:5173

**Step 4: Commit**

```bash
git add .
git commit -m "chore: initialize Vite TypeScript project with Three.js and chess.js"
```

---

### Task 1.2: Configure Project Structure

**Files:**
- Create: `src/core/types.ts`
- Create: `src/core/GameState.ts`
- Create: `src/graphics/Scene.ts`
- Create: `public/models/.gitkeep`

**Step 1: Create directory structure**

```bash
mkdir -p src/core src/graphics src/battle src/ai src/ui public/models
touch src/core/types.ts src/core/GameState.ts src/graphics/Scene.ts public/models/.gitkeep
```

**Step 2: Define core types in `src/core/types.ts`**

```typescript
export type PieceType = 'k' | 'q' | 'r' | 'b' | 'n' | 'p';
export type PieceColor = 'w' | 'b';

export interface Position {
  file: number; // 0-7 (a-h)
  rank: number; // 0-7 (1-8)
}

export interface ChessPiece {
  type: PieceType;
  color: PieceColor;
  position: Position;
}

export type Difficulty = 'beginner' | 'easy' | 'medium' | 'hard' | 'master';

export type GameMode = 'ai' | 'local';

export interface GameConfig {
  mode: GameMode;
  playerColor?: PieceColor;
  aiDifficulty?: Difficulty;
}

export interface MoveResult {
  from: Position;
  to: Position;
  piece: PieceType;
  captured?: PieceType;
  promotion?: PieceType;
  isCheck: boolean;
  isCheckmate: boolean;
  isStalemate: boolean;
}
```

**Step 3: Commit**

```bash
git add .
git commit -m "chore: set up project directory structure and core types"
```

---

## Phase 2: Chess Engine Integration

### Task 2.1: Create Chess Engine Wrapper

**Files:**
- Create: `src/core/ChessEngine.ts`
- Create: `src/core/__tests__/ChessEngine.test.ts`

**Step 1: Install test dependencies**

```bash
npm install -D vitest
```

**Step 2: Add test script to `package.json`**

Add to scripts section:
```json
"test": "vitest",
"test:run": "vitest run"
```

**Step 3: Write failing test in `src/core/__tests__/ChessEngine.test.ts`**

```typescript
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
    expect(moves.length).toBe(20); // 16 pawn moves + 4 knight moves
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
    const result = engine.makeMove('e2', 'e5'); // Can't move pawn 3 squares
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
    // White rook at a1
    expect(board[0][0]).toEqual({ type: 'r', color: 'w' });
    // Black king at e8
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
```

**Step 4: Run test to verify it fails**

```bash
npm run test:run
```

Expected: FAIL - Cannot find module '../ChessEngine'

**Step 5: Implement `src/core/ChessEngine.ts`**

```typescript
import { Chess, Square } from 'chess.js';
import { PieceType, PieceColor, Position, MoveResult } from './types';

interface BoardSquare {
  type: PieceType;
  color: PieceColor;
}

export class ChessEngine {
  private chess: Chess;

  constructor(fen?: string) {
    this.chess = fen ? new Chess(fen) : new Chess();
  }

  getCurrentPlayer(): PieceColor {
    return this.chess.turn();
  }

  isGameOver(): boolean {
    return this.chess.isGameOver();
  }

  isInCheck(): boolean {
    return this.chess.inCheck();
  }

  isCheckmate(): boolean {
    return this.chess.isCheckmate();
  }

  isStalemate(): boolean {
    return this.chess.isStalemate();
  }

  isDraw(): boolean {
    return this.chess.isDraw();
  }

  getValidMoves(): string[] {
    return this.chess.moves();
  }

  getMovesForSquare(square: string): string[] {
    const moves = this.chess.moves({ square: square as Square, verbose: true });
    return moves.map(m => m.to);
  }

  makeMove(from: string, to: string, promotion?: PieceType): MoveResult | null {
    try {
      const move = this.chess.move({
        from: from as Square,
        to: to as Square,
        promotion: promotion,
      });

      if (!move) return null;

      return {
        from: this.squareToPosition(move.from),
        to: this.squareToPosition(move.to),
        piece: move.piece as PieceType,
        captured: move.captured as PieceType | undefined,
        promotion: move.promotion as PieceType | undefined,
        isCheck: this.chess.inCheck(),
        isCheckmate: this.chess.isCheckmate(),
        isStalemate: this.chess.isStalemate(),
      };
    } catch {
      return null;
    }
  }

  getBoardState(): (BoardSquare | null)[][] {
    const board: (BoardSquare | null)[][] = [];

    for (let rank = 0; rank < 8; rank++) {
      const row: (BoardSquare | null)[] = [];
      for (let file = 0; file < 8; file++) {
        const square = this.positionToSquare({ file, rank });
        const piece = this.chess.get(square as Square);
        if (piece) {
          row.push({
            type: piece.type as PieceType,
            color: piece.color as PieceColor,
          });
        } else {
          row.push(null);
        }
      }
      board.push(row);
    }

    return board;
  }

  loadFEN(fen: string): boolean {
    try {
      this.chess.load(fen);
      return true;
    } catch {
      return false;
    }
  }

  getFEN(): string {
    return this.chess.fen();
  }

  reset(): void {
    this.chess.reset();
  }

  undo(): boolean {
    const move = this.chess.undo();
    return move !== null;
  }

  private squareToPosition(square: string): Position {
    const file = square.charCodeAt(0) - 'a'.charCodeAt(0);
    const rank = parseInt(square[1]) - 1;
    return { file, rank };
  }

  private positionToSquare(pos: Position): string {
    const file = String.fromCharCode('a'.charCodeAt(0) + pos.file);
    const rank = (pos.rank + 1).toString();
    return file + rank;
  }
}
```

**Step 6: Run tests to verify they pass**

```bash
npm run test:run
```

Expected: All tests PASS

**Step 7: Commit**

```bash
git add .
git commit -m "feat: add ChessEngine wrapper for chess.js with full test coverage"
```

---

## Phase 3: Three.js Scene Setup

### Task 3.1: Create Basic 3D Scene

**Files:**
- Modify: `src/main.ts`
- Create: `src/graphics/Scene.ts`
- Modify: `src/style.css`
- Modify: `index.html`

**Step 1: Update `index.html`**

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Battle Chess: Fantasy Edition</title>
    <link rel="stylesheet" href="/src/style.css" />
  </head>
  <body>
    <canvas id="game-canvas"></canvas>
    <div id="ui-overlay"></div>
    <script type="module" src="/src/main.ts"></script>
  </body>
</html>
```

**Step 2: Update `src/style.css`**

```css
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

html, body {
  width: 100%;
  height: 100%;
  overflow: hidden;
  background: #1a1a2e;
}

#game-canvas {
  display: block;
  width: 100%;
  height: 100%;
}

#ui-overlay {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
}

#ui-overlay > * {
  pointer-events: auto;
}
```

**Step 3: Create `src/graphics/Scene.ts`**

```typescript
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

export class GameScene {
  public scene: THREE.Scene;
  public camera: THREE.PerspectiveCamera;
  public renderer: THREE.WebGLRenderer;
  public controls: OrbitControls;

  private animationId: number = 0;

  constructor(canvas: HTMLCanvasElement) {
    // Scene
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x1a1a2e);

    // Camera
    const aspect = window.innerWidth / window.innerHeight;
    this.camera = new THREE.PerspectiveCamera(45, aspect, 0.1, 1000);
    this.camera.position.set(0, 12, 12);

    // Renderer
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
    });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    // Controls
    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.target.set(0, 0, 0);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.05;
    this.controls.maxPolarAngle = Math.PI / 2.2;
    this.controls.minDistance = 8;
    this.controls.maxDistance = 25;
    this.controls.update();

    // Lighting
    this.setupLighting();

    // Handle resize
    window.addEventListener('resize', this.onResize.bind(this));
  }

  private setupLighting(): void {
    // Ambient light
    const ambient = new THREE.AmbientLight(0x404040, 0.5);
    this.scene.add(ambient);

    // Key light (warm)
    const keyLight = new THREE.DirectionalLight(0xfff5e6, 1.0);
    keyLight.position.set(10, 15, 10);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.width = 2048;
    keyLight.shadow.mapSize.height = 2048;
    keyLight.shadow.camera.near = 0.5;
    keyLight.shadow.camera.far = 50;
    keyLight.shadow.camera.left = -10;
    keyLight.shadow.camera.right = 10;
    keyLight.shadow.camera.top = 10;
    keyLight.shadow.camera.bottom = -10;
    this.scene.add(keyLight);

    // Fill light (cool)
    const fillLight = new THREE.DirectionalLight(0xe6f0ff, 0.4);
    fillLight.position.set(-10, 10, -10);
    this.scene.add(fillLight);

    // Rim light
    const rimLight = new THREE.DirectionalLight(0xffffff, 0.3);
    rimLight.position.set(0, 5, -15);
    this.scene.add(rimLight);
  }

  private onResize(): void {
    const width = window.innerWidth;
    const height = window.innerHeight;

    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }

  public start(): void {
    const animate = () => {
      this.animationId = requestAnimationFrame(animate);
      this.controls.update();
      this.renderer.render(this.scene, this.camera);
    };
    animate();
  }

  public stop(): void {
    cancelAnimationFrame(this.animationId);
  }

  public dispose(): void {
    this.stop();
    this.renderer.dispose();
    window.removeEventListener('resize', this.onResize.bind(this));
  }
}
```

**Step 4: Update `src/main.ts`**

```typescript
import { GameScene } from './graphics/Scene';
import './style.css';

const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;

if (!canvas) {
  throw new Error('Canvas element not found');
}

const gameScene = new GameScene(canvas);
gameScene.start();

// Debug: Add a test cube
import * as THREE from 'three';
const geometry = new THREE.BoxGeometry(1, 1, 1);
const material = new THREE.MeshStandardMaterial({ color: 0x6c5ce7 });
const cube = new THREE.Mesh(geometry, material);
cube.position.y = 0.5;
cube.castShadow = true;
gameScene.scene.add(cube);

// Add ground plane for shadow testing
const planeGeo = new THREE.PlaneGeometry(20, 20);
const planeMat = new THREE.MeshStandardMaterial({ color: 0x2d3436 });
const plane = new THREE.Mesh(planeGeo, planeMat);
plane.rotation.x = -Math.PI / 2;
plane.receiveShadow = true;
gameScene.scene.add(plane);

console.log('Battle Chess initialized');
```

**Step 5: Run and verify**

```bash
npm run dev
```

Expected: Browser shows 3D scene with purple cube, shadows, and orbital camera controls

**Step 6: Commit**

```bash
git add .
git commit -m "feat: add Three.js scene with lighting, shadows, and orbit controls"
```

---

### Task 3.2: Create Chess Board

**Files:**
- Create: `src/graphics/Board.ts`
- Modify: `src/main.ts`

**Step 1: Create `src/graphics/Board.ts`**

```typescript
import * as THREE from 'three';

export class ChessBoard {
  public group: THREE.Group;

  private readonly BOARD_SIZE = 8;
  private readonly SQUARE_SIZE = 1;
  private readonly BOARD_OFFSET = (this.BOARD_SIZE * this.SQUARE_SIZE) / 2 - this.SQUARE_SIZE / 2;

  private lightSquareMaterial: THREE.MeshStandardMaterial;
  private darkSquareMaterial: THREE.MeshStandardMaterial;
  private borderMaterial: THREE.MeshStandardMaterial;

  constructor() {
    this.group = new THREE.Group();

    // Materials with fantasy stone/crystal look
    this.lightSquareMaterial = new THREE.MeshStandardMaterial({
      color: 0xd4c4a8,
      roughness: 0.6,
      metalness: 0.1,
    });

    this.darkSquareMaterial = new THREE.MeshStandardMaterial({
      color: 0x4a4063,
      roughness: 0.5,
      metalness: 0.2,
      emissive: 0x1a1030,
      emissiveIntensity: 0.1,
    });

    this.borderMaterial = new THREE.MeshStandardMaterial({
      color: 0x2d2540,
      roughness: 0.4,
      metalness: 0.3,
    });

    this.createBoard();
    this.createBorder();
  }

  private createBoard(): void {
    const squareGeometry = new THREE.BoxGeometry(
      this.SQUARE_SIZE,
      0.1,
      this.SQUARE_SIZE
    );

    for (let rank = 0; rank < this.BOARD_SIZE; rank++) {
      for (let file = 0; file < this.BOARD_SIZE; file++) {
        const isLightSquare = (rank + file) % 2 === 1;
        const material = isLightSquare
          ? this.lightSquareMaterial
          : this.darkSquareMaterial;

        const square = new THREE.Mesh(squareGeometry, material);
        square.position.set(
          file * this.SQUARE_SIZE - this.BOARD_OFFSET,
          0,
          rank * this.SQUARE_SIZE - this.BOARD_OFFSET
        );
        square.receiveShadow = true;

        // Store board position for raycasting
        square.userData = { file, rank, isSquare: true };

        this.group.add(square);
      }
    }
  }

  private createBorder(): void {
    const borderWidth = 0.3;
    const boardExtent = this.BOARD_SIZE * this.SQUARE_SIZE;
    const borderHeight = 0.15;

    // Create 4 border pieces
    const borderGeometries = [
      // Front and back
      new THREE.BoxGeometry(boardExtent + borderWidth * 2, borderHeight, borderWidth),
      new THREE.BoxGeometry(boardExtent + borderWidth * 2, borderHeight, borderWidth),
      // Left and right
      new THREE.BoxGeometry(borderWidth, borderHeight, boardExtent),
      new THREE.BoxGeometry(borderWidth, borderHeight, boardExtent),
    ];

    const positions = [
      [0, borderHeight / 2 - 0.05, -this.BOARD_OFFSET - this.SQUARE_SIZE / 2 - borderWidth / 2],
      [0, borderHeight / 2 - 0.05, this.BOARD_OFFSET + this.SQUARE_SIZE / 2 + borderWidth / 2],
      [-this.BOARD_OFFSET - this.SQUARE_SIZE / 2 - borderWidth / 2, borderHeight / 2 - 0.05, 0],
      [this.BOARD_OFFSET + this.SQUARE_SIZE / 2 + borderWidth / 2, borderHeight / 2 - 0.05, 0],
    ];

    borderGeometries.forEach((geo, i) => {
      const border = new THREE.Mesh(geo, this.borderMaterial);
      border.position.set(positions[i][0], positions[i][1], positions[i][2]);
      border.receiveShadow = true;
      border.castShadow = true;
      this.group.add(border);
    });
  }

  public getSquarePosition(file: number, rank: number): THREE.Vector3 {
    return new THREE.Vector3(
      file * this.SQUARE_SIZE - this.BOARD_OFFSET,
      0.05, // Slightly above board
      rank * this.SQUARE_SIZE - this.BOARD_OFFSET
    );
  }

  public getSquareWorldPosition(file: number, rank: number): THREE.Vector3 {
    const localPos = this.getSquarePosition(file, rank);
    return this.group.localToWorld(localPos.clone());
  }

  public dispose(): void {
    this.lightSquareMaterial.dispose();
    this.darkSquareMaterial.dispose();
    this.borderMaterial.dispose();
    this.group.traverse((obj) => {
      if (obj instanceof THREE.Mesh) {
        obj.geometry.dispose();
      }
    });
  }
}
```

**Step 2: Update `src/main.ts`**

```typescript
import { GameScene } from './graphics/Scene';
import { ChessBoard } from './graphics/Board';
import './style.css';

const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;

if (!canvas) {
  throw new Error('Canvas element not found');
}

const gameScene = new GameScene(canvas);

// Create chess board
const chessBoard = new ChessBoard();
gameScene.scene.add(chessBoard.group);

gameScene.start();

console.log('Battle Chess initialized');
```

**Step 3: Run and verify**

```bash
npm run dev
```

Expected: 8x8 chess board with alternating light/dark squares and border

**Step 4: Commit**

```bash
git add .
git commit -m "feat: add 3D chess board with fantasy stone materials"
```

---

## Phase 4: Piece Rendering

### Task 4.1: Create Placeholder Piece Meshes

**Files:**
- Create: `src/graphics/PieceRenderer.ts`
- Modify: `src/main.ts`

**Step 1: Create `src/graphics/PieceRenderer.ts`**

```typescript
import * as THREE from 'three';
import { PieceType, PieceColor, Position } from '../core/types';
import { ChessBoard } from './Board';

interface PieceMeshData {
  mesh: THREE.Mesh;
  position: Position;
  type: PieceType;
  color: PieceColor;
}

export class PieceRenderer {
  private pieces: Map<string, PieceMeshData> = new Map();
  private board: ChessBoard;
  public group: THREE.Group;

  private whiteMaterial: THREE.MeshStandardMaterial;
  private blackMaterial: THREE.MeshStandardMaterial;

  // Placeholder geometry heights by piece type
  private readonly pieceHeights: Record<PieceType, number> = {
    k: 1.4,
    q: 1.3,
    r: 0.8,
    b: 1.0,
    n: 0.9,
    p: 0.6,
  };

  private readonly pieceRadii: Record<PieceType, number> = {
    k: 0.25,
    q: 0.22,
    r: 0.2,
    b: 0.18,
    n: 0.2,
    p: 0.15,
  };

  constructor(board: ChessBoard) {
    this.board = board;
    this.group = new THREE.Group();

    // Fantasy materials - Light army (golden/white)
    this.whiteMaterial = new THREE.MeshStandardMaterial({
      color: 0xf5e6d3,
      roughness: 0.3,
      metalness: 0.5,
      emissive: 0xffd700,
      emissiveIntensity: 0.05,
    });

    // Dark army (purple/dark)
    this.blackMaterial = new THREE.MeshStandardMaterial({
      color: 0x2d1b4e,
      roughness: 0.3,
      metalness: 0.5,
      emissive: 0x6b4c9a,
      emissiveIntensity: 0.1,
    });
  }

  private createPlaceholderMesh(type: PieceType, color: PieceColor): THREE.Mesh {
    const height = this.pieceHeights[type];
    const radius = this.pieceRadii[type];

    // Create compound geometry based on piece type
    let geometry: THREE.BufferGeometry;

    switch (type) {
      case 'k': // King - tall cylinder with cross on top
        geometry = this.createKingGeometry(radius, height);
        break;
      case 'q': // Queen - tall with crown
        geometry = this.createQueenGeometry(radius, height);
        break;
      case 'r': // Rook - cylinder with crenellations
        geometry = this.createRookGeometry(radius, height);
        break;
      case 'b': // Bishop - tapered with slit
        geometry = this.createBishopGeometry(radius, height);
        break;
      case 'n': // Knight - angled shape
        geometry = this.createKnightGeometry(radius, height);
        break;
      case 'p': // Pawn - simple rounded shape
      default:
        geometry = this.createPawnGeometry(radius, height);
    }

    const material = color === 'w' ? this.whiteMaterial : this.blackMaterial;
    const mesh = new THREE.Mesh(geometry, material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;

    return mesh;
  }

  private createPawnGeometry(radius: number, height: number): THREE.BufferGeometry {
    const group = new THREE.Group();

    // Base
    const base = new THREE.CylinderGeometry(radius * 1.2, radius * 1.3, height * 0.15, 16);
    const baseMesh = new THREE.Mesh(base);
    baseMesh.position.y = height * 0.075;
    group.add(baseMesh);

    // Body
    const body = new THREE.CylinderGeometry(radius * 0.6, radius, height * 0.5, 16);
    const bodyMesh = new THREE.Mesh(body);
    bodyMesh.position.y = height * 0.4;
    group.add(bodyMesh);

    // Head
    const head = new THREE.SphereGeometry(radius * 0.7, 16, 16);
    const headMesh = new THREE.Mesh(head);
    headMesh.position.y = height * 0.8;
    group.add(headMesh);

    return this.mergeGroupGeometry(group);
  }

  private createRookGeometry(radius: number, height: number): THREE.BufferGeometry {
    const group = new THREE.Group();

    // Base
    const base = new THREE.CylinderGeometry(radius * 1.3, radius * 1.4, height * 0.15, 16);
    const baseMesh = new THREE.Mesh(base);
    baseMesh.position.y = height * 0.075;
    group.add(baseMesh);

    // Tower body
    const body = new THREE.CylinderGeometry(radius, radius * 1.1, height * 0.7, 16);
    const bodyMesh = new THREE.Mesh(body);
    bodyMesh.position.y = height * 0.5;
    group.add(bodyMesh);

    // Top platform
    const top = new THREE.CylinderGeometry(radius * 1.2, radius, height * 0.15, 16);
    const topMesh = new THREE.Mesh(top);
    topMesh.position.y = height * 0.925;
    group.add(topMesh);

    return this.mergeGroupGeometry(group);
  }

  private createBishopGeometry(radius: number, height: number): THREE.BufferGeometry {
    const group = new THREE.Group();

    // Base
    const base = new THREE.CylinderGeometry(radius * 1.2, radius * 1.3, height * 0.12, 16);
    const baseMesh = new THREE.Mesh(base);
    baseMesh.position.y = height * 0.06;
    group.add(baseMesh);

    // Body - tapered
    const body = new THREE.CylinderGeometry(radius * 0.3, radius, height * 0.6, 16);
    const bodyMesh = new THREE.Mesh(body);
    bodyMesh.position.y = height * 0.42;
    group.add(bodyMesh);

    // Head
    const head = new THREE.SphereGeometry(radius * 0.5, 16, 16);
    const headMesh = new THREE.Mesh(head);
    headMesh.position.y = height * 0.85;
    group.add(headMesh);

    return this.mergeGroupGeometry(group);
  }

  private createKnightGeometry(radius: number, height: number): THREE.BufferGeometry {
    const group = new THREE.Group();

    // Base
    const base = new THREE.CylinderGeometry(radius * 1.2, radius * 1.3, height * 0.12, 16);
    const baseMesh = new THREE.Mesh(base);
    baseMesh.position.y = height * 0.06;
    group.add(baseMesh);

    // Body
    const body = new THREE.BoxGeometry(radius * 1.5, height * 0.6, radius);
    const bodyMesh = new THREE.Mesh(body);
    bodyMesh.position.y = height * 0.42;
    bodyMesh.rotation.y = Math.PI / 6;
    group.add(bodyMesh);

    // Head (angled)
    const head = new THREE.BoxGeometry(radius, height * 0.35, radius * 0.8);
    const headMesh = new THREE.Mesh(head);
    headMesh.position.set(radius * 0.3, height * 0.8, 0);
    headMesh.rotation.z = -Math.PI / 6;
    group.add(headMesh);

    return this.mergeGroupGeometry(group);
  }

  private createQueenGeometry(radius: number, height: number): THREE.BufferGeometry {
    const group = new THREE.Group();

    // Base
    const base = new THREE.CylinderGeometry(radius * 1.3, radius * 1.4, height * 0.12, 16);
    const baseMesh = new THREE.Mesh(base);
    baseMesh.position.y = height * 0.06;
    group.add(baseMesh);

    // Body
    const body = new THREE.CylinderGeometry(radius * 0.4, radius * 1.1, height * 0.6, 16);
    const bodyMesh = new THREE.Mesh(body);
    bodyMesh.position.y = height * 0.42;
    group.add(bodyMesh);

    // Crown base
    const crownBase = new THREE.CylinderGeometry(radius * 0.6, radius * 0.4, height * 0.15, 16);
    const crownMesh = new THREE.Mesh(crownBase);
    crownMesh.position.y = height * 0.8;
    group.add(crownMesh);

    // Crown top
    const crownTop = new THREE.SphereGeometry(radius * 0.35, 16, 16);
    const crownTopMesh = new THREE.Mesh(crownTop);
    crownTopMesh.position.y = height * 0.95;
    group.add(crownTopMesh);

    return this.mergeGroupGeometry(group);
  }

  private createKingGeometry(radius: number, height: number): THREE.BufferGeometry {
    const group = new THREE.Group();

    // Base
    const base = new THREE.CylinderGeometry(radius * 1.3, radius * 1.4, height * 0.1, 16);
    const baseMesh = new THREE.Mesh(base);
    baseMesh.position.y = height * 0.05;
    group.add(baseMesh);

    // Body
    const body = new THREE.CylinderGeometry(radius * 0.5, radius * 1.1, height * 0.55, 16);
    const bodyMesh = new THREE.Mesh(body);
    bodyMesh.position.y = height * 0.375;
    group.add(bodyMesh);

    // Crown collar
    const collar = new THREE.CylinderGeometry(radius * 0.6, radius * 0.5, height * 0.1, 16);
    const collarMesh = new THREE.Mesh(collar);
    collarMesh.position.y = height * 0.7;
    group.add(collarMesh);

    // Cross vertical
    const crossV = new THREE.BoxGeometry(radius * 0.15, height * 0.25, radius * 0.15);
    const crossVMesh = new THREE.Mesh(crossV);
    crossVMesh.position.y = height * 0.875;
    group.add(crossVMesh);

    // Cross horizontal
    const crossH = new THREE.BoxGeometry(radius * 0.5, radius * 0.15, radius * 0.15);
    const crossHMesh = new THREE.Mesh(crossH);
    crossHMesh.position.y = height * 0.9;
    group.add(crossHMesh);

    return this.mergeGroupGeometry(group);
  }

  private mergeGroupGeometry(group: THREE.Group): THREE.BufferGeometry {
    const geometries: THREE.BufferGeometry[] = [];

    group.updateMatrixWorld(true);
    group.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        const cloned = child.geometry.clone();
        cloned.applyMatrix4(child.matrixWorld);
        geometries.push(cloned);
      }
    });

    const merged = mergeBufferGeometries(geometries);
    geometries.forEach((g) => g.dispose());

    return merged || new THREE.BoxGeometry(0.3, 0.5, 0.3);
  }

  public setupInitialPosition(boardState: ({ type: PieceType; color: PieceColor } | null)[][]): void {
    this.clearPieces();

    for (let rank = 0; rank < 8; rank++) {
      for (let file = 0; file < 8; file++) {
        const piece = boardState[rank][file];
        if (piece) {
          this.addPiece(piece.type, piece.color, { file, rank });
        }
      }
    }
  }

  public addPiece(type: PieceType, color: PieceColor, position: Position): void {
    const key = `${position.file}-${position.rank}`;
    const mesh = this.createPlaceholderMesh(type, color);

    const worldPos = this.board.getSquarePosition(position.file, position.rank);
    mesh.position.copy(worldPos);

    // Rotate black pieces to face opponent
    if (color === 'b') {
      mesh.rotation.y = Math.PI;
    }

    mesh.userData = { type, color, position, isPiece: true };

    this.pieces.set(key, { mesh, position, type, color });
    this.group.add(mesh);
  }

  public removePiece(position: Position): PieceMeshData | undefined {
    const key = `${position.file}-${position.rank}`;
    const pieceData = this.pieces.get(key);

    if (pieceData) {
      this.group.remove(pieceData.mesh);
      pieceData.mesh.geometry.dispose();
      this.pieces.delete(key);
    }

    return pieceData;
  }

  public movePiece(from: Position, to: Position): void {
    const key = `${from.file}-${from.rank}`;
    const pieceData = this.pieces.get(key);

    if (pieceData) {
      this.pieces.delete(key);

      const newKey = `${to.file}-${to.rank}`;
      pieceData.position = to;
      this.pieces.set(newKey, pieceData);

      const worldPos = this.board.getSquarePosition(to.file, to.rank);
      pieceData.mesh.position.copy(worldPos);
      pieceData.mesh.userData.position = to;
    }
  }

  public getPieceAt(position: Position): PieceMeshData | undefined {
    const key = `${position.file}-${position.rank}`;
    return this.pieces.get(key);
  }

  public clearPieces(): void {
    this.pieces.forEach((data) => {
      this.group.remove(data.mesh);
      data.mesh.geometry.dispose();
    });
    this.pieces.clear();
  }

  public dispose(): void {
    this.clearPieces();
    this.whiteMaterial.dispose();
    this.blackMaterial.dispose();
  }
}

// Helper function to merge geometries
function mergeBufferGeometries(geometries: THREE.BufferGeometry[]): THREE.BufferGeometry | null {
  if (geometries.length === 0) return null;
  if (geometries.length === 1) return geometries[0];

  let totalVertices = 0;
  let totalIndices = 0;

  for (const geo of geometries) {
    totalVertices += geo.attributes.position.count;
    if (geo.index) {
      totalIndices += geo.index.count;
    } else {
      totalIndices += geo.attributes.position.count;
    }
  }

  const positions = new Float32Array(totalVertices * 3);
  const normals = new Float32Array(totalVertices * 3);
  const indices = new Uint32Array(totalIndices);

  let vertexOffset = 0;
  let indexOffset = 0;
  let vertexCount = 0;

  for (const geo of geometries) {
    const posAttr = geo.attributes.position;
    const normAttr = geo.attributes.normal;

    for (let i = 0; i < posAttr.count; i++) {
      positions[(vertexOffset + i) * 3] = posAttr.getX(i);
      positions[(vertexOffset + i) * 3 + 1] = posAttr.getY(i);
      positions[(vertexOffset + i) * 3 + 2] = posAttr.getZ(i);

      if (normAttr) {
        normals[(vertexOffset + i) * 3] = normAttr.getX(i);
        normals[(vertexOffset + i) * 3 + 1] = normAttr.getY(i);
        normals[(vertexOffset + i) * 3 + 2] = normAttr.getZ(i);
      }
    }

    if (geo.index) {
      for (let i = 0; i < geo.index.count; i++) {
        indices[indexOffset + i] = geo.index.getX(i) + vertexCount;
      }
      indexOffset += geo.index.count;
    } else {
      for (let i = 0; i < posAttr.count; i++) {
        indices[indexOffset + i] = i + vertexCount;
      }
      indexOffset += posAttr.count;
    }

    vertexCount += posAttr.count;
    vertexOffset += posAttr.count;
  }

  const merged = new THREE.BufferGeometry();
  merged.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  merged.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
  merged.setIndex(new THREE.BufferAttribute(indices, 1));
  merged.computeVertexNormals();

  return merged;
}
```

**Step 2: Update `src/main.ts`**

```typescript
import { GameScene } from './graphics/Scene';
import { ChessBoard } from './graphics/Board';
import { PieceRenderer } from './graphics/PieceRenderer';
import { ChessEngine } from './core/ChessEngine';
import './style.css';

const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;

if (!canvas) {
  throw new Error('Canvas element not found');
}

// Initialize scene
const gameScene = new GameScene(canvas);

// Create chess board
const chessBoard = new ChessBoard();
gameScene.scene.add(chessBoard.group);

// Create piece renderer
const pieceRenderer = new PieceRenderer(chessBoard);
gameScene.scene.add(pieceRenderer.group);

// Initialize chess engine and set up pieces
const chessEngine = new ChessEngine();
pieceRenderer.setupInitialPosition(chessEngine.getBoardState());

gameScene.start();

console.log('Battle Chess initialized with pieces');
```

**Step 3: Run and verify**

```bash
npm run dev
```

Expected: Chess board with all 32 placeholder pieces in starting positions

**Step 4: Commit**

```bash
git add .
git commit -m "feat: add placeholder piece meshes with fantasy materials"
```

---

## Phase 5: Input & Interaction

### Task 5.1: Implement Square Selection with Raycasting

**Files:**
- Create: `src/graphics/InputController.ts`
- Create: `src/core/GameState.ts`
- Modify: `src/main.ts`

See design document for detailed implementation of InputController and GameState classes.

Key points:
- Use THREE.Raycaster for mouse-to-3D intersection
- Store file/rank in userData for each square mesh
- Show valid move indicators as small cylinders
- GameState manages selection state and coordinates with ChessEngine

**Step 5: Commit**

```bash
git add .
git commit -m "feat: add input handling with piece selection and move validation"
```

---

## Phase 6: Battle Animation System

### Task 6.1: Create Battle Manager

**Files:**
- Create: `src/battle/BattleManager.ts`
- Create: `src/graphics/CameraController.ts`

Key implementation points:
- CameraController handles smooth transitions between board view and battle close-up
- BattleManager orchestrates: camera transition → attack animation → death animation → camera return
- Magic users (king, queen, bishop) use projectile attacks
- Physical pieces (rook, knight, pawn) use melee lunge attacks
- Particle systems for magic trails, impacts, and death dissolve effects

**Step 6: Commit**

```bash
git add .
git commit -m "feat: add battle animation system with camera transitions and particles"
```

---

## Phase 7: Stockfish AI Integration

### Task 7.1: Integrate Stockfish.js

**Files:**
- Create: `src/ai/StockfishWorker.ts`
- Modify: `src/core/GameState.ts`

**Step 1: Install stockfish.js**

```bash
npm install stockfish.js
```

Key implementation:
- Run Stockfish in Web Worker for non-blocking UI
- Configure UCI protocol with difficulty-based ELO limiting
- Parse bestmove responses and convert UCI notation to board positions

**Step 5: Commit**

```bash
git add .
git commit -m "feat: integrate Stockfish.js AI with adjustable difficulty"
```

---

## Phase 8: UI System

### Task 8.1: Create Main Menu and HUD

**Files:**
- Create: `src/ui/Menu.ts`
- Create: `src/ui/HUD.ts`
- Modify: `src/style.css`

**IMPORTANT: Use safe DOM methods instead of innerHTML to prevent XSS:**

Example safe DOM construction for Menu.ts:

```typescript
private render(): void {
  const menu = document.createElement('div');
  menu.className = 'main-menu';

  const title = document.createElement('h1');
  title.textContent = 'Battle Chess';
  menu.appendChild(title);

  const subtitle = document.createElement('h2');
  subtitle.textContent = 'Fantasy Edition';
  subtitle.style.cssText = 'color: #a0a0a0; text-align: center; margin-bottom: 30px; font-size: 14px;';
  menu.appendChild(subtitle);

  // Game Mode Select
  const modeLabel = document.createElement('label');
  modeLabel.className = 'menu-label';
  modeLabel.textContent = 'Game Mode';
  menu.appendChild(modeLabel);

  const modeSelect = document.createElement('select');
  modeSelect.id = 'game-mode';
  modeSelect.className = 'menu-select';

  const aiOption = document.createElement('option');
  aiOption.value = 'ai';
  aiOption.textContent = 'vs Computer';
  modeSelect.appendChild(aiOption);

  const localOption = document.createElement('option');
  localOption.value = 'local';
  localOption.textContent = 'Local Multiplayer';
  modeSelect.appendChild(localOption);

  menu.appendChild(modeSelect);

  // ... continue building DOM elements safely

  this.container.appendChild(menu);
}
```

Apply same pattern to HUD.ts - always use createElement + textContent instead of innerHTML.

**Step 6: Commit**

```bash
git add .
git commit -m "feat: add main menu and in-game HUD with fantasy styling"
```

---

## Summary: Remaining Optional Tasks

### Phase 9 (Optional): Visual Polish
- Task 9.1: Add post-processing (bloom, ambient occlusion)
- Task 9.2: Add piece idle animations (gentle bob/glow)
- Task 9.3: Load actual glTF models to replace placeholders

### Phase 10 (Optional): Game Features
- Task 10.1: Add pawn promotion UI
- Task 10.2: Add move history panel
- Task 10.3: Add undo functionality
- Task 10.4: Add save/load game

---

**Plan complete.**
