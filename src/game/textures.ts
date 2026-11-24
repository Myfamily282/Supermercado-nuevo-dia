import * as THREE from 'three';
import { PRODUCT_LIST } from './kioscoLogic';
import type { ProductId } from './types';

export interface ProceduralTextures {
  asphaltColor: THREE.CanvasTexture;
  asphaltBump: THREE.CanvasTexture;
  asphaltRoughness: THREE.CanvasTexture;
  concreteColor: THREE.CanvasTexture;
  concreteBump: THREE.CanvasTexture;
  superWallColor: THREE.CanvasTexture;
  wallBump: THREE.CanvasTexture;
  woodCounterColor: THREE.CanvasTexture;
  woodBump: THREE.CanvasTexture;
  gondolaMetalColor: THREE.CanvasTexture;
  barkColor: THREE.CanvasTexture;
  barkBump: THREE.CanvasTexture;
  foliageColor: THREE.CanvasTexture;
  fabricBump: THREE.CanvasTexture;
  denimColor: THREE.CanvasTexture;
  apronBloodColor: THREE.CanvasTexture;
  skinBump: THREE.CanvasTexture;
  superSignColor: THREE.CanvasTexture;
  depositoSignColor: THREE.CanvasTexture;
  deliveryMatColor: THREE.CanvasTexture;
  tileFloorColor: THREE.CanvasTexture;
  tileBump: THREE.CanvasTexture;
  tileRoughness: THREE.CanvasTexture;
  aisleMeatHeaderColor: THREE.CanvasTexture;
  aisleColdHeaderColor: THREE.CanvasTexture;
  radialGlow: THREE.CanvasTexture;
  productLabels: Record<ProductId, THREE.CanvasTexture>;
  contactShadow: THREE.CanvasTexture;
  dispose: () => void;
}

function makeCanvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d')!;
  return [c, ctx];
}

function finalizeColorTexture(
  canvas: HTMLCanvasElement,
  anisotropy: number,
  repeatX = 1,
  repeatY = 1
): THREE.CanvasTexture {
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeatX, repeatY);
  tex.anisotropy = anisotropy;
  tex.needsUpdate = true;
  return tex;
}

function finalizeLinearTexture(
  canvas: HTMLCanvasElement,
  anisotropy: number,
  repeatX = 1,
  repeatY = 1
): THREE.CanvasTexture {
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.NoColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeatX, repeatY);
  tex.anisotropy = anisotropy;
  tex.needsUpdate = true;
  return tex;
}

