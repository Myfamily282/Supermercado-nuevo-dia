import React, { useState } from 'react';
import { Download, Smartphone, WifiOff } from 'lucide-react';
import { useOnlineStatus, usePWAInstall } from '../hooks/usePWAInstall';

export const PWAInstallButton: React.FC = () => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showGuide, setShowGuide] = useState(false);

  if (isInstalled) {
    return null;
  }

  const handleClick = async () => {
    if (isInstallable) {
      const accepted = await install();
      if (accepted) return;
    }
    setShowGuide(true);
  };

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        data-testid="pwa-install-btn"
        className="min-h-[46px] px-4 py-2.5 mc-btn mc-btn-green font-bold text-xs md:text-sm flex items-center gap-1.5 cursor-pointer"
        aria-label="Instalar juego como app en Android o iPhone"
      >
        {isInstallable ? <Download className="w-4 h-4 shrink-0" /> : <Smartphone className="w-4 h-4 shrink-0" />}
        <span>{isInstallable ? 'Instalar App' : 'App Celu / APK'}</span>
      </button>

      {showGuide && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 pointer-events-auto"
          role="dialog"
          aria-modal="true"
          aria-label="Cómo instalar la app en el celular"
        >
          <div className="w-full max-w-md mc-panel p-5 text-amber-50">
            <h3 className="text-base md:text-lg font-display font-bold text-amber-300 flex items-center gap-2">
              <Smartphone className="w-5 h-5 text-emerald-400" />
              <span>Instalar Súper 3AM en el Celular</span>
            </h3>

            {isIOS ? (
              <ol className="mt-3 space-y-1.5 text-xs md:text-sm text-stone-200 list-decimal list-inside">
                <li>Abrí este juego en Safari.</li>
                <li>Tocá el botón <strong>Compartir</strong> abajo.</li>
                <li>Elegí <strong>Agregar a inicio</strong> para jugarlo en pantalla completa.</li>
              </ol>
            ) : (
              <div className="mt-3 space-y-2 text-xs md:text-sm text-stone-200">
                <p>
                  El juego ya está listo como <strong>App instalable en Android</strong> (icono propio,
                  pantalla completa horizontal y modo sin conexión):
                </p>
                <ol className="space-y-1 list-decimal list-inside text-amber-100">
                  <li>Abrí el enlace compartido del juego en <strong>Google Chrome</strong> en tu Android.</li>
                  <li>Tocá el menú <strong>⋮</strong> arriba a la derecha y elegí <strong>Instalar aplicación</strong>.</li>
                </ol>
                <p className="text-[11px] text-stone-400">
                  Si querés generar un archivo <strong>.apk</strong> aparte para pasar por WhatsApp, podés
                  pegar la URL pública del juego en <strong>PWABuilder</strong> (opción Android APK).
                </p>
              </div>
            )}

            <button
              type="button"
              onClick={() => setShowGuide(false)}
              className="mt-4 w-full min-h-[42px] mc-btn mc-btn-gold font-bold text-sm cursor-pointer"
            >
              Entendido
            </button>
          </div>
        </div>
      )}
    </>
  );
};

export const OfflineIndicator: React.FC = () => {
  const isOnline = useOnlineStatus();

  if (isOnline) return null;

  return (
    <div
      className="fixed bottom-3 left-1/2 -translate-x-1/2 z-50 px-3 py-1 mc-panel border-amber-400 text-amber-200 text-[11px] font-bold flex items-center gap-1.5 pointer-events-none"
      data-testid="offline-indicator"
    >
      <WifiOff className="w-3.5 h-3.5 text-amber-300" />
      <span>Sin internet · Modo local guardado</span>
    </div>
  );
};
