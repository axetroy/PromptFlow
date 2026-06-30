/**
 * Template Parser Tests
 * 
 * Unit tests for the template-parser utility functions.
 * These tests cover the <VAR> template variable parsing functionality.
 */

import { describe, it, expect } from 'vitest';
import {
  parseTemplate,
  getUniqueVariables,
  hasVariables,
  allVariablesHaveDefaults,
  interpolate,
  generatePreview,
  generatePreviewSegments,
  isValidVariableName,
  getVariableStats,
} from './template-parser';

describe('parseTemplate', () => {
  it('should parse a single variable', () => {
    const result = parseTemplate('<VAR name="test"></VAR>');
    expect(result.variables).toHaveLength(1);
    expect(result.variables[0].name).toBe('test');
  });

  it('should parse a self-closing variable', () => {
    const result = parseTemplate('<VAR name="test" />');
    expect(result.variables).toHaveLength(1);
    expect(result.variables[0].name).toBe('test');
  });

  it('should parse variable with default value', () => {
    const result = parseTemplate('<VAR name="greeting" defaultValue="Hello"></VAR>');
    expect(result.variables).toHaveLength(1);
    expect(result.variables[0].name).toBe('greeting');
    expect(result.variables[0].defaultValue).toBe('Hello');
  });

  it('should parse variable with description', () => {
    const result = parseTemplate('<VAR name="topic" description="The main topic"></VAR>');
    expect(result.variables).toHaveLength(1);
    expect(result.variables[0].name).toBe('topic');
    expect(result.variables[0].description).toBe('The main topic');
  });

  it('should parse multiple variables', () => {
    const result = parseTemplate('<VAR name="first"></VAR><VAR name="second"></VAR>');
    expect(result.variables).toHaveLength(2);
    expect(result.variables[0].name).toBe('first');
    expect(result.variables[1].name).toBe('second');
  });

  it('should return empty array for template without variables', () => {
    const result = parseTemplate('Hello, world!');
    expect(result.variables).toHaveLength(0);
  });

  it('should handle variables with spaces in default values', () => {
    const result = parseTemplate('<VAR name="greeting" defaultValue="Hello World"></VAR>');
    expect(result.variables[0].defaultValue).toBe('Hello World');
  });

  it('should handle escaped quotes in values', () => {
    const result = parseTemplate('<VAR name="test" defaultValue="He said \\"hello\\""></VAR>');
    expect(result.variables[0].defaultValue).toBe('He said "hello"');
  });

  it('should ignore non-VAR tags', () => {
    const result = parseTemplate('<div><VAR name="test"></VAR></div>');
    expect(result.variables).toHaveLength(1);
    expect(result.variables[0].name).toBe('test');
  });

  it('should not match partial tags', () => {
    const result = parseTemplate('<VARIABLE name="test"></VARIABLE>');
    expect(result.variables).toHaveLength(0);
  });

  it('should return correct start and end indices', () => {
    const template = 'Hello <VAR name="test"></VAR> World';
    const result = parseTemplate(template);
    expect(result.variables[0].startIndex).toBe(6);
    expect(result.variables[0].endIndex).toBe(29); // </VAR> is 6 characters
  });
});

describe('getUniqueVariables', () => {
  it('should return unique variables', () => {
    const result = getUniqueVariables('<VAR name="test"></VAR><VAR name="test"></VAR>');
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('test');
  });

  it('should preserve first occurrence properties', () => {
    const result = getUniqueVariables(
      '<VAR name="test" description="First"></VAR><VAR name="test" description="Second"></VAR>'
    );
    expect(result).toHaveLength(1);
    expect(result[0].description).toBe('First');
  });

  it('should handle empty template', () => {
    const result = getUniqueVariables('');
    expect(result).toHaveLength(0);
  });
});

describe('hasVariables', () => {
  it('should return true for template with variables', () => {
    expect(hasVariables('<VAR name="test"></VAR>')).toBe(true);
  });

  it('should return false for template without variables', () => {
    expect(hasVariables('Hello, world!')).toBe(false);
  });
});

describe('allVariablesHaveDefaults', () => {
  it('should return true when all variables have defaults', () => {
    expect(allVariablesHaveDefaults('<VAR name="a" defaultValue="1"></VAR><VAR name="b" defaultValue="2"></VAR>')).toBe(true);
  });

  it('should return false when some variables lack defaults', () => {
    expect(allVariablesHaveDefaults('<VAR name="a" defaultValue="1"></VAR><VAR name="b"></VAR>')).toBe(false);
  });

  it('should return false for template without variables', () => {
    expect(allVariablesHaveDefaults('No variables here')).toBe(false);
  });
});

