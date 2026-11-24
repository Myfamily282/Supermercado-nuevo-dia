import React from 'react';
import { SENSITIVITY_PRESETS } from '../game/kioscoLogic';
import type { SensitivityPreset } from '../game/types';

interface PauseModalProps {
  cash: number;
  customersServed: number;
  sensitivity: SensitivityPreset;
  onChangeSensitivity: (preset: SensitivityPreset) => void;
  onResume: () => void;
  onOpenTutorial?: () => void;
  onRestart: () => void;
  onReturnTitle: () => void;
}

export const PauseModal: React.FC<PauseModalProps> = ({
  cash,
  customersServed,
  sensitivity,
  onChangeSensitivity,
  onResume,
  onOpenTutorial,
  onRestart,
  onReturnTitle,
}) => {
  return (
    <div
      className="fixed inset-0 z-30 flex items-center justify-center bg-black/75 p-3 md:p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Juego en Pausa"
    >
      <div className="w-full max-w-sm max-h-[92%] overflow-y-auto touch-pan-y mc-panel-stone p-4 md:p-6 text-amber-50 text-center">
        <h2 className="text-xl md:text-2xl font-display font-bold text-amber-300">PAUSA</h2>
        <p className="text-xs text-stone-400 mt-0.5">Súper Nocturno · 00:00 - 03:00 AM</p>

        <div className="mt-3 grid grid-cols-2 gap-2.5">
          <div className="mc-slot p-2.5">
            <div className="text-[10px] uppercase text-stone-400">Plata</div>
            <div className="text-lg font-mono-num font-bold text-amber-300">
              ${Math.round(cash).toLocaleString('es-AR')}
            </div>
          </div>
          <div className="mc-slot p-2.5">
            <div className="text-[10px] uppercase text-stone-400">Clientes</div>
            <div className="text-lg font-mono-num font-bold text-emerald-400">{customersServed}</div>
          </div>
        </div>

        <div className="mt-3 mc-slot p-3 text-left">
          <div className="text-[10px] uppercase tracking-wider text-amber-300 font-bold mb-2">
            Velocidad para moverte y mirar
          </div>
          <div className="grid grid-cols-3 gap-1.5">
            {(['media', 'alta', 'muy_alta'] as SensitivityPreset[]).map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => onChangeSensitivity(preset)}
                className={`min-h-[38px] py-1.5 mc-btn text-xs font-bold cursor-pointer ${
                  sensitivity === preset ? 'mc-btn-gold' : 'mc-btn-stone'
                }`}
              >
                {SENSITIVITY_PRESETS[preset].label}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-4 flex flex-col gap-2">
          <button
            type="button"
            onClick={onResume}
            className="w-full min-h-[44px] py-2.5 mc-btn mc-btn-gold font-display font-bold text-sm cursor-pointer"
          >
            SEGUIR JUGANDO
          </button>
          {onOpenTutorial && (
            <button
              type="button"
              onClick={onOpenTutorial}
              className="w-full min-h-[40px] py-2 mc-btn mc-btn-diamond font-bold text-xs cursor-pointer"
            >
              Ver cómo se juega (Tutorial)
            </button>
          )}
          <button
            type="button"
            onClick={onRestart}
            className="w-full min-h-[40px] py-2 mc-btn mc-btn-stone font-bold text-xs cursor-pointer"
          >
            Empezar de nuevo
          </button>
          <button
            type="button"
            onClick={onReturnTitle}
            className="w-full min-h-[40px] py-2 mc-btn mc-btn-dark font-semibold text-xs cursor-pointer"
          >
            Volver al Inicio
          </button>
        </div>
      </div>
    </div>
  );
};

