/**
 * Shared GitHub prompt-fetching logic used by both SettingsApp and SyncManager
 */

import {
  SyncedPrompt,
  fetchGitHubDirectory,
  fetchGitHubFileContent,
  parseFrontmatter,
} from '../types/sync';

/**
 * Fetch and parse prompts from a GitHub repository directory.
 * Shared by handleAddRepo and handleSyncRepo in SettingsApp.
 */
export async function fetchRepoPrompts(
  repo: string,
  promptsPath: string,
  branch: string,
  repoId: string,
): Promise<SyncedPrompt[]> {
  const mdFiles = await fetchGitHubDirectory(repo, promptsPath, branch);

  const prompts: SyncedPrompt[] = [];

  for (const file of mdFiles) {
    try {
      const content = await fetchGitHubFileContent(repo, file.path, branch);
      const { metadata, body } = parseFrontmatter(content);

      prompts.push({
        id: `${repoId}-${file.path.replace(/[^a-zA-Z0-9._-]/g, '_')}`,
        repoId,
        name: (metadata.name as string) || file.name.replace('.md', ''),
        content: body,
        description: (metadata.description as string) || '',
        tags: Array.isArray(metadata.tags) ? metadata.tags : (metadata.tag ? [metadata.tag as string] : []),
        filePath: file.path,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        enabled: true,
        isSynced: true,
      });
    } catch (err) {
      console.error(`Failed to fetch ${file.path}:`, err);
    }
  }

  return prompts;
}
