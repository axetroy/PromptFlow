import React, { useState, useCallback } from 'react';
import {
  Modal,
  Form,
  Input,
  Button,
  List,
  Space,
  Tag,
  Switch,
  Typography,
  Tooltip,
  Progress,
  message,
  Popconfirm,
} from 'antd';
import {
  GithubOutlined,
  SyncOutlined,
  DeleteOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  LoadingOutlined,
} from '@ant-design/icons';
import {
  SyncedRepo,
  SyncedPrompt,
  fetchGitHubDirectory,
  isValidRepoFormat,
} from './types/sync';

const { Text } = Typography;

interface SyncManagerProps {
  open: boolean;
  onClose: () => void;
  repos: SyncedRepo[];
  prompts: SyncedPrompt[];
  onAddRepo: (repo: Omit<SyncedRepo, 'id' | 'lastSyncedAt'>) => Promise<SyncedPrompt[]>;
  onRemoveRepo: (repoId: string) => void;
  onSyncRepo: (repoId: string) => Promise<SyncedPrompt[]>;
  onToggleRepo: (repoId: string, enabled: boolean) => void;
  onTogglePrompt: (promptId: string, enabled: boolean) => void;
}

interface SyncProgress {
  current: number;
  total: number;
  currentRepo: string;
}

const SyncManager: React.FC<SyncManagerProps> = ({
  open,
  onClose,
  repos,
  prompts,
  onAddRepo,
  onRemoveRepo,
  onSyncRepo,
  onToggleRepo,
  onTogglePrompt,
}) => {
  const [form] = Form.useForm();
  const [syncingRepos, setSyncingRepos] = useState<Set<string>>(new Set());
  const [isAddingRepo, setIsAddingRepo] = useState(false);
  const [isSyncingAll, setIsSyncingAll] = useState(false);
  const [syncProgress, setSyncProgress] = useState<SyncProgress | null>(null);
  const [messageApi, contextHolder] = message.useMessage();

  const handleAddRepo = async (values: { repo: string; branch?: string; promptsPath?: string }) => {
    const branch = values.branch || 'main';
    const promptsPath = values.promptsPath || '.agents/prompts';
    
    try {
      // Validate repo format
      if (!isValidRepoFormat(values.repo)) {
        messageApi.error('Invalid repo format. Use format: owner/repo');
        return;
      }
      
      setIsAddingRepo(true);
      
      // Check if repo already exists
      const existingRepo = repos.find(r => r.repo === values.repo);
      
      if (existingRepo) {
        // Repo already exists, just sync it
        messageApi.info(`Syncing existing repo ${values.repo}...`);
        await handleSyncRepo(existingRepo.id);
        form.resetFields();
        return;
      }
      
      // Test fetch to validate repo exists
      const files = await fetchGitHubDirectory(values.repo, promptsPath, branch);
      if (files.length === 0) {
        messageApi.warning(`No markdown files found at ${promptsPath}. Make sure the path is correct.`);
        return;
      }
      
      const newPrompts = await onAddRepo({
        repo: values.repo,
        branch,
        promptsPath,
        enabled: true,
        enabledPromptIds: [],
      });
      
      messageApi.success(`Added repo ${values.repo} with ${newPrompts.length} prompts`);
      form.resetFields();
    } catch (error) {
      messageApi.error(`Failed to add repo: ${(error as Error).message}`);
    } finally {
      setIsAddingRepo(false);
    }
  };

  const handleSyncRepo = useCallback(async (repoId: string) => {
    const repo = repos.find(r => r.id === repoId);
    if (!repo) return;
    
    setSyncingRepos(prev => new Set(prev).add(repoId));
    setSyncProgress({ current: 1, total: 1, currentRepo: repo.repo });
    
    try {
      const newPrompts = await onSyncRepo(repoId);
      messageApi.success(`Synced ${newPrompts.length} prompts from ${repo.repo}`);
    } catch (error) {
      messageApi.error(`Sync failed: ${(error as Error).message}`);
    } finally {
      setSyncingRepos(prev => {
        const next = new Set(prev);
        next.delete(repoId);
        return next;
      });
      setSyncProgress(null);
    }
  }, [repos, onSyncRepo, messageApi]);

  const handleSyncAll = useCallback(async () => {
    if (repos.length === 0) {
      messageApi.warning('No repositories to sync');
      return;
    }
    
    setIsSyncingAll(true);
    const enabledRepos = repos.filter(r => r.enabled);
    const total = enabledRepos.length;
    
    if (total === 0) {
      messageApi.warning('No enabled repositories to sync');
      setIsSyncingAll(false);
      return;
    }
    
    let successCount = 0;
    let failCount = 0;
    
    for (let i = 0; i < enabledRepos.length; i++) {
      const repo = enabledRepos[i];
      setSyncProgress({ current: i + 1, total, currentRepo: repo.repo });
      setSyncingRepos(prev => new Set(prev).add(repo.id));
      
      try {
        await onSyncRepo(repo.id);
        successCount++;
      } catch (error) {
        failCount++;
        console.error(`Failed to sync ${repo.repo}:`, error);
      } finally {
        setSyncingRepos(prev => {
          const next = new Set(prev);
          next.delete(repo.id);
          return next;
        });
      }
    }
    
    setSyncProgress(null);
    setIsSyncingAll(false);
    
    if (failCount === 0) {
      messageApi.success(`Synced ${successCount} repository(s) successfully`);
    } else {
      messageApi.warning(`Synced ${successCount}, failed ${failCount} repository(s)`);
    }
  }, [repos, onSyncRepo, messageApi]);

  const getRepoPrompts = (repoId: string) => prompts.filter(p => p.repoId === repoId);

  const formatLastSynced = (timestamp?: number) => {
    if (!timestamp) return 'Never synced';
    const date = new Date(timestamp);
    return date.toLocaleString();
  };

  const enabledRepos = repos.filter(r => r.enabled);
  const hasEnabledRepos = enabledRepos.length > 0;
  const isAnySyncing = syncingRepos.size > 0 || isSyncingAll;

  return (
    <Modal
      title={
        <Space>
          <GithubOutlined />
          <span>Sync Prompts from GitHub</span>
        </Space>
      }
      open={open}
      onCancel={onClose}
      footer={null}
      width={700}
    >
      {contextHolder}
      
      {/* Add new repo form */}
      <Form
        form={form}
        layout="inline"
        onFinish={handleAddRepo}
        style={{ marginBottom: 16 }}
      >
        <Form.Item
          name="repo"
          rules={[{ required: true, message: 'Enter repo (owner/repo)' }]}
          style={{ flex: 2 }}
        >
          <Input placeholder="owner/repo" disabled={isAddingRepo || isSyncingAll} />
        </Form.Item>
        <Form.Item name="branch" style={{ flex: 1 }}>
          <Input placeholder="branch (default: main)" defaultValue="main" disabled={isAddingRepo || isSyncingAll} />
        </Form.Item>
        <Form.Item name="promptsPath" style={{ flex: 2 }}>
          <Input 
            placeholder=".agents/prompts" 
            defaultValue=".agents/prompts" 
            disabled={isAddingRepo || isSyncingAll}
            addonBefore="Path:"
          />
        </Form.Item>
        <Form.Item>
          <Button 
            type="primary" 
            htmlType="submit" 
            loading={isAddingRepo}
            disabled={isSyncingAll}
          >
            {isAddingRepo ? 'Adding...' : 'Add Repo'}
          </Button>
        </Form.Item>
      </Form>

      {/* Sync progress */}
      {syncProgress && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <LoadingOutlined />
            <Text type="secondary">
              Syncing {syncProgress.currentRepo} ({syncProgress.current}/{syncProgress.total})
            </Text>
          </div>
          <Progress 
            percent={Math.round((syncProgress.current / syncProgress.total) * 100)} 
            size="small"
            showInfo={false}
          />
        </div>
      )}

      {/* Sync all button */}
      {repos.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <Button
            icon={isSyncingAll ? <LoadingOutlined /> : <SyncOutlined />}
            onClick={handleSyncAll}
            loading={isSyncingAll}
            disabled={isAnySyncing || !hasEnabledRepos}
          >
            {isSyncingAll ? 'Syncing...' : `Sync All (${enabledRepos.length} repo${enabledRepos.length !== 1 ? 's' : ''})`}
          </Button>
        </div>
      )}

      {/* Repo list */}
      {repos.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 40, color: '#999' }}>
          <GithubOutlined style={{ fontSize: 48, marginBottom: 16 }} />
          <Text type="secondary">No repositories configured</Text>
        </div>
      ) : (
        <List
          dataSource={repos}
          renderItem={(repo) => {
            const repoPrompts = getRepoPrompts(repo.id);
            const isSyncing = syncingRepos.has(repo.id);
            
            return (
              <List.Item
                key={repo.id}
                actions={[
                  <Tooltip key="sync" title={isSyncing ? 'Syncing...' : 'Sync now'}>
                    <Button
                      type="text"
                      icon={isSyncing ? <LoadingOutlined /> : <SyncOutlined spin={!isSyncing && !isSyncingAll} />}
                      onClick={() => handleSyncRepo(repo.id)}
                      disabled={isSyncing || isSyncingAll}
                    />
                  </Tooltip>,
                  <Popconfirm key="remove"
                    title="Remove this repository?"
                    description="All synced prompts from this repo will be removed."
                    onConfirm={() => onRemoveRepo(repo.id)}
                    okText="Remove"
                    okButtonProps={{ danger: true, disabled: isSyncing || isSyncingAll }}
                  >
                    <Tooltip title="Remove repo">
                      <Button 
                        type="text" 
                        danger 
                        icon={<DeleteOutlined />} 
                        disabled={isSyncing || isSyncingAll}
                      />
                    </Tooltip>
                  </Popconfirm>,
                ]}
              >
                <List.Item.Meta
                  title={
                    <Space>
                      <Switch
                        size="small"
                        checked={repo.enabled}
                        onChange={(checked) => onToggleRepo(repo.id, checked)}
                        disabled={isSyncingAll}
                      />
                      <GithubOutlined />
                      <Text strong={repo.enabled}>{repo.repo}</Text>
                      <Tag>{repo.branch}</Tag>
                      {isSyncing ? (
                        <Tag color="processing" icon={<LoadingOutlined />}>Syncing</Tag>
                      ) : repo.enabled ? (
                        <CheckCircleOutlined style={{ color: '#52c41a' }} />
                      ) : (
                        <ExclamationCircleOutlined style={{ color: '#faad14' }} />
                      )}
                    </Space>
                  }
                  description={
                    <Space direction="vertical" size="small" style={{ width: '100%' }}>
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        Path: <code>{repo.promptsPath}</code> • Last synced: {formatLastSynced(repo.lastSyncedAt)}
                      </Text>
                      {repoPrompts.length > 0 && (
                        <Space wrap>
                          {repoPrompts.map(prompt => (
                            <Tag
                              key={prompt.id}
                              color={prompt.enabled !== false ? 'green' : 'default'}
                              style={{ cursor: 'pointer' }}
                              onClick={() => !isSyncing && !isSyncingAll && onTogglePrompt(prompt.id, !prompt.enabled)}
                            >
                              {prompt.title}
                            </Tag>
                          ))}
                        </Space>
                      )}
                    </Space>
                  }
                />
              </List.Item>
            );
          }}
        />
      )}

      {/* Help text */}
      <div style={{ marginTop: 16, padding: 16, background: '#f5f5f5', borderRadius: 8 }}>
        <Text type="secondary" style={{ fontSize: 12 }}>
          <strong>How it works:</strong> Add a GitHub repository to sync prompts from a specific directory.
          Scrapes GitHub page for file list, fetches content via raw.githubusercontent.com.
        </Text>
        <div style={{ marginTop: 12 }}>
          <Text strong style={{ fontSize: 12 }}>Repository structure requirements:</Text>
          <ul style={{ margin: '8px 0 0 0', paddingLeft: 16, fontSize: 12 }}>
            <li>Prompt files must be <code>.md</code> files</li>
            <li>Each file must have YAML frontmatter with <code>title</code> field</li>
            <li>Optional frontmatter: <code>description</code>, <code>tags</code></li>
          </ul>
        </div>
        <div style={{ marginTop: 12 }}>
          <Text strong style={{ fontSize: 12 }}>Example file structure:</Text>
          <pre style={{ margin: '8px 0 0 0', padding: 8, background: '#fff', borderRadius: 4, fontSize: 11, overflow: 'auto' }}>
{`---
title: My Prompt
description: A useful prompt
tags: [chat, helpful]
---
Your prompt content here...`}
          </pre>
        </div>
      </div>
    </Modal>
  );
};

export default SyncManager;