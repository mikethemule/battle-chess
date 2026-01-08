import * as THREE from 'three';
import type { Position, PieceType, PieceColor } from '../core/types';
import { CameraController } from '../graphics/CameraController';
import { PieceRenderer } from '../graphics/PieceRenderer';
import { ParticlePool } from './particles/ParticlePool';
import * as effects from './particles/effects';

/**
 * Particle data structure for managing particle systems
 */
interface ParticleData {
  points: THREE.Points;
  velocities: THREE.Vector3[];
  startTime: number;
  duration: number;
}

/**
 * BattleManager - Handles dramatic battle animations when pieces capture
 * Creates cinematic camera transitions, attack animations, and particle effects
 */
export class BattleManager {
  private scene: THREE.Scene;
  private cameraController: CameraController;
  private pieceRenderer: PieceRenderer;
  private particlePool: ParticlePool;

  // Active particle systems (legacy)
  private particles: ParticleData[] = [];

  // Animation state
  private isPlaying = false;

  // Particle animation frame ID
  private particleAnimationId: number | null = null;

  constructor(
    scene: THREE.Scene,
    cameraController: CameraController,
    pieceRenderer: PieceRenderer
  ) {
    this.scene = scene;
    this.cameraController = cameraController;
    this.pieceRenderer = pieceRenderer;
    this.particlePool = new ParticlePool(this.scene, 200);
  }

  /**
   * Check if a battle animation is currently playing
   */
  public getIsPlaying(): boolean {
    return this.isPlaying;
  }

  /**
   * Play a complete battle sequence
   * @param attackerPos - Position of the attacking piece
   * @param defenderPos - Position of the defending piece
   * @param attackerType - Type of the attacking piece
   * @param attackerColor - Color of the attacking piece
   */
  async playBattle(
    attackerPos: Position,
    defenderPos: Position,
    attackerType: PieceType,
    attackerColor: PieceColor
  ): Promise<void> {
    if (this.isPlaying) return;
    this.isPlaying = true;

    try {
      // 1. Camera transition to battle view
      await this.cameraController.transitionToBattle(attackerPos, defenderPos);

      // 2. Play attack animation based on piece type
      await this.playAttackAnimation(
        attackerPos,
        defenderPos,
        attackerType,
        attackerColor
      );

      // 3. Play death animation for defender
      await this.playDeathAnimation(defenderPos);

      // 4. Brief pause for dramatic effect
      await this.delay(300);

      // 5. Return camera to default view
      await this.cameraController.returnToDefault();

      // 6. Cleanup any remaining particles
      this.cleanupParticles();
    } finally {
      this.isPlaying = false;
    }
  }

  /**
   * Play attack animation based on piece type
   * Magic users (k, q, b) use projectile attacks
   * Physical pieces (r, n, p) use melee lunges
   */
  private async playAttackAnimation(
    attackerPos: Position,
    defenderPos: Position,
    attackerType: PieceType,
    attackerColor: PieceColor
  ): Promise<void> {
    const board = this.cameraController.getBoard();
    const attackerWorld = board.getSquarePosition(
      attackerPos.file,
      attackerPos.rank
    );
    const defenderWorld = board.getSquarePosition(
      defenderPos.file,
      defenderPos.rank
    );

    // Get attacker mesh
    const attackerData = this.pieceRenderer.getPieceAt(attackerPos);
    if (!attackerData) return;

    // Determine attack type based on piece
    const isMagicUser = ['k', 'q', 'b'].includes(attackerType);

    if (isMagicUser) {
      // Magic attack: projectile with particle trail
      const magicColor = attackerColor === 'w' ? 0xffd700 : 0x9966ff;
      const colorName: 'white' | 'black' = attackerColor === 'w' ? 'white' : 'black';
      await this.playMagicBlast(attackerWorld, defenderWorld, magicColor, colorName);
    } else {
      // Physical attack: melee lunge
      await this.playMeleeAttack(
        attackerData.mesh,
        attackerWorld,
        defenderWorld
      );
    }
  }

