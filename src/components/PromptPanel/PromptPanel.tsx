/**
 * PromptPanel - React Component for Prompt Selection
 * 
 * A React component that provides a panel for searching and selecting prompts.
 * 
 * Features:
 * - Search filtering by title, description, and tags
 * - Keyboard navigation (Arrow keys, Enter to select)
 * - Recent prompts section
 * - Light/dark mode support
 */

import React, { useState, useEffect, useRef, useCallback, useMemo, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import type { Prompt } from '../../types';
import './PromptPanel.css';

interface PromptPanelProps {
  prompts: Prompt[];
  recentPromptIds: string[];
  selectedIndex: number;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onSelectIndex: (index: number) => void;
  onPromptSelect: (prompt: Prompt) => void;
  onClose: () => void;
  onOpenSettings: () => void;
}

interface PromptItemProps {
  prompt: Prompt;
  isSelected: boolean;
  searchQuery: string;
  onClick: () => void;
  onMouseEnter: () => void;
}

function highlightText(text: string, query: string): React.ReactNode {
  if (!query) return text;
  
  const escapedText = text.replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`(${escapedQuery})`, 'gi');
  const parts = escapedText.split(regex);
  
  return parts.map((part, index) => {
    if (part.toLowerCase() === query.toLowerCase()) {
      return <mark key={index} className="pp-highlight">{part}</mark>;
    }
    return part;
  });
}

function PromptItem({ prompt, isSelected, searchQuery, onClick, onMouseEnter }: PromptItemProps) {
  const itemRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    if (isSelected && itemRef.current) {
      itemRef.current.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }, [isSelected]);
  
  return (
    <div
      ref={itemRef}
      className={`pp-item ${isSelected ? 'selected' : ''}`}
      onClick={onClick}
      onMouseEnter={onMouseEnter}
    >
      <div className="pp-item-title">
        {highlightText(prompt.title, searchQuery)}
      </div>
      {prompt.description && (
        <div className="pp-item-description">
          {highlightText(prompt.description, searchQuery)}
        </div>
      )}
      {prompt.tags.length > 0 && (
        <div className="pp-item-tags">
          {prompt.tags.map((tag, index) => (
            <span key={index} className="pp-tag">{tag}</span>
          ))}
        </div>
      )}
    </div>
  );
}

