import { soundEngine } from './audio';
import {
  Building,
  CapePoint,
  Difficulty,
  DistrictId,
  FloatingText,
  HudSnapshot,
  Particle,
  Player,
  SlashArc,
  StreetLamp,
  SupplyCrate,
  Titan,
} from './types';
import {
  CEILING_Y,
  DISTRICTS,
  GROUND_Y,
  WORLD_WIDTH,
  createDistrictWorld,
  getDifficultyMultipliers,
  getTitanAnatomy,
  spawnTitanWave,
} from './world';

interface AimTarget {
  x: number;
  y: number;
  titanId: number | null;
  offsetX: number;
  offsetY: number;
}

const GRAVITY = 960;
const MAX_HOOK_RANGE = 600;
const PX_TO_KMH = 0.12; // 1000 px/s -> 120 km/h

export class AotGameEngine {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private onHudUpdate: (hud: HudSnapshot) => void;
  private onGameOver: (hud: HudSnapshot) => void;

  private rafId: number | null = null;
  private lastTime: number = 0;
  private running: boolean = false;
  private paused: boolean = false;

  private difficulty: Difficulty = 'scout';
  private districtId: DistrictId = 'shiganshina';
  private buildings: Building[] = [];
  private supplies: SupplyCrate[] = [];
  private lamps: StreetLamp[] = [];
  private titans: Titan[] = [];
  private particles: Particle[] = [];
  private slashArcs: SlashArc[] = [];
  private floatingTexts: FloatingText[] = [];

  private player!: Player;
  private nextEntityId = { current: 100 };

  private wave: number = 1;
  private waveBannerTimer: number = 0;
  private waveClearDelay: number = 0;
  private score: number = 0;
  private kills: number = 0;
  private combo: number = 0;
  private comboTimer: number = 0;
  private maxCombo: number = 0;
  private bestSpeedKmh: number = 0;
  private gameOverReason: string = '';

  // Camera & Juice
  private camX: number = WORLD_WIDTH / 2;
  private camY: number = GROUND_Y - 350;
  private camZoom: number = 0.85;
  private shakeTimer: number = 0;
  private shakeMagnitude: number = 0;
  private slowMoTimer: number = 0;
  private hitStopTimer: number = 0;

  // Input state
  private keys = new Set<string>();
  private mouseScreenX: number = 0;
  private mouseScreenY: number = 0;
  private mouseWorldX: number = WORLD_WIDTH / 2;
  private mouseWorldY: number = GROUND_Y - 300;
  private mouseLeftDown: boolean = false;
  private aimTarget: AimTarget | null = null;
  private hudAccumulator: number = 0;

  constructor(
    canvas: HTMLCanvasElement,
    onHudUpdate: (hud: HudSnapshot) => void,
    onGameOver: (hud: HudSnapshot) => void
  ) {
    this.canvas = canvas;
    const context = canvas.getContext('2d');
    if (!context) {
      throw new Error('Canvas 2D context unavailable');
    }
    this.ctx = context;
    this.onHudUpdate = onHudUpdate;
    this.onGameOver = onGameOver;
    this.bindEvents();
  }

  private handleKeyDown = (e: KeyboardEvent) => {
    if (!this.running || this.paused) return;
    const code = e.code;

    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(code)) {
      e.preventDefault();
    }

    if (!this.keys.has(code)) {
      // Single-press triggers
      if (code === 'KeyF' || code === 'KeyE' || code === 'KeyJ') {
        this.triggerSlashOrEscape();
      } else if (code === 'KeyR') {
        this.triggerReload();
      } else if (code === 'Space' && this.player.grabbedByTitanId !== null) {
        this.advanceGrabEscape();
      } else if ((code === 'KeyW' || code === 'ArrowUp') && this.player.grounded) {
        this.player.vy = -520;
        this.player.grounded = false;
      }
    }

