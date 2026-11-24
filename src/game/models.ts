import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import {
  COUNTER_SURFACE_Y,
  PRODUCT_CATALOG,
  RESTOCK_ZONES,
  SHIRT_OPTIONS,
} from './kioscoLogic';
import type { ProceduralTextures } from './textures';
import type { NpcArchetype, PlayerProfile, ProductId, RestockZoneId } from './types';

export function createProductMesh(
  productId: ProductId,
  textures: ProceduralTextures
): THREE.Group {
  const def = PRODUCT_CATALOG[productId];
  const group = new THREE.Group();
  const labelTex = textures.productLabels[productId];

  if (productId === 'carne') {
    const [w, h, d] = def.size;
    const trayMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.45 });
    const tray = new THREE.Mesh(new THREE.BoxGeometry(w, h * 0.45, d), trayMat);
    tray.position.y = -h * 0.25;
    tray.castShadow = true;
    group.add(tray);

    const meatMat = new THREE.MeshStandardMaterial({
      color: 0x7f1d1d,
      roughness: 0.34,
      metalness: 0.06,
    });
    const cut = new THREE.Mesh(new THREE.BoxGeometry(w * 0.82, h * 0.56, d * 0.78), meatMat);
    cut.position.y = h * 0.06;
    cut.castShadow = true;
    group.add(cut);

    const sticker = new THREE.Mesh(
      new THREE.PlaneGeometry(w * 0.56, d * 0.44),
      new THREE.MeshStandardMaterial({ map: labelTex, roughness: 0.3 })
    );
    sticker.rotation.x = -Math.PI / 2;
    sticker.position.y = h * 0.36;
    group.add(sticker);
    return group;
  }

  if (def.shape === 'bottle') {
    const r = def.size[0] * 0.48;
    const h = def.size[1];
    const bodyMat = new THREE.MeshPhysicalMaterial({
      color:
        productId === 'gaseosa'
          ? 0x2a0f08
          : productId === 'cafe'
          ? 0x3b1f14
          : 0x8bd3f7,
      roughness: 0.14,
      metalness: 0.05,
      clearcoat: 0.85,
      clearcoatRoughness: 0.08,
    });
    const body = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 0.96, h * 0.65, 16), bodyMat);
    body.position.y = -h * 0.17;
    body.castShadow = true;
    group.add(body);

    const labelMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: labelTex,
      roughness: 0.42,
      metalness: 0.06,
    });
    const label = new THREE.Mesh(
      new THREE.CylinderGeometry(r * 1.03, r * 1.03, h * 0.36, 16),
      labelMat
    );
    label.position.y = -h * 0.15;
    group.add(label);

    const neck = new THREE.Mesh(
      new THREE.CylinderGeometry(r * 0.38, r * 0.95, h * 0.22, 14),
      bodyMat
    );
    neck.position.y = h * 0.27;
    neck.castShadow = true;
    group.add(neck);

    const capMat = new THREE.MeshStandardMaterial({
      color: def.accentColor,
      roughness: 0.42,
      metalness: 0.25,
    });
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.44, r * 0.44, h * 0.12, 12), capMat);
    cap.position.y = h * 0.44;
    group.add(cap);
  } else if (def.shape === 'pouch') {
    const [w, h, d] = def.size;
    const pouchMat = new THREE.MeshStandardMaterial({
      color: def.primaryColor,
      roughness: 0.56,
      metalness: 0.05,
    });
    const body = new THREE.Mesh(new THREE.BoxGeometry(w, h * 0.84, d), pouchMat);
    body.castShadow = true;
    group.add(body);

    const labelMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: labelTex,
      roughness: 0.32,
      metalness: 0.1,
    });
    const frontLabel = new THREE.Mesh(new THREE.BoxGeometry(w * 0.88, h * 0.6, d + 0.004), labelMat);
    group.add(frontLabel);

    const crimpMat = new THREE.MeshStandardMaterial({
      color: def.accentColor,
      roughness: 0.28,
      metalness: 0.25,
    });
    const topCrimp = new THREE.Mesh(new THREE.BoxGeometry(w * 1.02, h * 0.09, d * 0.35), crimpMat);
    topCrimp.position.y = h * 0.45;
    group.add(topCrimp);

    const botCrimp = new THREE.Mesh(new THREE.BoxGeometry(w * 1.02, h * 0.07, d * 0.6), crimpMat);
    botCrimp.position.y = -h * 0.45;
    group.add(botCrimp);
  } else {
    const [w, h, d] = def.size;
    const baseMat = new THREE.MeshStandardMaterial({
      color: def.primaryColor,
      roughness: 0.5,
      metalness: 0.06,
    });
    const main = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), baseMat);
    main.castShadow = true;
    group.add(main);

    const labelMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: labelTex,
      roughness: 0.28,
      metalness: 0.15,
    });
    const topFace = new THREE.Mesh(new THREE.BoxGeometry(w * 0.92, h * 0.86, d + 0.004), labelMat);
    group.add(topFace);

    if (productId === 'leche') {
      const gable = new THREE.Mesh(
        new THREE.ConeGeometry(w * 0.56, h * 0.28, 4),
        new THREE.MeshStandardMaterial({ color: '#eff6ff', roughness: 0.4 })
      );
      gable.rotation.y = Math.PI / 4;
      gable.position.y = h * 0.58;
      group.add(gable);
    }
  }

  return group;
}

export function createUnderCounterWeapon(): THREE.Group {
  const gun = new THREE.Group();
  const woodMat = new THREE.MeshStandardMaterial({
    color: 0x4b2a14,
    roughness: 0.64,
    metalness: 0.06,
  });
  const steelMat = new THREE.MeshStandardMaterial({
    color: 0x262a30,
    roughness: 0.26,
    metalness: 0.88,
  });
  const brassMat = new THREE.MeshStandardMaterial({
    color: 0xd4a338,
    roughness: 0.22,
    metalness: 0.9,
  });

  const grip = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.12, 0.2), woodMat);
  grip.position.set(0, -0.04, 0.16);
  grip.rotation.x = 0.28;
  grip.castShadow = true;
  gun.add(grip);

  const forend = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.045, 0.22), woodMat);
  forend.position.set(0, -0.02, -0.14);
  gun.add(forend);

  const receiver = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.075, 0.16), steelMat);
  receiver.position.set(0, 0.01, 0.03);
  receiver.castShadow = true;
  gun.add(receiver);

  const barrelGeo = new THREE.CylinderGeometry(0.016, 0.016, 0.42, 12);
  barrelGeo.rotateX(Math.PI / 2);
  const barrelL = new THREE.Mesh(barrelGeo, steelMat);
  barrelL.position.set(-0.016, 0.026, -0.22);
  barrelL.castShadow = true;
  gun.add(barrelL);

  const barrelR = new THREE.Mesh(barrelGeo, steelMat);
  barrelR.position.set(0.016, 0.026, -0.22);
  barrelR.castShadow = true;
  gun.add(barrelR);

  const guard = new THREE.Mesh(new THREE.TorusGeometry(0.024, 0.005, 8, 16, Math.PI * 1.2), brassMat);
  guard.position.set(0, -0.035, 0.04);
  guard.rotation.y = Math.PI / 2;
  gun.add(guard);

  const sight = new THREE.Mesh(new THREE.SphereGeometry(0.006, 8, 8), brassMat);
  sight.position.set(0, 0.046, -0.41);
  gun.add(sight);

  return gun;
}

export function createNameBadgeSprite(label: string): THREE.Sprite {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 64;
  const ctx = canvas.getContext('2d')!;
  ctx.clearRect(0, 0, 256, 64);
  ctx.fillStyle = 'rgba(12, 10, 9, 0.88)';
  ctx.strokeStyle = 'rgba(248, 113, 113, 0.9)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.roundRect(14, 10, 228, 44, 4);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#fef2f2';
  ctx.font = 'bold 22px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label.slice(0, 18), 128, 33);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: true });
  const sprite = new THREE.Sprite(mat);
  sprite.scale.set(0.72, 0.18, 1);
  sprite.position.set(0, 2.04, 0);
  return sprite;
}

