import { test, expect } from '@playwright/test';

/**
 * Tests for Prompt Insertion Behavior
 * 
 * Based on design.md section 2.2 "插入行为":
 * 1. User inputs '/prompts' to trigger panel, system records:
 *    a. cursor position
 *    b. input content
 *    c. trigger position
 * 2. User selects Prompt, popup variable fill interface (if variables exist)
 *    2.1 If user cancels, refocus input and restore cursor position
 * 3. User confirms insertion, system inserts Prompt content at cursor position
 *    and deletes trigger '/prompts'
 *    3.1 If user cancels, refocus input and restore cursor position
 * 
 * Design principle: "插入提示词不破坏上下文，不改变光标位置"
 */

test.describe('Prompt Insertion Behavior', () => {
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
      // Check if there's non-whitespace content between trigger end and cursor
      // Whitespace is allowed (e.g., "/prompts " is valid)
      const textBetween = textBeforeCaret.substring(triggerEndPosition);
      if (textBetween.trim().length > 0) {
        // Non-whitespace content directly after trigger - partial match
        return -1;
      }
      // Only whitespace between trigger and cursor - this is valid
    }
    
    // Cursor is at or before trigger end, or has only whitespace after it - this is a match
    return lastIndex;
  }

  /**
   * Helper function to simulate insertion logic
   * Returns { newValue, cursorPosition } for the insertion result
   * 
   * The insertion logic:
   * 1. Replace trigger (from triggerStartPosition to triggerStartPosition + trigger.length)
   * 2. Insert promptContent at triggerStartPosition
   * 3. Preserve all text before trigger and all text after triggerEndPosition
   */
  function simulateInsert(
    inputValue: string,
    triggerStartPosition: number,
    caretPosition: number,
    trigger: string,
    promptContent: string
  ): { newValue: string; cursorPosition: number; deletedTrigger: string } {
    // The trigger should span from triggerStartPosition to triggerStartPosition + trigger.length
    const triggerEndPosition = triggerStartPosition + trigger.length;
    
    // Build the new value by:
    // 1. Taking text before trigger
    // 2. Inserting prompt content
    // 3. Taking text after trigger (not after caret)
    const before = inputValue.substring(0, triggerStartPosition);
    const after = inputValue.substring(triggerEndPosition);
    const newValue = before + promptContent + after;
    
    // Cursor should be at the end of inserted prompt content
    const cursorPosition = triggerStartPosition + promptContent.length;
    
    return {
      newValue,
      cursorPosition,
      deletedTrigger: inputValue.substring(triggerStartPosition, triggerEndPosition)
    };
  }

  test.describe('Scenario 1: Basic Insertion', () => {
    test('should trigger panel when cursor is right after /prompts', () => {
      // Input: "/prompts" with cursor at position 8
      const input = '/prompts';
      const caretPos = 8;
      
      const triggerPos = findTriggerPosition(input, caretPos, '/prompts');
      
      expect(triggerPos).toBe(0);
    });

    test('should insert prompt and delete trigger', () => {
      // Input: "/prompts" (trigger at 0, caret at 8)
      const input = '/prompts';
      const triggerPos = 0;
      const caretPos = 8;
      const trigger = '/prompts';
      const promptContent = 'You are a helpful assistant.';
      
      const result = simulateInsert(input, triggerPos, caretPos, trigger, promptContent);
      
      // Trigger should be deleted
      expect(result.deletedTrigger).toBe('/prompts');
      // New value should have prompt instead of trigger
      expect(result.newValue).toBe('You are a helpful assistant.');
      // Cursor should be at end of prompt
      expect(result.cursorPosition).toBe(promptContent.length);
    });

    test('should preserve context after insertion', () => {
      // Input: "Hello /prompts" with cursor at position 14
      const input = 'Hello /prompts';
      const triggerPos = 6;
      const caretPos = 14;
      const trigger = '/prompts';
      const promptContent = 'You are a helpful assistant.';
      
      const result = simulateInsert(input, triggerPos, caretPos, trigger, promptContent);
      
      // Should be: "Hello " + promptContent = "Hello You are a helpful assistant."
      expect(result.newValue).toBe('Hello You are a helpful assistant.');
      // Cursor should be at position after "Hello " (6) + prompt length
      expect(result.cursorPosition).toBe(6 + promptContent.length);
    });
  });

  test.describe('Scenario 2: Insertion with Context After', () => {
    test('should preserve text after trigger', () => {
      // Input: "/prompts world" with cursor at position 9 (after space)
      const input = '/prompts world';
      const triggerPos = 0;
      // caretPos is 9 because there's a space after trigger
      const caretPos = 9; // After "/prompts "
      const trigger = '/prompts';
      const promptContent = 'You are a helpful assistant.';
      
      const result = simulateInsert(input, triggerPos, caretPos, trigger, promptContent);
      
      // Result should be: promptContent + " world"
      expect(result.newValue).toBe('You are a helpful assistant. world');
      expect(result.cursorPosition).toBe(promptContent.length);
    });

    test('should preserve text before and after trigger', () => {
      // Input: "Hello /prompts world" with cursor at position 14
      const input = 'Hello /prompts world';
      const triggerPos = 6;
      const caretPos = 14; // After "/prompts "
      const trigger = '/prompts';
      const promptContent = 'You are a helpful assistant.';
      
      const result = simulateInsert(input, triggerPos, caretPos, trigger, promptContent);
      
      // Result should be: "Hello " + promptContent + " world"
      expect(result.newValue).toBe('Hello You are a helpful assistant. world');
      expect(result.cursorPosition).toBe(6 + promptContent.length);
    });
  });

  test.describe('Scenario 3: Multiline Context', () => {
    test('should preserve newline after trigger', () => {
      // Input: "/prompts\n" with cursor at position 9
      const input = '/prompts\n';
      const triggerPos = 0;
      const caretPos = 9;
      const trigger = '/prompts';
      const promptContent = 'You are a helpful assistant.';
      
      const result = simulateInsert(input, triggerPos, caretPos, trigger, promptContent);
      
      expect(result.newValue).toBe('You are a helpful assistant.\n');
      expect(result.cursorPosition).toBe(promptContent.length);
    });

    test('should preserve multiline context', () => {
      // Input: "line1\n/prompts\nline3" with cursor at position 14
      const input = 'line1\n/prompts\nline3';
      const triggerPos = 6;
      const caretPos = 14;
      const trigger = '/prompts';
      const promptContent = 'You are a helpful assistant.';
      
      const result = simulateInsert(input, triggerPos, caretPos, trigger, promptContent);
      
      expect(result.newValue).toBe('line1\nYou are a helpful assistant.\nline3');
      expect(result.cursorPosition).toBe(6 + promptContent.length);
    });
  });

  test.describe('Scenario 4: Multiple Triggers', () => {
    test('should use last trigger when multiple exist', () => {
      // Input: "/prompts /prompts" with cursor at position 17
      const input = '/prompts /prompts';
      const caretPos = 17;
      
      const triggerPos = findTriggerPosition(input, caretPos, '/prompts');
      
      // Should find the second trigger at position 9
      expect(triggerPos).toBe(9);
    });

    test('should insert at last trigger position', () => {
      // Input: "/prompts /prompts" - insert at second trigger
      const input = '/prompts /prompts';
      const triggerPos = 9; // Second trigger
      const caretPos = 17;
      const trigger = '/prompts';
      const promptContent = 'You are a helpful assistant.';
      
      const result = simulateInsert(input, triggerPos, caretPos, trigger, promptContent);
      
      // First trigger should remain, second should be replaced
      expect(result.newValue).toBe('/prompts You are a helpful assistant.');
    });
  });

  test.describe('Scenario 5: Trigger at Word Boundaries', () => {
    test('should match after opening parenthesis', () => {
      const input = '(/prompts';
      const caretPos = 9;
      
      const triggerPos = findTriggerPosition(input, caretPos, '/prompts');
      
      expect(triggerPos).toBe(1);
    });

    test('should match after opening bracket', () => {
      const input = '[/prompts';
      const caretPos = 9;
      
      const triggerPos = findTriggerPosition(input, caretPos, '/prompts');
      
      expect(triggerPos).toBe(1);
    });

    test('should match after opening brace', () => {
      const input = '{/prompts';
      const caretPos = 9;
      
      const triggerPos = findTriggerPosition(input, caretPos, '/prompts');
      
      expect(triggerPos).toBe(1);
    });

    test('should NOT match trigger in middle of word', () => {
      const input = 'test/prompts';
      const caretPos = 12;
      
      const triggerPos = findTriggerPosition(input, caretPos, '/prompts');
      
      expect(triggerPos).toBe(-1);
    });
  });

  test.describe('Scenario 6: Custom Trigger', () => {
    test('should support custom trigger like //cmd', () => {
      const input = 'Hello //cmd';
      const caretPos = 11;
      
      const triggerPos = findTriggerPosition(input, caretPos, '//cmd');
      
      expect(triggerPos).toBe(6);
    });

    test('should insert with custom trigger', () => {
      const input = 'Hello //cmd';
      const triggerPos = 6;
      const caretPos = 11;
      const trigger = '//cmd';
      const promptContent = 'Run this command';
      
      const result = simulateInsert(input, triggerPos, caretPos, trigger, promptContent);
      
      expect(result.newValue).toBe('Hello Run this command');
      expect(result.cursorPosition).toBe(6 + promptContent.length);
    });
  });

  test.describe('Edge Cases', () => {
    test('should handle empty input', () => {
      const input = '';
      const caretPos = 0;
      
      const triggerPos = findTriggerPosition(input, caretPos, '/prompts');
      
      expect(triggerPos).toBe(-1);
    });

    test('should NOT match partial trigger', () => {
      const input = '/prom';
      const caretPos = 5;
      
      const triggerPos = findTriggerPosition(input, caretPos, '/prompts');
      
      expect(triggerPos).toBe(-1);
    });

    test('should NOT match when non-whitespace follows trigger', () => {
      // "/promptsX" - 'X' directly after trigger
      const input = '/promptsX';
      const caretPos = 9;
      
      const triggerPos = findTriggerPosition(input, caretPos, '/prompts');
      
      expect(triggerPos).toBe(-1);
    });

    test('should insert correctly at beginning of input', () => {
      const input = '/prompts';
      const triggerPos = 0;
      const caretPos = 8;
      const trigger = '/prompts';
      const promptContent = 'You are a helpful assistant.';
      
      const result = simulateInsert(input, triggerPos, caretPos, trigger, promptContent);
      
      expect(result.newValue).toBe('You are a helpful assistant.');
      expect(result.cursorPosition).toBe(0 + promptContent.length);
    });
  });

  test.describe('Design Principle: Context Preservation', () => {
    test('should not break context - before text preserved', () => {
      const beforeContext = 'Hello, how are you? ';
      const input = beforeContext + '/prompts';
      const triggerPos = beforeContext.length;
      const caretPos = triggerPos + 8;
      const trigger = '/prompts';
      const promptContent = 'I am fine, thank you!';
      
      const result = simulateInsert(input, triggerPos, caretPos, trigger, promptContent);
      
      expect(result.newValue).toBe(beforeContext + promptContent);
      expect(result.newValue.startsWith(beforeContext)).toBe(true);
    });

    test('should not break context - after text preserved', () => {
      const afterContext = ' Let\'s chat!';
      const input = '/prompts' + afterContext;
      const triggerPos = 0;
      const caretPos = 8;
      const trigger = '/prompts';
      const promptContent = 'Hello!';
      
      const result = simulateInsert(input, triggerPos, caretPos, trigger, promptContent);
      
      expect(result.newValue).toBe(promptContent + afterContext);
      expect(result.newValue.endsWith(afterContext)).toBe(true);
    });

    test('should place cursor at end of inserted content', () => {
      // Design principle: cursor should be at end of inserted content
      const beforeContext = 'Hello ';
      const afterContext = ' world';
      const input = beforeContext + '/prompts' + afterContext;
      const triggerPos = beforeContext.length;
      const caretPos = triggerPos + 8;
      const trigger = '/prompts';
      const promptContent = 'beautiful';
      
      const result = simulateInsert(input, triggerPos, caretPos, trigger, promptContent);
      
      // Cursor should be exactly after the inserted prompt content
      const expectedCursorPos = triggerPos + promptContent.length;
      expect(result.cursorPosition).toBe(expectedCursorPos);
    });
  });
});
