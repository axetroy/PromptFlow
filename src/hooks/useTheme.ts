import { useMediaQuery } from './useMediaQuery';

/**
 * Detect system colour scheme preference.
 *
 * Returns `'dark'` when `prefers-color-scheme: dark` is active,
 * `'light'` otherwise.
 */
export function useTheme(): 'light' | 'dark' {
  const prefersDarkMode = useMediaQuery('(prefers-color-scheme: dark)');
  return prefersDarkMode ? 'dark' : 'light';
}