export function createCharacterGroup(opts: {
  skinTone: string;
  hairColor: string;
  shirtPrimary: string;
  shirtSecondary: string;
  hasCap: boolean;
  capColor?: string;
  withMate?: boolean;
  isSuspicious?: boolean;
  isButcher?: boolean;
  hasBackpack?: boolean;
  hasPoncho?: boolean;
  hasBeard?: boolean;
  wideHat?: boolean;
  isGhost?: boolean;
  eyeColor?: number;
  nameBadge?: string;
  textures?: ProceduralTextures;
}): THREE.Group {
  const root = new THREE.Group();
  const tex = opts.textures;

  const skinMat = new THREE.MeshStandardMaterial({
    color: opts.skinTone,
    bumpMap: tex?.skinBump ?? null,
    bumpScale: 0.004,
    roughness: opts.isGhost ? 0.35 : 0.56,
    metalness: 0.02,
  });
  const shirtMat = new THREE.MeshStandardMaterial({
    color: opts.shirtPrimary,
    bumpMap: tex?.fabricBump ?? null,
    bumpScale: 0.008,
    roughness: 0.84,
    metalness: 0.03,
  });
  const jacketMat = new THREE.MeshStandardMaterial({
    color: opts.shirtSecondary,
    bumpMap: tex?.fabricBump ?? null,
    bumpScale: 0.011,
    roughness: 0.72,
    metalness: 0.06,
  });
  const pantsMat = new THREE.MeshStandardMaterial({
    color: opts.isGhost ? 0x64748b : 0xd8e0eb,
    map: opts.isGhost ? null : tex?.denimColor ?? null,
    bumpMap: tex?.fabricBump ?? null,
    bumpScale: 0.01,
    roughness: 0.82,
    metalness: 0.03,
  });
  const bootMat = new THREE.MeshStandardMaterial({ color: 0x181310, roughness: 0.38, metalness: 0.18 });
  const soleMat = new THREE.MeshStandardMaterial({ color: 0x09090b, roughness: 0.88, metalness: 0.04 });
  const hairMat = new THREE.MeshStandardMaterial({
    color: opts.hairColor,
    bumpMap: tex?.fabricBump ?? null,
    bumpScale: 0.009,
    roughness: 0.84,
    metalness: 0.04,
  });

  if (tex?.contactShadow && !opts.isGhost) {
    const shadowDisc = new THREE.Mesh(
      new THREE.PlaneGeometry(0.92, 0.92),
      new THREE.MeshBasicMaterial({
        map: tex.contactShadow,
        transparent: true,
        opacity: 0.75,
        depthWrite: false,
      })
    );
    shadowDisc.rotation.x = -Math.PI / 2;
    shadowDisc.position.y = 0.016;
    shadowDisc.raycast = () => {};
    root.add(shadowDisc);
  }

  const buildLeg = (sideX: number) => {
    const hipPivot = new THREE.Group();
    hipPivot.position.set(sideX, 0.84, 0);

    const thigh = new THREE.Mesh(new THREE.CapsuleGeometry(0.072, 0.28, 6, 12), pantsMat);
    thigh.scale.set(1.04, 1, 1.08);
    thigh.position.y = -0.2;
    thigh.castShadow = true;
    hipPivot.add(thigh);

    const kneePivot = new THREE.Group();
    kneePivot.position.set(0, -0.41, 0);

    const kneeCap = new THREE.Mesh(new THREE.SphereGeometry(0.062, 10, 8), pantsMat);
    kneePivot.add(kneeCap);

    const calf = new THREE.Mesh(new THREE.CapsuleGeometry(0.056, 0.25, 6, 12), pantsMat);
    calf.position.y = -0.17;
    calf.castShadow = true;
    kneePivot.add(calf);

    const cuff = new THREE.Mesh(new THREE.CylinderGeometry(0.063, 0.068, 0.055, 12), pantsMat);
    cuff.position.y = -0.31;
    kneePivot.add(cuff);

    const bootAnkle = new THREE.Mesh(new THREE.CylinderGeometry(0.054, 0.06, 0.08, 12), bootMat);
    bootAnkle.position.set(0, -0.355, 0);
    kneePivot.add(bootAnkle);

    const bootFoot = new THREE.Mesh(new THREE.CapsuleGeometry(0.055, 0.11, 6, 10), bootMat);
    bootFoot.rotation.x = Math.PI / 2;
    bootFoot.scale.set(0.95, 1.0, 0.82);
    bootFoot.position.set(0, -0.388, 0.045);
    bootFoot.castShadow = true;
    kneePivot.add(bootFoot);

    const bootSole = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.024, 0.22), soleMat);
    bootSole.position.set(0, -0.418, 0.045);
    kneePivot.add(bootSole);

    hipPivot.add(kneePivot);
    root.add(hipPivot);
    return { hipPivot, kneePivot };
  };

  const leftLeg = buildLeg(-0.105);
  const rightLeg = buildLeg(0.105);

  const torsoGroup = new THREE.Group();
  torsoGroup.position.set(0, 0.84, 0);

  const pelvis = new THREE.Mesh(new THREE.CylinderGeometry(0.175, 0.19, 0.14, 16), pantsMat);
  pelvis.scale.set(1.1, 1, 0.68);
  pelvis.position.set(0, 0.02, 0);
  torsoGroup.add(pelvis);

  const abdomen = new THREE.Mesh(new THREE.CylinderGeometry(0.185, 0.168, 0.26, 16), shirtMat);
  abdomen.scale.set(1.08, 1, 0.68);
  abdomen.position.set(0, 0.2, 0);
  abdomen.castShadow = true;
  torsoGroup.add(abdomen);

  const ribcage = new THREE.Mesh(new THREE.CylinderGeometry(0.225, 0.185, 0.32, 18), shirtMat);
  ribcage.scale.set(1.16, 1, 0.72);
  ribcage.position.set(0, 0.44, 0);
  ribcage.castShadow = true;
  torsoGroup.add(ribcage);

  const chestPec = new THREE.Mesh(new THREE.SphereGeometry(0.145, 12, 10), shirtMat);
  chestPec.scale.set(1.12, 0.84, 0.62);
  chestPec.position.set(0, 0.46, 0.042);
  torsoGroup.add(chestPec);

  const traps = new THREE.Mesh(new THREE.CapsuleGeometry(0.094, 0.34, 6, 12), jacketMat);
  traps.rotation.z = Math.PI / 2;
  traps.scale.set(0.95, 1, 0.78);
  traps.position.set(0, 0.555, -0.004);
  traps.castShadow = true;
  torsoGroup.add(traps);

  const belt = new THREE.Mesh(
    new THREE.CylinderGeometry(0.186, 0.186, 0.048, 18),
    new THREE.MeshStandardMaterial({ color: 0x291a16, roughness: 0.34, metalness: 0.25 })
  );
  belt.scale.set(1.12, 1, 0.7);
  belt.position.set(0, 0.06, 0);
  torsoGroup.add(belt);

  const collar = new THREE.Mesh(new THREE.TorusGeometry(0.084, 0.018, 8, 18), jacketMat);
  collar.rotation.x = Math.PI / 2 + 0.14;
  collar.position.set(0, 0.595, 0.005);
  torsoGroup.add(collar);

  for (const side of [-1, 1]) {
    const jacketPanel = new THREE.Mesh(new THREE.CylinderGeometry(0.088, 0.092, 0.45, 12), jacketMat);
    jacketPanel.scale.set(0.92, 1, 1.28);
    jacketPanel.position.set(side * 0.135, 0.34, 0.024);
    jacketPanel.castShadow = true;
    torsoGroup.add(jacketPanel);
  }

  const jacketBack = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.45, 0.12), jacketMat);
  jacketBack.position.set(0, 0.35, -0.072);
  torsoGroup.add(jacketBack);

  if (opts.isButcher) {
    const apronMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: tex?.apronBloodColor ?? null,
      roughness: 0.65,
    });
    const apron = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.72, 0.04), apronMat);
    apron.position.set(0, 0.12, 0.15);
    apron.castShadow = true;
    torsoGroup.add(apron);
  }

  if (opts.hasPoncho) {
    const poncho = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.44, 0.54, 18), jacketMat);
    poncho.scale.set(1.06, 1, 0.84);
    poncho.position.set(0, 0.34, 0);
    poncho.castShadow = true;
    torsoGroup.add(poncho);
  }

  if (opts.hasBackpack) {
    const pack = new THREE.Mesh(new THREE.CapsuleGeometry(0.14, 0.24, 6, 12), jacketMat);
    pack.scale.set(1.22, 1, 0.72);
    pack.position.set(0, 0.35, -0.2);
    pack.castShadow = true;
    torsoGroup.add(pack);
  }

  root.add(torsoGroup);

  const buildArm = (side: -1 | 1) => {
    const armPivot = new THREE.Group();
    armPivot.position.set(side * 0.242, 1.385, 0);

    const deltoid = new THREE.Mesh(new THREE.SphereGeometry(0.068, 12, 10), jacketMat);
    deltoid.scale.set(0.95, 1.1, 0.95);
    armPivot.add(deltoid);

    const upperArm = new THREE.Mesh(new THREE.CapsuleGeometry(0.052, 0.19, 6, 12), jacketMat);
    upperArm.position.y = -0.125;
    upperArm.castShadow = true;
    armPivot.add(upperArm);

    const elbowPivot = new THREE.Group();
    elbowPivot.position.set(0, -0.245, 0);

    const elbowJoint = new THREE.Mesh(new THREE.SphereGeometry(0.048, 10, 8), jacketMat);
    elbowPivot.add(elbowJoint);

    const forearm = new THREE.Mesh(new THREE.CapsuleGeometry(0.044, 0.18, 6, 12), jacketMat);
    forearm.position.y = -0.115;
    forearm.castShadow = true;
    elbowPivot.add(forearm);

    const wrist = new THREE.Mesh(new THREE.CylinderGeometry(0.034, 0.036, 0.045, 10), skinMat);
    wrist.position.y = -0.22;
    elbowPivot.add(wrist);

    const handPalm = new THREE.Mesh(new THREE.BoxGeometry(0.042, 0.075, 0.068), skinMat);
    handPalm.position.set(0, -0.268, 0.008);
    elbowPivot.add(handPalm);

    armPivot.add(elbowPivot);
    root.add(armPivot);
    return { armPivot, elbowPivot };
  };

  const leftArm = buildArm(-1);
  const rightArm = buildArm(1);

  if (opts.withMate) {
    // Companion holds a bright emergency flashlight in right hand
    const flashMat = new THREE.MeshStandardMaterial({ color: 0x27272a, roughness: 0.3, metalness: 0.8 });
    const fBody = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.026, 0.18, 10), flashMat);
    fBody.rotation.x = Math.PI / 2;
    fBody.position.set(0, -0.265, 0.09);
    rightArm.elbowPivot.add(fBody);
    const fLens = new THREE.Mesh(
      new THREE.CylinderGeometry(0.028, 0.028, 0.02, 10),
      new THREE.MeshBasicMaterial({ color: 0xfef3c7 })
    );
    fLens.rotation.x = Math.PI / 2;
    fLens.position.set(0, -0.265, 0.18);
    rightArm.elbowPivot.add(fLens);
    rightArm.armPivot.rotation.x = -0.3;
    rightArm.elbowPivot.rotation.x = -0.7;
  }

  // Head
  const headGroup = new THREE.Group();
  headGroup.position.set(0, 1.62, 0.01);

  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.056, 0.072, 0.16, 14), skinMat);
  neck.position.set(0, -0.125, -0.01);
  headGroup.add(neck);

  const cranium = new THREE.Mesh(new THREE.SphereGeometry(0.132, 18, 16), skinMat);
  cranium.scale.set(0.9, 1.0, 0.96);
  cranium.position.set(0, 0.02, -0.01);
  cranium.castShadow = true;
  headGroup.add(cranium);

  const jaw = new THREE.Mesh(new THREE.CylinderGeometry(0.104, 0.072, 0.115, 14), skinMat);
  jaw.scale.set(0.95, 1.0, 1.02);
  jaw.position.set(0, -0.055, 0.016);
  jaw.castShadow = true;
  headGroup.add(jaw);

  const chin = new THREE.Mesh(new THREE.SphereGeometry(0.052, 12, 10), skinMat);
  chin.scale.set(1.02, 0.72, 0.95);
  chin.position.set(0, -0.098, 0.062);
  headGroup.add(chin);

  for (const cx of [-0.068, 0.068]) {
    const cheek = new THREE.Mesh(new THREE.SphereGeometry(0.044, 10, 8), skinMat);
    cheek.scale.set(0.9, 0.78, 0.85);
    cheek.position.set(cx, -0.022, 0.085);
    headGroup.add(cheek);
  }

  for (const ex of [-0.122, 0.122]) {
    const ear = new THREE.Mesh(new THREE.SphereGeometry(0.028, 10, 8), skinMat);
    ear.scale.set(0.38, 1.05, 0.65);
    ear.position.set(ex, -0.012, -0.01);
    headGroup.add(ear);
  }

  const noseBridge = new THREE.Mesh(new THREE.BoxGeometry(0.022, 0.052, 0.032), skinMat);
  noseBridge.position.set(0, -0.002, 0.118);
  noseBridge.rotation.x = -0.25;
  headGroup.add(noseBridge);

  const noseTip = new THREE.Mesh(new THREE.SphereGeometry(0.017, 10, 8), skinMat);
  noseTip.scale.set(1.1, 0.85, 1.0);
  noseTip.position.set(0, -0.025, 0.132);
  headGroup.add(noseTip);

  const mouth = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.008, 0.038, 4, 8),
    new THREE.MeshStandardMaterial({
      color: opts.isGhost || opts.isButcher ? 0x180909 : 0x9b5349,
      roughness: 0.48,
    })
  );
  mouth.rotation.z = Math.PI / 2;
  mouth.position.set(0, -0.056, 0.114);
  headGroup.add(mouth);

  for (const side of [-1, 1]) {
    const brow = new THREE.Mesh(new THREE.CapsuleGeometry(0.007, 0.035, 4, 8), hairMat);
    brow.rotation.z = Math.PI / 2 - side * (opts.isSuspicious || opts.isGhost ? 0.24 : 0.1);
    brow.position.set(side * 0.043, 0.038, 0.117);
    headGroup.add(brow);
  }

  if (opts.hasBeard) {
    const jawBeard = new THREE.Mesh(new THREE.CylinderGeometry(0.095, 0.068, 0.065, 14), hairMat);
    jawBeard.scale.set(0.96, 1, 0.96);
    jawBeard.position.set(0, -0.082, 0.016);
    headGroup.add(jawBeard);
  }

  if (opts.isGhost) {
    // Deep sunken black sockets + tiny eerie glowing pinprick pupils
    const socketMat = new THREE.MeshBasicMaterial({ color: 0x030508 });
    const pinMat = new THREE.MeshBasicMaterial({ color: 0x67e8f9 });
    for (const ex of [-0.044, 0.044]) {
      const socket = new THREE.Mesh(new THREE.SphereGeometry(0.025, 10, 8), socketMat);
      socket.scale.set(1.15, 1.25, 0.6);
      socket.position.set(ex, 0.014, 0.108);
      headGroup.add(socket);

      const pin = new THREE.Mesh(new THREE.SphereGeometry(0.0065, 8, 8), pinMat);
      pin.position.set(ex, 0.015, 0.123);
      headGroup.add(pin);
    }
    mouth.scale.set(1.3, 2.2, 1.0);
  } else if (opts.isButcher || opts.isSuspicious) {
    const socketMat = new THREE.MeshBasicMaterial({ color: 0x090505 });
    const redIrisMat = new THREE.MeshBasicMaterial({ color: 0xef4444 });
    for (const ex of [-0.044, 0.044]) {
      const socket = new THREE.Mesh(new THREE.SphereGeometry(0.022, 10, 8), socketMat);
      socket.scale.set(1.1, 0.95, 0.58);
      socket.position.set(ex, 0.014, 0.109);
      headGroup.add(socket);
      const pin = new THREE.Mesh(new THREE.SphereGeometry(0.006, 8, 8), redIrisMat);
      pin.position.set(ex, 0.014, 0.122);
      headGroup.add(pin);
    }
  } else {
    const scleraMat = new THREE.MeshStandardMaterial({ color: 0xf4f4ef, roughness: 0.22 });
    const irisMat = new THREE.MeshStandardMaterial({ color: opts.eyeColor ?? 0x4b3621, roughness: 0.18 });
    const pupilMat = new THREE.MeshStandardMaterial({ color: 0x0e0d0c, roughness: 0.12 });
    for (const ex of [-0.043, 0.043]) {
      const sclera = new THREE.Mesh(new THREE.SphereGeometry(0.021, 10, 8), scleraMat);
      sclera.scale.set(1.18, 0.78, 0.58);
      sclera.position.set(ex, 0.014, 0.109);
      headGroup.add(sclera);

      const iris = new THREE.Mesh(new THREE.SphereGeometry(0.0125, 8, 8), irisMat);
      iris.scale.set(1, 1, 0.6);
      iris.position.set(ex, 0.014, 0.116);
      headGroup.add(iris);

      const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.007, 8, 8), pupilMat);
      pupil.position.set(ex, 0.014, 0.121);
      headGroup.add(pupil);
    }
  }

  const hairTop = new THREE.Mesh(
    new THREE.SphereGeometry(
      opts.hasCap || opts.wideHat ? 0.129 : 0.139,
      16,
      12,
      0,
      Math.PI * 2,
      0,
      Math.PI * 0.58
    ),
    hairMat
  );
  hairTop.scale.set(0.92, opts.hasCap || opts.wideHat ? 0.96 : 1.05, 0.99);
  hairTop.position.set(0, opts.hasCap || opts.wideHat ? 0.02 : 0.032, -0.015);
  headGroup.add(hairTop);

  if (opts.hasCap) {
    const capMat = new THREE.MeshStandardMaterial({
      color: opts.capColor ?? opts.shirtPrimary,
      bumpMap: tex?.fabricBump ?? null,
      bumpScale: 0.01,
      roughness: 0.68,
    });
    const capCrown = new THREE.Mesh(
      new THREE.SphereGeometry(0.146, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.54),
      capMat
    );
    capCrown.scale.set(0.95, 1.0, 1.04);
    capCrown.position.set(0, 0.048, -0.005);
    headGroup.add(capCrown);

    const visor = new THREE.Mesh(
      new THREE.CylinderGeometry(0.128, 0.135, 0.016, 16, 1, false, -Math.PI * 0.45, Math.PI * 0.9),
      capMat
    );
    visor.position.set(0, 0.072, 0.108);
    visor.rotation.x = 0.15;
    headGroup.add(visor);
  }

  root.add(headGroup);

  if (opts.nameBadge) {
    const badge = createNameBadgeSprite(opts.nameBadge);
    root.add(badge);
  }

  root.userData.animParts = {
    legL: leftLeg.hipPivot,
    legR: rightLeg.hipPivot,
    kneeL: leftLeg.kneePivot,
    kneeR: rightLeg.kneePivot,
    armLPivot: leftArm.armPivot,
    armRPivot: rightArm.armPivot,
    elbowL: leftArm.elbowPivot,
    elbowR: rightArm.elbowPivot,
    torsoGroup,
    headGroup,
    mouth,
  };
  return root;
}

