import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { BoardSquare, PieceType, PieceColor, Position } from '../core/types';
import { ChessBoard } from './Board';

/**
 * Data structure for storing piece mesh information
 */
interface PieceMeshData {
  mesh: THREE.Mesh;
  position: Position;
  type: PieceType;
  color: PieceColor;
}

/**
 * PieceRenderer - Creates and manages 3D chess piece meshes
 * Features fantasy-styled placeholder pieces with cream and purple materials
 */
export class PieceRenderer {
  // Main group containing all piece meshes
  public group: THREE.Group;

  // Reference to the chess board for positioning
  private chessBoard: ChessBoard;

  // Materials for white and black pieces
  private whiteMaterial: THREE.MeshStandardMaterial;
  private blackMaterial: THREE.MeshStandardMaterial;

  // Store pieces by position key "file-rank"
  private pieces: Map<string, PieceMeshData> = new Map();

  // Piece dimensions
  private pieceHeights: Record<PieceType, number> = {
    k: 1.4,
    q: 1.3,
    r: 0.8,
    b: 1.0,
    n: 0.9,
    p: 0.6,
  };

  private pieceRadii: Record<PieceType, number> = {
    k: 0.25,
    q: 0.22,
    r: 0.2,
    b: 0.18,
    n: 0.2,
    p: 0.15,
  };

  constructor(chessBoard: ChessBoard) {
    this.chessBoard = chessBoard;
    this.group = new THREE.Group();
    this.group.name = 'PieceRenderer';

    // Create materials
    // White pieces: light cream with gold emissive
    this.whiteMaterial = new THREE.MeshStandardMaterial({
      color: 0xf5e6d3,
      roughness: 0.3,
      metalness: 0.5,
      emissive: 0xffd700,
      emissiveIntensity: 0.05,
    });

    // Black pieces: dark purple with purple emissive
    this.blackMaterial = new THREE.MeshStandardMaterial({
      color: 0x2d1b4e,
      roughness: 0.3,
      metalness: 0.5,
      emissive: 0x6b4c9a,
      emissiveIntensity: 0.1,
    });
  }

  /**
   * Creates a position key for the pieces Map
   */
  private getPositionKey(file: number, rank: number): string {
    return `${file}-${rank}`;
  }

  /**
   * Merges multiple geometries from a group into a single BufferGeometry
   */
  private mergeGroupGeometry(group: THREE.Group): THREE.BufferGeometry {
    const geometries: THREE.BufferGeometry[] = [];

    group.updateMatrixWorld(true);

    group.traverse((child) => {
      if (child instanceof THREE.Mesh && child.geometry) {
        const clonedGeometry = child.geometry.clone();
        clonedGeometry.applyMatrix4(child.matrixWorld);
        geometries.push(clonedGeometry);
      }
    });

    const merged = mergeGeometries(geometries, false);

    // Dispose cloned geometries
    geometries.forEach((geo) => geo.dispose());

    return merged || new THREE.BufferGeometry();
  }

  /**
   * Creates pawn geometry: base cylinder + body tapered cylinder + sphere head
   */
  private createPawnGeometry(): THREE.BufferGeometry {
    const group = new THREE.Group();
    const height = this.pieceHeights.p;
    const radius = this.pieceRadii.p;

    // Base cylinder
    const baseGeometry = new THREE.CylinderGeometry(radius * 1.2, radius * 1.3, height * 0.15, 16);
    const base = new THREE.Mesh(baseGeometry);
    base.position.y = height * 0.075;
    group.add(base);

    // Body tapered cylinder
    const bodyGeometry = new THREE.CylinderGeometry(radius * 0.6, radius * 1.0, height * 0.5, 16);
    const body = new THREE.Mesh(bodyGeometry);
    body.position.y = height * 0.15 + height * 0.25;
    group.add(body);

    // Sphere head
    const headGeometry = new THREE.SphereGeometry(radius * 0.7, 16, 12);
    const head = new THREE.Mesh(headGeometry);
    head.position.y = height * 0.75;
    group.add(head);

    const merged = this.mergeGroupGeometry(group);

    // Dispose individual geometries
    baseGeometry.dispose();
    bodyGeometry.dispose();
    headGeometry.dispose();

    return merged;
  }

