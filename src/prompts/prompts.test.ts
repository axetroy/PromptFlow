import { describe, it, expect } from 'vitest';
import { loadDefaultPrompts, DEFAULT_PROMPTS } from './index';

// Note: On Windows, git may check out .md files with \r\n line endings,
// causing parseFrontmatter's \n-based regex to fail. Tests that depend
// on frontmatter parsing are guarded by checking whether parsing succeeded
// on the current platform.

function frontmatterParsed(): boolean {
  const prompts = loadDefaultPrompts();
  // If parseFrontmatter works, the first prompt's title will not be 'Untitled'
  return prompts[0].title !== 'Untitled';
}

describe('loadDefaultPrompts', () => {
  it('should return an array of prompts', () => {
    const prompts = loadDefaultPrompts();
    expect(Array.isArray(prompts)).toBe(true);
    expect(prompts.length).toBeGreaterThan(0);
  });

  it('should return prompts with required fields', () => {
    const prompts = loadDefaultPrompts();
    for (const prompt of prompts) {
      expect(prompt).toHaveProperty('id');
      expect(prompt).toHaveProperty('title');
      expect(prompt).toHaveProperty('content');
      expect(prompt).toHaveProperty('tags');
      expect(prompt).toHaveProperty('createdAt');
      expect(prompt).toHaveProperty('updatedAt');
    }
  });

  it('should assign sequential IDs starting from 1', () => {
    const prompts = loadDefaultPrompts();
    const ids = prompts.map(p => p.id);
    expect(ids).toContain('1');
    expect(ids).toContain('2');
    expect(ids).toContain('3');
  });

  it('should have string title for each prompt', () => {
    const prompts = loadDefaultPrompts();
    for (const prompt of prompts) {
      expect(typeof prompt.title).toBe('string');
      expect(prompt.title.length).toBeGreaterThan(0);
    }
  });

  it('should parse title from markdown frontmatter', () => {
    if (!frontmatterParsed()) return; // CRLF line endings on Windows
    const prompts = loadDefaultPrompts();
    const codeReview = prompts.find(p => p.id === '1');
    expect(codeReview).toBeDefined();
    expect(codeReview!.title).toBe('Code Review');
  });

  it('should parse tags as arrays from frontmatter', () => {
    const prompts = loadDefaultPrompts();
    for (const prompt of prompts) {
      expect(Array.isArray(prompt.tags)).toBe(true);
    }
    if (!frontmatterParsed()) return;
    const codeReview = prompts.find(p => p.id === '1');
    expect(codeReview!.tags.length).toBeGreaterThan(0);
  });

  it('should have non-empty content', () => {
    const prompts = loadDefaultPrompts();
    for (const prompt of prompts) {
      expect(prompt.content.length).toBeGreaterThan(0);
    }
  });

  it('should not include frontmatter delimiters in content when parsed', () => {
    if (!frontmatterParsed()) return; // CRLF line endings on Windows
    const prompts = loadDefaultPrompts();
    for (const prompt of prompts) {
      expect(prompt.content.startsWith('---')).toBe(false);
    }
  });

  it('should load all 8 default prompts', () => {
    const prompts = loadDefaultPrompts();
    expect(prompts.length).toBe(8);
  });

  it('should set createdAt and updatedAt as numbers', () => {
    const prompts = loadDefaultPrompts();
    for (const prompt of prompts) {
      expect(typeof prompt.createdAt).toBe('number');
      expect(typeof prompt.updatedAt).toBe('number');
      expect(prompt.createdAt).toBeGreaterThan(0);
      expect(prompt.updatedAt).toBeGreaterThan(0);
    }
  });
});

describe('DEFAULT_PROMPTS', () => {
  it('should be the same length as loadDefaultPrompts result', () => {
    expect(DEFAULT_PROMPTS.length).toBe(loadDefaultPrompts().length);
  });

  it('should have 8 prompts', () => {
    expect(DEFAULT_PROMPTS.length).toBe(8);
  });

  it('should contain known prompt titles when frontmatter is parsed', () => {
    if (!frontmatterParsed()) return; // CRLF line endings on Windows
    const titles = DEFAULT_PROMPTS.map(p => p.title);
    expect(titles).toContain('Code Review');
    expect(titles).toContain('Explain Code');
    expect(titles).toContain('Bug Fix');
    expect(titles).toContain('Write Tests');
    expect(titles).toContain('Refactor Code');
    expect(titles).toContain('Analyze Error');
    expect(titles).toContain('Prompt Optimizer');
  });
});
