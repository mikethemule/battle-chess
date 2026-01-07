import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

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

    // Handle window resize
    window.addEventListener('resize', this.onWindowResize.bind(this));
  }

  /**
   * Setup scene lighting with ambient, key, fill, and rim lights
   */
  private setupLighting(): void {
    // Ambient light for base illumination
    const ambientLight = new THREE.AmbientLight(0x404060, 0.4);
    this.scene.add(ambientLight);

    // Key light (warm directional) - main light source with shadows
    const keyLight = new THREE.DirectionalLight(0xfff4e6, 1.2);
    keyLight.position.set(5, 10, 5);
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

    // Fill light (cool directional) - softens shadows
    const fillLight = new THREE.DirectionalLight(0x9db4ff, 0.4);
    fillLight.position.set(-5, 5, -5);
    this.scene.add(fillLight);

    // Rim light - edge highlighting from behind
    const rimLight = new THREE.DirectionalLight(0xffffff, 0.3);
    rimLight.position.set(0, 5, -10);
    this.scene.add(rimLight);
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
    this.controls.dispose();
    this.renderer.dispose();
  }
}
