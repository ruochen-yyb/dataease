# 文字、图片、图片组动态数据控制显隐设计

## 需求澄清

本次目标不是“交互变量控制显隐”，而是让组件显隐跟随动态数据集查询结果变化。

典型场景：

- 富文本组件根据自身数据集某个指标值显示或隐藏。
- 图片组根据自身动态数据结果显示或隐藏。
- 普通图片或手动组合 `Group` 根据页面内某个图表/富文本/图片组的数据结果显示或隐藏。
- 查询组件、外部参数、联动、定时刷新触发数据变化后，显隐结果自动更新。

## 当前可复用基础

项目已经有动态数据结果缓存：

- 富文本 `DeRichTextView.vue` 查询成功后调用 `dvMainStore.setViewDataDetails(element.value.id, res)`。
- 图片组 `picture-group/Component.vue` 查询成功后调用 `dvMainStore.setViewDataDetails(element.value.id, res)`。
- 普通图表、指标卡等也会调用 `setViewDataDetails(viewId, res)`。
- `dvMainStore.setViewDataDetails` 内部把 `chartDataInfo.data` 写入 `canvasViewDataInfo[viewId]`。
- 其他组件可通过 `dvMainStore.getViewDataDetails(viewId)` 获取当前图表数据结果。

这说明不需要新增一套数据集查询链路，优先复用已有图表数据缓存即可。

## 核心设计

将当前 `displayCondition` 从“只支持 bool 运行变量”扩展为“支持多种条件来源”：

```ts
displayCondition: {
  enabled: boolean
  sourceType?: 'runtimeVar' | 'dataset'

  // 兼容现有交互变量显隐
  varKey?: string
  emptyAs?: 'show' | 'hide'
  showClose?: boolean

  // 新增：动态数据显隐
  dataset?: {
    sourceViewId: string
    fieldId?: string
    fieldName?: string
    fieldKey?: string
    rowIndex?: number
    aggregate?: 'first' | 'sum' | 'avg' | 'max' | 'min' | 'count'
    operator: 'eq' | 'ne' | 'gt' | 'gte' | 'lt' | 'lte' | 'contains' | 'empty' | 'notEmpty'
    valueType: 'string' | 'number' | 'boolean'
    compareValue?: string | number | boolean
  }
}
```

兼容规则：

- 旧数据没有 `sourceType` 时按 `runtimeVar` 处理。
- `sourceType = 'runtimeVar'` 时继续走现有变量逻辑。
- `sourceType = 'dataset'` 时读取 `dataset.sourceViewId` 对应的数据缓存。
- 数据未加载、查询失败或字段缺失时按 `emptyAs` 处理，默认建议隐藏。

## 数据取值规则

动态数据结果来源：

```ts
const data = dvMainStore.getViewDataDetails(sourceViewId)
```

需要兼容常见数据结构：

- `data.tableRow`：表格/富文本/图片组常用行数据。
- `data.data`：部分图表渲染数据。
- `data.series`：指标类或部分自定义图表结果。

推荐一期优先支持 `tableRow`：

1. 从 `data.tableRow[rowIndex || 0]` 取第一行。
2. 优先按 `fieldKey` 取值，例如字段的 `dataeaseName`。
3. 如果没有 `fieldKey`，再按 `fieldName` 或字段 id 映射。
4. 取到值后按 `valueType` 转换。
5. 使用 `operator` 与 `compareValue` 比较得到最终 bool。

如果后续要支持多行聚合，再启用 `aggregate`。

## 适配组件

### 富文本

富文本自身有动态数据，建议默认允许 `sourceViewId = 当前组件 id`。

配置体验：

- 条件来源选择“动态数据”。
- 数据来源默认当前富文本。
- 字段下拉来自 `canvasViewInfo[当前组件 id].curFields` 或 `getViewDataDetails(id).fields`。
- 条件示例：`销售额 > 0` 时显示。

### 图片组

图片组也会调用 `getData` 并写入 `canvasViewDataInfo`，可直接使用自身数据结果。

配置体验：

- 条件来源选择“动态数据”。
- 数据来源默认当前图片组。
- 字段来自图片组数据集字段。
- 条件示例：`状态 = 启用` 时显示。

### 普通图片

普通图片本身没有数据集查询能力，因此需要选择页面内某个有数据的组件作为数据来源。

配置体验：

- 条件来源选择“动态数据”。
- 数据来源选择富文本、图片组、指标卡或任意图表。
- 条件示例：某指标图 `库存 <= 0` 时显示告警图片。

### 手动组合 Group

`Group` 本身没有数据，但可以选择页面内数据组件作为来源，实现整个组显示/隐藏。

如果要控制组内单个子组件，还需要在 `GroupPreview.vue` 中补递归显隐判断。

## 推荐实现步骤

### 第一步：公共显隐求值

新增 `core/core-frontend/src/utils/visibilityCondition.ts`：

- `resolveComponentVisible(item, context)`：统一处理 `isShow + displayCondition`。
- `resolveRuntimeVarVisible(...)`：保留现有变量逻辑。
- `resolveDatasetVisible(...)`：新增动态数据逻辑。
- `getDatasetConditionValue(...)`：从 `canvasViewDataInfo` 提取字段值。
- `compareConditionValue(...)`：比较符和类型转换。

### 第二步：替换预览层判断

- `DePreview.vue` 的 `finalShow(item)` 调用公共方法。
- `GroupPreview.vue` 也调用公共方法，支持组内子组件。

### 第三步：配置 UI 扩展

在现有“显隐（变量控制）”区域增加：

- 条件来源：交互变量 / 动态数据。
- 动态数据配置：
  - 数据来源组件。
  - 字段。
  - 比较符。
  - 比较值。
  - 数据缺失策略。

字段候选优先从：

- `canvasViewInfo[sourceViewId].curFields`
- `dvMainStore.getViewDataDetails(sourceViewId)?.fields`

### 第四步：刷新触发

不需要额外发请求。数据组件查询成功后已经写入 `canvasViewDataInfo`，Pinia 响应式更新会触发显隐重新计算。

需要注意：

- `finalShow`/公共方法必须读取响应式 store 数据。
- 查询中尚无数据时按 `emptyAs` 处理。
- 数据查询失败时也按 `emptyAs` 处理，必要时保留调试日志。

## 最小一期范围

建议一期只做：

- `sourceType = dataset`。
- 数据来源选择页面内已有数据组件。
- 数据结构只支持 `tableRow[0]` 取值。
- 比较符支持 `=、!=、>、>=、<、<=、为空、不为空、包含`。
- 组件范围覆盖富文本、普通图片、图片组、手动组合 `Group`。
- 继续只在 dataV 预览态生效。

## 不建议一期做

- 不为普通图片单独新增数据集查询。
- 不支持复杂表达式、多条件 `and/or`。
- 不支持跨刷新保存“计算结果”。
- 不支持 dashboard，除非确认产品范围。
- 不改后端接口。

## 待确认

1. 一期是否可以只取第一行数据 `tableRow[0]` 判断？
2. 普通图片和 `Group` 是否允许选择“页面内已有图表/富文本/图片组”作为数据来源？
3. 数据未加载或查询失败时，默认隐藏是否符合预期？
4. 是否只做 dataV 预览态，编辑态仍只展示配置不生效？