  /**
   * Play a magic projectile attack
   * @param from - Start world position
   * @param to - Target world position
   * @param color - Color of the magic effect
   * @param attackerColor - 'white' or 'black' for new particle effects
   */
  private async playMagicBlast(
    from: THREE.Vector3,
    to: THREE.Vector3,
    color: number,
    attackerColor: 'white' | 'black' = 'white'
  ): Promise<void> {
    // Create glowing sphere projectile
    const projectileGeometry = new THREE.SphereGeometry(0.15, 16, 16);
    const projectileMaterial = new THREE.MeshBasicMaterial({
      color: color,
      transparent: true,
      opacity: 1,
    });
    const projectile = new THREE.Mesh(projectileGeometry, projectileMaterial);

    // Position at attacker (slightly above)
    projectile.position.copy(from);
    projectile.position.y = 0.8;

    // Add glow effect using point light
    const glow = new THREE.PointLight(color, 2, 3);
    projectile.add(glow);

    this.scene.add(projectile);

    // Target position (slightly above)
    const targetPos = to.clone();
    targetPos.y = 0.8;

    // Animate projectile to target
    const duration = 400;
    const startTime = performance.now();
    let lastTime = startTime;
    const startPos = projectile.position.clone();

    // Create particle trail (legacy)
    this.createMagicParticles(from, color);

    // Spawn new pooled magic charge particles
    effects.spawnMagicCharge(this.particlePool, from, attackerColor);

    await new Promise<void>((resolve) => {
      const animate = (currentTime: number) => {
        const elapsed = currentTime - startTime;
        const deltaTime = (currentTime - lastTime) / 1000;
        lastTime = currentTime;
        const progress = Math.min(elapsed / duration, 1);
        const eased = this.easeOutQuad(progress);

        // Update particle pool
        this.particlePool.update(deltaTime);

        // Move projectile
        projectile.position.lerpVectors(startPos, targetPos, eased);

        // Create trail particles (legacy and new)
        if (progress < 0.9 && Math.random() > 0.6) {
          this.createTrailParticle(projectile.position, color);
          // Spawn new pooled projectile trail particles
          effects.spawnMagicProjectileTrail(
            this.particlePool,
            projectile.position,
            attackerColor
          );
        }

        if (progress < 1) {
          requestAnimationFrame(animate);
        } else {
          // Impact burst at target (legacy)
          this.createImpactParticles(to, color);

          // Remove projectile
          this.scene.remove(projectile);
          projectileGeometry.dispose();
          projectileMaterial.dispose();

          resolve();
        }
      };

      requestAnimationFrame(animate);
    });

    // Wait for impact effect
    await this.delay(200);
  }

  /**
   * Play a melee lunge attack
   * @param mesh - The attacker mesh
   * @param start - Start world position
   * @param target - Target world position
   */
  private async playMeleeAttack(
    object: THREE.Object3D,
    start: THREE.Vector3,
    target: THREE.Vector3
  ): Promise<void> {
    // Calculate lunge direction (toward target, but don't go all the way)
    const direction = new THREE.Vector3().subVectors(target, start).normalize();
    const lungeDistance = start.distanceTo(target) * 0.6;
    const lungeTarget = start.clone().addScaledVector(direction, lungeDistance);
    lungeTarget.y = start.y; // Keep same height

    const originalPos = object.position.clone();

    // Lunge forward
    await this.animateObject(object, lungeTarget, 150);

    // Brief hold at strike position
    await this.delay(100);

    // Create impact particles at defender (legacy)
    this.createImpactParticles(target, 0xffffff);

    // Spawn new pooled melee impact particles
    const impactPosition = target.clone();
    impactPosition.y = 0.5;
    effects.spawnMeleeImpact(this.particlePool, impactPosition);

    // Return to original position
    await this.animateObject(object, originalPos, 200);
  }

