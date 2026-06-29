/**
 * Sync utilities - shared sync logic for background and content scripts
 */

import { SyncedRepo, SyncedPrompt, fetchGitHubDirectory, fetchGitHubFileContent, parseFrontmatter } from '../types/sync';
import { getStorageData, saveStorageData } from './storage';

export interface SyncResult {
  success: boolean;
  syncedCount: number;
  errors: string[];
}

export interface SyncStatus {
  lastSynced: number | null;
  nextSync: number | null;
  enabled: boolean;
  reposCount: number;
}

// Sync interval options (in minutes)
export const SYNC_INTERVALS = {
  '5min': 5,
  '15min': 15,
  '30min': 30,
  '1hour': 60,
} as const;

export type SyncIntervalKey = keyof typeof SYNC_INTERVALS;

/**
 * Sync all enabled repositories
 */
export async function syncAllEnabledRepos(): Promise<SyncResult> {
  const data = await getStorageData();
  const repos = data.syncedRepos || [];
  const enabledRepos = repos.filter((r: SyncedRepo) => r.enabled);
  
  if (enabledRepos.length === 0) {
    return { success: true, syncedCount: 0, errors: [] };
  }
  
  let syncedCount = 0;
  const errors: string[] = [];
  
  for (const repo of enabledRepos) {
    try {
      const result = await syncSingleRepo(repo);
      if (result.success) {
        syncedCount++;
      } else {
        errors.push(...result.errors);
      }
    } catch (error) {
      errors.push(`${repo.repo}: ${(error as Error).message}`);
    }
  }
  
  return {
    success: errors.length === 0,
    syncedCount,
    errors,
  };
}

/**
 * Sync a single repository
 */
export async function syncSingleRepo(repo: SyncedRepo): Promise<SyncResult> {
  const errors: string[] = [];
  
  try {
    // Fetch directory listing
    const files = await fetchGitHubDirectory(repo.repo, repo.promptsPath, repo.branch);
    
    if (files.length === 0) {
      return { success: true, syncedCount: 0, errors: [] };
    }
    
    const syncedPrompts: SyncedPrompt[] = [];
    
    // Fetch and parse each file
    for (const file of files) {
      try {
        const content = await fetchGitHubFileContent(repo.repo, file.path, repo.branch);
        const { metadata, body } = parseFrontmatter(content);
        
        const prompt: SyncedPrompt = {
          id: `sync-${repo.id}-${Buffer.from(file.path).toString('base64').slice(0, 8)}`,
          repoId: repo.id,
          title: metadata.title || file.name.replace('.md', ''),
          content: body,
          description: metadata.description || '',
          tags: Array.isArray(metadata.tags) ? metadata.tags : (metadata.tag ? [metadata.tag] : []),
          filePath: file.path,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          enabled: true,
          isSynced: true,
        };
        
        syncedPrompts.push(prompt);
      } catch (error) {
        errors.push(`${file.path}: ${(error as Error).message}`);
      }
    }
    
    // Update storage with synced prompts
    const data = await getStorageData();
    
    // Remove old prompts from this repo
    const existingPrompts = data.syncedPrompts || [];
    const otherPrompts = existingPrompts.filter((p: SyncedPrompt) => p.repoId !== repo.id);
    
    // Add new prompts
    data.syncedPrompts = [...otherPrompts, ...syncedPrompts];
    
    // Update last synced time
    const repoIndex = data.syncedRepos.findIndex((r: SyncedRepo) => r.id === repo.id);
    if (repoIndex !== -1) {
      data.syncedRepos[repoIndex].lastSyncedAt = Date.now();
    }
    
    await saveStorageData(data);
    
    return {
      success: true,
      syncedCount: syncedPrompts.length,
      errors,
    };
  } catch (error) {
    return {
      success: false,
      syncedCount: 0,
      errors: [`${repo.repo}: ${(error as Error).message}`, ...errors],
    };
  }
}

/**
 * Get current sync status
 */
export async function getSyncStatus(): Promise<SyncStatus> {
  const data = await getStorageData();
  const repos = data.syncedRepos || [];
  const enabledRepos = repos.filter((r: SyncedRepo) => r.enabled);
  
  // Get the most recent sync time
  let lastSynced: number | null = null;
  for (const repo of enabledRepos) {
    if (repo.lastSyncedAt && (!lastSynced || repo.lastSyncedAt > lastSynced)) {
      lastSynced = repo.lastSyncedAt;
    }
  }
  
  return {
    lastSynced,
    nextSync: null, // Will be filled by background script
    enabled: enabledRepos.length > 0,
    reposCount: enabledRepos.length,
  };
}

/**
 * Format sync interval for display
 */
export function formatSyncInterval(interval: string): string {
  const labels: Record<string, string> = {
    '5min': 'Every 5 minutes',
    '15min': 'Every 15 minutes',
    '30min': 'Every 30 minutes',
    '1hour': 'Every hour',
  };
  return labels[interval] || interval;
}
