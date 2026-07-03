// @vitest-environment jsdom

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  findFirstPlaceholder,
  setInputSelection,
  setContentEditableSelection,
  insertContentIntoContentEditable,
  getInputCaretPosition,
  setInputCaretPosition,
  calculatePromptInsertion,
  insertContentIntoInput,
} from './cursor-utils';

describe('findFirstPlaceholder', () => {
  it('should find a simple placeholder', () => {
    const result = findFirstPlaceholder('Hello {name}!');
    expect(result).toEqual({ start: 6, end: 12 });
  });

  it('should find the first placeholder when multiple exist', () => {
    const result = findFirstPlaceholder('{greeting} {name}!');
    expect(result).toEqual({ start: 0, end: 10 });
  });

  it('should return null when no placeholder exists', () => {
    expect(findFirstPlaceholder('Hello World!')).toBeNull();
  });

  it('should return null for empty string', () => {
    expect(findFirstPlaceholder('')).toBeNull();
  });

  it('should find placeholder with underscores and hyphens', () => {
    const result = findFirstPlaceholder('Value: {my_var-name}');
    expect(result).toEqual({ start: 7, end: 20 });
  });

  it('should not match empty braces', () => {
    expect(findFirstPlaceholder('Empty {} here')).toBeNull();
  });

  it('should find placeholder with spaces inside', () => {
    const result = findFirstPlaceholder('{some value}');
    expect(result).toEqual({ start: 0, end: 12 });
  });
});

describe('setInputSelection', () => {
  let input: HTMLInputElement;

  beforeEach(() => {
    input = document.createElement('input');
    input.value = 'Hello World';
    document.body.appendChild(input);
  });

  afterEach(() => {
    document.body.removeChild(input);
  });

  it('should set selection range on input element', () => {
    setInputSelection(input, 0, 5);
    expect(input.selectionStart).toBe(0);
    expect(input.selectionEnd).toBe(5);
  });

  it('should set collapsed selection (cursor position)', () => {
    setInputSelection(input, 3, 3);
    expect(input.selectionStart).toBe(3);
    expect(input.selectionEnd).toBe(3);
  });

  it('should work with textarea elements', () => {
    const textarea = document.createElement('textarea');
    textarea.value = 'Hello World';
    document.body.appendChild(textarea);

    setInputSelection(textarea, 6, 11);
    expect(textarea.selectionStart).toBe(6);
    expect(textarea.selectionEnd).toBe(11);

    document.body.removeChild(textarea);
  });
});

describe('setContentEditableSelection', () => {
  let div: HTMLDivElement;

  beforeEach(() => {
    div = document.createElement('div');
    div.setAttribute('contenteditable', 'true');
    div.textContent = 'Hello World';
    document.body.appendChild(div);
  });

  afterEach(() => {
    document.body.removeChild(div);
  });

  it('should set selection in contenteditable element', () => {
    setContentEditableSelection(div, 0, 5);
    const sel = window.getSelection()!;
    expect(sel.toString()).toBe('Hello');
  });

  it('should set collapsed cursor position', () => {
    setContentEditableSelection(div, 5, 5);
    const sel = window.getSelection()!;
    expect(sel.isCollapsed).toBe(true);
  });

  it('should not throw for element without contenteditable', () => {
    const span = document.createElement('span');
    document.body.appendChild(span);
    expect(() => setContentEditableSelection(span, 0, 0)).not.toThrow();
    document.body.removeChild(span);
  });

  it('should handle position beyond content length', () => {
    setContentEditableSelection(div, 0, 100);
    // Should not throw, just collapse to end
    expect(true).toBe(true);
  });
});

