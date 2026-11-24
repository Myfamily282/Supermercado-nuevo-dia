export type ProductId =
  | 'carne'
  | 'leche'
  | 'fideos'
  | 'cafe'
  | 'gaseosa'
  | 'agua'
  | 'pan'
  | 'galletitas';

export type ProductCategory = 'Carnes y Lácteos' | 'Bebidas' | 'Almacén' | 'Panadería';

export interface ProductDef {
  id: ProductId;
  name: string;
  shortName: string;
  category: ProductCategory;
  price: number;
  mass: number;
  size: [number, number, number];
  primaryColor: string;
  accentColor: string;
  shape: 'box' | 'bottle' | 'pouch';
}

export type RestockZoneId =
  | 'heladera_carnes'
  | 'gondola_almacen'
  | 'gondola_bebidas'
  | 'heladera_bebidas';

export interface RestockZoneState {
  id: RestockZoneId;
  label: string;
  shortLabel: string;
  acceptedProducts: ProductId[];
  pos: [number, number, number];
  stockPercent: number; // 0..100
  needsRestock: boolean;
  isCritical: boolean;
  lastRestockedAt: number;
}

export type NpcArchetype =
  | 'camionero'
  | 'paisano'
  | 'turista'
  | 'pibe'
  | 'sospechoso'
  | 'aparicion';

export type GeminiVoiceName = 'Puck' | 'Charon' | 'Kore' | 'Fenrir' | 'Zephyr';

export interface VoiceProfile {
  id: string;
  label: string;
  voiceName: GeminiVoiceName;
  voiceStyle: string;
  pitch: number;
  rate: number;
  preferredGender: 'male' | 'female';
}

export type NpcStatus =
  | 'none'
  | 'approaching'
  | 'waiting'
  | 'attacking'
  | 'scared'
  | 'leaving';

export type GamePhase =
  | 'title'
  | 'intro'
  | 'tutorial'
  | 'playing'
  | 'paused'
  | 'night_complete'
  | 'gameover';

export type PaymentMethod = 'efectivo' | 'qr';

export type KioscoUpgradeId =
  | 'reflector_led'
  | 'linterna_pro'
  | 'mostrador_pro'
  | 'alarma_ruta';

export interface KioscoUpgradeDef {
  id: KioscoUpgradeId;
  name: string;
  description: string;
  cost: number;
}

export interface SecretEventDef {
  id: string;
  title: string;
  shortHint: string;
  discoveryText: string;
  friendReaction: string;
  rewardCash: number;
  rewardRep: number;
  pos: [number, number, number];
}

export interface NightChapter {
  nightNumber: number;
  title: string;
  subtitle: string;
  targetClients: number;
  restockDepleteRate: number;
  encounters: NpcEncounter[];
}

export interface OrderItem {
  productId: ProductId;
  quantity: number;
}

export interface NpcEncounter {
  id: string;
  npcName: string;
  archetype: NpcArchetype;
  greeting: string;
  friendComment: string;
  thanksLine: string;
  isSuspicious: boolean;
  canAttack?: boolean;
  attackDelaySec?: number;
  nightNumber?: number;
  paymentMethod: PaymentMethod;
  items: OrderItem[];
  source: 'story' | 'gemini';
  voiceProfile?: VoiceProfile;
}

export interface ShirtOption {
  id: string;
  label: string;
  primary: string;
  secondary: string;
}

export interface PlayerProfile {
  playerName: string;
  friendName: string;
  shirtId: string;
  skinTone: string;
  hairColor: string;
  hasCap: boolean;
  customModelName?: string;
}

export interface CounterItemSnapshot {
  instanceId: string;
  productId: ProductId;
  x: number;
  y: number;
  z: number;
}

export interface OrderEvaluation {
  requested: Array<{
    productId: ProductId;
    name: string;
    unitPrice: number;
    needed: number;
    placed: number;
  }>;
  extraOnCounter: Array<{
    productId: ProductId;
    name: string;
    count: number;
  }>;
  totalRequestedPrice: number;
  totalCounterPrice: number;
  isComplete: boolean;
  missingCount: number;
}

export interface PaymentResult {
  ok: boolean;
  method: PaymentMethod;
  total: number;
  tendered: number;
  change: number;
  error?: string;
}

export interface SoldRecord {
  productId: ProductId;
  quantitySold: number;
  revenue: number;
  lastSoldCustomer: string;
}

export type InventorySortKey = 'sold_desc' | 'revenue_desc' | 'stock_asc' | 'name_asc';

export interface InventoryRow {
  product: ProductDef;
  stock: number;
  quantitySold: number;
  revenue: number;
  lastSoldCustomer: string;
}

export interface MissionActionStep {
  id: string;
  text: string;
  done: boolean;
  active: boolean;
}

export type CustomizableButtonId = 'grab' | 'drop';

export interface ActionButtonConfig {
  id: CustomizableButtonId;
  label: string;
  keyCode: string;
  keyLabel: string;
  offsetX: number;
  offsetY: number;
  scale: number;
}

export type SensitivityPreset = 'media' | 'alta' | 'muy_alta';

export type AmbientDayPhase = 'noche' | 'madrugada' | 'amanecer' | 'dia';

export interface AmbientAudioParams {
  hour24: number;
  phase: AmbientDayPhase;
  windGain: number;
  windFreq: number;
  cricketIntensity: number;
  birdIntensity: number;
  fridgeHumGain: number;
  tensionGain: number;
  label: string;
}

