import { Prompt } from '../types';
import { parseFrontmatter } from '../utils/frontmatter';

// Import all markdown files
import codeReview from './1-code-review.md';
import explainCode from './2-explain-code.md';
import bugFix from './3-bug-fix.md';
import writeTests from './4-write-tests.md';
import refactorCode from './5-refactor-code.md';
import analyzeError from './6-analyze-error.md';
import promptOptimizer from './7-prompt-optimizer.md';
import customPrompt from './8-custom-prompt.md';

const markdownFiles = [
  { id: '1', content: codeReview },
  { id: '2', content: explainCode },
  { id: '3', content: bugFix },
  { id: '4', content: writeTests },
  { id: '5', content: refactorCode },
  { id: '6', content: analyzeError },
  { id: '7', content: promptOptimizer },
  { id: '8', content: customPrompt },
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
      title: (metadata.title as string) || 'Untitled',
      content: body, // Keep raw markdown content unchanged
      description: (metadata.description as string) || '',
      tags: Array.isArray(metadata.tags) ? metadata.tags : [],
      createdAt: now,
      updatedAt: now,
    };
  });
}

// Export the prompts for use in type definitions
export const DEFAULT_PROMPTS = loadDefaultPrompts();
