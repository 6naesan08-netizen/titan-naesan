export type GameState = 'TITLE_MENU' | 'PLAYING' | 'PAUSED' | 'GAME_OVER';

export type Difficulty = 'trainee' | 'scout' | 'captain';

export type DistrictId =
  | 'shiganshina'
  | 'trost'
  | 'forest'
  | 'utgard'
  | 'reiss_chapel'
  | 'liberio'
  | 'paradis_rumbling'
  | 'quinta';

export type TitanKind =
  | 'normal'
  | 'abnormal'
  | 'armored'
  | 'colossal'
  | 'attack'
  | 'female'
  | 'beast'
  | 'jaw'
  | 'cart'
  | 'warhammer'
  | 'founding';

export interface Vec2 {
  x: number;
  y: number;
}

export interface Building {
  id: number;
  x: number;
  y: number; // top of main rectangular body
  width: number;
  height: number; // extends down to groundY
  roofHeight: number;
  style: 'house' | 'tower' | 'wall' | 'tree' | 'ruin';
  colorMain: string;
  colorRoof: string;
  windows: { rx: number; ry: number; lit: boolean }[];
}

export interface StreetLamp {
  x: number;
  y: number;
  height: number;
  lit: boolean;
}

export interface DistrictMeta {
  id: DistrictId;
  name: string;
  subtitle: string;
  featuredTitans: string;
  description: string;
  skyColors: [string, string, string, string];
  wallLabel: string;
  hasColossalSilhouette: boolean;
  hasBrokenGate: boolean;
  hasCannons: boolean;
  hasBoulder: boolean;
}

export interface SupplyCrate {
  id: number;
  x: number;
  y: number;
  cooldown: number; // 0 when ready
  maxCooldown: number;
}

export interface GrappleHook {
  active: boolean;
  anchorX: number;
  anchorY: number;
  attachedTitanId: number | null;
  offsetX: number;
  offsetY: number;
  wireLength: number;
}

export interface CapePoint {
  x: number;
  y: number;
}

export interface Player {
  x: number;
  y: number;
  vx: number;
  vy: number;
  facing: 1 | -1;
  grounded: boolean;
  hp: number;
  maxHp: number;
  gas: number;
  maxGas: number;
  bladeDurability: number;
  maxBladeDurability: number;
  spareBlades: number;
  maxSpareBlades: number;
  slashTimer: number;
  slashCooldown: number;
  slashAngle: number;
  spinTimer: number;
  reloadTimer: number;
  invulnTimer: number;
  grabbedByTitanId: number | null;
  escapeProgress: number;
  hook: GrappleHook;
  cape: CapePoint[];
  animTime: number;
  boosting: boolean;
}

export interface Titan {
  id: number;
  kind: TitanKind;
  x: number;
  y: number; // feet position (groundY when standing)
  vx: number;
  vy: number;
  scale: number; // e.g., 1.0 (~9m), 1.5 (~13.5m), 1.8 (~16m)
  facing: 1 | -1;
  hp: number;
  maxHp: number;
  blindTimer: number;
  staggerTimer: number;
  attackCooldown: number;
  grabbingPlayer: boolean;
  leapTimer: number;
  walkPhase: number;
  reachAngle: number;
  dyingTimer: number; // > 0 when collapsing into steam
  dead: boolean;
  skinTone: string;
  hairColor: string;
  armorTone?: string;
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  alpha: number;
  life: number;
  maxLife: number;
  color: string;
  kind: 'steam' | 'blood' | 'spark' | 'shard' | 'flare';
  rotation?: number;
  vRot?: number;
}

export interface SlashArc {
  x: number;
  y: number;
  angle: number;
  radius: number;
  life: number;
  maxLife: number;
  isSpin: boolean;
  isCrit: boolean;
}

export interface FloatingText {
  x: number;
  y: number;
  vy: number;
  text: string;
  subtext?: string;
  color: string;
  life: number;
  maxLife: number;
  scale: number;
}

export interface HudSnapshot {
  hp: number;
  maxHp: number;
  gas: number;
  maxGas: number;
  bladeDurability: number;
  maxBladeDurability: number;
  spareBlades: number;
  maxSpareBlades: number;
  speedKmh: number;
  score: number;
  kills: number;
  combo: number;
  comboTimer: number;
  wave: number;
  titansRemaining: number;
  waveBannerTimer: number;
  grabbed: boolean;
  escapeProgress: number;
  reloading: boolean;
  nearSupply: boolean;
  bestSpeedKmh: number;
  maxCombo: number;
  muted: boolean;
  districtName: string;
  gameOverReason: string;
}

export interface BestRecord {
  highScore: number;
  maxKills: number;
  maxWave: number;
  bestSpeedKmh: number;
}