export function createNpcByArchetype(
  archetype: NpcArchetype,
  textures?: ProceduralTextures
): THREE.Group {
  switch (archetype) {
    case 'camionero':
      return createCharacterGroup({
        skinTone: '#b88563',
        hairColor: '#241d19',
        shirtPrimary: '#1e3a5f',
        shirtSecondary: '#18181b',
        hasCap: true,
        capColor: '#1e293b',
        hasBeard: true,
        eyeColor: 0x3b2818,
        textures,
      });
    case 'paisano':
      return createCharacterGroup({
        skinTone: '#b38362',
        hairColor: '#9ca3af',
        shirtPrimary: '#475569',
        shirtSecondary: '#334155',
        hasCap: false,
        hasPoncho: true,
        eyeColor: 0x2c2018,
        textures,
      });
    case 'turista':
      return createCharacterGroup({
        skinTone: '#dbb499',
        hairColor: '#3f2a1d',
        shirtPrimary: '#0f766e',
        shirtSecondary: '#1e293b',
        hasCap: false,
        hasBackpack: true,
        eyeColor: 0x2e5945,
        textures,
      });
    case 'sospechoso':
      return createCharacterGroup({
        skinTone: '#cfd8dc',
        hairColor: '#09090b',
        shirtPrimary: '#7f1d1d',
        shirtSecondary: '#18181b',
        hasCap: true,
        capColor: '#09090b',
        isSuspicious: true,
        isButcher: true,
        hasBeard: true,
        textures,
      });
    case 'aparicion': {
      const ghost = createCharacterGroup({
        skinTone: '#dbe4ee',
        hairColor: '#020617',
        shirtPrimary: '#94a3b8',
        shirtSecondary: '#1e293b',
        hasCap: false,
        hasPoncho: true,
        isGhost: true,
        textures,
      });
      const auraLight = new THREE.PointLight(0x67e8f9, 1.8, 5.2);
      auraLight.position.set(0, 1.45, 0.25);
      ghost.add(auraLight);
      return ghost;
    }
    case 'pibe':
    default:
      return createCharacterGroup({
        skinTone: '#cfa080',
        hairColor: '#1f1b18',
        shirtPrimary: '#7f1d1d',
        shirtSecondary: '#1c2833',
        hasCap: true,
        capColor: '#1c1c1e',
        eyeColor: 0x3a2515,
        textures,
      });
  }
}

