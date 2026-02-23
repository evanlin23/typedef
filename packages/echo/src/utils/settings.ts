// src/utils/settings.ts

const SETTINGS_KEY = 'echo-settings';

export interface Settings {
  isShuffled: boolean;
  normalizeAudio: boolean;
  currentPlaylistId: string | null;
}

const defaultSettings: Settings = {
  isShuffled: false,
  normalizeAudio: false,
  currentPlaylistId: null,
};

export const getSettings = (): Settings => {
  try {
    const stored = localStorage.getItem(SETTINGS_KEY);
    if (stored) {
      return { ...defaultSettings, ...JSON.parse(stored) };
    }
  } catch (error) {
    console.error('Error reading settings:', error);
  }
  return defaultSettings;
};

export const saveSettings = (settings: Partial<Settings>): void => {
  try {
    const current = getSettings();
    const updated = { ...current, ...settings };
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(updated));
  } catch (error) {
    console.error('Error saving settings:', error);
  }
};
