import * as THREE from 'three';

export interface ProceduralTextureSet {
  plasterWall: THREE.CanvasTexture;
  plasterBump: THREE.CanvasTexture;
  plasterEmissive: THREE.CanvasTexture;
  roofTile: THREE.CanvasTexture;
  roofBump: THREE.CanvasTexture;
  fortressStone: THREE.CanvasTexture;
  stoneBump: THREE.CanvasTexture;
  cobblestone: THREE.CanvasTexture;
  cobbleBump: THREE.CanvasTexture;
  cobbleRoughness: THREE.CanvasTexture;
  treeBark: THREE.CanvasTexture;
  barkBump: THREE.CanvasTexture;
  brushedSteel: THREE.CanvasTexture;
  titanSkin: THREE.CanvasTexture;
  titanBump: THREE.CanvasTexture;
  titanMuscle: THREE.CanvasTexture;
  titanMuscleBump: THREE.CanvasTexture;
  titanArmorPlate: THREE.CanvasTexture;
  titanArmorBump: THREE.CanvasTexture;
  titanBeastFur: THREE.CanvasTexture;
  titanBeastFurBump: THREE.CanvasTexture;
  wingsEmblem: THREE.CanvasTexture;
  dispose: () => void;
}

function finalizeTexture(
  canvas: HTMLCanvasElement,
  repeatX: number,
  repeatY: number,
  anisotropy: number,
  isColor: boolean = true
): THREE.CanvasTexture {
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeatX, repeatY);
  tex.anisotropy = anisotropy;
  tex.colorSpace = isColor ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  tex.needsUpdate = true;
  return tex;
}

