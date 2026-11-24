import type {
  ActionButtonConfig,
  AmbientAudioParams,
  AmbientDayPhase,
  CounterItemSnapshot,
  CustomizableButtonId,
  GeminiVoiceName,
  HorrorEventTrigger,
  HorrorEventType,
  InventoryRow,
  InventorySortKey,
  KioscoUpgradeDef,
  KioscoUpgradeId,
  MissionActionStep,
  NightChapter,
  NpcArchetype,
  NpcEncounter,
  NpcStatus,
  OrderEvaluation,
  OrderItem,
  PaymentMethod,
  PaymentResult,
  PlayerProfile,
  ProductCategory,
  ProductDef,
  ProductId,
  RestockZoneId,
  RestockZoneState,
  SecretEventDef,
  SensitivityPreset,
  ShirtOption,
  SoldRecord,
  VoiceProfile,
} from './types';

export const SHIFT_TARGET_MINUTES = 180; // 00:00 -> 03:00 AM (180 minutes)
export const SHIFT_START_SECONDS = 0; // 00:00 AM

export const PRODUCT_CATALOG: Record<ProductId, ProductDef> = {
  carne: {
    id: 'carne',
    name: 'Bandeja de Carne Fría',
    shortName: 'Carne',
    category: 'Carnes y Lácteos',
    price: 3400,
    mass: 0.48,
    size: [0.22, 0.08, 0.16],
    primaryColor: '#881337',
    accentColor: '#fecdd3',
    shape: 'box',
  },
  leche: {
    id: 'leche',
    name: 'Leche Entera 1L',
    shortName: 'Leche',
    category: 'Carnes y Lácteos',
    price: 1600,
    mass: 0.54,
    size: [0.11, 0.25, 0.11],
    primaryColor: '#1d4ed8',
    accentColor: '#eff6ff',
    shape: 'box',
  },
  fideos: {
    id: 'fideos',
    name: 'Paquete de Fideos',
    shortName: 'Fideos',
    category: 'Almacén',
    price: 1400,
    mass: 0.35,
    size: [0.18, 0.24, 0.09],
    primaryColor: '#d97706',
    accentColor: '#fef3c7',
    shape: 'pouch',
  },
  cafe: {
    id: 'cafe',
    name: 'Frasco de Café Negro',
    shortName: 'Café',
    category: 'Almacén',
    price: 2900,
    mass: 0.42,
    size: [0.13, 0.21, 0.13],
    primaryColor: '#3f2014',
    accentColor: '#f59e0b',
    shape: 'bottle',
  },
  gaseosa: {
    id: 'gaseosa',
    name: 'Gaseosa Cola 1.5L',
    shortName: 'Gaseosa',
    category: 'Bebidas',
    price: 2100,
    mass: 0.65,
    size: [0.12, 0.29, 0.12],
    primaryColor: '#991b1b',
    accentColor: '#f8fafc',
    shape: 'bottle',
  },
  agua: {
    id: 'agua',
    name: 'Agua Mineral Fría',
    shortName: 'Agua',
    category: 'Bebidas',
    price: 1300,
    mass: 0.52,
    size: [0.11, 0.27, 0.11],
    primaryColor: '#0284c7',
    accentColor: '#e0f2fe',
    shape: 'bottle',
  },
  pan: {
    id: 'pan',
    name: 'Pan Lactal de Molde',
    shortName: 'Pan',
    category: 'Panadería',
    price: 1850,
    mass: 0.28,
    size: [0.22, 0.14, 0.13],
    primaryColor: '#b45309',
    accentColor: '#fde68a',
    shape: 'pouch',
  },
  galletitas: {
    id: 'galletitas',
    name: 'Galletitas Dulces',
    shortName: 'Galletitas',
    category: 'Panadería',
    price: 1200,
    mass: 0.2,
    size: [0.19, 0.08, 0.12],
    primaryColor: '#6d28d9',
    accentColor: '#fde047',
    shape: 'box',
  },
};

export const PRODUCT_LIST: ProductDef[] = Object.values(PRODUCT_CATALOG);

export interface RestockZoneConfig {
  id: RestockZoneId;
  label: string;
  shortLabel: string;
  acceptedProducts: ProductId[];
  pos: [number, number, number];
}

export const RESTOCK_ZONES: RestockZoneConfig[] = [
  {
    id: 'heladera_carnes',
    label: 'Heladera Carnicería y Lácteos',
    shortLabel: 'Carnes/Lácteos',
    acceptedProducts: ['carne', 'leche'],
    pos: [-5.65, 1.35, 1.1],
  },
  {
    id: 'gondola_almacen',
    label: 'Góndola 1 · Almacén',
    shortLabel: 'Góndola Almacén',
    acceptedProducts: ['fideos', 'cafe'],
    pos: [-1.75, 1.35, 1.1],
  },
  {
    id: 'gondola_bebidas',
    label: 'Góndola 2 · Bebidas y Pan',
    shortLabel: 'Góndola Bebidas',
    acceptedProducts: ['gaseosa', 'pan'],
    pos: [1.75, 1.35, 1.1],
  },
  {
    id: 'heladera_bebidas',
    label: 'Heladera Central y Panificados',
    shortLabel: 'Heladera Central',
    acceptedProducts: ['agua', 'galletitas'],
    pos: [5.65, 1.35, 1.1],
  },
];

export function createInitialRestockZones(): RestockZoneState[] {
  return RESTOCK_ZONES.map((z, idx) => ({
    ...z,
    stockPercent: idx === 0 ? 45 : 85 - idx * 8,
    needsRestock: idx === 0,
    isCritical: false,
    lastRestockedAt: 0,
  }));
}

export function tickRestockZones(
  zones: RestockZoneState[],
  dt: number,
  depleteRatePerSec: number,
  activeNpcAttacking: boolean
): {
  nextZones: RestockZoneState[];
  criticalCount: number;
  urgentCount: number;
  stabilityDrain: number;
} {
  const threatMult = activeNpcAttacking ? 1.55 : 1.0;
  let criticalCount = 0;
  let urgentCount = 0;
  let stabilityDrain = 0;

  const nextZones = zones.map((zone, idx) => {
    // Stagger depletion slightly across shelves so tasks arrive rhythmically
    const rhythm = 0.78 + ((idx * 37) % 10) * 0.048;
    const nextPct = Math.max(0, zone.stockPercent - dt * depleteRatePerSec * rhythm * threatMult);
    const needsRestock = nextPct <= 40;
    const isCritical = nextPct <= 14;
    if (needsRestock) urgentCount++;
    if (isCritical) {
      criticalCount++;
      stabilityDrain += dt * 1.45;
    }
    return {
      ...zone,
      stockPercent: nextPct,
      needsRestock,
      isCritical,
    };
  });

  return { nextZones, criticalCount, urgentCount, stabilityDrain };
}

export function tryRestockZoneWithProduct(
  zones: RestockZoneState[],
  zoneId: RestockZoneId,
  productId: ProductId,
  shiftTimeSec: number
): { ok: boolean; nextZones: RestockZoneState[]; bonusCash: number; stabilityGain: number } {
  const target = zones.find((z) => z.id === zoneId);
  if (!target) {
    return { ok: false, nextZones: zones, bonusCash: 0, stabilityGain: 0 };
  }
  const accepts = target.acceptedProducts.includes(productId);
  if (!accepts) {
    return { ok: false, nextZones: zones, bonusCash: 0, stabilityGain: 0 };
  }
  const nextZones = zones.map((z) =>
    z.id === zoneId
      ? {
          ...z,
          stockPercent: 100,
          needsRestock: false,
          isCritical: false,
          lastRestockedAt: shiftTimeSec,
        }
      : z
  );
  return {
    ok: true,
    nextZones,
    bonusCash: target.isCritical ? 650 : 450,
    stabilityGain: target.isCritical ? 10 : 7,
  };
}

