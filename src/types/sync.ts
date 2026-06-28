// Types for synced prompts from GitHub repositories

export interface SyncedPrompt {
  id: string;
  repoId: string; // Links to SyncedRepo
  title: string;
  content: string;
  description?: string;
  tags: string[];
  filePath: string; // Path in the repo, e.g., ".agents/prompts/1-code-review.md"
  createdAt: number;
  updatedAt: number;
  enabled?: boolean;
  isSynced?: boolean; // Mark as synced prompt (read-only)
}

export interface SyncedRepo {
  id: string;
  repo: string; // e.g., "owner/repo"
  branch: string;
  promptsPath: string; // e.g., ".agents/prompts"
  lastSyncedAt?: number;
  enabled: boolean;
  enabledPromptIds: string[]; // IDs of enabled prompts within this repo
}

export interface SyncedPromptsData {
  repos: SyncedRepo[];
  prompts: SyncedPrompt[];
}

export interface GitHubFile {
  name: string;
  path: string;
  sha: string;
  size: number;
  type: 'file' | 'dir';
}

export interface GitHubContent {
  name: string;
  path: string;
  sha: string;
  size: number;
  content?: string; // Base64 encoded for files
  encoding?: string;
  type: 'file' | 'dir';
  download_url?: string;
}

/**
 * Fetch file content using jsdelivr CDN
 * Works globally including China, no rate limits
 * Format: https://cdn.jsdelivr.net/gh/{owner}/{repo}@{branch}/{path}
 */
export async function fetchGitHubFileContent(repo: string, filePath: string, branch: string = 'main'): Promise<string> {
  // jsdelivr CDN format
  const url = `https://cdn.jsdelivr.net/gh/${repo}@${branch}/${filePath}`;
  const response = await fetch(url);
  
  if (!response.ok) {
    throw new Error(`Failed to fetch file ${filePath}: ${response.statusText}`);
  }
  
  return response.text();
}

/**
 * Fetch directory listing using jsdelivr web interface
 * Works globally including China
 * Format: https://www.jsdelivr.com/package/gh/{owner}/{repo}?version={branch}&path={path}
 */
export async function fetchGitHubDirectory(
  repo: string,
  path: string,
  branch: string = 'main'
): Promise<GitHubContent[]> {
  // jsdelivr package page to list files
  const url = `https://www.jsdelivr.com/package/gh/${repo}?version=${branch}&path=${path}`;
  
  try {
    const response = await fetch(url);
    
    if (!response.ok) {
      if (response.status === 404) {
        return []; // Path doesn't exist
      }
      throw new Error(`Failed to fetch directory: ${response.statusText}`);
    }
    
    const html = await response.text();
    
    // Parse the HTML to extract file information
    // jsdelivr returns a JSON payload in a script tag or inline data
    const files: GitHubContent[] = [];
    
    // Try to extract file list from JSON data embedded in the page
    // Pattern 1: Look for JSON data with file information
    const jsonMatch = html.match(/window\.__NUXT__\s*=\s*({[\s\S]*?})\s*;?\s*<\/script>/);
    if (jsonMatch) {
      try {
        const jsonData = JSON.parse(jsonMatch[1]);
        // Navigate through the JSON structure to find files
        const items = jsonData?.data?.files || jsonData?.files || [];
        
        for (const item of items) {
          if (item.name?.endsWith('.md') || item.path?.endsWith('.md')) {
            const fileName = item.name || item.path?.split('/').pop() || '';
            const filePath = item.path || `${path}/${fileName}`;
            
            files.push({
              name: fileName,
              path: filePath,
              sha: item.sha || '',
              size: item.size || 0,
              type: 'file',
              download_url: `https://cdn.jsdelivr.net/gh/${repo}@${branch}/${filePath}`,
            });
          }
        }
        
        if (files.length > 0) {
          return files;
        }
      } catch (e) {
        console.warn('Failed to parse Nuxt JSON, trying alternative method');
      }
    }
    
    // Pattern 2: Look for API response embedded in page
    const apiMatch = html.match(/"files"\s*:\s*(\[[\s\S]*?\])/);
    if (apiMatch) {
      try {
        const filesData = JSON.parse(apiMatch[1]);
        
        for (const item of filesData) {
          if (item.name?.endsWith('.md') || item.path?.endsWith('.md')) {
            const fileName = item.name || item.path?.split('/').pop() || '';
            const filePath = item.path || `${path}/${fileName}`;
            
            files.push({
              name: fileName,
              path: filePath,
              sha: item.sha || '',
              size: item.size || 0,
              type: 'file',
              download_url: `https://cdn.jsdelivr.net/gh/${repo}@${branch}/${filePath}`,
            });
          }
        }
        
        if (files.length > 0) {
          return files;
        }
      } catch (e) {
        console.warn('Failed to parse files JSON, trying alternative method');
      }
    }
    
    // Pattern 3: Regex fallback - look for file links in the HTML
    const fileLinkPattern = /href=["']([^"']*cdn\.jsdelivr\.net[^"']*)["'][^>]*>([^<]*\.md)</gi;
    let match;
    
    while ((match = fileLinkPattern.exec(html)) !== null) {
      const url = match[1];
      const fileName = match[2] || url.split('/').pop() || '';
      
      // Extract path from jsdelivr URL
      const pathMatch = url.match(/gh\/([^@]+)@([^/]+)\/(.+)/);
      if (pathMatch) {
        const [, ownerRepo, , filePath] = pathMatch;
        
        if (!files.some(f => f.path === filePath)) {
          files.push({
            name: fileName,
            path: filePath,
            sha: '',
            size: 0,
            type: 'file',
            download_url: url,
          });
        }
      }
    }
    
    return files;
  } catch (error) {
    console.error('Error fetching GitHub directory:', error);
    return [];
  }
}

