<script setup lang="ts">
import { ElSlider } from 'element-plus';
</script>
<template>
  <ElSlider
    v-bind="$attrs"
    show-input
    :show-input-controls="false"
    class="custom-slider"
  />
</template>
