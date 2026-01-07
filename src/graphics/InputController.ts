import * as THREE from 'three';
import type { Position } from '../core/types';

type SquareClickCallback = (position: Position) => void;

/**
 * InputController - Handles mouse input for chess piece selection and movement
 * Uses raycasting to detect clicks on pieces and board squares
 */
export class InputController {
  private raycaster: THREE.Raycaster;
  private mouse: THREE.Vector2;
  private camera: THREE.Camera;
  private boardGroup: THREE.Group;
  private piecesGroup: THREE.Group;
  private domElement: HTMLElement;
  private onSquareClick: SquareClickCallback | null = null;

  // Valid move indicators
  private validMoveIndicators: THREE.Mesh[] = [];
  private validMoveMaterial: THREE.MeshStandardMaterial;
  private indicatorGeometry: THREE.CylinderGeometry;

  // Selection highlight
  private selectionIndicator: THREE.Mesh | null = null;
  private selectionMaterial: THREE.MeshStandardMaterial;

  // Bound event handlers for cleanup
  private boundOnClick: (event: MouseEvent) => void;
  private boundOnMouseMove: (event: MouseEvent) => void;

  // Hover state
  private hoveredSquare: Position | null = null;

  constructor(
    camera: THREE.Camera,
    boardGroup: THREE.Group,
    piecesGroup: THREE.Group,
    domElement: HTMLElement
  ) {
    this.camera = camera;
    this.boardGroup = boardGroup;
    this.piecesGroup = piecesGroup;
    this.domElement = domElement;

    // Initialize raycaster and mouse vector
    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();

    // Create material for valid move indicators (blue, transparent, emissive)
    this.validMoveMaterial = new THREE.MeshStandardMaterial({
      color: 0x4488ff,
      transparent: true,
      opacity: 0.6,
      emissive: 0x2266cc,
      emissiveIntensity: 0.5,
    });

    // Create selection highlight material (yellow/gold)
    this.selectionMaterial = new THREE.MeshStandardMaterial({
      color: 0xffdd44,
      transparent: true,
      opacity: 0.7,
      emissive: 0xffaa00,
      emissiveIntensity: 0.6,
    });

    // Create shared geometry for indicators (flat cylinder)
    this.indicatorGeometry = new THREE.CylinderGeometry(0.35, 0.35, 0.05, 32);

    // Bind event handlers
    this.boundOnClick = this.onClick.bind(this);
    this.boundOnMouseMove = this.onMouseMove.bind(this);

    // Add event listeners
    this.domElement.addEventListener('click', this.boundOnClick);
    this.domElement.addEventListener('mousemove', this.boundOnMouseMove);
  }

  /**
   * Set the callback for when a square is clicked
   */
  setOnSquareClick(callback: SquareClickCallback): void {
    this.onSquareClick = callback;
  }

  /**
   * Handle mouse click events
   */
  private onClick(event: MouseEvent): void {
    // Update mouse position to normalized device coordinates (-1 to +1)
    this.updateMousePosition(event);

    // Set up raycaster from camera through mouse position
    this.raycaster.setFromCamera(this.mouse, this.camera);

    // First, check for clicks on pieces
    const pieceIntersects = this.raycaster.intersectObjects(
      this.piecesGroup.children,
      true
    );

    if (pieceIntersects.length > 0) {
      const hit = pieceIntersects[0].object;
      // Find the piece mesh (might be a child of the actual piece)
      const pieceMesh = this.findPieceMesh(hit);
      if (pieceMesh && pieceMesh.userData.isPiece) {
        const position = pieceMesh.userData.position as Position;
        if (this.onSquareClick) {
          this.onSquareClick(position);
        }
        return;
      }
    }

    // Check for clicks on valid move indicators
    const indicatorIntersects = this.raycaster.intersectObjects(
      this.validMoveIndicators,
      false
    );

    if (indicatorIntersects.length > 0) {
      const indicator = indicatorIntersects[0].object;
      if (indicator.userData.isValidMoveIndicator) {
        const position = indicator.userData.position as Position;
        if (this.onSquareClick) {
          this.onSquareClick(position);
        }
        return;
      }
    }

    // Check for clicks on board squares
    const boardIntersects = this.raycaster.intersectObjects(
      this.boardGroup.children,
      false
    );

    if (boardIntersects.length > 0) {
      const hit = boardIntersects[0].object;
      if (hit.userData.isSquare) {
        const position: Position = {
          file: hit.userData.file as number,
          rank: hit.userData.rank as number,
        };
        if (this.onSquareClick) {
          this.onSquareClick(position);
        }
        return;
      }
    }
  }

