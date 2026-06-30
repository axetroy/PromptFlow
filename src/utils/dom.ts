/**
 * Escape HTML special characters in a string
 */
export function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Get the current text value from an input, textarea, or contenteditable element
 */
export function getInputValue(input: HTMLInputElement | HTMLTextAreaElement | Element): string {
  if (input instanceof HTMLInputElement || input instanceof HTMLTextAreaElement) {
    return input.value || '';
  }
  if (input.hasAttribute('contenteditable')) {
    return input.textContent || '';
  }
  return '';
}

/**
 * Get the cursor/caret position within an input, textarea, or contenteditable element
 */
export function getCaretPosition(input: HTMLInputElement | HTMLTextAreaElement | Element): number {
  if (input instanceof HTMLInputElement || input instanceof HTMLTextAreaElement) {
    return input.selectionStart || 0;
  }
  if (input.hasAttribute('contenteditable')) {
    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      const preCaretRange = range.cloneRange();
      preCaretRange.selectNodeContents(input);
      preCaretRange.setEnd(range.endContainer, range.endOffset);
      return preCaretRange.toString().length;
    }
  }
  return 0;
}

/**
 * Get the bounding rectangle of the cursor/caret position.
 * For contenteditable elements uses the selection range; for input/textarea
 * uses a mirror div technique to accurately compute the caret coordinates.
 */
export function getCaretRect(input: HTMLInputElement | HTMLTextAreaElement | Element): DOMRect | null {
  if (input.hasAttribute('contenteditable')) {
    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      if (typeof range.getClientRects === 'function') {
        const rects = range.getClientRects();
        if (rects.length > 0) {
          return rects[rects.length - 1];
        }
      }
      if (typeof range.getBoundingClientRect === 'function') {
        return range.getBoundingClientRect();
      }
      return null;
    }
    return null;
  }

  if (input instanceof HTMLInputElement || input instanceof HTMLTextAreaElement) {
    const inputRect = input.getBoundingClientRect();
    const pos = input.selectionStart || 0;

    const mirror = document.createElement('div');
    const style = getComputedStyle(input);

    const props = [
      'fontFamily', 'fontSize', 'fontWeight', 'fontStyle',
      'letterSpacing', 'lineHeight', 'textTransform',
      'borderWidth', 'borderStyle', 'borderColor',
      'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft',
      'boxSizing', 'wordBreak'
    ];

    props.forEach(prop => {
      mirror.style.setProperty(prop, style.getPropertyValue(
        prop === 'borderWidth' ? 'border-width' :
        prop === 'borderStyle' ? 'border-style' :
        prop === 'borderColor' ? 'border-color' :
        prop === 'boxSizing' ? 'box-sizing' :
        prop === 'wordBreak' ? 'word-break' : prop
      ));
    });

    mirror.style.position = 'absolute';
    mirror.style.top = '-9999px';
    mirror.style.left = '-9999px';
    mirror.style.whiteSpace = 'pre-wrap';
    mirror.style.overflow = 'hidden';
    mirror.style.width = inputRect.width + 'px';

    const textBefore = input.value.substring(0, pos);
    const textAfter = input.value.substring(pos);

    mirror.innerHTML = escapeHtml(textBefore) + '<span id="caret-span">|</span>' + escapeHtml(textAfter);
    document.body.appendChild(mirror);

    const caretSpan = document.getElementById('caret-span');
    let rect: DOMRect | null = null;

    if (caretSpan) {
      rect = caretSpan.getBoundingClientRect();
      rect = new DOMRect(rect.left, rect.top, 0, rect.height);
    }

    document.body.removeChild(mirror);
    return rect;
  }

  return null;
}

/**
 * Set the cursor/caret to a specific character position.
 * For input/textarea elements uses setSelectionRange; for contenteditable
 * traverses text nodes to find the correct DOM offset.
 */
export function setCaretPosition(input: HTMLInputElement | HTMLTextAreaElement | Element, position: number): void {
  if (input instanceof HTMLInputElement || input instanceof HTMLTextAreaElement) {
    input.setSelectionRange(position, position);
    input.focus();
  } else if (input.hasAttribute('contenteditable')) {
    const range = document.createRange();
    const selection = window.getSelection();
    let charCount = 0;
    let found = false;

    function traverseNodes(node: Node): void {
      if (found) return;
      if (node.nodeType === Node.TEXT_NODE) {
        const nextCount = charCount + node.textContent!.length;
        if (position <= nextCount) {
          range.setStart(node, position - charCount);
          range.setEnd(node, position - charCount);
          found = true;
        }
        charCount = nextCount;
      } else {
        for (const child of Array.from(node.childNodes)) {
          traverseNodes(child);
          if (found) break;
        }
      }
    }

    traverseNodes(input);
    if (!found) {
      range.selectNodeContents(input);
      range.collapse(false);
    }
    selection?.removeAllRanges();
    selection?.addRange(range);
  }
}

/**
 * Set a text selection range (start to end) within an input, textarea, or contenteditable element.
 * For contenteditable elements traverses text nodes and handles br tags to find exact offsets.
 */
