<script setup lang="ts">
import { ref } from 'vue';

import { ArrowDown, Check } from '@element-plus/icons-vue';
import {
  ElCard,
  ElCol,
  ElDialog,
  ElDropdown,
  ElDropdownItem,
  ElDropdownMenu,
  ElIcon,
  ElRow,
} from 'element-plus';

import { getProviderByModelType } from '#/api/ai/models';
import { providerList } from '#/components/dynamics-form/items/model/provider-data';

import { modelTypeList } from '../data';

interface Provider {
  icon?: string;
  name: string;
  provider: string;
}

const emit = defineEmits<{
  change: [provider: Provider, modelType: string];
}>();

const loading = ref(false);
const dialogVisible = ref(false);
const listProvider = ref<Array<Provider>>([]);
const currentModelType = ref('');
const selectModelType = ref('');

interface ModelTypeOption {
  label: string;
  value: string;
}

const modelTypeOptions: ModelTypeOption[] = [
  { label: '全部模型', value: '' },
  ...modelTypeList,
];

/** Lookup provider icon SVG string from provider-data.ts */
function getProviderIcon(item: Provider): string {
  const found = providerList.find((p) => p.provider === item.provider);
  if (found?.icon) return found.icon;
  if (item.icon && item.icon.trim().startsWith('<')) return item.icon;
  return '';
}

function open(modelType?: string) {
  dialogVisible.value = true;
  const option = modelTypeOptions.find(
    (item) => item.label === currentModelType.value,
  );
  checkModelType(modelType ?? option?.value ?? '');
}

function close() {
  dialogVisible.value = false;
}

function checkModelType(modelType: string) {
  selectModelType.value = modelType;
  const option = modelTypeOptions.find((item) => item.value === modelType);
  currentModelType.value = option?.label ?? '';
  loading.value = true;
  getProviderByModelType(modelType || undefined)
    .then((res) => {
      const data = Array.isArray(res)
        ? res
        : ((res as { data?: Provider[] })?.data ?? []);
      listProvider.value = data
        .filter((item) => item.provider)
        .toSorted((a, b) => a.provider.localeCompare(b.provider));
    })
    .catch(() => {
      listProvider.value = [];
    })
    .finally(() => {
      loading.value = false;
    });
}

function goCreate(provider: Provider) {
  close();
  emit('change', provider, selectModelType.value);
}

defineExpose({ open, close });
</script>

<template>
  <ElDialog
    v-model="dialogVisible"
    width="600px"
    :close-on-click-modal="false"
    :close-on-press-escape="false"
    :destroy-on-close="true"
    :before-close="close"
    append-to-body
  >
    <template #header>
      <div class="dialog-header">
        <h4 class="dialog-title">选择供应商</h4>
        <ElDropdown trigger="click">
          <span class="type-filter">
            {{ currentModelType || '全部模型' }}
            <ElIcon class="type-filter-icon"><ArrowDown /></ElIcon>
          </span>
          <template #dropdown>
            <ElDropdownMenu>
              <ElDropdownItem
                v-for="item in modelTypeOptions"
                :key="item.value"
                class="type-option"
                :class="{ active: currentModelType === item.label }"
                @click="checkModelType(item.value)"
              >
                <span>{{ item.label }}</span>
                <ElIcon
                  v-if="currentModelType === item.label"
                  class="check-icon"
                >
                  <Check />
                </ElIcon>
              </ElDropdownItem>
            </ElDropdownMenu>
          </template>
        </ElDropdown>
      </div>
    </template>

    <ElRow v-loading="loading" :gutter="12">
      <ElCol
        v-for="(data, index) in listProvider"
        :key="index"
        :span="12"
        class="provider-col"
      >
        <ElCard shadow="hover" class="provider-card" @click="goCreate(data)">
          <div class="provider-card-inner">
            <span
              class="provider-card-icon"
              v-safe-html="getProviderIcon(data)"
            ></span>
            <span class="provider-card-name">{{ data.name }}</span>
          </div>
        </ElCard>
      </ElCol>
      <ElCol
        v-if="!loading && listProvider.length === 0"
        :span="24"
        class="empty-col"
      >
        暂无可选供应商
      </ElCol>
    </ElRow>
  </ElDialog>
</template>

<style lang="scss" scoped>
.dialog-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.dialog-title {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
}

.type-filter {
  display: flex;
  align-items: center;
  font-size: 14px;
  color: var(--el-text-color-regular);
  cursor: pointer;

  &:hover {
    color: var(--el-color-primary);
  }

  .type-filter-icon {
    margin-left: 4px;
  }
}

.type-option {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 120px;

  &.active {
    color: var(--el-color-primary);
  }

  .check-icon {
    margin-left: 8px;
  }
}

.provider-col {
  margin-bottom: 12px;
}

.provider-card {
  cursor: pointer;
  transition:
    border-color 0.2s,
    box-shadow 0.2s;

  &:hover {
    border-color: var(--el-color-primary);
  }

  .provider-card-inner {
    display: flex;
    align-items: center;
  }

  .provider-card-icon {
    display: inline-flex;
    flex-shrink: 0;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    margin-right: 8px;

    :deep(svg) {
      width: 100%;
      height: 100%;
    }
  }

  .provider-card-name {
    overflow: hidden;
    text-overflow: ellipsis;
    font-size: 14px;
    color: var(--el-text-color-primary);
    white-space: nowrap;
  }
}

.empty-col {
  padding: 32px 0;
  font-size: 14px;
  color: var(--el-text-color-secondary);
  text-align: center;
}
</style>