  /**
   * Creates rook geometry: base + tower body + top platform
   */
  private createRookGeometry(): THREE.BufferGeometry {
    const group = new THREE.Group();
    const height = this.pieceHeights.r;
    const radius = this.pieceRadii.r;

    // Base cylinder
    const baseGeometry = new THREE.CylinderGeometry(radius * 1.2, radius * 1.4, height * 0.15, 16);
    const base = new THREE.Mesh(baseGeometry);
    base.position.y = height * 0.075;
    group.add(base);

    // Tower body
    const bodyGeometry = new THREE.CylinderGeometry(radius * 0.9, radius * 1.0, height * 0.6, 16);
    const body = new THREE.Mesh(bodyGeometry);
    body.position.y = height * 0.15 + height * 0.3;
    group.add(body);

    // Top platform
    const topGeometry = new THREE.CylinderGeometry(radius * 1.1, radius * 0.9, height * 0.2, 16);
    const top = new THREE.Mesh(topGeometry);
    top.position.y = height * 0.85;
    group.add(top);

    const merged = this.mergeGroupGeometry(group);

    baseGeometry.dispose();
    bodyGeometry.dispose();
    topGeometry.dispose();

    return merged;
  }

  /**
   * Creates bishop geometry: base + tapered body + sphere head
   */
  private createBishopGeometry(): THREE.BufferGeometry {
    const group = new THREE.Group();
    const height = this.pieceHeights.b;
    const radius = this.pieceRadii.b;

    // Base cylinder
    const baseGeometry = new THREE.CylinderGeometry(radius * 1.2, radius * 1.4, height * 0.12, 16);
    const base = new THREE.Mesh(baseGeometry);
    base.position.y = height * 0.06;
    group.add(base);

    // Tapered body
    const bodyGeometry = new THREE.CylinderGeometry(radius * 0.4, radius * 1.0, height * 0.6, 16);
    const body = new THREE.Mesh(bodyGeometry);
    body.position.y = height * 0.12 + height * 0.3;
    group.add(body);

    // Sphere head
    const headGeometry = new THREE.SphereGeometry(radius * 0.5, 16, 12);
    const head = new THREE.Mesh(headGeometry);
    head.position.y = height * 0.85;
    group.add(head);

    const merged = this.mergeGroupGeometry(group);

    baseGeometry.dispose();
    bodyGeometry.dispose();
    headGeometry.dispose();

    return merged;
  }

  /**
   * Creates knight geometry: base + box body + angled box head
   */
  private createKnightGeometry(): THREE.BufferGeometry {
    const group = new THREE.Group();
    const height = this.pieceHeights.n;
    const radius = this.pieceRadii.n;

    // Base cylinder
    const baseGeometry = new THREE.CylinderGeometry(radius * 1.2, radius * 1.4, height * 0.12, 16);
    const base = new THREE.Mesh(baseGeometry);
    base.position.y = height * 0.06;
    group.add(base);

    // Box body (neck)
    const bodyGeometry = new THREE.BoxGeometry(radius * 1.2, height * 0.5, radius * 0.8);
    const body = new THREE.Mesh(bodyGeometry);
    body.position.y = height * 0.12 + height * 0.25;
    group.add(body);

    // Angled box head (horse head shape)
    const headGeometry = new THREE.BoxGeometry(radius * 1.0, height * 0.35, radius * 1.4);
    const head = new THREE.Mesh(headGeometry);
    head.position.y = height * 0.7;
    head.position.z = radius * 0.3;
    head.rotation.x = -Math.PI * 0.15;
    group.add(head);

    const merged = this.mergeGroupGeometry(group);

    baseGeometry.dispose();
    bodyGeometry.dispose();
    headGeometry.dispose();

    return merged;
  }

