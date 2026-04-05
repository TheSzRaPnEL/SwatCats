// ── Player ────────────────────────────────────────────────────────────────────
export const PLAYER_SPEED      = 336;   // 280 × 1.2 (+20%)
export const PLAYER_W          = 80;
export const PLAYER_H          = 100;

// ── Weapons ───────────────────────────────────────────────────────────────────
export const BULLET_SPEED      = 620;
export const FIRE_RATE_MS      = 130;
export const ROCKET_SPEED      = 420;
export const ROCKET_COOLDOWN_MS = 5000;
export const ROCKET_AOE_RADIUS = 110;

export const SUB_ROCKET_WINDOW = 5000;  // ms sub-rocket buttons stay visible

// ── Ice rocket ────────────────────────────────────────────────────────────────
export const ICE_AOE_RADIUS    = 380;
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
export const POISON_AOE_RADIUS   = 200;
export const POISON_DAMAGE       = 1;
export const POISON_DOT_DAMAGE   = 1;
export const POISON_DOT_TICKS    = 4;
export const POISON_DOT_INTERVAL = 1000;

// ── Boss ──────────────────────────────────────────────────────────────────────
export const BOSS_HP_MULT        = 100;  // HP = BOSS_HP_MULT × weakest enemy HP
export const BOSS_FIRE_RATE      = 1500; // ms between 5-bullet spreads
export const BOSS_SPECIAL_DELAY  = 5000; // ms between special ability uses
export const BOSS_SPECIAL_WARN   = 1500; // ms of warning before damage
export const BOSS_SAFE_RADIUS    = 78;   // px radius of each safe zone
export const BOSS_SPECIAL_DAMAGE = 25;   // HP taken if outside safe zone
export const BOSS_ROCKET_DMG     = 20;   // normal rocket damage to boss
export const BOSS_ICE_DMG        = 10;   // ice rocket damage to boss
export const BOSS_POISON_DMG     = 8;    // poison rocket initial damage to boss
export const BOSS_POISON_DOT     = 2;    // poison DoT damage per tick to boss
export const BOSS_ENTRY_Y        = 145;  // y position boss settles to after entry
