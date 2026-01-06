<script setup lang="ts">
import { computed, nextTick, onMounted, ref, toRefs } from 'vue'
import { dvMainStoreWithOut } from '@/store/modules/data-visualization/dvMain'
import { storeToRefs } from 'pinia'
import ComponentPosition from '@/components/visualization/common/ComponentPosition.vue'
import BackgroundOverallCommon from '@/components/visualization/component-background/BackgroundOverallCommon.vue'
import { useI18n } from '@/hooks/web/useI18n'
import elementResizeDetectorMaker from 'element-resize-detector'
import { snapshotStoreWithOut } from '@/store/modules/data-visualization/snapshot'
import CommonStyleSet from '@/custom-component/common/CommonStyleSet.vue'
import CommonEvent from '@/custom-component/common/CommonEvent.vue'
import CarouselSetting from '@/custom-component/common/CarouselSetting.vue'
import CommonBorderSetting from '@/custom-component/common/CommonBorderSetting.vue'
import CollapseSwitchItem from '../../components/collapse-switch-item/src/CollapseSwitchItem.vue'
import TabBackgroundOverall from '@/custom-component/de-tabs/TabBackgroundOverall.vue'
const snapshotStore = snapshotStoreWithOut()

const { t } = useI18n()
const emits = defineEmits(['onAttrChange'])

const props = withDefaults(
  defineProps<{
    type?: 'light' | 'dark'
    themes?: EditorTheme
    element: any
    showStyle: boolean
    backgroundColorPickerWidth?: number
    backgroundBorderSelectWidth?: number
  }>(),
  {
    showStyle: true,
    themes: 'dark',
    backgroundColorPickerWidth: 50,
    backgroundBorderSelectWidth: 108
  }
)

const { themes, element } = toRefs(props)
const dvMainStore = dvMainStoreWithOut()
const { dvInfo, batchOptStatus, mobileInPc, componentData, canvasStyleData } =
  storeToRefs(dvMainStore)
const activeName = ref(element.value.collapseName)

const onChange = () => {
  element.value.collapseName = activeName
}

const positionComponentShow = computed(() => {
  return !batchOptStatus.value && !dashboardActive.value
})

const dashboardActive = computed(() => {
  return dvInfo.value.type === 'dashboard'
})

const onBackgroundChange = val => {
  element.value.commonBackground = val
  snapshotStore.recordSnapshotCacheToMobile('commonBackground')
  emits('onAttrChange', { custom: 'commonBackground' })
}

const onTitleBackgroundEnableChange = () => {
  snapshotStore.recordSnapshotCacheToMobile('titleBackground')
}

const onTitleBackgroundChange = val => {
  element.value.titleBackground = val
  snapshotStore.recordSnapshotCacheToMobile('titleBackground')
  emits('onAttrChange', { custom: 'titleBackground' })
}

const onStyleAttrChange = ({ key, value }) => {
  snapshotStore.recordSnapshotCacheToMobile('style')
  emits('onAttrChange', { custom: 'style', property: key, value: value })
}

const containerRef = ref()
const containerWidth = ref()

const borderSettingShow = computed(() => {
  return (
    !!element.value.style['borderStyle'] &&
    !['DeDecoration', 'DynamicBackground'].includes(element.value.component)
  )
})

// 暂时关闭
const eventsShow = computed(() => {
  return (
    ['Picture', 'CanvasIcon', 'CircleShape', 'SvgTriangle', 'RectShape', 'ScrollText'].includes(
      element.value.component
    ) || element.value.innerType === 'rich-text'
  )
})

// -------- 变量控制显隐（仅预览态生效；编辑态用于配置）--------
// 兼容旧数据：补齐默认结构，避免 UI 报错
onMounted(() => {
  if (!element.value.displayCondition) {
    element.value.displayCondition = {
      enabled: false,
      varKey: '',
      emptyAs: 'hide',
      showClose: true
    }
  } else {
    element.value.displayCondition.enabled = !!element.value.displayCondition.enabled
    element.value.displayCondition.varKey = element.value.displayCondition.varKey || ''
    element.value.displayCondition.emptyAs = element.value.displayCondition.emptyAs || 'hide'
    if (element.value.displayCondition.showClose === undefined) {
      element.value.displayCondition.showClose = true
    }
  }
})