export function createFriendModel(
  profile: PlayerProfile,
  remoteNameBadge?: string,
  textures?: ProceduralTextures
): THREE.Group {
  const shirt = SHIRT_OPTIONS.find((s) => s.id === profile.shirtId) ?? SHIRT_OPTIONS[0];
  return createCharacterGroup({
    skinTone: profile.skinTone || '#c98e68',
    hairColor: profile.hairColor || '#1d1917',
    shirtPrimary: shirt.primary,
    shirtSecondary: shirt.secondary,
    hasCap: profile.hasCap,
    capColor: '#1c2833',
    withMate: !remoteNameBadge,
    nameBadge: remoteNameBadge,
    textures,
  });
}

export async function loadNormalizedCustomCharacterModel(
  buffer: ArrayBuffer
): Promise<{ root: THREE.Group; mixer: THREE.AnimationMixer | null }> {
  const loader = new GLTFLoader();
  const gltf = await loader.parseAsync(buffer, '');
  const model = gltf.scene;

  const box = new THREE.Box3().setFromObject(model);
  const size = box.getSize(new THREE.Vector3());
  const height = Math.max(0.05, size.y);
  const scale = 1.74 / height;
  model.scale.setScalar(scale);

  box.setFromObject(model);
  const center = box.getCenter(new THREE.Vector3());
  model.position.set(-center.x, -box.min.y, -center.z);

  model.traverse((child) => {
    if ((child as THREE.Mesh).isMesh) {
      child.castShadow = true;
      child.receiveShadow = true;
    }
  });

  const wrapper = new THREE.Group();
  wrapper.add(model);

  // Dummy animParts shim so KioscoEngine idle/walk animations never throw on custom GLB models
  const dummy = new THREE.Object3D();
  wrapper.userData.animParts = {
    legL: dummy,
    legR: dummy,
    armLPivot: dummy,
    armRPivot: dummy,
    headGroup: model,
  };

  let mixer: THREE.AnimationMixer | null = null;
  if (gltf.animations && gltf.animations.length > 0) {
    mixer = new THREE.AnimationMixer(model);
    const clip = gltf.animations[0];
    mixer.clipAction(clip).play();
  }

  return { root: wrapper, mixer };
}

export interface TubeFixtureHandle {
  mesh: THREE.Mesh;
  mat: THREE.MeshStandardMaterial;
  light: THREE.PointLight;
  baseIntensity: number;
}

export interface RestockMarkerHandle {
  zoneId: RestockZoneId;
  ring: THREE.Mesh;
  ringMat: THREE.MeshBasicMaterial;
  orb: THREE.Mesh;
  orbMat: THREE.MeshStandardMaterial;
  fillBar: THREE.Mesh;
  fillMat: THREE.MeshBasicMaterial;
}