  /**
   * Play death animation for the captured piece
   * @param position - Position of the dying piece
   */
  private async playDeathAnimation(position: Position): Promise<void> {
    const pieceData = this.pieceRenderer.getPieceAt(position);
    if (!pieceData) return;

    const object = pieceData.mesh;
    const originalScale = object.scale.clone();

    // Get color for death particles
    const deathColor = pieceData.color === 'w' ? 0xf5e6d3 : 0x6b4c9a;
    const defenderColorName: 'white' | 'black' =
      pieceData.color === 'w' ? 'white' : 'black';

    // Create death particles (dissolve effect) - legacy
    const board = this.cameraController.getBoard();
    const worldPos = board.getSquarePosition(position.file, position.rank);
    this.createDeathParticles(worldPos, deathColor);

    // Spawn new pooled death dissolve particles
    effects.spawnDeathDissolve(this.particlePool, worldPos, defenderColorName);

    // Animate scale down and fade
    const duration = 400;
    const startTime = performance.now();
    let lastTime = startTime;

    // Find first mesh for material opacity animation
    let foundMaterial: THREE.MeshStandardMaterial | undefined;
    object.traverse((child) => {
      if (!foundMaterial && child instanceof THREE.Mesh && child.material) {
        foundMaterial = child.material as THREE.MeshStandardMaterial;
      }
    });
    const material = foundMaterial;
    if (material) {
      material.transparent = true;
    }

    await new Promise<void>((resolve) => {
      const animate = (currentTime: number) => {
        const elapsed = currentTime - startTime;
        const deltaTime = (currentTime - lastTime) / 1000;
        lastTime = currentTime;
        const progress = Math.min(elapsed / duration, 1);
        const eased = this.easeOutQuad(progress);

        // Update particle pool
        this.particlePool.update(deltaTime);

        // Scale down
        const scale = 1 - eased * 0.8;
        object.scale.setScalar(scale);

        // Fade out
        if (material) {
          material.opacity = 1 - eased;
        }

        // Slight upward drift
        object.position.y += 0.005;

        if (progress < 1) {
          requestAnimationFrame(animate);
        } else {
          // Reset material state (piece will be removed anyway)
          if (material) {
            material.opacity = 1;
            material.transparent = false;
          }
          object.scale.copy(originalScale);
          resolve();
        }
      };

      requestAnimationFrame(animate);
    });
  }

  /**
   * Create magic charging particles at position
   */
  private createMagicParticles(position: THREE.Vector3, color: number): void {
    const particleCount = 20;
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);
    const velocities: THREE.Vector3[] = [];

    for (let i = 0; i < particleCount; i++) {
      // Spawn in a circle around the position
      const angle = (i / particleCount) * Math.PI * 2;
      const radius = 0.3 + Math.random() * 0.3;
      positions[i * 3] = position.x + Math.cos(angle) * radius;
      positions[i * 3 + 1] = 0.5 + Math.random() * 0.5;
      positions[i * 3 + 2] = position.z + Math.sin(angle) * radius;

      // Velocity toward center and upward
      velocities.push(
        new THREE.Vector3(
          -Math.cos(angle) * 0.02,
          0.02 + Math.random() * 0.02,
          -Math.sin(angle) * 0.02
        )
      );
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    const material = new THREE.PointsMaterial({
      color: color,
      size: 0.08,
      transparent: true,
      opacity: 0.8,
      blending: THREE.AdditiveBlending,
    });

    const points = new THREE.Points(geometry, material);
    this.scene.add(points);

    this.particles.push({
      points,
      velocities,
      startTime: performance.now(),
      duration: 500,
    });

    this.startParticleAnimation();
  }

  /**
   * Create a single trail particle
   */
  private createTrailParticle(position: THREE.Vector3, color: number): void {
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array([
      position.x + (Math.random() - 0.5) * 0.1,
      position.y + (Math.random() - 0.5) * 0.1,
      position.z + (Math.random() - 0.5) * 0.1,
    ]);
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    const material = new THREE.PointsMaterial({
      color: color,
      size: 0.06,
      transparent: true,
      opacity: 0.7,
      blending: THREE.AdditiveBlending,
    });

    const points = new THREE.Points(geometry, material);
    this.scene.add(points);

    this.particles.push({
      points,
      velocities: [new THREE.Vector3(0, 0.01, 0)],
      startTime: performance.now(),
      duration: 300,
    });

    this.startParticleAnimation();
  }

  /**
   * Create impact burst particles at position
   */
  private createImpactParticles(position: THREE.Vector3, color: number): void {
    const particleCount = 30;
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);
    const velocities: THREE.Vector3[] = [];

    for (let i = 0; i < particleCount; i++) {
      // All start at impact point
      positions[i * 3] = position.x;
      positions[i * 3 + 1] = 0.5;
      positions[i * 3 + 2] = position.z;

      // Explode outward in all directions
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.random() * Math.PI;
      const speed = 0.05 + Math.random() * 0.05;
      velocities.push(
        new THREE.Vector3(
          Math.sin(phi) * Math.cos(theta) * speed,
          Math.cos(phi) * speed * 0.5 + 0.02,
          Math.sin(phi) * Math.sin(theta) * speed
        )
      );
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    const material = new THREE.PointsMaterial({
      color: color,
      size: 0.1,
      transparent: true,
      opacity: 1,
      blending: THREE.AdditiveBlending,
    });

    const points = new THREE.Points(geometry, material);
    this.scene.add(points);

    this.particles.push({
      points,
      velocities,
      startTime: performance.now(),
      duration: 600,
    });

    this.startParticleAnimation();
  }

