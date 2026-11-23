import {
  Building,
  Difficulty,
  DistrictId,
  DistrictMeta,
  StreetLamp,
  SupplyCrate,
  Titan,
  TitanKind,
} from './types';

export const WORLD_WIDTH = 4800;
export const GROUND_Y = 1100;
export const CEILING_Y = -580;

export const TITAN_LABELS: Record<TitanKind, string> = {
  normal: '무지성 거인',
  abnormal: '기행종 거인',
  attack: '진격의 거인',
  colossal: '초대형 거인',
  armored: '갑옷 거인',
  female: '여성형 거인',
  beast: '짐승의 거인',
  jaw: '턱 거인',
  cart: '차력 거인',
  warhammer: '전퇴의 거인',
  founding: '시조의 거인',
};

export const DISTRICTS: Record<DistrictId, DistrictMeta> = {
  shiganshina: {
    id: 'shiganshina',
    name: '월 마리아 · 시간시나 구',
    subtitle: '초대형 · 갑옷 거인 습격',
    featuredTitans: '초대형 · 갑옷 거인',
    description: '초대형 거인이 무너뜨린 50m 방벽, 운하와 아치 돌다리, 시계탑과 가로등이 늘어선 운명의 고향 시가지입니다.',
    skyColors: ['#0B111E', '#1D2636', '#46373B', '#734436'],
    wallLabel: 'WALL MARIA — SHIGANSHINA',
    hasColossalSilhouette: true,
    hasBrokenGate: true,
    hasCannons: true,
    hasBoulder: false,
  },
  trost: {
    id: 'trost',
    name: '월 로제 · 트로스트 구',
    subtitle: '진격의 거인 각성전',
    featuredTitans: '진격의 거인 · 갑옷 거인',
    description: '성벽 고정포대와 봉쇄용 거대 바위가 놓인 최전선 격전지입니다. 진격의 거인이 전장을 질주합니다.',
    skyColors: ['#0D131F', '#1B2538', '#303C4D', '#525763'],
    wallLabel: 'WALL ROSE — TROST',
    hasColossalSilhouette: false,
    hasBrokenGate: true,
    hasCannons: true,
    hasBoulder: true,
  },
  forest: {
    id: 'forest',
    name: '월 마리아 · 거목의 숲',
    subtitle: '여성형 거인 포획전',
    featuredTitans: '여성형 거인 · 기행종',
    description: '50m급 고목 사이를 고속 입체기동으로 누비는 숲입니다. 부분 경질화를 두른 여성형 거인이 추격해옵니다.',
    skyColors: ['#091318', '#13262B', '#233F3C', '#2E4A3E'],
    wallLabel: 'WALL MARIA — GIANT FOREST',
    hasColossalSilhouette: false,
    hasBrokenGate: false,
    hasCannons: false,
    hasBoulder: false,
  },
  utgard: {
    id: 'utgard',
    name: '월 로제 · 우트가르트 성',
    subtitle: '짐승 · 턱 거인 포위전',
    featuredTitans: '짐승 · 턱 거인',
    description: '푸른 달빛 아래 고성 망루를 포위하는 야간 전장입니다. 짐승의 거인의 투석과 턱 거인의 도약에 대비하세요.',
    skyColors: ['#070B17', '#111A30', '#1D2945', '#2E3B59'],
    wallLabel: 'WALL ROSE — UTGARD CASTLE',
    hasColossalSilhouette: false,
    hasBrokenGate: false,
    hasCannons: false,
    hasBoulder: false,
  },
  reiss_chapel: {
    id: 'reiss_chapel',
    name: '레이스 가문 · 수정 동굴',
    subtitle: '시조 · 진격의 거인 결전',
    featuredTitans: '시조 · 진격의 거인',
    description: '청록빛 경질화 수정 기둥이 하늘을 받치는 지하 예배당입니다. 시조의 거인과 진격의 거인이 격돌합니다.',
    skyColors: ['#06121A', '#0C2533', '#154454', '#226B7A'],
    wallLabel: 'REISS CRYSTAL CAVERN',
    hasColossalSilhouette: false,
    hasBrokenGate: false,
    hasCannons: false,
    hasBoulder: false,
  },
  liberio: {
    id: 'liberio',
    name: '마레 · 레벨리오 수용구',
    subtitle: '전퇴 · 차력 · 턱 거인',
    featuredTitans: '전퇴 · 차력 · 턱 거인',
    description: '마레 제국 연설 광장과 야간 서치라이트가 비추는 적진입니다. 전퇴의 거인의 망치와 차력 거인의 포탑을 돌파하세요.',
    skyColors: ['#0E0B18', '#23162D', '#4A2034', '#702E38'],
    wallLabel: 'MARLEY — LIBERIO PLAZA',
    hasColossalSilhouette: false,
    hasBrokenGate: false,
    hasCannons: true,
    hasBoulder: false,
  },
  paradis_rumbling: {
    id: 'paradis_rumbling',
    name: '천지전 · 땅울림 종말',
    subtitle: '아홉 거인 전원 총집결',
    featuredTitans: '아홉 거인 전원 출현',
    description: '시조의 거대한 뼈대 아치와 붉은 잿빛 하늘 아래 아홉 거인 모두가 강림하는 최후의 입체기동 결전장입니다.',
    skyColors: ['#1A0708', '#3B1112', '#6E2219', '#A84122'],
    wallLabel: 'THE RUMBLING — FINAL BATTLE',
    hasColossalSilhouette: true,
    hasBrokenGate: true,
    hasCannons: false,
    hasBoulder: false,
  },
  quinta: {
    id: 'quinta',
    name: '월 마리아 · 퀸타 구',
    subtitle: '서쪽 돌출 구역',
    featuredTitans: '갑옷 · 여성형 거인',
    description: '붉은 황혼 아래 높은 첨탑과 넓은 광장이 펼쳐져 고속 진자 기동에 유리한 서쪽 전선입니다.',
    skyColors: ['#120E1E', '#2A1F33', '#5E2E38', '#854336'],
    wallLabel: 'WALL MARIA — QUINTA',
    hasColossalSilhouette: false,
    hasBrokenGate: true,
    hasCannons: true,
    hasBoulder: false,
  },
};

