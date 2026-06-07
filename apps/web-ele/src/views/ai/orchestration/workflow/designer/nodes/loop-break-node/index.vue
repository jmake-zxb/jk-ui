<script setup lang="ts">
import LoopControlConditionEditor from '../loop-control-condition-editor.vue';

defineProps<{ nodeModel: any }>();
</script>

<template>
  <LoopControlConditionEditor :node-model="nodeModel" />
</template>
