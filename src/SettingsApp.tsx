import React, { useState, useEffect, useCallback, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import {
  ConfigProvider,
  Layout,
  Typography,
  Card,
  Form,
  Input,
  Button,
  Switch,
  Table,
  Tag,
  Space,
  Modal,
  message,
  Popconfirm,
  Select,
  Tooltip,
} from 'antd';
import {
  SettingOutlined,
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  ReloadOutlined,
  CodeOutlined,
  FileTextOutlined,
  UploadOutlined,
  DownloadOutlined,
  GithubOutlined,
  SyncOutlined,
  LoadingOutlined,
  BarChartOutlined
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';

// Import Ant Design styles
import 'antd/dist/reset.css';

// Import default prompts from markdown files
import { DEFAULT_PROMPTS as defaultPromptsFromFiles } from './prompts';

// Import sync types and functions
import {
  SyncedRepo,
  SyncedPrompt,
  fetchGitHubDirectory,
  fetchGitHubFileContent,
  parseFrontmatter,
} from './types/sync';

// Import SyncManager component
import SyncManager from './SyncManager';

// Import PromptPreview component
import PromptPreview from './components/PromptPreview';

const { Header, Content } = Layout;
const { Title, Text } = Typography;
const { TextArea } = Input;

// Types
interface Prompt {
  id: string;
  title: string;
  content: string;
  description?: string;
  tags: string[];
  createdAt: number;
  updatedAt: number;
  enabled?: boolean;
  isDefault?: boolean; // Mark default prompts
  isReadOnly?: boolean; // Mark prompts that cannot be edited (default or synced)
}

interface PromptSettings {
  trigger: string;
  insertMode: 'replace' | 'append';
  syncInterval?: '15min' | '30min' | '1hour' | '2hours' | '1day';
}

interface PromptUsage {
  promptId: string;
  usedAt: number;
}

interface StorageData {
  customPrompts: Prompt[]; // Only custom prompts stored
  disabledDefaultIds?: string[]; // IDs of disabled default prompts
  syncedRepos: SyncedRepo[];
  syncedPrompts: SyncedPrompt[];
  settings: PromptSettings;
  usageHistory?: PromptUsage[];
}

// Default prompts - always loaded from markdown files
const getDefaultPrompts = (): Prompt[] => defaultPromptsFromFiles.map(prompt => ({
  ...prompt,
  createdAt: Date.now(),
  updatedAt: Date.now(),
  isDefault: true,
  enabled: true,
}));

// Get all prompts: default prompts first, then custom prompts
// Default prompts with enabled=false are filtered out unless they were explicitly disabled
const getAllPrompts = (customPrompts: Prompt[], disabledDefaultIds: string[] = []): Prompt[] => {
  const defaults = getDefaultPrompts().map(p => ({
    ...p,
    enabled: !disabledDefaultIds.includes(p.id),
  }));
  
  // Sort: default prompts first (by id), then custom prompts
  const sortedDefaults = [...defaults].sort((a, b) => a.id.localeCompare(b.id));
  const sortedCustom = [...customPrompts].sort((a, b) => 
    (a.createdAt || 0) - (b.createdAt || 0)
  );
  
  return [...sortedDefaults, ...sortedCustom];
};

// Get all prompts including synced prompts
const getAllPromptsWithSync = (
  customPrompts: Prompt[],
  disabledDefaultIds: string[],
  syncedRepos: SyncedRepo[],
  syncedPrompts: SyncedPrompt[]
): Prompt[] => {
  // Start with default + custom prompts
  const basePrompts = getAllPrompts(customPrompts, disabledDefaultIds);
  
  // Add synced prompts (only enabled ones from enabled repos)
  const enabledRepoIds = new Set(
    syncedRepos.filter(r => r.enabled).map(r => r.id)
  );
  
  const enabledSyncedPrompts = syncedPrompts
    .filter(p => 
      enabledRepoIds.has(p.repoId) && 
      p.enabled !== false
    )
    .map(p => ({
      ...p,
      isReadOnly: true, // Synced prompts are read-only
    }));
  
  return [...basePrompts, ...enabledSyncedPrompts];
};

// Storage helpers - only store custom prompts and disabled default IDs
const loadData = (): Promise<StorageData> => {
  return new Promise((resolve, reject) => {
    chrome.storage.local.get(['promptflow-data'], (result) => {
      if (chrome.runtime.lastError) {
        reject(new Error(`Failed to load data: ${chrome.runtime.lastError.message}`));
        return;
      }
      const data = result['promptflow-data'] as StorageData | undefined;
      if (data) {
        resolve({
          customPrompts: data.customPrompts || [],
          disabledDefaultIds: data.disabledDefaultIds || [],
          syncedRepos: data.syncedRepos || [],
          syncedPrompts: data.syncedPrompts || [],
          settings: data.settings || { trigger: '/prompts', insertMode: 'replace' },
          usageHistory: data.usageHistory || [],
        });
      } else {
        resolve({
          customPrompts: [],
          disabledDefaultIds: [],
          syncedRepos: [],
          syncedPrompts: [],
          settings: { trigger: '/prompts', insertMode: 'replace' },
          usageHistory: [],
        });
      }
    });
  });
};

const saveData = (data: StorageData): Promise<void> => {
  return new Promise((resolve, reject) => {
    chrome.storage.local.set({ 'promptflow-data': data }, () => {
      if (chrome.runtime.lastError) {
        reject(new Error(`Failed to save data: ${chrome.runtime.lastError.message}`));
        return;
      }
      resolve();
    });
  });
};

// Decay settings - half-life of 14 days means usage value halves every 14 days
const HALF_LIFE_DAYS = 14;

// Calculate popularity score based on usage count and recency
// Formula: score = N * (0.5)^(T / halfLifeDays)
// Where N = usage count, T = days since last use, halfLifeDays = 14
const calculatePopularityScore = (count: number, lastUsedAt: number): number => {
  const now = Date.now();
  const daysSinceLastUse = (now - lastUsedAt) / (1000 * 60 * 60 * 24);
  const decayFactor = Math.pow(0.5, daysSinceLastUse / HALF_LIFE_DAYS);
  return count * decayFactor;
};

// Calculate usage statistics from history
const calculateUsageStats = (usageHistory: PromptUsage[], allPrompts: Prompt[]): { promptId: string; count: number; lastUsed: number; title: string; score: number }[] => {
  const statsMap = new Map<string, { count: number; lastUsed: number }>();
  
  for (const usage of usageHistory) {
    const existing = statsMap.get(usage.promptId);
    if (existing) {
      existing.count += 1;
      existing.lastUsed = Math.max(existing.lastUsed, usage.usedAt);
    } else {
      statsMap.set(usage.promptId, { count: 1, lastUsed: usage.usedAt });
    }
  }
  
  const stats: { promptId: string; count: number; lastUsed: number; title: string; score: number }[] = [];
  for (const [promptId, data] of statsMap) {
    const prompt = allPrompts.find(p => p.id === promptId);
    const score = calculatePopularityScore(data.count, data.lastUsed);
    stats.push({
      promptId,
      count: data.count,
      lastUsed: data.lastUsed,
      title: prompt?.title || 'Unknown Prompt',
      score,
    });
  }
  
  // Sort by popularity score (descending)
  return stats.sort((a, b) => b.score - a.score);
};

// Settings App Component
const SettingsApp: React.FC = () => {
  const [customPrompts, setCustomPrompts] = useState<Prompt[]>([]);
  const [disabledDefaultIds, setDisabledDefaultIds] = useState<string[]>([]);
  const [syncedRepos, setSyncedRepos] = useState<SyncedRepo[]>([]);
  const [syncedPrompts, setSyncedPrompts] = useState<SyncedPrompt[]>([]);
  const [syncingMap, setSyncingMap] = useState<Record<string, boolean>>({});
  const [allPrompts, setAllPrompts] = useState<Prompt[]>([]);
  const [settings, setSettings] = useState<PromptSettings>({ trigger: '/prompts', insertMode: 'replace', syncInterval: '1hour' });
  const [usageHistory, setUsageHistory] = useState<PromptUsage[]>([]);
  const [usageStats, setUsageStats] = useState<{ promptId: string; count: number; lastUsed: number; title: string; score: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingPrompt, setEditingPrompt] = useState<Prompt | null>(null);
  const [syncManagerVisible, setSyncManagerVisible] = useState(false);
  const [previewPrompt, setPreviewPrompt] = useState<Prompt | null>(null);
  const [previewVisible, setPreviewVisible] = useState(false);
  const [form] = Form.useForm();
  const [messageApi, contextHolder] = message.useMessage();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load data on mount
  useEffect(() => {
    loadData().then((data) => {
      setCustomPrompts(data.customPrompts);
      setDisabledDefaultIds(data.disabledDefaultIds || []);
      setSyncedRepos(data.syncedRepos);
      setSyncedPrompts(data.syncedPrompts);
      setAllPrompts(getAllPromptsWithSync(
        data.customPrompts,
        data.disabledDefaultIds || [],
        data.syncedRepos,
        data.syncedPrompts
      ));
      setSettings(data.settings);
      setUsageHistory(data.usageHistory || []);
      setLoading(false);
    }).catch((error) => {
      console.error('[PromptFlow] Failed to load data:', error);
      setLoading(false);
    });

    // Listen for storage changes from other sources (e.g., content script)
    const handleStorageChange = () => {
      loadData().then((data) => {
        setUsageHistory(data.usageHistory || []);
      }).catch((error) => {
        console.error('[PromptFlow] Failed to reload usage history:', error);
      });
    };
    
    chrome.storage.onChanged.addListener(handleStorageChange);
    return () => {
      chrome.storage.onChanged.removeListener(handleStorageChange);
    };
  }, []);

  // Update all prompts and usage stats when relevant data changes
  useEffect(() => {
    const mergedPrompts = getAllPromptsWithSync(customPrompts, disabledDefaultIds, syncedRepos, syncedPrompts);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setAllPrompts(mergedPrompts);
    // Update usage stats when prompts or history changes
    setUsageStats(calculateUsageStats(usageHistory, mergedPrompts));
  }, [customPrompts, disabledDefaultIds, syncedRepos, syncedPrompts, usageHistory]);

  // Save data whenever custom prompts, disabled defaults, synced data or settings change
  const persistData = useCallback(async (
    newCustomPrompts: Prompt[], 
    newDisabledDefaultIds: string[],
    newSyncedRepos: SyncedRepo[],
    newSyncedPrompts: SyncedPrompt[],
    newSettings: PromptSettings,
    newUsageHistory?: PromptUsage[]
  ) => {
    await saveData({ 
      customPrompts: newCustomPrompts, 
      disabledDefaultIds: newDisabledDefaultIds,
      syncedRepos: newSyncedRepos,
      syncedPrompts: newSyncedPrompts,
      settings: newSettings,
      usageHistory: newUsageHistory || usageHistory,
    });
  }, [usageHistory]);

  // Handle settings change
  const handleSettingsChange = async (key: keyof PromptSettings, value: string) => {
    const newSettings = { ...settings, [key]: value };
    setSettings(newSettings);
    try {
      await persistData(customPrompts, disabledDefaultIds, syncedRepos, syncedPrompts, newSettings);
      
      // Update background script's auto-sync alarm when interval changes
      if (key === 'syncInterval') {
        await chrome.runtime.sendMessage({ type: 'SAVE_SETTINGS', payload: newSettings });
      }
      
      messageApi.success('Settings saved');
    } catch (error) {
      console.error('[PromptFlow] Failed to save settings:', error);
      messageApi.error('Failed to save settings');
    }
  };

  // Handle clearing usage history
  const handleClearUsageHistory = async () => {
    try {
      await persistData(customPrompts, disabledDefaultIds, syncedRepos, syncedPrompts, settings, []);
      setUsageHistory([]);
      messageApi.success('Usage history cleared');
    } catch (error) {
      console.error('[PromptFlow] Failed to clear usage history:', error);
      messageApi.error('Failed to clear usage history');
    }
  };

  // Sync handlers
  const handleAddRepo = async (repoData: Omit<SyncedRepo, 'id' | 'lastSyncedAt'>): Promise<SyncedPrompt[]> => {
    const repoId = `sync-${Date.now()}`;
    
    // Fetch prompts from the repo (scraping GitHub page)
    const mdFiles = await fetchGitHubDirectory(repoData.repo, repoData.promptsPath, repoData.branch);
    
    if (mdFiles.length === 0) {
      messageApi.warning(`No markdown files found at ${repoData.promptsPath}`);
      return [];
    }
    
    const newPrompts: SyncedPrompt[] = [];
    
    const fetchErrors: string[] = [];
    for (const file of mdFiles) {
      try {
        const content = await fetchGitHubFileContent(repoData.repo, file.path, repoData.branch);
        const { metadata, body } = parseFrontmatter(content);
        
        newPrompts.push({
          id: `${repoId}-${file.name.replace('.md', '')}`,
          repoId,
          title: metadata.title || file.name.replace('.md', ''),
          content: body,
          description: metadata.description || '',
          tags: Array.isArray(metadata.tags) ? metadata.tags : [],
          filePath: file.path,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          enabled: true,
        });
      } catch (err) {
        console.error(`[PromptFlow] Failed to fetch ${file.path}:`, err);
        fetchErrors.push(file.path);
      }
    }
    
    if (fetchErrors.length > 0) {
      messageApi.warning(`Failed to fetch ${fetchErrors.length} file(s): ${fetchErrors.join(', ')}`);
    }
    
    const newRepo: SyncedRepo = {
      ...repoData,
      id: repoId,
      lastSyncedAt: Date.now(),
      enabledPromptIds: newPrompts.map(p => p.id),
    };
    
    const newRepos = [...syncedRepos, newRepo];
    const newPromptsAll = [...syncedPrompts, ...newPrompts];
    
    setSyncedRepos(newRepos);
    setSyncedPrompts(newPromptsAll);
    await persistData(customPrompts, disabledDefaultIds, newRepos, newPromptsAll, settings);
    
    return newPrompts;
  };

  const handleRemoveRepo = async (repoId: string) => {
    const newRepos = syncedRepos.filter(r => r.id !== repoId);
    const newPrompts = syncedPrompts.filter(p => p.repoId !== repoId);
    
    setSyncedRepos(newRepos);
    setSyncedPrompts(newPrompts);
    try {
      await persistData(customPrompts, disabledDefaultIds, newRepos, newPrompts, settings);
    } catch (error) {
      console.error('[PromptFlow] Failed to persist after removing repo:', error);
      messageApi.error('Failed to save changes');
    }
  };

  const handleSyncRepo = async (repoId: string): Promise<SyncedPrompt[]> => {
    setSyncingMap(prev => ({ ...prev, [repoId]: true }));

    try {
      const repo = syncedRepos.find(r => r.id === repoId);
      if (!repo) return [];
      
      // Fetch prompts from the repo (scraping GitHub page)
      const mdFiles = await fetchGitHubDirectory(repo.repo, repo.promptsPath, repo.branch);
      
      if (mdFiles.length === 0) {
        messageApi.warning(`No markdown files found at ${repo.promptsPath}`);
        return [];
      }
      
      const newPrompts: SyncedPrompt[] = [];
      
      const syncErrors: string[] = [];
      for (const file of mdFiles) {
        try {
          const content = await fetchGitHubFileContent(repo.repo, file.path, repo.branch);
          const { metadata, body } = parseFrontmatter(content);
          
          newPrompts.push({
            id: `${repoId}-${file.name.replace('.md', '')}`,
            repoId,
            title: metadata.title || file.name.replace('.md', ''),
            content: body,
            description: metadata.description || '',
            tags: Array.isArray(metadata.tags) ? metadata.tags : [],
            filePath: file.path,
            createdAt: Date.now(),
            updatedAt: Date.now(),
            enabled: true,
          });
        } catch (err) {
          console.error(`[PromptFlow] Failed to fetch ${file.path}:`, err);
          syncErrors.push(file.path);
        }
      }
      
      if (syncErrors.length > 0) {
        messageApi.warning(`Failed to fetch ${syncErrors.length} file(s): ${syncErrors.join(', ')}`);
      }
      
      // Update repo with new lastSyncedAt
      const updatedRepo = { ...repo, lastSyncedAt: Date.now() };
      const newRepos = syncedRepos.map(r => r.id === repoId ? updatedRepo : r);
      
      // Replace old prompts from this repo with new ones
      const otherPrompts = syncedPrompts.filter(p => p.repoId !== repoId);
      const newPromptsAll = [...otherPrompts, ...newPrompts];
      
      setSyncedRepos(newRepos);
      setSyncedPrompts(newPromptsAll);
      await persistData(customPrompts, disabledDefaultIds, newRepos, newPromptsAll, settings);
      
      return newPrompts;
    } finally {
      setSyncingMap(prev => {
        const newMap = { ...prev };
        delete newMap[repoId];
        return newMap;
      });
    }
  };

  const handleToggleRepo = async (repoId: string, enabled: boolean) => {
    const newRepos = syncedRepos.map(r => 
      r.id === repoId ? { ...r, enabled } : r
    );
    setSyncedRepos(newRepos);
    try {
      await persistData(customPrompts, disabledDefaultIds, newRepos, syncedPrompts, settings);
    } catch (error) {
      console.error('[PromptFlow] Failed to persist after toggling repo:', error);
      messageApi.error('Failed to save changes');
    }
  };

  const handleToggleSyncedPrompt = async (promptId: string, enabled: boolean) => {
    const newPrompts = syncedPrompts.map(p => 
      p.id === promptId ? { ...p, enabled } : p
    );
    
    try {
      // Update enabledPromptIds in the repo
      const prompt = syncedPrompts.find(p => p.id === promptId);
      if (prompt) {
        const newRepos = syncedRepos.map(r => {
          if (r.id === prompt.repoId) {
            if (enabled) {
              return { ...r, enabledPromptIds: [...r.enabledPromptIds, promptId] };
            } else {
              return { ...r, enabledPromptIds: r.enabledPromptIds.filter(id => id !== promptId) };
            }
          }
          return r;
        });
        setSyncedRepos(newRepos);
        await persistData(customPrompts, disabledDefaultIds, newRepos, newPrompts, settings);
      } else {
        setSyncedPrompts(newPrompts);
        await persistData(customPrompts, disabledDefaultIds, syncedRepos, newPrompts, settings);
      }
    } catch (error) {
      console.error('[PromptFlow] Failed to persist after toggling synced prompt:', error);
      messageApi.error('Failed to save changes');
    }
  };

  // Export prompts to JSON file (custom prompts only, default prompts are always loaded from files)
  const handleExport = () => {
    // Filter out default prompts (only export custom prompts)
    const customPromptsOnly = customPrompts.filter(p => !p.isDefault);
    
    const exportData = {
      version: '2.0',
      exportedAt: new Date().toISOString(),
      prompts: customPromptsOnly,
      disabledDefaultIds: disabledDefaultIds,
    };
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `promptflow-prompts-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    messageApi.success(`Exported ${customPromptsOnly.length} custom prompts (${disabledDefaultIds.length} disabled defaults)`);
  };

  // Import prompts from JSON file
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const content = event.target?.result as string;
        const importData = JSON.parse(content);

        if (!importData.prompts || !Array.isArray(importData.prompts)) {
          messageApi.error('Invalid file format: missing prompts array');
          return;
        }

        // Filter out default prompts (they are always loaded from files)
        // Only import custom prompts (id starts with 'custom-')
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const validCustomPrompts = importData.prompts.filter((p: any) => 
          p.id && p.title && p.content && p.id.startsWith('custom-')
        );

        // Get disabled default IDs from import
        const importedDisabledDefaults = Array.isArray(importData.disabledDefaultIds) 
          ? importData.disabledDefaultIds 
          : [];

        if (validCustomPrompts.length === 0 && importedDisabledDefaults.length === 0) {
          messageApi.error('No valid custom prompts or disabled defaults found in file');
          return;
        }

        Modal.confirm({
          title: 'Import Settings',
          content: `Found ${validCustomPrompts.length} custom prompts and ${importedDisabledDefaults.length} disabled defaults. How would you like to import?`,
          okText: 'Import',
          cancelText: 'Cancel',
          onOk: async () => {
            // Merge custom prompts (avoid duplicates by id)
            const existingIds = new Set(customPrompts.map(p => p.id));
            const newCustomPrompts = customPrompts.concat(
              validCustomPrompts.filter((p: Prompt) => !existingIds.has(p.id))
            );
            
            // Merge disabled defaults (avoid duplicates)
            const newDisabledDefaults = [...new Set([...disabledDefaultIds, ...importedDisabledDefaults])];
            
            setCustomPrompts(newCustomPrompts);
            setDisabledDefaultIds(newDisabledDefaults);
            await persistData(newCustomPrompts, newDisabledDefaults, syncedRepos, syncedPrompts, settings);
            messageApi.success(`Imported ${validCustomPrompts.length} prompts, ${newDisabledDefaults.length} disabled defaults`);
          },
        });
      } catch (error) {
        messageApi.error('Failed to parse file: ' + (error as Error).message);
      }
    };
    reader.readAsText(file);

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Open modal for add/edit
  const openModal = (prompt?: Prompt) => {
    // Don't allow editing default prompts
    if (prompt?.isDefault) {
      messageApi.warning('Default prompts cannot be edited');
      return;
    }
    setEditingPrompt(prompt || null);
    if (prompt) {
      form.setFieldsValue({
        title: prompt.title,
        content: prompt.content,
        description: prompt.description || '',
        tags: prompt.tags,
      });
    } else {
      form.resetFields();
    }
    setModalVisible(true);
  };

  // Handle form submit
  const handleSubmit = async (values: { title: string; content: string; description?: string; tags?: string[] }) => {
    const tags = values.tags || [];
    let newCustomPrompts: Prompt[];

    if (editingPrompt) {
      // Update existing custom prompt
      newCustomPrompts = customPrompts.map((p) =>
        p.id === editingPrompt.id
          ? { ...p, title: values.title, content: values.content, description: values.description, tags, updatedAt: Date.now() }
          : p
      );
    } else {
      // Add new custom prompt
      const newPrompt: Prompt = {
        id: `custom-${Date.now()}`,
        title: values.title,
        content: values.content,
        description: values.description,
        tags,
        createdAt: Date.now(),
        updatedAt: Date.now()
      };
      newCustomPrompts = [...customPrompts, newPrompt];
    }

    try {
      setCustomPrompts(newCustomPrompts);
      await persistData(newCustomPrompts, disabledDefaultIds, syncedRepos, syncedPrompts, settings);
      messageApi.success(editingPrompt ? 'Prompt updated' : 'Prompt added');
      setModalVisible(false);
      form.resetFields();
    } catch (error) {
      console.error('[PromptFlow] Failed to save prompt:', error);
      messageApi.error('Failed to save prompt');
    }
  };

  // Delete custom prompt only (default prompts cannot be deleted)
  const handleDelete = async (id: string) => {
    // Check if it's a default prompt
    const isDefault = id.match(/^[1-6]$/);
    if (isDefault) {
      messageApi.warning('Default prompts cannot be deleted');
      return;
    }
    
    const newCustomPrompts = customPrompts.filter((p) => p.id !== id);
    try {
      setCustomPrompts(newCustomPrompts);
      await persistData(newCustomPrompts, disabledDefaultIds, syncedRepos, syncedPrompts, settings);
      messageApi.success('Prompt deleted');
    } catch (error) {
      console.error('[PromptFlow] Failed to delete prompt:', error);
      messageApi.error('Failed to delete prompt');
    }
  };

  // Toggle prompt enabled status
  const handleToggleEnabled = async (id: string, enabled: boolean) => {
    try {
      // Check if it's a default prompt
      const isDefault = id.match(/^[1-6]$/);
      
      if (isDefault) {
        // Update disabledDefaultIds
        let newDisabledDefaultIds: string[];
        if (enabled) {
          newDisabledDefaultIds = disabledDefaultIds.filter(did => did !== id);
        } else {
          newDisabledDefaultIds = [...disabledDefaultIds, id];
        }
        setDisabledDefaultIds(newDisabledDefaultIds);
        await persistData(customPrompts, newDisabledDefaultIds, syncedRepos, syncedPrompts, settings);
      } else if (id.startsWith('sync-')) {
        // Synced prompt - delegate to handleToggleSyncedPrompt
        await handleToggleSyncedPrompt(id, enabled);
      } else {
        // Update custom prompts
        const newCustomPrompts = customPrompts.map((p) =>
          p.id === id ? { ...p, enabled } : p
        );
        setCustomPrompts(newCustomPrompts);
        await persistData(newCustomPrompts, disabledDefaultIds, syncedRepos, syncedPrompts, settings);
      }
      messageApi.success(enabled ? 'Prompt enabled' : 'Prompt disabled');
    } catch (error) {
      console.error('[PromptFlow] Failed to toggle prompt:', error);
      messageApi.error('Failed to update prompt status');
    }
  };

  // Reset prompts
  const handleReset = async () => {
    try {
      setCustomPrompts([]);
      setDisabledDefaultIds([]);
      await persistData([], [], syncedRepos, syncedPrompts, settings);
      messageApi.success('Prompts reset to defaults');
    } catch (error) {
      console.error('[PromptFlow] Failed to reset prompts:', error);
      messageApi.error('Failed to reset prompts');
    }
  };

  // Table columns
  const columns: ColumnsType<Prompt> = [
    {
      title: 'Title',
      dataIndex: 'title',
      key: 'title',
      render: (title: string, record) => (
        <Space>
          {
            record.id.startsWith('sync-') ? <Tag color="purple">Synced</Tag> : record.isDefault ? <Tag color="blue">Default</Tag> : <Tag color="green">Custom</Tag>
          }
          <Text strong>{title}</Text>
        </Space>
      ),
    },
    {
      title: 'Description',
      dataIndex: 'description',
      key: 'description',
      ellipsis: true,
      render: (desc: string) => desc || <Text type="secondary">No description</Text>,
    },
    {
      title: 'Tags',
      dataIndex: 'tags',
      key: 'tags',
      render: (tags: string[]) => (
        <Space wrap>
          {tags.map((tag) => <Tag key={tag}>{tag}</Tag>)}
        </Space>
      ),
    },
    {
      title: 'Status',
      key: 'enabled',
      width: 100,
      render: (_, record) => (
        <Switch
          checked={record.enabled !== false}
          onChange={(checked) => handleToggleEnabled(record.id, checked)}
          checkedChildren='On'
          unCheckedChildren='Off'
        />
      ),
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 200,
      render: (_, record) => {
        const isReadOnly = record.isDefault || record.id.startsWith('sync-');
        return (
          <Space>
            <Tooltip title="Preview">
              <Button
                type="text"
                icon={<FileTextOutlined />}
                onClick={() => {
                  setPreviewPrompt(record);
                  setPreviewVisible(true);
                }}
              />
            </Tooltip>
            <Tooltip title={isReadOnly ? 'This prompt cannot be edited' : 'Edit'}>
              <Button 
                type="text" 
                icon={<EditOutlined />} 
                onClick={() => openModal(record)}
                disabled={isReadOnly}
              />
            </Tooltip>
            <Tooltip title={isReadOnly ? 'This prompt cannot be deleted' : 'Delete'}>
              <Popconfirm
                title="Delete this prompt?"
                description="This action cannot be undone."
                onConfirm={() => handleDelete(record.id)}
                okText="Delete"
                cancelText="Cancel"
                okButtonProps={{ danger: true }}
                disabled={isReadOnly}
              >
                <Button type="text" danger icon={<DeleteOutlined />} disabled={isReadOnly} />
              </Popconfirm>
            </Tooltip>
          </Space>
        );
      },
    },
  ];

  return (
    <ConfigProvider theme={{ token: { colorPrimary: '#1890ff', borderRadius: 8 } }}>
      {contextHolder}
      <Layout style={{ minHeight: '100vh', background: '#f0f2f5' }}>
        <Header style={{ 
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', 
          padding: '24px 32px', 
          display: 'flex', 
          alignItems: 'center', 
          gap: 16,
          height: 'auto',
          lineHeight: 'normal',
        }}>
          <CodeOutlined style={{ fontSize: 32, color: '#fff' }} />
          <div>
            <Title level={3} style={{ color: '#fff', margin: '0 0 4px 0', fontWeight: 600 }}>PromptFlow Settings</Title>
            <Text style={{ color: 'rgba(255,255,255,0.85)', fontSize: 14 }}>Manage your prompts and customize your experience</Text>
          </div>
        </Header>

        <Content style={{ padding: 24, maxWidth: 1080, margin: '0 auto', width: '100%' }}>
          <Card title={<Space><SettingOutlined />General Settings</Space>} style={{ marginBottom: 24 }}>
            <Form layout="vertical">
              <Form.Item label="Trigger Command" tooltip="Type this command in any input field to open the prompt panel" style={{ marginBottom: 16 }}>
                <Input 
                  value={settings.trigger} 
                  onChange={(e) => handleSettingsChange('trigger', e.target.value)} 
                  placeholder="/prompts" 
                  style={{ maxWidth: 300 }}
                />
              </Form.Item>
              <Form.Item label="Auto Sync Interval" tooltip="How often to automatically sync prompts from GitHub repositories" style={{ marginBottom: 0 }}>
                <Select
                  value={settings.syncInterval || '1hour'}
                  onChange={(value) => handleSettingsChange('syncInterval', value)}
                  style={{ maxWidth: 200 }}
                >
                  <Select.Option value="15min">Every 15 minutes</Select.Option>
                  <Select.Option value="30min">Every 30 minutes</Select.Option>
                  <Select.Option value="1hour">Every hour</Select.Option>
                  <Select.Option value="2hours">Every 2 hours</Select.Option>
                  <Select.Option value="1day">Every day</Select.Option>
                </Select>
              </Form.Item>
            </Form>
          </Card>

          <Card
            title={<Space><FileTextOutlined />Prompts ({allPrompts.length})</Space>}
            extra={
              <Space>
                <Button icon={<SyncOutlined />} onClick={() => setSyncManagerVisible(true)}>
                  Sync from GitHub {syncedRepos.length > 0 && `(${syncedRepos.length})`}
                </Button>
                <Button icon={<UploadOutlined />} onClick={handleExport}>Export</Button>
                <Button icon={<DownloadOutlined />} onClick={() => fileInputRef.current?.click()}>Import</Button>
                <Button type="primary" icon={<PlusOutlined />} onClick={() => openModal()}>Add Prompt</Button>
              </Space>
            }
            style={{ marginBottom: 24 }}
          >
            <Table columns={columns} dataSource={allPrompts} rowKey="id" pagination={false} loading={loading} size="middle" />
          </Card>

          {/* Synced repos info */}
          {syncedRepos.length > 0 && (
            <Card style={{ marginBottom: 24, background: '#f8f5ff' }}>
              <Space direction="vertical" style={{ width: '100%' }}>
                <Text strong><GithubOutlined /> Synced from GitHub</Text>
                {syncedRepos.map(repo => (
                  <Space key={repo.id}>
                    <Tag color={repo.enabled ? 'green' : 'default'}>
                      {repo.enabled ? 'Active' : 'Disabled'}
                    </Tag>
                    <Text>{repo.repo}</Text>
                    <Text type="secondary">• {repo.branch}</Text>
                    <Text type="secondary">• Last sync: {repo.lastSyncedAt ? new Date(repo.lastSyncedAt).toLocaleString() : 'Never'}</Text>
                    <Button 
                      type="link" 
                      size="small" 
                      icon={syncingMap[repo.id] ? <LoadingOutlined /> : <SyncOutlined spin={!syncingMap[repo.id]} />}
                      onClick={() => handleSyncRepo(repo.id)}
                      loading={!!syncingMap[repo.id]}
                    >
                      Sync
                    </Button>
                  </Space>
                ))}
              </Space>
            </Card>
          )}

          {/* Usage Statistics */}
          <Card 
            title={<Space><BarChartOutlined /> Usage Statistics</Space>}
            extra={
              usageStats.length > 0 && (
                <Popconfirm
                  title="Clear usage history?"
                  description="This will reset all usage statistics. This action cannot be undone."
                  onConfirm={handleClearUsageHistory}
                  okText="Clear"
                  cancelText="Cancel"
                  okButtonProps={{ danger: true }}
                >
                  <Button danger size="small">Clear History</Button>
                </Popconfirm>
              )
            }
            style={{ marginBottom: 24 }}
          >
            {usageStats.length === 0 ? (
              <Text type="secondary">No usage data yet. Start using prompts to see statistics here.</Text>
            ) : (
              <>
                <Text type="secondary" style={{ display: 'block', marginBottom: 16 }}>
                  Total uses: {usageHistory.length} across {usageStats.length} prompts
                </Text>
                <Table
                  dataSource={usageStats}
                  rowKey="promptId"
                  pagination={false}
                  size="small"
                  scroll={{ y: 400 }}
                  sticky
                  columns={[
                      {
                        title: 'Prompt',
                        dataIndex: 'title',
                        key: 'title',
                        render: (text: string) => <Text ellipsis style={{ maxWidth: 300 }}>{text}</Text>,
                      },
                      {
                        title: 'Uses',
                        dataIndex: 'count',
                        key: 'count',
                        width: 80,
                        render: (count: number) => <Tag color="blue">{count}</Tag>,
                      },
                      {
                        title: 'Last Used',
                        dataIndex: 'lastUsed',
                        key: 'lastUsed',
                        width: 150,
                        render: (timestamp: number) => (
                          <Text type="secondary" style={{ fontSize: 12 }}>
                            {new Date(timestamp).toLocaleDateString()} {new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </Text>
                        ),
                      },
                    ]}
                  />
              </>
            )}
          </Card>

          <Card title={<Text type="danger"><SettingOutlined /> Danger Zone</Text>} style={{ borderColor: '#ff4d4f' }}>
            <Text type="secondary" style={{ display: 'block', marginBottom: 16 }}>
              This will clear all disabled default prompts and custom prompts. Default prompts will be restored from files.
            </Text>
            <Popconfirm
              title="Reset all prompts?"
              description="All disabled default prompts and custom prompts will be cleared."
              onConfirm={handleReset}
              okText="Reset"
              cancelText="Cancel"
              okButtonProps={{ danger: true }}
            >
              <Button icon={<ReloadOutlined />}>Reset to Default Prompts</Button>
            </Popconfirm>
          </Card>
        </Content>

        <Modal
          title={editingPrompt ? 'Edit Prompt' : 'Add New Prompt'}
          open={modalVisible}
          onCancel={() => { setModalVisible(false); form.resetFields(); }}
          footer={null}
          width={600}
        >
          <Form form={form} layout="vertical" onFinish={handleSubmit}>
            <Form.Item name="title" label="Title" rules={[{ required: true, message: 'Please enter a title' }]}>
              <Input placeholder="My Custom Prompt" />
            </Form.Item>
            <Form.Item name="content" label="Content" rules={[{ required: true, message: 'Please enter content' }]}>
              <TextArea rows={6} placeholder="Enter your prompt template..." />
            </Form.Item>
            <Form.Item name="description" label="Description">
              <Input placeholder="Brief description of this prompt" />
            </Form.Item>
            <Form.Item name="tags" label="Tags" tooltip="Press enter or comma to create tags">
              <Select mode="tags" placeholder="Add tags" style={{ width: '100%' }} tokenSeparators={[',']} />
            </Form.Item>
            <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
              <Space>
                <Button onClick={() => { setModalVisible(false); form.resetFields(); }}>Cancel</Button>
                <Button type="primary" htmlType="submit">{editingPrompt ? 'Update' : 'Create'}</Button>
              </Space>
            </Form.Item>
          </Form>
        </Modal>

        {/* Sync Manager Modal */}
        <SyncManager
          open={syncManagerVisible}
          onClose={() => setSyncManagerVisible(false)}
          repos={syncedRepos}
          prompts={syncedPrompts}
          onAddRepo={handleAddRepo}
          onRemoveRepo={handleRemoveRepo}
          onSyncRepo={handleSyncRepo}
          onToggleRepo={handleToggleRepo}
          onTogglePrompt={handleToggleSyncedPrompt}
        />

        {/* Prompt Preview Modal */}
        <PromptPreview
          prompt={previewPrompt}
          visible={previewVisible}
          onClose={() => setPreviewVisible(false)}
        />
      </Layout>
    </ConfigProvider>
  );
};

// Initialize React
const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(<SettingsApp />);
}

export default SettingsApp;
