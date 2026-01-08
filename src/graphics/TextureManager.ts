import * as THREE from 'three';

export interface PBRTextures {
  map: THREE.Texture;
  normalMap: THREE.Texture;
  roughnessMap: THREE.Texture;
}

export class TextureManager {
  private textureLoader: THREE.TextureLoader;
  private textureCache: Map<string, THREE.Texture> = new Map();

  constructor() {
    this.textureLoader = new THREE.TextureLoader();
  }

  async loadTexture(path: string): Promise<THREE.Texture> {
    if (this.textureCache.has(path)) {
      return this.textureCache.get(path)!;
    }

    return new Promise((resolve, reject) => {
      this.textureLoader.load(
        path,
        (texture) => {
          texture.wrapS = THREE.RepeatWrapping;
          texture.wrapT = THREE.RepeatWrapping;
          this.textureCache.set(path, texture);
          resolve(texture);
        },
        undefined,
        reject
      );
    });
  }

  /**
   * Attempts to load a texture, returning null if it fails
   */
  private async tryLoadTexture(path: string): Promise<THREE.Texture | null> {
    return new Promise((resolve) => {
      this.textureLoader.load(
        path,
        (texture) => {
          texture.wrapS = THREE.RepeatWrapping;
          texture.wrapT = THREE.RepeatWrapping;
          this.textureCache.set(path, texture);
          resolve(texture);
        },
        undefined,
        () => {
          // Texture not found, return null instead of rejecting
          resolve(null);
        }
      );
    });
  }

  async loadPBRTextures(basePath: string, prefix: string): Promise<PBRTextures> {
    // Load albedo (required), normal and roughness (optional)
    const [map, normalMap, roughnessMap] = await Promise.all([
      this.loadTexture(`${basePath}/${prefix}_albedo.jpg`),
      this.tryLoadTexture(`${basePath}/${prefix}_normal.jpg`),
      this.tryLoadTexture(`${basePath}/${prefix}_roughness.jpg`),
    ]);

    return {
      map,
      normalMap: normalMap || this.createDefaultNormalMap(),
      roughnessMap: roughnessMap || this.createDefaultRoughnessMap(),
    };
  }

  /**
   * Creates a default flat normal map (neutral blue)
   */
  private createDefaultNormalMap(): THREE.Texture {
    const canvas = document.createElement('canvas');
    canvas.width = 2;
    canvas.height = 2;
    const ctx = canvas.getContext('2d')!;
    // Neutral normal map color (128, 128, 255) = no normal offset
    ctx.fillStyle = '#8080ff';
    ctx.fillRect(0, 0, 2, 2);
    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    return texture;
  }

  /**
   * Creates a default roughness map (medium gray)
   */
  private createDefaultRoughnessMap(): THREE.Texture {
    const canvas = document.createElement('canvas');
    canvas.width = 2;
    canvas.height = 2;
    const ctx = canvas.getContext('2d')!;
    // Medium roughness (gray ~128)
    ctx.fillStyle = '#808080';
    ctx.fillRect(0, 0, 2, 2);
    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    return texture;
  }

  async loadBoardTextures(): Promise<{ light: PBRTextures; dark: PBRTextures }> {
    const [light, dark] = await Promise.all([
      this.loadPBRTextures('/textures/board', 'light'),
      this.loadPBRTextures('/textures/board', 'dark'),
    ]);

    return { light, dark };
  }

  async loadParticleTexture(): Promise<THREE.Texture> {
    return this.loadTexture('/textures/particles/spark.png');
  }

  dispose(): void {
    this.textureCache.forEach((texture) => texture.dispose());
    this.textureCache.clear();
  }
}