  /**
   * Creates queen geometry: base + tapered body + crown base + sphere top
   */
  private createQueenGeometry(): THREE.BufferGeometry {
    const group = new THREE.Group();
    const height = this.pieceHeights.q;
    const radius = this.pieceRadii.q;

    // Base cylinder
    const baseGeometry = new THREE.CylinderGeometry(radius * 1.2, radius * 1.5, height * 0.1, 16);
    const base = new THREE.Mesh(baseGeometry);
    base.position.y = height * 0.05;
    group.add(base);

    // Tapered body
    const bodyGeometry = new THREE.CylinderGeometry(radius * 0.5, radius * 1.1, height * 0.55, 16);
    const body = new THREE.Mesh(bodyGeometry);
    body.position.y = height * 0.1 + height * 0.275;
    group.add(body);

    // Crown base
    const crownGeometry = new THREE.CylinderGeometry(radius * 0.7, radius * 0.5, height * 0.15, 16);
    const crown = new THREE.Mesh(crownGeometry);
    crown.position.y = height * 0.75;
    group.add(crown);

    // Sphere top
    const topGeometry = new THREE.SphereGeometry(radius * 0.4, 16, 12);
    const top = new THREE.Mesh(topGeometry);
    top.position.y = height * 0.9;
    group.add(top);

    const merged = this.mergeGroupGeometry(group);

    baseGeometry.dispose();
    bodyGeometry.dispose();
    crownGeometry.dispose();
    topGeometry.dispose();

    return merged;
  }

  /**
   * Creates king geometry: base + body + collar + cross (vertical + horizontal boxes)
   */
  private createKingGeometry(): THREE.BufferGeometry {
    const group = new THREE.Group();
    const height = this.pieceHeights.k;
    const radius = this.pieceRadii.k;

    // Base cylinder
    const baseGeometry = new THREE.CylinderGeometry(radius * 1.2, radius * 1.5, height * 0.1, 16);
    const base = new THREE.Mesh(baseGeometry);
    base.position.y = height * 0.05;
    group.add(base);

    // Body
    const bodyGeometry = new THREE.CylinderGeometry(radius * 0.6, radius * 1.1, height * 0.5, 16);
    const body = new THREE.Mesh(bodyGeometry);
    body.position.y = height * 0.1 + height * 0.25;
    group.add(body);

    // Collar
    const collarGeometry = new THREE.CylinderGeometry(radius * 0.7, radius * 0.6, height * 0.1, 16);
    const collar = new THREE.Mesh(collarGeometry);
    collar.position.y = height * 0.65;
    group.add(collar);

    // Cross vertical bar
    const crossVerticalGeometry = new THREE.BoxGeometry(radius * 0.25, height * 0.25, radius * 0.25);
    const crossVertical = new THREE.Mesh(crossVerticalGeometry);
    crossVertical.position.y = height * 0.825;
    group.add(crossVertical);

    // Cross horizontal bar
    const crossHorizontalGeometry = new THREE.BoxGeometry(radius * 0.6, height * 0.08, radius * 0.25);
    const crossHorizontal = new THREE.Mesh(crossHorizontalGeometry);
    crossHorizontal.position.y = height * 0.88;
    group.add(crossHorizontal);

    const merged = this.mergeGroupGeometry(group);

    baseGeometry.dispose();
    bodyGeometry.dispose();
    collarGeometry.dispose();
    crossVerticalGeometry.dispose();
    crossHorizontalGeometry.dispose();

    return merged;
  }

  /**
   * Gets the geometry for a specific piece type
   */
  private getGeometryForPiece(type: PieceType): THREE.BufferGeometry {
    switch (type) {
      case 'p':
        return this.createPawnGeometry();
      case 'r':
        return this.createRookGeometry();
      case 'b':
        return this.createBishopGeometry();
      case 'n':
        return this.createKnightGeometry();
      case 'q':
        return this.createQueenGeometry();
      case 'k':
        return this.createKingGeometry();
      default:
        return this.createPawnGeometry();
    }
  }

