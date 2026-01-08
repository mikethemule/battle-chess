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
        Math.sin(phi) * Math.sin(theta) * speed + 1,
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

      particle.mesh.position.add(
        particle.velocity.clone().multiplyScalar(deltaTime)
      );

      particle.velocity.y += gravity * deltaTime;

      particle.life -= deltaTime;

      const lifeRatio = particle.life / particle.maxLife;
      (particle.mesh.material as THREE.MeshBasicMaterial).opacity = lifeRatio;
      particle.mesh.scale.setScalar(0.5 + lifeRatio * 0.5);

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