export function getDistrictWaveRoster(districtId: DistrictId, wave: number): TitanKind[] {
  const NINE: TitanKind[] = [
    'attack',
    'armored',
    'female',
    'beast',
    'jaw',
    'cart',
    'warhammer',
    'colossal',
    'founding',
  ];

  if (districtId === 'paradis_rumbling') {
    // Final battle: ALL 9 Titans appear across waves (starting with 3 Nine Titans right on Wave 1!)
    const startIdx = ((wave - 1) * 3) % NINE.length;
    const roster: TitanKind[] = [
      NINE[startIdx % NINE.length],
      NINE[(startIdx + 1) % NINE.length],
      NINE[(startIdx + 2) % NINE.length],
    ];
    if (wave >= 2) roster.push(NINE[(startIdx + 4) % NINE.length]);
    if (wave >= 3) roster.push('founding', 'colossal');
    const extras = Math.min(4, wave);
    for (let i = 0; i < extras; i++) {
      roster.push(i % 2 === 0 ? 'abnormal' : 'normal');
    }
    return roster;
  }

  const mapSpecials: Record<DistrictId, TitanKind[]> = {
    shiganshina: ['armored', 'colossal', 'jaw'],
    trost: ['attack', 'armored', 'abnormal'],
    forest: ['female', 'abnormal', 'jaw'],
    utgard: ['beast', 'jaw', 'abnormal'],
    reiss_chapel: ['founding', 'attack', 'warhammer'],
    liberio: ['warhammer', 'cart', 'jaw'],
    paradis_rumbling: NINE,
    quinta: ['armored', 'female', 'beast'],
  };

  const specials = mapSpecials[districtId];
  const roster: TitanKind[] = [];
  // Always include signature Nine Titan boss from Wave 1!
  roster.push(specials[0]);
  if (wave >= 2) roster.push(specials[1]);
  if (wave >= 3) roster.push(specials[2]);
  if (wave >= 4) roster.push(NINE[(wave + specials.length) % NINE.length]);

  const pureCount = Math.min(7, 2 + wave);
  for (let i = 0; i < pureCount; i++) {
    roster.push(wave >= 2 && i % 3 === 1 ? 'abnormal' : 'normal');
  }
  return roster;
}

const HOUSE_PALETTES = [
  { main: '#3B3632', roof: '#4E2E2B' },
  { main: '#443E38', roof: '#374151' },
  { main: '#363942', roof: '#5B322C' },
  { main: '#4A433B', roof: '#2E3A46' },
];

const QUINTA_PALETTES = [
  { main: '#473B3A', roof: '#69342D' },
  { main: '#3E3845', roof: '#4C3347' },
  { main: '#4E433E', roof: '#703D2F' },
];

