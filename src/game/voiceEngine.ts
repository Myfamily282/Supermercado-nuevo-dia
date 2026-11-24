import {
  getFriendVoiceProfile,
  getNarratorVoiceProfile,
  getNpcVoiceProfile,
} from './kioscoLogic';
import type { NpcEncounter, VoiceProfile } from './types';

export type VoiceSpeakerKind = 'narrator' | 'npc' | 'friend';

export interface SpeakingState {
  active: boolean;
  loading: boolean;
  kind: VoiceSpeakerKind | null;
  speakerName: string;
  voiceLabel: string;
  text: string;
  error: string | null;
}

export interface SpeechSegment {
  kind: VoiceSpeakerKind;
  speakerName: string;
  text: string;
  profile: VoiceProfile;
}

const IDLE_STATE: SpeakingState = {
  active: false,
  loading: false,
  kind: null,
  speakerName: '',
  voiceLabel: '',
  text: '',
  error: null,
};

class VoiceEngine {
  private muted = false;
  private state: SpeakingState = IDLE_STATE;
  private listeners = new Set<(state: SpeakingState) => void>();
  private queueId = 0;
  private currentAudio: HTMLAudioElement | null = null;
  private currentAbort: AbortController | null = null;
  private audioDataCache = new Map<string, string>();
  private inFlightCache = new Map<string, Promise<string>>();

  public setMuted(muted: boolean) {
    this.muted = muted;
    if (muted) {
      this.stop();
    }
  }

  public isMuted(): boolean {
    return this.muted;
  }

  public getSpeakingState(): SpeakingState {
    return this.state;
  }

  public subscribe(listener: (state: SpeakingState) => void): () => void {
    this.listeners.add(listener);
    listener(this.state);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private setState(next: SpeakingState) {
    this.state = next;
    for (const listener of this.listeners) {
      listener(next);
    }
  }

  public clearError() {
    if (this.state.error) {
      this.setState({ ...this.state, error: null });
    }
  }

  public stop() {
    this.queueId++;
    if (this.currentAbort) {
      this.currentAbort.abort();
      this.currentAbort = null;
    }
    if (this.currentAudio) {
      try {
        this.currentAudio.pause();
        this.currentAudio.currentTime = 0;
        this.currentAudio.src = '';
      } catch {
        // Ignore cleanup errors
      }
      this.currentAudio = null;
    }
    this.setState(IDLE_STATE);
  }

  private makeCacheKey(text: string, profile: VoiceProfile): string {
    return `${profile.voiceName}::${profile.voiceStyle}::${text.trim()}`;
  }

  private async fetchHumanAudioUrl(
    text: string,
    profile: VoiceProfile,
    signal?: AbortSignal
  ): Promise<string> {
    const cleanText = text.trim();
    const key = this.makeCacheKey(cleanText, profile);
    const cached = this.audioDataCache.get(key);
    if (cached) return cached;

    const existingPromise = this.inFlightCache.get(key);
    if (existingPromise) return existingPromise;

    const promise = (async () => {
      let lastError: Error | null = null;
      for (let attempt = 0; attempt < 2; attempt++) {
        if (signal?.aborted) {
          throw new DOMException('Aborted', 'AbortError');
        }
        try {
          const res = await fetch('/api/kiosco/tts', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            signal,
            body: JSON.stringify({
              text: cleanText,
              voiceName: profile.voiceName,
              style: profile.voiceStyle,
            }),
          });
          const data = await res.json();
          if (!res.ok) {
            const msg = data.error || `Error HTTP ${res.status} al generar voz`;
            if (res.status >= 500 && attempt === 0) {
              lastError = new Error(msg);
              await new Promise((r) => setTimeout(r, 300));
              continue;
            }
            const err = new Error(msg);
            (err as Error & { noRetry?: boolean }).noRetry = res.status < 500;
            throw err;
          }
          if (!data.audioBase64) {
            throw new Error('La respuesta de voz no incluyó audio.');
          }
          const dataUrl = `data:${data.mimeType || 'audio/wav'};base64,${data.audioBase64}`;
          if (this.audioDataCache.size >= 60) {
            const firstKey = this.audioDataCache.keys().next().value;
            if (firstKey) this.audioDataCache.delete(firstKey);
          }
          this.audioDataCache.set(key, dataUrl);
          return dataUrl;
        } catch (err: unknown) {
          if (signal?.aborted || (err instanceof DOMException && err.name === 'AbortError')) {
            throw err;
          }
          lastError = err instanceof Error ? err : new Error('No se pudo cargar la voz.');
          const noRetry = Boolean((err as { noRetry?: boolean })?.noRetry);
          if (attempt === 0 && !noRetry) {
            await new Promise((r) => setTimeout(r, 300));
            continue;
          }
          break;
        }
      }
      throw lastError ?? new Error('No se pudo cargar la voz.');
    })();

    this.inFlightCache.set(key, promise);
    try {
      return await promise;
    } finally {
      this.inFlightCache.delete(key);
    }
  }

