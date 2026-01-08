import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { AnimationController } from './AnimationController';

/**
 * GameScene - Main 3D scene manager for Battle Chess
 * Handles scene, camera, renderer, lighting, and controls
 */
export class GameScene {
  public scene: THREE.Scene;
  public camera: THREE.PerspectiveCamera;
  public renderer: THREE.WebGLRenderer;
  public controls: OrbitControls;

  private animationId: number | null = null;
  private isRunning: boolean = false;
  private animationController: AnimationController;

  constructor(canvas: HTMLCanvasElement) {
    // Initialize scene with dark background
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x1a1a2e);

    // Setup perspective camera
    const aspect = window.innerWidth / window.innerHeight;
    this.camera = new THREE.PerspectiveCamera(45, aspect, 0.1, 100);
    this.camera.position.set(0, 12, 12);

    // Setup WebGL renderer with antialiasing and shadows
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
    });
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    // Setup orbit controls
    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.target.set(0, 0, 0);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.05;
    this.controls.minDistance = 5;
    this.controls.maxDistance = 30;
    this.controls.maxPolarAngle = Math.PI / 2.1; // Prevent going below ground
    this.controls.update();

    // Setup lighting
    this.setupLighting();

    // Initialize animation controller
    this.animationController = new AnimationController();

    // Handle window resize
    window.addEventListener('resize', this.onWindowResize.bind(this));
  }

  /**
   * Setup scene lighting with fantasy-themed dramatic lighting
   * Uses 3-point setup with cool key, warm fill, and purple rim
   */
  private setupLighting(): void {
    // Ambient light - subtle base visibility
    const ambientLight = new THREE.AmbientLight(0x404040, 0.4);
    this.scene.add(ambientLight);

    // Key light (cool moon/magic light) - main light source with shadows
    const keyLight = new THREE.DirectionalLight(0xaaccff, 2.0);
    keyLight.position.set(-10, 20, 5);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.width = 2048;
    keyLight.shadow.mapSize.height = 2048;
    keyLight.shadow.camera.near = 0.5;
    keyLight.shadow.camera.far = 50;
    keyLight.shadow.camera.left = -10;
    keyLight.shadow.camera.right = 10;
    keyLight.shadow.camera.top = 10;
    keyLight.shadow.camera.bottom = -10;
    keyLight.shadow.bias = -0.0001;
    this.scene.add(keyLight);

    // Fill light (warm torch/ground glow) - creates depth
    const fillLight = new THREE.PointLight(0xffaa00, 0.6, 50);
    fillLight.position.set(10, 3, 10);
    this.scene.add(fillLight);

    // Secondary fill light on opposite side
    const fillLight2 = new THREE.PointLight(0xff8844, 0.4, 40);
    fillLight2.position.set(-10, 2, -10);
    this.scene.add(fillLight2);

    // Rim/back light (purple magical glow) - edge definition for silhouettes
    const rimLight = new THREE.SpotLight(0x8800ff, 3.0);
    rimLight.position.set(0, 10, -12);
    rimLight.target.position.set(0, 0, 0);
    rimLight.angle = Math.PI / 4;
    rimLight.penumbra = 0.5;
    this.scene.add(rimLight);
    this.scene.add(rimLight.target);
  }

  /**
   * Handle window resize events
   */
  private onWindowResize(): void {
    const width = window.innerWidth;
    const height = window.innerHeight;

    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();

    this.renderer.setSize(width, height);
  }

  /**
   * Animation loop
   */
  private animate(): void {
    if (!this.isRunning) return;

    this.animationId = requestAnimationFrame(this.animate.bind(this));

    // Update controls (required for damping)
    this.controls.update();

    // Update animations
    this.animationController.update();

    // Render the scene
    this.renderer.render(this.scene, this.camera);
  }

  /**
   * Start the animation loop
   */
  public start(): void {
    if (this.isRunning) return;
    this.isRunning = true;
    this.animate();
  }

  /**
   * Stop the animation loop
   */
  public stop(): void {
    this.isRunning = false;
    if (this.animationId !== null) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
  }

  /**
   * Get the animation controller for managing model animations
   */
  public getAnimationController(): AnimationController {
    return this.animationController;
  }

  /**
   * Add an object to the scene
   */
  public add(object: THREE.Object3D): void {
    this.scene.add(object);
  }

  /**
   * Remove an object from the scene
   */
  public remove(object: THREE.Object3D): void {
    this.scene.remove(object);
  }

  /**
   * Clean up resources
   */
  public dispose(): void {
    this.stop();
    window.removeEventListener('resize', this.onWindowResize.bind(this));
    this.animationController.dispose();
    this.controls.dispose();
    this.renderer.dispose();
  }
}
