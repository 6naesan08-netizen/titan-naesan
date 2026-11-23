import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { soundEngine } from '../game/audio';
import { Difficulty, DistrictId, HudSnapshot, TitanKind } from '../game/types';
import { DISTRICTS, getDifficultyMultipliers, getDistrictWaveRoster, TITAN_LABELS } from '../game/world';
import { createFirstPersonRig, FirstPersonRig } from './firstPersonRig';
import {
  BuildingCollider,
  createBuilding3D,
  createCanalAndBridges,
  createCannon3D,
  createColossalTitanBackdrop,
  createCrystalAltar,
  createCrystalCeilingArch,
  createCrystalPillar,
  createLiberioAmphitheater,
  createRumblingHorizonTitans,
  createRumblingRibArch,
  createStreetLamp3D,
  createSupplyDepot3D,
  createSupplyWagon3D,
  createSurveyBanner3D,
  createTitan3D,
  createUtgardCastleKeep,
  createUtgardMoon,
  Titan3DInstance,
} from './models';
import { createProceduralTextures, ProceduralTextureSet } from './textures';

const ARENA_HALF = 135;
const WALL_HEIGHT = 50;
const GRAVITY = 28; // m/s^2
const MAX_HOOK_DIST = 125;
const SPEED_TO_KMH = 3.6;

interface HookState {
  active: boolean;
  anchor: THREE.Vector3;
  attachedTitanId: number | null;
  localOffset: THREE.Vector3;
  wireLength: number;
  wireMesh: THREE.Mesh;
  anchorDart: THREE.Mesh;
}

interface LightningFx {
  group: THREE.Group;
  ring: THREE.Mesh;
  boltMat: THREE.MeshBasicMaterial;
  ringMat: THREE.MeshBasicMaterial;
  life: number;
  maxLife: number;
}

interface Particle3D {
  mesh: THREE.Mesh;
  vx: number;
  vy: number;
  vz: number;
  life: number;
  maxLife: number;
  grow: number;
  gravity: boolean;
}

interface HazardProjectile {
  mesh: THREE.Mesh;
  vx: number;
  vy: number;
  vz: number;
  life: number;
  radius: number;
  damage: number;
  gravity: boolean;
  label: string;
}

interface SupplyPoint {
  x: number;
  y: number;
  z: number;
  cooldown: number;
  mesh: THREE.Group;
}

interface ScoutAvatar {
  root: THREE.Group;
  cape: THREE.Mesh;
  leftLeg: THREE.Mesh;
  rightLeg: THREE.Mesh;
  leftArm: THREE.Group;
  rightArm: THREE.Group;
}

// Pre-allocated scratch math objects (zero-GC inside loop)
const _v1 = new THREE.Vector3();
const _v2 = new THREE.Vector3();
const _v3 = new THREE.Vector3();
const _forward = new THREE.Vector3();
const _right = new THREE.Vector3();
const _rayDir = new THREE.Vector3();
const _upAxis = new THREE.Vector3(0, 1, 0);
const _quat = new THREE.Quaternion();
const _euler = new THREE.Euler(0, 0, 0, 'YXZ');

const SKY_VERT = /* glsl */ `
  varying vec3 vWorldDir;
  void main() {
    vWorldDir = normalize(position);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const SKY_FRAG = /* glsl */ `
  uniform vec3 uTopColor;
  uniform vec3 uMidColor;
  uniform vec3 uHorizonColor;
  uniform vec3 uSunColor;
  uniform vec3 uSunDir;
  uniform float uTime;
  varying vec3 vWorldDir;

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
  }

  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    float a = hash(i);
    float b = hash(i + vec2(1.0, 0.0));
    float c = hash(i + vec2(0.0, 1.0));
    float d = hash(i + vec2(1.0, 1.0));
    return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
  }

  float fbm(vec2 p) {
    float v = 0.0;
    float a = 0.5;
    for (int i = 0; i < 4; i++) {
      v += a * noise(p);
      p *= 2.03;
      a *= 0.5;
    }
    return v;
  }

  void main() {
    vec3 dir = normalize(vWorldDir);
    float h = clamp(dir.y, 0.0, 1.0);

    vec3 col = mix(uHorizonColor, uMidColor, smoothstep(0.0, 0.28, h));
    col = mix(col, uTopColor, smoothstep(0.24, 0.85, h));

    float sunDot = max(dot(dir, normalize(uSunDir)), 0.0);
    float sunDisc = smoothstep(0.9965, 0.9992, sunDot);
    float sunHalo = pow(sunDot, 14.0) * 0.55 + pow(sunDot, 4.0) * 0.18;
    col += uSunColor * (sunHalo + sunDisc * 2.2);

    if (dir.y > 0.02) {
      vec2 cloudUv = dir.xz / (dir.y + 0.18) * 1.45 + vec2(uTime * 0.008, uTime * 0.004);
      float c = fbm(cloudUv);
      float cloudMask = smoothstep(0.46, 0.78, c) * smoothstep(0.02, 0.22, dir.y);
      vec3 cloudCol = mix(uMidColor * 1.15, uSunColor * 0.92, pow(sunDot, 3.0) * 0.75 + 0.25);
      col = mix(col, cloudCol, cloudMask * 0.55);
    }

    gl_FragColor = vec4(col, 1.0);
  }
