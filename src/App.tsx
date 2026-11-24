import { useCallback, useEffect, useRef, useState } from 'react';
import { CharacterModal } from './components/CharacterModal';
import { GameHUD } from './components/GameHUD';
import { IntroOverlay } from './components/IntroOverlay';
import { InventoryModal } from './components/InventoryModal';
import { NightSummaryModal } from './components/NightSummaryModal';
import { PauseModal } from './components/PauseModal';
import { PaymentModal } from './components/PaymentModal';
import { OfflineIndicator } from './components/PWAInstallButton';
import { TitleScreen } from './components/TitleScreen';
import { TutorialOverlay } from './components/TutorialOverlay';
import { KioscoEngine } from './game/KioscoEngine';
import { soundEngine } from './game/audio';
import { MultiplayerClient, type OnlineStateView } from './game/multiplayerClient';
import { voiceEngine, type SpeakingState } from './game/voiceEngine';
import {
  DEFAULT_ACTION_BUTTONS,
  DEFAULT_PLAYER_PROFILE,
  SENSITIVITY_PRESETS,
  createInitialRestockZones,
  createInitialSoldRecords,
  createInitialStock,
  getNpcScaredLine,
  normalizeGeminiEncounter,
  recordSaleToInventory,
  sanitizeActionButtonLayouts,
  sanitizeRoomCode,
} from './game/kioscoLogic';
import type {
  ActionButtonConfig,
  CustomizableButtonId,
  GamePhase,
  HudStateSnapshot,
  KioscoUpgradeId,
  PlayerProfile,
  ProductId,
  SecretEventDef,
  SensitivityPreset,
  SoldRecord,
} from './game/types';

const CONTROLS_STORAGE_KEY = 'kiosco_action_buttons_v2';
const SENSITIVITY_STORAGE_KEY = 'kiosco_sensitivity_v1';

type ActiveModal = 'none' | 'character' | 'inventory' | 'payment' | 'pause' | 'night_summary';

const INITIAL_HUD: HudStateSnapshot = {
  phase: 'title',
  cash: 4500,
  customersServed: 0,
  reputation: 90,
  nightNumber: 1,
  nightTitle: 'Noche 1 · Turno de Prueba (00:00 - 03:00 AM)',
  nightServed: 0,
  nightTarget: 3,
  upgrades: [],
  discoveredSecrets: [],
  shiftTimeLabel: '00:00 AM',
  shiftProgressPercent: 0,
  shiftMinutes: 0,
  restockedCount: 0,
  restockZones: createInitialRestockZones(),
  urgentRestockZone: null,
  flickerAlert: false,
  horrorThreatLevel: 0.1,
  activeHorrorEvent: null,
  ambientLabel: 'Súper de noche · Tubos y heladeras',
  weaponEquipped: false,
  weaponVisible: false,
  flashlightOn: true,
  playerZone: 'Pasillo Central · Góndolas',
  hoveredLabel: null,
  hoveredPrice: null,
  hoveredHint: null,
  hoveredTargetType: null,
  heldItemLabel: null,
  heldProductId: null,
  counterItemCount: 0,
  activeNpc: null,
  npcStatus: 'none',
  dialogueLine: '',
  friendLine: '',
  orderEval: null,
};

const INITIAL_ONLINE_STATE: OnlineStateView = {
  status: 'offline',
  roomCode: '',
  selfId: null,
  peers: [],
  messages: [],
  error: null,
};

