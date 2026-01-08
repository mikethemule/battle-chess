import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { BoardSquare, PieceType, PieceColor, Position } from '../core/types';
import { ChessBoard } from './Board';
import { AnimationController } from './AnimationController';

/**
 * Data structure for storing piece mesh information
 */
interface PieceMeshData {
  mesh: THREE.Object3D; // Can be Mesh or Group (for GLTF models)
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

  // GLB model loading
  private gltfLoader: GLTFLoader = new GLTFLoader();
  private textureLoader: THREE.TextureLoader = new THREE.TextureLoader();
  private modelPaths: Set<string> = new Set(); // Track which models exist
  private textureCache: Map<string, THREE.Texture> = new Map();
  private animationController: AnimationController | null = null;
  private _modelsLoaded: boolean = false;

  // Mapping from piece types to character texture names
  private pieceToTexture: Record<string, { body: string; weapon?: string }> = {
    king: { body: 'Warrior_Texture', weapon: 'Warrior_Sword_Texture' },
    queen: { body: 'Wizard_Texture', weapon: 'Wizard_Staff_Texture' },
    bishop: { body: 'Cleric_Texture', weapon: 'Cleric_Staff_Texture' },
    knight: { body: 'Rogue_Texture', weapon: 'Rogue_Dagger_Texture' },
    rook: { body: 'Ranger_Texture', weapon: 'Ranger_Bow_Texture' },
    pawn: { body: 'Monk_Texture' },
  };

  /** Returns true if GLB models have finished loading */
  get modelsLoaded(): boolean {
    return this._modelsLoaded;
  }

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

    // Create fantasy-themed materials
    // Light Army (Arcane Order): polished marble with cyan magical glow
    this.whiteMaterial = new THREE.MeshStandardMaterial({
      color: 0xf0f8ff,      // AliceBlue - marble white
      roughness: 0.2,       // Polished/shiny
      metalness: 0.6,       // Semi-metallic enchanted look
      emissive: 0x0088ff,   // Cyan magical energy
      emissiveIntensity: 0.15,
    });

