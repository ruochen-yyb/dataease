<script setup lang="tsx">
import icon_info_outlined from '@/assets/svg/icon_info_outlined.svg'
import { dvMainStoreWithOut } from '@/store/modules/data-visualization/dvMain'
import { snapshotStoreWithOut } from '@/store/modules/data-visualization/snapshot'
import { storeToRefs } from 'pinia'
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { ElFormItem, ElIcon, ElMessage } from 'element-plus-secondary'

import { merge, cloneDeep } from 'lodash-es'
import { useEmitt } from '@/hooks/web/useEmitt'
import ComponentColorSelector from '@/components/dashboard/subject-setting/dashboard-style/ComponentColorSelector.vue'
import OverallSetting from '@/components/dashboard/subject-setting/dashboard-style/OverallSetting.vue'
import CanvasBackground from '@/components/visualization/component-background/CanvasBackground.vue'
import SeniorStyleSetting from '@/components/dashboard/subject-setting/dashboard-style/SeniorStyleSetting.vue'
import Icon from '../icon-custom/src/Icon.vue'
import CanvasBaseSetting from '@/components/visualization/CanvasBaseSetting.vue'
import { useI18n } from '@/hooks/web/useI18n'
import ValueFormatterSetting from '@/components/dashboard/subject-setting/dashboard-style/ValueFormatterSetting.vue'
import { formatterViewInfo } from '@/views/chart/components/js/formatter'
const dvMainStore = dvMainStoreWithOut()
const snapshotStore = snapshotStoreWithOut()
const { canvasStyleData, canvasViewInfo, componentData, dvInfo } = storeToRefs(dvMainStore)
let canvasAttrInit = false

const canvasAttrActiveNames = ref(['size', 'baseSetting', 'background', 'color'])
const { t } = useI18n()
const screenAdaptorList = [
  { label: t('visualization.screen_adaptor_width_first'), value: 'widthFirst' },
  { label: t('visualization.screen_adaptor_height_first'), value: 'heightFirst' },
  { label: t('visualization.screen_adaptor_full'), value: 'full' },
  { label: t('visualization.screen_adaptor_keep'), value: 'keep' },
  { label: t('visualization.screen_adaptor_keep_proportion'), value: 'keepProportion' }
]
const init = () => {
  nextTick(() => {
    canvasAttrInit = true
  })
}

// ===== 交互变量默认值（bool）=====
/**
 * 兼容旧数据：初始化画布级「交互变量默认值」容器。
 * 注意：不要在 computed 中做赋值（会触发 eslint: vue/no-side-effects-in-computed-properties）
 */
const ensureRuntimeVarsDefault = () => {
  if (!canvasStyleData.value.runtimeBoolVarsDefault) {
    canvasStyleData.value.runtimeBoolVarsDefault = {}
  }
}
watch(
  () => canvasStyleData.value?.runtimeBoolVarsDefault,
  v => {
    if (!v) ensureRuntimeVarsDefault()
  },
  { immediate: true }
)
const runtimeVarsDefault = computed(
  () => (canvasStyleData.value.runtimeBoolVarsDefault || {}) as Record<string, boolean>
)
const runtimeVarKeys = computed(() => Object.keys(runtimeVarsDefault.value))
/**
 * UI 输入态：用于编辑变量名（避免直接绑定到 key 导致不可编辑/回显异常）
 */
const runtimeVarNameDraft = ref<Record<string, string>>({})
watch(
  runtimeVarKeys,
  keys => {
    keys.forEach(k => {
      if (runtimeVarNameDraft.value[k] === undefined) {
        runtimeVarNameDraft.value[k] = k
      }
    })
  },
  { immediate: true }
)

const addRuntimeVar = () => {
  const keyBase = 'flag'
  let i = 1
  let key = keyBase
  while (runtimeVarsDefault.value[key] !== undefined) {
    key = `${keyBase}${i++}`
  }
  runtimeVarsDefault.value[key] = false
  runtimeVarNameDraft.value[key] = key
  snapshotStore.recordSnapshotCache('canvasChange')
}
const removeRuntimeVar = (key: string) => {
  delete runtimeVarsDefault.value[key]
  delete runtimeVarNameDraft.value[key]
  snapshotStore.recordSnapshotCache('canvasChange')
}
/**
 * 重命名全局变量：
 * - 更新画布默认值
 * - 同步更新所有组件引用（显隐/事件）
 * - 同步更新当前 dvId 的运行时变量池（用于编辑器预览立即生效）
 */
