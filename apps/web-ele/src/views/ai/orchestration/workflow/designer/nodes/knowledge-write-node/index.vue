<script setup lang="ts">
import NodeDataForm from '../../common/NodeDataForm.vue';

defineProps<{ nodeModel: any }>();
</script>

<template>
  <NodeDataForm :node-model="nodeModel" variant="knowledge-write-node" />
</template>