    // Dark Army (Necrotic Horde): ancient obsidian with green necrotic glow
    this.blackMaterial = new THREE.MeshStandardMaterial({
      color: 0x2f4f4f,      // DarkSlateGray - obsidian
      roughness: 0.7,       // Rough stone/bone texture
      metalness: 0.3,       // Tarnished ancient metal
      emissive: 0x22dd22,   // Lime green necrotic energy
      emissiveIntensity: 0.12,
    });
  }

  /**
   * Checks which GLB models exist for chess pieces
   * Actual loading happens on-demand to avoid skeleton sharing issues
   */
  async loadModels(animationController: AnimationController): Promise<void> {
    this.animationController = animationController;

    const pieces = ['king', 'queen', 'bishop', 'knight', 'rook', 'pawn'];
    const colors = ['white', 'black'];

    const checkPromises: Promise<void>[] = [];

    for (const color of colors) {
      for (const piece of pieces) {
        const key = `${color}-${piece}`;
        const path = `/models/${key}.gltf`;

        // Check if model exists via HEAD request
        checkPromises.push(
          fetch(path, { method: 'HEAD' })
            .then((response) => {
              if (response.ok) {
                this.modelPaths.add(key);
              }
            })
            .catch(() => {
              // Model doesn't exist, will use procedural fallback
            })
        );
      }
    }

    await Promise.all(checkPromises);
    this._modelsLoaded = true;
  }

  /**
   * Loads a GLTF model on demand (fresh load, no caching)
   */
  private loadModelAsync(path: string): Promise<GLTF> {
    return new Promise((resolve, reject) => {
      this.gltfLoader.load(path, resolve, undefined, reject);
    });
  }

  /**
   * Loads a texture with caching
   */
  private async loadTexture(name: string): Promise<THREE.Texture | null> {
    if (this.textureCache.has(name)) {
      return this.textureCache.get(name)!;
    }

    const path = `/textures/pieces/${name}.png`;

    return new Promise((resolve) => {
      this.textureLoader.load(
        path,
        (texture) => {
          texture.flipY = false; // GLTF models use non-flipped UVs
          texture.colorSpace = THREE.SRGBColorSpace;
          this.textureCache.set(name, texture);
          resolve(texture);
        },
        undefined,
        () => {
          console.warn(`Failed to load texture: ${path}`);
          resolve(null);
        }
      );
    });
  }

  /**
   * Creates a piece mesh from a freshly loaded GLTF model
   * Model is used directly (no cloning) since each piece loads its own copy
   */
  private async createFromGLTF(
    gltf: GLTF,
    color: 'white' | 'black',
    pieceType: PieceType
  ): Promise<THREE.Group> {
    // Use the scene directly - no cloning needed since this is a fresh load
    const model = gltf.scene;

    // Update matrix world to ensure accurate bounding box calculation
    model.updateMatrixWorld(true);

    // Scale model to fit chess piece dimensions (target height ~1 unit)
    const box = new THREE.Box3().setFromObject(model);
    const size = box.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z);
    const scale = 1.0 / maxDim;

    model.scale.setScalar(scale);

    // Update matrix world again after scaling
    model.updateMatrixWorld(true);

    // Recalculate bounding box after scaling
    box.setFromObject(model);
    const center = box.getCenter(new THREE.Vector3());

    // Center model horizontally (x, z) and position bottom at y=0
    model.position.x = -center.x;
    model.position.z = -center.z;
    model.position.y = -box.min.y; // Move up so bottom is at y=0

    // Final matrix update
    model.updateMatrixWorld(true);

    // Register animations if available
    if (gltf.animations.length > 0 && this.animationController) {
      this.animationController.registerModel(model, gltf.animations);
    }

    // Map PieceType to full name for texture lookup
    const typeToName: Record<PieceType, string> = {
      k: 'king',
      q: 'queen',
      r: 'rook',
      b: 'bishop',
      n: 'knight',
      p: 'pawn',
    };
    const pieceName = typeToName[pieceType];

    // Load textures for this piece type
    const textureInfo = this.pieceToTexture[pieceName];
    let bodyTexture: THREE.Texture | null = null;
    let weaponTexture: THREE.Texture | null = null;

    if (textureInfo) {
      bodyTexture = await this.loadTexture(textureInfo.body);
      if (textureInfo.weapon) {
        weaponTexture = await this.loadTexture(textureInfo.weapon);
      }
    }

    // Team color tinting - subtle tint to preserve texture detail
    // White team: slight cool tint, Black team: darker purple tint
    const teamTint = color === 'white' ? new THREE.Color(1.0, 1.0, 1.0) : new THREE.Color(0.6, 0.5, 0.7);
    const emissiveColor = color === 'white' ? new THREE.Color(0x2266cc) : new THREE.Color(0x22aa22);
    const emissiveIntensity = color === 'white' ? 0.08 : 0.06;

    // Apply materials with textures to all meshes
    model.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        // Determine if this mesh is a weapon (usually named with weapon-related terms)
        const meshName = child.name.toLowerCase();
        const isWeapon =
          meshName.includes('weapon') ||
          meshName.includes('sword') ||
          meshName.includes('staff') ||
          meshName.includes('bow') ||
          meshName.includes('dagger');

        // Choose appropriate texture
        const texture = isWeapon && weaponTexture ? weaponTexture : bodyTexture;

        // Create textured material
        const material = new THREE.MeshStandardMaterial({
          map: texture,
          color: teamTint, // Tint the texture with team color
          roughness: color === 'white' ? 0.4 : 0.6,
          metalness: color === 'white' ? 0.3 : 0.2,
          emissive: emissiveColor,
          emissiveIntensity: emissiveIntensity,
          transparent: false,
          opacity: 1.0,
        });

        // Dispose old material if it exists
        if (child.material) {
          if (Array.isArray(child.material)) {
            child.material.forEach((m) => m.dispose());
          } else {
            child.material.dispose();
          }
        }

        child.material = material;
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });

    const group = new THREE.Group();
    group.add(model);

    return group;
  }

  /**
   * Creates a piece mesh, using GLB model if available or procedural fallback
   * Loads model fresh each time to avoid skeleton sharing issues with skinned meshes
   */
  async createPiece(type: PieceType, color: 'white' | 'black'): Promise<THREE.Group> {
    // Map PieceType to model name
    const typeToName: Record<PieceType, string> = {
      k: 'king',
      q: 'queen',
      r: 'rook',
      b: 'bishop',
      n: 'knight',
      p: 'pawn',
    };

    const key = `${color}-${typeToName[type]}`;

    if (this.modelPaths.has(key)) {
      try {
        const path = `/models/${key}.gltf`;
        const gltf = await this.loadModelAsync(path);
        return await this.createFromGLTF(gltf, color, type);
      } catch (error) {
        console.warn(`Failed to load model ${key}, using fallback`);
      }
    }

    // Fallback to procedural geometry
    return this.createProceduralPiece(type, color);
  }

  /**
   * Creates a procedural piece mesh (fallback when GLB not available)
   */
  private createProceduralPiece(type: PieceType, color: 'white' | 'black'): THREE.Group {
    const geometry = this.getGeometryForPiece(type);
    const material = color === 'white' ? this.whiteMaterial : this.blackMaterial;
    const mesh = new THREE.Mesh(geometry, material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;

    const group = new THREE.Group();
    group.add(mesh);
    return group;
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
   * Uses GLTF models if loaded, otherwise falls back to procedural geometry
   */
  public async addPiece(type: PieceType, color: PieceColor, position: Position): Promise<THREE.Object3D> {
    // Use createPiece which checks for GLTF models first
    const colorStr = color === 'w' ? 'white' : 'black';
    const pieceGroup = await this.createPiece(type, colorStr);

    // Get world position from chess board
    const worldPos = this.chessBoard.getSquarePosition(position.file, position.rank);
    pieceGroup.position.copy(worldPos);

    // Black pieces face opposite direction
    if (color === 'b') {
      pieceGroup.rotation.y = Math.PI;
    }

    // Enable shadows on all meshes in the group
    pieceGroup.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });

    // Store userData for identification
    pieceGroup.userData = {
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
    pieceGroup.name = `${color === 'w' ? 'White' : 'Black'}_${pieceNames[type]}_${String.fromCharCode(97 + position.file)}${position.rank + 1}`;

    // Add to group
    this.group.add(pieceGroup);

    // Store in pieces map
    const key = this.getPositionKey(position.file, position.rank);
    this.pieces.set(key, {
      mesh: pieceGroup,
      position: { ...position },
      type,
      color,
    });

    return pieceGroup;
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

    // Dispose geometries and materials in all child meshes
    pieceData.mesh.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        if (child.geometry) child.geometry.dispose();
        if (child.material) {
          if (Array.isArray(child.material)) {
            child.material.forEach(m => m.dispose());
          } else {
            child.material.dispose();
          }
        }
      }
    });

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
   * Animates a piece moving from one position to another with walk animation
   * @param from - Starting position
   * @param to - Destination position
   * @param duration - Optional movement duration in ms (default: auto-calculated based on distance)
   * @returns Promise that resolves when movement is complete
   */
  public async animateMovePiece(from: Position, to: Position, duration?: number): Promise<boolean> {
    const fromKey = this.getPositionKey(from.file, from.rank);
    const pieceData = this.pieces.get(fromKey);

    if (!pieceData) {
      return false;
    }

    // Remove any piece at destination (should be handled by GameState for captures)
    this.removePiece(to);

    // Get world positions
    const startPos = this.chessBoard.getSquarePosition(from.file, from.rank);
    const endPos = this.chessBoard.getSquarePosition(to.file, to.rank);

    // Calculate direction and distance
    const direction = new THREE.Vector3().subVectors(endPos, startPos);
    const distance = direction.length();
    direction.normalize();

    // Calculate duration based on distance (0.4s per square)
    const moveDuration = duration || Math.max(400, distance * 400);

    // Calculate target rotation to face movement direction
    const targetAngle = Math.atan2(direction.x, direction.z);

    // Get the inner model for animation (first child of the group is usually the GLTF scene)
    const innerModel = this.getInnerModel(pieceData.mesh);

    // Start walk animation if available
    if (innerModel && this.animationController) {
      // Smoothly rotate to face direction before walking
      await this.rotateToAngle(pieceData.mesh, targetAngle, 150);

      // Play walk animation
      if (this.animationController.hasAnimation(innerModel, 'walk')) {
        this.animationController.playAnimation(innerModel, 'walk', true);
      }
    }

    // Animate position
    await this.animatePosition(pieceData.mesh, startPos, endPos, moveDuration);

    // Stop walk and return to idle
    if (innerModel && this.animationController) {
      if (this.animationController.hasAnimation(innerModel, 'idle')) {
        this.animationController.playAnimation(innerModel, 'idle', true);
      }

      // Rotate back to default facing (black pieces face opposite)
      const defaultAngle = pieceData.color === 'b' ? Math.PI : 0;
      await this.rotateToAngle(pieceData.mesh, defaultAngle, 200);
    }

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
   * Gets the inner GLTF model from a piece group for animation purposes
   */
  private getInnerModel(pieceGroup: THREE.Object3D): THREE.Object3D | null {
    // The structure is: Group > GLTF Scene > SkinnedMesh
    // We need the GLTF Scene which has the animations registered
    if (pieceGroup.children.length > 0) {
      return pieceGroup.children[0];
    }
    return null;
  }

  /**
   * Smoothly rotates a mesh to a target angle
   */
  private rotateToAngle(mesh: THREE.Object3D, targetAngle: number, duration: number): Promise<void> {
    return new Promise((resolve) => {
      const startAngle = mesh.rotation.y;

      // Normalize angle difference to -PI to PI range
      let angleDiff = targetAngle - startAngle;
      while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
      while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;

      // Skip if angle is already correct
      if (Math.abs(angleDiff) < 0.01) {
        resolve();
        return;
      }

      const startTime = performance.now();

      const animate = () => {
        const elapsed = performance.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);

        // Ease-out for smooth deceleration
        const eased = 1 - Math.pow(1 - progress, 2);

        mesh.rotation.y = startAngle + angleDiff * eased;

        if (progress < 1) {
          requestAnimationFrame(animate);
        } else {
          mesh.rotation.y = targetAngle;
          resolve();
        }
      };

      requestAnimationFrame(animate);
    });
  }

  /**
   * Smoothly animates a mesh position from start to end
   */
  private animatePosition(
    mesh: THREE.Object3D,
    start: THREE.Vector3,
    end: THREE.Vector3,
    duration: number
  ): Promise<void> {
    return new Promise((resolve) => {
      const startTime = performance.now();

      const animate = () => {
        const elapsed = performance.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);

        // Ease-in-out for natural movement
        const eased = progress < 0.5
          ? 2 * progress * progress
          : 1 - Math.pow(-2 * progress + 2, 2) / 2;

        // Interpolate position
        mesh.position.lerpVectors(start, end, eased);

        if (progress < 1) {
          requestAnimationFrame(animate);
        } else {
          mesh.position.copy(end);
          resolve();
        }
      };

      requestAnimationFrame(animate);
    });
  }

  /**
   * Gets the piece data at a specified position
   */
  public getPieceAt(position: Position): PieceMeshData | null {
    const key = this.getPositionKey(position.file, position.rank);
    return this.pieces.get(key) || null;
  }

  /**
   * Gets the animation controller for external use (e.g., BattleManager)
   */
  public getAnimationController(): AnimationController | null {
    return this.animationController;
  }

  /**
   * Plays an animation on a piece at the given position
   * @param position - Position of the piece
   * @param animationName - Name of the animation to play
   * @param loop - Whether to loop the animation (default: false)
   * @returns Promise that resolves when animation finishes (or immediately if looping)
   */
  public async playPieceAnimation(
    position: Position,
    animationName: 'idle' | 'walk' | 'attack' | 'magic' | 'death',
    loop: boolean = false
  ): Promise<void> {
    const pieceData = this.getPieceAt(position);
    if (!pieceData || !this.animationController) return;

    const innerModel = this.getInnerModel(pieceData.mesh);
    if (!innerModel) return;

    if (this.animationController.hasAnimation(innerModel, animationName)) {
      await this.animationController.playAnimation(innerModel, animationName, loop);
    }
  }

  /**
   * Checks if a piece at the given position has a specific animation
   */
  public hasPieceAnimation(
    position: Position,
    animationName: 'idle' | 'walk' | 'attack' | 'magic' | 'death'
  ): boolean {
    const pieceData = this.getPieceAt(position);
    if (!pieceData || !this.animationController) return false;

    const innerModel = this.getInnerModel(pieceData.mesh);
    if (!innerModel) return false;

    return this.animationController.hasAnimation(innerModel, animationName);
  }

  /**
   * Clears all pieces from the board
   */
  public clearPieces(): void {
    this.pieces.forEach((pieceData) => {
      this.group.remove(pieceData.mesh);
      // Dispose geometries and materials in all child meshes
      pieceData.mesh.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          if (child.geometry) child.geometry.dispose();
          if (child.material) {
            if (Array.isArray(child.material)) {
              child.material.forEach(m => m.dispose());
            } else {
              child.material.dispose();
            }
          }
        }
      });
    });
    this.pieces.clear();
  }

  /**
   * Sets up all pieces from the initial board state
   */
  public async setupInitialPosition(boardState: (BoardSquare | null)[][]): Promise<void> {
    // Clear any existing pieces
    this.clearPieces();

    // Collect all pieces to add
    const addPromises: Promise<THREE.Object3D>[] = [];

    // Iterate through board state and create pieces
    for (let rank = 0; rank < 8; rank++) {
      for (let file = 0; file < 8; file++) {
        const square = boardState[rank][file];
        if (square) {
          addPromises.push(this.addPiece(square.type, square.color, { file, rank }));
        }
      }
    }

    // Wait for all pieces to be loaded
    await Promise.all(addPromises);
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
