<script setup lang="ts">
import NodeDataForm from '../../common/NodeDataForm.vue';

defineProps<{ nodeModel: any }>();
</script>

<template>
  <NodeDataForm :node-model="nodeModel" variant="speech-to-text-node" />
</template>
