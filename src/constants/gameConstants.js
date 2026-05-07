// ── 3D world: 1 unit ≈ 30 px in the old 2D system ────────────────────────────

// ── Player ────────────────────────────────────────────────────────────────────
export const PLAYER_SPEED      = 10;    // world units / second

// ── Weapons ───────────────────────────────────────────────────────────────────
export const BULLET_SPEED      = 22;    // world units / second
export const FIRE_RATE_MS      = 130;
export const ROCKET_SPEED      = 15;
export const ROCKET_COOLDOWN_MS = 5000;
export const ROCKET_AOE_RADIUS = 3.6;   // world units

export const SUB_ROCKET_WINDOW = 5000;

// ── Ice rocket ────────────────────────────────────────────────────────────────
export const ICE_AOE_RADIUS    = 12.5;
export const ICE_DAMAGE        = 1;
export const ICE_SLOW_FACTOR   = 0.2;
export const ICE_SLOW_DURATION = 5000;

// ── Zap rocket ────────────────────────────────────────────────────────────────
export const ZAP_DAMAGE        = 1;
export const ZAP_HITS          = 4;
export const ZAP_INTERVAL      = 1000;

// ── Enemies ───────────────────────────────────────────────────────────────────
export const ENEMY_HEALTH      = 2;

// ── Poison rocket ─────────────────────────────────────────────────────────────
export const POISON_AOE_RADIUS   = 6.6;
export const POISON_DAMAGE       = 1;
export const POISON_DOT_DAMAGE   = 1;
export const POISON_DOT_TICKS    = 4;
export const POISON_DOT_INTERVAL = 1000;

// ── Boss ──────────────────────────────────────────────────────────────────────
export const BOSS_HP_MULT        = 100;
export const BOSS_FIRE_RATE      = 1500;
export const BOSS_SPECIAL_DELAY  = 5000;
export const BOSS_SPECIAL_WARN   = 1500;
export const BOSS_SAFE_RADIUS    = 2.6;  // world units
export const BOSS_SPECIAL_DAMAGE = 25;
export const BOSS_ROCKET_DMG     = 20;
export const BOSS_ICE_DMG        = 10;
export const BOSS_POISON_DMG     = 8;
export const BOSS_POISON_DOT     = 2;
export const BOSS_ENTRY_Z        = -12; // Z position boss settles to after entry

// ── Collision radii ───────────────────────────────────────────────────────────
export const PLAYER_R   = 0.75;
export const ENEMY_R    = 0.6;
export const BOSS_R     = 1.8;
export const BULLET_R   = 0.14;
