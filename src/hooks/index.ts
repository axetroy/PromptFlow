/**
 * Custom React hooks for PromptFlow.
 *
 * ## General-purpose hooks
 *
 * | Hook | Purpose |
 * |------|---------|
 * | {@link useDebounce} | Debounce a reactive value |
 * | {@link useDebouncedCallback} | Debounce a callback function |
 * | {@link useKeyPress} | Track whether a key is held down |
 * | {@link useKeyboardShortcut} | Listen for key combinations |
 * | {@link useLocalStorage} | localStorage-backed state |
 * | {@link usePrevious} | Track the previous render's value |
 * | {@link useToggle} | Boolean toggle |
 * | {@link useClickOutside} | Detect clicks outside an element |
 * | {@link useMediaQuery} | Reactive CSS media query matcher |
 * | {@link useTheme} | System colour scheme detection |
 * | {@link useIntersectionObserver} | Element visibility observer |
 *
 * ## Panel-specific hooks
 *
 * | Hook | Purpose |
 * |------|---------|
 * | {@link usePanelPosition} | Fixed-position panel centred in viewport |
 * | {@link usePromptSearch} | Search/filter + recent prompts logic |
 * | {@link usePromptKeyboardNav} | Arrow-key navigation for the prompt list |
 *
 * @module
 */

export { useDebounce } from './useDebounce';
export { useDebouncedCallback } from './useDebouncedCallback';
export { useKeyPress } from './useKeyPress';
export { useKeyboardShortcut } from './useKeyboardShortcut';
export { useLocalStorage } from './useLocalStorage';
export { usePrevious } from './usePrevious';
export { useToggle } from './useToggle';
export { useClickOutside } from './useClickOutside';
export { useMediaQuery } from './useMediaQuery';
export { useTheme } from './useTheme';
export { useThemeMode, computeEffectiveTheme, getEffectiveThemeSync, getThemeSetting, saveThemeSetting } from './useThemeMode';
export { useIntersectionObserver } from './useIntersectionObserver';
export { usePanelPosition } from './usePanelPosition';
export { usePromptSearch } from './usePromptSearch';
export { usePromptKeyboardNav } from './usePromptKeyboardNav';
