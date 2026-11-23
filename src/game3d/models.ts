import * as THREE from 'three';
import { TitanKind } from '../game/types';
import { ProceduralTextureSet } from './textures';

export interface BuildingCollider {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  minZ: number;
  maxZ: number;
  isWall?: boolean;
}

function createGableRoofGeometry(width: number, height: number, depth: number): THREE.ExtrudeGeometry {
  const shape = new THREE.Shape();
  const hw = width / 2 + 0.85;
  shape.moveTo(-hw, 0);
  shape.lineTo(0, height);
  shape.lineTo(hw, 0);
  shape.closePath();

  const extrude = new THREE.ExtrudeGeometry(shape, {
    depth: depth + 1.4,
    bevelEnabled: true,
    bevelThickness: 0.18,
    bevelSize: 0.15,
    bevelSegments: 1,
  });
  extrude.translate(0, 0, -(depth + 1.4) / 2);
  return extrude;
}

export function createBuilding3D(
  x: number,
  z: number,
  w: number,
  h: number,
  d: number,
  style: 'house' | 'tower' | 'tree' | 'ruin',
  textures: ProceduralTextureSet,
  castShadow: boolean
): { group: THREE.Group; collider: BuildingCollider } {
  const group = new THREE.Group();
  group.position.set(x, 0, z);

  if (style === 'tree') {
    // 50m Giant Forest Tree: Flared Buttress Roots + Textured Trunk + Boughs + 3-Tier Canopy
    const barkMat = new THREE.MeshStandardMaterial({
      map: textures.treeBark,
      bumpMap: textures.barkBump,
      bumpScale: 0.35,
      roughness: 0.92,
      metalness: 0.02,
    });
    const leafMat = new THREE.MeshStandardMaterial({
      color: 0x1b3b27,
      roughness: 0.85,
      metalness: 0.0,
    });
    const leafDarkMat = new THREE.MeshStandardMaterial({
      color: 0x132a1d,
      roughness: 0.9,
    });

    const radius = w * 0.5;

    // 6 Radiating Buttress Roots
    for (let r = 0; r < 6; r++) {
      const ang = (r / 6) * Math.PI * 2;
      const root = new THREE.Mesh(new THREE.ConeGeometry(radius * 0.65, 6.5, 6), barkMat);
      root.position.set(Math.cos(ang) * radius * 0.85, 2.2, Math.sin(ang) * radius * 0.85);
      root.rotation.z = -Math.cos(ang) * 0.45;
      root.rotation.x = Math.sin(ang) * 0.45;
      root.castShadow = castShadow;
      root.receiveShadow = true;
      group.add(root);
    }

    // Main Massive Trunk
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(radius * 0.72, radius * 1.05, h, 12), barkMat);
    trunk.position.y = h / 2;
    trunk.castShadow = castShadow;
    trunk.receiveShadow = true;
    group.add(trunk);

    // Radiating thick horizontal limbs
    for (let i = 0; i < 6; i++) {
      const ang = (i / 6) * Math.PI * 2 + x * 0.13;
      const branch = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.95, radius * 3.8, 7), barkMat);
      branch.position.set(Math.cos(ang) * radius * 1.45, h * (0.52 + (i % 3) * 0.11), Math.sin(ang) * radius * 1.45);
      branch.rotation.z = Math.PI / 2 - 0.22;
      branch.rotation.y = -ang;
      branch.castShadow = castShadow;
      group.add(branch);
    }

    // Layered Giant Canopy Crowns
    const crown1 = new THREE.Mesh(new THREE.DodecahedronGeometry(radius * 3.5, 1), leafMat);
    crown1.position.y = h + radius * 0.85;
    crown1.scale.set(1.25, 0.72, 1.25);
    crown1.castShadow = castShadow;
    group.add(crown1);

    const crown2 = new THREE.Mesh(new THREE.DodecahedronGeometry(radius * 2.6, 1), leafDarkMat);
    crown2.position.set(radius * 1.4, h - 1.4, radius * 0.9);
    crown2.scale.set(1.15, 0.62, 1.15);
    group.add(crown2);

    const crown3 = new THREE.Mesh(new THREE.DodecahedronGeometry(radius * 2.4, 1), leafMat);
    crown3.position.set(-radius * 1.3, h - 0.8, -radius * 1.1);
    crown3.scale.set(1.1, 0.65, 1.1);
    group.add(crown3);

    return {
      group,
      collider: {
        minX: x - radius * 0.95,
        maxX: x + radius * 0.95,
        minY: 0,
        maxY: h,
        minZ: z - radius * 0.95,
        maxZ: z + radius * 0.95,
      },
    };
  }

  const wallMat = new THREE.MeshStandardMaterial({
    map: textures.plasterWall,
    bumpMap: textures.plasterBump,
    bumpScale: 0.18,
    emissive: 0xffffff,
    emissiveMap: textures.plasterEmissive,
    emissiveIntensity: 1.35,
    roughness: 0.85,
    metalness: 0.03,
  });
  const stoneMat = new THREE.MeshStandardMaterial({
    map: textures.fortressStone,
    bumpMap: textures.stoneBump,
    bumpScale: 0.24,
    color: 0x707682,
    roughness: 0.88,
    metalness: 0.06,
  });
  const roofMat = new THREE.MeshStandardMaterial({
    map: textures.roofTile,
    bumpMap: textures.roofBump,
    bumpScale: 0.28,
    color: style === 'tower' ? 0x3b4d66 : 0xa34b3f,
    roughness: 0.68,
    metalness: 0.08,
  });
  const timberMat = new THREE.MeshStandardMaterial({
    color: 0x2f2018,
    roughness: 0.86,
    metalness: 0.05,
  });

  // 1. Heavy Cut-Stone Foundation Plinth
  const plinthH = Math.min(2.6, h * 0.19);
  const plinth = new THREE.Mesh(new THREE.BoxGeometry(w + 0.55, plinthH, d + 0.55), stoneMat);
  plinth.position.y = plinthH / 2;
  plinth.castShadow = castShadow;
  plinth.receiveShadow = true;
  group.add(plinth);

  // 2. Timber-Framed Facade Body with glowing windows
  const bodyH = h - plinthH;
  const body = new THREE.Mesh(new THREE.BoxGeometry(w, bodyH, d), wallMat);
  body.position.y = plinthH + bodyH / 2;
  body.castShadow = castShadow;
  body.receiveShadow = true;
  group.add(body);

  // 3. Corner Wooden Timber Pillars & Story Belt Cornice
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.46, bodyH + 0.2, 0.46), timberMat);
      post.position.set(sx * (w / 2), plinthH + bodyH / 2, sz * (d / 2));
      group.add(post);
    }
  }

  const cornice = new THREE.Mesh(new THREE.BoxGeometry(w + 0.75, 0.55, d + 0.75), timberMat);
  cornice.position.y = h;
  group.add(cornice);

  // Mid-level projecting timber belt
  if (h > 10) {
    const belt = new THREE.Mesh(new THREE.BoxGeometry(w + 0.35, 0.4, d + 0.35), timberMat);
    belt.position.y = plinthH + bodyH * 0.48;
    group.add(belt);
  }

  if (style === 'ruin') {
    for (let i = 0; i < 5; i++) {
      const shard = new THREE.Mesh(new THREE.BoxGeometry(w * 0.25, 2.4 + (i % 2) * 1.8, d * 0.24), stoneMat);
      shard.position.set((i - 2) * (w * 0.18), h + 0.9, (i % 2 === 0 ? 1 : -1) * d * 0.3);
      shard.rotation.z = (i % 2 === 0 ? 1 : -1) * 0.08;
      group.add(shard);
    }
  } else if (style === 'tower') {
    // Upper Belfry Observation Gallery + Tall Spire + Brass Clockfaces
    const belfry = new THREE.Mesh(new THREE.BoxGeometry(w * 0.84, 3.2, d * 0.84), stoneMat);
    belfry.position.y = h + 1.6;
    belfry.castShadow = castShadow;
    group.add(belfry);

    const spireH = Math.min(12.5, w * 1.15);
    const spire = new THREE.Mesh(new THREE.ConeGeometry(Math.max(w, d) * 0.72, spireH, 4), roofMat);
    spire.position.y = h + 3.2 + spireH / 2;
    spire.rotation.y = Math.PI / 4;
    spire.castShadow = castShadow;
    group.add(spire);

    // Finial Spike
    const finial = new THREE.Mesh(
      new THREE.CylinderGeometry(0.06, 0.22, 3.0, 6),
      new THREE.MeshStandardMaterial({ color: 0xcbd5e1, metalness: 0.85, roughness: 0.25 })
    );
    finial.position.y = h + 3.2 + spireH + 1.4;
    group.add(finial);

    // Illuminated Clock Faces (front & back)
    const clockRimMat = new THREE.MeshStandardMaterial({ color: 0x92400e, metalness: 0.7, roughness: 0.3 });
    const clockGlowMat = new THREE.MeshStandardMaterial({
      color: 0xfef3c7,
      emissive: 0xf59e0b,
      emissiveIntensity: 1.4,
      roughness: 0.3,
    });
    for (const cz of [d / 2 + 0.12, -d / 2 - 0.12]) {
      const rim = new THREE.Mesh(new THREE.CylinderGeometry(1.55, 1.55, 0.26, 20), clockRimMat);
      rim.rotation.x = Math.PI / 2;
      rim.position.set(0, h - 2.6, cz);
      group.add(rim);

      const face = new THREE.Mesh(new THREE.CylinderGeometry(1.28, 1.28, 0.32, 20), clockGlowMat);
      face.rotation.x = Math.PI / 2;
      face.position.set(0, h - 2.6, cz);
      group.add(face);
    }
  } else {
    // True Shiganshina Extruded Pitched Gable Roof + Chimney + Dormer
    const roofH = Math.min(6.4, w * 0.44);
    const rotateRoof = w > d;
    const roofSpanW = rotateRoof ? d : w;
    const roofSpanD = rotateRoof ? w : d;

    const gableGeo = createGableRoofGeometry(roofSpanW, roofH, roofSpanD);
    const roofMesh = new THREE.Mesh(gableGeo, roofMat);
    roofMesh.position.y = h + 0.15;
    if (rotateRoof) roofMesh.rotation.y = Math.PI / 2;
    roofMesh.castShadow = castShadow;
    roofMesh.receiveShadow = true;
    group.add(roofMesh);

    // Stone Chimney with Cap
    const chimney = new THREE.Mesh(new THREE.BoxGeometry(1.15, roofH * 1.05, 1.15), stoneMat);
    chimney.position.set(w * 0.25, h + roofH * 0.55, -d * 0.18);
    chimney.castShadow = castShadow;
    group.add(chimney);

    const chimCap = new THREE.Mesh(new THREE.BoxGeometry(1.45, 0.3, 1.45), stoneMat);
    chimCap.position.set(w * 0.25, h + roofH * 1.1, -d * 0.18);
    group.add(chimCap);

    // Roof Dormer Window
    const dormer = new THREE.Mesh(new THREE.BoxGeometry(2.3, 1.8, 2.0), wallMat);
    dormer.position.set(0, h + roofH * 0.42, (d / 2) * 0.62);
    group.add(dormer);
  }

  return {
    group,
    collider: {
      minX: x - w / 2,
      maxX: x + w / 2,
      minY: 0,
      maxY: h,
      minZ: z - d / 2,
      maxZ: z + d / 2,
    },
  };
}

