<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';

import { Page } from '@vben/common-ui';

import { Plus, Refresh, Search } from '@element-plus/icons-vue';
import {
  ElButton,
  ElCol,
  ElEmpty,
  ElInput,
  ElOption,
  ElRow,
  ElScrollbar,
  ElSelect,
} from 'element-plus';

import {
  deleteModel,
  listProviderMetadata,
  pageModels,
} from '#/api/ai/models';

import CreateModelDialog from './component/CreateModelDialog.vue';
import EditModelDialog from './component/EditModelDialog.vue';
import ModelCard from './component/ModelCard.vue';
import ParamSettingDialog from './component/ParamSettingDialog.vue';
import ProviderList from './component/ProviderList.vue';
import SelectProviderDialog from './component/SelectProviderDialog.vue';
import { allProviderObj, modelTypeList } from './data';

interface Provider {
  icon?: string;
  name: string;
  provider: string;
}

interface Model {
  create_time?: string;
  credential?: any;
  id: number | string;
  meta?: { message?: string };
  model_name: string;
  model_type: string;
  name: string;
  nick_name?: string;
  provider: string;
  resource_count?: number;
  status: string;
}

const providerLoading = ref(false);
const modelLoading = ref(false);
const providerList = ref<Array<Provider>>([]);
const modelList = ref<Array<Model>>([]);
const activeProvider = ref<Provider>();

const searchType = ref('name');
const searchKeyword = ref('');
const modelTypeFilter = ref('');

const createModelRef = ref<InstanceType<typeof CreateModelDialog>>();
const selectProviderRef = ref<InstanceType<typeof SelectProviderDialog>>();
const editModelRef = ref<InstanceType<typeof EditModelDialog>>();
const paramSettingRef = ref<InstanceType<typeof ParamSettingDialog>>();

const isShared = computed(() => activeProvider.value?.provider === 'share');

const visibleModels = computed(() => {
  let result = modelList.value;
  if (
    activeProvider.value?.provider &&
    activeProvider.value.provider !== 'share'
  ) {
    result = result.filter(
      (m) => m.provider === activeProvider.value?.provider,
    );
  }
  const keyword = searchKeyword.value.trim().toLowerCase();
  if (keyword) {
    result = result.filter((m) =>
      [m.name, m.model_name, m.provider]
        .join(' ')
        .toLowerCase()
        .includes(keyword),
    );
  }
  if (modelTypeFilter.value) {
    result = result.filter((m) => m.model_type === modelTypeFilter.value);
  }
  return result;
});

const modelSplitList = computed(() => {
  const mid = Math.ceil(visibleModels.value.length / 2);
  return [visibleModels.value.slice(0, mid), visibleModels.value.slice(mid)];
});

function clickProvider(item: Provider) {
  activeProvider.value = item;
}

function updateModelById(modelId: string, model: Model) {
  modelList.value
    .filter((m) => String(m.id) === modelId)
    .forEach((m) => {
      m.status = model.status;
    });
}

function openCreateModel(provider?: Provider, modelType?: string) {
  if (provider && provider.provider) {
    createModelRef.value?.open(provider, modelType);
  } else {
    selectProviderRef.value?.open();
  }
}

function openEditModel(model: Model) {
  const provider = providerList.value.find(
    (p) => p.provider === model.provider,
  );
  if (provider) {
    editModelRef.value?.open(provider, model);
  }
}

function openParamSetting(model: Model) {
  paramSettingRef.value?.open(model);
}

function handleDeleteModel(model: Model) {
  deleteModel(model.id).then(() => {
    loadModels();
  });
}

function handleModelChange() {
  loadModels();
}

async function loadProviders() {
  providerLoading.value = true;
  try {
    // 对齐 MaxKB：供应商列表完全来自静态元数据注册表，不读 DB
    const res: any = await listProviderMetadata();
    const data = Array.isArray(res) ? res : (res?.data ?? []);
    providerList.value = data.filter((p: Provider) => p.provider);
  } catch {
    providerList.value = [];
  } finally {
    providerLoading.value = false;
  }
}

// loadProviderMetadata 已合并到 loadProviders，保留空函数避免调用方报错
async function loadProviderMetadata() {
  // no-op: 元数据已在 loadProviders 中加载
}

async function loadModels() {
  modelLoading.value = true;
  try {
    const res: any = await pageModels({ current: 1, page: 1, size: 200 });
    const records =
      res?.records ?? res?.data ?? (Array.isArray(res) ? res : []);
    modelList.value = records;
  } catch {
    modelList.value = [];
  } finally {
    modelLoading.value = false;
  }
}

