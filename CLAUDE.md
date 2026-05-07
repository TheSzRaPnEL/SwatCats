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

**SwatCats** is a Phaser 3 arcade shoot-em-up (vertical scroller). Vanilla JS — no TypeScript, no UI framework. Vite builds for web; Capacitor wraps for Android.

### Scene Graph
Phaser scene lifecycle: `BootScene` → `MenuScene` → `GameScene`. All gameplay lives in `GameScene`, which owns the physics groups and coordinates component classes.

### Component System (`src/components/`)
`GameScene` instantiates each component in `create()` and drives them from `update()`. Components receive `scene` (the GameScene reference) and use it to access physics groups, the player sprite, and other components.

| Component | Responsibility |
|---|---|
| `WeaponSystem` | Player firing — bullets (130ms rate), rockets (5s cooldown), 4 special rocket types |
| `EnemyManager` | Wave-based spawning; adjusts count, speed, health, fire rate per wave |
| `BossController` | Spawns after 20s wave timer; health = enemy HP × 100; attack patterns with warning zones |
| `EffectsManager` | Explosions and status effects — ice (freeze), zap (chain), poison (DoT) |
| `TouchControls` | Virtual joystick + rocket buttons; sub-rocket panel shows for `SUB_ROCKET_WINDOW` ms |
| `ThrusterRenderer` | Draws procedural thruster flames reacting to movement |
| `HUD` | Score, health, wave number, rocket cooldown overlay |
| `Background` | Parallax scrolling |
| `TextureFactory` | **Generates all sprites at runtime via canvas** — there are no image assets |

### Physics Groups
Defined in `GameScene.create()`. Separate groups per projectile type enable selective collision registration:
`bullets`, `rockets`, `iceRockets`, `zapRockets`, `poisonRockets`, `enemies`, `enemyBullets`, `bossGroup`

### Game Balance
All numeric constants (speeds, cooldowns, damage values, wave scaling) live in `src/constants/gameConstants.js`. Edit there first before touching component logic.

### Audio
`src/audio/AudioManager.js` is a module-level singleton. Call `AudioManager.resume()` before playing any sound (required after user gesture on mobile).

### Deployment
- Web: `dist/` uploaded via `deploy.mjs` using credentials from `.env` (`FTP_HOST`, `FTP_USER`, `FTP_PASS`)
- Android: Capacitor app ID `pl.hitme.swatcats`; release keystore is in the Android project
