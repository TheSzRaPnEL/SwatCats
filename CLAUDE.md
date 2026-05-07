# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev          # Start Vite dev server on localhost:3000
npm run build        # Production build to dist/
npm run preview      # Preview production build locally
npm run build:deploy # Build + FTP deploy to szrapnel.com/swatcats (requires .env)
npm run android      # build → Capacitor sync → open Android Studio
```

No test suite exists. Verify changes by running `npm run dev` and playing in the browser.

## Architecture

**SwatCats** is a Three.js arcade shoot-em-up (vertical scroller, top-down isometric view). Vanilla JS — no TypeScript, no UI framework. Vite builds for web; Capacitor wraps for Android.

**`src/scenes/BootScene.js` and `src/scenes/MenuScene.js` are stubs** (`export default {}`). All lifecycle is in `GameScene`.

### Entry Point
`src/main.js` creates a `WebGLRenderer` (shadows enabled), instantiates `GameScene`, then runs a `requestAnimationFrame` loop calling `game.update(delta)` → `renderer.render(game.threeScene, game.camera)`. Resize handling is also here.

### GameScene (`src/scenes/GameScene.js`)
The single orchestrator. Constructor creates the Three.js scene, camera, lights, and all components once — components **survive game restarts**. `_startGame()` clears entities and resets state without recreating components. `update(delta)` drives: player movement → weapons → entities (bullets, enemies) → boss → collisions → cleanup → thruster → background → HUD.

**Camera**: `PerspectiveCamera(58°)` at `(0, 22, 10)` looking at `(0, 0, −4)` — ~70° from horizontal.

**Entity arrays** (replace Phaser physics groups): `bullets[]`, `rockets[]`, `iceRockets[]`, `zapRockets[]`, `poisonRockets[]`, `enemies[]`, `enemyBullets[]`. Each entry is `{ mesh, vx, vy, vz, active, ... }`.

**Collision**: sphere-distance checks in `_sweepProjectiles(arr, threshold, onHit)` and `_sweepVsBoss(arr, threshold, onHit)`. Radii constants: `PLAYER_R=0.75`, `ENEMY_R=0.6`, `BOSS_R=1.8`, `BULLET_R=0.14`.

**World bounds**: X ∈ [−7.5, 7.5], player at Z≈+5, enemies spawn at Z=−24 and move toward +Z. Offscreen cutoff: |x|>13, z>13, z<−30.

### Component System (`src/components/`)

| Component | Responsibility |
|---|---|
| `ModelFactory` | Procedural low-poly 3D models (no image assets). Shared geometry/material cache. Player faces −Z; enemies/boss face +Z. |
| `WeaponSystem` | Player firing — bullets (130ms), rockets (5s cooldown), 4 special rocket types (ice/zap/poison/standard) |
| `EnemyManager` | Wave-based spawning; 3 movement patterns (straight, diagonal, sine-wave); adjusts HP/speed/fire rate per wave |
| `BossController` | Spawns after 20s; lerp X oscillation; 5-bullet spread attack; `_bossSpecial()` with DOM safe-zone overlay via `THREE.Vector3.project(camera)` |
| `EffectsManager` | `ScaleFadeEffect` inner class drives all explosions; status effects — ice (slow), zap (chain lightning), poison (DoT) |
| `ThrusterRenderer` | Two flame cone groups parented to `playerMesh`; scale/opacity driven by `moveZ` + per-frame flicker |
| `TouchControls` | DOM pointer events; left-half joystick (42px clamp); FIRE/ROCKET/ICE/ZAP/PSN buttons; sub-panel visible for `SUB_ROCKET_WINDOW` ms |
| `HUD` | Full DOM overlay (`pointer-events:none`); score, health bar, wave banner, boss HP bar, special warning circles |
| `Background` | Ground plane + road + buildings + trees; `scroll(delta)` moves all at 7 units/sec, wraps Z>14 → Z≈−28 |

### Game Balance
All numeric constants live in `src/constants/gameConstants.js`. Edit there before touching component logic.

### Audio
`src/audio/AudioManager.js` — module-level singleton. Call `audioManager.resume()` before playing (required after user gesture on mobile).

### Deployment
- Web: `dist/` uploaded via `deploy.mjs` using `basic-ftp` with `.env` credentials (`FTP_HOST`, `FTP_USER`, `FTP_PASS`) to h1.hitme.pl → `/domains/szrapnel.com/private_html/swatcats`
- Android: Capacitor app ID `pl.hitme.swatcats`; release keystore is in the Android project