export function PromptPanel({
  prompts,
  recentPromptIds,
  selectedIndex,
  searchQuery,
  onSearchChange,
  onSelectIndex,
  onPromptSelect,
  onClose,
  onOpenSettings,
}: PromptPanelProps) {
  const [localSearch, setLocalSearch] = useState(searchQuery);
  const searchInputRef = useRef<HTMLInputElement>(null);
  
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
  
  // Total items count
  const recentCount = showRecentSection ? recentPrompts.length : 0;
  const totalItems = recentCount + filteredPrompts.length;
  
  // Get prompt at index (considering recent section)
  const getPromptAtIndex = useCallback((index: number): Prompt | undefined => {
    if (showRecentSection && index < recentCount) {
      return recentPrompts[index];
    } else {
      const allIndex = showRecentSection ? index - recentCount : index;
      return filteredPrompts[allIndex];
    }
  }, [showRecentSection, recentCount, recentPrompts, filteredPrompts]);
  
  // Handle keyboard navigation
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        e.stopPropagation();
        if (totalItems > 0) {
          onSelectIndex(Math.min(selectedIndex + 1, totalItems - 1));
        }
        break;
        
      case 'ArrowUp':
        e.preventDefault();
        e.stopPropagation();
        if (totalItems > 0) {
          onSelectIndex(Math.max(selectedIndex - 1, 0));
        }
        break;
        
      case 'Enter':
        e.preventDefault();
        e.stopPropagation();
        const prompt = getPromptAtIndex(selectedIndex);
        if (prompt) {
          onPromptSelect(prompt);
        }
        break;
        
      case 'Escape':
        e.preventDefault();
        e.stopPropagation();
        onClose();
        break;
    }
  }, [totalItems, selectedIndex, onSelectIndex, getPromptAtIndex, onPromptSelect, onClose]);
  
  // Handle search input change
  const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setLocalSearch(value);
    onSearchChange(value);
  }, [onSearchChange]);
  
  // Focus search input on mount
  useEffect(() => {
    searchInputRef.current?.focus();
  }, []);
  
  // Handle backdrop click
  const handleBackdropClick = useCallback(() => {
    onClose();
  }, [onClose]);
  
  return (
    <div className="pp-container" onClick={handleBackdropClick}>
      <div className="pp-panel" onClick={e => e.stopPropagation()}>
        {/* Search Input */}
        <div className="pp-search-container">
          <input
            ref={searchInputRef}
            type="text"
            className="pp-search-input"
            placeholder="Search prompts..."
            value={localSearch}
            onChange={handleSearchChange}
            onKeyDown={handleKeyDown}
          />
        </div>
        
        {/* Prompt List */}
        <div className="pp-list">
          {totalItems > 0 ? (
            <>
              {/* Recent Section */}
              {showRecentSection && recentPrompts.length > 0 && (
                <div className="pp-list-section">
                  <div className="pp-section-title">Recent</div>
                  {recentPrompts.map((prompt, index) => (
                    <PromptItem
                      key={prompt.id}
                      prompt={prompt}
                      isSelected={selectedIndex === index}
                      searchQuery={localSearch}
                      onClick={() => onPromptSelect(prompt)}
                      onMouseEnter={() => onSelectIndex(index)}
                    />
                  ))}
                </div>
              )}
              
              {/* All Prompts Section */}
              {filteredPrompts.length > 0 && (
                <div className="pp-list-section">
                  {showRecentSection && (
                    <div className="pp-section-title">All Prompts</div>
                  )}
                  {filteredPrompts.map((prompt, index) => {
                    const actualIndex = showRecentSection ? recentCount + index : index;
                    return (
                      <PromptItem
                        key={prompt.id}
                        prompt={prompt}
                        isSelected={selectedIndex === actualIndex}
                        searchQuery={localSearch}
                        onClick={() => onPromptSelect(prompt)}
                        onMouseEnter={() => onSelectIndex(actualIndex)}
                      />
                    );
                  })}
                </div>
              )}
            </>
          ) : (
            <div className="pp-empty">
              <div className="pp-empty-icon">🔍</div>
              <div className="pp-empty-text">
                {localSearch ? 'No prompts found' : 'No prompts available'}
              </div>
            </div>
          )}
        </div>
        
        {/* Footer */}
        <div className="pp-footer">
          <div className="pp-footer-hint">
            <span className="pp-footer-key">↑↓</span> Navigate
            <span className="pp-footer-key">Enter</span> Select
            <span className="pp-footer-key">Esc</span> Close
          </div>
          <button className="pp-settings-btn" onClick={onOpenSettings}>
            <svg viewBox="64 64 896 896" focusable="false" width="16" height="16" fill="currentColor">
              <path d="M924.8 625.7l-65.5-56c3.1-19 4.7-38.4 4.7-57.8s-1.6-38.8-4.7-57.8l65.5-56a32.03 32.03 0 009.3-35.2l-.9-2.6a443.74 443.74 0 00-79.7-137.9l-1.8-2.1a32.12 32.12 0 00-35.1-9.5l-81.3 28.9c-30-24.6-63.5-44-99.7-57.6l-15.7-85a32.05 32.05 0 00-25.8-25.7l-2.7-.5c-52.1-9.4-106.9-9.4-159 0l-2.7.5a32.05 32.05 0 00-25.8 25.7l-15.8 85.4a351.86 351.86 0 00-99 57.4l-81.9-29.1a32 32 0 00-35.1 9.5l-1.8 2.1a446.02 446.02 0 00-79.7 137.9l-.9 2.6c-4.5 12.5-.8 26.5 9.3 35.2l66.3 56.6c-3.1 18.8-4.6 38-4.6 57.1 0 19.2 1.5 38.4 4.6 57.1L99 625.5a32.03 32.03 0 00-9.3 35.2l.9 2.6c18.1 50.4 44.9 96.9 79.7 137.9l1.8 2.1a32.12 32.12 0 0035.1 9.5l81.9-29.1c29.8 24.5 63.1 43.9 99 57.4l15.8 85.4a32.05 32.05 0 0025.8 25.7l2.7.5a449.4 449.4 0 00159 0l2.7-.5a32.05 32.05 0 0025.8-25.7l15.7-85a350 350 0 0099.7-57.6l81.3 28.9a32 32 0 0035.1-9.5l1.8-2.1c34.8-41.1 61.6-87.5 79.7-137.9l.9-2.6c4.5-12.3.8-26.3-9.3-35z"></path>
            </svg>
            Settings
          </button>
        </div>
      </div>
    </div>
  );
}

// Global references for cleanup
let reactRoot: { unmount: () => void } | null = null;
let hostElement: HTMLElement | null = null;

export interface PromptPanelOptions {
  prompts: Prompt[];
  recentPromptIds: string[];
  selectedIndex: number;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onSelectIndex: (index: number) => void;
  onPromptSelect: (prompt: Prompt) => void;
  onClose: () => void;
  onOpenSettings: () => void;
}

/**
 * Create and mount the PromptPanel to the page
 */
export function showPromptPanel(options: PromptPanelOptions): void {
  // Create host element
  hostElement = document.createElement('div');
  hostElement.id = 'promptflow-panel-host';
  hostElement.style.cssText = 'position: fixed; top: 0; left: 0; width: 0; height: 0; overflow: visible; z-index: 2147483647;';
  document.body.appendChild(hostElement);
  
  // Create React root
  reactRoot = createRoot(hostElement);
  
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
