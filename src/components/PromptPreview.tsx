import React from 'react';
import { Modal, Tag, Space, Typography } from 'antd';
import { FileTextOutlined } from '@ant-design/icons';

const { Text } = Typography;

export interface Prompt {
  id: string;
  title: string;
  content: string;
  description?: string;
  tags: string[];
  createdAt: number;
  updatedAt: number;
  enabled?: boolean;
  isDefault?: boolean;
}

interface PromptPreviewProps {
  prompt: Prompt | null;
  visible: boolean;
  onClose: () => void;
}

export const PromptPreview: React.FC<PromptPreviewProps> = ({ prompt, visible, onClose }) => {
  if (!prompt) return null;

  return (
    <Modal
      title={
        <Space>
          <FileTextOutlined />
          <span>{prompt.title}</span>
          {prompt.isDefault && <Tag color="blue">Default</Tag>}
          {prompt.id.startsWith('sync-') && <Tag color="purple">Synced</Tag>}
          {!prompt.isDefault && !prompt.id.startsWith('sync-') && <Tag color="green">Custom</Tag>}
        </Space>
      }
      open={visible}
      onCancel={onClose}
      footer={null}
      width={700}
      style={{ top: 20 }}
    >
      {prompt.description && (
        <div style={{ marginBottom: 16 }}>
          <Text type="secondary">{prompt.description}</Text>
        </div>
      )}
      
      {prompt.tags.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <Space wrap>
            {prompt.tags.map((tag) => (
              <Tag key={tag}>{tag}</Tag>
            ))}
          </Space>
        </div>
      )}

      <div
        style={{
          background: '#f5f5f5',
          border: '1px solid #d9d9d9',
          borderRadius: 6,
          padding: 16,
          fontFamily: 'Monaco, Menlo, "Ubuntu Mono", monospace',
          fontSize: 13,
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
          maxHeight: 400,
          overflow: 'auto',
          lineHeight: 1.6,
        }}
      >
        {prompt.content}
      </div>

      <div style={{ marginTop: 16, color: '#999', fontSize: 12 }}>
        <Text type="secondary">
          Last updated: {new Date(prompt.updatedAt).toLocaleString()}
        </Text>
      </div>
    </Modal>
  );
};

export default PromptPreview;