const renameRuntimeVar = (oldKey: string, newKey: string) => {
  const nk = (newKey || '').trim()
  if (!nk) {
    ElMessage.warning('变量名不能为空')
    runtimeVarNameDraft.value[oldKey] = oldKey
    return null
  }
  if (nk === oldKey) return oldKey
  if (runtimeVarsDefault.value[nk] !== undefined) {
    ElMessage.warning('变量名已存在')
    runtimeVarNameDraft.value[oldKey] = oldKey
    return null
  }
  const val = runtimeVarsDefault.value[oldKey]
  delete runtimeVarsDefault.value[oldKey]
  runtimeVarsDefault.value[nk] = !!val

  // 更新组件引用：displayCondition.varKey / events.setVar.varKey
  const updateBindings = (arr?: any[]) => {
    if (!arr) return
    arr.forEach(com => {
      if (com?.displayCondition?.varKey === oldKey) {
        com.displayCondition.varKey = nk
      }
      if (com?.events?.setVar?.varKey === oldKey) {
        com.events.setVar.varKey = nk
      }
      if (com?.component === 'Group') {
        updateBindings(com?.propValue)
      } else if (com?.component === 'DeTabs') {
        com?.propValue?.forEach(tabItem => updateBindings(tabItem?.componentData))
      }
    })
  }
  updateBindings(componentData.value)

  // 更新运行时变量池（编辑器预览/预览态立即生效）
  const vars = dvMainStore.getRuntimeVars(dvInfo.value.id)
  if (vars && Object.prototype.hasOwnProperty.call(vars, oldKey)) {
    vars[nk] = !!vars[oldKey]
    delete vars[oldKey]
  }

  // 更新输入态 key
  delete runtimeVarNameDraft.value[oldKey]
  runtimeVarNameDraft.value[nk] = nk
  snapshotStore.recordSnapshotCache('canvasChange')
  return nk
}

const commitRenameRuntimeVar = (oldKey: string) => {
  const draft = runtimeVarNameDraft.value[oldKey]
  renameRuntimeVar(oldKey, draft)
}

const onFormatterItemChange = val => {
  themeAttrChange('formatterCfg', 'formatterCfg', val)
}

const onColorChange = val => {
  themeAttrChange('customAttr', 'color', val)
}

const onStyleChange = () => {
  snapshotStore.recordSnapshotCache('renderChart')
}

const onBaseChange = () => {
  snapshotStore.recordSnapshotCache('renderChart')
  useEmitt().emitter.emit('initScroll')
}

const themeAttrChange = (custom, property, value) => {
  if (canvasAttrInit) {
    Object.keys(canvasViewInfo.value).forEach(function (viewId) {
      try {
        const viewInfo = canvasViewInfo.value[viewId]
        if (custom === 'formatterCfg') {
          formatterViewInfo(viewInfo, value)
        } else if (custom === 'customAttr') {
          if (viewInfo.type === 'flow-map') {
            const { customAttr } = viewInfo
            const tmpValue = cloneDeep(value)
            const miscObj = cloneDeep(customAttr.misc)
            for (const key in miscObj) {
              if (miscObj.hasOwnProperty(key) && tmpValue.misc?.[key] !== undefined) {
                tmpValue.misc[key] = miscObj[key]
              }
            }
            merge(viewInfo['customAttr'], tmpValue)
          } else {
            merge(viewInfo['customAttr'], value)
          }
        } else {
          Object.keys(value).forEach(function (key) {
            if (viewInfo[custom][property][key] !== undefined) {
              viewInfo[custom][property][key] = value[key]
            }
          })
        }
        useEmitt().emitter.emit('renderChart-' + viewId, viewInfo)
        if (viewInfo.type === 'rich-text') {
          useEmitt().emitter.emit('calcData-' + viewId, viewInfo)
        }
      } catch (e) {
        console.warn('themeAttrChange-error')
      }
    })
    snapshotStore.recordSnapshotCache('renderChart')
  }
}

onMounted(() => {
  init()
})
</script>

