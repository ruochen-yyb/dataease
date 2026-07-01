<script setup lang="ts">
import { computed, PropType, toRefs, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { dvMainStoreWithOut } from '@/store/modules/data-visualization/dvMain'
import { useI18n } from '@/hooks/web/useI18n'
import { normalizeDisplayCondition } from '@/utils/visibilityCondition'

const props = defineProps({
  themes: {
    type: String as PropType<EditorTheme>,
    default: 'dark'
  },
  element: {
    type: Object,
    required: true
  }
})

const emits = defineEmits(['change'])
const { themes, element } = toRefs(props)
const { t } = useI18n()
const dvMainStore = dvMainStoreWithOut()
const { componentData, canvasStyleData, canvasViewInfo } = storeToRefs(dvMainStore)

watch(
  () => element.value,
  value => {
    if (value) {
      normalizeDisplayCondition(value)
    }
  },
  { immediate: true }
)

const onChange = () => {
  emits('change')
}

const displayCondition = computed(() => element.value.displayCondition)

// 从页面引用的变量名中生成下拉候选（允许自由输入）。
const varKeyOptions = computed(() => {
  const keys = new Set<string>()
  const globalVars = canvasStyleData.value?.runtimeBoolVarsDefault || {}
  Object.keys(globalVars).forEach(k => keys.add(k))
  const walk = (arr?: any[]) => {
    if (!arr) return
    arr.forEach(com => {
      const dcKey = com?.displayCondition?.varKey
      if (dcKey) keys.add(dcKey)
      const evKey = com?.events?.setVar?.varKey
      if (evKey) keys.add(evKey)
      if (com?.component === 'Group') {
        walk(com?.propValue)
      } else if (com?.component === 'DeTabs') {
        com?.propValue?.forEach(tabItem => walk(tabItem?.componentData))
      }
    })
  }
  walk(componentData.value)
  return Array.from(keys).sort()
})

const componentName = (com, viewInfo) => {
  return com?.name || com?.label || viewInfo?.title || viewInfo?.name || com?.id
}

const sourceOptionLabel = option => {
  return `${option.label}${option.type ? `（${option.type}）` : ''}`
}

const sourceComponentOptions = computed(() => {
  const result = []
  const walk = (arr?: any[]) => {
    if (!arr) return
    arr.forEach(com => {
      const viewInfo = canvasViewInfo.value?.[com?.id]
      if (com?.component === 'UserView' && viewInfo) {
        result.push({
          value: com.id,
          label: componentName(com, viewInfo),
          type: viewInfo.type || com.innerType
        })
      }
      if (com?.component === 'Group') {
        walk(com?.propValue)
      } else if (com?.component === 'DeTabs') {
        com?.propValue?.forEach(tabItem => walk(tabItem?.componentData))
      }
    })
  }
  walk(componentData.value)
  return result
})

const getDataFields = data => {
  if (Array.isArray(data?.fields)) return data.fields
  if (Array.isArray(data?.sourceFields)) return data.sourceFields
  return []
}

const normalizeField = field => {
  const fieldKey = field?.dataeaseName || field?.fieldKey || field?.id || field?.name
  return {
    value: fieldKey,
    label: field?.name || field?.chartShowName || fieldKey,
    fieldId: field?.id || '',
    fieldName: field?.name || field?.chartShowName || fieldKey,
    fieldKey
  }
}

const fieldOptions = computed(() => {
  const sourceViewId = displayCondition.value?.dataset?.sourceViewId
  if (!sourceViewId) return []
  const viewInfo = canvasViewInfo.value?.[sourceViewId] || {}
  const data = dvMainStore.getViewDataDetails(sourceViewId) || {}
  const fields = [
    ...(Array.isArray(viewInfo.curFields) ? viewInfo.curFields : []),
    ...getDataFields(data),
    ...(Array.isArray(viewInfo.xAxis) ? viewInfo.xAxis : []),
    ...(Array.isArray(viewInfo.yAxis) ? viewInfo.yAxis : []),
    ...(Array.isArray(viewInfo.extBubble) ? viewInfo.extBubble : [])
  ]
  const map = new Map<string, any>()
  fields.map(normalizeField).forEach(field => {
    if (field.value && !map.has(field.value)) {
      map.set(field.value, field)
    }
  })
  return Array.from(map.values())
})

const operatorOptions = computed(() => [
  { label: t('visualization.operator_eq'), value: 'eq' },
  { label: t('visualization.operator_ne'), value: 'ne' },
  { label: t('visualization.operator_gt'), value: 'gt' },
  { label: t('visualization.operator_gte'), value: 'gte' },
  { label: t('visualization.operator_lt'), value: 'lt' },
  { label: t('visualization.operator_lte'), value: 'lte' },
  { label: t('visualization.operator_contains'), value: 'contains' },
  { label: t('visualization.operator_empty'), value: 'empty' },
  { label: t('visualization.operator_not_empty'), value: 'notEmpty' }
])

const onSourceTypeChange = () => {
  if (displayCondition.value.sourceType === 'dataset') {
    const dataset = displayCondition.value.dataset
    if (!dataset.sourceViewId && canvasViewInfo.value?.[element.value.id]) {
      dataset.sourceViewId = element.value.id
    }
  }
  onChange()
}

const onSourceViewChange = () => {
  const dataset = displayCondition.value.dataset
  dataset.fieldId = ''
  dataset.fieldName = ''
  dataset.fieldKey = ''
  onChange()
}

const onFieldChange = value => {
  const field = fieldOptions.value.find(item => item.value === value)
  const dataset = displayCondition.value.dataset
  dataset.fieldId = field?.fieldId || ''
  dataset.fieldName = field?.fieldName || ''
  dataset.fieldKey = field?.fieldKey || value
  onChange()
}

const compareValueShow = computed(
  () => !['empty', 'notEmpty'].includes(displayCondition.value?.dataset?.operator)
)
</script>

<template>
  <el-form label-position="top">
    <el-form-item class="form-item" :class="'form-item-' + themes" style="margin-bottom: 8px">
      <span style="display: inline-block; margin-bottom: 6px">
        {{ t('visualization.visibility_source') }}
      </span>
      <el-radio-group
        size="small"
        v-model="displayCondition.sourceType"
        :effect="themes"
        @change="onSourceTypeChange"
      >
        <el-radio :effect="themes" label="runtimeVar">
          {{ t('visualization.visibility_source_runtime_var') }}
        </el-radio>
        <el-radio :effect="themes" label="dataset">
          {{ t('visualization.visibility_source_dataset') }}
        </el-radio>
      </el-radio-group>
    </el-form-item>

    <template v-if="displayCondition.sourceType === 'dataset'">
      <el-form-item class="form-item" :class="'form-item-' + themes" style="margin-bottom: 8px">
        <span style="display: inline-block; margin-bottom: 6px">
          {{ t('visualization.data_source_component') }}
        </span>
        <el-select
          v-model="displayCondition.dataset.sourceViewId"
          :effect="themes"
          filterable
          clearable
          :placeholder="t('visualization.data_source_placeholder')"
          @change="onSourceViewChange"
          size="small"
        >
          <el-option
            v-for="option in sourceComponentOptions"
            :key="option.value"
            :label="sourceOptionLabel(option)"
            :value="option.value"
          />
        </el-select>
      </el-form-item>
      <el-form-item class="form-item" :class="'form-item-' + themes" style="margin-bottom: 8px">
        <span style="display: inline-block; margin-bottom: 6px">
          {{ t('visualization.dataset_field') }}
        </span>
        <el-select
          v-model="displayCondition.dataset.fieldKey"
          :effect="themes"
          filterable
          clearable
          :placeholder="t('visualization.dataset_field_placeholder')"
          @change="onFieldChange"
          size="small"
        >
          <el-option
            v-for="field in fieldOptions"
            :key="field.value"
            :label="field.label"
            :value="field.value"
          />
        </el-select>
      </el-form-item>
      <el-form-item class="form-item" :class="'form-item-' + themes" style="margin-bottom: 8px">
        <span style="display: inline-block; margin-bottom: 6px">
          {{ t('visualization.value_type') }}
        </span>
        <el-select
          v-model="displayCondition.dataset.valueType"
          :effect="themes"
          @change="onChange"
          size="small"
        >
          <el-option :label="t('visualization.value_type_string')" value="string" />
          <el-option :label="t('visualization.value_type_number')" value="number" />
          <el-option :label="t('visualization.value_type_boolean')" value="boolean" />
        </el-select>
      </el-form-item>
      <el-form-item class="form-item" :class="'form-item-' + themes" style="margin-bottom: 8px">
        <span style="display: inline-block; margin-bottom: 6px">
          {{ t('visualization.compare_operator') }}
        </span>
        <el-select
          v-model="displayCondition.dataset.operator"
          :effect="themes"
          @change="onChange"
          size="small"
        >
          <el-option
            v-for="option in operatorOptions"
            :key="option.value"
            :label="option.label"
            :value="option.value"
          />
        </el-select>
      </el-form-item>
      <el-form-item
        v-if="compareValueShow"
        class="form-item"
        :class="'form-item-' + themes"
        style="margin-bottom: 8px"
      >
        <span style="display: inline-block; margin-bottom: 6px">
          {{ t('visualization.compare_value') }}
        </span>
        <el-switch
          v-if="displayCondition.dataset.valueType === 'boolean'"
          v-model="displayCondition.dataset.compareValue"
          size="small"
          @change="onChange"
        />
        <el-input-number
          v-else-if="displayCondition.dataset.valueType === 'number'"
          v-model="displayCondition.dataset.compareValue"
          :effect="themes"
          size="small"
          controls-position="right"
          @change="onChange"
        />
        <el-input
          v-else
          v-model="displayCondition.dataset.compareValue"
          :effect="themes"
          size="small"
          @change="onChange"
        />
      </el-form-item>
    </template>

    <template v-else>
      <el-form-item class="form-item" :class="'form-item-' + themes" style="margin-bottom: 8px">
        <span style="display: inline-block; margin-bottom: 6px">
          {{ t('visualization.var_name') }}
        </span>
        <el-select
          v-model="displayCondition.varKey"
          :effect="themes"
          filterable
          allow-create
          default-first-option
          clearable
          :placeholder="t('visualization.var_name_placeholder')"
          @change="onChange"
          size="small"
        >
          <el-option v-for="k in varKeyOptions" :key="k" :label="k" :value="k" />
        </el-select>
      </el-form-item>
      <div style="margin-bottom: 10px; font-size: 12px; opacity: 0.8">
        {{ t('visualization.var_true_show') }}
      </div>
    </template>

    <el-form-item class="form-item" :class="'form-item-' + themes" style="margin-bottom: 8px">
      <span style="display: inline-block; margin-bottom: 6px">
        {{ t('visualization.var_missing_strategy') }}
      </span>
      <el-radio-group
        size="small"
        v-model="displayCondition.emptyAs"
        :effect="themes"
        @change="onChange"
      >
        <el-radio :effect="themes" label="hide">{{ t('visualization.hide') }}</el-radio>
        <el-radio :effect="themes" label="show">{{ t('visualization.show') }}</el-radio>
      </el-radio-group>
    </el-form-item>
    <el-form-item class="form-item" :class="'form-item-' + themes" style="margin-bottom: 0">
      <el-checkbox
        :effect="themes"
        size="small"
        v-model="displayCondition.showClose"
        @change="onChange"
      >
        {{ t('visualization.show_close_button') }}
      </el-checkbox>
    </el-form-item>
  </el-form>
</template>