export function createCanalAndBridges(
  textures: ProceduralTextureSet,
  castShadow: boolean
): { group: THREE.Group; colliders: BuildingCollider[] } {
  const group = new THREE.Group();
  const colliders: BuildingCollider[] = [];

  const stoneMat = new THREE.MeshStandardMaterial({
    map: textures.fortressStone,
    bumpMap: textures.stoneBump,
    bumpScale: 0.22,
    color: 0x626873,
    roughness: 0.88,
  });

  const waterMat = new THREE.MeshPhysicalMaterial({
    color: 0x163847,
    roughness: 0.1,
    metalness: 0.15,
    clearcoat: 1.0,
    clearcoatRoughness: 0.08,
    reflectivity: 0.9,
  });

  // North & South canal stretches (leaving Central Plaza at z = -18..18 solid cobblestone)
  for (const [zStart, zEnd] of [
    [-134, -18],
    [18, 134],
  ] as const) {
    const len = zEnd - zStart;
    const zMid = (zStart + zEnd) / 2;

    const water = new THREE.Mesh(new THREE.PlaneGeometry(11.5, len), waterMat);
    water.rotation.x = -Math.PI / 2;
    water.position.set(0, 0.06, zMid);
    water.receiveShadow = true;
    group.add(water);

    // Left & Right Low Stone Canal Embankments
    for (const sx of [-6.2, 6.2]) {
      const curb = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.45, len), stoneMat);
      curb.position.set(sx, 0.22, zMid);
      curb.receiveShadow = true;
      group.add(curb);
    }
  }

  // Two Iconic Arched Stone Bridges over the North & South Canals (grappleable & high clearance)
  for (const bz of [-64, 64]) {
    const bridge = new THREE.Group();
    bridge.position.set(0, 0, bz);

    // Twin stone arch piers on banks
    for (const sx of [-7.5, 7.5]) {
      const pier = new THREE.Mesh(new THREE.BoxGeometry(3.2, 4.8, 7.2), stoneMat);
      pier.position.set(sx, 2.4, 0);
      pier.castShadow = castShadow;
      pier.receiveShadow = true;
      bridge.add(pier);
    }

    // Elevated Bridge Deck Span
    const deck = new THREE.Mesh(new THREE.BoxGeometry(18.2, 1.3, 7.0), stoneMat);
    deck.position.set(0, 4.4, 0);
    deck.castShadow = castShadow;
    deck.receiveShadow = true;
    bridge.add(deck);

    // Side Stone Parapets
    for (const sz of [-3.2, 3.2]) {
      const wall = new THREE.Mesh(new THREE.BoxGeometry(18.2, 1.0, 0.55), stoneMat);
      wall.position.set(0, 5.5, sz);
      bridge.add(wall);
    }

    group.add(bridge);
    colliders.push({
      minX: -9.1,
      maxX: 9.1,
      minY: 3.7,
      maxY: 5.1,
      minZ: bz - 3.5,
      maxZ: bz + 3.5,
    });
  }

  return { group, colliders };
}

export function createSurveyBanner3D(
  x: number,
  y: number,
  z: number,
  rotY: number,
  textures: ProceduralTextureSet
): THREE.Group {
  const group = new THREE.Group();
  group.position.set(x, y, z);
  group.rotation.y = rotY;

  const poleMat = new THREE.MeshStandardMaterial({ color: 0x33241c, roughness: 0.75 });
  const clothMat = new THREE.MeshStandardMaterial({
    map: textures.wingsEmblem,
    side: THREE.DoubleSide,
    roughness: 0.85,
  });

  const crossbar = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 4.2, 8), poleMat);
  crossbar.rotation.z = Math.PI / 2;
  group.add(crossbar);

  const banner = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 5.4), clothMat);
  banner.position.set(0, -2.8, 0.12);
  group.add(banner);

  return group;
}

export function createSupplyWagon3D(x: number, z: number, rotY: number): THREE.Group {
  const group = new THREE.Group();
  group.position.set(x, 0, z);
  group.rotation.y = rotY;

  const woodMat = new THREE.MeshStandardMaterial({ color: 0x4c3526, roughness: 0.88 });
  const tarpMat = new THREE.MeshStandardMaterial({ color: 0x9c8e78, roughness: 0.9 });

  const bed = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.8, 4.2), woodMat);
  bed.position.y = 1.0;
  group.add(bed);

  const cover = new THREE.Mesh(
    new THREE.CylinderGeometry(1.25, 1.25, 3.9, 10, 1, false, 0, Math.PI),
    tarpMat
  );
  cover.rotation.z = Math.PI / 2;
  cover.rotation.y = Math.PI / 2;
  cover.position.y = 1.45;
  group.add(cover);

  for (const wx of [-1.28, 1.28]) {
    for (const wz of [-1.35, 1.35]) {
      const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.65, 0.65, 0.22, 12), woodMat);
      wheel.rotation.z = Math.PI / 2;
      wheel.position.set(wx, 0.65, wz);
      group.add(wheel);
    }
  }

  return group;
}

export function createStreetLamp3D(x: number, z: number): THREE.Group {
  const group = new THREE.Group();
  group.position.set(x, 0, z);

  const ironMat = new THREE.MeshStandardMaterial({
    color: 0x1a1e26,
    metalness: 0.82,
    roughness: 0.34,
  });
  const glassMat = new THREE.MeshStandardMaterial({
    color: 0xfef08a,
    emissive: 0xffa629,
    emissiveIntensity: 3.1,
    roughness: 0.15,
  });

  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.48, 1.0, 8), ironMat);
  base.position.y = 0.5;
  group.add(base);

  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.18, 5.4, 8), ironMat);
  pole.position.y = 3.2;
  group.add(pole);

  const bracket = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.12, 0.12), ironMat);
  bracket.position.set(x < 0 ? 0.35 : -0.35, 5.8, 0);
  group.add(bracket);

  const lx = x < 0 ? 0.72 : -0.72;
  const lantern = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.24, 0.85, 6), glassMat);
  lantern.position.set(lx, 5.35, 0);
  group.add(lantern);

  const cap = new THREE.Mesh(new THREE.ConeGeometry(0.48, 0.48, 6), ironMat);
  cap.position.set(lx, 5.98, 0);
  group.add(cap);

  return group;
}

export function createSupplyDepot3D(x: number, y: number, z: number, textures: ProceduralTextureSet): THREE.Group {
  const group = new THREE.Group();
  group.position.set(x, y, z);

  const crateMat = new THREE.MeshStandardMaterial({
    color: 0x166534,
    roughness: 0.72,
    metalness: 0.15,
  });
  const metalMat = new THREE.MeshStandardMaterial({
    map: textures.brushedSteel,
    color: 0xcbd5e1,
    roughness: 0.22,
    metalness: 0.9,
  });
  const emblemMat = new THREE.MeshStandardMaterial({
    map: textures.wingsEmblem,
    roughness: 0.65,
  });
  const beaconMat = new THREE.MeshBasicMaterial({
    color: 0x34d399,
    transparent: true,
    opacity: 0.32,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });

  const crate = new THREE.Mesh(new THREE.BoxGeometry(3.4, 1.9, 2.4), crateMat);
  crate.position.y = 0.95;
  group.add(crate);

  const crest = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 1.4), emblemMat);
  crest.position.set(0, 0.95, 1.22);
  group.add(crest);

  for (const ox of [-0.75, 0.75]) {
    const tank = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 2.0, 12), metalMat);
    tank.rotation.z = Math.PI / 2;
    tank.position.set(ox, 2.15, 0);
    group.add(tank);
  }

  const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.9, 44, 14, 1, true), beaconMat);
  beam.position.y = 22;
  group.add(beam);

  return group;
}

export function createCannon3D(): THREE.Group {
  const group = new THREE.Group();
  const ironMat = new THREE.MeshStandardMaterial({
    color: 0x22262e,
    metalness: 0.88,
    roughness: 0.32,
  });
  const woodMat = new THREE.MeshStandardMaterial({
    color: 0x452d20,
    roughness: 0.85,
  });

  const carriage = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.1, 2.8), woodMat);
  carriage.position.y = 0.75;
  group.add(carriage);

  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.54, 4.6, 14), ironMat);
  barrel.rotation.x = Math.PI / 2 - 0.14;
  barrel.position.set(0, 1.58, 0.9);
  group.add(barrel);

  const muzzle = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.09, 8, 16), ironMat);
  muzzle.position.set(0, 1.9, 3.15);
  group.add(muzzle);

  for (const sx of [-1.25, 1.25]) {
    const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.75, 0.3, 12), woodMat);
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(sx, 0.75, 0);
    group.add(wheel);
  }

  return group;
}

export function createColossalTitanBackdrop(
  wallHeight: number,
  textures: ProceduralTextureSet
): THREE.Group {
  const group = new THREE.Group();

  const fleshMat = new THREE.MeshStandardMaterial({
    map: textures.titanMuscle,
    bumpMap: textures.titanMuscleBump,
    bumpScale: 0.65,
    color: 0xa12620,
    roughness: 0.56,
    metalness: 0.05,
  });
  const tendonMat = new THREE.MeshStandardMaterial({
    color: 0xeadbc8,
    roughness: 0.65,
    metalness: 0.04,
  });
  const eyeMat = new THREE.MeshStandardMaterial({
    color: 0xfef3c7,
    emissive: 0xffa822,
    emissiveIntensity: 3.6,
  });
  const teethMat = new THREE.MeshStandardMaterial({
    color: 0xf1ebe0,
    roughness: 0.45,
  });

  // Massive Trapezius & Sternocleidomastoid Neck Columns peering over Wall Maria
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(7.0, 9.8, 11, 18), fleshMat);
  neck.position.set(0, wallHeight - 1.2, -2.2);
  group.add(neck);

  for (const sx of [-1, 1]) {
    const scm = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 2.4, 11.5, 10), tendonMat);
    scm.position.set(sx * 4.2, wallHeight - 0.5, 2.2);
    scm.rotation.z = sx * 0.28;
    scm.rotation.x = 0.22;
    group.add(scm);
  }

  // Broad Shoulders & Upper Collarbones
  const shoulders = new THREE.Mesh(new THREE.BoxGeometry(38, 7.8, 10.5), fleshMat);
  shoulders.position.set(0, wallHeight - 4.4, -3.2);
  group.add(shoulders);

  // Sculpted Skull-Muscle Cranium (Bald, Striated)
  const head = new THREE.Mesh(new THREE.SphereGeometry(8.5, 24, 20), fleshMat);
  head.scale.set(0.84, 1.22, 0.94);
  head.position.set(0, wallHeight + 6.6, 0.6);
  group.add(head);

  // Heavy Furrowed Brow Ridge
  const brow = new THREE.Mesh(new THREE.BoxGeometry(11.8, 2.1, 4.4), fleshMat);
  brow.position.set(0, wallHeight + 9.4, 5.9);
  brow.rotation.x = 0.14;
  group.add(brow);

  // Exposed Nasal Cavity + Cheek Muscle Striations
  const noseHole = new THREE.Mesh(
    new THREE.ConeGeometry(1.15, 2.6, 3),
    new THREE.MeshBasicMaterial({ color: 0x1a0606 })
  );
  noseHole.position.set(0, wallHeight + 5.6, 8.2);
  group.add(noseHole);

  // Iconic Vertical Jaw Tendon Columns & Lipless Teeth Grin
  for (const tx of [-4.1, -2.7, 2.7, 4.1]) {
    const tendon = new THREE.Mesh(new THREE.CylinderGeometry(0.65, 0.95, 6.2, 8), tendonMat);
    tendon.position.set(tx, wallHeight + 1.8, 5.8);
    tendon.rotation.z = tx < 0 ? -0.14 : 0.14;
    group.add(tendon);
  }
  const mouthVoid = new THREE.Mesh(
    new THREE.BoxGeometry(6.8, 2.8, 2.2),
    new THREE.MeshBasicMaterial({ color: 0x1a0505 })
  );
  mouthVoid.position.set(0, wallHeight + 2.1, 6.6);
  group.add(mouthVoid);

  for (let ti = -4; ti <= 4; ti++) {
    const tTop = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.95, 0.65), teethMat);
    tTop.position.set(ti * 0.72, wallHeight + 3.05, 7.6);
    group.add(tTop);
    const tBot = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.85, 0.62), teethMat);
    tBot.position.set(ti * 0.72, wallHeight + 1.25, 7.5);
    group.add(tBot);
  }

  // Deep Sunken Sockets + Piercing Eyes
  for (const ex of [-2.85, 2.85]) {
    const socket = new THREE.Mesh(
      new THREE.SphereGeometry(1.65, 10, 10),
      new THREE.MeshBasicMaterial({ color: 0x140505 })
    );
    socket.scale.set(1.25, 0.72, 0.7);
    socket.position.set(ex, wallHeight + 7.4, 7.1);
    group.add(socket);

    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.58, 10, 10), eyeMat);
    eye.position.set(ex, wallHeight + 7.4, 7.85);
    group.add(eye);
  }

  // Massive Muscle Hands & Fingers Digging Into Wall Maria Parapet
  for (const hx of [-19, 19]) {
    const palm = new THREE.Mesh(new THREE.BoxGeometry(7.6, 4.2, 6.0), fleshMat);
    palm.position.set(hx, wallHeight + 1.3, 6.8);
    group.add(palm);
    for (let f = -1.5; f <= 1.5; f += 1) {
      const finger = new THREE.Mesh(new THREE.BoxGeometry(1.4, 4.2, 2.8), fleshMat);
      finger.position.set(hx + f * 1.7, wallHeight + 0.6, 10.2);
      finger.rotation.x = 0.5;
      group.add(finger);
    }
  }

  return group;
}