  /**
   * Adds a piece to the board at the specified position
   */
  public addPiece(type: PieceType, color: PieceColor, position: Position): THREE.Mesh {
    const geometry = this.getGeometryForPiece(type);
    const material = color === 'w' ? this.whiteMaterial : this.blackMaterial;

    const mesh = new THREE.Mesh(geometry, material);

    // Get world position from chess board
    const worldPos = this.chessBoard.getSquarePosition(position.file, position.rank);
    mesh.position.copy(worldPos);

    // Black pieces face opposite direction
    if (color === 'b') {
      mesh.rotation.y = Math.PI;
    }

    // Enable shadows
    mesh.castShadow = true;
    mesh.receiveShadow = true;

    // Store userData for identification
    mesh.userData = {
      type,
      color,
      position: { ...position },
      isPiece: true,
    };

    // Name for debugging
    const pieceNames: Record<PieceType, string> = {
      k: 'King',
      q: 'Queen',
      r: 'Rook',
      b: 'Bishop',
      n: 'Knight',
      p: 'Pawn',
    };
    mesh.name = `${color === 'w' ? 'White' : 'Black'}_${pieceNames[type]}_${String.fromCharCode(97 + position.file)}${position.rank + 1}`;

    // Add to group
    this.group.add(mesh);

    // Store in pieces map
    const key = this.getPositionKey(position.file, position.rank);
    this.pieces.set(key, {
      mesh,
      position: { ...position },
      type,
      color,
    });

    return mesh;
  }

  /**
   * Removes a piece from the specified position
   */
  public removePiece(position: Position): boolean {
    const key = this.getPositionKey(position.file, position.rank);
    const pieceData = this.pieces.get(key);

    if (!pieceData) {
      return false;
    }

    // Remove from scene
    this.group.remove(pieceData.mesh);

    // Dispose geometry (material is shared, don't dispose)
    pieceData.mesh.geometry.dispose();

    // Remove from map
    this.pieces.delete(key);

    return true;
  }

  /**
   * Moves a piece from one position to another
   */
  public movePiece(from: Position, to: Position): boolean {
    const fromKey = this.getPositionKey(from.file, from.rank);
    const pieceData = this.pieces.get(fromKey);

    if (!pieceData) {
      return false;
    }

    // Remove any piece at destination
    this.removePiece(to);

    // Update position
    const worldPos = this.chessBoard.getSquarePosition(to.file, to.rank);
    pieceData.mesh.position.copy(worldPos);

    // Update stored data
    pieceData.position = { ...to };
    pieceData.mesh.userData.position = { ...to };

    // Update mesh name
    const pieceNames: Record<PieceType, string> = {
      k: 'King',
      q: 'Queen',
      r: 'Rook',
      b: 'Bishop',
      n: 'Knight',
      p: 'Pawn',
    };
    pieceData.mesh.name = `${pieceData.color === 'w' ? 'White' : 'Black'}_${pieceNames[pieceData.type]}_${String.fromCharCode(97 + to.file)}${to.rank + 1}`;

    // Update map
    this.pieces.delete(fromKey);
    const toKey = this.getPositionKey(to.file, to.rank);
    this.pieces.set(toKey, pieceData);

    return true;
  }

  /**
   * Gets the piece data at a specified position
   */
  public getPieceAt(position: Position): PieceMeshData | null {
    const key = this.getPositionKey(position.file, position.rank);
    return this.pieces.get(key) || null;
  }

  /**
   * Clears all pieces from the board
   */
  public clearPieces(): void {
    this.pieces.forEach((pieceData) => {
      this.group.remove(pieceData.mesh);
      pieceData.mesh.geometry.dispose();
    });
    this.pieces.clear();
  }

  /**
   * Sets up all pieces from the initial board state
   */
  public setupInitialPosition(boardState: (BoardSquare | null)[][]): void {
    // Clear any existing pieces
    this.clearPieces();

    // Iterate through board state and create pieces
    for (let rank = 0; rank < 8; rank++) {
      for (let file = 0; file < 8; file++) {
        const square = boardState[rank][file];
        if (square) {
          this.addPiece(square.type, square.color, { file, rank });
        }
      }
    }
  }

  /**
   * Clean up all resources
   */
  public dispose(): void {
    // Clear all pieces (disposes geometries)
    this.clearPieces();

    // Dispose materials
    this.whiteMaterial.dispose();
    this.blackMaterial.dispose();

    // Remove all children from group
    while (this.group.children.length > 0) {
      this.group.remove(this.group.children[0]);
    }
  }
}
