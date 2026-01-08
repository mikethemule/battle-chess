# Battle Chess 3D Assets Update - Design Document

## Overview

Update the Battle Chess game to replace procedural primitive geometry with proper 3D fantasy character models, PBR board textures, and enhanced battle animations as specified in the original design document.

## Decisions Summary

| Aspect | Choice |
|--------|--------|
| Model Source | Free assets first (Quaternius), AI-generated to fill gaps |
| Visual Style | Stylized low-poly |
| Animations | Hybrid: pre-rigged assets + procedural code enhancements |
| Board | Full visual overhaul with PBR textures |
| Board Textures | Free PBR sets (ambientCG, Poly Haven) |
| Particles | Battle-focused (attack/death), no ambient auras |

---

## 1. Asset Strategy & Character Mapping

### Character Model Sources

| Chess Piece | Light Army | Dark Army | Likely Source |
|-------------|-----------|-----------|---------------|
| King | High Wizard | Lich King | Quaternius Mage + AI for Lich |
| Queen | Arch Mage | Dark Sorceress | Quaternius Mage variants |
| Bishop | Battle Priest | Necromancer | Quaternius Mage/Cleric |
| Knight | Gryphon Rider | Death Knight | AI-generated (unique) |
| Rook | Golem | Bone Colossus | Quaternius Golem + Skeleton |
| Pawn | Apprentice | Skeleton Warrior | Quaternius Minion + Skeleton |

### Primary Free Asset Sources

- **Quaternius** (quaternius.com) - Best stylized low-poly fantasy characters
- **Kenney** (kenney.nl) - Backup for any gaps
- **Poly Haven / ambientCG** - Board PBR textures

### AI Gap-Filling

For unique characters not available in free libraries:
- **Meshy.ai** or **Tripo3D** for Gryphon Rider, Lich King, etc.
- Generate in "low-poly stylized" style to match Quaternius aesthetic

### File Format & Naming

- All models converted to **glTF/GLB** for Three.js
- Stored in `public/models/` directory
- Naming convention: `{color}-{piece}.glb`
  - Examples: `white-king.glb`, `black-pawn.glb`

---

## 2. Animation System

### Hybrid Approach

**From Pre-rigged Assets:**
- Use animations bundled with Quaternius/free models where available
- Typical included animations: idle, walk, attack, death
- Load via Three.js `GLTFLoader` with `AnimationMixer`

**Procedural Enhancements in Code:**
- Camera transitions (already implemented - keep)
- Piece movement tweening (board position A to B)
- Impact shake/bounce effects
- Fallback attacks for models without combat animations

### Animation Set Per Piece

| Animation | Source | Duration |
|-----------|--------|----------|
| Idle | Asset (loop) | Continuous |
| Move | Procedural (tween) | 400ms |
| Melee Attack | Asset or procedural lunge | 500ms |
| Magic Attack | Procedural + particles | 600ms |
| Death/Dissolve | Asset + procedural fade | 400ms |

### Fallback Strategy

If a model lacks an animation, use procedural version:
- **Melee:** Lunge forward 60% distance + return
- **Magic:** Charge particles + projectile
- **Death:** Scale down + fade + float up

---

## 3. Board Visual Overhaul

### Board Textures (PBR)

**Light Squares:**
- Material: Polished marble or light stone
- Source: ambientCG `Marble012` or Poly Haven equivalent
- Maps: Albedo, Normal, Roughness

**Dark Squares:**
- Material: Dark slate or obsidian with subtle purple tint
- Source: ambientCG `Rock034` or similar dark stone
- Maps: Albedo, Normal, Roughness, (optional) Emissive for glow

**Board Border:**
- Material: Ornate dark wood or carved stone
- Subtle gold/bronze trim accent
- Source: ambientCG wood or stone trim textures

### Texture Loading

```typescript
const textureLoader = new THREE.TextureLoader();
const lightSquare = {
  map: textureLoader.load('/textures/board/light_albedo.jpg'),
  normalMap: textureLoader.load('/textures/board/light_normal.jpg'),
  roughnessMap: textureLoader.load('/textures/board/light_roughness.jpg'),
};
```

### File Structure

```
public/textures/
└── board/
    ├── light_albedo.jpg
    ├── light_normal.jpg
    ├── light_roughness.jpg
    ├── dark_albedo.jpg
    ├── dark_normal.jpg
    ├── dark_roughness.jpg
    └── border_albedo.jpg
```

---

## 4. Battle-Focused Particle System

### Enhanced Particle Effects

**Magic Attack Particles (King, Queen, Bishop):**
- Charge-up: 25-30 particles spiral inward toward caster
- Projectile trail: 15 particles emitted along path, color-coded (gold/purple)
- Impact burst: 40 particles explode outward with randomized velocities