export function createUtgardCastleKeep(
  textures: ProceduralTextureSet,
  castShadow: boolean
): { group: THREE.Group; colliders: BuildingCollider[] } {
  const group = new THREE.Group();
  const colliders: BuildingCollider[] = [];

  const stoneMat = new THREE.MeshStandardMaterial({
    map: textures.fortressStone,
    bumpMap: textures.stoneBump,
    bumpScale: 0.3,
    color: 0x5c6270,
    roughness: 0.88,
  });

  // Central Towering Circular Stone Keep (34m tall)
  const keepR = 11;
  const keepH = 34;
  const tower = new THREE.Mesh(new THREE.CylinderGeometry(keepR * 0.92, keepR, keepH, 16), stoneMat);
  tower.position.set(0, keepH / 2, -16);
  tower.castShadow = castShadow;
  tower.receiveShadow = true;
  group.add(tower);

  const parapet = new THREE.Mesh(new THREE.CylinderGeometry(keepR + 0.8, keepR + 0.4, 2.5, 16), stoneMat);
  parapet.position.set(0, keepH + 1.25, -16);
  group.add(parapet);

  colliders.push({
    minX: -keepR,
    maxX: keepR,
    minY: 0,
    maxY: keepH + 2,
    minZ: -16 - keepR,
    maxZ: -16 + keepR,
  });

  // Flanking Ruined Castle Walls
  for (const sx of [-28, 28]) {
    const wall = new THREE.Mesh(new THREE.BoxGeometry(22, 14, 5), stoneMat);
    wall.position.set(sx, 7, -16);
    wall.castShadow = castShadow;
    wall.receiveShadow = true;
    group.add(wall);
    colliders.push({
      minX: sx - 11,
      maxX: sx + 11,
      minY: 0,
      maxY: 14,
      minZ: -18.5,
      maxZ: -13.5,
    });
  }

  return { group, colliders };
}

export function createCrystalPillar(
  x: number,
  z: number,
  height: number,
  radius: number,
  tiltZ: number
): { group: THREE.Group; collider: BuildingCollider } {
  const group = new THREE.Group();
  group.position.set(x, 0, z);

  const crystalMat = new THREE.MeshPhysicalMaterial({
    color: 0x67e8f9,
    emissive: 0x0891b2,
    emissiveIntensity: 1.35,
    roughness: 0.12,
    metalness: 0.08,
    clearcoat: 1.0,
    clearcoatRoughness: 0.08,
    transparent: true,
    opacity: 0.88,
  });

  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(radius * 0.72, radius * 1.15, height, 6), crystalMat);
  shaft.position.y = height / 2;
  shaft.rotation.z = tiltZ;
  group.add(shaft);

  const tip = new THREE.Mesh(new THREE.ConeGeometry(radius * 0.72, 4.5, 6), crystalMat);
  tip.position.y = height + 2.2;
  tip.rotation.z = tiltZ;
  group.add(tip);

  return {
    group,
    collider: {
      minX: x - radius * 1.05,
      maxX: x + radius * 1.05,
      minY: 0,
      maxY: height,
      minZ: z - radius * 1.05,
      maxZ: z + radius * 1.05,
    },
  };
}

export function createCrystalAltar(): THREE.Group {
  const group = new THREE.Group();
  const crystalMat = new THREE.MeshPhysicalMaterial({
    color: 0xa5f3fc,
    emissive: 0x22d3ee,
    emissiveIntensity: 1.8,
    roughness: 0.1,
    clearcoat: 1.0,
  });
  const dais = new THREE.Mesh(
    new THREE.CylinderGeometry(12, 14, 1.4, 8),
    new THREE.MeshStandardMaterial({ color: 0x273647, roughness: 0.75 })
  );
  dais.position.y = 0.7;
  group.add(dais);

  for (let i = 0; i < 6; i++) {
    const ang = (i / 6) * Math.PI * 2;
    const shard = new THREE.Mesh(new THREE.ConeGeometry(1.1, 6.5, 5), crystalMat);
    shard.position.set(Math.cos(ang) * 10.5, 3.2, Math.sin(ang) * 10.5);
    shard.rotation.z = -Math.cos(ang) * 0.25;
    shard.rotation.x = Math.sin(ang) * 0.25;
    group.add(shard);
  }
  return group;
}

export function createLiberioAmphitheater(
  textures: ProceduralTextureSet,
  castShadow: boolean
): { group: THREE.Group; colliders: BuildingCollider[] } {
  const group = new THREE.Group();
  const colliders: BuildingCollider[] = [];

  const marbleMat = new THREE.MeshStandardMaterial({
    map: textures.fortressStone,
    bumpMap: textures.stoneBump,
    bumpScale: 0.2,
    color: 0xbcb3a4,
    roughness: 0.65,
  });
  const crimsonMat = new THREE.MeshStandardMaterial({
    color: 0x7f1d1d,
    roughness: 0.75,
  });

  // Grand Speech Stage
  const stage = new THREE.Mesh(new THREE.BoxGeometry(34, 3.2, 18), marbleMat);
  stage.position.set(0, 1.6, -54);
  stage.castShadow = castShadow;
  stage.receiveShadow = true;
  group.add(stage);

  colliders.push({
    minX: -17,
    maxX: 17,
    minY: 0,
    maxY: 3.2,
    minZ: -63,
    maxZ: -45,
  });

  // Classical Columns + Marean Crimson Drapery
  for (let cx = -14; cx <= 14; cx += 7) {
    const col = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 1.0, 16, 10), marbleMat);
    col.position.set(cx, 11.2, -61);
    col.castShadow = castShadow;
    group.add(col);
  }
  const pediment = new THREE.Mesh(new THREE.BoxGeometry(36, 3.0, 5.5), marbleMat);
  pediment.position.set(0, 20.5, -61);
  group.add(pediment);

  const banner = new THREE.Mesh(new THREE.BoxGeometry(10, 12, 0.35), crimsonMat);
  banner.position.set(0, 12, -59.5);
  group.add(banner);

  // Night Searchlight Cones
  const beamMat = new THREE.MeshBasicMaterial({
    color: 0xfef3c7,
    transparent: true,
    opacity: 0.14,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
  });
  for (const [bx, bz, rz] of [
    [-46, -75, -0.25],
    [46, -75, 0.25],
    [-62, 48, -0.18],
    [62, 48, 0.18],
  ] as const) {
    const beam = new THREE.Mesh(new THREE.ConeGeometry(9.5, 78, 16, 1, true), beamMat);
    beam.position.set(bx, 38, bz);
    beam.rotation.z = rz;
    beam.rotation.x = Math.PI;
    group.add(beam);
  }

  return { group, colliders };
}

export function createRumblingRibArch(z: number, spanScale: number = 1.0): THREE.Group {
  const group = new THREE.Group();
  group.position.set(0, 0, z);

  const boneMat = new THREE.MeshStandardMaterial({
    color: 0xd9d2c3,
    roughness: 0.58,
    metalness: 0.08,
  });

  // Towering curved Founding Titan Ribcage Arch
  const rib = new THREE.Mesh(new THREE.TorusGeometry(62 * spanScale, 2.2, 10, 28, Math.PI), boneMat);
  rib.position.y = 0;
  group.add(rib);

  // Dorsal Vertebral Spine Nodes at Apex
  const apex = new THREE.Mesh(new THREE.BoxGeometry(5.5, 8.5, 5.5), boneMat);
  apex.position.y = 62 * spanScale + 2;
  group.add(apex);

  return group;
}

export function createUtgardMoon(): THREE.Group {
  const group = new THREE.Group();
  const moonMesh = new THREE.Mesh(
    new THREE.SphereGeometry(24, 24, 18),
    new THREE.MeshBasicMaterial({ color: 0xf1f5f9 })
  );
  group.add(moonMesh);

  const haloMesh = new THREE.Mesh(
    new THREE.RingGeometry(24.5, 42, 32),
    new THREE.MeshBasicMaterial({
      color: 0x93c5fd,
      transparent: true,
      opacity: 0.16,
      side: THREE.DoubleSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    })
  );
  group.add(haloMesh);
  group.position.set(-70, 145, -240);
  group.lookAt(0, 10, 0);
  return group;
}

export function createCrystalCeilingArch(z: number): THREE.Group {
  const group = new THREE.Group();
  group.position.set(0, 0, z);

  const rockMat = new THREE.MeshStandardMaterial({
    color: 0x16222f,
    roughness: 0.92,
  });
  const crystalMat = new THREE.MeshPhysicalMaterial({
    color: 0x67e8f9,
    emissive: 0x06b6d4,
    emissiveIntensity: 1.5,
    roughness: 0.12,
    clearcoat: 1.0,
    transparent: true,
    opacity: 0.85,
  });

  const arch = new THREE.Mesh(new THREE.TorusGeometry(118, 6.5, 8, 22, Math.PI), rockMat);
  arch.position.y = 6;
  group.add(arch);

  for (let i = -3; i <= 3; i++) {
    const ang = Math.PI * 0.5 + i * 0.28;
    const x = Math.cos(ang) * 108;
    const y = Math.sin(ang) * 108 + 4;
    const stalactite = new THREE.Mesh(new THREE.ConeGeometry(2.2, 13 + (Math.abs(i) % 2) * 5, 5), crystalMat);
    stalactite.position.set(x, y, 0);
    stalactite.rotation.x = Math.PI;
    group.add(stalactite);
  }
  return group;
}