export default function App() {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const engineRef = useRef<KioscoEngine | null>(null);
  const mpClientRef = useRef<MultiplayerClient | null>(null);

  const [phase, setPhase] = useState<GamePhase>(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('autostart') === '1' ? 'playing' : 'title';
  });
  const [activeModal, setActiveModal] = useState<ActiveModal>('none');
  const [profile, setProfile] = useState<PlayerProfile>(DEFAULT_PLAYER_PROFILE);
  const [sensitivity, setSensitivity] = useState<SensitivityPreset>(() => {
    try {
      const saved = localStorage.getItem(SENSITIVITY_STORAGE_KEY) as SensitivityPreset | null;
      if (saved && SENSITIVITY_PRESETS[saved]) return saved;
    } catch {
      // Ignore storage errors
    }
    return 'alta';
  });
  const [onlineState, setOnlineState] = useState<OnlineStateView>(INITIAL_ONLINE_STATE);
  const [stock, setStock] = useState<Record<ProductId, number>>(() => createInitialStock());
  const [sold, setSold] = useState<Record<ProductId, SoldRecord>>(() =>
    createInitialSoldRecords()
  );
  const [hud, setHud] = useState<HudStateSnapshot>(INITIAL_HUD);
  const [muted, setMuted] = useState(false);
  const [speaking, setSpeaking] = useState<SpeakingState>(() => voiceEngine.getSpeakingState());
  const [geminiLoading, setGeminiLoading] = useState(false);
  const [geminiError, setGeminiError] = useState<string | null>(null);
  const [secretToast, setSecretToast] = useState<{
    secret: SecretEventDef;
    byPlayerName?: string;
  } | null>(null);
  const [isPortrait, setIsPortrait] = useState(() =>
    typeof window !== 'undefined' ? window.innerHeight > window.innerWidth : false
  );
  const [isCompactHorizontal, setIsCompactHorizontal] = useState(() =>
    typeof window !== 'undefined'
      ? Math.max(window.innerWidth, window.innerHeight) < 1050 || window.innerHeight > window.innerWidth
      : false
  );
  const [actionButtons, setActionButtons] = useState<
    Record<CustomizableButtonId, ActionButtonConfig>
  >(() => {
    try {
      const saved = localStorage.getItem(CONTROLS_STORAGE_KEY);
      if (saved) return sanitizeActionButtonLayouts(JSON.parse(saved));
    } catch {
      // Ignore storage errors
    }
    return sanitizeActionButtonLayouts(DEFAULT_ACTION_BUTTONS);
  });

  const phaseRef = useRef(phase);
  phaseRef.current = phase;
  const activeModalRef = useRef(activeModal);
  activeModalRef.current = activeModal;
  const hudRef = useRef(hud);
  hudRef.current = hud;
  const profileRef = useRef(profile);
  profileRef.current = profile;
  const sensitivityRef = useRef(sensitivity);
  sensitivityRef.current = sensitivity;
  const onlineStateRef = useRef(onlineState);
  onlineStateRef.current = onlineState;
  const actionButtonsRef = useRef(actionButtons);
  actionButtonsRef.current = actionButtons;

  useEffect(() => {
    document.body.dataset.state = phase;
  }, [phase]);

  useEffect(() => {
    document.body.dataset.horrorEvent = hud.activeHorrorEvent?.type ?? 'none';
  }, [hud.activeHorrorEvent]);

  useEffect(() => {
    const checkOrientation = () => {
      const portrait = window.innerHeight > window.innerWidth;
      const longSide = Math.max(window.innerWidth, window.innerHeight);
      setIsPortrait(portrait);
      setIsCompactHorizontal(portrait || longSide < 1050);
      engineRef.current?.setLandscapeRotated(portrait);
    };
    checkOrientation();
    window.addEventListener('resize', checkOrientation);
    return () => window.removeEventListener('resize', checkOrientation);
  }, []);

  useEffect(() => {
    const unsub = voiceEngine.subscribe(setSpeaking);
    return unsub;
  }, []);

  useEffect(() => {
    if (!secretToast) return;
    const timer = window.setTimeout(() => setSecretToast(null), 6500);
    return () => window.clearTimeout(timer);
  }, [secretToast]);

  // Initialize real-time WebSocket co-op client & auto-join if ?sala=CODE is present
  useEffect(() => {
    const client = new MultiplayerClient(profileRef.current);
    mpClientRef.current = client;

    const unsubView = client.subscribe((view) => {
      setOnlineState(view);
      const engine = engineRef.current;
      if (engine) {
        engine.setRemotePeers(view.peers);
        if (view.status === 'connected' && view.selfId) {
          const allIds = [view.selfId, ...view.peers.map((p) => p.id)].sort();
          engine.setAllowAutoNpcSpawn(allIds[0] === view.selfId);
        } else {
          engine.setAllowAutoNpcSpawn(true);
        }
      }
    });

    const unsubServer = client.onServerMessage((msg) => {
      const engine = engineRef.current;
      if (msg.type === 'room:snapshot' || msg.type === 'shift:reset') {
        setStock(msg.snapshot.stock);
        setSold(msg.snapshot.sold);
        engine?.applyRemoteRoomSnapshot(msg.snapshot);
        if (msg.type === 'shift:reset') {
          setActiveModal((cur) => (cur === 'payment' ? 'none' : cur));
        }
      } else if (msg.type === 'npc:spawned') {
        engine?.spawnNpc(msg.encounter, false);
      } else if (msg.type === 'npc:status') {
        engine?.applyRemoteNpcStatus(msg.npcStatus, msg.reputation);
      } else if (msg.type === 'sale:completed') {
        setStock(msg.stock);
        setSold(msg.sold);
        if (msg.byPlayerId !== client.getView().selfId) {
          engine?.applyRemoteSaleCompleted(
            msg.cash,
            msg.customersServed,
            msg.nightServed,
            msg.reputation,
            msg.soldItems
          );
          setActiveModal((cur) => (cur === 'payment' ? 'none' : cur));
        }
      } else if (msg.type === 'stock:restocked') {
        setStock(msg.stock);
        if (msg.byPlayerId !== client.getView().selfId) {
          engine?.restockProduct(msg.productId, msg.count);
        }
      } else if (msg.type === 'shelves:organized') {
        if (msg.byPlayerId !== client.getView().selfId) {
          engine?.organizeShelves();
        }
      } else if (msg.type === 'secret:discovered') {
        engine?.applyRemoteSecretDiscovered(
          msg.secretId,
          msg.discoveredSecrets,
          msg.cash,
          msg.reputation,
          msg.byPlayerName
        );
      } else if (msg.type === 'upgrade:bought') {
        engine?.applyRemoteUpgrades(msg.upgrades, msg.cash);
      } else if (msg.type === 'night:advanced') {
        engine?.applyRemoteNightAdvanced(msg.nightNumber, msg.nightServed, msg.shiftSeconds);
        setActiveModal((cur) => (cur === 'night_summary' ? 'none' : cur));
        setPhase('playing');
        engine?.setPhase('playing');
      }
    });

    const params = new URLSearchParams(window.location.search);
    const roomFromUrl = params.get('sala');
    if (roomFromUrl) {
      client.connect(sanitizeRoomCode(roomFromUrl), profileRef.current);
    }

    return () => {
      unsubView();
      unsubServer();
      client.disconnect();
      mpClientRef.current = null;
    };
  }, []);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const engine = new KioscoEngine(container, profileRef.current, {
      onHudUpdate: (snapshot) => setHud(snapshot),
      onOpenPayment: () => {
        if (hudRef.current.activeNpc && hudRef.current.npcStatus === 'waiting') {
          setActiveModal('payment');
        }
      },
      onNpcEvent: (event, encounter) => {
        if (event === 'approaching') {
          voiceEngine.prefetchNpcArrival(encounter, profileRef.current.friendName);
        } else if (event === 'waiting') {
          voiceEngine.speakNpcArrival(encounter, profileRef.current.friendName);
        } else if (event === 'attacking') {
          voiceEngine.speakNpcLine(
            encounter,
            encounter.archetype === 'aparicion'
              ? '¡La luz se apaga! ¡Dame todo ahora!'
              : '¡Quietos ahí! ¡Esto es un asalto!',
            'scared'
          );
        } else if (event === 'leaving') {
          voiceEngine.speakNpcLine(encounter, encounter.thanksLine, 'normal');
        } else if (event === 'scared') {
          voiceEngine.speakNpcLine(encounter, getNpcScaredLine(encounter), 'scared');
        }
      },
      onNightComplete: () => {
        setActiveModal('night_summary');
      },
      onGameOver: () => {
        voiceEngine.stop();
        document.body.dataset.state = 'gameover';
        setPhase('gameover');
        setActiveModal('none');
      },
      onSecretDiscovered: (secret, byPlayerName) => {
        setSecretToast({ secret, byPlayerName });
      },
      onSyncSecretDiscover: (secretId) => {
        mpClientRef.current?.send({ type: 'secret:discover', secretId });
      },
      onLocalPose: (x, y, z, yaw, heldProductId) => {
        mpClientRef.current?.sendPose(x, y, z, yaw, heldProductId);
      },
      onSyncNpcSpawn: (encounter, storyIndex) => {
        mpClientRef.current?.send({ type: 'npc:spawn', encounter, storyIndex });
      },
      onSyncNpcStatus: (npcStatus, reputationDelta) => {
        mpClientRef.current?.send({ type: 'npc:status', npcStatus, reputationDelta });
      },
    });
    engineRef.current = engine;
    engine.setSensitivityPreset(sensitivityRef.current);
    engine.setLandscapeRotated(window.innerHeight > window.innerWidth);

    const view = onlineStateRef.current;
    if (view.peers.length > 0) {
      engine.setRemotePeers(view.peers);
    }
    if (view.status === 'connected' && view.selfId) {
      const allIds = [view.selfId, ...view.peers.map((p) => p.id)].sort();
      engine.setAllowAutoNpcSpawn(allIds[0] === view.selfId);
    }

    if (phaseRef.current === 'playing') {
      engine.setPhase('playing');
    }

    return () => {
      voiceEngine.stop();
      engine.dispose();
      engineRef.current = null;
    };
  }, []);

  const enterIntro = useCallback(() => {
    document.body.dataset.state = 'intro';
    setPhase('intro');
    setActiveModal('none');
    engineRef.current?.setPhase('intro');
  }, []);

  const enterTutorial = useCallback(() => {
    voiceEngine.stop();
    document.body.dataset.state = 'tutorial';
    setPhase('tutorial');
    setActiveModal('none');
    engineRef.current?.setPhase('tutorial');
  }, []);

  const enterPlaying = useCallback(() => {
    voiceEngine.stop();
    document.body.dataset.state = 'playing';
    setPhase('playing');
    setActiveModal('none');
    engineRef.current?.setPhase('playing');
  }, []);

  const handleToggleMute = useCallback(() => {
    setMuted((prev) => {
      const next = !prev;
      soundEngine.setMuted(next);
      voiceEngine.setMuted(next);
      return next;
    });
  }, []);

  const handleChangeSensitivity = useCallback((preset: SensitivityPreset) => {
    setSensitivity(preset);
    engineRef.current?.setSensitivityPreset(preset);
    try {
      localStorage.setItem(SENSITIVITY_STORAGE_KEY, preset);
    } catch {
      // Ignore storage errors
    }
  }, []);

  const handleJoinRoom = useCallback((roomCode: string) => {
    mpClientRef.current?.connect(sanitizeRoomCode(roomCode), profileRef.current);
  }, []);

  const handleLeaveRoom = useCallback(() => {
    mpClientRef.current?.disconnect();
    engineRef.current?.setAllowAutoNpcSpawn(true);
    engineRef.current?.setRemotePeers([]);
  }, []);

  const handleSendQuickChat = useCallback((text: string) => {
    mpClientRef.current?.send({ type: 'chat:send', text });
  }, []);

  const handleReplayNpcVoice = useCallback(() => {
    const npc = hudRef.current.activeNpc;
    if (!npc) return;
    if (muted) {
      soundEngine.setMuted(false);
      voiceEngine.setMuted(false);
      setMuted(false);
    }
    if (hudRef.current.npcStatus === 'leaving') {
      voiceEngine.speakNpcLine(npc, npc.thanksLine, 'normal');
    } else if (hudRef.current.npcStatus === 'scared') {
      voiceEngine.speakNpcLine(npc, getNpcScaredLine(npc), 'scared');
    } else {
      voiceEngine.speakNpcArrival(npc, profileRef.current.friendName);
    }
  }, [muted]);

  const handleSaveProfile = useCallback((nextProfile: PlayerProfile) => {
    setProfile(nextProfile);
    engineRef.current?.updateProfile(nextProfile);
    mpClientRef.current?.updateProfile(nextProfile);
  }, []);

  const handleUploadCustomModel = useCallback(async (file: File) => {
    const loadedName = await engineRef.current?.loadCustomCharacterFromFile(file);
    if (loadedName) {
      setProfile((prev) => ({ ...prev, customModelName: loadedName }));
    }
  }, []);

  const handleClearCustomModel = useCallback(() => {
    engineRef.current?.clearCustomCharacterModel();
    setProfile((prev) => ({ ...prev, customModelName: undefined }));
  }, []);

  const handleRestock = useCallback((productId: ProductId) => {
    engineRef.current?.restockProduct(productId, 2);
    setStock((prev) => ({ ...prev, [productId]: (prev[productId] ?? 0) + 2 }));
    mpClientRef.current?.send({ type: 'stock:restock', productId, count: 2 });
  }, []);

  const handleOrganizeShelves = useCallback(() => {
    engineRef.current?.organizeShelves();
    mpClientRef.current?.send({ type: 'shelves:organize' });
  }, []);

  const handleUpdateActionButton = useCallback(
    (id: CustomizableButtonId, patch: Partial<ActionButtonConfig>) => {
      setActionButtons((prev) => {
        const next = sanitizeActionButtonLayouts({
          ...prev,
          [id]: { ...prev[id], ...patch },
        });
        try {
          localStorage.setItem(CONTROLS_STORAGE_KEY, JSON.stringify(next));
        } catch {
          // Ignore storage errors
        }
        return next;
      });
    },
    []
  );

  const handleResetActionButtons = useCallback(() => {
    const next = sanitizeActionButtonLayouts(DEFAULT_ACTION_BUTTONS);
    try {
      localStorage.setItem(CONTROLS_STORAGE_KEY, JSON.stringify(next));
    } catch {
      // Ignore storage errors
    }
    setActionButtons(next);
  }, []);

  const handleQuickFillMissing = useCallback(() => {
    const evalState = hudRef.current.orderEval;
    if (!evalState) return;
    for (const req of evalState.requested) {
      const missing = Math.max(0, req.needed - req.placed);
      for (let i = 0; i < missing; i++) {
        engineRef.current?.dropQuickItemToCounter(req.productId);
      }
    }
    engineRef.current?.pushHudState(true);
  }, []);

  const handleConfirmPayment = useCallback(
    (total: number) => {
      const engine = engineRef.current;
      const npc = hudRef.current.activeNpc;
      if (!engine || !npc) return;

      const soldItems = engine.completeActiveOrderSale(total);
      setStock((prevStock) => {
        const result = recordSaleToInventory(prevStock, sold, soldItems, npc.npcName);
        setSold(result.nextSold);
        return result.nextStock;
      });
      if (onlineStateRef.current.status === 'connected') {
        mpClientRef.current?.send({
          type: 'sale:complete',
          soldItems,
          customerName: npc.npcName,
        });
      }
      setActiveModal('none');
    },
    [sold]
  );

  const handleRestartShift = useCallback(() => {
    voiceEngine.stop();
    engineRef.current?.resetShift();
    setStock(createInitialStock());
    setSold(createInitialSoldRecords());
    setActiveModal('none');
    setPhase('playing');
    engineRef.current?.setPhase('playing');
    if (onlineStateRef.current.status === 'connected') {
      mpClientRef.current?.send({ type: 'shift:reset' });
    }
  }, []);

  const handleReturnTitle = useCallback(() => {
    voiceEngine.stop();
    setActiveModal('none');
    setPhase('title');
    engineRef.current?.setPhase('title');
  }, []);

  const handleBuyUpgrade = useCallback((upgradeId: KioscoUpgradeId) => {
    if (onlineStateRef.current.status === 'connected') {
      mpClientRef.current?.send({ type: 'upgrade:buy', upgradeId });
    } else {
      engineRef.current?.buyUpgrade(upgradeId);
    }
  }, []);

  const handleStartNextNight = useCallback(() => {
    if (onlineStateRef.current.status === 'connected') {
      mpClientRef.current?.send({ type: 'night:advance' });
    } else {
      engineRef.current?.advanceToNextNight();
      setActiveModal('none');
      setPhase('playing');
      engineRef.current?.setPhase('playing');
    }
  }, []);

  const handleRequestGeminiNpc = useCallback(async () => {
    if (geminiLoading) return;
    setGeminiLoading(true);
    setGeminiError(null);
    try {
      const res = await fetch('/api/kiosco/encounter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          playerName: profileRef.current.playerName,
          friendName: profileRef.current.friendName,
          shiftCount: hudRef.current.customersServed + 1,
          mood: 'terror nocturno de supermercado antes de las 3 AM con pasillos oscuros',
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || `Error HTTP ${res.status}`);
      }
      const encounter = normalizeGeminiEncounter(data.encounter, String(Date.now()));
      engineRef.current?.spawnNpc(encounter, true);
    } catch (err: unknown) {
      setGeminiError(err instanceof Error ? err.message : 'No se pudo conectar con Gemini.');
    } finally {
      setGeminiLoading(false);
    }
  }, [geminiLoading]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isTyping =
        target &&
        (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT');
      if (isTyping) return;

      if (phaseRef.current === 'title' && activeModalRef.current === 'none') {
        if (e.code === 'Enter' || e.code === 'Space') {
          e.preventDefault();
          enterIntro();
        }
        return;
      }

      if (phaseRef.current === 'intro') {
        if (e.code === 'Escape') {
          e.preventDefault();
          enterTutorial();
        }
        return;
      }

      if (phaseRef.current === 'tutorial') {
        if (e.code === 'Escape' || e.code === 'Enter' || e.code === 'Space') {
          e.preventDefault();
          enterPlaying();
        }
        return;
      }

      if (e.code === 'Escape') {
        e.preventDefault();
        if (activeModalRef.current !== 'none') {
          setActiveModal('none');
          if (phaseRef.current === 'paused') {
            setPhase('playing');
            engineRef.current?.setPhase('playing');
          }
        } else if (phaseRef.current === 'playing') {
          setPhase('paused');
          setActiveModal('pause');
          engineRef.current?.setPhase('paused');
        }
        return;
      }

      if (phaseRef.current !== 'playing') return;

      if (e.code === 'KeyI') {
        e.preventDefault();
        setActiveModal((m) => (m === 'inventory' ? 'none' : 'inventory'));
      } else if (e.code === 'KeyP') {
        e.preventDefault();
        setActiveModal((m) => (m === 'character' ? 'none' : 'character'));
      } else if (e.code === 'KeyE') {
        if (hudRef.current.activeNpc && hudRef.current.npcStatus === 'waiting') {
          e.preventDefault();
          setActiveModal((m) => (m === 'payment' ? 'none' : 'payment'));
        }
      } else if (e.code === 'KeyG' && activeModalRef.current === 'none') {
        e.preventDefault();
        engineRef.current?.toggleWeapon();
      } else if (e.code === 'KeyF' && activeModalRef.current === 'none') {
        e.preventDefault();
        engineRef.current?.fireWeapon();
      } else if (e.code === 'KeyL' && activeModalRef.current === 'none') {
        e.preventDefault();
        engineRef.current?.toggleFlashlight();
      } else if (e.code === 'KeyM') {
        e.preventDefault();
        handleToggleMute();
      } else if (
        e.code === actionButtonsRef.current.grab.keyCode &&
        activeModalRef.current === 'none'
      ) {
        e.preventDefault();
        engineRef.current?.grabAction();
      } else if (
        e.code === actionButtonsRef.current.drop.keyCode &&
        activeModalRef.current === 'none'
      ) {
        e.preventDefault();
        engineRef.current?.dropAction(true);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [enterIntro, enterTutorial, enterPlaying, handleToggleMute]);

  return (
    <main
      className={`relative overflow-hidden bg-stone-950 ${
        isPortrait ? 'landscape-stage-rotated' : 'w-full h-full'
      }`}
    >
      <div
        ref={mountRef}
        className="fixed inset-0"
        data-testid="kiosco-canvas-container"
      />

      {phase === 'title' && (
        <TitleScreen
          profile={profile}
          onlineState={onlineState}
          onStart={enterIntro}
          onOpenCharacter={() => setActiveModal('character')}
          onJoinRoom={handleJoinRoom}
          onLeaveRoom={handleLeaveRoom}
        />
      )}

      {phase === 'intro' && (
        <IntroOverlay
          profile={profile}
          muted={muted}
          onToggleMute={handleToggleMute}
          onComplete={enterTutorial}
        />
      )}

      {phase === 'tutorial' && (
        <TutorialOverlay playerName={profile.playerName} onComplete={enterPlaying} />
      )}

      {phase === 'playing' && (
        <GameHUD
          hud={hud}
          profile={profile}
          muted={muted}
          compact={isCompactHorizontal}
          landscapeRotated={isPortrait}
          speaking={speaking}
          geminiLoading={geminiLoading}
          geminiError={geminiError}
          sensitivity={sensitivity}
          onlineState={onlineState}
          secretToast={secretToast}
          actionButtons={actionButtons}
          onChangeSensitivity={handleChangeSensitivity}
          onSendQuickChat={handleSendQuickChat}
          onUpdateActionButton={handleUpdateActionButton}
          onResetActionButtons={handleResetActionButtons}
          onToggleMute={handleToggleMute}
          onOpenInventory={() => setActiveModal('inventory')}
          onOpenCharacter={() => setActiveModal('character')}
          onOpenPayment={() => setActiveModal('payment')}
          onToggleWeapon={() => engineRef.current?.toggleWeapon()}
          onFireWeapon={() => engineRef.current?.fireWeapon()}
          onToggleFlashlight={() => engineRef.current?.toggleFlashlight()}
          onGrabAction={() => engineRef.current?.grabAction()}
          onDropAction={() => engineRef.current?.dropAction(true)}
          onJoystickMove={(x, z) => engineRef.current?.setAnalogMove(x, z)}
          onPause={() => {
            voiceEngine.stop();
            setPhase('paused');
            setActiveModal('pause');
            engineRef.current?.setPhase('paused');
          }}
          onRequestGeminiNpc={handleRequestGeminiNpc}
          onReplayNpcVoice={handleReplayNpcVoice}
          onDismissGeminiError={() => setGeminiError(null)}
          onDismissSecretToast={() => setSecretToast(null)}
        />
      )}

      {activeModal === 'character' && (
        <CharacterModal
          profile={profile}
          onSave={handleSaveProfile}
          onUploadCustomModel={handleUploadCustomModel}
          onClearCustomModel={handleClearCustomModel}
          onClose={() => setActiveModal('none')}
        />
      )}

      {activeModal === 'inventory' && (
        <InventoryModal
          stock={stock}
          sold={sold}
          onRestock={handleRestock}
          onOrganizeShelves={handleOrganizeShelves}
          onClose={() => setActiveModal('none')}
        />
      )}

      {activeModal === 'payment' && hud.activeNpc && hud.orderEval && (
        <PaymentModal
          npc={hud.activeNpc}
          orderEval={hud.orderEval}
          onQuickFillMissing={handleQuickFillMissing}
          onConfirmPayment={handleConfirmPayment}
          onClose={() => setActiveModal('none')}
        />
      )}

      {activeModal === 'pause' && (
        <PauseModal
          cash={hud.cash}
          customersServed={hud.customersServed}
          sensitivity={sensitivity}
          onChangeSensitivity={handleChangeSensitivity}
          onResume={() => {
            setActiveModal('none');
            setPhase('playing');
            engineRef.current?.setPhase('playing');
          }}
          onOpenTutorial={enterTutorial}
          onRestart={handleRestartShift}
          onReturnTitle={handleReturnTitle}
        />
      )}

      {activeModal === 'night_summary' && (
        <NightSummaryModal
          nightNumber={hud.nightNumber}
          cash={hud.cash}
          customersServed={hud.customersServed}
          restockedCount={hud.restockedCount}
          upgrades={hud.upgrades}
          discoveredSecrets={hud.discoveredSecrets}
          onBuyUpgrade={handleBuyUpgrade}
          onStartNextNight={handleStartNextNight}
        />
      )}

      {phase === 'gameover' && (
        <div
          className="fixed inset-0 z-30 flex items-center justify-center bg-black/88 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Apagón Total"
          data-testid="gameover-modal"
        >
          <div className="w-full max-w-md mc-panel-stone p-5 text-center text-red-50">
            <h2 className="text-2xl font-display font-bold text-red-400">
              CORTE TOTAL DE ENERGÍA
            </h2>
            <p className="mt-2 text-xs md:text-sm text-stone-200 leading-relaxed">
              Las góndolas y heladeras quedaron vacías demasiado tiempo antes de las 03:00 AM y el súper quedó a oscuras.
            </p>
            <div className="mt-4 flex flex-wrap justify-center gap-2.5">
              <button
                type="button"
                onClick={handleRestartShift}
                className="min-h-[44px] px-5 py-2 mc-btn mc-btn-gold font-display font-bold text-sm cursor-pointer"
              >
                REINTENTAR TURNO
              </button>
              <button
                type="button"
                onClick={handleReturnTitle}
                className="min-h-[44px] px-4 py-2 mc-btn mc-btn-stone text-xs font-bold cursor-pointer"
              >
                Volver al Inicio
              </button>
            </div>
          </div>
        </div>
      )}

      <OfflineIndicator />
    </main>
  );
}
