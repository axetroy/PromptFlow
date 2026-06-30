// @vitest-environment jsdom

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  escapeHtml,
  getInputValue,
  getCaretPosition,
  getCaretRect,
  setCaretPosition,
  setSelection,
  insertContentWithNewlines,
} from './dom';

describe('escapeHtml', () => {
  it('should escape < and >', () => {
    expect(escapeHtml('<div>')).toBe('&lt;div&gt;');
  });

  it('should escape &', () => {
    expect(escapeHtml('a & b')).toBe('a &amp; b');
  });

  it('should return empty string for empty input', () => {
    expect(escapeHtml('')).toBe('');
  });

  it('should return plain text unchanged', () => {
    expect(escapeHtml('Hello World')).toBe('Hello World');
  });

  it('should escape mixed content', () => {
    expect(escapeHtml('<script>alert("xss")</script>')).toBe(
      '&lt;script&gt;alert("xss")&lt;/script&gt;'
    );
  });
});

describe('getInputValue', () => {
  it('should return value from HTMLInputElement', () => {
    const input = document.createElement('input');
    input.value = 'test value';
    expect(getInputValue(input)).toBe('test value');
  });

  it('should return value from HTMLTextAreaElement', () => {
    const textarea = document.createElement('textarea');
    textarea.value = 'multiline\ntext';
    expect(getInputValue(textarea)).toBe('multiline\ntext');
  });

  it('should return textContent from contenteditable element', () => {
    const div = document.createElement('div');
    div.setAttribute('contenteditable', 'true');
    div.textContent = 'editable content';
    expect(getInputValue(div)).toBe('editable content');
  });

  it('should return empty string for unknown element', () => {
    const div = document.createElement('div');
    expect(getInputValue(div)).toBe('');
  });

  it('should return empty string for empty input', () => {
    const input = document.createElement('input');
    expect(getInputValue(input)).toBe('');
  });

  it('should return empty string for contenteditable with no text', () => {
    const div = document.createElement('div');
    div.setAttribute('contenteditable', 'true');
    expect(getInputValue(div)).toBe('');
  });
});

describe('getCaretPosition', () => {
  let input: HTMLInputElement;

  beforeEach(() => {
    input = document.createElement('input');
    input.value = 'Hello World';
    document.body.appendChild(input);
  });

  afterEach(() => {
    document.body.removeChild(input);
  });

  it('should return caret position from input element', () => {
    input.focus();
    input.setSelectionRange(6, 6);
    expect(getCaretPosition(input)).toBe(6);
  });

  it('should return caret position from textarea element', () => {
    const textarea = document.createElement('textarea');
    textarea.value = 'Hello World';
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.setSelectionRange(3, 3);
    expect(getCaretPosition(textarea)).toBe(3);
    document.body.removeChild(textarea);
  });

  it('should return 0 when input is not focused', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (input as any).selectionStart = null;
    expect(getCaretPosition(input)).toBe(0);
  });

  it('should return caret position from contenteditable', () => {
    const div = document.createElement('div');
    div.setAttribute('contenteditable', 'true');
    div.textContent = 'Hello World';
    document.body.appendChild(div);

    const sel = window.getSelection()!;
    const range = document.createRange();
    range.setStart(div.firstChild!, 5);
    range.collapse(true);
    sel.removeAllRanges();
    sel.addRange(range);

    expect(getCaretPosition(div)).toBe(5);
    document.body.removeChild(div);
  });

  it('should return 0 for contenteditable without selection', () => {
    const div = document.createElement('div');
    div.setAttribute('contenteditable', 'true');
    div.textContent = 'Hello';
    document.body.appendChild(div);

    window.getSelection()?.removeAllRanges();

    expect(getCaretPosition(div)).toBe(0);
    document.body.removeChild(div);
  });
});

describe('getCaretRect', () => {
  it('should return null for contenteditable without selection', () => {
    const div = document.createElement('div');
    div.setAttribute('contenteditable', 'true');
    document.body.appendChild(div);
    expect(getCaretRect(div)).toBeNull();
    document.body.removeChild(div);
  });

  it('should return null for contenteditable selection when getClientRects is unavailable', () => {
    const div = document.createElement('div');
    div.setAttribute('contenteditable', 'true');
    div.textContent = 'Hello World';
    document.body.appendChild(div);

    const sel = window.getSelection()!;
    const range = document.createRange();
    range.setStart(div.firstChild!, 0);
    range.collapse(true);
    sel.removeAllRanges();
    sel.addRange(range);

    expect(getCaretRect(div)).toBeNull();

    document.body.removeChild(div);
  });

  it('should return rect for input element', () => {
    const input = document.createElement('input');
    input.value = 'Hello World';
    document.body.appendChild(input);
    input.focus();
    input.setSelectionRange(5, 5);

    const rect = getCaretRect(input);
    expect(rect).not.toBeNull();

    document.body.removeChild(input);
  });

  it('should return null for unknown element type', () => {
    const div = document.createElement('div');
    expect(getCaretRect(div)).toBeNull();
  });
});

