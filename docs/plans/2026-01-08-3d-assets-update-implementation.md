# 3D Assets Update Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace procedural primitive geometry with stylized low-poly fantasy character models, PBR board textures, and enhanced battle particle effects.

**Architecture:** Load glTF/GLB models via Three.js GLTFLoader, integrate AnimationMixer for pre-rigged animations with procedural fallbacks, apply PBR texture maps to board materials, and enhance particle system with object pooling.

**Tech Stack:** Three.js (GLTFLoader, AnimationMixer, TextureLoader), TypeScript, Vite

---

## Phase 1: Asset Acquisition & Directory Setup

### Task 1: Create Asset Directory Structure

**Files:**
- Create: `public/models/.gitkeep`
- Create: `public/textures/board/.gitkeep`
- Create: `public/textures/particles/.gitkeep`

**Step 1: Create directories**

```bash
mkdir -p public/models public/textures/board public/textures/particles
touch public/models/.gitkeep public/textures/board/.gitkeep public/textures/particles/.gitkeep
```

**Step 2: Verify structure**

```bash
ls -la public/models public/textures/board public/textures/particles
```

Expected: Empty directories with .gitkeep files

**Step 3: Commit**

```bash
git add public/models public/textures
git commit -m "chore: create asset directory structure for 3D models and textures"
```

---

### Task 2: Download Board Textures from ambientCG

**Files:**
- Download: `public/textures/board/light_albedo.jpg`
- Download: `public/textures/board/light_normal.jpg`
- Download: `public/textures/board/light_roughness.jpg`
- Download: `public/textures/board/dark_albedo.jpg`
- Download: `public/textures/board/dark_normal.jpg`
- Download: `public/textures/board/dark_roughness.jpg`

**Step 1: Download light square texture (Marble)**

Visit: https://ambientcg.com/view?id=Marble012
Download 1K-JPG pack, extract and rename:
- `Marble012_1K-JPG_Color.jpg` → `light_albedo.jpg`
- `Marble012_1K-JPG_NormalGL.jpg` → `light_normal.jpg`
- `Marble012_1K-JPG_Roughness.jpg` → `light_roughness.jpg`

**Step 2: Download dark square texture (Slate/Rock)**

Visit: https://ambientcg.com/view?id=Rock034
Download 1K-JPG pack, extract and rename:
- `Rock034_1K-JPG_Color.jpg` → `dark_albedo.jpg`
- `Rock034_1K-JPG_NormalGL.jpg` → `dark_normal.jpg`
- `Rock034_1K-JPG_Roughness.jpg` → `dark_roughness.jpg`

**Step 3: Verify files exist**

```bash
ls -la public/textures/board/
```

Expected: 6 texture files (light_*.jpg, dark_*.jpg)

**Step 4: Commit**

```bash
git add public/textures/board/
git commit -m "feat: add PBR board textures from ambientCG"
```

---

### Task 3: Create Particle Sprite Texture

**Files:**
- Create: `public/textures/particles/spark.png`

**Step 1: Create soft circle sprite**

Create a 64x64 PNG with radial gradient (white center fading to transparent).
Options:
- Use image editor (GIMP/Photoshop)
- Download from Kenney particles pack: https://kenney.nl/assets/particle-pack
- Use online generator

**Step 2: Place in directory**

```bash
cp spark.png public/textures/particles/spark.png
ls -la public/textures/particles/
```

Expected: spark.png file present

**Step 3: Commit**

```bash
git add public/textures/particles/
git commit -m "feat: add particle spark sprite texture"
```

---

### Task 4: Download Character Models from Quaternius

**Files:**
- Download: Multiple .glb files to `public/models/`

**Step 1: Download Quaternius Ultimate Modular Characters**

Visit: https://quaternius.com/packs/ultimatemodularcharacters.html
Download the pack (free, CC0 license)

**Step 2: Select and rename models for Light Army**

From the pack, select appropriate models and convert/rename:
- Mage → `white-king.glb` (High Wizard)
- Mage_Female → `white-queen.glb` (Arch Mage)
- Priest → `white-bishop.glb` (Battle Priest)
- Knight → `white-knight.glb` (placeholder until Gryphon Rider)
- Golem → `white-rook.glb` (Golem)
- Rogue → `white-pawn.glb` (Apprentice)

