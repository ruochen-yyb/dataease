<script setup lang="ts">
import icon_info_outlined from '@/assets/svg/icon_info_outlined.svg'
import { computed, onMounted, toRefs } from 'vue'
import { ElFormItem, ElIcon } from 'element-plus-secondary'
import { snapshotStoreWithOut } from '@/store/modules/data-visualization/snapshot'
import Icon from '../../components/icon-custom/src/Icon.vue'
import { dvMainStoreWithOut } from '@/store/modules/data-visualization/dvMain'
import { useI18n } from '@/hooks/web/useI18n'
import { storeToRefs } from 'pinia'
const dvMainStore = dvMainStoreWithOut()
const { componentData, canvasStyleData } = storeToRefs(dvMainStore)
const { t } = useI18n()

const snapshotStore = snapshotStoreWithOut()

const props = withDefaults(
  defineProps<{
    themes?: EditorTheme
    eventsInfo: any
  }>(),
  {
    themes: 'dark'
  }
)
const { themes, eventsInfo } = toRefs(props)
const isDashboard = dvMainStore.dvInfo.type === 'dashboard'

const curSupportEvents = computed(() => {
  if (isDashboard) {
    return ['jump', 'refreshDataV', 'fullScreen', 'download']
  } else {
    // dataV 支持弹窗区、交互变量等
    return ['jump', 'showHidden', 'setVar', 'refreshDataV', 'fullScreen', 'download']
  }
})
const onEventChange = () => {
  snapshotStore.recordSnapshotCacheToMobile('events')
}

const onJumpValueChange = () => {
  snapshotStore.recordSnapshotCacheToMobile('events')
}

// 兼容旧数据：补齐 setVar 默认结构，避免 UI 报错
onMounted(() => {
  if (!eventsInfo.value.setVar) {
    eventsInfo.value.setVar = { varKey: '', op: 'toggle', value: true }
  } else {
    eventsInfo.value.setVar.varKey = eventsInfo.value.setVar.varKey || ''
    eventsInfo.value.setVar.op = eventsInfo.value.setVar.op || 'toggle'
    if (eventsInfo.value.setVar.value === undefined) {
      eventsInfo.value.setVar.value = true
    }
  }
})

const getTypeLabel = type => {
  return typeMap[type] || type
}
const typeMap = {
  jump: t('visualization.jump'),
  download: t('visualization.download'),
  share: t('visualization.share'),
  fullScreen: t('visualization.fullscreen'),
  showHidden: t('visualization.pop_area'),
  setVar: t('visualization.set_var'),
  refreshDataV: t('visualization.refresh'),
  refreshView: t('visualization.refresh_view')
}

// setVar 的变量名候选：全局变量 + 页面引用过的变量名（允许自由输入）
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
</script>

<template>
  <el-row class="custom-row">
    <el-form label-position="top">
      <el-form-item class="form-item" :class="'form-item-' + themes">
        <el-checkbox
          :effect="themes"
          size="small"
          v-model="eventsInfo.checked"
          @change="onEventChange"
          >{{ t('visualization.enable_event_binding') }}</el-checkbox
        >
        <el-tooltip class="item" :effect="themes" placement="top">
          <template #content>
            <div>{{ t('visualization.event_binding_tips') }}</div>
          </template>
          <el-icon class="hint-icon" :class="{ 'hint-icon--dark': themes === 'dark' }">
            <Icon name="icon_info_outlined"><icon_info_outlined class="svg-icon" /></Icon>
          </el-icon>
        </el-tooltip>
      </el-form-item>

      <el-form-item class="form-item" :class="'form-item-' + themes" style="margin-bottom: 8px">
        <el-select
          v-model="eventsInfo.type"
          :disabled="!eventsInfo.checked"
          :effect="themes"
          @change="onEventChange"
          size="small"
        >
          <el-option
            v-for="typeInfo in eventsInfo.typeList"
            v-show="curSupportEvents.includes(typeInfo.key)"
            size="small"
            :effect="themes"
            :key="typeInfo.key"
            :label="getTypeLabel(typeInfo.label)"
            :value="typeInfo.key"
          />
        </el-select>
      </el-form-item>

      <el-form-item
        v-if="eventsInfo.type === 'jump'"
        class="form-item"
        :class="'form-item-' + themes"
        style="margin-bottom: 8px"
      >
        <el-input
          v-model="eventsInfo.jump.value"
          :effect="themes"
          :disabled="!eventsInfo.checked"
          clearable
          :placeholder="t('visualization.input_url_tips')"
          @change="onJumpValueChange"
        />
      </el-form-item>
      <el-form-item
        v-if="eventsInfo.type === 'jump' && eventsInfo.jump.type"
        class="form-item"
        :class="'form-item-' + themes"
        style="margin-bottom: 8px"
      >
        <el-radio-group
          size="small"
          v-model="eventsInfo.jump.type"
          :effect="themes"
          :disabled="!eventsInfo.checked"
          @change="onJumpValueChange"
        >
          <el-radio :effect="themes" label="_blank">{{ t('visualization.new_window') }}</el-radio>
          <el-radio :effect="themes" label="_self">{{ t('visualization.now_window') }}</el-radio>
          <el-radio :effect="themes" label="newPop">{{ t('visualization.pop_window') }}</el-radio>
        </el-radio-group>
      </el-form-item>

      <!-- setVar：交互变量（bool） -->
      <template v-if="eventsInfo.type === 'setVar'">
        <el-form-item class="form-item" :class="'form-item-' + themes" style="margin-bottom: 8px">
          <span style="display: inline-block; margin-bottom: 6px">{{
            t('visualization.var_name')
          }}</span>
          <el-select
            v-model="eventsInfo.setVar.varKey"
            :effect="themes"
            :disabled="!eventsInfo.checked"
            filterable
            allow-create
            default-first-option
            clearable
            :placeholder="t('visualization.var_name_placeholder')"
            @change="onEventChange"
            size="small"
          >
            <el-option v-for="k in varKeyOptions" :key="k" :label="k" :value="k" />
          </el-select>
        </el-form-item>
        <el-form-item class="form-item" :class="'form-item-' + themes" style="margin-bottom: 8px">
          <el-radio-group
            size="small"
            v-model="eventsInfo.setVar.op"
            :effect="themes"
            :disabled="!eventsInfo.checked"
            @change="onEventChange"
          >
            <el-radio :effect="themes" label="toggle">{{ t('visualization.var_toggle') }}</el-radio>
            <el-radio :effect="themes" label="set">{{ t('visualization.var_set') }}</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item
          v-if="eventsInfo.setVar.op === 'set'"
          class="form-item"
          :class="'form-item-' + themes"
          style="margin-bottom: 8px"
        >
          <span style="display: inline-block; margin-bottom: 6px">{{
            t('visualization.var_set_value')
          }}</span>
          <el-switch
            v-model="eventsInfo.setVar.value"
            :disabled="!eventsInfo.checked"
            @change="onEventChange"
            size="small"
          />
        </el-form-item>
      </template>
    </el-form>
  </el-row>
</template>

<style scoped lang="less">
.form-item-light {
  .ed-radio {
    margin-right: 3px !important;
  }
}
.form-item-dark {
  .ed-radio {
    margin-right: 3px !important;
  }
}
</style>
