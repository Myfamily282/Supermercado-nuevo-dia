import React, { useState } from 'react';
import {
  ArrowDownToLine,
  Banknote,
  Flashlight,
  Gamepad2,
  Hand,
  Move,
  ShieldAlert,
  SlidersHorizontal,
} from 'lucide-react';

interface TutorialOverlayProps {
  playerName: string;
  onComplete: () => void;
}

export const TutorialOverlay: React.FC<TutorialOverlayProps> = ({
  playerName,
  onComplete,
}) => {
  const [step, setStep] = useState<0 | 1>(0);

  return (
    <div
      className="fixed inset-0 z-20 flex items-center justify-center bg-black/80 p-1.5 md:p-6"
      role="dialog"
      aria-modal="true"
      aria-label="Tutorial para jugar"
      data-testid="tutorial-overlay"
    >
      <div className="w-full max-w-3xl max-h-[96%] flex flex-col mc-panel-stone px-3 py-2 md:p-5 text-amber-50 gap-1.5 md:gap-3">
        {/* Compact Header */}
        <div className="flex items-center justify-between gap-2 border-b border-zinc-700 pb-1 md:pb-2 shrink-0">
          <div className="flex flex-wrap items-baseline gap-x-2">
            <h2 className="text-sm md:text-2xl font-display font-bold text-amber-200 leading-tight">
              ¿CÓMO SE JUEGA?
            </h2>
            <span className="text-[10px] md:text-xs font-mono-num uppercase tracking-wider text-red-300 font-bold">
              Turno hasta las 03:00 AM · {playerName}
            </span>
          </div>

          <button
            type="button"
            onClick={onComplete}
            className="min-h-[32px] md:min-h-[36px] px-2.5 py-0.5 mc-btn mc-btn-stone text-xs font-bold cursor-pointer shrink-0"
          >
            Saltar
          </button>
        </div>

        {/* Step selector tabs */}
        <div className="grid grid-cols-2 gap-1.5 shrink-0">
          <button
            type="button"
            onClick={() => setStep(0)}
            className={`min-h-[32px] md:min-h-[36px] px-2.5 py-1 mc-btn text-[11px] md:text-xs font-bold cursor-pointer ${
              step === 0 ? 'mc-btn-gold' : 'mc-btn-dark'
            }`}
          >
            1. Moverte y Mirar
          </button>
          <button
            type="button"
            onClick={() => setStep(1)}
            className={`min-h-[32px] md:min-h-[36px] px-2.5 py-1 mc-btn text-[11px] md:text-xs font-bold cursor-pointer ${
              step === 1 ? 'mc-btn-gold' : 'mc-btn-dark'
            }`}
          >
            2. Reponer y Sobrevivir
          </button>
        </div>

        {/* Scrollable middle content area (fits cleanly without scroll on 844x390) */}
        <div className="overflow-y-auto touch-pan-y flex-1 min-h-0">
          {step === 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 md:gap-2.5">
              <div className="mc-slot p-2 md:p-3 flex items-start gap-2">
                <div className="w-8 h-8 md:w-11 md:h-11 mc-btn mc-btn-green flex items-center justify-center shrink-0">
                  <Gamepad2 className="w-4 h-4 md:w-5 md:h-5 text-white" />
                </div>
                <div>
                  <h3 className="text-xs md:text-sm font-display font-bold text-amber-300">
                    Palanca izquierda (Mover)
                  </h3>
                  <p className="text-[11px] md:text-xs text-stone-200 mt-0.5 leading-snug">
                    Mové el dedo sobre el botón verde para caminar por las góndolas y el Depósito. Es fijo y no gira la cámara.
                  </p>
                </div>
              </div>

              <div className="mc-slot p-2 md:p-3 flex items-start gap-2">
                <div className="w-8 h-8 md:w-11 md:h-11 mc-btn mc-btn-diamond flex items-center justify-center shrink-0">
                  <Move className="w-4 h-4 md:w-5 md:h-5 text-white" />
                </div>
                <div>
                  <h3 className="text-xs md:text-sm font-display font-bold text-sky-300">
                    Deslizá la pantalla
                  </h3>
                  <p className="text-[11px] md:text-xs text-stone-200 mt-0.5 leading-snug">
                    Tocá la zona libre para mirar las heladeras, las sombras de los pasillos y la Caja 1.
                  </p>
                </div>
              </div>

              <div className="sm:col-span-2 mc-slot px-2.5 py-1.5 flex flex-wrap items-center justify-between gap-2 text-[11px] md:text-xs">
                <div className="flex items-center gap-1.5 text-amber-100">
                  <Flashlight className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  <span>
                    <strong>Luz:</strong> prende tu linterna cuando titilen los tubos.
                  </span>
                </div>
                <div className="flex items-center gap-1.5 text-sky-200">
                  <SlidersHorizontal className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                  <span>
                    <strong>Botones:</strong> mové o agrandá Agarrar y Tirar/Reponer.
                  </span>
                </div>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-1.5 md:gap-2">
              <div className="mc-slot px-2 py-1.5 md:p-3 flex items-start gap-2">
                <div className="w-7 h-7 md:w-10 md:h-10 mc-btn mc-btn-diamond flex items-center justify-center shrink-0">
                  <Hand className="w-4 h-4 md:w-5 md:h-5" />
                </div>
                <div>
                  <h3 className="text-xs md:text-sm font-display font-bold text-sky-300 leading-tight">
                    1. Agarrar comida
                  </h3>
                  <p className="text-[11px] md:text-xs text-stone-200 leading-tight">
                    Buscá carne, leche o bebidas en el <strong>Depósito</strong> y tocá <strong>Agarrar</strong>.
                  </p>
                </div>
              </div>

              <div className="mc-slot px-2 py-1.5 md:p-3 flex items-start gap-2">
                <div className="w-7 h-7 md:w-10 md:h-10 mc-btn mc-btn-green flex items-center justify-center shrink-0">
                  <ArrowDownToLine className="w-4 h-4 md:w-5 md:h-5" />
                </div>
                <div>
                  <h3 className="text-xs md:text-sm font-display font-bold text-emerald-300 leading-tight">
                    2. Reponer Góndolas
                  </h3>
                  <p className="text-[11px] md:text-xs text-stone-200 leading-tight">
                    Acercate a la heladera en rojo o a la Caja y tocá <strong>Reponer / Tirar</strong>.
                  </p>
                </div>
              </div>

              <div className="mc-slot px-2 py-1.5 md:p-3 flex items-start gap-2">
                <div className="w-7 h-7 md:w-10 md:h-10 mc-btn mc-btn-gold flex items-center justify-center shrink-0">
                  <Banknote className="w-4 h-4 md:w-5 md:h-5" />
                </div>
                <div>
                  <h3 className="text-xs md:text-sm font-display font-bold text-amber-300 leading-tight">
                    3. Cobrar en Caja
                  </h3>
                  <p className="text-[11px] md:text-xs text-stone-200 leading-tight">
                    Si llega un cliente nocturno, poné su pedido y tocá <strong>Cobrar</strong>.
                  </p>
                </div>
              </div>

              <div className="mc-slot px-2 py-1.5 md:p-3 flex items-start gap-2">
                <div className="w-7 h-7 md:w-10 md:h-10 mc-btn mc-btn-red flex items-center justify-center shrink-0">
                  <ShieldAlert className="w-4 h-4 md:w-5 md:h-5" />
                </div>
                <div>
                  <h3 className="text-xs md:text-sm font-display font-bold text-red-300 leading-tight">
                    4. Aguantar a las 03:00 AM
                  </h3>
                  <p className="text-[11px] md:text-xs text-stone-200 leading-tight">
                    Si una aparición ataca, tocá <strong>Arma</strong>. ¡Llegá a las 3 AM para renovar turno!
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Sticky Footer actions always visible */}
        <div className="flex items-center justify-between gap-2 pt-1 border-t border-zinc-700 shrink-0">
          <div className="flex items-center gap-1.5 text-xs text-stone-400">
            <span className={`w-2.5 h-2.5 rounded-none border border-black ${step === 0 ? 'bg-amber-400' : 'bg-stone-700'}`} />
            <span className={`w-2.5 h-2.5 rounded-none border border-black ${step === 1 ? 'bg-amber-400' : 'bg-stone-700'}`} />
            <span className="ml-1 font-mono-num text-[11px]">Paso {step + 1} de 2</span>
          </div>

          <div className="flex items-center gap-2">
            {step === 1 && (
              <button
                type="button"
                onClick={() => setStep(0)}
                className="min-h-[36px] md:min-h-[40px] px-3 py-1 mc-btn mc-btn-stone text-xs font-bold cursor-pointer"
              >
                Atrás
              </button>
            )}
            {step === 0 ? (
              <button
                type="button"
                onClick={() => setStep(1)}
                className="min-h-[36px] md:min-h-[40px] px-4 py-1 mc-btn mc-btn-gold font-display font-bold text-xs md:text-sm tracking-wide cursor-pointer"
              >
                SIGUIENTE
              </button>
            ) : (
              <button
                type="button"
                onClick={onComplete}
                data-testid="tutorial-start-btn"
                className="min-h-[36px] md:min-h-[40px] px-4 py-1 mc-btn mc-btn-green font-display font-bold text-xs md:text-sm tracking-wide cursor-pointer"
              >
                ¡LISTO, AL TURNO!
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
