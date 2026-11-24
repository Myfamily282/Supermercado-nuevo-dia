import React from 'react';
import { CheckCircle2, Compass, Moon, PackageCheck, Sparkles, Store } from 'lucide-react';
import { KIOSCO_UPGRADES, SECRET_EVENTS, getNightChapter } from '../game/kioscoLogic';
import type { KioscoUpgradeId } from '../game/types';

interface NightSummaryModalProps {
  nightNumber: number;
  cash: number;
  customersServed: number;
  restockedCount: number;
  upgrades: KioscoUpgradeId[];
  discoveredSecrets: string[];
  onBuyUpgrade: (upgradeId: KioscoUpgradeId) => void;
  onStartNextNight: () => void;
}

export const NightSummaryModal: React.FC<NightSummaryModalProps> = ({
  nightNumber,
  cash,
  customersServed,
  restockedCount,
  upgrades,
  discoveredSecrets,
  onBuyUpgrade,
  onStartNextNight,
}) => {
  const completedChapter = getNightChapter(nightNumber);
  const nextChapter = getNightChapter(nightNumber + 1);

  return (
    <div
      className="fixed inset-0 z-30 bg-stone-950/90 flex items-center justify-center p-2.5 sm:p-4"
      data-testid="night-summary-modal"
    >
      <div className="w-full max-w-2xl max-h-[94%] mc-panel-stone flex flex-col overflow-hidden text-amber-50">
        {/* Header */}
        <div className="px-4 py-2.5 bg-zinc-900/95 border-b-2 border-black flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 mc-slot flex items-center justify-center shrink-0">
              <Moon className="w-4 h-4 text-emerald-300" />
            </div>
            <div>
              <h2 className="font-display text-base sm:text-xl font-bold text-emerald-300 leading-tight">
                ¡03:00 AM SUPERADAS! · CONTRATO RENOVADO
              </h2>
              <p className="text-[11px] sm:text-xs text-stone-300">
                Terminaste {completedChapter.title}. Preparate para {nextChapter.title}
              </p>
            </div>
          </div>
          <div className="px-3 py-1 mc-slot text-right shrink-0">
            <div className="text-[9px] uppercase text-amber-300/80 font-bold">Tu Plata</div>
            <div className="text-sm sm:text-base font-display font-bold text-amber-300 font-mono-num">
              ${Math.round(cash).toLocaleString('es-AR')}
            </div>
          </div>
        </div>

        {/* Scrollable Body */}
        <div className="px-3 py-2.5 sm:px-4 sm:py-3 overflow-y-auto touch-pan-y space-y-2 flex-1 min-h-0">
          {/* Quick Night Stats */}
          <div className="grid grid-cols-4 gap-2">
            <div className="mc-slot px-2 py-1.5 text-center">
              <div className="text-[10px] uppercase text-stone-400 font-semibold">Clientes</div>
              <div className="text-sm font-bold text-emerald-300 font-mono-num">
                {customersServed}
              </div>
            </div>
            <div className="mc-slot px-2 py-1.5 text-center">
              <div className="text-[10px] uppercase text-stone-400 font-semibold flex items-center justify-center gap-1">
                <PackageCheck className="w-3 h-3 text-emerald-300" />
                <span>Repuestas</span>
              </div>
              <div className="text-sm font-bold text-emerald-300 font-mono-num">
                {restockedCount}
              </div>
            </div>
            <div className="mc-slot px-2 py-1.5 text-center">
              <div className="text-[10px] uppercase text-stone-400 font-semibold flex items-center justify-center gap-1">
                <Compass className="w-3 h-3 text-sky-300" />
                <span>Pistas</span>
              </div>
              <div className="text-sm font-bold text-sky-300 font-mono-num">
                {discoveredSecrets.length} / {SECRET_EVENTS.length}
              </div>
            </div>
            <div className="mc-slot px-2 py-1.5 text-center">
              <div className="text-[10px] uppercase text-stone-400 font-semibold flex items-center justify-center gap-1">
                <Store className="w-3 h-3 text-amber-300" />
                <span>Mejoras</span>
              </div>
              <div className="text-sm font-bold text-amber-300 font-mono-num">
                {upgrades.length} / {KIOSCO_UPGRADES.length}
              </div>
            </div>
          </div>

          {/* Upgrades Shop */}
          <div>
            <div className="text-[11px] font-bold uppercase tracking-wider text-amber-200/90 mb-1 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-amber-300" />
              <span>Mejoras para el Supermercado</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
              {KIOSCO_UPGRADES.map((upg) => {
                const owned = upgrades.includes(upg.id);
                const canAfford = cash >= upg.cost;
                return (
                  <div
                    key={upg.id}
                    className={`mc-slot px-2.5 py-2 flex items-center justify-between gap-2 ${
                      owned ? 'border-emerald-500/70' : ''
                    }`}
                  >
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-amber-100 truncate">
                        {upg.name}
                      </div>
                      <p className="text-[10px] text-stone-300 leading-tight">{upg.description}</p>
                    </div>
                    {owned ? (
                      <div className="px-2 py-1 mc-btn mc-btn-green text-[11px] font-bold flex items-center gap-1 shrink-0">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Listo</span>
                      </div>
                    ) : (
                      <button
                        type="button"
                        disabled={!canAfford}
                        onClick={() => onBuyUpgrade(upg.id)}
                        data-testid={`buy-upgrade-${upg.id}`}
                        className="px-2.5 py-1.5 mc-btn mc-btn-gold text-xs font-bold shrink-0 cursor-pointer disabled:cursor-not-allowed"
                      >
                        ${upg.cost.toLocaleString('es-AR')}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Sticky Footer CTA */}
        <div className="px-4 py-2.5 bg-zinc-900/95 border-t-2 border-black flex items-center justify-between gap-3 shrink-0">
          <div className="text-[11px] text-stone-300 hidden sm:block">
            {nextChapter.subtitle}
          </div>
          <button
            type="button"
            onClick={onStartNextNight}
            data-testid="start-next-night-btn"
            className="ml-auto px-5 py-2.5 mc-btn mc-btn-gold font-display font-bold text-sm sm:text-base tracking-wide cursor-pointer"
          >
            RENOVAR TURNO — NOCHE {nightNumber + 1} →
          </button>
        </div>
      </div>
    </div>
  );
};
