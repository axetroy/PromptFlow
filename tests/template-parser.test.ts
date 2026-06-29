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
 * Variable Syntax: <VAR name="variable_name" defaultValue="default_value"></VAR>
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
      assert.strictEqual(result.template, 'Hello World!');
    });

    it('should parse single variable', () => {
      const result = parseTemplate('Hello <VAR name="name"></VAR>!');
      assert.strictEqual(result.variables.length, 1);
      assert.strictEqual(result.variables[0].name, 'name');
      assert.strictEqual(result.variables[0].defaultValue, undefined);
      assert.strictEqual(result.variables[0].fullMatch, '<VAR name="name"></VAR>');
    });

    it('should parse variable with default value', () => {
      const result = parseTemplate('Hello <VAR name="name" defaultValue="World"></VAR>!');
      assert.strictEqual(result.variables.length, 1);
      assert.strictEqual(result.variables[0].name, 'name');
      assert.strictEqual(result.variables[0].defaultValue, 'World');
    });

    it('should parse multiple variables', () => {
      const result = parseTemplate('<VAR name="greeting"></VAR> <VAR name="name"></VAR>!');
      assert.strictEqual(result.variables.length, 2);
      assert.strictEqual(result.variables[0].name, 'greeting');
      assert.strictEqual(result.variables[1].name, 'name');
    });

    it('should parse duplicate variables', () => {
      const result = parseTemplate('<VAR name="name"></VAR> is the same as <VAR name="name"></VAR>');
      assert.strictEqual(result.variables.length, 2);
      assert.strictEqual(result.variables[0].name, 'name');
      assert.strictEqual(result.variables[1].name, 'name');
    });

    it('should handle variables at start of template', () => {
      const result = parseTemplate('<VAR name="greeting"></VAR> there!');
      assert.strictEqual(result.variables.length, 1);
      assert.strictEqual(result.variables[0].startIndex, 0);
    });

    it('should handle adjacent variables', () => {
      const result = parseTemplate('<VAR name="a"></VAR><VAR name="b"></VAR>');
      assert.strictEqual(result.variables.length, 2);
    });

    it('should handle default values with special characters', () => {
      const result = parseTemplate('<VAR name="style" defaultValue="formal, professional"></VAR>');
      assert.strictEqual(result.variables[0].defaultValue, 'formal, professional');
    });

    it('should handle self-closing syntax', () => {
      const result = parseTemplate('Hello <VAR name="name"/>!');
      assert.strictEqual(result.variables.length, 1);
      assert.strictEqual(result.variables[0].name, 'name');
    });

    it('should handle variable with underscore', () => {
      const result = parseTemplate('<VAR name="my_variable"></VAR>');
      assert.strictEqual(result.variables.length, 1);
      assert.strictEqual(result.variables[0].name, 'my_variable');
    });

    it('should handle variable with hyphen', () => {
      const result = parseTemplate('<VAR name="my-var"></VAR>');
      assert.strictEqual(result.variables.length, 1);
      assert.strictEqual(result.variables[0].name, 'my-var');
    });

    it('should handle multiline templates', () => {
      const template = `Hello <VAR name="name"></VAR>,
How are you today?`;
      const result = parseTemplate(template);
      assert.strictEqual(result.variables.length, 1);
      assert.strictEqual(result.variables[0].name, 'name');
    });

    it('should not match unrelated HTML tags', () => {
      const template = '<div>Hello</div> <span>World</span>';
      const result = parseTemplate(template);
      assert.strictEqual(result.variables.length, 0);
    });

    it('should handle content between VAR tags', () => {
      const template = '<VAR name="var">This is content</VAR>';
      const result = parseTemplate(template);
      assert.strictEqual(result.variables.length, 1);
      assert.strictEqual(result.variables[0].name, 'var');
    });
  });

  describe('getUniqueVariables', () => {
    it('should return empty array for template without variables', () => {
      const result = getUniqueVariables('Hello World!');
      assert.strictEqual(result.length, 0);
    });

    it('should return single variable for single occurrence', () => {
      const result = getUniqueVariables('<VAR name="name"></VAR>');
      assert.strictEqual(result.length, 1);
      assert.strictEqual(result[0].name, 'name');
    });

    it('should return unique variables only', () => {
      const result = getUniqueVariables('<VAR name="a"></VAR> <VAR name="b"></VAR> <VAR name="a"></VAR>');
      assert.strictEqual(result.length, 2);
      const names = result.map(v => v.name).sort();
      assert.deepStrictEqual(names, ['a', 'b']);
    });

    it('should return first occurrence for duplicate variables', () => {
      const result = getUniqueVariables('<VAR name="name" defaultValue="first"></VAR> <VAR name="name" defaultValue="second"></VAR>');
      assert.strictEqual(result.length, 1);
      assert.strictEqual(result[0].defaultValue, 'first');
    });
  });

  describe('hasVariables', () => {
    it('should return false for template without variables', () => {
      assert.strictEqual(hasVariables('Hello World!'), false);
    });

    it('should return true for template with one variable', () => {
      assert.strictEqual(hasVariables('Hello <VAR name="name"></VAR>!'), true);
    });

    it('should return true for template with multiple variables', () => {
      assert.strictEqual(hasVariables('<VAR name="a"></VAR> <VAR name="b"></VAR>'), true);
    });

    it('should return false for empty template', () => {
      assert.strictEqual(hasVariables(''), false);
    });

    it('should return true for template with default value variable', () => {
      assert.strictEqual(hasVariables('<VAR name="name" defaultValue="default"></VAR>'), true);
    });
  });

  describe('allVariablesHaveDefaults', () => {
    it('should return false for template without variables', () => {
      assert.strictEqual(allVariablesHaveDefaults('Hello!'), false);
    });

    it('should return true when all variables have defaults', () => {
      assert.strictEqual(allVariablesHaveDefaults('<VAR name="a" defaultValue="1"></VAR> <VAR name="b" defaultValue="2"></VAR>'), true);
    });

    it('should return false when some variables lack defaults', () => {
      assert.strictEqual(allVariablesHaveDefaults('<VAR name="a" defaultValue="1"></VAR> <VAR name="b"></VAR>'), false);
    });

    it('should return false when all variables lack defaults', () => {
      assert.strictEqual(allVariablesHaveDefaults('<VAR name="a"></VAR> <VAR name="b"></VAR>'), false);
    });
  });

  describe('interpolate', () => {
    it('should replace single variable', () => {
      const result = interpolate('Hello <VAR name="name"></VAR>!', { name: 'World' });
      assert.strictEqual(result, 'Hello World!');
    });

    it('should replace multiple variables', () => {
      const result = interpolate('<VAR name="greeting"></VAR> <VAR name="name"></VAR>!', { greeting: 'Hello', name: 'Alice' });
      assert.strictEqual(result, 'Hello Alice!');
    });

    it('should use default value when no value provided', () => {
      const result = interpolate('Hello <VAR name="name" defaultValue="World"></VAR>!', {});
      assert.strictEqual(result, 'Hello World!');
    });

    it('should prefer provided value over default', () => {
      const result = interpolate('Hello <VAR name="name" defaultValue="World"></VAR>!', { name: 'Alice' });
      assert.strictEqual(result, 'Hello Alice!');
    });

    it('should keep variable when no value and no default', () => {
      const result = interpolate('Hello <VAR name="name"></VAR>!', {});
      assert.strictEqual(result, 'Hello <VAR name="name"></VAR>!');
    });

    it('should handle duplicate variables', () => {
      const template = '<VAR name="name"></VAR> is the same as <VAR name="name"></VAR>';
      assert.strictEqual(interpolate(template, { name: 'Alice' }), 'Alice is the same as Alice');
    });

    it('should handle unicode in values', () => {
      assert.strictEqual(interpolate('<VAR name="greeting"></VAR>', { greeting: '你好世界' }), '你好世界');
    });

    it('should handle special characters in values', () => {
      assert.strictEqual(interpolate('<VAR name="text"></VAR>', { text: '$100 (50% off!)' }), '$100 (50% off!)');
    });

    it('should handle self-closing syntax', () => {
      const result = interpolate('Hello <VAR name="name"/>!', { name: 'World' });
      assert.strictEqual(result, 'Hello World!');
    });
  });

  describe('generatePreview', () => {
    it('should use defaults when no values provided', () => {
      const result = generatePreview('Hello <VAR name="name" defaultValue="World"></VAR>!');
      assert.strictEqual(result, 'Hello World!');
    });

    it('should use provided values over defaults', () => {
      const result = generatePreview('Hello <VAR name="name" defaultValue="World"></VAR>!', { name: 'John' });
      assert.strictEqual(result, 'Hello John!');
    });

    it('should use placeholder for variables without defaults', () => {
      const result = generatePreview('Hello <VAR name="name"></VAR>!');
      assert.strictEqual(result, 'Hello [name]!');
    });
  });

  describe('isValidVariableName', () => {
    it('should return true for simple name', () => {
      assert.strictEqual(isValidVariableName('name'), true);
    });

    it('should return true for name with underscore', () => {
      assert.strictEqual(isValidVariableName('my_variable'), true);
    });

    it('should return true for name with hyphen', () => {
      assert.strictEqual(isValidVariableName('my-var'), true);
    });

    it('should return false for name starting with number', () => {
      assert.strictEqual(isValidVariableName('123name'), false);
    });

    it('should return false for name with spaces', () => {
      assert.strictEqual(isValidVariableName('my name'), false);
    });

    it('should return false for empty string', () => {
      assert.strictEqual(isValidVariableName(''), false);
    });
  });

  describe('getVariableStats', () => {
    it('should return zeros for template without variables', () => {
      const stats = getVariableStats('Hello World!');
      assert.strictEqual(stats.total, 0);
      assert.strictEqual(stats.unique, 0);
      assert.strictEqual(stats.withDefaults, 0);
      assert.strictEqual(stats.required, 0);
    });

    it('should count single variable correctly', () => {
      const stats = getVariableStats('<VAR name="name"></VAR>');
      assert.strictEqual(stats.total, 1);
      assert.strictEqual(stats.unique, 1);
      assert.strictEqual(stats.withDefaults, 0);
      assert.strictEqual(stats.required, 1);
    });

    it('should count variable with default correctly', () => {
      const stats = getVariableStats('<VAR name="name" defaultValue="default"></VAR>');
      assert.strictEqual(stats.total, 1);
      assert.strictEqual(stats.unique, 1);
      assert.strictEqual(stats.withDefaults, 1);
      assert.strictEqual(stats.required, 0);
    });

    it('should count mixed variables correctly', () => {
      const stats = getVariableStats('<VAR name="a" defaultValue="1"></VAR> <VAR name="b"></VAR>');
      assert.strictEqual(stats.withDefaults, 1);
      assert.strictEqual(stats.required, 1);
    });
  });

  describe('Real-world usage - No conflicts', () => {
    it('should NOT match curly braces in markdown', () => {
      const template = '# {heading} is a conflict test\n\n**Bold text** and <VAR name="variable"></VAR>';
      const variables = getUniqueVariables(template);
      assert.strictEqual(variables.length, 1);
      assert.strictEqual(variables[0].name, 'variable');
    });

    it('should NOT match curly braces in JSON', () => {
      const template = '{"key": "{value}", "var": "<VAR name="var"></VAR>"}';
      const variables = getUniqueVariables(template);
      assert.strictEqual(variables.length, 1);
      assert.strictEqual(variables[0].name, 'var');
    });

    it('should NOT match Handlebars syntax', () => {
      const template = '{{#each items}}<VAR name="item"></VAR>{{/each}}';
      const variables = getUniqueVariables(template);
      assert.strictEqual(variables.length, 1);
    });

    it('should NOT match template literals', () => {
      const template = '`Hello {name}` and <VAR name="greeting"></VAR>';
      const variables = getUniqueVariables(template);
      assert.strictEqual(variables.length, 1);
      assert.strictEqual(variables[0].name, 'greeting');
    });

    it('should NOT match percentage placeholders', () => {
      const template = 'Hello %s and <VAR name="name"></VAR>';
      const variables = getUniqueVariables(template);
      assert.strictEqual(variables.length, 1);
      assert.strictEqual(variables[0].name, 'name');
    });

    it('should NOT match dollar sign variables', () => {
      const template = '$variable and <VAR name="name"></VAR>';
      const variables = getUniqueVariables(template);
      assert.strictEqual(variables.length, 1);
      assert.strictEqual(variables[0].name, 'name');
    });

    it('should interpolate correctly when mixed with other syntax', () => {
      const template = '# {title}\n\n<VAR name="content"></VAR>\n\nCode: `{code}`';
      const result = interpolate(template, { content: 'My Content' });
      assert.ok(result.includes('My Content'));
      assert.ok(result.includes('{title}')); // Not replaced
      assert.ok(result.includes('`{code}`')); // Not replaced
    });
  });

  describe('Translation prompt example', () => {
    it('should handle the exact translation prompt from user', () => {
      const template = `Translate the following text to <VAR name="target_language" defaultValue="English"></VAR>:

<VAR name="text"></VAR>

Do **not** translate {keep_as_is}`;

      const variables = getUniqueVariables(template);
      assert.strictEqual(variables.length, 2);
      
      const langVar = variables.find(v => v.name === 'target_language');
      assert.strictEqual(langVar?.defaultValue, 'English');
      
      const textVar = variables.find(v => v.name === 'text');
      assert.strictEqual(textVar?.defaultValue, undefined);

      const result = interpolate(template, {
        target_language: '中文',
        text: 'Hello World'
      });
      
      assert.ok(result.includes('Translate the following text to 中文'));
      assert.ok(result.includes('Hello World'));
      assert.ok(result.includes('Do **not** translate {keep_as_is}'));
    });
  });
});
