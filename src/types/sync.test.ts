import { describe, it, expect } from 'vitest';
import { parseFrontmatter } from './sync';

describe('parseFrontmatter', () => {
  it('should parse basic key-value frontmatter', () => {
    const content = '---\ntitle: Hello World\ndescription: A test\n---\nBody content';
    const result = parseFrontmatter(content);
    expect(result.metadata.title).toBe('Hello World');
    expect(result.metadata.description).toBe('A test');
    expect(result.body).toBe('Body content');
  });

  it('should return empty metadata when no frontmatter', () => {
    const content = 'Just body content\nNo frontmatter here';
    const result = parseFrontmatter(content);
    expect(result.metadata).toEqual({});
    expect(result.body).toBe('Just body content\nNo frontmatter here');
  });

  it('should parse array values in frontmatter', () => {
    const content = '---\ntitle: Test\ntags:\n- dev\n- review\n- code\n---\nBody';
    const result = parseFrontmatter(content);
    expect(result.metadata.title).toBe('Test');
    expect(result.metadata.tags).toEqual(['dev', 'review', 'code']);
    expect(result.body).toBe('Body');
  });

  it('should handle array at end of frontmatter', () => {
    const content = '---\ntitle: Test\ntags:\n- alpha\n- beta\n---\nBody content';
    const result = parseFrontmatter(content);
    expect(result.metadata.tags).toEqual(['alpha', 'beta']);
  });

  it('should handle empty body', () => {
    const content = '---\ntitle: Test\n---\n';
    const result = parseFrontmatter(content);
    expect(result.metadata.title).toBe('Test');
    expect(result.body).toBe('');
  });

  it('should handle multiline body', () => {
    const content = '---\ntitle: Test\n---\nLine 1\nLine 2\nLine 3';
    const result = parseFrontmatter(content);
    expect(result.body).toBe('Line 1\nLine 2\nLine 3');
  });

  it('should trim the body content', () => {
    const content = '---\ntitle: Test\n---\n\n  Body with whitespace  \n';
    const result = parseFrontmatter(content);
    expect(result.body).toBe('Body with whitespace');
  });

  it('should handle key without value (array header)', () => {
    const content = '---\ncategories:\n- cat1\n- cat2\n---\nBody';
    const result = parseFrontmatter(content);
    expect(result.metadata.categories).toEqual(['cat1', 'cat2']);
  });

  it('should handle multiple key-value pairs', () => {
    const content = '---\ntitle: My Title\nauthor: John\nversion: 1.0\n---\nContent';
    const result = parseFrontmatter(content);
    expect(result.metadata.title).toBe('My Title');
    expect(result.metadata.author).toBe('John');
    expect(result.metadata.version).toBe('1.0');
  });

  it('should handle values with colons', () => {
    const content = '---\ntitle: Hello: World\n---\nBody';
    const result = parseFrontmatter(content);
    expect(result.metadata.title).toBe('Hello: World');
  });

  it('should handle empty string', () => {
    const result = parseFrontmatter('');
    expect(result.metadata).toEqual({});
    expect(result.body).toBe('');
  });

  it('should handle frontmatter with only arrays', () => {
    const content = '---\nitems:\n- one\n- two\nothers:\n- three\n---\nContent here';
    const result = parseFrontmatter(content);
    expect(result.metadata.items).toEqual(['one', 'two']);
    expect(result.metadata.others).toEqual(['three']);
  });
});
