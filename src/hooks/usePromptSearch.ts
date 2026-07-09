import { useState, useCallback, useMemo } from 'react';
import type { Prompt } from '../types';

/**
 * Search and filter state for the PromptPanel.
 *
 * Manages the local search input, filters prompts by title / description /
 * tags, and computes the "recently used" section when there is no active
 * search query.
 *
 * @param prompts          - Full list of available prompts
 * @param recentPromptIds  - Ordered list of recently used prompt IDs
 *                           (most recent first)
 * @param onSearchChange   - Callback fired on every search input change so
 *                           the parent can persist the query if needed
 */
export function usePromptSearch(
  prompts: Prompt[],
  recentPromptIds: string[],
  onSearchChange: (query: string) => void,
) {
  const [localSearch, setLocalSearch] = useState('');

  const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setLocalSearch(value);
    onSearchChange(value);
  }, [onSearchChange]);

  const filteredPrompts = useMemo(() => {
    if (!localSearch) return prompts;
    const query = localSearch.toLowerCase();
    return prompts.filter(p =>
      p.name.toLowerCase().includes(query) ||
      (p.description && p.description.toLowerCase().includes(query)) ||
      p.tags.some(t => t.toLowerCase().includes(query))
    );
  }, [prompts, localSearch]);

  const showRecentSection = !localSearch && recentPromptIds.length > 0;

  const recentPrompts = useMemo(() => {
    if (!showRecentSection) return [];
    const promptMap = new Map(prompts.map(p => [p.id, p]));
    return recentPromptIds
      .slice(0, 5)
      .map(id => promptMap.get(id))
      .filter((p): p is Prompt => p !== undefined);
  }, [showRecentSection, recentPromptIds, prompts]);

  const recentCount = showRecentSection ? recentPrompts.length : 0;

  return {
    localSearch,
    setLocalSearch,
    handleSearchChange,
    filteredPrompts,
    showRecentSection,
    recentPrompts,
    recentCount,
  };
}
