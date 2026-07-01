# 动态数据显隐面板接入缺口分析

## 问题

普通图片、图片组、手动组合 `Group` 当前都能看到“显隐（变量控制）”配置，但面板里没有接入数据组件，无法配置“根据某个动态数据结果控制显隐”。

这说明缺口不在预览层 `finalShow`，而在属性面板配置模型：

- 现在的显隐配置只支持选择交互变量 `varKey`。
- 面板没有“条件来源：交互变量 / 动态数据”。
- 面板没有“数据来源组件、字段、比较符、比较值”等配置项。

## 当前面板路由

### 普通图片

普通图片组件：

- `component = 'Picture'`
- 属性面板：`custom-component/picture/Attr.vue`
- 面板内部复用：`CommonAttr.vue`

`PictureAttr` 只处理图片上传、重传、适配方式，显隐配置来自 `CommonAttr`。

### 图片组

图片组组件：

- `component = 'UserView'`
- `innerType = 'picture-group'`
- 属性面板：`custom-component/picture-group/Attr.vue`
- 面板内部复用：`CommonAttr.vue`

图片组面板中已有：

- `PictureGroupUploadAttr`
- `PictureGroupThreshold`
- `PictureGroupDatasetSelect`

但这里的 `PictureGroupDatasetSelect` 是图片组自身阈值/数据配置，不是显隐条件的数据来源组件选择。

### 手动组合 Group

手动组合组件：

- `component = 'Group'`
- 属性面板：`custom-component/group/Attr.vue`
- 面板内部复用：`CommonAttr.vue`

`GroupAttr` 当前几乎只包了一层 `CommonAttr`，没有自己的数据配置能力。

## 根因

三类组件的显隐配置都汇聚到 `CommonAttr.vue`，但 `CommonAttr.vue` 当前只接入了：

- `componentData`
- `canvasStyleData`
- `displayCondition.varKey`
- `runtimeBoolVarsDefault`

它没有接入：

- `canvasViewInfo`
- `dvMainStore.getViewDataDetails(viewId)`
- 可作为数据来源的组件列表
- 指定数据组件下的字段列表
- 比较符和值类型配置

所以即使后续 `DePreview.vue` 支持 `sourceType = dataset`，普通图片、图片组和 `Group` 面板也仍然无法配置数据来源。

## 推荐设计

把“动态数据显隐配置”作为 `CommonAttr.vue` 的公共能力，而不是分别写在 `PictureAttr`、`PictureGroupAttr`、`GroupAttr` 里。

原因：

- 普通图片、图片组、`Group` 都已经复用 `CommonAttr`。
- 富文本、其他基础组件也可以自然复用。
- 避免每个 Attr 文件重复维护同一套数据来源/字段/比较符 UI。
- `CommonAttr` 已经负责 `displayCondition` 初始化和保存快照，继续扩展最顺。

## 面板配置结构

在现有“显隐（变量控制）”区块中增加条件来源：

- `交互变量`
- `动态数据`

当选择 `动态数据` 时显示：

- 数据来源组件：页面内已有数据组件。
- 字段：来源组件的数据字段。
- 取值行：一期默认第一行，可隐藏配置。
- 比较符：`=、!=、>、>=、<、<=、包含、为空、不为空`。
- 比较值：根据值类型输入。
- 数据缺失时：显示 / 隐藏。

## 数据来源组件候选

候选组件来自 `componentData` 递归扫描，结合 `canvasViewInfo` 判断是否是数据组件。

建议一期候选包括：

- `UserView` 且 `canvasViewInfo[id]` 存在。
- `UserView.innerType = 'rich-text'`。
- `UserView.innerType = 'picture-group'`。
- 指标卡、普通图表等已有 `canvasViewInfo` 的组件。

对于 `Picture` 和 `Group`：

- 它们自身没有 `canvasViewInfo`，不能作为数据来源。
- 但可以选择页面内其他数据组件作为来源。

对于图片组：

- 可以默认把当前组件作为数据来源。
- 也允许改选页面内其他数据组件。

## 字段候选

字段候选优先级：

1. `canvasViewInfo[sourceViewId].curFields`
2. `dvMainStore.getViewDataDetails(sourceViewId)?.fields`
3. `dvMainStore.getViewDataDetails(sourceViewId)?.sourceFields`

字段保存时建议同时存：

- `fieldId`
- `fieldName`
- `fieldKey`，优先使用 `dataeaseName`

运行时取值优先用 `fieldKey` 读取 `tableRow[0][fieldKey]`。

## 需要修改的文件

### 必改

- `core/core-frontend/src/custom-component/common/CommonAttr.vue`
  - 增加 `canvasViewInfo`、动态数据来源组件候选、字段候选。
  - 扩展 `displayCondition` 默认结构。
  - 增加动态数据条件 UI。

- `core/core-frontend/src/custom-component/component-list.ts`
  - 扩展 `commonAttr.displayCondition` 默认结构。

- `core/core-frontend/src/utils/canvasUtils.ts`
  - 历史数据适配补齐 `sourceType` 和 `dataset` 默认结构。

- `core/core-frontend/src/utils/visibilityCondition.ts`
  - 新增或承载动态数据显隐求值。

- `core/core-frontend/src/components/data-visualization/canvas/DePreview.vue`
  - 使用公共求值方法。

- `core/core-frontend/src/custom-component/group/GroupPreview.vue`
  - 组内子组件显隐也使用公共求值方法。

### 可能需要

- `core/core-frontend/src/locales/zh-CN.ts`
  - 增加“条件来源、动态数据、数据来源组件、字段、比较符、比较值”等文案。

## 不建议方案

不建议分别在 `PictureAttr`、`PictureGroupAttr`、`GroupAttr` 中各写一套动态数据显隐配置。

原因：

- 三个面板最终都是修改 `displayCondition`。
- 字段候选、组件候选、比较符逻辑完全重复。
- 后续富文本或其他组件要支持时还要再复制。

## 结论

当前普通图片、图片组、手动组合 `Group` 没有接入数据组件，是因为动态数据显隐配置还没有进入公共属性面板 `CommonAttr.vue`。推荐把数据来源组件选择、字段选择和比较条件都放进 `CommonAttr`，让所有复用通用属性的组件统一获得动态数据显隐能力。

一期实现时，普通图片和 `Group` 选择页面内已有数据组件；图片组默认选择自身，也允许切换到其他数据组件。