/**
 * Alternative: Fetch directory listing using GitHub API with error handling
 * Falls back gracefully on rate limit
 */
export async function fetchGitHubDirectoryWithFallback(
  repo: string,
  path: string,
  branch: string = 'main'
): Promise<GitHubContent[]> {
  // Try web scraping first (no rate limit)
  const webResults = await fetchGitHubDirectory(repo, path, branch);
  if (webResults.length > 0) {
    return webResults;
  }
  
  // Fallback to API (may be rate limited)
  try {
    const url = `https://api.github.com/repos/${repo}/contents/${path}?ref=${branch}`;
    const response = await fetch(url, {
      headers: {
        'Accept': 'application/vnd.github.v3+json',
      },
    });
    
    if (!response.ok) {
      if (response.status === 403) {
        console.warn('GitHub API rate limit exceeded. Please try again later or add a GitHub token.');
      }
      return [];
    }
    
    const data = await response.json();
    
    if (!Array.isArray(data)) {
      return [];
    }
    
    return data
      .filter((item: any) => item.type === 'file' && item.name.endsWith('.md'))
      .map((item: any) => ({
        name: item.name,
        path: item.path,
        sha: item.sha,
        size: item.size,
        type: item.type,
        download_url: item.download_url,
      }));
  } catch (error) {
    console.error('Error fetching via API:', error);
    return [];
  }
}

/**
 * Parse YAML frontmatter from markdown content (same as prompts/index.ts)
 */
export function parseFrontmatter(content: string): { metadata: Record<string, any>; body: string } {
  const frontmatterRegex = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/;
  const match = content.match(frontmatterRegex);
  
  if (!match) {
    return { metadata: {}, body: content };
  }
  
  const yamlContent = match[1];
  const body = match[2];
  const metadata: Record<string, any> = {};
  
  const lines = yamlContent.split('\n');
  let currentKey: string | null = null;
  let inArray = false;
  let arrayValues: string[] = [];
  
  for (const line of lines) {
    const trimmedLine = line.trim();
    
    if (trimmedLine.startsWith('- ')) {
      if (!inArray) {
        inArray = true;
        arrayValues = [];
      }
      arrayValues.push(trimmedLine.substring(2).trim());
      continue;
    }
    
    if (inArray && currentKey) {
      metadata[currentKey] = arrayValues;
      inArray = false;
      arrayValues = [];
    }
    
    const colonIndex = trimmedLine.indexOf(':');
    if (colonIndex > 0) {
      if (inArray && currentKey) {
        metadata[currentKey] = arrayValues;
        inArray = false;
        arrayValues = [];
      }
      currentKey = trimmedLine.substring(0, colonIndex).trim();
      const value = trimmedLine.substring(colonIndex + 1).trim();
      if (value) {
        metadata[currentKey] = value;
      }
    }
  }
  
  if (inArray && currentKey) {
    metadata[currentKey] = arrayValues;
  }
  
  return { metadata, body: body.trim() };
}