  public prefetch(text: string, profile: VoiceProfile) {
    if (this.muted || !text.trim()) return;
    this.fetchHumanAudioUrl(text, profile).catch(() => {
      // Prefetch errors are handled when active playback requests the line
    });
  }

  public prefetchIntroBeat(_narration: string, _friendName: string, _friendSpeech: string) {
    // On-demand playback only to respect Gemini TTS requests-per-minute quota
  }

  public prefetchNpcArrival(_encounter: NpcEncounter, _friendName: string) {
    // On-demand playback only to respect Gemini TTS requests-per-minute quota
  }

  public async speakQueue(segments: SpeechSegment[]) {
    this.stop();
    if (this.muted || segments.length === 0) return;

    const myQueueId = this.queueId;

    for (let i = 0; i < segments.length; i++) {
      if (this.muted || myQueueId !== this.queueId) return;
      const seg = segments[i];
      const controller = new AbortController();
      this.currentAbort = controller;

      this.setState({
        active: false,
        loading: true,
        kind: seg.kind,
        speakerName: seg.speakerName,
        voiceLabel: seg.profile.label,
        text: seg.text,
        error: null,
      });

      try {
        const dataUrl = await this.fetchHumanAudioUrl(seg.text, seg.profile, controller.signal);
        if (this.muted || myQueueId !== this.queueId) return;

        await new Promise<void>((resolve) => {
          const audio = new Audio(dataUrl);
          this.currentAudio = audio;
          audio.volume = 0.96;

          const finish = () => {
            audio.onended = null;
            audio.onerror = null;
            if (this.currentAudio === audio) {
              this.currentAudio = null;
            }
            resolve();
          };

          audio.onended = finish;
          audio.onerror = finish;

          this.setState({
            active: true,
            loading: false,
            kind: seg.kind,
            speakerName: seg.speakerName,
            voiceLabel: seg.profile.label,
            text: seg.text,
            error: null,
          });

          audio.play().catch(() => {
            finish();
          });
        });
      } catch (err: unknown) {
        if (controller.signal.aborted || myQueueId !== this.queueId) {
          return;
        }
        const message =
          err instanceof Error ? err.message : 'No se pudo reproducir la voz humana.';
        this.setState({
          active: false,
          loading: false,
          kind: seg.kind,
          speakerName: seg.speakerName,
          voiceLabel: seg.profile.label,
          text: seg.text,
          error: message,
        });
        return;
      }
    }

    if (myQueueId === this.queueId) {
      this.setState(IDLE_STATE);
    }
  }

  public speakIntroBeat(narration: string, friendName: string, friendSpeech: string) {
    this.speakQueue([
      {
        kind: 'narrator',
        speakerName: 'Voz de Introducción',
        text: narration,
        profile: getNarratorVoiceProfile(),
      },
      {
        kind: 'friend',
        speakerName: friendName,
        text: friendSpeech,
        profile: getFriendVoiceProfile(friendName),
      },
    ]);
  }

  public speakNpcArrival(encounter: NpcEncounter, _friendName: string) {
    const npcProfile =
      encounter.voiceProfile ??
      getNpcVoiceProfile(encounter.archetype, encounter.npcName, encounter.id);

    this.speakQueue([
      {
        kind: 'npc',
        speakerName: encounter.npcName,
        text: encounter.greeting,
        profile: npcProfile,
      },
    ]);
  }

  public speakNpcLine(
    encounter: NpcEncounter,
    text: string,
    mood: 'normal' | 'scared' = 'normal'
  ) {
    const base =
      encounter.voiceProfile ??
      getNpcVoiceProfile(encounter.archetype, encounter.npcName, encounter.id);
    const profile: VoiceProfile =
      mood === 'scared'
        ? {
            ...base,
            voiceStyle: `Startled, hurried, panicked ${base.voiceStyle}`,
          }
        : base;

    this.speakQueue([
      {
        kind: 'npc',
        speakerName: encounter.npcName,
        text,
        profile,
      },
    ]);
  }
}

export const voiceEngine = new VoiceEngine();
