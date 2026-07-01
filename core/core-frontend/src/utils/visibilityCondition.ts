export type DisplayConditionSourceType = 'runtimeVar' | 'dataset'
export type DisplayConditionEmptyAs = 'show' | 'hide'
export type DatasetConditionOperator =
  | 'eq'
  | 'ne'
  | 'gt'
  | 'gte'
  | 'lt'
  | 'lte'
  | 'contains'
  | 'empty'
  | 'notEmpty'
export type DatasetConditionValueType = 'string' | 'number' | 'boolean'

export interface DatasetDisplayCondition {
  sourceViewId: string
  fieldId?: string
  fieldName?: string
  fieldKey?: string
  rowIndex?: number
  aggregate?: 'first' | 'sum' | 'avg' | 'max' | 'min' | 'count'
  operator: DatasetConditionOperator
  valueType: DatasetConditionValueType
  compareValue?: string | number | boolean
}

export interface DisplayCondition {
  enabled: boolean
  sourceType?: DisplayConditionSourceType
  varKey?: string
  emptyAs?: DisplayConditionEmptyAs
  showClose?: boolean
  dataset?: DatasetDisplayCondition
}

export interface VisibilityResolveContext {
  dvInfo?: any
  showPosition?: string
  runtimeVars?: Record<string, boolean>
  getViewDataDetails?: (viewId: string) => any
}

export const DEFAULT_DATASET_DISPLAY_CONDITION: DatasetDisplayCondition = {
  sourceViewId: '',
  fieldId: '',
  fieldName: '',
  fieldKey: '',
  rowIndex: 0,
  aggregate: 'first',
  operator: 'eq',
  valueType: 'string',
  compareValue: ''
}

export const DEFAULT_DISPLAY_CONDITION: DisplayCondition = {
  enabled: false,
  sourceType: 'runtimeVar',
  varKey: '',
  emptyAs: 'hide',
  showClose: true,
  dataset: { ...DEFAULT_DATASET_DISPLAY_CONDITION }
}

/**
 * 兼容旧组件数据，补齐显隐条件默认结构。
 */
export const normalizeDisplayCondition = (target: any): DisplayCondition => {
  if (!target.displayCondition) {
    target.displayCondition = {
      ...DEFAULT_DISPLAY_CONDITION,
      dataset: { ...DEFAULT_DATASET_DISPLAY_CONDITION }
    }
    return target.displayCondition
  }

  const dc = target.displayCondition
  dc.enabled = !!dc.enabled
  dc.sourceType = dc.sourceType || 'runtimeVar'
  dc.varKey = dc.varKey || ''
  dc.emptyAs = dc.emptyAs || 'hide'
  if (dc.showClose === undefined) {
    dc.showClose = true
  }
  dc.dataset = {
    ...DEFAULT_DATASET_DISPLAY_CONDITION,
    ...(dc.dataset || {})
  }
  return dc
}

const emptyResult = (emptyAs?: DisplayConditionEmptyAs) => (emptyAs || 'hide') === 'show'

const isEmptyValue = value => value === undefined || value === null || value === ''

const normalizeValue = (value, valueType: DatasetConditionValueType) => {
  if (valueType === 'number') {
    const num = Number(`${value ?? ''}`.replace(/,/g, ''))
    return Number.isNaN(num) ? undefined : num
  }
  if (valueType === 'boolean') {
    return value === true || value === 'true' || value === '1' || value === 1
  }
  return value === undefined || value === null ? '' : `${value}`
}

const compareConditionValue = (
  rawValue,
  operator: DatasetConditionOperator,
  compareValue,
  valueType: DatasetConditionValueType
) => {
  if (operator === 'empty') return isEmptyValue(rawValue)
  if (operator === 'notEmpty') return !isEmptyValue(rawValue)

  const left = normalizeValue(rawValue, valueType)
  const right = normalizeValue(compareValue, valueType)
  if (left === undefined || right === undefined) return false

  switch (operator) {
    case 'eq':
      return left === right
    case 'ne':
      return left !== right
    case 'gt':
      return left > right
    case 'gte':
      return left >= right
    case 'lt':
      return left < right
    case 'lte':
      return left <= right
    case 'contains':
      return `${left}`.includes(`${right}`)
    default:
      return false
  }
}

const getDataRows = data => {
  if (!data) return []
  if (Array.isArray(data)) return data
  if (Array.isArray(data.tableRow)) return data.tableRow
  if (Array.isArray(data.data)) return data.data
  if (Array.isArray(data.series)) return data.series
  return []
}

const getDataFields = data => {
  if (!data) return []
  if (Array.isArray(data.fields)) return data.fields
  if (Array.isArray(data.sourceFields)) return data.sourceFields
  return []
}

const getDatasetConditionValue = (data, dataset: DatasetDisplayCondition) => {
  const rows = getDataRows(data)
  const row = rows[dataset.rowIndex || 0]
  if (!row) return undefined

  const fields = getDataFields(data)
  const field =
    fields.find(item => item.id === dataset.fieldId) ||
    fields.find(item => item.name === dataset.fieldName) ||
    fields.find(item => item.dataeaseName === dataset.fieldKey)
  const keys = [
    dataset.fieldKey,
    field?.dataeaseName,
    dataset.fieldName,
    field?.name,
    dataset.fieldId,
    field?.id
  ].filter(Boolean)
  const key = keys.find(item => Object.prototype.hasOwnProperty.call(row, item))
  return key ? row[key] : undefined
}

const resolveRuntimeVarVisible = (dc: DisplayCondition, context: VisibilityResolveContext) => {
  if (!dc.varKey) return true
  const v = context.runtimeVars?.[dc.varKey]
  if (v === undefined) return emptyResult(dc.emptyAs)
  return v === true
}

const resolveDatasetVisible = (dc: DisplayCondition, context: VisibilityResolveContext) => {
  const dataset = dc.dataset || DEFAULT_DATASET_DISPLAY_CONDITION
  if (!dataset.sourceViewId || !dataset.fieldKey) return emptyResult(dc.emptyAs)
  const data = context.getViewDataDetails?.(dataset.sourceViewId)
  const value = getDatasetConditionValue(data, dataset)
  if (isEmptyValue(value) && !['empty', 'notEmpty'].includes(dataset.operator)) {
    return emptyResult(dc.emptyAs)
  }
  return compareConditionValue(value, dataset.operator, dataset.compareValue, dataset.valueType)
}

/**
 * 统一组件显隐规则，供顶层画布和组合内递归预览复用。
 */
export const resolveComponentVisible = (item: any, context: VisibilityResolveContext) => {
  if (!item?.isShow) return false
  if (context.dvInfo?.type !== 'dataV' || !context.showPosition?.includes('preview')) return true

  const dc = item?.displayCondition as DisplayCondition
  if (!dc?.enabled) return true

  if ((dc.sourceType || 'runtimeVar') === 'dataset') {
    return resolveDatasetVisible(dc, context)
  }
  return resolveRuntimeVarVisible(dc, context)
}
