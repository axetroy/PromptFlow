/**
 * PromptPanel - React Component for Prompt Selection
 * 
 * Features:
 * - Search filtering by title, description, and tags
 * - Keyboard navigation (Arrow keys, Enter to select)
 * - Recent prompts section
 * - Light/dark mode support
 */

import React, { useState, useEffect, useRef, useCallback, useMemo, createElement } from 'react';
import { createRoot, Root } from 'react-dom/client';
import type { Prompt } from '../../types';

const PANEL_WIDTH = 620;
const PANEL_MAX_HEIGHT = 520;

interface PromptPanelProps {
  prompts: Prompt[];
  recentPromptIds: string[];
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onPromptSelect: (prompt: Prompt) => void;
  onClose: () => void;
  onOpenSettings: () => void;
}

function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function highlightText(text: string, query: string): React.ReactNode {
  if (!query) return escapeHtml(text);
  
  const escapedText = escapeHtml(text);
  const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`(${escapedQuery})`, 'gi');
  const parts = escapedText.split(regex);
  
  return parts.map((part, index) => {
    if (part.toLowerCase() === query.toLowerCase()) {
      return <mark key={index}>{part}</mark>;
    }
    return <span key={index}>{part}</span>;
  });
}

function PromptItem({
  prompt,
  isSelected,
  isHovered,
  searchQuery,
  onClick,
  onMouseEnter,
  onMouseLeave
}: {
  prompt: Prompt;
  isSelected: boolean;
  isHovered: boolean;
  searchQuery: string;
  onClick: () => void;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
}) {
  const itemRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    if (isSelected && itemRef.current) {
      itemRef.current.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }, [isSelected]);
  
  const className = [
    'prompt-item',
    isSelected ? 'selected' : '',
    isHovered ? 'hovered' : ''
  ].filter(Boolean).join(' ');
  
  return (
    <div
      ref={itemRef}
      className={className}
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      <div className="prompt-item-title">
        {highlightText(prompt.title, searchQuery)}
      </div>
      {prompt.description && (
        <div className="prompt-item-description">
          {highlightText(prompt.description, searchQuery)}
        </div>
      )}
      {prompt.tags.length > 0 && (
        <div className="prompt-item-tags">
          {prompt.tags.map((tag, index) => (
            <span key={index} className="prompt-tag">{tag}</span>
          ))}
        </div>
      )}
    </div>
  );
}

function usePanelPosition() {
  // Calculate only maxHeight since position is handled by host element
  const calculateMaxHeight = useCallback(() => {
    const viewportHeight = window.innerHeight;
    const topPadding = viewportHeight * 0.05;
    const availableHeight = viewportHeight - topPadding - 20;
    return Math.min(Math.max(200, availableHeight), PANEL_MAX_HEIGHT);
  }, []);

  const [maxHeight, setMaxHeight] = useState(calculateMaxHeight);
  
  useEffect(() => {
    // Debounce function
    let timeoutId: ReturnType<typeof setTimeout>;
    const debouncedCalculate = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        setMaxHeight(calculateMaxHeight());
      }, 50);
    };
    
    document.addEventListener('scroll', debouncedCalculate, true);
    window.addEventListener('resize', debouncedCalculate);
    
    return () => {
      document.removeEventListener('scroll', debouncedCalculate, true);
      window.removeEventListener('resize', debouncedCalculate);
    };
  }, [calculateMaxHeight]);
  
  return { maxHeight };
}

