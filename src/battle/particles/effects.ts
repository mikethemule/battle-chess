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
