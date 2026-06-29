import { Prompt } from '../types';

/**
 * Parse YAML frontmatter from markdown content
 */
function parseFrontmatter(content: string): { metadata: Record<string, any>; body: string } {
  const frontmatterRegex = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/;
  const match = content.match(frontmatterRegex);
  
  if (!match) {
    return { metadata: {}, body: content };
  }
  
  const yamlContent = match[1];
  const body = match[2];
  const metadata: Record<string, any> = {};
  
  // Simple YAML parser for our use case
  const lines = yamlContent.split('\n');
  let currentKey: string | null = null;
  let inArray = false;
  let arrayValues: string[] = [];
  
  for (const line of lines) {
    const trimmedLine = line.trim();
    
    // Check for array items (starts with -)
    if (trimmedLine.startsWith('- ')) {
      if (!inArray) {
        inArray = true;
        arrayValues = [];
      }
      arrayValues.push(trimmedLine.substring(2).trim());
      continue;
    }
    
    // End of array
    if (inArray && currentKey) {
      metadata[currentKey] = arrayValues;
      inArray = false;
      arrayValues = [];
    }
    
    // Key-value pair
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
  
  // Handle array at end
  if (inArray && currentKey) {
    metadata[currentKey] = arrayValues;
  }
  
  return { metadata, body: body.trim() };
}

// Import all markdown files
import codeReview from './1-code-review.md';
import explainCode from './2-explain-code.md';
import bugFix from './3-bug-fix.md';
import writeTests from './4-write-tests.md';
import refactorCode from './5-refactor-code.md';
import analyzeError from './6-analyze-error.md';
import promptOptimizer from './7-prompt-optimizer.md';

const markdownFiles = [
  { id: '1', content: codeReview },
  { id: '2', content: explainCode },
  { id: '3', content: bugFix },
  { id: '4', content: writeTests },
  { id: '5', content: refactorCode },
  { id: '6', content: analyzeError },
  { id: '7', content: promptOptimizer },
];

/**
 * Load all default prompts from markdown files
 * Content is kept as-is (raw markdown)
 */
export function loadDefaultPrompts(): Prompt[] {
  const now = Date.now();
  
  return markdownFiles.map(({ id, content }) => {
    const { metadata, body } = parseFrontmatter(content);
    
    return {
      id,
      title: metadata.title || 'Untitled',
      content: body, // Keep raw markdown content unchanged
      description: metadata.description || '',
      tags: Array.isArray(metadata.tags) ? metadata.tags : [],
      createdAt: now,
      updatedAt: now,
    };
  });
}

// Export the prompts for use in type definitions
export const DEFAULT_PROMPTS = loadDefaultPrompts();