const TITAN_SKIN_TONES = ['#D6A68D', '#C9967D', '#DFB59E', '#BD8A72', '#CE9F86'];
const TITAN_HAIR_COLORS = ['#2A201C', '#3E2C22', '#1B1918', '#523A28', '#222428'];

export function createDistrictWorld(districtId: DistrictId = 'shiganshina'): {
  buildings: Building[];
  supplies: SupplyCrate[];
  lamps: StreetLamp[];
} {
  const buildings: Building[] = [];
  const supplies: SupplyCrate[] = [];
  const lamps: StreetLamp[] = [];
  let idCounter = 1;

  // Left & Right 50m Fortress Walls (Wall Maria / Rose District Gates)
  buildings.push({
    id: idCounter++,
    x: 0,
    y: GROUND_Y - 820,
    width: 190,
    height: 820,
    roofHeight: 38,
    style: 'wall',
    colorMain: '#2A2E37',
    colorRoof: '#1E222A',
    windows: [],
  });

  buildings.push({
    id: idCounter++,
    x: WORLD_WIDTH - 190,
    y: GROUND_Y - 820,
    width: 190,
    height: 820,
    roofHeight: 38,
    style: 'wall',
    colorMain: '#2A2E37',
    colorRoof: '#1E222A',
    windows: [],
  });

  if (districtId === 'forest') {
    // Giant Forest of Wall Maria: 50m massive trees + abandoned ruined watchtowers
    const forestLayout: Array<{ x: number; w: number; h: number; style: 'tree' | 'ruin'; supply?: boolean }> = [
      { x: 280, w: 92, h: 660, style: 'tree' },
      { x: 540, w: 120, h: 580, style: 'tree', supply: true },
      { x: 840, w: 165, h: 210, style: 'ruin' },
      { x: 1150, w: 105, h: 720, style: 'tree' },
      { x: 1470, w: 95, h: 610, style: 'tree' },
      { x: 1790, w: 115, h: 690, style: 'tree' },
      { x: 2150, w: 190, h: 240, style: 'ruin', supply: true },
      { x: 2480, w: 110, h: 740, style: 'tree' },
      { x: 2820, w: 96, h: 630, style: 'tree' },
      { x: 3140, w: 108, h: 700, style: 'tree' },
      { x: 3480, w: 175, h: 220, style: 'ruin' },
      { x: 3810, w: 102, h: 670, style: 'tree', supply: true },
      { x: 4140, w: 112, h: 640, style: 'tree' },
    ];

    forestLayout.forEach((item) => {
      const topY = GROUND_Y - item.h;
      buildings.push({
        id: idCounter++,
        x: item.x,
        y: topY,
        width: item.w,
        height: item.h,
        roofHeight: item.style === 'tree' ? 120 : 28,
        style: item.style,
        colorMain: item.style === 'tree' ? '#3B2B22' : '#33373E',
        colorRoof: item.style === 'tree' ? '#1E3A2A' : '#252930',
        windows: [],
      });

      if (item.supply) {
        supplies.push({
          id: idCounter++,
          x: item.x + item.w / 2,
          y: item.style === 'tree' ? GROUND_Y - 340 : topY,
          cooldown: 0,
          maxCooldown: 11,
        });
      }
    });

    supplies.push({
      id: idCounter++,
      x: WORLD_WIDTH / 2,
      y: GROUND_Y,
      cooldown: 0,
      maxCooldown: 11,
    });

    return { buildings, supplies, lamps };
  }

  // City District Layouts (Shiganshina / Quinta / Trost)
  const layout: Array<{ x: number; w: number; h: number; style: 'house' | 'tower' | 'ruin'; supply?: boolean }> =
    districtId === 'quinta'
      ? [
          { x: 260, w: 190, h: 260, style: 'house' },
          { x: 520, w: 145, h: 430, style: 'tower', supply: true },
          { x: 840, w: 230, h: 220, style: 'house' },
          { x: 1190, w: 165, h: 350, style: 'tower' },
          { x: 1560, w: 210, h: 230, style: 'house' },
          { x: 1920, w: 155, h: 470, style: 'tower', supply: true },
          { x: 2340, w: 250, h: 245, style: 'house' },
          { x: 2740, w: 160, h: 390, style: 'tower' },
          { x: 3090, w: 220, h: 230, style: 'house' },
          { x: 3480, w: 150, h: 440, style: 'tower', supply: true },
          { x: 3820, w: 215, h: 260, style: 'house' },
          { x: 4160, w: 190, h: 320, style: 'house' },
        ]
      : districtId === 'trost'
        ? [
            { x: 270, w: 195, h: 240, style: 'house' },
            { x: 510, w: 155, h: 375, style: 'tower', supply: true },
            { x: 770, w: 210, h: 205, style: 'ruin' },
            { x: 1050, w: 185, h: 295, style: 'house' },
            { x: 1380, w: 150, h: 420, style: 'tower' },
            { x: 1660, w: 235, h: 235, style: 'house', supply: true },
            { x: 1970, w: 180, h: 315, style: 'house' },
            { x: 2310, w: 160, h: 455, style: 'tower' },
            { x: 2620, w: 215, h: 245, style: 'house', supply: true },
            { x: 2940, w: 190, h: 295, style: 'house' },
            { x: 3230, w: 150, h: 395, style: 'tower' },
            { x: 3520, w: 220, h: 215, style: 'ruin' },
            { x: 3860, w: 170, h: 350, style: 'tower', supply: true },
            { x: 4140, w: 220, h: 255, style: 'house' },
          ]
        : // Shiganshina District (Default Wall Maria iconic layout)
          [
            { x: 260, w: 185, h: 250, style: 'house' },
            { x: 485, w: 150, h: 380, style: 'tower', supply: true },
            { x: 740, w: 220, h: 215, style: 'house' },
            { x: 1020, w: 185, h: 295, style: 'house' },
            { x: 1340, w: 145, h: 440, style: 'tower' },
            { x: 1620, w: 235, h: 230, style: 'house' },
            { x: 1910, w: 175, h: 310, style: 'house' },
            { x: 2230, w: 165, h: 485, style: 'tower', supply: true },
            { x: 2450, w: 205, h: 240, style: 'house' },
            { x: 2790, w: 195, h: 290, style: 'house' },
            { x: 3040, w: 150, h: 395, style: 'tower' },
            { x: 3340, w: 225, h: 225, style: 'house' },
            { x: 3630, w: 180, h: 330, style: 'house' },
            { x: 3950, w: 155, h: 410, style: 'tower', supply: true },
            { x: 4150, w: 210, h: 255, style: 'house' },
          ];

  const palettes = districtId === 'quinta' ? QUINTA_PALETTES : HOUSE_PALETTES;

  layout.forEach((item, index) => {
    const palette = palettes[index % palettes.length];
    const roofHeight = item.style === 'tower' ? 98 : item.style === 'ruin' ? 22 : 58;
    const topY = GROUND_Y - item.h;

    const windows: { rx: number; ry: number; lit: boolean }[] = [];
    if (item.style !== 'ruin') {
      const cols = Math.max(2, Math.floor(item.w / 52));
      const rows = Math.max(2, Math.floor(item.h / 72));
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          windows.push({
            rx: 22 + c * ((item.w - 44) / Math.max(1, cols - 1)),
            ry: 34 + r * 62,
            lit: (index + r * 3 + c) % 3 !== 0,
          });
        }
      }
    }

    buildings.push({
      id: idCounter++,
      x: item.x,
      y: topY,
      width: item.w,
      height: item.h,
      roofHeight,
      style: item.style,
      colorMain: item.style === 'tower' ? '#323741' : item.style === 'ruin' ? '#363332' : palette.main,
      colorRoof: item.style === 'tower' ? '#2B3544' : item.style === 'ruin' ? '#262424' : palette.roof,
      windows,
    });

    if (item.supply) {
      supplies.push({
        id: idCounter++,
        x: item.x + item.w / 2,
        y: topY,
        cooldown: 0,
        maxCooldown: 12,
      });
    }
  });

  // Street Gas Lamps (시가지 등불) placed along open street lanes
  for (let lx = 380; lx < WORLD_WIDTH - 360; lx += 340) {
    const blocked = buildings.some((b) => lx >= b.x - 18 && lx <= b.x + b.width + 18);
    if (!blocked) {
      lamps.push({
        x: lx,
        y: GROUND_Y,
        height: 82,
        lit: true,
      });
    }
  }

  // Central Plaza Supply Depot
  supplies.push({
    id: idCounter++,
    x: WORLD_WIDTH / 2,
    y: GROUND_Y,
    cooldown: 0,
    maxCooldown: 12,
  });

  return { buildings, supplies, lamps };
}

