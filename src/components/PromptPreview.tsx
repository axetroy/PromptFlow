import React from 'react';
import { Modal, Tag, Space, Typography } from 'antd';
import { FileTextOutlined } from '@ant-design/icons';
import { parseTemplate } from '../utils/template-parser';
import type { Prompt } from '../types';

const { Text } = Typography;

interface PromptPreviewProps {
  prompt: Prompt | null;
  visible: boolean;
  onClose: () => void;
}

// Highlight variables in content matching the panel's rendering style
function renderContentWithHighlights(content: string): React.ReactNode {
  const { variables } = parseTemplate(content);
  
  if (variables.length === 0) {
    return content;
  }
  
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  
  variables.forEach((variable, index) => {
    // Add text before this variable
    if (variable.startIndex > lastIndex) {
      parts.push(
        <span key={`text-${index}`}>{content.slice(lastIndex, variable.startIndex)}</span>
      );
    }
    
    // Add highlighted variable
    const title = variable.description 
      ? `${variable.name} - ${variable.description}` 
      : variable.name;
    
    parts.push(
      <span
        key={`var-${index}`}
        className="var-highlight"
        title={title}
        style={{
          backgroundColor: '#ede9fe',
          color: '#7c3aed',
          borderRadius: 3,
          padding: '1px 4px',
          borderBottom: '2px solid #a78bfa',
        }}
      >
        {variable.defaultValue !== undefined 
          ? `[${variable.name}="${variable.defaultValue}"]` 
          : `[${variable.name}]`}
      </span>
    );
    
    lastIndex = variable.endIndex;
  });
  
  // Add remaining text
  if (lastIndex < content.length) {
    parts.push(
      <span key="text-end">{content.slice(lastIndex)}</span>
    );
  }
  
  return parts;
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
      styles={{ body: { maxHeight: '60vh', overflow: 'auto' } }}
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
        {renderContentWithHighlights(prompt.content)}
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
