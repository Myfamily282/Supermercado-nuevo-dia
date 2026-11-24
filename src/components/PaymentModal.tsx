import React, { useState } from 'react';
import { calculatePayment } from '../game/kioscoLogic';
import type { NpcEncounter, OrderEvaluation, PaymentMethod } from '../game/types';

interface PaymentModalProps {
  npc: NpcEncounter;
  orderEval: OrderEvaluation;
  onQuickFillMissing: () => void;
  onConfirmPayment: (total: number) => void;
  onClose: () => void;
}

const QUICK_BILLS = [1000, 2000, 5000, 10000];

export const PaymentModal: React.FC<PaymentModalProps> = ({
  npc,
  orderEval,
  onQuickFillMissing,
  onConfirmPayment,
  onClose,
}) => {
  const [method, setMethod] = useState<PaymentMethod>(npc.paymentMethod);
  const [tenderedInput, setTenderedInput] = useState<string>(
    String(Math.ceil(orderEval.totalRequestedPrice / 1000) * 1000)
  );
  const [errorMsg, setErrorMsg] = useState('');

  const tenderedNum = Number(tenderedInput) || 0;
  const preview = calculatePayment(orderEval.totalRequestedPrice, tenderedNum, method);

  const handleConfirm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!orderEval.isComplete) {
      setErrorMsg('Todavía faltan productos en el mostrador. Soltalos en la Zona de Entrega primero.');
      return;
    }
    if (!preview.ok) {
      setErrorMsg(preview.error ?? 'Monto insuficiente.');
      return;
    }
    onConfirmPayment(preview.total);
  };

  return (
    <div
      className="fixed inset-0 z-30 flex items-center justify-center bg-black/75 p-3 md:p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Caja Registradora - Procesar Pago"
    >
      <form
        onSubmit={handleConfirm}
        className="w-full max-w-md max-h-[92%] overflow-y-auto touch-pan-y mc-panel-stone p-4 md:p-6 text-amber-50"
      >
        <div className="flex items-center justify-between border-b border-zinc-700 pb-2.5">
          <div>
            <h2 className="text-lg md:text-xl font-display font-bold text-amber-300">CAJA PARA COBRAR</h2>
            <p className="text-xs text-stone-300">Cliente: {npc.npcName}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="min-w-[38px] min-h-[38px] px-2.5 py-1 mc-btn mc-btn-stone text-sm font-bold cursor-pointer"
            aria-label="Cerrar caja"
          >
            ✕
          </button>
        </div>

        {/* Items verification */}
        <div className="mt-3 space-y-2">
          <div className="text-xs font-bold uppercase tracking-wider text-stone-400">
            Lo que pidió el cliente
          </div>
          {orderEval.requested.map((req) => {
            const ok = req.placed >= req.needed;
            return (
              <div
                key={req.productId}
                className={`flex items-center justify-between px-3 py-2 mc-slot text-xs ${
                  ok
                    ? 'border-emerald-500/60 text-emerald-200'
                    : 'border-red-500/60 text-red-200'
                }`}
              >
                <span>
                  {ok ? '✓ ' : '• '}
                  {req.name} ({req.placed}/{req.needed})
                </span>
                <span className="font-mono-num font-bold">
                  ${(req.unitPrice * req.needed).toLocaleString('es-AR')}
                </span>
              </div>
            );
          })}

          {!orderEval.isComplete && (
            <div className="flex items-center justify-between gap-2 mc-slot border-amber-500/60 p-2.5 text-xs text-amber-200">
              <span>Faltan {orderEval.missingCount} producto(s) en el mostrador.</span>
              <button
                type="button"
                onClick={onQuickFillMissing}
                className="min-h-[38px] px-3 py-1.5 mc-btn mc-btn-gold text-xs font-bold cursor-pointer shrink-0"
              >
                Poner rápido
              </button>
            </div>
          )}
        </div>

        {/* Total & Payment method */}
        <div className="mt-3 mc-slot p-3 flex items-center justify-between">
          <span className="text-xs uppercase tracking-wider text-stone-300 font-bold">
            Total a Cobrar
          </span>
          <span className="text-2xl font-display font-bold font-mono-num text-amber-300">
            ${orderEval.totalRequestedPrice.toLocaleString('es-AR')}
          </span>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => {
              setMethod('efectivo');
              setErrorMsg('');
            }}
            className={`min-h-[42px] py-2 mc-btn text-xs font-bold cursor-pointer ${
              method === 'efectivo' ? 'mc-btn-gold' : 'mc-btn-dark'
            }`}
          >
            Efectivo ($)
          </button>
          <button
            type="button"
            onClick={() => {
              setMethod('qr');
              setErrorMsg('');
            }}
            className={`min-h-[42px] py-2 mc-btn text-xs font-bold cursor-pointer ${
              method === 'qr' ? 'mc-btn-diamond' : 'mc-btn-dark'
            }`}
          >
            Celular / QR
          </button>
        </div>

        {method === 'efectivo' ? (
          <div className="mt-3 space-y-2">
            <label htmlFor="cash-tendered-input" className="block text-xs font-bold text-amber-200">
              ¿Con cuánto billete paga? ($ ARS)
            </label>
            <input
              id="cash-tendered-input"
              type="number"
              min={0}
              step={50}
              value={tenderedInput}
              onChange={(e) => {
                setErrorMsg('');
                setTenderedInput(e.target.value);
              }}
              className="w-full px-3 py-2 mc-slot font-mono-num text-base text-white focus:border-amber-400 focus:outline-none"
            />
            <div className="flex flex-wrap gap-1.5">
              {QUICK_BILLS.map((bill) => (
                <button
                  key={bill}
                  type="button"
                  onClick={() => {
                    setErrorMsg('');
                    setTenderedInput(String(bill));
                  }}
                  className="min-h-[36px] px-3 py-1 mc-btn mc-btn-stone text-xs font-mono-num font-bold cursor-pointer"
                >
                  ${bill.toLocaleString('es-AR')}
                </button>
              ))}
            </div>
            <div className="flex items-center justify-between pt-1 text-sm">
              <span className="text-stone-300">Vuelto para darle:</span>
              <span className="font-mono-num font-bold text-emerald-400">
                ${preview.ok ? preview.change.toLocaleString('es-AR') : 0}
              </span>
            </div>
          </div>
        ) : (
          <div className="mt-3 mc-slot border-sky-500/60 p-3 text-xs text-sky-100">
            Pago por celular al alias <span className="font-mono-num font-bold">SUPER.NOCTURNO.3AM</span>.
            No hace falta dar vuelto.
          </div>
        )}

        {errorMsg && <p className="mt-2.5 text-xs font-semibold text-red-400">{errorMsg}</p>}

        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="min-h-[42px] px-4 py-2 mc-btn mc-btn-stone text-xs font-bold cursor-pointer"
          >
            Volver
          </button>
          <button
            type="submit"
            className="min-h-[42px] px-5 py-2 mc-btn mc-btn-green text-xs font-display font-bold tracking-wide cursor-pointer"
          >
            ¡COBRAR!
          </button>
        </div>
      </form>
    </div>
  );
};
