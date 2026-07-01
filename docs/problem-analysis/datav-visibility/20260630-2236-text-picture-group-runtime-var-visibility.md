# 文字、图片、图片组变量控制显隐范围分析

## 目标

本次需求收敛为：优先实现文字、图片以及图片组相关组件的“变量控制显隐”，不引入数据集条件表达式。

期望效果：

- 富文本组件可以绑定变量，变量为 `true` 时显示。
- 普通图片组件可以绑定变量，变量为 `true` 时显示。
- 图片组图表可以绑定变量，变量为 `true` 时显示。
- 组合后的文字/图片组可以整体绑定变量显示隐藏。
- 如果需要，也支持组合内部的某个文字/图片子组件单独绑定变量。

## 当前代码现状

### 已具备的能力

- `DePreview.vue` 主画布预览循环已经通过 `v-show="finalShow(item)"` 控制顶层组件显隐。
- `finalShow(item)` 已经支持 `displayCondition.enabled + varKey`，并读取 `dvMainStore.getRuntimeVars(dvId)`。
- `CommonAttr.vue` 已经提供通用组件的“显隐（变量控制）”配置入口。
- `Senior.vue` 已经提供图表类组件的“显隐（变量控制）”配置入口。
- `component-list.ts` 的 `commonAttr` 已经包含 `displayCondition` 默认结构。
- `canvasUtils.ts` 的历史适配会给旧组件补齐 `displayCondition`。

### 文字组件

富文本在组件面板中对应：

- `component = 'UserView'`
- `innerType = 'rich-text'`

当前 `CommonAttr.vue` 的事件入口已覆盖富文本，显隐配置也在通用属性中展示。因此富文本顶层组件变量显隐链路基本成立。

### 普通图片组件

普通图片在组件面板中对应：

- `component = 'Picture'`

当前 `CommonAttr.vue` 的事件入口和显隐配置均覆盖普通图片。因此普通图片顶层组件变量显隐链路基本成立。

### 图片组图表

图片组在媒体组件面板中对应：

- `component = 'UserView'`
- `innerType = 'picture-group'`

图片组属于图表类组件，主要走 `Senior.vue` 高级属性。当前 `PictureGroupView.properties` 只包含：

- `background-overall-component`
- `border-style`
- `threshold`

如果 `Senior.vue` 的“显隐（变量控制）”不受 `properties` 控制，则图片组已经可以配置；如果实际 UI 中没有展示，需要给图片组补显隐配置入口，或让显隐配置对 dataV 图表类组件统一展示。

### 组合 Group

顶层组合组件 `Group` 本身在 `DePreview.vue` 的 `baseComponentData` 中渲染，因此外层 `Group` 可以被 `finalShow(item)` 控制，实现“整个组显示/隐藏”。

但 `GroupPreview.vue` 渲染组内子组件时直接循环 `propValue`，没有调用 `finalShow(item)` 或等价逻辑。因此：

- 控制外层组：可行。
- 控制组内单个文字/图片：当前链路不完整，需要补递归显隐判断。

## 推荐最小方案

建议不改数据结构，只补齐覆盖范围：

1. 保持 `displayCondition` 仍为 bool 变量模型。
2. 确认富文本、普通图片、图片组图表都能看到“显隐（变量控制）”配置。
3. 把 `finalShow` 逻辑抽成可复用方法，例如 `resolveRuntimeVarVisible(item, context)`。
4. `DePreview.vue` 顶层组件继续调用该方法。
5. `GroupPreview.vue` 组内组件也调用同一方法，支持组内子组件独立显隐。

## 涉及文件

预计最小改动文件：

- `core/core-frontend/src/utils/visibilityCondition.ts`
  - 新增变量显隐求值方法，避免 `DePreview.vue` 与 `GroupPreview.vue` 复制逻辑。
- `core/core-frontend/src/components/data-visualization/canvas/DePreview.vue`
  - `finalShow` 改为调用公共方法。
- `core/core-frontend/src/custom-component/group/GroupPreview.vue`
  - 增加运行变量读取，并对组内 `component-wrapper` 增加显隐判断。
- `core/core-frontend/src/views/chart/components/js/panel/charts/others/picture-group.ts`
  - 如果图片组 UI 不展示显隐配置，再补配置入口。

## 不建议本次做的事情

- 不引入数据集字段条件。
- 不扩展 `displayCondition` schema。
- 不做跨刷新持久化。
- 不改 dashboard 语义，仍优先只在 dataV 预览态生效。

## 待确认

1. “文字”是否只指富文本 `rich-text`，还是也包含滚动文本 `ScrollText`？
2. “图片组”是指媒体里的图片组图表 `picture-group`，还是指手动组合后的 `Group`？
3. 是否需要支持组内单个子组件独立显隐，还是只需要控制整个组？