export function PromptPanel({
  prompts,
  recentPromptIds,
  searchQuery,
  onSearchChange,
  onPromptSelect,
  onClose,
  onOpenSettings,
}: PromptPanelProps) {
  const [localSearch, setLocalSearch] = useState(searchQuery);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [isDark, setIsDark] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  
  // Detect dark mode
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    setIsDark(mediaQuery.matches);
    
    const handler = (e: MediaQueryListEvent) => setIsDark(e.matches);
    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, []);
  
  const { maxHeight } = usePanelPosition();
  
  // Filter prompts based on search query
  const filteredPrompts = useMemo(() => {
    if (!localSearch) return prompts;
    const query = localSearch.toLowerCase();
    return prompts.filter(p => 
      p.title.toLowerCase().includes(query) ||
      (p.description && p.description.toLowerCase().includes(query)) ||
      p.tags.some(t => t.toLowerCase().includes(query))
    );
  }, [prompts, localSearch]);
  
  // Recent prompts section
  const showRecentSection = !localSearch && recentPromptIds.length > 0;
  const recentPrompts = useMemo(() => {
    if (!showRecentSection) return [];
    const promptMap = new Map(prompts.map(p => [p.id, p]));
    return recentPromptIds
      .slice(0, 5)
      .map(id => promptMap.get(id))
      .filter((p): p is Prompt => p !== undefined);
  }, [showRecentSection, recentPromptIds, prompts]);
  
  // Recent section items count
  const recentCount = showRecentSection ? recentPrompts.length : 0;
  
  // Handle keyboard navigation within the panel
  useEffect(() => {
    const panel = panelRef.current;
    if (!panel) return;

    const handlePanelKeyDown = (e: KeyboardEvent) => {
      const list = listRef.current;
      if (!list) return;
      const items = Array.from(list.querySelectorAll('.prompt-item'));

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        e.stopPropagation();
        setSelectedIndex(prev => {
          const next = Math.min(prev + 1, items.length - 1);
          items[next]?.scrollIntoView({ block: 'nearest' });
          return next;
        });
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        e.stopPropagation();
        setSelectedIndex(prev => {
          const next = Math.max(prev - 1, 0);
          items[next]?.scrollIntoView({ block: 'nearest' });
          return next;
        });
      } else if (e.key === 'Enter') {
        const item = items[selectedIndex] as HTMLElement | undefined;
        if (item) {
          e.preventDefault();
          e.stopPropagation();
          item.click();
        }
      }
    };

    panel.addEventListener('keydown', handlePanelKeyDown);
    return () => panel.removeEventListener('keydown', handlePanelKeyDown);
  }, [selectedIndex]);

  // Handle search input change
  const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setLocalSearch(value);
    setSelectedIndex(0);
    onSearchChange(value);
  }, [onSearchChange]);
  
  // Focus search input on mount
  useEffect(() => {
    searchInputRef.current?.focus();
  }, []);
  
  // Handle settings click
  const handleSettingsClick = useCallback(() => {
    onClose();
    onOpenSettings();
  }, [onClose, onOpenSettings]);
  
  // Render prompt item
  const renderPromptItem = (prompt: Prompt, index: number, actualIndex: number) => (
    <PromptItem
      key={prompt.id}
      prompt={prompt}
      isSelected={selectedIndex === actualIndex}
      isHovered={hoveredIndex === actualIndex}
      searchQuery={localSearch}
      onClick={() => onPromptSelect(prompt)}
      onMouseEnter={() => setHoveredIndex(actualIndex)}
      onMouseLeave={() => setHoveredIndex(null)}
    />
  );
  
  return (
    <div
      ref={panelRef}
      id="promptflow-panel"
      className={isDark ? 'dark' : ''}
      style={{ 
        maxHeight: maxHeight 
      }}
      onClick={e => e.stopPropagation()}
      tabIndex={-1}
    >
      {/* Search Input */}
      <div className="search-wrapper">
        <input
          ref={searchInputRef}
          id="promptflow-search"
          type="text"
          placeholder="Search prompts..."
          value={localSearch}
          onChange={handleSearchChange}
        />
      </div>
      
      {/* Prompt List */}
      <div ref={listRef} id="promptflow-list">
        {/* Recent Section */}
        {showRecentSection && recentPrompts.length > 0 && (
          <>
            <div className="section-header">Recent</div>
            {recentPrompts.map((prompt, index) => renderPromptItem(prompt, index, index))}
            <div className="section-header">All Prompts</div>
          </>
        )}
        
        {/* All Prompts */}
        {filteredPrompts.length > 0 ? (
          filteredPrompts.map((prompt, index) => {
            const actualIndex = showRecentSection ? recentCount + index : index;
            return renderPromptItem(prompt, index, actualIndex);
          })
        ) : (
          !showRecentSection && (
            <div className="empty-state">
              {localSearch ? 'No prompts found' : 'No prompts available'}
            </div>
          )
        )}
      </div>
      
      {/* Footer */}
      <div id="promptflow-footer">
        <div className="footer-hint">
          <span className="footer-key">↑↓</span> Navigate
          <span className="footer-key">Enter</span> Select
          <span className="footer-key">Esc</span> Close
        </div>
        <button id="promptflow-settings-btn" onClick={handleSettingsClick}>
          <svg viewBox="64 64 896 896" focusable="false" width="1em" height="1em" fill="currentColor">
            <path d="M924.8 625.7l-65.5-56c3.1-19 4.7-38.4 4.7-57.8s-1.6-38.8-4.7-57.8l65.5-56a32.03 32.03 0 009.3-35.2l-.9-2.6a443.74 443.74 0 00-79.7-137.9l-1.8-2.1a32.12 32.12 0 00-35.1-9.5l-81.3 28.9c-30-24.6-63.5-44-99.7-57.6l-15.7-85a32.05 32.05 0 00-25.8-25.7l-2.7-.5c-52.1-9.4-106.9-9.4-159 0l-2.7.5a32.05 32.05 0 00-25.8 25.7l-15.8 85.4a351.86 351.86 0 00-99 57.4l-81.9-29.1a32 32 0 00-35.1 9.5l-1.8 2.1a446.02 446.02 0 00-79.7 137.9l-.9 2.6c-4.5 12.5-.8 26.5 9.3 35.2l66.3 56.6c-3.1 18.8-4.6 38-4.6 57.1 0 19.2 1.5 38.4 4.6 57.1L99 625.5a32.03 32.03 0 00-9.3 35.2l.9 2.6c18.1 50.4 44.9 96.9 79.7 137.9l1.8 2.1a32.12 32.12 0 0035.1 9.5l81.9-29.1c29.8 24.5 63.1 43.9 99 57.4l15.8 85.4a32.05 32.05 0 0025.8 25.7l2.7.5a449.4 449.4 0 00159 0l2.7-.5a32.05 32.05 0 0025.8-25.7l15.7-85a350 350 0 0099.7-57.6l81.3 28.9a32 32 0 0035.1-9.5l1.8-2.1c34.8-41.1 61.6-87.5 79.7-137.9l.9-2.6c4.5-12.3.8-26.3-9.3-35zM788.3 465.9c2.5 15.1 3.8 30.6 3.8 46.1s-1.3 31-3.8 46.1l-6.6 40.1 74.7 63.9a370.03 370.03 0 01-42.6 73.6L721 702.8l-31.4 25.8c-23.9 19.6-50.5 35-79.3 45.8l-38.1 14.3-17.9 97a377.5 377.5 0 01-85 0l-17.9-97.2-37.8-14.5c-28.5-10.8-55-26.2-78.7-45.7l-31.4-25.9-93.4 33.2c-17-22.9-31.2-47.6-42.6-73.6l75.5-64.5-6.5-40c-2.4-14.9-3.7-30.3-3.7-45.5 0-15.3 1.2-30.6 3.7-45.5l6.5-40-75.5-64.5c11.3-26.1 25.6-50.7 42.6-73.6l93.4 33.2 31.4-25.9c23.7-19.5 50.2-34.9 78.7-45.7l37.9-14.3 17.9-97.2c28.1-3.2 56.8-3.2 85 0l17.9 97 38.1 14.3c28.7 10.8 55.4 26.2 79.3 45.8l31.4 25.8 92.8-32.9c17 22.9 31.2 47.6 42.6 73.6L781.8 426l6.5 39.9zM512 326c-97.2 0-176 78.8-176 176s78.8 176 176 176 176-78.8 176-176-78.8-176-176-176zm79.2 255.2A111.6 111.6 0 01512 614c-29.9 0-58-11.7-79.2-32.8A111.6 111.6 0 01400 502c0-29.9 11.7-58 32.8-79.2C454 401.6 482.1 390 512 390c29.9 0 58 11.6 79.2 32.8A111.6 111.6 0 01624 502c0 29.9-11.7 58-32.8 79.2z"></path>
          </svg>
          Settings
        </button>
      </div>
    </div>
  );
}