export type HorrorEventType =
  | 'flicker_lights'
  | 'shelf_drop'
  | 'aisle_shadow'
  | 'freezer_slam';

export interface HorrorEventTrigger {
  id: string;
  type: HorrorEventType;
  title: string;
  detail: string;
  durationSec: number;
  intensity: number; // 0.35 .. 1.0
}

export interface ActiveHorrorEventView {
  id: string;
  type: HorrorEventType;
  title: string;
  detail: string;
  intensity: number;
}

export interface HudStateSnapshot {
  phase: GamePhase;
  cash: number;
  customersServed: number;
  reputation: number;
  nightNumber: number;
  nightTitle: string;
  nightServed: number;
  nightTarget: number;
  shiftTimeLabel: string;
  shiftProgressPercent: number; // 00:00 -> 03:00 AM (0..100)
  shiftMinutes: number; // 0..180
  restockedCount: number;
  restockZones: RestockZoneState[];
  urgentRestockZone: RestockZoneState | null;
  flickerAlert: boolean;
  horrorThreatLevel: number; // 0..1 computed from reputation & shift hour
  activeHorrorEvent: ActiveHorrorEventView | null;
  ambientLabel: string;
  upgrades: KioscoUpgradeId[];
  discoveredSecrets: string[];
  weaponEquipped: boolean;
  weaponVisible: boolean;
  flashlightOn: boolean;
  playerZone: string;
  hoveredLabel: string | null;
  hoveredPrice: number | null;
  hoveredHint: string | null;
  hoveredTargetType:
    | 'item'
    | 'counter_zone'
    | 'restock_zone'
    | 'register'
    | 'weapon'
    | 'secret'
    | null;
  heldItemLabel: string | null;
  heldProductId: ProductId | null;
  counterItemCount: number;
  activeNpc: NpcEncounter | null;
  npcStatus: NpcStatus;
  dialogueLine: string;
  friendLine: string;
  orderEval: OrderEvaluation | null;
}

export interface OnlinePlayerState {
  id: string;
  x: number;
  y: number;
  z: number;
  yaw: number;
  heldProductId: ProductId | null;
  profile: PlayerProfile;
}

export interface OnlineChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  text: string;
  at: number;
}

export interface RoomStateSnapshot {
  roomCode: string;
  selfId: string;
  players: OnlinePlayerState[];
  cash: number;
  customersServed: number;
  reputation: number;
  shiftSeconds: number;
  storyIndex: number;
  nightNumber: number;
  nightServed: number;
  upgrades: KioscoUpgradeId[];
  discoveredSecrets: string[];
  activeNpc: NpcEncounter | null;
  npcStatus: NpcStatus;
  stock: Record<ProductId, number>;
  sold: Record<ProductId, SoldRecord>;
}

export type WsClientMessage =
  | { type: 'room:join'; roomCode: string; profile: PlayerProfile }
  | { type: 'profile:update'; profile: PlayerProfile }
  | {
      type: 'pose:update';
      x: number;
      y: number;
      z: number;
      yaw: number;
      heldProductId: ProductId | null;
    }
  | { type: 'npc:spawn'; encounter: NpcEncounter; storyIndex: number }
  | { type: 'npc:status'; npcStatus: NpcStatus; reputationDelta?: number }
  | { type: 'sale:complete'; soldItems: OrderItem[]; customerName: string }
  | { type: 'stock:restock'; productId: ProductId; count: number }
  | { type: 'shelves:organize' }
  | { type: 'secret:discover'; secretId: string }
  | { type: 'upgrade:buy'; upgradeId: KioscoUpgradeId }
  | { type: 'night:advance' }
  | { type: 'shift:reset' }
  | { type: 'chat:send'; text: string };

export type WsServerMessage =
  | { type: 'room:snapshot'; snapshot: RoomStateSnapshot }
  | { type: 'peer:joined'; player: OnlinePlayerState }
  | { type: 'peer:left'; playerId: string }
  | { type: 'peer:pose'; player: OnlinePlayerState }
  | { type: 'npc:spawned'; encounter: NpcEncounter; storyIndex: number }
  | { type: 'npc:status'; npcStatus: NpcStatus; reputation: number }
  | {
      type: 'sale:completed';
      cash: number;
      customersServed: number;
      nightServed: number;
      reputation: number;
      stock: Record<ProductId, number>;
      sold: Record<ProductId, SoldRecord>;
      soldItems: OrderItem[];
      customerName: string;
      byPlayerId: string;
    }
  | {
      type: 'stock:restocked';
      productId: ProductId;
      count: number;
      stock: Record<ProductId, number>;
      byPlayerId: string;
    }
  | { type: 'shelves:organized'; byPlayerId: string }
  | {
      type: 'secret:discovered';
      secretId: string;
      discoveredSecrets: string[];
      cash: number;
      reputation: number;
      byPlayerName: string;
    }
  | {
      type: 'upgrade:bought';
      upgradeId: KioscoUpgradeId;
      upgrades: KioscoUpgradeId[];
      cash: number;
    }
  | {
      type: 'night:advanced';
      nightNumber: number;
      nightServed: number;
      shiftSeconds: number;
    }
  | { type: 'shift:reset'; snapshot: RoomStateSnapshot }
  | { type: 'chat:message'; message: OnlineChatMessage }
  | { type: 'error'; message: string };
