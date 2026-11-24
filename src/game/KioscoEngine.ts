import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { soundEngine } from './audio';
import {
  COUNTER_DELIVERY_ZONE,
  COUNTER_SURFACE_Y,
  KIOSCO_UPGRADES,
  PRODUCT_CATALOG,
  PRODUCT_LIST,
  PRODUCT_LOCATIONS,
  SECRET_EVENTS,
  SENSITIVITY_PRESETS,
  SHIFT_START_SECONDS,
  applyJoystickResponse,
  computeAmbientAudioParams,
  computeHorrorThreatLevel,
  computeNextHorrorIntervalSec,
  createInitialRestockZones,
  evaluateCounterOrder,
  formatShiftClock,
  getNightChapter,
  getNightEncounter,
  getNpcScaredLine,
  getPlayerZoneLabel,
  isPointInDeliveryZone,
  pickHorrorEvent,
  resolvePlayerMapPosition,
  tickRestockZones,
  tryRestockZoneWithProduct,
} from './kioscoLogic';
import {
  createAisleShadowMesh,
  createFriendModel,
  createKioscoEnvironment,
  createNpcByArchetype,
  createProductMesh,
  createSecretRoadsideProp,
  createUnderCounterWeapon,
  loadNormalizedCustomCharacterModel,
  type KioscoEnvironmentHandles,
} from './models';
import { createProceduralTextures, type ProceduralTextures } from './textures';
import { voiceEngine } from './voiceEngine';
import type {
  ActiveHorrorEventView,
  CounterItemSnapshot,
  GamePhase,
  HorrorEventType,
  HudStateSnapshot,
  KioscoUpgradeId,
  NpcEncounter,
  OnlinePlayerState,
  OrderItem,
  PlayerProfile,
  ProductId,
  RestockZoneId,
  RestockZoneState,
  RoomStateSnapshot,
  SecretEventDef,
  SensitivityPreset,
} from './types';

interface PhysicalProduct {
  instanceId: string;
  productId: ProductId;
  mesh: THREE.Group;
  body: CANNON.Body;
  homePos: THREE.Vector3;
  isHeld: boolean;
  lastImpactSoundAt: number;
}

interface ParticleSlot {
  active: boolean;
  age: number;
  maxAge: number;
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  scale: number;
  color: THREE.Color;
}

const PARTICLE_POOL_SIZE = 72;

// Pre-allocated scratch math objects (zero GC in render loop)
const _vec3A = new THREE.Vector3();
const _vec3B = new THREE.Vector3();
const _mat4 = new THREE.Matrix4();
const _mouseNdc = new THREE.Vector2();

export interface KioscoEngineCallbacks {
  onHudUpdate: (snapshot: HudStateSnapshot) => void;
  onOpenPayment: () => void;
  onNpcEvent?: (
    event: 'approaching' | 'waiting' | 'attacking' | 'leaving' | 'scared',
    encounter: NpcEncounter
  ) => void;
  onNightComplete?: (nightNumber: number) => void;
  onGameOver?: () => void;
  onSecretDiscovered?: (secret: SecretEventDef, byPlayerName?: string) => void;
  onSyncSecretDiscover?: (secretId: string) => void;
  onLocalPose?: (
    x: number,
    y: number,
    z: number,
    yaw: number,
    heldProductId: ProductId | null
  ) => void;
  onSyncNpcSpawn?: (encounter: NpcEncounter, storyIndex: number) => void;
  onSyncNpcStatus?: (
    npcStatus: RoomStateSnapshot['npcStatus'],
    reputationDelta?: number
  ) => void;
}

interface RemotePeerActor {
  id: string;
  profileKey: string;
  mesh: THREE.Group;
  targetPos: THREE.Vector3;
  targetYaw: number;
  heldProductId: ProductId | null;
  heldMesh: THREE.Group | null;
  walkPhase: number;
}

export class KioscoEngine {
  private container: HTMLElement;
  private callbacks: KioscoEngineCallbacks;
  private renderer: THREE.WebGLRenderer;
  private composer: EffectComposer | null = null;
  private bloomPass: UnrealBloomPass | null = null;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private textures: ProceduralTextures;
  private env: KioscoEnvironmentHandles;
  private isSoftwareGl: boolean;

  private world: CANNON.World;
  private groundMaterial: CANNON.Material;
  private itemMaterial: CANNON.Material;

  private items: PhysicalProduct[] = [];
  private interactables: THREE.Object3D[] = [];
  private raycaster = new THREE.Raycaster();
  private instanceCounter = 0;

  private underCounterWeaponMesh: THREE.Group;
  private viewWeaponMesh: THREE.Group;
  private muzzleFlashLight: THREE.PointLight;
  private flashlight: THREE.SpotLight;
  private flashlightTarget: THREE.Object3D;
  private reflectorLight: THREE.SpotLight;
  private flashlightOn = true;
  private muzzleFlashTimer = 0;
  private weaponRecoil = 0;

  private friendGroup: THREE.Group;
  private customModelGroup: THREE.Group | null = null;
  private customModelMixer: THREE.AnimationMixer | null = null;
  private remotePeers = new Map<string, RemotePeerActor>();
  private npcGroup: THREE.Group | null = null;
  private npcPos = new THREE.Vector3(0, 0, -10.5);
  private npcTargetZ = -4.65;
  private npcTargetX = -3.45;
  private npcWalkPhase = 0;
  private npcStatus: HudStateSnapshot['npcStatus'] = 'none';
  private activeNpc: NpcEncounter | null = null;
  private storyIndex = 0;
  private nextNpcTimer = 1.4;
  private allowAutoNpcSpawn = true;
  private npcWaitTimer = 0;
  private npcAttackTimer = 0;
  private alarmPlayedForNpc = false;

  private phase: GamePhase = 'title';
  private profile: PlayerProfile;
  private sensitivityPreset: SensitivityPreset = 'alta';
  private cash = 4500;
  private customersServed = 0;
  private reputation = 90;
  private nightNumber = 1;
  private nightServed = 0;
  private nightCompleteTriggered = false;
  private upgrades: KioscoUpgradeId[] = [];
  private discoveredSecrets = new Set<string>();
  private secretProps = new Map<
    string,
    { group: THREE.Group; beacon: THREE.Mesh; glowOrb: THREE.Mesh }
  >();
  private shiftSeconds = SHIFT_START_SECONDS; // Starts 00:00 AM -> ends 03:00 AM
  private restockZones: RestockZoneState[] = createInitialRestockZones();
  private restockedCount = 0;
  private flickerAlert = false;
  private flickerTimer = 0;
  private lastFlickerSoundAt = 0;
  private aisleShadowMesh: THREE.Group;
  private shadowStartPos = new THREE.Vector3();
  private shadowEndPos = new THREE.Vector3();
  private shadowElapsed = 0;
  private shadowDuration = 0;
  private horrorEventTimer = 4.0;
  private activeHorrorEvent:
    | (ActiveHorrorEventView & { remainingSec: number; durationSec: number })
    | null = null;
  private ambientLabel = 'Súper de noche · Tubos y heladeras';
  private lastAmbientUpdate = 0;
  private weaponEquipped = false;
  private introTime = 0;

  // Player state (inside central supermarket aisle looking toward Checkout & Front Glass)
  private playerPos = new THREE.Vector3(0, 1.72, 3.4);
  private playerYaw = 0;
  private playerPitch = -0.14;
  private targetYaw = 0;
  private targetPitch = -0.14;
  private cameraTrauma = 0;
  private hitstopTimer = 0;
  private titleOrbitAngle = 0.45;

  // Input state
  private keysHeld = new Set<string>();
  private analogMoveX = 0;
  private analogMoveZ = 0;
  private pointerDown = false;
  private activeLookPointerId: number | null = null;
  private pointerMovedDist = 0;
  private lastPointerX = 0;
  private lastPointerY = 0;
  private pointerClientX = 0;
  private pointerClientY = 0;
  private hasPointerPos = false;
  private heldItem: PhysicalProduct | null = null;
  private hoveredItem: PhysicalProduct | null = null;
  private hoveredTarget:
    | 'item'
    | 'counter_zone'
    | 'restock_zone'
    | 'register'
    | 'weapon'
    | 'secret'
    | null = null;
  private hoveredSecretId: string | null = null;
  private hoveredRestockZoneId: RestockZoneId | null = null;

  // Pooled particle ring buffer
  private particleMesh: THREE.InstancedMesh;
  private particles: ParticleSlot[] = [];
  private particleCursor = 0;

  // Loop & throttling
  private frameId = 0;
  private lastTime = 0;
  private lastHudPush = 0;
  private disposed = false;
  private resizeObserver: ResizeObserver;
  private landscapeRotated = false;