  /**
   * Create death/dissolve particles
   */
  private createDeathParticles(position: THREE.Vector3, color: number): void {
    const particleCount = 50;
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);
    const velocities: THREE.Vector3[] = [];

    for (let i = 0; i < particleCount; i++) {
      // Spawn within the piece volume
      positions[i * 3] = position.x + (Math.random() - 0.5) * 0.3;
      positions[i * 3 + 1] = Math.random() * 1.2 + 0.1;
      positions[i * 3 + 2] = position.z + (Math.random() - 0.5) * 0.3;

      // Float upward and outward
      velocities.push(
        new THREE.Vector3(
          (Math.random() - 0.5) * 0.02,
          0.02 + Math.random() * 0.03,
          (Math.random() - 0.5) * 0.02
        )
      );
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    const material = new THREE.PointsMaterial({
      color: color,
      size: 0.08,
      transparent: true,
      opacity: 0.9,
      blending: THREE.AdditiveBlending,
    });

    const points = new THREE.Points(geometry, material);
    this.scene.add(points);

    this.particles.push({
      points,
      velocities,
      startTime: performance.now(),
      duration: 800,
    });

    this.startParticleAnimation();
  }

  /**
   * Start the particle animation loop if not already running
   */
  private startParticleAnimation(): void {
    if (this.particleAnimationId !== null) return;

    const animate = () => {
      const currentTime = performance.now();
      let hasActiveParticles = false;

      for (let i = this.particles.length - 1; i >= 0; i--) {
        const particle = this.particles[i];
        const elapsed = currentTime - particle.startTime;
        const progress = elapsed / particle.duration;

        if (progress >= 1) {
          // Remove expired particles
          this.scene.remove(particle.points);
          particle.points.geometry.dispose();
          (particle.points.material as THREE.Material).dispose();
          this.particles.splice(i, 1);
        } else {
          hasActiveParticles = true;

          // Update particle positions
          const positions = particle.points.geometry.attributes.position;
          const posArray = positions.array as Float32Array;

          for (let j = 0; j < particle.velocities.length; j++) {
            posArray[j * 3] += particle.velocities[j].x;
            posArray[j * 3 + 1] += particle.velocities[j].y;
            posArray[j * 3 + 2] += particle.velocities[j].z;

            // Apply gravity to some particles
            particle.velocities[j].y -= 0.001;
          }

          positions.needsUpdate = true;

          // Fade out
          const material = particle.points.material as THREE.PointsMaterial;
          material.opacity = 1 - progress;
        }
      }

      if (hasActiveParticles) {
        this.particleAnimationId = requestAnimationFrame(animate);
      } else {
        this.particleAnimationId = null;
      }
    };

    this.particleAnimationId = requestAnimationFrame(animate);
  }

  /**
   * Animate an object to a target position
   */
  private animateObject(
    object: THREE.Object3D,
    target: THREE.Vector3,
    duration: number
  ): Promise<void> {
    return new Promise((resolve) => {
      const startPos = object.position.clone();
      const startTime = performance.now();

      const animate = (currentTime: number) => {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const eased = this.easeOutQuad(progress);

        object.position.lerpVectors(startPos, target, eased);

        if (progress < 1) {
          requestAnimationFrame(animate);
        } else {
          resolve();
        }
      };

      requestAnimationFrame(animate);
    });
  }

  /**
   * Ease out quadratic easing function
   */
  private easeOutQuad(t: number): number {
    return t * (2 - t);
  }

  /**
   * Delay helper
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Clean up all active particles
   */
  private cleanupParticles(): void {
    if (this.particleAnimationId !== null) {
      cancelAnimationFrame(this.particleAnimationId);
      this.particleAnimationId = null;
    }

    for (const particle of this.particles) {
      this.scene.remove(particle.points);
      particle.points.geometry.dispose();
      (particle.points.material as THREE.Material).dispose();
    }

    this.particles = [];
  }

  /**
   * Set a texture for particles (optional enhancement)
   * @param texture - The texture to apply to pooled particles
   */
  public setParticleTexture(texture: THREE.Texture): void {
    // Note: ParticlePool currently only supports texture at construction time.
    // This method stores the texture for potential future use or re-initialization.
    // For now, log that we received it.
    console.log('BattleManager: Particle texture set', texture.uuid);
  }

  /**
   * Dispose of all resources
   */
  public dispose(): void {
    this.cleanupParticles();
    this.particlePool.dispose();
  }
}