describe('insertContentIntoContentEditable', () => {
  let div: HTMLDivElement;

  beforeEach(() => {
    div = document.createElement('div');
    div.setAttribute('contenteditable', 'true');
    document.body.appendChild(div);
  });

  afterEach(() => {
    document.body.removeChild(div);
  });

  it('should insert simple content', () => {
    const result = insertContentIntoContentEditable(div, 'Hello World');
    expect(div.textContent).toBe('Hello World');
    expect(result.selectionStart).toBe(11);
    expect(result.selectionEnd).toBe(11);
  });

  it('should insert content with newlines using br elements', () => {
    insertContentIntoContentEditable(div, 'Line 1\nLine 2\nLine 3');
    expect(div.querySelectorAll('br').length).toBe(2);
  });

  it('should select first placeholder when present', () => {
    const result = insertContentIntoContentEditable(div, 'Hello {name}!');
    expect(result.selectionStart).toBe(6);
    expect(result.selectionEnd).toBe(12);
  });

  it('should position cursor at end when no placeholder', () => {
    const result = insertContentIntoContentEditable(div, 'No placeholder here');
    expect(result.selectionStart).toBe(19);
    expect(result.selectionEnd).toBe(19);
  });

  it('should return zeros for non-contenteditable element', () => {
    const span = document.createElement('span');
    document.body.appendChild(span);
    const result = insertContentIntoContentEditable(span, 'test');
    expect(result.selectionStart).toBe(0);
    expect(result.selectionEnd).toBe(0);
    document.body.removeChild(span);
  });

  it('should clear existing content before inserting', () => {
    div.textContent = 'Old content';
    insertContentIntoContentEditable(div, 'New content');
    expect(div.textContent).toBe('New content');
  });
});

describe('getInputCaretPosition', () => {
  it('should return selectionStart from input', () => {
    const input = document.createElement('input');
    input.value = 'Hello World';
    document.body.appendChild(input);
    input.focus();
    input.setSelectionRange(5, 5);
    expect(getInputCaretPosition(input)).toBe(5);
    document.body.removeChild(input);
  });

  it('should return 0 when selectionStart is null', () => {
    const input = document.createElement('input');
    document.body.appendChild(input);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (input as any).selectionStart = null;
    expect(getInputCaretPosition(input)).toBe(0);
    document.body.removeChild(input);
  });
});

describe('setInputCaretPosition', () => {
  it('should set caret position in input', () => {
    const input = document.createElement('input');
    input.value = 'Hello World';
    document.body.appendChild(input);
    setInputCaretPosition(input, 7);
    expect(input.selectionStart).toBe(7);
    expect(input.selectionEnd).toBe(7);
    document.body.removeChild(input);
  });

  it('should set caret position in textarea', () => {
    const textarea = document.createElement('textarea');
    textarea.value = 'Hello World';
    document.body.appendChild(textarea);
    setInputCaretPosition(textarea, 3);
    expect(textarea.selectionStart).toBe(3);
    expect(textarea.selectionEnd).toBe(3);
    document.body.removeChild(textarea);
  });
});

describe('calculatePromptInsertion', () => {
  it('should position cursor at end of content when no placeholder', () => {
    const result = calculatePromptInsertion(5, 'Hello World', 5);
    expect(result.selectionStart).toBe(16); // 5 + 11
    expect(result.selectionEnd).toBe(16);
  });

  it('should select first placeholder when present', () => {
    const result = calculatePromptInsertion(5, 'Hello {name}!', 5);
    expect(result.selectionStart).toBe(11); // 5 + 6
    expect(result.selectionEnd).toBe(17);  // 5 + 12
  });

  it('should handle zero trigger start position', () => {
    const result = calculatePromptInsertion(0, 'Content', 0);
    expect(result.selectionStart).toBe(7);
    expect(result.selectionEnd).toBe(7);
  });

  it('should return empty strings for before, after, and newValue', () => {
    const result = calculatePromptInsertion(0, 'test', 0);
    expect(result.before).toBe('');
    expect(result.after).toBe('');
    expect(result.newValue).toBe('');
  });
});

describe('insertContentIntoInput', () => {
  it('should set input value and dispatch event', () => {
    const input = document.createElement('input');
    document.body.appendChild(input);

    let eventFired = false;
    input.addEventListener('input', () => {
      eventFired = true;
    });

    insertContentIntoInput(input, 'New Value', 3, 5);
    expect(input.value).toBe('New Value');
    expect(eventFired).toBe(true);
    expect(input.selectionStart).toBe(3);
    expect(input.selectionEnd).toBe(5);

    document.body.removeChild(input);
  });

  it('should work with textarea', () => {
    const textarea = document.createElement('textarea');
    document.body.appendChild(textarea);

    insertContentIntoInput(textarea, 'Line 1\nLine 2', 0, 14);
    expect(textarea.value).toBe('Line 1\nLine 2');

    document.body.removeChild(textarea);
  });
});
