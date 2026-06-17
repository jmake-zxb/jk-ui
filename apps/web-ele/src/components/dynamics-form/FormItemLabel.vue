<script setup lang="ts">
import type { FormField } from './type';

defineProps<{
  formField: FormField;
}>();
</script>

<template>
  {{ formField.label }}
</template>
