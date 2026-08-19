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
} from './types/sync';
import { useI18n } from './i18n/useI18n';

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
  const { t, locale } = useI18n();

  const handleAddRepo = async (values: { repo: string; branch?: string; promptsPath?: string }) => {
    const branch = values.branch || 'main';
    const promptsPath = values.promptsPath || '.agents/prompts';
    
    try {
      // Validate repo format
      if (!values.repo.match(/^[\w-]+\/[\w-]+$/)) {
        messageApi.error(t('sync.invalidFormat', 'Invalid repo format. Use format: owner/repo'));
        return;
      }
      
      setIsAddingRepo(true);
      
      // Check if repo already exists
      const existingRepo = repos.find(r => r.repo === values.repo);
      
      if (existingRepo) {
        // Repo already exists, just sync it
        messageApi.info(t('sync.syncingExisting', 'Syncing existing repo {repo}...', { repo: values.repo }));
        await handleSyncRepo(existingRepo.id);
        form.resetFields();
        return;
      }
      
      // Test fetch to validate repo exists
      const files = await fetchGitHubDirectory(values.repo, promptsPath, branch);
      if (files.length === 0) {
        messageApi.warning(t('sync.noMarkdown', 'No markdown files found at {path}. Make sure the path is correct.', { path: promptsPath }));
        return;
      }
      
      const newPrompts = await onAddRepo({
        repo: values.repo,
        branch,
        promptsPath,
        enabled: true,
        enabledPromptIds: [],
      });
      
      messageApi.success(t('sync.addSuccess', 'Added repo {repo} with {count} prompts', { repo: values.repo, count: newPrompts.length }));
      form.resetFields();
    } catch (error) {
      messageApi.error(t('sync.addFailed', 'Failed to add repo: {message}', { message: (error as Error).message }));
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
      messageApi.success(t('sync.syncSuccess', 'Synced {count} prompts from {repo}', { count: newPrompts.length, repo: repo.repo }));
    } catch (error) {
      messageApi.error(t('sync.syncFailed', 'Sync failed: {message}', { message: (error as Error).message }));
    } finally {
      setSyncingRepos(prev => {
        const next = new Set(prev);
        next.delete(repoId);
        return next;
      });
      setSyncProgress(null);
    }
  }, [repos, onSyncRepo, messageApi, t]);

  const handleSyncAll = useCallback(async () => {
    if (repos.length === 0) {
      messageApi.warning(t('sync.noRepos', 'No repositories to sync'));
      return;
    }
    
    setIsSyncingAll(true);
    const enabledRepos = repos.filter(r => r.enabled);
    const total = enabledRepos.length;
    
    if (total === 0) {
      messageApi.warning(t('sync.noEnabledRepos', 'No enabled repositories to sync'));
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
      messageApi.success(t('sync.syncAllSuccess', 'Synced {count} repositories successfully', { count: successCount }));
    } else {
      messageApi.warning(t('sync.syncAllPartial', 'Synced {count}, failed {failed} repositories', { count: successCount, failed: failCount }));
    }
  }, [repos, onSyncRepo, messageApi, t]);

  const getRepoPrompts = (repoId: string) => prompts.filter(p => p.repoId === repoId);

  const formatLastSynced = (timestamp?: number) => {
    if (!timestamp) return t('sync.neverSynced', 'Never synced');
    const date = new Date(timestamp);
    return date.toLocaleString(locale);
  };

  const enabledRepos = repos.filter(r => r.enabled);
  const hasEnabledRepos = enabledRepos.length > 0;
  const isAnySyncing = syncingRepos.size > 0 || isSyncingAll;

  return (
    <Modal
      title={
        <Space>
          <GithubOutlined />
          <span>{t('sync.title', 'Sync Prompts from GitHub')}</span>
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
          rules={[{ required: true, message: t('sync.repo.required', 'Enter repo (owner/repo)') }]}
          style={{ flex: 2 }}
        >
          <Input placeholder={t('sync.repo.placeholder', 'owner/repo')} disabled={isAddingRepo || isSyncingAll} />
        </Form.Item>
        <Form.Item name="branch" style={{ flex: 1 }}>
          <Input placeholder={t('sync.branch.placeholder', 'branch (default: main)')} defaultValue="main" disabled={isAddingRepo || isSyncingAll} />
        </Form.Item>
        <Form.Item name="promptsPath" style={{ flex: 2 }}>
          <Input 
            placeholder={t('sync.path.placeholder', '.agents/prompts')} 
            defaultValue=".agents/prompts" 
            disabled={isAddingRepo || isSyncingAll}
            addonBefore={t('sync.path.label', 'Path:')}
          />
        </Form.Item>
        <Form.Item>
          <Button 
            type="primary" 
            htmlType="submit" 
            loading={isAddingRepo}
            disabled={isSyncingAll}
          >
            {isAddingRepo ? t('sync.adding', 'Adding...') : t('sync.addRepo', 'Add Repo')}
          </Button>
        </Form.Item>
      </Form>

      {/* Sync progress */}
      {syncProgress && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <LoadingOutlined />
            <Text type="secondary">
              {t('sync.progress', 'Syncing {repo} ({current}/{total})', { repo: syncProgress.currentRepo, current: syncProgress.current, total: syncProgress.total })}
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
            {isSyncingAll ? t('sync.syncingAll', 'Syncing...') : t('sync.syncAll', 'Sync All ({count})', { count: enabledRepos.length })}
          </Button>
        </div>
      )}

      {/* Repo list */}
      {repos.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 40, color: '#999' }}>
          <GithubOutlined style={{ fontSize: 48, marginBottom: 16 }} />
          <Text type="secondary">{t('sync.empty', 'No repositories configured')}</Text>
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
                  <Tooltip key="sync" title={isSyncing ? t('sync.syncingAll', 'Syncing...') : t('sync.now', 'Sync now')}>
                    <Button
                      type="text"
                      icon={isSyncing ? <LoadingOutlined /> : <SyncOutlined />}
                      onClick={() => handleSyncRepo(repo.id)}
                      disabled={isSyncing || isSyncingAll}
                    />
                  </Tooltip>,
                  <Popconfirm key="remove"
                    title={t('sync.removeTitle', 'Remove this repository?')}
                    description={t('sync.removeDesc', 'All synced prompts from this repo will be removed.')}
                    onConfirm={() => onRemoveRepo(repo.id)}
                    okText={t('sync.removeOk', 'Remove')}
                    okButtonProps={{ danger: true, disabled: isSyncing || isSyncingAll }}
                  >
                    <Tooltip title={t('sync.removeTooltip', 'Remove repo')}>
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
                        <Tag color="processing" icon={<LoadingOutlined />}>{t('sync.syncingTag', 'Syncing')}</Tag>
                      ) : repo.enabled ? (
                        <CheckCircleOutlined style={{ color: '#52c41a' }} />
                      ) : (
                        <ExclamationCircleOutlined style={{ color: '#faad14' }} />
                      )}
                    </Space>
                  }
                  description={
                    <Space orientation="vertical" size="small" style={{ width: '100%' }}>
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        {t('sync.path.label', 'Path:')} <code>{repo.promptsPath}</code> • {t('sync.lastSynced', 'Last synced:')} {formatLastSynced(repo.lastSyncedAt)}
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
                              {prompt.name}
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
      <div style={{ marginTop: 16, padding: 16, borderRadius: 8, border: '1px solid var(--ant-color-border)' }}>
        <Text type="secondary" style={{ fontSize: 12 }}>
          <strong>{t('sync.howItWorks', 'How it works:')}</strong> {t('sync.howItWorksDesc', 'Add a GitHub repository to sync prompts from a specific directory. Scrapes GitHub page for file list, fetches content via raw.githubusercontent.com.')}
        </Text>
        <div style={{ marginTop: 12 }}>
          <Text strong style={{ fontSize: 12 }}>{t('sync.requirements.title', 'Repository structure requirements:')}</Text>
          <ul style={{ margin: '8px 0 0 0', paddingLeft: 16, fontSize: 12 }}>
            <li>{t('sync.requirements.md', 'Prompt files must be')} <code>.md</code> {t('sync.requirements.mdSuffix', 'files')}</li>
            <li>{t('sync.requirements.frontmatter', 'Each file must have YAML frontmatter with')} <code>title</code> {t('sync.requirements.frontmatterSuffix', 'field')}</li>
            <li>{t('sync.requirements.optional', 'Optional frontmatter:')} <code>description</code>{t('sync.requirements.optionalSeparator', ',')} <code>tags</code></li>
          </ul>
        </div>
        <div style={{ marginTop: 12 }}>
<Text strong style={{ fontSize: 12 }}>{t('sync.example.title', 'Example file structure:')}</Text>
          <pre style={{ margin: '8px 0 0 0', padding: 8, borderRadius: 4, fontSize: 11, overflow: 'auto' }}>
{`---
name: My Prompt
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