  /**
   * Handle mouse move events for hover effects
   */
  private onMouseMove(event: MouseEvent): void {
    this.updateMousePosition(event);
    this.raycaster.setFromCamera(this.mouse, this.camera);

    // Check board squares for hover
    const boardIntersects = this.raycaster.intersectObjects(
      this.boardGroup.children,
      false
    );

    if (boardIntersects.length > 0) {
      const hit = boardIntersects[0].object;
      if (hit.userData.isSquare) {
        const position: Position = {
          file: hit.userData.file as number,
          rank: hit.userData.rank as number,
        };
        this.hoveredSquare = position;
        this.domElement.style.cursor = 'pointer';
        return;
      }
    }

    this.hoveredSquare = null;
    this.domElement.style.cursor = 'default';
  }

  /**
   * Update mouse position from event
   */
  private updateMousePosition(event: MouseEvent): void {
    const rect = this.domElement.getBoundingClientRect();
    this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  }

  /**
   * Find the parent piece mesh from a potentially nested object
   */
  private findPieceMesh(object: THREE.Object3D): THREE.Object3D | null {
    let current: THREE.Object3D | null = object;
    while (current) {
      if (current.userData.isPiece) {
        return current;
      }
      current = current.parent;
    }
    return null;
  }

  /**
   * Show valid move indicators at the specified positions
   */
  showValidMoves(positions: Position[], boardGroup: THREE.Group): void {
    // Clear any existing indicators
    this.clearValidMoves();

    // Create indicator at each valid position
    positions.forEach((position) => {
      const indicator = new THREE.Mesh(
        this.indicatorGeometry,
        this.validMoveMaterial
      );

      // Get world position from board
      const x = position.file - 3.5; // BOARD_OFFSET calculation
      const z = position.rank - 3.5;
      indicator.position.set(x, 0.1, z); // Slightly above board

      // Store position data
      indicator.userData = {
        isValidMoveIndicator: true,
        position: { ...position },
      };

      indicator.name = `ValidMove_${String.fromCharCode(97 + position.file)}${position.rank + 1}`;

      // Add to board group for rendering
      boardGroup.add(indicator);
      this.validMoveIndicators.push(indicator);
    });
  }

  /**
   * Show selection indicator at the specified position
   */
  showSelection(position: Position, boardGroup: THREE.Group): void {
    this.clearSelection();

    this.selectionIndicator = new THREE.Mesh(
      this.indicatorGeometry,
      this.selectionMaterial
    );

    const x = position.file - 3.5;
    const z = position.rank - 3.5;
    this.selectionIndicator.position.set(x, 0.08, z);

    this.selectionIndicator.userData = {
      isSelectionIndicator: true,
      position: { ...position },
    };

    this.selectionIndicator.name = `Selection_${String.fromCharCode(97 + position.file)}${position.rank + 1}`;

    boardGroup.add(this.selectionIndicator);
  }

  /**
   * Clear selection indicator
   */
  clearSelection(): void {
    if (this.selectionIndicator) {
      this.selectionIndicator.parent?.remove(this.selectionIndicator);
      this.selectionIndicator = null;
    }
  }

  /**
   * Clear all valid move indicators
   */
  clearValidMoves(): void {
    this.validMoveIndicators.forEach((indicator) => {
      indicator.parent?.remove(indicator);
    });
    this.validMoveIndicators = [];
  }

  /**
   * Get the currently hovered square
   */
  getHoveredSquare(): Position | null {
    return this.hoveredSquare;
  }

  /**
   * Clean up all resources and event listeners
   */
  dispose(): void {
    // Remove event listeners
    this.domElement.removeEventListener('click', this.boundOnClick);
    this.domElement.removeEventListener('mousemove', this.boundOnMouseMove);

    // Clear indicators
    this.clearValidMoves();
    this.clearSelection();

    // Dispose geometries and materials
    this.indicatorGeometry.dispose();
    this.validMoveMaterial.dispose();
    this.selectionMaterial.dispose();

    // Reset cursor
    this.domElement.style.cursor = 'default';
  }
}
