---
name: design-instructions
description: PromptFlow UI 设计规范。修改 UI 代码时，请先阅读对应页面的设计文件，遵守对应页面的设计规则。
---

# PromptFlow 设计规范

根据你要修改的页面，选择对应的设计文件：

- **[CommandPanel.md](./CommandPanel.md)** — 提示词选择面板（打开、搜索、键盘/鼠标导航、最近使用）
- **[FillVariables.md](./FillVariables.md)** — 变量填写弹窗（触发条件、表单字段、预览、复制、提交）
- **[Setting.md](./Setting.md)** — 设置页面（通用设置、提示词管理、GitHub 同步、使用统计、导入导出）
- **[PromptPreview.md](./PromptPreview.md)** — 提示词预览弹窗（打开方式、内容布局、变量高亮样式）
- **[SyncManager.md](./SyncManager.md)** — GitHub 同步管理器（添加仓库、同步、删除、进度显示）

---

## 全局规范（适用于所有页面）

### 主题

- 跟随系统 `prefers-color-scheme` 自动切换亮/暗模式
- 面板：暗色模式时根元素添加 CSS 类 `dark`
- 弹窗：使用 `@media (prefers-color-scheme: dark)` 配合 CSS 自定义属性作用于 `:host`

### 状态管理

- 面板：`isPanelOpen`、`selectedIndex`（React 内部管理）、`searchQuery`、`recentPromptIds`
- 变量弹窗：`pendingPrompt`（content.ts 管理）、变量值映射（React 内部管理）
- 焦点：打开面板时搜索框自动聚焦；关闭/取消时恢复原始输入框焦点和光标位置

### 实现注意事项

1. **Shadow DOM 隔离** — 所有浮动 UI 使用 `attachShadow({ mode: 'open' })` 实现样式隔离
2. **事件冒泡** — 使用 capture 阶段监听器在 content.ts 中拦截 Shadow DOM 事件
3. **键盘事件** — Escape 由 content.ts 全局处理；方向键和 Enter 由 React 组件内部处理
4. **点击外部关闭** — 面板通过 content.ts 点击监听关闭；弹窗通过点击遮罩层关闭
5. **原生 Setter** — 设置 input/textarea 值时使用 `Object.getOwnPropertyDescriptor(HTML*Element.prototype, 'value')!.set!` 绕过框架拦截
