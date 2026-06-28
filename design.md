# PromptFlow Chrome Extension 设计白皮书

---

# 1. 项目概述

## 1.1 项目名称

**PromptFlow**

---

## 1.2 产品定义

PromptFlow 是一个运行在 Chrome 浏览器中的输入增强型工具，用于在任意网页输入框中提供快捷 Prompt 调用能力。

用户可通过输入 `/prompts` 触发 Prompt 选择器，并将预设 Prompt 模板快速插入当前输入位置。

---

## 1.3 核心定位

PromptFlow 是一个：

> 浏览器级 Prompt Command System（输入即调用 Prompt 的增强层）

---

## 1.4 设计目标

* 在任意输入框中提供统一 Prompt 调用能力
* 降低重复 Prompt 编写成本
* 提供类似 IDE Snippet 的输入体验
* 支持跨网站一致使用
* 提供可扩展 Prompt 管理能力

---

# 2. 用户交互模型

---

## 2.1 基本交互流程

```plaintext id="pf-flow-1"
用户在输入框输入：
/prompts

系统识别触发词

弹出 Prompt 选择面板

用户选择 Prompt

Prompt 插入输入框光标位置
```

---

## 2.2 交互特性

### 触发方式

* `/prompts`（默认）
* `/prompt`
* `/p`（可扩展）

---

### 面板行为

* 跟随光标位置浮动显示
* 支持键盘导航（↑ ↓ Enter）
* 支持实时搜索过滤
* 支持标签筛选

---

### 插入行为

* 替换 `/prompts` 触发词
* 或插入至光标位置
* 保留原输入上下文结构

---

# 3. 系统架构设计

---

## 3.1 总体架构

```plaintext id="pf-arch-1"
┌──────────────────────────────┐
│        Chrome Extension      │
├──────────────────────────────┤
│ Content Script               │
│  - 输入监听                 │
│  - 触发词识别               │
│  - 光标管理                 │
│  - 文本插入                 │
├──────────────────────────────┤
│ UI Layer (Floating Panel)    │
│  - Prompt 列表              │
│  - 搜索过滤                 │
│  - 键盘交互                 │
├──────────────────────────────┤
│ Background Service Worker    │
│  - Prompt 数据管理          │
│  - 存储同步                 │
│  - 跨页面通信               │
├──────────────────────────────┤
│ Storage Layer               │
│  - chrome.storage.local     │
│  - 可扩展云同步             │
└──────────────────────────────┘
```

---

# 4. 核心模块设计

---

## 4.1 Content Script（输入引擎）

### 职责

* 监听所有输入事件（input / textarea / contenteditable）
* 检测触发词 `/prompts`
* 获取光标位置
* 控制 UI 展示
* 执行文本替换

---

### 支持范围

* input
* textarea
* contenteditable
* 富文本编辑器（兼容模式）

---

### 输入识别机制

触发规则：

```plaintext id="pf-trigger"
检测输入流中包含：
/prompts
```

优化机制：

* debounce 防抖处理
* caret position tracking
* selection range detection

---

## 4.2 Prompt Engine（提示词系统）

### 职责

* Prompt 模板管理
* 分类与标签系统
* 搜索与过滤
* 模板解析

---

### Prompt 数据结构

```json id="pf-data-1"
{
  "id": "string",
  "title": "string",
  "content": "string",
  "description": "string",
  "tags": ["string"],
  "createdAt": "timestamp",
  "updatedAt": "timestamp"
}
```

---

### 模板能力（扩展）

支持变量插值：

```text id="pf-template-1"
Write a {tone} explanation about {topic}
```

变量类型：

* `{tone}`
* `{topic}`

---

## 4.3 UI Layer（浮动面板）

### 设计原则

* 不干扰输入体验
* 最小视觉侵入
* 快速响应交互

---

### UI 结构