// Global references for cleanup
let reactRoot: Root | null = null;
let hostElement: HTMLElement | null = null;

export interface PromptPanelOptions {
  prompts: Prompt[];
  recentPromptIds: string[];
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onPromptSelect: (prompt: Prompt) => void;
  onClose: () => void;
  onOpenSettings: () => void;
}

/**
 * Create and mount the PromptPanel to the page using Shadow DOM
 */
export function showPromptPanel(options: PromptPanelOptions): void {
  // Calculate initial position
  const viewportHeight = window.innerHeight;
  const viewportWidth = window.innerWidth;
  const topPadding = viewportHeight * 0.05;
  const leftPosition = (viewportWidth - PANEL_WIDTH) / 2;
  
  // Create host element for Shadow DOM with position
  hostElement = document.createElement('div');
  hostElement.id = 'promptflow-panel-host';
  hostElement.style.cssText = `position: fixed; z-index: 2147483647; top: ${topPadding}px; left: ${leftPosition}px;`;
  document.body.appendChild(hostElement);
  
  // Create Shadow DOM for style isolation
  const shadowRoot = hostElement.attachShadow({ mode: 'open' });
  
  // Load the original PromptPanel.css stylesheet
  const linkEl = document.createElement('link');
  linkEl.rel = 'stylesheet';
  linkEl.href = chrome.runtime.getURL('PromptPanel.css');
  shadowRoot.appendChild(linkEl);
  
  // Create container for React app inside Shadow DOM
  const container = document.createElement('div');
  shadowRoot.appendChild(container);
  
  // Create React root and render
  reactRoot = createRoot(container);
  
  reactRoot.render(
    createElement(PromptPanel, {
      ...options,
    })
  );
}

/**
 * Hide the PromptPanel
 */
export function hidePromptPanel(): void {
  if (reactRoot) {
    reactRoot.unmount();
    reactRoot = null;
  }
  
  if (hostElement) {
    hostElement.remove();
    hostElement = null;
  }
}


