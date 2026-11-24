import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowDownToLine,
  Banknote,
  Compass,
  Flame,
  Flashlight,
  Ghost,
  Hand,
  Package,
  Pause,
  ShieldAlert,
  SlidersHorizontal,
  Sparkles,
  UserRound,
  Volume2,
  VolumeX,
  Zap,
} from 'lucide-react';
import { SENSITIVITY_PRESETS, buildMissionSteps, formatKeyLabel } from '../game/kioscoLogic';
import type { OnlineStateView } from '../game/multiplayerClient';
import type {
  ActionButtonConfig,
  CustomizableButtonId,
  HudStateSnapshot,
  PlayerProfile,
  SecretEventDef,
  SensitivityPreset,
} from '../game/types';
import type { SpeakingState } from '../game/voiceEngine';

interface GameHUDProps {
  hud: HudStateSnapshot;
  profile: PlayerProfile;
  muted: boolean;
  compact: boolean;
  landscapeRotated: boolean;
  speaking: SpeakingState;
  geminiLoading: boolean;
  geminiError: string | null;
  sensitivity: SensitivityPreset;
  onlineState: OnlineStateView;
  secretToast: { secret: SecretEventDef; byPlayerName?: string } | null;
  actionButtons: Record<CustomizableButtonId, ActionButtonConfig>;
  onChangeSensitivity: (preset: SensitivityPreset) => void;
  onSendQuickChat: (text: string) => void;
  onUpdateActionButton: (id: CustomizableButtonId, patch: Partial<ActionButtonConfig>) => void;
  onResetActionButtons: () => void;
  onToggleMute: () => void;
  onOpenInventory: () => void;
  onOpenCharacter: () => void;
  onOpenPayment: () => void;
  onToggleWeapon: () => void;
  onFireWeapon: () => void;
  onToggleFlashlight: () => void;
  onGrabAction: () => void;
  onDropAction: () => void;
  onJoystickMove: (x: number, z: number) => void;
  onPause: () => void;
  onRequestGeminiNpc: () => void;
  onReplayNpcVoice: () => void;
  onDismissGeminiError: () => void;
  onDismissSecretToast: () => void;
}

