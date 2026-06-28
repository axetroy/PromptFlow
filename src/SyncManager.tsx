import React, { useState } from 'react';
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
  Spin,
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
  fetchGitHubFileContent,
  parseFrontmatter,
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
  const [messageApi, contextHolder] = message.useMessage();

  const handleAddRepo = async (values: { repo: string; branch?: string; promptsPath?: string }) => {
    const branch = values.branch || 'main';
    const promptsPath = values.promptsPath || '.agents/prompts';
    
    try {
      // Validate repo format
      if (!values.repo.match(/^[\w-]+\/[\w-]+$/)) {
        messageApi.error('Invalid repo format. Use format: owner/repo');
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
    }
  };

  const handleSyncRepo = async (repoId: string) => {
    setSyncingRepos(prev => new Set(prev).add(repoId));
    try {
      const newPrompts = await onSyncRepo(repoId);
      messageApi.success(`Synced ${newPrompts.length} prompts`);
    } catch (error) {
      messageApi.error(`Sync failed: ${(error as Error).message}`);
    } finally {
      setSyncingRepos(prev => {
        const next = new Set(prev);
        next.delete(repoId);
        return next;
      });
    }
  };

  const getRepoPrompts = (repoId: string) => prompts.filter(p => p.repoId === repoId);

  const formatLastSynced = (timestamp?: number) => {
    if (!timestamp) return 'Never synced';
    const date = new Date(timestamp);
    return date.toLocaleString();
  };

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
        style={{ marginBottom: 24 }}
      >
        <Form.Item
          name="repo"
          rules={[{ required: true, message: 'Enter repo (owner/repo)' }]}
          style={{ flex: 2 }}
        >
          <Input placeholder="owner/repo" />
        </Form.Item>
        <Form.Item name="branch" style={{ flex: 1 }}>
          <Input placeholder="branch (default: main)" defaultValue="main" />
        </Form.Item>
        <Form.Item name="promptsPath" style={{ flex: 1 }}>
          <Input placeholder="path (default: .agents/prompts)" defaultValue=".agents/prompts" />
        </Form.Item>
        <Form.Item>
          <Button type="primary" htmlType="submit">Add Repo</Button>
        </Form.Item>
      </Form>

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
                  <Tooltip title="Sync now">
                    <Button
                      type="text"
                      icon={isSyncing ? <LoadingOutlined /> : <SyncOutlined spin={isSyncing} />}
                      onClick={() => handleSyncRepo(repo.id)}
                      disabled={isSyncing}
                    />
                  </Tooltip>,
                  <Popconfirm
                    title="Remove this repository?"
                    description="All synced prompts from this repo will be removed."
                    onConfirm={() => onRemoveRepo(repo.id)}
                    okText="Remove"
                    okButtonProps={{ danger: true }}
                  >
                    <Tooltip title="Remove repo">
                      <Button type="text" danger icon={<DeleteOutlined />} />
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
                      />
                      <GithubOutlined />
                      <Text strong>{repo.repo}</Text>
                      <Tag>{repo.branch}</Tag>
                      {repo.enabled ? (
                        <CheckCircleOutlined style={{ color: '#52c41a' }} />
                      ) : (
                        <ExclamationCircleOutlined style={{ color: '#faad14' }} />
                      )}
                    </Space>
                  }
                  description={
                    <Space direction="vertical" size="small" style={{ width: '100%' }}>
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        Path: <code>.agents/prompts</code> • Last synced: {formatLastSynced(repo.lastSyncedAt)}
                      </Text>
                      {repoPrompts.length > 0 && (
                        <Space wrap>
                          {repoPrompts.map(prompt => (
                            <Tag
                              key={prompt.id}
                              color={prompt.enabled !== false ? 'green' : 'default'}
                              style={{ cursor: 'pointer' }}
                              onClick={() => onTogglePrompt(prompt.id, !prompt.enabled)}
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
          <strong>How it works:</strong> Add a GitHub repository to sync prompts from the <code>.agents/prompts/</code> directory.
          Prompts are read from <code>.md</code> files in the configured directory.
          Each prompt file should have YAML frontmatter with <code>title</code> and optionally <code>description</code> and <code>tags</code>.
        </Text>
      </div>
    </Modal>
  );
};

export default SyncManager;