**Step 3: Download Quaternius Skeleton Pack for Dark Army**

Visit: https://quaternius.com/packs/skeletonpack.html
- Skeleton_Mage → `black-king.glb` (Lich King)
- Skeleton_Mage → `black-queen.glb` (Dark Sorceress - different pose)
- Skeleton_Minion → `black-bishop.glb` (Necromancer)
- Skeleton_Warrior → `black-knight.glb` (Death Knight)
- Skeleton_Minion_Large → `black-rook.glb` (Bone Colossus)
- Skeleton_Minion → `black-pawn.glb` (Skeleton Warrior)

**Step 4: Verify 12 model files**

```bash
ls -la public/models/*.glb
```

Expected: 12 .glb files (white-*.glb, black-*.glb for each piece type)

**Step 5: Commit**

```bash
git add public/models/
git commit -m "feat: add fantasy character models from Quaternius"
```

---

## Phase 2: Texture Manager Implementation

### Task 5: Create TextureManager Class

**Files:**
- Create: `src/graphics/TextureManager.ts`

**Step 1: Create TextureManager file**

```typescript
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
```

**Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit src/graphics/TextureManager.ts
```

Expected: No errors

**Step 3: Commit**

```bash
git add src/graphics/TextureManager.ts
git commit -m "feat: add TextureManager for PBR texture loading"
```

---

### Task 6: Update Board.ts to Use PBR Textures

**Files:**
- Modify: `src/graphics/Board.ts`

**Step 1: Add TextureManager import and property**

At top of Board.ts, add:

```typescript
import { TextureManager, PBRTextures } from './TextureManager';
```

**Step 2: Add texture loading method to Board class**

Add new method:

```typescript
async loadTextures(textureManager: TextureManager): Promise<void> {
  const { light, dark } = await textureManager.loadBoardTextures();

  // Update light square materials
  this.lightSquareMaterial.map = light.map;
  this.lightSquareMaterial.normalMap = light.normalMap;
  this.lightSquareMaterial.roughnessMap = light.roughnessMap;
  this.lightSquareMaterial.needsUpdate = true;

  // Update dark square materials
  this.darkSquareMaterial.map = dark.map;
  this.darkSquareMaterial.normalMap = dark.normalMap;
  this.darkSquareMaterial.roughnessMap = dark.roughnessMap;
  this.darkSquareMaterial.needsUpdate = true;
}
```

**Step 3: Verify build passes**

```bash
npm run build
```

Expected: Build succeeds

**Step 4: Commit**

```bash
git add src/graphics/Board.ts
git commit -m "feat: add PBR texture support to Board"
```

---

## Phase 3: Model Loading System

### Task 7: Create AnimationController Class

**Files:**
- Create: `src/graphics/AnimationController.ts`

**Step 1: Create AnimationController file**

```typescript
import * as THREE from 'three';

export type AnimationName = 'idle' | 'walk' | 'attack' | 'magic' | 'death';

interface MixerEntry {
  mixer: THREE.AnimationMixer;
  clips: Map<string, THREE.AnimationClip>;
  currentAction: THREE.AnimationAction | null;
}

export class AnimationController {
  private mixers: Map<THREE.Object3D, MixerEntry> = new Map();
  private clock: THREE.Clock;

  constructor() {
    this.clock = new THREE.Clock();
  }

  registerModel(model: THREE.Object3D, clips: THREE.AnimationClip[]): void {
    const mixer = new THREE.AnimationMixer(model);
    const clipMap = new Map<string, THREE.AnimationClip>();

    clips.forEach((clip) => {
      // Normalize animation names
      const name = this.normalizeAnimationName(clip.name);
      clipMap.set(name, clip);
    });

    this.mixers.set(model, {
      mixer,
      clips: clipMap,
      currentAction: null,
    });

    // Auto-play idle if available
    if (clipMap.has('idle')) {
      this.playAnimation(model, 'idle', true);
    }
  }