function seededRand(seed: number): () => number {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

export function createProceduralTextures(maxAnisotropy: number): ProceduralTextureSet {
  const aniso = Math.min(8, Math.max(1, maxAnisotropy));
  const rand = seededRand(845);

  // =========================================================================
  // 1. European Timber-Framed Plaster Wall (Color + Bump + Emissive Windows)
  // =========================================================================
  const pSize = 512;
  const plasterCanvas = document.createElement('canvas');
  plasterCanvas.width = pSize;
  plasterCanvas.height = pSize;
  const pCtx = plasterCanvas.getContext('2d')!;

  const plasterBumpCanvas = document.createElement('canvas');
  plasterBumpCanvas.width = pSize;
  plasterBumpCanvas.height = pSize;
  const pbCtx = plasterBumpCanvas.getContext('2d')!;

  const plasterEmissiveCanvas = document.createElement('canvas');
  plasterEmissiveCanvas.width = pSize;
  plasterEmissiveCanvas.height = pSize;
  const peCtx = plasterEmissiveCanvas.getContext('2d')!;

  // Base aged stucco plaster
  pCtx.fillStyle = '#C4B9A7';
  pCtx.fillRect(0, 0, pSize, pSize);
  pbCtx.fillStyle = '#7A7A7A';
  pbCtx.fillRect(0, 0, pSize, pSize);
  peCtx.fillStyle = '#000000';
  peCtx.fillRect(0, 0, pSize, pSize);

  // Stucco weathering & damp streaks
  for (let i = 0; i < 3600; i++) {
    const x = rand() * pSize;
    const y = rand() * pSize;
    const w = 2 + rand() * 5;
    const h = 2 + rand() * 5;
    const dark = rand() > 0.45;
    pCtx.fillStyle = dark ? 'rgba(65, 52, 42, 0.065)' : 'rgba(255, 248, 236, 0.065)';
    pCtx.fillRect(x, y, w, h);
    pbCtx.fillStyle = dark ? 'rgba(90,90,90,0.22)' : 'rgba(155,155,155,0.22)';
    pbCtx.fillRect(x, y, w, h);
  }

  // Dark aged oak timber framing (protruding in bump map)
  const drawBeam = (x: number, y: number, w: number, h: number) => {
    pCtx.fillStyle = '#36261D';
    pCtx.fillRect(x, y, w, h);
    pCtx.fillStyle = '#4B3629';
    pCtx.fillRect(x + 3, y + 3, Math.max(2, w - 6), Math.max(2, h - 6));
    pbCtx.fillStyle = '#E0E0E0';
    pbCtx.fillRect(x, y, w, h);
  };
  drawBeam(0, 0, pSize, 28);
  drawBeam(0, 240, pSize, 26);
  drawBeam(0, pSize - 28, pSize, 28);
  drawBeam(0, 0, 28, pSize);
  drawBeam(240, 0, 26, pSize);
  drawBeam(pSize - 28, 0, 28, pSize);

  // Diagonal timber braces
  const drawDiag = (x1: number, y1: number, x2: number, y2: number) => {
    pCtx.strokeStyle = '#3B2A20';
    pCtx.lineWidth = 20;
    pCtx.beginPath();
    pCtx.moveTo(x1, y1);
    pCtx.lineTo(x2, y2);
    pCtx.stroke();

    pbCtx.strokeStyle = '#D8D8D8';
    pbCtx.lineWidth = 20;
    pbCtx.beginPath();
    pbCtx.moveTo(x1, y1);
    pbCtx.lineTo(x2, y2);
    pbCtx.stroke();
  };
  drawDiag(26, 26, 242, 242);
  drawDiag(pSize - 26, 26, 264, 242);

  // Mullioned European windows with wooden shutters & warm emissive glow
  for (const [wx, wy, lit] of [
    [82, 72, true],
    [332, 72, false],
    [82, 312, false],
    [332, 312, true],
  ] as const) {
    // Frame
    pCtx.fillStyle = '#241913';
    pCtx.fillRect(wx - 8, wy - 8, 108, 132);
    pbCtx.fillStyle = '#FFFFFF';
    pbCtx.fillRect(wx - 8, wy - 8, 108, 132);

    // Side shutters
    pCtx.fillStyle = '#2D3A34';
    pCtx.fillRect(wx - 26, wy - 4, 18, 124);
    pCtx.fillRect(wx + 100, wy - 4, 18, 124);

    // Window pane
    if (lit) {
      const wg = pCtx.createLinearGradient(wx, wy, wx, wy + 116);
      wg.addColorStop(0, '#FDBA4D');
      wg.addColorStop(1, '#D97706');
      pCtx.fillStyle = wg;
    } else {
      pCtx.fillStyle = '#182130';
    }
    pCtx.fillRect(wx, wy, 92, 116);
    pbCtx.fillStyle = '#282828';
    pbCtx.fillRect(wx, wy, 92, 116);

    if (lit) {
      peCtx.fillStyle = '#FFB347';
      peCtx.fillRect(wx + 2, wy + 2, 88, 112);
    }

    // Mullion crossbars
    pCtx.fillStyle = '#241913';
    pCtx.fillRect(wx + 42, wy, 8, 116);
    pCtx.fillRect(wx, wy + 54, 92, 8);
    peCtx.fillStyle = '#000000';
    peCtx.fillRect(wx + 42, wy, 8, 116);
    peCtx.fillRect(wx, wy + 54, 92, 8);
  }

  const plasterWall = finalizeTexture(plasterCanvas, 2, 2, aniso, true);
  const plasterBump = finalizeTexture(plasterBumpCanvas, 2, 2, aniso, false);
  const plasterEmissive = finalizeTexture(plasterEmissiveCanvas, 2, 2, aniso, true);

  // =========================================================================
  // 2. Terracotta / Slate Shingle Roof Tiles (Color + Bump)
  // =========================================================================
  const roofCanvas = document.createElement('canvas');
  roofCanvas.width = 512;
  roofCanvas.height = 512;
  const rCtx = roofCanvas.getContext('2d')!;

  const roofBumpCanvas = document.createElement('canvas');
  roofBumpCanvas.width = 512;
  roofBumpCanvas.height = 512;
  const rbCtx = roofBumpCanvas.getContext('2d')!;

  rCtx.fillStyle = '#6A332B';
  rCtx.fillRect(0, 0, 512, 512);
  rbCtx.fillStyle = '#555555';
  rbCtx.fillRect(0, 0, 512, 512);

  for (let row = 0; row < 20; row++) {
    const y = row * 25.6;
    const offset = (row % 2) * 24;
    for (let col = -1; col < 12; col++) {
      const x = col * 48 + offset;
      const shade = Math.floor(rand() * 24) - 12;
      const rr = 114 + shade;
      const gg = 56 + Math.floor(shade * 0.5);
      const bb = 48 + Math.floor(shade * 0.4);
      rCtx.fillStyle = `rgb(${rr}, ${gg}, ${bb})`;
      rCtx.fillRect(x + 2, y + 1, 44, 22);

      // Highlight top lip & dark overlap shadow
      rCtx.fillStyle = 'rgba(255, 215, 190, 0.14)';
      rCtx.fillRect(x + 2, y + 2, 44, 3);
      rCtx.fillStyle = 'rgba(10, 6, 6, 0.35)';
      rCtx.fillRect(x, y + 22, 48, 4);

      // Bump shingle gradient
      const bg = rbCtx.createLinearGradient(0, y, 0, y + 24);
      bg.addColorStop(0, '#606060');
      bg.addColorStop(0.8, '#DEDEDE');
      bg.addColorStop(1, '#202020');
      rbCtx.fillStyle = bg;
      rbCtx.fillRect(x + 2, y, 44, 25);
    }
  }
  const roofTile = finalizeTexture(roofCanvas, 3, 2, aniso, true);
  const roofBump = finalizeTexture(roofBumpCanvas, 3, 2, aniso, false);

  // =========================================================================
  // 3. Weathered 50m Wall Maria Fortress Stone (Color + Bump)
  // =========================================================================
  const stoneCanvas = document.createElement('canvas');
  stoneCanvas.width = 512;
  stoneCanvas.height = 512;
  const sCtx = stoneCanvas.getContext('2d')!;

  const stoneBumpCanvas = document.createElement('canvas');
  stoneBumpCanvas.width = 512;
  stoneBumpCanvas.height = 512;
  const sbCtx = stoneBumpCanvas.getContext('2d')!;

  sCtx.fillStyle = '#4B5059';
  sCtx.fillRect(0, 0, 512, 512);
  sbCtx.fillStyle = '#252525';
  sbCtx.fillRect(0, 0, 512, 512);

  for (let row = 0; row < 10; row++) {
    const y = row * 51.2;
    const offset = (row % 2) * 48;
    for (let col = -1; col < 6; col++) {
      const x = col * 96 + offset;
      const base = 86 + Math.floor(rand() * 24);
      sCtx.fillStyle = `rgb(${base}, ${base + 2}, ${base + 7})`;
      sCtx.fillRect(x + 3, y + 3, 90, 45);

      // Chisel bevel
      sCtx.fillStyle = 'rgba(255,255,255,0.08)';
      sCtx.fillRect(x + 3, y + 3, 90, 4);
      sCtx.fillStyle = 'rgba(10,14,20,0.42)';
      sCtx.fillRect(x, y + 47, 96, 5);
      sCtx.fillRect(x + 92, y, 4, 52);

      sbCtx.fillStyle = `rgb(${165 + Math.floor(rand() * 55)},${165 + Math.floor(rand() * 55)},${165 + Math.floor(rand() * 55)})`;
      sbCtx.fillRect(x + 4, y + 4, 88, 43);
    }
  }
  // Vertical rain weathering streaks
  for (let i = 0; i < 45; i++) {
    const sx = rand() * 512;
    const sy = rand() * 400;
    const sh = 60 + rand() * 140;
    sCtx.fillStyle = 'rgba(20, 26, 22, 0.14)';
    sCtx.fillRect(sx, sy, 4 + rand() * 6, sh);
  }

  const fortressStone = finalizeTexture(stoneCanvas, 8, 4, aniso, true);
  const stoneBump = finalizeTexture(stoneBumpCanvas, 8, 4, aniso, false);

  // =========================================================================
  // 4. Damp Cobblestone Street (Color + Bump + Roughness)
  // =========================================================================
  const cobbleCanvas = document.createElement('canvas');
  cobbleCanvas.width = 512;
  cobbleCanvas.height = 512;
  const cCtx = cobbleCanvas.getContext('2d')!;

  const cobbleBumpCanvas = document.createElement('canvas');
  cobbleBumpCanvas.width = 512;
  cobbleBumpCanvas.height = 512;
  const cbCtx = cobbleBumpCanvas.getContext('2d')!;

  const cobbleRoughCanvas = document.createElement('canvas');
  cobbleRoughCanvas.width = 512;
  cobbleRoughCanvas.height = 512;
  const crCtx = cobbleRoughCanvas.getContext('2d')!;

  cCtx.fillStyle = '#20242D';
  cCtx.fillRect(0, 0, 512, 512);
  cbCtx.fillStyle = '#262626';
  cbCtx.fillRect(0, 0, 512, 512);
  // Damp mortar seams are smoother (darker in roughness map)
  crCtx.fillStyle = '#4A4A4A';
  crCtx.fillRect(0, 0, 512, 512);

  for (let row = 0; row < 20; row++) {
    const y = row * 25.6;
    const off = (row % 2) * 20;
    for (let col = -1; col < 14; col++) {
      const x = col * 40 + off;
      const v = 54 + Math.floor(rand() * 24);
      const warm = rand() > 0.65 ? 5 : 0;
      cCtx.fillStyle = `rgb(${v + warm}, ${v + 3}, ${v + 8 - warm})`;
      cCtx.beginPath();
      cCtx.roundRect(x + 3, y + 3, 34, 20, 5);
      cCtx.fill();

      cbCtx.fillStyle = `rgb(${180 + Math.floor(rand() * 55)},${180 + Math.floor(rand() * 55)},${180 + Math.floor(rand() * 55)})`;
      cbCtx.beginPath();
      cbCtx.roundRect(x + 3, y + 3, 34, 20, 5);
      cbCtx.fill();

      // Matte stone top, specular damp patches
      const roughVal = rand() > 0.78 ? 110 : 210;
      crCtx.fillStyle = `rgb(${roughVal},${roughVal},${roughVal})`;
      crCtx.beginPath();
      crCtx.roundRect(x + 3, y + 3, 34, 20, 5);
      crCtx.fill();
    }
  }

  const cobblestone = finalizeTexture(cobbleCanvas, 42, 42, aniso, true);
  const cobbleBump = finalizeTexture(cobbleBumpCanvas, 42, 42, aniso, false);
  const cobbleRoughness = finalizeTexture(cobbleRoughCanvas, 42, 42, aniso, false);

  // =========================================================================
  // 5. Giant Forest Tree Bark (Color + Bump)
  // =========================================================================
  const barkCanvas = document.createElement('canvas');
  barkCanvas.width = 256;
  barkCanvas.height = 256;
  const bCtx = barkCanvas.getContext('2d')!;

  const barkBumpCanvas = document.createElement('canvas');
  barkBumpCanvas.width = 256;
  barkBumpCanvas.height = 256;
  const bbCtx = barkBumpCanvas.getContext('2d')!;

  bCtx.fillStyle = '#38281E';
  bCtx.fillRect(0, 0, 256, 256);
  bbCtx.fillStyle = '#505050';
  bbCtx.fillRect(0, 0, 256, 256);

  for (let x = 0; x < 256; x += 6) {
    const ridge = (Math.sin(x * 0.25) + 1) * 0.5;
    bCtx.fillStyle = ridge > 0.5 ? '#4E392C' : '#2A1D15';
    bCtx.fillRect(x, 0, 4, 256);
    const bv = Math.floor(60 + ridge * 175);
    bbCtx.fillStyle = `rgb(${bv},${bv},${bv})`;
    bbCtx.fillRect(x, 0, 4, 256);
  }
  const treeBark = finalizeTexture(barkCanvas, 2, 6, aniso, true);
  const barkBump = finalizeTexture(barkBumpCanvas, 2, 6, aniso, false);

  // =========================================================================
  // 6. Brushed Ultra-Hard Steel (ODM Blades)
  // =========================================================================
  const steelCanvas = document.createElement('canvas');
  steelCanvas.width = 256;
  steelCanvas.height = 256;
  const stCtx = steelCanvas.getContext('2d')!;
  const stGrad = stCtx.createLinearGradient(0, 0, 0, 256);
  stGrad.addColorStop(0, '#F1F5F9');
  stGrad.addColorStop(0.5, '#CBD5E1');
  stGrad.addColorStop(1, '#94A3B8');
  stCtx.fillStyle = stGrad;
  stCtx.fillRect(0, 0, 256, 256);

  for (let y = 0; y < 256; y += 2) {
    stCtx.fillStyle = y % 4 === 0 ? 'rgba(255,255,255,0.22)' : 'rgba(15,23,42,0.1)';
    stCtx.fillRect(0, y, 256, 1);
  }
  // Signature break-away blade segments
  stCtx.fillStyle = 'rgba(15, 23, 42, 0.45)';
  for (let x = 28; x < 256; x += 34) {
    stCtx.fillRect(x, 0, 3, 256);
  }
  const brushedSteel = finalizeTexture(steelCanvas, 1, 1, aniso, true);

  // =========================================================================
  // 7. Titan Skin Muscle Striation (Color + Bump)
  // =========================================================================
  const skinCanvas = document.createElement('canvas');
  skinCanvas.width = 256;
  skinCanvas.height = 256;
  const skCtx = skinCanvas.getContext('2d')!;

  const skinBumpCanvas = document.createElement('canvas');
  skinBumpCanvas.width = 256;
  skinBumpCanvas.height = 256;
  const skbCtx = skinBumpCanvas.getContext('2d')!;

  skCtx.fillStyle = '#D1A088';
  skCtx.fillRect(0, 0, 256, 256);
  skbCtx.fillStyle = '#808080';
  skbCtx.fillRect(0, 0, 256, 256);

  for (let i = 0; i < 64; i++) {
    const y = i * 4.2;
    const isRidge = i % 2 === 0;
    skCtx.strokeStyle = isRidge ? 'rgba(140, 58, 45, 0.22)' : 'rgba(255, 230, 215, 0.14)';
    skCtx.lineWidth = 2.4;
    skCtx.beginPath();
    skCtx.moveTo(0, y);
    skCtx.bezierCurveTo(75, y + 12, 180, y - 12, 256, y);
    skCtx.stroke();

    skbCtx.strokeStyle = isRidge ? 'rgba(40,40,40,0.45)' : 'rgba(235,235,235,0.45)';
    skbCtx.lineWidth = 2.5;
    skbCtx.beginPath();
    skbCtx.moveTo(0, y);
    skbCtx.bezierCurveTo(75, y + 12, 180, y - 12, 256, y);
    skbCtx.stroke();
  }
  const titanSkin = finalizeTexture(skinCanvas, 1, 1, aniso, true);
  const titanBump = finalizeTexture(skinBumpCanvas, 1, 1, aniso, false);

  // =========================================================================
  // 7b. Exposed Titan Muscle & Tendon Fascia (Colossal / Female / Armored Joints)
  // =========================================================================
  const muscleCanvas = document.createElement('canvas');
  muscleCanvas.width = 256;
  muscleCanvas.height = 256;
  const mCtx = muscleCanvas.getContext('2d')!;

  const muscleBumpCanvas = document.createElement('canvas');
  muscleBumpCanvas.width = 256;
  muscleBumpCanvas.height = 256;
  const mbCtx = muscleBumpCanvas.getContext('2d')!;

  mCtx.fillStyle = '#8F1D19';
  mCtx.fillRect(0, 0, 256, 256);
  mbCtx.fillStyle = '#707070';
  mbCtx.fillRect(0, 0, 256, 256);

  for (let i = 0; i < 86; i++) {
    const x = i * 3.1;
    const isFascia = i % 11 === 0;
    mCtx.strokeStyle = isFascia
      ? 'rgba(242, 228, 210, 0.72)'
      : i % 2 === 0
        ? 'rgba(185, 42, 34, 0.75)'
        : 'rgba(84, 12, 12, 0.65)';
    mCtx.lineWidth = isFascia ? 2.6 : 1.9;
    mCtx.beginPath();
    mCtx.moveTo(x, 0);
    mCtx.bezierCurveTo(x + 9, 84, x - 9, 172, x, 256);
    mCtx.stroke();

    mbCtx.strokeStyle = isFascia ? '#F5F5F5' : i % 2 === 0 ? '#D4D4D4' : '#2C2C2C';
    mbCtx.lineWidth = isFascia ? 2.8 : 2.0;
    mbCtx.beginPath();
    mbCtx.moveTo(x, 0);
    mbCtx.bezierCurveTo(x + 9, 84, x - 9, 172, x, 256);
    mbCtx.stroke();
  }
  const titanMuscle = finalizeTexture(muscleCanvas, 1.5, 1.5, aniso, true);
  const titanMuscleBump = finalizeTexture(muscleBumpCanvas, 1.5, 1.5, aniso, false);

  // =========================================================================
  // 7c. Keratinized Bone / Hardened Armor Plate (Armored / Jaw / War Hammer)
  // =========================================================================
  const armorCanvas = document.createElement('canvas');
  armorCanvas.width = 256;
  armorCanvas.height = 256;
  const aCtx = armorCanvas.getContext('2d')!;

  const armorBumpCanvas = document.createElement('canvas');
  armorBumpCanvas.width = 256;
  armorBumpCanvas.height = 256;
  const abCtx = armorBumpCanvas.getContext('2d')!;

  aCtx.fillStyle = '#DCD4C2';
  aCtx.fillRect(0, 0, 256, 256);
  abCtx.fillStyle = '#909090';
  abCtx.fillRect(0, 0, 256, 256);

  for (let i = 0; i < 120; i++) {
    const y = rand() * 256;
    const x = rand() * 256;
    const len = 30 + rand() * 80;
    aCtx.strokeStyle = rand() > 0.5 ? 'rgba(130, 118, 100, 0.28)' : 'rgba(255, 252, 244, 0.32)';
    aCtx.lineWidth = 1.5 + rand() * 2;
    aCtx.beginPath();
    aCtx.moveTo(x, y);
    aCtx.lineTo(x + len, y + (rand() - 0.5) * 14);
    aCtx.stroke();

    abCtx.strokeStyle = rand() > 0.5 ? '#505050' : '#E2E2E2';
    abCtx.lineWidth = 1.5 + rand() * 2;
    abCtx.beginPath();
    abCtx.moveTo(x, y);
    abCtx.lineTo(x + len, y + (rand() - 0.5) * 14);
    abCtx.stroke();
  }
  const titanArmorPlate = finalizeTexture(armorCanvas, 1, 1, aniso, true);
  const titanArmorBump = finalizeTexture(armorBumpCanvas, 1, 1, aniso, false);

  // =========================================================================
  // 7d. Beast Titan Shaggy Ape Fur (Color + Bump)
  // =========================================================================
  const furCanvas = document.createElement('canvas');
  furCanvas.width = 256;
  furCanvas.height = 256;
  const fCtx = furCanvas.getContext('2d')!;

  const furBumpCanvas = document.createElement('canvas');
  furBumpCanvas.width = 256;
  furBumpCanvas.height = 256;
  const fbCtx = furBumpCanvas.getContext('2d')!;

  fCtx.fillStyle = '#3B281E';
  fCtx.fillRect(0, 0, 256, 256);
  fbCtx.fillStyle = '#404040';
  fbCtx.fillRect(0, 0, 256, 256);

  for (let i = 0; i < 900; i++) {
    const fx = rand() * 256;
    const fy = rand() * 256;
    const fl = 12 + rand() * 18;
    const dx = (rand() - 0.5) * 6;
    fCtx.strokeStyle = rand() > 0.4 ? '#523829' : '#261811';
    fCtx.lineWidth = 1.8;
    fCtx.beginPath();
    fCtx.moveTo(fx, fy);
    fCtx.lineTo(fx + dx, fy + fl);
    fCtx.stroke();

    fbCtx.strokeStyle = rand() > 0.5 ? '#E6E6E6' : '#707070';
    fbCtx.lineWidth = 1.8;
    fbCtx.beginPath();
    fbCtx.moveTo(fx, fy);
    fbCtx.lineTo(fx + dx, fy + fl);
    fbCtx.stroke();
  }
  const titanBeastFur = finalizeTexture(furCanvas, 2, 2, aniso, true);
  const titanBeastFurBump = finalizeTexture(furBumpCanvas, 2, 2, aniso, false);

  // =========================================================================
  // 8. Survey Corps "Wings of Freedom" Emblem (자유의 날개)
  // =========================================================================
  const wingCanvas = document.createElement('canvas');
  wingCanvas.width = 256;
  wingCanvas.height = 256;
  const wCtx = wingCanvas.getContext('2d')!;
  wCtx.fillStyle = '#144B34';
  wCtx.fillRect(0, 0, 256, 256);

  // Shield border
  wCtx.strokeStyle = '#94A3B8';
  wCtx.lineWidth = 6;
  wCtx.beginPath();
  wCtx.moveTo(58, 36);
  wCtx.lineTo(198, 36);
  wCtx.lineTo(198, 145);
  wCtx.quadraticCurveTo(198, 206, 128, 228);
  wCtx.quadraticCurveTo(58, 206, 58, 145);
  wCtx.closePath();
  wCtx.fillStyle = '#0F172A';
  wCtx.fill();
  wCtx.stroke();

  // Blue inner wing (left) & White overlapping wing (right)
  const drawWing = (side: -1 | 1, color: string) => {
    wCtx.fillStyle = color;
    for (let f = 0; f < 5; f++) {
      wCtx.beginPath();
      const oy = 62 + f * 22;
      const spread = 58 - f * 7;
      wCtx.moveTo(128, oy + 14);
      wCtx.quadraticCurveTo(128 + side * spread * 0.7, oy - 12, 128 + side * spread, oy - 6);
      wCtx.quadraticCurveTo(128 + side * spread * 0.65, oy + 18, 128, oy + 26);
      wCtx.closePath();
      wCtx.fill();
    }
  };
  drawWing(-1, '#2563EB');
  drawWing(1, '#F8FAFC');

  const wingsEmblem = finalizeTexture(wingCanvas, 1, 1, aniso, true);
  wingsEmblem.wrapS = THREE.ClampToEdgeWrapping;
  wingsEmblem.wrapT = THREE.ClampToEdgeWrapping;

  return {
    plasterWall,
    plasterBump,
    plasterEmissive,
    roofTile,
    roofBump,
    fortressStone,
    stoneBump,
    cobblestone,
    cobbleBump,
    cobbleRoughness,
    treeBark,
    barkBump,
    brushedSteel,
    titanSkin,
    titanBump,
    titanMuscle,
    titanMuscleBump,
    titanArmorPlate,
    titanArmorBump,
    titanBeastFur,
    titanBeastFurBump,
    wingsEmblem,
    dispose: () => {
      plasterWall.dispose();
      plasterBump.dispose();
      plasterEmissive.dispose();
      roofTile.dispose();
      roofBump.dispose();
      fortressStone.dispose();
      stoneBump.dispose();
      cobblestone.dispose();
      cobbleBump.dispose();
      cobbleRoughness.dispose();
      treeBark.dispose();
      barkBump.dispose();
      brushedSteel.dispose();
      titanSkin.dispose();
      titanBump.dispose();
      titanMuscle.dispose();
      titanMuscleBump.dispose();
      titanArmorPlate.dispose();
      titanArmorBump.dispose();
      titanBeastFur.dispose();
      titanBeastFurBump.dispose();
      wingsEmblem.dispose();
    },
  };
}