export function getDifficultyMultipliers(diff: Difficulty) {
  switch (diff) {
    case 'trainee':
      return { titanSpeed: 0.78, titanHp: 0.75, gasDrain: 0.7, damageTaken: 0.65, scoreMult: 0.85 };
    case 'captain':
      return { titanSpeed: 1.25, titanHp: 1.25, gasDrain: 1.15, damageTaken: 1.35, scoreMult: 1.4 };
    case 'scout':
    default:
      return { titanSpeed: 1.0, titanHp: 1.0, gasDrain: 1.0, damageTaken: 1.0, scoreMult: 1.0 };
  }
}

export function spawnTitanWave(
  wave: number,
  difficulty: Difficulty,
  playerX: number,
  nextIdRef: { current: number }
): Titan[] {
  const mult = getDifficultyMultipliers(difficulty);
  const count = Math.min(12, 2 + wave * 2);
  const titans: Titan[] = [];

  for (let i = 0; i < count; i++) {
    let kind: TitanKind = 'normal';
    if (wave >= 2 && i % 3 === 1) {
      kind = 'abnormal';
    }
    if (wave >= 3 && i === count - 1) {
      kind = 'armored';
    } else if (wave >= 5 && i === count - 2) {
      kind = 'armored';
    }

    const scale =
      kind === 'armored'
        ? 1.75 + Math.random() * 0.15
        : kind === 'abnormal'
          ? 1.15 + Math.random() * 0.35
          : 1.0 + Math.random() * 0.45;

    const baseHp = kind === 'armored' ? 280 : kind === 'abnormal' ? 120 : 100;
    const maxHp = Math.round(baseHp * mult.titanHp * (1 + (wave - 1) * 0.08));

    let spawnX = 350 + Math.random() * (WORLD_WIDTH - 700);
    if (Math.abs(spawnX - playerX) < 520) {
      spawnX =
        playerX < WORLD_WIDTH / 2
          ? playerX + 680 + Math.random() * 500
          : playerX - 680 - Math.random() * 500;
      spawnX = Math.max(300, Math.min(WORLD_WIDTH - 300, spawnX));
    }

    titans.push({
      id: nextIdRef.current++,
      kind,
      x: spawnX,
      y: GROUND_Y,
      vx: 0,
      vy: 0,
      scale,
      facing: spawnX < playerX ? 1 : -1,
      hp: maxHp,
      maxHp,
      blindTimer: 0,
      staggerTimer: 0,
      attackCooldown: 0.8 + Math.random() * 0.9,
      grabbingPlayer: false,
      leapTimer: 2.5 + Math.random() * 3.0,
      walkPhase: Math.random() * Math.PI * 2,
      reachAngle: 0,
      dyingTimer: 0,
      dead: false,
      skinTone:
        kind === 'armored'
          ? '#A85A4B'
          : TITAN_SKIN_TONES[Math.floor(Math.random() * TITAN_SKIN_TONES.length)],
      hairColor:
        kind === 'armored'
          ? '#D4CEC6'
          : TITAN_HAIR_COLORS[Math.floor(Math.random() * TITAN_HAIR_COLORS.length)],
      armorTone: kind === 'armored' ? '#CFC5B4' : undefined,
    });
  }

  return titans;
}