**Melee Attack Particles (Rook, Knight, Pawn):**
- Weapon swing: 10-15 streak particles following arc
- Impact: 30 ground-burst particles with sparks
- Optional: dust/debris small particles

**Death/Capture Particles:**
- Soul wisps: 20 particles float upward, slow velocity, fade over 800ms
- Dissolve: 50 small particles break off from model as it fades
- Color: Match army theme (warm gold vs cold purple)

### Particle Material

```typescript
const particleMaterial = new THREE.PointsMaterial({
  size: 0.08,
  map: sparkTexture,  // Simple soft circle
  transparent: true,
  blending: THREE.AdditiveBlending,
  depthWrite: false,
});
```

### Performance Considerations

- Object pooling to avoid garbage collection
- Max 150 active particles per battle sequence
- Auto-cleanup after 1 second

---

## 5. Code Architecture Changes

### New Files

| File | Purpose |
|------|---------|
| `src/graphics/AnimationController.ts` | Manage mixers, play clips, handle transitions |
| `src/graphics/TextureManager.ts` | Load and cache PBR textures |
| `src/battle/particles/ParticlePool.ts` | Reusable particle object pool |
| `src/battle/particles/effects.ts` | Effect presets (magic, melee, death) |

### Modified Files

| File | Changes |
|------|---------|
| `src/graphics/PieceRenderer.ts` | Replace procedural geometry with GLB model loading |
| `src/graphics/Board.ts` | Add PBR texture loading and UV mapping |
| `src/battle/BattleManager.ts` | Integrate AnimationController, enhanced particles |
| `src/graphics/Scene.ts` | Update render loop to call mixer.update() |

### PieceRenderer.ts Overhaul

**Current:** Procedural geometry creation (cylinders, spheres, boxes)
**New:** GLB model loading with animation support

```typescript
class PieceRenderer {
  private modelCache: Map<string, GLTF> = new Map();
  private mixers: Map<string, AnimationMixer> = new Map();

  async loadModels(): Promise<void> {
    const loader = new GLTFLoader();
    const pieces = ['king', 'queen', 'bishop', 'knight', 'rook', 'pawn'];
    const colors = ['white', 'black'];

    for (const color of colors) {
      for (const piece of pieces) {
        const gltf = await loader.loadAsync(`/models/${color}-${piece}.glb`);
        this.modelCache.set(`${color}-${piece}`, gltf);
      }
    }
  }

  createPiece(type: PieceType, color: Color): THREE.Group {
    const gltf = this.modelCache.get(`${color}-${type}`);
    const model = gltf.scene.clone();
    const mixer = new AnimationMixer(model);
    // Store mixer for animation updates
    return model;
  }
}
```

---

## 6. Asset Directory Structure

```
public/
├── models/
│   ├── white-king.glb
│   ├── white-queen.glb
│   ├── white-bishop.glb
│   ├── white-knight.glb
│   ├── white-rook.glb
│   ├── white-pawn.glb
│   ├── black-king.glb
│   ├── black-queen.glb
│   ├── black-bishop.glb
│   ├── black-knight.glb
│   ├── black-rook.glb
│   └── black-pawn.glb
└── textures/
    ├── board/
    │   ├── light_albedo.jpg
    │   ├── light_normal.jpg
    │   ├── light_roughness.jpg
    │   ├── dark_albedo.jpg
    │   ├── dark_normal.jpg
    │   ├── dark_roughness.jpg
    │   └── border_albedo.jpg
    └── particles/
        └── spark.png
```

---

## 7. Implementation Order

1. **Asset Acquisition** - Download/generate all 12 character models
2. **Model Integration** - Update PieceRenderer to load GLB files
3. **Animation System** - Create AnimationController, integrate with existing code
4. **Board Textures** - Download PBR textures, update Board.ts
5. **Particle Enhancements** - Create ParticlePool, update BattleManager
6. **Testing & Polish** - Verify all pieces, animations, and effects work together

---

## 8. Asset Acquisition Checklist

### From Quaternius (Free)

- [ ] Mage/Wizard models (for King, Queen, Bishop - Light)
- [ ] Skeleton Warrior (for Pawn - Dark)
- [ ] Golem (for Rook - Light)
- [ ] Knight/Warrior models (reference for style)

### AI-Generated (Meshy/Tripo3D)

- [ ] Lich King (Dark King)
- [ ] Dark Sorceress (Dark Queen)
- [ ] Necromancer (Dark Bishop)
- [ ] Gryphon Rider (Light Knight)
- [ ] Death Knight (Dark Knight)
- [ ] Bone Colossus (Dark Rook)
- [ ] Apprentice (Light Pawn)

### Textures (ambientCG/Poly Haven)

- [ ] Light marble/stone for light squares
- [ ] Dark slate/obsidian for dark squares
- [ ] Wood or stone for board border
- [ ] Soft circle sprite for particles