export function createRumblingHorizonTitans(): THREE.Group {
  const group = new THREE.Group();
  const silhouetteMat = new THREE.MeshStandardMaterial({
    color: 0x2a0f0e,
    emissive: 0x7f1d1d,
    emissiveIntensity: 0.4,
    roughness: 0.85,
  });
  const eyeMat = new THREE.MeshBasicMaterial({ color: 0xfb923c });

  for (let i = 0; i < 16; i++) {
    const ang = (i / 16) * Math.PI * 2;
    if (Math.abs(ang) < 0.25) continue;
    const dist = 195 + (i % 2) * 28;
    const titan = new THREE.Group();
    titan.position.set(Math.cos(ang) * dist, 0, Math.sin(ang) * dist);
    titan.lookAt(0, 0, 0);

    const torso = new THREE.Mesh(new THREE.BoxGeometry(16, 46, 8), silhouetteMat);
    torso.position.y = 23;
    titan.add(torso);

    const head = new THREE.Mesh(new THREE.SphereGeometry(5.2, 10, 8), silhouetteMat);
    head.position.y = 50;
    titan.add(head);

    for (const ex of [-1.8, 1.8]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.65, 6, 6), eyeMat);
      eye.position.set(ex, 50.5, 4.6);
      titan.add(eye);
    }
    group.add(titan);
  }
  return group;
}

export interface Titan3DInstance {
  id: number;
  kind: TitanKind;
  scale: number;
  group: THREE.Group;
  bodyPivot: THREE.Group;
  headPivot: THREE.Group;
  leftLegPivot: THREE.Group;
  rightLegPivot: THREE.Group;
  leftArmPivot: THREE.Group;
  rightArmPivot: THREE.Group;
  handTarget: THREE.Object3D;
  napeMesh: THREE.Mesh;
  napeTarget: THREE.Object3D;
  eyeTarget: THREE.Object3D;
  eyesGroup: THREE.Group;
  blindXGroup: THREE.Group;
  vx: number;
  vz: number;
  vy: number;
  hp: number;
  maxHp: number;
  walkPhase: number;
  blindTimer: number;
  staggerTimer: number;
  attackCooldown: number;
  leapTimer: number;
  abilityTimer: number;
  grabbingPlayer: boolean;
  dyingTimer: number;
  dead: boolean;
}

function createArmoredPlateGeo(w: number, h: number, d: number, bevel: number = 0.12): THREE.ExtrudeGeometry {
  const shape = new THREE.Shape();
  const hw = w * 0.5;
  const hh = h * 0.5;
  shape.moveTo(-hw * 0.85, -hh);
  shape.lineTo(hw * 0.85, -hh);
  shape.lineTo(hw, -hh * 0.35);
  shape.lineTo(hw * 0.92, hh * 0.78);
  shape.lineTo(0, hh);
  shape.lineTo(-hw * 0.92, hh * 0.78);
  shape.lineTo(-hw, -hh * 0.35);
  shape.closePath();

  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: d,
    bevelEnabled: true,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments: 2,
  });
  geo.center();
  return geo;
}

function addCurvedHairStrand(
  parent: THREE.Object3D,
  pts: Array<[number, number, number]>,
  radius: number,
  mat: THREE.Material
) {
  const curve = new THREE.CatmullRomCurve3(pts.map(([x, y, z]) => new THREE.Vector3(x, y, z)));
  const geo = new THREE.TubeGeometry(curve, 10, radius, 6, false);
  const mesh = new THREE.Mesh(geo, mat);
  parent.add(mesh);
}

function addCanonTitanHair(
  headPivot: THREE.Group,
  kind: TitanKind,
  s: number,
  hairMat: THREE.Material
) {
  if (kind === 'colossal' || kind === 'warhammer') return;

  if (kind === 'armored') {
    // Reiner Armored Titan: Short bristled white-blonde crop protruding above helmet brow
    const cap = new THREE.Mesh(
      new THREE.SphereGeometry(1.18 * s, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.45),
      hairMat
    );
    cap.position.set(0, 2.02 * s, -0.05 * s);
    headPivot.add(cap);
    for (let i = -3; i <= 3; i++) {
      const spike = new THREE.Mesh(new THREE.ConeGeometry(0.24 * s, 0.78 * s, 5), hairMat);
      spike.position.set(i * 0.28 * s, 2.74 * s, (0.38 - Math.abs(i) * 0.08) * s);
      spike.rotation.x = 0.28;
      spike.rotation.z = -i * 0.12;
      headPivot.add(spike);
    }
    return;
  }

  if (kind === 'jaw') {
    // Porco / Galliard Jaw Titan: Thick swept-back spiky lion's mane
    const cap = new THREE.Mesh(
      new THREE.SphereGeometry(1.22 * s, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.56),
      hairMat
    );
    cap.position.set(0, 1.85 * s, -0.1 * s);
    headPivot.add(cap);
    for (let i = -3; i <= 3; i++) {
      addCurvedHairStrand(
        headPivot,
        [
          [i * 0.26 * s, 2.55 * s, 0.45 * s],
          [i * 0.42 * s, 2.85 * s, -0.35 * s],
          [i * 0.52 * s, 1.95 * s, -1.25 * s],
        ],
        0.22 * s,
        hairMat
      );
    }
    return;
  }

  if (kind === 'beast') {
    // Zeke Beast Titan: Thick ape hair crown + sideburns + full beard around jaw
    const crown = new THREE.Mesh(
      new THREE.SphereGeometry(1.26 * s, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.58),
      hairMat
    );
    crown.position.set(0, 1.86 * s, -0.05 * s);
    headPivot.add(crown);
    for (const sx of [-1, 1]) {
      const sideburn = new THREE.Mesh(new THREE.ConeGeometry(0.36 * s, 1.1 * s, 6), hairMat);
      sideburn.position.set(sx * 0.96 * s, 1.32 * s, 0.35 * s);
      sideburn.rotation.z = sx * 0.2;
      sideburn.rotation.x = Math.PI;
      headPivot.add(sideburn);
    }
    const beard = new THREE.Mesh(new THREE.ConeGeometry(0.75 * s, 1.15 * s, 7), hairMat);
    beard.position.set(0, 0.72 * s, 0.65 * s);
    beard.rotation.x = Math.PI - 0.15;
    headPivot.add(beard);
    return;
  }

  if (kind === 'female') {
    // Annie Female Titan: Sleek layered blonde bob framing cheeks & nape
    const crown = new THREE.Mesh(
      new THREE.SphereGeometry(1.22 * s, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.58),
      hairMat
    );
    crown.position.set(0, 1.82 * s, -0.04 * s);
    headPivot.add(crown);
    for (let i = -3; i <= 3; i++) {
      const zStart = i === 0 ? 0.92 : 0.75 - Math.abs(i) * 0.12;
      addCurvedHairStrand(
        headPivot,
        [
          [i * 0.25 * s, 2.55 * s, zStart * 0.35 * s],
          [i * 0.36 * s, 1.85 * s, (Math.abs(i) >= 2 ? 0.5 : 0.95) * s],
          [i * 0.34 * s, 1.05 * s, (Math.abs(i) >= 2 ? 0.35 : 0.85) * s],
        ],
        0.16 * s,
        hairMat
      );
    }
    for (let b = -3; b <= 3; b++) {
      addCurvedHairStrand(
        headPivot,
        [
          [b * 0.28 * s, 2.25 * s, -0.55 * s],
          [b * 0.34 * s, 1.25 * s, -0.95 * s],
          [b * 0.3 * s, 0.45 * s, -0.82 * s],
        ],
        0.2 * s,
        hairMat
      );
    }
    return;
  }

  if (kind === 'attack' || kind === 'founding') {
    // Eren Attack / Founding Titan: Wild jagged bangs over forehead + long flowing shoulder/back hair locks
    const crown = new THREE.Mesh(
      new THREE.SphereGeometry(1.25 * s, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.56),
      hairMat
    );
    crown.position.set(0, 1.82 * s, -0.05 * s);
    headPivot.add(crown);

    // Messy front bangs falling between eyes & cheeks
    for (let f = -3; f <= 3; f++) {
      addCurvedHairStrand(
        headPivot,
        [
          [f * 0.24 * s, 2.65 * s, 0.32 * s],
          [f * 0.31 * s, 2.1 * s, 1.08 * s],
          [f * 0.34 * s, 1.38 * s, (1.16 - Math.abs(f) * 0.08) * s],
        ],
        0.15 * s,
        hairMat
      );
    }
    // Long flowing back/shoulder locks
    const backLen = kind === 'founding' ? -3.4 * s : -0.65 * s;
    for (let b = -4; b <= 4; b++) {
      addCurvedHairStrand(
        headPivot,
        [
          [b * 0.26 * s, 2.25 * s, -0.45 * s],
          [b * 0.36 * s, 0.85 * s, -1.08 * s],
          [b * 0.44 * s, backLen, (-1.28 - (b % 2) * 0.25) * s],
        ],
        0.19 * s,
        hairMat
      );
    }
    return;
  }

  if (kind === 'cart') {
    // Pieck Cart Titan: Shaggy dark bob strands draped along sides of long snout
    for (let i = -3; i <= 3; i++) {
      addCurvedHairStrand(
        headPivot,
        [
          [i * 0.2 * s, 0.72 * s, 0.1 * s],
          [i * 0.24 * s, 0.55 * s, -0.55 * s],
          [i * 0.26 * s, -0.25 * s, -0.95 * s],
        ],
        0.14 * s,
        hairMat
      );
    }
    return;
  }

  // Normal / Abnormal pure titans: messy tufts
  const cap = new THREE.Mesh(
    new THREE.SphereGeometry(1.18 * s, 10, 8, 0, Math.PI * 2, 0, Math.PI * 0.52),
    hairMat
  );
  cap.position.set(0, 1.84 * s, -0.05 * s);
  headPivot.add(cap);
  for (let hIdx = -2; hIdx <= 2; hIdx++) {
    const tuft = new THREE.Mesh(new THREE.ConeGeometry(0.24 * s, 0.65 * s, 5), hairMat);
    tuft.position.set(hIdx * 0.32 * s, 2.35 * s, 0.5 * s);
    tuft.rotation.x = 0.65;
    headPivot.add(tuft);
  }
}