async function refreshAll() {
  // 顺序执行：loadProviders 赋值覆盖，loadProviderMetadata 追加。
  // 并行时若 loadProviders 后 resolve 会清空 metadata 追加结果。
  await loadProviders();
  await loadProviderMetadata();
  await loadModels();
}

onMounted(() => {
  activeProvider.value = allProviderObj as Provider;
  refreshAll();
});
</script>

<template>
  <Page auto-content-height>
    <div class="model-manage">
      <!-- Left: Provider List -->
      <aside class="provider-sidebar">
        <ProviderList
          :data="providerList"
          :loading="providerLoading"
          :show-shared="false"
          :active="activeProvider"
          @click="clickProvider"
        />
      </aside>

      <!-- Right: Model List -->
      <main class="model-content">
        <div class="content-header">
          <h3>{{ activeProvider?.name || '全部模型' }}</h3>
        </div>

        <div class="search-bar">
          <ElSelect
            v-model="searchType"
            style="width: 120px"
            @change="searchType = $event"
          >
            <ElOption label="模型名称" value="name" />
            <ElOption label="模型类型" value="model_type" />
          </ElSelect>
          <ElInput
            v-if="searchType === 'name'"
            v-model="searchKeyword"
            clearable
            :prefix-icon="Search"
            placeholder="搜索模型名称"
            style="width: 220px"
          />
          <ElSelect
            v-else-if="searchType === 'model_type'"
            v-model="modelTypeFilter"
            clearable
            placeholder="全部类型"
            style="width: 220px"
          >
            <ElOption
              v-for="item in modelTypeList"
              :key="item.value"
              :label="item.label"
              :value="item.value"
            />
          </ElSelect>
          <ElButton :icon="Refresh" link @click="refreshAll" />
          <ElButton
            v-if="!isShared"
            :icon="Plus"
            type="primary"
            @click="openCreateModel()"
          >
            添加模型
          </ElButton>
        </div>

        <ElScrollbar class="model-scroll">
          <div v-if="visibleModels.length > 0" class="model-grid">
            <ElRow :gutter="15">
              <template v-for="(row, index) in modelSplitList" :key="index">
                <ElCol
                  v-for="model in row"
                  :key="String(model.id)"
                  :xs="24"
                  :sm="12"
                  :md="12"
                  :lg="8"
                  :xl="8"
                  class="mb-16"
                >
                  <ModelCard
                    :model="model"
                    :provider-list="providerList"
                    :update-model-by-id="updateModelById"
                    @change="handleModelChange"
                    @edit="openEditModel"
                    @delete="handleDeleteModel"
                    @param-setting="openParamSetting"
                  />
                </ElCol>
              </template>
            </ElRow>
          </div>
          <ElEmpty v-else description="暂无模型" />
        </ElScrollbar>
      </main>

      <!-- Dialogs -->
      <CreateModelDialog
        ref="createModelRef"
        @submit="handleModelChange"
        @change="openCreateModel()"
      />
      <SelectProviderDialog
        ref="selectProviderRef"
        @change="(provider, modelType) => openCreateModel(provider, modelType)"
      />
      <EditModelDialog ref="editModelRef" @submit="handleModelChange" />
      <ParamSettingDialog ref="paramSettingRef" />
    </div>
  </Page>
</template>

<style lang="scss" scoped>
.model-manage {
  display: grid;
  grid-template-columns: 280px minmax(0, 1fr);
  gap: 12px;
  height: 100%;
  overflow: hidden;
}

.provider-sidebar {
  display: flex;
  flex-direction: column;
  min-height: 0;
  overflow: hidden;
  background: hsl(var(--card));
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 6px;
}

.model-content {
  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
  background: hsl(var(--card));
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 6px;
}

.content-header {
  flex-shrink: 0;
  padding: 12px 16px;
  border-bottom: 1px solid var(--el-border-color-lighter);

  h3 {
    margin: 0;
    font-size: 18px;
    font-weight: 600;
  }
}

.search-bar {
  display: flex;
  flex-shrink: 0;
  gap: 8px;
  align-items: center;
  padding: 12px 16px;
  border-bottom: 1px solid var(--el-border-color-lighter);
}

.model-scroll {
  flex: 1;
  min-height: 0;
}

.model-grid {
  padding: 12px 16px;
}

.mb-16 {
  margin-bottom: 16px;
}
</style>
