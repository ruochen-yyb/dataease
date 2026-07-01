# DataV 组件按数据集值控制显隐设计分析

## 背景

当前 `DePreview.vue` 的组件显隐链路已经支持“运行时 bool 变量控制组件显隐”：

- `isShow = false` 时组件无条件隐藏。
- `displayCondition.enabled + varKey` 开启后，预览态读取 `dvMainStore.getRuntimeVars(dvId)[varKey]`。
- 变量为 `true` 时显示，变量缺失时按 `emptyAs` 决定显示或隐藏。
- 变量来源主要是画布默认值 `runtimeBoolVarsDefault`、组件事件 `setVar`、右上角关闭按钮。

用户新需求是：组件显示/隐藏希望能根据“数据集某个值”控制，或者按当前项目设计逻辑给出合理方案。

## 现状判断

当前实现的核心优势是链路短：

- 显隐最终入口集中在 `DePreview.vue` 的 `finalShow(item)`。
- 运行时状态集中在 `dvMainStore.runtimeVarsByDvId`。
- 编辑态配置已经覆盖通用组件属性、图表高级属性、画布变量默认值。

但它目前只适合“交互状态驱动显隐”，不适合直接表达“数据值满足条件时显示”：

- `runtimeVarsByDvId` 类型固定为 `Record<string, boolean>`。
- `displayCondition` 只有 `varKey`，没有数据源、字段、聚合、比较符等配置。
- 数据集值可能是字符串、数字、日期、空值、聚合结果，不能简单转换为 bool。
- 数据刷新、联动、参数变化后，显隐条件需要重新计算，否则会出现图表数据已变但显隐状态未同步的问题。

## 推荐设计

建议把能力拆成两层：

1. 保留现有“运行变量显隐”，继续服务点击事件、关闭按钮、轻量交互。
2. 新增“数据条件显隐”，让组件直接配置一个数据值判断表达式。

### 组件配置模型

保留现有字段兼容旧数据，同时扩展 `displayCondition`：

```ts
displayCondition: {
  enabled: boolean
  sourceType: 'runtimeVar' | 'dataset'
  varKey?: string
  emptyAs?: 'show' | 'hide'
  showClose?: boolean
  dataset?: {
    sourceMode: 'selfChart' | 'selectedChart' | 'datasetQuery'
    sourceId?: string
    fieldId: string
    fieldName?: string
    aggregate?: 'first' | 'sum' | 'avg' | 'max' | 'min' | 'count'
    operator: 'eq' | 'ne' | 'gt' | 'gte' | 'lt' | 'lte' | 'contains' | 'empty' | 'notEmpty'
    valueType: 'string' | 'number' | 'boolean' | 'date'
    compareValue?: string | number | boolean
  }
}
```

兼容策略：

- 旧数据没有 `sourceType` 时，默认按 `runtimeVar` 处理。
- 旧的 `varKey / emptyAs / showClose` 不迁移、不删除。
- `dataset` 配置仅在 `sourceType === 'dataset'` 时生效。

### 数据源模式

建议先支持 `selectedChart` 或 `selfChart`，谨慎支持独立 `datasetQuery`。

- `selfChart`：图表组件按自身数据结果判断自身显隐，配置简单，但对普通装饰组件不适用。
- `selectedChart`：选择页面中一个图表组件作为数据来源，普通组件也能根据图表数据控制显隐。
- `datasetQuery`：组件自己直接绑定数据集并查询，能力最完整，但要新增查询、权限、参数、缓存、刷新链路，实施成本最高。

推荐一期优先做 `selectedChart`：

- 复用当前图表已有的数据查询和刷新机制。
- 避免每个装饰组件都新增独立数据集查询。
- 通过“隐藏图表/控制图表”也能满足只用数据集值控制显隐的场景。

## 运行时计算方案

新增一个独立的显隐条件求值方法，例如 `resolveDisplayCondition(item)`：

1. `isShow = false` 直接返回 `false`。
2. 未开启 `displayCondition` 返回 `true`。
3. `sourceType = runtimeVar` 时走现有逻辑。
4. `sourceType = dataset` 时：
   - 根据 `sourceId` 找到对应图表数据结果。
   - 按 `fieldId + aggregate` 取出一个标量值。
   - 按 `operator + compareValue + valueType` 得到 bool。
   - 数据缺失或异常时按 `emptyAs` 处理。

建议把数据条件求值逻辑独立到工具文件，例如：

- `core/core-frontend/src/utils/visibilityCondition.ts`

这样 `DePreview.vue` 只负责调用，不堆积字段解析和比较逻辑。

## 刷新与联动

数据驱动显隐必须跟随数据变化重新计算。建议触发点包括：

- 页面首次加载图表数据完成。
- 图表刷新、联动、参数变化后数据更新。
- `canvasViewInfo` 或图表数据缓存变化。
- 编辑态修改显隐条件配置后。

如果当前图表数据结果没有统一暴露给 `DePreview.vue`，需要先建立一个轻量运行时数据索引：

```ts
visibilityDataByViewId: Record<string, {
  loading: boolean
  error?: string
  rows?: Record<string, any>[]
  updatedAt: number
}>
```

图表组件在数据加载完成后写入索引，`finalShow` 再读取索引求值。

## 配置 UI

组件属性里的“显隐（变量控制）”建议调整为“显隐条件”：

- 条件来源：交互变量 / 数据值。
- 交互变量：保持现有变量名、缺失策略、关闭按钮。
- 数据值：
  - 数据来源图表。
  - 字段。
  - 聚合方式。
  - 判断条件。
  - 比较值。
  - 数据缺失策略。

图表高级属性 `Senior.vue` 与通用属性 `CommonAttr.vue` 要保持同一套配置组件，避免重复维护。

## 实施建议

### 一期：最小闭环

- 扩展 `displayCondition.sourceType`，默认兼容 `runtimeVar`。
- 新增数据条件配置 UI，先支持 `selectedChart`。
- 新增 `visibilityCondition.ts`，封装取值、类型转换、比较符判断。
- 在图表数据加载完成后维护 `visibilityDataByViewId`。
- `DePreview.vue` 的 `finalShow` 调用统一求值方法。

### 二期：增强能力

- 支持 `datasetQuery` 独立查询。
- 支持多个条件组合：`and / or`。
- 支持跨页面参数、查询组件参数、联动条件参与计算。
- 支持调试面板展示“当前值、比较符、最终结果”。

## 风险点

- 数据刷新时序：显隐判断早于图表数据返回时，需要明确 loading 状态下按 `emptyAs` 处理。
- 性能：每个组件不能重复发起数据集查询，优先复用图表数据或运行时索引。
- 权限：独立数据集查询会触及数据权限，优先不要在一期引入。
- 空值类型：`null / undefined / '' / NaN` 需要统一处理。
- 兼容性：旧画布必须继续按 bool 变量显隐，不应要求数据迁移。

## 结论

合理设计是：不要把“数据集值”直接塞进当前 bool 运行变量模型，而是把 `displayCondition` 升级为“条件来源 + 条件表达式”。一期推荐复用图表数据结果做 `selectedChart` 数据源，既贴合当前项目已有渲染/刷新链路，也能较快满足“根据数据集某个值控制组件显示隐藏”的需求。

待确认问题：

1. 数据值来源是否允许选择“页面内某个图表组件”的结果？
2. 一期是否只需要判断单个标量值，例如 `销售额 > 10000`？
3. 数据加载中或查询失败时，默认隐藏还是显示？
4. 这个能力是否只面向 dataV，还是 dashboard 也需要支持？
