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

  async loadPBRTextures(basePath: string, prefix: string): Promise<PBRTextures> {
    const [map, normalMap, roughnessMap] = await Promise.all([
      this.loadTexture(`${basePath}/${prefix}_albedo.jpg`),
      this.loadTexture(`${basePath}/${prefix}_normal.jpg`),
      this.loadTexture(`${basePath}/${prefix}_roughness.jpg`),
    ]);

    return { map, normalMap, roughnessMap };
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
