import React, { useEffect, useState } from 'react';
import { Play, UserRound, Users } from 'lucide-react';
import { PWAInstallButton } from './PWAInstallButton';
import { createRoomCode, sanitizeRoomCode } from '../game/kioscoLogic';
import type { OnlineStateView } from '../game/multiplayerClient';
import type { PlayerProfile } from '../game/types';

interface TitleScreenProps {
  profile: PlayerProfile;
  onlineState: OnlineStateView;
  onStart: () => void;
  onOpenCharacter: () => void;
  onJoinRoom: (roomCode: string) => void;
  onLeaveRoom: () => void;
}

export const TitleScreen: React.FC<TitleScreenProps> = ({
  profile,
  onlineState,
  onStart,
  onOpenCharacter,
  onJoinRoom,
  onLeaveRoom,
}) => {
  const [roomInput, setRoomInput] = useState(onlineState.roomCode || 'SUPER3');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (onlineState.roomCode) {
      setRoomInput(onlineState.roomCode);
    }
  }, [onlineState.roomCode]);

  const isConnected = onlineState.status === 'connected';
  const isConnecting = onlineState.status === 'connecting';

  const handleCopyInvite = () => {
    const code = sanitizeRoomCode(onlineState.roomCode || roomInput);
    const url = `${window.location.origin}${window.location.pathname}?sala=${code}`;
    navigator.clipboard?.writeText(url).catch(() => {});
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  };

  return (
    <div className="fixed inset-0 z-20 flex flex-col justify-between p-3 md:p-7 pointer-events-none">
      {/* Upper-left Horror Supermarket Marquee + Compact Phone-Ready Controls */}
      <div className="flex flex-col items-start max-w-2xl pointer-events-auto">
        <svg
          viewBox="0 0 540 165"
          className="w-full max-w-[min(320px,54vh)] md:max-w-[min(450px,74vh)] drop-shadow-[0_10px_24px_rgba(0,0,0,0.85)]"
          role="img"
          aria-label="Súper Nocturno 3 AM — Supermercado de Terror"
        >
          <rect
            x="6"
            y="6"
            width="528"
            height="153"
            rx="10"
            fill="#0b0f17"
            fillOpacity="0.94"
            stroke="#dc2626"
            strokeWidth="4"
          />
          <rect
            x="15"
            y="15"
            width="510"
            height="135"
            rx="6"
            fill="none"
            stroke="#38bdf8"
            strokeWidth="2"
            strokeDasharray="8 5"
          />
          <text
            x="270"
            y="60"
            textAnchor="middle"
            fill="#fef2f2"
            fontSize="38"
            fontWeight="700"
            fontFamily="Chakra Petch, sans-serif"
            letterSpacing="3"
          >
            SÚPER NOCTURNO
          </text>
          <text
            x="270"
            y="97"
            textAnchor="middle"
            fill="#f87171"
            fontSize="17"
            fontWeight="700"
            fontFamily="Chakra Petch, sans-serif"
            letterSpacing="2.4"
          >
            SUPERMERCADO DE TERROR · 03:00 AM
          </text>
          <line x1="65" y1="113" x2="475" y2="113" stroke="#7f1d1d" strokeWidth="2" />
          <text
            x="270"
            y="136"
            textAnchor="middle"
            fill="#cbd5e1"
            fontSize="12.5"
            fontWeight="600"
            fontFamily="JetBrains Mono, monospace"
            letterSpacing="1.4"
          >
            TURNO COMPLETO 00:00 A 03:00 AM · REPONER O MORIR
          </text>
        </svg>

        <p className="mt-1.5 px-2.5 py-1 mc-panel text-[11px] md:text-sm text-amber-100/95 max-w-lg leading-snug">
          Vos ({profile.playerName}) y{' '}
          {onlineState.peers.length > 0
            ? onlineState.peers.map((p) => p.profile.playerName).join(', ')
            : profile.friendName}{' '}
          trabajan hasta las 03:00 AM. Reponé comida del Depósito antes que se corten las luces.
        </p>

        <div className="mt-2 flex flex-wrap items-center gap-2">
          <button
            type="button"
            data-start="true"
            onClick={(e) => {
              e.currentTarget.blur();
              onStart();
            }}
            className="min-h-[42px] md:min-h-[46px] px-4 md:px-5 py-2 md:py-2.5 mc-btn mc-btn-gold font-display font-bold text-sm md:text-lg tracking-wide flex items-center gap-2 cursor-pointer"
          >
            <Play className="w-4 h-4 md:w-5 md:h-5 fill-current" />
            <span>ENTRAR AL TURNO</span>
          </button>

          <button
            type="button"
            onClick={(e) => {
              e.currentTarget.blur();
              onOpenCharacter();
            }}
            className="min-h-[42px] md:min-h-[46px] px-3.5 md:px-4 py-2 md:py-2.5 mc-btn mc-btn-stone font-bold text-xs md:text-sm flex items-center gap-1.5 cursor-pointer"
          >
            <UserRound className="w-4 h-4 text-sky-300" />
            <span>Personaje y Modelo 3D</span>
          </button>

          <PWAInstallButton />
        </div>

        {/* Real Online Co-Op Room Panel */}
        <div
          className="mt-2 px-2.5 py-1.5 mc-panel flex flex-wrap items-center gap-2 text-xs text-sky-100"
          data-testid="online-room-panel"
        >
          <span className="font-bold text-sky-300 flex items-center gap-1 text-xs">
            <Users className="w-3.5 h-3.5" />
            <span>Jugar con Amigo:</span>
          </span>
          <input
            type="text"
            aria-label="Código de sala online"
            value={roomInput}
            maxLength={8}
            onChange={(e) => setRoomInput(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
            placeholder="SUPER3"
            className="w-24 px-2 py-1 mc-slot focus:border-sky-400 focus:outline-none font-mono-num text-xs text-white uppercase"
          />
          {!isConnected && !isConnecting ? (
            <>
              <button
                type="button"
                onClick={() => onJoinRoom(sanitizeRoomCode(roomInput))}
                className="min-h-[34px] px-3 py-1 mc-btn mc-btn-diamond font-bold cursor-pointer"
              >
                Entrar
              </button>
              <button
                type="button"
                onClick={() => {
                  const code = createRoomCode();
                  setRoomInput(code);
                  onJoinRoom(code);
                }}
                className="min-h-[34px] px-3 py-1 mc-btn mc-btn-stone font-semibold cursor-pointer"
              >
                Crear Sala
              </button>
            </>
          ) : (
            <>
              <span
                className="px-2.5 py-1 mc-slot border-emerald-400/60 text-emerald-300 font-mono-num"
                data-testid="online-status-badge"
              >
                {isConnecting
                  ? 'Conectando...'
                  : `Sala ${onlineState.roomCode} · ${1 + onlineState.peers.length}/4`}
              </span>
              <button
                type="button"
                onClick={handleCopyInvite}
                className="min-h-[34px] px-2.5 py-1 mc-btn mc-btn-stone font-semibold cursor-pointer"
              >
                {copied ? '¡Copiado! ✓' : 'Invitar'}
              </button>
              <button
                type="button"
                onClick={onLeaveRoom}
                className="min-h-[34px] px-2.5 py-1 mc-btn mc-btn-dark cursor-pointer"
              >
                Salir
              </button>
            </>
          )}
          {onlineState.error && (
            <span className="text-[11px] text-red-300 font-medium">{onlineState.error}</span>
          )}
        </div>
      </div>

      {/* Phone-first kid-friendly bottom hint (floating subtitle text, no clipping) */}
      <div className="w-full flex justify-center">
        <p className="px-2 text-center text-[10px] md:text-xs text-amber-100 font-medium leading-tight [text-shadow:0_1px_3px_#000,0_0_8px_#000]">
          Palanca izquierda: caminar · Deslizá la pantalla: mirar · Reponé comida del Depósito hasta las 03:00 AM
        </p>
      </div>
    </div>
  );
};