export function setSelection(input: HTMLInputElement | HTMLTextAreaElement | Element, start: number, end: number): void {
  if (!input) return;

  if (input instanceof HTMLInputElement || input instanceof HTMLTextAreaElement) {
    input.focus();
    input.setSelectionRange(start, end);
  } else if (input.hasAttribute && input.hasAttribute('contenteditable')) {
    const range = document.createRange();
    const selection = window.getSelection();
    let charCount = 0;
    let foundStart = false;
    let foundEnd = false;

    function traverseNodes(node: Node): void {
      if (foundStart && foundEnd) return;
      if (node.nodeType === Node.TEXT_NODE) {
        const nodeLength = node.textContent!.length;
        const nextCount = charCount + nodeLength;
        const offset = start - charCount;

        if (!foundStart && offset >= 0 && offset <= nodeLength) {
          if (offset === nodeLength) {
            // continue to next node
          } else {
            range.setStart(node, offset);
            foundStart = true;
          }
        }

        const endOffset = end - charCount;
        if (foundStart && !foundEnd && endOffset >= 0 && endOffset <= nodeLength) {
          if (endOffset === nodeLength) {
            // continue to next node
          } else {
            range.setEnd(node, endOffset);
            foundEnd = true;
          }
        }

        if (!foundStart && offset > nodeLength) {
          foundStart = true;
          range.setStartAfter(node);
        }
        if (foundStart && !foundEnd && endOffset > nodeLength) {
          foundEnd = true;
          range.setEndBefore(node);
        }

        charCount = nextCount;
      } else {
        if (node.nodeName === 'BR') {
          const nextCount = charCount + 1;
          if (!foundStart && start === nextCount) {
            foundStart = true;
          }
          if (foundStart && !foundEnd && end === nextCount) {
            foundEnd = true;
          }
          charCount = nextCount;
        }

        for (const child of Array.from(node.childNodes)) {
          traverseNodes(child);
          if (foundStart && foundEnd) break;
        }
      }
    }

    traverseNodes(input);

    if (!foundStart || !foundEnd) {
      const allTextNodes: Text[] = [];
      function collectTextNodes(node: Node): void {
        if (node.nodeType === Node.TEXT_NODE) {
          allTextNodes.push(node as Text);
        }
        for (const child of Array.from(node.childNodes)) {
          collectTextNodes(child);
        }
      }
      collectTextNodes(input);

      if (allTextNodes.length > 0) {
        if (!foundStart) {
          range.setStart(allTextNodes[0], 0);
        }
        if (!foundEnd) {
          const lastNode = allTextNodes[allTextNodes.length - 1];
          if (start <= lastNode.textContent!.length) {
            range.setEnd(lastNode, start);
          } else {
            range.setEndAfter(lastNode);
          }
        }
      } else {
        range.selectNodeContents(input);
        range.collapse(false);
      }
    }

    selection?.removeAllRanges();
    selection?.addRange(range);
  }
}

/**
 * Insert content into a contenteditable element, replacing a trigger range
 * with the new content. Handles newlines by inserting <br> elements and
 * positions the cursor at the end of the inserted content.
 */
export function insertContentWithNewlines(
  element: Element,
  newContent: string,
  triggerStartPosition: number,
  triggerLength: number,
): void {
  const currentContent = element.textContent || '';
  const triggerEndPosition = triggerStartPosition + triggerLength;
  const before = currentContent.substring(0, triggerStartPosition);
  const after = currentContent.substring(triggerEndPosition);
  const finalContent = before + newContent + after;
  const finalCursorPosition = triggerStartPosition + newContent.length;

  while (element.firstChild) {
    element.removeChild(element.firstChild);
  }

  const lines = finalContent.split('\n');
  for (let i = 0; i < lines.length; i++) {
    if (i > 0) {
      element.appendChild(document.createElement('br'));
    }
    if (lines[i].length > 0) {
      element.appendChild(document.createTextNode(lines[i]));
    }
  }

  (element as HTMLElement).focus();

  const domPos = findDOMPosition(element, finalCursorPosition);
  if (domPos) {
    setCursorAtPosition(element, domPos);
  }
}

/**
 * Find the DOM node and offset corresponding to a character position in an element's text content.
 * Handles text nodes and <br> elements (counted as one character each).
 */
function findDOMPosition(element: Element, targetCharPos: number): { node: Node; offset: number } | null {
  let charCount = 0;

  for (const node of Array.from(element.childNodes)) {
    if (node.nodeType === Node.TEXT_NODE) {
      const nodeLength = node.textContent!.length;

      if (charCount <= targetCharPos && targetCharPos <= charCount + nodeLength) {
        return { node, offset: targetCharPos - charCount };
      }
      charCount += nodeLength;
    } else if (node.nodeName === 'BR') {
      if (charCount === targetCharPos) {
        const nextTextNode = findNextTextNode(element, node);
        if (nextTextNode) {
          return { node: nextTextNode, offset: 0 };
        }
      }
      charCount += 1;
    }
  }

  const lastTextNode = findLastTextNode(element);
  if (lastTextNode) {
    return { node: lastTextNode, offset: lastTextNode.textContent!.length };
  }

  return null;
}

/**
 * Find the next text sibling after a given node within the same parent element.
 * Returns null if no further text node exists.
 */
function findNextTextNode(element: Element, afterNode: Node): Node | null {
  let foundAfter = false;
  for (const node of Array.from(element.childNodes)) {
    if (foundAfter && node.nodeType === Node.TEXT_NODE) {
      return node;
    }
    if (node === afterNode) {
      foundAfter = true;
    }
  }
  return null;
}

/**
 * Find the last text node child of an element
 */
function findLastTextNode(element: Element): Node | null {
  for (let i = element.childNodes.length - 1; i >= 0; i--) {
    if (element.childNodes[i].nodeType === Node.TEXT_NODE) {
      return element.childNodes[i];
    }
  }
  return null;
}

/**
 * Place the cursor at a specific DOM position (node + offset) within an element.
 * Collapses the selection to a single point at the given position.
 */
function setCursorAtPosition(element: Element, pos: { node: Node; offset: number }): void {
  const selection = window.getSelection();
  if (!selection) return;

  const range = document.createRange();
  range.setStart(pos.node, pos.offset);
  range.collapse(true);

  selection.removeAllRanges();
  selection.addRange(range);
}