  constructor(
    container: HTMLElement,
    initialProfile: PlayerProfile,
    callbacks: KioscoEngineCallbacks
  ) {
    this.container = container;
    this.profile = { ...initialProfile };
    this.callbacks = callbacks;

    this.isSoftwareGl = (() => {
      const gl = document.createElement('canvas').getContext('webgl2');
      if (!gl) return true;
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
      const gpu = String(gl.getParameter(param));
      gl.getExtension('WEBGL_lose_context')?.loseContext();
      return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
    })();

    const width = Math.max(1, container.clientWidth);
    const height = Math.max(1, container.clientHeight);

    this.renderer = new THREE.WebGLRenderer({
      antialias: !this.isSoftwareGl,
      powerPreference: 'high-performance',
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.08;
    this.renderer.setPixelRatio(this.isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(width, height);
    this.renderer.shadowMap.enabled = !this.isSoftwareGl;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    const skyColor = 0x05080d; // Dark haunted midnight fog
    this.scene.background = new THREE.Color(skyColor);
    this.scene.fog = new THREE.FogExp2(skyColor, 0.028);

    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    pmrem.dispose();

    this.camera = new THREE.PerspectiveCamera(68, width / height, 0.08, 180);
    this.scene.add(this.camera);

    // Cold horror supermarket lighting + dim moonlight outside + crimson back rim
    const hemi = new THREE.HemisphereLight(0x334155, 0x0f172a, 0.58);
    this.scene.add(hemi);

    const moon = new THREE.DirectionalLight(0x94a3b8, 0.72);
    moon.position.set(-16, 18, -18);
    moon.castShadow = !this.isSoftwareGl;
    moon.shadow.mapSize.width = 1024;
    moon.shadow.mapSize.height = 1024;
    moon.shadow.camera.left = -18;
    moon.shadow.camera.right = 18;
    moon.shadow.camera.top = 18;
    moon.shadow.camera.bottom = -18;
    moon.shadow.camera.near = 1;
    moon.shadow.camera.far = 56;
    moon.shadow.bias = -0.0005;
    moon.shadow.normalBias = 0.02;
    this.scene.add(moon);

    const rimLight = new THREE.DirectionalLight(0xfca5a5, 0.18);
    rimLight.position.set(10, 6, 12);
    this.scene.add(rimLight);

    this.textures = createProceduralTextures(this.renderer.capabilities.getMaxAnisotropy());
    this.env = createKioscoEnvironment(this.textures);
    this.scene.add(this.env.group);

    // Make all 4 supermarket restock zone markers raycastable
    for (const marker of this.env.restockMarkers.values()) {
      if (marker.orb.parent) {
        this.interactables.push(marker.orb.parent);
      }
    }

    if (!this.isSoftwareGl) {
      const composer = new EffectComposer(this.renderer);
      composer.addPass(new RenderPass(this.scene, this.camera));
      const bloomPass = new UnrealBloomPass(new THREE.Vector2(width, height), 0.36, 0.45, 0.86);
      composer.addPass(bloomPass);
      composer.addPass(new OutputPass());
      this.composer = composer;
      this.bloomPass = bloomPass;
    }

    // Player tactical flashlight attached to camera for dark aisles & Depósito
    this.flashlight = new THREE.SpotLight(0xfff4d6, 10.5, 24, Math.PI / 5.4, 0.48, 1.35);
    this.flashlight.position.set(0.15, -0.08, 0);
    this.flashlightTarget = new THREE.Object3D();
    this.flashlightTarget.position.set(0, -0.1, -6);
    this.camera.add(this.flashlightTarget);
    this.flashlight.target = this.flashlightTarget;
    this.camera.add(this.flashlight);

    // Exterior LED reflector spotlight over parking lot entrance
    this.reflectorLight = new THREE.SpotLight(0xe0f2fe, 0, 28, Math.PI / 3.2, 0.5, 1.2);
    this.reflectorLight.position.set(0, 3.5, -5.6);
    const reflectorTarget = new THREE.Object3D();
    reflectorTarget.position.set(0, 0, -10.5);
    this.scene.add(reflectorTarget);
    this.reflectorLight.target = reflectorTarget;
    this.scene.add(this.reflectorLight);

    // Horror clues hidden in Depósito & dark parking lot
    for (const secret of SECRET_EVENTS) {
      const prop = createSecretRoadsideProp(secret.id);
      prop.group.position.set(secret.pos[0], 0.07, secret.pos[2]);
      prop.group.traverse((child) => {
        child.userData.interactKind = 'secret';
        child.userData.secretId = secret.id;
      });
      this.scene.add(prop.group);
      this.interactables.push(prop.group);
      this.secretProps.set(secret.id, prop);
    }

    // Co-worker standing alertly near Checkout / aisle with emergency flashlight
    this.friendGroup = createFriendModel(this.profile, undefined, this.textures);
    this.friendGroup.position.set(-1.55, 0.07, -2.35);
    this.friendGroup.rotation.y = 0.25;
    this.scene.add(this.friendGroup);

    // Spectral aisle shadow entity for random horror events
    this.aisleShadowMesh = createAisleShadowMesh();
    this.scene.add(this.aisleShadowMesh);

    // Under-counter shotgun + first-person equipped shotgun
    this.underCounterWeaponMesh = createUnderCounterWeapon();
    this.underCounterWeaponMesh.position.set(-3.4, 0.56, -3.2);
    this.underCounterWeaponMesh.rotation.y = Math.PI / 2;
    this.underCounterWeaponMesh.userData.interactKind = 'weapon';
    this.scene.add(this.underCounterWeaponMesh);
    this.interactables.push(this.underCounterWeaponMesh);

    this.viewWeaponMesh = createUnderCounterWeapon();
    this.viewWeaponMesh.position.set(0.28, -0.24, -0.45);
    this.viewWeaponMesh.visible = false;
    this.camera.add(this.viewWeaponMesh);

    this.muzzleFlashLight = new THREE.PointLight(0xffb703, 0, 6);
    this.muzzleFlashLight.position.set(0.28, -0.2, -0.9);
    this.camera.add(this.muzzleFlashLight);

    // Tag Checkout delivery zone & cash register as raycast interactables
    const deliveryProxy = new THREE.Mesh(
      new THREE.BoxGeometry(2.1, 0.14, 1.0),
      new THREE.MeshBasicMaterial({ visible: false })
    );
    deliveryProxy.position.set(-3.45, COUNTER_SURFACE_Y + 0.04, -3.4);
    deliveryProxy.userData.interactKind = 'counter_zone';
    this.scene.add(deliveryProxy);
    this.interactables.push(deliveryProxy);

    const registerProxy = new THREE.Mesh(
      new THREE.BoxGeometry(0.65, 0.52, 0.55),
      new THREE.MeshBasicMaterial({ visible: false })
    );
    registerProxy.position.set(-2.12, COUNTER_SURFACE_Y + 0.24, -3.55);
    registerProxy.userData.interactKind = 'register';
    this.scene.add(registerProxy);
    this.interactables.push(registerProxy);

    // Physics world (cannon-es)
    this.world = new CANNON.World({
      gravity: new CANNON.Vec3(0, -9.82, 0),
      allowSleep: true,
    });
    this.world.broadphase = new CANNON.SAPBroadphase(this.world);
    this.groundMaterial = new CANNON.Material('ground');
    this.itemMaterial = new CANNON.Material('item');
    this.world.addContactMaterial(
      new CANNON.ContactMaterial(this.groundMaterial, this.itemMaterial, {
        friction: 0.55,
        restitution: 0.22,
      })
    );
    this.world.addContactMaterial(
      new CANNON.ContactMaterial(this.itemMaterial, this.itemMaterial, {
        friction: 0.45,
        restitution: 0.2,
      })
    );

    this.setupStaticColliders();
    this.spawnInitialStock();

    // Pooled InstancedMesh particles
    const pGeo = new THREE.DodecahedronGeometry(0.035, 0);
    const pMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    this.particleMesh = new THREE.InstancedMesh(pGeo, pMat, PARTICLE_POOL_SIZE);
    this.particleMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.particleMesh.frustumCulled = false;
    this.scene.add(this.particleMesh);
    for (let i = 0; i < PARTICLE_POOL_SIZE; i++) {
      this.particles.push({
        active: false,
        age: 0,
        maxAge: 0.5,
        pos: new THREE.Vector3(),
        vel: new THREE.Vector3(),
        scale: 0,
        color: new THREE.Color(0xffffff),
      });
      _mat4.makeScale(0, 0, 0);
      this.particleMesh.setMatrixAt(i, _mat4);
      this.particleMesh.setColorAt(i, this.particles[i].color);
    }
    this.particleMesh.instanceMatrix.needsUpdate = true;

    if (!this.isSoftwareGl) {
      this.renderer.compile(this.scene, this.camera);
    }

    this.bindEvents();
    this.resizeObserver = new ResizeObserver(() => this.handleResize());
    this.resizeObserver.observe(this.container);

    this.lastTime = performance.now();
    this.tick();
  }

  private setupStaticColliders() {
    const addStaticBox = (
      cx: number,
      cy: number,
      cz: number,
      hx: number,
      hy: number,
      hz: number
    ) => {
      const body = new CANNON.Body({
        mass: 0,
        material: this.groundMaterial,
        shape: new CANNON.Box(new CANNON.Vec3(hx, hy, hz)),
        position: new CANNON.Vec3(cx, cy, cz),
      });
      this.world.addBody(body);
    };

    // Sales + Depósito floor slab (top at y = 0.07)
    addStaticBox(0, 0.035, 0.9, 7.1, 0.035, 7.1);

    // Exterior asphalt ground plane
    const groundPlane = new CANNON.Body({
      mass: 0,
      material: this.groundMaterial,
      shape: new CANNON.Plane(),
    });
    groundPlane.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
    this.world.addBody(groundPlane);

    // Checkout counter top & base
    addStaticBox(-3.55, COUNTER_SURFACE_Y - 0.04, -3.55, 1.76, 0.04, 0.64);
    addStaticBox(-3.55, 0.485, -3.55, 1.725, 0.485, 0.6);

    // Gondola 1 (-2.55) & Gondola 2 (2.55) shelf planks & center spines
    for (const gx of [-2.55, 2.55]) {
      addStaticBox(gx, 1.07, 1.1, 0.06, 0.975, 2.45);
      for (const sy of [0.58, 1.08, 1.58]) {
        addStaticBox(gx, 0.07 + sy, 1.1, 0.48, 0.025, 2.45);
      }
    }

    // Left & Right wall chillers
    for (const cx of [-6.35, 6.35]) {
      for (const sy of [0.55, 1.08, 1.6]) {
        addStaticBox(cx, 0.07 + sy, 1.1, 0.31, 0.02, 2.5);
      }
    }

    // Depósito racks (z = 6.95)
    for (const rx of [-4.6, 4.6]) {
      for (const sy of [0.62, 1.22, 1.82]) {
        addStaticBox(rx, 0.07 + sy, 6.95, 1.6, 0.03, 0.425);
      }
    }

    // Outer supermarket walls & partition walls
    addStaticBox(-7.0, 1.95, 0.9, 0.12, 1.95, 7.0);
    addStaticBox(7.0, 1.95, 0.9, 0.12, 1.95, 7.0);
    addStaticBox(0, 1.95, 7.8, 7.1, 1.95, 0.12);
    // Depósito partition leaving doorway [-1.65..1.65]
    addStaticBox(-4.32, 1.95, 5.0, 2.675, 1.95, 0.11);
    addStaticBox(4.32, 1.95, 5.0, 2.675, 1.95, 0.11);
    // Storefront glass leaving doorway [-1.6..1.6]
    addStaticBox(-4.3, 1.5, -6.0, 2.7, 1.5, 0.11);
    addStaticBox(4.3, 1.5, -6.0, 2.7, 1.5, 0.11);
  }

  private spawnProductInstance(productId: ProductId, pos: THREE.Vector3) {
    const def = PRODUCT_CATALOG[productId];
    const mesh = createProductMesh(productId, this.textures);
    mesh.position.copy(pos);
    mesh.userData.instanceId = `item-${++this.instanceCounter}`;
    mesh.userData.interactKind = 'item';
    this.scene.add(mesh);

    const body = new CANNON.Body({
      mass: def.mass,
      material: this.itemMaterial,
      shape: new CANNON.Box(
        new CANNON.Vec3(def.size[0] * 0.5, def.size[1] * 0.5, def.size[2] * 0.5)
      ),
      position: new CANNON.Vec3(pos.x, pos.y, pos.z),
      linearDamping: 0.18,
      angularDamping: 0.28,
    });

    const item: PhysicalProduct = {
      instanceId: mesh.userData.instanceId,
      productId,
      mesh,
      body,
      homePos: pos.clone(),
      isHeld: false,
      lastImpactSoundAt: 0,
    };

    body.addEventListener('collide', (e: { contact: CANNON.ContactEquation }) => {
      const impact = Math.abs(e.contact.getImpactVelocityAlongNormal());
      const now = performance.now();
      if (impact > 0.75 && now - item.lastImpactSoundAt > 90 && this.phase === 'playing') {
        item.lastImpactSoundAt = now;
        soundEngine.playDropImpact(impact);
        if (impact > 2.0) {
          this.spawnParticles(mesh.position, 4, 0xd4a373, 1.2);
        }
      }
    });

    this.world.addBody(body);
    this.items.push(item);
    this.interactables.push(mesh);
    return item;
  }

  private spawnInitialStock() {
    for (const def of PRODUCT_LIST) {
      const spots = this.env.shelfSpots[def.id];
      for (const spot of spots) {
        this.spawnProductInstance(def.id, spot);
      }
    }
  }

  public restockProduct(productId: ProductId, count = 2) {
    const spots = this.env.shelfSpots[productId];
    const currentOnFloorOrShelf = this.items.filter((it) => it.productId === productId).length;
    for (let i = 0; i < count; i++) {
      const base = spots[(currentOnFloorOrShelf + i) % spots.length];
      const spawnPos = base.clone().add(new THREE.Vector3(0, 0.14 + i * 0.12, 0));
      this.spawnProductInstance(productId, spawnPos);
    }
    this.spawnParticles(spots[0], 8, 0x22c55e, 1.5);
  }

  public organizeShelves() {
    if (this.heldItem) {
      this.dropHeldItem(new THREE.Vector3(-3.45, COUNTER_SURFACE_Y + 0.35, -3.4));
    }
    const perTypeCounter = new Map<ProductId, number>();
    for (const item of this.items) {
      const idx = perTypeCounter.get(item.productId) ?? 0;
      perTypeCounter.set(item.productId, idx + 1);
      const spots = this.env.shelfSpots[item.productId];
      const spot = spots[idx % spots.length];
      const stackOffset =
        Math.floor(idx / spots.length) * (PRODUCT_CATALOG[item.productId].size[1] + 0.02);
      item.body.type = CANNON.Body.DYNAMIC;
      item.body.mass = PRODUCT_CATALOG[item.productId].mass;
      item.body.updateMassProperties();
      item.body.position.set(spot.x, spot.y + stackOffset, spot.z);
      item.body.velocity.set(0, 0, 0);
      item.body.angularVelocity.set(0, 0, 0);
      item.body.quaternion.set(0, 0, 0, 1);
      item.body.wakeUp();
    }
    soundEngine.playPickup();
  }

  public setPhase(phase: GamePhase) {
    this.phase = phase;
    if (phase === 'intro') {
      this.introTime = 0;
      soundEngine.unlock();
    }
    if (phase === 'playing') {
      soundEngine.unlock();
      this.camera.rotation.set(this.playerPitch, this.playerYaw, 0, 'YXZ');
      if (this.npcStatus === 'none' && !this.activeNpc && this.allowAutoNpcSpawn) {
        this.spawnNextStoryNpc();
      }
    }
    if (phase !== 'playing') {
      this.keysHeld.clear();
      this.analogMoveX = 0;
      this.analogMoveZ = 0;
      this.pointerDown = false;
      this.activeLookPointerId = null;
      soundEngine.updateAmbient(this.shiftSeconds, true, false, 0);
      if (document.pointerLockElement === this.renderer.domElement) {
        document.exitPointerLock?.();
      }
    }
    this.pushHudState(true);
  }

  public setAllowAutoNpcSpawn(allow: boolean) {
    this.allowAutoNpcSpawn = allow;
  }

  public setSensitivityPreset(preset: SensitivityPreset) {
    this.sensitivityPreset = preset;
  }

  public setLandscapeRotated(rotated: boolean) {
    this.landscapeRotated = rotated;
  }

  public setAnalogMove(x: number, z: number) {
    if (this.phase !== 'playing') {
      this.analogMoveX = 0;
      this.analogMoveZ = 0;
      return;
    }
    this.analogMoveX = Math.max(-1, Math.min(1, x));
    this.analogMoveZ = Math.max(-1, Math.min(1, z));
  }

  public setVirtualInput(code: string, active: boolean) {
    if (this.phase !== 'playing') return;
    if (active) this.keysHeld.add(code);
    else this.keysHeld.delete(code);
  }

  public toggleFlashlight() {
    this.flashlightOn = !this.flashlightOn;
    const hasProFlash = this.upgrades.includes('linterna_pro');
    this.flashlight.intensity = this.flashlightOn ? (hasProFlash ? 19 : 10.5) : 0;
    soundEngine.playPickup();
    this.pushHudState(true);
  }

  public async loadCustomCharacterFromFile(file: File): Promise<string> {
    const buffer = await file.arrayBuffer();
    const { root, mixer } = await loadNormalizedCustomCharacterModel(buffer);
    if (this.customModelMixer) {
      this.customModelMixer.stopAllAction();
      this.customModelMixer = null;
    }
    this.scene.remove(this.friendGroup);
    this.customModelGroup = root;
    this.customModelMixer = mixer;
    this.friendGroup = root;
    this.friendGroup.position.set(-1.55, 0.07, -2.35);
    this.friendGroup.rotation.y = 0.25;
    this.friendGroup.visible = this.remotePeers.size === 0;
    this.scene.add(this.friendGroup);
    this.profile = { ...this.profile, customModelName: file.name };
    this.pushHudState(true);
    return file.name;
  }

  public clearCustomCharacterModel() {
    if (this.customModelMixer) {
      this.customModelMixer.stopAllAction();
      this.customModelMixer = null;
    }
    this.customModelGroup = null;
    this.profile = { ...this.profile, customModelName: undefined };
    this.updateProfile(this.profile);
  }

  public grabAction() {
    if (this.phase !== 'playing') return;
    if (this.weaponEquipped) {
      this.fireWeapon();
      return;
    }
    this.raycaster.setFromCamera(_mouseNdc.set(0, 0), this.camera);
    const hits = this.raycaster.intersectObjects(this.interactables, true);
    for (const hit of hits) {
      if (hit.distance > 6.5) continue;
      const kind = this.findInteractKind(hit.object);
      if (kind === 'secret') {
        const sId = this.findSecretId(hit.object);
        if (sId && !this.discoveredSecrets.has(sId)) {
          this.discoverSecret(sId, true, true);
          return;
        }
      } else if (kind === 'item') {
        const prod = this.findProductFromObject(hit.object);
        if (prod && !prod.isHeld) {
          if (this.heldItem) {
            this.dropHeldItem();
          }
          this.pickUpItem(prod);
          return;
        }
      } else if (kind === 'weapon') {
        this.toggleWeapon();
        return;
      } else if (kind === 'register') {
        this.callbacks.onOpenPayment();
        return;
      }
    }
    // Check proximity to an undiscovered secret clue
    const nearbySecret = this.findNearestUndiscoveredSecret(2.8);
    if (nearbySecret) {
      this.discoverSecret(nearbySecret.id, true, true);
      return;
    }
    // Fallback: grab nearest reachable unheld product within 2.75m in front of player
    let bestProd: PhysicalProduct | null = null;
    let bestDist = 2.75;
    _vec3A.set(0, 0, -1).applyQuaternion(this.camera.quaternion);
    for (const item of this.items) {
      if (item.isHeld) continue;
      const d = item.mesh.position.distanceTo(this.camera.position);
      if (d < bestDist) {
        _vec3B.subVectors(item.mesh.position, this.camera.position).normalize();
        if (_vec3B.dot(_vec3A) > 0.35) {
          bestDist = d;
          bestProd = item;
        }
      }
    }
    if (bestProd) {
      if (this.heldItem) this.dropHeldItem();
      this.pickUpItem(bestProd);
    }
  }

  private findMatchingRestockZoneForHeld(productId: ProductId): RestockZoneState | null {
    if (this.hoveredTarget === 'restock_zone' && this.hoveredRestockZoneId) {
      const aimed = this.restockZones.find((z) => z.id === this.hoveredRestockZoneId);
      if (aimed && aimed.acceptedProducts.includes(productId)) {
        return aimed;
      }
    }
    let bestZone: RestockZoneState | null = null;
    let bestScore = Infinity;
    for (const zone of this.restockZones) {
      if (!zone.acceptedProducts.includes(productId)) continue;
      const dist = Math.hypot(this.playerPos.x - zone.pos[0], this.playerPos.z - zone.pos[2]);
      if (dist <= 2.9) {
        const urgencyBias = zone.needsRestock ? 0 : 2.5;
        if (dist + urgencyBias < bestScore) {
          bestScore = dist + urgencyBias;
          bestZone = zone;
        }
      }
    }
    return bestZone;
  }

  private consumeHeldItemForRestock(zone: RestockZoneState) {
    const item = this.heldItem;
    if (!item) return;
    const pid = item.productId;
    const res = tryRestockZoneWithProduct(this.restockZones, zone.id, pid, this.shiftSeconds);
    if (!res.ok) return;

    this.restockZones = res.nextZones;
    this.cash += res.bonusCash;
    this.reputation = Math.min(100, this.reputation + res.stabilityGain);
    this.restockedCount += 1;

    this.heldItem = null;
    this.world.removeBody(item.body);
    this.scene.remove(item.mesh);
    const idx = this.interactables.indexOf(item.mesh);
    if (idx >= 0) this.interactables.splice(idx, 1);
    const itemIdx = this.items.indexOf(item);
    if (itemIdx >= 0) this.items.splice(itemIdx, 1);

    // Spawn green restock particles at marker + replenish reserve unit in Depósito so food never runs out
    const markerPos = new THREE.Vector3(zone.pos[0], 1.4, zone.pos[2]);
    this.spawnParticles(markerPos, 12, 0x22c55e, 2.0);
    const reserveSpots = this.env.shelfSpots[pid];
    const depSpot = reserveSpots[2] ?? reserveSpots[0];
    if (depSpot) {
      this.spawnProductInstance(pid, depSpot.clone().add(new THREE.Vector3(0, 0.14, 0)));
    }

    soundEngine.playRestock();
    this.pushHudState(true);
  }

  public dropAction(throwForward = true) {
    if (this.phase !== 'playing' || !this.heldItem) return;

    // 1. Check if player is restocking a matching supermarket shelf / chiller zone
    const restockTarget = this.findMatchingRestockZoneForHeld(this.heldItem.productId);
    if (restockTarget) {
      this.consumeHeldItemForRestock(restockTarget);
      return;
    }

    // 2. Check Checkout Counter delivery zone
    this.raycaster.setFromCamera(_mouseNdc.set(0, 0), this.camera);
    const hits = this.raycaster.intersectObjects(this.interactables, true);
    const counterHit = hits.find(
      (h) => h.distance <= 5.5 && this.findInteractKind(h.object) === 'counter_zone'
    );
    if (counterHit) {
      this.dropHeldItem(
        new THREE.Vector3(counterHit.point.x, COUNTER_SURFACE_Y + 0.34, counterHit.point.z)
      );
      return;
    }

    const distToCounter = Math.hypot(this.playerPos.x + 3.45, this.playerPos.z + 3.4);
    if (distToCounter <= 2.45) {
      this.dropHeldItem(
        new THREE.Vector3(
          -3.45 + (Math.random() - 0.5) * 0.7,
          COUNTER_SURFACE_Y + 0.34,
          -3.4 + (Math.random() - 0.5) * 0.35
        )
      );
      return;
    }

    if (throwForward) {
      _vec3A.set(0, 0, -1).applyQuaternion(this.camera.quaternion).normalize();
      this.dropHeldItem(undefined, new THREE.Vector3(_vec3A.x * 3.1, 0.9, _vec3A.z * 3.1));
    } else {
      this.dropHeldItem();
    }
  }

  public triggerCenterAction() {
    if (this.phase !== 'playing') return;
    if (this.heldItem) {
      this.dropAction(true);
    } else {
      this.grabAction();
    }
  }

  public setRemotePeers(peers: OnlinePlayerState[]) {
    const incomingIds = new Set(peers.map((p) => p.id));

    for (const [id, actor] of this.remotePeers.entries()) {
      if (!incomingIds.has(id)) {
        this.scene.remove(actor.mesh);
        this.remotePeers.delete(id);
      }
    }

    for (const peer of peers) {
      const profileKey = `${peer.profile.playerName}:${peer.profile.shirtId}:${peer.profile.skinTone}:${peer.profile.hairColor}:${peer.profile.hasCap}`;
      let actor = this.remotePeers.get(peer.id);
      if (!actor || actor.profileKey !== profileKey) {
        if (actor) {
          this.scene.remove(actor.mesh);
        }
        const mesh = createFriendModel(peer.profile, peer.profile.playerName, this.textures);
        mesh.position.set(peer.x, 0.07, peer.z);
        mesh.rotation.y = peer.yaw;
        this.scene.add(mesh);
        actor = {
          id: peer.id,
          profileKey,
          mesh,
          targetPos: new THREE.Vector3(peer.x, 0.07, peer.z),
          targetYaw: peer.yaw,
          heldProductId: null,
          heldMesh: null,
          walkPhase: 0,
        };
        this.remotePeers.set(peer.id, actor);
      } else {
        actor.targetPos.set(peer.x, 0.07, peer.z);
        actor.targetYaw = peer.yaw;
      }

      if (actor.heldProductId !== peer.heldProductId) {
        if (actor.heldMesh) {
          actor.mesh.remove(actor.heldMesh);
          actor.heldMesh = null;
        }
        actor.heldProductId = peer.heldProductId;
        if (peer.heldProductId) {
          const itemMesh = createProductMesh(peer.heldProductId, this.textures);
          itemMesh.position.set(0.28, 1.02, 0.34);
          actor.mesh.add(itemMesh);
          actor.heldMesh = itemMesh;
        }
      }
    }

    // Hide local companion NPC while real online co-op friends are connected
    this.friendGroup.visible = this.remotePeers.size === 0;
  }

  public applyRemoteRoomSnapshot(snapshot: RoomStateSnapshot) {
    this.cash = snapshot.cash;
    this.customersServed = snapshot.customersServed;
    this.reputation = snapshot.reputation;
    this.shiftSeconds = snapshot.shiftSeconds ?? SHIFT_START_SECONDS;
    this.storyIndex = snapshot.storyIndex;
    this.nightNumber = snapshot.nightNumber ?? 1;
    this.nightServed = snapshot.nightServed ?? 0;
    this.nightCompleteTriggered = formatShiftClock(this.shiftSeconds).isShiftComplete;
    this.applyUpgrades(snapshot.upgrades ?? []);
    this.syncDiscoveredSecrets(snapshot.discoveredSecrets ?? []);
    if (snapshot.activeNpc) {
      this.spawnNpc(snapshot.activeNpc, false);
      if (snapshot.npcStatus === 'waiting' && this.npcGroup) {
        this.npcPos.set(this.npcTargetX, 0, this.npcTargetZ);
        this.npcGroup.position.copy(this.npcPos);
        this.npcGroup.rotation.y = 0;
        this.npcStatus = 'waiting';
      } else {
        this.npcStatus = snapshot.npcStatus;
      }
    } else {
      this.clearCurrentNpc();
    }
    this.pushHudState(true);
  }

  public applyRemoteSaleCompleted(
    cash: number,
    customersServed: number,
    nightServed: number,
    reputation: number,
    soldItems: OrderItem[]
  ) {
    this.cash = cash;
    this.customersServed = customersServed;
    this.nightServed = nightServed;
    this.reputation = reputation;
    for (const req of soldItems) {
      let remaining = req.quantity;
      for (let i = this.items.length - 1; i >= 0 && remaining > 0; i--) {
        const it = this.items[i];
        if (
          it.productId === req.productId &&
          isPointInDeliveryZone(it.body.position.x, it.body.position.y, it.body.position.z)
        ) {
          this.spawnParticles(it.mesh.position, 6, 0x4ade80, 1.8);
          this.world.removeBody(it.body);
          this.scene.remove(it.mesh);
          const idx = this.interactables.indexOf(it.mesh);
          if (idx >= 0) this.interactables.splice(idx, 1);
          this.items.splice(i, 1);
          remaining--;
        }
      }
    }
    soundEngine.playCashRegister();
    if (this.activeNpc) {
      this.npcStatus = 'leaving';
      this.callbacks.onNpcEvent?.('leaving', this.activeNpc);
    }
    this.pushHudState(true);
  }

  public applyRemoteNpcStatus(npcStatus: RoomStateSnapshot['npcStatus'], reputation: number) {
    const prev = this.npcStatus;
    this.reputation = reputation;
    this.npcStatus = npcStatus;
    if (npcStatus === 'none') {
      this.clearCurrentNpc();
    } else if (npcStatus === 'waiting' && this.npcGroup) {
      this.npcPos.set(this.npcTargetX, 0, this.npcTargetZ);
      this.npcGroup.position.copy(this.npcPos);
      this.npcGroup.rotation.y = 0;
      if (this.activeNpc) {
        this.callbacks.onNpcEvent?.('waiting', this.activeNpc);
      }
    } else if (npcStatus === 'attacking' && this.activeNpc) {
      this.npcAttackTimer = 0;
      soundEngine.playAlarmWarning();
      this.callbacks.onNpcEvent?.('attacking', this.activeNpc);
    } else if (npcStatus === 'scared' && this.activeNpc) {
      if (prev !== 'scared') {
        this.nightServed += 1;
      }
      this.callbacks.onNpcEvent?.('scared', this.activeNpc);
    }
    this.pushHudState(true);
  }

  public applyRemoteSecretDiscovered(
    secretId: string,
    discoveredSecrets: string[],
    cash: number,
    reputation: number,
    byPlayerName: string
  ) {
    const wasNew = !this.discoveredSecrets.has(secretId);
    this.cash = cash;
    this.reputation = reputation;
    this.syncDiscoveredSecrets(discoveredSecrets);
    if (wasNew) {
      const secret = SECRET_EVENTS.find((s) => s.id === secretId);
      if (secret) {
        soundEngine.playSecretDiscovery();
        this.callbacks.onSecretDiscovered?.(secret, byPlayerName);
      }
    }
    this.pushHudState(true);
  }

  public applyRemoteUpgrades(upgrades: KioscoUpgradeId[], cash: number) {
    this.cash = cash;
    this.applyUpgrades(upgrades);
  }

  public applyRemoteNightAdvanced(nightNumber: number, nightServed: number, shiftSeconds: number) {
    this.nightNumber = nightNumber;
    this.nightServed = nightServed;
    this.storyIndex = 0;
    this.shiftSeconds = shiftSeconds;
    this.nightCompleteTriggered = false;
    this.restockZones = createInitialRestockZones();
    this.reputation = Math.max(75, this.reputation);
    this.clearCurrentNpc();
    this.nextNpcTimer = 0.8;
    this.pushHudState(true);
  }

  public buyUpgrade(upgradeId: KioscoUpgradeId): boolean {
    const upg = KIOSCO_UPGRADES.find((u) => u.id === upgradeId);
    if (!upg || this.upgrades.includes(upgradeId) || this.cash < upg.cost) return false;
    this.cash -= upg.cost;
    this.applyUpgrades([...this.upgrades, upgradeId]);
    soundEngine.playCashRegister();
    return true;
  }

  public applyUpgrades(upgrades: KioscoUpgradeId[]) {
    this.upgrades = [...upgrades];
    const hasReflector = this.upgrades.includes('reflector_led');
    this.reflectorLight.intensity = hasReflector ? 13.5 : 0;
    for (const tf of this.env.tubeFixtures) {
      tf.baseIntensity = hasReflector ? 6.8 : 5.2;
    }

    const hasProFlash = this.upgrades.includes('linterna_pro');
    this.flashlight.angle = hasProFlash ? Math.PI / 4.0 : Math.PI / 5.4;
    this.flashlight.distance = hasProFlash ? 36 : 24;
    this.flashlight.intensity = this.flashlightOn ? (hasProFlash ? 19 : 10.5) : 0;
    this.pushHudState(true);
  }

  public advanceToNextNight(nextNight?: number) {
    this.nightNumber = nextNight ?? this.nightNumber + 1;
    this.nightServed = 0;
    this.storyIndex = 0;
    this.nightCompleteTriggered = false;
    this.shiftSeconds = SHIFT_START_SECONDS;
    this.restockZones = createInitialRestockZones();
    this.reputation = Math.max(85, this.reputation);
    this.activeHorrorEvent = null;
    this.aisleShadowMesh.visible = false;
    this.shadowDuration = 0;
    this.horrorEventTimer = 4.5;
    if (this.scene.fog instanceof THREE.FogExp2) {
      this.scene.fog.density = 0.028;
    }
    this.clearCurrentNpc();
    this.nextNpcTimer = 0.8;
    this.pushHudState(true);
  }

  private syncDiscoveredSecrets(ids: string[]) {
    this.discoveredSecrets = new Set(ids);
    for (const [sid, prop] of this.secretProps.entries()) {
      const found = this.discoveredSecrets.has(sid);
      prop.beacon.visible = !found;
      prop.glowOrb.visible = !found;
    }
  }

  public discoverSecret(secretId: string, broadcast = true, grantRewards = true) {
    const secret = SECRET_EVENTS.find((s) => s.id === secretId);
    if (!secret || this.discoveredSecrets.has(secretId)) return;
    this.discoveredSecrets.add(secretId);
    const prop = this.secretProps.get(secretId);
    if (prop) {
      prop.beacon.visible = false;
      prop.glowOrb.visible = false;
      this.spawnParticles(prop.group.position.clone().setY(0.55), 14, 0x38bdf8, 2.2);
    }
    if (grantRewards) {
      this.cash += secret.rewardCash;
      this.reputation = Math.min(100, this.reputation + secret.rewardRep);
    }
    soundEngine.playSecretDiscovery();
    this.callbacks.onSecretDiscovered?.(secret);
    if (broadcast) {
      this.callbacks.onSyncSecretDiscover?.(secretId);
    }
    this.pushHudState(true);
  }

  public updateProfile(profile: PlayerProfile) {
    this.profile = { ...profile };
    if (this.customModelGroup && profile.customModelName) {
      this.pushHudState(true);
      return;
    }
    this.scene.remove(this.friendGroup);
    this.friendGroup = createFriendModel(this.profile, undefined, this.textures);
    this.friendGroup.position.set(-1.55, 0.07, -2.35);
    this.friendGroup.rotation.y = 0.25;
    this.friendGroup.visible = this.remotePeers.size === 0;
    this.scene.add(this.friendGroup);
    this.pushHudState(true);
  }

  public resetShift() {
    for (const item of this.items) {
      this.world.removeBody(item.body);
      this.scene.remove(item.mesh);
      const idx = this.interactables.indexOf(item.mesh);
      if (idx >= 0) this.interactables.splice(idx, 1);
    }
    this.items = [];
    this.heldItem = null;
    this.cash = 4500;
    this.customersServed = 0;
    this.reputation = 90;
    this.shiftSeconds = SHIFT_START_SECONDS;
    this.restockZones = createInitialRestockZones();
    this.restockedCount = 0;
    this.flickerAlert = false;
    this.flickerTimer = 0;
    this.activeHorrorEvent = null;
    this.aisleShadowMesh.visible = false;
    this.shadowDuration = 0;
    this.horrorEventTimer = 4.0;
    if (this.scene.fog instanceof THREE.FogExp2) {
      this.scene.fog.density = 0.028;
    }
    this.storyIndex = 0;
    this.nightNumber = 1;
    this.nightServed = 0;
    this.nightCompleteTriggered = false;
    this.syncDiscoveredSecrets([]);
    this.applyUpgrades([]);
    this.playerPos.set(0, 1.72, 3.4);
    this.playerYaw = 0;
    this.targetYaw = 0;
    this.playerPitch = -0.14;
    this.targetPitch = -0.14;
    this.weaponEquipped = false;
    this.underCounterWeaponMesh.visible = true;
    this.viewWeaponMesh.visible = false;
    this.clearCurrentNpc();
    this.spawnInitialStock();
    this.nextNpcTimer = 0.8;
    this.pushHudState(true);
  }

  public toggleWeapon() {
    if (this.phase !== 'playing') return;
    if (this.heldItem) {
      this.dropHeldItem();
    }
    this.weaponEquipped = !this.weaponEquipped;
    this.underCounterWeaponMesh.visible = !this.weaponEquipped;
    this.viewWeaponMesh.visible = this.weaponEquipped;
    soundEngine.playWeaponCock();
    this.pushHudState(true);
  }

  private handleWeaponFiredOnNpc() {
    if (!this.activeNpc || this.npcStatus === 'scared' || this.npcStatus === 'leaving') return;
    let repDelta = -15;
    if (this.npcStatus === 'attacking') {
      repDelta = 15;
      this.cash += 800;
      this.customersServed += 1;
    } else if (this.activeNpc.isSuspicious) {
      repDelta = -5;
    }
    this.nightServed += 1;
    this.npcStatus = 'scared';
    this.reputation = Math.max(0, Math.min(100, this.reputation + repDelta));
    this.callbacks.onNpcEvent?.('scared', this.activeNpc);
    this.callbacks.onSyncNpcStatus?.('scared', repDelta);
    this.pushHudState(true);
  }

  public fireWeapon() {
    if (!this.weaponEquipped || this.phase !== 'playing') return;
    soundEngine.playGunshot();
    this.weaponRecoil = 1.0;
    this.muzzleFlashTimer = 0.08;
    this.muzzleFlashLight.intensity = 10;
    this.cameraTrauma = Math.min(1, this.cameraTrauma + 0.65);
    this.hitstopTimer = 0.04;

    _vec3A.set(0.22, -0.14, -0.9).applyMatrix4(this.camera.matrixWorld);
    this.spawnParticles(_vec3A, 18, 0xfbbf24, 4.5);

    if (
      this.activeNpc &&
      (this.npcStatus === 'attacking' ||
        this.npcStatus === 'waiting' ||
        this.npcStatus === 'approaching')
    ) {
      this.handleWeaponFiredOnNpc();
    }
    this.pushHudState(true);
  }

  public spawnNextStoryNpc() {
    if (this.nightCompleteTriggered || this.phase !== 'playing') {
      return;
    }
    const enc = getNightEncounter(this.nightNumber, this.storyIndex);
    this.storyIndex++;
    this.spawnNpc(enc, true);
  }

  public spawnNpc(encounter: NpcEncounter, broadcast = true) {
    this.clearCurrentNpc();
    this.activeNpc = encounter;
    this.npcWaitTimer = 0;
    this.npcAttackTimer = 0;
    this.alarmPlayedForNpc = false;
    this.npcGroup = createNpcByArchetype(encounter.archetype, this.textures);
    this.npcPos.set(0, 0, -10.5);
    this.npcGroup.position.copy(this.npcPos);
    this.scene.add(this.npcGroup);
    this.npcStatus = 'approaching';
    soundEngine.playDoorChime();
    this.callbacks.onNpcEvent?.('approaching', encounter);
    if (broadcast) {
      this.callbacks.onSyncNpcSpawn?.(encounter, this.storyIndex);
    }
    this.pushHudState(true);
  }

  private clearCurrentNpc() {
    if (this.npcGroup) {
      this.scene.remove(this.npcGroup);
      this.npcGroup = null;
    }
    this.activeNpc = null;
    this.npcStatus = 'none';
    this.npcWaitTimer = 0;
    this.npcAttackTimer = 0;
    this.alarmPlayedForNpc = false;
  }

  public completeActiveOrderSale(soldTotal: number): OrderItem[] {
    if (!this.activeNpc) return [];
    const soldItems = this.activeNpc.items;
    const tipBonus = this.upgrades.includes('mostrador_pro') ? 350 : 0;
    this.cash += soldTotal + tipBonus;
    this.customersServed += 1;
    this.nightServed += 1;
    this.reputation = Math.min(100, this.reputation + 5);

    for (const req of soldItems) {
      let remaining = req.quantity;
      for (let i = this.items.length - 1; i >= 0 && remaining > 0; i--) {
        const it = this.items[i];
        if (
          it.productId === req.productId &&
          isPointInDeliveryZone(it.body.position.x, it.body.position.y, it.body.position.z)
        ) {
          this.spawnParticles(it.mesh.position, 6, 0x4ade80, 1.8);
          this.world.removeBody(it.body);
          this.scene.remove(it.mesh);
          const idx = this.interactables.indexOf(it.mesh);
          if (idx >= 0) this.interactables.splice(idx, 1);
          this.items.splice(i, 1);
          remaining--;
        }
      }
      // Also replenish reserve in Depósito so shelf supply never softlocks
      const depSpot = this.env.shelfSpots[req.productId]?.[2];
      if (depSpot) {
        this.spawnProductInstance(req.productId, depSpot.clone().add(new THREE.Vector3(0, 0.14, 0)));
      }
    }

    soundEngine.playCashRegister();
    this.npcStatus = 'leaving';
    this.callbacks.onNpcEvent?.('leaving', this.activeNpc);
    this.pushHudState(true);
    return soldItems;
  }

  public getCounterSnapshots(): CounterItemSnapshot[] {
    return this.items
      .filter((it) => !it.isHeld)
      .map((it) => ({
        instanceId: it.instanceId,
        productId: it.productId,
        x: it.body.position.x,
        y: it.body.position.y,
        z: it.body.position.z,
      }));
  }

  public dropQuickItemToCounter(productId: ProductId): boolean {
    const candidate = this.items.find(
      (it) =>
        !it.isHeld &&
        it.productId === productId &&
        !isPointInDeliveryZone(it.body.position.x, it.body.position.y, it.body.position.z)
    );
    if (!candidate) return false;
    const dropX =
      (COUNTER_DELIVERY_ZONE.minX + COUNTER_DELIVERY_ZONE.maxX) * 0.5 +
      (Math.random() - 0.5) * 0.85;
    const dropZ =
      (COUNTER_DELIVERY_ZONE.minZ + COUNTER_DELIVERY_ZONE.maxZ) * 0.5 +
      (Math.random() - 0.5) * 0.35;
    candidate.body.type = CANNON.Body.DYNAMIC;
    candidate.body.mass = PRODUCT_CATALOG[productId].mass;
    candidate.body.updateMassProperties();
    candidate.body.position.set(dropX, COUNTER_SURFACE_Y + 0.42, dropZ);
    candidate.body.velocity.set(0, -1.2, 0);
    candidate.body.angularVelocity.set(
      (Math.random() - 0.5) * 2.5,
      (Math.random() - 0.5) * 2.5,
      (Math.random() - 0.5) * 2.5
    );
    candidate.body.wakeUp();
    soundEngine.playPickup();
    return true;
  }

  private spawnParticles(origin: THREE.Vector3, count: number, hexColor: number, speed: number) {
    for (let i = 0; i < count; i++) {
      const slot = this.particles[this.particleCursor];
      this.particleCursor = (this.particleCursor + 1) % PARTICLE_POOL_SIZE;
      slot.active = true;
      slot.age = 0;
      slot.maxAge = 0.25 + Math.random() * 0.35;
      slot.pos.copy(origin);
      slot.vel.set(
        (Math.random() - 0.5) * speed,
        0.5 + Math.random() * speed * 0.8,
        (Math.random() - 0.5) * speed
      );
      slot.scale = 0.7 + Math.random() * 0.8;
      slot.color.setHex(hexColor);
      this.particleMesh.setColorAt(
        this.particleCursor === 0 ? PARTICLE_POOL_SIZE - 1 : this.particleCursor - 1,
        slot.color
      );
    }
    if (this.particleMesh.instanceColor) {
      this.particleMesh.instanceColor.needsUpdate = true;
    }
  }

  private findProductFromObject(obj: THREE.Object3D): PhysicalProduct | null {
    let cur: THREE.Object3D | null = obj;
    while (cur) {
      if (cur.userData?.instanceId) {
        return this.items.find((i) => i.instanceId === cur!.userData.instanceId) ?? null;
      }
      cur = cur.parent;
    }
    return null;
  }

  private findInteractKind(
    obj: THREE.Object3D
  ): 'item' | 'counter_zone' | 'restock_zone' | 'register' | 'weapon' | 'secret' | null {
    let cur: THREE.Object3D | null = obj;
    while (cur) {
      if (cur.userData?.interactKind) {
        return cur.userData.interactKind;
      }
      cur = cur.parent;
    }
    return null;
  }

  private findSecretId(obj: THREE.Object3D): string | null {
    let cur: THREE.Object3D | null = obj;
    while (cur) {
      if (typeof cur.userData?.secretId === 'string') {
        return cur.userData.secretId;
      }
      cur = cur.parent;
    }
    return null;
  }

  private findRestockZoneId(obj: THREE.Object3D): RestockZoneId | null {
    let cur: THREE.Object3D | null = obj;
    while (cur) {
      if (typeof cur.userData?.restockZoneId === 'string') {
        return cur.userData.restockZoneId as RestockZoneId;
      }
      cur = cur.parent;
    }
    return null;
  }

  private findNearestUndiscoveredSecret(maxDist: number): SecretEventDef | null {
    let best: SecretEventDef | null = null;
    let bestDist = maxDist;
    for (const s of SECRET_EVENTS) {
      if (this.discoveredSecrets.has(s.id)) continue;
      const d = Math.hypot(this.playerPos.x - s.pos[0], this.playerPos.z - s.pos[2]);
      if (d < bestDist) {
        bestDist = d;
        best = s;
      }
    }
    return best;
  }

  private pickUpItem(item: PhysicalProduct) {
    if (this.weaponEquipped) {
      this.weaponEquipped = false;
      this.underCounterWeaponMesh.visible = true;
      this.viewWeaponMesh.visible = false;
    }
    this.heldItem = item;
    item.isHeld = true;
    item.body.type = CANNON.Body.KINEMATIC;
    item.body.mass = 0;
    item.body.updateMassProperties();
    item.body.velocity.set(0, 0, 0);
    item.body.angularVelocity.set(0, 0, 0);
    soundEngine.playPickup();
    this.pushHudState(true);
  }

  private dropHeldItem(explicitDropPos?: THREE.Vector3, throwVel?: THREE.Vector3) {
    const item = this.heldItem;
    if (!item) return;
    this.heldItem = null;
    item.isHeld = false;

    const def = PRODUCT_CATALOG[item.productId];
    item.body.type = CANNON.Body.DYNAMIC;
    item.body.mass = def.mass;
    item.body.updateMassProperties();

    if (explicitDropPos) {
      item.body.position.set(explicitDropPos.x, explicitDropPos.y, explicitDropPos.z);
    }
    if (throwVel) {
      item.body.velocity.set(throwVel.x, throwVel.y, throwVel.z);
    } else {
      item.body.velocity.set(0, -0.9, 0);
    }
    item.body.angularVelocity.set(
      (Math.random() - 0.5) * 2.2,
      (Math.random() - 0.5) * 1.8,
      (Math.random() - 0.5) * 2.2
    );
    item.body.wakeUp();
    this.pushHudState(true);
  }

  private updateRaycast(clientX: number, clientY: number) {
    const rect = this.renderer.domElement.getBoundingClientRect();
    if (document.pointerLockElement === this.renderer.domElement) {
      _mouseNdc.set(0, 0);
    } else if (this.landscapeRotated) {
      _mouseNdc.x = ((clientY - rect.top) / Math.max(1, rect.height)) * 2 - 1;
      _mouseNdc.y = -((rect.right - clientX) / Math.max(1, rect.width)) * 2 + 1;
    } else {
      _mouseNdc.x = ((clientX - rect.left) / Math.max(1, rect.width)) * 2 - 1;
      _mouseNdc.y = -((clientY - rect.top) / Math.max(1, rect.height)) * 2 + 1;
    }
    this.raycaster.setFromCamera(_mouseNdc, this.camera);
    const hits = this.raycaster.intersectObjects(this.interactables, true);

    this.hoveredItem = null;
    this.hoveredTarget = null;
    this.hoveredSecretId = null;
    this.hoveredRestockZoneId = null;

    for (const hit of hits) {
      if (hit.distance > 6.5) continue;
      const kind = this.findInteractKind(hit.object);
      if (kind === 'secret') {
        const sId = this.findSecretId(hit.object);
        if (sId && !this.discoveredSecrets.has(sId)) {
          this.hoveredTarget = 'secret';
          this.hoveredSecretId = sId;
          return hit.point;
        }
      } else if (kind === 'item') {
        const prod = this.findProductFromObject(hit.object);
        if (prod && !prod.isHeld) {
          this.hoveredItem = prod;
          this.hoveredTarget = 'item';
          return hit.point;
        }
      } else if (kind === 'restock_zone') {
        const zId = this.findRestockZoneId(hit.object);
        if (zId) {
          this.hoveredTarget = 'restock_zone';
          this.hoveredRestockZoneId = zId;
          return hit.point;
        }
      } else if (kind === 'weapon' && !this.weaponEquipped) {
        this.hoveredTarget = 'weapon';
        return hit.point;
      } else if (kind === 'register') {
        this.hoveredTarget = 'register';
        return hit.point;
      } else if (kind === 'counter_zone') {
        this.hoveredTarget = 'counter_zone';
        return hit.point;
      }
    }
    return null;
  }

  private bindEvents() {
    const canvas = this.renderer.domElement;

    const onKeyDown = (e: KeyboardEvent) => {
      if (this.phase !== 'playing') return;
      soundEngine.unlock();
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT')
      ) {
        return;
      }
      this.keysHeld.add(e.code);
    };

    const onKeyUp = (e: KeyboardEvent) => {
      this.keysHeld.delete(e.code);
    };

    const onBlur = () => {
      this.keysHeld.clear();
      this.pointerDown = false;
      this.activeLookPointerId = null;
    };

    const onPointerDown = (e: PointerEvent) => {
      if (this.phase !== 'playing') return;
      if (e.target !== canvas) return;
      const hitEl = document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null;
      if (hitEl?.closest('[data-hud-interactive="true"]')) return;
      if (this.activeLookPointerId !== null && this.activeLookPointerId !== e.pointerId) return;

      soundEngine.unlock();
      this.pointerDown = true;
      this.activeLookPointerId = e.pointerId;
      this.pointerMovedDist = 0;
      this.lastPointerX = e.clientX;
      this.lastPointerY = e.clientY;
      if (e.pointerType !== 'touch') {
        this.pointerClientX = e.clientX;
        this.pointerClientY = e.clientY;
        this.hasPointerPos = true;
      }
    };

    const onPointerMove = (e: PointerEvent) => {
      if (this.phase !== 'playing') return;
      const lookScale = SENSITIVITY_PRESETS[this.sensitivityPreset]?.lookScale ?? 1.18;

      if (document.pointerLockElement === canvas) {
        this.pointerClientX = e.clientX;
        this.pointerClientY = e.clientY;
        this.hasPointerPos = true;
        this.targetYaw -= e.movementX * 0.0046 * lookScale;
        this.targetPitch = THREE.MathUtils.clamp(
          this.targetPitch - e.movementY * 0.0038 * lookScale,
          -1.05,
          0.72
        );
      } else if (this.pointerDown && e.pointerId === this.activeLookPointerId) {
        if (e.pointerType !== 'touch') {
          this.pointerClientX = e.clientX;
          this.pointerClientY = e.clientY;
          this.hasPointerPos = true;
        }
        const rawDx = e.clientX - this.lastPointerX;
        const rawDy = e.clientY - this.lastPointerY;
        const dx = this.landscapeRotated ? rawDy : rawDx;
        const dy = this.landscapeRotated ? -rawDx : rawDy;
        this.pointerMovedDist += Math.hypot(rawDx, rawDy);
        this.lastPointerX = e.clientX;
        this.lastPointerY = e.clientY;
        this.targetYaw -= dx * 0.0064 * lookScale;
        this.targetPitch = THREE.MathUtils.clamp(
          this.targetPitch - dy * 0.0052 * lookScale,
          -1.05,
          0.72
        );
      } else if (!this.pointerDown && e.pointerType === 'mouse' && e.target === canvas) {
        this.pointerClientX = e.clientX;
        this.pointerClientY = e.clientY;
        this.hasPointerPos = true;
      }
    };

    const onPointerUp = (e: PointerEvent) => {
      if (e.pointerId !== this.activeLookPointerId) return;
      const wasClick = this.pointerMovedDist < 7;
      this.pointerDown = false;
      this.activeLookPointerId = null;
      if (this.phase !== 'playing' || !wasClick) return;

      const hitPoint = this.updateRaycast(e.clientX, e.clientY);

      if (this.weaponEquipped && e.button === 0) {
        if (this.hoveredTarget === 'register') {
          this.callbacks.onOpenPayment();
        } else {
          this.fireWeapon();
        }
        return;
      }

      if (this.heldItem) {
        const restockTarget = this.findMatchingRestockZoneForHeld(this.heldItem.productId);
        if (restockTarget) {
          this.consumeHeldItemForRestock(restockTarget);
        } else if (this.hoveredTarget === 'counter_zone' && hitPoint) {
          this.dropHeldItem(new THREE.Vector3(hitPoint.x, COUNTER_SURFACE_Y + 0.36, hitPoint.z));
        } else {
          this.dropHeldItem();
        }
        return;
      }

      if (this.hoveredTarget === 'secret' && this.hoveredSecretId) {
        this.discoverSecret(this.hoveredSecretId, true, true);
      } else if (this.hoveredTarget === 'item' && this.hoveredItem) {
        this.pickUpItem(this.hoveredItem);
      } else if (this.hoveredTarget === 'weapon') {
        this.toggleWeapon();
      } else if (this.hoveredTarget === 'register') {
        this.callbacks.onOpenPayment();
      }
    };

    const onPointerCancel = (e: PointerEvent) => {
      if (e.pointerId !== this.activeLookPointerId) return;
      this.pointerDown = false;
      this.activeLookPointerId = null;
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);
    canvas.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointercancel', onPointerCancel);

    this.unbindEvents = () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
      canvas.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', onPointerCancel);
    };
  }

  private unbindEvents: () => void = () => {};

  private handleResize() {
    if (this.disposed) return;
    const width = Math.max(1, this.container.clientWidth);
    const height = Math.max(1, this.container.clientHeight);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
    if (this.composer) {
      this.composer.setSize(width, height);
      this.bloomPass?.resolution.set(width, height);
      this.composer.render();
    } else {
      this.renderer.render(this.scene, this.camera);
    }
  }

  private updateRestockAndFlicker(dt: number, elapsed: number) {
    const chapter = getNightChapter(this.nightNumber);
    const res = tickRestockZones(
      this.restockZones,
      dt,
      chapter.restockDepleteRate,
      this.npcStatus === 'attacking'
    );
    this.restockZones = res.nextZones;

    if (res.stabilityDrain > 0) {
      this.reputation = Math.max(0, this.reputation - res.stabilityDrain);
      if (this.reputation <= 0 && this.phase === 'playing') {
        this.phase = 'gameover';
        soundEngine.playPowerFlicker();
        this.callbacks.onGameOver?.();
        this.pushHudState(true);
        return;
      }
    }

    // Update 3D shelf restock markers
    for (const zone of this.restockZones) {
      const marker = this.env.restockMarkers.get(zone.id);
      if (!marker) continue;

      const hex = zone.isCritical ? 0xef4444 : zone.needsRestock ? 0xf59e0b : 0x22c55e;
      marker.ringMat.color.setHex(hex);
      marker.orbMat.color.setHex(hex);
      marker.orbMat.emissive.setHex(hex);
      marker.fillMat.color.setHex(hex);
      marker.fillBar.scale.x = Math.max(0.05, zone.stockPercent / 100);

      const pulse = zone.isCritical
        ? 1 + Math.abs(Math.sin(elapsed * 8.5)) * 0.25
        : zone.needsRestock
        ? 1 + Math.sin(elapsed * 4.5) * 0.14
        : 1;
      marker.ring.scale.set(pulse, pulse, 1);
      marker.orb.rotation.y = elapsed * (zone.needsRestock ? 3.5 : 1.4);
      marker.orb.position.y = 2.02 + Math.sin(elapsed * 3.2) * 0.08;
    }

    // Horror power flicker when chillers/gondolas hit critical, an entity attacks, or horror event fires
    const shouldFlicker =
      res.criticalCount > 0 ||
      this.npcStatus === 'attacking' ||
      this.flickerTimer > 0 ||
      this.activeHorrorEvent?.type === 'flicker_lights';
    this.flickerAlert = shouldFlicker;

    if (this.flickerTimer > 0) {
      this.flickerTimer = Math.max(0, this.flickerTimer - dt);
    }

    const flickerDepth = this.activeHorrorEvent?.type === 'flicker_lights' ? 0.05 : 0.18;
    this.env.tubeFixtures.forEach((tf, idx) => {
      if (shouldFlicker) {
        const wave = Math.sin(elapsed * (19 + idx * 6.5) + idx * 2.1);
        const stutter = Math.sin(elapsed * 43 + idx * 4.7) > 0.25 ? 1 : 0.35;
        const dim = wave > 0.12 ? 0.92 * stutter : flickerDepth;
        tf.light.intensity = tf.baseIntensity * dim;
        tf.mat.emissiveIntensity = dim * 1.45;
      } else {
        tf.light.intensity = tf.baseIntensity;
        tf.mat.emissiveIntensity = 1.45;
      }
    });

    this.env.depositoRedLight.intensity =
      res.criticalCount > 0 || this.activeHorrorEvent?.type === 'freezer_slam'
        ? 4.6 + Math.sin(elapsed * 9.5) * 3.1
        : 5.5 + Math.sin(elapsed * 2.2) * 0.7;

    this.updateHorrorEvents(dt, elapsed);
  }

  public triggerHorrorEvent(forcedType?: HorrorEventType) {
    const evt = pickHorrorEvent(
      this.reputation,
      this.shiftSeconds,
      this.nightNumber,
      forcedType
        ? forcedType === 'flicker_lights'
          ? 0.05
          : forcedType === 'aisle_shadow'
          ? 0.45
          : forcedType === 'shelf_drop'
          ? 0.7
          : 0.95
        : Math.random()
    );

    this.activeHorrorEvent = {
      id: evt.id,
      type: evt.type,
      title: evt.title,
      detail: evt.detail,
      intensity: evt.intensity,
      durationSec: evt.durationSec,
      remainingSec: evt.durationSec,
    };

    if (evt.type === 'flicker_lights') {
      this.flickerTimer = Math.max(this.flickerTimer, evt.durationSec);
      const nowMs = performance.now();
      if (nowMs - this.lastFlickerSoundAt > 1800) {
        this.lastFlickerSoundAt = nowMs;
        soundEngine.playPowerFlicker();
      }
    } else if (evt.type === 'shelf_drop') {
      const candidates = this.items.filter(
        (it) =>
          !it.isHeld &&
          it.body.position.y > 0.65 &&
          it.body.position.z < 4.7 &&
          !isPointInDeliveryZone(it.body.position.x, it.body.position.y, it.body.position.z)
      );
      if (candidates.length > 0) {
        const dropCount = evt.intensity > 0.72 ? Math.min(3, candidates.length) : Math.min(2, candidates.length);
        for (let i = 0; i < dropCount; i++) {
          const pickIdx = Math.floor(Math.random() * candidates.length);
          const target = candidates.splice(pickIdx, 1)[0];
          target.body.wakeUp();
          // Push outward from shelves/chillers into open walking aisles
          const pushDirX =
            target.body.position.x < -4.5
              ? 1
              : target.body.position.x > 4.5
              ? -1
              : target.body.position.x < 0
              ? target.body.position.x < -2.55
                ? -1
                : 1
              : target.body.position.x > 2.55
              ? 1
              : -1;
          target.body.velocity.set(
            pushDirX * (1.8 + Math.random() * 1.4),
            0.9 + Math.random() * 0.8,
            (Math.random() - 0.5) * 1.1
          );
          target.body.angularVelocity.set(
            (Math.random() - 0.5) * 8,
            (Math.random() - 0.5) * 8,
            (Math.random() - 0.5) * 8
          );
          this.spawnParticles(target.mesh.position, 8, 0x94a3b8, 1.8);
        }
      }
      soundEngine.playPoltergeistDrop();
      this.flickerTimer = Math.max(this.flickerTimer, 1.2);
    } else if (evt.type === 'aisle_shadow') {
      const routes: Array<[THREE.Vector3, THREE.Vector3]> = [
        [new THREE.Vector3(-4.4, 0.08, 4.4), new THREE.Vector3(-4.4, 0.08, -1.8)],
        [new THREE.Vector3(4.4, 0.08, -1.8), new THREE.Vector3(4.4, 0.08, 4.4)],
        [new THREE.Vector3(-4.8, 0.08, 4.35), new THREE.Vector3(4.8, 0.08, 4.35)],
        [new THREE.Vector3(-1.4, 0.08, 5.5), new THREE.Vector3(1.4, 0.08, 5.5)],
      ];
      const [start, end] = routes[Math.floor(Math.random() * routes.length)];
      this.shadowStartPos.copy(start);
      this.shadowEndPos.copy(end);
      this.shadowElapsed = 0;
      this.shadowDuration = evt.durationSec;
      this.aisleShadowMesh.position.copy(start);
      this.aisleShadowMesh.visible = true;
      soundEngine.playShadowWhisper();
      this.spawnParticles(start.clone().setY(1.2), 10, 0x38bdf8, 1.4);
    } else if (evt.type === 'freezer_slam') {
      this.cameraTrauma = Math.min(1, this.cameraTrauma + 0.34 * evt.intensity);
      this.flickerTimer = Math.max(this.flickerTimer, 2.1);
      soundEngine.playFreezerSlam();
      this.spawnParticles(new THREE.Vector3(0, 1.2, 5.2), 14, 0xbae6fd, 2.4);
    }

    this.pushHudState(true);
  }

  private updateHorrorEvents(dt: number, elapsed: number) {
    if (this.phase !== 'playing') return;

    if (this.activeHorrorEvent) {
      this.activeHorrorEvent.remainingSec -= dt;
      if (this.activeHorrorEvent.remainingSec <= 0) {
        this.activeHorrorEvent = null;
        this.pushHudState(true);
      }
    }

    // Smoothly thicken fog during freezer slams / shadows, then restore baseline
    if (this.scene.fog instanceof THREE.FogExp2) {
      const threat = computeHorrorThreatLevel(this.reputation, this.shiftSeconds, this.nightNumber).threat;
      const baseFog = 0.026 + threat * 0.008;
      const targetFog =
        this.activeHorrorEvent?.type === 'freezer_slam' ||
        this.activeHorrorEvent?.type === 'aisle_shadow'
          ? baseFog + 0.018
          : baseFog;
      this.scene.fog.density = THREE.MathUtils.lerp(
        this.scene.fog.density,
        targetFog,
        1 - Math.exp(-3.5 * dt)
      );
    }

    // Update gliding aisle shadow silhouette
    if (this.aisleShadowMesh.visible && this.shadowDuration > 0) {
      this.shadowElapsed += dt;
      const t = Math.min(1, this.shadowElapsed / this.shadowDuration);
      this.aisleShadowMesh.position.lerpVectors(this.shadowStartPos, this.shadowEndPos, t);
      this.aisleShadowMesh.position.y = 0.08 + Math.sin(elapsed * 7.5) * 0.04;
      _vec3A.subVectors(this.shadowEndPos, this.shadowStartPos);
      if (_vec3A.lengthSq() > 0.001) {
        this.aisleShadowMesh.rotation.y = Math.atan2(_vec3A.x, _vec3A.z);
      }
      if (t >= 1) {
        this.aisleShadowMesh.visible = false;
        this.shadowDuration = 0;
      }
    }

    // Count down to next random horror environmental event (accelerated by low rep & late hour)
    if (!this.nightCompleteTriggered && !this.activeHorrorEvent) {
      this.horrorEventTimer -= dt;
      if (this.horrorEventTimer <= 0) {
        this.triggerHorrorEvent();
        this.horrorEventTimer = computeNextHorrorIntervalSec(
          this.reputation,
          this.shiftSeconds,
          this.nightNumber
        );
      }
    }
  }

  private updateNpc(dt: number, elapsed: number) {
    if (!this.activeNpc || !this.npcGroup) {
      if (this.phase === 'playing' && this.allowAutoNpcSpawn && !this.nightCompleteTriggered) {
        this.nextNpcTimer -= dt;
        if (this.nextNpcTimer <= 0) {
          this.spawnNextStoryNpc();
        }
      }
      return;
    }

    const parts = this.npcGroup.userData.animParts as {
      legL: THREE.Object3D;
      legR: THREE.Object3D;
      kneeL?: THREE.Object3D;
      kneeR?: THREE.Object3D;
      armLPivot: THREE.Object3D;
      armRPivot: THREE.Object3D;
      elbowL?: THREE.Object3D;
      elbowR?: THREE.Object3D;
      torsoGroup?: THREE.Object3D;
      headGroup: THREE.Object3D;
      mouth?: THREE.Object3D;
    };

    const speaking = voiceEngine.getSpeakingState();
    const isNpcTalking = speaking.active && speaking.kind === 'npc';
    if (parts.mouth) {
      parts.mouth.scale.y = isNpcTalking ? 1.0 + Math.abs(Math.sin(elapsed * 22)) * 2.1 : 1.0;
    }

    if (this.npcStatus === 'approaching') {
      // Walk in via automatic door (0, 0, -6.0) then over to Checkout customer side (-3.45, 0, -4.65)
      if (this.npcPos.z < -6.1) {
        _vec3A.set(0, 0, -5.8);
      } else {
        _vec3A.set(this.npcTargetX, 0, this.npcTargetZ);
      }
      _vec3B.subVectors(_vec3A, this.npcPos);
      const dist = _vec3B.length();
      if (dist > 0.14) {
        _vec3B.normalize();
        const step = Math.min(dist, dt * 3.5);
        this.npcPos.addScaledVector(_vec3B, step);
        this.npcWalkPhase += step * 5.2;
        this.npcGroup.rotation.y = Math.atan2(_vec3B.x, _vec3B.z);
        const swing = Math.sin(this.npcWalkPhase) * 0.48;
        parts.legL.rotation.x = swing;
        parts.legR.rotation.x = -swing;
        if (parts.kneeL) parts.kneeL.rotation.x = Math.max(0, -swing * 0.85);
        if (parts.kneeR) parts.kneeR.rotation.x = Math.max(0, swing * 0.85);
        parts.armLPivot.rotation.x = -swing * 0.65;
        parts.armRPivot.rotation.x = swing * 0.65;
        if (parts.elbowL) parts.elbowL.rotation.x = -0.35 - Math.max(0, swing * 0.3);
        if (parts.elbowR) parts.elbowR.rotation.x = -0.35 - Math.max(0, -swing * 0.3);
        if (parts.torsoGroup) {
          parts.torsoGroup.position.y = 0.84 + Math.abs(Math.sin(this.npcWalkPhase)) * 0.025;
        }
      } else {
        this.npcPos.set(this.npcTargetX, 0, this.npcTargetZ);
        this.npcGroup.rotation.y = 0; // Face +Z toward Checkout Counter
        parts.legL.rotation.x = 0;
        parts.legR.rotation.x = 0;
        if (parts.kneeL) parts.kneeL.rotation.x = 0;
        if (parts.kneeR) parts.kneeR.rotation.x = 0;
        parts.armLPivot.rotation.x = 0;
        parts.armRPivot.rotation.x = 0;
        if (parts.elbowL) parts.elbowL.rotation.x = -0.18;
        if (parts.elbowR) parts.elbowR.rotation.x = -0.22;
        if (parts.torsoGroup) parts.torsoGroup.position.y = 0.84;
        this.npcStatus = 'waiting';
        this.callbacks.onNpcEvent?.('waiting', this.activeNpc);
        if (this.allowAutoNpcSpawn) {
          this.callbacks.onSyncNpcStatus?.('waiting');
        }
        this.pushHudState(true);
      }
      this.npcGroup.position.copy(this.npcPos);
    } else if (this.npcStatus === 'waiting') {
      const dx = this.playerPos.x - this.npcPos.x;
      const dz = this.playerPos.z - this.npcPos.z;
      const lookYaw = Math.atan2(dx, dz) - this.npcGroup.rotation.y;
      parts.headGroup.rotation.y = THREE.MathUtils.clamp(lookYaw, -0.55, 0.55);
      parts.headGroup.rotation.x =
        Math.sin(elapsed * (isNpcTalking ? 7.2 : 3.1)) * (isNpcTalking ? 0.08 : 0.04);
      parts.armLPivot.rotation.x = -0.14 + Math.sin(elapsed * 2.2) * 0.09;
      parts.armRPivot.rotation.x = -0.22 + Math.cos(elapsed * 2.5) * 0.12;
      if (parts.elbowL) parts.elbowL.rotation.x = -0.25 + Math.sin(elapsed * 2.2) * 0.08;
      if (parts.elbowR) {
        parts.elbowR.rotation.x = isNpcTalking ? -0.58 + Math.sin(elapsed * 5.2) * 0.16 : -0.32;
      }
      if (parts.torsoGroup) parts.torsoGroup.position.y = 0.84 + Math.sin(elapsed * 2.1) * 0.01;

      if (this.activeNpc.canAttack) {
        this.npcWaitTimer += dt;
        const delay =
          (this.activeNpc.attackDelaySec ?? 12) + (this.upgrades.includes('alarma_ruta') ? 6 : 0);
        if (
          this.upgrades.includes('alarma_ruta') &&
          !this.alarmPlayedForNpc &&
          this.npcWaitTimer >= Math.max(2, delay - 3.5)
        ) {
          this.alarmPlayedForNpc = true;
          soundEngine.playAlarmWarning();
        }
        if (this.npcWaitTimer >= delay) {
          this.npcStatus = 'attacking';
          this.npcAttackTimer = 0;
          soundEngine.playAlarmWarning();
          this.callbacks.onNpcEvent?.('attacking', this.activeNpc);
          if (this.allowAutoNpcSpawn) {
            this.callbacks.onSyncNpcStatus?.('attacking');
          }
          this.pushHudState(true);
        }
      }
    } else if (this.npcStatus === 'attacking') {
      this.npcAttackTimer += dt;
      this.npcPos.z = THREE.MathUtils.lerp(this.npcPos.z, -4.15, 1 - Math.exp(-5 * dt));
      this.npcGroup.position.set(
        this.npcPos.x + Math.sin(elapsed * 26) * 0.04,
        Math.abs(Math.sin(elapsed * 12)) * 0.06,
        this.npcPos.z
      );
      this.npcGroup.rotation.y = Math.sin(elapsed * 10) * 0.18;
      parts.armLPivot.rotation.x = -1.35 + Math.sin(elapsed * 18) * 0.35;
      parts.armRPivot.rotation.x = -1.35 + Math.cos(elapsed * 18) * 0.35;
      if (parts.elbowL) parts.elbowL.rotation.x = -0.35;
      if (parts.elbowR) parts.elbowR.rotation.x = -0.35;

      if (this.npcAttackTimer >= 9.0 && this.allowAutoNpcSpawn) {
        this.cash = Math.max(0, this.cash - 500);
        this.reputation = Math.max(0, this.reputation - 15);
        this.nightServed += 1;
        this.cameraTrauma = Math.min(1, this.cameraTrauma + 0.85);
        this.npcStatus = 'scared';
        this.callbacks.onNpcEvent?.('scared', this.activeNpc);
        this.callbacks.onSyncNpcStatus?.('scared', -15);
        if (this.reputation <= 0 && this.phase === 'playing') {
          this.phase = 'gameover';
          this.callbacks.onGameOver?.();
        }
        this.pushHudState(true);
      }
    } else if (this.npcStatus === 'leaving' || this.npcStatus === 'scared') {
      const speed = this.npcStatus === 'scared' ? 5.2 : 3.4;
      if (this.npcPos.z > -5.9) {
        _vec3A.set(0, 0, -6.2);
      } else {
        _vec3A.set(4.5, 0, -11.5);
      }
      _vec3B.subVectors(_vec3A, this.npcPos);
      const dist = _vec3B.length();
      if (dist > 0.35 && this.npcPos.z > -10.8) {
        _vec3B.normalize();
        const step = dt * speed;
        this.npcPos.addScaledVector(_vec3B, step);
        this.npcWalkPhase += step * 5.5;
        this.npcGroup.rotation.y = Math.atan2(_vec3B.x, _vec3B.z);
        const swing = Math.sin(this.npcWalkPhase) * 0.55;
        parts.legL.rotation.x = swing;
        parts.legR.rotation.x = -swing;
        if (parts.kneeL) parts.kneeL.rotation.x = Math.max(0, -swing * 0.85);
        if (parts.kneeR) parts.kneeR.rotation.x = Math.max(0, swing * 0.85);
        if (parts.elbowL) parts.elbowL.rotation.x = -0.32;
        if (parts.elbowR) parts.elbowR.rotation.x = -0.32;
        this.npcGroup.position.copy(this.npcPos);
      } else {
        this.clearCurrentNpc();
        if (this.allowAutoNpcSpawn) {
          this.callbacks.onSyncNpcStatus?.('none');
        }
        this.nextNpcTimer = 2.2;
        this.pushHudState(true);
      }
    }
  }

  private updateParticles(dt: number) {
    let anyDirty = false;
    for (let i = 0; i < PARTICLE_POOL_SIZE; i++) {
      const p = this.particles[i];
      if (!p.active) continue;
      anyDirty = true;
      p.age += dt;
      if (p.age >= p.maxAge) {
        p.active = false;
        _mat4.makeScale(0, 0, 0);
        this.particleMesh.setMatrixAt(i, _mat4);
        continue;
      }
      p.vel.y -= 6.5 * dt;
      p.pos.addScaledVector(p.vel, dt);
      const s = p.scale * (1 - p.age / p.maxAge);
      _mat4.makeTranslation(p.pos.x, p.pos.y, p.pos.z);
      _mat4.scale(_vec3A.set(s, s, s));
      this.particleMesh.setMatrixAt(i, _mat4);
    }
    if (anyDirty) {
      this.particleMesh.instanceMatrix.needsUpdate = true;
    }
  }

  private tick = () => {
    if (this.disposed) return;

    const now = performance.now();
    const rawDt = (now - this.lastTime) / 1000;
    this.lastTime = now;
    const dt = Math.min(Math.max(rawDt, 0.001), this.isSoftwareGl ? 0.12 : 0.05);
    const elapsed = now * 0.001;

    this.env.updatePassingTruck(dt);
    this.env.updateAmbientMotes(elapsed);

    if (this.customModelMixer) {
      this.customModelMixer.update(dt);
    }

    // Local co-worker idle OR live online remote friends animation
    if (this.remotePeers.size === 0) {
      this.friendGroup.position.y = 0.07 + Math.sin(elapsed * 2.1) * 0.01;
      const friendParts = this.friendGroup.userData.animParts as {
        headGroup: THREE.Object3D;
        mouth?: THREE.Object3D;
      };
      if (friendParts?.headGroup && !this.customModelGroup) {
        friendParts.headGroup.rotation.y = Math.sin(elapsed * 0.9) * 0.2;
      }
      if (friendParts?.mouth) {
        const sp = voiceEngine.getSpeakingState();
        const friendTalking = sp.active && sp.kind === 'friend';
        friendParts.mouth.scale.y = friendTalking
          ? 1.0 + Math.abs(Math.sin(elapsed * 20)) * 2.0
          : 1.0;
      }
    } else {
      const lerpAlpha = 1 - Math.exp(-14 * dt);
      for (const actor of this.remotePeers.values()) {
        const distMoved = Math.hypot(
          actor.targetPos.x - actor.mesh.position.x,
          actor.targetPos.z - actor.mesh.position.z
        );
        actor.mesh.position.lerp(actor.targetPos, lerpAlpha);
        const desiredRotY = actor.targetYaw + Math.PI;
        let diff = desiredRotY - actor.mesh.rotation.y;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        actor.mesh.rotation.y += diff * lerpAlpha;

        const parts = actor.mesh.userData.animParts as {
          legL: THREE.Object3D;
          legR: THREE.Object3D;
          kneeL?: THREE.Object3D;
          kneeR?: THREE.Object3D;
          armLPivot: THREE.Object3D;
          armRPivot: THREE.Object3D;
          elbowL?: THREE.Object3D;
          elbowR?: THREE.Object3D;
        };
        if (distMoved > 0.015) {
          actor.walkPhase += Math.min(0.45, distMoved * 6.5);
          const swing = Math.sin(actor.walkPhase) * 0.52;
          parts.legL.rotation.x = swing;
          parts.legR.rotation.x = -swing;
          if (parts.kneeL) parts.kneeL.rotation.x = Math.max(0, -swing * 0.85);
          if (parts.kneeR) parts.kneeR.rotation.x = Math.max(0, swing * 0.85);
          parts.armLPivot.rotation.x = -swing * 0.65;
          parts.armRPivot.rotation.x = actor.heldProductId ? -0.55 : swing * 0.65;
          if (parts.elbowR) parts.elbowR.rotation.x = actor.heldProductId ? -0.65 : -0.3;
        } else {
          parts.legL.rotation.x *= 0.82;
          parts.legR.rotation.x *= 0.82;
          if (parts.kneeL) parts.kneeL.rotation.x *= 0.82;
          if (parts.kneeR) parts.kneeR.rotation.x *= 0.82;
          parts.armLPivot.rotation.x *= 0.82;
          parts.armRPivot.rotation.x = actor.heldProductId ? -0.55 : parts.armRPivot.rotation.x * 0.82;
        }
      }
    }

    if (this.phase === 'title') {
      this.titleOrbitAngle += dt * 0.1;
      const camX = 0.4 + Math.sin(this.titleOrbitAngle) * 5.2;
      const camZ = -10.2 + Math.cos(this.titleOrbitAngle) * 1.6;
      this.camera.position.set(camX, 2.35, camZ);
      this.camera.lookAt(0, 1.9, -4.5);
    } else if (this.phase === 'intro') {
      this.introTime += dt;
      const t = Math.min(1, this.introTime / 14);
      const camX = THREE.MathUtils.lerp(-5.2, 0.0, t);
      const camY = THREE.MathUtils.lerp(2.6, 1.85, t);
      const camZ = THREE.MathUtils.lerp(-10.5, 1.8, t);
      this.camera.position.set(camX, camY, camZ);
      this.camera.lookAt(0, 1.5, -3.5);
    } else if (this.phase === 'tutorial') {
      this.camera.position.set(this.playerPos.x, this.playerPos.y, this.playerPos.z);
      this.camera.rotation.set(this.playerPitch, this.playerYaw, 0, 'YXZ');
    } else if (this.phase === 'playing') {
      if (this.hitstopTimer > 0) {
        this.hitstopTimer = Math.max(0, this.hitstopTimer - dt);
      } else {
        // Night shift runs from 00:00 AM -> 03:00 AM (180 mins at 1.65 min/sec ≈ 109 sec per shift)
        this.shiftSeconds += dt * 1.65;
        this.updateRestockAndFlicker(dt, elapsed);

        const clock = formatShiftClock(this.shiftSeconds);
        if (clock.isShiftComplete && !this.nightCompleteTriggered && this.phase === 'playing') {
          this.nightCompleteTriggered = true;
          soundEngine.playShiftBell3AM();
          this.cash += 1500;
          this.callbacks.onNightComplete?.(this.nightNumber);
          this.pushHudState(true);
        }

        // Dynamic horror supermarket soundscape
        if (now - this.lastAmbientUpdate > 250) {
          this.lastAmbientUpdate = now;
          const zone = getPlayerZoneLabel(this.playerPos.x, this.playerPos.z);
          const isIndoors = zone !== 'Estacionamiento Oscuro';
          const critCount = this.restockZones.filter((z) => z.isCritical).length;
          const amb = soundEngine.updateAmbient(this.shiftSeconds, isIndoors, true, critCount);
          this.ambientLabel = amb.label;
        }

        const tuning = SENSITIVITY_PRESETS[this.sensitivityPreset] ?? SENSITIVITY_PRESETS.alta;
        const moveDt = Math.min(Math.max(rawDt, 0.001), 0.14);
        const curvedJoy = applyJoystickResponse(
          this.analogMoveX,
          this.analogMoveZ,
          this.sensitivityPreset
        );
        let moveX = curvedJoy.x;
        let moveZ = curvedJoy.z;
        if (this.keysHeld.has('KeyW')) moveZ -= 1;
        if (this.keysHeld.has('KeyS')) moveZ += 1;
        if (this.keysHeld.has('KeyA')) moveX -= 1;
        if (this.keysHeld.has('KeyD')) moveX += 1;

        if (this.keysHeld.has('ArrowLeft')) this.targetYaw += moveDt * 2.9 * tuning.lookScale;
        if (this.keysHeld.has('ArrowRight')) this.targetYaw -= moveDt * 2.9 * tuning.lookScale;
        if (this.keysHeld.has('ArrowUp')) {
          this.targetPitch = THREE.MathUtils.clamp(
            this.targetPitch + moveDt * 2.15 * tuning.lookScale,
            -1.05,
            0.72
          );
        }
        if (this.keysHeld.has('ArrowDown')) {
          this.targetPitch = THREE.MathUtils.clamp(
            this.targetPitch - moveDt * 2.15 * tuning.lookScale,
            -1.05,
            0.72
          );
        }

        const rawMag = Math.hypot(moveX, moveZ);
        if (rawMag > 0.03) {
          const clampedMag = Math.min(1, rawMag);
          moveX = (moveX / rawMag) * clampedMag;
          moveZ = (moveZ / rawMag) * clampedMag;
          const speed = tuning.walkSpeed;
          const sinY = Math.sin(this.playerYaw);
          const cosY = Math.cos(this.playerYaw);
          const worldDx = (moveX * cosY + moveZ * sinY) * speed * moveDt;
          const worldDz = (-moveX * sinY + moveZ * cosY) * speed * moveDt;
          const resolved = resolvePlayerMapPosition(
            this.playerPos.x + worldDx,
            this.playerPos.z + worldDz
          );
          this.playerPos.x = resolved.x;
          this.playerPos.z = resolved.z;
        }

        const dampFactor = 1 - Math.exp(-26 * dt);
        this.playerYaw += (this.targetYaw - this.playerYaw) * dampFactor;
        this.playerPitch += (this.targetPitch - this.playerPitch) * dampFactor;

        this.camera.position.copy(this.playerPos);
        this.camera.rotation.order = 'YXZ';
        const shakeX = (Math.random() - 0.5) * this.cameraTrauma * this.cameraTrauma * 0.08;
        const shakeY = (Math.random() - 0.5) * this.cameraTrauma * this.cameraTrauma * 0.08;
        this.camera.rotation.set(this.playerPitch + shakeY, this.playerYaw + shakeX, 0, 'YXZ');
        this.cameraTrauma = Math.max(0, this.cameraTrauma - dt * 2.2);

        this.callbacks.onLocalPose?.(
          this.playerPos.x,
          0.07,
          this.playerPos.z,
          this.playerYaw,
          this.heldItem ? this.heldItem.productId : null
        );

        if (this.heldItem) {
          _vec3A
            .set(0.24, -0.16, -0.82)
            .applyQuaternion(this.camera.quaternion)
            .add(this.camera.position);
          const bx = this.heldItem.body.position;
          bx.set(
            THREE.MathUtils.lerp(bx.x, _vec3A.x, 1 - Math.exp(-18 * dt)),
            THREE.MathUtils.lerp(bx.y, _vec3A.y, 1 - Math.exp(-18 * dt)),
            THREE.MathUtils.lerp(bx.z, _vec3A.z, 1 - Math.exp(-18 * dt))
          );
          this.heldItem.body.quaternion.set(0, 0, 0, 1);
        }

        this.world.step(1 / 60, dt, this.isSoftwareGl ? 8 : 3);

        for (const item of this.items) {
          item.mesh.position.set(
            item.body.position.x,
            item.body.position.y,
            item.body.position.z
          );
          item.mesh.quaternion.set(
            item.body.quaternion.x,
            item.body.quaternion.y,
            item.body.quaternion.z,
            item.body.quaternion.w
          );
        }

        this.updateNpc(dt, elapsed);

        if (this.hasPointerPos) {
          this.updateRaycast(this.pointerClientX, this.pointerClientY);
        }
      }

      if (this.weaponRecoil > 0) {
        this.weaponRecoil = Math.max(0, this.weaponRecoil - dt * 5.5);
        this.viewWeaponMesh.position.z = -0.45 + this.weaponRecoil * 0.14;
        this.viewWeaponMesh.rotation.x = this.weaponRecoil * 0.35;
      }
      if (this.muzzleFlashTimer > 0) {
        this.muzzleFlashTimer -= dt;
        if (this.muzzleFlashTimer <= 0) {
          this.muzzleFlashLight.intensity = 0;
        }
      }

      for (const [sid, prop] of this.secretProps.entries()) {
        if (!this.discoveredSecrets.has(sid)) {
          const pulse = 1 + Math.sin(elapsed * 3.8) * 0.12;
          prop.beacon.scale.set(pulse, pulse, 1);
          prop.glowOrb.position.y = 1.05 + Math.sin(elapsed * 3.2) * 0.1;
          prop.glowOrb.rotation.y = elapsed * 1.8;
        }
      }

      // Update floating 3D Mission Beacon: urgent restock shelf, held item target, or active NPC item
      const urgentZone = this.getUrgentRestockZone();
      if (this.heldItem) {
        const matchZone = this.restockZones.find(
          (z) => z.needsRestock && z.acceptedProducts.includes(this.heldItem!.productId)
        );
        if (matchZone) {
          this.env.missionBeacon.visible = true;
          this.env.missionBeacon.position.set(
            matchZone.pos[0],
            2.25 + Math.sin(elapsed * 4) * 0.08,
            matchZone.pos[2]
          );
          this.env.missionBeacon.rotation.y = elapsed * 2.4;
        } else {
          this.env.missionBeacon.visible = true;
          this.env.missionBeacon.position.set(
            -3.45,
            1.62 + Math.sin(elapsed * 4) * 0.08,
            -3.4
          );
          this.env.missionBeacon.rotation.y = elapsed * 2.1;
        }
      } else if (urgentZone) {
        const sampleProd = urgentZone.acceptedProducts[0];
        const reserveSpot = this.env.shelfSpots[sampleProd]?.[2];
        if (reserveSpot) {
          this.env.missionBeacon.visible = true;
          this.env.missionBeacon.position.set(
            reserveSpot.x,
            2.28 + Math.sin(elapsed * 4.5) * 0.08,
            reserveSpot.z
          );
          this.env.missionBeacon.rotation.y = elapsed * 2.6;
        } else {
          this.env.missionBeacon.visible = false;
        }
      } else if (this.activeNpc && this.npcStatus === 'waiting') {
        const evalNow = evaluateCounterOrder(this.activeNpc.items, this.getCounterSnapshots());
        const nextReq = evalNow.requested.find((r) => r.placed < r.needed);
        if (nextReq) {
          const mp = PRODUCT_LOCATIONS[nextReq.productId].markerPos;
          this.env.missionBeacon.visible = true;
          this.env.missionBeacon.position.set(mp[0], mp[1] + Math.sin(elapsed * 4) * 0.08, mp[2]);
          this.env.missionBeacon.rotation.y = elapsed * 2.1;
        } else {
          this.env.missionBeacon.visible = true;
          this.env.missionBeacon.position.set(-2.12, 1.85 + Math.sin(elapsed * 4) * 0.08, -3.55);
          this.env.missionBeacon.rotation.y = elapsed * 2.1;
        }
      } else {
        this.env.missionBeacon.visible = false;
      }
    }

    this.updateParticles(dt);
    if (this.composer) {
      this.composer.render();
    } else {
      this.renderer.render(this.scene, this.camera);
    }

    if (this.phase === 'playing' && now - this.lastHudPush > 120) {
      this.pushHudState(false);
    }

    if (this.isSoftwareGl) {
      this.afterDraw(this.tick);
    } else {
      this.frameId = requestAnimationFrame(this.tick);
    }
  };

  private getUrgentRestockZone(): RestockZoneState | null {
    let worst: RestockZoneState | null = null;
    for (const z of this.restockZones) {
      if (z.needsRestock && (!worst || z.stockPercent < worst.stockPercent)) {
        worst = z;
      }
    }
    return worst;
  }

  private afterDraw(cb: () => void) {
    const gl = this.renderer.getContext() as WebGL2RenderingContext;
    const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
    gl.flush();
    const poll = () => {
      if (this.disposed) return;
      const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
      if (state === gl.UNSIGNALED) {
        this.frameId = window.setTimeout(poll, 5);
      } else {
        if (sync) gl.deleteSync(sync);
        this.frameId = window.setTimeout(cb, 25);
      }
    };
    this.frameId = window.setTimeout(poll, 5);
  }

  public pushHudState(force: boolean) {
    const now = performance.now();
    if (!force && now - this.lastHudPush < 100) return;
    this.lastHudPush = now;

    const clock = formatShiftClock(this.shiftSeconds);
    const urgentZone = this.getUrgentRestockZone();
    const criticalCount = this.restockZones.filter((z) => z.isCritical).length;

    const counterItems = this.getCounterSnapshots();
    const orderEval = this.activeNpc
      ? evaluateCounterOrder(this.activeNpc.items, counterItems)
      : null;

    let dialogueLine = '';
    let friendLine = '';
    if (this.activeNpc) {
      if (this.npcStatus === 'approaching') {
        dialogueLine = 'Se abrió la puerta automática del súper en la oscuridad...';
        friendLine = `${this.profile.friendName}: "Che ${this.profile.playerName}, alguien entró desde el playón."`;
      } else if (this.npcStatus === 'waiting') {
        dialogueLine = this.activeNpc.greeting;
        friendLine = `${this.profile.friendName}: "${this.activeNpc.friendComment}"`;
      } else if (this.npcStatus === 'attacking') {
        dialogueLine = '¡Viene directo hacia la caja! ¡Defiendan el turno!';
        friendLine = `${this.profile.friendName}: "¡${this.profile.playerName}, tocá ARMA y DISPARÁ ya!"`;
      } else if (this.npcStatus === 'leaving') {
        dialogueLine = this.activeNpc.thanksLine;
        friendLine = `${this.profile.friendName}: "Bien ahí, seguí vigilando las góndolas hasta las 3."`;
      } else if (this.npcStatus === 'scared') {
        dialogueLine = getNpcScaredLine(this.activeNpc);
        friendLine = this.activeNpc.isSuspicious
          ? `${this.profile.friendName}: "¡Qué susto! Volvamos a reponer las heladeras."`
          : `${this.profile.friendName}: "¡Pará loco, era un cliente común!"`;
      }
    } else if (urgentZone) {
      dialogueLine = `¡Alerta en ${urgentZone.shortLabel}! Faltan ${urgentZone.acceptedProducts
        .map((id) => PRODUCT_CATALOG[id].shortName)
        .join(' o ')}.`;
      friendLine = `${this.profile.friendName}: "Buscá en el Depósito de atrás antes que se apague la luz."`;
    } else {
      dialogueLine = 'Pasillos fríos en silencio. Mantené llenas las heladeras hasta las 03:00 AM.';
      friendLine = `${this.profile.friendName}: "Si parpadean los tubos, corré a reponer, ${this.profile.playerName}."`;
    }

    const nearbySecret = this.findNearestUndiscoveredSecret(2.8);
    const activeSecretTarget =
      this.hoveredTarget === 'secret' && this.hoveredSecretId
        ? SECRET_EVENTS.find((s) => s.id === this.hoveredSecretId) ?? null
        : nearbySecret;

    let hoveredLabel: string | null = null;
    let hoveredPrice: number | null = null;
    let hoveredHint: string | null = null;
    let hoveredTargetType: HudStateSnapshot['hoveredTargetType'] = this.hoveredTarget;

    if (this.heldItem) {
      const def = PRODUCT_CATALOG[this.heldItem.productId];
      const matchRestock = this.findMatchingRestockZoneForHeld(this.heldItem.productId);
      hoveredLabel = def.name;
      hoveredPrice = def.price;
      hoveredHint = matchRestock
        ? `Tocá Reponer para llenar ${matchRestock.shortLabel}`
        : 'Llevalo a la Caja o a su Góndola / Heladera';
    } else if (activeSecretTarget && !this.discoveredSecrets.has(activeSecretTarget.id)) {
      hoveredTargetType = 'secret';
      hoveredLabel = activeSecretTarget.title;
      hoveredHint = 'Tocá Agarrar para investigar esta pista';
    } else if (this.hoveredTarget === 'item' && this.hoveredItem) {
      const def = PRODUCT_CATALOG[this.hoveredItem.productId];
      hoveredLabel = def.name;
      hoveredPrice = def.price;
      hoveredHint = 'Tocá Agarrar para llevarlo';
    } else if (this.hoveredTarget === 'restock_zone' && this.hoveredRestockZoneId) {
      const rz = this.restockZones.find((z) => z.id === this.hoveredRestockZoneId);
      if (rz) {
        hoveredLabel = `${rz.shortLabel} (${Math.round(rz.stockPercent)}%)`;
        hoveredHint = `Acepta: ${rz.acceptedProducts
          .map((id) => PRODUCT_CATALOG[id].shortName)
          .join(' / ')}`;
      }
    } else if (this.hoveredTarget === 'register') {
      hoveredLabel = 'Caja Registradora 1';
      hoveredHint = 'Tocá Cobrar para atender al cliente';
    } else if (this.hoveredTarget === 'weapon') {
      hoveredLabel = 'Escopeta abajo de la caja';
      hoveredHint = 'Tocá Arma solo si una entidad ataca';
    } else if (this.hoveredTarget === 'counter_zone') {
      hoveredLabel = 'Caja 1 (Zona de Entrega)';
      hoveredHint = 'Dejá acá el pedido del cliente';
    }

    const zone = getPlayerZoneLabel(this.playerPos.x, this.playerPos.z);
    const isIndoors = zone !== 'Estacionamiento Oscuro';
    const ambientLabel = computeAmbientAudioParams(
      this.shiftSeconds,
      isIndoors,
      criticalCount
    ).label;
    const chapter = getNightChapter(this.nightNumber);
    const threatLevel = computeHorrorThreatLevel(
      this.reputation,
      this.shiftSeconds,
      this.nightNumber
    ).threat;

    this.callbacks.onHudUpdate({
      phase: this.phase,
      cash: this.cash,
      customersServed: this.customersServed,
      reputation: this.reputation,
      nightNumber: this.nightNumber,
      nightTitle: chapter.title,
      nightServed: this.nightServed,
      nightTarget: chapter.targetClients,
      upgrades: [...this.upgrades],
      discoveredSecrets: Array.from(this.discoveredSecrets),
      shiftTimeLabel: clock.timeLabel,
      shiftProgressPercent: clock.progressPercent,
      shiftMinutes: clock.shiftMinutes,
      restockedCount: this.restockedCount,
      restockZones: this.restockZones.map((z) => ({ ...z })),
      urgentRestockZone: urgentZone ? { ...urgentZone } : null,
      flickerAlert: this.flickerAlert,
      horrorThreatLevel: threatLevel,
      activeHorrorEvent: this.activeHorrorEvent
        ? {
            id: this.activeHorrorEvent.id,
            type: this.activeHorrorEvent.type,
            title: this.activeHorrorEvent.title,
            detail: this.activeHorrorEvent.detail,
            intensity: this.activeHorrorEvent.intensity,
          }
        : null,
      ambientLabel,
      weaponEquipped: this.weaponEquipped,
      weaponVisible: !this.underCounterWeaponMesh.visible,
      flashlightOn: this.flashlightOn,
      playerZone: zone,
      hoveredLabel,
      hoveredPrice,
      hoveredHint,
      hoveredTargetType,
      heldItemLabel: this.heldItem ? PRODUCT_CATALOG[this.heldItem.productId].name : null,
      heldProductId: this.heldItem ? this.heldItem.productId : null,
      counterItemCount: counterItems.filter((c) => isPointInDeliveryZone(c.x, c.y, c.z)).length,
      activeNpc: this.activeNpc,
      npcStatus: this.npcStatus,
      dialogueLine,
      friendLine,
      orderEval,
    });
  }

  public dispose() {
    this.disposed = true;
    soundEngine.stopAmbient();
    cancelAnimationFrame(this.frameId);
    clearTimeout(this.frameId);
    this.resizeObserver.disconnect();
    this.unbindEvents();
    this.composer?.dispose();
    this.textures.dispose();
    this.renderer.dispose();
    if (this.renderer.domElement.parentElement === this.container) {
      this.container.removeChild(this.renderer.domElement);
    }
  }
}
