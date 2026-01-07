import './style.css';
import * as THREE from 'three';
import { GameScene } from './graphics/Scene';

// Get the canvas element
const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;

if (!canvas) {
  throw new Error('Canvas element #game-canvas not found');
}

// Create the game scene
const gameScene = new GameScene(canvas);

// Add a test cube (purple) with shadows
const cubeGeometry = new THREE.BoxGeometry(1, 1, 1);
const cubeMaterial = new THREE.MeshStandardMaterial({
  color: 0x9b59b6, // Purple color
  roughness: 0.5,
  metalness: 0.3,
});
const testCube = new THREE.Mesh(cubeGeometry, cubeMaterial);
testCube.position.set(0, 0.5, 0);
testCube.castShadow = true;
testCube.receiveShadow = true;
gameScene.add(testCube);

// Add a ground plane for shadow testing
const groundGeometry = new THREE.PlaneGeometry(20, 20);
const groundMaterial = new THREE.MeshStandardMaterial({
  color: 0x2d2d44, // Dark purple-gray
  roughness: 0.8,
  metalness: 0.2,
});
const ground = new THREE.Mesh(groundGeometry, groundMaterial);
ground.rotation.x = -Math.PI / 2; // Rotate to be horizontal
ground.position.y = 0;
ground.receiveShadow = true;
gameScene.add(ground);

// Start the animation loop
gameScene.start();

// Log success message
console.log('Battle Chess: Fantasy Edition - Scene initialized successfully');
