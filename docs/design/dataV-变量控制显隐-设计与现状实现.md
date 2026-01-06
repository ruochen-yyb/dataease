## 背景与目标

在 DataEase「数据大屏（dataV）」中，为每个组件提供一套“由变量控制显隐”的机制，使得：

- **绑定 bool 变量**：变量为 `true` 时显示，`false` 时隐藏。
- **同一 dvId 内共享**：页面内同一 `dvId` 的组件共享同一套变量。
- **编辑器预览可见效果**：在编辑器的预览态也能看到显隐效果，便于调试。
- **组件内交互**：通过事件（`setVar`）或组件右上角“关闭按钮”取反变量，从而驱动其他组件显隐联动。

本方案为 MVP：**变量类型固定为 bool**，显隐规则固定为“true 显示”。

---

## 核心概念

### 1) 组件基础显隐：`isShow`

组件原本就存在 `commonAttr.isShow`，最终渲染层用 `v-show` 控制。

- `isShow = false`：无条件不显示。
- `isShow = true`：进入“变量控制显隐”的二次判定。

### 2) 变量控制显隐：`displayCondition`

在组件的 `commonAttr` 上新增 `displayCondition` 用于变量控制显隐（MVP 仅 bool）：

- `enabled`: 是否开启变量控制显隐
- `varKey`: 变量名（支持自由输入）
- `emptyAs`: 变量不存在时策略：`show | hide`
- `showClose`: 显示时是否在组件右上角展示“关闭按钮”（点击取反该变量）

### 3) 运行时变量（不落盘）：`runtimeVarsByDvId`

运行时变量存储在前端 Pinia store 内存中（按 `dvId` 维度隔离）：

- **同一用户/同一页面实例共享**（同一 `dvId`）
- **刷新会丢失**（回到默认值或未定义）
- **不同用户/不同设备互不影响**（天然隔离）

### 4) 变量默认值（落盘）：`runtimeBoolVarsDefault`

在画布级配置中新增（并持久化）：

- `canvasStyleData.runtimeBoolVarsDefault: Record<string, boolean>`

用于页面加载/预览初始化运行时变量的默认值。

---

## 渲染层规则：`finalShow`

最终渲染可见性（伪代码）：

1. `if (!isShow) return false`
2. 若未开启 `displayCondition` 或 `varKey` 为空：`return true`
3. 读取运行时变量 `v = runtimeVars[varKey]`
   - `v === undefined`：按 `emptyAs` 决策（默认 hide）
   - 否则：`return v === true`

> 说明：MVP 固定“true 显示”。后续若要支持 eq/ne 或多类型变量，需要扩展 schema 与表达式。

---

## 交互：如何改变变量

### 1) 事件扩展：新增 `setVar`

复用组件 events，新增事件类型 `setVar`（MVP 优先用于富文本点击）：

- `toggle`：取反 bool 变量（默认行为）
- `set`：设置为某个 bool 值（可选）

> 事件触发区域：富文本组件点击任意区域即可触发（MVP）。

### 2) 关闭按钮：右上角“×”

当组件：

- 开启 `displayCondition.enabled`
- `varKey` 有值
- `showClose = true`
- 且当前 `finalShow` 为可见

则在组件右上角展示关闭按钮，点击后对 `varKey` 执行 **toggle**。

---

## 变量配置 UI（编辑态）

### 1) 画布：全局变量默认值

在画布属性面板提供：

- 新增/删除全局变量默认值
- **变量名可编辑（支持重命名）**
- 默认值（bool 开关）

重命名时需要：

- 修改 `runtimeBoolVarsDefault` key
- 同步修改所有组件引用：
  - `displayCondition.varKey`
  - `events.setVar.varKey`
- 同步修改当前 `dvId` 的运行时变量池（编辑器预览即时生效）

### 2) 组件：显隐（变量控制）

在组件属性面板提供“显隐（变量控制）”配置区：

- 开启/关闭
- 变量名（自由输入 + 可选建议列表）
- emptyAs
- showClose

---

## 运行时/生产语义（本次最终选择）

当前实现满足：

- **不同人打开页面独立控制**：每个用户/设备独立一套变量状态
- **不落盘运行时值**：刷新/重开会回到默认值（或未定义）

后续如果要做到：

- 同一用户跨刷新保持（localStorage）
- 跨设备同步/多人共享同一状态（后端持久化 + 轮询/推送）

需要另行扩展（见《实现清单与扩展方案》）。