  private normalizeAnimationName(name: string): string {
    const lower = name.toLowerCase();
    if (lower.includes('idle')) return 'idle';
    if (lower.includes('walk') || lower.includes('run')) return 'walk';
    if (lower.includes('attack') || lower.includes('hit')) return 'attack';
    if (lower.includes('magic') || lower.includes('cast')) return 'magic';
    if (lower.includes('death') || lower.includes('die')) return 'death';
    return lower;
  }

  playAnimation(
    model: THREE.Object3D,
    name: AnimationName,
    loop: boolean = false
  ): Promise<void> {
    return new Promise((resolve) => {
      const entry = this.mixers.get(model);
      if (!entry) {
        resolve();
        return;
      }

      const clip = entry.clips.get(name);
      if (!clip) {
        resolve();
        return;
      }

      // Stop current animation
      if (entry.currentAction) {
        entry.currentAction.fadeOut(0.2);
      }

      // Play new animation
      const action = entry.mixer.clipAction(clip);
      action.reset();
      action.setLoop(loop ? THREE.LoopRepeat : THREE.LoopOnce, loop ? Infinity : 1);
      action.clampWhenFinished = !loop;
      action.fadeIn(0.2);
      action.play();

      entry.currentAction = action;

      if (!loop) {
        const onFinished = () => {
          entry.mixer.removeEventListener('finished', onFinished);
          resolve();
        };
        entry.mixer.addEventListener('finished', onFinished);
      } else {
        resolve();
      }
    });
  }

  hasAnimation(model: THREE.Object3D, name: AnimationName): boolean {
    const entry = this.mixers.get(model);
    return entry?.clips.has(name) ?? false;
  }

  update(): void {
    const delta = this.clock.getDelta();
    this.mixers.forEach((entry) => {
      entry.mixer.update(delta);
    });
  }

  unregisterModel(model: THREE.Object3D): void {
    const entry = this.mixers.get(model);
    if (entry) {
      entry.mixer.stopAllAction();
      this.mixers.delete(model);
    }
  }

  dispose(): void {
    this.mixers.forEach((entry) => {
      entry.mixer.stopAllAction();
    });
    this.mixers.clear();
  }
}
```

**Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit src/graphics/AnimationController.ts
```

Expected: No errors

**Step 3: Commit**

```bash
git add src/graphics/AnimationController.ts
git commit -m "feat: add AnimationController for model animations"
```

---

### Task 8: Update PieceRenderer to Load GLB Models

**Files:**
- Modify: `src/graphics/PieceRenderer.ts`

**Step 1: Add GLTFLoader import**

At top of file:

```typescript
import { GLTFLoader, GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { AnimationController } from './AnimationController';
```

**Step 2: Add model cache and loader properties**

In PieceRenderer class, add properties:

```typescript
private gltfLoader: GLTFLoader;
private modelCache: Map<string, GLTF> = new Map();
private animationController: AnimationController;
private modelsLoaded: boolean = false;
```

**Step 3: Add loadModels method**

```typescript
async loadModels(animationController: AnimationController): Promise<void> {
  this.animationController = animationController;
  this.gltfLoader = new GLTFLoader();

  const pieces = ['king', 'queen', 'bishop', 'knight', 'rook', 'pawn'];
  const colors = ['white', 'black'];

  const loadPromises: Promise<void>[] = [];

  for (const color of colors) {
    for (const piece of pieces) {
      const key = `${color}-${piece}`;
      const path = `/models/${key}.glb`;

      loadPromises.push(
        new Promise((resolve, reject) => {
          this.gltfLoader.load(
            path,
            (gltf) => {
              this.modelCache.set(key, gltf);
              resolve();
            },
            undefined,
            (error) => {
              console.warn(`Failed to load model ${path}, using fallback`);
              resolve(); // Don't reject, use procedural fallback
            }
          );
        })
      );
    }
  }

  await Promise.all(loadPromises);
  this.modelsLoaded = true;
}
```

**Step 4: Modify createPiece to use loaded models**

Update the createPiece method to check for loaded models first:

```typescript
createPiece(type: PieceType, color: 'white' | 'black'): THREE.Group {
  const key = `${color}-${type}`;
  const gltf = this.modelCache.get(key);

  if (gltf) {
    return this.createFromGLTF(gltf, color);
  }

  // Fallback to procedural geometry
  return this.createProceduralPiece(type, color);
}

private createFromGLTF(gltf: GLTF, color: 'white' | 'black'): THREE.Group {
  const model = gltf.scene.clone();

  // Scale model to fit chess piece dimensions
  const box = new THREE.Box3().setFromObject(model);
  const size = box.getSize(new THREE.Vector3());
  const maxDim = Math.max(size.x, size.y, size.z);
  const scale = 1.0 / maxDim; // Normalize to ~1 unit
  model.scale.setScalar(scale);

  // Center model
  box.setFromObject(model);
  const center = box.getCenter(new THREE.Vector3());
  model.position.sub(center);
  model.position.y = 0;

  // Register animations if available
  if (gltf.animations.length > 0 && this.animationController) {
    this.animationController.registerModel(model, gltf.animations);
  }

  // Apply color tinting
  model.traverse((child) => {
    if (child instanceof THREE.Mesh && child.material) {
      const material = (child.material as THREE.MeshStandardMaterial).clone();
      if (color === 'white') {
        material.emissive = new THREE.Color(0xffd700);
        material.emissiveIntensity = 0.05;
      } else {
        material.emissive = new THREE.Color(0x6b4c9a);
        material.emissiveIntensity = 0.1;
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

private createProceduralPiece(type: PieceType, color: 'white' | 'black'): THREE.Group {
  // Move existing procedural geometry code here
  // (Keep as fallback)
}
```

**Step 5: Verify build passes**

```bash
npm run build
```

Expected: Build succeeds

**Step 6: Commit**

```bash
git add src/graphics/PieceRenderer.ts
git commit -m "feat: add GLB model loading with procedural fallback"
```

---

## Phase 4: Particle System Enhancement

### Task 9: Create ParticlePool Class

**Files:**
- Create: `src/battle/particles/ParticlePool.ts`

**Step 1: Create particles directory and ParticlePool file**

```bash
mkdir -p src/battle/particles
```