<template>
  <div class="attr-container de-collapse-style">
    <el-collapse v-model="canvasAttrActiveNames">
      <el-collapse-item effect="dark" :title="t('visualization.size')" name="size">
        <el-form label-position="left" :label-width="14">
          <el-row :gutter="8" class="m-size">
            <el-col :span="12">
              <el-form-item class="form-item form-item-dark" label="W">
                <el-input-number
                  effect="dark"
                  size="small"
                  :min="100"
                  :max="50000"
                  v-model="canvasStyleData.width"
                  @change="onBaseChange"
                  controls-position="right"
                />
              </el-form-item>
            </el-col>
            <el-col :span="12">
              <el-form-item class="form-item form-item-dark" label="H">
                <el-input-number
                  effect="dark"
                  size="small"
                  :min="100"
                  :max="50000"
                  v-model="canvasStyleData.height"
                  @change="onBaseChange"
                  controls-position="right"
                />
              </el-form-item>
            </el-col>
          </el-row>
          <el-row v-if="canvasStyleData.screenAdaptor">
            <el-form-item style="margin: 8px 0 16px">
              <span class="form-item-scroll"> {{ t('visualization.screen_adaptor') }} </span>
              <el-tooltip class="item" effect="dark" placement="top">
                <template #content>
                  <div>{{ t('visualization.effective_during_preview') }}</div>
                </template>
                <el-icon class="hint-icon--dark">
                  <Icon name="icon_info_outlined"><icon_info_outlined class="svg-icon" /></Icon>
                </el-icon>
              </el-tooltip>
              <el-select
                style="width: 139px; margin: 0 0 0 8px; flex: 1"
                effect="dark"
                v-model="canvasStyleData.screenAdaptor"
                @change="onStyleChange"
                size="small"
              >
                <el-option
                  v-for="option in screenAdaptorList"
                  size="small"
                  :key="option.value"
                  :label="option.label"
                  :value="option.value"
                />
              </el-select>
            </el-form-item>
          </el-row>
        </el-form>
      </el-collapse-item>
      <el-collapse-item effect="dark" :title="t('visualization.base_config')" name="baseSetting">
        <canvas-base-setting themes="dark"></canvas-base-setting>
      </el-collapse-item>
      <el-collapse-item effect="dark" :title="t('visualization.background')" name="background">
        <canvas-background themes="dark"></canvas-background>
      </el-collapse-item>
      <el-collapse-item
        effect="dark"
        :title="t('visualization.color_config')"
        name="color"
        class="no-padding no-border-bottom"
      >
        <component-color-selector themes="dark" @onColorChange="onColorChange" />
      </el-collapse-item>
      <el-collapse-item
        effect="dark"
        :title="t('visualization.refresh_config')"
        name="overallSetting"
      >
        <overall-setting style="padding-bottom: 8px" themes="dark" />
      </el-collapse-item>
      <el-collapse-item
        effect="dark"
        :title="t('visualization.number_formatter')"
        name="formatterItem"
      >
        <ValueFormatterSetting
          :formatter-cfg="canvasStyleData.component.formatterItem"
          themes="dark"
          @onFormatterItemChange="onFormatterItemChange"
        ></ValueFormatterSetting>
      </el-collapse-item>
      <el-collapse-item
        effect="dark"
        :title="t('visualization.advanced_style_settings')"
        name="seniorStyleSetting"
        class="no-padding no-border-bottom"
      >
        <senior-style-setting themes="dark"></senior-style-setting>
      </el-collapse-item>

      <!-- 交互变量默认值（MVP: bool，dataV 预览使用） -->
      <el-collapse-item
        effect="dark"
        :title="t('visualization.runtime_vars_default')"
        name="runtimeVars"
      >
        <div style="padding-bottom: 8px">
          <div
            style="
              display: flex;
              justify-content: space-between;
              align-items: center;
              margin-bottom: 8px;
            "
          >
            <span style="font-size: 12px; color: #fff">{{
              t('visualization.runtime_vars_default_tips')
            }}</span>
            <el-button type="primary" size="small" @click="addRuntimeVar">
              {{ t('commons.add') }}
            </el-button>
          </div>
          <div v-if="runtimeVarKeys.length === 0" style="font-size: 12px; opacity: 0.7">
            {{ t('visualization.runtime_vars_empty') }}
          </div>
          <div
            v-for="k in runtimeVarKeys"
            :key="k"
            style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px"
          >
            <el-input
              size="small"
              effect="dark"
              v-model="runtimeVarNameDraft[k]"
              @blur="() => commitRenameRuntimeVar(k)"
              @keyup.enter="() => commitRenameRuntimeVar(k)"
              style="flex: 1"
            />
            <el-switch
              v-model="runtimeVarsDefault[k]"
              size="small"
              @change="() => snapshotStore.recordSnapshotCache('canvasChange')"
            />
            <el-button size="small" type="danger" @click="removeRuntimeVar(k)">
              {{ t('commons.delete') }}
            </el-button>
          </div>
        </div>
      </el-collapse-item>
    </el-collapse>
  </div>
</template>

<style lang="less" scoped>
.form-item-scroll {
  font-size: 12px;
  color: @canvas-main-font-color-dark;
}
:deep(.ed-collapse-item) {
  &:first-child {
    .ed-collapse-item__header {
      border-top: none;
    }
  }
}