export interface KioscoEnvironmentHandles {
  group: THREE.Group;
  truckGroup: THREE.Group;
  bulbLight: THREE.PointLight;
  depositoRedLight: THREE.PointLight;
  registerMesh: THREE.Group;
  missionBeacon: THREE.Group;
  tubeFixtures: TubeFixtureHandle[];
  restockMarkers: Map<RestockZoneId, RestockMarkerHandle>;
  shelfSpots: Record<ProductId, THREE.Vector3[]>;
  updatePassingTruck: (dt: number) => void;
  updateAmbientMotes: (elapsed: number) => void;
}

export function createKioscoEnvironment(textures: ProceduralTextures): KioscoEnvironmentHandles {
  const group = new THREE.Group();

  // 0. Dark Eerie Night Sky Dome
  const skyDomeGeo = new THREE.SphereGeometry(122, 24, 16);
  const skyDomeMat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: {
      uTopColor: { value: new THREE.Color(0x020408) },
      uMidColor: { value: new THREE.Color(0x050911) },
      uHorizonColor: { value: new THREE.Color(0x0a1220) },
      uMoonDir: { value: new THREE.Vector3(-28, 36, -54).normalize() },
    },
    vertexShader: `
      varying vec3 vDir;
      void main() {
        vDir = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform vec3 uTopColor;
      uniform vec3 uMidColor;
      uniform vec3 uHorizonColor;
      uniform vec3 uMoonDir;
      varying vec3 vDir;
      void main() {
        float h = clamp(vDir.y, 0.0, 1.0);
        vec3 col = mix(uHorizonColor, uMidColor, smoothstep(0.0, 0.3, h));
        col = mix(col, uTopColor, smoothstep(0.25, 0.85, h));
        float moonGlow = pow(max(dot(normalize(vDir), uMoonDir), 0.0), 22.0);
        col += vec3(0.25, 0.34, 0.5) * moonGlow * 0.45;
        gl_FragColor = vec4(col, 1.0);
      }
    `,
  });
  const skyDome = new THREE.Mesh(skyDomeGeo, skyDomeMat);
  skyDome.raycast = () => {};
  group.add(skyDome);

  // 1. Exterior Dark Asphalt Parking Lot & Perimeter Ground
  const asphaltMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: textures.asphaltColor,
    bumpMap: textures.asphaltBump,
    bumpScale: 0.036,
    roughnessMap: textures.asphaltRoughness,
    roughness: 0.84,
    metalness: 0.08,
  });
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(180, 180), asphaltMat);
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  group.add(ground);

  // Faded yellow parking lot stalls in front of the supermarket (z < -6)
  const stripeMat = new THREE.MeshStandardMaterial({ color: 0xb45309, roughness: 0.9 });
  for (const px of [-6.0, -3.2, 3.2, 6.0]) {
    const stripe = new THREE.Mesh(new THREE.PlaneGeometry(0.14, 3.6), stripeMat);
    stripe.rotation.x = -Math.PI / 2;
    stripe.position.set(px, 0.015, -9.8);
    group.add(stripe);
  }

  // Front concrete sidewalk apron
  const concreteMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: textures.concreteColor,
    bumpMap: textures.concreteBump,
    bumpScale: 0.025,
    roughness: 0.85,
    metalness: 0.05,
  });
  const frontSidewalk = new THREE.Mesh(new THREE.BoxGeometry(15.2, 0.07, 2.4), concreteMat);
  frontSidewalk.position.set(0, 0.035, -7.1);
  frontSidewalk.receiveShadow = true;
  group.add(frontSidewalk);

  // 2. Supermarket Main Sales Floor (Grimy Linoleum Tile Floor, x in [-7,7], z in [-6, 5])
  const tileFloorMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: textures.tileFloorColor,
    bumpMap: textures.tileBump,
    bumpScale: 0.02,
    roughnessMap: textures.tileRoughness,
    roughness: 0.45,
    metalness: 0.14,
  });
  const salesFloor = new THREE.Mesh(new THREE.BoxGeometry(14.0, 0.07, 11.2), tileFloorMat);
  salesFloor.position.set(0, 0.035, -0.5);
  salesFloor.receiveShadow = true;
  group.add(salesFloor);

  // Depósito / Back Stockroom Concrete Slab (z in [5.0, 7.8])
  const depositoFloor = new THREE.Mesh(new THREE.BoxGeometry(14.0, 0.07, 3.0), concreteMat);
  depositoFloor.position.set(0, 0.035, 6.4);
  depositoFloor.receiveShadow = true;
  group.add(depositoFloor);

  // 3. Horror Supermarket Walls, Ceiling Trusses & Storefront Sliding Entrance
  const wallMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: textures.superWallColor,
    bumpMap: textures.wallBump,
    bumpScale: 0.03,
    roughness: 0.84,
    metalness: 0.05,
  });
  const steelMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: textures.gondolaMetalColor,
    roughness: 0.48,
    metalness: 0.65,
  });
  const ceilingMat = new THREE.MeshStandardMaterial({ color: 0x181b20, roughness: 0.9 });

  // Outer left, right, and back Depósito walls (height 3.9m)
  const leftWall = new THREE.Mesh(new THREE.BoxGeometry(0.24, 3.9, 14.0), wallMat);
  leftWall.position.set(-7.0, 1.95, 0.9);
  leftWall.castShadow = true;
  leftWall.receiveShadow = true;
  group.add(leftWall);

  const rightWall = new THREE.Mesh(new THREE.BoxGeometry(0.24, 3.9, 14.0), wallMat);
  rightWall.position.set(7.0, 1.95, 0.9);
  rightWall.castShadow = true;
  rightWall.receiveShadow = true;
  group.add(rightWall);

  const backWall = new THREE.Mesh(new THREE.BoxGeometry(14.2, 3.9, 0.24), wallMat);
  backWall.position.set(0, 1.95, 7.8);
  backWall.castShadow = true;
  backWall.receiveShadow = true;
  group.add(backWall);

  // Interior partition wall at z=5.0 leaving wide open doorway [-1.65, 1.65] into Depósito
  const depWallL = new THREE.Mesh(new THREE.BoxGeometry(5.35, 3.9, 0.22), wallMat);
  depWallL.position.set(-4.32, 1.95, 5.0);
  depWallL.castShadow = true;
  depWallL.receiveShadow = true;
  group.add(depWallL);

  const depWallR = new THREE.Mesh(new THREE.BoxGeometry(5.35, 3.9, 0.22), wallMat);
  depWallR.position.set(4.32, 1.95, 5.0);
  depWallR.castShadow = true;
  depWallR.receiveShadow = true;
  group.add(depWallR);

  const depHeader = new THREE.Mesh(new THREE.BoxGeometry(3.4, 1.25, 0.24), wallMat);
  depHeader.position.set(0, 3.27, 5.0);
  group.add(depHeader);

  // Glowing red DEPÓSITO warning sign over back doorway
  const depSign = new THREE.Mesh(
    new THREE.PlaneGeometry(2.6, 0.58),
    new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: textures.depositoSignColor,
      emissive: 0xef4444,
      emissiveMap: textures.depositoSignColor,
      emissiveIntensity: 0.85,
    })
  );
  depSign.position.set(0, 2.95, 4.86);
  depSign.rotation.y = Math.PI;
  group.add(depSign);

  const depositoRedLight = new THREE.PointLight(0xef4444, 5.5, 11, 1.4);
  depositoRedLight.position.set(0, 3.1, 6.2);
  group.add(depositoRedLight);

  // Front glass storefront walls leaving central automatic doorway [-1.6, 1.6] open at z=-6.0
  const glassMat = new THREE.MeshPhysicalMaterial({
    color: 0x94a3b8,
    transparent: true,
    opacity: 0.22,
    roughness: 0.14,
    metalness: 0.15,
    clearcoat: 0.8,
  });
  for (const side of [-1, 1]) {
    const lowerKnee = new THREE.Mesh(new THREE.BoxGeometry(5.4, 0.72, 0.2), wallMat);
    lowerKnee.position.set(side * 4.3, 0.36, -6.0);
    lowerKnee.castShadow = true;
    group.add(lowerKnee);

    const glassPane = new THREE.Mesh(new THREE.BoxGeometry(5.3, 2.35, 0.06), glassMat);
    glassPane.position.set(side * 4.3, 1.9, -6.0);
    glassPane.raycast = () => {};
    group.add(glassPane);

    const mullion = new THREE.Mesh(new THREE.BoxGeometry(0.14, 3.1, 0.22), steelMat);
    mullion.position.set(side * 1.62, 1.55, -6.0);
    group.add(mullion);
  }
  const frontFascia = new THREE.Mesh(new THREE.BoxGeometry(14.4, 0.9, 0.34), wallMat);
  frontFascia.position.set(0, 3.55, -6.0);
  frontFascia.castShadow = true;
  group.add(frontFascia);

  // Exterior Neon Marquee Sign ("SÚPER NOCTURNO 24/7")
  const superSign = new THREE.Mesh(
    new THREE.PlaneGeometry(5.8, 1.35),
    new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: textures.superSignColor,
      emissive: 0xfca5a5,
      emissiveMap: textures.superSignColor,
      emissiveIntensity: 0.85,
      roughness: 0.35,
    })
  );
  superSign.position.set(0, 4.15, -6.18);
  superSign.rotation.y = Math.PI;
  group.add(superSign);

  // Roof slab + ceiling trusses + 6 Flickering Fluorescent Tube Fixtures
  const roof = new THREE.Mesh(new THREE.BoxGeometry(14.6, 0.14, 14.3), ceilingMat);
  roof.position.set(0, 3.92, 0.9);
  group.add(roof);

  const tubeFixtures: TubeFixtureHandle[] = [];
  const tubeCoords: Array<[number, number, number]> = [
    [-4.3, 3.74, -2.5],
    [0.0, 3.74, -2.5],
    [4.3, 3.74, -2.5],
    [-4.3, 3.74, 2.0],
    [0.0, 3.74, 2.0],
    [4.3, 3.74, 2.0],
  ];
  for (const [lx, ly, lz] of tubeCoords) {
    const housing = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.08, 1.6), steelMat);
    housing.position.set(lx, ly + 0.06, lz);
    group.add(housing);

    const tubeMat = new THREE.MeshStandardMaterial({
      color: 0xdbeafe,
      emissive: 0xcffafe,
      emissiveIntensity: 1.45,
      roughness: 0.2,
    });
    const tubeMesh = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.05, 1.48), tubeMat);
    tubeMesh.position.set(lx, ly, lz);
    group.add(tubeMesh);

    const pLight = new THREE.PointLight(0xd8f3ff, 5.2, 11.5, 1.45);
    pLight.position.set(lx, ly - 0.18, lz);
    group.add(pLight);

    tubeFixtures.push({
      mesh: tubeMesh,
      mat: tubeMat,
      light: pLight,
      baseIntensity: 5.2,
    });
  }

  // Main overhead light reference for upgrades
  const bulbLight = tubeFixtures[1].light;

  // 4. Checkout Counter ("Caja 1") at x in [-5.3, -1.85], z in [-4.2, -2.95]
  const woodMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: textures.woodCounterColor,
    bumpMap: textures.woodBump,
    bumpScale: 0.025,
    roughness: 0.62,
    metalness: 0.06,
  });
  const counterBase = new THREE.Mesh(new THREE.BoxGeometry(3.45, 0.97, 1.2), steelMat);
  counterBase.position.set(-3.55, 0.485, -3.55);
  counterBase.castShadow = true;
  counterBase.receiveShadow = true;
  group.add(counterBase);

  const counterTop = new THREE.Mesh(new THREE.BoxGeometry(3.52, 0.08, 1.28), woodMat);
  counterTop.position.set(-3.55, COUNTER_SURFACE_Y - 0.04, -3.55);
  counterTop.castShadow = true;
  counterTop.receiveShadow = true;
  group.add(counterTop);

  // Delivery Zone Mat on Checkout Counter
  const deliveryMatMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(2.1, 0.96),
    new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: textures.deliveryMatColor,
      roughness: 0.55,
    })
  );
  deliveryMatMesh.rotation.x = -Math.PI / 2;
  deliveryMatMesh.position.set(-3.45, COUNTER_SURFACE_Y + 0.004, -3.4);
  group.add(deliveryMatMesh);

  // Cash Register + Barcode Scanner on right side of checkout counter
  const registerMesh = new THREE.Group();
  const regBody = new THREE.Mesh(
    new THREE.BoxGeometry(0.48, 0.24, 0.42),
    new THREE.MeshStandardMaterial({ color: 0x18181b, roughness: 0.4, metalness: 0.35 })
  );
  regBody.position.y = 0.12;
  regBody.castShadow = true;
  registerMesh.add(regBody);

  const regScreen = new THREE.Mesh(
    new THREE.BoxGeometry(0.32, 0.2, 0.04),
    new THREE.MeshStandardMaterial({
      color: 0x052e16,
      emissive: 0x22c55e,
      emissiveIntensity: 0.75,
    })
  );
  regScreen.position.set(0, 0.31, -0.08);
  regScreen.rotation.x = -0.25;
  registerMesh.add(regScreen);

  registerMesh.position.set(-2.12, COUNTER_SURFACE_Y, -3.55);
  group.add(registerMesh);

  // 5. Two Long Double-Sided Metal Gondolas (x = -2.55 and x = 2.55, z in [-1.35, 3.55])
  const shelfPlankMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.52, metalness: 0.45 });
  const buildGondola = (gx: number) => {
    const g = new THREE.Group();
    const spine = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.95, 4.9), steelMat);
    spine.position.set(0, 1.0, 0);
    spine.castShadow = true;
    spine.receiveShadow = true;
    g.add(spine);

    for (const sy of [0.58, 1.08, 1.58]) {
      const plank = new THREE.Mesh(new THREE.BoxGeometry(0.96, 0.05, 4.9), shelfPlankMat);
      plank.position.set(0, sy, 0);
      plank.castShadow = true;
      plank.receiveShadow = true;
      g.add(plank);
    }
    g.position.set(gx, 0.07, 1.1);
    group.add(g);
  };
  buildGondola(-2.55);
  buildGondola(2.55);

  // 6. Left & Right Illuminated Wall Chillers (Carnicería/Lácteos & Heladera Central)
  const buildChillerBank = (
    cx: number,
    rotY: number,
    headerTex: THREE.CanvasTexture,
    glowHex: number
  ) => {
    const bank = new THREE.Group();
    const back = new THREE.Mesh(
      new THREE.BoxGeometry(5.2, 2.35, 0.14),
      new THREE.MeshStandardMaterial({
        color: 0xf1f5f9,
        emissive: glowHex,
        emissiveIntensity: 0.25,
        roughness: 0.35,
      })
    );
    back.position.set(0, 1.24, -0.32);
    bank.add(back);

    const topHeader = new THREE.Mesh(new THREE.BoxGeometry(5.24, 0.34, 0.78), steelMat);
    topHeader.position.set(0, 2.32, 0);
    bank.add(topHeader);

    const sign = new THREE.Mesh(
      new THREE.PlaneGeometry(4.8, 0.28),
      new THREE.MeshStandardMaterial({
        color: 0xffffff,
        map: headerTex,
        emissive: 0xffffff,
        emissiveMap: headerTex,
        emissiveIntensity: 0.55,
      })
    );
    sign.position.set(0, 2.32, 0.4);
    bank.add(sign);

    for (const sy of [0.55, 1.08, 1.6]) {
      const shelf = new THREE.Mesh(new THREE.BoxGeometry(5.0, 0.04, 0.62), shelfPlankMat);
      shelf.position.set(0, sy, 0.02);
      shelf.receiveShadow = true;
      bank.add(shelf);
    }

    const glassDoor = new THREE.Mesh(new THREE.PlaneGeometry(5.0, 1.8), glassMat);
    glassDoor.position.set(0, 1.22, 0.36);
    glassDoor.raycast = () => {};
    bank.add(glassDoor);

    const chillerLight = new THREE.PointLight(glowHex, 3.2, 6.2, 1.5);
    chillerLight.position.set(0, 1.75, 0.75);
    bank.add(chillerLight);

    bank.position.set(cx, 0.07, 1.1);
    bank.rotation.y = rotY;
    group.add(bank);
  };
  buildChillerBank(-6.35, Math.PI / 2, textures.aisleMeatHeaderColor, 0xf87171);
  buildChillerBank(6.35, -Math.PI / 2, textures.aisleColdHeaderColor, 0x38bdf8);

  // 7. Depósito / Back Stockroom Pallets & Reserve Racks (z in [5.5, 7.4])
  for (const rx of [-4.6, 4.6]) {
    const rack = new THREE.Group();
    for (const sy of [0.62, 1.22, 1.82]) {
      const plank = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.06, 0.85), woodMat);
      plank.position.set(0, sy, 0);
      plank.castShadow = true;
      plank.receiveShadow = true;
      rack.add(plank);
    }
    for (const px of [-1.5, 1.5]) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.08, 2.2, 0.86), steelMat);
      post.position.set(px, 1.1, 0);
      rack.add(post);
    }
    rack.position.set(rx, 0.07, 6.95);
    group.add(rack);
  }
  // Wooden floor pallets stacked with sealed boxes in Depósito center-left
  for (const px of [-2.0, 2.0]) {
    const pallet = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.14, 1.1), woodMat);
    pallet.position.set(px, 0.14, 6.6);
    group.add(pallet);
    const crate = new THREE.Mesh(
      new THREE.BoxGeometry(0.62, 0.45, 0.56),
      new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.8 })
    );
    crate.position.set(px, 0.43, 6.6);
    crate.castShadow = true;
    group.add(crate);
  }

  // 8. Interactive Restock Zone Markers (4 zones that pulse red when depleted & green when full)
  const restockMarkers = new Map<RestockZoneId, RestockMarkerHandle>();
  for (const zone of RESTOCK_ZONES) {
    const markerGroup = new THREE.Group();
    markerGroup.position.set(zone.pos[0], 0.085, zone.pos[2]);

    const ringMat = new THREE.MeshBasicMaterial({
      color: 0x10b981,
      transparent: true,
      opacity: 0.72,
      side: THREE.DoubleSide,
    });
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.45, 0.62, 24), ringMat);
    ring.rotation.x = -Math.PI / 2;
    markerGroup.add(ring);

    const orbMat = new THREE.MeshStandardMaterial({
      color: 0x10b981,
      emissive: 0x10b981,
      emissiveIntensity: 1.1,
      roughness: 0.25,
    });
    const orb = new THREE.Mesh(new THREE.OctahedronGeometry(0.14, 0), orbMat);
    orb.position.y = 2.05;
    markerGroup.add(orb);

    const barBg = new THREE.Mesh(
      new THREE.BoxGeometry(0.74, 0.1, 0.04),
      new THREE.MeshBasicMaterial({ color: 0x09090b })
    );
    barBg.position.y = 2.34;
    markerGroup.add(barBg);

    const fillMat = new THREE.MeshBasicMaterial({ color: 0x22c55e });
    const fillBar = new THREE.Mesh(new THREE.BoxGeometry(0.68, 0.06, 0.05), fillMat);
    fillBar.position.y = 2.34;
    markerGroup.add(fillBar);

    markerGroup.traverse((c) => {
      c.userData.interactKind = 'restock_zone';
      c.userData.restockZoneId = zone.id;
    });

    group.add(markerGroup);
    restockMarkers.set(zone.id, {
      zoneId: zone.id,
      ring,
      ringMat,
      orb,
      orbMat,
      fillBar,
      fillMat,
    });
  }

  // 9. Floating Mission Beacon
  const missionBeacon = new THREE.Group();
  const beaconCone = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.14, 0),
    new THREE.MeshStandardMaterial({
      color: 0xfef08a,
      emissive: 0xf59e0b,
      emissiveIntensity: 1.4,
      roughness: 0.2,
    })
  );
  missionBeacon.add(beaconCone);
  const beaconRing = new THREE.Mesh(
    new THREE.TorusGeometry(0.24, 0.022, 8, 24),
    new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      emissive: 0x38bdf8,
      emissiveIntensity: 1.2,
    })
  );
  beaconRing.rotation.x = Math.PI / 2;
  beaconRing.position.y = -0.18;
  missionBeacon.add(beaconRing);
  missionBeacon.visible = false;
  group.add(missionBeacon);

  // 10. Exterior Parking Lot Lamp, Dark Trees, Stars, Veiled Moon & Distant Passing Truck
  const lampPost = new THREE.Group();
  const lampPole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.09, 4.6, 8), steelMat);
  lampPole.position.y = 2.3;
  lampPole.castShadow = true;
  lampPost.add(lampPole);
  const lampArm = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.07, 0.07), steelMat);
  lampArm.position.set(-0.4, 4.55, 0);
  lampPost.add(lampArm);
  const lampHalo = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: textures.radialGlow,
      color: 0xbae6fd,
      transparent: true,
      opacity: 0.65,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })
  );
  lampHalo.scale.set(2.4, 2.4, 1);
  lampHalo.position.set(-0.8, 4.4, 0);
  lampPost.add(lampHalo);
  const lotLight = new THREE.PointLight(0xdbeafe, 6.2, 18, 1.5);
  lotLight.position.set(-0.8, 4.2, 0);
  lampPost.add(lotLight);
  lampPost.position.set(5.4, 0, -9.2);
  group.add(lampPost);

  // Trees around parking lot perimeter
  const treeCount = 28;
  const trunkGeo = new THREE.CylinderGeometry(0.14, 0.28, 2.5, 8);
  trunkGeo.translate(0, 1.25, 0);
  const trunkMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: textures.barkColor,
    bumpMap: textures.barkBump,
    bumpScale: 0.04,
    roughness: 0.94,
  });
  const canopyGeo = new THREE.DodecahedronGeometry(1.45, 1);
  canopyGeo.scale(1.2, 0.82, 1.15);
  canopyGeo.translate(0, 2.8, 0);
  const canopyMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: textures.foliageColor,
    roughness: 0.9,
  });
  const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, treeCount);
  const canopies = new THREE.InstancedMesh(canopyGeo, canopyMat, treeCount);
  const dummy = new THREE.Object3D();
  for (let i = 0; i < treeCount; i++) {
    const ang = (i / treeCount) * Math.PI * 2;
    const dist = 19 + (i % 4) * 5;
    const tx = Math.cos(ang) * dist;
    const tz = Math.sin(ang) * dist;
    dummy.position.set(tx, 0, tz);
    dummy.rotation.set(0, i * 1.1, 0);
    dummy.scale.setScalar(0.9 + (i % 3) * 0.15);
    dummy.updateMatrix();
    trunks.setMatrixAt(i, dummy.matrix);
    canopies.setMatrixAt(i, dummy.matrix);
  }
  group.add(trunks);
  group.add(canopies);

  // Dust / cold air motes drifting in flashlight beams
  const moteCount = 48;
  const moteBase = new Float32Array(moteCount * 3);
  const motePos = new Float32Array(moteCount * 3);
  for (let i = 0; i < moteCount; i++) {
    const mx = (Math.random() - 0.5) * 12;
    const my = 0.6 + Math.random() * 2.5;
    const mz = -5 + Math.random() * 11;
    moteBase[i * 3] = mx;
    moteBase[i * 3 + 1] = my;
    moteBase[i * 3 + 2] = mz;
    motePos[i * 3] = mx;
    motePos[i * 3 + 1] = my;
    motePos[i * 3 + 2] = mz;
  }
  const moteGeo = new THREE.BufferGeometry();
  moteGeo.setAttribute('position', new THREE.BufferAttribute(motePos, 3));
  const motes = new THREE.Points(
    moteGeo,
    new THREE.PointsMaterial({
      color: 0xcffafe,
      size: 0.06,
      transparent: true,
      opacity: 0.48,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })
  );
  group.add(motes);

  // Passing shadowy delivery truck far beyond parking lot
  const truckGroup = new THREE.Group();
  const cabMat = new THREE.MeshStandardMaterial({ color: 0x3f3f46, roughness: 0.45 });
  const trailer = new THREE.Mesh(
    new THREE.BoxGeometry(5.2, 2.2, 2.1),
    new THREE.MeshStandardMaterial({ color: 0x52525b, roughness: 0.6 })
  );
  trailer.position.set(-1.7, 1.55, 0);
  truckGroup.add(trailer);
  const cab = new THREE.Mesh(new THREE.BoxGeometry(1.5, 1.85, 1.95), cabMat);
  cab.position.set(1.75, 1.38, 0);
  truckGroup.add(cab);
  const hlMat = new THREE.MeshBasicMaterial({ color: 0xfef3c7 });
  for (const wz of [-0.72, 0.72]) {
    const hl = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.16, 0.22), hlMat);
    hl.position.set(2.52, 0.72, wz);
    truckGroup.add(hl);
  }
  truckGroup.position.set(-50, 0, -18.5);
  group.add(truckGroup);

  const updatePassingTruck = (dt: number) => {
    truckGroup.position.x += dt * 10;
    if (truckGroup.position.x > 65) truckGroup.position.x = -65;
  };

  const updateAmbientMotes = (elapsed: number) => {
    const attr = moteGeo.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < moteCount; i++) {
      attr.setXYZ(
        i,
        moteBase[i * 3] + Math.sin(elapsed * 0.7 + i) * 0.35,
        moteBase[i * 3 + 1] + Math.sin(elapsed * 1.1 + i * 1.5) * 0.18,
        moteBase[i * 3 + 2] + Math.cos(elapsed * 0.6 + i) * 0.35
      );
    }
    attr.needsUpdate = true;
  };

  // Shelf + Depósito reserve stock positions (aligned with static colliders)
  const shelfSpots: Record<ProductId, THREE.Vector3[]> = {
    carne: [
      new THREE.Vector3(-5.95, 1.24, 0.2),
      new THREE.Vector3(-5.95, 1.24, 1.1),
      new THREE.Vector3(-4.6, 1.36, 6.8),
      new THREE.Vector3(-4.1, 1.36, 6.8),
    ],
    leche: [
      new THREE.Vector3(-5.95, 1.75, 0.4),
      new THREE.Vector3(-5.95, 1.75, 1.5),
      new THREE.Vector3(-3.6, 1.36, 6.8),
      new THREE.Vector3(-4.6, 1.96, 6.8),
    ],
    fideos: [
      new THREE.Vector3(-2.3, 1.28, 0.1),
      new THREE.Vector3(-2.3, 1.28, 1.0),
      new THREE.Vector3(-4.1, 1.96, 6.8),
      new THREE.Vector3(-3.6, 1.96, 6.8),
    ],
    cafe: [
      new THREE.Vector3(-2.3, 1.78, 0.3),
      new THREE.Vector3(-2.3, 1.78, 1.4),
      new THREE.Vector3(-4.6, 0.78, 6.8),
      new THREE.Vector3(-4.0, 0.78, 6.8),
    ],
    gaseosa: [
      new THREE.Vector3(2.3, 1.32, 0.2),
      new THREE.Vector3(2.3, 1.32, 1.2),
      new THREE.Vector3(4.2, 1.36, 6.8),
      new THREE.Vector3(4.8, 1.36, 6.8),
    ],
    pan: [
      new THREE.Vector3(2.3, 1.78, 0.4),
      new THREE.Vector3(2.3, 1.78, 1.5),
      new THREE.Vector3(3.6, 1.36, 6.8),
      new THREE.Vector3(4.2, 1.96, 6.8),
    ],
    agua: [
      new THREE.Vector3(5.95, 1.3, 0.3),
      new THREE.Vector3(5.95, 1.3, 1.3),
      new THREE.Vector3(4.8, 1.96, 6.8),
      new THREE.Vector3(3.6, 1.96, 6.8),
    ],
    galletitas: [
      new THREE.Vector3(5.95, 1.74, 0.5),
      new THREE.Vector3(5.95, 1.74, 1.6),
      new THREE.Vector3(4.1, 0.78, 6.8),
      new THREE.Vector3(4.7, 0.78, 6.8),
    ],
  };

  return {
    group,
    truckGroup,
    bulbLight,
    depositoRedLight,
    registerMesh,
    missionBeacon,
    tubeFixtures,
    restockMarkers,
    shelfSpots,
    updatePassingTruck,
    updateAmbientMotes,
  };
}