```typescript
import * as THREE from 'three';

interface Particle {
  mesh: THREE.Mesh;
  velocity: THREE.Vector3;
  life: number;
  maxLife: number;
  active: boolean;
}

export class ParticlePool {
  private particles: Particle[] = [];
  private geometry: THREE.SphereGeometry;
  private material: THREE.MeshBasicMaterial;
  private parent: THREE.Object3D;

  constructor(
    parent: THREE.Object3D,
    poolSize: number = 200,
    texture?: THREE.Texture
  ) {
    this.parent = parent;
    this.geometry = new THREE.SphereGeometry(0.03, 8, 8);

    this.material = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    if (texture) {
      this.material.map = texture;
    }

    // Pre-allocate particles
    for (let i = 0; i < poolSize; i++) {
      const mesh = new THREE.Mesh(this.geometry, this.material.clone());
      mesh.visible = false;
      parent.add(mesh);

      this.particles.push({
        mesh,
        velocity: new THREE.Vector3(),
        life: 0,
        maxLife: 1,
        active: false,
      });
    }
  }

  spawn(
    position: THREE.Vector3,
    velocity: THREE.Vector3,
    color: THREE.Color,
    life: number = 1
  ): void {
    const particle = this.particles.find((p) => !p.active);
    if (!particle) return;

    particle.mesh.position.copy(position);
    particle.velocity.copy(velocity);
    particle.life = life;
    particle.maxLife = life;
    particle.active = true;
    particle.mesh.visible = true;

    (particle.mesh.material as THREE.MeshBasicMaterial).color.copy(color);
    (particle.mesh.material as THREE.MeshBasicMaterial).opacity = 1;
    particle.mesh.scale.setScalar(1);
  }

  spawnBurst(
    position: THREE.Vector3,
    count: number,
    color: THREE.Color,
    speed: number = 2,
    life: number = 0.8
  ): void {
    for (let i = 0; i < count; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.random() * Math.PI;

      const velocity = new THREE.Vector3(
        Math.sin(phi) * Math.cos(theta) * speed,
        Math.sin(phi) * Math.sin(theta) * speed + 1, // Bias upward
        Math.cos(phi) * speed
      );

      this.spawn(position.clone(), velocity, color, life);
    }
  }

  spawnTrail(
    start: THREE.Vector3,
    end: THREE.Vector3,
    count: number,
    color: THREE.Color
  ): void {
    for (let i = 0; i < count; i++) {
      const t = i / count;
      const position = new THREE.Vector3().lerpVectors(start, end, t);
      const velocity = new THREE.Vector3(
        (Math.random() - 0.5) * 0.5,
        Math.random() * 0.5,
        (Math.random() - 0.5) * 0.5
      );
      this.spawn(position, velocity, color, 0.5);
    }
  }

  update(deltaTime: number): void {
    const gravity = -3;

    this.particles.forEach((particle) => {
      if (!particle.active) return;

      // Update position
      particle.mesh.position.add(
        particle.velocity.clone().multiplyScalar(deltaTime)
      );

      // Apply gravity
      particle.velocity.y += gravity * deltaTime;

      // Update life
      particle.life -= deltaTime;

      // Fade out
      const lifeRatio = particle.life / particle.maxLife;
      (particle.mesh.material as THREE.MeshBasicMaterial).opacity = lifeRatio;
      particle.mesh.scale.setScalar(0.5 + lifeRatio * 0.5);

      // Deactivate dead particles
      if (particle.life <= 0) {
        particle.active = false;
        particle.mesh.visible = false;
      }
    });
  }

  dispose(): void {
    this.particles.forEach((particle) => {
      this.parent.remove(particle.mesh);
      particle.mesh.geometry.dispose();
      (particle.mesh.material as THREE.Material).dispose();
    });
    this.particles = [];
    this.geometry.dispose();
    this.material.dispose();
  }
}
```

**Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit src/battle/particles/ParticlePool.ts
```

Expected: No errors

**Step 3: Commit**

```bash
git add src/battle/particles/
git commit -m "feat: add ParticlePool for efficient particle management"
```

---

### Task 10: Create Particle Effects Presets

**Files:**
- Create: `src/battle/particles/effects.ts`

**Step 1: Create effects presets file**

```typescript
import * as THREE from 'three';
import { ParticlePool } from './ParticlePool';

export const COLORS = {
  lightMagic: new THREE.Color(0xffd700), // Gold
  darkMagic: new THREE.Color(0x9b59b6), // Purple
  lightSoul: new THREE.Color(0xf5e6d3), // Cream
  darkSoul: new THREE.Color(0x6b4c9a), // Dark purple
  impact: new THREE.Color(0xffffff), // White
  spark: new THREE.Color(0xffaa00), // Orange
};

export function spawnMagicCharge(
  pool: ParticlePool,
  center: THREE.Vector3,
  color: 'white' | 'black'
): void {
  const particleColor = color === 'white' ? COLORS.lightMagic : COLORS.darkMagic;

  for (let i = 0; i < 25; i++) {
    const angle = (i / 25) * Math.PI * 2;
    const radius = 0.8;
    const position = new THREE.Vector3(
      center.x + Math.cos(angle) * radius,
      center.y + 0.5,
      center.z + Math.sin(angle) * radius
    );

    const velocity = new THREE.Vector3(
      (center.x - position.x) * 2,
      0.5,
      (center.z - position.z) * 2
    );

    pool.spawn(position, velocity, particleColor, 0.4);
  }
}

export function spawnMagicProjectileTrail(
  pool: ParticlePool,
  position: THREE.Vector3,
  color: 'white' | 'black'
): void {
  const particleColor = color === 'white' ? COLORS.lightMagic : COLORS.darkMagic;

  for (let i = 0; i < 5; i++) {
    const offset = new THREE.Vector3(
      (Math.random() - 0.5) * 0.2,
      (Math.random() - 0.5) * 0.2,
      (Math.random() - 0.5) * 0.2
    );

    const velocity = new THREE.Vector3(
      (Math.random() - 0.5) * 0.5,
      Math.random() * 0.3,
      (Math.random() - 0.5) * 0.5
    );

    pool.spawn(position.clone().add(offset), velocity, particleColor, 0.3);
  }
}

