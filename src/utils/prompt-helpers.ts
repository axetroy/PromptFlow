/**
 * Shared prompt merging/filtering utilities.
 *
 * Both SettingsApp and content.ts need to merge default prompts,
 * custom prompts, and synced prompts into a single list. This module
 * provides a single source of truth for that logic.
 */

import { Prompt, DEFAULT_PROMPTS } from '../types';
import { SyncedRepo, SyncedPrompt } from '../types/sync';

/**
 * Collect all enabled prompts: defaults (minus disabled), custom, and synced.
 */
export function getAllEnabledPrompts(
  customPrompts: Prompt[],
  disabledDefaultIds: string[],
  syncedRepos: SyncedRepo[],
  syncedPrompts: SyncedPrompt[],
): Prompt[] {
  const allPrompts: Prompt[] = [];

  // Default prompts sorted by id, excluding disabled
  const sortedDefaults = [...DEFAULT_PROMPTS]
    .sort((a, b) => a.id.localeCompare(b.id))
    .filter(p => !disabledDefaultIds.includes(p.id));

  allPrompts.push(...sortedDefaults);

  // Track all IDs to prevent duplicates across all sources
  const usedIds = new Set(allPrompts.map(p => p.id));

  // Custom prompts that are enabled, excluding any duplicate IDs
  for (const p of customPrompts) {
    if (p.enabled !== false && !usedIds.has(p.id)) {
      usedIds.add(p.id);
      allPrompts.push(p);
    }
  }

  // Synced prompts from enabled repos
  const enabledRepoIds = new Set(
    syncedRepos.filter(r => r.enabled).map(r => r.id),
  );

  for (const p of syncedPrompts) {
    if (enabledRepoIds.has(p.repoId) && p.enabled !== false && !usedIds.has(p.id)) {
      usedIds.add(p.id);
      allPrompts.push(p);
    }
  }

  return allPrompts;
}

/**
 * Extract unique recent prompt IDs from usage history (most recent first).
 */
export function extractRecentPromptIds(
  usageHistory: { promptId: string }[],
  limit: number,
): string[] {
  const seen = new Set<string>();
  const recentIds: string[] = [];
  for (const usage of usageHistory) {
    if (!seen.has(usage.promptId)) {
      seen.add(usage.promptId);
      recentIds.push(usage.promptId);
      if (recentIds.length >= limit) break;
    }
  }
  return recentIds;
}