    this.keys.add(code);
  };

  private handleKeyUp = (e: KeyboardEvent) => {
    this.keys.delete(e.code);
  };

  private handleMouseMove = (e: MouseEvent) => {
    const rect = this.canvas.getBoundingClientRect();
    this.mouseScreenX = e.clientX - rect.left;
    this.mouseScreenY = e.clientY - rect.top;
  };

  private handleMouseDown = (e: MouseEvent) => {
    if (!this.running || this.paused) return;
    const rect = this.canvas.getBoundingClientRect();
    this.mouseScreenX = e.clientX - rect.left;
    this.mouseScreenY = e.clientY - rect.top;
    this.updateMouseWorld();

    if (e.button === 0) {
      if (this.player.grabbedByTitanId !== null) {
        this.advanceGrabEscape();
        return;
      }
      this.mouseLeftDown = true;
      this.tryAttachGrapple();
    } else if (e.button === 2) {
      e.preventDefault();
      this.triggerSlashOrEscape();
    }
  };

  private handleMouseUp = (e: MouseEvent) => {
    if (e.button === 0) {
      this.mouseLeftDown = false;
      this.releaseGrapple();
    }
  };

  private handleContextMenu = (e: MouseEvent) => {
    e.preventDefault();
  };

  private handleBlur = () => {
    this.keys.clear();
    this.mouseLeftDown = false;
    this.releaseGrapple();
  };

  private bindEvents() {
    window.addEventListener('keydown', this.handleKeyDown);
    window.addEventListener('keyup', this.handleKeyUp);
    window.addEventListener('blur', this.handleBlur);
    this.canvas.addEventListener('mousemove', this.handleMouseMove);
    this.canvas.addEventListener('mousedown', this.handleMouseDown);
    window.addEventListener('mouseup', this.handleMouseUp);
    this.canvas.addEventListener('contextmenu', this.handleContextMenu);
  }

  public destroy() {
    this.stop();
    window.removeEventListener('keydown', this.handleKeyDown);
    window.removeEventListener('keyup', this.handleKeyUp);
    window.removeEventListener('blur', this.handleBlur);
    this.canvas.removeEventListener('mousemove', this.handleMouseMove);
    this.canvas.removeEventListener('mousedown', this.handleMouseDown);
    window.removeEventListener('mouseup', this.handleMouseUp);
    this.canvas.removeEventListener('contextmenu', this.handleContextMenu);
  }

  public startNewGame(difficulty: Difficulty, districtId: DistrictId = 'shiganshina') {
    this.difficulty = difficulty;
    this.districtId = districtId;
    const { buildings, supplies, lamps } = createDistrictWorld(districtId);
    this.buildings = buildings;
    this.supplies = supplies;
    this.lamps = lamps;
    this.particles = [];
    this.slashArcs = [];
    this.floatingTexts = [];

    const startX = WORLD_WIDTH / 2;
    const startY = GROUND_Y - 310;

    const cape: CapePoint[] = [];
    for (let i = 0; i < 6; i++) {
      cape.push({ x: startX, y: startY });
    }

    this.player = {
      x: startX,
      y: startY,
      vx: 0,
      vy: 0,
      facing: 1,
      grounded: false,
      hp: 100,
      maxHp: 100,
      gas: 100,
      maxGas: 100,
      bladeDurability: 100,
      maxBladeDurability: 100,
      spareBlades: 6,
      maxSpareBlades: 6,
      slashTimer: 0,
      slashCooldown: 0,
      slashAngle: 0,
      spinTimer: 0,
      reloadTimer: 0,
      invulnTimer: 0,
      grabbedByTitanId: null,
      escapeProgress: 0,
      hook: {
        active: false,
        anchorX: 0,
        anchorY: 0,
        attachedTitanId: null,
        offsetX: 0,
        offsetY: 0,
        wireLength: 0,
      },
      cape,
      animTime: 0,
      boosting: false,
    };

    this.wave = 1;
    this.score = 0;
    this.kills = 0;
    this.combo = 0;
    this.comboTimer = 0;
    this.maxCombo = 0;
    this.bestSpeedKmh = 0;
    this.gameOverReason = '';
    this.waveClearDelay = 0;
    this.slowMoTimer = 0;
    this.hitStopTimer = 0;
    this.shakeTimer = 0;

    this.titans = spawnTitanWave(1, difficulty, startX, this.nextEntityId);
    this.waveBannerTimer = 2.6;
    this.spawnSignalFlare(startX, GROUND_Y - 450, '#10B981');
    soundEngine.playTitanRoar();

    this.camX = startX;
    this.camY = startY;
    this.camZoom = 0.82;
    this.paused = false;
    this.running = true;
    this.lastTime = performance.now();

    this.emitHud();
    if (this.rafId === null) {
      this.rafId = requestAnimationFrame(this.loop);
    }
  }

  public setPaused(paused: boolean) {
    this.paused = paused;
    if (!paused && this.running) {
      this.lastTime = performance.now();
    }
  }

  public stop() {
    this.running = false;
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  public toggleMute(): boolean {
    const next = !soundEngine.isMuted();
    soundEngine.setMuted(next);
    this.emitHud();
    return next;
  }

  private loop = (now: number) => {
    if (!this.running) {
      this.rafId = null;
      return;
    }

    const rawDt = Math.min(0.033, Math.max(0.001, (now - this.lastTime) / 1000));
    this.lastTime = now;

    if (!this.paused) {
      this.step(rawDt);
    }
    this.render();

    this.rafId = requestAnimationFrame(this.loop);
  };

  private updateMouseWorld() {
    const w = this.canvas.width;
    const h = this.canvas.height;
    this.mouseWorldX = (this.mouseScreenX - w / 2) / this.camZoom + this.camX;
    this.mouseWorldY = (this.mouseScreenY - h / 2) / this.camZoom + this.camY;
  }

  private findAimTarget(): AimTarget | null {
    const px = this.player.x;
    const py = this.player.y - 12;
    const dx = this.mouseWorldX - px;
    const dy = this.mouseWorldY - py;
    const dist = Math.hypot(dx, dy);
    if (dist < 4) return null;

    const dirX = dx / dist;
    const dirY = dy / dist;

    let bestT = MAX_HOOK_RANGE;
    let bestTarget: AimTarget | null = null;

    // 1. Raycast against buildings
    for (const b of this.buildings) {
      const hitT = this.rayRectIntersection(px, py, dirX, dirY, b.x, b.y, b.width, b.height);
      if (hitT !== null && hitT > 16 && hitT < bestT) {
        bestT = hitT;
        bestTarget = {
          x: px + dirX * hitT,
          y: py + dirY * hitT,
          titanId: null,
          offsetX: 0,
          offsetY: 0,
        };
      }
    }

    // 2. Raycast against Titan bodies (shoulders / torso)
    for (const t of this.titans) {
      if (t.dead || t.dyingTimer > 0) continue;
      const anat = getTitanAnatomy(t);
      const hitT = this.rayCircleIntersection(
        px,
        py,
        dirX,
        dirY,
        anat.torsoCenterX,
        anat.torsoCenterY,
        anat.torsoRadius * 1.15
      );
      if (hitT !== null && hitT > 20 && hitT < bestT) {
        bestT = hitT;
        const hx = px + dirX * hitT;
        const hy = py + dirY * hitT;
        bestTarget = {
          x: hx,
          y: hy,
          titanId: t.id,
          offsetX: hx - t.x,
          offsetY: hy - t.y,
        };
      }
    }

    // 3. Smart snap assist near cursor if direct ray missed (e.g., aiming slightly above a roof)
    if (!bestTarget) {
      let closestSnapDist = 110;
      for (const b of this.buildings) {
        const clampedX = Math.max(b.x, Math.min(b.x + b.width, this.mouseWorldX));
        const clampedY = Math.max(b.y, Math.min(b.y + b.height, this.mouseWorldY));
        const dCursor = Math.hypot(clampedX - this.mouseWorldX, clampedY - this.mouseWorldY);
        const dPlayer = Math.hypot(clampedX - px, clampedY - py);
        if (dCursor < closestSnapDist && dPlayer <= MAX_HOOK_RANGE) {
          closestSnapDist = dCursor;
          bestTarget = {
            x: clampedX,
            y: clampedY,
            titanId: null,
            offsetX: 0,
            offsetY: 0,
          };
        }
      }
    }

    return bestTarget;
  }

  private rayRectIntersection(
    ox: number,
    oy: number,
    dx: number,
    dy: number,
    rx: number,
    ry: number,
    rw: number,
    rh: number
  ): number | null {
    const invX = dx !== 0 ? 1 / dx : 1e9;
    const invY = dy !== 0 ? 1 / dy : 1e9;

    const t1 = (rx - ox) * invX;
    const t2 = (rx + rw - ox) * invX;
    const t3 = (ry - oy) * invY;
    const t4 = (ry + rh - oy) * invY;

    const tmin = Math.max(Math.min(t1, t2), Math.min(t3, t4));
    const tmax = Math.min(Math.max(t1, t2), Math.max(t3, t4));

    if (tmax < 0 || tmin > tmax) return null;
    return tmin >= 0 ? tmin : tmax;
  }

  private rayCircleIntersection(
    ox: number,
    oy: number,
    dx: number,
    dy: number,
    cx: number,
    cy: number,
    r: number
  ): number | null {
    const fx = ox - cx;
    const fy = oy - cy;
    const b = 2 * (fx * dx + fy * dy);
    const c = fx * fx + fy * fy - r * r;
    const disc = b * b - 4 * c;
    if (disc < 0) return null;
    const sqrtDisc = Math.sqrt(disc);
    const t1 = (-b - sqrtDisc) / 2;
    const t2 = (-b + sqrtDisc) / 2;
    if (t1 >= 0) return t1;
    if (t2 >= 0) return t2;
    return null;
  }

  private tryAttachGrapple() {
    if (this.player.gas <= 0.5) {
      this.spawnFloatingText(this.player.x, this.player.y - 40, '가스 부족!', undefined, '#F59E0B', 0.9);
      return;
    }
    const target = this.findAimTarget();
    if (!target) return;

    this.player.hook = {
      active: true,
      anchorX: target.x,
      anchorY: target.y,
      attachedTitanId: target.titanId,
      offsetX: target.offsetX,
      offsetY: target.offsetY,
      wireLength: Math.hypot(target.x - this.player.x, target.y - (this.player.y - 12)),
    };
    this.player.grounded = false;

    soundEngine.playGrapple();
    for (let i = 0; i < 6; i++) {
      const ang = Math.random() * Math.PI * 2;
      const spd = 80 + Math.random() * 140;
      this.particles.push({
        x: target.x,
        y: target.y,
        vx: Math.cos(ang) * spd,
        vy: Math.sin(ang) * spd,
        size: 2.5,
        alpha: 1,
        life: 0.25,
        maxLife: 0.25,
        color: '#FDE047',
        kind: 'spark',
      });
    }
  }

  private releaseGrapple() {
    this.player.hook.active = false;
    this.player.hook.attachedTitanId = null;
  }

  private triggerReload() {
    const p = this.player;
    if (p.reloadTimer > 0) return;
    if (p.bladeDurability >= 99) return;
    if (p.spareBlades <= 0) {
      this.spawnFloatingText(p.x, p.y - 45, '예비 칼날 없음!', '보급소에서 충전하세요', '#EF4444', 1);
      return;
    }

    p.reloadTimer = 0.42;
    p.spareBlades -= 1;
    soundEngine.playBladeReload();

    // Eject broken blade shards
    for (let i = 0; i < 2; i++) {
      this.particles.push({
        x: p.x + (i === 0 ? -8 : 8),
        y: p.y - 14,
        vx: (i === 0 ? -1 : 1) * (90 + Math.random() * 60),
        vy: -120 - Math.random() * 60,
        size: 12,
        alpha: 1,
        life: 0.85,
        maxLife: 0.85,
        color: '#CBD5E1',
        kind: 'shard',
        rotation: Math.random() * Math.PI,
        vRot: (Math.random() - 0.5) * 14,
      });
    }
  }

  private advanceGrabEscape() {
    const p = this.player;
    p.escapeProgress += 26;
    soundEngine.playSlash(false);
    if (p.escapeProgress >= 100) {
      const titan = this.titans.find((t) => t.id === p.grabbedByTitanId);
      if (titan) {
        titan.grabbingPlayer = false;
        titan.staggerTimer = 1.6;
        titan.attackCooldown = 2.0;
        const anat = getTitanAnatomy(titan);
        this.spawnBloodBurst(anat.handX, anat.handY, 12);
      }
      p.grabbedByTitanId = null;
      p.escapeProgress = 0;
      p.invulnTimer = 1.0;
      p.vy = -480;
      p.vx = p.facing * 260;
      this.spawnFloatingText(p.x, p.y - 40, '손가락 절단 탈출!', undefined, '#34D399', 1.15);
    }
  }

  private triggerSlashOrEscape() {
    const p = this.player;
    if (p.grabbedByTitanId !== null) {
      this.advanceGrabEscape();
      return;
    }
    if (p.slashCooldown > 0 || p.reloadTimer > 0) return;

    if (p.bladeDurability <= 0) {
      if (p.spareBlades > 0) {
        this.triggerReload();
      } else {
        this.spawnFloatingText(p.x, p.y - 40, '칼날 파손!', '보급소 필요', '#EF4444', 1);
      }
      return;
    }

    const speed = Math.hypot(p.vx, p.vy);
    const isSpin = speed > 560;
    const aimAngle = Math.atan2(this.mouseWorldY - (p.y - 14), this.mouseWorldX - p.x);

    p.slashTimer = isSpin ? 0.24 : 0.17;
    p.slashCooldown = 0.25;
    p.slashAngle = aimAngle;
    p.spinTimer = isSpin ? 0.24 : 0;
    p.facing = Math.cos(aimAngle) >= 0 ? 1 : -1;

    // Slight forward lunge in slash direction
    if (!p.grounded) {
      p.vx += Math.cos(aimAngle) * 140;
      p.vy += Math.sin(aimAngle) * 110;
    }

    p.bladeDurability = Math.max(0, p.bladeDurability - 14);
    soundEngine.playSlash(isSpin);

    this.slashArcs.push({
      x: p.x,
      y: p.y - 14,
      angle: aimAngle,
      radius: isSpin ? 72 : 62,
      life: 0.2,
      maxLife: 0.2,
      isSpin,
      isCrit: speed * PX_TO_KMH >= 95,
    });

    this.evaluateSlashHits(aimAngle, speed, isSpin);
  }

  private evaluateSlashHits(aimAngle: number, speed: number, isSpin: boolean) {
    const p = this.player;
    const speedKmh = speed * PX_TO_KMH;
    const slashReach = isSpin ? 82 : 70;
    const slashX = p.x + Math.cos(aimAngle) * 28;
    const slashY = p.y - 14 + Math.sin(aimAngle) * 28;

    const durabilityFactor = p.bladeDurability > 15 ? 1.0 : 0.55;
    const speedDamage = Math.round((45 + speedKmh * 1.15) * durabilityFactor * (isSpin ? 1.25 : 1.0));

    let hitSomething = false;

    for (const t of this.titans) {
      if (t.dead || t.dyingTimer > 0) continue;
      const anat = getTitanAnatomy(t);

      // 1. Check Nape Weak Point (목덜미)
      const distNape = Math.hypot(slashX - anat.napeX, slashY - anat.napeY);
      const distPlayerNape = Math.hypot(p.x - anat.napeX, p.y - 14 - anat.napeY);
      if (Math.min(distNape, distPlayerNape) <= anat.napeRadius + slashReach * 0.55) {
        hitSomething = true;
        const isCrit = speedKmh >= 95;
        const dmg = isCrit ? Math.max(speedDamage, t.hp) : speedDamage;
        t.hp -= dmg;
        t.staggerTimer = 0.65;

        this.spawnBloodBurst(anat.napeX, anat.napeY, isCrit ? 26 : 16);
        soundEngine.playNapeKill(isCrit || t.hp <= 0);

        if (t.hp <= 0) {
          this.killTitan(t, speedKmh, isCrit);
        } else {
          this.hitStopTimer = 0.045;
          this.triggerShake(6, 0.14);
          this.spawnFloatingText(
            anat.napeX,
            anat.napeY - 25,
            `목덜미 타격 -${dmg}`,
            '속도를 더 높여 일격에 베세요!',
            '#FBBF24',
            1.0
          );
        }
        continue;
      }

      // 2. Check Eyes / Face (눈 베기 - 실명)
      const distEye = Math.hypot(slashX - anat.eyeX, slashY - anat.eyeY);
      if (distEye <= anat.eyeRadius + slashReach * 0.5) {
        hitSomething = true;
        t.blindTimer = 4.2;
        t.staggerTimer = 1.1;
        this.spawnBloodBurst(anat.eyeX, anat.eyeY, 12);
        this.triggerShake(5, 0.12);
        this.spawnFloatingText(
          anat.eyeX,
          anat.eyeY - 25,
          '시야 차단!',
          '뒷목(목덜미)으로 돌아가세요',
          '#38BDF8',
          1.0
        );
        continue;
      }

      // 3. Check Armored / Body deflection
      const distTorso = Math.hypot(slashX - anat.torsoCenterX, slashY - anat.torsoCenterY);
      if (distTorso <= anat.torsoRadius + slashReach * 0.4 && t.kind === 'armored') {
        hitSomething = true;
        for (let i = 0; i < 8; i++) {
          const ang = Math.random() * Math.PI * 2;
          this.particles.push({
            x: slashX,
            y: slashY,
            vx: Math.cos(ang) * 180,
            vy: Math.sin(ang) * 180,
            size: 3,
            alpha: 1,
            life: 0.25,
            maxLife: 0.25,
            color: '#FACC15',
            kind: 'spark',
          });
        }
        this.spawnFloatingText(slashX, slashY - 20, '경질화 장갑!', '목덜미를 노리세요', '#F87171', 0.9);
      }
    }

    if (hitSomething && p.bladeDurability <= 0) {
      this.spawnFloatingText(p.x, p.y - 45, '칼날 마모! [R] 교체', undefined, '#F59E0B', 0.95);
    }
  }

  private killTitan(t: Titan, speedKmh: number, isCrit: boolean) {
    t.dyingTimer = 1.6;
    t.grabbingPlayer = false;
    if (this.player.hook.attachedTitanId === t.id) {
      this.releaseGrapple();
    }

    this.kills += 1;
    this.combo += 1;
    this.comboTimer = 4.8;
    if (this.combo > this.maxCombo) this.maxCombo = this.combo;

    const mult = getDifficultyMultipliers(this.difficulty).scoreMult;
    const basePoints = t.kind === 'armored' ? 450 : t.kind === 'abnormal' ? 220 : 150;
    const speedBonus = Math.round(speedKmh * 1.5);
    const comboMult = 1 + (this.combo - 1) * 0.25;
    const earned = Math.round((basePoints + speedBonus) * comboMult * mult);
    this.score += earned;

    // Juice: Hitstop + Slow-mo + Screen shake
    this.hitStopTimer = isCrit ? 0.09 : 0.06;
    this.slowMoTimer = isCrit ? 0.28 : 0.16;
    this.triggerShake(isCrit ? 14 : 9, 0.25);

    const anat = getTitanAnatomy(t);
    const label =
      this.combo >= 3
        ? `연속 토벌 x${this.combo}! +${earned}`
        : isCrit
          ? `완전 절단! +${earned}`
          : `거인 토벌! +${earned}`;
    const sub = `${Math.round(speedKmh)} km/h`;
    this.spawnFloatingText(anat.napeX, anat.napeY - 30, label, sub, isCrit ? '#F43F5E' : '#34D399', 1.25);
  }

  private triggerShake(magnitude: number, duration: number) {
    this.shakeMagnitude = Math.max(this.shakeMagnitude, magnitude);
    this.shakeTimer = Math.max(this.shakeTimer, duration);
  }

  private spawnBloodBurst(x: number, y: number, count: number) {
    for (let i = 0; i < count; i++) {
      const ang = Math.random() * Math.PI * 2;
      const spd = 80 + Math.random() * 280;
      this.particles.push({
        x,
        y,
        vx: Math.cos(ang) * spd,
        vy: Math.sin(ang) * spd - 60,
        size: 3 + Math.random() * 5,
        alpha: 0.95,
        life: 0.45 + Math.random() * 0.35,
        maxLife: 0.8,
        color: Math.random() > 0.2 ? '#DC2626' : '#991B1B',
        kind: 'blood',
      });
    }
  }

  private spawnSteam(x: number, y: number, vx: number, vy: number, size: number, life: number) {
    this.particles.push({
      x,
      y,
      vx,
      vy,
      size,
      alpha: 0.65,
      life,
      maxLife: life,
      color: '#E2E8F0',
      kind: 'steam',
    });
  }

  private spawnSignalFlare(x: number, y: number, color: string) {
    for (let i = 0; i < 24; i++) {
      this.particles.push({
        x: x + (Math.random() - 0.5) * 16,
        y: y - i * 12,
        vx: (Math.random() - 0.5) * 28,
        vy: -140 - Math.random() * 120,
        size: 10 + Math.random() * 14,
        alpha: 0.85,
        life: 1.6,
        maxLife: 1.6,
        color,
        kind: 'flare',
      });
    }
  }

  private spawnFloatingText(
    x: number,
    y: number,
    text: string,
    subtext: string | undefined,
    color: string,
    scale: number
  ) {
    this.floatingTexts.push({
      x,
      y,
      vy: -55,
      text,
      subtext,
      color,
      life: 1.25,
      maxLife: 1.25,
      scale,
    });
  }

  private step(rawDt: number) {
    if (this.hitStopTimer > 0) {
      this.hitStopTimer -= rawDt;
      return;
    }

    let dt = rawDt;
    if (this.slowMoTimer > 0) {
      this.slowMoTimer -= rawDt;
      dt *= 0.32;
    }

    if (this.shakeTimer > 0) {
      this.shakeTimer -= rawDt;
      if (this.shakeTimer <= 0) this.shakeMagnitude = 0;
    }

    if (this.waveBannerTimer > 0) this.waveBannerTimer -= rawDt;
    if (this.comboTimer > 0) {
      this.comboTimer -= rawDt;
      if (this.comboTimer <= 0) this.combo = 0;
    }

    this.updateMouseWorld();
    this.aimTarget = this.findAimTarget();

    this.updatePlayer(dt);
    this.updateTitans(dt);
    this.updateSupplies(dt);
    this.updateParticles(dt);
    this.updateCamera(rawDt);

    // Check Wave completion
    const aliveTitans = this.titans.filter((t) => !t.dead && t.dyingTimer <= 0).length;
    if (aliveTitans === 0) {
      this.waveClearDelay += rawDt;
      if (this.waveClearDelay >= 1.8) {
        this.waveClearDelay = 0;
        this.wave += 1;
        this.titans = spawnTitanWave(this.wave, this.difficulty, this.player.x, this.nextEntityId);
        this.waveBannerTimer = 2.8;
        this.spawnSignalFlare(this.player.x, this.player.y - 40, '#10B981');
        soundEngine.playTitanRoar();
      }
    }

    this.hudAccumulator += rawDt;
    if (this.hudAccumulator >= 0.05) {
      this.hudAccumulator = 0;
      this.emitHud();
    }
  }

  private updatePlayer(dt: number) {
    const p = this.player;
    const mult = getDifficultyMultipliers(this.difficulty);
    p.animTime += dt;

    if (p.slashTimer > 0) p.slashTimer -= dt;
    if (p.slashCooldown > 0) p.slashCooldown -= dt;
    if (p.spinTimer > 0) p.spinTimer -= dt;
    if (p.invulnTimer > 0) p.invulnTimer -= dt;

    if (p.reloadTimer > 0) {
      p.reloadTimer -= dt;
      if (p.reloadTimer <= 0) {
        p.reloadTimer = 0;
        p.bladeDurability = p.maxBladeDurability;
        this.spawnFloatingText(p.x, p.y - 38, '칼날 교체 완료', undefined, '#E2E8F0', 0.9);
      }
    }

    // Grabbed state
    if (p.grabbedByTitanId !== null) {
      const titan = this.titans.find((t) => t.id === p.grabbedByTitanId);
      if (!titan || titan.dead || titan.dyingTimer > 0) {
        p.grabbedByTitanId = null;
        p.escapeProgress = 0;
      } else {
        const anat = getTitanAnatomy(titan);
        p.x = anat.handX;
        p.y = anat.handY;
        p.vx = 0;
        p.vy = 0;
        p.hp -= 18 * mult.damageTaken * dt;
        p.escapeProgress = Math.max(0, p.escapeProgress - 12 * dt);
        if (p.hp <= 0) {
          this.triggerGameOver('거인에게 포획되어 전사했습니다.');
        }
        this.updateCape(dt);
        return;
      }
    }

    const moveLeft = this.keys.has('KeyA') || this.keys.has('ArrowLeft');
    const moveRight = this.keys.has('KeyD') || this.keys.has('ArrowRight');
    const moveUp = this.keys.has('KeyW') || this.keys.has('ArrowUp');
    const moveDown = this.keys.has('KeyS') || this.keys.has('ArrowDown');
    const gasBoost = this.keys.has('Space') || this.keys.has('ShiftLeft') || this.keys.has('ShiftRight');

    // Horizontal directional input
    const inputX = (moveRight ? 1 : 0) - (moveLeft ? 1 : 0);
    const inputY = (moveDown ? 1 : 0) - (moveUp ? 1 : 0);
    if (inputX !== 0) p.facing = inputX > 0 ? 1 : -1;

    if (p.grounded) {
      p.vx += inputX * 1450 * dt;
      p.vx *= Math.pow(0.0012, dt);
    } else {
      p.vx += inputX * 420 * dt;
    }

    // Gravity
    p.vy += GRAVITY * dt;

    // Grapple Hook Physics
    if (p.hook.active) {
      if (p.hook.attachedTitanId !== null) {
        const targetTitan = this.titans.find((t) => t.id === p.hook.attachedTitanId);
        if (!targetTitan || targetTitan.dead || targetTitan.dyingTimer > 0) {
          this.releaseGrapple();
        } else {
          p.hook.anchorX = targetTitan.x + p.hook.offsetX;
          p.hook.anchorY = targetTitan.y + p.hook.offsetY;
        }
      }
    }

    if (p.hook.active) {
      const dx = p.hook.anchorX - p.x;
      const dy = p.hook.anchorY - (p.y - 12);
      const dist = Math.hypot(dx, dy);

      if (dist > 10 && p.gas > 0) {
        const nx = dx / dist;
        const ny = dy / dist;

        // Reel in wire & pull scout
        p.hook.wireLength = Math.max(45, Math.min(p.hook.wireLength, dist) - 340 * dt);
        const pullForce = 1650;
        p.vx += nx * pullForce * dt;
        p.vy += ny * pullForce * dt;

        // Pendulum constraint when taut
        if (dist > p.hook.wireLength) {
          const radialVel = p.vx * nx + p.vy * ny;
          if (radialVel < 0) {
            p.vx -= radialVel * nx * 0.72;
            p.vy -= radialVel * ny * 0.72;
          }
          const stretch = dist - p.hook.wireLength;
          p.vx += nx * Math.min(stretch * 14, 900) * dt;
          p.vy += ny * Math.min(stretch * 14, 900) * dt;
        }

        p.gas = Math.max(0, p.gas - 3.6 * mult.gasDrain * dt);
      } else if (p.gas <= 0) {
        this.releaseGrapple();
      }
    }

    // Gas Boost (Space / Shift)
    p.boosting = false;
    if (gasBoost && p.gas > 0) {
      p.boosting = true;
      let bx = inputX;
      let by = inputY;
      if (bx === 0 && by === 0) {
        const aimDx = this.mouseWorldX - p.x;
        const aimDy = this.mouseWorldY - (p.y - 12);
        const aimLen = Math.hypot(aimDx, aimDy) || 1;
        bx = aimDx / aimLen;
        by = aimDy / aimLen;
      } else {
        const bLen = Math.hypot(bx, by) || 1;
        bx /= bLen;
        by /= bLen;
      }

      p.vx += bx * 1850 * dt;
      p.vy += by * 1850 * dt;
      p.grounded = false;
      p.gas = Math.max(0, p.gas - 13 * mult.gasDrain * dt);

      soundEngine.playGasBoost();
      this.spawnSteam(
        p.x - bx * 12 + (Math.random() - 0.5) * 6,
        p.y - 12 - by * 12 + (Math.random() - 0.5) * 6,
        -bx * 180 + (Math.random() - 0.5) * 60,
        -by * 180 + (Math.random() - 0.5) * 60,
        6 + Math.random() * 6,
        0.35
      );
    }

    // Air drag & speed cap
    const maxSpeed = 1480; // ~177 km/h
    const speed = Math.hypot(p.vx, p.vy);
    if (speed > maxSpeed) {
      p.vx = (p.vx / speed) * maxSpeed;
      p.vy = (p.vy / speed) * maxSpeed;
    } else {
      p.vx *= Math.pow(0.84, dt);
      p.vy *= Math.pow(0.92, dt);
    }

    const kmh = Math.round(Math.hypot(p.vx, p.vy) * PX_TO_KMH);
    if (kmh > this.bestSpeedKmh) this.bestSpeedKmh = kmh;

    // Integrate & Resolve Collisions with Buildings + Ground
    const prevY = p.y;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.grounded = false;

    // World bounds
    if (p.x < 195) {
      p.x = 195;
      p.vx = Math.max(0, p.vx);
    } else if (p.x > WORLD_WIDTH - 195) {
      p.x = WORLD_WIDTH - 195;
      p.vx = Math.min(0, p.vx);
    }
    if (p.y < CEILING_Y) {
      p.y = CEILING_Y;
      p.vy = Math.max(0, p.vy);
    }

    // Ground collision
    if (p.y >= GROUND_Y) {
      p.y = GROUND_Y;
      if (p.vy > 0) p.vy = 0;
      p.grounded = true;
    }

    // Building rooftop landing + wall slide
    const halfW = 10;
    const height = 28;
    for (const b of this.buildings) {
      if (b.style === 'wall') continue;
      if (p.x + halfW > b.x && p.x - halfW < b.x + b.width && p.y > b.y && p.y - height < GROUND_Y) {
        // Landed on rooftop from above
        if (prevY <= b.y + 12 && p.vy >= 0) {
          p.y = b.y;
          p.vy = 0;
          p.grounded = true;
        } else {
          // Side push out
          const overlapLeft = p.x + halfW - b.x;
          const overlapRight = b.x + b.width - (p.x - halfW);
          if (overlapLeft < overlapRight) {
            p.x = b.x - halfW;
            if (p.vx > 0) p.vx = 0;
          } else {
            p.x = b.x + b.width + halfW;
            if (p.vx < 0) p.vx = 0;
          }
        }
      }
    }

    // Subtle passive gas regeneration when resting on rooftops/ground
    if (p.grounded && p.gas < p.maxGas) {
      p.gas = Math.min(p.maxGas, p.gas + 3.5 * dt);
    }

    this.updateCape(dt);
  }

  private updateCape(dt: number) {
    const p = this.player;
    p.cape[0].x = p.x - p.facing * 4;
    p.cape[0].y = p.y - 20;

    for (let i = 1; i < p.cape.length; i++) {
      const prev = p.cape[i - 1];
      const curr = p.cape[i];
      // Flutter + gravity
      curr.y += (120 + Math.sin(p.animTime * 16 + i) * 35) * dt;
      curr.x -= p.facing * 50 * dt;

      const dx = curr.x - prev.x;
      const dy = curr.y - prev.y;
      const d = Math.hypot(dx, dy) || 1;
      const segLen = 5.5;
      if (d > segLen) {
        curr.x = prev.x + (dx / d) * segLen;
        curr.y = prev.y + (dy / d) * segLen;
      }
    }
  }

  private updateTitans(dt: number) {
    const p = this.player;
    const mult = getDifficultyMultipliers(this.difficulty);

    for (const t of this.titans) {
      if (t.dead) continue;

      if (t.dyingTimer > 0) {
        t.dyingTimer -= dt;
        // Disintegration steam
        if (Math.random() < 0.7) {
          const anat = getTitanAnatomy(t);
          this.spawnSteam(
            t.x + (Math.random() - 0.5) * 60 * t.scale,
            anat.torsoCenterY + (Math.random() - 0.5) * 70 * t.scale,
            (Math.random() - 0.5) * 45,
            -60 - Math.random() * 80,
            18 * t.scale,
            0.9
          );
        }
        if (t.dyingTimer <= 0) {
          t.dead = true;
        }
        continue;
      }

      if (t.blindTimer > 0) t.blindTimer -= dt;
      if (t.staggerTimer > 0) t.staggerTimer -= dt;
      if (t.attackCooldown > 0) t.attackCooldown -= dt;

      const dxToPlayer = p.x - t.x;
      const distToPlayer = Math.hypot(dxToPlayer, p.y - (t.y - 90 * t.scale));

      if (t.blindTimer <= 0 && t.staggerTimer <= 0 && !t.grabbingPlayer) {
        // Face & pursue player
        if (Math.abs(dxToPlayer) > 25) {
          t.facing = dxToPlayer > 0 ? 1 : -1;
        }

        const baseWalkSpeed =
          t.kind === 'abnormal' ? 195 : t.kind === 'armored' ? 145 : 105;
        t.vx = t.facing * baseWalkSpeed * mult.titanSpeed;
        t.walkPhase += dt * (t.kind === 'abnormal' ? 6.5 : 3.6);

        // Abnormal leap attack
        if (t.kind === 'abnormal' && t.y >= GROUND_Y - 1) {
          t.leapTimer -= dt;
          if (t.leapTimer <= 0 && distToPlayer < 460 && p.y < GROUND_Y - 90) {
            t.vy = -610;
            t.vx = t.facing * 320 * mult.titanSpeed;
            t.leapTimer = 3.6 + Math.random() * 2.4;
            soundEngine.playTitanRoar();
          }
        }
      } else {
        t.vx *= 0.85;
      }

      // Gravity for leaping titans
      t.vy += GRAVITY * dt;
      t.x += t.vx * dt;
      t.y += t.vy * dt;
      if (t.y >= GROUND_Y) {
        t.y = GROUND_Y;
        t.vy = 0;
      }
      t.x = Math.max(240, Math.min(WORLD_WIDTH - 240, t.x));

      // Arm reaching angle toward player
      const anat = getTitanAnatomy(t);
      if (t.blindTimer > 0) {
        t.reachAngle = Math.sin(p.animTime * 9) * 0.8 - 1.2;
      } else if (t.grabbingPlayer) {
        t.reachAngle = t.facing === 1 ? -0.45 : Math.PI + 0.45;
      } else {
        const targetAng = Math.atan2(p.y - 16 - (anat.shoulderY + 10 * t.scale), p.x - (t.x + t.facing * 12 * t.scale));
        t.reachAngle = targetAng;
      }

      // Check Grab / Swat Hitbox against Player
      if (
        p.grabbedByTitanId === null &&
        p.invulnTimer <= 0 &&
        p.slashTimer <= 0 &&
        t.blindTimer <= 0 &&
        t.staggerTimer <= 0 &&
        t.attackCooldown <= 0
      ) {
        const updatedAnat = getTitanAnatomy(t);
        const handDist = Math.hypot(p.x - updatedAnat.handX, p.y - 14 - updatedAnat.handY);
        if (handDist < updatedAnat.handRadius + 14) {
          // Grab player!
          p.grabbedByTitanId = t.id;
          p.escapeProgress = 0;
          this.releaseGrapple();
          t.grabbingPlayer = true;
          p.hp -= 16 * mult.damageTaken;
          soundEngine.playDamage();
          this.triggerShake(10, 0.2);

          if (p.hp <= 0) {
            this.triggerGameOver('거인의 손에 붙잡혀 전사했습니다.');
          }
        }
      }
    }
  }

  private updateSupplies(dt: number) {
    const p = this.player;
    for (const s of this.supplies) {
      if (s.cooldown > 0) {
        s.cooldown = Math.max(0, s.cooldown - dt);
        continue;
      }
      const dist = Math.hypot(p.x - s.x, p.y - (s.y - 16));
      if (dist < 46) {
        const needsGas = p.gas < 95;
        const needsBlades = p.spareBlades < p.maxSpareBlades || p.bladeDurability < 95;
        const needsHp = p.hp < p.maxHp;
        if (needsGas || needsBlades || needsHp) {
          p.gas = p.maxGas;
          p.spareBlades = p.maxSpareBlades;
          p.bladeDurability = p.maxBladeDurability;
          p.hp = Math.min(p.maxHp, p.hp + 30);
          s.cooldown = s.maxCooldown;
          soundEngine.playSupply();
          this.spawnFloatingText(s.x, s.y - 45, '가스·칼날 완전 보급!', '체력 +30', '#10B981', 1.1);
        }
      }
    }
  }

  private updateParticles(dt: number) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const pt = this.particles[i];
      pt.life -= dt;
      if (pt.life <= 0) {
        this.particles.splice(i, 1);
        continue;
      }
      if (pt.kind === 'blood' || pt.kind === 'shard') {
        pt.vy += 540 * dt;
      } else if (pt.kind === 'steam' || pt.kind === 'flare') {
        pt.size += 16 * dt;
        pt.vx *= 0.96;
      }
      pt.x += pt.vx * dt;
      pt.y += pt.vy * dt;
      if (pt.rotation !== undefined && pt.vRot !== undefined) {
        pt.rotation += pt.vRot * dt;
      }
      pt.alpha = Math.max(0, pt.life / pt.maxLife);
    }

    for (let i = this.slashArcs.length - 1; i >= 0; i--) {
      const sa = this.slashArcs[i];
      sa.life -= dt;
      sa.x = this.player.x;
      sa.y = this.player.y - 14;
      if (sa.life <= 0) this.slashArcs.splice(i, 1);
    }

    for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
      const ft = this.floatingTexts[i];
      ft.life -= dt;
      ft.y += ft.vy * dt;
      ft.vy *= 0.94;
      if (ft.life <= 0) this.floatingTexts.splice(i, 1);
    }
  }

  private updateCamera(dt: number) {
    const p = this.player;
    const speed = Math.hypot(p.vx, p.vy);
    const lookAheadX = p.vx * 0.24;
    const lookAheadY = p.vy * 0.14 - 45;

    const targetX = p.x + lookAheadX;
    const targetY = Math.min(GROUND_Y - 210, p.y + lookAheadY);
    const targetZoom = Math.max(0.62, Math.min(0.92, 0.9 - (speed / 1500) * 0.26));

    const smooth = 1 - Math.pow(0.0008, dt);
    this.camX += (targetX - this.camX) * smooth;
    this.camY += (targetY - this.camY) * smooth;
    this.camZoom += (targetZoom - this.camZoom) * smooth;
  }

  private triggerGameOver(reason: string) {
    this.player.hp = 0;
    this.gameOverReason = reason;
    this.running = false;
    const snapshot = this.buildHudSnapshot();
    this.onHudUpdate(snapshot);
    this.onGameOver(snapshot);
  }

  private buildHudSnapshot(): HudSnapshot {
    const p = this.player;
    const speedKmh = Math.round(Math.hypot(p.vx, p.vy) * PX_TO_KMH);
    const titansRemaining = this.titans.filter((t) => !t.dead && t.dyingTimer <= 0).length;
    const nearSupply = this.supplies.some(
      (s) => s.cooldown <= 0 && Math.hypot(p.x - s.x, p.y - s.y) < 130
    );

    return {
      hp: Math.max(0, Math.round(p.hp)),
      maxHp: p.maxHp,
      gas: Math.round(p.gas),
      maxGas: p.maxGas,
      bladeDurability: Math.round(p.bladeDurability),
      maxBladeDurability: p.maxBladeDurability,
      spareBlades: p.spareBlades,
      maxSpareBlades: p.maxSpareBlades,
      speedKmh,
      score: this.score,
      kills: this.kills,
      combo: this.combo,
      comboTimer: this.comboTimer,
      wave: this.wave,
      titansRemaining,
      waveBannerTimer: this.waveBannerTimer,
      grabbed: p.grabbedByTitanId !== null,
      escapeProgress: Math.round(p.escapeProgress),
      reloading: p.reloadTimer > 0,
      nearSupply,
      bestSpeedKmh: this.bestSpeedKmh,
      maxCombo: this.maxCombo,
      muted: soundEngine.isMuted(),
      districtName: DISTRICTS[this.districtId].name,
      gameOverReason: this.gameOverReason,
    };
  }

  private emitHud() {
    this.onHudUpdate(this.buildHudSnapshot());
  }

  // ==================== RENDERING ====================
  private render() {
    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;

    ctx.save();

    const district = DISTRICTS[this.districtId];

    // 1. Atmospheric District Sky Gradient
    const skyGrad = ctx.createLinearGradient(0, 0, 0, h);
    skyGrad.addColorStop(0, district.skyColors[0]);
    skyGrad.addColorStop(0.55, district.skyColors[1]);
    skyGrad.addColorStop(0.88, district.skyColors[2]);
    skyGrad.addColorStop(1, district.skyColors[3]);
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, w, h);

    // Subtle distant sunset glow
    const sunGrad = ctx.createRadialGradient(w * 0.72, h * 0.34, 10, w * 0.72, h * 0.34, h * 0.52);
    sunGrad.addColorStop(0, 'rgba(245, 158, 11, 0.24)');
    sunGrad.addColorStop(0.5, 'rgba(217, 119, 6, 0.08)');
    sunGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = sunGrad;
    ctx.fillRect(0, 0, w, h);

    // 2. Parallax Wall Maria / District Landmarks in Background
    this.renderParallaxBackground(ctx, w, h);

    // Apply Camera Transform + Screen Shake
    let shakeX = 0;
    let shakeY = 0;
    if (this.shakeTimer > 0) {
      shakeX = (Math.random() - 0.5) * this.shakeMagnitude * 2;
      shakeY = (Math.random() - 0.5) * this.shakeMagnitude * 2;
    }

    ctx.translate(w / 2 + shakeX, h / 2 + shakeY);
    ctx.scale(this.camZoom, this.camZoom);
    ctx.translate(-this.camX, -this.camY);

    // 3. District Landmarks (Broken Gate / Trost Boulder) & Street Lamps
    this.renderDistrictLandmarks(ctx);

    // 4. District Buildings & Giant Trees
    this.renderBuildings(ctx);

    // 5. Cobblestone Street & Ground
    this.renderGround(ctx);

    // 6. Street Gas Lamps (시가지 등불)
    this.renderStreetLamps(ctx);

    // 7. Supply Depots
    this.renderSupplies(ctx);

    // 8. Titans
    this.renderTitans(ctx);

    // 9. ODM Grapple Cable & Aim Reticle
    this.renderGrappleAndAim(ctx);

    // 10. Scout Player & Slash Arcs
    this.renderPlayer(ctx);
    this.renderSlashArcs(ctx);

    // 11. Particles & Floating Combat Text
    this.renderParticles(ctx);
    this.renderFloatingTexts(ctx);

    ctx.restore();

    // 12. Screen-Space FX: Speedlines & Offscreen Titan Indicators
    this.renderScreenOverlays(ctx, w, h);
  }

  private renderParallaxBackground(ctx: CanvasRenderingContext2D, w: number, h: number) {
    const district = DISTRICTS[this.districtId];

    // Distant mountains
    ctx.fillStyle = '#141B29';
    ctx.beginPath();
    ctx.moveTo(0, h);
    const mountainOffset = -this.camX * 0.06;
    for (let x = -200; x <= w + 200; x += 160) {
      const peak =
        h * 0.54 +
        Math.sin((x - mountainOffset) * 0.004) * 55 +
        Math.cos((x - mountainOffset) * 0.009) * 30;
      ctx.lineTo(x, peak);
    }
    ctx.lineTo(w, h);
    ctx.closePath();
    ctx.fill();

    if (this.districtId === 'forest') {
      // Distant Giant Forest Canopy Silhouette
      const treeShift = ((-this.camX * 0.12) % 260 + 260) % 260;
      ctx.fillStyle = '#12221D';
      for (let x = -260 + treeShift; x < w + 260; x += 260) {
        ctx.fillRect(x + 40, h * 0.22, 46, h * 0.78);
        ctx.beginPath();
        ctx.arc(x + 63, h * 0.24, 92, 0, Math.PI * 2);
        ctx.fill();
      }
      return;
    }

    // Towering 50m Wall Maria / Rose Silhouette
    const wallTop = h * 0.44 - (this.camY - 700) * 0.08;

    // Colossal Titan peering over Wall Maria in Shiganshina!
    if (district.hasColossalSilhouette) {
      const colossalX = w * 0.5 - (this.camX - WORLD_WIDTH / 2) * 0.08;
      const colossalY = wallTop - 16;
      ctx.save();
      // Rising steam behind wall
      const steamGrad = ctx.createRadialGradient(colossalX, colossalY - 40, 12, colossalX, colossalY - 40, 190);
      steamGrad.addColorStop(0, 'rgba(226, 232, 240, 0.22)');
      steamGrad.addColorStop(1, 'rgba(226, 232, 240, 0)');
      ctx.fillStyle = steamGrad;
      ctx.beginPath();
      ctx.arc(colossalX, colossalY - 40, 190, 0, Math.PI * 2);
      ctx.fill();

      // Massive Head & Shoulders
      ctx.fillStyle = '#532523';
      ctx.beginPath();
      ctx.arc(colossalX, colossalY - 38, 52, Math.PI, 0);
      ctx.lineTo(colossalX + 58, wallTop + 10);
      ctx.lineTo(colossalX - 58, wallTop + 10);
      ctx.closePath();
      ctx.fill();

      // Glowing Eyes
      ctx.fillStyle = 'rgba(251, 191, 36, 0.85)';
      ctx.fillRect(colossalX - 24, colossalY - 42, 12, 5);
      ctx.fillRect(colossalX + 12, colossalY - 42, 12, 5);

      // Massive gripping fingers on top of the wall
      ctx.fillStyle = '#4B211F';
      ctx.fillRect(colossalX - 108, wallTop - 10, 38, 16);
      ctx.fillRect(colossalX + 70, wallTop - 10, 38, 16);
      ctx.restore();
    }

    ctx.fillStyle = '#1B2230';
    ctx.fillRect(0, wallTop, w, h - wallTop);

    // Wall battlements, watchtowers & cannons
    const wallShift = ((-this.camX * 0.14) % 420 + 420) % 420;
    ctx.fillStyle = '#212938';
    for (let x = -420 + wallShift; x < w + 420; x += 420) {
      ctx.fillRect(x, wallTop - 36, 74, 40);
      ctx.fillRect(x + 18, wallTop - 52, 38, 18);

      // Fixed Wall Cannons (성벽 고정포대)
      if (district.hasCannons) {
        ctx.fillStyle = '#141923';
        ctx.fillRect(x + 140, wallTop - 12, 26, 12);
        ctx.save();
        ctx.translate(x + 158, wallTop - 10);
        ctx.rotate(-0.22);
        ctx.fillRect(0, -4, 34, 8);
        ctx.restore();
        ctx.fillStyle = '#212938';
      }
    }

    // Wall seam lines
    ctx.strokeStyle = 'rgba(255,255,255,0.03)';
    ctx.lineWidth = 2;
    for (let x = -420 + wallShift; x < w + 420; x += 140) {
      ctx.beginPath();
      ctx.moveTo(x, wallTop);
      ctx.lineTo(x, h);
      ctx.stroke();
    }
  }

  private renderDistrictLandmarks(ctx: CanvasRenderingContext2D) {
    const district = DISTRICTS[this.districtId];

    // Trost Sealing Boulder in the Plaza background
    if (district.hasBoulder) {
      const bx = WORLD_WIDTH / 2 - 220;
      const by = GROUND_Y;
      ctx.save();
      ctx.fillStyle = '#393B40';
      ctx.beginPath();
      ctx.arc(bx, by - 55, 86, Math.PI * 0.9, Math.PI * 2.1);
      ctx.lineTo(bx + 85, by);
      ctx.lineTo(bx - 85, by);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = '#222428';
      ctx.lineWidth = 4;
      ctx.stroke();
      ctx.restore();
    }

    // Wall Maria Broken Gate Arch at Left Boundary
    if (district.hasBrokenGate) {
      ctx.save();
      // Left Wall Gate Breach (파괴된 성문)
      ctx.fillStyle = '#151820';
      ctx.fillRect(28, GROUND_Y - 210, 145, 210);
      ctx.strokeStyle = '#3B4252';
      ctx.lineWidth = 5;
      ctx.strokeRect(28, GROUND_Y - 210, 145, 210);

      // Jagged breach cracks around the gate
      ctx.fillStyle = '#0B0E14';
      ctx.beginPath();
      ctx.moveTo(40, GROUND_Y);
      ctx.lineTo(52, GROUND_Y - 140);
      ctx.lineTo(95, GROUND_Y - 185);
      ctx.lineTo(148, GROUND_Y - 130);
      ctx.lineTo(162, GROUND_Y);
      ctx.closePath();
      ctx.fill();

      // Right Wall Gate
      ctx.fillStyle = '#151820';
      ctx.fillRect(WORLD_WIDTH - 172, GROUND_Y - 210, 145, 210);
      ctx.restore();
    }
  }

  private renderStreetLamps(ctx: CanvasRenderingContext2D) {
    for (const lamp of this.lamps) {
      ctx.save();
      ctx.translate(lamp.x, lamp.y);

      // Iron Pole
      ctx.fillStyle = '#1F242D';
      ctx.fillRect(-2.5, -lamp.height, 5, lamp.height);
      ctx.fillRect(-7, -6, 14, 6);

      // Lantern Head
      ctx.fillStyle = '#334155';
      ctx.fillRect(-6, -lamp.height - 12, 12, 12);

      // Warm Amber Glow (시가지 가스등)
      if (lamp.lit) {
        const glow = ctx.createRadialGradient(0, -lamp.height - 6, 2, 0, -lamp.height - 6, 48);
        glow.addColorStop(0, 'rgba(251, 191, 36, 0.7)');
        glow.addColorStop(0.35, 'rgba(245, 158, 11, 0.24)');
        glow.addColorStop(1, 'rgba(245, 158, 11, 0)');
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(0, -lamp.height - 6, 48, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#FDE68A';
        ctx.fillRect(-3.5, -lamp.height - 9, 7, 7);
      }
      ctx.restore();
    }
  }

  private renderBuildings(ctx: CanvasRenderingContext2D) {
    for (const b of this.buildings) {
      if (b.style === 'wall') {
        // Massive Outer Fortress Wall Boundaries
        ctx.fillStyle = b.colorMain;
        ctx.fillRect(b.x, b.y, b.width, b.height);
        ctx.fillStyle = '#1B1F27';
        for (let row = 0; row < 12; row++) {
          ctx.fillRect(b.x + 12, b.y + 40 + row * 62, b.width - 24, 4);
        }
        // Battlement crown
        ctx.fillStyle = b.colorRoof;
        ctx.fillRect(b.x - 10, b.y - b.roofHeight, b.width + 20, b.roofHeight);
        continue;
      }

      if (b.style === 'tree') {
        // Giant 50m Forest Tree Trunk
        ctx.fillStyle = b.colorMain;
        ctx.fillRect(b.x, b.y, b.width, b.height);
        // Bark vertical texture
        ctx.fillStyle = '#2A1E17';
        for (let bx = b.x + 14; bx < b.x + b.width - 10; bx += 22) {
          ctx.fillRect(bx, b.y + 12, 6, b.height - 24);
        }
        // Layered Canopy Crown
        ctx.fillStyle = b.colorRoof;
        ctx.beginPath();
        ctx.arc(b.x + b.width / 2, b.y, b.width * 1.15, 0, Math.PI * 2);
        ctx.arc(b.x + 8, b.y + 24, b.width * 0.72, 0, Math.PI * 2);
        ctx.arc(b.x + b.width - 8, b.y + 24, b.width * 0.72, 0, Math.PI * 2);
        ctx.fill();
        continue;
      }

      // Main building facade
      ctx.fillStyle = b.colorMain;
      ctx.fillRect(b.x, b.y, b.width, b.height);

      // Timber framing cross-beams
      ctx.strokeStyle = '#231F1D';
      ctx.lineWidth = 4;
      ctx.strokeRect(b.x + 2, b.y + 2, b.width - 4, b.height - 4);

      if (b.style === 'ruin') {
        // Jagged ruined stone roofline
        ctx.fillStyle = b.colorRoof;
        ctx.beginPath();
        ctx.moveTo(b.x, b.y + 4);
        ctx.lineTo(b.x + b.width * 0.25, b.y - 16);
        ctx.lineTo(b.x + b.width * 0.55, b.y + 8);
        ctx.lineTo(b.x + b.width * 0.8, b.y - 22);
        ctx.lineTo(b.x + b.width, b.y + 4);
        ctx.closePath();
        ctx.fill();
      } else {
        // Pitched Roof
        ctx.fillStyle = b.colorRoof;
        ctx.beginPath();
        ctx.moveTo(b.x - 12, b.y + 2);
        ctx.lineTo(b.x + b.width / 2, b.y - b.roofHeight);
        ctx.lineTo(b.x + b.width + 12, b.y + 2);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = '#1C1917';
        ctx.lineWidth = 3;
        ctx.stroke();
      }

      // Windows
      for (const win of b.windows) {
        ctx.fillStyle = win.lit ? 'rgba(251, 191, 36, 0.45)' : 'rgba(15, 23, 42, 0.7)';
        ctx.fillRect(b.x + win.rx - 7, b.y + win.ry - 10, 14, 20);
        ctx.strokeStyle = '#1E1B18';
        ctx.lineWidth = 2;
        ctx.strokeRect(b.x + win.rx - 7, b.y + win.ry - 10, 14, 20);
      }
    }
  }

  private renderGround(ctx: CanvasRenderingContext2D) {
    ctx.fillStyle = '#1E2128';
    ctx.fillRect(0, GROUND_Y, WORLD_WIDTH, 400);

    // Street curb highlight
    ctx.fillStyle = '#333945';
    ctx.fillRect(0, GROUND_Y, WORLD_WIDTH, 8);

    // Cobblestone lines
    ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
    for (let x = 200; x < WORLD_WIDTH - 200; x += 65) {
      ctx.fillRect(x, GROUND_Y + 18, 34, 5);
      ctx.fillRect(x + 28, GROUND_Y + 34, 28, 5);
    }
  }

  private renderSupplies(ctx: CanvasRenderingContext2D) {
    for (const s of this.supplies) {
      const ready = s.cooldown <= 0;
      ctx.save();
      ctx.translate(s.x, s.y);

      // Supply crate box
      ctx.fillStyle = ready ? '#14532D' : '#334155';
      ctx.fillRect(-18, -24, 36, 24);
      ctx.strokeStyle = ready ? '#34D399' : '#64748B';
      ctx.lineWidth = 2.5;
      ctx.strokeRect(-18, -24, 36, 24);

      // Cross / Wing emblem
      ctx.fillStyle = ready ? '#6EE7B7' : '#94A3B8';
      ctx.fillRect(-3, -19, 6, 14);
      ctx.fillRect(-7, -15, 14, 6);

      // Floating indicator
      ctx.font = 'bold 12px "Noto Sans KR", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = ready ? '#34D399' : '#94A3B8';
      ctx.fillText(ready ? '보급소' : `${Math.ceil(s.cooldown)}초`, 0, -34);

      ctx.restore();
    }
  }

  private renderTitans(ctx: CanvasRenderingContext2D) {
    for (const t of this.titans) {
      if (t.dead) continue;
      const anat = getTitanAnatomy(t);
      const s = t.scale;

      ctx.save();
      if (t.dyingTimer > 0) {
        ctx.globalAlpha = Math.max(0.15, t.dyingTimer / 1.6);
      }

      // Shadow on ground
      ctx.fillStyle = 'rgba(0,0,0,0.38)';
      ctx.beginPath();
      ctx.ellipse(t.x, GROUND_Y + 4, 38 * s, 10 * s, 0, 0, Math.PI * 2);
      ctx.fill();

      const stride = Math.sin(t.walkPhase) * 22 * s;
      const hipY = t.y - 76 * s;

      // Back Leg
      ctx.strokeStyle = t.skinTone;
      ctx.lineWidth = 19 * s;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(t.x - t.facing * 8 * s, hipY);
      ctx.lineTo(t.x - stride, t.y - 4 * s);
      ctx.stroke();

      // Front Leg
      ctx.beginPath();
      ctx.moveTo(t.x + t.facing * 8 * s, hipY);
      ctx.lineTo(t.x + stride, t.y - 4 * s);
      ctx.stroke();

      // Torso (Muscular V-shape)
      ctx.fillStyle = t.skinTone;
      ctx.beginPath();
      ctx.moveTo(t.x - 28 * s, anat.shoulderY);
      ctx.lineTo(t.x + 28 * s, anat.shoulderY);
      ctx.lineTo(t.x + 19 * s, hipY);
      ctx.lineTo(t.x - 19 * s, hipY);
      ctx.closePath();
      ctx.fill();

      // Armored Titan Plating
      if (t.kind === 'armored' && t.armorTone) {
        ctx.fillStyle = t.armorTone;
        ctx.beginPath();
        ctx.moveTo(t.x + t.facing * 26 * s, anat.shoulderY + 2 * s);
        ctx.lineTo(t.x - t.facing * 4 * s, anat.shoulderY + 8 * s);
        ctx.lineTo(t.x - t.facing * 2 * s, hipY - 8 * s);
        ctx.lineTo(t.x + t.facing * 20 * s, hipY - 12 * s);
        ctx.closePath();
        ctx.fill();
      }

      // Nape Weak Point Visual Highlight (Behind Neck)
      const distPlayerToNape = Math.hypot(this.player.x - anat.napeX, this.player.y - anat.napeY);
      const highlightAlpha = distPlayerToNape < 260 ? 0.85 : 0.42;
      ctx.strokeStyle = `rgba(244, 63, 94, ${highlightAlpha})`;
      ctx.lineWidth = 3 * s;
      ctx.beginPath();
      ctx.arc(anat.napeX, anat.napeY, 13 * s, 0, Math.PI * 2);
      ctx.stroke();

      ctx.fillStyle = `rgba(225, 29, 72, ${highlightAlpha * 0.45})`;
      ctx.beginPath();
      ctx.arc(anat.napeX, anat.napeY, 7 * s, 0, Math.PI * 2);
      ctx.fill();

      // Head
      ctx.fillStyle = t.skinTone;
      ctx.beginPath();
      ctx.arc(anat.headX, anat.headY, anat.headRadius, 0, Math.PI * 2);
      ctx.fill();

      // Wild Hair on top & back of head (leaves nape visible below)
      ctx.fillStyle = t.hairColor;
      ctx.beginPath();
      ctx.arc(anat.headX - t.facing * 3 * s, anat.headY - 5 * s, anat.headRadius * 0.92, Math.PI * 0.9, Math.PI * 2.1);
      ctx.fill();

      // Eerie Eyes & Grinning Jaw
      if (t.blindTimer > 0) {
        // Slashed eyes
        ctx.strokeStyle = '#DC2626';
        ctx.lineWidth = 3 * s;
        ctx.beginPath();
        ctx.moveTo(anat.eyeX - 6 * s, anat.eyeY - 4 * s);
        ctx.lineTo(anat.eyeX + 6 * s, anat.eyeY + 4 * s);
        ctx.stroke();
      } else {
        ctx.fillStyle = '#FFFFFF';
        ctx.beginPath();
        ctx.arc(anat.eyeX, anat.eyeY, 4.5 * s, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#111827';
        ctx.beginPath();
        ctx.arc(anat.eyeX + t.facing * 1.5 * s, anat.eyeY, 2.2 * s, 0, Math.PI * 2);
        ctx.fill();
      }

      // Teeth / Mouth
      ctx.fillStyle = '#450A0A';
      ctx.fillRect(
        anat.headX + (t.facing === 1 ? 4 * s : -17 * s),
        anat.headY + 6 * s,
        13 * s,
        6 * s
      );
      ctx.fillStyle = '#F8FAFC';
      ctx.fillRect(
        anat.headX + (t.facing === 1 ? 5 * s : -16 * s),
        anat.headY + 7 * s,
        11 * s,
        2 * s
      );

      // Reaching Front Arm
      ctx.strokeStyle = t.skinTone;
      ctx.lineWidth = 15 * s;
      ctx.beginPath();
      ctx.moveTo(t.x + t.facing * 12 * s, anat.shoulderY + 10 * s);
      ctx.lineTo(anat.handX, anat.handY);
      ctx.stroke();

      // Grabbing Fist / Hand
      ctx.fillStyle = t.skinTone;
      ctx.beginPath();
      ctx.arc(anat.handX, anat.handY, 11 * s, 0, Math.PI * 2);
      ctx.fill();

      // HP Bar & Label above Titan when damaged or Armored/Abnormal
      if (t.hp < t.maxHp || t.kind !== 'normal') {
        const barW = 54 * s;
        const barY = anat.headY - 36 * s;
        ctx.fillStyle = 'rgba(15, 23, 42, 0.75)';
        ctx.fillRect(t.x - barW / 2, barY, barW, 6);
        ctx.fillStyle = t.kind === 'armored' ? '#F59E0B' : '#EF4444';
        ctx.fillRect(t.x - barW / 2, barY, barW * Math.max(0, t.hp / t.maxHp), 6);

        if (t.kind !== 'normal') {
          ctx.font = 'bold 12px "Noto Sans KR", sans-serif';
          ctx.textAlign = 'center';
          ctx.fillStyle = t.kind === 'armored' ? '#FCD34D' : '#FB923C';
          ctx.fillText(t.kind === 'armored' ? '갑옷 거인' : '기행종', t.x, barY - 6);
        }
      }

      // Blinded Indicator
      if (t.blindTimer > 0) {
        ctx.font = 'bold 13px "Noto Sans KR", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillStyle = '#38BDF8';
        ctx.fillText('실명 상태!', t.x, anat.headY - 48 * s);
      }

      ctx.restore();
    }
  }

  private renderGrappleAndAim(ctx: CanvasRenderingContext2D) {
    const p = this.player;

    // Active steel grappling wires (dual wires from hip ODM pods)
    if (p.hook.active) {
      ctx.strokeStyle = '#E2E8F0';
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.moveTo(p.x - 4, p.y - 11);
      ctx.lineTo(p.hook.anchorX, p.hook.anchorY);
      ctx.moveTo(p.x + 4, p.y - 11);
      ctx.lineTo(p.hook.anchorX, p.hook.anchorY);
      ctx.stroke();

      // Anchor point glow
      ctx.fillStyle = '#FDE047';
      ctx.beginPath();
      ctx.arc(p.hook.anchorX, p.hook.anchorY, 5, 0, Math.PI * 2);
      ctx.fill();
    }

    // Smart Grapple Target Preview
    if (this.aimTarget && !p.hook.active && p.grabbedByTitanId === null) {
      ctx.save();
      ctx.strokeStyle = 'rgba(52, 211, 153, 0.55)';
      ctx.setLineDash([6, 6]);
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(p.x, p.y - 12);
      ctx.lineTo(this.aimTarget.x, this.aimTarget.y);
      ctx.stroke();

      ctx.setLineDash([]);
      ctx.strokeStyle = '#34D399';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(this.aimTarget.x, this.aimTarget.y, 8, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    // Cursor Reticle in world space
    ctx.save();
    ctx.translate(this.mouseWorldX, this.mouseWorldY);
    ctx.strokeStyle = this.aimTarget ? '#34D399' : '#94A3B8';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, 11, 0, Math.PI * 2);
    ctx.moveTo(-16, 0);
    ctx.lineTo(-7, 0);
    ctx.moveTo(7, 0);
    ctx.lineTo(16, 0);
    ctx.moveTo(0, -16);
    ctx.lineTo(0, -7);
    ctx.moveTo(0, 7);
    ctx.lineTo(0, 16);
    ctx.stroke();
    ctx.restore();
  }

  private renderPlayer(ctx: CanvasRenderingContext2D) {
    const p = this.player;
    ctx.save();

    // Flowing Survey Corps Green Cloak
    ctx.strokeStyle = '#15803D';
    ctx.lineWidth = 9;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(p.cape[0].x, p.cape[0].y);
    for (let i = 1; i < p.cape.length; i++) {
      ctx.lineTo(p.cape[i].x, p.cape[i].y);
    }
    ctx.stroke();

    ctx.translate(p.x, p.y - 14);

    if (p.spinTimer > 0) {
      ctx.rotate(p.animTime * 42);
    } else if (!p.grounded) {
      ctx.rotate(Math.max(-0.55, Math.min(0.55, p.vx * 0.0006)));
    }

    // Legs
    const legSwing = p.grounded ? Math.sin(p.animTime * 14) * (Math.abs(p.vx) > 25 ? 7 : 0) : 5;
    ctx.strokeStyle = '#E2E8F0';
    ctx.lineWidth = 4.5;
    ctx.beginPath();
    ctx.moveTo(-2, 4);
    ctx.lineTo(-4 - legSwing, 14);
    ctx.moveTo(2, 4);
    ctx.lineTo(4 + legSwing, 14);
    ctx.stroke();

    // Survey Corps Jacket
    ctx.fillStyle = '#785A40';
    ctx.fillRect(-5, -8, 10, 13);

    // ODM Hip Scabbards
    ctx.fillStyle = '#64748B';
    ctx.fillRect(-8, 0, 16, 4);

    // Head
    ctx.fillStyle = '#F5D0C5';
    ctx.beginPath();
    ctx.arc(0, -12, 5.5, 0, Math.PI * 2);
    ctx.fill();

    // Hair
    ctx.fillStyle = '#1E1B18';
    ctx.beginPath();
    ctx.arc(0, -13.5, 5.8, Math.PI * 0.9, Math.PI * 2.1);
    ctx.fill();

    // Dual Ultra-Hard Steel Blades
    if (p.bladeDurability > 0 && p.reloadTimer <= 0) {
      ctx.strokeStyle = '#F8FAFC';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(p.facing * 4, -2);
      ctx.lineTo(p.facing * 20, -9);
      ctx.moveTo(-p.facing * 3, 0);
      ctx.lineTo(-p.facing * 16, 6);
      ctx.stroke();
    }

    ctx.restore();

    // Grabbed Escape Prompt above scout
    if (p.grabbedByTitanId !== null) {
      ctx.save();
      ctx.translate(p.x, p.y - 54);
      ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
      ctx.fillRect(-66, -24, 132, 28);
      ctx.strokeStyle = '#EF4444';
      ctx.lineWidth = 2;
      ctx.strokeRect(-66, -24, 132, 28);

      ctx.fillStyle = '#34D399';
      ctx.fillRect(-62, -2, (124 * p.escapeProgress) / 100, 4);

      ctx.font = 'bold 12px "Noto Sans KR", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#F8FAFC';
      ctx.fillText('연타 탈출! [Space / F]', 0, -6);
      ctx.restore();
    }
  }

  private renderSlashArcs(ctx: CanvasRenderingContext2D) {
    for (const sa of this.slashArcs) {
      const alpha = sa.life / sa.maxLife;
      ctx.save();
      ctx.translate(sa.x, sa.y);
      ctx.strokeStyle = sa.isCrit
        ? `rgba(244, 63, 94, ${alpha})`
        : `rgba(248, 250, 252, ${alpha})`;
      ctx.lineWidth = sa.isCrit ? 8 : 5;
      ctx.lineCap = 'round';
      ctx.beginPath();
      if (sa.isSpin) {
        ctx.arc(0, 0, sa.radius, sa.angle - Math.PI * 0.9, sa.angle + Math.PI * 0.9);
      } else {
        ctx.arc(0, 0, sa.radius, sa.angle - 1.05, sa.angle + 1.05);
      }
      ctx.stroke();

      // Inner bright core
      ctx.strokeStyle = `rgba(255, 255, 255, ${alpha * 0.9})`;
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.restore();
    }
  }

  private renderParticles(ctx: CanvasRenderingContext2D) {
    for (const pt of this.particles) {
      ctx.save();
      ctx.globalAlpha = pt.alpha;
      ctx.fillStyle = pt.color;
      if (pt.kind === 'shard') {
        ctx.translate(pt.x, pt.y);
        ctx.rotate(pt.rotation || 0);
        ctx.fillRect(-pt.size / 2, -1.5, pt.size, 3);
      } else {
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, pt.size, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
  }

  private renderFloatingTexts(ctx: CanvasRenderingContext2D) {
    for (const ft of this.floatingTexts) {
      const alpha = Math.min(1, (ft.life / ft.maxLife) * 1.4);
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.translate(ft.x, ft.y);
      ctx.scale(ft.scale, ft.scale);
      ctx.textAlign = 'center';

      ctx.font = 'bold 18px "Noto Sans KR", sans-serif';
      ctx.fillStyle = '#090D16';
      ctx.fillText(ft.text, 1.5, 1.5);
      ctx.fillStyle = ft.color;
      ctx.fillText(ft.text, 0, 0);

      if (ft.subtext) {
        ctx.font = '600 12px "Noto Sans KR", sans-serif';
        ctx.fillStyle = '#E2E8F0';
        ctx.fillText(ft.subtext, 0, 17);
      }
      ctx.restore();
    }
  }

  private renderScreenOverlays(ctx: CanvasRenderingContext2D, w: number, h: number) {
    // 1. High-speed anime wind speedlines
    const speedKmh = Math.hypot(this.player.vx, this.player.vy) * PX_TO_KMH;
    if (speedKmh > 92) {
      const intensity = Math.min(0.45, (speedKmh - 92) / 140);
      ctx.save();
      ctx.strokeStyle = `rgba(226, 232, 240, ${intensity})`;
      ctx.lineWidth = 1.5;
      const cx = w / 2;
      const cy = h / 2;
      const count = 24;
      for (let i = 0; i < count; i++) {
        const ang = (i / count) * Math.PI * 2 + (this.player.animTime * 0.7 % 0.3);
        const rInner = Math.min(w, h) * 0.42;
        const rOuter = Math.max(w, h) * 0.75;
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(ang) * rInner, cy + Math.sin(ang) * rInner);
        ctx.lineTo(cx + Math.cos(ang) * rOuter, cy + Math.sin(ang) * rOuter);
        ctx.stroke();
      }
      ctx.restore();
    }

    // 2. Low-HP vignette
    if (this.player.hp < 35) {
      const pulse = 0.22 + Math.sin(this.player.animTime * 7) * 0.1;
      const vig = ctx.createRadialGradient(w / 2, h / 2, h * 0.3, w / 2, h / 2, w * 0.7);
      vig.addColorStop(0, 'rgba(0,0,0,0)');
      vig.addColorStop(1, `rgba(185, 28, 28, ${pulse})`);
      ctx.fillStyle = vig;
      ctx.fillRect(0, 0, w, h);
    }

    // 3. Offscreen Titan Directional Pointers
    for (const t of this.titans) {
      if (t.dead || t.dyingTimer > 0) continue;
      const anat = getTitanAnatomy(t);
      const sx = (t.x - this.camX) * this.camZoom + w / 2;
      const sy = (anat.headY - this.camY) * this.camZoom + h / 2;

      if (sx < 24 || sx > w - 24 || sy < 24 || sy > h - 24) {
        const clampedX = Math.max(28, Math.min(w - 28, sx));
        const clampedY = Math.max(76, Math.min(h - 76, sy));
        const ang = Math.atan2(sy - h / 2, sx - w / 2);

        ctx.save();
        ctx.translate(clampedX, clampedY);
        ctx.rotate(ang);
        ctx.fillStyle = t.kind === 'armored' ? '#F59E0B' : '#EF4444';
        ctx.beginPath();
        ctx.moveTo(12, 0);
        ctx.lineTo(-8, -7);
        ctx.lineTo(-5, 0);
        ctx.lineTo(-8, 7);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }
    }
  }
}