export function createSecretRoadsideProp(secretId: string): {
  group: THREE.Group;
  beacon: THREE.Mesh;
  glowOrb: THREE.Mesh;
} {
  const group = new THREE.Group();

  if (secretId === 'secret-cinta') {
    const crate = new THREE.Mesh(
      new THREE.BoxGeometry(0.62, 0.38, 0.44),
      new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.8 })
    );
    crate.position.y = 0.19;
    crate.castShadow = true;
    group.add(crate);

    const vhs = new THREE.Mesh(
      new THREE.BoxGeometry(0.28, 0.08, 0.18),
      new THREE.MeshStandardMaterial({ color: 0x09090b, roughness: 0.4 })
    );
    vhs.position.y = 0.42;
    group.add(vhs);

    const reel = new THREE.Mesh(
      new THREE.BoxGeometry(0.18, 0.02, 0.1),
      new THREE.MeshBasicMaterial({ color: 0xef4444 })
    );
    reel.position.set(0, 0.47, 0);
    group.add(reel);
  } else if (secretId === 'secret-nota') {
    const board = new THREE.Mesh(
      new THREE.BoxGeometry(0.42, 0.04, 0.56),
      new THREE.MeshStandardMaterial({ color: 0x451a03, roughness: 0.7 })
    );
    board.position.y = 0.04;
    group.add(board);

    const paper = new THREE.Mesh(
      new THREE.BoxGeometry(0.34, 0.02, 0.46),
      new THREE.MeshStandardMaterial({ color: 0xfef2f2, roughness: 0.5 })
    );
    paper.position.y = 0.07;
    group.add(paper);
  } else {
    const badge = new THREE.Mesh(
      new THREE.BoxGeometry(0.34, 0.04, 0.24),
      new THREE.MeshStandardMaterial({ color: 0x991b1b, roughness: 0.4 })
    );
    badge.position.y = 0.04;
    group.add(badge);
  }

  const beacon = new THREE.Mesh(
    new THREE.RingGeometry(0.42, 0.54, 24),
    new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.78,
      side: THREE.DoubleSide,
    })
  );
  beacon.rotation.x = -Math.PI / 2;
  beacon.position.y = 0.04;
  group.add(beacon);

  const glowOrb = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.11, 0),
    new THREE.MeshBasicMaterial({
      color: 0x7dd3fc,
      transparent: true,
      opacity: 0.88,
    })
  );
  glowOrb.position.set(0, 1.05, 0);
  group.add(glowOrb);

  return { group, beacon, glowOrb };
}

