import * as THREE from 'three';
import { ProceduralTextureSet } from './textures';

export interface FirstPersonRig {
  root: THREE.Group;
  leftArm: THREE.Group;
  rightArm: THREE.Group;
  leftBlade: THREE.Group;
  rightBlade: THREE.Group;
  slashPlane: THREE.Mesh;
  crossSlashPlane: THREE.Mesh;
  slashGlowPlane: THREE.Mesh;
  update: (
    dt: number,
    speed: number,
    slashTimer: number,
    isSpinSlash: boolean,
    reloadTimer: number,
    bladeDurability: number,
    visible: boolean
  ) => void;
}

export function createFirstPersonRig(textures: ProceduralTextureSet): FirstPersonRig {
  const root = new THREE.Group();

  const jacketMat = new THREE.MeshStandardMaterial({
    color: 0x6b4b35,
    roughness: 0.84,
    metalness: 0.04,
  });
  const cloakMat = new THREE.MeshStandardMaterial({
    color: 0x165e39,
    roughness: 0.88,
    metalness: 0.02,
  });
  const cuffMat = new THREE.MeshStandardMaterial({
    color: 0x261d17,
    roughness: 0.7,
    metalness: 0.14,
  });
  const gloveMat = new THREE.MeshStandardMaterial({
    color: 0x181b22,
    roughness: 0.65,
    metalness: 0.18,
  });
  const gripMat = new THREE.MeshStandardMaterial({
    color: 0x334155,
    roughness: 0.28,
    metalness: 0.9,
  });
  const triggerMat = new THREE.MeshStandardMaterial({
    color: 0x94a3b8,
    roughness: 0.22,
    metalness: 0.94,
  });
  const steelMat = new THREE.MeshPhysicalMaterial({
    map: textures.brushedSteel,
    color: 0xf8fafc,
    roughness: 0.12,
    metalness: 0.96,
    anisotropy: 0.85,
    clearcoat: 0.8,
    clearcoatRoughness: 0.1,
  });
  const edgeMat = new THREE.MeshBasicMaterial({
    color: 0xe0f2fe,
  });

  const makeArmAssembly = (side: -1 | 1) => {
    const arm = new THREE.Group();
    arm.position.set(side * 0.34, -0.28, -0.42);

    // Survey Corps Emerald Cloak Shoulder Edge + Jacket Sleeve
    const cloakEdge = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.12, 0.26), cloakMat);
    cloakEdge.position.set(side * 0.045, -0.04, 0.26);
    cloakEdge.rotation.z = side * -0.28;
    arm.add(cloakEdge);

    const sleeve = new THREE.Mesh(new THREE.CylinderGeometry(0.056, 0.072, 0.36, 12), jacketMat);
    sleeve.rotation.x = Math.PI / 2 - 0.32;
    sleeve.position.set(0, -0.05, 0.15);
    arm.add(sleeve);

    const cuff = new THREE.Mesh(new THREE.CylinderGeometry(0.059, 0.059, 0.075, 12), cuffMat);
    cuff.rotation.x = Math.PI / 2 - 0.32;
    cuff.position.set(0, -0.015, 0.03);
    arm.add(cuff);

    // Gloved Hand
    const hand = new THREE.Mesh(new THREE.BoxGeometry(0.088, 0.092, 0.115), gloveMat);
    hand.position.set(0, 0.01, -0.02);
    arm.add(hand);

    // ODM Trigger Handle + Dual Brake / Gas Levers + Hose Collar
    const grip = new THREE.Mesh(new THREE.BoxGeometry(0.044, 0.14, 0.068), gripMat);
    grip.position.set(0, 0.02, -0.04);
    grip.rotation.x = -0.25;
    arm.add(grip);

    const wireTrigger = new THREE.Mesh(new THREE.BoxGeometry(0.016, 0.045, 0.045), triggerMat);
    wireTrigger.position.set(0, 0.005, -0.085);
    wireTrigger.rotation.x = 0.35;
    arm.add(wireTrigger);

    const gasLever = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.055, 0.04), triggerMat);
    gasLever.position.set(0, -0.035, -0.072);
    arm.add(gasLever);

    const guard = new THREE.Mesh(new THREE.BoxGeometry(0.038, 0.058, 0.17), gripMat);
    guard.position.set(0, 0.078, -0.085);
    arm.add(guard);

    const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.024, 0.06, 8), triggerMat);
    collar.position.set(side * 0.03, -0.04, 0.02);
    collar.rotation.z = side * 0.4;
    arm.add(collar);

    // Ultra-Hard Steel Segmented Blade + Razor Edge Highlight + 5 Break-Away Snap Grooves
    const bladeGroup = new THREE.Group();
    bladeGroup.position.set(0, 0.092, -0.49);

    const bladeBody = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.054, 0.84), steelMat);
    bladeGroup.add(bladeBody);

    const razorEdge = new THREE.Mesh(new THREE.BoxGeometry(0.004, 0.012, 0.84), edgeMat);
    razorEdge.position.y = -0.029;
    bladeGroup.add(razorEdge);

    for (let g = 0; g < 5; g++) {
      const notch = new THREE.Mesh(new THREE.BoxGeometry(0.015, 0.056, 0.006), cuffMat);
      notch.position.z = -0.34 + g * 0.15;
      notch.rotation.x = 0.28;
      bladeGroup.add(notch);
    }

    // Tapered Tanto Tip
    const tip = new THREE.Mesh(new THREE.ConeGeometry(0.029, 0.13, 4), steelMat);
    tip.rotation.x = -Math.PI / 2;
    tip.rotation.z = Math.PI / 4;
    tip.scale.set(0.32, 1, 1.0);
    tip.position.z = -0.48;
    bladeGroup.add(tip);

    arm.add(bladeGroup);
    root.add(arm);
    return { arm, bladeGroup };
  };

  const left = makeArmAssembly(-1);
  const right = makeArmAssembly(1);

  // Primary Crescent Slash Arc + Crossed Spin Arc + Additive Bloom Aura Arc
  const slashMat = new THREE.MeshBasicMaterial({
    color: 0xf8fafc,
    transparent: true,
    opacity: 0,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const slashPlane = new THREE.Mesh(new THREE.RingGeometry(0.24, 0.56, 28, 1, -1.0, 2.0), slashMat);
  slashPlane.position.set(0, -0.04, -0.68);
  root.add(slashPlane);

  const crossSlashMat = new THREE.MeshBasicMaterial({
    color: 0xfef08a,
    transparent: true,
    opacity: 0,
    side: THREE.DoubleSide,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const crossSlashPlane = new THREE.Mesh(new THREE.RingGeometry(0.28, 0.62, 28, 1, 0.5, 2.1), crossSlashMat);
  crossSlashPlane.position.set(0, -0.03, -0.71);
  root.add(crossSlashPlane);

  const slashGlowMat = new THREE.MeshBasicMaterial({
    color: 0x67e8f9,
    transparent: true,
    opacity: 0,
    side: THREE.DoubleSide,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const slashGlowPlane = new THREE.Mesh(new THREE.RingGeometry(0.18, 0.66, 28, 1, -1.1, 2.2), slashGlowMat);
  slashGlowPlane.position.set(0, -0.04, -0.7);
  root.add(slashGlowPlane);

  let swayTime = 0;

  return {
    root,
    leftArm: left.arm,
    rightArm: right.arm,
    leftBlade: left.bladeGroup,
    rightBlade: right.bladeGroup,
    slashPlane,
    crossSlashPlane,
    slashGlowPlane,
    update(dt, speed, slashTimer, isSpinSlash, reloadTimer, bladeDurability, visible) {
      root.visible = visible;
      if (!visible) return;

      swayTime += dt * (2.5 + Math.min(8, speed * 0.12));
      const bobX = Math.cos(swayTime) * 0.012 * Math.min(1.5, speed * 0.03);
      const bobY = Math.sin(swayTime * 2) * 0.012 * Math.min(1.5, speed * 0.03);

      const hasBlade = bladeDurability > 0 && reloadTimer <= 0;
      left.bladeGroup.visible = hasBlade;
      right.bladeGroup.visible = hasBlade;

      if (reloadTimer > 0) {
        const p = Math.sin((reloadTimer / 0.42) * Math.PI);
        left.arm.position.set(-0.34, -0.28 - p * 0.22, -0.42 + p * 0.12);
        right.arm.position.set(0.34, -0.28 - p * 0.22, -0.42 + p * 0.12);
        left.arm.rotation.set(-p * 0.9, 0.15, 0.25);
        right.arm.rotation.set(-p * 0.9, -0.15, -0.25);
        slashMat.opacity = 0;
        crossSlashMat.opacity = 0;
        slashGlowMat.opacity = 0;
        return;
      }

      if (slashTimer > 0) {
        const progress = 1 - Math.min(1, slashTimer / 0.24);
        const swing = Math.sin(progress * Math.PI);

        left.arm.position.set(-0.34 + swing * 0.28, -0.24 + swing * 0.1, -0.48 - swing * 0.14);
        right.arm.position.set(0.34 - swing * 0.28, -0.24 + swing * 0.1, -0.48 - swing * 0.14);

        left.arm.rotation.set(-0.55 * swing, -1.25 * swing, 0.9 * swing);
        right.arm.rotation.set(-0.55 * swing, 1.25 * swing, -0.9 * swing);

        const spinCol = isSpinSlash ? 0xf43f5e : 0x38bdf8;
        slashMat.color.setHex(isSpinSlash ? 0xfda4af : 0xf8fafc);
        slashMat.opacity = (1 - progress) * 0.88;
        crossSlashMat.opacity = isSpinSlash ? (1 - progress) * 0.78 : 0;
        slashGlowMat.color.setHex(spinCol);
        slashGlowMat.opacity = (1 - progress) * 0.72;

        const rotZ = progress * (isSpinSlash ? Math.PI * 2.5 : 1.55) - 0.65;
        slashPlane.rotation.z = rotZ;
        crossSlashPlane.rotation.z = -rotZ * 1.15;
        slashGlowPlane.rotation.z = rotZ + 0.12;
      } else {
        const tuck = Math.min(1, speed / 45);
        left.arm.position.set(-0.34 + bobX, -0.28 + bobY, -0.42 + tuck * 0.05);
        right.arm.position.set(0.34 - bobX, -0.28 + bobY, -0.42 + tuck * 0.05);

        left.arm.rotation.set(0.12 - tuck * 0.22, 0.18, 0.14);
        right.arm.rotation.set(0.12 - tuck * 0.22, -0.18, -0.14);
        slashMat.opacity = 0;
        crossSlashMat.opacity = 0;
        slashGlowMat.opacity = 0;
      }
    },
  };
}
