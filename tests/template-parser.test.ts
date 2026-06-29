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
 */

import {
  parseTemplate,
  getUniqueVariables,
  hasVariables,
  allVariablesHaveDefaults,
  interpolate,
  generatePreview,
  isValidVariableName,
  getVariableStats,
  Variable,
} from '../src/utils/template-parser';

describe('Template Parser', () => {
  describe('parseTemplate', () => {
    it('should return empty array for template without variables', () => {
      const result = parseTemplate('Hello World!');
      expect(result.variables).toHaveLength(0);
      expect(result.template).toBe('Hello World!');
    });

    it('should parse single variable', () => {
      const result = parseTemplate('Hello {name}!');
      expect(result.variables).toHaveLength(1);
      expect(result.variables[0].name).toBe('name');
      expect(result.variables[0].defaultValue).toBeUndefined();
      expect(result.variables[0].fullMatch).toBe('{name}');
      expect(result.variables[0].startIndex).toBe(6);
      // endIndex is startIndex + length of "{name}" = 6 + 6 = 12
      expect(result.variables[0].endIndex).toBe(12);
    });

    it('should parse variable with default value', () => {
      const result = parseTemplate('Hello {name:World}!');
      expect(result.variables).toHaveLength(1);
      expect(result.variables[0].name).toBe('name');
      expect(result.variables[0].defaultValue).toBe('World');
    });

    it('should parse multiple variables', () => {
      const result = parseTemplate('{greeting} {name}!');
      expect(result.variables).toHaveLength(2);
      expect(result.variables[0].name).toBe('greeting');
      expect(result.variables[1].name).toBe('name');
    });

    it('should parse duplicate variables', () => {
      const result = parseTemplate('{name} is the same as {name}');
      expect(result.variables).toHaveLength(2);
      expect(result.variables[0].name).toBe('name');
      expect(result.variables[1].name).toBe('name');
    });

    it('should handle variables at start of template', () => {
      const result = parseTemplate('{greeting} there!');
      expect(result.variables).toHaveLength(1);
      expect(result.variables[0].startIndex).toBe(0);
    });

    it('should handle variables at end of template', () => {
      const result = parseTemplate('Say {word}');
      expect(result.variables).toHaveLength(1);
      expect(result.variables[0].endIndex).toBe(10);
    });

    it('should handle adjacent variables', () => {
      const result = parseTemplate('{a}{b}');
      expect(result.variables).toHaveLength(2);
      expect(result.variables[0].endIndex).toBe(3);
      expect(result.variables[1].startIndex).toBe(3);
    });

    it('should handle default values with special characters', () => {
      const result = parseTemplate('{style:formal, professional}');
      expect(result.variables[0].defaultValue).toBe('formal, professional');
    });

    it('should handle default values with spaces', () => {
      const result = parseTemplate('{greeting:Hello World}');
      expect(result.variables[0].defaultValue).toBe('Hello World');
    });

    it('should handle default values with numbers', () => {
      const result = parseTemplate('{count:42} and {ratio:3.14}');
      expect(result.variables[0].defaultValue).toBe('42');
      expect(result.variables[1].defaultValue).toBe('3.14');
    });

    it('should not match empty braces', () => {
      const result = parseTemplate('{}');
      expect(result.variables).toHaveLength(0);
    });

    it('should not match braces with only special characters', () => {
      const result = parseTemplate('{!} {?} {$}');
      expect(result.variables).toHaveLength(0);
    });

    it('should handle variable with underscore', () => {
      const result = parseTemplate('{my_variable}');
      expect(result.variables).toHaveLength(1);
      expect(result.variables[0].name).toBe('my_variable');
    });

    it('should handle variable with hyphen', () => {
      const result = parseTemplate('{my-var}');
      expect(result.variables).toHaveLength(1);
      expect(result.variables[0].name).toBe('my-var');
    });

    it('should handle variable starting with underscore', () => {
      const result = parseTemplate('{_private}');
      expect(result.variables).toHaveLength(1);
      expect(result.variables[0].name).toBe('_private');
    });

    it('should handle multiline templates', () => {
      const template = `Hello {name},
How are you today?`;
      const result = parseTemplate(template);
      expect(result.variables).toHaveLength(1);
      expect(result.variables[0].name).toBe('name');
    });

    it('should handle template with only a variable', () => {
      const result = parseTemplate('{var}');
      expect(result.variables).toHaveLength(1);
      expect(result.variables[0].startIndex).toBe(0);
      expect(result.variables[0].endIndex).toBe(5);
    });
  });

  describe('getUniqueVariables', () => {
    it('should return empty array for template without variables', () => {
      const result = getUniqueVariables('Hello World!');
      expect(result).toHaveLength(0);
    });

    it('should return single variable for single occurrence', () => {
      const result = getUniqueVariables('{name}');
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('name');
    });

    it('should return unique variables only', () => {
      const result = getUniqueVariables('{a} {b} {a} {c} {b}');
      expect(result).toHaveLength(3);
      const names = result.map(v => v.name).sort();
      expect(names).toEqual(['a', 'b', 'c']);
    });

    it('should return first occurrence for duplicate variables', () => {
      const result = getUniqueVariables('{name:first} {name:second}');
      expect(result).toHaveLength(1);
      expect(result[0].defaultValue).toBe('first');
    });

    it('should preserve default values', () => {
      const result = getUniqueVariables('{name:default}');
      expect(result).toHaveLength(1);
      expect(result[0].defaultValue).toBe('default');
    });
  });

  describe('hasVariables', () => {
    it('should return false for template without variables', () => {
      expect(hasVariables('Hello World!')).toBe(false);
    });

    it('should return true for template with one variable', () => {
      expect(hasVariables('Hello {name}!')).toBe(true);
    });

    it('should return true for template with multiple variables', () => {
      expect(hasVariables('{a} {b} {c}')).toBe(true);
    });

    it('should return false for empty template', () => {
      expect(hasVariables('')).toBe(false);
    });

    it('should return false for whitespace only', () => {
      expect(hasVariables('   ')).toBe(false);
    });

    it('should return true for template with default value variable', () => {
      expect(hasVariables('{name:default}')).toBe(true);
    });
  });

  describe('allVariablesHaveDefaults', () => {
    it('should return false for template without variables', () => {
      expect(allVariablesHaveDefaults('Hello!')).toBe(false);
    });

    it('should return true when all variables have defaults', () => {
      expect(allVariablesHaveDefaults('{a:1} {b:2}')).toBe(true);
    });

    it('should return false when some variables lack defaults', () => {
      expect(allVariablesHaveDefaults('{a:1} {b}')).toBe(false);
    });

    it('should return false when no variables have defaults', () => {
      expect(allVariablesHaveDefaults('{a} {b}')).toBe(false);
    });

    it('should return true for single variable with default', () => {
      expect(allVariablesHaveDefaults('{var:default}')).toBe(true);
    });

    it('should return false for single variable without default', () => {
      expect(allVariablesHaveDefaults('{var}')).toBe(false);
    });
  });

  describe('interpolate', () => {
    it('should return original template when no values provided', () => {
      expect(interpolate('Hello {name}!', {})).toBe('Hello {name}!');
    });

    it('should replace variable with provided value', () => {
      expect(interpolate('Hello {name}!', { name: 'World' })).toBe('Hello World!');
    });

    it('should use default value when no value provided', () => {
      expect(interpolate('Hello {name:World}!', {})).toBe('Hello World!');
    });

    it('should prefer provided value over default', () => {
      expect(interpolate('Hello {name:World}!', { name: 'John' })).toBe('Hello John!');
    });

    it('should handle multiple variables', () => {
      const template = '{greeting} {name}!';
      const result = interpolate(template, { greeting: 'Hello', name: 'World' });
      expect(result).toBe('Hello World!');
    });

    it('should handle mixed variables with and without defaults', () => {
      const template = '{greeting} {name}!';
      const result = interpolate(template, { greeting: 'Hi', name: undefined as any });
      expect(result).toBe('Hi {name}!');
    });

    it('should handle empty string value', () => {
      expect(interpolate('Hello {name}!', { name: '' })).toBe('Hello {name}!');
    });

    it('should handle whitespace value', () => {
      expect(interpolate('Hello {name}!', { name: ' ' })).toBe('Hello  !');
    });

    it('should not affect text outside variables', () => {
      const template = 'Prefix {var} suffix';
      expect(interpolate(template, { var: 'X' })).toBe('Prefix X suffix');
    });

    it('should handle nested braces in default values', () => {
      // The parser treats {nested} inside the default as part of the default value
      // because [^}]* matches until the first closing }
      // Result: {text:{nested}} -> {nested} (default value used)
      const result = interpolate('{text:{nested}}', {});
      expect(result).toBe('{nested}');
    });

    it('should handle duplicate variables', () => {
      const template = '{name} and {name}';
      expect(interpolate(template, { name: 'Alice' })).toBe('Alice and Alice');
    });

    it('should handle unicode in values', () => {
      expect(interpolate('{greeting}', { greeting: '你好世界 🌍' })).toBe('你好世界 🌍');
    });

    it('should handle special regex characters in values', () => {
      expect(interpolate('{text}', { text: '$100 (50% off!)' })).toBe('$100 (50% off!)');
    });

    it('should handle newlines in default values', () => {
      expect(interpolate('{multi:line1\nline2}', {})).toBe('line1\nline2');
    });

    it('should handle template with only variable', () => {
      expect(interpolate('{var}', { var: 'value' })).toBe('value');
    });

    it('should handle adjacent variables with values', () => {
      expect(interpolate('{a}{b}', { a: 'X', b: 'Y' })).toBe('XY');
    });
  });

  describe('generatePreview', () => {
    it('should use defaults when no values provided', () => {
      const result = generatePreview('Hello {name:World}!');
      expect(result).toBe('Hello World!');
    });

    it('should use provided values over defaults', () => {
      const result = generatePreview('Hello {name:World}!', { name: 'John' });
      expect(result).toBe('Hello John!');
    });

    it('should use placeholder for variables without defaults', () => {
      const result = generatePreview('Hello {name}!');
      expect(result).toBe('Hello [name]!');
    });

    it('should handle multiple variables with mixed defaults', () => {
      const result = generatePreview('{a:1} and {b}', {});
      expect(result).toBe('1 and [b]');
    });

    it('should prefer provided values', () => {
      const result = generatePreview('{a} and {b}', { a: 'X', b: 'Y' });
      expect(result).toBe('X and Y');
    });
  });

  describe('isValidVariableName', () => {
    it('should return true for simple name', () => {
      expect(isValidVariableName('name')).toBe(true);
    });

    it('should return true for name with underscore', () => {
      expect(isValidVariableName('my_variable')).toBe(true);
    });

    it('should return true for name with hyphen', () => {
      expect(isValidVariableName('my-var')).toBe(true);
    });

    it('should return true for name starting with underscore', () => {
      expect(isValidVariableName('_private')).toBe(true);
    });

    it('should return true for name with numbers', () => {
      expect(isValidVariableName('var123')).toBe(true);
    });

    it('should return true for mixed case', () => {
      expect(isValidVariableName('myVariable_123')).toBe(true);
    });

    it('should return false for name starting with number', () => {
      expect(isValidVariableName('123name')).toBe(false);
    });

    it('should return false for name with spaces', () => {
      expect(isValidVariableName('my name')).toBe(false);
    });

    it('should return false for empty string', () => {
      expect(isValidVariableName('')).toBe(false);
    });

    it('should return false for special characters', () => {
      expect(isValidVariableName('name!')).toBe(false);
      expect(isValidVariableName('name@')).toBe(false);
      expect(isValidVariableName('name#')).toBe(false);
    });

    it('should return false for name with dots', () => {
      expect(isValidVariableName('name.surname')).toBe(false);
    });
  });

  describe('getVariableStats', () => {
    it('should return zeros for template without variables', () => {
      const stats = getVariableStats('Hello World!');
      expect(stats.total).toBe(0);
      expect(stats.unique).toBe(0);
      expect(stats.withDefaults).toBe(0);
      expect(stats.required).toBe(0);
    });

    it('should count single variable correctly', () => {
      const stats = getVariableStats('{name}');
      expect(stats.total).toBe(1);
      expect(stats.unique).toBe(1);
      expect(stats.withDefaults).toBe(0);
      expect(stats.required).toBe(1);
    });

    it('should count variable with default correctly', () => {
      const stats = getVariableStats('{name:default}');
      expect(stats.total).toBe(1);
      expect(stats.unique).toBe(1);
      expect(stats.withDefaults).toBe(1);
      expect(stats.required).toBe(0);
    });

    it('should count duplicate variables correctly', () => {
      const stats = getVariableStats('{name} {other} {name}');
      expect(stats.total).toBe(3);
      expect(stats.unique).toBe(2);
    });

    it('should count mixed variables correctly', () => {
      const stats = getVariableStats('{a:1} {b} {c:3} {d}');
      expect(stats.total).toBe(4);
      expect(stats.unique).toBe(4);
      expect(stats.withDefaults).toBe(2);
      expect(stats.required).toBe(2);
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
      expect(variables).toHaveLength(3);
      
      const names = variables.map(v => v.name).sort();
      expect(names).toEqual(['code', 'focus_areas', 'language']);
      
      const focusVar = variables.find(v => v.name === 'focus_areas');
      expect(focusVar?.defaultValue).toBe('general improvements');
      
      const codeVar = variables.find(v => v.name === 'code');
      expect(codeVar?.defaultValue).toBeUndefined();
    });

    it('should handle prompt with all required variables', () => {
      const template = 'Write a {tone} {style} explanation about {topic}';
      const result = interpolate(template, {
        tone: 'professional',
        style: 'technical',
        topic: 'JavaScript closures'
      });
      expect(result).toBe('Write a professional technical explanation about JavaScript closures');
    });

    it('should handle prompt with all optional variables', () => {
      const template = 'Write a {tone:casual} explanation about {topic:this topic}';
      const result = interpolate(template, {});
      expect(result).toBe('Write a casual explanation about this topic');
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
      expect(result).toContain('title: My Post');
      expect(result).toContain('description: No description');
      expect(result).toContain('tags: [general]');
    });

    it('should handle JSON-like structure', () => {
      const template = '{"name": "{name}", "age": {age:0}, "active": {active:true}}';
      const result = interpolate(template, { name: 'John' });
      expect(result).toContain('"name": "John"');
      expect(result).toContain('"age": 0');
      expect(result).toContain('"active": true');
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

      expect(result).toContain('Dear Alice');
      expect(result).toContain('purchase'); // default for order_type
      expect(result).toContain('#ORD-2024-001'); // replaced with provided value
      expect(result).toContain('received'); // default for status
    });
  });
});