.de-collapse-style {
  :deep(.ed-collapse-item__header) {
    height: 36px !important;
    line-height: 36px !important;
    font-size: 12px !important;
    padding: 0 !important;
    font-weight: 500 !important;

    .ed-collapse-item__arrow {
      margin: 0 6px 0 8px;
    }
  }
  :deep(.ed-collapse-item__content) {
    padding: 16px 8px 0;
    border: none;
  }
  :deep(.ed-form-item) {
    display: block;
    margin-bottom: 8px;
  }
  :deep(.ed-form-item__label) {
    justify-content: flex-start;
  }
}

.item-show {
  display: flex;
  text-align: center;
  padding-top: 18px;
  min-width: 220px;
}

.attr-container {
  background-color: rgba(37, 45, 54, 1);
  color: #fff;
  z-index: 20;
  height: 100%;
  width: 100%;
  min-width: 220px;
}

:deep(.ed-collapse-item__wrap) {
  border-bottom: none;
}
:deep(.ed-collapse) {
  width: 100%;
}

.disabled :deep(.el-upload--picture-card) {
  display: none;
}

.avatar-uploader :deep(.ed-upload) {
  width: 80px;
  height: 80px;
  line-height: 90px;
}

.avatar-uploader :deep(.ed-upload-list li) {
  width: 80px !important;
  height: 80px !important;
}
.avatar-uploader :deep(.ed-upload--picture-card) {
  background: rgba(0, 0, 0, 0);
}
.img-area {
  width: 80px;
  height: 80px;
  margin-top: 0px;
  margin-bottom: 20px;
  overflow: hidden;
}

.color-picker-style {
  cursor: pointer;
  z-index: 1003;
}

.color-label {
  display: inline-block;
  width: 60px;
}

.color-type :deep(.ed-radio__input) {
  display: none;
}

.ed-radio {
  color: #757575;
}

.custom-color-style :deep(.ed-radio) {
  margin: 0 2px 0 0 !important;
  border: 1px solid transparent;
}

.custom-color-style :deep(.ed-radio__label) {
  padding-left: 0;
}

.custom-color-style :deep(.ed-radio.is-checked) {
  border: 1px solid #0a7be0;
}

.image-hint {
  color: #8f959e;
  size: 14px;
  line-height: 22px;
  font-weight: 400;
  margin-top: 2px;
}

.re-update-span {
  cursor: pointer;
  color: var(--ed-color-primary);
  size: 14px;
  line-height: 22px;
  font-weight: 400;
}

.m-size {
  :deep(.ed-form-item) {
    display: flex !important;
  }
}

:deep(.ed-form-item) {
  .ed-radio.ed-radio--small .ed-radio__inner {
    width: 14px;
    height: 14px;
  }
  .ed-input__inner {
    font-size: 12px;
    font-weight: 400;
  }
  .ed-input {
    --ed-input-height: 28px;

    .ed-input__suffix {
      height: 26px;
    }
  }
  .ed-input-number {
    width: 100%;

    .ed-input-number__decrease {
      --ed-input-number-controls-height: 13px;
    }
    .ed-input-number__increase {
      --ed-input-number-controls-height: 13px;
    }

    .ed-input__inner {
      text-align: start;
    }
  }
  .ed-select {
    width: 100%;
    .ed-input__inner {
      height: 26px !important;
    }
  }
  .ed-checkbox {
    .ed-checkbox__label {
      font-size: 12px;
    }
  }
  .ed-color-picker {
    .ed-color-picker__mask {
      height: 26px;
      width: calc(100% - 2px) !important;
    }
  }
  .ed-radio {
    height: 20px;
    .ed-radio__label {
      font-size: 12px;
      font-style: normal;
      font-weight: 400;
      line-height: 20px;
    }
  }

  &.margin-bottom-8 {
    margin-bottom: 8px;
  }
}
:deep(.ed-checkbox__label) {
  color: #1f2329;
  font-size: 12px;
  font-style: normal;
  font-weight: 400;
  line-height: 20px;
}
:deep(.ed-checkbox--dark) {
  .ed-checkbox__label {
    color: @dv-canvas-main-font-color;
  }
}

:deep(.ed-form-item__label) {
  color: @canvas-main-font-color;
  font-size: 12px;
  font-style: normal;
  font-weight: 400;
}
:deep(.form-item-dark) {
  .ed-form-item__label {
    color: @canvas-main-font-color-dark;
  }
}
.no-padding {
  :deep(.ed-collapse-item__content) {
    padding: 0 !important;
  }
}
.no-border-bottom {
  :deep(.ed-collapse-item__wrap) {
    border-bottom: none;
  }
}

.hint-icon--dark {
  color: #a6a6a6;
}
</style>
