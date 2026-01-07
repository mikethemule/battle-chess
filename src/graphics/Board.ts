import * as THREE from 'three';

/**
 * ChessBoard - Creates and manages the 3D chess board
 * Features fantasy stone materials with alternating colors
 */
export class ChessBoard {
  // Board constants
  public static readonly BOARD_SIZE = 8;
  public static readonly SQUARE_SIZE = 1;
  public static readonly BOARD_OFFSET =
    (ChessBoard.BOARD_SIZE * ChessBoard.SQUARE_SIZE) / 2 - ChessBoard.SQUARE_SIZE / 2;

  // Main group containing all board elements
  public group: THREE.Group;

  // Materials
  private lightSquareMaterial: THREE.MeshStandardMaterial;
  private darkSquareMaterial: THREE.MeshStandardMaterial;
  private borderMaterial: THREE.MeshStandardMaterial;

  // Geometries for cleanup
  private squareGeometry: THREE.BoxGeometry;
  private borderGeometries: THREE.BoxGeometry[] = [];

  constructor() {
    this.group = new THREE.Group();
    this.group.name = 'ChessBoard';

    // Create materials
    // Light squares: cream/tan fantasy stone
    this.lightSquareMaterial = new THREE.MeshStandardMaterial({
      color: 0xd4c4a8,
      roughness: 0.6,
      metalness: 0.1,
    });

    // Dark squares: purple/dark fantasy stone with subtle glow
    this.darkSquareMaterial = new THREE.MeshStandardMaterial({
      color: 0x4a4063,
      roughness: 0.5,
      metalness: 0.2,
      emissive: 0x1a1030,
    });

    // Border: darker purple
    this.borderMaterial = new THREE.MeshStandardMaterial({
      color: 0x2d2540,
      roughness: 0.7,
      metalness: 0.1,
    });

    // Create shared square geometry
    this.squareGeometry = new THREE.BoxGeometry(
      ChessBoard.SQUARE_SIZE,
      0.1,
      ChessBoard.SQUARE_SIZE
    );

    // Build the board
    this.createBoard();
    this.createBorder();
  }

  /**
   * Creates the 64 squares of the chess board
   */
  private createBoard(): void {
    for (let rank = 0; rank < ChessBoard.BOARD_SIZE; rank++) {
      for (let file = 0; file < ChessBoard.BOARD_SIZE; file++) {
        // Determine square color: light squares where (rank + file) % 2 === 1
        const isLightSquare = (rank + file) % 2 === 1;
        const material = isLightSquare ? this.lightSquareMaterial : this.darkSquareMaterial;

        // Create square mesh
        const square = new THREE.Mesh(this.squareGeometry, material);

        // Position the square
        const x = file * ChessBoard.SQUARE_SIZE - ChessBoard.BOARD_OFFSET;
        const z = rank * ChessBoard.SQUARE_SIZE - ChessBoard.BOARD_OFFSET;
        square.position.set(x, 0, z);

        // Enable shadow receiving
        square.receiveShadow = true;

        // Store userData for raycasting
        square.userData = {
          file,
          rank,
          isSquare: true,
          isLightSquare,
        };

        // Name for debugging
        square.name = `Square_${String.fromCharCode(97 + file)}${rank + 1}`;

        this.group.add(square);
      }
    }
  }

  /**
   * Creates the border around the chess board
   */
  private createBorder(): void {
    const boardWidth = ChessBoard.BOARD_SIZE * ChessBoard.SQUARE_SIZE;
    const borderWidth = 0.5;
    const borderHeight = 0.15;

    // Create border geometries
    const horizontalBorderGeometry = new THREE.BoxGeometry(
      boardWidth + borderWidth * 2,
      borderHeight,
      borderWidth
    );
    const verticalBorderGeometry = new THREE.BoxGeometry(
      borderWidth,
      borderHeight,
      boardWidth
    );

    this.borderGeometries.push(horizontalBorderGeometry, verticalBorderGeometry);

    // Calculate border positions
    const offset = boardWidth / 2 + borderWidth / 2;

    // Top border (positive Z)
    const topBorder = new THREE.Mesh(horizontalBorderGeometry, this.borderMaterial);
    topBorder.position.set(0, 0, offset);
    topBorder.receiveShadow = true;
    topBorder.name = 'Border_Top';
    this.group.add(topBorder);

    // Bottom border (negative Z)
    const bottomBorder = new THREE.Mesh(horizontalBorderGeometry, this.borderMaterial);
    bottomBorder.position.set(0, 0, -offset);
    bottomBorder.receiveShadow = true;
    bottomBorder.name = 'Border_Bottom';
    this.group.add(bottomBorder);

    // Right border (positive X)
    const rightBorder = new THREE.Mesh(verticalBorderGeometry, this.borderMaterial);
    rightBorder.position.set(offset, 0, 0);
    rightBorder.receiveShadow = true;
    rightBorder.name = 'Border_Right';
    this.group.add(rightBorder);

    // Left border (negative X)
    const leftBorder = new THREE.Mesh(verticalBorderGeometry, this.borderMaterial);
    leftBorder.position.set(-offset, 0, 0);
    leftBorder.receiveShadow = true;
    leftBorder.name = 'Border_Left';
    this.group.add(leftBorder);

    // Corner pieces
    const cornerGeometry = new THREE.BoxGeometry(borderWidth, borderHeight, borderWidth);
    this.borderGeometries.push(cornerGeometry);

    const corners = [
      { x: offset, z: offset, name: 'Corner_TopRight' },
      { x: -offset, z: offset, name: 'Corner_TopLeft' },
      { x: offset, z: -offset, name: 'Corner_BottomRight' },
      { x: -offset, z: -offset, name: 'Corner_BottomLeft' },
    ];

    corners.forEach((corner) => {
      const cornerMesh = new THREE.Mesh(cornerGeometry, this.borderMaterial);
      cornerMesh.position.set(corner.x, 0, corner.z);
      cornerMesh.receiveShadow = true;
      cornerMesh.name = corner.name;
      this.group.add(cornerMesh);
    });
  }

  /**
   * Gets the world position for a piece at the given file and rank
   * @param file - File index (0-7, a-h)
   * @param rank - Rank index (0-7, 1-8)
   * @returns Vector3 position for placing a piece
   */
  public getSquarePosition(file: number, rank: number): THREE.Vector3 {
    const x = file * ChessBoard.SQUARE_SIZE - ChessBoard.BOARD_OFFSET;
    const y = 0.05; // Slightly above the board surface
    const z = rank * ChessBoard.SQUARE_SIZE - ChessBoard.BOARD_OFFSET;
    return new THREE.Vector3(x, y, z);
  }

  /**
   * Gets the square at a given file and rank
   * @param file - File index (0-7)
   * @param rank - Rank index (0-7)
   * @returns The square mesh or null if not found
   */
  public getSquare(file: number, rank: number): THREE.Mesh | null {
    const squareName = `Square_${String.fromCharCode(97 + file)}${rank + 1}`;
    const square = this.group.getObjectByName(squareName);
    return square instanceof THREE.Mesh ? square : null;
  }

  /**
   * Clean up all resources
   */
  public dispose(): void {
    // Dispose geometries
    this.squareGeometry.dispose();
    this.borderGeometries.forEach((geometry) => geometry.dispose());

    // Dispose materials
    this.lightSquareMaterial.dispose();
    this.darkSquareMaterial.dispose();
    this.borderMaterial.dispose();

    // Remove all children from group
    while (this.group.children.length > 0) {
      this.group.remove(this.group.children[0]);
    }
  }
}