export function createProceduralTextures(maxAnisotropy: number): ProceduralTextures {
  const aniso = Math.max(1, maxAnisotropy);
  const allTextures: THREE.CanvasTexture[] = [];
  const track = <T extends THREE.CanvasTexture>(t: T): T => {
    allTextures.push(t);
    return t;
  };

  // 1. Dark wet parking-lot asphalt with damp sheen puddles & cracks
  const [roadC, roadCtx] = makeCanvas(512, 512);
  const [roadBC, roadBCtx] = makeCanvas(512, 512);
  const [roadRC, roadRCtx] = makeCanvas(512, 512);
  roadCtx.fillStyle = '#181a1f';
  roadCtx.fillRect(0, 0, 512, 512);
  roadBCtx.fillStyle = '#7a7a7a';
  roadBCtx.fillRect(0, 0, 512, 512);
  roadRCtx.fillStyle = '#cfcfcf';
  roadRCtx.fillRect(0, 0, 512, 512);

  for (let p = 0; p < 12; p++) {
    const px = 40 + ((p * 97) % 440);
    const py = 40 + ((p * 131) % 440);
    const r = 24 + (p % 4) * 12;
    const pGrad = roadRCtx.createRadialGradient(px, py, 2, px, py, r);
    pGrad.addColorStop(0, 'rgba(28, 28, 28, 0.92)');
    pGrad.addColorStop(1, 'rgba(190, 190, 190, 0)');
    roadRCtx.fillStyle = pGrad;
    roadRCtx.fillRect(px - r, py - r, r * 2, r * 2);

    const dGrad = roadCtx.createRadialGradient(px, py, 2, px, py, r);
    dGrad.addColorStop(0, 'rgba(10, 12, 16, 0.65)');
    dGrad.addColorStop(1, 'rgba(24, 26, 31, 0)');
    roadCtx.fillStyle = dGrad;
    roadCtx.fillRect(px - r, py - r, r * 2, r * 2);
  }

  for (let i = 0; i < 12000; i++) {
    const x = Math.random() * 512;
    const y = Math.random() * 512;
    const g = 18 + Math.floor(Math.random() * 26);
    roadCtx.fillStyle = `rgb(${g},${g + 1},${g + 4})`;
    roadCtx.fillRect(x, y, 2, 2);
    const bg = 92 + Math.floor(Math.random() * 92);
    roadBCtx.fillStyle = `rgb(${bg},${bg},${bg})`;
    roadBCtx.fillRect(x, y, 2, 2);
  }
  roadCtx.strokeStyle = 'rgba(7, 8, 10, 0.78)';
  roadCtx.lineWidth = 1.6;
  roadBCtx.strokeStyle = '#202020';
  roadBCtx.lineWidth = 2.2;
  for (let c = 0; c < 11; c++) {
    const sx = (c * 67) % 470;
    const sy = (c * 89) % 470;
    roadCtx.beginPath();
    roadCtx.moveTo(sx, sy);
    roadCtx.lineTo(sx + 28, sy + 17);
    roadCtx.lineTo(sx + 54, sy + 7);
    roadCtx.stroke();
    roadBCtx.beginPath();
    roadBCtx.moveTo(sx, sy);
    roadBCtx.lineTo(sx + 28, sy + 17);
    roadBCtx.lineTo(sx + 54, sy + 7);
    roadBCtx.stroke();
  }
  const asphaltColor = track(finalizeColorTexture(roadC, aniso, 12, 10));
  const asphaltBump = track(finalizeLinearTexture(roadBC, aniso, 12, 10));
  const asphaltRoughness = track(finalizeLinearTexture(roadRC, aniso, 12, 10));

  // 2. Dark stained concrete floor (Depósito + exterior sidewalk)
  const [concC, concCtx] = makeCanvas(256, 256);
  const [concBC, concBCtx] = makeCanvas(256, 256);
  concCtx.fillStyle = '#383b40';
  concCtx.fillRect(0, 0, 256, 256);
  concBCtx.fillStyle = '#848484';
  concBCtx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 4800; i++) {
    const x = Math.random() * 256;
    const y = Math.random() * 256;
    const v = 42 + Math.floor(Math.random() * 34);
    concCtx.fillStyle = `rgb(${v},${v + 1},${v + 3})`;
    concCtx.fillRect(x, y, 2, 2);
    const bv = 95 + Math.floor(Math.random() * 88);
    concBCtx.fillStyle = `rgb(${bv},${bv},${bv})`;
    concBCtx.fillRect(x, y, 2, 2);
  }
  concCtx.strokeStyle = 'rgba(14, 16, 18, 0.58)';
  concCtx.lineWidth = 2;
  concBCtx.strokeStyle = '#343434';
  concBCtx.lineWidth = 2;
  for (let g = 0; g <= 256; g += 128) {
    concCtx.beginPath();
    concCtx.moveTo(g, 0);
    concCtx.lineTo(g, 256);
    concCtx.stroke();
    concCtx.beginPath();
    concCtx.moveTo(0, g);
    concCtx.lineTo(256, g);
    concCtx.stroke();
    concBCtx.beginPath();
    concBCtx.moveTo(g, 0);
    concBCtx.lineTo(g, 256);
    concBCtx.stroke();
    concBCtx.beginPath();
    concBCtx.moveTo(0, g);
    concBCtx.lineTo(256, g);
    concBCtx.stroke();
  }
  const concreteColor = track(finalizeColorTexture(concC, aniso, 5, 4));
  const concreteBump = track(finalizeLinearTexture(concBC, aniso, 5, 4));

  // 3. Horror Supermarket Grimy Concrete/Plaster Walls with warning baseboard & moisture stains
  const [wallC, wallCtx] = makeCanvas(256, 256);
  const [wallBC, wallBCtx] = makeCanvas(256, 256);
  wallCtx.fillStyle = '#474c52';
  wallCtx.fillRect(0, 0, 256, 256);
  wallBCtx.fillStyle = '#808080';
  wallBCtx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 4200; i++) {
    const x = Math.random() * 256;
    const y = Math.random() * 256;
    const v = 58 + Math.floor(Math.random() * 30);
    wallCtx.fillStyle = `rgb(${v},${v + 2},${v + 4})`;
    wallCtx.fillRect(x, y, 2, 2);
    const bv = 110 + Math.floor(Math.random() * 44);
    wallBCtx.fillStyle = `rgb(${bv},${bv},${bv})`;
    wallBCtx.fillRect(x, y, 2, 2);
  }
  // Vertical damp streaks near bottom & dark industrial dado band
  for (let s = 0; s < 14; s++) {
    const sx = (s * 23) % 250;
    const h = 45 + (s % 4) * 28;
    const g = wallCtx.createLinearGradient(sx, 256 - h, sx, 256);
    g.addColorStop(0, 'rgba(18, 22, 24, 0)');
    g.addColorStop(1, 'rgba(16, 18, 20, 0.62)');
    wallCtx.fillStyle = g;
    wallCtx.fillRect(sx, 256 - h, 8 + (s % 3) * 4, h);
  }
  wallCtx.fillStyle = '#18181b';
  wallCtx.fillRect(0, 232, 256, 24);
  wallCtx.fillStyle = '#7f1d1d';
  wallCtx.fillRect(0, 226, 256, 6);
  const superWallColor = track(finalizeColorTexture(wallC, aniso, 4, 1));
  const wallBump = track(finalizeLinearTexture(wallBC, aniso, 4, 1));

  // 4. Scratched dark steel gondola metal
  const [metC, metCtx] = makeCanvas(256, 256);
  metCtx.fillStyle = '#272b30';
  metCtx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 1600; i++) {
    const x = Math.random() * 256;
    const y = Math.random() * 256;
    metCtx.fillStyle =
      Math.random() > 0.72
        ? 'rgba(120, 53, 15, 0.22)'
        : Math.random() > 0.4
        ? 'rgba(148, 163, 184, 0.14)'
        : 'rgba(10, 12, 15, 0.25)';
    metCtx.fillRect(x, y, 4 + Math.random() * 14, 1);
  }
  const gondolaMetalColor = track(finalizeColorTexture(metC, aniso, 2, 2));

  // 5. Weathered Dark Wood (Pallets & Checkout Counter Trim)
  const [woodC, woodCtx] = makeCanvas(256, 256);
  const [woodBC, woodBCtx] = makeCanvas(256, 256);
  woodCtx.fillStyle = '#4e331f';
  woodCtx.fillRect(0, 0, 256, 256);
  woodBCtx.fillStyle = '#808080';
  woodBCtx.fillRect(0, 0, 256, 256);
  for (let y = 0; y < 256; y += 2) {
    const v = Math.sin(y * 0.16) * 12 + (Math.random() - 0.5) * 14;
    const r = Math.max(24, Math.min(150, 78 + v));
    const g = Math.max(16, Math.min(110, 50 + v * 0.65));
    const b = Math.max(12, Math.min(80, 30 + v * 0.4));
    woodCtx.fillStyle = `rgb(${r},${g},${b})`;
    woodCtx.fillRect(0, y, 256, 2);
    const bv = Math.floor(128 + v * 1.6);
    woodBCtx.fillStyle = `rgb(${bv},${bv},${bv})`;
    woodBCtx.fillRect(0, y, 256, 2);
  }
  for (const py of [64, 128, 192]) {
    woodCtx.fillStyle = 'rgba(14, 8, 4, 0.65)';
    woodCtx.fillRect(0, py, 256, 2);
    woodBCtx.fillStyle = '#303030';
    woodBCtx.fillRect(0, py, 256, 2);
  }
  const woodCounterColor = track(finalizeColorTexture(woodC, aniso, 2, 1));
  const woodBump = track(finalizeLinearTexture(woodBC, aniso, 2, 1));

  // 6. Bark & dark foliage for perimeter trees beyond parking lot
  const [barkC, barkCtx] = makeCanvas(256, 256);
  const [barkBC, barkBCtx] = makeCanvas(256, 256);
  barkCtx.fillStyle = '#2d2018';
  barkCtx.fillRect(0, 0, 256, 256);
  barkBCtx.fillStyle = '#808080';
  barkBCtx.fillRect(0, 0, 256, 256);
  for (let x = 0; x < 256; x += 2) {
    const ridge = Math.sin(x * 0.25) * 16 + (Math.random() - 0.5) * 18;
    const r = Math.max(18, Math.min(90, 44 + ridge));
    const g = Math.max(14, Math.min(72, 32 + ridge * 0.72));
    const b = Math.max(12, Math.min(60, 24 + ridge * 0.5));
    barkCtx.fillStyle = `rgb(${r},${g},${b})`;
    barkCtx.fillRect(x, 0, 2, 256);
    const bv = Math.floor(128 + ridge * 2.2);
    barkBCtx.fillStyle = `rgb(${bv},${bv},${bv})`;
    barkBCtx.fillRect(x, 0, 2, 256);
  }
  const barkColor = track(finalizeColorTexture(barkC, aniso, 2, 2));
  const barkBump = track(finalizeLinearTexture(barkBC, aniso, 2, 2));

  const [folC, folCtx] = makeCanvas(256, 256);
  folCtx.fillStyle = '#142416';
  folCtx.fillRect(0, 0, 256, 256);
  const leafColors = ['#0d1c10', '#162b17', '#1f3a20', '#122214'];
  for (let i = 0; i < 850; i++) {
    const lx = Math.random() * 256;
    const ly = Math.random() * 256;
    folCtx.fillStyle = leafColors[i % leafColors.length];
    folCtx.beginPath();
    folCtx.ellipse(lx, ly, 5 + Math.random() * 5, 3 + Math.random() * 3, Math.random() * Math.PI, 0, Math.PI * 2);
    folCtx.fill();
  }
  const foliageColor = track(finalizeColorTexture(folC, aniso, 2, 2));

  // 7. Character PBR textures (woven cloth, denim, bloodied butcher apron, skin pores)
  const [fabBC, fabBCtx] = makeCanvas(128, 128);
  fabBCtx.fillStyle = '#808080';
  fabBCtx.fillRect(0, 0, 128, 128);
  for (let y = 0; y < 128; y += 2) {
    for (let x = 0; x < 128; x += 2) {
      const weave = ((x + y) % 4 === 0 ? 18 : -16) + (Math.random() - 0.5) * 14;
      const v = Math.max(40, Math.min(220, Math.floor(128 + weave)));
      fabBCtx.fillStyle = `rgb(${v},${v},${v})`;
      fabBCtx.fillRect(x, y, 2, 2);
    }
  }
  const fabricBump = track(finalizeLinearTexture(fabBC, aniso, 5, 5));

  const [denC, denCtx] = makeCanvas(256, 256);
  denCtx.fillStyle = '#1e293b';
  denCtx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 4200; i++) {
    denCtx.fillStyle = Math.random() > 0.55 ? 'rgba(60, 84, 118, 0.26)' : 'rgba(12, 16, 24, 0.36)';
    denCtx.fillRect(Math.random() * 256, Math.random() * 256, 2, 1);
  }
  const denimColor = track(finalizeColorTexture(denC, aniso, 2, 2));

  const [apC, apCtx] = makeCanvas(256, 256);
  apCtx.fillStyle = '#cbd5e1';
  apCtx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 2400; i++) {
    apCtx.fillStyle = 'rgba(51, 65, 85, 0.14)';
    apCtx.fillRect(Math.random() * 256, Math.random() * 256, 3, 2);
  }
  for (let b = 0; b < 22; b++) {
    const bx = 25 + ((b * 43) % 210);
    const by = 40 + ((b * 61) % 190);
    const r = 8 + (b % 4) * 7;
    const g = apCtx.createRadialGradient(bx, by, 1, bx, by, r);
    g.addColorStop(0, 'rgba(110, 12, 18, 0.85)');
    g.addColorStop(1, 'rgba(90, 10, 14, 0)');
    apCtx.fillStyle = g;
    apCtx.fillRect(bx - r, by - r, r * 2, r * 2);
  }
  const apronBloodColor = track(finalizeColorTexture(apC, aniso, 1, 1));

  const [skinBC, skinBCtx] = makeCanvas(128, 128);
  skinBCtx.fillStyle = '#808080';
  skinBCtx.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 2400; i++) {
    const v = 112 + Math.floor(Math.random() * 32);
    skinBCtx.fillStyle = `rgb(${v},${v},${v})`;
    skinBCtx.fillRect(Math.random() * 128, Math.random() * 128, 1, 1);
  }
  const skinBump = track(finalizeLinearTexture(skinBC, aniso, 3, 3));

  // 8. Supermarket Signs ("SÚPER NOCTURNO · 00:00 - 03:00 AM", Depósito, Delivery Mat)
  const [signC, signCtx] = makeCanvas(640, 192);
  signCtx.fillStyle = '#090d14';
  signCtx.fillRect(0, 0, 640, 192);
  signCtx.strokeStyle = '#dc2626';
  signCtx.lineWidth = 10;
  signCtx.strokeRect(10, 10, 620, 172);
  signCtx.fillStyle = '#fca5a5';
  signCtx.font = 'bold 46px sans-serif';
  signCtx.textAlign = 'center';
  signCtx.fillText('SÚPER NOCTURNO 24/7', 320, 74);
  signCtx.fillStyle = '#e2e8f0';
  signCtx.font = 'bold 24px sans-serif';
  signCtx.fillText('AUTOSERVICIO · CARNICERÍA · ALMACÉN', 320, 118);
  signCtx.fillStyle = '#f87171';
  signCtx.font = 'bold 20px monospace';
  signCtx.fillText('TURNO NOCHE: 00:00 A 03:00 AM', 320, 155);
  const superSignColor = track(finalizeColorTexture(signC, aniso, 1, 1));
  superSignColor.wrapS = THREE.ClampToEdgeWrapping;
  superSignColor.wrapT = THREE.ClampToEdgeWrapping;

  const [depC, depCtx] = makeCanvas(512, 128);
  depCtx.fillStyle = '#1f0808';
  depCtx.fillRect(0, 0, 512, 128);
  depCtx.strokeStyle = '#ef4444';
  depCtx.lineWidth = 8;
  depCtx.strokeRect(8, 8, 496, 112);
  depCtx.fillStyle = '#fecaca';
  depCtx.font = 'bold 34px sans-serif';
  depCtx.textAlign = 'center';
  depCtx.fillText('DEPÓSITO / ALMACÉN', 256, 58);
  depCtx.fillStyle = '#fca5a5';
  depCtx.font = 'bold 20px monospace';
  depCtx.fillText('BUSCÁ COMIDA ACÁ PARA REPONER', 256, 96);
  const depositoSignColor = track(finalizeColorTexture(depC, aniso, 1, 1));
  depositoSignColor.wrapS = THREE.ClampToEdgeWrapping;
  depositoSignColor.wrapT = THREE.ClampToEdgeWrapping;

  const [matC, matCtx] = makeCanvas(512, 256);
  matCtx.fillStyle = '#111827';
  matCtx.fillRect(0, 0, 512, 256);
  matCtx.strokeStyle = '#f59e0b';
  matCtx.lineWidth = 8;
  matCtx.setLineDash([20, 12]);
  matCtx.strokeRect(14, 14, 484, 228);
  matCtx.setLineDash([]);
  matCtx.fillStyle = '#fde68a';
  matCtx.font = 'bold 34px sans-serif';
  matCtx.textAlign = 'center';
  matCtx.fillText('CAJA 1 · ENTREGA', 256, 114);
  matCtx.fillStyle = '#93c5fd';
  matCtx.font = 'bold 20px sans-serif';
  matCtx.fillText('SOLTÁ LOS PRODUCTOS ACÁ PARA COBRAR', 256, 158);
  const deliveryMatColor = track(finalizeColorTexture(matC, aniso, 1, 1));
  deliveryMatColor.wrapS = THREE.ClampToEdgeWrapping;
  deliveryMatColor.wrapT = THREE.ClampToEdgeWrapping;

  // 9. Product label textures
  const productLabels = {} as Record<ProductId, THREE.CanvasTexture>;
  for (const prod of PRODUCT_LIST) {
    const [pc, pCtx] = makeCanvas(256, 128);
    pCtx.fillStyle = prod.primaryColor;
    pCtx.fillRect(0, 0, 256, 128);
    pCtx.fillStyle = prod.accentColor;
    pCtx.fillRect(0, 0, 256, 20);
    pCtx.fillRect(0, 108, 256, 20);
    pCtx.fillStyle = '#ffffff';
    pCtx.font = 'bold 30px sans-serif';
    pCtx.textAlign = 'center';
    pCtx.fillText(prod.shortName.toUpperCase(), 128, 68);
    pCtx.fillStyle = '#fef08a';
    pCtx.font = 'bold 22px monospace';
    pCtx.fillText(`$${prod.price}`, 128, 98);
    const tex = track(finalizeColorTexture(pc, aniso, 1, 1));
    tex.wrapS = THREE.ClampToEdgeWrapping;
    tex.wrapT = THREE.ClampToEdgeWrapping;
    productLabels[prod.id] = tex;
  }

  // 10. Soft radial contact shadow
  const [shC, shCtx] = makeCanvas(128, 128);
  const grad = shCtx.createRadialGradient(64, 64, 6, 64, 64, 62);
  grad.addColorStop(0, 'rgba(4, 6, 8, 0.78)');
  grad.addColorStop(0.55, 'rgba(4, 6, 8, 0.34)');
  grad.addColorStop(1, 'rgba(4, 6, 8, 0)');
  shCtx.fillStyle = grad;
  shCtx.fillRect(0, 0, 128, 128);
  const contactShadow = track(finalizeColorTexture(shC, aniso, 1, 1));
  contactShadow.wrapS = THREE.ClampToEdgeWrapping;
  contactShadow.wrapT = THREE.ClampToEdgeWrapping;

  // 11. Grimy, Scuffed Horror Supermarket Tile Floor + Grout Bump + Specular Puddles
  const [tileC, tileCtx] = makeCanvas(256, 256);
  const [tileBC, tileBCtx] = makeCanvas(256, 256);
  const [tileRC, tileRCtx] = makeCanvas(256, 256);
  tileBCtx.fillStyle = '#e0e0e0';
  tileBCtx.fillRect(0, 0, 256, 256);
  tileRCtx.fillStyle = '#4c4c4c';
  tileRCtx.fillRect(0, 0, 256, 256);
  const sq = 64;
  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 4; c++) {
      const dark = (r + c) % 2 === 0;
      tileCtx.fillStyle = dark ? '#2a2e33' : '#6c7075';
      tileCtx.fillRect(c * sq, r * sq, sq, sq);
      tileCtx.fillStyle = dark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.06)';
      tileCtx.fillRect(c * sq + 4, r * sq + 4, sq - 8, sq - 8);
      tileCtx.strokeStyle = 'rgba(10, 12, 14, 0.65)';
      tileCtx.lineWidth = 3;
      tileCtx.strokeRect(c * sq + 1, r * sq + 1, sq - 2, sq - 2);
      tileBCtx.strokeStyle = '#484848';
      tileBCtx.lineWidth = 3;
      tileBCtx.strokeRect(c * sq + 1, r * sq + 1, sq - 2, sq - 2);
      tileRCtx.strokeStyle = '#d4d4d4';
      tileRCtx.lineWidth = 4;
      tileRCtx.strokeRect(c * sq + 1, r * sq + 1, sq - 2, sq - 2);
    }
  }
  // Scuff grime + subtle rust/blood smears on supermarket tiles
  for (let g = 0; g < 18; g++) {
    const gx = (g * 47) % 230;
    const gy = (g * 67) % 230;
    const rad = 14 + (g % 3) * 10;
    const sg = tileCtx.createRadialGradient(gx, gy, 2, gx, gy, rad);
    sg.addColorStop(0, g % 6 === 0 ? 'rgba(88, 16, 18, 0.34)' : 'rgba(14, 16, 18, 0.35)');
    sg.addColorStop(1, 'rgba(0,0,0,0)');
    tileCtx.fillStyle = sg;
    tileCtx.fillRect(gx - rad, gy - rad, rad * 2, rad * 2);
  }
  const tileFloorColor = track(finalizeColorTexture(tileC, aniso, 11, 9));
  const tileBump = track(finalizeLinearTexture(tileBC, aniso, 11, 9));
  const tileRoughness = track(finalizeLinearTexture(tileRC, aniso, 11, 9));

  // 12. Chiller & Aisle Marquee Headers
  const makeHeader = (bg: string, title: string, accent: string) => {
    const [fc, fCtx] = makeCanvas(512, 80);
    fCtx.fillStyle = bg;
    fCtx.fillRect(0, 0, 512, 80);
    fCtx.strokeStyle = accent;
    fCtx.lineWidth = 4;
    fCtx.strokeRect(4, 4, 504, 72);
    fCtx.fillStyle = '#f8fafc';
    fCtx.font = 'bold 30px sans-serif';
    fCtx.textAlign = 'center';
    fCtx.fillText(title, 256, 51);
    const t = track(finalizeColorTexture(fc, aniso, 1, 1));
    t.wrapS = THREE.ClampToEdgeWrapping;
    t.wrapT = THREE.ClampToEdgeWrapping;
    return t;
  };
  const aisleMeatHeaderColor = makeHeader('#450a0a', 'CARNICERÍA Y LÁCTEOS', '#fca5a5');
  const aisleColdHeaderColor = makeHeader('#082f49', 'HELADERA CENTRAL · FRÍO', '#7dd3fc');

  // 13. Soft radial halo glow sprite texture
  const [glC, glCtx] = makeCanvas(128, 128);
  const glGrad = glCtx.createRadialGradient(64, 64, 2, 64, 64, 62);
  glGrad.addColorStop(0, 'rgba(226, 244, 255, 0.95)');
  glGrad.addColorStop(0.35, 'rgba(186, 230, 253, 0.42)');
  glGrad.addColorStop(1, 'rgba(125, 211, 252, 0)');
  glCtx.fillStyle = glGrad;
  glCtx.fillRect(0, 0, 128, 128);
  const radialGlow = track(finalizeColorTexture(glC, aniso, 1, 1));
  radialGlow.wrapS = THREE.ClampToEdgeWrapping;
  radialGlow.wrapT = THREE.ClampToEdgeWrapping;

  return {
    asphaltColor,
    asphaltBump,
    asphaltRoughness,
    concreteColor,
    concreteBump,
    superWallColor,
    wallBump,
    woodCounterColor,
    woodBump,
    gondolaMetalColor,
    barkColor,
    barkBump,
    foliageColor,
    fabricBump,
    denimColor,
    apronBloodColor,
    skinBump,
    superSignColor,
    depositoSignColor,
    deliveryMatColor,
    tileFloorColor,
    tileBump,
    tileRoughness,
    aisleMeatHeaderColor,
    aisleColdHeaderColor,
    radialGlow,
    productLabels,
    contactShadow,
    dispose: () => {
      for (const tex of allTextures) tex.dispose();
    },
  };
}
