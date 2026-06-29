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

1. 用户输入 `/prompts` 触发面板，此时记录 a. 光标位置 b. 输入框内容 c. 触发词位置
2. 用户选择 Prompt，弹出变量填充界面（如果有变量）
  2.1 如果用户取消选择，则重新聚焦输入框，并恢复原光标位置
3. 用户确认插入，系统将 Prompt 内容插入至光标位置，并删除触发词 `/prompts`
  3.1 如果用户取消选择，则重新聚焦输入框，并恢复原光标位置

插入提示词不破坏上下文，不改变光标位置

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

支持变量插值，使用 `<VAR>` XML 标签语法：

```text id="pf-template-1"
Write a <VAR name="tone"></VAR> explanation about <VAR name="topic"></VAR>
```

变量类型：

* `<VAR name="tone"></VAR>` - 必填变量
* `<VAR name="tone" defaultValue="professional"></VAR>` - 带默认值的变量

---

## 4.3 模板变量语法（VAR Tag）

### 设计背景

传统的变量语法如 `{variable_name}` 容易与以下场景冲突：
- Markdown 中的强调/粗体：`**text**`, `{text}`
- JSON/代码中的对象属性
- 其他模板引擎（如 Handlebars、Nunjucks）
- 正则表达式

为了避免冲突，采用 XML 标签风格的 `<VAR>` 语法。

---

### 语法规范

#### 基本语法

```xml
<VAR name="variable_name"></VAR>
```

#### 带默认值的变量

```xml
<VAR name="variable_name" defaultValue="default_value"></VAR>
```

#### 自闭合语法

```xml
<VAR name="variable_name" defaultValue="value"/>
```

---

### 参数说明

| 参数 | 必需 | 类型 | 说明 |
|------|------|------|------|
| `name` | 是 | string | 变量唯一标识符，支持字母、数字、下划线、连字符，必须以字母或下划线开头 |
| `defaultValue` | 否 | string | 当用户未提供值时使用的默认值 |

---

### 变量名称规则

* 必须以字母 (`a-z`, `A-Z`) 或下划线 (`_`) 开头
* 可包含字母、数字 (`0-9`)、下划线 (`_`)、连字符 (`-`)
* 大小写敏感
* 不能包含空格

**合法名称**：
- `name`
- `variable_name`
- `variableName`
- `topic_1`
- `my-var`
- `_private`

**非法名称**：
- `123name` (不能以数字开头)
- `my name` (不能包含空格)
- `var!` (不能包含特殊字符)

---

### 使用示例

#### 示例 1：基础变量

```xml
Translate the following text to <VAR name="target_language" defaultValue="English"></VAR>:

<VAR name="text"></VAR>
```

#### 示例 2：代码审查

```xml
Review the following <VAR name="language"></VAR> code:

<VAR name="code"></VAR>

Focus on: <VAR name="focus_areas" defaultValue="general improvements"></VAR>
```

#### 示例 3：复杂 Prompt

```xml
---
title: <VAR name="title" defaultValue="Untitled"></VAR>
description: <VAR name="description" defaultValue="No description"></VAR>
tags:
  - <VAR name="tag1"></VAR>
  - <VAR name="tag2" defaultValue="general"></VAR>
---

# <VAR name="title" defaultValue="Untitled"></VAR>

<VAR name="content"></VAR>

### Requirements

- <VAR name="req1"></VAR>
- <VAR name="req2" defaultValue="Follow best practices"></VAR>
```

---

### 与其他语法的兼容性

`<VAR>` 语法不会与以下常见语法冲突：

| 语法 | 示例 | 是否冲突 |
|------|------|----------|
| Markdown 粗体 | `**bold**` | ❌ 不冲突 |
| Markdown 大括号 | `{text}` | ❌ 不冲突 |
| Handlebars | `{{name}}` | ❌ 不冲突 |
| JavaScript 模板字面量 | `` `${var}` `` | ❌ 不冲突 |
| printf 格式 | `%s %d` | ❌ 不冲突 |
| Shell 变量 | `$VAR` | ❌ 不冲突 |
| CSS 变量 | `--var` | ❌ 不冲突 |

---

### 技术实现

#### 正则表达式

```javascript
// 匹配 <VAR> 标签
/<VAR\s+name="([^"]+)"(?:\s+defaultValue="([^"]*)")?(?:[^>]*)>(?:[\s\S]*?)<\/VAR>|<VAR\s+name="([^"]+)"(?:\s+defaultValue="([^"]*)")?\s*\/>/gi
```

#### 解析流程

1. 扫描模板中的所有 `<VAR>` 标签
2. 提取 `name` 和 `defaultValue` 属性
3. 返回变量列表供 UI 层渲染输入表单
4. 用户填写后，执行替换操作

#### 替换规则

1. 如果用户提供了值，使用用户值替换
2. 如果用户未提供值但有默认值，使用默认值替换
3. 如果既无用户值也无默认值，保留原始 `<VAR>` 标签

---

### 设计原则

1. **无歧义**：XML 标签风格确保不会与现有语法冲突
2. **可扩展**：未来可添加更多属性（如 `type`、`required`、`description`）
3. **易读写**：语法简洁明了，易于理解和编写
4. **标准化**：采用常见的 XML 属性语法

---

## 4.4 UI Layer（浮动面板）

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

## 4.5 Background Service Worker

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

## 4.6 Storage Layer

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
