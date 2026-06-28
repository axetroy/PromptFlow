// PromptFlow Settings Page

interface Prompt {
  id: string;
  title: string;
  content: string;
  description?: string;
  tags: string[];
  createdAt: number;
  updatedAt: number;
  isDefault?: boolean;
}

interface PromptSettings {
  trigger: string;
  theme: 'light' | 'dark' | 'auto';
}

interface StorageData {
  prompts: Prompt[];
  settings: PromptSettings;
}

// State
let prompts: Prompt[] = [];
let settings: PromptSettings = { trigger: '/prompts', theme: 'dark' };

// DOM Elements
const triggerInput = document.getElementById('trigger') as HTMLInputElement;
const promptListEl = document.getElementById('prompt-list') as HTMLDivElement;
const addPromptBtn = document.getElementById('add-prompt-btn') as HTMLButtonElement;
const resetPromptsBtn = document.getElementById('reset-prompts-btn') as HTMLButtonElement;
const modal = document.getElementById('prompt-modal') as HTMLDivElement;
const modalTitle = document.getElementById('modal-title') as HTMLHeadingElement;
const modalClose = document.getElementById('modal-close') as HTMLButtonElement;
const modalCancel = document.getElementById('modal-cancel') as HTMLButtonElement;
const modalSave = document.getElementById('modal-save') as HTMLButtonElement;
const toast = document.getElementById('toast') as HTMLDivElement;

// Form fields
const promptIdInput = document.getElementById('prompt-id') as HTMLInputElement;
const promptTitleInput = document.getElementById('prompt-title') as HTMLInputElement;
const promptContentInput = document.getElementById('prompt-content') as HTMLTextAreaElement;
const promptDescriptionInput = document.getElementById('prompt-description') as HTMLInputElement;
const promptTagsInput = document.getElementById('prompt-tags') as HTMLInputElement;

// Theme toggle buttons
const themeButtons = document.querySelectorAll('.toggle-option[data-theme]');

// Initialize
async function init() {
  await loadData();
  renderPrompts();
  setupEventListeners();
}

// Load data from storage
async function loadData() {
  return new Promise<void>((resolve) => {
    chrome.storage.local.get(['promptflow-data'], (result) => {
      const data = result['promptflow-data'] as StorageData | undefined;
      if (data) {
        prompts = data.prompts || [];
        settings = data.settings || { trigger: '/prompts', theme: 'dark' };
      }
      updateUI();
      resolve();
    });
  });
}

// Save data to storage
async function saveData() {
  return new Promise<void>((resolve) => {
    chrome.storage.local.set({
      'promptflow-data': { prompts, settings }
    }, resolve);
  });
}

// Update UI with current data
function updateUI() {
  triggerInput.value = settings.trigger;
  
  // Update theme buttons
  themeButtons.forEach(btn => {
    const theme = btn.getAttribute('data-theme');
    btn.classList.toggle('active', theme === settings.theme);
  });
}

// Render prompts list
function renderPrompts() {
  if (prompts.length === 0) {
    promptListEl.innerHTML = `
      <div class="empty-prompts">
        <div class="empty-prompts-icon">📝</div>
        <p>No prompts yet. Click "Add New Prompt" to create one.</p>
      </div>
    `;
    return;
  }
  
  promptListEl.innerHTML = prompts.map(prompt => `
    <div class="prompt-card ${prompt.isDefault ? 'default' : ''}">
      <div class="prompt-header">
        <span class="prompt-title">${escapeHtml(prompt.title)}</span>
        ${prompt.isDefault ? '<span class="prompt-badge">Default</span>' : ''}
      </div>
      ${prompt.description ? `<p class="prompt-description">${escapeHtml(prompt.description)}</p>` : ''}
      <div class="prompt-meta">
        ${prompt.tags.map(tag => `<span class="prompt-tag">${escapeHtml(tag)}</span>`).join('')}
      </div>
      <div class="prompt-actions">
        ${prompt.isDefault ? `
          <button class="btn btn-secondary" disabled>Edit</button>
          <button class="btn btn-secondary" disabled>Delete</button>
        ` : `
          <button class="btn btn-secondary" onclick="editPrompt('${prompt.id}')">Edit</button>
          <button class="btn btn-danger" onclick="deletePrompt('${prompt.id}')">Delete</button>
        `}
      </div>
    </div>
  `).join('');
}

// Setup event listeners
function setupEventListeners() {
  // Trigger input
  triggerInput.addEventListener('change', async () => {
    settings.trigger = triggerInput.value || '/prompts';
    await saveData();
    showToast('Settings saved', 'success');
  });
  
  // Theme buttons
  themeButtons.forEach(btn => {
    btn.addEventListener('click', async () => {
      const theme = btn.getAttribute('data-theme') as 'light' | 'dark' | 'auto';
      settings.theme = theme;
      themeButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      await saveData();
    });
  });
  
  // Add prompt button
  addPromptBtn.addEventListener('click', () => openModal());
  
  // Modal close buttons
  modalClose.addEventListener('click', closeModal);
  modalCancel.addEventListener('click', closeModal);
  
  // Close modal on overlay click
  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeModal();
  });
  
  // Save prompt
  modalSave.addEventListener('click', savePrompt);
  
  // Reset prompts
  resetPromptsBtn.addEventListener('click', resetPrompts);
}

