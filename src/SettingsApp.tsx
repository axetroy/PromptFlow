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
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';

// Import Ant Design styles
import 'antd/dist/reset.css';

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
  isDefault?: boolean;
}

interface PromptSettings {
  trigger: string;
  insertMode: 'replace' | 'append';
}

interface StorageData {
  prompts: Prompt[];
  settings: PromptSettings;
}

// Default prompts
const getDefaultPrompts = (): Prompt[] => [
  {
    id: '1',
    title: 'Code Review',
    content: 'Please review the following code and suggest improvements:\n\n```\n{code}\n```\n\nFocus on:\n- Code quality\n- Performance\n- Security',
    description: 'Review code and provide improvement suggestions',
    tags: ['dev', 'review', 'code'],
    createdAt: Date.now(),
    updatedAt: Date.now(),
    isDefault: true,
  },
  {
    id: '2',
    title: 'Explain Code',
    content: 'Explain the following code in detail:\n\n```\n{code}\n```\n\nPlease include:\n- What the code does\n- How it works\n- Key components',
    description: 'Get detailed explanation of any code',
    tags: ['dev', 'explanation', 'learning'],
    createdAt: Date.now(),
    updatedAt: Date.now(),
    isDefault: true,
  },
  {
    id: '3',
    title: 'Bug Fix',
    content: 'I have a bug in the following code:\n\n```\n{code}\n```\n\nError message:\n{error}\n\nPlease help me identify and fix the issue.',
    description: 'Debug and fix code issues',
    tags: ['dev', 'debug', 'fix'],
    createdAt: Date.now(),
    updatedAt: Date.now(),
    isDefault: true,
  },
  {
    id: '4',
    title: 'Write Tests',
    content: 'Write comprehensive tests for the following code:\n\n```\n{code}\n```\n\nRequirements:\n- Cover edge cases\n- Use best practices\n- Include comments',
    description: 'Generate test cases for code',
    tags: ['dev', 'testing', 'quality'],
    createdAt: Date.now(),
    updatedAt: Date.now(),
    isDefault: true,
  },
  {
    id: '5',
    title: 'Refactor Code',
    content: 'Refactor the following code to improve readability and maintainability:\n\n```\n{code}\n```\n\nGoals:\n- Cleaner architecture\n- Better naming\n- Reduced complexity',
    description: 'Improve code structure and quality',
    tags: ['dev', 'refactor', 'cleanup'],
    createdAt: Date.now(),
    updatedAt: Date.now(),
    isDefault: true,
  },
];

// Storage helpers
const loadData = (): Promise<StorageData> => {
  return new Promise((resolve) => {
    chrome.storage.local.get(['promptflow-data'], (result) => {
      const data = result['promptflow-data'] as StorageData | undefined;
      if (data) {
        resolve(data);
      } else {
        resolve({
          prompts: getDefaultPrompts(),
          settings: { trigger: '/prompts', insertMode: 'replace' },
        });
      }
    });
  });
};

const saveData = (data: StorageData): Promise<void> => {
  return new Promise((resolve) => {
    chrome.storage.local.set({ 'promptflow-data': data }, resolve);
  });
};