export const GameHUD: React.FC<GameHUDProps> = ({
  hud,
  profile,
  muted,
  compact,
  landscapeRotated,
  speaking,
  geminiLoading,
  geminiError,
  sensitivity,
  onlineState,
  secretToast,
  actionButtons,
  onChangeSensitivity,
  onSendQuickChat,
  onUpdateActionButton,
  onResetActionButtons,
  onToggleMute,
  onOpenInventory,
  onOpenCharacter,
  onOpenPayment,
  onToggleWeapon,
  onFireWeapon,
  onToggleFlashlight,
  onGrabAction,
  onDropAction,
  onJoystickMove,
  onPause,
  onRequestGeminiNpc,
  onReplayNpcVoice,
  onDismissGeminiError,
  onDismissSecretToast,
}) => {
  // Analog Virtual Joystick state
  const joystickBaseRef = useRef<HTMLDivElement | null>(null);
  const joystickPointerId = useRef<number | null>(null);
  const [knobOffset, setKnobOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const maxKnobRadius = compact ? 32 : 38;

  // Modifiable Agarrar / Tirar button editor state
  const [editMode, setEditMode] = useState(false);
  const [selectedBtnId, setSelectedBtnId] = useState<CustomizableButtonId>('grab');
  const [listeningKeyFor, setListeningKeyFor] = useState<CustomizableButtonId | null>(null);
  const dragInfoRef = useRef<{
    id: CustomizableButtonId;
    startClientX: number;
    startClientY: number;
    origOffsetX: number;
    origOffsetY: number;
    moved: boolean;
  } | null>(null);

  useEffect(() => {
    if (!listeningKeyFor) return;
    const onKey = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (e.code !== 'Escape') {
        onUpdateActionButton(listeningKeyFor, {
          keyCode: e.code,
          keyLabel: formatKeyLabel(e.code),
        });
      }
      setListeningKeyFor(null);
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [listeningKeyFor, onUpdateActionButton]);

  const updateJoystickFromPointer = (clientX: number, clientY: number) => {
    const base = joystickBaseRef.current;
    if (!base) return;
    const rect = base.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;

    const dx = landscapeRotated ? clientY - cy : clientX - cx;
    const dy = landscapeRotated ? -(clientX - cx) : clientY - cy;

    const dist = Math.hypot(dx, dy);
    const clamped = Math.min(maxKnobRadius, dist);
    const angle = Math.atan2(dy, dx);
    const kx = dist > 0.5 ? Math.cos(angle) * clamped : 0;
    const ky = dist > 0.5 ? Math.sin(angle) * clamped : 0;

    setKnobOffset({ x: kx, y: ky });
    onJoystickMove(kx / maxKnobRadius, ky / maxKnobRadius);
  };

  const resetJoystick = () => {
    joystickPointerId.current = null;
    setKnobOffset({ x: 0, y: 0 });
    onJoystickMove(0, 0);
  };

  const missionSteps = useMemo(
    () =>
      buildMissionSteps(
        hud.activeNpc,
        hud.npcStatus,
        hud.heldProductId,
        hud.orderEval,
        hud.urgentRestockZone
      ),
    [hud.activeNpc, hud.npcStatus, hud.heldProductId, hud.orderEval, hud.urgentRestockZone]
  );

  // Voice subtitle text: live spoken voice line or active character line
  const subtitleText = speaking.active
    ? `${speaking.speakerName}: "${speaking.text}"`
    : hud.activeNpc && hud.npcStatus === 'approaching'
    ? hud.friendLine
    : hud.activeNpc
    ? `${hud.activeNpc.npcName}: "${hud.dialogueLine}"`
    : hud.dialogueLine;

  const renderModifiableButton = (
    id: CustomizableButtonId,
    onAction: () => void,
    disabled: boolean,
    highlightClass: string,
    icon: React.ReactNode,
    overrideLabel?: string
  ) => {
    const cfg = actionButtons[id];
    const isSelected = editMode && selectedBtnId === id;
    const displayLabel = overrideLabel ?? cfg.label;

    return (
      <div
        key={id}
        data-hud-interactive="true"
        onPointerDown={(e) => e.stopPropagation()}
        style={{
          transform: `translate(${cfg.offsetX}px, ${cfg.offsetY}px) scale(${cfg.scale})`,
          transformOrigin: 'bottom right',
        }}
        className="absolute bottom-0 right-0 pointer-events-auto touch-none"
      >
        <button
          type="button"
          tabIndex={-1}
          disabled={!editMode && disabled}
          data-testid={`action-btn-${id}`}
          onPointerDown={(e) => {
            e.stopPropagation();
            if (!editMode) return;
            e.currentTarget.setPointerCapture(e.pointerId);
            setSelectedBtnId(id);
            dragInfoRef.current = {
              id,
              startClientX: e.clientX,
              startClientY: e.clientY,
              origOffsetX: cfg.offsetX,
              origOffsetY: cfg.offsetY,
              moved: false,
            };
          }}
          onPointerMove={(e) => {
            if (!editMode || !dragInfoRef.current || dragInfoRef.current.id !== id) return;
            const rawDx = e.clientX - dragInfoRef.current.startClientX;
            const rawDy = e.clientY - dragInfoRef.current.startClientY;
            const dx = landscapeRotated ? rawDy : rawDx;
            const dy = landscapeRotated ? -rawDx : rawDy;
            if (Math.hypot(dx, dy) > 3) dragInfoRef.current.moved = true;
            onUpdateActionButton(id, {
              offsetX: dragInfoRef.current.origOffsetX + Math.round(dx),
              offsetY: dragInfoRef.current.origOffsetY + Math.round(dy),
            });
          }}
          onPointerUp={(e) => {
            if (editMode && dragInfoRef.current?.id === id) {
              if (e.currentTarget.hasPointerCapture(e.pointerId)) {
                e.currentTarget.releasePointerCapture(e.pointerId);
              }
              dragInfoRef.current = null;
            }
          }}
          onClick={(e) => {
            e.currentTarget.blur();
            if (editMode) {
              setSelectedBtnId(id);
              return;
            }
            onAction();
          }}
          className={`${
            compact ? 'min-h-[44px] px-3.5 py-2 text-xs' : 'min-h-[48px] px-4 py-2.5 text-sm'
          } mc-btn font-bold select-none whitespace-nowrap flex items-center gap-1.5 ${
            editMode
              ? isSelected
                ? 'mc-btn-diamond ring-2 ring-sky-200 cursor-move'
                : 'mc-btn-dark border-sky-400 text-sky-100 cursor-move'
              : `${highlightClass} cursor-pointer disabled:cursor-not-allowed`
          }`}
          aria-label={displayLabel}
        >
          {icon}
          <span>{displayLabel}</span>
        </button>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-10 pointer-events-none">
      {/* Subtle Horror Event Atmospheric Vignette (no backdrop-blur) */}
      {hud.activeHorrorEvent && (
        <div
          className="fixed inset-0 pointer-events-none transition-opacity duration-300"
          style={{
            boxShadow:
              hud.activeHorrorEvent.type === 'aisle_shadow'
                ? 'inset 0 0 80px rgba(14, 165, 233, 0.24)'
                : 'inset 0 0 95px rgba(185, 28, 28, 0.3)',
          }}
          aria-hidden="true"
        />
      )}

      {/* Top-Left Status Cluster */}
      <div
        data-hud-interactive="true"
        onPointerDown={(e) => e.stopPropagation()}
        className={`absolute flex flex-col gap-1 pointer-events-auto ${
          compact ? 'top-2 left-2' : 'top-3 left-3 gap-1.5'
        }`}
      >
        <div
          className={`flex items-center mc-panel ${
            compact ? 'gap-2 px-2.5 py-1.5' : 'gap-3.5 px-3.5 py-2'
          } ${hud.flickerAlert ? 'border-red-500/80' : ''}`}
        >
          <div>
            <div className="text-[9px] md:text-[10px] uppercase tracking-wider text-amber-400/90 font-semibold">
              {compact ? 'TURNO' : 'SÚPER · HASTA 03:00 AM'}
            </div>
            <div
              className={`${
                compact ? 'text-sm' : 'text-lg'
              } font-display font-bold font-mono-num leading-tight ${
                hud.flickerAlert ? 'text-red-300 animate-pulse' : 'text-amber-300'
              }`}
              data-testid="hud-shift-clock"
            >
              {hud.shiftTimeLabel}
            </div>
            <div className="mt-0.5 w-20 md:w-28 h-1.5 bg-zinc-900 border border-black overflow-hidden">
              <div
                className="h-full bg-emerald-400 transition-all duration-200"
                style={{ width: `${hud.shiftProgressPercent}%` }}
              />
            </div>
          </div>
          <div className="h-7 w-0.5 bg-zinc-700" />
          <div>
            <div className="text-[9px] md:text-[10px] uppercase tracking-wider text-stone-400 font-semibold">
              PLATA · ESTABILIDAD
            </div>
            <div className="flex items-baseline gap-1.5">
              <span
                className="text-xs md:text-sm font-display font-bold text-amber-300 font-mono-num"
                data-testid="hud-cash"
              >
                ${Math.round(hud.cash).toLocaleString('es-AR')}
              </span>
              <span
                className={`text-[11px] md:text-xs font-mono-num font-bold ${
                  hud.reputation <= 35 ? 'text-red-400 animate-pulse' : 'text-emerald-400'
                }`}
                data-testid="hud-night-progress"
              >
                {Math.round(hud.reputation)}%
              </span>
            </div>
            <div className="text-[10px] text-stone-300 truncate max-w-[130px]" data-testid="hud-names">
              Noche {hud.nightNumber} · {profile.playerName}
            </div>
          </div>
        </div>

        {/* Live Supermarket Shelf & Chiller Restock Strip */}
        <div
          className="grid grid-cols-4 gap-1 mc-panel px-1.5 py-1 max-w-[340px] md:max-w-[400px]"
          data-testid="hud-restock-strip"
        >
          {hud.restockZones.map((zone) => (
            <div
              key={zone.id}
              className={`px-1 py-0.5 border border-black bg-zinc-900/90 ${
                zone.isCritical
                  ? 'ring-1 ring-red-400 animate-pulse'
                  : zone.needsRestock
                  ? 'ring-1 ring-amber-400/70'
                  : ''
              }`}
            >
              <div className="flex items-center justify-between gap-1 text-[9px] font-mono-num leading-none">
                <span className="truncate text-stone-200">
                  {zone.id === 'heladera_carnes'
                    ? 'Carnes'
                    : zone.id === 'gondola_almacen'
                    ? 'Almacén'
                    : zone.id === 'gondola_bebidas'
                    ? 'Bebidas'
                    : 'Heladera'}
                </span>
                <span
                  className={
                    zone.isCritical
                      ? 'text-red-300 font-bold'
                      : zone.needsRestock
                      ? 'text-amber-300 font-bold'
                      : 'text-emerald-300'
                  }
                >
                  {Math.round(zone.stockPercent)}%
                </span>
              </div>
              <div className="mt-0.5 w-full h-1 bg-black">
                <div
                  className={`h-full ${
                    zone.isCritical
                      ? 'bg-red-500'
                      : zone.needsRestock
                      ? 'bg-amber-400'
                      : 'bg-emerald-500'
                  }`}
                  style={{ width: `${Math.max(4, Math.round(zone.stockPercent))}%` }}
                />
              </div>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <div
            className={`self-start mc-slot font-mono-num text-amber-200/90 ${
              compact ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-1 text-[11px]'
            }`}
            data-testid="hud-zone"
          >
            Lugar: {hud.playerZone}
          </div>
          <div
            className={`self-start mc-slot font-mono-num text-sky-200 flex items-center gap-1 ${
              compact ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-1 text-[11px]'
            }`}
            data-testid="hud-secrets-badge"
          >
            <Compass className="w-3 h-3 text-sky-300" />
            <span>Pistas {hud.discoveredSecrets.length}/3</span>
          </div>
          {onlineState.status === 'connected' && (
            <div
              className={`self-start mc-slot font-mono-num text-sky-200 flex items-center gap-1.5 ${
                compact ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-1 text-[11px]'
              }`}
              data-testid="hud-online-pill"
            >
              <span>
                Sala {onlineState.roomCode} ({1 + onlineState.peers.length}/4)
              </span>
              {onlineState.peers.length > 0 && (
                <>
                  <button
                    type="button"
                    tabIndex={-1}
                    onClick={() => onSendQuickChat('¡Vení al mostrador!')}
                    className="mc-btn mc-btn-diamond px-2 py-0.5 text-[10px] font-bold cursor-pointer"
                  >
                    ¡Vení!
                  </button>
                  <button
                    type="button"
                    tabIndex={-1}
                    onClick={() => onSendQuickChat('Cobrá vos en la caja')}
                    className="mc-btn mc-btn-diamond px-2 py-0.5 text-[10px] font-bold cursor-pointer"
                  >
                    Cobrá
                  </button>
                </>
              )}
            </div>
          )}
        </div>
        {onlineState.messages.length > 0 && (
          <div
            className="self-start mc-panel px-2.5 py-1 text-[11px] text-sky-100"
            data-testid="hud-online-chat"
          >
            <span className="font-bold text-sky-300">
              {onlineState.messages[onlineState.messages.length - 1].senderName}:
            </span>{' '}
            {onlineState.messages[onlineState.messages.length - 1].text}
          </div>
        )}
      </div>

      {/* Top-Right Touch-Friendly Utility Buttons (icons + plain kid-friendly words) */}
      <div
        data-hud-interactive="true"
        onPointerDown={(e) => e.stopPropagation()}
        className={`absolute flex items-center gap-1.5 pointer-events-auto ${
          compact ? 'top-2 right-2' : 'top-3 right-3'
        }`}
      >
        <button
          type="button"
          tabIndex={-1}
          onClick={(e) => {
            e.currentTarget.blur();
            onOpenInventory();
          }}
          className={`${
            compact ? 'min-h-[40px] px-2.5 py-1.5 text-[11px]' : 'min-h-[42px] px-3 py-2 text-xs'
          } mc-btn mc-btn-stone font-bold flex items-center gap-1.5 cursor-pointer`}
          aria-label="Abrir Productos"
        >
          <Package className="w-4 h-4 text-amber-300 shrink-0" />
          <span>Productos</span>
        </button>

        <button
          type="button"
          tabIndex={-1}
          onClick={(e) => {
            e.currentTarget.blur();
            onOpenCharacter();
          }}
          className={`${
            compact ? 'min-h-[40px] px-2.5 py-1.5 text-[11px]' : 'min-h-[42px] px-3 py-2 text-xs'
          } mc-btn mc-btn-stone font-bold flex items-center gap-1.5 cursor-pointer`}
          aria-label="Cambiar Personaje"
        >
          <UserRound className="w-4 h-4 text-sky-300 shrink-0" />
          <span>{compact ? 'Yo' : 'Personaje'}</span>
        </button>

        <button
          type="button"
          tabIndex={-1}
          onClick={(e) => {
            e.currentTarget.blur();
            setEditMode((v) => !v);
            setListeningKeyFor(null);
          }}
          className={`${
            compact ? 'min-h-[40px] px-2.5 py-1.5 text-[11px]' : 'min-h-[42px] px-3 py-2 text-xs'
          } mc-btn font-bold flex items-center gap-1.5 cursor-pointer ${
            editMode ? 'mc-btn-diamond' : 'mc-btn-stone'
          }`}
          aria-label="Ajustar botones y sensibilidad"
        >
          <SlidersHorizontal className="w-4 h-4 shrink-0" />
          <span>{editMode ? 'Listo' : 'Botones'}</span>
        </button>

        <button
          type="button"
          tabIndex={-1}
          onClick={(e) => {
            e.currentTarget.blur();
            onToggleFlashlight();
          }}
          className={`${
            compact ? 'min-h-[40px] px-2.5 py-1.5 text-[11px]' : 'min-h-[42px] px-3 py-2 text-xs'
          } mc-btn font-bold flex items-center gap-1.5 cursor-pointer ${
            hud.flashlightOn ? 'mc-btn-gold' : 'mc-btn-dark'
          }`}
          aria-label="Prender o apagar linterna"
        >
          <Flashlight className="w-4 h-4 shrink-0" />
          <span>{compact ? 'Luz' : 'Linterna'}</span>
        </button>

        <button
          type="button"
          tabIndex={-1}
          onClick={(e) => {
            e.currentTarget.blur();
            onToggleMute();
          }}
          className="w-10 h-10 mc-btn mc-btn-stone flex items-center justify-center cursor-pointer"
          aria-label={muted ? 'Activar sonido' : 'Silenciar sonido'}
          title="Sonido"
        >
          {muted ? <VolumeX className="w-4 h-4 text-red-200" /> : <Volume2 className="w-4 h-4 text-amber-200" />}
        </button>

        <button
          type="button"
          tabIndex={-1}
          onClick={(e) => {
            e.currentTarget.blur();
            onPause();
          }}
          className="w-10 h-10 mc-btn mc-btn-stone flex items-center justify-center cursor-pointer"
          aria-label="Pausar juego"
          title="Pausa"
        >
          <Pause className="w-4 h-4" />
        </button>
      </div>

      {/* Button & Sensitivity Customization Toolbar */}
      {editMode && (
        <div
          className={`absolute ${
            compact ? 'top-[62px]' : 'top-[92px]'
          } left-1/2 -translate-x-1/2 z-30 px-3 py-2 mc-panel pointer-events-auto flex flex-wrap items-center justify-center gap-2 text-xs text-sky-100 w-max max-w-[95%]`}
          data-testid="button-editor-bar"
        >
          <span className="font-bold text-sky-300">
            Arrastrá Agarrar o Tirar para moverlos
          </span>
          <div className="flex items-center gap-1">
            {(['grab', 'drop'] as CustomizableButtonId[]).map((bid) => (
              <button
                key={bid}
                type="button"
                onClick={() => setSelectedBtnId(bid)}
                className={`px-2.5 py-1 mc-btn font-bold cursor-pointer ${
                  selectedBtnId === bid ? 'mc-btn-diamond' : 'mc-btn-dark'
                }`}
              >
                {actionButtons[bid].label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1">
            <span>Tamaño:</span>
            <button
              type="button"
              onClick={() =>
                onUpdateActionButton(selectedBtnId, {
                  scale: Math.max(0.8, Number((actionButtons[selectedBtnId].scale - 0.1).toFixed(2))),
                })
              }
              className="w-7 h-7 mc-btn mc-btn-stone cursor-pointer font-bold"
              aria-label="Achicar botón"
            >
              -
            </button>
            <span className="font-mono-num w-10 text-center">
              {Math.round(actionButtons[selectedBtnId].scale * 100)}%
            </span>
            <button
              type="button"
              onClick={() =>
                onUpdateActionButton(selectedBtnId, {
                  scale: Math.min(1.45, Number((actionButtons[selectedBtnId].scale + 0.1).toFixed(2))),
                })
              }
              className="w-7 h-7 mc-btn mc-btn-stone cursor-pointer font-bold"
              aria-label="Agrandar botón"
            >
              +
            </button>
          </div>
          {!compact && (
            <button
              type="button"
              onClick={() => setListeningKeyFor(selectedBtnId)}
              className="px-2.5 py-1 mc-btn mc-btn-dark text-amber-200 font-semibold cursor-pointer"
            >
              {listeningKeyFor === selectedBtnId
                ? 'Presioná una tecla...'
                : `Tecla: [${actionButtons[selectedBtnId].keyLabel}]`}
            </button>
          )}
          <div className="flex items-center gap-1 border-l border-zinc-700 pl-2">
            <span className="text-amber-200 font-bold">Velocidad:</span>
            {(['media', 'alta', 'muy_alta'] as SensitivityPreset[]).map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => onChangeSensitivity(preset)}
                className={`px-2.5 py-1 mc-btn font-bold cursor-pointer ${
                  sensitivity === preset ? 'mc-btn-gold' : 'mc-btn-dark'
                }`}
              >
                {SENSITIVITY_PRESETS[preset].label}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={onResetActionButtons}
            className="px-2.5 py-1 mc-btn mc-btn-stone cursor-pointer font-bold"
          >
            Reiniciar
          </button>
          <button
            type="button"
            onClick={() => {
              setEditMode(false);
              setListeningKeyFor(null);
            }}
            className="px-3 py-1 mc-btn mc-btn-green font-bold cursor-pointer"
          >
            Guardar
          </button>
        </div>
      )}

      {/* Exact Center Reticle & World Hover Clue (Minecraft pixel crosshair) */}
      <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center">
        <div
          className={`w-3 h-3 rounded-none border-2 ${
            hud.weaponEquipped
              ? 'border-red-400 bg-red-500/40'
              : hud.heldItemLabel
              ? 'border-amber-300 bg-amber-400/60'
              : 'border-amber-100/90 bg-stone-950/40'
          }`}
        />
        {(hud.hoveredLabel || hud.heldItemLabel) && (
          <div className="mt-2.5 px-3 py-1.5 mc-panel text-center whitespace-nowrap">
            <div className="text-xs font-bold text-amber-200">
              {hud.heldItemLabel ? `Tenés: ${hud.heldItemLabel}` : hud.hoveredLabel}
              {hud.hoveredPrice ? ` · $${hud.hoveredPrice.toLocaleString('es-AR')}` : ''}
            </div>
            {hud.hoveredHint && <div className="text-[11px] text-stone-200">{hud.hoveredHint}</div>}
          </div>
        )}
      </div>

      {/* Attacking Horror Alert Banner */}
      {hud.npcStatus === 'attacking' && (
        <div
          className="fixed top-14 left-1/2 -translate-x-1/2 z-20 px-4 py-2 mc-panel bg-[#7f1d1d]/95 border-[#fca5a5] text-white animate-pulse flex items-center gap-2 pointer-events-none"
          data-testid="attack-alert-banner"
        >
          <ShieldAlert className="w-5 h-5 text-red-200 shrink-0" />
          <span className="text-xs sm:text-sm font-display font-bold tracking-wide whitespace-nowrap">
            ¡CUIDADO! ¡ESTÁ ATACANDO! Tocá Arma y Dispará
          </span>
        </div>
      )}

      {/* Random Environmental Horror Event Banner (cleanly tucked under top-right bar) */}
      {hud.activeHorrorEvent && hud.npcStatus !== 'attacking' && (
        <div
          className={`fixed z-20 pointer-events-none mc-panel px-2.5 py-1.5 flex items-center gap-2 max-w-[270px] md:max-w-[320px] ${
            compact ? 'top-[50px] right-2' : 'top-[58px] right-3'
          } ${
            hud.activeHorrorEvent.type === 'aisle_shadow'
              ? 'border-sky-400/80 text-sky-100'
              : 'border-red-500/85 text-red-100'
          }`}
          data-testid="horror-event-banner"
        >
          {hud.activeHorrorEvent.type === 'aisle_shadow' ||
          hud.activeHorrorEvent.type === 'shelf_drop' ? (
            <Ghost className="w-4 h-4 text-sky-300 shrink-0 animate-pulse" />
          ) : (
            <Zap className="w-4 h-4 text-red-300 shrink-0 animate-pulse" />
          )}
          <div className="min-w-0">
            <div className="text-[10px] md:text-[11px] font-display font-bold uppercase tracking-wide leading-tight truncate">
              {hud.activeHorrorEvent.title}
            </div>
            <div className="text-[10px] text-stone-200 leading-tight line-clamp-1">
              {hud.activeHorrorEvent.detail}
            </div>
          </div>
        </div>
      )}

      {/* Roadside Secret Discovery Toast */}
      {secretToast && (
        <div
          data-hud-interactive="true"
          onPointerDown={(e) => e.stopPropagation()}
          className="fixed top-16 left-1/2 -translate-x-1/2 z-20 max-w-md px-4 py-2.5 mc-panel border-[#38bdf8] text-sky-50 pointer-events-auto flex items-start justify-between gap-3"
          data-testid="secret-discovery-toast"
        >
          <div>
            <div className="text-xs font-bold text-sky-300 flex items-center gap-1.5">
              <Compass className="w-4 h-4" />
              <span>
                ¡Pista del Súper! {secretToast.secret.title}
                {secretToast.byPlayerName ? ` (por ${secretToast.byPlayerName})` : ''}
              </span>
            </div>
            <p className="text-[11px] text-sky-100 mt-0.5 leading-snug">
              {secretToast.secret.discoveryText} (+${secretToast.secret.rewardCash.toLocaleString('es-AR')})
            </p>
          </div>
          <button
            type="button"
            onClick={onDismissSecretToast}
            className="mc-btn mc-btn-dark px-2 py-0.5 text-xs font-bold cursor-pointer"
            aria-label="Cerrar aviso de secreto"
          >
            ✕
          </button>
        </div>
      )}

      {/* Gemini Error Toast */}
      {geminiError && (
        <div className="absolute top-20 right-4 max-w-sm px-4 py-3 mc-panel bg-[#450a0a]/95 border-[#f87171] text-red-100 text-xs pointer-events-auto flex items-start justify-between gap-3">
          <div>
            <div className="font-bold text-red-300">No pudimos llamar otro cliente</div>
            <div className="mt-0.5">{geminiError}</div>
          </div>
          <button
            type="button"
            onClick={onDismissGeminiError}
            className="mc-btn mc-btn-red px-2 py-0.5 text-xs font-bold cursor-pointer"
            aria-label="Cerrar aviso de error"
          >
            ✕
          </button>
        </div>
      )}

      {/* Bottom-Left Solid Touch Virtual Joystick (never rotates camera) */}
      <div
        data-hud-interactive="true"
        onPointerDown={(e) => {
          e.stopPropagation();
          e.preventDefault();
        }}
        onPointerMove={(e) => e.stopPropagation()}
        onPointerUp={(e) => e.stopPropagation()}
        onPointerCancel={(e) => e.stopPropagation()}
        onTouchStart={(e) => e.stopPropagation()}
        onTouchMove={(e) => e.stopPropagation()}
        className={`absolute pointer-events-auto select-none touch-none ${
          compact ? 'bottom-2 left-2' : 'bottom-3 left-3'
        }`}
        aria-label="Palanca para caminar"
      >
        <div
          ref={joystickBaseRef}
          data-testid="movement-joystick"
          data-hud-interactive="true"
          onPointerDown={(e) => {
            e.preventDefault();
            e.stopPropagation();
            if (joystickPointerId.current !== null && joystickPointerId.current !== e.pointerId) {
              return;
            }
            e.currentTarget.setPointerCapture(e.pointerId);
            joystickPointerId.current = e.pointerId;
            updateJoystickFromPointer(e.clientX, e.clientY);
          }}
          onPointerMove={(e) => {
            e.stopPropagation();
            if (joystickPointerId.current !== e.pointerId) return;
            updateJoystickFromPointer(e.clientX, e.clientY);
          }}
          onPointerUp={(e) => {
            e.stopPropagation();
            if (joystickPointerId.current !== e.pointerId) return;
            if (e.currentTarget.hasPointerCapture(e.pointerId)) {
              e.currentTarget.releasePointerCapture(e.pointerId);
            }
            resetJoystick();
          }}
          onPointerCancel={(e) => {
            e.stopPropagation();
            if (joystickPointerId.current !== e.pointerId) return;
            resetJoystick();
          }}
          onTouchStart={(e) => e.stopPropagation()}
          onTouchMove={(e) => e.stopPropagation()}
          className={`relative mc-dpad-base flex items-center justify-center cursor-grab active:cursor-grabbing touch-none select-none ${
            compact ? 'w-[116px] h-[116px]' : 'w-[130px] h-[130px]'
          }`}
        >
          {/* Carved Minecraft D-Pad Quadrant Cross */}
          <div className="w-11 h-[84%] mc-slot opacity-65 pointer-events-none" />
          <div className="absolute h-11 w-[84%] mc-slot opacity-65 pointer-events-none" />
          <span className="absolute top-1.5 text-[11px] text-amber-200 font-bold pointer-events-none drop-shadow">
            ▲
          </span>
          <span className="absolute bottom-1.5 text-[11px] text-amber-200 font-bold pointer-events-none drop-shadow">
            ▼
          </span>
          <span className="absolute left-2 text-[11px] text-amber-200 font-bold pointer-events-none drop-shadow">
            ◀
          </span>
          <span className="absolute right-2 text-[11px] text-amber-200 font-bold pointer-events-none drop-shadow">
            ▶
          </span>
          <div
            data-testid="joystick-knob"
            style={{
              transform: `translate(${knobOffset.x}px, ${knobOffset.y}px)`,
            }}
            className={`absolute mc-dpad-knob pointer-events-none flex items-center justify-center ${
              compact ? 'w-11 h-11' : 'w-12 h-12'
            }`}
          >
            <span className="text-[9px] font-bold uppercase tracking-tighter text-white">
              Mover
            </span>
          </div>
        </div>
      </div>

      {/* Bottom-Center: Plain Small Floating Voice Subtitles + Mission Actions (no box/rectangle) */}
      <div
        data-hud-interactive="true"
        onPointerDown={(e) => e.stopPropagation()}
        className={`absolute pointer-events-auto flex flex-col items-center text-center ${
          compact
            ? 'bottom-2 left-[132px] right-[230px]'
            : 'bottom-3 left-1/2 -translate-x-1/2 w-[min(560px,46vw)] min-w-[260px]'
        }`}
      >
        <p
          className={`${
            compact ? 'text-[11px] line-clamp-2' : 'text-xs md:text-[13px]'
          } text-amber-50 font-semibold leading-snug [text-shadow:0_1px_3px_#000,0_0_8px_rgba(0,0,0,0.96),0_0_2px_#000]`}
          data-testid="hud-subtitles"
        >
          {speaking.loading && (
            <span className="text-amber-300 mr-1.5 font-mono-num text-[10px]">[Cargando voz]</span>
          )}
          {subtitleText}
        </p>

        {speaking.error && (
          <p className="mt-0.5 text-[10px] text-amber-300 [text-shadow:0_1px_3px_#000,0_0_6px_#000]">
            {speaking.error}
          </p>
        )}

        {/* Action Checklist Directly Below Voice Subtitles (plain floating text) */}
        <div
          className="mt-1 flex flex-col items-center gap-0.5"
          data-testid="hud-mission-actions"
        >
          {missionSteps.slice(0, compact ? 2 : 3).map((step) => (
            <div
              key={step.id}
              className={`flex items-center justify-center gap-1 ${
                compact ? 'text-[10px]' : 'text-[11px]'
              } leading-tight [text-shadow:0_1px_3px_#000,0_0_7px_rgba(0,0,0,0.95)] ${
                step.done
                  ? 'text-emerald-300 line-through opacity-85'
                  : step.active
                  ? 'text-amber-300 font-bold'
                  : 'text-stone-200'
              }`}
            >
              <span className="shrink-0 font-mono-num">
                {step.done ? '✓' : step.active ? '▸' : '•'}
              </span>
              <span className={compact ? 'truncate max-w-full' : ''}>{step.text}</span>
            </div>
          ))}
        </div>

        <div className="mt-1.5 flex items-center justify-center gap-1.5">
          {hud.activeNpc && hud.npcStatus !== 'approaching' && (
            <button
              type="button"
              tabIndex={-1}
              onClick={(e) => {
                e.currentTarget.blur();
                onReplayNpcVoice();
              }}
              className="px-2 py-0.5 mc-btn mc-btn-gold text-[10px] font-bold flex items-center gap-1 cursor-pointer"
              aria-label="Escuchar voz del cliente"
            >
              <Volume2 className="w-3 h-3" />
              <span>Oír</span>
            </button>
          )}
          <button
            type="button"
            tabIndex={-1}
            disabled={geminiLoading}
            onClick={(e) => {
              e.currentTarget.blur();
              onRequestGeminiNpc();
            }}
            className="px-2 py-0.5 mc-btn mc-btn-diamond text-[10px] font-bold flex items-center gap-1 cursor-pointer"
          >
            <Sparkles className="w-3 h-3" />
            <span>{geminiLoading ? '...' : 'Otro Cliente'}</span>
          </button>
        </div>
      </div>

      {/* Bottom-Right Thumb Cluster: Modifiable Agarrar & Tirar + Cobrar & Arma */}
      <div
        className={`absolute flex flex-col items-end pointer-events-none ${
          compact ? 'bottom-2.5 right-2.5 gap-1.5' : 'bottom-3.5 right-3.5 gap-2'
        }`}
        aria-label="Botones de acción"
      >
        {/* Modifiable Agarrar & Tirar buttons */}
        {renderModifiableButton(
          'grab',
          onGrabAction,
          false,
          hud.hoveredTargetType === 'secret'
            ? 'mc-btn-diamond ring-2 ring-sky-200'
            : hud.hoveredPrice !== null && !hud.heldItemLabel
            ? 'mc-btn-diamond ring-2 ring-sky-300/70'
            : 'mc-btn-stone',
          <Hand className="w-4 h-4 shrink-0" />,
          hud.hoveredTargetType === 'secret' ? 'Investigar' : undefined
        )}
        {renderModifiableButton(
          'drop',
          onDropAction,
          !hud.heldItemLabel,
          hud.heldItemLabel ? 'mc-btn-green ring-2 ring-emerald-200/70' : 'mc-btn-gold',
          <ArrowDownToLine className="w-4 h-4 shrink-0" />,
          hud.heldProductId &&
            (hud.hoveredTargetType === 'restock_zone' ||
              hud.restockZones.some(
                (z) => z.needsRestock && z.acceptedProducts.includes(hud.heldProductId!)
              ))
            ? 'Reponer'
            : undefined
        )}

        <div
          data-hud-interactive="true"
          onPointerDown={(e) => e.stopPropagation()}
          className={`flex pointer-events-auto ${compact ? 'gap-1.5' : 'gap-2'}`}
        >
          <button
            type="button"
            tabIndex={-1}
            disabled={!(hud.activeNpc && hud.npcStatus === 'waiting')}
            onClick={(e) => {
              e.currentTarget.blur();
              onOpenPayment();
            }}
            className={`${
              compact ? 'min-h-[44px] px-3.5 py-2 text-xs' : 'min-h-[48px] px-4 py-2.5 text-sm'
            } mc-btn font-display font-bold tracking-wide cursor-pointer disabled:cursor-not-allowed flex items-center gap-1.5 ${
              hud.orderEval?.isComplete
                ? 'mc-btn-green ring-2 ring-emerald-200/70'
                : 'mc-btn-gold'
            }`}
          >
            <Banknote className="w-4 h-4 shrink-0" />
            <span>Cobrar</span>
          </button>

          <button
            type="button"
            tabIndex={-1}
            onClick={(e) => {
              e.currentTarget.blur();
              onToggleWeapon();
            }}
            className={`${
              compact ? 'min-h-[44px] px-3 py-2 text-xs' : 'min-h-[48px] px-3.5 py-2.5 text-sm'
            } mc-btn font-bold cursor-pointer flex items-center gap-1.5 ${
              hud.weaponEquipped ? 'mc-btn-red' : 'mc-btn-dark'
            }`}
            aria-label="Sacar o guardar arma de abajo del mostrador"
          >
            <ShieldAlert className="w-4 h-4 shrink-0 text-red-200" />
            <span>{hud.weaponEquipped ? 'Guardar' : 'Arma'}</span>
          </button>

          {hud.weaponEquipped && (
            <button
              type="button"
              tabIndex={-1}
              onClick={(e) => {
                e.currentTarget.blur();
                onFireWeapon();
              }}
              className={`${
                compact ? 'min-h-[44px] px-3 py-2 text-xs' : 'min-h-[48px] px-4 py-2.5 text-sm'
              } mc-btn mc-btn-red font-bold cursor-pointer flex items-center gap-1.5`}
              aria-label="Disparar tiro de advertencia"
            >
              <Flame className="w-4 h-4 shrink-0" />
              <span>Disparar</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