`;

function detectSoftwareGl(): boolean {
  try {
    const gl = document.createElement('canvas').getContext('webgl2');
    if (!gl) return true;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
    const gpu = String(gl.getParameter(param));
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
  } catch {
    return true;
  }
}

export class Aot3DEngine {
  private container: HTMLElement;
  private onHudUpdate: (
    hud: HudSnapshot & {
      hookReady: boolean;
      hookDist: number;
      pointerLocked: boolean;
      thirdPerson: boolean;
      combatBanner: string;
      targetTitanName?: string;
      targetTitanHpPct?: number;
    }
  ) => void;
  private onGameOver: (hud: HudSnapshot) => void;

  private isSoftwareGl: boolean;
  private renderer!: THREE.WebGLRenderer;
  private composer: EffectComposer | null = null;
  private bloomPass: UnrealBloomPass | null = null;
  private scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;
  private skyMat!: THREE.ShaderMaterial;
  private textures!: ProceduralTextureSet;
  private worldGroup!: THREE.Group;
  private fpRig!: FirstPersonRig;
  private scoutAvatar!: ScoutAvatar;
  private ambientPoints: THREE.Points | null = null;
  private ambientBaseY: Float32Array | null = null;

  private frameId: number = 0;
  private clock = new THREE.Clock();
  private elapsed: number = 0;
  private running: boolean = false;
  private paused: boolean = false;
  private contextLost: boolean = false;

  private difficulty: Difficulty = 'scout';
  private districtId: DistrictId = 'shiganshina';

  private colliders: BuildingCollider[] = [];
  private supplies: SupplyPoint[] = [];
  private titans: Titan3DInstance[] = [];
  private particles: Particle3D[] = [];
  private hazards: HazardProjectile[] = [];
  private lightnings: LightningFx[] = [];
  private nextTitanId = 1;

  // Player 3D Kinematics
  private pos = new THREE.Vector3(0, 14, 24);
  private vel = new THREE.Vector3();
  private yaw: number = 0;
  private pitch: number = -0.05;
  private roll: number = 0;
  private grounded: boolean = false;
  private thirdPerson: boolean = false;
  private stridePhase: number = 0;

  // Player Resources & Combat
  private hp: number = 100;
  private maxHp: number = 100;
  private gas: number = 100;
  private maxGas: number = 100;
  private bladeDurability: number = 100;
  private maxBladeDurability: number = 100;
  private spareBlades: number = 6;
  private maxSpareBlades: number = 6;

  private slashTimer: number = 0;
  private slashCooldown: number = 0;
  private isSpinSlash: boolean = false;
  private reloadTimer: number = 0;
  private invulnTimer: number = 0;
  private grabbedByTitanId: number | null = null;
  private escapeProgress: number = 0;

  private leftHook!: HookState;
  private rightHook!: HookState;

  // Wave & Score
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

  // Juice & Feedback
  private hitStopTimer: number = 0;
  private slowMoTimer: number = 0;
  private shakeTimer: number = 0;
  private shakeMag: number = 0;
  private combatBanner: string = '';
  private combatBannerTimer: number = 0;
  private colossalSteamAcc: number = 0;
  private flareTimer: number = 0;

  // Aim Telemetry & Touch State
  private hookReady: boolean = false;
  private hookDist: number = 0;
  private targetTitanName: string | undefined = undefined;
  private targetTitanHpPct: number | undefined = undefined;
  private pointerLocked: boolean = false;
  private keys = new Set<string>();
  private draggingLook: boolean = false;
  private lookTouchId: number | null = null;
  private lastTouchX: number = 0;
  private lastTouchY: number = 0;
  private virtualMoveX: number = 0;
  private virtualMoveY: number = 0;
  private virtualBoost: boolean = false;
  private touchMode: boolean = false;
  private hudAccumulator: number = 0;

  // Shared particle & projectile geometries/materials
  private steamGeo = new THREE.SphereGeometry(0.48, 7, 6);
  private bloodGeo = new THREE.SphereGeometry(0.24, 6, 5);
  private boulderGeo = new THREE.DodecahedronGeometry(1.15, 0);
  private spikeGeo = new THREE.ConeGeometry(1.1, 14, 5);
  private bulletGeo = new THREE.SphereGeometry(0.32, 6, 5);
  private steamMat = new THREE.MeshBasicMaterial({ color: 0xe2e8f0, transparent: true, opacity: 0.56 });
  private bloodMat = new THREE.MeshBasicMaterial({ color: 0xdc2626, transparent: true, opacity: 0.92 });
  private sparkMat = new THREE.MeshBasicMaterial({ color: 0xfde047, transparent: true, opacity: 1.0 });
  private flareMat = new THREE.MeshBasicMaterial({ color: 0x34d399, transparent: true, opacity: 0.78 });
  private boulderMat = new THREE.MeshStandardMaterial({ color: 0x57534e, roughness: 0.92 });
  private spikeMat = new THREE.MeshPhysicalMaterial({ color: 0xf1f5f9, emissive: 0x38bdf8, emissiveIntensity: 0.65, roughness: 0.25 });
  private bulletMat = new THREE.MeshBasicMaterial({ color: 0xfbbf24 });

  constructor(
    container: HTMLElement,
    onHudUpdate: (
      hud: HudSnapshot & {
        hookReady: boolean;
        hookDist: number;
        pointerLocked: boolean;
        thirdPerson: boolean;
        combatBanner: string;
        targetTitanName?: string;
        targetTitanHpPct?: number;
      }
    ) => void,
    onGameOver: (hud: HudSnapshot) => void
  ) {
    this.container = container;
    this.onHudUpdate = onHudUpdate;
    this.onGameOver = onGameOver;
    this.isSoftwareGl = detectSoftwareGl();

    this.initThree();
    this.bindEvents();
  }

  private initThree() {
    this.scene = new THREE.Scene();

    const width = Math.max(1, this.container.clientWidth);
    const height = Math.max(1, this.container.clientHeight);

    this.camera = new THREE.PerspectiveCamera(78, width / height, 0.15, 720);

    this.renderer = new THREE.WebGLRenderer({
      antialias: !this.isSoftwareGl,
      powerPreference: 'high-performance',
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.1;
    this.renderer.setPixelRatio(this.isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(width, height);
    this.renderer.shadowMap.enabled = !this.isSoftwareGl;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.renderer.domElement.style.display = 'block';
    this.renderer.domElement.style.width = '100%';
    this.renderer.domElement.style.height = '100%';
    this.renderer.domElement.style.touchAction = 'none';
    this.container.appendChild(this.renderer.domElement);

    // GPU Post-Processing Pipeline: Render -> UnrealBloom -> Tone-Mapped Output
    if (!this.isSoftwareGl) {
      this.composer = new EffectComposer(this.renderer);
      this.composer.addPass(new RenderPass(this.scene, this.camera));
      this.bloomPass = new UnrealBloomPass(new THREE.Vector2(width, height), 0.42, 0.55, 0.85);
      this.composer.addPass(this.bloomPass);
      this.composer.addPass(new OutputPass());
    }

    // Studio Reflection Environment (PMREM + RoomEnvironment)
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    pmrem.dispose();

    // Procedural Textures
    this.textures = createProceduralTextures(this.renderer.capabilities.getMaxAnisotropy());

    // Procedural Anime Sky Dome
    this.skyMat = new THREE.ShaderMaterial({
      vertexShader: SKY_VERT,
      fragmentShader: SKY_FRAG,
      side: THREE.BackSide,
      depthWrite: false,
      uniforms: {
        uTopColor: { value: new THREE.Color('#0B111E') },
        uMidColor: { value: new THREE.Color('#1D2636') },
        uHorizonColor: { value: new THREE.Color('#684135') },
        uSunColor: { value: new THREE.Color('#FFBA7A') },
        uSunDir: { value: new THREE.Vector3(0.45, 0.25, -0.85).normalize() },
        uTime: { value: 0 },
      },
    });
    const skyDome = new THREE.Mesh(new THREE.SphereGeometry(460, 32, 20), this.skyMat);
    skyDome.frustumCulled = false;
    this.scene.add(skyDome);

    // World Container
    this.worldGroup = new THREE.Group();
    this.scene.add(this.worldGroup);

    // First-Person Viewmodel Rig attached to Camera
    this.fpRig = createFirstPersonRig(this.textures);
    this.camera.add(this.fpRig.root);
    this.scene.add(this.camera);

    // 3rd-Person Survey Corps Scout Mesh (shown when toggling V key)
    this.scoutAvatar = this.createScoutAvatar();
    this.scoutAvatar.root.visible = false;
    this.scene.add(this.scoutAvatar.root);

    // Grapple Hook Metallic Cables & Anchor Darts
    this.leftHook = this.createHookState();
    this.rightHook = this.createHookState();
    this.scene.add(this.leftHook.wireMesh);
    this.scene.add(this.leftHook.anchorDart);
    this.scene.add(this.rightHook.wireMesh);
    this.scene.add(this.rightHook.anchorDart);
  }

  private createHookState(): HookState {
    const geom = new THREE.CylinderGeometry(0.032, 0.032, 1, 6);
    const mat = new THREE.MeshStandardMaterial({
      color: 0xe2e8f0,
      metalness: 0.92,
      roughness: 0.2,
      emissive: 0x38bdf8,
      emissiveIntensity: 0.25,
    });
    const wireMesh = new THREE.Mesh(geom, mat);
    wireMesh.frustumCulled = false;
    wireMesh.visible = false;

    const dartGeom = new THREE.ConeGeometry(0.16, 0.55, 4);
    const dartMat = new THREE.MeshStandardMaterial({
      color: 0xf8fafc,
      metalness: 0.95,
      roughness: 0.15,
      emissive: 0x34d399,
      emissiveIntensity: 0.8,
    });
    const anchorDart = new THREE.Mesh(dartGeom, dartMat);
    anchorDart.frustumCulled = false;
    anchorDart.visible = false;

    return {
      active: false,
      anchor: new THREE.Vector3(),
      attachedTitanId: null,
      localOffset: new THREE.Vector3(),
      wireLength: 0,
      wireMesh,
      anchorDart,
    };
  }

  private createScoutAvatar(): ScoutAvatar {
    const root = new THREE.Group();
    const cloakMat = new THREE.MeshStandardMaterial({
      color: 0x165e39,
      roughness: 0.85,
      side: THREE.DoubleSide,
    });
    const crestMat = new THREE.MeshStandardMaterial({
      map: this.textures.wingsEmblem,
      roughness: 0.72,
    });
    const jacketMat = new THREE.MeshStandardMaterial({ color: 0x6f5038, roughness: 0.82 });
    const pantsMat = new THREE.MeshStandardMaterial({ color: 0xe2dfd7, roughness: 0.85 });
    const leatherMat = new THREE.MeshStandardMaterial({ color: 0x2d1e15, roughness: 0.76 });
    const gearMat = new THREE.MeshStandardMaterial({ color: 0x475569, metalness: 0.86, roughness: 0.28 });
    const steelMat = new THREE.MeshPhysicalMaterial({
      map: this.textures.brushedSteel,
      color: 0xf8fafc,
      metalness: 0.95,
      roughness: 0.15,
      clearcoat: 0.7,
    });
    const headMat = new THREE.MeshStandardMaterial({ color: 0xf4cfc3, roughness: 0.7 });
    const hairMat = new THREE.MeshStandardMaterial({ color: 0x1e1917, roughness: 0.85 });

    const leftLeg = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.09, 0.74, 8), pantsMat);
    leftLeg.position.set(-0.16, 0.37, 0);
    root.add(leftLeg);

    const rightLeg = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.09, 0.74, 8), pantsMat);
    rightLeg.position.set(0.16, 0.37, 0);
    root.add(rightLeg);

    // Tall Leather Boots
    for (const leg of [leftLeg, rightLeg]) {
      const boot = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.11, 0.38, 8), leatherMat);
      boot.position.y = -0.2;
      leg.add(boot);
    }

    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.82, 0.34), jacketMat);
    torso.position.y = 1.12;
    root.add(torso);

    // ODM Leather Chest Straps
    for (const sx of [-0.17, 0.17]) {
      const strap = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.84, 0.36), leatherMat);
      strap.position.set(sx, 1.12, 0);
      root.add(strap);
    }

    // Hip ODM Scabbards + Twin Gas Cylinders
    for (const sx of [-0.39, 0.39]) {
      const box = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.24, 0.86), gearMat);
      box.position.set(sx, 0.86, 0.08);
      box.rotation.x = 0.22;
      root.add(box);

      const canister = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.65, 8), steelMat);
      canister.rotation.x = Math.PI / 2 + 0.22;
      canister.position.set(sx * 1.12, 0.95, 0.12);
      root.add(canister);
    }

    // Sculpted Arms + Dual Ultra-Hard Steel Blades
    const makeScoutArm = (side: -1 | 1) => {
      const arm = new THREE.Group();
      arm.position.set(side * 0.38, 1.42, 0);
      const sleeve = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.07, 0.62, 8), jacketMat);
      sleeve.rotation.x = Math.PI / 3;
      sleeve.position.set(0, -0.18, -0.2);
      arm.add(sleeve);

      const blade = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.065, 0.92), steelMat);
      blade.position.set(0, -0.3, -0.78);
      arm.add(blade);
      root.add(arm);
      return arm;
    };
    const leftArm = makeScoutArm(-1);
    const rightArm = makeScoutArm(1);

    // Green Survey Corps Cloak + Wings of Freedom Back Crest
    const cape = new THREE.Mesh(new THREE.BoxGeometry(0.88, 1.02, 0.07), cloakMat);
    cape.position.set(0, 1.08, 0.22);
    cape.rotation.x = 0.22;

    const crest = new THREE.Mesh(new THREE.PlaneGeometry(0.58, 0.64), crestMat);
    crest.position.set(0, 0.02, 0.042);
    cape.add(crest);
    root.add(cape);

    const head = new THREE.Mesh(new THREE.SphereGeometry(0.23, 12, 10), headMat);
    head.position.y = 1.72;
    root.add(head);

    const hair = new THREE.Mesh(
      new THREE.SphereGeometry(0.245, 10, 8, 0, Math.PI * 2, 0, Math.PI * 0.58),
      hairMat
    );
    hair.position.set(0, 1.75, -0.02);
    root.add(hair);

    return { root, cape, leftLeg, rightLeg, leftArm, rightArm };
  }

  private handleResize = () => {
    if (!this.renderer || !this.camera) return;
    const w = Math.max(1, this.container.clientWidth);
    const h = Math.max(1, this.container.clientHeight);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
    if (this.composer) {
      this.composer.setSize(w, h);
    }
    if (this.bloomPass) {
      this.bloomPass.resolution.set(w, h);
    }
  };

  private handlePointerLockChange = () => {
    this.pointerLocked = document.pointerLockElement === this.renderer.domElement;
    this.emitHud();
  };

  private handleMouseMove = (e: MouseEvent) => {
    if (!this.running || this.paused) return;
    if (this.pointerLocked || this.draggingLook) {
      this.yaw -= e.movementX * 0.0022;
      this.pitch = THREE.MathUtils.clamp(this.pitch - e.movementY * 0.0022, -1.46, 1.46);
    }
  };

  private handleMouseDown = (e: MouseEvent) => {
    if (!this.running || this.paused) return;

    if (this.touchMode) {
      if (e.button === 0) {
        this.draggingLook = true;
      }
      return;
    }

    if (!this.pointerLocked && this.renderer.domElement.requestPointerLock) {
      try {
        this.renderer.domElement.requestPointerLock();
      } catch {
        // fallback drag look if pointer lock blocked
      }
    }

    if (e.button === 0) {
      if (this.grabbedByTitanId !== null) {
        this.advanceGrabEscape();
        return;
      }
      this.draggingLook = true;
      this.attachHook(this.leftHook, -1);
      this.attachHook(this.rightHook, 1);
    } else if (e.button === 2) {
      e.preventDefault();
      this.triggerSlashOrEscape();
    }
  };

  private handleMouseUp = (e: MouseEvent) => {
    if (e.button === 0) {
      this.draggingLook = false;
      if (!this.touchMode) {
        this.releaseHook(this.leftHook);
        this.releaseHook(this.rightHook);
      }
    }
  };

  private handleContextMenu = (e: MouseEvent) => {
    e.preventDefault();
  };

  private handleKeyDown = (e: KeyboardEvent) => {
    if (!this.running || this.paused) return;
    const code = e.code;

    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(code)) {
      e.preventDefault();
    }

    if (!this.keys.has(code)) {
      if (code === 'KeyQ') {
        this.attachHook(this.leftHook, -1);
      } else if (code === 'KeyE') {
        this.attachHook(this.rightHook, 1);
      } else if (code === 'KeyF' || code === 'KeyJ') {
        this.triggerSlashOrEscape();
      } else if (code === 'KeyR') {
        this.triggerReload();
      } else if (code === 'KeyV') {
        this.thirdPerson = !this.thirdPerson;
        this.emitHud();
      } else if (code === 'Space') {
        if (this.grabbedByTitanId !== null) {
          this.advanceGrabEscape();
        } else if (this.grounded) {
          this.vel.y = 14.5;
          this.grounded = false;
        }
      }
    }
    this.keys.add(code);
  };

  private handleKeyUp = (e: KeyboardEvent) => {
    this.keys.delete(e.code);
    if (e.code === 'KeyQ') this.releaseHook(this.leftHook);
    if (e.code === 'KeyE') this.releaseHook(this.rightHook);
  };

  private handleTouchStart = (e: TouchEvent) => {
    if (!this.running || this.paused) return;
    if (this.lookTouchId === null && e.changedTouches.length > 0) {
      const t = e.changedTouches[0];
      this.lookTouchId = t.identifier;
      this.lastTouchX = t.clientX;
      this.lastTouchY = t.clientY;
    }
  };

  private handleTouchMove = (e: TouchEvent) => {
    if (!this.running || this.paused || this.lookTouchId === null) return;
    for (let i = 0; i < e.changedTouches.length; i++) {
      const t = e.changedTouches[i];
      if (t.identifier === this.lookTouchId) {
        e.preventDefault();
        const dx = t.clientX - this.lastTouchX;
        const dy = t.clientY - this.lastTouchY;
        this.lastTouchX = t.clientX;
        this.lastTouchY = t.clientY;
        this.yaw -= dx * 0.0048;
        this.pitch = THREE.MathUtils.clamp(this.pitch - dy * 0.0042, -1.46, 1.46);
        break;
      }
    }
  };

  private handleTouchEnd = (e: TouchEvent) => {
    if (this.lookTouchId === null) return;
    for (let i = 0; i < e.changedTouches.length; i++) {
      if (e.changedTouches[i].identifier === this.lookTouchId) {
        this.lookTouchId = null;
        break;
      }
    }
  };

  private handleBlur = () => {
    this.keys.clear();
    this.draggingLook = false;
    this.lookTouchId = null;
    this.virtualMoveX = 0;
    this.virtualMoveY = 0;
    this.virtualBoost = false;
    this.releaseHook(this.leftHook);
    this.releaseHook(this.rightHook);
  };

  private handleContextLost = (e: Event) => {
    e.preventDefault();
    this.contextLost = true;
  };

  private handleContextRestored = () => {
    this.contextLost = false;
  };

  private bindEvents() {
    window.addEventListener('resize', this.handleResize);
    window.addEventListener('keydown', this.handleKeyDown);
    window.addEventListener('keyup', this.handleKeyUp);
    window.addEventListener('blur', this.handleBlur);
    window.addEventListener('mouseup', this.handleMouseUp);
    document.addEventListener('pointerlockchange', this.handlePointerLockChange);

    const dom = this.renderer.domElement;
    dom.addEventListener('mousemove', this.handleMouseMove);
    dom.addEventListener('mousedown', this.handleMouseDown);
    dom.addEventListener('touchstart', this.handleTouchStart, { passive: true });
    dom.addEventListener('touchmove', this.handleTouchMove, { passive: false });
    dom.addEventListener('touchend', this.handleTouchEnd);
    dom.addEventListener('touchcancel', this.handleTouchEnd);
    dom.addEventListener('contextmenu', this.handleContextMenu);
    dom.addEventListener('webglcontextlost', this.handleContextLost);
    dom.addEventListener('webglcontextrestored', this.handleContextRestored);
  }

  public destroy() {
    this.stop();
    window.removeEventListener('resize', this.handleResize);
    window.removeEventListener('keydown', this.handleKeyDown);
    window.removeEventListener('keyup', this.handleKeyUp);
    window.removeEventListener('blur', this.handleBlur);
    window.removeEventListener('mouseup', this.handleMouseUp);
    document.removeEventListener('pointerlockchange', this.handlePointerLockChange);

    const dom = this.renderer.domElement;
    dom.removeEventListener('mousemove', this.handleMouseMove);
    dom.removeEventListener('mousedown', this.handleMouseDown);
    dom.removeEventListener('touchstart', this.handleTouchStart);
    dom.removeEventListener('touchmove', this.handleTouchMove);
    dom.removeEventListener('touchend', this.handleTouchEnd);
    dom.removeEventListener('touchcancel', this.handleTouchEnd);
    dom.removeEventListener('contextmenu', this.handleContextMenu);
    dom.removeEventListener('webglcontextlost', this.handleContextLost);
    dom.removeEventListener('webglcontextrestored', this.handleContextRestored);

    this.clearWorld();
    this.composer?.dispose();
    this.skyMat.dispose();
    this.textures.dispose();
    this.steamGeo.dispose();
    this.bloodGeo.dispose();
    this.boulderGeo.dispose();
    this.spikeGeo.dispose();
    this.bulletGeo.dispose();
    this.steamMat.dispose();
    this.bloodMat.dispose();
    this.sparkMat.dispose();
    this.flareMat.dispose();
    this.boulderMat.dispose();
    this.spikeMat.dispose();
    this.bulletMat.dispose();
    this.renderer.dispose();
    if (dom.parentNode === this.container) {
      this.container.removeChild(dom);
    }
  }

  private clearWorld() {
    while (this.worldGroup.children.length > 0) {
      const child = this.worldGroup.children[0];
      this.worldGroup.remove(child);
    }
    for (const t of this.titans) {
      this.scene.remove(t.group);
    }
    for (const pt of this.particles) {
      this.scene.remove(pt.mesh);
    }
    for (const hz of this.hazards) {
      this.scene.remove(hz.mesh);
    }
    for (const lx of this.lightnings) {
      this.scene.remove(lx.group);
      this.scene.remove(lx.ring);
      lx.boltMat.dispose();
      lx.ringMat.dispose();
    }
    if (this.ambientPoints) {
      this.ambientPoints.geometry.dispose();
      (this.ambientPoints.material as THREE.Material).dispose();
      this.worldGroup.remove(this.ambientPoints);
      this.ambientPoints = null;
      this.ambientBaseY = null;
    }
    this.titans = [];
    this.particles = [];
    this.hazards = [];
    this.lightnings = [];
    this.colliders = [];
    this.supplies = [];
  }

  private buildDistrictScene(districtId: DistrictId) {
    this.clearWorld();
    const meta = DISTRICTS[districtId];
    const castShadow = !this.isSoftwareGl;

    // Update Procedural Anime Sky Dome Palette + Atmospheric Fog
    this.skyMat.uniforms.uTopColor.value.set(meta.skyColors[0]);
    this.skyMat.uniforms.uMidColor.value.set(meta.skyColors[1]);
    this.skyMat.uniforms.uHorizonColor.value.set(meta.skyColors[3]);
    this.skyMat.uniforms.uSunColor.value.set(
      districtId === 'quinta'
        ? '#FF9466'
        : districtId === 'forest'
          ? '#A7E3C6'
          : districtId === 'reiss_chapel'
            ? '#67E8F9'
            : districtId === 'utgard'
              ? '#CBD5E1'
              : districtId === 'paradis_rumbling'
                ? '#FF6B4A'
                : districtId === 'liberio'
                  ? '#F59E0B'
                  : '#FFC482'
    );
    const fogColor = new THREE.Color(meta.skyColors[2]).lerp(new THREE.Color(meta.skyColors[3]), 0.35);
    this.scene.fog = new THREE.FogExp2(
      fogColor.getHex(),
      districtId === 'forest' ? 0.0046 : districtId === 'paradis_rumbling' ? 0.0042 : 0.0033
    );

    // 3-Point Warm Sunset / Moonlight / Crystal Atmospheric Lighting
    const hemiSky =
      districtId === 'reiss_chapel'
        ? 0x67e8f9
        : districtId === 'utgard'
          ? 0x818cf8
          : districtId === 'paradis_rumbling'
            ? 0xfca5a5
            : 0xa3c0e6;
    const hemi = new THREE.HemisphereLight(hemiSky, 0x3b2c25, districtId === 'utgard' ? 0.7 : 0.85);
    this.worldGroup.add(hemi);

    const sunColor =
      districtId === 'quinta'
        ? 0xffb38a
        : districtId === 'forest'
          ? 0xd2f5dc
          : districtId === 'reiss_chapel'
            ? 0x67e8f9
            : districtId === 'utgard'
              ? 0xcbd5e1
              : districtId === 'paradis_rumbling'
                ? 0xff7b54
                : 0xffddb0;
    const sun = new THREE.DirectionalLight(sunColor, districtId === 'utgard' ? 1.55 : 2.05);
    sun.position.set(80, 125, -140);
    sun.castShadow = castShadow;
    if (castShadow) {
      sun.shadow.mapSize.set(2048, 2048);
      sun.shadow.radius = 3;
      sun.shadow.camera.near = 10;
      sun.shadow.camera.far = 380;
      const d = 148;
      sun.shadow.camera.left = -d;
      sun.shadow.camera.right = d;
      sun.shadow.camera.top = d;
      sun.shadow.camera.bottom = -d;
      sun.shadow.bias = -0.0005;
      sun.shadow.normalBias = 0.025;
    }
    this.worldGroup.add(sun);

    const rim = new THREE.DirectionalLight(
      districtId === 'paradis_rumbling' ? 0xea580c : 0x647da3,
      0.68
    );
    rim.position.set(-90, 65, 110);
    this.worldGroup.add(rim);

    // Ground Surface per District
    const useCobble = districtId !== 'forest' && districtId !== 'reiss_chapel' && districtId !== 'paradis_rumbling';
    const groundColor =
      districtId === 'forest'
        ? 0x223224
        : districtId === 'reiss_chapel'
          ? 0x162633
          : districtId === 'paradis_rumbling'
            ? 0x301e1c
            : 0x5c626e;
    const groundMat = new THREE.MeshStandardMaterial({
      map: useCobble ? this.textures.cobblestone : undefined,
      bumpMap: useCobble ? this.textures.cobbleBump : undefined,
      bumpScale: 0.16,
      roughnessMap: useCobble ? this.textures.cobbleRoughness : undefined,
      color: groundColor,
      roughness: districtId === 'reiss_chapel' ? 0.45 : 0.88,
      metalness: districtId === 'reiss_chapel' ? 0.18 : 0.06,
    });
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(920, 920), groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    this.worldGroup.add(ground);

    // Distant Mountain Ridge Silhouettes beyond Wall Maria
    const ridgeMat = new THREE.MeshStandardMaterial({
      color: districtId === 'paradis_rumbling' ? 0x2b1212 : 0x19212e,
      roughness: 0.95,
    });
    for (let i = 0; i < 20; i++) {
      const ang = (i / 20) * Math.PI * 2;
      const dist = 250 + (i % 3) * 38;
      const peak = new THREE.Mesh(new THREE.ConeGeometry(48 + (i % 4) * 14, 82 + (i % 3) * 30, 6), ridgeMat);
      peak.position.set(Math.cos(ang) * dist, 34, Math.sin(ang) * dist);
      this.worldGroup.add(peak);
    }

    // 50-Meter Perimeter Walls (or Cavern Rock Perimeter in Reiss Chapel)
    const wallMat = new THREE.MeshStandardMaterial({
      map: this.textures.fortressStone,
      bumpMap: this.textures.stoneBump,
      bumpScale: 0.28,
      color: districtId === 'reiss_chapel' ? 0x293b4d : districtId === 'paradis_rumbling' ? 0x3b2a29 : 0xffffff,
      roughness: 0.86,
      metalness: 0.06,
    });
    const wallThick = 14;
    const span = ARENA_HALF * 2 + wallThick;

    const addWallSegment = (x: number, z: number, w: number, d: number) => {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, WALL_HEIGHT, d), wallMat);
      mesh.position.set(x, WALL_HEIGHT / 2, z);
      mesh.receiveShadow = true;
      this.worldGroup.add(mesh);

      const topTrim = new THREE.Mesh(new THREE.BoxGeometry(w + 1.2, 2.4, d + 1.2), wallMat);
      topTrim.position.set(x, WALL_HEIGHT + 1.2, z);
      this.worldGroup.add(topTrim);

      this.colliders.push({
        minX: x - w / 2,
        maxX: x + w / 2,
        minY: 0,
        maxY: WALL_HEIGHT + 2,
        minZ: z - d / 2,
        maxZ: z + d / 2,
        isWall: true,
      });
    };

    addWallSegment(0, -ARENA_HALF - wallThick / 2, span, wallThick);
    addWallSegment(0, ARENA_HALF + wallThick / 2, span, wallThick);
    addWallSegment(-ARENA_HALF - wallThick / 2, 0, wallThick, span);
    addWallSegment(ARENA_HALF + wallThick / 2, 0, wallThick, span);

    // Wall Buttresses & Survey Corps Banners
    for (let bx = -100; bx <= 100; bx += 40) {
      const buttress = new THREE.Mesh(new THREE.BoxGeometry(4.2, WALL_HEIGHT * 0.92, 4.0), wallMat);
      buttress.position.set(bx, WALL_HEIGHT * 0.46, -ARENA_HALF + 1.2);
      this.worldGroup.add(buttress);

      if (Math.abs(bx) >= 30 && districtId !== 'reiss_chapel' && districtId !== 'liberio') {
        const banner = createSurveyBanner3D(bx, WALL_HEIGHT - 8, -ARENA_HALF + 3.6, 0, this.textures);
        this.worldGroup.add(banner);
      }
    }

    if (meta.hasBrokenGate) {
      const gateDark = new THREE.Mesh(
        new THREE.BoxGeometry(22, 21, wallThick + 1.4),
        new THREE.MeshBasicMaterial({ color: 0x070a0f })
      );
      gateDark.position.set(0, 10.5, -ARENA_HALF - wallThick / 2);
      this.worldGroup.add(gateDark);

      const lintel = new THREE.Mesh(new THREE.BoxGeometry(26, 3.2, wallThick + 2.2), wallMat);
      lintel.position.set(0, 22, -ARENA_HALF - wallThick / 2);
      this.worldGroup.add(lintel);
    }

    if (meta.hasCannons) {
      for (let cx = -100; cx <= 100; cx += 50) {
        const cannon = createCannon3D();
        cannon.position.set(cx, WALL_HEIGHT + 2.2, -ARENA_HALF - 4);
        this.worldGroup.add(cannon);
      }
    }

    if (meta.hasColossalSilhouette) {
      const colossal = createColossalTitanBackdrop(WALL_HEIGHT, this.textures);
      colossal.position.set(0, 0, -ARENA_HALF - 11.5);
      this.worldGroup.add(colossal);
    }

    if (meta.hasBoulder) {
      const boulder = new THREE.Mesh(
        new THREE.DodecahedronGeometry(13.5, 1),
        new THREE.MeshStandardMaterial({
          map: this.textures.fortressStone,
          bumpMap: this.textures.stoneBump,
          bumpScale: 0.4,
          color: 0x4b4e57,
          roughness: 0.92,
        })
      );
      boulder.position.set(-22, 9.5, -78);
      boulder.castShadow = castShadow;
      this.worldGroup.add(boulder);
    }

    // Specialized Landmark Environments per Map
    if (districtId === 'utgard') {
      const keep = createUtgardCastleKeep(this.textures, castShadow);
      this.worldGroup.add(keep.group);
      this.colliders.push(...keep.colliders);
      this.worldGroup.add(createUtgardMoon());
    } else if (districtId === 'reiss_chapel') {
      this.worldGroup.add(createCrystalAltar());
      for (const cz of [-75, -25, 25, 75]) {
        this.worldGroup.add(createCrystalCeilingArch(cz));
      }
      if (!this.isSoftwareGl) {
        const caveLight = new THREE.PointLight(0x22d3ee, 65, 120, 1.5);
        caveLight.position.set(0, 26, -16);
        this.worldGroup.add(caveLight);
      }
    } else if (districtId === 'liberio') {
      const plaza = createLiberioAmphitheater(this.textures, castShadow);
      this.worldGroup.add(plaza.group);
      this.colliders.push(...plaza.colliders);
    } else if (districtId === 'paradis_rumbling') {
      for (const rz of [-90, -45, 0, 45, 90]) {
        this.worldGroup.add(createRumblingRibArch(rz, 1.05));
      }
      this.worldGroup.add(createRumblingHorizonTitans());
    } else if (districtId === 'shiganshina' || districtId === 'quinta' || districtId === 'trost') {
      const canal = createCanalAndBridges(this.textures, castShadow);
      this.worldGroup.add(canal.group);
      this.colliders.push(...canal.colliders);
    }

    // District Atmospheric Drifting Embers / Crystal Motes / Spores
    this.buildAtmosphereParticles(districtId);

    // District Skyline Buildings / Trees / Crystal Pillars / Ruins
    const gridCoords = [-105, -70, -35, 35, 70, 105];
    for (const gx of gridCoords) {
      for (const gz of gridCoords) {
        if (Math.abs(gx) < 30 && Math.abs(gz) < 30) continue;

        const seed = Math.abs(Math.sin(gx * 12.9898 + gz * 78.233) * 43758.5453) % 1;
        const jx = gx + (seed - 0.5) * 10;
        const jz = gz + (((seed * 7) % 1) - 0.5) * 10;

        if (districtId === 'reiss_chapel') {
          const h = 34 + seed * 22;
          const rad = 2.6 + ((seed * 3) % 1) * 1.8;
          const tilt = (seed - 0.5) * 0.16;
          const pillar = createCrystalPillar(jx, jz, h, rad, tilt);
          this.worldGroup.add(pillar.group);
          this.colliders.push(pillar.collider);
          continue;
        }

        let style: 'house' | 'tower' | 'tree' | 'ruin' = 'house';
        let w = 13 + seed * 6;
        let d = 13 + ((seed * 3) % 1) * 6;
        let h = 11 + ((seed * 11) % 1) * 8;

        if (districtId === 'forest') {
          style = seed > 0.84 ? 'ruin' : 'tree';
          w = style === 'tree' ? 5.5 + seed * 2.5 : 14;
          d = w;
          h = style === 'tree' ? 38 + ((seed * 5) % 1) * 16 : 10;
        } else if (districtId === 'utgard') {
          style = seed > 0.68 ? 'tower' : 'ruin';
          w = style === 'tower' ? 10 : 14;
          d = w;
          h = style === 'tower' ? 24 + seed * 10 : 9 + seed * 7;
        } else if (districtId === 'paradis_rumbling') {
          style = seed > 0.55 ? 'ruin' : 'tower';
          w = 11;
          d = 11;
          h = style === 'tower' ? 28 + seed * 12 : 10 + seed * 8;
        } else if (seed > 0.78) {
          style = 'tower';
          w = 10;
          d = 10;
          h = 26 + ((seed * 9) % 1) * 10;
        } else if (districtId === 'trost' && seed < 0.22) {
          style = 'ruin';
          h = 8 + seed * 6;
        }

        const { group, collider } = createBuilding3D(jx, jz, w, h, d, style, this.textures, castShadow);
        this.worldGroup.add(group);
        this.colliders.push(collider);
      }
    }

    // Street Gas Lamps & Wagons in Urban Maps
    if (districtId === 'shiganshina' || districtId === 'quinta' || districtId === 'trost' || districtId === 'liberio') {
      let lampIdx = 0;
      for (const lx of [-18, 18]) {
        for (let lz = -100; lz <= 100; lz += 40) {
          const lamp = createStreetLamp3D(lx, lz);
          this.worldGroup.add(lamp);

          if (!this.isSoftwareGl && lampIdx % 2 === 0) {
            const pLight = new THREE.PointLight(0xffad42, 22, 36, 1.8);
            pLight.position.set(lx + (lx < 0 ? 0.75 : -0.75), 5.2, lz);
            this.worldGroup.add(pLight);
          }
          lampIdx++;
        }
      }

      this.worldGroup.add(createSupplyWagon3D(-16, 16, 0.35));
      this.worldGroup.add(createSupplyWagon3D(16, -24, -0.4));
    }

    // 4 Survey Corps Supply Depots across the district
    const supplyCoords: Array<[number, number, number]> = [
      [0, 0, 0],
      [-70, 0, -52],
      [70, 0, -52],
      [0, 0, 76],
    ];
    for (const [sx, sy, sz] of supplyCoords) {
      const depot = createSupplyDepot3D(sx, sy, sz, this.textures);
      this.worldGroup.add(depot);
      this.supplies.push({ x: sx, y: sy, z: sz, cooldown: 0, mesh: depot });
    }
  }

  private buildAtmosphereParticles(districtId: DistrictId) {
    const count = 320;
    const positions = new Float32Array(count * 3);
    const baseY = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 260;
      const py = 2 + Math.random() * 58;
      positions[i * 3 + 1] = py;
      baseY[i] = py;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 260;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    const color =
      districtId === 'reiss_chapel'
        ? 0x67e8f9
        : districtId === 'paradis_rumbling'
          ? 0xfb923c
          : districtId === 'forest'
            ? 0xbbf7d0
            : districtId === 'utgard'
              ? 0xcbd5e1
              : 0xfde68a;

    const mat = new THREE.PointsMaterial({
      color,
      size: districtId === 'paradis_rumbling' ? 0.65 : 0.45,
      transparent: true,
      opacity: 0.72,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const pts = new THREE.Points(geo, mat);
    pts.frustumCulled = false;
    this.worldGroup.add(pts);
    this.ambientPoints = pts;
    this.ambientBaseY = baseY;
  }

  private spawnTitanLightning(x: number, z: number, colorHex: number = 0xfef08a) {
    const group = new THREE.Group();
    const boltMat = new THREE.MeshBasicMaterial({
      color: colorHex,
      transparent: true,
      opacity: 0.95,
      blending: THREE.AdditiveBlending,
    });

    let curX = x;
    let curZ = z;
    let curY = 120;
    const steps = 6;
    for (let i = 0; i < steps; i++) {
      const nextY = curY - 20;
      const nextX = i === steps - 1 ? x : x + (Math.random() - 0.5) * 14;
      const nextZ = i === steps - 1 ? z : z + (Math.random() - 0.5) * 14;
      _v1.set(curX, curY, curZ);
      _v2.set(nextX, nextY, nextZ);
      const len = _v1.distanceTo(_v2);
      const seg = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.7, len, 6), boltMat);
      seg.position.copy(_v1).add(_v2).multiplyScalar(0.5);
      _v3.copy(_v2).sub(_v1).normalize();
      seg.quaternion.setFromUnitVectors(_upAxis, _v3);
      group.add(seg);
      curX = nextX;
      curY = nextY;
      curZ = nextZ;
    }
    this.scene.add(group);

    const ringMat = new THREE.MeshBasicMaterial({
      color: colorHex,
      transparent: true,
      opacity: 0.85,
      side: THREE.DoubleSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const ring = new THREE.Mesh(new THREE.RingGeometry(1.5, 4.0, 28), ringMat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(x, 0.35, z);
    this.scene.add(ring);

    this.lightnings.push({ group, ring, boltMat, ringMat, life: 0.75, maxLife: 0.75 });
    this.spawnBurst(x, 3, z, 10, this.steamMat, 11, 0.9, true);
  }

  public startNewGame(difficulty: Difficulty, districtId: DistrictId) {
    this.difficulty = difficulty;
    this.districtId = districtId;
    this.buildDistrictScene(districtId);

    this.pos.set(0, 18, 36);
    this.vel.set(0, 0, 0);
    this.yaw = 0;
    this.pitch = -0.05;
    this.roll = 0;
    this.grounded = false;

    this.hp = 100;
    this.maxHp = 100;
    this.gas = 100;
    this.maxGas = 100;
    this.bladeDurability = 100;
    this.maxBladeDurability = 100;
    this.spareBlades = 6;
    this.maxSpareBlades = 6;
    this.slashTimer = 0;
    this.slashCooldown = 0;
    this.reloadTimer = 0;
    this.invulnTimer = 1.0;
    this.grabbedByTitanId = null;
    this.escapeProgress = 0;

    this.releaseHook(this.leftHook);
    this.releaseHook(this.rightHook);

    this.wave = 1;
    this.score = 0;
    this.kills = 0;
    this.combo = 0;
    this.comboTimer = 0;
    this.maxCombo = 0;
    this.bestSpeedKmh = 0;
    this.gameOverReason = '';
    this.waveClearDelay = 0;
    this.hitStopTimer = 0;
    this.slowMoTimer = 0;
    this.shakeTimer = 0;
    this.combatBanner = '';
    this.combatBannerTimer = 0;

    this.spawnWaveTitans(1);
    this.waveBannerTimer = 2.8;
    soundEngine.playTitanRoar();

    if (!this.isSoftwareGl) {
      this.renderer.compile(this.scene, this.camera);
    }

    this.paused = false;
    this.running = true;
    this.clock.getDelta();
    this.emitHud();
    this.scheduleNextTick();
  }

  private spawnWaveTitans(waveNum: number) {
    for (const t of this.titans) {
      this.scene.remove(t.group);
    }
    this.titans = [];

    const mult = getDifficultyMultipliers(this.difficulty);
    const roster = getDistrictWaveRoster(this.districtId, waveNum);

    const scaleMap: Record<TitanKind, number> = {
      colossal: 2.85,
      founding: 2.1,
      beast: 1.68,
      armored: 1.55,
      warhammer: 1.5,
      attack: 1.48,
      female: 1.42,
      abnormal: 1.22,
      normal: 1.05,
      cart: 0.85,
      jaw: 0.74,
    };

    const hpMap: Record<TitanKind, number> = {
      colossal: 460,
      founding: 420,
      warhammer: 320,
      armored: 300,
      beast: 270,
      attack: 240,
      female: 220,
      cart: 185,
      jaw: 165,
      abnormal: 125,
      normal: 100,
    };

    for (const kind of roster) {
      const scale = scaleMap[kind] * (kind === 'normal' ? 0.9 + Math.random() * 0.3 : 1.0);
      const maxHp = Math.round(hpMap[kind] * mult.titanHp * (1 + (waveNum - 1) * 0.08));

      let sx = (Math.random() - 0.5) * 195;
      let sz = (Math.random() - 0.5) * 195;
      if (Math.hypot(sx - this.pos.x, sz - this.pos.z) < 44) {
        sx = sx >= 0 ? 78 : -78;
        sz = -78;
      }

      const titan = createTitan3D(
        this.nextTitanId++,
        kind,
        scale,
        sx,
        sz,
        maxHp,
        this.textures,
        !this.isSoftwareGl
      );
      this.scene.add(titan.group);
      this.titans.push(titan);

      // Golden Titan Transformation Lightning on Nine Titans Arrival!
      if (kind !== 'normal' && kind !== 'abnormal') {
        const boltCol = kind === 'founding' ? 0x67e8f9 : 0xfef08a;
        this.spawnTitanLightning(sx, sz, boltCol);
      }
    }

    // Launch green Survey Corps Signal Flare stream
    this.flareTimer = 1.6;
  }

  public setPaused(paused: boolean) {
    this.paused = paused;
    if (paused && document.pointerLockElement) {
      document.exitPointerLock?.();
    }
    if (!paused && this.running) {
      this.clock.getDelta();
    }
  }

  public stop() {
    this.running = false;
    cancelAnimationFrame(this.frameId);
    clearTimeout(this.frameId);
    if (document.pointerLockElement === this.renderer.domElement) {
      document.exitPointerLock?.();
    }
  }

  public toggleMute(): boolean {
    const next = !soundEngine.isMuted();
    soundEngine.setMuted(next);
    this.emitHud();
    return next;
  }

  public toggleView(): boolean {
    this.thirdPerson = !this.thirdPerson;
    this.emitHud();
    return this.thirdPerson;
  }

  public setTouchMode(enabled: boolean) {
    this.touchMode = enabled;
    if (enabled && document.pointerLockElement === this.renderer.domElement) {
      document.exitPointerLock?.();
    }
  }

  public setVirtualMove(x: number, y: number) {
    this.virtualMoveX = THREE.MathUtils.clamp(x, -1, 1);
    this.virtualMoveY = THREE.MathUtils.clamp(y, -1, 1);
  }

  public setVirtualWire(active: boolean) {
    if (!this.running || this.paused) return;
    if (active) {
      if (this.grabbedByTitanId !== null) {
        this.advanceGrabEscape();
        return;
      }
      this.attachHook(this.leftHook, -1);
      this.attachHook(this.rightHook, 1);
    } else {
      this.releaseHook(this.leftHook);
      this.releaseHook(this.rightHook);
    }
  }

  public setVirtualBoost(active: boolean) {
    if (!this.running || this.paused) return;
    if (active) {
      if (this.grabbedByTitanId !== null) {
        this.advanceGrabEscape();
        return;
      }
      if (this.grounded) {
        this.vel.y = 14.5;
        this.grounded = false;
      }
    }
    this.virtualBoost = active;
  }

  public triggerSlashAction() {
    if (!this.running || this.paused) return;
    this.triggerSlashOrEscape();
  }

  public triggerReloadAction() {
    if (!this.running || this.paused) return;
    this.triggerReload();
  }

  private scheduleNextTick() {
    if (!this.running) return;
    if (this.isSoftwareGl) {
      this.afterDraw(() => this.tick());
    } else {
      this.frameId = requestAnimationFrame(() => this.tick());
    }
  }

  private afterDraw(cb: () => void) {
    const gl = this.renderer.getContext() as WebGL2RenderingContext;
    const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
    gl.flush();
    const poll = () => {
      if (!this.running) return;
      const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
      if (state === gl.UNSIGNALED) {
        this.frameId = window.setTimeout(poll, 5);
      } else {
        if (sync) gl.deleteSync(sync);
        this.frameId = window.setTimeout(cb, 80);
      }
    };
    this.frameId = window.setTimeout(poll, 5);
  }

  private tick() {
    if (!this.running || this.contextLost) return;
    const rawDt = Math.min(0.05, Math.max(0.001, this.clock.getDelta()));

    if (!this.paused) {
      this.step(rawDt);
    }
    this.renderFrame();
    this.scheduleNextTick();
  }

  // ==================== RAYCAST & HOOKS ====================
  private findHookHit(outPos: THREE.Vector3): {
    hit: boolean;
    dist: number;
    titanId: number | null;
    localOffset: THREE.Vector3;
  } {
    _euler.set(this.pitch, this.yaw, 0, 'YXZ');
    _rayDir.set(0, 0, -1).applyEuler(_euler).normalize();

    const ox = this.camera.position.x;
    const oy = this.camera.position.y;
    const oz = this.camera.position.z;

    let bestT = MAX_HOOK_DIST;
    let hitTitanId: number | null = null;
    const localOffset = new THREE.Vector3();

    for (const c of this.colliders) {
      const t = this.rayAABB(ox, oy, oz, _rayDir.x, _rayDir.y, _rayDir.z, c);
      if (t !== null && t > 1.5 && t < bestT) {
        bestT = t;
        hitTitanId = null;
      }
    }

    for (const ti of this.titans) {
      if (ti.dead || ti.dyingTimer > 0) continue;
      const cx = ti.group.position.x;
      const cy = ti.group.position.y + 7.2 * ti.scale;
      const cz = ti.group.position.z;
      const r = 2.6 * ti.scale;
      const t = this.raySphere(ox, oy, oz, _rayDir.x, _rayDir.y, _rayDir.z, cx, cy, cz, r);
      if (t !== null && t > 2.0 && t < bestT) {
        bestT = t;
        hitTitanId = ti.id;
        localOffset.set(
          ox + _rayDir.x * t - ti.group.position.x,
          oy + _rayDir.y * t - ti.group.position.y,
          oz + _rayDir.z * t - ti.group.position.z
        );
      }
    }

    if (bestT < MAX_HOOK_DIST) {
      outPos.set(ox + _rayDir.x * bestT, oy + _rayDir.y * bestT, oz + _rayDir.z * bestT);
      return { hit: true, dist: bestT, titanId: hitTitanId, localOffset };
    }

    return { hit: false, dist: 0, titanId: null, localOffset };
  }

  private rayAABB(
    ox: number,
    oy: number,
    oz: number,
    dx: number,
    dy: number,
    dz: number,
    b: BuildingCollider
  ): number | null {
    const ix = dx !== 0 ? 1 / dx : 1e9;
    const iy = dy !== 0 ? 1 / dy : 1e9;
    const iz = dz !== 0 ? 1 / dz : 1e9;

    const t1 = (b.minX - ox) * ix;
    const t2 = (b.maxX - ox) * ix;
    const t3 = (b.minY - oy) * iy;
    const t4 = (b.maxY - oy) * iy;
    const t5 = (b.minZ - oz) * iz;
    const t6 = (b.maxZ - oz) * iz;

    const tmin = Math.max(Math.min(t1, t2), Math.min(t3, t4), Math.min(t5, t6));
    const tmax = Math.min(Math.max(t1, t2), Math.max(t3, t4), Math.max(t5, t6));
    if (tmax < 0 || tmin > tmax) return null;
    return tmin >= 0 ? tmin : tmax;
  }

  private raySphere(
    ox: number,
    oy: number,
    oz: number,
    dx: number,
    dy: number,
    dz: number,
    cx: number,
    cy: number,
    cz: number,
    r: number
  ): number | null {
    const fx = ox - cx;
    const fy = oy - cy;
    const fz = oz - cz;
    const b = 2 * (fx * dx + fy * dy + fz * dz);
    const c = fx * fx + fy * fy + fz * fz - r * r;
    const disc = b * b - 4 * c;
    if (disc < 0) return null;
    const sq = Math.sqrt(disc);
    const t1 = (-b - sq) / 2;
    const t2 = (-b + sq) / 2;
    if (t1 >= 0) return t1;
    if (t2 >= 0) return t2;
    return null;
  }

  private attachHook(hook: HookState, side: -1 | 1) {
    if (this.gas <= 0.5) {
      this.showBanner('가스 부족! 보급소를 찾으세요');
      return;
    }
    const res = this.findHookHit(_v1);
    if (!res.hit) return;

    hook.active = true;
    hook.anchor.copy(_v1);
    hook.attachedTitanId = res.titanId;
    hook.localOffset.copy(res.localOffset);
    hook.wireLength = Math.max(4, this.pos.distanceTo(hook.anchor) - 1.5);
    hook.wireMesh.visible = true;
    hook.anchorDart.visible = true;

    if (res.titanId === null && (side === -1 || side === 1)) {
      _right.set(1, 0, 0).applyAxisAngle(_v2.set(0, 1, 0), this.yaw);
      hook.anchor.addScaledVector(_right, side * 0.8);
    }

    soundEngine.playGrapple();
    this.spawnBurst(hook.anchor.x, hook.anchor.y, hook.anchor.z, 6, this.sparkMat, 7, 0.25);
  }

  private releaseHook(hook: HookState) {
    hook.active = false;
    hook.attachedTitanId = null;
    hook.wireMesh.visible = false;
    hook.anchorDart.visible = false;
  }

  private triggerReload() {
    if (this.reloadTimer > 0) return;
    if (this.bladeDurability >= 100) {
      this.showBanner('칼날 상태 최상 (100%)');
      this.emitHud();
      return;
    }
    if (this.spareBlades <= 0) {
      this.showBanner('예비 칼날 없음! 보급소에서 충전하세요');
      this.emitHud();
      return;
    }
    this.reloadTimer = 0.42;
    this.spareBlades -= 1;
    soundEngine.playBladeReload();
    this.emitHud();
  }

  private advanceGrabEscape() {
    this.escapeProgress += 26;
    soundEngine.playSlash(false);
    if (this.escapeProgress >= 100) {
      const titan = this.titans.find((t) => t.id === this.grabbedByTitanId);
      if (titan) {
        titan.grabbingPlayer = false;
        titan.staggerTimer = 1.6;
        titan.attackCooldown = 2.0;
        titan.handTarget.getWorldPosition(_v1);
        this.spawnBurst(_v1.x, _v1.y, _v1.z, 14, this.bloodMat, 10, 0.5);
      }
      this.grabbedByTitanId = null;
      this.escapeProgress = 0;
      this.invulnTimer = 1.0;
      this.vel.y = 14;
      this.showBanner('손가락 절단 탈출!');
    }
  }

  private triggerSlashOrEscape() {
    if (this.grabbedByTitanId !== null) {
      this.advanceGrabEscape();
      return;
    }
    if (this.slashCooldown > 0 || this.reloadTimer > 0) return;

    if (this.bladeDurability <= 0) {
      if (this.spareBlades > 0) this.triggerReload();
      else this.showBanner('칼날 마모! 보급소에서 보충하세요');
      return;
    }

    const speed = this.vel.length();
    const speedKmh = speed * SPEED_TO_KMH;
    this.isSpinSlash = speedKmh >= 75;
    this.slashTimer = 0.24;
    this.slashCooldown = 0.26;

    _euler.set(this.pitch, this.yaw, 0, 'YXZ');
    _forward.set(0, 0, -1).applyEuler(_euler).normalize();
    if (!this.grounded) {
      this.vel.addScaledVector(_forward, 6.5);
    }

    this.bladeDurability = Math.max(0, this.bladeDurability - 14);
    soundEngine.playSlash(this.isSpinSlash);

    this.evaluateSlashHits(speedKmh);
  }

  private evaluateSlashHits(speedKmh: number) {
    const durabilityFactor = this.bladeDurability > 15 ? 1.0 : 0.55;
    const speedDmg = Math.round((48 + speedKmh * 1.15) * durabilityFactor * (this.isSpinSlash ? 1.3 : 1.0));
    const slashPos = _v2.copy(this.pos).addScaledVector(_forward, 2.4);

    for (const t of this.titans) {
      if (t.dead || t.dyingTimer > 0) continue;
      const hitScale = Math.max(1.15, t.scale);

      t.napeTarget.getWorldPosition(_v1);
      const distNape = Math.min(this.pos.distanceTo(_v1), slashPos.distanceTo(_v1));
      if (distNape <= 3.7 * hitScale) {
        const isCrit = speedKmh >= 90;
        const dmg = isCrit ? Math.max(speedDmg, Math.round(t.maxHp * 0.55)) : speedDmg;
        t.hp -= dmg;
        t.staggerTimer = 0.65;

        this.spawnBurst(_v1.x, _v1.y, _v1.z, isCrit ? 24 : 14, this.bloodMat, 12, 0.55);
        this.spawnBurst(_v1.x, _v1.y, _v1.z, 6, this.steamMat, 6, 0.7, true);
        soundEngine.playNapeKill(isCrit || t.hp <= 0);

        if (t.hp <= 0) {
          this.killTitan(t, speedKmh, isCrit);
        } else {
          this.hitStopTimer = 0.04;
          this.triggerShake(0.35, 0.14);
          this.showBanner(`${TITAN_LABELS[t.kind]} 목덜미 타격 -${dmg} (${Math.round(speedKmh)} km/h)`);
        }
        continue;
      }

      t.eyeTarget.getWorldPosition(_v1);
      if (Math.min(this.pos.distanceTo(_v1), slashPos.distanceTo(_v1)) <= 3.2 * hitScale) {
        t.blindTimer = 4.5;
        t.staggerTimer = 1.2;
        t.eyesGroup.visible = false;
        t.blindXGroup.visible = true;
        this.spawnBurst(_v1.x, _v1.y, _v1.z, 12, this.bloodMat, 9, 0.45);
        this.triggerShake(0.25, 0.12);
        this.showBanner(`${TITAN_LABELS[t.kind]} 눈 절단! 뒷목을 노리세요`);
        continue;
      }

      if (t.kind === 'armored' || t.kind === 'warhammer' || t.kind === 'female') {
        _v1.set(t.group.position.x, t.group.position.y + 7.4 * t.scale, t.group.position.z);
        if (slashPos.distanceTo(_v1) <= 3.6 * hitScale) {
          this.spawnBurst(slashPos.x, slashPos.y, slashPos.z, 10, this.sparkMat, 10, 0.3);
          this.showBanner(`${TITAN_LABELS[t.kind]} 경질화 장갑! 뒷목을 노리세요`);
        }
      }
    }
  }

  private killTitan(t: Titan3DInstance, speedKmh: number, isCrit: boolean) {
    t.dyingTimer = 1.6;
    t.grabbingPlayer = false;
    if (this.leftHook.attachedTitanId === t.id) this.releaseHook(this.leftHook);
    if (this.rightHook.attachedTitanId === t.id) this.releaseHook(this.rightHook);

    this.kills += 1;
    this.combo += 1;
    this.comboTimer = 5.0;
    if (this.combo > this.maxCombo) this.maxCombo = this.combo;

    const mult = getDifficultyMultipliers(this.difficulty).scoreMult;
    const ptsMap: Record<TitanKind, number> = {
      colossal: 800,
      founding: 750,
      warhammer: 580,
      armored: 500,
      beast: 480,
      attack: 440,
      female: 420,
      jaw: 360,
      cart: 350,
      abnormal: 220,
      normal: 150,
    };
    const basePts = ptsMap[t.kind];
    const speedBonus = Math.round(speedKmh * 1.5);
    const earned = Math.round((basePts + speedBonus) * (1 + (this.combo - 1) * 0.25) * mult);
    this.score += earned;

    this.hitStopTimer = isCrit ? 0.08 : 0.05;
    this.slowMoTimer = isCrit ? 0.25 : 0.14;
    this.triggerShake(isCrit ? 0.65 : 0.4, 0.24);

    const tName = TITAN_LABELS[t.kind];
    this.showBanner(
      this.combo >= 3
        ? `${tName} 토벌 · ${this.combo}연속! +${earned}점`
        : isCrit
          ? `${tName} 일격필살! +${earned}점 (${Math.round(speedKmh)} km/h)`
          : `${tName} 토벌! +${earned}점`
    );
  }

  private showBanner(text: string) {
    this.combatBanner = text;
    this.combatBannerTimer = 1.7;
  }

  private triggerShake(mag: number, dur: number) {
    this.shakeMag = Math.max(this.shakeMag, mag);
    this.shakeTimer = Math.max(this.shakeTimer, dur);
  }

  private spawnBurst(
    x: number,
    y: number,
    z: number,
    count: number,
    mat: THREE.Material,
    speed: number,
    life: number,
    isSteam: boolean = false
  ) {
    const geo = isSteam ? this.steamGeo : this.bloodGeo;
    for (let i = 0; i < count; i++) {
      if (this.particles.length > 180) break;
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(x, y, z);
      this.scene.add(mesh);
      this.particles.push({
        mesh,
        vx: (Math.random() - 0.5) * speed * 2,
        vy: (Math.random() - 0.2) * speed * 1.4,
        vz: (Math.random() - 0.5) * speed * 2,
        life: life * (0.7 + Math.random() * 0.6),
        maxLife: life,
        grow: isSteam ? 2.5 : 0,
        gravity: !isSteam,
      });
    }
  }

  // ==================== SIMULATION STEP ====================
  private step(rawDt: number) {
    this.elapsed += rawDt;
    this.skyMat.uniforms.uTime.value = this.elapsed;

    if (this.hitStopTimer > 0) {
      this.hitStopTimer -= rawDt;
      return;
    }

    let dt = rawDt;
    if (this.slowMoTimer > 0) {
      this.slowMoTimer -= rawDt;
      dt *= 0.35;
    }

    if (this.shakeTimer > 0) {
      this.shakeTimer -= rawDt;
      if (this.shakeTimer <= 0) this.shakeMag = 0;
    }
    if (this.waveBannerTimer > 0) this.waveBannerTimer -= rawDt;
    if (this.combatBannerTimer > 0) {
      this.combatBannerTimer -= rawDt;
      if (this.combatBannerTimer <= 0) this.combatBanner = '';
    }
    if (this.comboTimer > 0) {
      this.comboTimer -= rawDt;
      if (this.comboTimer <= 0) this.combo = 0;
    }

    // Colossal Titan wall steam plumes in Shiganshina
    if (DISTRICTS[this.districtId].hasColossalSilhouette) {
      this.colossalSteamAcc += rawDt;
      if (this.colossalSteamAcc >= 0.24) {
        this.colossalSteamAcc = 0;
        const steam = new THREE.Mesh(this.steamGeo, this.steamMat);
        steam.position.set((Math.random() - 0.5) * 32, WALL_HEIGHT + 4, -ARENA_HALF - 8);
        steam.scale.setScalar(4.2);
        this.scene.add(steam);
        this.particles.push({
          mesh: steam,
          vx: (Math.random() - 0.5) * 4,
          vy: 10 + Math.random() * 6,
          vz: 2 + Math.random() * 3,
          life: 2.2,
          maxLife: 2.2,
          grow: 2.6,
          gravity: false,
        });
      }
    }

    // Ascending green Survey Corps Signal Flare stream on Wave start
    if (this.flareTimer > 0) {
      this.flareTimer -= rawDt;
      if (Math.random() < 0.75 && this.particles.length < 180) {
        const progress = 1 - this.flareTimer / 1.6;
        const flare = new THREE.Mesh(this.steamGeo, this.flareMat);
        flare.position.set(-22, 8 + progress * 68, -28);
        flare.scale.setScalar(1.3);
        this.scene.add(flare);
        this.particles.push({
          mesh: flare,
          vx: (Math.random() - 0.5) * 2.2,
          vy: 6,
          vz: (Math.random() - 0.5) * 2.2,
          life: 1.4,
          maxLife: 1.4,
          grow: 1.8,
          gravity: false,
        });
      }
    }

    this.updatePlayer(dt);
    this.updateTitans(dt);
    this.updateHazards(dt);
    this.updateSupplies(dt);
    this.updateParticles(dt);
    this.updateLightning(rawDt);
    this.updateAtmosphere(rawDt);
    this.updateCameraAndRig(rawDt);

    const aimRes = this.findHookHit(_v1);
    this.hookReady = aimRes.hit;
    this.hookDist = Math.round(aimRes.dist);
    if (aimRes.titanId !== null) {
      const targetTitan = this.titans.find((ti) => ti.id === aimRes.titanId);
      if (targetTitan && !targetTitan.dead && targetTitan.dyingTimer <= 0) {
        this.targetTitanName = TITAN_LABELS[targetTitan.kind];
        this.targetTitanHpPct = Math.max(0, Math.round((targetTitan.hp / targetTitan.maxHp) * 100));
      } else {
        this.targetTitanName = undefined;
        this.targetTitanHpPct = undefined;
      }
    } else {
      this.targetTitanName = undefined;
      this.targetTitanHpPct = undefined;
    }

    const aliveCount = this.titans.filter((t) => !t.dead && t.dyingTimer <= 0).length;
    if (aliveCount === 0) {
      this.waveClearDelay += rawDt;
      if (this.waveClearDelay >= 2.0) {
        this.waveClearDelay = 0;
        this.wave += 1;
        this.spawnWaveTitans(this.wave);
        this.waveBannerTimer = 2.8;
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
    const mult = getDifficultyMultipliers(this.difficulty);

    if (this.slashTimer > 0) this.slashTimer -= dt;
    if (this.slashCooldown > 0) this.slashCooldown -= dt;
    if (this.invulnTimer > 0) this.invulnTimer -= dt;

    if (this.reloadTimer > 0) {
      this.reloadTimer -= dt;
      if (this.reloadTimer <= 0) {
        this.reloadTimer = 0;
        this.bladeDurability = this.maxBladeDurability;
        this.showBanner('칼날 교체 완료');
      }
    }

    if (this.grabbedByTitanId !== null) {
      const t = this.titans.find((ti) => ti.id === this.grabbedByTitanId);
      if (!t || t.dead || t.dyingTimer > 0) {
        this.grabbedByTitanId = null;
        this.escapeProgress = 0;
      } else {
        t.handTarget.getWorldPosition(_v1);
        this.pos.copy(_v1);
        this.vel.set(0, 0, 0);
        this.hp -= 18 * mult.damageTaken * dt;
        this.escapeProgress = Math.max(0, this.escapeProgress - 12 * dt);
        if (this.hp <= 0) {
          this.triggerGameOver('거인에게 포획되어 전사했습니다.');
        }
        return;
      }
    }

    _forward.set(-Math.sin(this.yaw), 0, -Math.cos(this.yaw)).normalize();
    _right.set(Math.cos(this.yaw), 0, -Math.sin(this.yaw)).normalize();

    const keyFwd =
      (this.keys.has('KeyW') || this.keys.has('ArrowUp') ? 1 : 0) -
      (this.keys.has('KeyS') || this.keys.has('ArrowDown') ? 1 : 0);
    const keySide =
      (this.keys.has('KeyD') || this.keys.has('ArrowRight') ? 1 : 0) -
      (this.keys.has('KeyA') || this.keys.has('ArrowLeft') ? 1 : 0);

    const fwdIn = Math.abs(keyFwd) > 0 ? keyFwd : this.virtualMoveY;
    const sideIn = Math.abs(keySide) > 0 ? keySide : this.virtualMoveX;

    _v1.set(0, 0, 0).addScaledVector(_forward, fwdIn).addScaledVector(_right, sideIn);
    if (_v1.lengthSq() > 1) _v1.normalize();

    if (this.grounded) {
      this.vel.x += _v1.x * 58 * dt;
      this.vel.z += _v1.z * 58 * dt;
      this.vel.x *= Math.pow(0.002, dt);
      this.vel.z *= Math.pow(0.002, dt);
    } else {
      this.vel.x += _v1.x * 18 * dt;
      this.vel.z += _v1.z * 18 * dt;
    }

    this.vel.y -= GRAVITY * dt;

    const processHook = (hook: HookState) => {
      if (!hook.active) return;
      if (hook.attachedTitanId !== null) {
        const t = this.titans.find((ti) => ti.id === hook.attachedTitanId);
        if (!t || t.dead || t.dyingTimer > 0) {
          this.releaseHook(hook);
          return;
        }
        hook.anchor.copy(t.group.position).add(hook.localOffset);
      }

      if (this.gas <= 0) {
        this.releaseHook(hook);
        return;
      }

      _v2.copy(hook.anchor).sub(this.pos);
      const dist = _v2.length();
      if (dist > 1.2) {
        _v2.divideScalar(dist);
        hook.wireLength = Math.max(3, Math.min(hook.wireLength, dist) - 18 * dt);

        this.vel.addScaledVector(_v2, 62 * dt);

        if (dist > hook.wireLength) {
          const radial = this.vel.dot(_v2);
          if (radial < 0) {
            this.vel.addScaledVector(_v2, -radial * 0.78);
          }
          const stretch = dist - hook.wireLength;
          this.vel.addScaledVector(_v2, Math.min(stretch * 10, 42) * dt);
        }
        this.gas = Math.max(0, this.gas - 2.4 * mult.gasDrain * dt);
      }
    };
    processHook(this.leftHook);
    processHook(this.rightHook);

    const boosting =
      this.virtualBoost ||
      this.keys.has('Space') ||
      this.keys.has('ShiftLeft') ||
      this.keys.has('ShiftRight');
    if (boosting && this.gas > 0) {
      _euler.set(this.pitch, this.yaw, 0, 'YXZ');
      _v3.set(0, 0, -1).applyEuler(_euler).normalize();
      if (_v1.lengthSq() > 0) {
        _v3.addScaledVector(_v1, 0.55).normalize();
      }
      this.vel.addScaledVector(_v3, 56 * dt);
      this.grounded = false;
      this.gas = Math.max(0, this.gas - 12 * mult.gasDrain * dt);
      soundEngine.playGasBoost();

      if (Math.random() < 0.7) {
        this.spawnBurst(this.pos.x, this.pos.y - 0.5, this.pos.z, 1, this.steamMat, 3.8, 0.35, true);
      }
    }

    const speed = this.vel.length();
    const maxSpd = 52;
    if (speed > maxSpd) {
      this.vel.multiplyScalar(maxSpd / speed);
    } else {
      this.vel.x *= Math.pow(0.84, dt);
      this.vel.z *= Math.pow(0.84, dt);
      this.vel.y *= Math.pow(0.95, dt);
    }

    const kmh = Math.round(this.vel.length() * SPEED_TO_KMH);
    if (kmh > this.bestSpeedKmh) this.bestSpeedKmh = kmh;

    const prevY = this.pos.y;
    this.pos.addScaledVector(this.vel, dt);
    this.grounded = false;

    const eyeRadius = 0.85;
    if (this.pos.y <= 1.7) {
      this.pos.y = 1.7;
      if (this.vel.y < 0) this.vel.y = 0;
      this.grounded = true;
    }

    if (this.pos.y > 95) {
      this.pos.y = 95;
      if (this.vel.y > 0) this.vel.y = 0;
    }

    this.pos.x = THREE.MathUtils.clamp(this.pos.x, -ARENA_HALF + 1, ARENA_HALF - 1);
    this.pos.z = THREE.MathUtils.clamp(this.pos.z, -ARENA_HALF + 1, ARENA_HALF - 1);

    for (const c of this.colliders) {
      if (c.isWall) continue;
      if (
        this.pos.x + eyeRadius > c.minX &&
        this.pos.x - eyeRadius < c.maxX &&
        this.pos.z + eyeRadius > c.minZ &&
        this.pos.z - eyeRadius < c.maxZ &&
        this.pos.y - 1.6 < c.maxY &&
        this.pos.y > c.minY
      ) {
        if (prevY - 1.5 >= c.maxY - 0.8 && this.vel.y <= 0) {
          this.pos.y = c.maxY + 1.6;
          this.vel.y = 0;
          this.grounded = true;
        } else {
          const penX1 = this.pos.x + eyeRadius - c.minX;
          const penX2 = c.maxX - (this.pos.x - eyeRadius);
          const penZ1 = this.pos.z + eyeRadius - c.minZ;
          const penZ2 = c.maxZ - (this.pos.z - eyeRadius);
          const minPen = Math.min(penX1, penX2, penZ1, penZ2);
          if (minPen === penX1) {
            this.pos.x = c.minX - eyeRadius;
            if (this.vel.x > 0) this.vel.x = 0;
          } else if (minPen === penX2) {
            this.pos.x = c.maxX + eyeRadius;
            if (this.vel.x < 0) this.vel.x = 0;
          } else if (minPen === penZ1) {
            this.pos.z = c.minZ - eyeRadius;
            if (this.vel.z > 0) this.vel.z = 0;
          } else {
            this.pos.z = c.maxZ + eyeRadius;
            if (this.vel.z < 0) this.vel.z = 0;
          }
        }
      }
    }

    if (this.grounded && this.gas < this.maxGas) {
      this.gas = Math.min(this.maxGas, this.gas + 4.5 * dt);
    }

    const sideVel = this.vel.dot(_right);
    const targetRoll = THREE.MathUtils.clamp(-sideVel * 0.0045, -0.18, 0.18);
    this.roll = THREE.MathUtils.damp(this.roll, targetRoll, 9, dt);
  }

  private updateTitans(dt: number) {
    const mult = getDifficultyMultipliers(this.difficulty);

    for (const t of this.titans) {
      if (t.dead) continue;

      if (t.dyingTimer > 0) {
        t.dyingTimer -= dt;
        t.group.position.y -= 3.5 * dt;
        t.group.rotation.x += 0.65 * dt;
        if (Math.random() < 0.72) {
          this.spawnBurst(
            t.group.position.x + (Math.random() - 0.5) * 4,
            Math.max(1, t.group.position.y + 5),
            t.group.position.z + (Math.random() - 0.5) * 4,
            1,
            this.steamMat,
            4.5,
            0.85,
            true
          );
        }
        if (t.dyingTimer <= 0) {
          t.dead = true;
          this.scene.remove(t.group);
        }
        continue;
      }

      if (t.blindTimer > 0) {
        t.blindTimer -= dt;
        if (t.blindTimer <= 0) {
          t.eyesGroup.visible = true;
          t.blindXGroup.visible = false;
        }
      }
      if (t.staggerTimer > 0) t.staggerTimer -= dt;
      if (t.attackCooldown > 0) t.attackCooldown -= dt;

      const dx = this.pos.x - t.group.position.x;
      const dz = this.pos.z - t.group.position.z;
      const horizDist = Math.hypot(dx, dz);

      if (t.blindTimer <= 0 && t.staggerTimer <= 0 && !t.grabbingPlayer) {
        const targetYaw = Math.atan2(dx, dz);
        let diff = targetYaw - t.group.rotation.y;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        t.group.rotation.y += diff * Math.min(1, 3.2 * dt);

        const speedByKind: Record<TitanKind, number> = {
          jaw: 17.5,
          female: 15.5,
          cart: 15.0,
          attack: 14.5,
          abnormal: 13.5,
          armored: 11.5,
          warhammer: 9.5,
          normal: 7.8,
          beast: 7.2,
          founding: 6.5,
          colossal: 4.2,
        };
        const spd = speedByKind[t.kind] * mult.titanSpeed;
        if (horizDist > (t.kind === 'beast' || t.kind === 'cart' ? 18 : 2.0)) {
          t.vx = (dx / horizDist) * spd;
          t.vz = (dz / horizDist) * spd;
        } else {
          t.vx *= 0.85;
          t.vz *= 0.85;
        }
        t.walkPhase += dt * (t.kind === 'jaw' || t.kind === 'abnormal' || t.kind === 'cart' ? 7.8 : 4.2);

        // Agile Leap for Abnormal, Jaw, Attack, Female
        if (
          (t.kind === 'abnormal' || t.kind === 'jaw' || t.kind === 'attack' || t.kind === 'female') &&
          t.group.position.y <= 0.05
        ) {
          t.leapTimer -= dt;
          if (t.leapTimer <= 0 && horizDist < 38 && this.pos.y > 5) {
            t.vy = t.kind === 'jaw' ? 23 : 20;
            t.leapTimer = (t.kind === 'jaw' ? 2.8 : 4.2) + Math.random() * 2.0;
            soundEngine.playTitanRoar();
          }
        }

        // Nine Titans Signature Combat Abilities
        t.abilityTimer -= dt;
        if (t.abilityTimer <= 0) {
          if (t.kind === 'colossal') {
            t.abilityTimer = 7.0;
            this.spawnBurst(t.group.position.x, 12 * t.scale, t.group.position.z, 18, this.steamMat, 14, 1.1, true);
            if (this.pos.distanceTo(t.group.position) < 26) {
              this.showBanner('초대형 거인 · 초고열 증기 방출!');
              _v2.copy(this.pos).sub(t.group.position).normalize();
              this.vel.addScaledVector(_v2, 26);
              if (this.invulnTimer <= 0) {
                this.hp -= 12 * mult.damageTaken;
                this.invulnTimer = 0.8;
                soundEngine.playDamage();
              }
            }
          } else if (t.kind === 'beast' && horizDist < 110) {
            t.abilityTimer = 5.5;
            this.showBanner('짐승의 거인 · 투석 공격!');
            const flightT = Math.max(0.45, Math.min(1.8, horizDist / 52));
            for (const spread of [-4, 0, 4]) {
              const rock = new THREE.Mesh(this.boulderGeo, this.boulderMat);
              rock.position.set(t.group.position.x, 11 * t.scale, t.group.position.z);
              this.scene.add(rock);
              this.hazards.push({
                mesh: rock,
                vx: (this.pos.x + spread - rock.position.x) / flightT,
                vy: (this.pos.y - rock.position.y) / flightT + 0.5 * GRAVITY * flightT,
                vz: (this.pos.z + spread - rock.position.z) / flightT,
                life: 3.2,
                radius: 2.0,
                damage: 18 * mult.damageTaken,
                gravity: true,
                label: '짐승의 거인의 투석에 적중했습니다.',
              });
            }
          } else if (t.kind === 'warhammer' && horizDist < 85) {
            t.abilityTimer = 5.2;
            this.showBanner('전퇴의 거인 · 경질화 가시!');
            const spike = new THREE.Mesh(this.spikeGeo, this.spikeMat);
            spike.position.set(this.pos.x, -4, this.pos.z);
            this.scene.add(spike);
            this.hazards.push({
              mesh: spike,
              vx: 0,
              vy: 28,
              vz: 0,
              life: 1.4,
              radius: 2.3,
              damage: 16 * mult.damageTaken,
              gravity: true,
              label: '전퇴의 거인의 경질화 가시에 관통당했습니다.',
            });
          } else if (t.kind === 'cart' && horizDist < 95) {
            t.abilityTimer = 3.2;
            const shot = new THREE.Mesh(this.bulletGeo, this.bulletMat);
            shot.position.set(t.group.position.x, 4.2 * t.scale, t.group.position.z);
            this.scene.add(shot);
            _v2.copy(this.pos).sub(shot.position).normalize();
            this.hazards.push({
              mesh: shot,
              vx: _v2.x * 68,
              vy: _v2.y * 68,
              vz: _v2.z * 68,
              life: 2.2,
              radius: 1.3,
              damage: 10 * mult.damageTaken,
              gravity: false,
              label: '차력 거인 포탑 사격에 피격당했습니다.',
            });
          } else if (t.kind === 'founding') {
            t.abilityTimer = 6.5;
            this.spawnBurst(t.group.position.x, 12, t.group.position.z, 14, this.flareMat, 12, 0.9, true);
            if (this.pos.distanceTo(t.group.position) < 28) {
              this.showBanner('시조의 거인 · 좌표 충격파!');
              _v2.copy(this.pos).sub(t.group.position).normalize();
              this.vel.addScaledVector(_v2, 22);
            }
          } else {
            t.abilityTimer = 5.0;
          }
        }
      } else {
        t.vx *= 0.85;
        t.vz *= 0.85;
      }

      t.vy -= GRAVITY * dt;
      t.group.position.x = THREE.MathUtils.clamp(t.group.position.x + t.vx * dt, -ARENA_HALF + 8, ARENA_HALF - 8);
      t.group.position.z = THREE.MathUtils.clamp(t.group.position.z + t.vz * dt, -ARENA_HALF + 8, ARENA_HALF - 8);
      t.group.position.y += t.vy * dt;
      if (t.group.position.y < 0) {
        t.group.position.y = 0;
        t.vy = 0;
      }

      const legSwing = Math.sin(t.walkPhase) * 0.55;
      t.leftLegPivot.rotation.x = legSwing;
      t.rightLegPivot.rotation.x = -legSwing;

      // Authentic Attack on Titan Stance & Body Posture
      if (t.kind === 'jaw') {
        t.bodyPivot.rotation.x = 0.28;
      } else if (t.kind === 'beast') {
        t.bodyPivot.rotation.x = 0.14;
      } else if (t.kind === 'armored' && horizDist < 28) {
        t.bodyPivot.rotation.x = 0.24;
      } else {
        t.bodyPivot.rotation.x = Math.sin(t.walkPhase * 2) * 0.03;
      }

      if (t.kind === 'colossal' && Math.random() < 0.18) {
        this.spawnBurst(t.group.position.x, 10 * t.scale, t.group.position.z, 1, this.steamMat, 3.2, 0.9, true);
      }

      if (t.kind === 'cart') {
        t.leftArmPivot.rotation.x = -legSwing;
        t.rightArmPivot.rotation.x = legSwing;
      } else if (t.blindTimer > 0) {
        t.leftArmPivot.rotation.x = -2.2 + Math.sin(t.walkPhase * 3) * 0.3;
        t.rightArmPivot.rotation.x = -2.2 - Math.sin(t.walkPhase * 3) * 0.3;
      } else if (t.kind === 'warhammer') {
        t.leftArmPivot.rotation.x = -0.35 + Math.sin(t.walkPhase) * 0.2;
        t.rightArmPivot.rotation.x = horizDist < 24 ? -1.35 + Math.sin(t.walkPhase * 2) * 0.35 : -0.65;
      } else if (t.kind === 'female') {
        // Annie's Muay Thai / Martial Arts Boxing Guard Stance
        t.leftArmPivot.rotation.x = horizDist < 24 ? -1.45 : -0.95 + Math.sin(t.walkPhase) * 0.2;
        t.rightArmPivot.rotation.x = horizDist < 24 ? -1.25 : -0.85 - Math.sin(t.walkPhase) * 0.2;
      } else {
        const reachAngle = horizDist < 22 ? -1.45 : -0.4 + Math.sin(t.walkPhase) * 0.25;
        t.leftArmPivot.rotation.x = reachAngle;
        t.rightArmPivot.rotation.x = reachAngle - 0.15;
      }

      if (
        this.grabbedByTitanId === null &&
        this.invulnTimer <= 0 &&
        this.slashTimer <= 0 &&
        t.blindTimer <= 0 &&
        t.staggerTimer <= 0 &&
        t.attackCooldown <= 0
      ) {
        t.handTarget.getWorldPosition(_v1);
        const grabR = Math.max(1.15, t.scale) * 2.7;
        if (this.pos.distanceTo(_v1) < grabR) {
          this.grabbedByTitanId = t.id;
          this.escapeProgress = 0;
          this.releaseHook(this.leftHook);
          this.releaseHook(this.rightHook);
          t.grabbingPlayer = true;
          this.hp -= 16 * mult.damageTaken;
          soundEngine.playDamage();
          this.triggerShake(0.45, 0.2);

          if (this.hp <= 0) {
            this.triggerGameOver(`${TITAN_LABELS[t.kind]}에게 포획되어 전사했습니다.`);
          }
        }
      }
    }
  }

  private updateHazards(dt: number) {
    for (let i = this.hazards.length - 1; i >= 0; i--) {
      const hz = this.hazards[i];
      hz.life -= dt;
      if (hz.gravity) hz.vy -= GRAVITY * dt;
      hz.mesh.position.x += hz.vx * dt;
      hz.mesh.position.y += hz.vy * dt;
      hz.mesh.position.z += hz.vz * dt;

      if (this.invulnTimer <= 0 && this.pos.distanceTo(hz.mesh.position) <= hz.radius + 0.9) {
        this.hp -= hz.damage;
        this.invulnTimer = 0.85;
        soundEngine.playDamage();
        this.triggerShake(0.45, 0.2);
        this.spawnBurst(hz.mesh.position.x, hz.mesh.position.y, hz.mesh.position.z, 8, this.sparkMat, 9, 0.3);
        this.scene.remove(hz.mesh);
        this.hazards.splice(i, 1);
        if (this.hp <= 0) {
          this.triggerGameOver(hz.label);
        }
        continue;
      }

      if (hz.life <= 0 || hz.mesh.position.y < -8) {
        this.scene.remove(hz.mesh);
        this.hazards.splice(i, 1);
      }
    }
  }

  private updateSupplies(dt: number) {
    for (const s of this.supplies) {
      if (s.cooldown > 0) {
        s.cooldown = Math.max(0, s.cooldown - dt);
        s.mesh.scale.y = 0.7;
        continue;
      }
      s.mesh.scale.y = 1.0;
      const dist = Math.hypot(this.pos.x - s.x, this.pos.z - s.z);
      if (dist < 4.5 && this.pos.y < s.y + 5.0) {
        if (
          this.gas < 95 ||
          this.spareBlades < this.maxSpareBlades ||
          this.bladeDurability < 95 ||
          this.hp < this.maxHp
        ) {
          this.gas = this.maxGas;
          this.spareBlades = this.maxSpareBlades;
          this.bladeDurability = this.maxBladeDurability;
          this.hp = Math.min(this.maxHp, this.hp + 35);
          s.cooldown = 12;
          soundEngine.playSupply();
          this.showBanner('가스 · 칼날 완전 보급! (체력 +35)');
        }
      }
    }
  }

  private updateParticles(dt: number) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const pt = this.particles[i];
      pt.life -= dt;
      if (pt.life <= 0) {
        this.scene.remove(pt.mesh);
        this.particles.splice(i, 1);
        continue;
      }
      if (pt.gravity) pt.vy -= 18 * dt;
      pt.mesh.position.x += pt.vx * dt;
      pt.mesh.position.y += pt.vy * dt;
      pt.mesh.position.z += pt.vz * dt;
      if (pt.grow > 0) {
        pt.mesh.scale.addScalar(pt.grow * dt);
      }
    }
  }

  private updateLightning(dt: number) {
    for (let i = this.lightnings.length - 1; i >= 0; i--) {
      const lx = this.lightnings[i];
      lx.life -= dt;
      if (lx.life <= 0) {
        this.scene.remove(lx.group);
        this.scene.remove(lx.ring);
        lx.boltMat.dispose();
        lx.ringMat.dispose();
        this.lightnings.splice(i, 1);
        continue;
      }
      const p = lx.life / lx.maxLife;
      lx.boltMat.opacity = p * 0.95;
      lx.ringMat.opacity = p * 0.85;
      const scale = 1 + (1 - p) * 14;
      lx.ring.scale.set(scale, scale, 1);
    }
  }

  private updateAtmosphere(dt: number) {
    if (!this.ambientPoints || !this.ambientBaseY) return;
    const posAttr = this.ambientPoints.geometry.attributes.position as THREE.BufferAttribute;
    const arr = posAttr.array as Float32Array;
    const isRumbling = this.districtId === 'paradis_rumbling';
    for (let i = 0; i < this.ambientBaseY.length; i++) {
      const idx = i * 3 + 1;
      arr[idx] += (isRumbling ? 4.2 : 1.0) * dt;
      if (arr[idx] > 62) {
        arr[idx] = 2;
      }
      arr[i * 3] += Math.sin(this.elapsed * 0.6 + i) * 0.45 * dt;
    }
    posAttr.needsUpdate = true;
  }

  private updateCameraAndRig(dt: number) {
    const speed = this.vel.length();

    const targetFov = THREE.MathUtils.clamp(78 + (speed / 48) * 22, 78, 100);
    this.camera.fov = THREE.MathUtils.damp(this.camera.fov, targetFov, 7, dt);
    this.camera.updateProjectionMatrix();

    _euler.set(this.pitch, this.yaw, this.roll, 'YXZ');
    this.camera.quaternion.setFromEuler(_euler);

    if (this.thirdPerson) {
      this.scoutAvatar.root.visible = true;
      this.scoutAvatar.root.position.set(this.pos.x, this.pos.y - 1.5, this.pos.z);
      this.scoutAvatar.root.rotation.y = this.yaw;

      const horizSpeed = Math.hypot(this.vel.x, this.vel.z);
      this.scoutAvatar.cape.rotation.x = 0.22 + Math.min(0.85, horizSpeed * 0.025) + Math.sin(this.elapsed * 14) * 0.06;
      const armSwing = this.slashTimer > 0 ? -1.4 : -0.15;
      this.scoutAvatar.leftArm.rotation.x = armSwing;
      this.scoutAvatar.rightArm.rotation.x = armSwing;
      if (this.grounded && horizSpeed > 1.0) {
        this.stridePhase += dt * Math.min(18, horizSpeed * 0.9);
        const legRot = Math.sin(this.stridePhase) * 0.55;
        this.scoutAvatar.leftLeg.rotation.x = legRot;
        this.scoutAvatar.rightLeg.rotation.x = -legRot;
      } else {
        this.scoutAvatar.leftLeg.rotation.x = -0.25;
        this.scoutAvatar.rightLeg.rotation.x = 0.25;
      }

      _forward.set(0, 0, -1).applyEuler(_euler).normalize();
      this.camera.position.copy(this.pos).addScaledVector(_forward, -5.5);
      this.camera.position.y += 1.3;
    } else {
      this.scoutAvatar.root.visible = false;
      this.camera.position.copy(this.pos);
    }

    if (this.shakeTimer > 0) {
      this.camera.position.x += (Math.random() - 0.5) * this.shakeMag;
      this.camera.position.y += (Math.random() - 0.5) * this.shakeMag;
    }

    const updateWireMesh = (hook: HookState, side: -1 | 1) => {
      if (!hook.active) return;
      _right.set(1, 0, 0).applyAxisAngle(_v3.set(0, 1, 0), this.yaw);
      _v1.copy(this.pos).addScaledVector(_right, side * 0.48);
      _v1.y -= 0.48;

      const dist = _v1.distanceTo(hook.anchor);
      if (dist < 0.2) return;

      _v2.copy(hook.anchor).sub(_v1).divideScalar(dist);
      _quat.setFromUnitVectors(_upAxis, _v2);

      hook.wireMesh.position.copy(_v1).add(hook.anchor).multiplyScalar(0.5);
      hook.wireMesh.quaternion.copy(_quat);
      hook.wireMesh.scale.set(1, dist, 1);

      hook.anchorDart.position.copy(hook.anchor);
      hook.anchorDart.quaternion.copy(_quat);
    };
    updateWireMesh(this.leftHook, -1);
    updateWireMesh(this.rightHook, 1);

    this.fpRig.update(
      dt,
      speed,
      this.slashTimer,
      this.isSpinSlash,
      this.reloadTimer,
      this.bladeDurability,
      !this.thirdPerson
    );
  }

  private renderFrame() {
    if (this.composer) {
      this.composer.render();
    } else {
      this.renderer.render(this.scene, this.camera);
    }
  }

  private triggerGameOver(reason: string) {
    this.hp = 0;
    this.gameOverReason = reason;
    this.running = false;
    if (document.pointerLockElement === this.renderer.domElement) {
      document.exitPointerLock?.();
    }
    const snap = this.buildHudSnapshot();
    this.onHudUpdate({
      ...snap,
      hookReady: this.hookReady,
      hookDist: this.hookDist,
      pointerLocked: this.pointerLocked,
      thirdPerson: this.thirdPerson,
      combatBanner: this.combatBanner,
      targetTitanName: this.targetTitanName,
      targetTitanHpPct: this.targetTitanHpPct,
    });
    this.onGameOver(snap);
  }

  private buildHudSnapshot(): HudSnapshot {
    const titansRemaining = this.titans.filter((t) => !t.dead && t.dyingTimer <= 0).length;
    const speedKmh = Math.round(this.vel.length() * SPEED_TO_KMH);

    return {
      hp: Math.max(0, Math.round(this.hp)),
      maxHp: this.maxHp,
      gas: Math.round(this.gas),
      maxGas: this.maxGas,
      bladeDurability: Math.round(this.bladeDurability),
      maxBladeDurability: this.maxBladeDurability,
      spareBlades: this.spareBlades,
      maxSpareBlades: this.maxSpareBlades,
      speedKmh,
      score: this.score,
      kills: this.kills,
      combo: this.combo,
      comboTimer: this.comboTimer,
      wave: this.wave,
      titansRemaining,
      waveBannerTimer: this.waveBannerTimer,
      grabbed: this.grabbedByTitanId !== null,
      escapeProgress: Math.round(this.escapeProgress),
      reloading: this.reloadTimer > 0,
      nearSupply: false,
      bestSpeedKmh: this.bestSpeedKmh,
      maxCombo: this.maxCombo,
      muted: soundEngine.isMuted(),
      districtName: DISTRICTS[this.districtId].name,
      gameOverReason: this.gameOverReason,
    };
  }

  private emitHud() {
    this.onHudUpdate({
      ...this.buildHudSnapshot(),
      hookReady: this.hookReady,
      hookDist: this.hookDist,
      pointerLocked: this.pointerLocked,
      thirdPerson: this.thirdPerson,
      combatBanner: this.combatBanner,
      targetTitanName: this.targetTitanName,
      targetTitanHpPct: this.targetTitanHpPct,
    });
  }
}
