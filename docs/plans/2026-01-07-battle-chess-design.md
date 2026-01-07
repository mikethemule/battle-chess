# Battle Chess: Fantasy Edition - Design Document

## Overview

A browser-based 3D chess game featuring animated fantasy battles when pieces capture, inspired by the classic Battle Chess.

## Decisions Summary

| Aspect | Choice |
|--------|--------|
| Platform | Web browser (HTML5/WebGL) |
| Graphics | Full 3D with Three.js |
| AI | Stockfish.js (WASM) with adjustable difficulty |
| Multiplayer | Local hot-seat only (online deferred) |
| Animations | Generic with variation (6-8 base animations) |
| Visual Style | Fantasy themed (wizards vs warriors) |
| 3D Assets | AI-generated models with manual cleanup |
| Audio | Deferred - focus on visuals first |
| Tech Stack | TypeScript + Vite |

---

## Architecture

### Core Stack
- **Three.js** - 3D rendering, scene management, animations
- **TypeScript + Vite** - Type safety, fast HMR, modern bundling
- **Stockfish.js** (WASM) - Chess AI with adjustable difficulty
- **chess.js** - Move validation, game state, PGN support

### Project Structure
```
battle-chess/
├── public/
│   └── models/          # glTF piece models
├── src/
│   ├── core/
│   │   ├── GameState.ts
│   │   ├── ChessEngine.ts    # chess.js wrapper
│   │   └── types.ts
│   ├── graphics/
│   │   ├── Scene.ts          # Three.js setup
│   │   ├── Board.ts
│   │   ├── PieceRenderer.ts
│   │   └── CameraController.ts
│   ├── battle/
│   │   ├── BattleManager.ts
│   │   ├── animations/
│   │   └── particles/
│   ├── ai/
│   │   └── StockfishWorker.ts
│   ├── ui/
│   │   ├── Menu.ts
│   │   └── HUD.ts
│   ├── main.ts
│   └── style.css
├── index.html
├── package.json
├── tsconfig.json
└── vite.config.ts
```

### Game Flow
1. **Main Menu** → New Game (vs AI/Local) or Load Game
2. **Game Setup** → Choose side, AI difficulty (if applicable)
3. **Gameplay Loop** → Select piece → Show valid moves → Select target → Play animation → Update board
4. **Battle Trigger** → On capture, camera zooms to action, battle animation plays, returns to board view

---

## 3D Graphics System

### Scene Setup
- **Board** - 8x8 grid of alternating tile meshes, fantasy stone/crystal materials with subtle glow effects
- **Lighting** - Ambient + two directional lights (warm key, cool fill) + point lights for magical glow
- **Camera** - Perspective camera at 45° angle, smooth orbit controls

### Fantasy Piece Types

| Chess Piece | Light Army | Dark Army |
|-------------|-----------|-----------|
| King | High Wizard | Lich King |
| Queen | Arch Mage | Dark Sorceress |
| Bishop | Battle Priest | Necromancer |
| Knight | Gryphon Rider | Death Knight |
| Rook | Golem | Bone Colossus |
| Pawn | Apprentice | Skeleton Warrior |

### Model Requirements
- **Format**: glTF/GLB
- **Poly count**: ~2-5k triangles per piece
- **Rigging**: Simple skeleton for idle and combat poses
- **Scale**: Pawns ~1 unit tall, King ~1.5 units

### Rendering Features
- PBR materials with emissive magic effects
- Soft shadows (PCF or VSM)
- Post-processing: bloom for magical glow, ambient occlusion
- Target: 60fps on mid-range hardware

---

## Battle Animation System

### Animation Types (6-8 Total)

**Attack Animations:**
- **Melee Strike** - Quick forward lunge with weapon/staff hit
- **Magic Blast** - Charge-up, projectile launch with particle trail
- **Heavy Slam** - Overhead crushing blow with ground impact

**Death Animations:**
- **Dissolve** - Piece crumbles into particles, fades away
- **Banish** - Magical implosion with light burst
- **Collapse** - Ragdoll-style fall and fade

### Battle Sequence Flow
```
1. Player confirms capture move
2. Camera transitions to battle view (close-up, dramatic angle)
3. Attacker plays attack animation + particle effects
4. Defender plays death animation
5. Brief pause (500ms) for impact
6. Camera returns to board view
7. Pieces update positions, game state advances
```

### Particle Effects
- Magic sparks on spell cast
- Impact bursts on hit
- Soul wisps on death
- Ambient magical aura on powerful pieces

### Animation Variation
- Randomized timing (±10%)
- Color tinting per army (gold vs purple magic)
- Particle intensity based on piece value

---

## Chess Logic & AI

### Chess Engine (chess.js)
- Move validation and legal move generation
- Check/checkmate/stalemate detection
- FEN strings for save/load
- PGN for move history
- Special moves: castling, en passant, pawn promotion

### Stockfish.js Integration
```typescript
// Web Worker isolation
const stockfish = new Worker('stockfish.wasm.js');

// Difficulty scaling
const difficulties = {
  beginner: { depth: 3, elo: 800 },
  easy: { depth: 6, elo: 1200 },
  medium: { depth: 10, elo: 1600 },
  hard: { depth: 15, elo: 2000 },
  master: { depth: 20, elo: null }
};
```

### Game Modes

**Vs AI:**
- Choose color (white/black/random)
- Select difficulty
- "Thinking" animation while AI calculates

**Local Multiplayer:**
- Hot-seat on same device
- Optional camera rotation per player
- Optional chess clocks (10min, 15+10, 30min)

### Game State
```typescript
interface GameState {
  mode: 'ai' | 'local';
  fen: string;
  history: Move[];
  currentPlayer: 'white' | 'black';
  aiDifficulty?: Difficulty;
  timeControl?: { white: number; black: number };
}
```

---

## UI System

### HTML Overlay Components
- **Main Menu** - New Game, Continue, Settings
- **In-Game HUD** - Move history, captured pieces, turn indicator
- **Modals** - Pawn promotion picker, game over screen, settings
- **Styling** - Fantasy-themed CSS (parchment textures, ornate borders)

---

## Future Enhancements (Out of Scope)

- Online multiplayer (WebSocket server)
- Sound effects and music
- Additional animation variations per matchup
- Mobile touch controls
- Replay system
- Achievements/progression
