import { describe, it, expect } from 'vitest';
import { loadDefaultPrompts, DEFAULT_PROMPTS } from './index';

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

  it('should parse title from markdown frontmatter', () => {
    const prompts = loadDefaultPrompts();
    const codeReview = prompts.find(p => p.id === '1');
    expect(codeReview).toBeDefined();
    expect(codeReview!.title).toBe('Code Review');
  });

  it('should parse tags as arrays from frontmatter', () => {
    const prompts = loadDefaultPrompts();
    const codeReview = prompts.find(p => p.id === '1');
    expect(codeReview).toBeDefined();
    expect(Array.isArray(codeReview!.tags)).toBe(true);
    expect(codeReview!.tags.length).toBeGreaterThan(0);
  });

  it('should parse description from frontmatter', () => {
    const prompts = loadDefaultPrompts();
    const codeReview = prompts.find(p => p.id === '1');
    expect(codeReview).toBeDefined();
    expect(codeReview!.description).toBeTruthy();
  });

  it('should have non-empty content (the body after frontmatter)', () => {
    const prompts = loadDefaultPrompts();
    for (const prompt of prompts) {
      expect(prompt.content.length).toBeGreaterThan(0);
    }
  });

  it('should not include frontmatter delimiters in content', () => {
    const prompts = loadDefaultPrompts();
    for (const prompt of prompts) {
      expect(prompt.content.startsWith('---')).toBe(false);
    }
  });

  it('should load all 8 default prompts', () => {
    const prompts = loadDefaultPrompts();
    expect(prompts.length).toBe(8);
  });
});

describe('DEFAULT_PROMPTS', () => {
  it('should be the same as loadDefaultPrompts result', () => {
    expect(DEFAULT_PROMPTS.length).toBe(loadDefaultPrompts().length);
  });

  it('should contain known prompt titles', () => {
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