// Open modal for add/edit
function openModal(promptId?: string) {
  if (promptId) {
    const prompt = prompts.find(p => p.id === promptId);
    if (prompt) {
      modalTitle.textContent = 'Edit Prompt';
      promptIdInput.value = prompt.id;
      promptTitleInput.value = prompt.title;
      promptContentInput.value = prompt.content;
      promptDescriptionInput.value = prompt.description || '';
      promptTagsInput.value = prompt.tags.join(', ');
    }
  } else {
    modalTitle.textContent = 'Add Prompt';
    promptIdInput.value = '';
    promptTitleInput.value = '';
    promptContentInput.value = '';
    promptDescriptionInput.value = '';
    promptTagsInput.value = '';
  }
  
  modal.classList.add('active');
  promptTitleInput.focus();
}

// Close modal
function closeModal() {
  modal.classList.remove('active');
}

// Save prompt
async function savePrompt() {
  const title = promptTitleInput.value.trim();
  const content = promptContentInput.value.trim();
  const description = promptDescriptionInput.value.trim();
  const tags = promptTagsInput.value
    .split(',')
    .map(t => t.trim())
    .filter(t => t.length > 0);
  
  if (!title) {
    showToast('Title is required', 'error');
    promptTitleInput.focus();
    return;
  }
  
  if (!content) {
    showToast('Content is required', 'error');
    promptContentInput.focus();
    return;
  }
  
  const id = promptIdInput.value;
  
  if (id) {
    // Edit existing
    const index = prompts.findIndex(p => p.id === id);
    if (index !== -1) {
      prompts[index] = {
        ...prompts[index],
        title,
        content,
        description,
        tags,
        updatedAt: Date.now(),
      };
    }
  } else {
    // Add new
    prompts.push({
      id: `custom-${Date.now()}`,
      title,
      content,
      description,
      tags,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      isDefault: false,
    });
  }
  
  await saveData();
  renderPrompts();
  closeModal();
  showToast(id ? 'Prompt updated' : 'Prompt added', 'success');
}

// Edit prompt (global function for onclick)
(window as any).editPrompt = function(id: string) {
  openModal(id);
};

// Delete prompt
async function deletePrompt(id: string) {
  if (!confirm('Are you sure you want to delete this prompt?')) return;
  
  prompts = prompts.filter(p => p.id !== id);
  await saveData();
  renderPrompts();
  showToast('Prompt deleted', 'success');
}

// Make deletePrompt available globally
(window as any).deletePrompt = deletePrompt;

// Reset prompts to defaults
async function resetPrompts() {
  if (!confirm('This will delete all custom prompts. Are you sure?')) return;
  
  // Import default prompts
  const defaultPrompts = await getDefaultPrompts();
  prompts = defaultPrompts;
  await saveData();
  renderPrompts();
  showToast('Prompts reset to defaults', 'success');
}

// Get default prompts
async function getDefaultPrompts(): Promise<Prompt[]> {
  return [
    {
      id: '1',
      title: 'Code Review',
      content: 'Please review the following code and suggest improvements:\n\n```\n{code}\n```\n\nFocus on:\n- Code quality\n- Performance\n- Security',
      description: 'Review code and provide improvement suggestions',
      tags: ['dev', 'review', 'code'],
      createdAt: Date.now(),
      updatedAt: Date.now(),
      isDefault: true,
    },
    {
      id: '2',
      title: 'Explain Code',
      content: 'Explain the following code in detail:\n\n```\n{code}\n```\n\nPlease include:\n- What the code does\n- How it works\n- Key components',
      description: 'Get detailed explanation of any code',
      tags: ['dev', 'explanation', 'learning'],
      createdAt: Date.now(),
      updatedAt: Date.now(),
      isDefault: true,
    },
    {
      id: '3',
      title: 'Bug Fix',
      content: 'I have a bug in the following code:\n\n```\n{code}\n```\n\nError message:\n{error}\n\nPlease help me identify and fix the issue.',
      description: 'Debug and fix code issues',
      tags: ['dev', 'debug', 'fix'],
      createdAt: Date.now(),
      updatedAt: Date.now(),
      isDefault: true,
    },
    {
      id: '4',
      title: 'Write Tests',
      content: 'Write comprehensive tests for the following code:\n\n```\n{code}\n```\n\nRequirements:\n- Cover edge cases\n- Use best practices\n- Include comments',
      description: 'Generate test cases for code',
      tags: ['dev', 'testing', 'quality'],
      createdAt: Date.now(),
      updatedAt: Date.now(),
      isDefault: true,
    },
    {
      id: '5',
      title: 'Refactor Code',
      content: 'Refactor the following code to improve readability and maintainability:\n\n```\n{code}\n```\n\nGoals:\n- Cleaner architecture\n- Better naming\n- Reduced complexity',
      description: 'Improve code structure and quality',
      tags: ['dev', 'refactor', 'cleanup'],
      createdAt: Date.now(),
      updatedAt: Date.now(),
      isDefault: true,
    },
  ];
}

// Show toast notification
function showToast(message: string, type: 'success' | 'error') {
  toast.textContent = message;
  toast.className = `toast ${type} show`;
  
  setTimeout(() => {
    toast.classList.remove('show');
  }, 3000);
}

// Escape HTML
function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', init);