export function createAisleShadowMesh(): THREE.Group {
  const shadow = new THREE.Group();
  const cloakMat = new THREE.MeshStandardMaterial({
    color: 0x030508,
    roughness: 0.95,
    metalness: 0.05,
    transparent: true,
    opacity: 0.88,
  });

  // Tall gaunt spectral cloak & torso
  const lowerCloak = new THREE.Mesh(new THREE.ConeGeometry(0.38, 1.55, 12), cloakMat);
  lowerCloak.position.y = 0.78;
  shadow.add(lowerCloak);

  const upperBody = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.24, 0.52, 12), cloakMat);
  upperBody.position.y = 1.48;
  shadow.add(upperBody);

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.145, 12, 10), cloakMat);
  head.scale.set(0.86, 1.18, 0.92);
  head.position.y = 1.84;
  shadow.add(head);

  // Subtle pale glowing pinprick eyes
  const eyeMat = new THREE.MeshBasicMaterial({ color: 0x93c5fd });
  for (const ex of [-0.045, 0.045]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.012, 6, 6), eyeMat);
    eye.position.set(ex, 1.85, 0.12);
    shadow.add(eye);
  }

  // Long thin shadowy arms reaching outward
  for (const side of [-1, 1]) {
    const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.018, 0.78, 8), cloakMat);
    arm.position.set(side * 0.23, 1.32, 0.08);
    arm.rotation.z = side * 0.22;
    arm.rotation.x = -0.35;
    shadow.add(arm);
  }

  // Eerie cold point light aura
  const aura = new THREE.PointLight(0x38bdf8, 1.1, 4.2, 1.8);
  aura.position.set(0, 1.55, 0.2);
  shadow.add(aura);

  shadow.visible = false;
  shadow.traverse((c) => {
    c.raycast = () => {};
  });
  return shadow;
}