describe('setCaretPosition', () => {
  let input: HTMLInputElement;

  beforeEach(() => {
    input = document.createElement('input');
    input.value = 'Hello World';
    document.body.appendChild(input);
  });

  afterEach(() => {
    document.body.removeChild(input);
  });

  it('should set caret position in input element', () => {
    setCaretPosition(input, 5);
    expect(input.selectionStart).toBe(5);
    expect(input.selectionEnd).toBe(5);
  });

  it('should set caret position in textarea element', () => {
    const textarea = document.createElement('textarea');
    textarea.value = 'Hello World';
    document.body.appendChild(textarea);
    setCaretPosition(textarea, 3);
    expect(textarea.selectionStart).toBe(3);
    expect(textarea.selectionEnd).toBe(3);
    document.body.removeChild(textarea);
  });

  it('should set caret position in contenteditable', () => {
    const div = document.createElement('div');
    div.setAttribute('contenteditable', 'true');
    div.textContent = 'Hello World';
    document.body.appendChild(div);

    setCaretPosition(div, 5);

    const sel = window.getSelection()!;
    expect(sel.rangeCount).toBeGreaterThan(0);
    const range = sel.getRangeAt(0);
    expect(range.startContainer).toBe(div.firstChild);
    expect(range.startOffset).toBe(5);

    document.body.removeChild(div);
  });

  it('should collapse to end when position exceeds content length', () => {
    const div = document.createElement('div');
    div.setAttribute('contenteditable', 'true');
    div.textContent = 'Hi';
    document.body.appendChild(div);

    setCaretPosition(div, 100);

    expect(div.textContent).toBe('Hi');

    document.body.removeChild(div);
  });
});

describe('setSelection', () => {
  it('should set selection range in input element', () => {
    const input = document.createElement('input');
    input.value = 'Hello World';
    document.body.appendChild(input);

    setSelection(input, 6, 11);

    expect(input.selectionStart).toBe(6);
    expect(input.selectionEnd).toBe(11);
    document.body.removeChild(input);
  });

  it('should set selection range in textarea element', () => {
    const textarea = document.createElement('textarea');
    textarea.value = 'Hello World';
    document.body.appendChild(textarea);

    setSelection(textarea, 0, 5);

    expect(textarea.selectionStart).toBe(0);
    expect(textarea.selectionEnd).toBe(5);
    document.body.removeChild(textarea);
  });

  it('should set selection in contenteditable element', () => {
    const div = document.createElement('div');
    div.setAttribute('contenteditable', 'true');
    div.textContent = 'Hello World';
    document.body.appendChild(div);

    setSelection(div, 6, 10);

    const sel = window.getSelection()!;
    expect(sel.toString()).toBe('Worl');
    document.body.removeChild(div);
  });

  it('should set cursor position when start equals end in contenteditable', () => {
    const div = document.createElement('div');
    div.setAttribute('contenteditable', 'true');
    div.textContent = 'Hello World';
    document.body.appendChild(div);

    setSelection(div, 5, 5);

    const sel = window.getSelection()!;
    expect(sel.isCollapsed).toBe(true);
    expect(sel.getRangeAt(0).startOffset).toBe(5);
    document.body.removeChild(div);
  });

  it('should handle null input gracefully', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(() => setSelection(null as any, 0, 0)).not.toThrow();
  });
});

describe('insertContentWithNewlines', () => {
  let div: HTMLDivElement;

  beforeEach(() => {
    div = document.createElement('div');
    div.setAttribute('contenteditable', 'true');
    document.body.appendChild(div);
  });

  afterEach(() => {
    document.body.removeChild(div);
  });

  it('should insert content at trigger position', () => {
    div.textContent = 'Hello /p World';
    insertContentWithNewlines(div, 'inserted', 6, 2);
    expect(div.textContent).toBe('Hello inserted World');
  });

  it('should handle content with newlines', () => {
    div.textContent = 'Start /p End';
    insertContentWithNewlines(div, 'line1\nline2\nline3', 6, 2);
    expect(div.querySelectorAll('br').length).toBe(2);
    const textNodes = Array.from(div.childNodes).filter(n => n.nodeType === Node.TEXT_NODE);
    expect(textNodes[0].textContent).toBe('Start line1');
    expect(textNodes[1].textContent).toBe('line2');
    expect(textNodes[2].textContent).toBe('line3 End');
  });

  it('should handle empty trigger position at start', () => {
    div.textContent = '';
    insertContentWithNewlines(div, 'new content', 0, 0);
    expect(div.textContent).toBe('new content');
  });

  it('should handle empty new content', () => {
    div.textContent = 'Hello /p World';
    insertContentWithNewlines(div, '', 6, 2);
    expect(div.textContent).toBe('Hello  World');
  });

  it('should position cursor at end of inserted content', () => {
    div.textContent = '/p World';
    insertContentWithNewlines(div, 'Hello', 0, 2);

    const sel = window.getSelection()!;
    const range = sel.getRangeAt(0);
    const expectedEnd = 5;
    let actualPos = 0;
    let charCount = 0;
    for (const node of Array.from(div.childNodes)) {
      if (node.nodeType === Node.TEXT_NODE) {
        if (node === range.startContainer) {
          actualPos = charCount + range.startOffset;
          break;
        }
        charCount += node.textContent!.length;
      } else if (node.nodeName === 'BR') {
        charCount += 1;
      }
    }
    expect(actualPos).toBe(expectedEnd);
    expect(div.textContent).toBe('Hello World');
  });

  it('should handle multiline content with existing text after trigger', () => {
    div.textContent = 'Before /p After';
    insertContentWithNewlines(div, 'line1\nline2', 7, 2);
    const textNodes = Array.from(div.childNodes).filter(n => n.nodeType === Node.TEXT_NODE);
    expect(textNodes[0].textContent).toBe('Before line1');
    expect(textNodes[1].textContent).toBe('line2 After');
  });

  it('should preserve text before trigger', () => {
    div.textContent = 'prefix/p';
    insertContentWithNewlines(div, 'OK', 6, 2);
    expect(div.textContent).toBe('prefixOK');
  });
});