export interface TitanAnatomy {
  totalHeight: number;
  shoulderY: number;
  headX: number;
  headY: number;
  headRadius: number;
  napeX: number;
  napeY: number;
  napeRadius: number;
  eyeX: number;
  eyeY: number;
  eyeRadius: number;
  torsoCenterX: number;
  torsoCenterY: number;
  torsoRadius: number;
  handX: number;
  handY: number;
  handRadius: number;
}

export function getTitanAnatomy(t: Titan): TitanAnatomy {
  const s = t.scale;
  const totalHeight = 175 * s;
  const hipY = t.y - 76 * s;
  const shoulderY = t.y - 140 * s;
  const headRadius = 21 * s;
  const headX = t.x + t.facing * 5 * s;
  const headY = shoulderY - 22 * s;

  const napeX = t.x - t.facing * 18 * s;
  const napeY = shoulderY - 11 * s;
  const napeRadius = 24 * s;

  const eyeX = headX + t.facing * 13 * s;
  const eyeY = headY - 3 * s;
  const eyeRadius = 15 * s;

  const armLen = 72 * s;
  const handX = t.x + t.facing * 12 * s + Math.cos(t.reachAngle) * armLen;
  const handY = shoulderY + 10 * s + Math.sin(t.reachAngle) * armLen;

  return {
    totalHeight,
    shoulderY,
    headX,
    headY,
    headRadius,
    napeX,
    napeY,
    napeRadius,
    eyeX,
    eyeY,
    eyeRadius,
    torsoCenterX: t.x,
    torsoCenterY: (hipY + shoulderY) / 2,
    torsoRadius: 38 * s,
    handX,
    handY,
    handRadius: 20 * s,
  };
}
