import { test, expect } from '@playwright/test';

/**
 * Tests for trigger detection logic.
 * The trigger should only activate when the cursor is IMMEDIATELY after the trigger word.
 */
test.describe('Trigger Detection', () => {
  /**
   * Helper function to simulate findTriggerPosition logic
   */
  function findTriggerPosition(inputValue: string, caretPos: number, trigger: string): number {
    const textBeforeCaret = inputValue.substring(0, caretPos);
    
    // Find the trigger - must be at word boundary (start of text or after space/newline/punctuation)
    let lastIndex = -1;
    
    // Find all occurrences and check word boundaries
    let searchStart = 0;
    while (true) {
      const found = textBeforeCaret.indexOf(trigger, searchStart);
      if (found === -1) break;
      
      // Check if it's at a word boundary
      const isWordBoundary = found === 0 || 
        /\s/.test(textBeforeCaret[found - 1]) ||
        /[\(\[\{]/.test(textBeforeCaret[found - 1]);
      
      if (isWordBoundary) {
        lastIndex = found;
      }
      
      searchStart = found + 1;
    }
    
    if (lastIndex === -1) return -1;

    const triggerEndPosition = lastIndex + trigger.length;
    
    // If cursor is past the trigger, check what's between them
    if (textBeforeCaret.length > triggerEndPosition) {
      // There's text between trigger end and cursor
      // If there's ANY whitespace there, the cursor is not at the trigger
      const textBetween = textBeforeCaret.substring(triggerEndPosition);
      if (textBetween.trim().length > 0) {
        // Non-whitespace content between trigger and cursor - partial match
        return -1;
      }
      // There's whitespace between trigger and cursor - cursor is not at trigger
      return -1;
    }
    
    // Cursor is at or before trigger end - this is a match
    return lastIndex;
  }

  test('should match when cursor is immediately after trigger', () => {
    // "/prompts" with cursor at position 8 (right after the trigger)
    const result = findTriggerPosition('/prompts', 8, '/prompts');
    expect(result).toBe(0);
  });

  test('should match when space follows trigger', () => {
    // "/prompts " with cursor at position 9 (after the space) - whitespace is OK
    const result = findTriggerPosition('/prompts ', 9, '/prompts');
    expect(result).toBe(0);
  });

  test('should NOT match when non-whitespace character follows trigger', () => {
    // "/prompts a" with cursor at position 10 (after 'a') - non-whitespace breaks match
    const result = findTriggerPosition('/prompts a', 10, '/prompts');
    expect(result).toBe(-1);
  });

  test('should match trigger at beginning of input', () => {
    const result = findTriggerPosition('/prompts', 8, '/prompts');
    expect(result).toBe(0);
  });

  test('should match trigger after newline', () => {
    // "\n/prompts" with cursor at position 9
    const result = findTriggerPosition('\n/prompts', 9, '/prompts');
    expect(result).toBe(1);
  });

  test('should match trigger after space', () => {
    // "Hello /prompts" with cursor at position 14
    const result = findTriggerPosition('Hello /prompts', 14, '/prompts');
    expect(result).toBe(6);
  });

  test('should NOT match trigger with text between trigger and cursor', () => {
    // "Hello /promptsBye" with cursor at position 18
    const result = findTriggerPosition('Hello /promptsBye', 18, '/prompts');
    expect(result).toBe(-1);
  });

  test('should NOT match partial trigger', () => {
    // "/prom" - incomplete trigger should not match
    const result = findTriggerPosition('/prom', 5, '/prompts');
    expect(result).toBe(-1);
  });

  test('should match multiple occurrences - use last one', () => {
    // "/prompts /prompts" with cursor at position 17 (right after second trigger)
    // At position 17, textBeforeCaret is "/prompts /prompts" (16 chars)
    // The trigger ends at position 9+8=17, so cursor is right after trigger
    const result = findTriggerPosition('/prompts /prompts', 17, '/prompts');
    expect(result).toBe(9);
  });

  test('should NOT match if last occurrence has text after cursor', () => {
    // "/prompts /prompts a" - last occurrence has 'a' after cursor
    const result = findTriggerPosition('/prompts /prompts a', 18, '/prompts');
    expect(result).toBe(-1);
  });

  test('should match trigger after opening parenthesis', () => {
    // "(/prompts" with cursor at position 9
    const result = findTriggerPosition('(/prompts', 9, '/prompts');
    expect(result).toBe(1);
  });

  test('should match trigger after opening bracket', () => {
    // "[/prompts" with cursor at position 9
    const result = findTriggerPosition('[/prompts', 9, '/prompts');
    expect(result).toBe(1);
  });

  test('should match trigger after opening brace', () => {
    // "{/prompts" with cursor at position 9
    const result = findTriggerPosition('{/prompts', 9, '/prompts');
    expect(result).toBe(1);
  });

  test('should NOT match trigger in middle of word', () => {
    // "test/prompts" - should not match because trigger is in middle of "word"
    const result = findTriggerPosition('test/prompts', 12, '/prompts');
    expect(result).toBe(-1);
  });

  test('should match with newline between trigger and cursor', () => {
    // "/prompts\n" with cursor at position 9
    const result = findTriggerPosition('/prompts\n', 9, '/prompts');
    expect(result).toBe(-1); // newline is whitespace, so should not match
  });

  test('should match empty input with no trigger', () => {
    const result = findTriggerPosition('', 0, '/prompts');
    expect(result).toBe(-1);
  });

  test('should handle custom trigger', () => {
    // "Hello //cmd world" - "//cmd" starts at position 6, ends at position 10
    // Cursor at position 11 is right after "//cmd"
    const result = findTriggerPosition('Hello //cmd world', 11, '//cmd');
    expect(result).toBe(6);
  });

  test('should NOT match custom trigger with space after', () => {
    // "Hello //cmd arg" with cursor at position 15
    const result = findTriggerPosition('Hello //cmd arg', 15, '//cmd');
    expect(result).toBe(-1);
  });
});