export function formatShiftClock(shiftSeconds: number): {
  timeLabel: string;
  shiftMinutes: number;
  progressPercent: number;
  isShiftComplete: boolean;
} {
  const clamped = Math.max(0, Math.min(SHIFT_TARGET_MINUTES, shiftSeconds));
  const totalMins = Math.floor(clamped);
  const hh = String(Math.floor(totalMins / 60)).padStart(2, '0');
  const mm = String(totalMins % 60).padStart(2, '0');
  return {
    timeLabel: `${hh}:${mm} AM`,
    shiftMinutes: totalMins,
    progressPercent: Math.min(100, Math.round((clamped / SHIFT_TARGET_MINUTES) * 100)),
    isShiftComplete: clamped >= SHIFT_TARGET_MINUTES,
  };
}

export const SHIRT_OPTIONS: ShirtOption[] = [
  { id: 'super_rojo', label: 'Uniforme Súper Rojo', primary: '#991b1b', secondary: '#18181b' },
  { id: 'super_azul', label: 'Turno Noche Azul', primary: '#1e3a8a', secondary: '#e2e8f0' },
  { id: 'ferroviario', label: 'Chomba Negra', primary: '#18181b', secondary: '#f4f4f5' },
  { id: 'verde', label: 'Repositor Verde', primary: '#14532d', secondary: '#bbf7d0' },
];

export const DEFAULT_PLAYER_PROFILE: PlayerProfile = {
  playerName: 'Santi',
  friendName: 'El Tucu',
  shirtId: 'super_rojo',
  skinTone: '#d9a077',
  hairColor: '#1f1b18',
  hasCap: true,
};

// Checkout Counter surface height & delivery tray bounds in world space (meters)
export const COUNTER_SURFACE_Y = 1.05;
export const COUNTER_DELIVERY_ZONE = {
  minX: -4.65,
  maxX: -2.25,
  minY: COUNTER_SURFACE_Y - 0.1,
  maxY: COUNTER_SURFACE_Y + 0.7,
  minZ: -4.05,
  maxZ: -2.75,
};

export const WORLD_WALK_BOUNDS = {
  minX: -14,
  maxX: 14,
  minZ: -12.5,
  maxZ: 7.3,
};

