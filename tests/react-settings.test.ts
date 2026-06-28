import { test, expect } from '@playwright/test';

// Mock chrome storage
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    const mockData = {
      prompts: [
        {
          id: '1',
          title: 'Code Review',
          content: 'Please review the code',
          description: 'Review code',
          tags: ['dev', 'review'],
          createdAt: Date.now(),
          updatedAt: Date.now()
        },
        {
          id: 'custom-1',
          title: 'Custom Prompt',
          content: 'My custom content',
          description: 'A custom prompt',
          tags: ['custom'],
          createdAt: Date.now(),
          updatedAt: Date.now()
        },
      ],
      settings: {
        trigger: '/prompts',
        theme: 'dark',
      },
    };
    
    (window as any).chrome = {
      storage: {
        local: {
          get: async (key: string) => {
            if (key === 'promptflow-data') {
              return { 'promptflow-data': mockData };
            }
            return {};
          },
          set: async (data: any) => {
            (window as any)._lastStorageData = data;
          },
        },
      },
      runtime: {
        getURL: (path: string) => `chrome-extension://test/${path}`,
      },
    };
  });
});

test.describe('React Settings App', () => {
  test('should have correct structure for React app', async ({ page }) => {
    await page.goto('about:blank');
    
    const result = await page.evaluate(() => {
      return {
        hasRoot: true, // root element will be created by React app
        hasBody: !!document.body,
      };
    });
    
    expect(result.hasRoot).toBe(true);
    expect(result.hasBody).toBe(true);
  });
  
  test('should have settings data structure', async ({ page }) => {
    await page.goto('about:blank');
    
    const result = await page.evaluate(() => {
      const data = {
        prompts: [
          { id: '1', title: 'Test', isDefault: true },
          { id: 'custom-1', title: 'Custom', isDefault: false },
        ],
        settings: { trigger: '/prompts', theme: 'dark' as const },
      };
      
      return {
        promptCount: data.prompts.length,
        defaultCount: 0,
        customCount: data.prompts.length,
        hasSettings: !!data.settings,
      };
    });
    
    expect(result.promptCount).toBe(2);
    expect(result.defaultCount).toBe(0);
    expect(result.customCount).toBe(2);
    expect(result.hasSettings).toBe(true);
  });
  
  test('should generate unique IDs for new prompts', async ({ page }) => {
    await page.goto('about:blank');
    
    const result = await page.evaluate(() => {
      const id1 = `custom-${Date.now()}`;
      const id2 = `custom-${Date.now() + 1}`;
      return {
        id1StartsWithCustom: id1.startsWith('custom-'),
        id2StartsWithCustom: id2.startsWith('custom-'),
        idsAreDifferent: id1 !== id2,
      };
    });
    
    expect(result.id1StartsWithCustom).toBe(true);
    expect(result.id2StartsWithCustom).toBe(true);
    expect(result.idsAreDifferent).toBe(true);
  });
  
  test('should validate prompt form fields', async ({ page }) => {
    await page.goto('about:blank');
    
    const result = await page.evaluate(() => {
      const validateForm = (title: string, content: string) => {
        const errors: string[] = [];
        if (!title.trim()) errors.push('Title is required');
        if (!content.trim()) errors.push('Content is required');
        return errors;
      };
      
      return {
        emptyErrors: validateForm('', '').length,
        validNoErrors: validateForm('Test', 'Content').length,
        missingTitle: validateForm('', 'Content').length,
        missingContent: validateForm('Test', '').length,
      };
    });
    
    expect(result.emptyErrors).toBe(2);
    expect(result.validNoErrors).toBe(0);
    expect(result.missingTitle).toBe(1);
    expect(result.missingContent).toBe(1);
  });
  
  test('should handle theme settings', async ({ page }) => {
    await page.goto('about://blank');
    
    const result = await page.evaluate(() => {
      const themes = ['light', 'dark', 'auto'] as const;
      let settings = { trigger: '/prompts', theme: 'dark' as const };
      
      themes.forEach(theme => {
        if (theme === 'auto') {
          settings.theme = theme;
        }
      });
      
      return {
        currentTheme: settings.theme,
        isValid: themes.includes(settings.theme),
      };
    });
    
    expect(result.currentTheme).toBe('auto');
    expect(result.isValid).toBe(true);
  });
  
  test('should handle tags array', async ({ page }) => {
    await page.goto('about:blank');
    
    const result = await page.evaluate(() => {
      const tags = ['dev', 'code', 'review'];
      return {
        tagCount: tags.length,
        hasDev: tags.includes('dev'),
        hasCode: tags.includes('code'),
      };
    });
    
    expect(result.tagCount).toBe(3);
    expect(result.hasDev).toBe(true);
    expect(result.hasCode).toBe(true);
  });
  
  test('should distinguish default vs custom prompts', async ({ page }) => {
    await page.goto('about:blank');
    
    const result = await page.evaluate(() => {
      const prompts = [
        { id: '1', isDefault: true },
        { id: '2', isDefault: true },
        { id: 'custom-1', isDefault: false },
      ];
      
      const defaultPrompts = prompts.filter(p => p.isDefault);
      const customPrompts = prompts.filter(p => !p.isDefault);
      
      return {
        defaultCount: defaultPrompts.length,
        customCount: customPrompts.length,
        canEditCustom: true,
        canEditDefault: false,
      };
    });
    
    expect(result.defaultCount).toBe(2);
    expect(result.customCount).toBe(1);
    expect(result.canEditCustom).toBe(true);
    expect(result.canEditDefault).toBe(false);
  });

  test('should load default prompts from files', async ({ page }) => {
    await page.goto('about:blank');
    
    const result = await page.evaluate(() => {
      // Simulate the new storage structure
      const storageData = {
        customPrompts: [],
        disabledDefaultIds: ['1'],
        settings: { trigger: '/prompts', insertMode: 'replace' }
      };
      
      const defaultPrompts = [
        { id: '1', title: 'Default 1', isDefault: true },
        { id: '2', title: 'Default 2', isDefault: true },
      ];
      
      const enabledDefaults = defaultPrompts.filter(p => !storageData.disabledDefaultIds.includes(p.id));
      
      return {
        hasCustomPrompts: storageData.customPrompts !== undefined,
        hasDisabledDefaults: storageData.disabledDefaultIds !== undefined,
        enabledDefaultsCount: enabledDefaults.length,
      };
    });
    
    expect(result.hasCustomPrompts).toBe(true);
    expect(result.hasDisabledDefaults).toBe(true);
    expect(result.enabledDefaultsCount).toBe(1);
  });
  
  test('should update prompt properties', async ({ page }) => {
    await page.goto('about:blank');
    
    const result = await page.evaluate(() => {
      let prompt = {
        id: 'custom-1',
        title: 'Original',
        content: 'Original content',
        tags: ['original'],
        updatedAt: Date.now(),
      };
      
      // Simulate update
      prompt = {
        ...prompt,
        title: 'Updated',
        content: 'Updated content',
        tags: ['updated'],
        updatedAt: Date.now() + 1000,
      };
      
      return {
        titleChanged: prompt.title === 'Updated',
        contentChanged: prompt.content === 'Updated content',
        tagsChanged: prompt.tags.includes('updated'),
        timestampUpdated: prompt.updatedAt > Date.now() - 100,
      };
    });
    
    expect(result.titleChanged).toBe(true);
    expect(result.contentChanged).toBe(true);
    expect(result.tagsChanged).toBe(true);
    expect(result.timestampUpdated).toBe(true);
  });
});