// Settings App Component
const SettingsApp: React.FC = () => {
  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [settings, setSettings] = useState<PromptSettings>({ trigger: '/prompts', insertMode: 'replace' });
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingPrompt, setEditingPrompt] = useState<Prompt | null>(null);
  const [form] = Form.useForm();
  const [messageApi, contextHolder] = message.useMessage();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load data on mount
  useEffect(() => {
    loadData().then((data) => {
      setPrompts(data.prompts);
      setSettings(data.settings);
      setLoading(false);
    });
  }, []);

  // Save data whenever prompts or settings change
  const persistData = useCallback(async (newPrompts: Prompt[], newSettings: PromptSettings) => {
    await saveData({ prompts: newPrompts, settings: newSettings });
  }, []);

  // Handle settings change
  const handleSettingsChange = async (key: keyof PromptSettings, value: string) => {
    const newSettings = { ...settings, [key]: value };
    setSettings(newSettings);
    await persistData(prompts, newSettings);
    messageApi.success('Settings saved');
  };

  // Export prompts to JSON file
  const handleExport = () => {
    const exportData = {
      version: '1.0',
      exportedAt: new Date().toISOString(),
      prompts: prompts,
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
    messageApi.success(`Exported ${prompts.length} prompts`);
  };

  // Import prompts from JSON file
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

        // Validate prompts structure
        const validPrompts = importData.prompts.filter((p: any) => 
          p.id && p.title && p.content
        );

        if (validPrompts.length === 0) {
          messageApi.error('No valid prompts found in file');
          return;
        }

        Modal.confirm({
          title: 'Import Prompts',
          content: `Found ${validPrompts.length} prompts. How would you like to import them?`,
          okText: 'Merge',
          cancelText: 'Cancel',
          onOk: async () => {
            // Merge with existing prompts (avoid duplicates by id)
            const existingIds = new Set(prompts.map(p => p.id));
            const newPrompts = prompts.concat(
              validPrompts.filter((p: Prompt) => !existingIds.has(p.id))
            );
            setPrompts(newPrompts);
            await persistData(newPrompts, settings);
            messageApi.success(`Merged ${validPrompts.length} prompts`);
          },
        });

        // Replace option
        Modal.confirm({
          title: 'Or Replace All',
          content: 'Would you like to replace all existing prompts with the imported ones?',
          okText: 'Replace All',
          cancelText: 'Cancel',
          onOk: async () => {
            setPrompts(validPrompts);
            await persistData(validPrompts, settings);
            messageApi.success(`Replaced with ${validPrompts.length} prompts`);
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
    let newPrompts: Prompt[];

    if (editingPrompt) {
      // Update existing prompt
      newPrompts = prompts.map((p) =>
        p.id === editingPrompt.id
          ? { ...p, title: values.title, content: values.content, description: values.description, tags, updatedAt: Date.now() }
          : p
      );
      messageApi.success('Prompt updated');
    } else {
      // Add new prompt
      const newPrompt: Prompt = {
        id: `custom-${Date.now()}`,
        title: values.title,
        content: values.content,
        description: values.description,
        tags,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        isDefault: false,
      };
      newPrompts = [...prompts, newPrompt];
      messageApi.success('Prompt added');
    }

    setPrompts(newPrompts);
    await persistData(newPrompts, settings);
    setModalVisible(false);
    form.resetFields();
  };

  // Delete prompt
  const handleDelete = async (id: string) => {
    const newPrompts = prompts.filter((p) => p.id !== id);
    setPrompts(newPrompts);
    await persistData(newPrompts, settings);
    messageApi.success('Prompt deleted');
  };

  // Reset prompts
  const handleReset = async () => {
    const defaultPrompts = getDefaultPrompts();
    setPrompts(defaultPrompts);
    await persistData(defaultPrompts, settings);
    messageApi.success('Prompts reset to defaults');
  };

  // Table columns
  const columns: ColumnsType<Prompt> = [
    {
      title: 'Title',
      dataIndex: 'title',
      key: 'title',
      render: (title: string, record) => (
        <Space>
          <Text strong>{title}</Text>
          {record.isDefault && <Tag color="blue">Default</Tag>}
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
      title: 'Actions',
      key: 'actions',
      width: 150,
      render: (_, record) => (
        <Space>
          <Tooltip title={record.isDefault ? 'Default prompts cannot be edited' : 'Edit'}>
            <Button type="text" icon={<EditOutlined />} disabled={record.isDefault} onClick={() => openModal(record)} />
          </Tooltip>
          <Tooltip title={record.isDefault ? 'Default prompts cannot be deleted' : 'Delete'}>
            <Popconfirm
              title="Delete this prompt?"
              description="This action cannot be undone."
              onConfirm={() => handleDelete(record.id)}
              okText="Delete"
              cancelText="Cancel"
              okButtonProps={{ danger: true }}
              disabled={record.isDefault}
            >
              <Button type="text" danger icon={<DeleteOutlined />} disabled={record.isDefault} />
            </Popconfirm>
          </Tooltip>
        </Space>
      ),
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

        <Content style={{ padding: 24, maxWidth: 900, margin: '0 auto', width: '100%' }}>
          <Card title={<Space><SettingOutlined />General Settings</Space>} style={{ marginBottom: 24 }}>
            <Form layout="vertical">
              <Form.Item label="Trigger Command" tooltip="Type this command in any input field to open the prompt panel" style={{ marginBottom: 8 }}>
                <Input 
                  value={settings.trigger} 
                  onChange={(e) => handleSettingsChange('trigger', e.target.value)} 
                  placeholder="/prompts" 
                  style={{ maxWidth: 300 }}
                />
              </Form.Item>
            </Form>
          </Card>

          <Card
            title={<Space><FileTextOutlined />Prompts ({prompts.length})</Space>}
            extra={
              <Space>
                <Button icon={<UploadOutlined />} onClick={handleExport}>Export</Button>
                <Button icon={<DownloadOutlined />} onClick={() => fileInputRef.current?.click()}>Import</Button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".json"
                  style={{ display: 'none' }}
                  onChange={handleImport}
                />
                <Button type="primary" icon={<PlusOutlined />} onClick={() => openModal()}>Add Prompt</Button>
              </Space>
            }
            style={{ marginBottom: 24 }}
          >
            <Table columns={columns} dataSource={prompts} rowKey="id" pagination={false} loading={loading} size="middle" />
          </Card>

          <Card title={<Text type="danger"><SettingOutlined /> Danger Zone</Text>} style={{ borderColor: '#ff4d4f' }}>
            <Text type="secondary" style={{ display: 'block', marginBottom: 16 }}>
              This will delete all custom prompts and restore the default ones. This action cannot be undone.
            </Text>
            <Popconfirm
              title="Reset all prompts?"
              description="All custom prompts will be deleted. Default prompts will be restored."
              onConfirm={handleReset}
              okText="Reset"
              cancelText="Cancel"
              okButtonProps={{ danger: true }}
            >
              <Button icon={<ReloadOutlined />}>Reset Prompts to Defaults</Button>
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