describe('interpolate', () => {
  it('should replace single variable', () => {
    const result = interpolate('<VAR name="name"></VAR>', { name: 'John' });
    expect(result).toBe('John');
  });

  it('should replace multiple variables', () => {
    const result = interpolate(
      '<VAR name="greeting"></VAR>, <VAR name="name"></VAR>!',
      { greeting: 'Hello', name: 'John' }
    );
    expect(result).toBe('Hello, John!');
  });

  it('should use default value when no value provided', () => {
    const result = interpolate('<VAR name="greeting" defaultValue="Hello"></VAR>', {});
    expect(result).toBe('Hello');
  });

  it('should use provided value over default', () => {
    const result = interpolate(
      '<VAR name="greeting" defaultValue="Hello"></VAR>',
      { greeting: 'Hi' }
    );
    expect(result).toBe('Hi');
  });

  it('should keep original tag when no value and no default', () => {
    const result = interpolate('<VAR name="test"></VAR>', {});
    expect(result).toBe('<VAR name="test"></VAR>');
  });

  it('should preserve text before and after variables', () => {
    const result = interpolate(
      'Prefix <VAR name="var"></VAR> Suffix',
      { var: 'middle' }
    );
    expect(result).toBe('Prefix middle Suffix');
  });

  it('should handle empty template', () => {
    const result = interpolate('', { name: 'John' });
    expect(result).toBe('');
  });

  it('should handle template without variables', () => {
    const result = interpolate('Hello, world!', { name: 'John' });
    expect(result).toBe('Hello, world!');
  });
});

describe('generatePreview', () => {
  it('should generate preview with placeholders for missing values', () => {
    const result = generatePreview('<VAR name="name"></VAR>');
    expect(result).toBe('[name]');
  });

  it('should use default value when no user value provided', () => {
    const result = generatePreview('<VAR name="greeting" defaultValue="Hello"></VAR>');
    expect(result).toBe('Hello');
  });

  it('should use provided value over default', () => {
    const result = generatePreview(
      '<VAR name="greeting" defaultValue="Hello"></VAR>',
      { greeting: 'Hi' }
    );
    expect(result).toBe('Hi');
  });
});

describe('generatePreviewSegments', () => {
  it('should generate text and variable segments', () => {
    const result = generatePreviewSegments(
      'Hello <VAR name="name"></VAR>!',
      { name: 'World' }
    );
    
    expect(result).toHaveLength(3);
    expect(result[0]).toEqual({ type: 'text', content: 'Hello ' });
    expect(result[1]).toEqual({ 
      type: 'variable', 
      content: 'World',
      variable: expect.objectContaining({ name: 'name' })
    });
    expect(result[2]).toEqual({ type: 'text', content: '!' });
  });

  it('should handle template without variables', () => {
    const result = generatePreviewSegments('Hello, world!', {});
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({ type: 'text', content: 'Hello, world!' });
  });

  it('should handle multiple variables in a row', () => {
    const result = generatePreviewSegments(
      '<VAR name="a"></VAR><VAR name="b"></VAR>',
      { a: 'A', b: 'B' }
    );
    
    expect(result).toHaveLength(2);
    expect(result[0].type).toBe('variable');
    expect(result[0].content).toBe('A');
    expect(result[1].type).toBe('variable');
    expect(result[1].content).toBe('B');
  });
});

describe('isValidVariableName', () => {
  it('should accept valid variable names', () => {
    expect(isValidVariableName('name')).toBe(true);
    expect(isValidVariableName('_private')).toBe(true);
    expect(isValidVariableName('camelCase')).toBe(true);
    expect(isValidVariableName('snake_case')).toBe(true);
    expect(isValidVariableName('kebab-case')).toBe(true);
    expect(isValidVariableName('with123numbers')).toBe(true);
    expect(isValidVariableName('START_UPPER')).toBe(true);
  });

  it('should reject invalid variable names', () => {
    expect(isValidVariableName('123start')).toBe(false);
    expect(isValidVariableName('has space')).toBe(false);
    expect(isValidVariableName('has.dot')).toBe(false);
    expect(isValidVariableName('')).toBe(false);
  });
});

describe('getVariableStats', () => {
  it('should return correct statistics', () => {
    const stats = getVariableStats(
      '<VAR name="a"></VAR><VAR name="b" defaultValue="x"></VAR><VAR name="a"></VAR>'
    );
    
    expect(stats.total).toBe(3);
    expect(stats.unique).toBe(2);
    expect(stats.withDefaults).toBe(1);
    expect(stats.required).toBe(1);
  });

  it('should handle empty template', () => {
    const stats = getVariableStats('');
    
    expect(stats.total).toBe(0);
    expect(stats.unique).toBe(0);
    expect(stats.withDefaults).toBe(0);
    expect(stats.required).toBe(0);
  });
});
