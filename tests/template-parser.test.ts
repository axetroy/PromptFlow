/**
 * Template Parser Tests
 * 
 * Tests for the template-parser utility functions including:
 * - parseTemplate
 * - getUniqueVariables
 * - hasVariables
 * - allVariablesHaveDefaults
 * - interpolate
 * - generatePreview
 * - generatePreviewSegments
 * - isValidVariableName
 * - getVariableStats
 * 
 * Variable Syntax: <VAR name="name" description="desc" defaultValue="val"></VAR>
 * 
 * Uses Node.js built-in test runner (node:test)
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';
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
} from '../src/utils/template-parser';

describe('Template Parser - VAR Tag Syntax', () => {
  describe('parseTemplate', () => {
    it('should return empty array for template without variables', () => {
      const result = parseTemplate('Hello World!');
      assert.strictEqual(result.variables.length, 0);
    });

    it('should parse single variable', () => {
      const result = parseTemplate('Hello <VAR name="name"></VAR>!');
      assert.strictEqual(result.variables.length, 1);
      assert.strictEqual(result.variables[0].name, 'name');
      assert.strictEqual(result.variables[0].defaultValue, undefined);
      assert.strictEqual(result.variables[0].description, undefined);
    });

    it('should parse variable with default value', () => {
      const result = parseTemplate('Hello <VAR name="name" defaultValue="World"></VAR>!');
      assert.strictEqual(result.variables.length, 1);
      assert.strictEqual(result.variables[0].name, 'name');
      assert.strictEqual(result.variables[0].defaultValue, 'World');
    });

    it('should parse variable with description', () => {
      const result = parseTemplate('Hello <VAR name="name" description="Your name"></VAR>!');
      assert.strictEqual(result.variables.length, 1);
      assert.strictEqual(result.variables[0].name, 'name');
      assert.strictEqual(result.variables[0].description, 'Your name');
    });

    it('should parse variable with description and defaultValue', () => {
      const result = parseTemplate('<VAR name="topic" description="Main topic" defaultValue="General"></VAR>');
      assert.strictEqual(result.variables.length, 1);
      assert.strictEqual(result.variables[0].name, 'topic');
      assert.strictEqual(result.variables[0].description, 'Main topic');
      assert.strictEqual(result.variables[0].defaultValue, 'General');
    });

    it('should parse variable with attributes in different order', () => {
      // defaultValue first, then description
      const result1 = parseTemplate('<VAR name="a" defaultValue="x" description="y"></VAR>');
      assert.strictEqual(result1.variables[0].defaultValue, 'x');
      assert.strictEqual(result1.variables[0].description, 'y');
      
      // description first, then defaultValue
      const result2 = parseTemplate('<VAR name="b" description="y" defaultValue="x"></VAR>');
      assert.strictEqual(result2.variables[0].defaultValue, 'x');
      assert.strictEqual(result2.variables[0].description, 'y');
    });

    it('should parse multiple variables', () => {
      const result = parseTemplate('<VAR name="greeting"></VAR> <VAR name="name"></VAR>!');
      assert.strictEqual(result.variables.length, 2);
      assert.strictEqual(result.variables[0].name, 'greeting');
      assert.strictEqual(result.variables[1].name, 'name');
    });

    it('should handle self-closing syntax with all attributes', () => {
      const result = parseTemplate('<VAR name="code" description="Source code" defaultValue="none"/>');
      assert.strictEqual(result.variables.length, 1);
      assert.strictEqual(result.variables[0].name, 'code');
      assert.strictEqual(result.variables[0].description, 'Source code');
      assert.strictEqual(result.variables[0].defaultValue, 'none');
    });

    it('should handle multiline templates', () => {
      const template = `Hello <VAR name="name" description="User name"></VAR>,
How are you today?`;
      const result = parseTemplate(template);
      assert.strictEqual(result.variables.length, 1);
      assert.strictEqual(result.variables[0].name, 'name');
      assert.strictEqual(result.variables[0].description, 'User name');
    });
  });

  describe('interpolate', () => {
    it('should replace single variable', () => {
      const result = interpolate('Hello <VAR name="name"></VAR>!', { name: 'World' });
      assert.strictEqual(result, 'Hello World!');
    });

    it('should use default value when no value provided', () => {
      const result = interpolate('Hello <VAR name="name" defaultValue="World"></VAR>!', {});
      assert.strictEqual(result, 'Hello World!');
    });

    it('should prefer provided value over default', () => {
      const result = interpolate('Hello <VAR name="name" defaultValue="World"></VAR>!', { name: 'Alice' });
      assert.strictEqual(result, 'Hello Alice!');
    });

    it('should ignore description in interpolation', () => {
      const result = interpolate('<VAR name="x" description="desc" defaultValue="default"></VAR>', {});
      assert.strictEqual(result, 'default');
    });

    it('should handle self-closing syntax', () => {
      const result = interpolate('Hello <VAR name="name"/>!', { name: 'World' });
      assert.strictEqual(result, 'Hello World!');
    });
  });

  describe('Real-world usage - No conflicts', () => {
    it('should NOT match curly braces in markdown', () => {
      const template = '# {heading}\n\n**Bold** and <VAR name="var"></VAR>';
      const variables = getUniqueVariables(template);
      assert.strictEqual(variables.length, 1);
      assert.strictEqual(variables[0].name, 'var');
    });

    it('should interpolate correctly with description', () => {
      const template = '<VAR name="code" description="Source code to review"></VAR>';
      const result = interpolate(template, { code: 'function test() {}' });
      assert.strictEqual(result, 'function test() {}');
    });
  });

  describe('Translation prompt with description', () => {
    it('should parse translation prompt with all attributes', () => {
      const template = `Translate the following text to <VAR name="target_language" description="Target language for translation" defaultValue="English"></VAR>:

<VAR name="text" description="Text to translate"></VAR>`;

      const variables = getUniqueVariables(template);
      assert.strictEqual(variables.length, 2);
      
      const langVar = variables.find(v => v.name === 'target_language');
      assert.strictEqual(langVar?.description, 'Target language for translation');
      assert.strictEqual(langVar?.defaultValue, 'English');
      
      const textVar = variables.find(v => v.name === 'text');
      assert.strictEqual(textVar?.description, 'Text to translate');
    });
  });
});

describe('generatePreviewSegments', () => {
  it('should return single text segment for template without variables', () => {
    const segments = generatePreviewSegments('Hello World!', {});
    assert.strictEqual(segments.length, 1);
    assert.strictEqual(segments[0].type, 'text');
    assert.strictEqual(segments[0].content, 'Hello World!');
  });

  it('should return text and variable segments', () => {
    const template = 'Hello <VAR name="name"></VAR>!';
    const segments = generatePreviewSegments(template, { name: 'World' });
    
    assert.strictEqual(segments.length, 3);
    
    // First text segment
    assert.strictEqual(segments[0].type, 'text');
    assert.strictEqual(segments[0].content, 'Hello ');
    
    // Variable segment with resolved value
    assert.strictEqual(segments[1].type, 'variable');
    assert.strictEqual(segments[1].content, 'World');
    assert.ok(segments[1].variable);
    
    // Last text segment
    assert.strictEqual(segments[2].type, 'text');
    assert.strictEqual(segments[2].content, '!');
  });

  it('should use default value when no value provided', () => {
    const template = 'Hello <VAR name="name" defaultValue="Default"></VAR>!';
    const segments = generatePreviewSegments(template, {});
    
    assert.strictEqual(segments[1].type, 'variable');
    assert.strictEqual(segments[1].content, 'Default');
  });

  it('should prefer provided value over default', () => {
    const template = 'Hello <VAR name="name" defaultValue="Default"></VAR>!';
    const segments = generatePreviewSegments(template, { name: 'World' });
    
    assert.strictEqual(segments[1].type, 'variable');
    assert.strictEqual(segments[1].content, 'World');
  });

  it('should keep original tag when variable is unresolved', () => {
    const template = 'Hello <VAR name="name"></VAR>!';
    const segments = generatePreviewSegments(template, {});
    
    assert.strictEqual(segments[1].type, 'variable');
    assert.strictEqual(segments[1].content, '<VAR name="name"></VAR>');
    assert.strictEqual(segments[1].variable, undefined);
  });

  it('should include variable metadata in segment', () => {
    const template = '<VAR name="code" description="Source code" defaultValue="none"/>';
    const segments = generatePreviewSegments(template, {});
    
    assert.strictEqual(segments.length, 1);
    assert.strictEqual(segments[0].type, 'variable');
    assert.strictEqual(segments[0].content, 'none');
    assert.ok(segments[0].variable);
    assert.strictEqual(segments[0].variable?.name, 'code');
    assert.strictEqual(segments[0].variable?.description, 'Source code');
    assert.strictEqual(segments[0].variable?.defaultValue, 'none');
  });

  it('should handle multiple variables', () => {
    const template = '<VAR name="greeting"></VAR>, <VAR name="name"></VAR>!';
    const segments = generatePreviewSegments(template, { greeting: 'Hello', name: 'World' });
    
    // Should have 4 segments (no empty text at start since template starts with variable)
    assert.strictEqual(segments.length, 4);
    
    assert.strictEqual(segments[0].type, 'variable');
    assert.strictEqual(segments[0].content, 'Hello');
    
    assert.strictEqual(segments[1].type, 'text');
    assert.strictEqual(segments[1].content, ', ');
    
    assert.strictEqual(segments[2].type, 'variable');
    assert.strictEqual(segments[2].content, 'World');
    
    assert.strictEqual(segments[3].type, 'text');
    assert.strictEqual(segments[3].content, '!');
  });

  it('should preserve whitespace in text segments', () => {
    const template = 'Line 1\n<VAR name="var"></VAR>\nLine 3';
    const segments = generatePreviewSegments(template, { var: 'Middle' });
    
    assert.strictEqual(segments[0].content, 'Line 1\n');
    assert.strictEqual(segments[1].content, 'Middle');
    assert.strictEqual(segments[2].content, '\nLine 3');
  });
});
