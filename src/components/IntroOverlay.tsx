import React, { useEffect, useMemo, useState } from 'react';
import { buildIntroBeats } from '../game/kioscoLogic';
import type { PlayerProfile } from '../game/types';
import { voiceEngine, type SpeakingState } from '../game/voiceEngine';

interface IntroOverlayProps {
  profile: PlayerProfile;
  muted: boolean;
  onToggleMute: () => void;
  onComplete: () => void;
}

export const IntroOverlay: React.FC<IntroOverlayProps> = ({
  profile,
  muted,
  onToggleMute,
  onComplete,
}) => {
  const beats = useMemo(
    () => buildIntroBeats(profile.playerName, profile.friendName),
    [profile.playerName, profile.friendName]
  );
  const [step, setStep] = useState(0);
  const [speaking, setSpeaking] = useState<SpeakingState>(() => voiceEngine.getSpeakingState());
  const current = beats[step];
  const isLast = step >= beats.length - 1;

  useEffect(() => {
    const unsub = voiceEngine.subscribe(setSpeaking);
    return () => {
      unsub();
      voiceEngine.stop();
    };
  }, []);

  useEffect(() => {
    if (!current || muted) return;
    voiceEngine.speakIntroBeat(current.narration, profile.friendName, current.friendSpeech);
  }, [step, current, profile.friendName, muted]);

  const handleReplayVoice = () => {
    if (muted) {
      onToggleMute();
    }
    voiceEngine.setMuted(false);
    voiceEngine.speakIntroBeat(current.narration, profile.friendName, current.friendSpeech);
  };

  const handleNext = () => {
    voiceEngine.stop();
    if (isLast) {
      onComplete();
    } else {
      setStep((s) => s + 1);
    }
  };

  return (
    <div
      className="fixed inset-0 z-20 flex flex-col justify-between p-3 md:p-8 pointer-events-none"
      role="dialog"
      aria-label="Introducción de la historia"
    >
      {/* Top cinematic location stamp */}
      <div className="flex items-center justify-between gap-2">
        <div className="px-3 py-1.5 mc-panel">
          <div className="text-[11px] md:text-xs font-mono-num font-bold tracking-widest text-amber-400">
            {current.title}
          </div>
          <div className="text-[10px] md:text-[11px] text-stone-400">{current.subtitle}</div>
        </div>

        <div className="flex items-center gap-2 pointer-events-auto">
          <button
            type="button"
            onClick={(e) => {
              e.currentTarget.blur();
              onToggleMute();
            }}
            className="min-h-[40px] px-3 py-2 mc-btn mc-btn-dark text-amber-200 text-xs font-bold cursor-pointer"
            aria-label={muted ? 'Activar voz de introducción' : 'Silenciar voz de introducción'}
          >
            {muted ? 'Voz: Apagada' : 'Voz: Prendida'}
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.currentTarget.blur();
              voiceEngine.stop();
              onComplete();
            }}
            className="min-h-[40px] px-4 py-2 mc-btn mc-btn-stone text-xs font-bold cursor-pointer"
          >
            Saltar
          </button>
        </div>
      </div>

      {/* Bottom floating plain subtitles (no square/rectangle panel) */}
      <div className="mx-auto w-full max-w-2xl px-2 pb-1 text-center pointer-events-auto">
        <div
          className="inline-flex items-center justify-center gap-2 text-[10px] md:text-[11px] font-mono-num text-amber-300/95 mb-1 [text-shadow:0_1px_3px_#000,0_0_8px_#000]"
          data-testid="intro-voice-status"
        >
          {speaking.loading ? (
            <span>Preparando voz: {speaking.speakerName}...</span>
          ) : speaking.active ? (
            <span>Hablando: {speaking.speakerName}</span>
          ) : (
            <span>
              {step + 1} / {beats.length}
            </span>
          )}
        </div>

        <p
          className="text-xs md:text-sm text-amber-50 font-medium leading-snug [text-shadow:0_1px_3px_#000,0_0_10px_rgba(0,0,0,0.96),0_0_2px_#000]"
          data-testid="intro-subtitles"
        >
          {current.narration}
        </p>
        <p className="mt-1 text-xs md:text-sm font-semibold text-amber-300 [text-shadow:0_1px_3px_#000,0_0_10px_rgba(0,0,0,0.96),0_0_2px_#000]">
          {current.speakerLine}
        </p>

        {speaking.error && (
          <p className="mt-1 text-[10px] text-amber-200 [text-shadow:0_1px_2px_#000]">
            {speaking.error}
          </p>
        )}

        <div className="mt-2.5 flex items-center justify-center gap-2.5">
          <button
            type="button"
            onClick={(e) => {
              e.currentTarget.blur();
              handleReplayVoice();
            }}
            className="min-h-[40px] px-3.5 py-1.5 mc-btn mc-btn-stone text-xs font-bold flex items-center gap-1.5 cursor-pointer"
          >
            <svg viewBox="0 0 24 24" className="w-4 h-4 fill-none stroke-current" strokeWidth="2">
              <path d="M11 5L6 9H2v6h4l5 4V5z" />
              <path d="M15.5 8.5a5 5 0 010 7" />
            </svg>
            <span>Escuchar de nuevo</span>
          </button>

          <button
            type="button"
            onClick={(e) => {
              e.currentTarget.blur();
              handleNext();
            }}
            className="min-h-[40px] px-5 py-1.5 mc-btn mc-btn-gold font-display font-bold text-sm tracking-wide cursor-pointer"
          >
            {isLast ? 'EMPEZAR A JUGAR' : 'SIGUIENTE'}
          </button>
        </div>
      </div>
    </div>
  );
};
