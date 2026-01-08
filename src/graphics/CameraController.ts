import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import type { Position } from '../core/types';
import { ChessBoard } from './Board';

/**
 * CameraController - Manages camera transitions for battle sequences
 * Handles smooth animations between default view and battle closeups
 */
export class CameraController {
  private camera: THREE.PerspectiveCamera;
  private controls: OrbitControls;
  private board: ChessBoard;

  // Default camera position (matches Scene.ts setup)
  private defaultPosition = new THREE.Vector3(0, 12, 12);
  private defaultTarget = new THREE.Vector3(0, 0, 0);

  // Current animation state
  private isAnimating = false;

  // Store original control state
  private wasControlsEnabled = true;

  constructor(
    camera: THREE.PerspectiveCamera,
    controls: OrbitControls,
    board: ChessBoard
  ) {
    this.camera = camera;
    this.controls = controls;
    this.board = board;

    // Store current camera position as default
    this.defaultPosition.copy(camera.position);
    this.defaultTarget.copy(controls.target);
  }

  /**
   * Check if currently animating
   */
  public getIsAnimating(): boolean {
    return this.isAnimating;
  }

  /**
   * Transition camera to a battle view between attacker and defender
   * @param attackerPos - Position of the attacking piece
   * @param defenderPos - Position of the defending piece
   */
  async transitionToBattle(
    attackerPos: Position,
    defenderPos: Position
  ): Promise<void> {
    if (this.isAnimating) return;

    // Store current control state and disable
    this.wasControlsEnabled = this.controls.enabled;
    this.controls.enabled = false;

    // Get world positions of the pieces
    const attackerWorld = this.board.getSquarePosition(
      attackerPos.file,
      attackerPos.rank
    );
    const defenderWorld = this.board.getSquarePosition(
      defenderPos.file,
      defenderPos.rank
    );

    // Calculate midpoint between attacker and defender
    const midpoint = new THREE.Vector3()
      .addVectors(attackerWorld, defenderWorld)
      .multiplyScalar(0.5);
    midpoint.y = 0.5; // Slightly above board

    // Calculate direction from attacker to defender
    const direction = new THREE.Vector3()
      .subVectors(defenderWorld, attackerWorld)
      .normalize();

    // Calculate perpendicular direction for camera offset (side view)
    const perpendicular = new THREE.Vector3(-direction.z, 0, direction.x);

    // Calculate distance between pieces
    const distance = attackerWorld.distanceTo(defenderWorld);

    // Camera position: side view, close up
    // Scale camera distance based on piece distance, with minimum
    const cameraDistance = Math.max(3, distance * 1.2);
    const cameraHeight = 2.5;

    const targetCameraPos = new THREE.Vector3()
      .copy(midpoint)
      .addScaledVector(perpendicular, cameraDistance)
      .setY(cameraHeight);

    // Target look-at point: slightly above the midpoint
    const targetLookAt = midpoint.clone();
    targetLookAt.y = 0.5;

    // Animate to battle position
    await this.animateCamera(targetCameraPos, targetLookAt, 600);
  }

  /**
   * Return camera to default position
   */
  async returnToDefault(): Promise<void> {
    if (this.isAnimating) return;

    // Animate back to default
    await this.animateCamera(this.defaultPosition.clone(), this.defaultTarget.clone(), 500);

    // Re-enable orbit controls
    this.controls.enabled = this.wasControlsEnabled;
  }

  /**
   * Smoothly animate camera to a target position and look-at point
   * @param targetPos - Target camera position
   * @param targetLookAt - Target look-at point
   * @param duration - Animation duration in milliseconds
   */
  private animateCamera(
    targetPos: THREE.Vector3,
    targetLookAt: THREE.Vector3,
    duration: number
  ): Promise<void> {
    return new Promise((resolve) => {
      this.isAnimating = true;

      const startPos = this.camera.position.clone();
      const startTarget = this.controls.target.clone();

      const startTime = performance.now();

      const animate = (currentTime: number) => {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);

        // Ease in-out cubic for smooth motion
        const eased = this.easeInOutCubic(progress);

        // Lerp camera position
        this.camera.position.lerpVectors(startPos, targetPos, eased);

        // Lerp controls target
        this.controls.target.lerpVectors(startTarget, targetLookAt, eased);

        // Update camera to look at target
        this.camera.lookAt(this.controls.target);

        if (progress < 1) {
          requestAnimationFrame(animate);
        } else {
          this.isAnimating = false;
          resolve();
        }
      };

      requestAnimationFrame(animate);
    });
  }

  /**
   * Ease in-out cubic easing function
   * @param t - Progress value from 0 to 1
   * @returns Eased value
   */
  private easeInOutCubic(t: number): number {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  }

  /**
   * Update stored default position (call after user moves camera)
   */
  public updateDefaultPosition(): void {
    if (!this.isAnimating) {
      this.defaultPosition.copy(this.camera.position);
      this.defaultTarget.copy(this.controls.target);
    }
  }

  /**
   * Get the chess board reference
   */
  public getBoard(): ChessBoard {
    return this.board;
  }
}