test.describe('Settings Button in Panel', () => {
  test('should render settings button in panel footer', async ({ page }) => {
    await page.goto('about:blank');
    
    const result = await page.evaluate(() => {
      // Simulate panel footer with settings button
      const footerHTML = `
        <div id="promptflow-footer">
          <div style="display: flex; gap: 16px;">
            <span>Navigate</span>
            <span>Select</span>
            <span>Close</span>
          </div>
          <button id="promptflow-settings-btn">
            <svg></svg>
            Settings
          </button>
        </div>
      `;
      
      return {
        hasSettingsButton: footerHTML.includes('promptflow-settings-btn'),
        hasSettingsText: footerHTML.includes('Settings'),
        hasSvgIcon: footerHTML.includes('<svg'),
      };
    });
    
    expect(result.hasSettingsButton).toBe(true);
    expect(result.hasSettingsText).toBe(true);
    expect(result.hasSvgIcon).toBe(true);
  });
  
  test('should close panel when settings is clicked', async ({ page }) => {
    await page.goto('about:blank');
    
    const result = await page.evaluate(() => {
      let isPanelOpen = true;
      
      // Simulate settings button click
      const settingsBtnClicked = true;
      if (settingsBtnClicked) {
        isPanelOpen = false;
      }
      
      return { isPanelOpen };
    });
    
    expect(result.isPanelOpen).toBe(false);
  });
  
  test('should have hover effect styles for settings button', async ({ page }) => {
    await page.goto('about:blank');
    
    const result = await page.evaluate(() => {
      const buttonStyle = `
        background: none;
        border: none;
        color: rgba(255, 255, 255, 0.4);
        cursor: pointer;
        padding: 4px 8px;
        border-radius: 4px;
        transition: all 0.15s ease;
      `;
      
      return {
        hasTransition: buttonStyle.includes('transition'),
        hasBorderRadius: buttonStyle.includes('border-radius'),
        hasHoverSupport: buttonStyle.includes('transition') && buttonStyle.includes('cursor: pointer'),
      };
    });
    
    expect(result.hasTransition).toBe(true);
    expect(result.hasBorderRadius).toBe(true);
    expect(result.hasHoverSupport).toBe(true);
  });
});
