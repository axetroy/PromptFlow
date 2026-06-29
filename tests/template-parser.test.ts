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

describe('Template Parser', () => {
  describe('parseTemplate', () => {
    it('should return empty array for template without variables', () => {
      const result = parseTemplate('Hello World!');
      assert.strictEqual(result.variables.length, 0);
      assert.strictEqual(result.template, 'Hello World!');
    });

    it('should parse single variable', () => {
      const result = parseTemplate('Hello {name}!');
      assert.strictEqual(result.variables.length, 1);
      assert.strictEqual(result.variables[0].name, 'name');
      assert.strictEqual(result.variables[0].defaultValue, undefined);
      assert.strictEqual(result.variables[0].fullMatch, '{name}');
      assert.strictEqual(result.variables[0].startIndex, 6);
      assert.strictEqual(result.variables[0].endIndex, 12);
    });

    it('should parse variable with default value', () => {
      const result = parseTemplate('Hello {name:World}!');
      assert.strictEqual(result.variables.length, 1);
      assert.strictEqual(result.variables[0].name, 'name');
      assert.strictEqual(result.variables[0].defaultValue, 'World');
    });

    it('should parse multiple variables', () => {
      const result = parseTemplate('{greeting} {name}!');
      assert.strictEqual(result.variables.length, 2);
      assert.strictEqual(result.variables[0].name, 'greeting');
      assert.strictEqual(result.variables[1].name, 'name');
    });

    it('should parse duplicate variables', () => {
      const result = parseTemplate('{name} is the same as {name}');
      assert.strictEqual(result.variables.length, 2);
      assert.strictEqual(result.variables[0].name, 'name');
      assert.strictEqual(result.variables[1].name, 'name');
    });

    it('should handle variables at start of template', () => {
      const result = parseTemplate('{greeting} there!');
      assert.strictEqual(result.variables.length, 1);
      assert.strictEqual(result.variables[0].startIndex, 0);
    });

    it('should handle variables at end of template', () => {
      const result = parseTemplate('Say {word}');
      assert.strictEqual(result.variables.length, 1);
      assert.strictEqual(result.variables[0].endIndex, 10);
    });

    it('should handle adjacent variables', () => {
      const result = parseTemplate('{a}{b}');
      assert.strictEqual(result.variables.length, 2);
      assert.strictEqual(result.variables[0].endIndex, 3);
      assert.strictEqual(result.variables[1].startIndex, 3);
    });

    it('should handle default values with special characters', () => {
      const result = parseTemplate('{style:formal, professional}');
      assert.strictEqual(result.variables[0].defaultValue, 'formal, professional');
    });

    it('should handle default values with spaces', () => {
      const result = parseTemplate('{greeting:Hello World}');
      assert.strictEqual(result.variables[0].defaultValue, 'Hello World');
    });

    it('should handle default values with numbers', () => {
      const result = parseTemplate('{count:42} and {ratio:3.14}');
      assert.strictEqual(result.variables[0].defaultValue, '42');
      assert.strictEqual(result.variables[1].defaultValue, '3.14');
    });

    it('should not match empty braces', () => {
      const result = parseTemplate('{}');
      assert.strictEqual(result.variables.length, 0);
    });

    it('should not match braces with only special characters', () => {
      const result = parseTemplate('{!} {?} {$}');
      assert.strictEqual(result.variables.length, 0);
    });

    it('should handle variable with underscore', () => {
      const result = parseTemplate('{my_variable}');
      assert.strictEqual(result.variables.length, 1);
      assert.strictEqual(result.variables[0].name, 'my_variable');
    });

    it('should handle variable with hyphen', () => {
      const result = parseTemplate('{my-var}');
      assert.strictEqual(result.variables.length, 1);
      assert.strictEqual(result.variables[0].name, 'my-var');
    });

    it('should handle variable starting with underscore', () => {
      const result = parseTemplate('{_private}');
      assert.strictEqual(result.variables.length, 1);
      assert.strictEqual(result.variables[0].name, '_private');
    });

    it('should handle multiline templates', () => {
      const template = `Hello {name},
How are you today?`;
      const result = parseTemplate(template);
      assert.strictEqual(result.variables.length, 1);
      assert.strictEqual(result.variables[0].name, 'name');
    });

    it('should handle template with only a variable', () => {
      const result = parseTemplate('{var}');
      assert.strictEqual(result.variables.length, 1);
      assert.strictEqual(result.variables[0].startIndex, 0);
      assert.strictEqual(result.variables[0].endIndex, 5);
    });
  });

  describe('getUniqueVariables', () => {
    it('should return empty array for template without variables', () => {
      const result = getUniqueVariables('Hello World!');
      assert.strictEqual(result.length, 0);
    });

    it('should return single variable for single occurrence', () => {
      const result = getUniqueVariables('{name}');
      assert.strictEqual(result.length, 1);
      assert.strictEqual(result[0].name, 'name');
    });

    it('should return unique variables only', () => {
      const result = getUniqueVariables('{a} {b} {a} {c} {b}');
      assert.strictEqual(result.length, 3);
      const names = result.map(v => v.name).sort();
      assert.deepStrictEqual(names, ['a', 'b', 'c']);
    });

    it('should return first occurrence for duplicate variables', () => {
      const result = getUniqueVariables('{name:first} {name:second}');
      assert.strictEqual(result.length, 1);
      assert.strictEqual(result[0].defaultValue, 'first');
    });

    it('should preserve default values', () => {
      const result = getUniqueVariables('{name:default}');
      assert.strictEqual(result.length, 1);
      assert.strictEqual(result[0].defaultValue, 'default');
    });
  });

  describe('hasVariables', () => {
    it('should return false for template without variables', () => {
      assert.strictEqual(hasVariables('Hello World!'), false);
    });

    it('should return true for template with one variable', () => {
      assert.strictEqual(hasVariables('Hello {name}!'), true);
    });

    it('should return true for template with multiple variables', () => {
      assert.strictEqual(hasVariables('{a} {b} {c}'), true);
    });

    it('should return false for empty template', () => {
      assert.strictEqual(hasVariables(''), false);
    });

    it('should return false for whitespace only', () => {
      assert.strictEqual(hasVariables('   '), false);
    });

    it('should return true for template with default value variable', () => {
      assert.strictEqual(hasVariables('{name:default}'), true);
    });
  });

  describe('allVariablesHaveDefaults', () => {
    it('should return false for template without variables', () => {
      assert.strictEqual(allVariablesHaveDefaults('Hello!'), false);
    });

    it('should return true when all variables have defaults', () => {
      assert.strictEqual(allVariablesHaveDefaults('{a:1} {b:2}'), true);
    });

    it('should return false when some variables lack defaults', () => {
      assert.strictEqual(allVariablesHaveDefaults('{a:1} {b}'), false);
    });

    it('should return false when no variables have defaults', () => {
      assert.strictEqual(allVariablesHaveDefaults('{a} {b}'), false);
    });

    it('should return true for single variable with default', () => {
      assert.strictEqual(allVariablesHaveDefaults('{var:default}'), true);
    });

    it('should return false for single variable without default', () => {
      assert.strictEqual(allVariablesHaveDefaults('{var}'), false);
    });
  });

  describe('interpolate', () => {
    it('should return original template when no values provided', () => {
      assert.strictEqual(interpolate('Hello {name}!', {}), 'Hello {name}!');
    });

    it('should replace variable with provided value', () => {
      assert.strictEqual(interpolate('Hello {name}!', { name: 'World' }), 'Hello World!');
    });

    it('should use default value when no value provided', () => {
      assert.strictEqual(interpolate('Hello {name:World}!', {}), 'Hello World!');
    });

    it('should prefer provided value over default', () => {
      assert.strictEqual(interpolate('Hello {name:World}!', { name: 'John' }), 'Hello John!');
    });

    it('should handle multiple variables', () => {
      const template = '{greeting} {name}!';
      const result = interpolate(template, { greeting: 'Hello', name: 'World' });
      assert.strictEqual(result, 'Hello World!');
    });

    it('should handle mixed variables with and without defaults', () => {
      const template = '{greeting} {name}!';
      const result = interpolate(template, { greeting: 'Hi' });
      assert.strictEqual(result, 'Hi {name}!');
    });

    it('should handle empty string value', () => {
      assert.strictEqual(interpolate('Hello {name}!', { name: '' }), 'Hello {name}!');
    });

    it('should handle whitespace value', () => {
      assert.strictEqual(interpolate('Hello {name}!', { name: ' ' }), 'Hello  !');
    });

    it('should not affect text outside variables', () => {
      const template = 'Prefix {var} suffix';
      assert.strictEqual(interpolate(template, { var: 'X' }), 'Prefix X suffix');
    });

    it('should handle nested braces in default values', () => {
      const result = interpolate('{text:{nested}}', {});
      assert.strictEqual(result, '{nested}');
    });

    it('should handle duplicate variables', () => {
      const template = '{name} and {name}';
      assert.strictEqual(interpolate(template, { name: 'Alice' }), 'Alice and Alice');
    });

    it('should handle unicode in values', () => {
      assert.strictEqual(interpolate('{greeting}', { greeting: '你好世界 🌍' }), '你好世界 🌍');
    });

    it('should handle special regex characters in values', () => {
      assert.strictEqual(interpolate('{text}', { text: '$100 (50% off!)' }), '$100 (50% off!)');
    });

    it('should handle newlines in default values', () => {
      assert.strictEqual(interpolate('{multi:line1\nline2}', {}), 'line1\nline2');
    });

    it('should handle template with only variable', () => {
      assert.strictEqual(interpolate('{var}', { var: 'value' }), 'value');
    });

    it('should handle adjacent variables with values', () => {
      assert.strictEqual(interpolate('{a}{b}', { a: 'X', b: 'Y' }), 'XY');
    });
  });

  describe('generatePreview', () => {
    it('should use defaults when no values provided', () => {
      const result = generatePreview('Hello {name:World}!');
      assert.strictEqual(result, 'Hello World!');
    });

    it('should use provided values over defaults', () => {
      const result = generatePreview('Hello {name:World}!', { name: 'John' });
      assert.strictEqual(result, 'Hello John!');
    });

    it('should use placeholder for variables without defaults', () => {
      const result = generatePreview('Hello {name}!');
      assert.strictEqual(result, 'Hello [name]!');
    });

    it('should handle multiple variables with mixed defaults', () => {
      const result = generatePreview('{a:1} and {b}', {});
      assert.strictEqual(result, '1 and [b]');
    });

    it('should prefer provided values', () => {
      const result = generatePreview('{a} and {b}', { a: 'X', b: 'Y' });
      assert.strictEqual(result, 'X and Y');
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

    it('should return true for name starting with underscore', () => {
      assert.strictEqual(isValidVariableName('_private'), true);
    });

    it('should return true for name with numbers', () => {
      assert.strictEqual(isValidVariableName('var123'), true);
    });

    it('should return true for mixed case', () => {
      assert.strictEqual(isValidVariableName('myVariable_123'), true);
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

    it('should return false for special characters', () => {
      assert.strictEqual(isValidVariableName('name!'), false);
      assert.strictEqual(isValidVariableName('name@'), false);
      assert.strictEqual(isValidVariableName('name#'), false);
    });

    it('should return false for name with dots', () => {
      assert.strictEqual(isValidVariableName('name.surname'), false);
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
      const stats = getVariableStats('{name}');
      assert.strictEqual(stats.total, 1);
      assert.strictEqual(stats.unique, 1);
      assert.strictEqual(stats.withDefaults, 0);
      assert.strictEqual(stats.required, 1);
    });

    it('should count variable with default correctly', () => {
      const stats = getVariableStats('{name:default}');
      assert.strictEqual(stats.total, 1);
      assert.strictEqual(stats.unique, 1);
      assert.strictEqual(stats.withDefaults, 1);
      assert.strictEqual(stats.required, 0);
    });

    it('should count duplicate variables correctly', () => {
      const stats = getVariableStats('{name} {other} {name}');
      assert.strictEqual(stats.total, 3);
      assert.strictEqual(stats.unique, 2);
    });

    it('should count mixed variables correctly', () => {
      const stats = getVariableStats('{a:1} {b} {c:3} {d}');
      assert.strictEqual(stats.total, 4);
      assert.strictEqual(stats.unique, 4);
      assert.strictEqual(stats.withDefaults, 2);
      assert.strictEqual(stats.required, 2);
    });
  });

  describe('Edge cases and real-world usage', () => {
    it('should handle realistic code review prompt', () => {
      const template = `Review the following {language} code:

\`\`\`
{code}
\`\`\`

Focus on: {focus_areas:general improvements}`;

      const variables = getUniqueVariables(template);
      assert.strictEqual(variables.length, 3);
      
      const names = variables.map(v => v.name).sort();
      assert.deepStrictEqual(names, ['code', 'focus_areas', 'language']);
      
      const focusVar = variables.find(v => v.name === 'focus_areas');
      assert.strictEqual(focusVar?.defaultValue, 'general improvements');
      
      const codeVar = variables.find(v => v.name === 'code');
      assert.strictEqual(codeVar?.defaultValue, undefined);
    });

    it('should handle prompt with all required variables', () => {
      const template = 'Write a {tone} {style} explanation about {topic}';
      const result = interpolate(template, {
        tone: 'professional',
        style: 'technical',
        topic: 'JavaScript closures'
      });
      assert.strictEqual(result, 'Write a professional technical explanation about JavaScript closures');
    });

    it('should handle prompt with all optional variables', () => {
      const template = 'Write a {tone:casual} explanation about {topic:this topic}';
      const result = interpolate(template, {});
      assert.strictEqual(result, 'Write a casual explanation about this topic');
    });

    it('should handle complex markdown prompt', () => {
      const template = `---
title: {title:Untitled}
description: {description:No description}
tags: [{tags:general}]
---

# {title:Untitled}

{content}`;

      const result = interpolate(template, { title: 'My Post' });
      assert.ok(result.includes('title: My Post'));
      assert.ok(result.includes('description: No description'));
      assert.ok(result.includes('tags: [general]'));
    });

    it('should handle JSON-like structure', () => {
      const template = '{"name": "{name}", "age": {age:0}, "active": {active:true}}';
      const result = interpolate(template, { name: 'John' });
      assert.ok(result.includes('"name": "John"'));
      assert.ok(result.includes('"age": 0'));
      assert.ok(result.includes('"active": true'));
    });

    it('should handle email template', () => {
      const template = `Dear {name:Valued Customer},

Thank you for your {order_type:purchase}.

Your order #{order_id:12345} has been {status:received}.

Best regards,
{company:Our Company}`;

      const result = interpolate(template, {
        name: 'Alice',
        order_id: 'ORD-2024-001'
      });

      assert.ok(result.includes('Dear Alice'));
      assert.ok(result.includes('purchase'));
      assert.ok(result.includes('#ORD-2024-001'));
      assert.ok(result.includes('received'));
    });
  });
});