let cachedShadowTex: THREE.CanvasTexture | null = null;
function getTitanShadowTexture(): THREE.CanvasTexture {
  if (cachedShadowTex) return cachedShadowTex;
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 128;
  const ctx = c.getContext('2d')!;
  const grad = ctx.createRadialGradient(64, 64, 10, 64, 64, 62);
  grad.addColorStop(0, 'rgba(0, 0, 0, 0.58)');
  grad.addColorStop(0.6, 'rgba(0, 0, 0, 0.24)');
  grad.addColorStop(1, 'rgba(0, 0, 0, 0.0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 128, 128);
  cachedShadowTex = new THREE.CanvasTexture(c);
  return cachedShadowTex;
}

export function createTitan3D(
  id: number,
  kind: TitanKind,
  scale: number,
  x: number,
  z: number,
  maxHp: number,
  textures: ProceduralTextureSet,
  castShadow: boolean
): Titan3DInstance {
  const group = new THREE.Group();
  group.position.set(x, 0, z);

  // Soft Ground Contact Shadow beneath Titan feet
  const shadowSize = kind === 'cart' ? 3.8 * scale : 3.2 * scale;
  const contactShadow = new THREE.Mesh(
    new THREE.PlaneGeometry(shadowSize * 2, shadowSize * 2),
    new THREE.MeshBasicMaterial({
      map: getTitanShadowTexture(),
      transparent: true,
      depthWrite: false,
    })
  );
  contactShadow.rotation.x = -Math.PI / 2;
  contactShadow.position.y = 0.04;
  group.add(contactShadow);

  const skinColorMap: Record<TitanKind, number> = {
    normal: 0xc9947b,
    abnormal: 0xd69b82,
    attack: 0xc78f76,
    colossal: 0x9c251f,
    armored: 0x9b2c25,
    female: 0xdab09c,
    beast: 0xb98c72,
    jaw: 0xc28e76,
    cart: 0xc49f8b,
    warhammer: 0xf1efe9,
    founding: 0xb5a6a2,
  };

  const useRawMuscleBase = kind === 'colossal' || kind === 'armored';
  const skinMat = new THREE.MeshPhysicalMaterial({
    map: useRawMuscleBase ? textures.titanMuscle : textures.titanSkin,
    bumpMap: useRawMuscleBase ? textures.titanMuscleBump : textures.titanBump,
    bumpScale: kind === 'colossal' ? 0.55 : 0.28,
    color: skinColorMap[kind],
    roughness: kind === 'warhammer' ? 0.28 : 0.66,
    metalness: kind === 'warhammer' ? 0.1 : 0.03,
    clearcoat: kind === 'warhammer' ? 0.65 : 0.0,
    sheen: 0.35,
    sheenColor: new THREE.Color(useRawMuscleBase ? 0xef4444 : 0xffcbb3),
    emissive: kind === 'colossal' ? 0x540b0b : kind === 'founding' ? 0x0e2a38 : 0x000000,
    emissiveIntensity: kind === 'colossal' ? 0.45 : kind === 'founding' ? 0.35 : 0,
  });

  const exposedMuscleMat = new THREE.MeshStandardMaterial({
    map: textures.titanMuscle,
    bumpMap: textures.titanMuscleBump,
    bumpScale: 0.45,
    color: 0xa42822,
    roughness: 0.56,
    metalness: 0.04,
  });

  const hairColorMap: Record<TitanKind, number> = {
    normal: 0x221915,
    abnormal: 0x2c201a,
    attack: 0x16110e,
    colossal: 0x7f1d1d,
    armored: 0xe2dfd5,
    female: 0xe6c36a,
    beast: 0x3b261b,
    jaw: 0x1d1613,
    cart: 0x16161a,
    warhammer: 0xf1f5f9,
    founding: 0x090b10,
  };

  const hairMat = new THREE.MeshStandardMaterial({
    color: hairColorMap[kind],
    roughness: 0.86,
  });

  const furMat = new THREE.MeshStandardMaterial({
    map: textures.titanBeastFur,
    bumpMap: textures.titanBeastFurBump,
    bumpScale: 0.55,
    color: 0x523728,
    roughness: 0.94,
  });

  const armorMat = new THREE.MeshPhysicalMaterial({
    map: textures.titanArmorPlate,
    bumpMap: textures.titanArmorBump,
    bumpScale: 0.35,
    color: kind === 'warhammer' ? 0xf4f4f2 : kind === 'jaw' ? 0xe7decb : 0xdfd6c1,
    roughness: kind === 'warhammer' ? 0.28 : 0.42,
    metalness: 0.14,
    clearcoat: kind === 'warhammer' ? 0.6 : 0.25,
  });

  const crystalHardMat = new THREE.MeshPhysicalMaterial({
    color: 0x93c5fd,
    emissive: 0x0284c7,
    emissiveIntensity: 1.05,
    roughness: 0.12,
    clearcoat: 1.0,
    transparent: true,
    opacity: 0.92,
  });

  const tendonMat = new THREE.MeshStandardMaterial({
    color: 0xe8dac4,
    roughness: 0.62,
  });

  const bodyPivot = new THREE.Group();
  group.add(bodyPivot);
  const s = scale;

  // =========================================================================
  // SPECIAL QUADRUPED BUILD: CART TITAN (차력 거인 - 피크 핑거)
  // =========================================================================
  if (kind === 'cart') {
    // Lean horizontal quadruped torso & arched spine
    const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.95 * s, 2.75 * s, 8, 12), skinMat);
    torso.rotation.x = Math.PI / 2;
    torso.scale.set(1.05, 1.0, 0.88);
    torso.position.set(0, 2.75 * s, 0);
    torso.castShadow = castShadow;
    bodyPivot.add(torso);

    // Visible spinal ridge bumps
    for (let sp = -3; sp <= 3; sp++) {
      const vertebra = new THREE.Mesh(new THREE.SphereGeometry(0.26 * s, 6, 6), skinMat);
      vertebra.position.set(0, 3.55 * s, sp * 0.48 * s);
      bodyPivot.add(vertebra);
    }

    // Marean Panzer Armor Saddle + Steel Turret + Twin Heavy Machine Guns + Ammo Boxes
    const harnessMat = new THREE.MeshStandardMaterial({ color: 0x3f2e21, roughness: 0.85 });
    const steelMat = new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.85, roughness: 0.34 });

    const saddle = new THREE.Mesh(new THREE.BoxGeometry(2.15 * s, 0.45 * s, 2.9 * s), harnessMat);
    saddle.position.set(0, 3.55 * s, -0.1 * s);
    bodyPivot.add(saddle);

    const turretShield = new THREE.Mesh(new THREE.CylinderGeometry(0.95 * s, 1.1 * s, 1.3 * s, 8), steelMat);
    turretShield.position.set(0, 4.35 * s, -0.25 * s);
    bodyPivot.add(turretShield);

    for (const gx of [-0.58 * s, 0.58 * s]) {
      const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.11 * s, 0.14 * s, 2.6 * s, 8), steelMat);
      barrel.rotation.x = Math.PI / 2;
      barrel.position.set(gx, 4.5 * s, 1.15 * s);
      bodyPivot.add(barrel);

      const ammoBox = new THREE.Mesh(new THREE.BoxGeometry(0.45 * s, 0.65 * s, 0.8 * s), harnessMat);
      ammoBox.position.set(gx * 1.65, 3.8 * s, -0.45 * s);
      bodyPivot.add(ammoBox);
    }

    const makeQuadLeg = (lx: number, lz: number) => {
      const piv = new THREE.Group();
      piv.position.set(lx, 2.55 * s, lz);
      const upper = new THREE.Mesh(new THREE.CylinderGeometry(0.36 * s, 0.28 * s, 1.4 * s, 8), skinMat);
      upper.position.y = -0.65 * s;
      piv.add(upper);
      const lower = new THREE.Mesh(new THREE.CylinderGeometry(0.27 * s, 0.2 * s, 1.35 * s, 8), skinMat);
      lower.position.y = -1.85 * s;
      lower.castShadow = castShadow;
      piv.add(lower);
      const paw = new THREE.Mesh(new THREE.BoxGeometry(0.5 * s, 0.28 * s, 0.78 * s), skinMat);
      paw.position.set(0, -2.45 * s, 0.18 * s);
      piv.add(paw);
      bodyPivot.add(piv);
      return piv;
    };
    const leftLegPivot = makeQuadLeg(-0.85 * s, -1.65 * s);
    const rightLegPivot = makeQuadLeg(0.85 * s, -1.65 * s);
    const leftArmPivot = makeQuadLeg(-0.88 * s, 1.65 * s);
    const rightArmPivot = makeQuadLeg(0.88 * s, 1.65 * s);

    // Long forward-stretching neck & iconic horse/crocodile muzzle head
    const headPivot = new THREE.Group();
    headPivot.position.set(0, 3.1 * s, 2.25 * s);
    bodyPivot.add(headPivot);

    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.55 * s, 0.72 * s, 1.65 * s, 10), skinMat);
    neck.rotation.x = Math.PI / 3;
    neck.position.set(0, 0.15 * s, -0.15 * s);
    headPivot.add(neck);

    const napeMat = new THREE.MeshStandardMaterial({
      color: 0xf43f5e,
      emissive: 0xf43f5e,
      emissiveIntensity: 2.3,
    });
    const napeMesh = new THREE.Mesh(new THREE.BoxGeometry(0.95 * s, 0.85 * s, 0.55 * s), napeMat);
    napeMesh.position.set(0, 0.75 * s, -0.78 * s);
    headPivot.add(napeMesh);
    const napeTarget = new THREE.Object3D();
    napeTarget.position.set(0, 0.75 * s, -0.95 * s);
    headPivot.add(napeTarget);

    // Cranium + Elongated Horse-Like Muzzle + Armored Steel Forehead Plate
    const cranium = new THREE.Mesh(new THREE.SphereGeometry(0.76 * s, 12, 10), skinMat);
    cranium.position.set(0, 0.35 * s, 0.45 * s);
    headPivot.add(cranium);

    const snout = new THREE.Mesh(new THREE.BoxGeometry(0.95 * s, 0.78 * s, 1.95 * s), skinMat);
    snout.position.set(0, 0.08 * s, 1.55 * s);
    headPivot.add(snout);

    // Armored Marean Head Mask Plate
    const steelHeadMask = new THREE.Mesh(new THREE.BoxGeometry(1.12 * s, 0.45 * s, 1.75 * s), steelMat);
    steelHeadMask.position.set(0, 0.55 * s, 1.35 * s);
    headPivot.add(steelHeadMask);

    // Wide Lipless Teethed Muzzle Sides
    const toothMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.4 });
    for (let ti = 0; ti < 5; ti++) {
      for (const sx of [-0.46 * s, 0.46 * s]) {
        const sideTooth = new THREE.Mesh(new THREE.BoxGeometry(0.1 * s, 0.24 * s, 0.18 * s), toothMat);
        sideTooth.position.set(sx, -0.14 * s, (1.05 + ti * 0.28) * s);
        headPivot.add(sideTooth);
      }
    }

    addCanonTitanHair(headPivot, 'cart', s, hairMat);

    // Droopy Dark-Ringed Eyes
    const eyesGroup = new THREE.Group();
    headPivot.add(eyesGroup);
    const ringMat = new THREE.MeshBasicMaterial({ color: 0x1e1b18 });
    const ewMat = new THREE.MeshBasicMaterial({ color: 0xf1f5f9 });
    const epMat = new THREE.MeshBasicMaterial({ color: 0x0f172a });
    for (const ex of [-0.46 * s, 0.46 * s]) {
      const ring = new THREE.Mesh(new THREE.SphereGeometry(0.27 * s, 8, 8), ringMat);
      ring.position.set(ex, 0.34 * s, 1.15 * s);
      eyesGroup.add(ring);
      const ew = new THREE.Mesh(new THREE.SphereGeometry(0.19 * s, 8, 8), ewMat);
      ew.position.set(ex, 0.34 * s, 1.24 * s);
      eyesGroup.add(ew);
      const ep = new THREE.Mesh(new THREE.SphereGeometry(0.08 * s, 6, 6), epMat);
      ep.position.set(ex, 0.32 * s, 1.39 * s);
      eyesGroup.add(ep);
    }
    const blindXGroup = new THREE.Group();
    blindXGroup.visible = false;
    headPivot.add(blindXGroup);

    const eyeTarget = new THREE.Object3D();
    eyeTarget.position.set(0, 0.34 * s, 1.45 * s);
    headPivot.add(eyeTarget);

    const handTarget = new THREE.Object3D();
    handTarget.position.set(0, -1.8 * s, 0.6 * s);
    rightArmPivot.add(handTarget);

    return {
      id,
      kind,
      scale,
      group,
      bodyPivot,
      headPivot,
      leftLegPivot,
      rightLegPivot,
      leftArmPivot,
      rightArmPivot,
      handTarget,
      napeMesh,
      napeTarget,
      eyeTarget,
      eyesGroup,
      blindXGroup,
      vx: 0,
      vz: 0,
      vy: 0,
      hp: maxHp,
      maxHp,
      walkPhase: Math.random() * Math.PI * 2,
      blindTimer: 0,
      staggerTimer: 0,
      attackCooldown: 1.0,
      leapTimer: 4.0,
      abilityTimer: 2.5,
      grabbingPlayer: false,
      dyingTimer: 0,
      dead: false,
    };
  }

  // =========================================================================
  // BIPEDAL CANON SCULPTURE FOR THE REMAINING EIGHT TITANS
  // =========================================================================

  // Sculpted Torso Lathe Profile tailored per Titan!
  const torsoBaseMat = kind === 'beast' ? furMat : skinMat;
  const isBeast = kind === 'beast';
  const isFemale = kind === 'female';
  const isColossal = kind === 'colossal';
  const isFounding = kind === 'founding';
  const isArmored = kind === 'armored';
  const isWarhammer = kind === 'warhammer';
  const isJaw = kind === 'jaw';

  const torsoLathePts = isBeast
    ? [
        new THREE.Vector2(0.01, -1.9 * s),
        new THREE.Vector2(1.55 * s, -1.65 * s),
        new THREE.Vector2(2.25 * s, -0.45 * s), // Protruding Beast Titan pot-belly
        new THREE.Vector2(1.85 * s, 0.85 * s),
        new THREE.Vector2(1.62 * s, 1.75 * s),  // Narrower ape shoulders
        new THREE.Vector2(0.01, 1.95 * s),
      ]
    : isFemale
      ? [
          new THREE.Vector2(0.01, -1.85 * s),
          new THREE.Vector2(1.38 * s, -1.55 * s), // Female hips
          new THREE.Vector2(0.95 * s, -0.25 * s), // Cinched athletic waist
          new THREE.Vector2(1.48 * s, 1.15 * s),
          new THREE.Vector2(1.42 * s, 1.8 * s),
          new THREE.Vector2(0.01, 1.95 * s),
        ]
      : isFounding
        ? [
            new THREE.Vector2(0.01, -1.85 * s),
            new THREE.Vector2(0.92 * s, -1.4 * s), // Gaunt skeletal Founding waist
            new THREE.Vector2(0.75 * s, -0.3 * s),
            new THREE.Vector2(1.45 * s, 1.15 * s),
            new THREE.Vector2(1.68 * s, 1.82 * s),
            new THREE.Vector2(0.01, 1.95 * s),
          ]
        : [
            // Attack / Armored / Colossal / War Hammer / Jaw: Ripped V-taper
            new THREE.Vector2(0.01, -1.85 * s),
            new THREE.Vector2(1.25 * s, -1.65 * s),
            new THREE.Vector2(1.16 * s, -0.35 * s),
            new THREE.Vector2(1.88 * s, 1.15 * s),
            new THREE.Vector2(2.05 * s, 1.75 * s),
            new THREE.Vector2(0.01, 1.95 * s),
          ];

  const torsoGeo = new THREE.LatheGeometry(torsoLathePts, 16);
  const torso = new THREE.Mesh(torsoGeo, torsoBaseMat);
  torso.position.set(0, 7.25 * s, isBeast ? 0.35 * s : 0);
  torso.scale.set(isArmored ? 1.18 : 1.08, 1.0, isBeast ? 1.12 : 0.72);
  torso.castShadow = castShadow;
  bodyPivot.add(torso);

  // Anatomical Pelvis & Thigh Join
  const pelvis = new THREE.Mesh(
    new THREE.CylinderGeometry(isFemale ? 1.32 * s : 1.28 * s, 1.1 * s, 1.45 * s, 12),
    torsoBaseMat
  );
  pelvis.position.y = 5.2 * s;
  pelvis.scale.set(1.15, 1, 0.78);
  pelvis.castShadow = castShadow;
  bodyPivot.add(pelvis);

  // Sculpted Anatomical Pectorals + 6-Pack Abs (Exposed Skin/Muscle depending on Titan)
  if (!isBeast && !isArmored && !isFounding) {
    const chestMat = isFemale ? exposedMuscleMat : skinMat;
    for (const px of [-0.72 * s, 0.72 * s]) {
      const pec = new THREE.Mesh(new THREE.SphereGeometry(isFemale ? 0.76 * s : 0.92 * s, 12, 10), chestMat);
      pec.position.set(px, 8.1 * s, 0.78 * s);
      pec.scale.set(1.12, 0.82, 0.68);
      bodyPivot.add(pec);
    }
    if (kind === 'attack' || isColossal || isFemale || isWarhammer) {
      for (let row = 0; row < 3; row++) {
        for (const ax of [-0.36 * s, 0.36 * s]) {
          const ab = new THREE.Mesh(new THREE.SphereGeometry(0.35 * s, 8, 8), skinMat);
          ab.position.set(ax, (7.05 - row * 0.56) * s, 0.86 * s);
          ab.scale.set(1.1, 0.78, 0.55);
          bodyPivot.add(ab);
        }
      }
    }
  }

  // BEAST TITAN: Exposed hairless skin patch on chest/belly & protruding ape belly dome
  if (isBeast) {
    const bareChest = new THREE.Mesh(new THREE.SphereGeometry(1.45 * s, 12, 10), skinMat);
    bareChest.position.set(0, 6.7 * s, 0.95 * s);
    bareChest.scale.set(0.95, 1.15, 0.72);
    bodyPivot.add(bareChest);

    // Broad hunched fur mantle across upper back/shoulders
    const furMantle = new THREE.Mesh(new THREE.DodecahedronGeometry(1.95 * s, 1), furMat);
    furMantle.position.set(0, 8.8 * s, -0.35 * s);
    furMantle.scale.set(1.25, 0.75, 0.92);
    bodyPivot.add(furMantle);
  }

  // COLOSSAL TITAN: Exposed curved white ribs + sternum + trapezius tendons
  if (isColossal) {
    const sternum = new THREE.Mesh(new THREE.BoxGeometry(0.45 * s, 2.7 * s, 0.45 * s), tendonMat);
    sternum.position.set(0, 7.6 * s, 1.12 * s);
    bodyPivot.add(sternum);

    for (let r = 0; r < 5; r++) {
      const yRib = (6.3 + r * 0.54) * s;
      for (const side of [-1, 1]) {
        const ribCurve = new THREE.CatmullRomCurve3([
          new THREE.Vector3(0, yRib, 1.05 * s),
          new THREE.Vector3(side * 1.45 * s, yRib + 0.08 * s, 0.85 * s),
          new THREE.Vector3(side * 1.78 * s, yRib + 0.14 * s, -0.25 * s),
          new THREE.Vector3(side * 0.75 * s, yRib + 0.16 * s, -1.05 * s),
        ]);
        const ribMesh = new THREE.Mesh(new THREE.TubeGeometry(ribCurve, 12, 0.13 * s, 6, false), tendonMat);
        bodyPivot.add(ribMesh);
      }
    }
  }

  // FEMALE TITAN: Anatomical half-muscle / half-skin patchy pattern + hardened chest/neck zones
  if (isFemale) {
    const rightFlankMuscle = new THREE.Mesh(new THREE.BoxGeometry(1.1 * s, 2.4 * s, 1.2 * s), exposedMuscleMat);
    rightFlankMuscle.position.set(0.85 * s, 6.8 * s, 0.05 * s);
    bodyPivot.add(rightFlankMuscle);
  }

  // WAR HAMMER TITAN: Crimson sinew gaps beneath gleaming porcelain shell
  if (isWarhammer) {
    for (const sx of [-1.25 * s, 1.25 * s]) {
      const sinewLine = new THREE.Mesh(new THREE.CylinderGeometry(0.14 * s, 0.14 * s, 3.1 * s, 6), exposedMuscleMat);
      sinewLine.position.set(sx, 7.3 * s, 0.65 * s);
      sinewLine.rotation.z = sx < 0 ? 0.2 : -0.2;
      bodyPivot.add(sinewLine);
    }
    const backSpineSeam = new THREE.Mesh(new THREE.BoxGeometry(0.45 * s, 3.5 * s, 0.35 * s), exposedMuscleMat);
    backSpineSeam.position.set(0, 7.2 * s, -1.0 * s);
    bodyPivot.add(backSpineSeam);
  }

  // ARMORED TITAN: Multi-part overlapping beveled bone armor plates over red muscle
  if (isArmored) {
    // V-shaped Clavicle Collar Armor
    const collarPlate = new THREE.Mesh(createArmoredPlateGeo(3.6 * s, 0.9 * s, 1.45 * s, 0.1 * s), armorMat);
    collarPlate.position.set(0, 9.05 * s, 0.3 * s);
    bodyPivot.add(collarPlate);

    // Split Angular Pectoral Armor Plates
    for (const px of [-0.95 * s, 0.95 * s]) {
      const chestPlate = new THREE.Mesh(createArmoredPlateGeo(1.65 * s, 1.45 * s, 0.72 * s, 0.11 * s), armorMat);
      chestPlate.position.set(px, 8.08 * s, 0.96 * s);
      chestPlate.rotation.y = px < 0 ? -0.18 : 0.18;
      bodyPivot.add(chestPlate);
    }

    // 6-Segment Articulated Abdominal Armor Plates
    for (let ab = 0; ab < 3; ab++) {
      for (const ax of [-0.52 * s, 0.52 * s]) {
        const abPlate = new THREE.Mesh(createArmoredPlateGeo(0.95 * s, 0.55 * s, 0.55 * s, 0.08 * s), armorMat);
        abPlate.position.set(ax, (6.95 - ab * 0.62) * s, 0.95 * s);
        bodyPivot.add(abPlate);
      }
    }

    // Dorsal Armored Spine Plates
    for (let b = 0; b < 4; b++) {
      const backPlate = new THREE.Mesh(createArmoredPlateGeo(2.8 * s, 0.75 * s, 0.6 * s, 0.09 * s), armorMat);
      backPlate.position.set(0, (6.2 + b * 0.85) * s, -0.98 * s);
      bodyPivot.add(backPlate);
    }
  }

  // FOUNDING TITAN: Dramatic towering skeletal ribs & dorsal spine cage + glowing Coordinate core
  if (isFounding) {
    const boneMat = new THREE.MeshStandardMaterial({ color: 0xe7e1d3, roughness: 0.5 });
    const coordGlowMat = new THREE.MeshStandardMaterial({
      color: 0xa5f3fc,
      emissive: 0x38bdf8,
      emissiveIntensity: 2.3,
    });

    // Exposed Skeletal Ribcage around Chest
    for (let r = 0; r < 5; r++) {
      const ry = (6.1 + r * 0.55) * s;
      for (const side of [-1, 1]) {
        const cage = new THREE.Mesh(new THREE.BoxGeometry(1.4 * s, 0.18 * s, 0.25 * s), boneMat);
        cage.position.set(side * 0.65 * s, ry, 0.75 * s);
        cage.rotation.z = side * -0.12;
        bodyPivot.add(cage);
      }
    }

    // Towering Radiating Rumbling Spine-Rib Crown Arcs behind shoulders
    for (let arcIdx = -4; arcIdx <= 4; arcIdx++) {
      const spreadX = arcIdx * 0.72 * s;
      const archH = (12.2 - Math.abs(arcIdx) * 0.7) * s;
      const ribCurve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(arcIdx * 0.2 * s, 6.2 * s, -0.9 * s),
        new THREE.Vector3(spreadX * 1.1, 9.6 * s, -2.1 * s),
        new THREE.Vector3(spreadX * 1.45, archH, -1.2 * s),
        new THREE.Vector3(spreadX * 1.25, archH - 1.4 * s, 0.6 * s),
      ]);
      const spineRib = new THREE.Mesh(new THREE.TubeGeometry(ribCurve, 14, 0.16 * s, 6, false), boneMat);
      bodyPivot.add(spineRib);
    }

    // Glowing Coordinate Rib Halo Core
    const coordCore = new THREE.Mesh(new THREE.OctahedronGeometry(0.75 * s, 0), coordGlowMat);
    coordCore.position.set(0, 7.8 * s, -1.25 * s);
    bodyPivot.add(coordCore);
  }

  // Sculpted Legs (Colossal has thick heavy pillar calves!)
  const makeLeg = (side: -1 | 1) => {
    const legPivot = new THREE.Group();
    legPivot.position.set(side * 0.88 * s, 5.0 * s, 0);

    const legMat = isBeast ? furMat : isColossal ? exposedMuscleMat : skinMat;
    const thighRTop = isColossal ? 0.92 * s : 0.7 * s;
    const thighRBot = isColossal ? 0.84 * s : 0.52 * s;
    const calfRTop = isColossal ? 0.96 * s : isFemale ? 0.44 * s : 0.52 * s;
    const calfRBot = isColossal ? 0.92 * s : isFemale ? 0.3 * s : 0.38 * s;

    const thigh = new THREE.Mesh(new THREE.CylinderGeometry(thighRTop, thighRBot, 2.75 * s, 10), legMat);
    thigh.position.y = -1.3 * s;
    thigh.castShadow = castShadow;
    legPivot.add(thigh);

    const knee = new THREE.Mesh(new THREE.SphereGeometry(0.54 * s, 8, 8), legMat);
    knee.position.y = -2.65 * s;
    legPivot.add(knee);

    const calf = new THREE.Mesh(new THREE.CylinderGeometry(calfRTop, calfRBot, 2.55 * s, 10), legMat);
    calf.position.y = -3.8 * s;
    calf.castShadow = castShadow;
    legPivot.add(calf);

    const foot = new THREE.Mesh(
      new THREE.BoxGeometry(isColossal ? 1.35 * s : 0.9 * s, 0.48 * s, 1.48 * s),
      isBeast ? skinMat : legMat
    );
    foot.position.set(0, -4.85 * s, 0.28 * s);
    legPivot.add(foot);

    if (isArmored) {
      const thighArmor = new THREE.Mesh(createArmoredPlateGeo(1.22 * s, 2.1 * s, 1.15 * s, 0.09 * s), armorMat);
      thighArmor.position.set(0, -1.25 * s, 0.16 * s);
      legPivot.add(thighArmor);
      const kneeArmor = new THREE.Mesh(createArmoredPlateGeo(1.0 * s, 0.85 * s, 0.7 * s, 0.08 * s), armorMat);
      kneeArmor.position.set(0, -2.65 * s, 0.45 * s);
      legPivot.add(kneeArmor);
      const shinPlate = new THREE.Mesh(createArmoredPlateGeo(1.08 * s, 2.25 * s, 1.1 * s, 0.09 * s), armorMat);
      shinPlate.position.set(0, -3.8 * s, 0.18 * s);
      legPivot.add(shinPlate);
    } else if (isFemale) {
      const shinCrystal = new THREE.Mesh(new THREE.CylinderGeometry(0.5 * s, 0.36 * s, 2.1 * s, 8), crystalHardMat);
      shinCrystal.position.set(0, -3.75 * s, 0);
      legPivot.add(shinCrystal);
    } else if (isJaw) {
      for (const cx of [-0.24 * s, 0, 0.24 * s]) {
        const toeClaw = new THREE.Mesh(new THREE.ConeGeometry(0.11 * s, 0.65 * s, 4), armorMat);
        toeClaw.rotation.x = Math.PI / 2;
        toeClaw.position.set(cx, -4.9 * s, 1.15 * s);
        legPivot.add(toeClaw);
      }
    }

    bodyPivot.add(legPivot);
    return legPivot;
  };
  const leftLegPivot = makeLeg(-1);
  const rightLegPivot = makeLeg(1);

  // =========================================================================
  // HEAD & CANON FACIAL ANATOMY (Distinct Faces for All Nine Titans!)
  // =========================================================================
  const headPivot = new THREE.Group();
  headPivot.position.set(0, 9.3 * s, isBeast ? 0.35 * s : 0.1 * s);
  bodyPivot.add(headPivot);

  const neck = new THREE.Mesh(
    new THREE.CylinderGeometry(0.76 * s, 0.98 * s, 1.25 * s, 10),
    isBeast ? furMat : isColossal ? exposedMuscleMat : skinMat
  );
  neck.position.y = 0.42 * s;
  headPivot.add(neck);

  // Nape Weak Point Target
  const napeMat = new THREE.MeshStandardMaterial({
    color: 0xf43f5e,
    emissive: 0xf43f5e,
    emissiveIntensity: 2.3,
    roughness: 0.3,
  });
  const napeMesh = new THREE.Mesh(new THREE.BoxGeometry(0.96 * s, 0.96 * s, 0.48 * s), napeMat);
  napeMesh.position.set(0, 0.45 * s, -0.82 * s);
  headPivot.add(napeMesh);

  const napeTarget = new THREE.Object3D();
  napeTarget.position.set(0, 0.45 * s, -0.96 * s);
  headPivot.add(napeTarget);

  const cranium = new THREE.Mesh(
    new THREE.SphereGeometry(1.15 * s, 16, 14),
    isColossal ? exposedMuscleMat : skinMat
  );
  cranium.position.y = 1.68 * s;
  cranium.scale.set(0.9, 1.15, 0.96);
  cranium.castShadow = castShadow;
  headPivot.add(cranium);

  const browRidge = new THREE.Mesh(
    new THREE.BoxGeometry(1.44 * s, 0.28 * s, 0.48 * s),
    isColossal ? exposedMuscleMat : skinMat
  );
  browRidge.position.set(0, 2.04 * s, 0.92 * s);
  browRidge.rotation.x = 0.14;
  headPivot.add(browRidge);

  // Pointed Elf-like Titan Ears (Attack / Beast / Founding)
  if (kind === 'attack' || kind === 'beast' || kind === 'founding') {
    for (const ex of [-1.14 * s, 1.14 * s]) {
      const ear = new THREE.Mesh(new THREE.ConeGeometry(0.22 * s, 0.95 * s, 5), skinMat);
      ear.position.set(ex, 1.75 * s, 0.04 * s);
      ear.rotation.z = ex < 0 ? 1.2 : -1.2;
      ear.rotation.y = ex < 0 ? -0.25 : 0.25;
      headPivot.add(ear);
    }
  }

  // DISTINCT FACE SCULPTS PER TITAN
  if (isArmored) {
    // Reiner's Angular Bone Armor Helmet Face + Split Cheek Muscle Gaps + Breathing Mouth Grill
    const foreheadArmor = new THREE.Mesh(createArmoredPlateGeo(1.75 * s, 0.72 * s, 0.9 * s, 0.08 * s), armorMat);
    foreheadArmor.position.set(0, 2.18 * s, 0.62 * s);
    headPivot.add(foreheadArmor);

    for (const cx of [-0.62 * s, 0.62 * s]) {
      const cheekPlate = new THREE.Mesh(createArmoredPlateGeo(0.75 * s, 0.95 * s, 0.85 * s, 0.07 * s), armorMat);
      cheekPlate.position.set(cx, 1.38 * s, 0.66 * s);
      cheekPlate.rotation.y = cx < 0 ? -0.24 : 0.24;
      headPivot.add(cheekPlate);
    }

    const chinArmor = new THREE.Mesh(createArmoredPlateGeo(1.18 * s, 0.55 * s, 0.78 * s, 0.08 * s), armorMat);
    chinArmor.position.set(0, 0.86 * s, 0.74 * s);
    headPivot.add(chinArmor);
  } else if (isJaw) {
    // Galliard / Porco Jaw Titan: Massive White Bone Skull Mask + Jagged Hinged Armored Lower Jaw
    const skullMask = new THREE.Mesh(createArmoredPlateGeo(1.88 * s, 0.88 * s, 1.15 * s, 0.09 * s), armorMat);
    skullMask.position.set(0, 1.9 * s, 0.62 * s);
    headPivot.add(skullMask);

    const lowerBoneJaw = new THREE.Mesh(createArmoredPlateGeo(1.76 * s, 0.62 * s, 1.15 * s, 0.08 * s), armorMat);
    lowerBoneJaw.position.set(0, 0.96 * s, 0.72 * s);
    headPivot.add(lowerBoneJaw);

    // Interlocking Jagged Bone Fangs along the Outer Jaw Mask
    for (let fi = -2; fi <= 2; fi++) {
      const topFang = new THREE.Mesh(new THREE.ConeGeometry(0.12 * s, 0.36 * s, 4), armorMat);
      topFang.position.set(fi * 0.28 * s, 1.36 * s, 1.16 * s);
      topFang.rotation.x = Math.PI;
      headPivot.add(topFang);

      const botFang = new THREE.Mesh(new THREE.ConeGeometry(0.11 * s, 0.32 * s, 4), armorMat);
      botFang.position.set((fi + 0.5) * 0.26 * s, 1.22 * s, 1.14 * s);
      headPivot.add(botFang);
    }
  } else if (isWarhammer) {
    // War Hammer Titan: Smooth Porcelain Hood Cowl + Executioner Vertical Visor Grill + Horned Ear Fins
    const cowl = new THREE.Mesh(new THREE.SphereGeometry(1.24 * s, 16, 14), armorMat);
    cowl.scale.set(0.92, 1.18, 1.0);
    cowl.position.set(0, 1.72 * s, 0.02 * s);
    headPivot.add(cowl);

    for (const hx of [-1.05 * s, 1.05 * s]) {
      const earFin = new THREE.Mesh(new THREE.ConeGeometry(0.24 * s, 1.15 * s, 4), armorMat);
      earFin.position.set(hx, 2.05 * s, -0.08 * s);
      earFin.rotation.z = hx < 0 ? 0.65 : -0.65;
      headPivot.add(earFin);
    }

    // Dark recessed face slit beneath vertical porcelain visor bars
    const visorVoid = new THREE.Mesh(
      new THREE.BoxGeometry(1.32 * s, 0.92 * s, 0.45 * s),
      new THREE.MeshBasicMaterial({ color: 0x1e090a })
    );
    visorVoid.position.set(0, 1.54 * s, 0.94 * s);
    headPivot.add(visorVoid);

    for (let bar = -2; bar <= 2; bar++) {
      const grillBar = new THREE.Mesh(new THREE.BoxGeometry(0.11 * s, 0.98 * s, 0.2 * s), armorMat);
      grillBar.position.set(bar * 0.26 * s, 1.54 * s, 1.15 * s);
      headPivot.add(grillBar);
    }
  } else if (isColossal) {
    // Colossal Skull-Striated Face + White Tendon Columns flanking mouth
    for (const tx of [-0.56 * s, -0.38 * s, 0.38 * s, 0.56 * s]) {
      const jawTendon = new THREE.Mesh(new THREE.CylinderGeometry(0.08 * s, 0.12 * s, 0.72 * s, 6), tendonMat);
      jawTendon.position.set(tx, 1.2 * s, 0.85 * s);
      headPivot.add(jawTendon);
    }
  }

  // Canon Layered Flowing Hair
  addCanonTitanHair(headPivot, kind, s, hairMat);

  // Eyes (distinct glow & brow shape per Nine Titans!)
  const eyesGroup = new THREE.Group();
  headPivot.add(eyesGroup);
  const socketMat = new THREE.MeshBasicMaterial({ color: 0x160d0c });
  const eyeWhiteMat = new THREE.MeshBasicMaterial({ color: 0xf8fafc });

  const irisColorMap: Record<TitanKind, number> = {
    normal: 0x0f172a,
    abnormal: 0xdc2626,
    attack: 0x10b981,
    colossal: 0xf59e0b,
    armored: 0xf59e0b,
    female: 0x38bdf8,
    beast: 0xef4444,
    jaw: 0xfbbf24,
    cart: 0x0f172a,
    warhammer: 0xf8fafc,
    founding: 0xa855f7,
  };
  const irisMat = new THREE.MeshBasicMaterial({ color: irisColorMap[kind] });

  for (const ex of [-0.38 * s, 0.38 * s]) {
    const socket = new THREE.Mesh(new THREE.SphereGeometry(0.28 * s, 8, 8), socketMat);
    socket.position.set(ex, 1.84 * s, 0.85 * s);
    eyesGroup.add(socket);

    const ew = new THREE.Mesh(new THREE.SphereGeometry(0.2 * s, 8, 8), eyeWhiteMat);
    ew.position.set(ex, 1.84 * s, 0.95 * s);
    eyesGroup.add(ew);

    const ep = new THREE.Mesh(new THREE.SphereGeometry(0.11 * s, 6, 6), irisMat);
    ep.position.set(ex, 1.84 * s, 1.11 * s);
    eyesGroup.add(ep);
  }

  const blindXGroup = new THREE.Group();
  blindXGroup.visible = false;
  headPivot.add(blindXGroup);
  const blindMat = new THREE.MeshBasicMaterial({ color: 0xdc2626 });
  for (const ex of [-0.38 * s, 0.38 * s]) {
    const slash = new THREE.Mesh(new THREE.BoxGeometry(0.55 * s, 0.1 * s, 0.12 * s), blindMat);
    slash.position.set(ex, 1.84 * s, 1.08 * s);
    slash.rotation.z = ex < 0 ? 0.5 : -0.5;
    blindXGroup.add(slash);
  }

  // Signature Slit-Cheek Demon Mouth & Exposed Teeth (Attack / Female / Colossal / Armored / Beast)
  if (!isWarhammer && !isJaw) {
    const mouthW = kind === 'attack' || isFemale ? 1.38 * s : 0.96 * s;
    const mouthHole = new THREE.Mesh(
      new THREE.BoxGeometry(mouthW, 0.44 * s, 0.42 * s),
      new THREE.MeshBasicMaterial({ color: 0x260606 })
    );
    mouthHole.position.set(0, 1.14 * s, 0.86 * s);
    headPivot.add(mouthHole);

    const toothMat = new THREE.MeshStandardMaterial({ color: 0xf1f5f9, roughness: 0.4 });
    const count = kind === 'attack' || isFemale ? 4 : 3;
    for (let ti = -count; ti <= count; ti++) {
      const topTooth = new THREE.Mesh(new THREE.BoxGeometry(0.11 * s, 0.15 * s, 0.12 * s), toothMat);
      topTooth.position.set(ti * 0.13 * s, 1.26 * s, 1.04 * s);
      headPivot.add(topTooth);

      const botTooth = new THREE.Mesh(new THREE.BoxGeometry(0.11 * s, 0.14 * s, 0.12 * s), toothMat);
      botTooth.position.set(ti * 0.13 * s, 1.02 * s, 1.02 * s);
      headPivot.add(botTooth);
    }

    // Exposed Cheek Striated Muscle Bands (Attack Titan & Female Titan)
    if (kind === 'attack' || isFemale) {
      for (const sx of [-0.62 * s, 0.62 * s]) {
        const cheekSinew = new THREE.Mesh(new THREE.BoxGeometry(0.28 * s, 0.38 * s, 0.25 * s), exposedMuscleMat);
        cheekSinew.position.set(sx, 1.14 * s, 0.92 * s);
        headPivot.add(cheekSinew);
      }
    }
  }

  const eyeTarget = new THREE.Object3D();
  eyeTarget.position.set(0, 1.82 * s, 1.12 * s);
  headPivot.add(eyeTarget);

  // =========================================================================
  // ARMS, HARDENED FISTS, CLAWS & WAR HAMMER WEAPON
  // =========================================================================
  const armScale = isBeast ? 1.62 : isJaw ? 1.18 : 1.0;
  const armMat = isBeast ? furMat : isColossal ? exposedMuscleMat : skinMat;
  const shoulderX = isBeast ? 1.95 * s : isFemale ? 1.85 * s : 2.35 * s;

  const makeArm = (side: -1 | 1) => {
    const armPivot = new THREE.Group();
    armPivot.position.set(side * shoulderX, 8.85 * s, 0);

    // Deltoid / Shoulder Pauldron
    if (isArmored) {
      const pauldron = new THREE.Mesh(createArmoredPlateGeo(1.75 * s, 1.55 * s, 1.75 * s, 0.12 * s), armorMat);
      pauldron.position.set(side * 0.15 * s, 0.15 * s, 0);
      pauldron.rotation.z = side * -0.25;
      armPivot.add(pauldron);
    } else {
      const deltoid = new THREE.Mesh(new THREE.SphereGeometry(0.78 * s, 10, 8), armMat);
      deltoid.position.y = -0.1 * s;
      armPivot.add(deltoid);
    }

    const upper = new THREE.Mesh(
      new THREE.CylinderGeometry(isBeast ? 0.44 * s : 0.56 * s, 0.44 * s, 2.65 * s * armScale, 10),
      armMat
    );
    upper.position.y = -1.25 * s * armScale;
    upper.castShadow = castShadow;
    armPivot.add(upper);

    const forearm = new THREE.Mesh(
      new THREE.CylinderGeometry(0.45 * s, 0.34 * s, 2.45 * s * armScale, 10),
      armMat
    );
    forearm.position.y = -3.48 * s * armScale;
    forearm.castShadow = castShadow;
    armPivot.add(forearm);

    if (isArmored) {
      const bracer = new THREE.Mesh(createArmoredPlateGeo(1.05 * s, 2.25 * s, 1.05 * s, 0.08 * s), armorMat);
      bracer.position.set(0, -3.48 * s, 0.12 * s);
      armPivot.add(bracer);
    } else if (isFemale) {
      const crystalGauntlet = new THREE.Mesh(new THREE.CylinderGeometry(0.54 * s, 0.46 * s, 2.2 * s, 6), crystalHardMat);
      crystalGauntlet.position.set(0, -3.55 * s, 0);
      armPivot.add(crystalGauntlet);
    } else if (isJaw) {
      // Hardened Bone Forearm Armor & Scythe Claws
      const boneBrace = new THREE.Mesh(createArmoredPlateGeo(0.95 * s, 2.1 * s, 0.85 * s, 0.07 * s), armorMat);
      boneBrace.position.set(0, -3.5 * s * armScale, 0.12 * s);
      armPivot.add(boneBrace);
      for (let c = -1; c <= 1; c++) {
        const claw = new THREE.Mesh(new THREE.ConeGeometry(0.14 * s, 1.35 * s, 4), armorMat);
        claw.position.set(c * 0.22 * s, -5.35 * s * armScale, 0.3 * s);
        claw.rotation.x = Math.PI - 0.25;
        armPivot.add(claw);
      }
    }

    // War Hammer Titan: Giant Hardened Two-Handed War Hammer with Spikes!
    if (isWarhammer && side === 1) {
      const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.24 * s, 0.26 * s, 10.2 * s, 8), armorMat);
      shaft.rotation.x = Math.PI / 2;
      shaft.position.set(0, -4.68 * s, 3.6 * s);
      armPivot.add(shaft);

      const hammerHead = new THREE.Mesh(createArmoredPlateGeo(2.0 * s, 3.2 * s, 2.2 * s, 0.15 * s), armorMat);
      hammerHead.position.set(0, -4.68 * s, 8.2 * s);
      armPivot.add(hammerHead);

      const backSpike = new THREE.Mesh(new THREE.ConeGeometry(0.55 * s, 1.8 * s, 4), armorMat);
      backSpike.rotation.x = -Math.PI / 2;
      backSpike.position.set(0, -4.68 * s, 9.8 * s);
      armPivot.add(backSpike);
    }

    const hand = new THREE.Mesh(
      new THREE.SphereGeometry(0.56 * s, 8, 8),
      isFemale ? crystalHardMat : isBeast ? skinMat : armMat
    );
    hand.position.y = -4.72 * s * armScale;
    armPivot.add(hand);

    bodyPivot.add(armPivot);
    return armPivot;
  };
  const leftArmPivot = makeArm(-1);
  const rightArmPivot = makeArm(1);

  const handTarget = new THREE.Object3D();
  handTarget.position.set(0, -4.72 * s * armScale, 0);
  rightArmPivot.add(handTarget);

  return {
    id,
    kind,
    scale,
    group,
    bodyPivot,
    headPivot,
    leftLegPivot,
    rightLegPivot,
    leftArmPivot,
    rightArmPivot,
    handTarget,
    napeMesh,
    napeTarget,
    eyeTarget,
    eyesGroup,
    blindXGroup,
    vx: 0,
    vz: 0,
    vy: 0,
    hp: maxHp,
    maxHp,
    walkPhase: Math.random() * Math.PI * 2,
    blindTimer: 0,
    staggerTimer: 0,
    attackCooldown: 1.0 + Math.random(),
    leapTimer: 3.0 + Math.random() * 2.5,
    abilityTimer: 3.5 + Math.random() * 2.5,
    grabbingPlayer: false,
    dyingTimer: 0,
    dead: false,
  };
}