// 从页面引用的变量名中生成下拉候选（允许自由输入）
const varKeyOptions = computed(() => {
  const keys = new Set<string>()
  // 画布全局默认变量
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

const onDisplayConditionChange = () => {
  // 记录快照，保证配置可保存（编辑态不生效，预览态生效）
  snapshotStore.recordSnapshotCacheToMobile('displayCondition')
  emits('onAttrChange', { custom: 'displayCondition' })
}

const carouselShow = computed(() => {
  return (
    ['DeTabs', 'DeScreen'].includes(element.value.component) &&
    element.value.carousel &&
    !mobileInPc.value
  )
})

const backgroundCustomShow = computed(() => {
  return (
    dashboardActive.value ||
    (!dashboardActive.value &&
      ![
        'CanvasBoard',
        'CanvasIcon',
        'CircleShape',
        'RectShape',
        'DeDecoration',
        'DynamicBackground'
      ].includes(element.value.component))
  )
})

const titleBackgroundShow = computed(
  () => ['DeTabs', 'DeScreen'].includes(element.value.component) && element.value.titleBackground
)

const tabTitleShow = computed(() => {
  return (
    element.value && element.value.style && ['DeTabs', 'DeScreen'].includes(element.value.component)
  )
})

const styleShow = computed(() => {
  return (
    element.value &&
    element.value.style &&
    !['DeDecoration', 'DynamicBackground', 'DeTabs', 'DeScreen'].includes(
      element.value.component
    ) &&
    Object.keys(element.value.style).length > 0
  )
})

onMounted(() => {
  const erd = elementResizeDetectorMaker()
  containerWidth.value = containerRef.value?.offsetWidth
  erd.listenTo(containerRef.value, () => {
    nextTick(() => {
      containerWidth.value = containerRef.value?.offsetWidth
    })
  })
})
</script>

<template>
  <div class="v-common-attr" ref="containerRef">
    <el-collapse v-model="activeName" @change="onChange()">
      <el-collapse-item
        :effect="themes"
        :title="t('visualization.position')"
        name="position"
        v-if="positionComponentShow"
      >
        <component-position :themes="themes" />
      </el-collapse-item>
      <el-collapse-item
        :effect="themes"
        :title="t('visualization.background')"
        name="background"
        v-if="element && backgroundCustomShow"
      >
        <background-overall-common
          :themes="themes"
          :common-background-pop="element.commonBackground"
          component-position="component"
          @onBackgroundChange="onBackgroundChange"
          :background-color-picker-width="backgroundColorPickerWidth"
          :background-border-select-width="backgroundBorderSelectWidth"
        />
      </el-collapse-item>

      <collapse-switch-item
        :effect="themes"
        :title="t('visualization.title_background')"
        name="titleBackground"
        v-model="element.titleBackground.enable"
        @modelChange="val => onTitleBackgroundEnableChange(val)"
        v-if="element && titleBackgroundShow"
      >
        <tab-background-overall
          :themes="themes"
          :element="element"
          component-position="component"
          @onTitleBackgroundChange="onTitleBackgroundChange"
        ></tab-background-overall>
      </collapse-switch-item>
      <slot></slot>
      <collapse-switch-item
        v-if="tabTitleShow"
        v-model="element.style.showTabTitle"
        @modelChange="val => onStyleAttrChange({ key: 'showTabTitle', value: val })"
        :themes="themes"
        :title="t('visualization.tab_title')"
        name="tabTitle"
        class="common-style-area"
      >
        <common-style-set
          @onStyleAttrChange="onStyleAttrChange"
          :themes="themes"
          :element="element"
        ></common-style-set>
      </collapse-switch-item>
      <el-collapse-item
        v-if="styleShow"
        :effect="themes"
        :title="t('visualization.style')"
        name="style"
        class="common-style-area"
      >
        <common-style-set
          @onStyleAttrChange="onStyleAttrChange"
          :themes="themes"
          :element="element"
        ></common-style-set>
      </el-collapse-item>
      <el-collapse-item
        v-if="element && element.events && eventsShow"
        :effect="themes"
        :title="t('visualization.event')"
        name="events"
        class="common-style-area"
      >
        <common-event :themes="themes" :events-info="element.events"></common-event>
      </el-collapse-item>

      <!-- 显隐（变量控制）：变量为 true 显示；编辑态仅配置，预览态生效 -->
      <collapse-switch-item
        v-model="element.displayCondition.enabled"
        @modelChange="onDisplayConditionChange"
        :themes="themes"
        :title="t('visualization.visibility_by_var')"
        name="displayCondition"
        class="common-style-area"
      >
        <el-form label-position="top">
          <el-form-item class="form-item" :class="'form-item-' + themes" style="margin-bottom: 8px">
            <span style="display: inline-block; margin-bottom: 6px">{{
              t('visualization.var_name')
            }}</span>
            <el-select
              v-model="element.displayCondition.varKey"
              :effect="themes"
              filterable
              allow-create
              default-first-option
              clearable
              :placeholder="t('visualization.var_name_placeholder')"
              @change="onDisplayConditionChange"
              size="small"
            >
              <el-option v-for="k in varKeyOptions" :key="k" :label="k" :value="k" />
            </el-select>
          </el-form-item>
          <div style="margin-bottom: 10px; font-size: 12px; opacity: 0.8">
            {{ t('visualization.var_true_show') }}
          </div>
          <el-form-item class="form-item" :class="'form-item-' + themes" style="margin-bottom: 8px">
            <span style="display: inline-block; margin-bottom: 6px">{{
              t('visualization.var_missing_strategy')
            }}</span>
            <el-radio-group
              size="small"
              v-model="element.displayCondition.emptyAs"
              :effect="themes"
              @change="onDisplayConditionChange"
            >
              <el-radio :effect="themes" label="hide">{{ t('visualization.hide') }}</el-radio>
              <el-radio :effect="themes" label="show">{{ t('visualization.show') }}</el-radio>
            </el-radio-group>
          </el-form-item>
          <el-form-item class="form-item" :class="'form-item-' + themes" style="margin-bottom: 0">
            <el-checkbox
              :effect="themes"
              size="small"
              v-model="element.displayCondition.showClose"
              @change="onDisplayConditionChange"
            >
              {{ t('visualization.show_close_button') }}
            </el-checkbox>
          </el-form-item>
        </el-form>
      </collapse-switch-item>
      <collapse-switch-item
        v-if="element && borderSettingShow"
        v-model="element.style.borderActive"
        @modelChange="val => onStyleAttrChange({ key: 'borderActive', value: val })"
        :themes="themes"
        :title="t('visualization.board')"
        name="borderSetting"
        class="common-style-area"
      >
        <common-border-setting
          :style-info="element.style"
          :themes="themes"
          @onStyleAttrChange="onStyleAttrChange"
        ></common-border-setting>
      </collapse-switch-item>
      <slot name="threshold" />
      <slot name="carousel" />
      <CarouselSetting v-if="carouselShow" :element="element" :themes="themes"></CarouselSetting>
    </el-collapse>
  </div>
</template>

<style lang="less" scoped>
.v-common-attr {
  .ed-input-group__prepend {
    padding: 0 10px;
  }
  :deep(.ed-collapse-item__content) {
    border-top: none;
  }

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
    padding: 16px 8px 8px !important;
    border: none;
  }
  :deep(.ed-form-item) {
    display: block;
    margin-bottom: 16px;
  }
  :deep(.ed-form-item__label) {
    justify-content: flex-start;
  }
}

:deep(.ed-collapse-item) {
  &:first-child {
    .ed-collapse-item__header {
      border-top: none;
    }
  }
}

:deep(.ed-collapse) {
  width: 100%;
}

.attr-custom-icon-main {
  padding-top: 4px;
  width: 30px;
  overflow: hidden;
  text-align: right;
}

.attr-custom-icon {
  font-size: 16px;
  color: #646a73;
  margin-right: 5px;
}

.common-style-inner {
  width: 100%;
  min-width: 230px;
  margin-left: -12px;
}

.bash-icon {
  width: 24px;
  height: 24px;
}

.custom-color {
  margin-left: 4px;
}

:deep(.ed-color-picker.is-custom .ed-color-picker__mask) {
  height: 26px;
  width: 48px;
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

.icon-radio-group {
  :deep(.ed-radio) {
    margin-right: 8px;
    height: 28px;

    &:last-child {
      margin-right: 0;
    }
  }
  :deep(.ed-radio__input) {
    display: none;
  }
  :deep(.ed-radio__label) {
    padding: 0;
  }
}
.icon-btn {
  font-size: 16px;
  line-height: 16px;
  width: 24px;
  height: 24px;
  text-align: center;
  border-radius: 4px;
  padding-top: 4px;

  color: #1f2329;

  cursor: pointer;

  &.dark {
    color: #a6a6a6;
    &.active {
      color: var(--ed-color-primary);
      background-color: var(--ed-color-primary-1a, rgba(51, 112, 255, 0.1));
    }
    &:hover {
      background-color: rgba(255, 255, 255, 0.1);
    }
  }

  &.active {
    color: var(--ed-color-primary);
    background-color: var(--ed-color-primary-1a, rgba(51, 112, 255, 0.1));
  }

  &:hover {
    background-color: rgba(31, 35, 41, 0.1);
  }
}
</style>