```plaintext id="pf-ui-1"
PromptFlow Panel
 ├── Search Input
 ├── Prompt List
 │    ├── Title
 │    ├── Tags
 │    ├── Preview
 ├── Keyboard Hint
```

---

### 交互方式

* ↑ ↓ 选择
* Enter 确认插入
* Esc 关闭面板
* / 进入搜索模式

---

## 4.4 Background Service Worker

### 职责

* Prompt 数据持久化管理
* 多 Tab 状态同步
* 配置管理
* 扩展能力入口（未来 AI 模块）

---

### 可扩展能力

* AI 自动生成 Prompt
* Prompt 云同步
* Prompt 分享系统
* Workspace 管理

---

## 4.5 Storage Layer

### 本地存储方案

```plaintext id="pf-storage-1"
chrome.storage.local
```

---

### 数据结构

```json id="pf-storage-2"
{
  "prompts": [
    {
      "id": "1",
      "title": "Code Review",
      "content": "Review this code and suggest improvements...",
      "tags": ["dev", "review"]
    }
  ],
  "settings": {
    "trigger": "/prompts",
    "theme": "dark"
  }
}
```

---

# 5. 输入系统设计

---

## 5.1 光标控制机制

必须支持：

* 光标位置获取
* 输入选区识别
* 精准插入文本
* 触发词替换

---

## 5.2 插入策略

### 模式 1：替换模式（默认）

```plaintext id="pf-insert-1"
/prompts → Prompt 内容
```

---

### 模式 2：插入模式

保留原输入内容，仅插入 Prompt

---

### 模式 3：上下文增强模式（扩展）

根据上下文智能拼接 Prompt

---

# 6. 兼容性设计

---

## 6.1 Web 应用兼容

需支持主流 Web 应用：

* ChatGPT
* Claude
* Notion
* Linear
* GitHub
* Slack Web
* 各类 CMS / Admin 系统

---

## 6.2 富文本兼容

支持：

* contenteditable
* Slate
* ProseMirror
* TipTap

策略：

* DOM fallback 注入
* selection API 兼容处理

---

# 7. 性能设计

---

## 7.1 事件优化

* input debounce
* keydown throttle
* batch DOM updates

---

## 7.2 DOM 监听策略

* MutationObserver 监听结构变化
* event delegation 减少绑定成本

---

## 7.3 UI 性能优化

* 虚拟列表（Prompt 多时）
* lazy rendering
* requestAnimationFrame 定位更新

---

# 8. 扩展能力设计

---

## 8.1 AI Prompt 生成（未来能力）

支持：

```plaintext id="pf-ai-1"
/ai "write a react performance prompt"
```

自动生成 Prompt 模板

---

## 8.2 Prompt Workspace

按项目组织 Prompt：

```plaintext id="pf-ws-1"
frontend/
backend/
electron-app/
```

---

## 8.3 Prompt 分享系统

* 导入 / 导出
* tag 分类
* 社区 Prompt 库（未来）

---

## 8.4 Git 同步（高级能力）

* Prompt 存储 Git repository
* 版本管理
* diff Prompt 变化

---

# 9. 安全与隔离设计

---

## 9.1 执行隔离

* Content Script sandbox
* Shadow DOM UI 隔离
* 防止样式污染

---

## 9.2 权限控制

最小权限原则：

* activeTab
* storage
* scripting

---

# 10. MVP 定义

---

## 10.1 第一阶段（必须实现）

* `/prompts` 触发机制
* Prompt 面板 UI
* Prompt 插入能力
* 本地存储

---

## 10.2 第二阶段

* 搜索过滤
* 键盘导航
* 多网站兼容优化

---

## 10.3 第三阶段

* AI Prompt 生成
* Workspace
* 云同步
* 分享系统

---

# 11. 产品定位总结

PromptFlow 是一个：

> 将 Prompt 能力嵌入浏览器输入层的 Command System，使 Prompt 成为“输入级能力”的工具。

---
