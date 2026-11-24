import React, { useRef, useState } from 'react';
import { Trash2, Upload } from 'lucide-react';
import { SHIRT_OPTIONS } from '../game/kioscoLogic';
import type { PlayerProfile } from '../game/types';

interface CharacterModalProps {
  profile: PlayerProfile;
  onSave: (next: PlayerProfile) => void;
  onUploadCustomModel?: (file: File) => Promise<void>;
  onClearCustomModel?: () => void;
  onClose: () => void;
}

const SKIN_TONES = [
  { label: 'Claro', hex: '#e5b899' },
  { label: 'Trigueño', hex: '#d9a077' },
  { label: 'Moreno', hex: '#b97b52' },
  { label: 'Oscuro', hex: '#8d5534' },
];

const HAIR_COLORS = [
  { label: 'Negro', hex: '#1f1b18' },
  { label: 'Castaño', hex: '#4a3222' },
  { label: 'Rubio', hex: '#c89d54' },
  { label: 'Canoso', hex: '#a6acaf' },
];

export const CharacterModal: React.FC<CharacterModalProps> = ({
  profile,
  onSave,
  onUploadCustomModel,
  onClearCustomModel,
  onClose,
}) => {
  const [draft, setDraft] = useState<PlayerProfile>({ ...profile });
  const [error, setError] = useState('');
  const [modelStatus, setModelStatus] = useState('');
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !onUploadCustomModel) return;
    setError('');
    setModelStatus('');
    setUploading(true);
    try {
      await onUploadCustomModel(file);
      setDraft((prev) => ({ ...prev, customModelName: file.name }));
      setModelStatus(`Modelo 3D cargado: ${file.name}`);
    } catch (err) {
      setError(
        err instanceof Error
          ? `No se pudo leer el modelo 3D: ${err.message}`
          : 'Archivo 3D inválido. Usá formato .glb o .gltf.'
      );
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const pName = draft.playerName.trim();
    const fName = draft.friendName.trim();
    if (!pName || !fName) {
      setError('Completá tu nombre y el de tu compañero antes de guardar.');
      return;
    }
    onSave({ ...draft, playerName: pName, friendName: fName });
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-30 flex items-center justify-center bg-black/75 p-2.5 md:p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Personalizar Personaje y Modelo 3D"
    >
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-lg max-h-[94%] flex flex-col overflow-hidden mc-panel-stone text-amber-50"
      >
        <div className="flex items-center justify-between border-b border-zinc-700 px-3 py-2 md:px-5 md:py-3 shrink-0">
          <div>
            <h2 className="text-base md:text-xl font-display font-bold text-amber-300 leading-tight">
              PERSONALIZAR Y MODELO 3D
            </h2>
            <p className="text-[11px] md:text-xs text-stone-300">
              Elegí nombres, uniforme del súper o cargá tu propio personaje .glb / .gltf.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="min-w-[36px] min-h-[36px] px-2.5 py-1 mc-btn mc-btn-stone text-sm font-bold cursor-pointer shrink-0"
            aria-label="Cerrar personalizar personaje"
          >
            ✕
          </button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto touch-pan-y px-3 py-2 md:px-5 md:py-3 space-y-2.5">
          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <label htmlFor="player-name-input" className="block text-xs font-bold text-amber-200 mb-1">
                Tu Nombre
              </label>
              <input
                id="player-name-input"
                type="text"
                maxLength={20}
                value={draft.playerName}
                onChange={(e) => {
                  setError('');
                  setDraft({ ...draft, playerName: e.target.value });
                }}
                className="w-full px-2.5 py-1.5 mc-slot focus:border-amber-400 focus:outline-none text-xs md:text-sm text-white"
              />
            </div>

            <div>
              <label htmlFor="friend-name-input" className="block text-xs font-bold text-amber-200 mb-1">
                Nombre del Compañero
              </label>
              <input
                id="friend-name-input"
                type="text"
                maxLength={20}
                value={draft.friendName}
                onChange={(e) => {
                  setError('');
                  setDraft({ ...draft, friendName: e.target.value });
                }}
                className="w-full px-2.5 py-1.5 mc-slot focus:border-amber-400 focus:outline-none text-xs md:text-sm text-white"
              />
            </div>
          </div>

          {/* Custom .glb / .gltf 3D Model Upload */}
          <div className="mc-slot p-2.5 space-y-1.5" data-testid="custom-model-section">
            <div className="flex items-center justify-between gap-2">
              <div>
                <div className="text-xs font-bold text-sky-300">
                  Cargar Modelo 3D (.glb / .gltf)
                </div>
                <p className="text-[10px] text-stone-300 leading-tight">
                  Podés subir un archivo .glb aquí o adjuntarlo en el chat.
                </p>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".glb,.gltf"
                  onChange={handleFileChange}
                  className="hidden"
                  data-testid="custom-model-file-input"
                />
                <button
                  type="button"
                  disabled={uploading}
                  onClick={() => fileInputRef.current?.click()}
                  className="min-h-[34px] px-2.5 py-1 mc-btn mc-btn-diamond text-[11px] font-bold flex items-center gap-1 cursor-pointer"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>{uploading ? 'Cargando...' : 'Subir .glb'}</span>
                </button>
                {draft.customModelName && onClearCustomModel && (
                  <button
                    type="button"
                    onClick={() => {
                      onClearCustomModel();
                      setDraft((prev) => ({ ...prev, customModelName: undefined }));
                      setModelStatus('');
                    }}
                    className="min-h-[34px] px-2 py-1 mc-btn mc-btn-red text-[11px] font-bold flex items-center gap-1 cursor-pointer"
                    aria-label="Quitar modelo 3D personalizado"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
            {(draft.customModelName || modelStatus) && (
              <div className="text-[11px] text-emerald-300 font-mono-num truncate">
                {modelStatus || `Activo: ${draft.customModelName}`}
              </div>
            )}
          </div>

          <div>
            <div className="text-xs font-bold text-amber-200 mb-1">Uniforme del Súper</div>
            <div className="grid grid-cols-2 gap-1.5">
              {SHIRT_OPTIONS.map((shirt) => {
                const selected = draft.shirtId === shirt.id;
                return (
                  <button
                    key={shirt.id}
                    type="button"
                    onClick={() => setDraft({ ...draft, shirtId: shirt.id })}
                    className={`min-h-[38px] flex items-center gap-2 px-2.5 py-1.5 mc-btn text-xs font-bold cursor-pointer ${
                      selected ? 'mc-btn-gold' : 'mc-btn-dark'
                    }`}
                  >
                    <span
                      className="w-4 h-4 rounded-none border border-black shrink-0"
                      style={{ backgroundColor: shirt.primary }}
                    />
                    <span className="truncate">{shirt.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="text-xs font-bold text-amber-200 mb-1">Piel</div>
              <div className="flex gap-2">
                {SKIN_TONES.map((t) => (
                  <button
                    key={t.hex}
                    type="button"
                    aria-label={`Piel ${t.label}`}
                    onClick={() => setDraft({ ...draft, skinTone: t.hex })}
                    className={`w-8 h-8 rounded-[2px] border-2 cursor-pointer shadow-[2px_2px_0_#000] ${
                      draft.skinTone === t.hex ? 'border-amber-300 scale-110' : 'border-black'
                    }`}
                    style={{ backgroundColor: t.hex }}
                  />
                ))}
              </div>
            </div>

            <div>
              <div className="text-xs font-bold text-amber-200 mb-1">Pelo</div>
              <div className="flex gap-2">
                {HAIR_COLORS.map((h) => (
                  <button
                    key={h.hex}
                    type="button"
                    aria-label={`Pelo ${h.label}`}
                    onClick={() => setDraft({ ...draft, hairColor: h.hex })}
                    className={`w-8 h-8 rounded-[2px] border-2 cursor-pointer shadow-[2px_2px_0_#000] ${
                      draft.hairColor === h.hex ? 'border-amber-300 scale-110' : 'border-black'
                    }`}
                    style={{ backgroundColor: h.hex }}
                  />
                ))}
              </div>
            </div>
          </div>

          {error && <p className="text-xs font-semibold text-red-400">{error}</p>}
        </div>

        <div className="flex items-center justify-between gap-2 border-t border-zinc-700 px-3 py-2 md:px-5 md:py-3 bg-zinc-900/80 shrink-0">
          <label htmlFor="has-cap-checkbox" className="flex items-center gap-2 text-xs font-semibold text-stone-200 cursor-pointer">
            <input
              id="has-cap-checkbox"
              type="checkbox"
              checked={draft.hasCap}
              onChange={(e) => setDraft({ ...draft, hasCap: e.target.checked })}
              className="w-4 h-4 accent-amber-500"
            />
            <span>Usar gorra puesta</span>
          </label>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="min-h-[38px] px-3.5 py-1.5 mc-btn mc-btn-stone text-xs font-bold cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="min-h-[38px] px-4 py-1.5 mc-btn mc-btn-green text-xs font-display font-bold tracking-wide cursor-pointer"
            >
              GUARDAR
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};