export function spawnMeleeImpact(
  pool: ParticlePool,
  position: THREE.Vector3
): void {
  pool.spawnBurst(position, 30, COLORS.spark, 3, 0.6);
}

export function spawnDeathDissolve(
  pool: ParticlePool,
  position: THREE.Vector3,
  color: 'white' | 'black'
): void {
  const particleColor = color === 'white' ? COLORS.lightSoul : COLORS.darkSoul;

  // Soul wisps floating upward
  for (let i = 0; i < 20; i++) {
    const offset = new THREE.Vector3(
      (Math.random() - 0.5) * 0.5,
      Math.random() * 0.8,
      (Math.random() - 0.5) * 0.5
    );

    const velocity = new THREE.Vector3(
      (Math.random() - 0.5) * 0.3,
      0.5 + Math.random() * 0.5,
      (Math.random() - 0.5) * 0.3
    );

    pool.spawn(position.clone().add(offset), velocity, particleColor, 0.8);
  }

  // Dissolve particles
  for (let i = 0; i < 50; i++) {
    const offset = new THREE.Vector3(
      (Math.random() - 0.5) * 0.6,
      Math.random() * 1.2,
      (Math.random() - 0.5) * 0.6
    );

    const velocity = new THREE.Vector3(
      (Math.random() - 0.5) * 1.5,
      Math.random() * 2,
      (Math.random() - 0.5) * 1.5
    );

    pool.spawn(position.clone().add(offset), velocity, COLORS.impact, 0.5);
  }
}
```

**Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit src/battle/particles/effects.ts
```

Expected: No errors

**Step 3: Commit**

```bash
git add src/battle/particles/effects.ts
git commit -m "feat: add particle effect presets for battle animations"
```

---

## Phase 5: Integration

### Task 11: Update BattleManager to Use New Particle System

**Files:**
- Modify: `src/battle/BattleManager.ts`

**Step 1: Import new particle system**

Add imports:

```typescript
import { ParticlePool } from './particles/ParticlePool';
import * as effects from './particles/effects';
```

**Step 2: Add ParticlePool property and initialization**

Add property:

```typescript
private particlePool: ParticlePool;
```

In constructor or init method:

```typescript
this.particlePool = new ParticlePool(this.scene, 200);
```

**Step 3: Replace existing particle spawning with new effects**

Update magic attack to use:

```typescript
effects.spawnMagicCharge(this.particlePool, attackerPosition, attackerColor);
// During projectile flight:
effects.spawnMagicProjectileTrail(this.particlePool, projectilePosition, attackerColor);
```

Update melee impact:

```typescript
effects.spawnMeleeImpact(this.particlePool, impactPosition);
```

Update death animation:

```typescript
effects.spawnDeathDissolve(this.particlePool, defenderPosition, defenderColor);
```

**Step 4: Add particle update to animation loop**

In update method:

```typescript
this.particlePool.update(deltaTime);
```

**Step 5: Verify build passes**

```bash
npm run build
```

Expected: Build succeeds

**Step 6: Commit**

```bash
git add src/battle/BattleManager.ts
git commit -m "feat: integrate ParticlePool into BattleManager"
```

---

### Task 12: Update Scene.ts for Animation Updates

**Files:**
- Modify: `src/graphics/Scene.ts`

**Step 1: Add AnimationController property**

Add import and property:

```typescript
import { AnimationController } from './AnimationController';

// In class:
private animationController: AnimationController;
```

**Step 2: Initialize AnimationController**

In constructor:

```typescript
this.animationController = new AnimationController();
```

**Step 3: Add getter for AnimationController**

```typescript
getAnimationController(): AnimationController {
  return this.animationController;
}
```

**Step 4: Update render loop to include animation updates**

In animate/render method:

```typescript
this.animationController.update();
```

**Step 5: Verify build passes**

```bash
npm run build
```

