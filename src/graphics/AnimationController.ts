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
