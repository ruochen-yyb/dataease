<script setup lang="ts">
import { computed, PropType, ref, toRefs } from 'vue'
import ComponentWrapper from '@/components/data-visualization/canvas/ComponentWrapper.vue'
import { toPercent } from '@/utils/translate'
import { dvMainStoreWithOut } from '@/store/modules/data-visualization/dvMain'
import UserViewEnlarge from '@/components/visualization/UserViewEnlarge.vue'
import { resolveComponentVisible } from '@/utils/visibilityCondition'
const dvMainStore = dvMainStoreWithOut()
const userViewEnlargeRef = ref(null)

const props = defineProps({
  propValue: {
    type: Array as PropType<any[]>,
    default: () => []
  },
  canvasStyleData: {
    type: Object,
    required: true
  },
  element: {
    type: Object,
    default() {
      return {
        propValue: null
      }
    }
  },
  showPosition: {
    type: String,
    required: false,
    default: 'canvas'
  },
  dvInfo: {
    type: Object,
    required: true
  },
  // 仪表板刷新计时器
  searchCount: {
    type: Number,
    required: false,
    default: 0
  },
  scale: {
    type: Number,
    required: false,
    default: 1
  },
  canvasViewInfo: {
    type: Object,
    required: true
  },
  // 字体
  fontFamily: {
    type: String,
    required: false,
    default: 'inherit'
  }
})

const { propValue, canvasStyleData, dvInfo, showPosition, searchCount, scale, canvasViewInfo } =
  toRefs(props)
const runtimeVars = computed(() => dvMainStore.getRuntimeVars(dvInfo.value.id))
const customGroupStyle = item => {
  return {
    width: toPercent(item.groupStyle.width),
    height: toPercent(item.groupStyle.height),
    top: toPercent(item.groupStyle.top),
    left: toPercent(item.groupStyle.left)
  }
}

const userViewEnlargeOpen = (opt, item) => {
  userViewEnlargeRef.value.dialogInit(
    dvMainStore.canvasStyleData,
    canvasViewInfo.value[item.id],
    item,
    opt,
    { scale: scale.value }
  )
}

// 组合内子组件复用顶层画布显隐规则，支持动态数据条件递归生效。
const finalShow = item => {
  return resolveComponentVisible(item, {
    dvInfo: dvInfo.value,
    showPosition: showPosition.value,
    runtimeVars: runtimeVars.value,
    getViewDataDetails: viewId => dvMainStore.getViewDataDetails(viewId)
  })
}
</script>

<template>
  <div class="group">
    <div>
      <component-wrapper
        v-for="(item, index) in propValue"
        :id="'component' + item.id"
        v-show="finalShow(item)"
        :view-info="canvasViewInfo[item.id]"
        :key="index"
        :config="item"
        :index="index"
        :canvas-style-data="canvasStyleData"
        :dv-info="dvInfo"
        :canvas-view-info="canvasViewInfo"
        :style="customGroupStyle(item)"
        :show-position="showPosition"
        :search-count="searchCount"
        :scale="scale"
        :font-family="fontFamily"
        @userViewEnlargeOpen="userViewEnlargeOpen($event, item)"
      />
    </div>
    <user-view-enlarge ref="userViewEnlargeRef"></user-view-enlarge>
  </div>
</template>

<style lang="less" scoped>
.group {
  & > div {
    position: relative;
    width: 100%;
    height: 100%;

    .component {
      position: absolute;
    }
  }
}
</style>