Expected: Build succeeds

**Step 6: Commit**

```bash
git add src/graphics/Scene.ts
git commit -m "feat: integrate AnimationController into Scene render loop"
```

---

### Task 13: Update main.ts to Initialize Asset Loading

**Files:**
- Modify: `src/main.ts`

**Step 1: Add TextureManager initialization**

Add import:

```typescript
import { TextureManager } from './graphics/TextureManager';
```

**Step 2: Create loading sequence**

Before game initialization:

```typescript
async function loadAssets(): Promise<void> {
  const textureManager = new TextureManager();

  // Load board textures
  await board.loadTextures(textureManager);

  // Load piece models
  const animationController = scene.getAnimationController();
  await pieceRenderer.loadModels(animationController);

  // Load particle texture
  const particleTexture = await textureManager.loadParticleTexture();
  battleManager.setParticleTexture(particleTexture);
}

// Call during initialization
await loadAssets();
```

**Step 3: Add loading indicator (optional)**

```typescript
const loadingDiv = document.getElementById('loading');
if (loadingDiv) {
  loadingDiv.style.display = 'block';
}

await loadAssets();

if (loadingDiv) {
  loadingDiv.style.display = 'none';
}
```

**Step 4: Verify build passes**

```bash
npm run build
```

Expected: Build succeeds

**Step 5: Commit**

```bash
git add src/main.ts
git commit -m "feat: add asset loading initialization to main"
```

---

## Phase 6: Testing & Polish

### Task 14: Test Model Loading

**Step 1: Start dev server**

```bash
npm run dev
```

**Step 2: Open browser and check console**

Navigate to http://localhost:5173
Open DevTools (F12) and check Console for errors

**Step 3: Verify pieces render**

- All 12 piece types should be visible
- If models failed to load, procedural fallbacks should appear
- No console errors about missing files

**Step 4: Document any issues**

If models don't load:
- Check file paths in public/models/
- Verify .glb file format is correct
- Check network tab for 404 errors

---

### Task 15: Test Board Textures

**Step 1: Verify board textures loaded**

- Light squares should show marble texture
- Dark squares should show dark stone texture
- Normal maps should add depth/detail

**Step 2: Check texture tiling**

- Textures should tile correctly (no obvious seams)
- UV mapping should be 1:1 per square

**Step 3: Document any issues**

If textures don't appear:
- Check file paths in public/textures/board/
- Verify texture files are valid JPGs
- Check console for loading errors

---

### Task 16: Test Battle Animations

**Step 1: Make a capture move**

Play a game and capture an opponent's piece

**Step 2: Verify particle effects**

- Magic pieces (K, Q, B): Should see magic charge + projectile trail
- Melee pieces (R, N, P): Should see impact sparks
- Death: Should see soul wisps + dissolve particles

**Step 3: Verify camera transition**

- Camera should smoothly zoom to battle view
- Should return to board view after animation

**Step 4: Document any issues**

Note any timing issues, missing effects, or visual glitches

---

### Task 17: Final Commit and Build Verification

**Step 1: Run final build**

```bash
npm run build
```

Expected: Build succeeds with no errors

**Step 2: Test production build**

```bash
npm run preview
```

Navigate to preview URL and verify everything works

**Step 3: Create summary commit**

```bash
git add -A
git commit -m "feat: complete 3D assets update - models, textures, and particles

- Add fantasy character models from Quaternius
- Add PBR board textures from ambientCG
- Implement TextureManager for texture loading
- Implement AnimationController for model animations
- Add ParticlePool with object pooling
- Add battle particle effects (magic, melee, death)
- Update Board, PieceRenderer, BattleManager, Scene integration

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Summary

| Phase | Tasks | Description |
|-------|-------|-------------|
| 1 | 1-4 | Asset acquisition and directory setup |
| 2 | 5-6 | TextureManager implementation |
| 3 | 7-8 | Model loading system |
| 4 | 9-10 | Particle system enhancement |
| 5 | 11-13 | Integration with existing code |
| 6 | 14-17 | Testing and polish |

**Total Tasks:** 17
**Estimated Commits:** 15+
