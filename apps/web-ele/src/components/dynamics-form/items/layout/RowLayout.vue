<script setup lang="ts">
import type { FormField } from '../../type';

import { ElRow } from 'element-plus';

defineProps<{
  field: string;
  formField: FormField;
  formfieldList?: Array<FormField>;
  formValue?: any;
  otherParams: any;
  view?: boolean;
}>();
</script>
<template>
  <ElRow />
</template>
