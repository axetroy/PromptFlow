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
