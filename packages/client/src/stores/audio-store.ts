import { create } from 'zustand';

const STORAGE_KEY = 'veilfall_audio_prefs';

interface AudioPrefs {
  musicEnabled: boolean;
  sfxEnabled: boolean;
  volume: number;
}

function loadPrefs(): AudioPrefs {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        musicEnabled: typeof parsed.musicEnabled === 'boolean' ? parsed.musicEnabled : true,
        sfxEnabled: typeof parsed.sfxEnabled === 'boolean' ? parsed.sfxEnabled : true,
        volume: typeof parsed.volume === 'number' ? parsed.volume : 0.5,
      };
    }
  } catch {
    // ignore
  }
  return { musicEnabled: true, sfxEnabled: true, volume: 0.5 };
}

function savePrefs(prefs: AudioPrefs): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    // ignore
  }
}

interface AudioState {
  musicEnabled: boolean;
  sfxEnabled: boolean;
  volume: number;
  toggleMusic: () => void;
  toggleSfx: () => void;
  setVolume: (v: number) => void;
}

export const useAudioStore = create<AudioState>((set, get) => {
  const initial = loadPrefs();

  return {
    ...initial,

    toggleMusic: () => {
      const next = !get().musicEnabled;
      set({ musicEnabled: next });
      savePrefs({ musicEnabled: next, sfxEnabled: get().sfxEnabled, volume: get().volume });
    },

    toggleSfx: () => {
      const next = !get().sfxEnabled;
      set({ sfxEnabled: next });
      savePrefs({ musicEnabled: get().musicEnabled, sfxEnabled: next, volume: get().volume });
    },

    setVolume: (v: number) => {
      const clamped = Math.max(0, Math.min(1, v));
      set({ volume: clamped });
      savePrefs({ musicEnabled: get().musicEnabled, sfxEnabled: get().sfxEnabled, volume: clamped });
    },
  };
});
