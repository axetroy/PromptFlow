import { useState, useEffect } from 'react';
import { useMediaQuery } from './useMediaQuery';
import type { ThemeMode } from '../types';

const STORAGE_KEY = 'promptflow-data';

/**
 * Get the effective theme based on user's theme setting and system preference.
 * 
 * @param themeSetting - The user's theme setting: 'light', 'dark', or 'system'
 * @param prefersDarkMode - Whether the system prefers dark mode
 */
function getEffectiveTheme(themeSetting: ThemeMode, prefersDarkMode: boolean): 'light' | 'dark' {
  if (themeSetting === 'system') {
    return prefersDarkMode ? 'dark' : 'light';
  }
  return themeSetting;
}

/**
 * Get stored theme setting from chrome storage.
 */
async function getStoredThemeSetting(): Promise<ThemeMode> {
  return new Promise((resolve) => {
    chrome.storage.local.get([STORAGE_KEY], (result) => {
      const data = result[STORAGE_KEY] as { settings?: { theme?: ThemeMode } } | undefined;
      const theme = data?.settings?.theme;
      resolve(theme || 'system');
    });
  });
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
  
  return getEffectiveTheme(themeSetting, prefersDarkMode);
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