interface StaticObstacle2D {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

// Solid obstacles for spacious horror supermarket (leaves open front entrance [-1.6..1.6, z=-6], 3 wide aisles, and Depósito door [-1.65..1.65, z=5.0])
const WALK_OBSTACLES: StaticObstacle2D[] = [
  // Front storefront glass walls leaving [-1.6, 1.6] wide sliding entrance open
  { minX: -7.4, maxX: -1.6, minZ: -6.2, maxZ: -5.8 },
  { minX: 1.6, maxX: 7.4, minZ: -6.2, maxZ: -5.8 },
  // Left & Right outer supermarket walls + perimeter chillers
  { minX: -7.4, maxX: -6.2, minZ: -6.2, maxZ: 7.8 },
  { minX: 6.2, maxX: 7.4, minZ: -6.2, maxZ: 7.8 },
  // Back wall behind Depósito
  { minX: -7.4, maxX: 7.4, minZ: 7.45, maxZ: 7.95 },
  // Depósito partition walls leaving wide center doorway [-1.65, 1.65] at z=5.0
  { minX: -7.2, maxX: -1.65, minZ: 4.82, maxZ: 5.18 },
  { minX: 1.65, maxX: 7.2, minZ: 4.82, maxZ: 5.18 },
  // Checkout counter & cash register lane
  { minX: -5.3, maxX: -1.85, minZ: -4.2, maxZ: -2.95 },
  // Gondola 1 (Almacén) & Gondola 2 (Bebidas y Pan)
  { minX: -3.05, maxX: -2.05, minZ: -1.45, maxZ: 3.65 },
  { minX: 2.05, maxX: 3.05, minZ: -1.45, maxZ: 3.65 },
];

export function resolvePlayerMapPosition(
  x: number,
  z: number,
  radius = 0.34
): { x: number; z: number } {
  let px = Math.max(WORLD_WALK_BOUNDS.minX, Math.min(WORLD_WALK_BOUNDS.maxX, x));
  let pz = Math.max(WORLD_WALK_BOUNDS.minZ, Math.min(WORLD_WALK_BOUNDS.maxZ, z));

  for (let pass = 0; pass < 2; pass++) {
    for (const obs of WALK_OBSTACLES) {
      const closestX = Math.max(obs.minX, Math.min(px, obs.maxX));
      const closestZ = Math.max(obs.minZ, Math.min(pz, obs.maxZ));
      const dx = px - closestX;
      const dz = pz - closestZ;
      const distSq = dx * dx + dz * dz;
      if (distSq < radius * radius) {
        if (distSq > 1e-6) {
          const dist = Math.sqrt(distSq);
          const push = radius - dist;
          px += (dx / dist) * push;
          pz += (dz / dist) * push;
        } else {
          const penLeft = Math.abs(px - obs.minX);
          const penRight = Math.abs(obs.maxX - px);
          const penTop = Math.abs(pz - obs.minZ);
          const penBot = Math.abs(obs.maxZ - pz);
          const m = Math.min(penLeft, penRight, penTop, penBot);
          if (m === penLeft) px = obs.minX - radius;
          else if (m === penRight) px = obs.maxX + radius;
          else if (m === penTop) pz = obs.minZ - radius;
          else pz = obs.maxZ + radius;
        }
      }
    }
  }

  return { x: px, z: pz };
}

export function getPlayerZoneLabel(x: number, z: number): string {
  if (z < -6.0) {
    return 'Estacionamiento Oscuro';
  }
  if (z >= 5.0) {
    return 'Depósito / Almacén';
  }
  if (z <= -2.1 && x <= -0.8) {
    return 'Zona de Cajas';
  }
  if (x < -3.05) {
    return 'Pasillo Carnes y Lácteos';
  }
  if (x > 3.05) {
    return 'Pasillo Heladeras Centrales';
  }
  return 'Pasillo Central · Góndolas';
}

export function isPointInDeliveryZone(x: number, y: number, z: number): boolean {
  return (
    x >= COUNTER_DELIVERY_ZONE.minX &&
    x <= COUNTER_DELIVERY_ZONE.maxX &&
    y >= COUNTER_DELIVERY_ZONE.minY &&
    y <= COUNTER_DELIVERY_ZONE.maxY &&
    z >= COUNTER_DELIVERY_ZONE.minZ &&
    z <= COUNTER_DELIVERY_ZONE.maxZ
  );
}

export function evaluateCounterOrder(
  orderItems: OrderItem[],
  itemsOnCounter: CounterItemSnapshot[]
): OrderEvaluation {
  const placedCounts = new Map<ProductId, number>();
  for (const item of itemsOnCounter) {
    if (isPointInDeliveryZone(item.x, item.y, item.z)) {
      placedCounts.set(item.productId, (placedCounts.get(item.productId) ?? 0) + 1);
    }
  }

  const remainingCounts = new Map<ProductId, number>(placedCounts);
  let totalRequestedPrice = 0;
  let missingCount = 0;

  const requested = orderItems.map((req) => {
    const def = PRODUCT_CATALOG[req.productId];
    const available = remainingCounts.get(req.productId) ?? 0;
    const placed = Math.min(req.quantity, available);
    remainingCounts.set(req.productId, available - placed);
    totalRequestedPrice += def.price * req.quantity;
    missingCount += Math.max(0, req.quantity - placed);
    return {
      productId: req.productId,
      name: def.name,
      unitPrice: def.price,
      needed: req.quantity,
      placed,
    };
  });

  const extraOnCounter: OrderEvaluation['extraOnCounter'] = [];
  for (const [productId, count] of remainingCounts.entries()) {
    if (count > 0) {
      extraOnCounter.push({
        productId,
        name: PRODUCT_CATALOG[productId].name,
        count,
      });
    }
  }

  let totalCounterPrice = 0;
  for (const [productId, count] of placedCounts.entries()) {
    totalCounterPrice += PRODUCT_CATALOG[productId].price * count;
  }

  return {
    requested,
    extraOnCounter,
    totalRequestedPrice,
    totalCounterPrice,
    isComplete: missingCount === 0 && orderItems.length > 0,
    missingCount,
  };
}

export function calculatePayment(
  total: number,
  tendered: number,
  method: PaymentMethod
): PaymentResult {
  if (total <= 0) {
    return {
      ok: false,
      method,
      total,
      tendered: 0,
      change: 0,
      error: 'No hay productos válidos para cobrar.',
    };
  }
  if (method === 'qr') {
    return {
      ok: true,
      method: 'qr',
      total,
      tendered: total,
      change: 0,
    };
  }
  if (!Number.isFinite(tendered) || tendered < total) {
    return {
      ok: false,
      method: 'efectivo',
      total,
      tendered: Number.isFinite(tendered) ? tendered : 0,
      change: 0,
      error: `Faltan $${Math.max(0, total - (Number.isFinite(tendered) ? tendered : 0)).toLocaleString('es-AR')} para cubrir el total.`,
    };
  }
  return {
    ok: true,
    method: 'efectivo',
    total,
    tendered,
    change: tendered - total,
  };
}

export function createInitialStock(): Record<ProductId, number> {
  return {
    carne: 5,
    leche: 5,
    fideos: 6,
    cafe: 5,
    gaseosa: 6,
    agua: 6,
    pan: 5,
    galletitas: 6,
  };
}

export function createInitialSoldRecords(): Record<ProductId, SoldRecord> {
  const records = {} as Record<ProductId, SoldRecord>;
  for (const product of PRODUCT_LIST) {
    records[product.id] = {
      productId: product.id,
      quantitySold: 0,
      revenue: 0,
      lastSoldCustomer: '—',
    };
  }
  return records;
}

export function recordSaleToInventory(
  currentStock: Record<ProductId, number>,
  currentSold: Record<ProductId, SoldRecord>,
  soldItems: OrderItem[],
  customerName: string
): {
  nextStock: Record<ProductId, number>;
  nextSold: Record<ProductId, SoldRecord>;
  revenueAdded: number;
} {
  const nextStock = { ...currentStock };
  const nextSold = { ...currentSold };
  let revenueAdded = 0;

  for (const item of soldItems) {
    const def = PRODUCT_CATALOG[item.productId];
    if (!def || item.quantity <= 0) continue;
    const prevRecord = nextSold[item.productId];
    const itemRevenue = def.price * item.quantity;
    revenueAdded += itemRevenue;
    nextStock[item.productId] = Math.max(0, (nextStock[item.productId] ?? 0) - item.quantity);
    nextSold[item.productId] = {
      productId: item.productId,
      quantitySold: prevRecord.quantitySold + item.quantity,
      revenue: prevRecord.revenue + itemRevenue,
      lastSoldCustomer: customerName,
    };
  }

  return { nextStock, nextSold, revenueAdded };
}

export function getOrganizedInventoryRows(
  stock: Record<ProductId, number>,
  sold: Record<ProductId, SoldRecord>,
  categoryFilter: ProductCategory | 'Todas',
  sortBy: InventorySortKey
): InventoryRow[] {
  const rows: InventoryRow[] = PRODUCT_LIST.filter(
    (p) => categoryFilter === 'Todas' || p.category === categoryFilter
  ).map((product) => {
    const rec = sold[product.id];
    return {
      product,
      stock: stock[product.id] ?? 0,
      quantitySold: rec?.quantitySold ?? 0,
      revenue: rec?.revenue ?? 0,
      lastSoldCustomer: rec?.lastSoldCustomer ?? '—',
    };
  });

  rows.sort((a, b) => {
    switch (sortBy) {
      case 'sold_desc':
        return b.quantitySold - a.quantitySold || b.revenue - a.revenue;
      case 'revenue_desc':
        return b.revenue - a.revenue || b.quantitySold - a.quantitySold;
      case 'stock_asc':
        return a.stock - b.stock || a.product.name.localeCompare(b.product.name);
      case 'name_asc':
        return a.product.name.localeCompare(b.product.name);
    }
  });

  return rows;
}

const FEMALE_NAME_HINTS =
  /\b(doña|mujer|dama|clienta|aparición|aparicion|norma|maría|maria|ana|rosa|laura|lucía|lucia|sofía|sofia|camila|juana|marta|carla|paula|valentina|silvia|claudia|señora|abuela|chica|piba|enfermera)\b/i;

function hashString(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

export function getNarratorVoiceProfile(): VoiceProfile {
  return {
    id: 'narrator-intro',
    label: 'Supervisor del Súper · Turno Noche',
    voiceName: 'Charon',
    voiceStyle:
      'Low, eerie, tense Argentine human narrator whispering warnings about a haunted supermarket night shift until 3 AM in Rioplatense Spanish',
    pitch: 0.92,
    rate: 0.94,
    preferredGender: 'male',
  };
}

export function getFriendVoiceProfile(friendName: string): VoiceProfile {
  const isFemale = FEMALE_NAME_HINTS.test(friendName);
  const seed = hashString(friendName || 'El Tucu');
  const micro = ((seed % 5) - 2) * 0.015;
  const voiceName: GeminiVoiceName = isFemale ? 'Zephyr' : 'Puck';
  return {
    id: `friend-${seed}`,
    label: `Compañero de turno · ${friendName}`,
    voiceName,
    voiceStyle: isFemale
      ? 'Nervous but supportive young Argentine supermarket co-worker speaking casually in Rioplatense Spanish late at night'
      : 'Nervous, alert young Argentine supermarket night-shift worker talking quietly to his partner in Rioplatense Spanish',
    pitch: Number((1.01 + micro).toFixed(2)),
    rate: 1.02,
    preferredGender: isFemale ? 'female' : 'male',
  };
}

export function getNpcVoiceProfile(
  archetype: NpcArchetype,
  npcName: string,
  id?: string
): VoiceProfile {
  const isFemale = FEMALE_NAME_HINTS.test(npcName);
  const seed = hashString(`${archetype}:${npcName}:${id ?? ''}`);
  const pitchOffset = ((seed % 5) - 2) * 0.015;
  const rateOffset = (((seed >> 3) % 5) - 2) * 0.015;

  switch (archetype) {
    case 'camionero':
      return {
        id: `npc-${seed}`,
        label: 'Ronca y cansada · Cliente Nocturno',
        voiceName: isFemale ? 'Kore' : 'Fenrir',
        voiceStyle: isFemale
          ? 'Tired, low-voiced late-night shopper in an empty dark supermarket speaking Rioplatense Spanish'
          : 'Deep, gravelly tired night worker grabbing groceries after midnight in Argentine Spanish',
        pitch: Number((isFemale ? 0.98 : 0.9 + pitchOffset).toFixed(2)),
        rate: Number((0.94 + rateOffset).toFixed(2)),
        preferredGender: isFemale ? 'female' : 'male',
      };
    case 'paisano':
      return {
        id: `npc-${seed}`,
        label: isFemale ? 'Inquieta · Vecina de Madrugada' : 'Grave · Sereno',
        voiceName: isFemale ? 'Kore' : 'Charon',
        voiceStyle:
          'Hushed, uneasy late-night Argentine speaker whispering inside a flickering supermarket corridor',
        pitch: Number((isFemale ? 1.01 : 0.94 + pitchOffset).toFixed(2)),
        rate: Number((0.93 + rateOffset).toFixed(2)),
        preferredGender: isFemale ? 'female' : 'male',
      };
    case 'turista':
      return {
        id: `npc-${seed}`,
        label: 'Apurada · Cliente 01:00 AM',
        voiceName: isFemale ? 'Zephyr' : 'Puck',
        voiceStyle:
          'Fast, slightly startled late-night customer shopping quickly in an eerie supermarket in Rioplatense Spanish',
        pitch: Number((isFemale ? 1.03 : 1.0 + pitchOffset).toFixed(2)),
        rate: Number((1.03 + rateOffset).toFixed(2)),
        preferredGender: isFemale ? 'female' : 'male',
      };
    case 'pibe':
      return {
        id: `npc-${seed}`,
        label: 'Nervioso · Turno Anterior',
        voiceName: isFemale ? 'Zephyr' : 'Puck',
        voiceStyle:
          'Young nervous Argentine speaking fast in a dark supermarket aisle in Rioplatense Spanish',
        pitch: Number((isFemale ? 1.04 : 1.02 + pitchOffset).toFixed(2)),
        rate: Number((1.04 + rateOffset).toFixed(2)),
        preferredGender: isFemale ? 'female' : 'male',
      };
    case 'sospechoso':
      return {
        id: `npc-${seed}`,
        label: 'Fría y amenazante · Acechador',
        voiceName: isFemale ? 'Kore' : 'Charon',
        voiceStyle:
          'Cold, threatening, creepy hushed Argentine voice stalking supermarket aisles in Spanish',
        pitch: Number((isFemale ? 0.91 : 0.85 + pitchOffset).toFixed(2)),
        rate: Number((0.9 + rateOffset).toFixed(2)),
        preferredGender: isFemale ? 'female' : 'male',
      };
    case 'aparicion':
      return {
        id: `npc-${seed}`,
        label: 'Susurro espectral · Aparición 3 AM',
        voiceName: isFemale ? 'Kore' : 'Charon',
        voiceStyle:
          'Terrifying, ghostly, hollow whisper in Argentine Spanish echoing inside a dark haunted supermarket at 3 AM',
        pitch: Number((isFemale ? 0.88 : 0.8 + pitchOffset).toFixed(2)),
        rate: Number((0.84 + rateOffset).toFixed(2)),
        preferredGender: isFemale ? 'female' : 'male',
      };
  }
}

export function getNpcScaredLine(encounter: NpcEncounter): string {
  if (encounter.archetype === 'aparicion') {
    return '¡No... las luces volvieron! ¡Me escondo en la cámara frigorífica!';
  }
  if (encounter.isSuspicious) {
    return '¡Pará loco, bajá esa escopeta! ¡Ya salgo del súper!';
  }
  if (encounter.archetype === 'paisano') {
    return '¡Ay por favor! ¡No dispares, ya me voy!';
  }
  return '¡Qué hacés con eso! ¡Me voy de acá!';
}

export const STORY_ENCOUNTERS: NpcEncounter[] = [
  {
    id: 'story-1',
    npcName: 'Sergio (Guardia Nocturno)',
    archetype: 'camionero',
    greeting:
      'Qué frío hace en el pasillo de carnicería... Dame una bandeja de carne y un café negro rápido antes de que parpadeen los tubos.',
    friendComment: 'No dejes que se vacíe ninguna heladera o se corta la luz.',
    thanksLine: 'Mantené las góndolas llenas hasta las 3 AM.',
    isSuspicious: false,
    paymentMethod: 'efectivo',
    items: [
      { productId: 'carne', quantity: 1 },
      { productId: 'cafe', quantity: 1 },
    ],
    source: 'story',
    voiceProfile: getNpcVoiceProfile('camionero', 'Sergio (Guardia Nocturno)', 'story-1'),
  },
  {
    id: 'story-2',
    npcName: 'Doña Marta (Cliente 01:00 AM)',
    archetype: 'paisano',
    greeting:
      'Disculpame, hijo... escuché golpes adentro del depósito. ¿Me cobrás una leche entera y unos fideos para llevarme ya?',
    friendComment: 'Mirá si la heladera de lácteos necesita reposición.',
    thanksLine: 'No mires para atrás cuando vayas al depósito...',
    isSuspicious: false,
    paymentMethod: 'efectivo',
    items: [
      { productId: 'leche', quantity: 1 },
      { productId: 'fideos', quantity: 1 },
    ],
    source: 'story',
    voiceProfile: getNpcVoiceProfile('paisano', 'Doña Marta (Cliente 01:00 AM)', 'story-2'),
  },
  {
    id: 'story-3',
    npcName: 'Lucas (Repartidor Nocturno)',
    archetype: 'turista',
    greeting:
      'Che, dejé cajas en el depósito de atrás. Pasame un pan lactal y un agua fría, pago con QR que me quiero rajar de acá.',
    friendComment: 'Andá al depósito a buscar mercadería cuando bajen las góndolas.',
    thanksLine: 'Suerte aguantando hasta las 03:00 AM.',
    isSuspicious: false,
    paymentMethod: 'qr',
    items: [
      { productId: 'pan', quantity: 1 },
      { productId: 'agua', quantity: 1 },
    ],
    source: 'story',
    voiceProfile: getNpcVoiceProfile('turista', 'Lucas (Repartidor Nocturno)', 'story-3'),
  },
  {
    id: 'story-4',
    npcName: 'El Pibe del Turno Anterior',
    archetype: 'pibe',
    greeting:
      'Me olvidé la campera en el pasillo 2... dame unas galletitas y una gaseosa. Si ves una sombra blanca en la carnicería, no te quedes quieto.',
    friendComment: 'Este renunció la semana pasada después de las 2 de la mañana.',
    thanksLine: 'Si sobrevivís a las 3 AM te renuevan el contrato.',
    isSuspicious: false,
    paymentMethod: 'efectivo',
    items: [
      { productId: 'galletitas', quantity: 1 },
      { productId: 'gaseosa', quantity: 1 },
    ],
    source: 'story',
    voiceProfile: getNpcVoiceProfile('pibe', 'El Pibe del Turno Anterior', 'story-4'),
  },
  {
    id: 'story-5',
    npcName: 'El Carnicero Pálido',
    archetype: 'sospechoso',
    greeting:
      'Las heladeras están muy calientes esta noche... dame dos bandejas de carne ya mismo... o voy a pasar detrás de la caja.',
    friendComment: '¡Tiene el delantal manchado! Hablale tranquilo o usá el arma si ataca.',
    thanksLine: 'Nos vemos cuando se apague el pasillo...',
    isSuspicious: true,
    canAttack: true,
    attackDelaySec: 12,
    paymentMethod: 'efectivo',
    items: [{ productId: 'carne', quantity: 2 }],
    source: 'story',
    voiceProfile: getNpcVoiceProfile('sospechoso', 'El Carnicero Pálido', 'story-5'),
  },
];

export const KIOSCO_UPGRADES: KioscoUpgradeDef[] = [
  {
    id: 'reflector_led',
    name: 'Tubos LED de Emergencia',
    description: 'Ilumina más los pasillos oscuros y reduce los apagones repentinos.',
    cost: 2200,
  },
  {
    id: 'linterna_pro',
    name: 'Linterna Táctica Pro',
    description: 'Doble potencia de haz para ver sombras al fondo del súper y depósito.',
    cost: 2500,
  },
  {
    id: 'mostrador_pro',
    name: 'Escáner de Caja Rápido',
    description: 'Paga +$350 extra por cada venta cobrada en caja.',
    cost: 2900,
  },
  {
    id: 'alarma_ruta',
    name: 'Sensor de Pasillos',
    description: 'Avisa antes si una entidad o intruso va a atacar en el turno.',
    cost: 3300,
  },
];

export const SECRET_EVENTS: SecretEventDef[] = [
  {
    id: 'secret-cinta',
    title: 'Grabación VHS de las 03:00 AM',
    shortHint: 'Cinta de seguridad caída en el Depósito',
    discoveryText:
      'En la cinta se ve al súper vacío a las 03:00 AM... y una sombra reponiendo carne cruda con las luces apagadas.',
    friendReaction: '¡Mirá la hora de la cámara! Siempre pasa exactamente a las 3.',
    rewardCash: 1000,
    rewardRep: 10,
    pos: [-4.4, 0.45, 6.4],
  },
  {
    id: 'secret-nota',
    title: 'Nota del Repositor Desaparecido',
    shortHint: 'Libreta tirada junto a la Cámara Fría',
    discoveryText:
      '"Regla 1: Nunca dejes vacías las góndolas después de la 01:00. Si suena el tubo fluorescente, corré a reponer."',
    friendReaction: '¡Con razón se ponen agresivos cuando falta mercadería!',
    rewardCash: 1200,
    rewardRep: 10,
    pos: [4.6, 0.4, 6.2],
  },
  {
    id: 'secret-llave',
    title: 'Credencial Ensangrentada del Súper',
    shortHint: 'Credencial brillando en el estacionamiento',
    discoveryText:
      'Dice "TURNO NOCHE · CONTRATO RENOVADO ETERNAMENTE". Alguien intentó escapar por el playón.',
    friendReaction: 'Guardemos esto rápido y volvamos adentro antes que nos encierren.',
    rewardCash: 1500,
    rewardRep: 15,
    pos: [4.5, 0.35, -8.5],
  },
];

const NIGHT_2_ENCOUNTERS: NpcEncounter[] = [
  {
    id: 'night2-1',
    npcName: 'Lucas (Repartidor Nocturno)',
    archetype: 'turista',
    greeting:
      '¡Locos, vi alguien parado inmóvil mirando la leche en el pasillo 1! Dame café y pan que me voy volando.',
    friendComment: 'Fijate si las góndolas están llenas mientras cobrás.',
    thanksLine: '¡No apagues la linterna en el depósito!',
    isSuspicious: false,
    nightNumber: 2,
    paymentMethod: 'qr',
    items: [
      { productId: 'cafe', quantity: 1 },
      { productId: 'pan', quantity: 1 },
    ],
    source: 'story',
    voiceProfile: getNpcVoiceProfile('turista', 'Lucas (Repartidor Nocturno)', 'night2-1'),
  },
  {
    id: 'night2-2',
    npcName: 'La Clienta de las 02:00 AM',
    archetype: 'aparicion',
    greeting:
      '¿Por qué no hay nadie más comprando...? Dame leche fría y carne... si tardás mucho apago los pasillos.',
    friendComment: '¡No tiene sombra en las baldosas! Atendela rápido o defendete con el Arma.',
    thanksLine: 'Volveré antes de las tres...',
    isSuspicious: true,
    canAttack: true,
    attackDelaySec: 13,
    nightNumber: 2,
    paymentMethod: 'efectivo',
    items: [
      { productId: 'leche', quantity: 1 },
      { productId: 'carne', quantity: 1 },
    ],
    source: 'story',
    voiceProfile: getNpcVoiceProfile('aparicion', 'La Clienta de las 02:00 AM', 'night2-2'),
  },
  {
    id: 'night2-3',
    npcName: 'El Carnicero Pálido',
    archetype: 'sospechoso',
    greeting:
      'Falta stock en la heladera de atrás... dame gaseosa y fideos rápido antes que salte el mostrador.',
    friendComment: 'Ojo con este si se acerca demasiado a la caja.',
    thanksLine: 'Seguí reponiendo... te estoy mirando.',
    isSuspicious: true,
    canAttack: true,
    attackDelaySec: 12,
    nightNumber: 2,
    paymentMethod: 'efectivo',
    items: [
      { productId: 'gaseosa', quantity: 1 },
      { productId: 'fideos', quantity: 1 },
    ],
    source: 'story',
    voiceProfile: getNpcVoiceProfile('sospechoso', 'El Carnicero Pálido', 'night2-3'),
  },
];

const NIGHT_3_ENCOUNTERS: NpcEncounter[] = [
  {
    id: 'night3-1',
    npcName: 'Sergio (Guardia Nocturno)',
    archetype: 'camionero',
    greeting:
      'Es la última hora antes de las 3 AM y los tubos están fallando. Dame café y galletitas para aguantar.',
    friendComment: 'Reponé las heladeras en rojo antes de que se corte toda la energía.',
    thanksLine: '¡Falta poco para renovar el turno!',
    isSuspicious: false,
    nightNumber: 3,
    paymentMethod: 'efectivo',
    items: [
      { productId: 'cafe', quantity: 1 },
      { productId: 'galletitas', quantity: 1 },
    ],
    source: 'story',
    voiceProfile: getNpcVoiceProfile('camionero', 'Sergio (Guardia Nocturno)', 'night3-1'),
  },
  {
    id: 'night3-2',
    npcName: 'El Maniquí del Pasillo 2',
    archetype: 'aparicion',
    greeting:
      'Las cajas del depósito son mías... dame agua fría y pan... no te des vuelta...',
    friendComment: '¡Ese salió de atrás de la góndola! Tené la escopeta lista por si ataca.',
    thanksLine: 'El pasillo 2 me pertenece...',
    isSuspicious: true,
    canAttack: true,
    attackDelaySec: 10,
    nightNumber: 3,
    paymentMethod: 'efectivo',
    items: [
      { productId: 'agua', quantity: 1 },
      { productId: 'pan', quantity: 1 },
    ],
    source: 'story',
    voiceProfile: getNpcVoiceProfile('aparicion', 'El Maniquí del Pasillo 2', 'night3-2'),
  },
  {
    id: 'night3-3',
    npcName: 'El Vigía Sin Sombra',
    archetype: 'aparicion',
    greeting:
      'Ya casi son las tres de la mañana... dame dos bandejas de carne o no salís del supermercado.',
    friendComment: '¡Es la entidad de la cámara fría! Aguantá hasta las 03:00 AM.',
    thanksLine: 'Tu turno terminó... por ahora.',
    isSuspicious: true,
    canAttack: true,
    attackDelaySec: 9,
    nightNumber: 3,
    paymentMethod: 'efectivo',
    items: [{ productId: 'carne', quantity: 2 }],
    source: 'story',
    voiceProfile: getNpcVoiceProfile('aparicion', 'El Vigía Sin Sombra', 'night3-3'),
  },
];

export const NIGHT_CHAPTERS: NightChapter[] = [
  {
    nightNumber: 1,
    title: 'Noche 1 · Turno de Prueba (00:00 - 03:00 AM)',
    subtitle: 'Reponé las góndolas cada cierto tiempo y atendé hasta las 3 AM',
    targetClients: 3,
    restockDepleteRate: 1.55,
    encounters: [STORY_ENCOUNTERS[0], STORY_ENCOUNTERS[1], STORY_ENCOUNTERS[4]],
  },
  {
    nightNumber: 2,
    title: 'Noche 2 · Apagón en Carnicería (00:00 - 03:00 AM)',
    subtitle: 'Turno renovado: la comida se gasta más rápido y hay apariciones',
    targetClients: 3,
    restockDepleteRate: 2.05,
    encounters: NIGHT_2_ENCOUNTERS,
  },
  {
    nightNumber: 3,
    title: 'Noche 3 · Última Hora (00:00 - 03:00 AM)',
    subtitle: 'Pasillos malditos: reponé sin parar hasta las 03:00 AM',
    targetClients: 4,
    restockDepleteRate: 2.55,
    encounters: NIGHT_3_ENCOUNTERS,
  },
];

export function getNightChapter(nightNumber: number): NightChapter {
  const idx = Math.max(0, Math.min(NIGHT_CHAPTERS.length - 1, nightNumber - 1));
  const base = NIGHT_CHAPTERS[idx];
  if (nightNumber <= NIGHT_CHAPTERS.length) return base;
  return {
    ...base,
    nightNumber,
    restockDepleteRate: Math.min(3.5, base.restockDepleteRate + (nightNumber - 3) * 0.35),
    title: `Noche ${nightNumber} · Turno Infinito (00:00 - 03:00 AM)`,
    subtitle: 'Sobreviví reponiendo comida cada cierto tiempo hasta las 3 AM',
  };
}

export function getNightEncounter(nightNumber: number, indexInNight: number): NpcEncounter {
  const chapter = getNightChapter(nightNumber);
  return chapter.encounters[indexInNight % chapter.encounters.length];
}

const VALID_ARCHETYPES: NpcArchetype[] = [
  'camionero',
  'paisano',
  'turista',
  'pibe',
  'sospechoso',
  'aparicion',
];

export interface IntroBeat {
  title: string;
  subtitle: string;
  narration: string;
  speakerLine: string;
  friendSpeech: string;
}

export function buildIntroBeats(playerName: string, friendName: string): IntroBeat[] {
  return [
    {
      title: 'SÚPER NOCTURNO · 00:00 A 03:00 AM',
      subtitle: 'Turno completo · Supermercado de Terror',
      narration:
        'Son las doce de la noche y cerraron casi todas las persianas del supermercado. Trabajás tiempo completo hasta las tres de la mañana para que te renueven el turno.',
      friendSpeech: `Che ${playerName}, tenemos que aguantar hasta las 3 AM... si las góndolas se vacían, los tubos se apagan y salen cosas de la cámara fría.`,
      speakerLine: `${friendName}: "Che ${playerName}, tenemos que aguantar hasta las 3 AM... si las góndolas se vacían, salen cosas de la cámara fría."`,
    },
    {
      title: 'REPONER COMIDA DEL DEPÓSITO',
      subtitle: 'Heladeras y góndolas en tiempo real',
      narration:
        'Cada cierto tiempo las heladeras y góndolas se quedan sin comida. Buscá mercadería fresca en el Depósito del fondo y reponela donde titile la alarma roja.',
      friendSpeech: 'Agarrá carne, leche, fideos o gaseosas del depósito y soltalo en la góndola que pide reposición.',
      speakerLine: `${friendName}: "Agarrá comida del depósito y soltalo en la góndola que pide reposición."`,
    },
    {
      title: 'COBRAR EN CAJA Y DEFENDERSE',
      subtitle: 'Escopeta debajo de la caja registradora',
      narration:
        'También llegan clientes extraños y apariciones a la caja. Atendelos rápido y si alguno te ataca en la oscuridad, sacá el arma de abajo del mostrador.',
      friendSpeech: '¡Prendé la linterna y no sueltes las góndolas! Arrancamos el turno.',
      speakerLine: `${friendName}: "¡Prendé la linterna y no sueltes las góndolas! Arrancamos el turno."`,
    },
  ];
}

export function normalizeGeminiEncounter(raw: unknown, idSuffix: string): NpcEncounter {
  const data = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const archetype = VALID_ARCHETYPES.includes(data.archetype as NpcArchetype)
    ? (data.archetype as NpcArchetype)
    : 'turista';
  const rawItems = Array.isArray(data.items) ? data.items : [];
  const validItems: OrderItem[] = [];
  for (const entry of rawItems) {
    if (!entry || typeof entry !== 'object') continue;
    const rec = entry as Record<string, unknown>;
    const pid = rec.productId as ProductId;
    if (PRODUCT_CATALOG[pid]) {
      const qty = Math.max(1, Math.min(3, Math.round(Number(rec.quantity) || 1)));
      validItems.push({ productId: pid, quantity: qty });
    }
  }
  if (validItems.length === 0) {
    validItems.push({ productId: 'carne', quantity: 1 });
  }
  const paymentMethod: PaymentMethod = data.paymentMethod === 'qr' ? 'qr' : 'efectivo';
  const npcName =
    typeof data.npcName === 'string' && data.npcName.trim()
      ? data.npcName.trim()
      : 'Visitante de Madrugada';
  const id = `gemini-${idSuffix}`;
  return {
    id,
    npcName,
    archetype,
    greeting:
      typeof data.greeting === 'string' && data.greeting.trim()
        ? data.greeting.trim()
        : 'Necesito comprar comida rápido antes de que den las tres de la mañana.',
    friendComment:
      typeof data.friendComment === 'string' && data.friendComment.trim()
        ? data.friendComment.trim()
        : 'Llevá el pedido a la caja y vigilá los pasillos.',
    thanksLine:
      typeof data.thanksLine === 'string' && data.thanksLine.trim()
        ? data.thanksLine.trim()
        : 'Suerte terminando el turno hasta las 3 AM...',
    isSuspicious: Boolean(data.isSuspicious),
    paymentMethod,
    items: validItems,
    source: 'gemini',
    voiceProfile: getNpcVoiceProfile(archetype, npcName, id),
  };
}

export const PRODUCT_LOCATIONS: Record<
  ProductId,
  { placeLabel: string; markerPos: [number, number, number] }
> = {
  carne: { placeLabel: 'a la Heladera de Carnicería', markerPos: [-5.65, 2.25, 0.2] },
  leche: { placeLabel: 'a la Heladera de Lácteos', markerPos: [-5.65, 2.25, 2.0] },
  fideos: { placeLabel: 'a la Góndola 1 (Almacén)', markerPos: [-1.75, 2.25, 0.2] },
  cafe: { placeLabel: 'a la Góndola 1 o Depósito', markerPos: [-1.75, 2.25, 2.0] },
  gaseosa: { placeLabel: 'a la Góndola 2 (Bebidas)', markerPos: [1.75, 2.25, 0.2] },
  pan: { placeLabel: 'a la Góndola 2 (Panadería)', markerPos: [1.75, 2.25, 2.0] },
  agua: { placeLabel: 'a la Heladera Central', markerPos: [5.65, 2.25, 0.2] },
  galletitas: { placeLabel: 'al Estante Derecho', markerPos: [5.65, 2.25, 2.0] },
};

export function buildMissionSteps(
  npc: NpcEncounter | null,
  npcStatus: NpcStatus,
  heldProductId: ProductId | null,
  orderEval: OrderEvaluation | null,
  urgentRestockZone: RestockZoneState | null = null
): MissionActionStep[] {
  if (npc && npcStatus === 'attacking') {
    return [
      {
        id: 'defend-attack',
        text: `¡${npc.npcName} está atacando! Tocá Arma y Dispará ya para sobrevivir.`,
        done: false,
        active: true,
      },
    ];
  }

  const steps: MissionActionStep[] = [];

  if (urgentRestockZone) {
    const firstProd = PRODUCT_CATALOG[urgentRestockZone.acceptedProducts[0]];
    const holdingMatching =
      heldProductId !== null && urgentRestockZone.acceptedProducts.includes(heldProductId);
    if (holdingMatching && heldProductId) {
      steps.push({
        id: `restock-drop-${urgentRestockZone.id}`,
        text: `¡REPONER! Llevá ${PRODUCT_CATALOG[heldProductId].shortName} a ${urgentRestockZone.shortLabel} y tocá Reponer.`,
        done: false,
        active: true,
      });
    } else {
      steps.push({
        id: `restock-need-${urgentRestockZone.id}`,
        text: `¡FALTA COMIDA! Buscá ${firstProd.shortName} en el Depósito y reponé ${urgentRestockZone.shortLabel}.`,
        done: false,
        active: true,
      });
    }
  }

  if (!npc || npcStatus === 'none') {
    if (steps.length === 0) {
      steps.push({
        id: 'patrol-super',
        text: 'Recorré los pasillos, revisá el Depósito y aguantá hasta las 03:00 AM.',
        done: false,
        active: true,
      });
    }
    return steps;
  }

  if (npcStatus === 'approaching') {
    steps.push({
      id: 'approach',
      text: `Alguien entró por la puerta automática: ${npc.npcName}.`,
      done: false,
      active: !urgentRestockZone,
    });
    return steps;
  }

  if (npcStatus === 'scared') {
    steps.push({
      id: 'scared',
      text: 'Lo ahuyentaste hacia la oscuridad. Guardá el arma y revisá las góndolas.',
      done: true,
      active: true,
    });
    return steps;
  }

  if (npcStatus === 'leaving') {
    steps.push({
      id: 'leaving',
      text: 'Cliente cobrado. Vigilá el reloj hacia las 03:00 AM y las heladeras.',
      done: true,
      active: true,
    });
    return steps;
  }

  if (heldProductId && !(urgentRestockZone && urgentRestockZone.acceptedProducts.includes(heldProductId))) {
    const heldDef = PRODUCT_CATALOG[heldProductId];
    steps.push({
      id: 'drop-counter',
      text: `Llevá ${heldDef.shortName} a la Caja (Zona de Entrega) y soltalo con Tirar / Reponer.`,
      done: false,
      active: !urgentRestockZone,
    });
  }

  let foundNextActive = Boolean(heldProductId) || Boolean(urgentRestockZone);
  for (const req of orderEval?.requested ?? []) {
    const done = req.placed >= req.needed;
    const loc = PRODUCT_LOCATIONS[req.productId];
    const def = PRODUCT_CATALOG[req.productId];
    const isActive = !done && !foundNextActive;
    if (isActive) foundNextActive = true;
    steps.push({
      id: `item-${req.productId}`,
      text: done
        ? `${def.shortName} en la caja (${req.placed}/${req.needed})`
        : `Andá ${loc.placeLabel} y agarrá ${def.shortName} (${req.placed}/${req.needed})`,
      done,
      active: isActive,
    });
  }

  const readyToPay = Boolean(orderEval?.isComplete);
  steps.push({
    id: 'pay-register',
    text: readyToPay
      ? `¡Pedido listo! Tocá Cobrar en la caja (${npc.paymentMethod === 'qr' ? 'QR' : 'Efectivo'}).`
      : 'Cuando esté el pedido en la caja, tocá Cobrar.',
    done: false,
    active: readyToPay && !heldProductId,
  });

  return steps;
}

export const DEFAULT_ACTION_BUTTONS: Record<CustomizableButtonId, ActionButtonConfig> = {
  grab: {
    id: 'grab',
    label: 'Agarrar',
    keyCode: 'KeyQ',
    keyLabel: 'Q',
    offsetX: -120,
    offsetY: -58,
    scale: 1,
  },
  drop: {
    id: 'drop',
    label: 'Tirar',
    keyCode: 'KeyR',
    keyLabel: 'R',
    offsetX: 0,
    offsetY: -58,
    scale: 1,
  },
};

export function formatKeyLabel(code: string): string {
  if (code.startsWith('Key')) return code.slice(3).toUpperCase();
  if (code.startsWith('Digit')) return code.slice(5);
  if (code === 'Space') return 'ESP';
  if (code === 'ShiftLeft' || code === 'ShiftRight') return 'SHIFT';
  if (code === 'Enter') return 'ENT';
  return code.slice(0, 4).toUpperCase();
}

export function sanitizeActionButtonLayouts(
  raw: unknown
): Record<CustomizableButtonId, ActionButtonConfig> {
  const base: Record<CustomizableButtonId, ActionButtonConfig> = {
    grab: { ...DEFAULT_ACTION_BUTTONS.grab },
    drop: { ...DEFAULT_ACTION_BUTTONS.drop },
  };
  if (!raw || typeof raw !== 'object') return base;
  const obj = raw as Record<string, unknown>;
  for (const id of ['grab', 'drop'] as CustomizableButtonId[]) {
    const entry = obj[id];
    if (!entry || typeof entry !== 'object') continue;
    const rec = entry as Record<string, unknown>;
    const keyCode =
      typeof rec.keyCode === 'string' && rec.keyCode.trim()
        ? rec.keyCode.trim()
        : base[id].keyCode;
    const label =
      typeof rec.label === 'string' && rec.label.trim()
        ? rec.label.trim().slice(0, 14)
        : base[id].label;
    const offsetX =
      typeof rec.offsetX === 'number' && Number.isFinite(rec.offsetX)
        ? Math.max(-520, Math.min(40, Math.round(rec.offsetX)))
        : base[id].offsetX;
    const offsetY =
      typeof rec.offsetY === 'number' && Number.isFinite(rec.offsetY)
        ? Math.max(-280, Math.min(20, Math.round(rec.offsetY)))
        : base[id].offsetY;
    const scale =
      typeof rec.scale === 'number' && Number.isFinite(rec.scale)
        ? Math.max(0.8, Math.min(1.45, Number(rec.scale.toFixed(2))))
        : base[id].scale;
    base[id] = {
      id,
      label,
      keyCode,
      keyLabel: formatKeyLabel(keyCode),
      offsetX,
      offsetY,
      scale,
    };
  }
  return base;
}

export interface SensitivityTuning {
  label: string;
  lookScale: number;
  walkSpeed: number;
  joystickExpo: number;
}

export const SENSITIVITY_PRESETS: Record<SensitivityPreset, SensitivityTuning> = {
  media: {
    label: 'Media',
    lookScale: 0.92,
    walkSpeed: 4.8,
    joystickExpo: 0.85,
  },
  alta: {
    label: 'Alta',
    lookScale: 1.35,
    walkSpeed: 5.8,
    joystickExpo: 0.62,
  },
  muy_alta: {
    label: 'Muy Alta',
    lookScale: 1.88,
    walkSpeed: 7.0,
    joystickExpo: 0.48,
  },
};

export function applyJoystickResponse(
  rawX: number,
  rawZ: number,
  preset: SensitivityPreset = 'alta'
): { x: number; z: number } {
  const mag = Math.hypot(rawX, rawZ);
  if (mag < 0.04) return { x: 0, z: 0 };
  const tuning = SENSITIVITY_PRESETS[preset] ?? SENSITIVITY_PRESETS.alta;
  const clamped = Math.min(1, mag);
  const remapped = Math.pow((clamped - 0.04) / 0.96, tuning.joystickExpo);
  const scale = remapped / mag;
  return {
    x: rawX * scale,
    z: rawZ * scale,
  };
}

export function computeAmbientAudioParams(
  shiftSeconds: number,
  isIndoors: boolean,
  criticalCount = 0
): AmbientAudioParams {
  // shiftSeconds advances 0 -> 180 (00:00 AM -> 03:00 AM)
  const totalMins = Math.max(0, Math.floor(shiftSeconds));
  const hour24 = (totalMins / 60) % 24;
  const indoorScale = isIndoors ? 0.35 : 1.0;

  let phase: AmbientDayPhase = 'noche';
  let cricketBase = 0.72;
  let birdBase = 0;
  let windBase = 0.13;
  let windFreq = 390;

  if (hour24 >= 2.2) {
    // Witching hour approaching 3 AM: eerie hush + sharper cold air vents
    phase = 'madrugada';
    cricketBase = 0.48;
    windBase = 0.19;
    windFreq = 460;
  } else {
    phase = 'noche';
    cricketBase = 0.75;
    windBase = 0.14;
    windFreq = 380;
  }

  const tensionGain = Math.min(0.14, 0.03 + (hour24 / 3) * 0.05 + criticalCount * 0.03);

  const label = isIndoors
    ? criticalCount > 0
      ? 'Pasillos en alerta · Tubos parpadeando'
      : 'Súper de noche · Tubos y heladeras'
    : 'Playón oscuro · Viento frío';

  return {
    hour24,
    phase,
    windGain: Number((windBase * indoorScale).toFixed(4)),
    windFreq: isIndoors ? Math.round(windFreq * 0.72) : windFreq,
    cricketIntensity: Number((cricketBase * indoorScale).toFixed(3)),
    birdIntensity: Number((birdBase * indoorScale).toFixed(3)),
    fridgeHumGain: isIndoors ? 0.068 : 0.012,
    tensionGain: Number(tensionGain.toFixed(3)),
    label,
  };
}

export function sanitizeRoomCode(raw: string): string {
  const cleaned = (raw || '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 8);
  return cleaned.length >= 3 ? cleaned : 'SUPER3';
}

export function createRoomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let out = '';
  for (let i = 0; i < 6; i++) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  return out;
}

export function sanitizePlayerProfile(raw: unknown): PlayerProfile {
  const obj = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const validShirt = SHIRT_OPTIONS.some((s) => s.id === obj.shirtId)
    ? String(obj.shirtId)
    : DEFAULT_PLAYER_PROFILE.shirtId;
  const hexColor = (val: unknown, fallback: string) =>
    typeof val === 'string' && /^#[0-9a-fA-F]{6}$/.test(val.trim()) ? val.trim() : fallback;
  const cleanName = (val: unknown, fallback: string) => {
    if (typeof val !== 'string') return fallback;
    const t = val.replace(/[\r\n\t<>]/g, '').trim().slice(0, 20);
    return t || fallback;
  };
  return {
    playerName: cleanName(obj.playerName, DEFAULT_PLAYER_PROFILE.playerName),
    friendName: cleanName(obj.friendName, DEFAULT_PLAYER_PROFILE.friendName),
    shirtId: validShirt,
    skinTone: hexColor(obj.skinTone, DEFAULT_PLAYER_PROFILE.skinTone),
    hairColor: hexColor(obj.hairColor, DEFAULT_PLAYER_PROFILE.hairColor),
    hasCap: typeof obj.hasCap === 'boolean' ? obj.hasCap : DEFAULT_PLAYER_PROFILE.hasCap,
    customModelName:
      typeof obj.customModelName === 'string' && obj.customModelName.trim()
        ? obj.customModelName.trim().slice(0, 48)
        : undefined,
  };
}

export interface HorrorThreatProfile {
  threat: number; // 0..1
  intervalMinSec: number;
  intervalMaxSec: number;
  weights: Record<HorrorEventType, number>;
}

export function computeHorrorThreatLevel(
  reputation: number,
  shiftSeconds: number,
  nightNumber = 1
): HorrorThreatProfile {
  const clampedRep = Math.max(0, Math.min(100, reputation));
  const repRisk = (100 - clampedRep) / 100; // 0 at 100% rep -> 1.0 at 0% rep
  const timeProgress = Math.max(0, Math.min(1, shiftSeconds / SHIFT_TARGET_MINUTES)); // 0 at 00:00 -> 1 at 03:00 AM
  const nightBonus = Math.min(0.24, Math.max(0, nightNumber - 1) * 0.08);

  // Late hours (especially 02:00-03:00 AM) and low reputation strongly escalate paranormal pressure
  const threat = Math.max(
    0.08,
    Math.min(1, repRisk * 0.52 + Math.pow(timeProgress, 1.15) * 0.42 + nightBonus)
  );

  // Interval between random horror events shrinks as threat climbs:
  // calm 00:00 + high rep (~13-19s) -> intense 02:30+ / low rep (~4.5-8s)
  const intervalMinSec = Number((13 - threat * 8.5).toFixed(2));
  const intervalMaxSec = Number((19 - threat * 11.0).toFixed(2));

  // Event mix shifts from mild flickers early on to poltergeist drops, roaming shadows, and freezer slams
  const weights: Record<HorrorEventType, number> = {
    flicker_lights: 0.44 - threat * 0.16,
    aisle_shadow: 0.24 + threat * 0.12,
    shelf_drop: 0.2 + threat * 0.14,
    freezer_slam: 0.12 + threat * 0.18,
  };

  return {
    threat: Number(threat.toFixed(3)),
    intervalMinSec,
    intervalMaxSec,
    weights,
  };
}

export function computeNextHorrorIntervalSec(
  reputation: number,
  shiftSeconds: number,
  nightNumber = 1,
  randomFn: () => number = Math.random
): number {
  const profile = computeHorrorThreatLevel(reputation, shiftSeconds, nightNumber);
  const r = Math.max(0, Math.min(0.9999, randomFn()));
  return Number(
    (profile.intervalMinSec + (profile.intervalMaxSec - profile.intervalMinSec) * r).toFixed(2)
  );
}

const HORROR_EVENT_META: Record<
  HorrorEventType,
  Array<{ title: string; detail: string; baseDuration: number }>
> = {
  flicker_lights: [
    {
      title: 'Bajón de Tensión',
      detail: 'Los tubos fluorescentes parpadean en los pasillos.',
      baseDuration: 3.2,
    },
    {
      title: 'Oscuridad en Góndolas',
      detail: 'Algo corta la luz del techo hacia el Depósito.',
      baseDuration: 3.8,
    },
  ],
  shelf_drop: [
    {
      title: 'Mercadería en el Piso',
      detail: '¡Un producto cayó solo de la góndola!',
      baseDuration: 3.6,
    },
    {
      title: 'Mano Invisible',
      detail: 'Algo tiró comida de los estantes en la oscuridad.',
      baseDuration: 4.0,
    },
  ],
  aisle_shadow: [
    {
      title: 'Sombra en el Pasillo',
      detail: 'Una silueta oscura cruzó entre las heladeras.',
      baseDuration: 4.4,
    },
    {
      title: 'Algo Camina Atrás',
      detail: 'Viste una sombra moviéndose cerca del Depósito.',
      baseDuration: 4.8,
    },
  ],
  freezer_slam: [
    {
      title: 'Golpe en Cámara Fría',
      detail: 'La puerta de la cámara fría golpeó con furia y entró niebla.',
      baseDuration: 3.4,
    },
    {
      title: 'Escalofrío de las 3 AM',
      detail: 'Un viento helado sacudió todo el supermercado.',
      baseDuration: 3.6,
    },
  ],
};

export function pickHorrorEvent(
  reputation: number,
  shiftSeconds: number,
  nightNumber = 1,
  roll: number = Math.random()
): HorrorEventTrigger {
  const profile = computeHorrorThreatLevel(reputation, shiftSeconds, nightNumber);
  const entries = Object.entries(profile.weights) as Array<[HorrorEventType, number]>;
  const totalWeight = entries.reduce((sum, [, w]) => sum + Math.max(0, w), 0);
  const clampedRoll = Math.max(0, Math.min(0.999999, roll));
  let cursor = clampedRoll * totalWeight;
  let pickedType: HorrorEventType = 'flicker_lights';

  for (const [type, weight] of entries) {
    cursor -= Math.max(0, weight);
    if (cursor <= 0) {
      pickedType = type;
      break;
    }
  }

  const variants = HORROR_EVENT_META[pickedType];
  const variantIdx = Math.floor(clampedRoll * 100) % variants.length;
  const meta = variants[variantIdx];
  const intensity = Number(Math.min(1, 0.42 + profile.threat * 0.58).toFixed(2));
  const durationSec = Number((meta.baseDuration + profile.threat * 1.1).toFixed(2));

  return {
    id: `${pickedType}-${Math.round(shiftSeconds * 10)}-${variantIdx}`,
    type: pickedType,
    title: meta.title,
    detail: meta.detail,
    durationSec,
    intensity,
  };
}
