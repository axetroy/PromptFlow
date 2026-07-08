import { useState, useEffect } from 'react';
import { useMediaQuery } from './useMediaQuery';
import type { ThemeMode } from '../types';

const STORAGE_KEY = 'promptflow-data';

/**
 * Compute the effective theme based on user's theme setting and system preference.
 * This is a pure function that can be used in any context.
 * 
 * @param themeSetting - The user's theme setting: 'light', 'dark', or 'system'
 * @param prefersDark - Whether the system prefers dark mode
 */
export function computeEffectiveTheme(themeSetting: ThemeMode | 'system', prefersDark: boolean): 'light' | 'dark' {
  if (themeSetting === 'system') {
    return prefersDark ? 'dark' : 'light';
  }
  return themeSetting;
}

/**
 * Get stored theme setting from chrome storage (async).
 */
export async function getStoredThemeSetting(): Promise<ThemeMode> {
  return new Promise((resolve) => {
    chrome.storage.local.get([STORAGE_KEY], (result) => {
      const data = result[STORAGE_KEY] as { settings?: { theme?: ThemeMode } } | undefined;
      const theme = data?.settings?.theme;
      resolve(theme || 'system');
    });
  });
}

/**
 * Get the effective theme synchronously from storage.
 * Falls back to system preference if storage read fails.
 */
export function getEffectiveThemeSync(): 'light' | 'dark' {
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const storage = chrome.storage.local as any;
    const getSync = storage.getSync;
    if (typeof getSync === 'function') {
      const result = getSync(STORAGE_KEY);
      if (result && typeof result === 'object') {
        const settings = result.settings;
        if (settings && typeof settings === 'object') {
          const themeSetting = settings.theme as ThemeMode | undefined;
          return computeEffectiveTheme(themeSetting || 'system', prefersDark);
        }
      }
    }
  } catch {
    // Fallback to system preference
  }
  
  return prefersDark ? 'dark' : 'light';
}

/**
 * React hook for theme management.
 * 
 * Returns the effective theme ('light' | 'dark') based on:
 * 1. User's stored theme setting
 * 2. System dark mode preference (when theme is 'system')
 * 
 * Also handles:
 * - Loading theme from storage
 * - Listening for storage changes to update theme
 * - Listening for system preference changes
 */
export function useThemeMode(): 'light' | 'dark' {
  const [themeSetting, setThemeSetting] = useState<ThemeMode>('system');
  const prefersDarkMode = useMediaQuery('(prefers-color-scheme: dark)');
  
  // Load theme setting from storage on mount
  useEffect(() => {
    getStoredThemeSetting().then(setThemeSetting);
  }, []);
  
  // Listen for storage changes to update theme setting
  useEffect(() => {
    const handleStorageChange = (changes: Record<string, chrome.storage.StorageChange>) => {
      if (changes[STORAGE_KEY]) {
        const newSettings = changes[STORAGE_KEY].newValue as { settings?: { theme?: ThemeMode } } | undefined;
        if (newSettings?.settings?.theme) {
          setThemeSetting(newSettings.settings.theme);
        }
      }
    };
    
    chrome.storage.onChanged.addListener(handleStorageChange);
    return () => chrome.storage.onChanged.removeListener(handleStorageChange);
  }, []);
  
  return computeEffectiveTheme(themeSetting, prefersDarkMode);
}

/**
 * Get theme setting directly from storage (non-reactive).
 * Useful for non-React contexts.
 */
export async function getThemeSetting(): Promise<ThemeMode> {
  return getStoredThemeSetting();
}

/**
 * Save theme setting to storage.
 */
export async function saveThemeSetting(theme: ThemeMode): Promise<void> {
  return new Promise((resolve) => {
    chrome.storage.local.get([STORAGE_KEY], (result) => {
      const data = result[STORAGE_KEY] as Record<string, unknown> || {};
      const settings = (data.settings as Record<string, unknown>) || {};
      const merged = {
        ...data,
        settings: {
          ...settings,
          theme,
        },
      };
      chrome.storage.local.set({ [STORAGE_KEY]: merged }, resolve);
    });
  });
}
