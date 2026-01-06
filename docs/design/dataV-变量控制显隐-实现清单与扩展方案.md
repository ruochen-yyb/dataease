## 实现清单（已实现）

### 数据结构
- **组件级**
  - `commonAttr.isShow`: 原有显隐开关
  - `commonAttr.displayCondition`: 新增变量控制显隐配置（MVP: bool）
- **画布级**
  - `canvasStyleData.runtimeBoolVarsDefault`: 新增全局变量默认值（持久化）
- **运行时（Pinia，仅内存）**
  - `runtimeVarsByDvId: Record<dvId, Record<varKey, boolean>>`

---

### 前端关键流程

#### 1) 初始化
- 从 `canvasStyleData.runtimeBoolVarsDefault` 初始化当前 dvId 的运行时变量（仅内存）。

#### 2) 渲染判定
- `finalShow = isShow && (未开启变量控制 ? true : runtimeVar[varKey] === true / emptyAs)`

#### 3) 变量变更来源
- **事件 `setVar`**：组件点击触发 `toggle/set`
- **右上角关闭按钮**：触发 `toggle`

#### 4) 调试日志（用于排查“为什么没生效”）
- 变量写入点打印：`setRuntimeVar/toggleRuntimeVar`（包含 dvId/key/value/source）
- 显隐判定点打印：`finalShow(item)`（包含组件 id/varKey/取值/最终结果）

---

## 涉及文件（已改动）

> 下面是“定位用清单”，以 repo 实际代码为准。

### 组件 schema
- `core/core-frontend/src/custom-component/component-list.ts`
  - `commonAttr.displayCondition` 新增字段

### 运行时变量 store
- `core/core-frontend/src/store/modules/data-visualization/dvMain.ts`
  - `runtimeVarsByDvId`
  - `getRuntimeVars/initRuntimeVars/setRuntimeVar/toggleRuntimeVar`
  - 变量变更日志

### 渲染层（显隐计算）
- `core/core-frontend/src/components/data-visualization/canvas/DePreview.vue`
  - `finalShow` 合并 `isShow + displayCondition + runtimeVars`
  -（可选）日志：finalShow 结果

### 交互事件与关闭按钮
- `core/core-frontend/src/components/data-visualization/canvas/ComponentWrapper.vue`
  - 处理 `events.type === 'setVar'`
  - 渲染关闭按钮并 toggle 变量

### 配置 UI：通用组件属性
- `core/core-frontend/src/custom-component/common/CommonAttr.vue`
  - “显隐（变量控制）”配置区

### 配置 UI：图表高级属性
- `core/core-frontend/src/views/chart/components/editor/editor-senior/Senior.vue`
  - “显隐（变量控制）”配置区（覆盖图表类组件）

### 配置 UI：事件（setVar 的 varKey 选择）
- `core/core-frontend/src/custom-component/common/CommonEvent.vue`
  - varKey 使用 `el-select allow-create`，支持自由输入 + 建议列表

### 配置 UI：画布全局变量默认值 & 改名
- `core/core-frontend/src/components/data-visualization/CanvasAttr.vue`
  - `runtimeBoolVarsDefault` 的增删改
  - **变量名重命名**：同步更新组件引用（显隐/事件）与运行时变量池

### 文案
- `core/core-frontend/src/locales/zh-CN.ts`
  - 新增相关 i18n key

---

## 当前语义（已满足：不同人独立控制，不落盘运行时值）

- 运行时值存在 Pinia 内存：**刷新丢失**
- 默认值在画布配置中：**持久化**
- 不同用户/不同设备：**互不影响**

---

## 扩展方案（未实现）

### A) 同一用户刷新/再次打开仍保持
- 方案：`localStorage` 持久化 `dvId -> vars`
- 合并：`{...defaults, ...persisted}`
- 增强：提供“清除本地记忆/重置为默认”按钮

### B) 跨设备同步 + 多人共享同一状态
- 方案：后端持久化 `dvId -> vars` + `version`
- 前端：轮询 `version`（1~3 秒）-> 变化才拉全量 vars
- 注意：分享链接 token（`X-DE-LINK-TOKEN`）目前只包含 `resourceId(dvId)`，不含 share uuid：
  - 若要按 share uuid 隔离，需要扩展 token/分享体系


